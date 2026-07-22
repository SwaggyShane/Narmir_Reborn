// game/lib/turn-pipeline.js
// processTurn phase playlist (engine extract plan S10).
// Helpers that still live on engine (attunement runner, fire-and-forget) are
// injected so this module does not require('./engine') (cycle).

'use strict';

const { clearParseCache } = require('../../utils/helpers');
const { getProfiler } = require('../profiling');
const { createTurnContext } = require('./turn-context');
const { runPrelude } = require('./turn-prelude');
const { runIncomePhase } = require('./turn-income');
const { runProductionPhase } = require('./turn-production');
const { runLoreAndBuildings } = require('./turn-lore-buildings');
const { runUpkeepAndFlavor } = require('./turn-upkeep-flavor');
const { runResearchPhase } = require('./turn-research');
const { runQueuesPhase } = require('./turn-queues');
const { runTrainingAndXpPhase } = require('./turn-training-xp');
const { finalizeTurn } = require('./turn-finalize');

/**
 * @param {object} k
 * @param {object|null} db
 * @param {{
 *   measureAttunement: Function,
 *   fireAndForgetWithRetry: Function,
 *   runBuildingAttunements: Function,
 * }} helpers
 * @returns {{ updates: object, events: object[], _profileReport: object }}
 */
function processTurn(k, db, helpers) {
  const profiler = getProfiler();
  profiler.start();
  clearParseCache();

  const ctx = createTurnContext(k, db);
  runPrelude(ctx);
  runIncomePhase(ctx);
  helpers.runBuildingAttunements(k, ctx.updates, ctx.events);
  runProductionPhase(ctx, {
    measureAttunement: helpers.measureAttunement,
    fireAndForgetWithRetry: helpers.fireAndForgetWithRetry,
  });
  runLoreAndBuildings(ctx);
  runUpkeepAndFlavor(ctx);
  runResearchPhase(ctx);
  runQueuesPhase(ctx);
  runTrainingAndXpPhase(ctx);
  return finalizeTurn(ctx, profiler);
}

module.exports = {
  processTurn,
};
