// game/lib/turn-queues.js
// processTurn section 8: build queue, forge ticks, library/trade/defense/tower/shrine/effects.
// Engine extract plan S07. Mutates ctx (incl. xpSourcesAccum) in place. Order is load-bearing.

'use strict';

const { processBuildQueue } = require('./building-research');
const { processCharcoalTick } = require('../forge-production');
const { processBargeBuildTick } = require('../flux-barge');
const {
  processLibrary,
  processMageTower,
  processShrine,
  processMausoleum,
} = require('../magic');
const { getPrestigeModifiers } = require('../prestige/balance');
const { checkDefenseTiers } = require('../defense');
const { processActiveEffects } = require('./gameplay');
const { ensureArray } = require('./healing');
const { safeJsonStringify } = require('../../utils/helpers');

/**
 * @param {import('./turn-context').TurnContext} ctx
 * @returns {void}
 */
function runQueuesPhase(ctx) {
  const { k, updates, events } = ctx;
  let xpSourcesAccum = ctx.xpSourcesAccum;

  // ── 8. Build queue — engineers work on queued buildings each turn ─────────────
  const buildUpdates = processBuildQueue({ ...k, ...updates }, events, xpSourcesAccum);
  Object.assign(updates, buildUpdates);
  if (buildUpdates.xp_sources_updated) Object.assign(xpSourcesAccum, buildUpdates.xp_sources_updated);

  // ── 8a. Forge charcoal pit (A3) ────────────────────────────────────────────
  try {
    const charcoal = processCharcoalTick({ ...k, ...updates });
    if (charcoal.updates && Object.keys(charcoal.updates).length) {
      Object.assign(updates, charcoal.updates);
      if (charcoal.coalGain > 0) {
        events.push({
          type: 'system',
          message: `🔥 Charcoal pit: burned ${charcoal.woodSpent.toLocaleString()} wood → ${charcoal.coalGain.toLocaleString()} coal.`,
        });
      }
    }
  } catch {
    /* forge-production optional if partial deploy */
  }

  // ── 8a2. Flux-Barge build queue (A4) ─────────────────────────────────────
  try {
    const bargeTick = processBargeBuildTick({ ...k, ...updates });
    if (bargeTick.updates && Object.keys(bargeTick.updates).length) {
      Object.assign(updates, bargeTick.updates);
      if (bargeTick.completed && bargeTick.completed.length) {
        events.push({
          type: 'system',
          message: `🚤 Flux-Barge ready: #${bargeTick.completed.join(', #')}.`,
        });
      }
    }
  } catch {
    /* flux-barge optional if partial deploy */
  }

  // ── 8b. Library — mages produce mana, scribes craft maps/blueprints, mages craft scrolls ──
  const libUpdates = processLibrary({ ...k, ...updates }, events);
  Object.assign(updates, libUpdates);

  // ── 8d. Legacy trade_routes INT income (uses prestige econ mult only) ───────
  // Not a second prestige formula: same table as economy.js (getPrestigeModifiers.econ).
  const legacyTradeRoutes = k.trade_routes || 0;
  const tradeEconMult = getPrestigeModifiers(k.prestige_level || 0).econ || 1.0;
  const legacyTradeIncome = Math.floor(legacyTradeRoutes * 100 * tradeEconMult);
  if (legacyTradeIncome > 0) {
    updates.gold = (updates.gold || k.gold) + legacyTradeIncome;
    events.push({
      type: 'system',
      message: `Trade Routes generated ${legacyTradeIncome.toLocaleString()} gold.`,
    });
  }

  // Bank Deposits processing
  // pre-healed (M1-3)
  let deposits = ensureArray(
    k.bank_deposits,
    []
  );
  let depositPayout = 0;
  let hasCompleted = false;

  deposits.forEach((dep) => {
    if (dep.status === 'active' && updates.turn >= dep.targetTurn) {
      dep.status = 'completed';
      depositPayout += dep.returnAmount;
      hasCompleted = true;
    }
  });

  if (hasCompleted) {
    deposits = deposits.filter((d) => d.status === 'active');
    updates.bank_deposits = safeJsonStringify(deposits);
    updates.gold = (updates.gold || k.gold) + depositPayout;
    events.push({
      type: 'system',
      message: `🏦 Bank deposits matured! Earned ${depositPayout.toLocaleString()} gold.`,
    });
  }

  // ── 8d. Defence — calculate defense tiers ───────────────────────────────────────────────
  const tierUpdates = checkDefenseTiers({ ...k, ...updates }, events);
  Object.assign(updates, tierUpdates);

  // ── 8c. Mage tower research — research from mages in towers ──────────────────
  const towerUpdates = processMageTower({ ...k, ...updates }, events);
  Object.assign(updates, towerUpdates);

  // ── 8d. Shrines — clerics boost happiness and prepare to heal ───────────────────
  if (k.race === 'vampire') {
    const mausoleumUpdates = processMausoleum({ ...k, ...updates }, events);
    Object.assign(updates, mausoleumUpdates);
  } else {
    const shrineUpdates = processShrine({ ...k, ...updates }, events);
    Object.assign(updates, shrineUpdates);
  }

  // ── 8e. Active effects — tick down debuffs/buffs ─────────────────────────────
  const effectUpdates = processActiveEffects({ ...k, ...updates }, events);
  Object.assign(updates, effectUpdates);

  ctx.xpSourcesAccum = xpSourcesAccum;
}

module.exports = {
  runQueuesPhase,
};
