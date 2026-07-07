/**
 * Race-region assignment and water-band terrain checks, shared between
 * server-side kingdom/node placement (game/world-map-coords.js) and
 * validation tooling (scripts/validate-kingdom-hex-placement.js).
 *
 * Mirrors client/src/components/react/WorldmapRenderer.jsx's RACE_HOMES,
 * nearestRaceHome, and oceanBandForColumn exactly. That file is a
 * browser-only React component and can't be required() from the server, so
 * this logic is kept here as the server-side source of truth and manually
 * synced if the renderer's map geometry ever changes.
 */

'use strict';

const { pixelToHex } = require('./hex-utils');

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

const OCEAN_BASE_ROW = 2;
const OCEAN_THICKNESS = 2;
// Note: the desert/volcanic south band never produces water terrain, only
// the ocean/tundra rows at the top of the map matter for water checks.

function oceanBandForColumn(col) {
  const wave = Math.sin(col * 0.35) * 1.0 + Math.sin(col * 0.9 + 1.3) * 0.4;
  const start = Math.round(OCEAN_BASE_ROW + wave);
  return { start, end: start + OCEAN_THICKNESS };
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
 * True if pixel (x, y) falls in an ocean/tundra-band hex row (water,
 * unsuitable for a kingdom or resource node spawn).
 */
function isWaterPoint(x, y) {
  const { col, row } = pixelToHex(x, y);
  const oceanBand = oceanBandForColumn(col);
  return row < oceanBand.end;
}

module.exports = {
  RACE_HOMES,
  nearestRaceHome,
  oceanBandForColumn,
  isWaterPoint,
};
