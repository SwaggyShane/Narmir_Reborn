/**
 * Combat Helpers
 * Small pure utilities used across combat resolution
 */

const { WM_CREW_REQUIRED } = require('./config');

function isNight() {
  const h = new Date().getUTCHours();
  return h >= 1 && h < 13; // 8PM EST to 8AM EST (EST is UTC-5)
}

function wmCrewRequired(race, engineerLevel) {
  let base = WM_CREW_REQUIRED[race] || 3;
  // Dwarf racial unique — solo crew at engineer level 25+
  if (race === "dwarf" && engineerLevel >= 25) base = 1;
  return base;
}

function happinessCombatMult(happiness) {
  const h = typeof happiness === "number" && !isNaN(happiness) ? happiness : 100;
  const mult = 0.5 + (h / 120);
  return Math.max(0.5, Math.min(1.5, mult));
}

function resolveAllianceDefense(attackResult, allies) {
  // When a kingdom is attacked, allied kingdoms send pledge % of their fighters
  if (!attackResult.win) return [];
  return allies.map((ally) => {
    const sent = Math.floor(ally.fighters * (ally.pledge / 100));
    return { allyId: ally.id, sent };
  });
}
module.exports = {
  isNight,
  wmCrewRequired,
  happinessCombatMult,
  resolveAllianceDefense,
};
