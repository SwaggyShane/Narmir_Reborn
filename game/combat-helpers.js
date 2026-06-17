/**
 * Combat Helpers
 * Shared helper functions used by combat resolution and related modules.
 */

const { WM_CREW_REQUIRED } = require('./config');

function isNight() {
  const h = new Date().getUTCHours();
  return h >= 1 && h < 13; // 8PM EST to 8AM EST (EST is UTC-5)
}

function happinessCombatMult(happiness) {
  const mult = 0.5 + (happiness / 120);
  return Math.max(0.5, Math.min(1.5, mult));
}

function wmCrewRequired(race, engineerLevel) {
  let base = WM_CREW_REQUIRED[race] || 3;
  // Dwarf racial unique - solo crew at engineer level 25+
  if (race === "dwarf" && engineerLevel >= 25) base = 1;
  return base;
}

module.exports = { isNight, happinessCombatMult, wmCrewRequired };
