#!/usr/bin/env node
/**
 * Fog of War Phase 1 validation: checks that every kingdom's continuous
 * (map_x, map_y) coordinate lands in a hex cell that (a) visually renders
 * with the kingdom's own race color and (b) is not a water tile (ocean/
 * tundra-band ocean). Read-only — reports findings, changes nothing.
 *
 * Race-region assignment and water-band logic are intentionally reproduced
 * here rather than imported from WorldmapRenderer.jsx: that file is a
 * browser-only React component, and Phase 1 only extracted the generic hex
 * math (hexCenter/hexNeighborKeys/pixelToHex) into game/hex-utils.js, not
 * the terrain-assignment rules, which are render-specific and out of scope
 * for this validation pass. Kept in sync manually; source of truth is
 * WorldmapRenderer.jsx's RACE_HOMES / oceanBandForColumn / SOUTH_BAND_FRAC.
 *
 * Usage: node scripts/validate-kingdom-hex-placement.js
 */

'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const { hexCenter, pixelToHex } = require('../game/hex-utils');
const { getKingdomMapCoords } = require('../game/world-map-coords');

// Mirrors WorldmapRenderer.jsx RACE_HOMES exactly.
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
// Note: SOUTH_BAND_FRAC (desert/volcanic band) is deliberately not checked
// here — that band never produces water terrain, only the ocean/tundra rows
// at the top of the map matter for the no-water-spawn validation below.

// Mirrors WorldmapRenderer.jsx oceanBandForColumn exactly.
function oceanBandForColumn(col) {
  const wave = Math.sin(col * 0.35) * 1.0 + Math.sin(col * 0.9 + 1.3) * 0.4;
  const start = Math.round(OCEAN_BASE_ROW + wave);
  return { start, end: start + OCEAN_THICKNESS };
}

// Mirrors WorldmapRenderer.jsx nearestRaceHome exactly (logic-wise). Entries
// precomputed once and iterated with a plain loop, not Object.entries().forEach,
// since this runs once per kingdom (5,000+ in the local DB) and the array/
// closure allocation on every call was a measurable, easy-to-avoid cost.
const RACE_HOMES_ENTRIES = Object.entries(RACE_HOMES);

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

// Water bands only (tundra/ocean); the SOUTH_BAND_FRAC check never yields
// water (desert/volcanic), so it's irrelevant to the water-spawn check.
function isWaterCell(col, row) {
  const oceanBand = oceanBandForColumn(col);
  return row < oceanBand.end; // tundra rows also count as "too far north to be a valid spawn region"
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let kingdoms;
  try {
    const result = await pool.query('SELECT id, name, race FROM kingdoms');
    kingdoms = result.rows;
  } finally {
    await pool.end();
  }

  if (!kingdoms.length) {
    console.log('No kingdoms found — nothing to validate.');
    return;
  }

  const misaligned = [];
  const inWater = [];

  for (const k of kingdoms) {
    // Kingdom map position is not stored — it's derived deterministically
    // from id+race, same as every other place in the app that renders it.
    const { map_x, map_y } = getKingdomMapCoords(k);
    const hex = pixelToHex(map_x, map_y);
    const cellCenter = hexCenter(hex.col, hex.row);
    const cellRace = nearestRaceHome(cellCenter.x, cellCenter.y);

    if (cellRace !== k.race) {
      misaligned.push({ id: k.id, name: k.name, race: k.race, cellRace, hex });
    }
    if (isWaterCell(hex.col, hex.row)) {
      inWater.push({ id: k.id, name: k.name, race: k.race, hex });
    }
  }

  console.log(`Checked ${kingdoms.length} kingdoms.`);
  console.log(`Region alignment: ${kingdoms.length - misaligned.length}/${kingdoms.length} land in their own race's hex region.`);
  if (misaligned.length) {
    console.log('\nMisaligned (own race != nearest hex region):');
    misaligned.forEach((m) => console.log(`  #${m.id} ${m.name} (${m.race}) -> hex region resolves to ${m.cellRace} at (${m.hex.col},${m.hex.row})`));
  }

  console.log(`\nWater spawns: ${inWater.length}/${kingdoms.length} land in an ocean/tundra-band hex.`);
  if (inWater.length) {
    console.log('\nIn water (violates no-water-spawn rule, to be enforced going forward per Phase 1.5):');
    inWater.forEach((w) => console.log(`  #${w.id} ${w.name} (${w.race}) -> hex (${w.hex.col},${w.hex.row})`));
  }

  console.log(`\n${misaligned.length === 0 && inWater.length === 0 ? '✓ All kingdoms aligned and on land.' : '⚠ See findings above — Phase 1.5 will address water-spawn enforcement and region seed alignment.'}`);
}

main().catch((err) => {
  console.error('Validation failed:', err);
  process.exit(1);
});
