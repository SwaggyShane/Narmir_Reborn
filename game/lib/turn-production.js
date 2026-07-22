// game/lib/turn-production.js
// processTurn mid production: resources, mercs, maps, active events, scout.
// Engine extract plan S03. Attunements stay outside this module (called first by processTurn).
// Mutates ctx in place. Order is load-bearing.

'use strict';

const { processResourceYield } = require('../economy');
const { processMercenaries, junkPrize } = require('./gameplay');
const { processLocationMapsWip } = require('./expeditions');
const { ensureObject } = require('./healing');
const { safeJsonStringify } = require('../../utils/helpers');
const { processScoutProgress } = require('../scout-progress');
const { getProgressMetrics } = require('../scout-rings');
const { processPassiveScoutFinds } = require('../passive-scout-finds');
const { revealRingHexes } = require('../visibility');
const { checkFogDiscoveries } = require('../kingdom-fog-discovery');

/**
 * @param {import('./turn-context').TurnContext} ctx
 * @param {{ measureAttunement: Function, fireAndForgetWithRetry: Function }} [helpers]
 *   Optional inject for tests; defaults to lib modules (S13).
 * @returns {void}
 */
function runProductionPhase(ctx, helpers) {
  const { k, db, updates, events } = ctx;
  const measureAttunement = (helpers && helpers.measureAttunement)
    || require('./turn-attunements').measureAttunement;
  const fireAndForgetWithRetry = (helpers && helpers.fireAndForgetWithRetry)
    || require('./fire-and-forget').fireAndForgetWithRetry;

  // ── 4b. Resource production (wood / stone / iron) ────────────────────────────
  const resourceUpdates = processResourceYield({ ...k, ...updates }, events);
  Object.assign(updates, resourceUpdates);

  // ── 4c. Tavern entertainment bonus (Disabled: taverns no longer grant entertainment study per turn) ──
  /*
  const entBonus = tavernEntertainmentBonus(k);
  if (entBonus > 0) {
    updates.res_entertainment = Math.min(
      500,
      k.res_entertainment + Math.floor(entBonus / 10),
    );
  }
  */

  // ── 4c. Mercenary upkeep and expiry ───────────────────────────────────────────
  const mercUpdates = processMercenaries({ ...k, ...updates }, events);
  Object.assign(updates, mercUpdates);

  // ── 4d. Location maps in progress ────────────────────────────────────────────
  const locUpdates = processLocationMapsWip({ ...k, ...updates }, events);
  Object.assign(updates, locUpdates);

  // ── 4e. Active event tick-down ────────────────────────────────────────────────
  const activeEv2 = ensureObject(
    updates.active_event || k.active_event,
    {}
  );
  let changed = false;
  for (const key of Object.keys(activeEv2)) {
    activeEv2[key].turns_remaining = (activeEv2[key].turns_remaining || 1) - 1;
    if (activeEv2[key].turns_remaining <= 0) {
      delete activeEv2[key];
    }
    changed = true;
  }
  if (changed) updates.active_event = safeJsonStringify(activeEv2);

  // ── 4e-i. Scout ring progression ──────────────────────────────────────────────
  {
    try {
      const scoutResult = measureAttunement('processScoutProgress', () =>
        processScoutProgress({ ...k, ...updates }, db)
      );
      if (scoutResult.progress_gained > 0) {
        updates.scout_progress = scoutResult.new_total;
        const metrics = getProgressMetrics(scoutResult.new_total);
        const pctStr = Math.round(metrics.percentComplete);
        const ringMsg = metrics.nextRing ? `toward Ring ${metrics.nextRing}` : `Ring ${metrics.currentRing} (Complete)`;
        const scoutMsg = `Scouts: ${pctStr}% ${ringMsg}`;
        events.push({
          type: 'system',
          message: `🔍 ${scoutMsg}`,
          skipNews: true,
          expeditionLogEntry: {
            icon: '🔍',
            title: scoutMsg,
            subtitle: 'Scout allocation progress',
          },
        });
        // Reveal new ring hexes if a ring was completed. scout_progress is
        // cumulative, so a single turn's gain (e.g. a large ranger
        // allocation) can cross more than one ring threshold at once —
        // completed_ring_number is only the LAST one reached. Loop every
        // ring from previous_ring+1 through completed_ring_number, or the
        // in-between rings' hexes (and anything seeded on them, like a
        // region's dungeon/mountain location) would never get revealed at
        // all despite the kingdom's progress having already passed them.
        if (scoutResult.ring_completed && db && k.id) {
          for (let r = scoutResult.previous_ring + 1; r <= scoutResult.completed_ring_number; r++) {
            fireAndForgetWithRetry(
              () => revealRingHexes(db, k.id, { ...k, ...updates }, r),
              `reveal scout ring ${r} for kingdom ${k.id}`,
            );
          }
        }

        // Deterministic kingdom discovery: no dice roll — whatever hex has
        // its fog removed (this turn or previously) is checked against every
        // other kingdom's home hex, every turn scouts are allocated. Not
        // gated on ring_completed since a kingdom with fog already fully
        // uncovered (DISABLE_FOG_OF_WAR test bypass) needs this to keep
        // firing rather than only at the moment a new ring is first reached.
        if (db && k.id) {
          checkFogDiscoveries(db, k.id).catch(err =>
            console.error(`[engine] Fog discovery check failed for kingdom ${k.id}: ${err.message}`)
          );
        }

        // Passive scouting continuous finds (P0 §3a): allocation-scaled
        // table in game/passive-scout-finds.js — replaces flat 5% junk/resource stub.
        processPassiveScoutFinds(
          { ...k, ...updates, scout_allocation: k.scout_allocation },
          updates,
          events,
          { junkPrize },
        );
      }
    } catch (err) {
      console.error('[engine] Scout progression error:', err.message);
    }
  }
}

module.exports = {
  runProductionPhase,
};
