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
