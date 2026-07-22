// game/lib/turn-context.js
// Shared turn-phase context for processTurn extracts (engine extract plan S00).
// Phases mutate updates/events in place. createTurnContext owns init healing only.

'use strict';

const {
  healKingdomForTurn,
} = require('./healing');

/** JSON columns healed and applied onto the kingdom row at turn start (matches processTurn). */
const TURN_JSON_FIELDS = Object.freeze([
  'troop_levels', 'xp_sources', 'build_queue',
  'active_effects', 'active_event', 'collected_lore',
  'school_upgrades', 'research_focus', 'research_progress', 'milestone_bonuses',
  'bank_deposits', 'training_allocation', 'research_allocation', 'mage_research_progress',
  'racial_bonuses_unlocked', 'discovered_kingdoms', 'location_maps_wip',
]);

/**
 * @typedef {object} TurnContext
 * @property {object} k
 * @property {object|null} db
 * @property {object} updates
 * @property {object[]} events
 * @property {object} [xpSourcesAccum]
 * @property {object} [happinessResult]
 * @property {object} [profiler]
 */

/**
 * Heal JSON columns on the kingdom row and seed the turn updates/events bags.
 * Mutates `k` in place for healed fields (same as legacy processTurn init).
 *
 * @param {object} k
 * @param {object|null} [db=null]
 * @returns {TurnContext}
 */
function createTurnContext(k, db = null) {
  // M1-3: centralized healing for nested-stringified JSON columns.
  const healed = healKingdomForTurn(k || {});
  // Apply healed (object/array) values so later safeJsonParse(k.xxx) sees objects.
  for (const f of TURN_JSON_FIELDS) {
    if (healed[f] !== undefined) k[f] = healed[f];
  }

  return {
    k,
    db: db || null,
    updates: {
      turn: k.turn + 1,
      updated_at: Math.floor(Date.now() / 1000),
    },
    events: [],
  };
}

/**
 * Merged kingdom view for steps that intentionally read post-update state.
 * @param {TurnContext} ctx
 * @returns {object}
 */
function mergeState(ctx) {
  return { ...ctx.k, ...ctx.updates };
}

/**
 * @param {TurnContext} ctx
 * @param {object} partial
 */
function assignUpdates(ctx, partial) {
  Object.assign(ctx.updates, partial);
}

module.exports = {
  TURN_JSON_FIELDS,
  createTurnContext,
  mergeState,
  assignUpdates,
};
