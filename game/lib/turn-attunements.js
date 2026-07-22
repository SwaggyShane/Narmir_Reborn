// game/lib/turn-attunements.js
// Building attunement runner for processTurn (engine extract S13 / A3-8).

'use strict';

const { getProfiler } = require('../profiling');
const attunementsMod = require('../attunements');
const {
  processGranaryAttunements,
  processVaultAttunements,
  processWallsAttunements,
  processGuardTowerAttunements,
  processOutpostAttunements,
  processTrainingAttunements,
  processBarracksAttunements,
  processCastleAttunements,
  processMausoleumAttunements,
  processLibraryAttunements,
  processMageTowerAttunements,
  processSchoolAttunements,
  processFarmAttunements,
  processSmithyAttunements,
  processMarketAttunements,
  processShrineAttunements,
  processTavernAttunements,
  processHousingAttunements,
} = attunementsMod;

/** Measure attunement function execution time for profiling. */
function measureAttunement(name, fn) {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  const profiler = getProfiler();
  profiler.recordAttunementCall(name, duration);
  return result;
}

// ── Building attunement processors, run in this exact order every turn ──────
// (A3-8, 2026-07-19: extracted from 18 near-identical inline blocks in
// processTurn — each was `measureAttunement(name, () => fn({...k, ...updates},
// events))` followed by `Object.assign(updates, result)`. Order is
// significant and preserved exactly: each processor sees {...k, ...updates}
// freshly merged with every prior processor's updates already applied.)
const BUILDING_ATTUNEMENT_PROCESSORS = [
  ['processGranaryAttunements', processGranaryAttunements],
  ['processVaultAttunements', processVaultAttunements],
  ['processBarracksAttunements', processBarracksAttunements],
  ['processWallsAttunements', processWallsAttunements],
  ['processGuardTowerAttunements', processGuardTowerAttunements],
  ['processOutpostAttunements', processOutpostAttunements],
  ['processTrainingAttunements', processTrainingAttunements],
  ['processCastleAttunements', processCastleAttunements],
  ['processMausoleumAttunements', processMausoleumAttunements],
  ['processLibraryAttunements', processLibraryAttunements],
  ['processMageTowerAttunements', processMageTowerAttunements],
  ['processSmithyAttunements', processSmithyAttunements],
  ['processMarketAttunements', processMarketAttunements],
  ['processShrineAttunements', processShrineAttunements],
  ['processTavernAttunements', processTavernAttunements],
  ['processSchoolAttunements', processSchoolAttunements],
  ['processFarmAttunements', processFarmAttunements],
  ['processHousingAttunements', processHousingAttunements],
];

function runBuildingAttunements(k, updates, events) {
  for (const [name, fn] of BUILDING_ATTUNEMENT_PROCESSORS) {
    const result = measureAttunement(name, () => fn({ ...k, ...updates }, events));
    Object.assign(updates, result);
  }
}

module.exports = {
  measureAttunement,
  runBuildingAttunements,
  BUILDING_ATTUNEMENT_PROCESSORS,
};
