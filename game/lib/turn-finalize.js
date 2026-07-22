// game/lib/turn-finalize.js
// processTurn end: EOT gold summary, achievements, cleanup, profiler.
// Engine extract plan S09. Returns the processTurn result object.

'use strict';

const effectsProcessor = require('../synergy-effects-processor');
const { checkAchievements } = require('./achievements');
const { cleanNewsEvent } = require('./data-transformations');
const { resetDevProfiler, BUDGETS } = require('../profiling');

/**
 * @param {import('./turn-context').TurnContext} ctx
 * @param {{ end: Function }} profiler  TurnProfiler from game/profiling
 * @returns {{ updates: object, events: object[], _profileReport: object }}
 */
function finalizeTurn(ctx, profiler) {
  const { k, updates, events } = ctx;

  const finalGold = updates.gold !== undefined ? updates.gold : k.gold;
  const netGoldChange = finalGold - k.gold;
  const netSign = netGoldChange >= 0 ? '+' : '';
  events.push({
    type: 'system',
    message: `💰 End of Turn ${updates.turn} — Net Gold: ${netSign}${netGoldChange.toLocaleString()}. Final Treasury: ${finalGold.toLocaleString()} gold.`,
  });

  updates.last_turn_at = Math.floor(Date.now() / 1000);
  checkAchievements(k, updates, events);

  // Clean up temporary fields
  delete updates.xp_sources_updated;

  // Remove expired synergy effects at end of turn
  const kingdomForEffectCleanup = { ...k, ...updates };
  const cleanedKingdom = effectsProcessor.removeExpiredEffects(kingdomForEffectCleanup);
  if (cleanedKingdom && cleanedKingdom.active_effects && cleanedKingdom.active_effects !== kingdomForEffectCleanup.active_effects) {
    updates.active_effects = cleanedKingdom.active_effects;
  }

  const report = profiler.end();

  // Dev always-on profiler: surface budget warnings
  if (process.env.NODE_ENV !== 'production' && report && report.summary && report.summary.profileNeeded) {
    const needed = report.summary.profileNeeded;
    if (needed.jsonHighCost) {
      console.warn(`[profiler] JSON high cost: ${report.jsonOperations.totalTime}ms (budget ${BUDGETS.jsonHighCostMs}ms)`);
    }
    if (needed.highSynergyLookups) {
      console.warn(`[profiler] High synergy lookups: ${report.synergyLookups} (budget ${BUDGETS.highSynergyLookups})`);
    }
    if (needed.slowAttunementExists) {
      console.warn('[profiler] Slow attunements detected (see _profileReport)');
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    try { resetDevProfiler(); } catch { /* ignore */ }
  }

  return { updates, events: events.map(cleanNewsEvent), _profileReport: report };
}

module.exports = {
  finalizeTurn,
};
