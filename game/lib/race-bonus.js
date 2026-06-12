// Race + region + alliance + vault + hero stat multiplier resolution.
// Extracted from engine.js so combat, economy, magic, and covert modules can
// pull a single canonical raceBonus without re-importing engine itself
// (which would risk circular dependencies once those domains are split out).

const {
  RACE_BONUSES,
  RACE_COMBAT_MODIFIERS,
  REGION_DATA,
  HERO_CLASSES,
} = require("../config");
const { safeJsonParse } = require("../../utils/helpers");

function raceBonus(kingdom, stat) {
  const bonuses = RACE_BONUSES[kingdom.race] || {};
  const base = bonuses[stat] || 1.0;

  let combatMod = 1.0;
  if ((stat === "military" || stat === "magic") && RACE_COMBAT_MODIFIERS[kingdom.race]) {
    combatMod = RACE_COMBAT_MODIFIERS[kingdom.race];
  }

  const homeRegion = REGION_DATA[kingdom.race];
  const isHome = homeRegion && homeRegion.name === kingdom.region;
  const regionMult =
    isHome && homeRegion.bonus === stat ? 1 + homeRegion.mult : 1.0;

  let allianceMult = 1.0;
  if (
    kingdom._region_owned_by_my_alliance &&
    kingdom._region_bonus_type === stat
  ) {
    allianceMult = 1.1;
  }

  let vaultMult = 1.0;
  const aBuffs = safeJsonParse(
    kingdom.alliance_buffs,
    {},
    "raceBonus:alliance_buffs",
  );
  if (stat === "economy" && aBuffs.merchant_guild)
    vaultMult += aBuffs.merchant_guild * 0.05;
  if (stat === "stealth" && aBuffs.shadow_network)
    vaultMult += aBuffs.shadow_network * 0.02;
  if (stat === "military" && aBuffs.mercenary_subsidy)
    vaultMult += aBuffs.mercenary_subsidy * 0.02;

  let heroMult = 1.0;
  if (kingdom.heroes && Array.isArray(kingdom.heroes)) {
    for (const h of kingdom.heroes) {
      if (h.status !== "idle") continue;
      const cls = HERO_CLASSES[h.class];
      if (cls && cls.statBonus && cls.statBonus[stat]) {
        const bonusValue = cls.statBonus[stat] - 1.0;
        // Hero ability tiers unlock at levels 1, 5, 10 — scale linearly.
        if (h.level >= 10) {
          heroMult += bonusValue;
        } else if (h.level >= 5) {
          heroMult += bonusValue * 0.66;
        } else {
          heroMult += bonusValue * 0.33;
        }
      }
    }
  }

  return base * regionMult * allianceMult * vaultMult * heroMult * combatMod;
}

module.exports = { raceBonus };
