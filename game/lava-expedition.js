/**
 * Lava expedition
 * All-or-nothing: win the arrival race and draw lava, or lose it and
 * return empty-handed. No cancellation at any phase (§5, §6.2). Crew
 * (25 engineers + 5 mages) is committed for the full round trip and
 * only returns on resolution.
 */

'use strict';

const config = require('./config');
const { pixelToHex } = require('./hex-utils');
const { getPathHexes, getEpicTrekTurns } = require('./epic-trek-paths');
const { getAvailableUnits, parseTroopLevel, awardTroopXp } = require('./lib/troops');
const { flagOn } = require('./forge-upgrades');
const { claimVent, releaseVent, lavaYield } = require('./lava-vents');
const { applyHullWear, findDeployableBarge, setBargeStatus, serializeBarges } = require('./flux-barge');
const { awardEngineerXp } = require('./engineers');
const { junkPrize } = require('./lib/gameplay');

const FOOD_PER_HEX = 50;

function lavaCfg() {
  return (
    config.FORGE_LAVA || {
      crew_engineers: 25,
      crew_mages: 5,
      eng_level_min: 50,
      mage_level_min: 25,
      on_site_turns: 100,
      base_yield: 8,
      xp_success: { engineers: 10000, mages: 2500 },
      xp_empty: { engineers: 1500, mages: 400 },
    }
  );
}

function kingdomEngineerLevel(k) {
  return k.engineer_level || 1;
}

function kingdomMageLevel(k) {
  return parseTroopLevel(k.troop_levels, 'mages') || 1;
}

/**
 * Pure gate check — mirrors §7 "Eligible to draw requires all of."
 * Does not check vent ACTIVE state (that's the arrival race, resolved
 * server-side at resolution, not a launch-time gate — a vent can go
 * dormant during someone else's trip after you've already launched).
 */
function canLaunch(k, bargeId) {
  const cfg = lavaCfg();
  if (!flagOn(k, 'forge')) return { error: 'Install the Forge upgrade first' };
  if (kingdomEngineerLevel(k) < cfg.eng_level_min) {
    return { error: `Engineer level ${cfg.eng_level_min}+ required for lava draws` };
  }
  if (kingdomMageLevel(k) < cfg.mage_level_min) {
    return { error: `Mage level ${cfg.mage_level_min}+ required for lava draws` };
  }
  if (getAvailableUnits(k, 'engineers') < cfg.crew_engineers) {
    return { error: `Need ${cfg.crew_engineers} available engineers` };
  }
  if (getAvailableUnits(k, 'mages') < cfg.crew_mages) {
    return { error: `Need ${cfg.crew_mages} available mages` };
  }
  const bargeCheck = findDeployableBarge(k.flux_barges, bargeId);
  if (bargeCheck.error) return { error: bargeCheck.error };
  return { ok: true };
}

/**
 * Pure launch computation. Crew + food + turns are debited now; crew is
 * NOT returned until resolveLavaDraw runs (§5 "Crew commitment").
 */
function buildLaunch(k, targetX, targetY, bargeId, opts = {}) {
  const gate = canLaunch(k, bargeId);
  if (gate.error) return gate;

  const cfg = lavaCfg();
  const { map_x, map_y } = opts.homeCoords;
  const pathHexes = getPathHexes(map_x, map_y, targetX, targetY);
  const oneWayTurns = getEpicTrekTurns(map_x, map_y, targetX, targetY, opts.turnOpts || {});
  const onSiteTurns = Number(cfg.on_site_turns) || 100;
  const turnsTotal = oneWayTurns * 2 + onSiteTurns;

  const foodNeeded = Math.ceil(pathHexes.length * 2 * FOOD_PER_HEX);
  if ((k.turns_stored || 0) < turnsTotal) {
    return { error: `Lava draw requires ${turnsTotal} turns (you have ${k.turns_stored || 0})` };
  }
  if ((k.food || 0) < foodNeeded) {
    return { error: `Lava draw requires ${foodNeeded.toLocaleString()} food (you have ${(k.food || 0).toLocaleString()})` };
  }

  const bargeResult = setBargeStatus(k.flux_barges, bargeId, 'deployed');
  if (bargeResult.error) return bargeResult;

  const targetHex = pixelToHex(targetX, targetY);

  return {
    updates: {
      engineers: (k.engineers || 0) - cfg.crew_engineers,
      mages: (k.mages || 0) - cfg.crew_mages,
      food: (k.food || 0) - foodNeeded,
      turns_stored: (k.turns_stored || 0) - turnsTotal,
      flux_barges: serializeBarges(bargeResult.list),
    },
    turnsTotal,
    foodNeeded,
    pathHexes,
    targetX,
    targetY,
    targetHexCol: targetHex.col,
    targetHexRow: targetHex.row,
    bargeId,
  };
}

/**
 * Resolution — called from engine.js's resolveExpeditions when this
 * expedition's turns_left reaches 0. The whole round trip (travel +
 * on-site + return) is pre-baked into turns_total at launch, so the
 * arrival race is simulated right here: attempt to claim the vent as
 * of "now." Win -> draw lava. Lose -> empty-handed. Either way crew
 * returns and the barge takes hull wear.
 */
async function resolveLavaDraw(db, exp, kingdom) {
  const { updateKingdomVisibility } = require('./visibility');
  const { cellIndex } = require('./visibility-cells');
  const { safeJsonParse } = require('../utils/helpers');

  const events = [];
  const updates = {};
  const rewards = [];
  const cfg = lavaCfg();

  const extraData = safeJsonParse(exp.extra_data || '{}', {}, 'lava-expedition:extra_data');
  const pathHexes = extraData.path_hexes || [];
  const hexCol = extraData.target_hex_col;
  const hexRow = extraData.target_hex_row;
  const bargeId = extraData.barge_id;

  // Path fog reveal (no-roll) — same pattern as Epic Trek.
  if (pathHexes.length > 0) {
    try {
      await updateKingdomVisibility(db, kingdom.id, (current) => {
        let newSeenCells = current.seenCells;
        for (const hex of pathHexes) {
          if (hex.col !== undefined && hex.row !== undefined) {
            try {
              const idx = cellIndex(hex.col, hex.row);
              newSeenCells |= BigInt(1) << BigInt(idx);
            } catch {
              /* invalid hex coordinate — skip */
            }
          }
        }
        return { seenCells: newSeenCells, currentCells: current.currentCells, version: current.version };
      });
    } catch (err) {
      console.error(`[lava-draw] Fog reveal failed for kingdom ${kingdom.id}:`, err.message);
    }
  }

  // Travel finds — small per-hex junk chance, no rolls during the on-site draw itself.
  let junkCount = 0;
  for (let i = 0; i < pathHexes.length; i++) {
    if (Math.random() < 0.08) {
      junkPrize({ ...kingdom, ...updates }, updates);
      junkCount++;
    }
  }
  if (junkCount > 0) {
    rewards.push({ text: `Along the way, your crew picked up ${junkCount} small find${junkCount !== 1 ? 's' : ''}.` });
  }

  // Crew always returns — committed for the round trip only (§5).
  updates.engineers = (kingdom.engineers || 0) + cfg.crew_engineers;
  updates.mages = (kingdom.mages || 0) + cfg.crew_mages;

  // The arrival race.
  const claim = Number.isFinite(hexCol) && Number.isFinite(hexRow)
    ? await claimVent(db, hexCol, hexRow, kingdom.id)
    : { claimed: false, reason: 'invalid vent' };

  let hullResult = null;

  if (claim.claimed) {
    const yield_ = lavaYield(kingdom.race);
    updates.lava_stored = (kingdom.lava_stored || 0) + yield_;
    rewards.push({ text: `Your crew drew ${yield_} lava from the vent!` });
    events.push({ type: 'system', message: `🌋 Lava draw succeeded: +${yield_} lava.` });

    await releaseVent(db, hexCol, hexRow, kingdom.id, true);

    const engXp = Math.floor((cfg.xp_success.engineers || 10000) * (flagOn(kingdom, 'engineers_lodge') ? (config.FORGE_LODGE_ENG_XP_MULT || 1.15) : 1));
    const mageXp = cfg.xp_success.mages || 2500;
    const engRes = awardTroopXp({ ...kingdom, ...updates }, 'engineers', engXp);
    updates.troop_levels = JSON.parse(engRes.troop_levels);
    const mageRes = awardTroopXp({ ...kingdom, troop_levels: updates.troop_levels }, 'mages', mageXp);
    updates.troop_levels = JSON.parse(mageRes.troop_levels);
    const engResult = { engineer_level: kingdom.engineer_level || 1, engineer_xp: kingdom.engineer_xp || 0 };
    awardEngineerXp(engResult, engXp);
    updates.engineer_level = engResult.engineer_level;
    updates.engineer_xp = engResult.engineer_xp;

    hullResult = applyHullWear(kingdom.flux_barges, bargeId, 'success');
  } else {
    rewards.push({ text: claim.reason === 'occupied'
      ? `The vent was already occupied by ${claim.occupying_kingdom_name || 'another kingdom'} — your crew returned empty-handed.`
      : 'The vent had gone dormant by the time your crew arrived — they returned empty-handed.' });
    events.push({ type: 'system', message: '🌋 Lava draw failed: returned empty-handed.' });

    const engXp = Math.floor((cfg.xp_empty.engineers || 1500) * (flagOn(kingdom, 'engineers_lodge') ? (config.FORGE_LODGE_ENG_XP_MULT || 1.15) : 1));
    const mageXp = cfg.xp_empty.mages || 400;
    const engRes = awardTroopXp({ ...kingdom, ...updates }, 'engineers', engXp);
    updates.troop_levels = JSON.parse(engRes.troop_levels);
    const mageRes = awardTroopXp({ ...kingdom, troop_levels: updates.troop_levels }, 'mages', mageXp);
    updates.troop_levels = JSON.parse(mageRes.troop_levels);
    const engResult = { engineer_level: kingdom.engineer_level || 1, engineer_xp: kingdom.engineer_xp || 0 };
    awardEngineerXp(engResult, engXp);
    updates.engineer_level = engResult.engineer_level;
    updates.engineer_xp = engResult.engineer_xp;

    hullResult = applyHullWear(kingdom.flux_barges, bargeId, 'empty');
  }

  if (hullResult) {
    if (!hullResult.destroyed) {
      const statusResult = setBargeStatus(hullResult.list, bargeId, 'idle');
      updates.flux_barges = serializeBarges(statusResult.list || hullResult.list);
    } else {
      updates.flux_barges = serializeBarges(hullResult.list);
      rewards.push({ text: 'The Flux-Barge\'s hull gave out and was lost.' });
    }
  }

  return { events, updates, rewards };
}

module.exports = {
  canLaunch,
  buildLaunch,
  resolveLavaDraw,
  kingdomEngineerLevel,
  kingdomMageLevel,
};
