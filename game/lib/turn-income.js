// game/lib/turn-income.js
// processTurn income core: gold, mana, population, food economy.
// Engine extract plan S02. Mutates ctx in place. Order is load-bearing.

'use strict';

const {
  goldPerTurn,
  calculateTradeIncome,
  processFoodEconomy,
} = require('../economy');
const { manaPerTurn } = require('../magic');
const { popGrowth } = require('../population');
const { awardUnitXp } = require('./troops');

/**
 * Gold, mana, population, food — phases 1–4 before building attunements.
 *
 * @param {import('./turn-context').TurnContext} ctx
 * @returns {void}
 */
function runIncomePhase(ctx) {
  const { k, updates, events } = ctx;

  // ── 1. Gold income ───────────────────────────────────────────────────────────
  const income = goldPerTurn(k);
  const tradeIncome = calculateTradeIncome(k);
  // Respect gold already set by rebellionCheck (e.g. Treasury Looting) instead of
  // recomputing from the pre-turn k.gold snapshot and discarding it.
  const goldBase = updates.gold !== undefined ? updates.gold : k.gold;
  updates.gold = goldBase + income + tradeIncome;
  // Net per-turn rate for the client's resource strip (see
  // routes/response-structurer.js's economyFields whitelist and
  // client/src/stores/economyStore.js's receiveServerSnapshot).
  updates.gold_income = income + tradeIncome;

  let incomeMsg = `🪙 Turn ${updates.turn}: +${income.toLocaleString()} gold earned.`;
  if (tradeIncome > 0) {
    incomeMsg = `🪙 Turn ${updates.turn}: +${income.toLocaleString()} gold earned (+${tradeIncome.toLocaleString()} from trade routes).`;
  }
  events.push({ type: 'system', message: incomeMsg });

  // ── 2. Mana regeneration ─────────────────────────────────────────────────────
  const manaGain = manaPerTurn(k);
  updates.mana = k.mana + manaGain;
  // Net per-turn rate for the client's resource strip (see
  // routes/response-structurer.js's economyFields whitelist and
  // client/src/stores/economyStore.js's receiveServerSnapshot).
  updates.mana_regen = manaGain;
  events.push({
    type: 'system',
    message: `✨ Mana: +${manaGain.toLocaleString()} restored. Total: ${updates.mana.toLocaleString()}.`,
  });

  // Mages gain XP when producing mana
  if (k.mages > 0 && manaGain > 0) {
    const resMages = awardUnitXp({ ...k, ...updates }, 'mages', manaGain);
    if (resMages) updates.troop_levels = resMages;
  }

  // ── 3. Population growth ─────────────────────────────────────────────────────
  const growth = popGrowth(k);
  // Respect population already set by rebellionCheck (e.g. Unrest) instead of
  // recomputing from the pre-turn k.population snapshot and discarding it.
  const populationBase = updates.population !== undefined ? updates.population : k.population;
  updates.population = Math.max(0, populationBase + growth);
  if (growth > 0) {
    events.push({
      type: 'system',
      message: `👥 Population grew by ${growth.toLocaleString()} to ${updates.population.toLocaleString()}.`,
    });
  } else if (growth < 0) {
    events.push({
      type: 'system',
      message: `⚠️ Population declined by ${Math.abs(growth).toLocaleString()} to ${updates.population.toLocaleString()} due to low happiness.`,
    });
  }

  // ── 4. Food economy — farms, consumption, shortage consequences ──────────────
  const foodUpdates = processFoodEconomy({ ...k, ...updates }, events);
  Object.assign(updates, foodUpdates);
}

module.exports = {
  runIncomePhase,
};
