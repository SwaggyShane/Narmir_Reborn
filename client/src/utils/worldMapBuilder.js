/**
 * Builds hex grid data for worldmap renderers (SVG and WebGL)
 * Shared utility to ensure both renderers use identical data
 */

import { hexCenter, hexCorners, HEX_SIZE, HEX_W, HEX_VERT } from './hexMap/HexGeometry.ts';

// Hex neighbor directions and edge corners for odd-r offset
const ODDR_DIRECTIONS = [
  [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]],
  [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]],
];

const DIRECTION_EDGE_CORNERS = [
  [0, 1], // E
  [5, 0], // NE
  [4, 5], // NW
  [3, 4], // W
  [2, 3], // SW
  [1, 2], // SE
];

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

const ALL_BIOMES = ['plains', 'forest', 'mountains', 'hills', 'swamp', 'desert'];

const SOUTH_BAND_FRAC = 0.15;

function hexSeededRandom(col, row, channel, seed = 0) {
  const x = Math.sin(col * 12.9898 + row * 78.233 + channel * 45.164 + seed * 94.67) * 43758.5453;
  return x - Math.floor(x);
}

function stringHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
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

function hexNeighborKeys(col, row) {
  const parity = row & 1;
  return ODDR_DIRECTIONS[parity].map(([dc, dr]) => `${col + dc},${row + dr}`);
}

function bfsRiverPath(start, target, cellMap, allowCell) {
  const startKey = `${start.col},${start.row}`;
  const targetKey = `${target.col},${target.row}`;
  if (startKey === targetKey) return [];

  const cameFrom = new Map();
  const visited = new Set([startKey]);
  const queue = [start];
  let head = 0;
  while (head < queue.length) {
    const current = queue[head];
    head++;
    if (`${current.col},${current.row}` === targetKey) break;
    const neighborKeys = hexNeighborKeys(current.col, current.row);
    neighborKeys.forEach((key, dirIndex) => {
      if (visited.has(key)) return;
      const nb = cellMap.get(key);
      if (!nb) return;
      if (allowCell && nb !== target && !allowCell(nb)) return;
      visited.add(key);
      cameFrom.set(key, { from: current, dirIndex });
      queue.push(nb);
    });
  }

  if (!cameFrom.has(targetKey)) return null;

  const edges = [];
  let currentKey = targetKey;
  while (currentKey !== startKey) {
    const step = cameFrom.get(currentKey);
    const to = cellMap.get(currentKey);
    edges.unshift({
      from: step.from,
      to,
      dirIndex: step.dirIndex,
      key: [`${step.from.col},${step.from.row}`, currentKey].sort().join('|'),
    });
    currentKey = `${step.from.col},${step.from.row}`;
  }
  return edges;
}

function buildRegionAdjacency(cells, cellMap) {
  const adjacentPairs = new Set();
  cells.forEach((cell) => {
    hexNeighborKeys(cell.col, cell.row).forEach((key) => {
      const nb = cellMap.get(key);
      if (nb && nb.race !== cell.race) {
        adjacentPairs.add([cell.race, nb.race].sort().join('|'));
      }
    });
  });
  return adjacentPairs;
}

function buildRegionMST(races, adjacentPairs) {
  const mstEdges = [];
  const visited = new Set([races[0]]);
  const remaining = new Set(races.slice(1));

  const homeDistSq = (a, b) => {
    const ha = RACE_HOMES[a];
    const hb = RACE_HOMES[b];
    return (ha.x - hb.x) ** 2 + (ha.y - hb.y) ** 2;
  };

  while (remaining.size > 0) {
    let bestAdjacent = null;
    let bestAdjacentDist = Infinity;
    let bestAny = null;
    let bestAnyDist = Infinity;

    visited.forEach((a) => {
      remaining.forEach((b) => {
        const dist = homeDistSq(a, b);
        if (dist < bestAnyDist) {
          bestAnyDist = dist;
          bestAny = [a, b];
        }
        if (adjacentPairs.has([a, b].sort().join('|')) && dist < bestAdjacentDist) {
          bestAdjacentDist = dist;
          bestAdjacent = [a, b];
        }
      });
    });

    const chosen = bestAdjacent || bestAny;
    if (!chosen) break;
    mstEdges.push(chosen);
    visited.add(chosen[1]);
    remaining.delete(chosen[1]);
  }
  return mstEdges;
}

function buildRiverNetwork(cells, cellMap, lakeByRace) {
  const riverSegments = [];
  const visitedEdges = new Set();
  const waterGraph = new Map();

  const isWaterTerrain = (t) => t === 'lake' || t === 'ocean' || t === 'swamp';

  const addSegment = (edge, kind) => {
    if (visitedEdges.has(edge.key)) return;
    visitedEdges.add(edge.key);
    // Whichever endpoint is lake/ocean/swamp stops at the shared border
    // instead of reaching that cell's center — a river should visibly meet
    // the water, not run on top of it. Unlike lake/ocean (excluded from
    // isLand below, so never an intermediate hop), swamp is still passable
    // land for pathfinding, so a path can cross several consecutive swamp
    // cells — both sides of that inner hop count as "water" and neither
    // gets snapped here. Renderers skip drawing swamp-to-swamp segments
    // entirely instead (fromTerrain/toTerrain below), so the river still
    // visibly stops at the first swamp edge rather than crossing every
    // swamp cell it happens to pass through in a straight center-to-center
    // line.
    const fromWater = isWaterTerrain(edge.from.terrain);
    const toWater = isWaterTerrain(edge.to.terrain);
    let p1 = [edge.from.x, edge.from.y];
    let p2 = [edge.to.x, edge.to.y];
    if (fromWater !== toWater) {
      const corners = hexCorners(edge.from.x, edge.from.y, HEX_SIZE);
      const edgeCorners = DIRECTION_EDGE_CORNERS[edge.dirIndex];
      const c1 = corners[edgeCorners[0]];
      const c2 = corners[edgeCorners[1]];
      const mid = [(c1[0] + c2[0]) / 2, (c1[1] + c2[1]) / 2];
      if (fromWater) p1 = mid;
      if (toWater) p2 = mid;
    }
    riverSegments.push({ p1, p2, kind, fromTerrain: edge.from.terrain, toTerrain: edge.to.terrain });
    const fromKey = `${edge.from.col},${edge.from.row}`;
    const toKey = `${edge.to.col},${edge.to.row}`;
    if (!waterGraph.has(fromKey)) waterGraph.set(fromKey, new Set());
    if (!waterGraph.has(toKey)) waterGraph.set(toKey, new Set());
    waterGraph.get(fromKey).add(toKey);
    waterGraph.get(toKey).add(fromKey);
  };

  const isLand = (cell) => cell.terrain !== 'lake' && cell.terrain !== 'ocean';

  const oceanCells = cells.filter((c) => c.terrain === 'ocean');
  const coastalOceanCells = oceanCells.filter((oc) => hexNeighborKeys(oc.col, oc.row).some((key) => {
    const nb = cellMap.get(key);
    return nb && isLand(nb);
  }));

  Object.keys(lakeByRace).forEach((race) => {
    const lake = lakeByRace[race];
    const home = RACE_HOMES[race];
    let nearestOcean = null;
    let nearestDist = Infinity;
    coastalOceanCells.forEach((oc) => {
      const dist = (oc.x - home.x) ** 2 + (oc.y - home.y) ** 2;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestOcean = oc;
      }
    });
    if (!nearestOcean) return;

    const edges = bfsRiverPath(nearestOcean, lake, cellMap, isLand);
    if (edges) edges.forEach((edge) => addSegment(edge, 'tributary'));
  });

  const races = Object.keys(lakeByRace);
  const adjacentPairs = buildRegionAdjacency(cells, cellMap);
  const mstEdges = buildRegionMST(races, adjacentPairs);
  mstEdges.forEach(([raceA, raceB]) => {
    const edges = bfsRiverPath(lakeByRace[raceA], lakeByRace[raceB], cellMap, isLand);
    if (edges) edges.forEach((edge) => addSegment(edge, 'trunk'));
  });

  return { riverSegments, waterGraph };
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
        // Predominant biome fill — the "at least one of every other biome"
        // guarantee is applied in a second pass below, once every cell's
        // race/dominant terrain is known. No percentage roll here.
        terrain = RACE_TO_TERRAIN[race] || 'plains';
      }

      const cell = { col, row, x, y, race, terrain };
      cells.push(cell);
      cellMap.set(`${col},${row}`, cell);
    }
  }

  // Guarantee every region contains at least one hex of every other biome
  // (excluding tundra/ocean/volcanic, which are fixed by row-band position,
  // not region biome). Deterministically reassign one dominant-biome cell
  // per missing biome per race, seeded so the same world seed always picks
  // the same cells.
  Object.keys(RACE_HOMES).forEach((race) => {
    const dominant = RACE_TO_TERRAIN[race] || 'plains';
    const eligible = cells.filter((c) => c.race === race && c.terrain === dominant);
    const raceHash = stringHash(race);

    ALL_BIOMES.filter((b) => b !== dominant).forEach((biome, idx) => {
      if (eligible.length === 0) return;
      const pick = Math.floor(hexSeededRandom(raceHash, idx, 5, worldSeed) * eligible.length);
      eligible[pick].terrain = biome;
      eligible.splice(pick, 1);
    });
  });

  // Generate lakes - one per race. The real requirement is water access
  // (a lake, a river, or direct ocean frontage all satisfy it), not
  // literally owning a lake cell: a region whose territory already
  // borders the ocean has water access on its own, so a lake there is
  // opportunistic, not required. A region with no direct ocean access
  // MUST get one — hardened with a relaxed fallback so it can never
  // silently end up with neither.
  const touchesOcean = (c) => hexNeighborKeys(c.col, c.row).some((key) => {
    const nb = cellMap.get(key);
    return nb && nb.terrain === 'ocean';
  });

  const lakeByRace = {};
  Object.keys(RACE_HOMES).forEach((race) => {
    const home = RACE_HOMES[race];
    const dominant = RACE_TO_TERRAIN[race] || 'plains';
    const raceCells = cells.filter((c) => c.race === race);
    const hasDirectOceanAccess = raceCells.some((c) => c.terrain === 'ocean' || touchesOcean(c));

    const findBest = (allowCoastal) => {
      let best = null;
      let bestDist = Infinity;
      raceCells.forEach((c) => {
        // Restricted to still-dominant-biome cells only: the biome
        // guarantee above deliberately converted a handful of cells to
        // each of the region's other biomes, and with only one guaranteed
        // cell per biome, this search picking one of those as the lake
        // (it's just "closest to home", with no awareness of that
        // reservation) would silently erase that biome from the region
        // entirely. A dominant-biome cell can't cannibalize anything —
        // there are dozens left after converting only 5 of them.
        if (c.terrain !== dominant) return;
        if (!allowCoastal && touchesOcean(c)) return;
        const dx = c.x - home.x;
        const dy = c.y - home.y;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = c;
        }
      });
      return best;
    };

    let best = findBest(false);
    if (!best && !hasDirectOceanAccess) {
      best = findBest(true);
    }
    if (best) {
      best.terrain = 'lake';
      lakeByRace[race] = best;
    }
  });

  // Generate rivers
  const network = buildRiverNetwork(cells, cellMap, lakeByRace);

  return { cells, cellMap, W, H, riverSegments: network.riverSegments, waterGraph: network.waterGraph, lakeByRace };
}

export { RACE_HOMES, RACE_TO_TERRAIN };
