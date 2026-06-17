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
  // Dwarf racial unique ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â solo crew at engineer level 25+
  if (race === "dwarf" && engineerLevel >= 25) base = 1;
  return base;
}

function moraleMult(morale) {
  if (morale < 50) return 0.8 + (morale / 50) * 0.1; // 0.80ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“0.90
  if (morale < 100) return 0.9 + ((morale - 50) / 50) * 0.1; // 0.90ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“1.00
  return Math.min(1.2, 1.0 + ((morale - 100) / 100) * 0.1); // 1.00ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“1.20 (capped at 1.20)
}

function happinessCombatMult(happiness) {
  const mult = 0.5 + (happiness / 120);
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
