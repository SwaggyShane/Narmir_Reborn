// game/lib/turn-lore-buildings.js
// processTurn phases 5 + 5b: lore drops and free build-queue completion.
// Engine extract plan S04. Mutates ctx in place. Order is load-bearing.
// Note: engineer build *queue processing* (section 8) is S07 — this is 5b only.

'use strict';

const config = require('../config');
const { ensureArray, ensureObject } = require('./healing');
const { awardUnitXp } = require('./troops');
const { safeJsonStringify } = require('../../utils/helpers');
const {
  awardEngineerXp,
} = require('../engineers');

/**
 * @param {import('./turn-context').TurnContext} ctx
 * @returns {void}
 */
function runLoreAndBuildings(ctx) {
  const { k, updates, events } = ctx;

  // ── 5. Lore Events ────────────────────────────────────────────────────────────
  // 0.1% chance ~ 24000 turns needed for 24 drops
  if (Math.random() < 0.001) {
    // config.LORE_EVENTS is refreshed from the lore_entries table at boot
    // (seeded from game/lore.js); falls back to the static book before then.
    const LORE = config.LORE_EVENTS;
    const cats = ['narmir', 'general', k.race];
    const cat = cats[Math.floor(Math.random() * cats.length)];
    const raceLore = LORE[cat] || [];
    if (raceLore.length > 0) {
      const loreCollected = ensureArray(
        updates.collected_lore || k.collected_lore,
        []
      );
      const lastId = updates.last_lore_id || k.last_lore_id;

      let available = raceLore.filter((l) => l.id !== lastId);
      if (available.length === 0) available = raceLore;
      const ev = available[Math.floor(Math.random() * available.length)];
      if (ev) {
        if (!loreCollected.includes(ev.id)) {
          loreCollected.push(ev.id);
          updates.collected_lore = safeJsonStringify(loreCollected);

          // Historian unlocks when the kingdom's reachable pool is complete
          // (narmir + general + own race — other races' lore can't drop here)
          const reachableTotal = cats.reduce(
            (sum, c) => sum + (LORE[c] || []).length,
            0,
          );
          const collectedReachable = loreCollected.filter((id) =>
            cats.some((c) => (LORE[c] || []).some((l) => l.id === id)),
          ).length;
          if (collectedReachable >= reachableTotal) {
            updates._historian_unlocked = true;
          }
        }
        updates.last_lore_id = ev.id;
        events.push({
          type: 'system',
          message: `📜 HISTORY: ${ev.msg || ev.content || ev}`,
        });
      }
    }
  }

  // ── 5b. Building completion (legacy per-job queue objects only) ───────────────
  // Live construction uses processBuildQueue (section 8 / turn-queues): build_queue
  // values are *counts* per building key, e.g. { woodyard: 1 }, not job objects.
  // Mutating turns_remaining on a number throws:
  //   "Cannot create property 'turns_remaining' on number '1'"
  // Only process entries that are plain job objects with turns_remaining.
  // build_queue pre-healed by healKingdomForTurn (M1-3)
  let buildQueue = ensureObject(k.build_queue, {});
  let buildQueueChanged = false;
  const completedBuildings = [];

  for (const [queueId, buildJob] of Object.entries(buildQueue)) {
    if (!buildJob || typeof buildJob !== 'object' || Array.isArray(buildJob)) {
      continue; // count-style queue entry owned by processBuildQueue
    }
    if (buildJob.turns_remaining === undefined && buildJob.turns_needed === undefined) {
      continue;
    }

    buildJob.turns_remaining = (Number(buildJob.turns_remaining) || 1) - 1;

    if (buildJob.turns_remaining <= 0) {
      completedBuildings.push(buildJob);
      delete buildQueue[queueId];
      buildQueueChanged = true;

      // Increment building count
      if (!updates[buildJob.building]) {
        updates[buildJob.building] = (k[buildJob.building] || 0) + 1;
      } else {
        updates[buildJob.building]++;
      }

      // Award engineer XP (preserve existing troop_levels)
      const xpGain = Math.ceil((buildJob.turns_needed || 0) / 100);
      const mergedK = { ...k, ...updates };
      const newTroopLevels = awardUnitXp(mergedK, 'engineers', xpGain);
      if (newTroopLevels) updates.troop_levels = newTroopLevels;

      // Apply engineer level progression
      awardEngineerXp(mergedK, xpGain);
      updates.engineer_level = mergedK.engineer_level;
      updates.engineer_xp = mergedK.engineer_xp;

      events.push({
        type: 'system',
        message: `✅ Construction complete: ${String(buildJob.building || queueId).replace(/_/g, ' ')}! Engineers gained ${xpGain} XP.`,
      });
    }
  }

  if (buildQueueChanged) {
    updates.build_queue = safeJsonStringify(buildQueue);
  }
}

module.exports = {
  runLoreAndBuildings,
};
