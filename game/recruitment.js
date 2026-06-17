/**
 * Unit Recruitment System
 * Handles hiring military and non-military units with level caps and capacity checks
 */

const fragmentBonusManager = require("./fragment-bonus-manager");
const { diluteTroopXp } = require("./lib/troops");
const { CAPS, PRESTIGE_MODIFIERS, UNIT_COST } = require("./config");

function levelCap(base, max, level, capLevel = 1000) {
  const lv = Math.max(1, Math.min(capLevel, level || 1));
  const range = capLevel - 1;
  if (range <= 0) return max;
  return Math.floor(base + ((max - base) * (lv - 1)) / range);
}

function getCap(field, level, prestigeLevel = 0) {
  const c = CAPS[field];
  if (!c) return Infinity;
  let baseCap = levelCap(c.base, c.max, level, c.capLevel || 1000);
  if (prestigeLevel > 0 && field.startsWith("bld_")) {
    const tier = PRESTIGE_MODIFIERS[Math.min(prestigeLevel, 5)];
    if (tier) {
      baseCap = Math.floor(baseCap * tier.bldCap);
    }
  }
  return baseCap;
}

function hireUnits(k, unit, amount) {
  const validUnits = [
    "fighters",
    "rangers",
    "clerics",
    "mages",
    "thieves",
    "ninjas",
    "researchers",
    "engineers",
    "scribes",
  ];
  if (!validUnits.includes(unit)) return { error: "Invalid unit type" };
  const amt = Math.floor(Number(amount));
  if (isNaN(amt) || amt <= 0) return { error: "Amount must be positive" };
  amount = amt;

  // School cap — researchers need schools (100 per school)
  if (unit === "researchers") {
    const schoolCap = k.bld_schools * 100;
    const currentResearchers = k.researchers;
    if (schoolCap === 0)
      return { error: "You need at least 1 school to hire researchers" };
    if (currentResearchers >= schoolCap)
      return {
        error: `School capacity full — ${schoolCap.toLocaleString()} researchers max with ${k.bld_schools} school${k.bld_schools > 1 ? "s" : ""} (100 per school)`,
      };
    if (currentResearchers + amount > schoolCap)
      return {
        error: `Only room for ${(schoolCap - currentResearchers).toLocaleString()} more researchers — build more schools (100 per school)`,
      };
  }

  // Barracks cap — military troops need barracks (500 per barracks)
  const BARRACKS_TROOPS = [
    "fighters",
    "rangers",
    "clerics",
    "thieves",
    "ninjas",
  ];
  if (BARRACKS_TROOPS.includes(unit)) {
    const barracksCapacityMult = fragmentBonusManager.getBonusMultiplier(k, 'barracks', 'capacity');
    const barracksCap = Math.floor(k.bld_barracks * 500 * barracksCapacityMult);
    const currentTroops = BARRACKS_TROOPS.reduce((s, u) => s + (k[u] || 0), 0);
    if (barracksCap === 0)
      return { error: "You need at least 1 barracks to hire troops" };
    if (currentTroops >= barracksCap)
      return {
        error: `Barracks full — ${barracksCap.toLocaleString()} troops max with ${k.bld_barracks} barracks (500 per barracks)`,
      };
    if (currentTroops + amount > barracksCap)
      return {
        error: `Only room for ${(barracksCap - currentTroops).toLocaleString()} more troops — build more barracks (500 per barracks)`,
      };
  }

  // Level cap check (researchers, engineers, scribes have no level cap)
  if (!["researchers", "engineers", "scribes"].includes(unit)) {
    let cap = getCap(unit, k.level || 1);
    // Orc: Unit capacity -50% rangers
    if (k.race === "orc" && unit === "rangers") {
      cap = Math.floor(cap * 0.5);
    }
    const current = k[unit] || 0;
    if (current >= cap)
      return {
        error: `Level ${k.level || 1} cap reached for ${unit} (max ${cap.toLocaleString()}) — gain levels to increase`,
      };
    if (current + amount > cap)
      return {
        error: `Level ${k.level || 1} cap: can only hire ${(cap - current).toLocaleString()} more ${unit} (max ${cap.toLocaleString()})`,
      };
  }

  const cost = amount * UNIT_COST;
  if (k.gold < cost)
    return { error: `Not enough gold — need ${cost.toLocaleString()} gold` };
  if (amount > k.population)
    return { error: "Not enough population available" };

  // Dilute unit XP pool when new recruits join — new troops lower the average
  const dilutedLevels = diluteTroopXp(k, unit, amount);

  return {
    updates: {
      gold: k.gold - cost,
      population: k.population - amount,
      [unit]: (k[unit] || 0) + amount,
      ...(dilutedLevels ? { troop_levels: dilutedLevels } : {}),
      updated_at: Math.floor(Date.now() / 1000),
    },
  };
}

module.exports = {
  levelCap,
  getCap,
  hireUnits,
};
