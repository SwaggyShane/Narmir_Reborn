// Natural morale cap — the highest morale value a kingdom can hold without
// outside boost. Read from economy (processFoodEconomy applies surplus bonus
// up to the cap) and from happiness/combat code paths.
//
// Lives in lib so economy and happiness modules can share it without going
// through engine.js (and avoiding the circular import that creates).

const fragmentBonusManager = require("../fragment-bonus-manager");

function naturalMoraleCap(k) {
  let cap = k.res_entertainment || 100;
  // Apply dynamic housing passive bonuses on morale / happiness (e.g.,
  // Celestial Realm, Ancient Elven Wood).
  const housingMoraleMult = fragmentBonusManager.getBonusMultiplier(k, 'housing', 'morale');
  const housingHappinessMult = fragmentBonusManager.getBonusMultiplier(k, 'housing', 'happiness');
  cap = Math.floor(cap * housingMoraleMult * housingHappinessMult);

  // Apply housing stability modifier (e.g., Void Essence, Cursed Bloodstone
  // reduce max morale).
  const housingStabilityMult = fragmentBonusManager.getBonusMultiplier(k, 'housing', 'stability');
  cap = Math.floor(cap * housingStabilityMult);

  return cap;
}

module.exports = { naturalMoraleCap };
