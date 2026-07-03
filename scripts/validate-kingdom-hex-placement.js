#!/usr/bin/env node
/**
 * Fog of War Phase 1 validation: checks that every kingdom's continuous
 * (map_x, map_y) coordinate lands in a hex cell that (a) visually renders
 * with the kingdom's own race color and (b) is not a water tile (ocean/
 * tundra-band ocean). Read-only — reports findings, changes nothing.
 *
 * Region/water logic now lives in game/world-regions.js (extracted here in
 * Phase 1.5 to stop duplicating it a second time — game/world-map-coords.js
 * needs the same logic to gate its own placement).
 *
 * Usage: node scripts/validate-kingdom-hex-placement.js
 */

'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const { hexCenter, pixelToHex } = require('../game/hex-utils');
const { getKingdomMapCoords } = require('../game/world-map-coords');
const { nearestRaceHome, isWaterPoint } = require('../game/world-regions');

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
    if (isWaterPoint(map_x, map_y)) {
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
