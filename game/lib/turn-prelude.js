// game/lib/turn-prelude.js
// processTurn prelude: evolution tick, goals, XP source init, happiness, rebellion.
// Engine extract plan S01. Mutates ctx in place. Order is load-bearing.

'use strict';

const { processEvolutionTurn } = require('../evolution');
const { progressGoal } = require('../goals');
const { calculateHappiness } = require('../happiness');
const { recordHappinessHistory } = require('./happiness-logging');
const { rebellionCheck } = require('./special-events');
const { ensureObject, getXpSources } = require('./healing');
const { safeJsonStringify } = require('../../utils/helpers');

/**
 * Run pre-income turn steps on an existing TurnContext from createTurnContext.
 * Sets ctx.xpSourcesAccum and ctx.happinessResult.
 *
 * @param {import('./turn-context').TurnContext} ctx
 * @returns {void}
 */
function runPrelude(ctx) {
  const { k, db, updates, events } = ctx;

  // Dragon ritual tick (castle fail / complete / decrement)
  {
    const evoSnap = { ...k, turn: updates.turn, bld_castles: updates.bld_castles ?? k.bld_castles };
    const evoResult = processEvolutionTurn(evoSnap);
    if (evoResult) {
      Object.assign(updates, evoResult.updates);
      if (evoResult.events?.length) events.push(...evoResult.events);
      // Keep in-memory k in sync so later turn steps see form/ritual
      if (evoResult.updates.evolution_form !== undefined) k.evolution_form = evoResult.updates.evolution_form;
      if (evoResult.updates.evolution_ritual !== undefined) k.evolution_ritual = evoResult.updates.evolution_ritual;
    }
  }

  progressGoal(k, updates, 'turn_taken', 1);

  // Initialize XP source tracking at the very beginning (already healed via M1-3)
  ctx.xpSourcesAccum = getXpSources(k.xp_sources);

  // Calculate happiness using last turn's active_effects so the penalty is applied before decay
  const happinessResult = calculateHappiness(k);
  ctx.happinessResult = happinessResult;
  updates.happiness = happinessResult.happiness;

  // Decay fragment happiness penalty by 1 toward 0 each turn; remove the key when it reaches 0
  // active_effects pre-healed (M1-3)
  {
    const decayEffects = ensureObject(k.active_effects, {});
    if ((decayEffects.fragment_happiness_penalty || 0) < 0) {
      decayEffects.fragment_happiness_penalty = Math.min(0, decayEffects.fragment_happiness_penalty + 1);
      if (decayEffects.fragment_happiness_penalty === 0) {
        delete decayEffects.fragment_happiness_penalty;
      }
      updates.active_effects = safeJsonStringify(decayEffects);
    }
  }

  // Record happiness history for tracking and graphing
  if (db && k.id) {
    recordHappinessHistory(db, k.id, updates.turn, happinessResult).catch(err =>
      console.error(`[engine] Failed to record happiness history: ${err.message}`)
    );
  }

  {
    const comp = happinessResult.components || {};
    const happinessParts = [];
    const orderedComponents = [
      ['food', comp.food],
      ['entertainment', comp.entertainment],
      ['safety', comp.safety],
      ['prosperity', comp.prosperity],
      ['race', comp.race],
      ['effects', comp.effects],
      ['synergy', comp.synergy],
      ['tax', comp.tax],
      ['overcrowding', comp.overcrowding],
      ['fragments', comp.fragments]
    ];
    for (const [label, value] of orderedComponents) {
      const amount = Number(value || 0);
      if (!amount) continue;
      const prefix = amount > 0 ? '+' : '';
      happinessParts.push(`${label} ${prefix}${amount}`);
    }
    events.push({
      type: 'system',
      message: `😊 Happiness: ${happinessResult.happiness}/120 (recovery +${happinessResult.recovery}${happinessParts.length ? ', ' + happinessParts.join(', ') : ''})`
    });
  }

  // Check for rebellion events
  rebellionCheck(k, happinessResult.happiness, updates, events);
}

module.exports = {
  runPrelude,
};
