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

function moraleMult(morale) {
  const m = typeof morale === "number" && !isNaN(morale) ? morale : 100;
  if (m < 50) return 0.8 + (m / 50) * 0.1; // 0.80–0.90
  if (m < 100) return 0.9 + ((m - 50) / 50) * 0.1; // 0.90–1.00
  return Math.min(1.2, 1.0 + ((m - 100) / 100) * 0.1); // 1.00–1.20 (capped at 1.20)
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
  moraleMult,
  happinessCombatMult,
  resolveAllianceDefense,
};
