/**
 * Race-region assignment and water-band terrain checks, shared between
 * server-side kingdom/node placement (game/world-map-coords.js) and
 * validation tooling (scripts/validate-kingdom-hex-placement.js).
 *
 * Mirrors client/src/utils/worldMapBuilder.js's RACE_HOMES, nearestRaceHome,
 * and computeOceanBand exactly (the WebGL renderer's terrain generator,
 * confirmed canonical 2026-07-15 — the older WorldmapRenderer.jsx/SVG
 * renderer had its own diverging inline copy of this logic; that
 * divergence is being retired in favor of this one). That file is a
 * browser-only ES module and can't be required() from the server, so this
 * logic is kept here as the server-side source of truth and manually
 * synced if the renderer's map geometry ever changes. game/world-hex-grid.js
 * builds on top of this module for the full terrain+lake+river grid.
 */

'use strict';

const { pixelToHex, HEX_VERT } = require('./hex-utils');
const { getTerrainAt } = require('./world-hex-grid-cache');

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

const MAP_HEIGHT = 1380;

/**
 * Fixed-latitude ocean band (matches worldMapBuilder.js's computeOceanBand).
 * Rows above `start` are tundra, [start, end) are ocean — both uninhabitable.
 */
function oceanBand(worldHeight = MAP_HEIGHT) {
  const oceanLatitude = 0.2;
  const oceanBandWidth = 0.08;
  const start = Math.floor((oceanLatitude - oceanBandWidth / 2) * (worldHeight / HEX_VERT));
  const end = Math.floor((oceanLatitude + oceanBandWidth / 2) * (worldHeight / HEX_VERT));
  return { start, end };
}

const RACE_HOMES_ENTRIES = Object.entries(RACE_HOMES);

/**
 * Which race's home is closest to pixel (x, y) — the same Voronoi-style
 * assignment WorldmapRenderer.jsx uses to color each hex cell's region.
 */
function nearestRaceHome(x, y) {
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < RACE_HOMES_ENTRIES.length; i++) {
    const [race, home] = RACE_HOMES_ENTRIES[i];
    const dx = x - home.x;
    const dy = y - home.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = race;
    }
  }
  return best || 'human';
}

/**
 * True if pixel (x, y) falls in an ocean/tundra-band hex row, OR lands
 * exactly on a per-region lake hex (water either way, unsuitable for a
 * kingdom or resource node spawn). The lake check needs the built hex grid
 * (game/world-hex-grid.js's buildHexGrid, cached at boot in
 * world-hex-grid-cache.js) — before that's populated, or for the (rare,
 * non-water) 'ocean' terrain that only ever occurs inside the row band
 * already checked below, this falls back to the row-band check alone.
 * Found 2026-07-16: without this, a kingdom's home could land exactly on
 * its own region's lake — a real, pre-existing gap (kingdom placement never
 * had lake-awareness before game/world-hex-grid.js existed) that surfaced
 * once elevation gave it a visible effect (permanent elevation 0).
 */
function isWaterPoint(x, y) {
  const { col, row } = pixelToHex(x, y);
  const band = oceanBand();
  if (row < band.end) return true;
  return getTerrainAt(col, row) === 'lake';
}

module.exports = {
  RACE_HOMES,
  nearestRaceHome,
  oceanBand,
  isWaterPoint,
};
