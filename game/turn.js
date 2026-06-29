// game/turn.js
// Per-turn processing domain -- processTurn and its local helpers.
// Extracted from game/engine.js (Phase 5). engine.js re-exports all symbols
// via module.exports for backward compatibility.

const config = require("./config");
const { safeJsonParse } = require('../utils/helpers');

const { LOCATE_RACE_MULT } = config;

// ── Season system ─────────────────────────────────────────────────────────────

// ── Location system ───────────────────────────────────────────────────────────

function calcDiscoveryChance(k) {
  const baseChance = 0.05; // 5% base
  const race = k.race || "human";
  const raceMult = LOCATE_RACE_MULT[race] || 1.0;
  return baseChance * raceMult;
}

function processLocationMapsWip(k, events) {
  const updates = {};
  const wip = safeJsonParse(
    k.location_maps_wip,
    [],
    "processLocationMapsWip:location_maps_wip",
  );
  if (!wip.length) return updates;

  const scribesAvail = k.scribes;
  let scribesUsed = 0;
  const completed = [];
  const remaining = [];

  for (const item of wip) {
    const cost = 10; // scribes required
    if (scribesUsed + cost > scribesAvail) {
      remaining.push(item);
      continue;
    }
    scribesUsed += cost;
    item.turns_remaining = (item.turns_remaining || 5) - 1;
    if (item.turns_remaining <= 0) {
      completed.push(item);
      const disc = safeJsonParse(
        k.discovered_kingdoms,
        {},
        "processLocationMapsWip:discovered_kingdoms",
      );
      disc[item.target_id] = { found: true, mapped: true };
      updates.discovered_kingdoms = JSON.stringify(disc);
      events.push({
        type: "system",
        message: `🗺️ Scribes have completed a location map for ${item.target_name}. You may now interact with them.`,
      });
    } else {
      remaining.push(item);
    }
  }

  updates.location_maps_wip = JSON.stringify(remaining);
  return updates;
}

module.exports = {
  calcDiscoveryChance,
  processLocationMapsWip,
};
