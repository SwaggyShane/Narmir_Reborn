/**
 * Builds hex grid data for worldmap renderers (SVG and WebGL)
 * Shared utility to ensure both renderers use identical data
 */

import { hexCenter, HEX_SIZE, HEX_W, HEX_VERT } from './hexMap/HexGeometry.ts';

const RACE_HOMES = {
  dwarf: { x: 400, y: 488 },
  high_elf: { x: 1155, y: 340 },
  wood_elf: { x: 1599, y: 467 },
  vampire: { x: 933, y: 701 },
  ogre: { x: 1777, y: 828 },
  dark_elf: { x: 1243, y: 913 },
  orc: { x: 1555, y: 1040 },
  human: { x: 666, y: 913 },
  dire_wolf: { x: 289, y: 849 },
};

const RACE_TO_TERRAIN = {
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

const BIOME_MIX_ALTERNATES = {
  mountains: ['hills'],
  forest: ['hills', 'swamp'],
  hills: ['forest', 'plains'],
  plains: ['hills', 'forest'],
  swamp: ['forest', 'plains'],
};

const SOUTH_BAND_FRAC = 0.15;

function hexSeededRandom(col, row, channel, seed = 0) {
  const x = Math.sin(col * 12.9898 + row * 78.233 + channel * 45.164 + seed * 94.67) * 43758.5453;
  return x - Math.floor(x);
}

function oceanBandForColumn(col) {
  const oceanLatitude = 0.2;
  const oceanBandWidth = 0.08;
  const worldHeight = 1380;
  const startRow = Math.floor((oceanLatitude - oceanBandWidth / 2) * (worldHeight / HEX_VERT));
  const endRow = Math.floor((oceanLatitude + oceanBandWidth / 2) * (worldHeight / HEX_VERT));
  return { start: startRow, end: endRow };
}

function nearestRaceHome(x, y) {
  let nearest = null;
  let nearestDist = Infinity;
  Object.entries(RACE_HOMES).forEach(([race, home]) => {
    const dx = x - home.x;
    const dy = y - home.y;
    const dist = dx * dx + dy * dy;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = race;
    }
  });
  return nearest || 'human';
}

export function buildHexGrid(W = 1999, H = 1380, worldSeed = 0) {
  const cols = Math.ceil(W / HEX_W) + 2;
  const rows = Math.ceil(H / HEX_VERT) + 2;
  const cells = [];
  const cellMap = new Map();

  // Build cells
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
        terrain = hexSeededRandom(col, row, 3, worldSeed) < 0.55 ? 'desert' : 'volcanic';
      } else {
        const dominant = RACE_TO_TERRAIN[race] || 'plains';
        if (hexSeededRandom(col, row, 1, worldSeed) < 0.7) {
          terrain = dominant;
        } else {
          const alternates = BIOME_MIX_ALTERNATES[dominant] || ['plains'];
          terrain = alternates[Math.floor(hexSeededRandom(col, row, 2, worldSeed) * alternates.length)];
        }
      }

      const cell = { col, row, x, y, race, terrain };
      cells.push(cell);
      cellMap.set(`${col},${row}`, cell);
    }
  }

  return { cells, cellMap, W, H };
}

export { RACE_HOMES, RACE_TO_TERRAIN };
