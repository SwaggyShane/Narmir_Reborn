/**
 * Lava vent state
 * ACTIVE/DORMANT via a wall-clock `dormant_until` timestamp (never turns —
 * the server's turn clock advances whether anyone is online or not, so a
 * turn-based cooldown would make a vent's readiness depend on who happens
 * to be taking turns). Occupation is job-based (one kingdom on-site at a
 * time), cleared when the on-site draw ends — that part is expedition
 * state, not wall-clock.
 */

'use strict';

const config = require('./config');

function raceLavaMult(race) {
  const table = config.FORGE_RACE_MULT || {};
  const row = table[race] || table.human || { lava: 1 };
  const v = Number(row.lava);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

/** Lava yield on a successful draw: max(1, floor(8 x race_lava_mult)). */
function lavaYield(race) {
  const base = Number((config.FORGE_LAVA && config.FORGE_LAVA.base_yield) || 8);
  return Math.max(1, Math.floor(base * raceLavaMult(race)));
}

function isActiveRow(row) {
  if (!row) return true; // no row yet = never drawn = ACTIVE
  if (!row.dormant_until) return true;
  return new Date(row.dormant_until).getTime() <= Date.now();
}

/**
 * Read-only vent status for hex-card / targeting display.
 * Lazily-known hex — no row yet means ACTIVE and unoccupied.
 */
async function getVentState(db, hexCol, hexRow) {
  const row = await db.get(
    `SELECT v.hex_col, v.hex_row, v.occupying_kingdom_id, v.dormant_until, k.name AS occupying_kingdom_name
     FROM lava_vents v
     LEFT JOIN kingdoms k ON k.id = v.occupying_kingdom_id
     WHERE v.hex_col = $1 AND v.hex_row = $2`,
    [hexCol, hexRow],
  );
  return {
    hex_col: hexCol,
    hex_row: hexRow,
    active: isActiveRow(row),
    occupying_kingdom_id: row ? row.occupying_kingdom_id : null,
    occupying_kingdom_name: row ? row.occupying_kingdom_name : null,
    dormant_until: row && row.dormant_until ? new Date(row.dormant_until).toISOString() : null,
  };
}

/**
 * Atomic claim on arrival — the "arrival race." Succeeds only if the vent
 * has no row yet, or has a row with no occupant and isn't dormant.
 * Returns { claimed: true } or { claimed: false, reason }.
 */
async function claimVent(db, hexCol, hexRow, kingdomId) {
  const row = await db.get(
    `INSERT INTO lava_vents (hex_col, hex_row, occupying_kingdom_id, dormant_until)
     VALUES ($1, $2, $3, NULL)
     ON CONFLICT (hex_col, hex_row) DO UPDATE
       SET occupying_kingdom_id = EXCLUDED.occupying_kingdom_id
       WHERE lava_vents.occupying_kingdom_id IS NULL
         AND (lava_vents.dormant_until IS NULL OR lava_vents.dormant_until <= NOW())
     RETURNING hex_col, hex_row, occupying_kingdom_id`,
    [hexCol, hexRow, kingdomId],
  );
  if (row && Number(row.occupying_kingdom_id) === Number(kingdomId)) {
    return { claimed: true };
  }
  const state = await getVentState(db, hexCol, hexRow);
  if (!state.active) return { claimed: false, reason: 'dormant' };
  return { claimed: false, reason: 'occupied', occupying_kingdom_name: state.occupying_kingdom_name };
}

/**
 * Release on-site occupation when the draw job ends.
 * success=true also starts the dormancy window (now + 3h); a failed/
 * cancelled-before-claim situation never reaches this (nothing to release).
 * Empty-handed arrivals never call this either — they never claimed.
 */
async function releaseVent(db, hexCol, hexRow, kingdomId, success) {
  const dormantMs = Number((config.FORGE_LAVA && config.FORGE_LAVA.dormant_ms) || 3 * 60 * 60 * 1000);
  if (success) {
    const dormantUntil = new Date(Date.now() + dormantMs);
    await db.run(
      `UPDATE lava_vents SET occupying_kingdom_id = NULL, dormant_until = $3
       WHERE hex_col = $1 AND hex_row = $2 AND occupying_kingdom_id = $4`,
      [hexCol, hexRow, dormantUntil, kingdomId],
    );
    return { dormant_until: dormantUntil.toISOString() };
  }
  await db.run(
    `UPDATE lava_vents SET occupying_kingdom_id = NULL
     WHERE hex_col = $1 AND hex_row = $2 AND occupying_kingdom_id = $3`,
    [hexCol, hexRow, kingdomId],
  );
  return { dormant_until: null };
}

module.exports = {
  raceLavaMult,
  lavaYield,
  getVentState,
  claimVent,
  releaseVent,
};
