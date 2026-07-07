// Terrain utilities for worldmap rendering (shared between WorldmapRenderer and HexSelectionModal)

// Import hex geometry from hexMap library (consolidation from Phase 1)
import { hexCenter, hexCorners, HEX_SIZE, HEX_W, HEX_VERT } from './hexMap/HexGeometry.ts';

// Re-export for backward compatibility
export { hexCenter, hexCorners, HEX_SIZE, HEX_W, HEX_VERT };

export const RACE_TO_TERRAIN = {
  dwarf: 'mountains',
  high_elf: 'forest',
  wood_elf: 'forest',
  orc: 'plains',
  human: 'plains',
  dire_wolf: 'hills',
  vampire: 'swamp',
  dark_elf: 'hills',
  ogre: 'mountains',
};

export const TERRAIN_COLORS = {
  plains: '#556b2f',
  forest: '#2d4a2d',
  mountains: '#5c4033',
  hills: '#6b5b3f',
  swamp: '#3a3f2a',
  desert: '#8b7355',
  coast: '#3a5f7a',
  tundra: '#7a8a94',
  volcanic: '#7a2e1a',
  lake: '#2a5f8a',
  ocean: '#0d3a5c',
};

const BIOME_MIX_ALTERNATES = {
  mountains: ['hills', 'forest'],
  forest: ['hills', 'swamp'],
  plains: ['hills', 'coast'],
  hills: ['plains', 'forest', 'mountains'],
  swamp: ['forest', 'coast'],
  desert: ['hills', 'volcanic'],
  coast: ['plains', 'swamp'],
};

const RACE_HOMES = {
  dwarf: { x: 180, y: 230 },
  high_elf: { x: 520, y: 160 },
  wood_elf: { x: 720, y: 220 },
  vampire: { x: 420, y: 330 },
  ogre: { x: 800, y: 390 },
  dark_elf: { x: 560, y: 430 },
  orc: { x: 700, y: 490 },
  human: { x: 300, y: 430 },
  dire_wolf: { x: 130, y: 400 },
};

const OCEAN_BASE_ROW = 2;
const OCEAN_THICKNESS = 2;
const SOUTH_BAND_FRAC = 0.15;

export function hexSeededRandom(col, row, salt, worldSeed = 0) {
  let t = (col * 374761393 + row * 668265263 + salt * 2654435761 + worldSeed * 40503) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function seedToInt32(worldSeed) {
  if (worldSeed === null || worldSeed === undefined) return 0;
  try {
    return Number(BigInt(worldSeed) % 2147483647n);
  } catch {
    return 0;
  }
}


function oceanBandForColumn(col) {
  const wave = Math.sin(col * 0.35) * 1.0 + Math.sin(col * 0.9 + 1.3) * 0.4;
  const start = Math.round(OCEAN_BASE_ROW + wave);
  return { start, end: start + OCEAN_THICKNESS };
}

function nearestRaceHome(x, y) {
  let best = null;
  let bestDist = Infinity;
  Object.entries(RACE_HOMES).forEach(([race, home]) => {
    const dx = x - home.x;
    const dy = y - home.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = race;
    }
  });
  return best || 'human';
}

export function buildHexGrid(W, H, worldSeed = 0) {
  const cols = Math.ceil(W / HEX_W) + 2;
  const rows = Math.ceil(H / HEX_VERT) + 2;
  const cells = [];
  const cellMap = new Map();
  const seedInt = seedToInt32(worldSeed);

  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const { x, y } = hexCenter(col, row);
      if (x < -HEX_W || x > W + HEX_W || y < -HEX_VERT || y > H + HEX_VERT) continue;

      const race = nearestRaceHome(x, y);
      const oceanBand = oceanBandForColumn(col);
      let terrain;
      if (row < oceanBand.start) {
        terrain = 'tundra';
      } else if (row < oceanBand.end) {
        terrain = 'ocean';
      } else if (y > H * (1 - SOUTH_BAND_FRAC)) {
        terrain = hexSeededRandom(col, row, 3, seedInt) < 0.55 ? 'desert' : 'volcanic';
      } else {
        const dominant = RACE_TO_TERRAIN[race] || 'plains';
        if (hexSeededRandom(col, row, 1, seedInt) < 0.7) {
          terrain = dominant;
        } else {
          const alternates = BIOME_MIX_ALTERNATES[dominant] || ['plains'];
          terrain = alternates[Math.floor(hexSeededRandom(col, row, 2, seedInt) * alternates.length)];
        }
      }

      const cell = { col, row, x, y, race, terrain };
      cells.push(cell);
      cellMap.set(`${col},${row}`, cell);
    }
  }

  return { cells, cellMap };
}
