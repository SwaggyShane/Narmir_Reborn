/**
 * combat.js — public combat API (Combat V2 only).
 *
 * Legacy aggregate-power combat was removed 2026-07-16. All military attacks
 * resolve through game/lib/combat-wrappers.js → combat-resolver.js.
 */

'use strict';

const wrappers = require('./lib/combat-wrappers');
const helpers = require('./lib/combat-helpers');

module.exports = {
  resolveMilitaryAttack: wrappers.resolveMilitaryAttack,
  resolveMilitaryAttackV2Adapter: wrappers.resolveMilitaryAttackV2Adapter,
  wmCrewRequired: wrappers.wmCrewRequired,
  // Formatting helpers (kept for engine / comparative tests re-exports)
  sumRecordValues: helpers.sumRecordValues,
  normalizeCombatUnits: helpers.normalizeCombatUnits,
  formatCombatUnitCounts: helpers.formatCombatUnitCounts,
  formatCombatBuildingsLost: helpers.formatCombatBuildingsLost,
  formatCombatV2NewsBlurb: helpers.formatCombatV2NewsBlurb,
};
