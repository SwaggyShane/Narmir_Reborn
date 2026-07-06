import { REGION_META, REGION_BONUSES } from '../../utils/raceData.js';
import { escapeHtml } from '../../utils/escapeHtml.js';
import { NODE_TYPE_META, getNodeRadius } from '../../utils/worldMapNodeMeta.js';

function regionOpacity(race, highlightedRace, dim = '0.3') {
  if (!highlightedRace) return '1';
  return race === highlightedRace ? '1' : dim;
}

const DEFAULT_LAYERS = {
  kingdoms: true,
  nodes: true,
  routes: true,
  expeditions: true,
  terrain: false,
};

// Bootstrap race -> dominant biome mapping — kept in sync with game/terrain.js RACE_TO_TERRAIN.
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

const TERRAIN_COLORS = {
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

const TERRAIN_DISPLAY_NAMES = {
  plains: 'Plains',
  forest: 'Forest',
  mountains: 'Mountains',
  hills: 'Hills',
  swamp: 'Swamp',
  desert: 'Desert',
  coast: 'Coast',
  tundra: 'Tundra',
  volcanic: 'Volcanic',
  lake: 'Lake',
  ocean: 'Ocean',
};

// Expedition speed modifier per terrain — kept in sync with game/terrain.js TERRAIN_DATA.
// Shown in the map tooltip since it's the modifier Phase 2 actually wires into gameplay.
const TERRAIN_EXP_SPEED = {
  plains: 1.12,
  forest: 0.92,
  mountains: 0.80,
  hills: 0.95,
  swamp: 0.78,
  desert: 0.88,
  coast: 1.05,
  tundra: 0.75,
  volcanic: 0.70,
  lake: 0.60,
  ocean: 0.55,
};

function terrainTooltip(terrain) {
  const name = TERRAIN_DISPLAY_NAMES[terrain] || 'Plains';
  const speed = TERRAIN_EXP_SPEED[terrain] ?? 1.0;
  const pct = Math.round((speed - 1) * 100);
  const speedLabel = pct === 0 ? 'no change' : `${pct > 0 ? '+' : ''}${pct}% expedition speed`;
  return `${name} — ${speedLabel}`;
}

function layerVisibilityStyle(enabled) {
  return enabled ? '' : 'opacity:0;pointer-events:none';
}

// Blends a hex color toward white by `amount` (0-1). Used so the terrain-off
// region fill is a visibly lighter shade of the race color, distinct from the
// brighter, unlightened stroke color used for borders. Only handles literal
// #rrggbb strings (all REGION_META fill colors are); anything else (e.g. a
// CSS var used for some stroke colors) is returned unchanged.
function lightenHexColor(hex, amount) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!match) return hex;
  const num = parseInt(match[1], 16);
  const channels = [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff]
    .map((c) => Math.round(c + (255 - c) * amount));
  return '#' + channels.map((c) => c.toString(16).padStart(2, '0')).join('');
}

// Blends a hex color toward black by `amount` (0-1). Used for region title
// text so it reads as a darker shade of the region's own color rather than
// plain white, while staying visible against any biome fill underneath.
function darkenHexColor(hex, amount) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!match) return hex;
  const num = parseInt(match[1], 16);
  const channels = [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff]
    .map((c) => Math.round(c * (1 - amount)));
  return '#' + channels.map((c) => c.toString(16).padStart(2, '0')).join('');
}

// Splits a region name onto two lines at whichever space is closest to the
// middle, so long names ("The Nightfall Marshes") fit inside a hex region
// instead of overflowing it. Short names are left on one line.
function wrapRegionName(name) {
  if (!name || name.length <= 14) return [name || ''];
  const spaceIndices = [];
  for (let i = 0; i < name.length; i++) {
    if (name[i] === ' ') spaceIndices.push(i);
  }
  if (!spaceIndices.length) return [name];
  const mid = name.length / 2;
  let best = spaceIndices[0];
  spaceIndices.forEach((idx) => {
    if (Math.abs(idx - mid) < Math.abs(best - mid)) best = idx;
  });
  return [name.slice(0, best), name.slice(best + 1)];
}

// ── World map region layout ─────────────────────────────────────────────────
// Every race's "home" seed point on the 1999x1380 canvas. The hex grid below
// assigns each tile to whichever race's home is nearest, so regions tile the
// whole map with no gaps or overlaps by construction. To add a future race:
// add one entry here, one to RACE_TO_TERRAIN above, and one to REGION_META /
// REGION_BONUSES in raceData.js — no other changes needed.
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

// Regions where a dominant biome, when it isn't chosen, can plausibly bleed
// into an adjacent patch instead (keeps mixed biomes thematically coherent
// rather than fully random).
const BIOME_MIX_ALTERNATES = {
  mountains: ['hills', 'forest'],
  forest: ['hills', 'swamp'],
  plains: ['hills', 'coast'],
  hills: ['plains', 'forest', 'mountains'],
  swamp: ['forest', 'coast'],
  desert: ['hills', 'volcanic'],
  coast: ['plains', 'swamp'],
};

const HEX_SIZE = 34; // center-to-corner radius
const HEX_W = Math.sqrt(3) * HEX_SIZE;
const HEX_VERT = HEX_SIZE * 1.5;
const SOUTH_BAND_FRAC = 0.15; // bottom strip of the map -> desert/volcanic

const OCEAN_BASE_ROW = 2;
const OCEAN_THICKNESS = 2; // rows — a strait, not a sea consuming the map

// The sea dividing tundra from every other region. A gently wobbling
// coastline (two smooth, low-frequency sine waves, not independent
// per-column noise) rather than one straight line — bounded (max slope well
// under the band thickness) so adjacent columns' bands always overlap by at
// least a row, which is what actually guarantees the ocean stays one
// connected body of water rather than random per-column jitter accidentally
// splitting it into disconnected pockets.
function oceanBandForColumn(col) {
  const wave = Math.sin(col * 0.35) * 1.0 + Math.sin(col * 0.9 + 1.3) * 0.4;
  const start = Math.round(OCEAN_BASE_ROW + wave);
  return { start, end: start + OCEAN_THICKNESS };
}

// Deterministic per-cell "random" value so the map's biome mix is stable
// across re-renders instead of reshuffling on every data refresh. worldSeed
// (Fog of War Phase 1.5) folds the current world's generation seed into the
// mix so biome patterns differ across resets too, not just kingdom/node
// placement — without it, every world would render the exact same terrain
// layout even though kingdoms/nodes now randomize.
function hexSeededRandom(col, row, salt, worldSeed = 0) {
  let t = (col * 374761393 + row * 668265263 + salt * 2654435761 + worldSeed * 40503) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Folds a BigInt/string/number world seed (arbitrary precision, arrives
// from the server as a string since JSON can't carry BigInt) into a 32-bit
// safe integer for hexSeededRandom's mixing — same approach as
// game/world-map-coords.js's seedAsInt32, kept independent here since this
// file is a browser-only bundle that doesn't share code with the server.
function seedToInt32(worldSeed) {
  if (worldSeed === null || worldSeed === undefined) return 0;
  try {
    return Number(BigInt(worldSeed) % 2147483647n);
  } catch {
    return 0;
  }
}

function hexCenter(col, row) {
  const x = col * HEX_W + (row % 2 !== 0 ? HEX_W / 2 : 0);
  const y = row * HEX_VERT;
  return { x, y };
}

function hexCorners(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push([
      Math.round((cx + size * Math.cos(angle)) * 10) / 10,
      Math.round((cy + size * Math.sin(angle)) * 10) / 10,
    ]);
  }
  return pts;
}

function hexPath(cx, cy, size) {
  const pts = hexCorners(cx, cy, size);
  return 'M' + pts.map((p) => p.join(',')).join('L') + 'Z';
}

// Client-side copy of cellIndex logic (matches server game/visibility-cells.js)
// for determining per-hex fog state from the visibility bitmaps provided by /world-map.
const CLIENT_CELL_INDEX_OFFSET = 8;
const CLIENT_CELL_INDEX_STRIDE = 48;
function clientCellIndex(col, row) {
  const colShifted = col + CLIENT_CELL_INDEX_OFFSET;
  const rowShifted = row + CLIENT_CELL_INDEX_OFFSET;
  if (colShifted < 0 || colShifted >= CLIENT_CELL_INDEX_STRIDE || rowShifted < 0) return -1;
  return rowShifted * CLIENT_CELL_INDEX_STRIDE + colShifted;
}
function isHexSeen(col, row, seenBig) {
  const idx = clientCellIndex(col, row);
  if (idx < 0 || !seenBig) return false;
  return (seenBig & (1n << BigInt(idx))) !== 0n;
}
function isHexCurrent(col, row, currentBig) {
  const idx = clientCellIndex(col, row);
  if (idx < 0 || !currentBig) return false;
  return (currentBig & (1n << BigInt(idx))) !== 0n;
}

// odd-r offset neighbor directions (pointy-top hexes), indexed by row parity.
// Direction order is E, NE, NW, W, SW, SE — this order is fixed regardless of
// row parity, which is what makes DIRECTION_EDGE_CORNERS below valid for both.
const ODDR_DIRECTIONS = [
  [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]],
  [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]],
];

// For hexCorners' angle formula (60*i - 30), corner i is: 0=E-ish upper,
// 1=lower-right, 2=bottom, 3=lower-left, 4=upper-left, 5=top. Each of the six
// neighbor directions above corresponds to exactly one edge (pair of adjacent
// corners) — this lets us draw only the true shared edge between two
// differently-raced cells instead of a whole hex ring per border cell.
const DIRECTION_EDGE_CORNERS = [
  [0, 1], // E
  [5, 0], // NE
  [4, 5], // NW
  [3, 4], // W
  [2, 3], // SW
  [1, 2], // SE
];

function hexNeighborKeys(col, row) {
  const parity = row & 1;
  return ODDR_DIRECTIONS[parity].map(([dc, dr]) => `${col + dc},${row + dr}`);
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

// Builds the full hex tessellation: every cell gets a race (for border/legend
// coloring) and a terrain (dominant race biome, an occasional mixed-in
// alternate, or a forced tundra/desert/volcanic band at the map's edges).
function buildHexGrid(W, H, worldSeed = 0) {
  const cols = Math.ceil(W / HEX_W) + 2;
  const rows = Math.ceil(H / HEX_VERT) + 2;
  const cells = [];
  const cellMap = new Map();

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

  // One lake per region: the cell nearest that race's home point (guaranteed
  // to belong to that race, since it's the same point the Voronoi assignment
  // above is measured from) is overridden to lake terrain, regardless of what
  // biome mix would otherwise have put there. Explicitly excludes ocean/
  // tundra cells — a race's home can end up geometrically close to that
  // latitude band, and picking one of those cells as the lake would steal a
  // tile from the ocean, breaking its contiguity as one connected body. Also
  // excludes any cell touching an ocean tile: a lake directly beside the
  // ocean reads as the same body of water split by an arbitrary terrain
  // label, not two distinct features.
  const lakeByRace = {};
  Object.keys(RACE_HOMES).forEach((race) => {
    const home = RACE_HOMES[race];
    let best = null;
    let bestDist = Infinity;
    cells.forEach((c) => {
      if (c.race !== race) return;
      if (c.terrain === 'ocean' || c.terrain === 'tundra') return;
      const touchesOcean = hexNeighborKeys(c.col, c.row).some((key) => {
        const nb = cellMap.get(key);
        return nb && nb.terrain === 'ocean';
      });
      if (touchesOcean) return;
      const dx = c.x - home.x;
      const dy = c.y - home.y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    });
    if (best) {
      best.terrain = 'lake';
      lakeByRace[race] = best;
    }
  });

  const network = buildRiverNetwork(cells, cellMap, lakeByRace);

  return { cells, cellMap, riverSegments: network.riverSegments, waterGraph: network.waterGraph };
}

// Shortest hex-to-hex path between two cells via BFS — guaranteed to find a
// route whenever one exists through cells `allowCell` accepts. An earlier
// version used a greedy-with-randomness heuristic walk instead; that could
// wander/oscillate near a multi-region junction and silently fail to
// converge within a fixed step budget, which once left 6 of 9 regions
// disconnected from the water network despite looking plausible on the
// rendered map. Every water connection that connectivity depends on (region
// tributaries reaching the ocean, trunk roadways between regions) now uses
// this instead. `allowCell(cell)` optionally restricts which cells the path
// may pass through (e.g. "ocean or this region's own territory"); omit it to
// allow any cell.
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

  if (!cameFrom.has(targetKey)) return null; // unreachable given this filter

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

// Every pair of races whose territories physically touch (share at least one
// hex edge) — this is the graph a minimum spanning tree gets built over, so
// trunk rivers only ever connect regions that are actually adjacent, the way
// a real waterway would.
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

// Minimum spanning tree over the region-adjacency graph (Prim's algorithm,
// edge weight = distance between the two races' home points). A spanning
// tree is the minimal structure that still guarantees every region is
// reachable from every other — exactly what "a navy needs to reach every
// region" requires, without redundant connections. Falls back to connecting
// via raw distance if two remaining groups somehow share no adjacency
// (shouldn't happen since the tessellation is one contiguous map, but keeps
// this from ever failing to fully connect the graph).
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
    // Prefer the nearest pair that's actually physically adjacent; only fall
    // back to the nearest pair overall if no adjacent option exists at all
    // (shouldn't happen on one contiguous tessellation, but keeps this from
    // ever failing to connect every region).
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

// Builds the full navigable water network: a short local tributary or two per
// region feeding its own lake, plus trunk rivers along a minimum spanning
// tree over region adjacency so every region's lake is connected to every
// other by some path — the "roadway" a future navy can traverse end to end.
function buildRiverNetwork(cells, cellMap, lakeByRace) {
  const riverSegments = [];
  const visitedEdges = new Set();
  const waterGraph = new Map(); // "col,row" -> Set of connected "col,row" neighbor keys

  const isWaterTerrain = (t) => t === 'lake' || t === 'ocean';

  const addSegment = (edge, kind) => {
    if (visitedEdges.has(edge.key)) return;
    visitedEdges.add(edge.key);
    // Center-to-center, not the shared hex-boundary chord: a path that goes
    // "straight" through a hex enters and exits on opposite (non-adjacent)
    // edges of that hex, so consecutive boundary-chords don't share an
    // endpoint and the drawn line fragments into disconnected dashes. Two
    // cell centers are always connectable regardless of the path's turn
    // angle, which is what a continuous, always-connected river needs.
    // Exception: whichever endpoint is a lake/ocean cell stops at the
    // shared border instead of reaching all the way to that cell's center —
    // a river should visibly meet the lake/ocean, not get drawn on top of
    // it. The two cells are never both water (the isLand filter below
    // guarantees that for every hop except the case of two directly
    // adjacent lakes, handled separately).
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
    riverSegments.push({ p1, p2, kind });
    const fromKey = `${edge.from.col},${edge.from.row}`;
    const toKey = `${edge.to.col},${edge.to.row}`;
    if (!waterGraph.has(fromKey)) waterGraph.set(fromKey, new Set());
    if (!waterGraph.has(toKey)) waterGraph.set(toKey, new Set());
    waterGraph.get(fromKey).add(toKey);
    waterGraph.get(toKey).add(fromKey);
  };

  // A river only touches water at its two intended endpoints — the ocean
  // cell it originates from, or the lake it ends at — never passing through
  // some other, unrelated lake or extra ocean tile along the way. Both
  // tributaries and trunk connectors route through this filter; the target
  // itself is always exempt (bfsRiverPath never re-checks it), so the
  // destination lake is reachable even though its own terrain is 'lake'.
  const isLand = (cell) => cell.terrain !== 'lake' && cell.terrain !== 'ocean';

  // Tributaries: every region's lake gets a guaranteed path back to the
  // shared ocean, entering from whichever ocean cell is nearest that
  // region's home point AND already borders land — so the path's very first
  // hop leaves the ocean, instead of potentially needing to cross a second
  // ocean tile first (which the isLand filter above would otherwise block,
  // silently failing the whole tributary). Only regions bordering the ocean
  // band directly (roughly a third of them, on this map's geometry) have
  // territory that touches it, so a same-region-only path is unreachable for
  // everyone else and silently produces zero tributary — letting the path
  // cross intervening regions' land is also just realistic: real rivers flow
  // through multiple territories before reaching the sea.
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

  // Trunk connectors: a minimum spanning tree over region adjacency, so every
  // region's lake is also directly reachable from every physically-adjacent
  // region without routing all the way up to the ocean — the "distinct
  // roadway" between two regions, layered on top of (not instead of) the
  // shared ocean network above.
  const races = Object.keys(lakeByRace);
  const adjacentPairs = buildRegionAdjacency(cells, cellMap);
  const mstEdges = buildRegionMST(races, adjacentPairs);
  mstEdges.forEach(([raceA, raceB]) => {
    const edges = bfsRiverPath(lakeByRace[raceA], lakeByRace[raceB], cellMap, isLand);
    if (edges) edges.forEach((edge) => addSegment(edge, 'trunk'));
  });

  return { riverSegments, waterGraph };
}

export function renderWorldMap(
  kingdoms,
  routes = [],
  highlightedRace = null,
  kingdomId = null,
  options = {},
) {
  const nodes = options.nodes || [];
  const expeditions = options.expeditions || [];
  const layers = { ...DEFAULT_LAYERS, ...(options.layers || {}) };
  const worldSeed = seedToInt32(options.worldSeed);
  const vis = options.visibility || null;
  let seenBig = 0n;
  let currentBig = 0n;
  if (vis) {
    try { seenBig = BigInt(vis.seenCells || '0'); } catch {}
    try { currentBig = BigInt(vis.currentCells || '0'); } catch {}
  }
  const state = {
    kingdomId,
  };

        var W = 1999,

          H = 1380;

        var bg = "url(#oceanGrad)";



        // Build SVG

        var svg =

          '<svg viewBox="0 0 ' +

          W +

          " " +

          H +

          '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block;border-radius:12px;box-shadow:inset 0 0 40px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5); background:#040710;">';
        // Defs - filters and gradients
        svg +=

          "<defs>" +

          '<linearGradient id="oceanGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#050a18"/><stop offset="50%" stop-color="#091225"/><stop offset="100%" stop-color="#03050c"/></linearGradient>' +

          '<radialGradient id="vignette" cx="50%" cy="50%" r="75%"><stop offset="40%" stop-color="transparent"/><stop offset="100%" stop-color="rgba(0,0,0,0.85)"/></radialGradient>' +

          '<filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +

          '<filter id="softglow"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +

          '<filter id="uiShadow"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.9"/></filter>' +

          "</defs>";



        // Background

        svg += '<rect width="' + W + '" height="' + H + '" fill="' + bg + '"/>';



        svg += '<g stroke="rgba(255,255,255,0.03)" stroke-width="1">';

        for (var gx = 0; gx < W; gx += 60)

          svg +=

            '<line x1="' + gx + '" y1="0" x2="' + gx + '" y2="' + H + '"/>';

        for (var gy = 0; gy < H; gy += 60)

          svg +=

            '<line x1="0" y1="' + gy + '" x2="' + W + '" y2="' + gy + '"/>';

        svg += "</g>";



        var rhumbs = [

          [W * 0.15, H * 0.2],

          [W * 0.85, H * 0.25],

          [W * 0.5, H * 0.85],

        ];

        rhumbs.forEach(function (pt) {

          svg +=

            '<circle cx="' +

            pt[0] +

            '" cy="' +

            pt[1] +

            '" r="800" stroke="rgba(255,255,255,0.015)" stroke-width="1" fill="none"/>';

          svg +=

            '<circle cx="' +

            pt[0] +

            '" cy="' +

            pt[1] +

            '" r="400" stroke="rgba(255,255,255,0.015)" stroke-width="1" fill="none"/>';

          for (var i = 0; i < 20; i++) {

            var a = (i * Math.PI) / 4;

            svg +=

              '<line x1="' +

              pt[0] +

              '" y1="' +

              pt[1] +

              '" x2="' +

              (pt[0] + Math.cos(a) * W) +

              '" y2="' +

              (pt[1] + Math.sin(a) * W) +

              '" stroke="rgba(255,255,255,0.02)" stroke-width="1"/>';

          }

        });



        // Non-overlapping hex tessellation covering the whole map. Every cell
        // belongs to exactly one race (by nearest RACE_HOMES point) and one
        // terrain (dominant race biome, an occasional mixed alternate, or a
        // forced tundra/desert/volcanic band at the map's far north/south).
        var hexGrid = buildHexGrid(W, H, worldSeed);

        // Terrain layer: the fill of every hex. Toggling "terrain" off shows
        // flat race-identity colors — lightened so the fill reads as its own
        // shade, distinct from the (brighter, unlightened) border color below.
        // Always visible: this layer now doubles as the flat race-color fill
        // when the terrain toggle is off, so it must never be hidden outright
        // (the toggle switches its fill color, not its visibility).
        svg += '<g class="wm-layer wm-layer-terrain">';
        hexGrid.cells.forEach(function (cell) {
          var meta = REGION_META[cell.race] || {};
          var fill;
          if (cell.terrain === 'lake' || cell.terrain === 'ocean') {
            // Lakes and the ocean are fixed geography, not a biome-toggle
            // cosmetic — always show as water regardless of the terrain
            // toggle, the same way region borders always show.
            fill = TERRAIN_COLORS[cell.terrain];
          } else if (layers.terrain !== false) {
            fill = TERRAIN_COLORS[cell.terrain] || TERRAIN_COLORS.plains;
          } else {
            fill = lightenHexColor(meta.color || TERRAIN_COLORS.plains, 0.35);
          }
          svg += '<path d="' + hexPath(cell.x, cell.y, HEX_SIZE + 0.6) + '" fill="' + fill + '" class="terrain-shape" data-terrain="' + escapeHtml(cell.terrain) + '" data-race="' + escapeHtml(cell.race) + '" style="transform-box:fill-box;transform-origin:center;cursor:default" pointer-events="none"><title>' + escapeHtml(terrainTooltip(cell.terrain)) + '</title></path>';
        });
        svg += '</g>';

        // Terrain symbols layer: adds visual distinction to terrain types
        // (rendered above terrain fill, below fog of war for visibility)
        svg += '<g class="wm-layer wm-layer-terrain-symbols" style="pointer-events:none">';
        hexGrid.cells.forEach(function (cell) {
          if (cell.terrain === 'lake' || cell.terrain === 'ocean') return; // no symbols on water
          var symbol = '';
          var symbolColor = '';

          switch (cell.terrain) {
            case 'plains':
              // Grass tufts: small dots
              symbolColor = 'rgba(200,220,100,0.7)';
              symbol = '<circle cx="' + cell.x + '" cy="' + (cell.y - 2) + '" r="1.5" fill="' + symbolColor + '"/>' +
                      '<circle cx="' + (cell.x - 3) + '" cy="' + cell.y + '" r="1.5" fill="' + symbolColor + '"/>' +
                      '<circle cx="' + (cell.x + 3) + '" cy="' + cell.y + '" r="1.5" fill="' + symbolColor + '"/>';
              break;
            case 'forest':
              // Trees: small evergreen triangles
              symbolColor = 'rgba(150,200,100,0.8)';
              symbol = '<path d="M ' + cell.x + ' ' + (cell.y - 4) + ' L ' + (cell.x - 2) + ' ' + (cell.y - 1) + ' L ' + (cell.x + 2) + ' ' + (cell.y - 1) + ' Z" fill="' + symbolColor + '"/>' +
                      '<path d="M ' + (cell.x - 4) + ' ' + (cell.y + 2) + ' L ' + (cell.x - 6) + ' ' + (cell.y + 4) + ' L ' + (cell.x - 2) + ' ' + (cell.y + 4) + ' Z" fill="' + symbolColor + '"/>' +
                      '<path d="M ' + (cell.x + 4) + ' ' + (cell.y + 2) + ' L ' + (cell.x + 2) + ' ' + (cell.y + 4) + ' L ' + (cell.x + 6) + ' ' + (cell.y + 4) + ' Z" fill="' + symbolColor + '"/>';
              break;
            case 'mountains':
              // Mountain peaks: triangles
              symbolColor = 'rgba(200,200,200,0.8)';
              symbol = '<path d="M ' + cell.x + ' ' + (cell.y - 5) + ' L ' + (cell.x - 4) + ' ' + (cell.y + 2) + ' L ' + cell.x + ' ' + (cell.y - 1) + ' Z" fill="' + symbolColor + '"/>' +
                      '<path d="M ' + cell.x + ' ' + (cell.y - 1) + ' L ' + (cell.x + 4) + ' ' + (cell.y + 2) + ' L ' + (cell.x + 6) + ' ' + cell.y + ' Z" fill="' + symbolColor + '"/>';
              break;
            case 'hills':
              // Rolling hills: curved shapes
              symbolColor = 'rgba(200,180,120,0.7)';
              symbol = '<path d="M ' + (cell.x - 5) + ' ' + (cell.y + 1) + ' Q ' + (cell.x - 3) + ' ' + (cell.y - 3) + ' ' + cell.x + ' ' + (cell.y + 1) + '" stroke="' + symbolColor + '" stroke-width="2" fill="none"/>' +
                      '<path d="M ' + cell.x + ' ' + (cell.y + 1) + ' Q ' + (cell.x + 3) + ' ' + (cell.y - 2) + ' ' + (cell.x + 5) + ' ' + (cell.y + 1) + '" stroke="' + symbolColor + '" stroke-width="2" fill="none"/>';
              break;
            case 'swamp':
              // Swamp: wavy water lines
              symbolColor = 'rgba(100,150,100,0.7)';
              symbol = '<path d="M ' + (cell.x - 4) + ' ' + cell.y + ' Q ' + (cell.x - 2) + ' ' + (cell.y - 2) + ' ' + cell.x + ' ' + cell.y + ' Q ' + (cell.x + 2) + ' ' + (cell.y + 2) + ' ' + (cell.x + 4) + ' ' + cell.y + '" stroke="' + symbolColor + '" stroke-width="1.5" fill="none"/>' +
                      '<path d="M ' + (cell.x - 4) + ' ' + (cell.y + 3) + ' Q ' + (cell.x - 2) + ' ' + (cell.y + 1) + ' ' + cell.x + ' ' + (cell.y + 3) + ' Q ' + (cell.x + 2) + ' ' + (cell.y + 5) + ' ' + (cell.x + 4) + ' ' + (cell.y + 3) + '" stroke="' + symbolColor + '" stroke-width="1.5" fill="none"/>';
              break;
            case 'desert':
              // Desert: sand pattern (diagonal lines)
              symbolColor = 'rgba(200,160,80,0.6)';
              symbol = '<line x1="' + (cell.x - 4) + '" y1="' + (cell.y - 4) + '" x2="' + (cell.x - 1) + '" y2="' + (cell.y - 1) + '" stroke="' + symbolColor + '" stroke-width="1.5"/>' +
                      '<line x1="' + cell.x + '" y1="' + (cell.y - 4) + '" x2="' + (cell.x + 3) + '" y2="' + (cell.y - 1) + '" stroke="' + symbolColor + '" stroke-width="1.5"/>' +
                      '<line x1="' + (cell.x + 2) + '" y1="' + (cell.y - 2) + '" x2="' + (cell.x + 5) + '" y2="' + (cell.y + 1) + '" stroke="' + symbolColor + '" stroke-width="1.5"/>';
              break;
            case 'coast':
              // Coast: wave pattern
              symbolColor = 'rgba(150,200,220,0.8)';
              symbol = '<path d="M ' + (cell.x - 4) + ' ' + (cell.y - 2) + ' Q ' + (cell.x - 2) + ' ' + (cell.y - 4) + ' ' + cell.x + ' ' + (cell.y - 2) + ' Q ' + (cell.x + 2) + ' ' + cell.y + ' ' + (cell.x + 4) + ' ' + (cell.y - 2) + '" stroke="' + symbolColor + '" stroke-width="2" fill="none"/>' +
                      '<path d="M ' + (cell.x - 4) + ' ' + (cell.y + 2) + ' Q ' + (cell.x - 2) + ' ' + cell.y + ' ' + cell.x + ' ' + (cell.y + 2) + ' Q ' + (cell.x + 2) + ' ' + (cell.y + 4) + ' ' + (cell.x + 4) + ' ' + (cell.y + 2) + '" stroke="' + symbolColor + '" stroke-width="2" fill="none"/>';
              break;
            case 'tundra':
              // Tundra: snowflake (3 intersecting lines)
              symbolColor = 'rgba(220,240,255,0.8)';
              symbol = '<line x1="' + (cell.x - 4) + '" y1="' + cell.y + '" x2="' + (cell.x + 4) + '" y2="' + cell.y + '" stroke="' + symbolColor + '" stroke-width="1.5"/>' +
                      '<line x1="' + (cell.x - 2) + '" y1="' + (cell.y - 3.46) + '" x2="' + (cell.x + 2) + '" y2="' + (cell.y + 3.46) + '" stroke="' + symbolColor + '" stroke-width="1.5"/>' +
                      '<line x1="' + (cell.x - 2) + '" y1="' + (cell.y + 3.46) + '" x2="' + (cell.x + 2) + '" y2="' + (cell.y - 3.46) + '" stroke="' + symbolColor + '" stroke-width="1.5"/>';
              break;
            case 'volcanic':
              // Volcanic: crater rings
              symbolColor = 'rgba(220,100,60,0.7)';
              symbol = '<circle cx="' + cell.x + '" cy="' + cell.y + '" r="3" fill="none" stroke="' + symbolColor + '" stroke-width="1.5"/>' +
                      '<circle cx="' + cell.x + '" cy="' + cell.y + '" r="1.5" fill="' + symbolColor + '"/>';
              break;
          }

          if (symbol) {
            svg += symbol;
          }
        });
        svg += '</g>';

        // River network: rendered below fog of war so rivers are visible
        // but not obscuring the unseen/seen fog overlay distinction.
        // Rivers are a geographic feature, always visible regardless of terrain toggle.
        // Trunk segments (spanning-tree connectors linking every region's lake to every other)
        // render thicker/brighter than local tributaries — the "roadway" a navy travels.
        svg += '<g class="wm-layer wm-layer-rivers">';
        hexGrid.riverSegments.forEach(function (seg) {
          var underWidth = seg.kind === 'trunk' ? 6 : 4.5;
          svg += '<line x1="' + seg.p1[0] + '" y1="' + seg.p1[1] + '" x2="' + seg.p2[0] + '" y2="' + seg.p2[1] + '" stroke="#0d2a3a" stroke-width="' + underWidth + '" stroke-linecap="round" opacity="0.5" pointer-events="none"/>';
        });
        hexGrid.riverSegments.forEach(function (seg) {
          var topWidth = seg.kind === 'trunk' ? 3.25 : 2.25;
          var color = seg.kind === 'trunk' ? '#5cc0e8' : '#4a9fd0';
          svg += '<line x1="' + seg.p1[0] + '" y1="' + seg.p1[1] + '" x2="' + seg.p2[0] + '" y2="' + seg.p2[1] + '" stroke="' + color + '" stroke-width="' + topWidth + '" stroke-linecap="round" opacity="0.85" class="water-edge" data-kind="' + seg.kind + '" pointer-events="none"/>';
        });
        svg += '</g>';

        // Fog of War overlay (after rivers, before region borders/labels).
        // Unseen: heavily obscured; seen: dimmed; current: fully visible (no overlay).
        svg += '<g class="wm-layer wm-layer-fog" style="pointer-events:none">';
        hexGrid.cells.forEach(function (cell) {
          const col = cell.col, row = cell.row;
          let fog = 'unseen';
          if (isHexCurrent(col, row, currentBig)) fog = 'current';
          else if (isHexSeen(col, row, seenBig)) fog = 'seen';
          if (fog === 'current') return; // no overlay
          let fogFill, fogOpacity;
          if (fog === 'unseen') {
            fogFill = 'rgb(0,0,0)';
            fogOpacity = '0.92';
          } else {
            fogFill = 'rgb(15,20,35)';
            fogOpacity = '0.65';
          }
          svg += '<path d="' + hexPath(cell.x, cell.y, HEX_SIZE + 0.8) + '" fill="' + fogFill + '" opacity="' + fogOpacity + '" />';
        });
        svg += '</g>';

        // Interactive hex layer for Epic Trek target selection
        // Invisible clickable hexes (for exploration mode)
        svg += '<g class="wm-layer wm-layer-hex-interact" style="pointer-events:auto">';
        hexGrid.cells.forEach(function (cell) {
          svg += '<path d="' + hexPath(cell.x, cell.y, HEX_SIZE + 0.6) + '" fill="transparent" stroke="none" data-hex-x="' + Math.round(cell.x) + '" data-hex-y="' + Math.round(cell.y) + '" style="cursor:crosshair;opacity:0" />';
        });
        svg += '</g>';

        // Region layer: each cell draws its OWN edge, inset slightly toward
        // its own center, wherever that edge faces a different race (or the
        // map's outer boundary). At an internal seam, both neighboring cells
        // draw their own inset edge in their own color, producing two
        // distinct parallel lines (one per side) instead of a single shared
        // line that has to arbitrarily pick one color. A dark underline is
        // drawn first so each line reads clearly against any biome color.
        svg += '<g class="wm-layer wm-layer-regions">';
        var BORDER_INSET = 4;
        var borderSegments = [];
        hexGrid.cells.forEach(function (cell) {
          var neighborKeys = hexNeighborKeys(cell.col, cell.row);
          var corners = hexCorners(cell.x, cell.y, HEX_SIZE - BORDER_INSET);
          neighborKeys.forEach(function (key, dirIndex) {
            var neighbor = hexGrid.cellMap.get(key);
            if (neighbor && neighbor.race === cell.race) return;
            var edge = DIRECTION_EDGE_CORNERS[dirIndex];
            var p1 = corners[edge[0]];
            var p2 = corners[edge[1]];
            borderSegments.push({ race: cell.race, p1: p1, p2: p2 });
          });
        });
        borderSegments.forEach(function (seg) {
          svg += '<line x1="' + seg.p1[0] + '" y1="' + seg.p1[1] + '" x2="' + seg.p2[0] + '" y2="' + seg.p2[1] + '" stroke="#000" stroke-width="4.5" stroke-linecap="round" opacity="0.5" pointer-events="none"/>';
        });
        borderSegments.forEach(function (seg) {
          var meta = REGION_META[seg.race] || {};
          svg += '<line x1="' + seg.p1[0] + '" y1="' + seg.p1[1] + '" x2="' + seg.p2[0] + '" y2="' + seg.p2[1] + '" stroke="' + (meta.stroke || '#fff') + '" stroke-width="2.25" stroke-linecap="round" class="region-shape wm-region" data-race="' + escapeHtml(seg.race) + '" style="transition:opacity 0.3s;opacity:' + regionOpacity(seg.race, highlightedRace) + '" pointer-events="none"/>';
        });
        svg += '</g>';

        // Grid lines - subtle
        for (gx = 0; gx < W; gx += 80) {

          svg +=

            '<line x1="' +

            gx +

            '" y1="0" x2="' +

            gx +

            '" y2="' +

            H +

            '" stroke="#ffffff" stroke-width="0.3" opacity="0.04"/>';

        }

        for (gy = 0; gy < H; gy += 80) {

          svg +=

            '<line x1="0" y1="' +

            gy +

            '" x2="' +

            W +

            '" y2="' +

            gy +

            '" stroke="#ffffff" stroke-width="0.3" opacity="0.04"/>';

        }



        // Kingdom dots — jittered around the kingdom's race's home seed point
        // (the same point the hex tessellation above uses), so dots land
        // inside their matching territory without a separate seed table.

        var kdCoords = {};

        kingdoms.forEach(function (k, i) {

          if (Number.isFinite(Number(k.map_x)) && Number.isFinite(Number(k.map_y))) {

            kdCoords[k.id] = { x: Number(k.map_x), y: Number(k.map_y) };

            return;

          }

          var home = RACE_HOMES[k.race] || { x: W / 2, y: H / 2 };

          kdCoords[k.id] = {

            x: home.x + (((i * 17 + 3) % 140) - 70),

            y: home.y + (((i * 13 + 7) % 140) - 70),

          };

        });



        svg += '<g class="wm-layer wm-layer-expeditions" style="' + layerVisibilityStyle(layers.expeditions !== false) + '">';

        if (expeditions.length) {

          var homeCoords = kdCoords[state.kingdomId];

          expeditions.forEach(function (exp) {

            if (!homeCoords || !Number.isFinite(Number(exp.map_x)) || !Number.isFinite(Number(exp.map_y))) return;

            svg +=

              '<line class="wm-expedition-line" x1="' +

              homeCoords.x +

              '" y1="' +

              homeCoords.y +

              '" x2="' +

              Number(exp.map_x) +

              '" y2="' +

              Number(exp.map_y) +

              '" stroke="#7ec8ff" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.55" />';

          });

        }

        svg += '</g>';



        svg += '<g class="wm-layer wm-layer-nodes" style="' + layerVisibilityStyle(layers.nodes !== false) + '">';

        if (nodes.length) {

          nodes.forEach(function (node) {

            if (!Number.isFinite(Number(node.map_x)) || !Number.isFinite(Number(node.map_y))) return;

            var meta = NODE_TYPE_META[node.type] || NODE_TYPE_META.wood;

            var nx = Number(node.map_x);

            var ny = Number(node.map_y);

            var nr = getNodeRadius(node.richness);

            var activeExp = expeditions.some(function (exp) {

              return String(exp.node_id) === String(node.id);

            });

            var strokeWidth = activeExp ? 2.5 : 1.5;

            svg += '<g class="wm-node-group map-node-group" data-node-id="' + escapeHtml(String(node.id)) + '" transform="translate(' + nx + ',' + ny + ')">';

            // larger hit area for easier clicking, transparent
            svg += '<circle cx="0" cy="0" r="' + (nr + 8) + '" fill="transparent" style="pointer-events:visiblePainted" data-node-id="' + escapeHtml(String(node.id)) + '"/>';

            svg +=

              '<circle class="wm-node-halo" cx="0" cy="0" r="' +

              (nr + 3) +

              '" fill="' +

              meta.fill +

              '" opacity="0.18"/>';

            svg +=

              '<circle class="wm-node map-node" cx="0" cy="0" r="' +

              nr +

              '" fill="' +

              (node.terrain ? (TERRAIN_COLORS[node.terrain] || TERRAIN_COLORS.plains) : meta.fill) +

              '" stroke="' +

              meta.stroke +

              '" stroke-width="' +

              strokeWidth +

              '" data-base-stroke="' +

              strokeWidth +

              '" data-node-id="' +

              escapeHtml(String(node.id)) +

              '" data-node-type="' +

              escapeHtml(String(node.type || '')) +

              '" style="cursor:pointer" filter="' +

              (activeExp ? 'url(#glow)' : 'url(#uiShadow)') +

              '"/>';

            svg +=

              '<text class="wm-node-icon" x="0" y="4" text-anchor="middle" font-size="9" pointer-events="none">' +

              escapeHtml(meta.icon) +

              '</text>';

            svg += '</g>';

          });

        }

        svg += '</g>';



        svg += '<g class="wm-layer wm-layer-routes" style="' + layerVisibilityStyle(layers.routes !== false) + '">';

        routes.forEach(function (r) {

          var p1 = kdCoords[r.kingdom_id];

          var p2 = kdCoords[r.partner_id];

          if (p1 && p2) {

            svg +=

              '<line class="wm-trade-line" x1="' +

              p1.x +

              '" y1="' +

              p1.y +

              '" x2="' +

              p2.x +

              '" y2="' +

              p2.y +

              '" stroke="var(--gold)" stroke-width="1.5" stroke-dasharray="4 4" opacity="0.4" />';

          }

        });

        svg += '</g>';



        svg += '<g class="wm-layer wm-layer-kingdoms" style="' + layerVisibilityStyle(layers.kingdoms !== false) + '">';

        var sortedKingdoms = kingdoms.slice().sort(function (a, b) {

          return b.land - a.land;

        });

        sortedKingdoms.forEach(function (k, i) {

          var coords = kdCoords[k.id] || { x: 0, y: 0 };

          var jx = coords.x;

          var jy = coords.y;

          var isMe = k.id === state.kingdomId;

          var dotColor = REGION_META[k.race]

            ? REGION_META[k.race].stroke

            : "#ffffff";

          var r = isMe

            ? 7

            : Math.max(4.5, Math.min(8, 3.5 + Math.floor(k.land / 4000)));



          // Invisible larger hit area — the visible dot is as small as 4.5 SVG
          // units (roughly 10px on screen), too small to reliably click with a
          // real mouse. Same technique already used for resource node markers:
          // a transparent circle with pointer-events:visiblePainted, sized well
          // past the visible dot, carrying the same data-kingdom-id so
          // handleMapClick's DOM walk-up still resolves it correctly.

          svg +=

            '<circle cx="' + jx + '" cy="' + jy + '" r="' + (r + 8) +

            '" fill="transparent" style="pointer-events:visiblePainted;cursor:pointer" data-kingdom-id="' + escapeHtml(String(k.id)) + '"/>';



          svg +=

            '<circle cx="' +

            jx +

            '" cy="' +

            (jy + 2) +

            '" r="' +

            r +

            '" fill="#000" opacity="0.6"/>';



          if (isMe) {

            svg +=

              '<circle class="wm-kingdom-ring" cx="' +

              jx +

              '" cy="' +

              jy +

              '" r="10" fill="none" stroke="#e8b84b" stroke-width="1.5" opacity="0.55" />';

          }



          svg +=

            '<circle cx="' +

            jx +

            '" cy="' +

            jy +

            '" r="' +

            r +

            '" fill="' +

            (isMe ? "#e8b84b" : dotColor) +

            '" stroke="' +

            (isMe ? "#fff" : "#111") +

            '" stroke-width="' +

            (isMe ? 2 : 1) +

            '" class="kd-dot wm-kingdom" data-race="' +

            k.race +

            '" data-kingdom-id="' + escapeHtml(String(k.id)) +

            '" style="cursor:pointer;transition:opacity 0.3s;opacity:' + regionOpacity(k.race, highlightedRace, '0.2') + '" filter="' +

            (isMe ? "url(#glow)" : "url(#uiShadow)") +

            '"/>';



          if (isMe || k.land > 5000 || k.rank <= 3) {

            svg +=

              '<text class="wm-kingdom-label" x="' +

              jx +

              '" y="' +

              (jy - r - 5) +

              '" text-anchor="middle" font-family="sans-serif" font-size="' +

              (isMe ? 12 : 9) +

              '" font-weight="' +

              (isMe ? 800 : 600) +

              '" fill="' +

              (isMe ? "#e8b84b" : "#fff") +

              '" filter="url(#uiShadow)" pointer-events="none">' +

              escapeHtml(k.name.slice(0, 10)) +

              "</text>";

          }

        });

        svg += '</g>';



        // Title

        svg +=

          '<text x="' +

          W / 2 +

          '" y="35" text-anchor="middle" font-family="Georgia,serif" font-size="18" fill="#e8b84b" filter="url(#glow)" font-weight="bold" letter-spacing="4" style="text-shadow: 0 4px 10px #000">NARMIR REBORN</text>';



        // Compass rose

        svg +=

          '<g transform="translate(' +

          (W - 90) +

          ", " +

          90 +

          ') scale(0.9)">' +

          '<circle cx="0" cy="0" r="45" fill="none" stroke="rgba(232, 184, 75, 0.4)" stroke-width="1.5" stroke-dasharray="4 4"/>' +

          '<circle cx="0" cy="0" r="35" fill="rgba(6, 8, 16, 0.5)" stroke="rgba(232, 184, 75, 0.6)" stroke-width="2"/>' +

          '<path d="M0,-30 L8,-8 L30,0 L8,8 L0,30 L-8,8 L-30,0 L-8,-8 Z" fill="rgba(232, 184, 75, 0.15)" stroke="#e8b84b" stroke-width="1"/>' +

          '<path d="M0,-30 L0,30 M-30,0 L30,0" stroke="#e8b84b" stroke-width="1.5" opacity="0.6"/>' +

          '<text x="0" y="-40" text-anchor="middle" font-family="Georgia,serif" font-size="16" fill="#e8b84b" font-weight="bold" filter="url(#glow)">N</text>' +

          "</g>";



        // Vignette over everything

        svg +=

          '<rect width="' +

          W +

          '" height="' +

          H +

          '" fill="url(#vignette)" pointer-events="none"/>';

        // Region labels — rendered LAST, same layer as title so they're on top of everything
        svg += '<g class="wm-layer wm-layer-region-labels">';
        Object.entries(REGION_META).forEach(function (e) {
          var race = e[0];
          var meta = e[1];
          var home = RACE_HOMES[race];
          if (!home) return;
          var cx = home.x;
          var cy = home.y;
          var titleColor = darkenHexColor(meta.color || '#333333', 0.35);
          var titleLines = wrapRegionName(meta.name);
          var titleFontSize = 28;
          var titleLineHeight = titleFontSize + 4;
          var titleTop = cy - 6 - ((titleLines.length - 1) * titleLineHeight) / 2;

          svg += '<g class="wm-region-label" style="transition:opacity 0.3s;opacity:' + regionOpacity(race, highlightedRace) + '">';
          titleLines.forEach(function (line, i) {
            svg +=
              '<text x="' + cx + '" y="' + (titleTop + i * titleLineHeight) +
              '" text-anchor="middle" font-family="Georgia,serif" font-weight="700" font-size="' + titleFontSize + '" fill="' + (meta.stroke || '#fff') + '" opacity="1" pointer-events="none" style="text-transform:uppercase;letter-spacing:1.5px;text-shadow:0 1px 3px rgba(0,0,0,0.9);">' +
              escapeHtml(line) +
              "</text>";
          });
          svg +=
            '<text x="' + cx + '" y="' + (titleTop + titleLines.length * titleLineHeight + 8) +
            '" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="20" fill="#ffffff" opacity="1" pointer-events="none" style="text-shadow:0 1px 2px rgba(0,0,0,0.9);">' +
            escapeHtml(REGION_BONUSES[race] || "") +
            "</text>";
          svg += "</g>";
        });
        svg += '</g>';

        svg += "</svg>";

        return svg;
      }
