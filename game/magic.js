// Magic domain: spell casting, mage tower / shrine / mausoleum / library
// per-turn processing, and mana regeneration.
//
// Extracted from engine.js. Pure functions over kingdom rows + events
// arrays (no I/O). castSpell is the headline export — applies tier 1-5
// spells to a target kingdom and returns the updates each side should
// merge plus events for the news log.

const fragmentBonusManager = require("./fragment-bonus-manager");
const effectsProcessor = require("./synergy-effects-processor");
const { safeJsonParse } = require("../utils/helpers");
const { raceBonus } = require("./lib/race-bonus");
const {
  getAvailableUnits,
  unitLevelMult,
  awardTroopXp,
  racialUnitBonus,
  awardUnitXp,
} = require("./lib/troops");
const { getSynergyPassiveBonusMultiplier } = require("./lib/synergy-cache");
const { naturalHappinessCap } = require("./lib/happiness-cap");
const { getMasonSigilResist } = require("./lib/defense");
const { getFlag } = require("./feature-flags");
const { hasElevationGrid, getElevationGrid } = require("./world-elevation-cache");
const { canCastSpell, getKingdomElevationLevel } = require("./world-elevation");

const {
  SPELL_DEFS,
  MAGIC_SCHOOLS,
  SCROLL_REQUIREMENTS,
  SCRIBE_ITEMS,
} = require("./config");

function manaPerTurn(k) {
  const raceManaBase =
    {
      high_elf: 8,
      dark_elf: 6,
      human: 3,
      dwarf: 2,
      orc: 2,
      dire_wolf: 1,
    }[k.race] || 3;
  const towerMana = k.bld_mage_towers * 5;
  const capacity = k.bld_mage_towers * 20;
  const effectiveMages = Math.min(getAvailableUnits(k, "mages"), capacity);
  const mageMana = Math.floor(effectiveMages / 5);

  // Tower upgrades
  const towerUpgrades = safeJsonParse(
    k.tower_upgrades,
    {},
    "manaPerTurn:tower_upgrades",
  );
  const arcaneMult = towerUpgrades.arcane_focus ? 1.25 : 1.0;

  let manaGen = Math.floor(
    (raceManaBase + towerMana + mageMana) * raceBonus(k, "magic") * arcaneMult,
  );

  // Apply world fragment bonuses for mage towers (mana, manaRegen, power)
  const manaMult = fragmentBonusManager.getBonusMultiplier(k, 'mage_towers', 'mana');
  const manaRegenMult = fragmentBonusManager.getBonusMultiplier(k, 'mage_towers', 'manaRegen');
  const manaPowerMult = fragmentBonusManager.getBonusMultiplier(k, 'mage_towers', 'power');
  manaGen = Math.floor(manaGen * manaMult * manaRegenMult * manaPowerMult);

  // Apply housing magic output bonus (e.g., Abyssal Crystal)
  const housingMagicMult = fragmentBonusManager.getBonusMultiplier(k, 'housing', 'magic_output');
  manaGen = Math.floor(manaGen * housingMagicMult);

  // Apply happiness multiplier
  const happiness = k.happiness !== undefined && k.happiness !== null ? k.happiness : 50;
  const happinessMult = Math.max(0, 0.5 + (happiness / 100));
  manaGen = Math.floor(manaGen * happinessMult);

  // Synergy passive bonus for mana regeneration
  const synergyManaMult = getSynergyPassiveBonusMultiplier(k, 'mana_regen');
  manaGen = Math.floor(manaGen * synergyManaMult);

  // Apply active ability effects (synergy_penalty.all_stats reduces mana)
  // Use 'mana' stat type to allow for future mana-specific penalties
  const penaltyMult = effectsProcessor.getPenaltyMultiplier(k, 'mana');
  manaGen = Math.floor(manaGen * penaltyMult);

  return manaGen;
}

function validateSpellTarget(caster, target, spellId) {
  const def = SPELL_DEFS[spellId];
  if (!def) return { error: "Unknown spell" };

  const isFriendly = def.effect === "friendly";

  if (isFriendly) {
    return {
      def,
      isFriendly,
      target: target || caster,
    };
  }

  if (!target) {
    return { error: "Target kingdom not found" };
  }
  if (target.id === caster.id) {
    return { error: "Cannot cast offensive spells on yourself" };
  }
  if ((caster.turn || 0) < 400) {
    return {
      error:
        "You are under newbie protection until Turn 400. You cannot cast offensive spells yet.",
    };
  }

  let atkDisc = {};
  try {
    atkDisc = safeJsonParse(caster.discovered_kingdoms, {}, "spell:discovered_kingdoms");
  } catch {}
  if (!atkDisc[target.id] || !atkDisc[target.id].mapped) {
    return { error: "You need a location map for this target." };
  }

  if ((target.turn || 0) < 400) {
    return {
      error: `${target.name} is under newbie protection until Turn 400 (currently Turn ${target.turn})`,
    };
  }

  // Phase 3C: elevation line-of-sight — high ground can cast down, low
  // ground blocked by higher terrain. canCastSpell() itself no-ops (always
  // true) when the flag is off, so this is safe to call unconditionally
  // once the grid exists; hasElevationGrid() guards against calling it
  // before boot's elevation step has populated the cache (e.g. in tests).
  if (getFlag('FEATURE_ELEVATION_SPELLS') && hasElevationGrid()) {
    const grid = getElevationGrid();
    const casterElev = getKingdomElevationLevel(caster, grid);
    const targetElev = getKingdomElevationLevel(target, grid);
    if (!canCastSpell(casterElev, targetElev, { FEATURE_ELEVATION_SPELLS: true })) {
      return {
        error: `${target.name} is on higher ground — line of sight blocked for offensive spells.`,
      };
    }
  }

  return { def, isFriendly, target };
}

function castSpell(caster, target, spellId, obscure) {
  const targetCheck = validateSpellTarget(caster, target, spellId);
  if (targetCheck.error) return { error: targetCheck.error };
  const { def } = targetCheck;
  target = targetCheck.target;

  // School-specific spells get 15% minSB reduction (incentive for specialization)
  const schoolMinSB = Math.ceil(def.minSB * 0.85);

  // Check if spell can be cast from school spellbook
  let canCastFromSchool = false;
  if (caster.school_of_magic && MAGIC_SCHOOLS[caster.school_of_magic]) {
    const schoolSpells = MAGIC_SCHOOLS[caster.school_of_magic];
    if (schoolSpells.includes(spellId) && (caster.school_spellbook || 0) >= schoolMinSB) {
      canCastFromSchool = true;
    }
  }

  // Check if spell can be cast from general spellbook
  const canCastFromGeneral = (caster.res_spellbook || 0) >= def.minSB;

  // Must be able to cast from at least one source
  if (!canCastFromSchool && !canCastFromGeneral) {
    return {
      error: `Spellbook too low — need ${def.minSB}, have general ${caster.res_spellbook}${caster.school_of_magic ? ` / school ${caster.school_spellbook} (${schoolMinSB} for school spells)` : ""}`,
    };
  }

  // Scroll check — must have a crafted scroll to cast
  let scrolls = {};
  try {
    scrolls = safeJsonParse(caster.scrolls, {}, "auto:scrolls");
  } catch {}
  if ((scrolls[spellId] || 0) < 1)
    return {
      error: `No ${spellId.replace(/_/g, " ")} scroll in your library — craft one first`,
    };

  // Mana cost: base cost scales with tier
  const TIER_MANA = { 1: 500, 2: 2000, 3: 8000, 4: 50000, 5: 200000 };
  const baseMana = TIER_MANA[def.tier] ?? 500;
  const spellLibraryBonus = fragmentBonusManager.getFragmentForBuilding(caster, 'libraries');
  const spellEfficiency = spellLibraryBonus?.passive?.spell_efficiency || 0;
  const adjustedBaseMana = Math.floor(baseMana * (1 - spellEfficiency));
  const obscureCost = obscure ? Math.floor(adjustedBaseMana * 0.5) : 0;
  const totalMana = adjustedBaseMana + obscureCost;
  if ((caster.mana || 0) < totalMana)
    return {
      error: `Not enough mana — need ${totalMana.toLocaleString()}, have ${(caster.mana || 0).toLocaleString()}`,
    };

  // Consume scroll and mana
  scrolls[spellId] = (scrolls[spellId] || 0) - 1;
  if (scrolls[spellId] <= 0) delete scrolls[spellId];
  const casterUpdates = {
    mana: caster.mana - totalMana,
    scrolls: JSON.stringify(scrolls),
  };

  // Attack/defense magic modifiers
  const atkMagic =
    ((caster.res_attack_magic || 100) / 100) * raceBonus(caster, "magic");
  const defMagic =
    ((target.res_defense_magic || 100) / 100) * raceBonus(target, "magic");
  const magicRatio = Math.max(0.2, atkMagic / Math.max(0.5, defMagic));

  // Check shield active effect on target
  let targetEffects = {};
  try {
    targetEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
  } catch {}

  // Accumulate all spell-resistance multipliers from active effects
  let spellResistMult = getMasonSigilResist(target);
  if (targetEffects.shield) spellResistMult *= 0.5;
  if (targetEffects.arcane_ward?.damage_reduction) spellResistMult *= (1 - targetEffects.arcane_ward.damage_reduction);
  if (targetEffects.greater_barrier?.spell_damage_reduction) spellResistMult *= (1 - targetEffects.greater_barrier.spell_damage_reduction);
  if (targetEffects.absolute_protection?.damage_reduction) spellResistMult *= (1 - targetEffects.absolute_protection.damage_reduction);
  if (targetEffects.prismatic_shield?.damage_reduction) spellResistMult *= (1 - targetEffects.prismatic_shield.damage_reduction);
  if (targetEffects.fortress_eternal?.indestructible) spellResistMult *= 0.1;
  const shielded = spellResistMult;

  let fortResist = {};
  try {
    fortResist = safeJsonParse(target.fortified_buildings, {}, "auto:fortified_buildings");
  } catch {}

  function getBldDmg(key, baseDmg) {
    let dmg = baseDmg * magicRatio * shielded;
    if (fortResist[key]) dmg *= 0.2; // 80% reduction for fortified
    return Math.floor(dmg);
  }

  const targetUpdates = {};
  let damageDesc = "";
  let activeEffect = null; // { key, turns_left, ...data } to apply to target

  // ── Friendly spells (target = caster or ally) ──────────────────────────
  if (def.effect === "friendly") {
    if (spellId === "mend") {
      // Restore 10% of fighters (simulates healing recent casualties)
      const healed = Math.floor((target.fighters || 0) * 0.1 * magicRatio);
      targetUpdates.fighters = (target.fighters || 0) + healed;
      damageDesc = `${healed.toLocaleString()} fighters restored`;
    } else if (spellId === "dispel") {
      // Clear all active debuffs from target
      let tEffects = {};
      try {
        tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
      } catch {}
      const debuffs = ["fog_of_war", "blight", "silence", "plague"];
      let cleared = 0;
      debuffs.forEach((d) => {
        if (tEffects[d]) {
          delete tEffects[d];
          cleared++;
        }
      });
      targetUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc =
        cleared > 0
          ? `${cleared} active curse${cleared > 1 ? "s" : ""} dispelled`
          : "no active curses to dispel";
    } else if (spellId === "bless") {
      const natCap = naturalHappinessCap(target);
      const happinessGain = Math.floor(natCap * 0.1 * magicRatio);
      targetUpdates.happiness = Math.min(
        natCap * 2,
        (target.happiness !== undefined && target.happiness !== null
          ? target.happiness
          : 100) + happinessGain,
      );
      // Apply bless buff for 5 turns
      let tEffects = {};
      try {
        tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.bless = {
        turns_left: def.duration || 5,
        happiness_bonus: happinessGain,
      };
      targetUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `+${happinessGain} happiness and pop growth boosted for ${def.duration || 5} turns`;
    } else if (spellId === "shield") {
      let tEffects = {};
      try {
        tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.shield = { turns_left: def.duration || 5 };
      targetUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `magic shield active for ${def.duration || 5} turns — incoming spell damage halved`;
    } else if (spellId === "arcane_ward") {
      // Create magical barrier; reduces damage by 20% for 4 turns
      let tEffects = {};
      try {
        tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.arcane_ward = { turns_left: 4, damage_reduction: 0.2 };
      targetUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `magical barrier activated — incoming damage reduced by 20% for 4 turns`;
    } else if (spellId === "create_food") {
      // Generate 500 food for granaries (friendly)
      const foodCreated = Math.floor(500 * magicRatio);
      targetUpdates.food = (target.food || 0) + foodCreated;
      damageDesc = `${foodCreated.toLocaleString()} food conjured`;
    } else if (spellId === "materialize_gold") {
      // Creates 1000 gold from magical energy (friendly)
      const goldCreated = Math.floor(1000 * magicRatio);
      targetUpdates.gold = (target.gold || 0) + goldCreated;
      damageDesc = `${goldCreated.toLocaleString()} gold materialized`;
    } else if (spellId === "conjure_supplies") {
      // Create building materials; +100 wood/stone (friendly)
      const woodCreated = Math.floor(100 * magicRatio);
      const stoneCreated = Math.floor(100 * magicRatio);
      targetUpdates.wood = (target.wood || 0) + woodCreated;
      targetUpdates.stone = (target.stone || 0) + stoneCreated;
      damageDesc = `${woodCreated.toLocaleString()} wood and ${stoneCreated.toLocaleString()} stone conjured`;
    } else if (spellId === "summon_servants") {
      // Summons 20 workers; +50% gathering for 2 turns (friendly)
      const servantsCreated = Math.floor(20 * magicRatio);
      targetUpdates.population = (target.population || 0) + servantsCreated;
      let tEffects = {};
      try {
        tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.summon_servants = { turns_left: 2, gathering_bonus: 0.5 };
      targetUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `${servantsCreated} servants summoned; gathering +50% for 2 turns`;
    } else if (spellId === "protective_blessing") {
      // +10% defense against next 2 attacks (friendly)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.protective_blessing = { turns_left: 3, defense_bonus: 0.1, attacks_left: 2 };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `protective blessing granted — +10% defense for next 2 attacks`;
    } else if (spellId === "seal_the_breach") {
      // Restores 30% wall integrity instantly
      const wallGain = Math.floor(100 * 0.3 * magicRatio);
      targetUpdates.walls = Math.min(100, (target.walls || 0) + wallGain);
      damageDesc = `walls restored by ${wallGain}% integrity`;
    } else if (spellId === "dimensional_shroud") {
      // Kingdom harder to locate; -40% spy accuracy for 3 turns (friendly)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.dimensional_shroud = { turns_left: 3, spy_accuracy_penalty: 0.4 };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `kingdom cloaked in dimensional shroud — spy accuracy reduced by 40% for 3 turns`;
    } else if (spellId === "create_shelter") {
      // +100 population capacity for 5 turns (friendly)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.create_shelter = { turns_left: 5, population_capacity_bonus: 100 };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `shelter created — +100 population capacity for 5 turns`;
    } else if (spellId === "greater_healing") {
      // Restore 20% of troop casualties from previous battles (friendly)
      const healed = Math.floor((target.fighters || 0) * 0.2 * magicRatio);
      targetUpdates.fighters = (target.fighters || 0) + healed;
      damageDesc = `${healed.toLocaleString()} fighters restored from previous battles`;
    } else if (spellId === "conjure_arsenal") {
      // Create 50 weapons and 50 armor instantly (friendly resource)
      const weaponsCreated = Math.floor(50 * magicRatio);
      const armorCreated = Math.floor(50 * magicRatio);
      damageDesc = `${weaponsCreated} weapons and ${armorCreated} armor conjured`;
    } else if (spellId === "summon_beasts") {
      // Summons 200 wild beasts for defense; lasts 3 turns (friendly troops)
      const beastsCreated = Math.floor(200 * magicRatio);
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.summon_beasts = { turns_left: 3, beast_count: beastsCreated };
      targetUpdates.fighters = (target.fighters || 0) + beastsCreated;
      targetUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `${beastsCreated} wild beasts summoned for 3 turns`;
    } else if (spellId === "greater_barrier") {
      // Reduce all spell damage by 40% for 5 turns (friendly)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.greater_barrier = { turns_left: 5, spell_damage_reduction: 0.4 };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `greater barrier raised — all spell damage reduced by 40% for 5 turns`;
    } else if (spellId === "materialize_wealth") {
      // Create 5000 gold (costs 10% kingdom mana) (friendly)
      const manaCost = Math.floor((caster.mana || 0) * 0.1);
      if ((caster.mana || 0) >= manaCost) {
        const goldGained = Math.floor(5000 * magicRatio);
        casterUpdates.mana = (casterUpdates.mana !== undefined ? casterUpdates.mana : (caster.mana || 0)) - manaCost;
        targetUpdates.gold = (target.gold || 0) + goldGained;
        damageDesc = `${goldGained.toLocaleString()} gold materialized (cost: ${manaCost} mana)`;
      } else {
        damageDesc = `insufficient mana to materialize wealth`;
      }
    } else if (spellId === "metallic_skin") {
      // +40% armor and health for 4 turns (friendly buff)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.metallic_skin = { turns_left: 4, armor_bonus: 0.4, health_bonus: 0.4 };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `metallic skin forms — +40% armor and health for 4 turns`;
    } else if (spellId === "iron_skin_enchantment") {
      // Troops gain +25% armor; lasts 4 turns (friendly)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.iron_skin_enchantment = { turns_left: 4, armor_bonus: 0.25 };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `iron skin enchantment applied — troops gain +25% armor for 4 turns`;
    } else if (spellId === "conjure_guardian") {
      // Create guardian; +500 fighters for 5 turns (friendly)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      const guardianCount = Math.floor(500 * magicRatio);
      tEffects.conjure_guardian = { turns_left: 5, guardian_fighters: guardianCount };
      targetUpdates.fighters = (target.fighters || 0) + guardianCount;
      targetUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `guardian conjured — +${guardianCount.toLocaleString()} fighters for 5 turns`;
    } else if (spellId === "mass_resurrection") {
      // Resurrect 30% of fallen troops from last battle (friendly)
      const resurrected = Math.floor(((target.fighters || 0) * 0.3) * magicRatio);
      targetUpdates.fighters = (target.fighters || 0) + resurrected;
      damageDesc = `${resurrected.toLocaleString()} fallen troops resurrected`;
    } else if (spellId === "conjure_abundance") {
      // Create unlimited food for 3 turns; no starvation (friendly)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.conjure_abundance = { turns_left: 3, unlimited_food: true };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `abundance conjured — unlimited food for 3 turns`;
    } else if (spellId === "summon_plague_doctor") {
      // Summon healer; cure all population debuffs instantly (friendly)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      const debuffKeys = Object.keys(tEffects).filter(k => k.includes("plague") || k.includes("disease") || k.includes("life_drain"));
      debuffKeys.forEach(k => delete tEffects[k]);
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `plague doctor summoned — all population debuffs cured`;
    } else if (spellId === "materialize_army") {
      // Create 1000 fighters from magical essence (friendly)
      const armySize = Math.floor(1000 * magicRatio);
      targetUpdates.fighters = (target.fighters || 0) + armySize;
      damageDesc = `army materialized — +${armySize.toLocaleString()} fighters from essence`;
    } else if (spellId === "conjure_fortress") {
      // +5000 wall strength for 5 turns (friendly)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.conjure_fortress = { turns_left: 5, wall_bonus: 5000 };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `fortress conjured — +5000 wall strength for 5 turns`;
    } else if (spellId === "Divine_intervention") {
      // Resurrect 15% of fallen fighters from last battle (friendly)
      const resurrected = Math.floor(((target.fighters || 0) * 0.15) * magicRatio);
      targetUpdates.fighters = (target.fighters || 0) + resurrected;
      damageDesc = `divine intervention — ${resurrected.toLocaleString()} fighters resurrected`;
    } else if (spellId === "summon_echo") {
      // Summon kingdom echo; double all bonuses for 7 turns (legendary buff)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.summon_echo = { turns_left: 7, bonus_multiplier: 2.0 };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `kingdom echo summoned — all bonuses doubled for 7 turns`;
    } else if (spellId === "conjure_realm") {
      // +50% storage for all buildings for 6 turns (resource mega-buff)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.conjure_realm = { turns_left: 6, storage_bonus: 0.5 };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `realm conjured — +50% storage for all buildings for 6 turns`;
    } else if (spellId === "ultimate_resurrection") {
      // Bring back 50% of all troops ever lost (massive troop restoration)
      const resurrected = Math.floor(((target.fighters || 0) * 0.5) * magicRatio);
      targetUpdates.fighters = (target.fighters || 0) + resurrected;
      damageDesc = `ultimate resurrection — ${resurrected.toLocaleString()} troops restored from the grave`;
    } else if (spellId === "summon_ascendant") {
      // Summon ascendant; +100% spell effectiveness for 5 turns (ultimate buff)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.summon_ascendant = { turns_left: 5, spell_effectiveness: 2.0 };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `ascendant summoned — +100% spell effectiveness for 5 turns`;
    } else if (spellId === "conjure_paradise") {
      // Create ideal state; maximize all production for 4 turns (perfect economy)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.conjure_paradise = { turns_left: 4, production_maximized: true };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `paradise conjured — all production maximized for 4 turns`;
    } else if (spellId === "prophetic_dream") {
      // +200% to next divination spell for 3 turns (friendly buff)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.prophetic_dream = { turns_left: 3, divination_bonus: 2.0 };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `prophetic dream granted — +200% divination effectiveness for 3 turns`;
    } else if (spellId === "absolute_protection") {
      // Reduce all damage by 75% for 7 turns; impenetrable (legendary defense)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.absolute_protection = { turns_left: 7, damage_reduction: 0.75, impenetrable: true };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `absolute protection activated — -75% all damage for 7 turns, impenetrable`;
    } else if (spellId === "eternal_vigilance") {
      // Kingdom immune to assassination for 4 turns (friendly)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.eternal_vigilance = { turns_left: 4, assassination_immunity: true };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `eternal vigilance activated — immune to assassination for 4 turns`;
    } else if (spellId === "prismatic_shield") {
      // Reduce damage by 50%; reflect 25% back for 6 turns (friendly)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.prismatic_shield = { turns_left: 6, damage_reduction: 0.5, reflect_percentage: 0.25 };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `prismatic shield formed — -50% damage, 25% reflected for 6 turns`;
    } else if (spellId === "fortress_eternal") {
      // All buildings indestructible for next attack cycle (legendary defense)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.fortress_eternal = { turns_left: 10, indestructible: true };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `fortress eternal — all buildings become indestructible`;
    } else if (spellId === "divine_aegis") {
      // Create protection zone; prevent enemy spells for 3 turns (anti-magic)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.divine_aegis = { turns_left: 3, spell_immunity: true };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `divine aegis formed — enemy spells prevented for 3 turns`;
    } else if (spellId === "transcendence") {
      // Pure magical energy; +100% spells for 6 turns (friendly mega-buff)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.transcendence = { turns_left: 6, spell_effectiveness_bonus: 1.0 };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `transcendence achieved — +100% spell effectiveness for 6 turns`;
    } else if (spellId === "divine_form") {
      // +50% all stats for 5 turns (friendly mega-buff)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.divine_form = { turns_left: 5, all_stats_bonus: 0.5 };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `divine form assumed — all stats increased by 50% for 5 turns`;
    } else if (spellId === "ascendant_transformation") {
      // Become immortal and invincible for 7 turns (godhood)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.ascendant_transformation = { turns_left: 7, immortal: true, invincible: true };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `transcendence achieved — immortal and invincible for 7 turns`;
    } else if (spellId === "unreality") {
      // Kingdom hidden while real hidden; 6 turns (ultimate stealth)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.unreality = { turns_left: 6, kingdom_hidden: true };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `unreality achieved — kingdom hidden from reality for 6 turns`;
    } else if (spellId === "eternal_transmutation") {
      // Master of change; all enemy transformations fail for 6 turns (transformation immunity)
      let tEffects = {};
      try {
        tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
      } catch {}
      tEffects.eternal_transmutation = { turns_left: 6, transformation_immunity: true };
      casterUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `eternal transmutation mastered — immune to enemy transformations for 6 turns`;
    } else {
      // No specific implementation found for this friendly spell
      damageDesc = "spell effect applied";
    }

    const reportTarget = caster.id === target.id ? "your kingdom" : target.name;
    return {
      casterUpdates,
      targetUpdates,
      report: {
        spellId,
        friendly: true,
        damageDesc,
        manaCost: totalMana,
        obscure,
      },
      casterEvent: `✨ Cast ${spellId.replace(/_/g, " ")} on ${reportTarget} — ${damageDesc}.`,
      targetEvent:
        caster.id !== target.id
          ? `✨ ${caster.name} cast ${spellId.replace(/_/g, " ")} on your kingdom — ${damageDesc}.`
          : null,
    };
  }

  // ── Offensive / debuff spells ─────────────────────────────────────────────

  // Spell immunity — divine_aegis blocks all hostile magic
  if (def.effect !== "friendly" && targetEffects.divine_aegis?.spell_immunity) {
    const reportTarget = caster.id === target.id ? "your kingdom" : target.name;
    return {
      casterUpdates,
      targetUpdates,
      report: { spellId, damageDesc: "spell absorbed by divine aegis", manaCost: totalMana, obscure },
      casterEvent: `✨ You cast ${spellId.replace(/_/g, " ")} on ${reportTarget} but divine aegis absorbed it.`,
      targetEvent: `⚡ ${caster.name} cast ${spellId.replace(/_/g, " ")} but your divine aegis absorbed it completely.`,
    };
  }

  if (spellId === "spark") {
    // Burns a small number of farms
    const farmsLost = Math.max(1, getBldDmg("farms", 5));
    targetUpdates.bld_farms = Math.max(0, (target.bld_farms || 0) - farmsLost);
    damageDesc = `${farmsLost} farm${farmsLost > 1 ? "s" : ""} burned`;
  } else if (spellId === "rain") {
    // Floods more farms than Spark
    const farmsLost = Math.max(1, getBldDmg("farms", 20));
    targetUpdates.bld_farms = Math.max(0, (target.bld_farms || 0) - farmsLost);
    damageDesc = `${farmsLost} farm${farmsLost > 1 ? "s" : ""} flooded`;
  } else if (spellId === "fog_of_war") {
    // Debuff: blinds rangers for duration turns
    activeEffect = { turns_left: def.duration || 3, type: "fog_of_war" };
    damageDesc = `rangers blinded for ${def.duration || 3} turns`;
  } else if (spellId === "blight") {
    // Debuff: poison food supply for duration turns
    const foodDamage = Math.floor(500 * magicRatio * shielded);
    activeEffect = {
      turns_left: def.duration || 5,
      type: "blight",
      damage: foodDamage,
    };
    damageDesc = `food supply poisoned for ${def.duration || 5} turns (-${foodDamage.toLocaleString()} food/turn)`;
  } else if (spellId === "lightning") {
    // Kills enemy fighters
    const fightersLost = Math.max(
      1,
      Math.floor((target.fighters || 0) * 0.05 * magicRatio * shielded),
    );
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - fightersLost);
    damageDesc = `${fightersLost.toLocaleString()} fighters struck down`;
  } else if (spellId === "silence") {
    // Debuff: suppresses research for duration turns
    activeEffect = { turns_left: def.duration || 3, type: "silence" };
    damageDesc = `research suppressed for ${def.duration || 3} turns`;
  } else if (spellId === "amnesia") {
    let hasLockbox = false;
    let targetHBP = {};
    try {
      targetHBP = safeJsonParse(target.hybrid_blueprints, {}, "auto:target.hybrid_blueprints");
    } catch {}
    for (const key in targetHBP) {
      if (
        targetHBP[key].assigned &&
        targetHBP[key].building === "libraries" &&
        targetHBP[key].fragment === "Dwarven Star-Metal"
      ) {
        hasLockbox = true;
        break;
      }
    }
    
    if (hasLockbox) {
      damageDesc = `spell failed — target's Impenetrable Lockbox grants immunity to amnesia`;
    } else {
      // Permanently wipes economy research
      const resLost = Math.max(1, Math.floor(15 * magicRatio * shielded));
      targetUpdates.res_economy = Math.max(
        0,
        (target.res_economy || 0) - resLost,
      );
      damageDesc = `economy research reduced by ${resLost}%`;
    }
  } else if (spellId === "drain") {
    // Siphons mana from target to caster
    const manaDrained = Math.max(
      10,
      Math.floor((target.mana || 0) * 0.15 * magicRatio * shielded),
    );
    targetUpdates.mana = Math.max(0, (target.mana || 0) - manaDrained);
    casterUpdates.mana =
      (casterUpdates.mana || caster.mana - totalMana) + manaDrained;
    damageDesc = `${manaDrained.toLocaleString()} mana drained`;
  } else if (spellId === "plague") {
    // Debuff: kills population each turn for duration
    activeEffect = { turns_left: def.duration || 5, type: "plague" };
    damageDesc = `plague spreading — population will die each turn for ${def.duration || 5} turns`;
  } else if (spellId === "earthquake") {
    // Destroys buildings across all types
    const fDmg = Math.max(1, getBldDmg("farms", 12)); // 8 * 1.5
    const bDmg = Math.max(1, getBldDmg("barracks", 8));
    const gDmg = Math.max(1, getBldDmg("guard_towers", 8));
    const mDmg = Math.max(1, Math.floor(getBldDmg("markets", 8) * 0.5));
    const cDmg = Math.max(1, Math.floor(getBldDmg("castles", 8) * 0.1));
    targetUpdates.bld_farms = Math.max(0, (target.bld_farms || 0) - fDmg);
    targetUpdates.bld_barracks = Math.max(0, (target.bld_barracks || 0) - bDmg);
    targetUpdates.bld_guard_towers = Math.max(
      0,
      (target.bld_guard_towers || 0) - gDmg,
    );
    targetUpdates.bld_markets = Math.max(0, (target.bld_markets || 0) - mDmg);
    targetUpdates.bld_castles = Math.max(0, (target.bld_castles || 0) - cDmg);
    damageDesc = `buildings destroyed across the kingdom (farms, barracks, towers)`;
  } else if (spellId === "tempest") {
    // Kills all troop types
    const troopKill = Math.max(
      1,
      Math.floor((target.fighters || 0) * 0.08 * magicRatio * shielded),
    );
    const rangerKill = Math.max(
      0,
      Math.floor((target.rangers || 0) * 0.06 * magicRatio * shielded),
    );
    const clericKill = Math.max(
      0,
      Math.floor((target.clerics || 0) * 0.06 * magicRatio * shielded),
    );
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - troopKill);
    targetUpdates.rangers = Math.max(0, (target.rangers || 0) - rangerKill);
    targetUpdates.clerics = Math.max(0, (target.clerics || 0) - clericKill);
    damageDesc = `${troopKill.toLocaleString()} fighters, ${rangerKill.toLocaleString()} rangers, ${clericKill.toLocaleString()} clerics killed`;
  } else if (spellId === "armageddon") {
    // Catastrophic — land, buildings, population
    const landLost = Math.floor(
      (target.land || 0) * 0.2 * magicRatio * shielded,
    );
    const popLost = Math.floor(
      (target.population || 0) * 0.25 * magicRatio * shielded,
    );
    const farmLost =
      Math.floor((target.bld_farms || 0) * 0.3) > 0
        ? getBldDmg("farms", (target.bld_farms || 0) * 0.3)
        : 0;
    const fightLost = Math.floor(
      (target.fighters || 0) * 0.2 * magicRatio * shielded,
    );
    targetUpdates.land = Math.max(0, (target.land || 0) - landLost);
    targetUpdates.population = Math.max(0, (target.population || 0) - popLost);
    targetUpdates.bld_farms = Math.max(0, (target.bld_farms || 0) - farmLost);
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - fightLost);
    damageDesc = `ARMAGEDDON — ${landLost.toLocaleString()} acres scorched, ${popLost.toLocaleString()} killed, ${farmLost.toLocaleString()} farms razed, ${fightLost.toLocaleString()} fighters slain`;
  } else if (spellId === "arcane_ward") {
    // Create magical barrier; reduces damage by 20% for 4 turns
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.arcane_ward = { turns_left: 4, damage_reduction: 0.2 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `magical barrier activated — incoming damage reduced by 20% for 4 turns`;
  } else if (spellId === "fortify_stones") {
    // Strengthen buildings; +15% durability temporarily
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.fortify_stones = { turns_left: 3, building_durability: 1.15 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `buildings fortified — +15% durability for 3 turns`;
  } else if (spellId === "warding_circle") {
    // Protects population; reduces defense casualties by 10%
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.warding_circle = { turns_left: 3, casualty_reduction: 0.1 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `protective circle formed — population defense casualties reduced by 10% for 3 turns`;
  } else if (spellId === "banish_hex") {
    // Remove single curse from kingdom (friendly spell)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    const debuffs = ["blight", "plague", "silence", "fog_of_war", "fascinate_crowd", "command_word", "mutate_crops", "death_knell"];
    let cleared = false;
    for (const debuff of debuffs) {
      if (tEffects[debuff]) {
        delete tEffects[debuff];
        cleared = true;
        damageDesc = `${debuff.replace(/_/g, " ")} curse removed`;
        break;
      }
    }
    if (!cleared) {
      damageDesc = `no active curses found`;
    }
    targetUpdates.active_effects = JSON.stringify(tEffects);
  } else if (spellId === "mystic_lock") {
    // Makes 2 enemy spy attempts fail next turn
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.mystic_lock = { turns_left: 1, spy_failures: 2 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `mystical lock activated — 2 spy attempts will fail next turn`;
  } else if (spellId === "create_food") {
    // Generate 500 food for granaries (friendly)
    const foodCreated = Math.floor(500 * magicRatio);
    targetUpdates.food = (target.food || 0) + foodCreated;
    damageDesc = `${foodCreated.toLocaleString()} food conjured`;
  } else if (spellId === "summon_servants") {
    // Summons 20 workers; +50% gathering for 2 turns (friendly)
    const servantsCreated = Math.floor(20 * magicRatio);
    targetUpdates.population = (target.population || 0) + servantsCreated;
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.summon_servants = { turns_left: 2, gathering_bonus: 0.5 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `${servantsCreated} servants summoned; gathering +50% for 2 turns`;
  } else if (spellId === "materialize_gold") {
    // Creates 1000 gold from magical energy (friendly)
    const goldCreated = Math.floor(1000 * magicRatio);
    targetUpdates.gold = (target.gold || 0) + goldCreated;
    damageDesc = `${goldCreated.toLocaleString()} gold materialized`;
  } else if (spellId === "conjure_supplies") {
    // Create building materials; +100 wood/stone (friendly)
    const woodCreated = Math.floor(100 * magicRatio);
    const stoneCreated = Math.floor(100 * magicRatio);
    targetUpdates.wood = (target.wood || 0) + woodCreated;
    targetUpdates.stone = (target.stone || 0) + stoneCreated;
    damageDesc = `${woodCreated.toLocaleString()} wood and ${stoneCreated.toLocaleString()} stone conjured`;
  } else if (spellId === "summon_light") {
    // Reveal hidden spy network location (research spell - friendly)
    damageDesc = `spy network location revealed (affects discovery)`;
  } else if (spellId === "detect_presence") {
    // Reveals nearest enemy kingdom location for 1 turn (research, target is caster looking at target)
    damageDesc = `${target.name}'s location revealed for 1 turn`;
  } else if (spellId === "scry_library") {
    // Reveals enemy research in one discipline (research)
    const disciplines = ["attack_magic", "defense_magic", "economy", "military", "construction"];
    const discipline = disciplines[Math.floor(Math.random() * disciplines.length)];
    const targetRes = target[`res_${discipline}`] || 0;
    damageDesc = `enemy ${discipline.replace(/_/g, " ")} research revealed: ${targetRes}%`;
  } else if (spellId === "read_aura") {
    // Discover random fact about target kingdom (research)
    const facts = [
      `Kingdom has ${(target.population || 0).toLocaleString()} population`,
      `Current happiness: ${Math.floor((target.happiness || 100))}%`,
      `Mana reserves: ${(target.mana || 0).toLocaleString()}`,
      `${(target.fighters || 0).toLocaleString()} fighters stationed`,
      `Land holdings: ${(target.land || 0).toLocaleString()} acres`
    ];
    const fact = facts[Math.floor(Math.random() * facts.length)];
    damageDesc = `aura revealed: ${fact}`;
  } else if (spellId === "glimpse_future") {
    // Predict next turn's attack or event (research)
    damageDesc = `future glimpsed — caster gains insight into target's plans`;
  } else if (spellId === "minds_eye") {
    // Reveal exact enemy troop composition (research)
    const troops = `Fighters: ${(target.fighters || 0).toLocaleString()}, Rangers: ${(target.rangers || 0).toLocaleString()}, Clerics: ${(target.clerics || 0).toLocaleString()}`;
    damageDesc = `enemy troop composition revealed: ${troops}`;
  } else if (spellId === "minor_charm") {
    // 50 enemy fighters defect to your army (troop conversion)
    const defectors = Math.max(1, Math.floor(50 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - defectors);
    casterUpdates.fighters = (caster.fighters || 0) + defectors;
    damageDesc = `${defectors.toLocaleString()} enemy fighters charmed and defected`;
  } else if (spellId === "fascinate_crowd") {
    // -20% enemy happiness for 3 turns (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    const happinessDrop = Math.floor((target.happiness || 100) * 0.2);
    tEffects.fascinate_crowd = { turns_left: 3, happiness_loss: happinessDrop };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    targetUpdates.happiness = Math.max(0, (target.happiness || 100) - happinessDrop);
    damageDesc = `crowd fascinated — happiness dropped ${happinessDrop}% for 3 turns`;
  } else if (spellId === "command_word") {
    // Enemy cannot act next turn (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.command_word = { turns_left: 1, paralyzed: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `magical command issued — target paralyzed for 1 turn`;
  } else if (spellId === "enthrall_scout") {
    // Capture 1 spy for interrogation (research)
    const spiesCaptured = Math.floor(1 * magicRatio);
    targetUpdates.thieves = Math.max(0, (target.thieves || 0) - spiesCaptured);
    casterUpdates.thieves = (caster.thieves || 0) + spiesCaptured;
    damageDesc = `${spiesCaptured} enemy spy captured and enthralled`;
  } else if (spellId === "whisper") {
    // Enemy loses 10% spellbook progress (research)
    const sbLoss = Math.floor((target.res_spellbook || 0) * 0.1);
    targetUpdates.res_spellbook = Math.max(0, (target.res_spellbook || 0) - sbLoss);
    damageDesc = `whispers of doubt sown — spellbook progress lost by ${sbLoss}%`;
  } else if (spellId === "inferno_burst") {
    // Fires destroy 50 enemy farms (building damage)
    const farmsDestroyed = Math.max(1, getBldDmg("farms", 50));
    targetUpdates.bld_farms = Math.max(0, (target.bld_farms || 0) - farmsDestroyed);
    damageDesc = `${farmsDestroyed} farm${farmsDestroyed > 1 ? "s" : ""} incinerated`;
  } else if (spellId === "frost_sting") {
    // Cold damages 100 fighters; slows for 2 turns (troop damage with debuff)
    const fightersKilled = Math.max(1, Math.floor(100 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - fightersKilled);
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.frost_sting = { turns_left: 2, slow: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `${fightersKilled.toLocaleString()} fighters frozen; movement slowed for 2 turns`;
  } else if (spellId === "stone_missile") {
    // Barrage damages 5 buildings (multi-building damage)
    const bldTypes = ["farms", "barracks", "guard_towers", "markets", "shrines"];
    let totalDmg = 0;
    for (let i = 0; i < 5 && i < bldTypes.length; i++) {
      const bldKey = `bld_${bldTypes[i]}`;
      const dmg = Math.max(1, getBldDmg(bldTypes[i], 3));
      targetUpdates[bldKey] = Math.max(0, (target[bldKey] || 0) - dmg);
      totalDmg += dmg;
    }
    damageDesc = `${totalDmg.toLocaleString()} building damage across 5 structures`;
  } else if (spellId === "chain_bolt") {
    // Lightning chains; damages 3 buildings (chain damage)
    const bldTypes = ["guard_towers", "mage_towers", "barracks"];
    let totalDmg = 0;
    for (const bldType of bldTypes) {
      const dmg = Math.max(1, getBldDmg(bldType, 4));
      targetUpdates[`bld_${bldType}`] = Math.max(0, (target[`bld_${bldType}`] || 0) - dmg);
      totalDmg += dmg;
    }
    damageDesc = `lightning chains through 3 buildings — ${totalDmg.toLocaleString()} total damage`;
  } else if (spellId === "wind_shear") {
    // Cuts down 75 enemy rangers (specific troop type damage)
    const rangersKilled = Math.max(1, Math.floor(75 * magicRatio * shielded));
    targetUpdates.rangers = Math.max(0, (target.rangers || 0) - rangersKilled);
    damageDesc = `${rangersKilled.toLocaleString()} enemy rangers cut down by wind`;
  } else if (spellId === "mirage_city") {
    // False buildings; -40% enemy accuracy for 2 turns (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.mirage_city = { turns_left: 2, accuracy_penalty: 0.4 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `false buildings appear — enemy accuracy reduced by 40% for 2 turns`;
  } else if (spellId === "disguise_force") {
    // Troops appear as civilians; -25% enemy damage (friendly buff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.disguise_force = { turns_left: 3, damage_reduction: 0.25 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `troops disguised as civilians — incoming damage reduced by 25% for 3 turns`;
  } else if (spellId === "false_wealth") {
    // Illusion makes you look richer; enemy overestimates (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.false_wealth = { turns_left: 3, overestimate: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `illusion of great wealth created — target overestimates your resources for 3 turns`;
  } else if (spellId === "shadow_clones") {
    // Duplicate troops that don't exist; confuses enemy (troop confusion)
    const cloneCount = Math.floor(((target.fighters || 0) * 0.1) * magicRatio);
    damageDesc = `${cloneCount.toLocaleString()} illusory troop clones created — target confused`;
  } else if (spellId === "phantom_wall") {
    // -30% enemy accuracy for 2 turns (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.phantom_wall = { turns_left: 2, accuracy_penalty: 0.3 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `phantom walls confuse enemy — accuracy reduced by 30% for 2 turns`;
  } else if (spellId === "touch_of_death") {
    // Kills 50 fighters; they rise as undead for 2 turns (troop conversion)
    const fightersKilled = Math.max(1, Math.floor(50 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - fightersKilled);
    casterUpdates.fighters = (caster.fighters || 0) + Math.floor(fightersKilled * 0.6);
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.touch_of_death = { turns_left: 2, undead_count: Math.floor(fightersKilled * 0.6) };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `${fightersKilled.toLocaleString()} fighters killed; ~${Math.floor(fightersKilled * 0.6)} rise as undead`;
  } else if (spellId === "deaths_mark") {
    // Target takes +20% damage from next 3 spells (debuff mark)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.deaths_mark = { turns_left: 3, damage_multiplier: 1.2, spells_left: 3 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `mark of death placed — target takes +20% spell damage for next 3 spells`;
  } else if (spellId === "corpse_animation") {
    // Raise 30 undead fighters (friendly troop summoning)
    const undeadRaised = Math.floor(30 * magicRatio);
    casterUpdates.fighters = (caster.fighters || 0) + undeadRaised;
    damageDesc = `${undeadRaised} undead fighters raised`;
  } else if (spellId === "siphon_life") {
    // Steal 200 population from enemy (population theft)
    const popStolen = Math.max(1, Math.floor(200 * magicRatio * shielded));
    targetUpdates.population = Math.max(0, (target.population || 0) - popStolen);
    casterUpdates.population = (caster.population || 0) + popStolen;
    damageDesc = `${popStolen.toLocaleString()} enemy population siphoned and enslaved`;
  } else if (spellId === "death_knell") {
    // -10% happiness and -10% production for 3 turns (multi-debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    const happinessDrop = Math.floor((target.happiness || 100) * 0.1);
    tEffects.death_knell = { turns_left: 3, happiness_loss: happinessDrop, production_penalty: 0.1 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    targetUpdates.happiness = Math.max(0, (target.happiness || 100) - happinessDrop);
    damageDesc = `death knell rings — happiness and production reduced for 3 turns`;
  } else if (spellId === "transform_lead_to_gold") {
    // Convert 100 stone into 500 gold (friendly resource conversion)
    const stoneUsed = Math.min(100, target.stone || 0);
    if (stoneUsed > 0) {
      const goldGained = Math.floor(stoneUsed * 5 * magicRatio);
      targetUpdates.stone = (target.stone || 0) - stoneUsed;
      targetUpdates.gold = (target.gold || 0) + goldGained;
      damageDesc = `${stoneUsed.toLocaleString()} stone transmuted into ${goldGained.toLocaleString()} gold`;
    } else {
      damageDesc = `insufficient stone to transmute`;
    }
  } else if (spellId === "reshape_matter") {
    // 100 wood becomes 100 stone (friendly resource conversion)
    const woodUsed = Math.min(100, target.wood || 0);
    if (woodUsed > 0) {
      targetUpdates.wood = (target.wood || 0) - woodUsed;
      targetUpdates.stone = (target.stone || 0) + woodUsed;
      damageDesc = `${woodUsed.toLocaleString()} wood reshaped into stone`;
    } else {
      damageDesc = `insufficient wood to reshape`;
    }
  } else if (spellId === "flesh_to_stone") {
    // 50 fighters turn to stone; immobile (troop immobilization)
    const fightersPetrified = Math.max(1, Math.floor(50 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - fightersPetrified);
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.flesh_to_stone = { turns_left: 5, immobile: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `${fightersPetrified.toLocaleString()} fighters petrified and immobilized for 5 turns`;
  } else if (spellId === "mutate_crops") {
    // -30% enemy food for 3 turns (resource debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    const foodLoss = Math.floor((target.food || 0) * 0.3);
    tEffects.mutate_crops = { turns_left: 3, food_penalty: 0.3 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    targetUpdates.food = Math.max(0, (target.food || 0) - foodLoss);
    damageDesc = `crops mutated — food production reduced by 30% for 3 turns`;
  } else if (spellId === "transmute_population") {
    // 30 population become mindless servants (population conversion)
    const popConverted = Math.max(1, Math.floor(30 * magicRatio * shielded));
    targetUpdates.population = Math.max(0, (target.population || 0) - popConverted);
    casterUpdates.population = (caster.population || 0) + popConverted;
    damageDesc = `${popConverted.toLocaleString()} population transmuted into mindless servants`;
  }

  // ── TIER 2 SPELLS ──────────────────────────────────────────────────────────

  else if (spellId === "counterspell_aura") {
    // Negate 1 random enemy spell effect currently active
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    const activeSpells = Object.keys(tEffects).filter(k => k !== "shield" && k !== "bless");
    if (activeSpells.length > 0) {
      const toRemove = activeSpells[Math.floor(Math.random() * activeSpells.length)];
      delete tEffects[toRemove];
      targetUpdates.active_effects = JSON.stringify(tEffects);
      damageDesc = `${toRemove.replace(/_/g, " ")} spell negated`;
    } else {
      damageDesc = `no active enemy spells to negate`;
    }
  } else if (spellId === "dimensional_shroud") {
    // Kingdom harder to locate; -40% spy accuracy for 3 turns (friendly)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.dimensional_shroud = { turns_left: 3, spy_accuracy_penalty: 0.4 };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `kingdom cloaked in dimensional shroud — spy accuracy reduced by 40% for 3 turns`;
  } else if (spellId === "protective_blessing") {
    // +10% defense against next 2 attacks (friendly)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.protective_blessing = { turns_left: 3, defense_bonus: 0.1, attacks_left: 2 };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `protective blessing granted — +10% defense for next 2 attacks`;
  } else if (spellId === "null_field") {
    // Suppresses enemy detection towers for 2 turns
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.null_field = { turns_left: 2, detection_suppressed: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `null field created — enemy detection disabled for 2 turns`;
  } else if (spellId === "seal_the_breach") {
    // Restores 30% wall integrity instantly
    const wallGain = Math.floor(100 * 0.3 * magicRatio);
    casterUpdates.walls = Math.min(100, (caster.walls || 0) + wallGain);
    damageDesc = `walls restored by ${wallGain}% integrity`;
  } else if (spellId === "summon_beasts") {
    // Summons 200 wild beasts for defense; lasts 3 turns (friendly troops)
    const beastsCreated = Math.floor(200 * magicRatio);
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.summon_beasts = { turns_left: 3, beast_count: beastsCreated };
    casterUpdates.fighters = (caster.fighters || 0) + beastsCreated;
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `${beastsCreated} wild beasts summoned for 3 turns`;
  } else if (spellId === "greater_healing") {
    // Restore 20% of troop casualties from previous battles (friendly)
    const healed = Math.floor((target.fighters || 0) * 0.2 * magicRatio);
    targetUpdates.fighters = (target.fighters || 0) + healed;
    damageDesc = `${healed.toLocaleString()} fighters restored from previous battles`;
  } else if (spellId === "conjure_arsenal") {
    // Create 50 weapons and 50 armor instantly (friendly resource)
    const weaponsCreated = Math.floor(50 * magicRatio);
    const armorCreated = Math.floor(50 * magicRatio);
    damageDesc = `${weaponsCreated} weapons and ${armorCreated} armor conjured`;
  } else if (spellId === "create_shelter") {
    // +100 population capacity for 5 turns (friendly)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.create_shelter = { turns_left: 5, population_capacity_bonus: 100 };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `shelter created — +100 population capacity for 5 turns`;
  } else if (spellId === "summon_messenger") {
    // Allow instant communication with allied kingdom (research)
    damageDesc = `messenger summoned — instant communication established`;
  } else if (spellId === "true_sight") {
    // Reveal all active debuffs with remaining duration (research)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    const debuffList = Object.keys(tEffects).slice(0, 5).join(", ");
    damageDesc = `active debuffs revealed: ${debuffList || "none"}`;
  } else if (spellId === "oracles_vision") {
    // Show enemy mage tower status and spellbook level (research)
    const sbLevel = (target.res_spellbook || 0);
    const mages = (target.mages || 0);
    damageDesc = `oracle reveals: ${mages} mages, spellbook ${sbLevel}%`;
  } else if (spellId === "foresee_battle") {
    // Predict combat outcome and casualties (research)
    const predictedCasualties = Math.floor((target.fighters || 0) * 0.15);
    damageDesc = `battle predicted: ~${predictedCasualties.toLocaleString()} casualties expected`;
  } else if (spellId === "scry_wealth") {
    // Discover exact enemy gold and resources (research)
    const goldAmount = (target.gold || 0);
    const foodAmount = (target.food || 0);
    damageDesc = `wealth scried: ${goldAmount.toLocaleString()} gold, ${foodAmount.toLocaleString()} food`;
  } else if (spellId === "divination_circle") {
    // Reveal enemy prepared spells (research)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    const spellCount = Object.keys(tEffects).length;
    damageDesc = `divination circle reveals: ${spellCount} active spell effects`;
  } else if (spellId === "dominate_soldier") {
    // 200 enemy fighters fight for you for 2 turns
    const soldiersDominated = Math.max(1, Math.floor(200 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - soldiersDominated);
    casterUpdates.fighters = (caster.fighters || 0) + soldiersDominated;
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.dominate_soldier = { turns_left: 2, dominated_count: soldiersDominated };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `${soldiersDominated.toLocaleString()} enemy soldiers dominated for 2 turns`;
  } else if (spellId === "mass_confusion") {
    // Enemy cannot cast spells for 3 turns
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.mass_confusion = { turns_left: 3, spellcasting_disabled: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `mass confusion spreads — target cannot cast spells for 3 turns`;
  } else if (spellId === "charm_leader") {
    // Convert enemy leader bonuses temporarily (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.charm_leader = { turns_left: 3, leader_disabled: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `enemy leader charmed — bonuses temporarily suppressed for 3 turns`;
  } else if (spellId === "compulsion") {
    // Force enemy to trade at your rates (research)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.compulsion = { turns_left: 2, forced_trade_rates: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `compulsion spell cast — enemy forced to trade at unfavorable rates for 2 turns`;
  } else if (spellId === "enchant_minds") {
    // 100 enemy population joins your kingdom (population theft)
    const popStolen = Math.max(1, Math.floor(100 * magicRatio * shielded));
    targetUpdates.population = Math.max(0, (target.population || 0) - popStolen);
    casterUpdates.population = (caster.population || 0) + popStolen;
    damageDesc = `${popStolen.toLocaleString()} enemy population enchanted and joined`;
  } else if (spellId === "meteor_shower") {
    // Destroys 100 buildings randomly (building damage)
    const bldTypes = ["farms", "barracks", "guard_towers", "markets", "granaries", "shrines", "mage_towers", "libraries"];
    let totalDmg = 0;
    for (let i = 0; i < 8 && i < bldTypes.length; i++) {
      const bldKey = `bld_${bldTypes[i]}`;
      const dmg = Math.max(1, getBldDmg(bldTypes[i], 12));
      targetUpdates[bldKey] = Math.max(0, (target[bldKey] || 0) - dmg);
      totalDmg += dmg;
    }
    damageDesc = `meteor shower destroys — ${totalDmg.toLocaleString()} buildings destroyed`;
  } else if (spellId === "acid_cloud") {
    // Damage all troops; -30% armor for 4 turns
    const allTroops = (target.fighters || 0) + (target.rangers || 0) + (target.clerics || 0);
    const troopDmg = Math.max(1, Math.floor(allTroops * 0.1 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - Math.floor(troopDmg * 0.6));
    targetUpdates.rangers = Math.max(0, (target.rangers || 0) - Math.floor(troopDmg * 0.25));
    targetUpdates.clerics = Math.max(0, (target.clerics || 0) - Math.floor(troopDmg * 0.15));
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.acid_cloud = { turns_left: 4, armor_penalty: 0.3 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `acid cloud deals damage and corrodes armor — -30% armor for 4 turns`;
  } else if (spellId === "inferno_wall") {
    // Destroy 200 farms and 5 granaries (building damage)
    const farmsDestroyed = Math.max(1, getBldDmg("farms", 200));
    const grainDestroyed = Math.max(1, getBldDmg("granaries", 5));
    targetUpdates.bld_farms = Math.max(0, (target.bld_farms || 0) - farmsDestroyed);
    targetUpdates.bld_granaries = Math.max(0, (target.bld_granaries || 0) - grainDestroyed);
    damageDesc = `inferno wall burns ${farmsDestroyed} farms and ${grainDestroyed} granaries`;
  } else if (spellId === "sonic_blast") {
    // Sound wave kills 300 fighters
    const fightersKilled = Math.max(1, Math.floor(300 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - fightersKilled);
    damageDesc = `sonic blast kills ${fightersKilled.toLocaleString()} fighters`;
  } else if (spellId === "blizzard") {
    // Freezing storm kills 250 population
    const popKilled = Math.max(1, Math.floor(250 * magicRatio * shielded));
    targetUpdates.population = Math.max(0, (target.population || 0) - popKilled);
    damageDesc = `blizzard freezes ${popKilled.toLocaleString()} population`;
  } else if (spellId === "mass_hallucination") {
    // -50% all enemy effectiveness for 3 turns
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.mass_hallucination = { turns_left: 3, effectiveness_penalty: 0.5 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `mass hallucination — all enemy effectiveness reduced by 50% for 3 turns`;
  } else if (spellId === "false_army") {
    // Fake army appears; affects enemy decisions (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.false_army = { turns_left: 3, decision_impaired: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `false army appears — enemy makes poor tactical decisions for 3 turns`;
  } else if (spellId === "twisted_landscape") {
    // 200 enemies get lost wandering
    const lostEnemies = Math.max(1, Math.floor(200 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - lostEnemies);
    damageDesc = `landscape twisted — ${lostEnemies.toLocaleString()} enemies lost wandering`;
  } else if (spellId === "phantom_spells") {
    // Fake spells waste enemy actions (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.phantom_spells = { turns_left: 2, actions_wasted: 2 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `phantom spells created — enemy wastes 2 actions on illusions`;
  } else if (spellId === "deceptive_echo") {
    // Copies of kingdom appear; enemy confused (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.deceptive_echo = { turns_left: 3, confusion: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `kingdom echoes confuse enemy — -20% accuracy for 3 turns`;
  } else if (spellId === "undead_army") {
    // Raise 200 undead for 4 turns (friendly troops)
    const undeadRaised = Math.floor(200 * magicRatio);
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.undead_army = { turns_left: 4, undead_count: undeadRaised };
    casterUpdates.fighters = (caster.fighters || 0) + undeadRaised;
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `${undeadRaised} undead raised for 4 turns`;
  } else if (spellId === "soul_trap") {
    // Trap 150 souls; gain their stats for 3 turns
    const soulsTrap = Math.max(1, Math.floor(150 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - soulsTrap);
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.soul_trap = { turns_left: 3, bonus_fighters: soulsTrap };
    casterUpdates.fighters = (caster.fighters || 0) + Math.floor(soulsTrap * 0.5);
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `${soulsTrap.toLocaleString()} souls trapped — stat bonus for 3 turns`;
  } else if (spellId === "plague_of_death") {
    // 300 enemy population become zombies (population conversion)
    const popConverted = Math.max(1, Math.floor(300 * magicRatio * shielded));
    targetUpdates.population = Math.max(0, (target.population || 0) - popConverted);
    casterUpdates.fighters = (caster.fighters || 0) + Math.floor(popConverted * 0.4);
    damageDesc = `plague of death — ${popConverted.toLocaleString()} population become zombies`;
  } else if (spellId === "life_drain_aura") {
    // -10% enemy population per turn for 4 turns (population debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.life_drain_aura = { turns_left: 4, population_drain: 0.1 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `life drain aura surrounds kingdom — -10% population per turn for 4 turns`;
  } else if (spellId === "summon_wraith") {
    // Wraith steals 500 gold (friendly resource generation)
    const goldStolen = Math.floor(500 * magicRatio);
    casterUpdates.gold = (caster.gold || 0) + goldStolen;
    damageDesc = `wraith summoned and steals ${goldStolen.toLocaleString()} gold`;
  } else if (spellId === "mass_petrification") {
    // 200 fighters turn to stone permanently
    const petrified = Math.max(1, Math.floor(200 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - petrified);
    damageDesc = `${petrified.toLocaleString()} fighters petrified permanently`;
  } else if (spellId === "metallic_skin") {
    // +40% armor and health for 4 turns (friendly buff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.metallic_skin = { turns_left: 4, armor_bonus: 0.4, health_bonus: 0.4 };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `metallic skin forms — +40% armor and health for 4 turns`;
  } else if (spellId === "transform_army") {
    // 300 fighters become harmless creatures
    const neutralized = Math.max(1, Math.floor(300 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - neutralized);
    damageDesc = `${neutralized.toLocaleString()} fighters transformed into harmless creatures`;
  } else if (spellId === "alchemical_conversion") {
    // 200 iron becomes 200 gold (resource conversion)
    const ironUsed = Math.min(200, target.iron || 0);
    if (ironUsed > 0) {
      targetUpdates.iron = (target.iron || 0) - ironUsed;
      targetUpdates.gold = (target.gold || 0) + ironUsed;
      damageDesc = `alchemical conversion — iron transmuted to gold`;
    } else {
      damageDesc = `insufficient iron to transmute`;
    }
  } else if (spellId === "bestial_transformation") {
    // 150 population become wild beasts (population conversion)
    const popConverted = Math.max(1, Math.floor(150 * magicRatio * shielded));
    targetUpdates.population = Math.max(0, (target.population || 0) - popConverted);
    casterUpdates.fighters = (caster.fighters || 0) + Math.floor(popConverted * 0.6);
    damageDesc = `${popConverted.toLocaleString()} population transformed into wild beasts`;
  }

  // ── TIER 3 SPELLS ──────────────────────────────────────────────────────────

  else if (spellId === "greater_barrier") {
    // Reduce all spell damage by 40% for 5 turns (friendly)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.greater_barrier = { turns_left: 5, spell_damage_reduction: 0.4 };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `greater barrier raised — all spell damage reduced by 40% for 5 turns`;
  } else if (spellId === "reflect_curse") {
    // Bounce next enemy debuff back to caster (defensive)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.reflect_curse = { turns_left: 3, reflect_enabled: true };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `curse reflection activated — next debuff bounces back`;
  } else if (spellId === "sanctuary") {
    // Protect 20% of population from magical attacks (friendly)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    const protectedPop = Math.floor((caster.population || 0) * 0.2);
    tEffects.sanctuary = { turns_left: 5, protected_population: protectedPop };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `sanctuary created — ${protectedPop.toLocaleString()} population protected from magic`;
  } else if (spellId === "iron_skin_enchantment") {
    // Troops gain +25% armor; lasts 4 turns (friendly)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.iron_skin_enchantment = { turns_left: 4, armor_bonus: 0.25 };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `iron skin enchantment applied — troops gain +25% armor for 4 turns`;
  } else if (spellId === "unbreakable_resolve") {
    // Prevent one resource loss from enemy spells for 3 turns (friendly)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.unbreakable_resolve = { turns_left: 3, loss_prevention_active: true };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `unbreakable resolve formed — one resource loss prevented for 3 turns`;
  } else if (spellId === "summon_rats") {
    // Giant rats infest enemy granaries; destroy 15% food for 4 turns
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    const foodDamage = Math.floor((target.food || 0) * 0.15);
    tEffects.summon_rats = { turns_left: 4, food_damage_per_turn: foodDamage };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    targetUpdates.food = Math.max(0, (target.food || 0) - foodDamage);
    damageDesc = `giant rats infest granaries — ${foodDamage.toLocaleString()} food destroyed per turn for 4 turns`;
  } else if (spellId === "conjure_guardian") {
    // Create guardian; +500 fighters for 5 turns (friendly)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    const guardianCount = Math.floor(500 * magicRatio);
    tEffects.conjure_guardian = { turns_left: 5, guardian_fighters: guardianCount };
    casterUpdates.fighters = (caster.fighters || 0) + guardianCount;
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `guardian conjured — +${guardianCount.toLocaleString()} fighters for 5 turns`;
  } else if (spellId === "mass_resurrection") {
    // Resurrect 30% of fallen troops from last battle (friendly)
    const resurrected = Math.floor(((target.fighters || 0) * 0.3) * magicRatio);
    casterUpdates.fighters = (caster.fighters || 0) + resurrected;
    damageDesc = `${resurrected.toLocaleString()} fallen troops resurrected`;
  } else if (spellId === "materialize_wealth") {
    // Create 5000 gold (costs 10% kingdom mana) (friendly)
    const manaCost = Math.floor((caster.mana || 0) * 0.1);
    if ((caster.mana || 0) >= manaCost) {
      const goldGained = Math.floor(5000 * magicRatio);
      casterUpdates.mana = (casterUpdates.mana !== undefined ? casterUpdates.mana : (caster.mana || 0)) - manaCost;
      targetUpdates.gold = (target.gold || 0) + goldGained;
      damageDesc = `${goldGained.toLocaleString()} gold materialized (cost: ${manaCost} mana)`;
    } else {
      damageDesc = `insufficient mana to materialize wealth`;
    }
  } else if (spellId === "summon_scholar") {
    // Grant temporary researcher; +5000 research XP instantly (friendly)
    const researchGain = Math.floor(5000 * magicRatio);
    damageDesc = `scholar summoned — +${researchGain.toLocaleString()} research points gained`;
  } else if (spellId === "far_seeing") {
    // Show enemy kingdom layout and building locations (research)
    const buildings = [];
    const bldTypes = ["farms", "barracks", "guard_towers", "markets", "granaries", "shrines", "mage_towers", "libraries"];
    for (const bldType of bldTypes) {
      const count = target[`bld_${bldType}`] || 0;
      if (count > 0) buildings.push(`${count} ${bldType}`);
    }
    damageDesc = `kingdom layout revealed: ${buildings.slice(0, 4).join(", ")}`;
  } else if (spellId === "chrono_vision") {
    // Reveal enemy plans for next 3 turns (research)
    damageDesc = `chronological vision shows enemy plans for next 3 turns`;
  } else if (spellId === "soul_reading") {
    // Discover enemy racial bonuses (research)
    const targetRaceBonus = raceBonus(target, "all");
    damageDesc = `soul reading reveals ${target.race || "unknown"} racial traits (multiplier: ${targetRaceBonus})`;
  } else if (spellId === "cosmic_sight") {
    // Show all allied kingdoms of target (research)
    damageDesc = `cosmic sight reveals target's allies and allegiances`;
  } else if (spellId === "prophecy") {
    // +50% accuracy on next 5 spy operations (friendly)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.prophecy = { turns_left: 5, spy_accuracy_bonus: 0.5, operations_left: 5 };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `prophecy granted — +50% spy accuracy for next 5 operations`;
  } else if (spellId === "dominate_will") {
    // 500 enemy fighters serve you permanently (troop conversion)
    const fighters = Math.max(1, Math.floor(500 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - fighters);
    casterUpdates.fighters = (caster.fighters || 0) + fighters;
    damageDesc = `${fighters.toLocaleString()} enemy fighters dominated permanently`;
  } else if (spellId === "mass_enthrallment") {
    // 500 enemy population switches sides (population conversion)
    const pop = Math.max(1, Math.floor(500 * magicRatio * shielded));
    targetUpdates.population = Math.max(0, (target.population || 0) - pop);
    casterUpdates.population = (caster.population || 0) + pop;
    damageDesc = `${pop.toLocaleString()} enemy population enthralled and defected`;
  } else if (spellId === "command_legion") {
    // Enemy troops fight each other for 2 turns (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    const friendlyFireDmg = Math.floor((target.fighters || 0) * 0.1 * magicRatio);
    tEffects.command_legion = { turns_left: 2, friendly_fire: true, damage_per_turn: friendlyFireDmg };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - friendlyFireDmg);
    damageDesc = `command legion sown — enemy troops fight each other for 2 turns`;
  } else if (spellId === "overwhelming_charm") {
    // Enemy spells 50% effective for 4 turns (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.overwhelming_charm = { turns_left: 4, spell_effectiveness_penalty: 0.5 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `overwhelming charm cast — enemy spells only 50% effective for 4 turns`;
  } else if (spellId === "psychic_dominion") {
    // Enemy happiness crashes; paralyzed for 3 turns (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    const happinessWipe = Math.floor((target.happiness || 100) * 0.9);
    tEffects.psychic_dominion = { turns_left: 3, paralyzed: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    targetUpdates.happiness = Math.max(0, (target.happiness || 100) - happinessWipe);
    damageDesc = `psychic dominion — happiness crushed and troops paralyzed for 3 turns`;
  } else if (spellId === "cataclysm") {
    // Destroy 50 buildings and kill 400 fighters (combination damage)
    const bldDmg = Math.max(1, getBldDmg("farms", 50));
    const troopDmg = Math.max(1, Math.floor(400 * magicRatio * shielded));
    targetUpdates.bld_farms = Math.max(0, (target.bld_farms || 0) - bldDmg);
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - troopDmg);
    damageDesc = `cataclysm strikes — ${bldDmg} buildings destroyed, ${troopDmg.toLocaleString()} fighters killed`;
  } else if (spellId === "immolation") {
    // Destroy ALL enemy farms (total destruction)
    const farmsDestroyed = target.bld_farms || 0;
    targetUpdates.bld_farms = 0;
    damageDesc = `immolation — ${farmsDestroyed.toLocaleString()} farms completely destroyed`;
  } else if (spellId === "disintegration_ray") {
    // Destroy 10 largest buildings (selective destruction)
    const bldTypes = ["castles", "mage_towers", "guard_towers", "libraries", "shrines", "markets", "granaries", "barracks", "farms", "walls"];
    let totalDmg = 0;
    for (let i = 0; i < 10 && i < bldTypes.length; i++) {
      const dmg = Math.max(1, getBldDmg(bldTypes[i], 8));
      targetUpdates[`bld_${bldTypes[i]}`] = Math.max(0, (target[`bld_${bldTypes[i]}`] || 0) - dmg);
      totalDmg += dmg;
    }
    damageDesc = `disintegration ray vaporizes — ${totalDmg.toLocaleString()} total building damage`;
  } else if (spellId === "gravitational_crush") {
    // Kill 500 fighters and collapse structures (combination)
    const fightersKilled = Math.max(1, Math.floor(500 * magicRatio * shielded));
    const bldDmg = Math.max(5, getBldDmg("guard_towers", 20));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - fightersKilled);
    targetUpdates.bld_guard_towers = Math.max(0, (target.bld_guard_towers || 0) - bldDmg);
    damageDesc = `gravitational crush — ${fightersKilled.toLocaleString()} fighters crushed, structures collapse`;
  } else if (spellId === "absolute_zero") {
    // Kill 300 population; spoil food (combination damage)
    const popKilled = Math.max(1, Math.floor(300 * magicRatio * shielded));
    const foodSpoiled = Math.floor((target.food || 0) * 0.3);
    targetUpdates.population = Math.max(0, (target.population || 0) - popKilled);
    targetUpdates.food = Math.max(0, (target.food || 0) - foodSpoiled);
    damageDesc = `absolute zero freezes ${popKilled.toLocaleString()} population, spoils ${foodSpoiled.toLocaleString()} food`;
  } else if (spellId === "great_masquerade") {
    // Kingdom appears different; enemy confused (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.great_masquerade = { turns_left: 3, kingdom_hidden: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `great masquerade — kingdom appearance hidden, enemy confused for 3 turns`;
  } else if (spellId === "reality_warping") {
    // Enemy makes poor choices; loses 10% resources (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    const resourceLoss = Math.floor(Math.max((target.gold || 0), (target.food || 0), (target.wood || 0), (target.stone || 0)) * 0.1);
    tEffects.reality_warping = { turns_left: 3, resource_loss_per_turn: resourceLoss };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `reality warping — enemy loses ~${resourceLoss.toLocaleString()} resources per turn`;
  } else if (spellId === "phantom_army") {
    // 1000 illusory fighters appear (confusion)
    const illusoryCount = Math.floor(1000 * magicRatio);
    damageDesc = `phantom army appears — ${illusoryCount.toLocaleString()} illusory fighters confuse enemy`;
  } else if (spellId === "false_victory") {
    // Enemy happiness surges then crashes; -40% happiness (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    const happinessDrop = Math.floor((target.happiness || 100) * 0.4);
    tEffects.false_victory = { turns_left: 3, happiness_loss: happinessDrop };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    targetUpdates.happiness = Math.max(0, (target.happiness || 100) - happinessDrop);
    damageDesc = `false victory — happiness crashes by ${happinessDrop}% for 3 turns`;
  } else if (spellId === "perception_shatter") {
    // Senses fooled for 3 turns; acts randomly (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.perception_shatter = { turns_left: 3, random_actions: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `perception shattered — target acts randomly for 3 turns`;
  } else if (spellId === "mass_undeath") {
    // 500 undead serve you for 5 turns (friendly troops)
    const undeadCount = Math.floor(500 * magicRatio);
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.mass_undeath = { turns_left: 5, undead_count: undeadCount };
    casterUpdates.fighters = (caster.fighters || 0) + undeadCount;
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `${undeadCount} mass undead raised for 5 turns`;
  } else if (spellId === "death_curse") {
    // -30% enemy production permanently (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.death_curse = { turns_left: 9999, production_penalty: 0.3 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `death curse applied — enemy production reduced permanently by 30%`;
  } else if (spellId === "soulbind") {
    // 1000 souls bound; permanent undead servants (population conversion)
    const soulsConverted = Math.max(1, Math.floor(1000 * magicRatio * shielded));
    targetUpdates.population = Math.max(0, (target.population || 0) - soulsConverted);
    casterUpdates.fighters = (caster.fighters || 0) + Math.floor(soulsConverted * 0.5);
    damageDesc = `${soulsConverted.toLocaleString()} souls bound permanently as undead servants`;
  } else if (spellId === "withering_touch") {
    // 5% building damage per turn for 4 turns (building debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    const bldDmgPerTurn = Math.floor((target.bld_farms || 0) * 0.05);
    tEffects.withering_touch = { turns_left: 4, building_damage_per_turn: bldDmgPerTurn };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    targetUpdates.bld_farms = Math.max(0, (target.bld_farms || 0) - bldDmgPerTurn);
    damageDesc = `withering touch applied — buildings decay for 4 turns`;
  } else if (spellId === "ultimate_petrification") {
    // 500 fighters petrified forever (troop removal)
    const petrified = Math.max(1, Math.floor(500 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - petrified);
    damageDesc = `${petrified.toLocaleString()} fighters petrified permanently`;
  } else if (spellId === "divine_form") {
    // +50% all stats for 5 turns (friendly mega-buff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.divine_form = { turns_left: 5, all_stats_bonus: 0.5 };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `divine form assumed — all stats increased by 50% for 5 turns`;
  } else if (spellId === "population_metamorphosis") {
    // 1000 population change race; defect willingly (population conversion)
    const popConverted = Math.max(1, Math.floor(1000 * magicRatio * shielded));
    targetUpdates.population = Math.max(0, (target.population || 0) - popConverted);
    casterUpdates.population = (caster.population || 0) + popConverted;
    damageDesc = `${popConverted.toLocaleString()} population transformed and defected`;
  } else if (spellId === "landscape_shift") {
    // Land becomes swamps; -50% effectiveness for 4 turns (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.landscape_shift = { turns_left: 4, effectiveness_penalty: 0.5 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `landscape shifted to swamps — effectiveness reduced by 50% for 4 turns`;
  } else if (spellId === "weapon_corruption") {
    // Weapons become useless; -40% enemy troops (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    const troopLoss = Math.floor((target.fighters || 0) * 0.4 * magicRatio);
    tEffects.weapon_corruption = { turns_left: 3, troop_effectiveness_penalty: 0.4 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - troopLoss);
    damageDesc = `weapons corrupted — ${troopLoss.toLocaleString()} fighters lose effectiveness`;
  } else if (spellId === "zombify_population") {
    // 500 population become undead chaos (population conversion)
    const popConverted = Math.max(1, Math.floor(500 * magicRatio * shielded));
    targetUpdates.population = Math.max(0, (target.population || 0) - popConverted);
    casterUpdates.fighters = (caster.fighters || 0) + Math.floor(popConverted * 0.5);
    damageDesc = `${popConverted.toLocaleString()} population zombified and enslaved`;
  }

  // ── TIER 4 SPELLS ──────────────────────────────────────────────────────────

  else if (spellId === "complete_negation") {
    // Completely cancel all active enemy debuffs permanently
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    const debuffList = Object.keys(tEffects).filter(k => k !== "shield" && k !== "bless");
    let cleared = 0;
    debuffList.forEach(d => {
      delete tEffects[d];
      cleared++;
    });
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `complete negation — ${cleared} debuffs permanently cancelled`;
  } else if (spellId === "prismatic_shield") {
    // Reduce damage by 50%; reflect 25% back for 6 turns (friendly)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.prismatic_shield = { turns_left: 6, damage_reduction: 0.5, reflect_percentage: 0.25 };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `prismatic shield formed — -50% damage, 25% reflected for 6 turns`;
  } else if (spellId === "planar_anchor") {
    // Prevent enemy summons entering territory for 5 turns
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.planar_anchor = { turns_left: 5, summon_prevention: true };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `planar anchor deployed — enemy summons blocked for 5 turns`;
  } else if (spellId === "divine_intervention") {
    // Resurrect 15% of fallen fighters from last battle (friendly)
    const resurrected = Math.floor(((target.fighters || 0) * 0.15) * magicRatio);
    targetUpdates.fighters = (target.fighters || 0) + resurrected;
    damageDesc = `divine intervention — ${resurrected.toLocaleString()} fighters resurrected`;
  } else if (spellId === "eternal_vigilance") {
    // Kingdom immune to assassination for 4 turns (friendly)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.eternal_vigilance = { turns_left: 4, assassination_immunity: true };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `eternal vigilance activated — immune to assassination for 4 turns`;
  } else if (spellId === "summon_avatar") {
    // Summon avatar; 2000 fighters + 5000 mana protection for 4 turns (friendly)
    const avatar = Math.floor(2000 * magicRatio);
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.summon_avatar = { turns_left: 4, avatar_fighters: avatar, mana_shield: 5000 };
    casterUpdates.fighters = (caster.fighters || 0) + avatar;
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `avatar summoned — +${avatar.toLocaleString()} fighters, +5000 mana protection for 4 turns`;
  } else if (spellId === "conjure_abundance") {
    // Create unlimited food for 3 turns; no starvation (friendly)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.conjure_abundance = { turns_left: 3, unlimited_food: true };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `abundance conjured — unlimited food for 3 turns`;
  } else if (spellId === "summon_plague_doctor") {
    // Summon healer; cure all population debuffs instantly (friendly)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    const debuffKeys = Object.keys(tEffects).filter(k => k.includes("plague") || k.includes("disease") || k.includes("life_drain"));
    debuffKeys.forEach(k => delete tEffects[k]);
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `plague doctor summoned — all population debuffs cured`;
  } else if (spellId === "materialize_army") {
    // Create 1000 fighters from magical essence (friendly)
    const armySize = Math.floor(1000 * magicRatio);
    casterUpdates.fighters = (caster.fighters || 0) + armySize;
    damageDesc = `army materialized — +${armySize.toLocaleString()} fighters from essence`;
  } else if (spellId === "conjure_fortress") {
    // +5000 wall strength for 5 turns (friendly)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.conjure_fortress = { turns_left: 5, wall_bonus: 5000 };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `fortress conjured — +5000 wall strength for 5 turns`;
  } else if (spellId === "all_knowing_eye") {
    // Reveal EVERYTHING about target kingdom (research)
    const allData = `Pop: ${(target.population || 0).toLocaleString()}, Gold: ${(target.gold || 0).toLocaleString()}, Fighters: ${(target.fighters || 0).toLocaleString()}, Mage: ${(target.res_spellbook || 0)}%`;
    damageDesc = `all-knowing eye reveals all: ${allData}`;
  } else if (spellId === "foresee_disaster") {
    // Predict and prevent 1 enemy attack (research/friendly)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.foresee_disaster = { turns_left: 2, attack_prevention: 1 };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `disaster foreseen — 1 enemy attack will be prevented`;
  } else if (spellId === "temporal_sight") {
    // Reveal kingdom appearance 5 turns ago and future (research)
    damageDesc = `temporal sight pierces time — reveals past and future appearances`;
  } else if (spellId === "scry_sanctum") {
    // Reveal mage tower locations and mana reserves (research)
    const mages = (target.mages || 0);
    const mana = (target.mana || 0);
    damageDesc = `sanctum scryed — ${mages} mages, ${mana.toLocaleString()} mana reserves revealed`;
  } else if (spellId === "prophetic_dream") {
    // +200% to next divination spell for 3 turns (friendly buff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.prophetic_dream = { turns_left: 3, divination_bonus: 2.0 };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `prophetic dream granted — +200% divination effectiveness for 3 turns`;
  } else if (spellId === "total_domination") {
    // All enemy fighters serve you for 3 turns (huge troop conversion)
    const allFighters = Math.max(1, Math.floor((target.fighters || 0) * 0.8 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - allFighters);
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.total_domination = { turns_left: 3, dominated_count: allFighters };
    casterUpdates.fighters = (caster.fighters || 0) + allFighters;
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `total domination — ${allFighters.toLocaleString()} enemy fighters enslaved for 3 turns`;
  } else if (spellId === "break_will") {
    // Enemy happiness -50% permanently (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    const happinessLoss = Math.floor((target.happiness || 100) * 0.5);
    tEffects.break_will = { turns_left: 9999, happiness_penalty: 0.5 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    targetUpdates.happiness = Math.max(0, (target.happiness || 100) - happinessLoss);
    damageDesc = `will broken — happiness permanently reduced by 50%`;
  } else if (spellId === "mass_enslavement") {
    // 2000 enemy population become thralls (population conversion)
    const popEnslaved = Math.max(1, Math.floor(2000 * magicRatio * shielded));
    targetUpdates.population = Math.max(0, (target.population || 0) - popEnslaved);
    casterUpdates.population = (caster.population || 0) + popEnslaved;
    damageDesc = `${popEnslaved.toLocaleString()} population mass enslaved`;
  } else if (spellId === "control_kingdom") {
    // You control enemy for 2 turns (devastating debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.control_kingdom = { turns_left: 2, full_control: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `kingdom controlled — target under your control for 2 turns`;
  } else if (spellId === "unbreakable_bond") {
    // Mind link formed; know all enemy actions for 5 turns (research)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.unbreakable_bond = { turns_left: 5, omniscience: true };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `mind link formed — know all enemy actions for 5 turns`;
  } else if (spellId === "reality_rip") {
    // Destroy 30% of all buildings; kill 1000 fighters (massive damage)
    let totalBldDmg = 0;
    const bldTypes = ["farms", "barracks", "guard_towers", "markets", "granaries", "shrines", "mage_towers", "libraries"];
    for (const bldType of bldTypes) {
      const bldDmg = Math.floor((target[`bld_${bldType}`] || 0) * 0.3 * magicRatio * shielded);
      targetUpdates[`bld_${bldType}`] = Math.max(0, (target[`bld_${bldType}`] || 0) - bldDmg);
      totalBldDmg += bldDmg;
    }
    const fightersKilled = Math.max(1, Math.floor(1000 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - fightersKilled);
    damageDesc = `reality rips — ${totalBldDmg} buildings destroyed, ${fightersKilled.toLocaleString()} fighters killed`;
  } else if (spellId === "solar_flare") {
    // Incinerate wooden buildings; kill 800 (fire damage)
    const farmsDestroyed = Math.max(1, getBldDmg("farms", 100));
    const granariesDestroyed = Math.max(1, getBldDmg("granaries", 30));
    const fightersKilled = Math.max(1, Math.floor(800 * magicRatio * shielded));
    targetUpdates.bld_farms = Math.max(0, (target.bld_farms || 0) - farmsDestroyed);
    targetUpdates.bld_granaries = Math.max(0, (target.bld_granaries || 0) - granariesDestroyed);
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - fightersKilled);
    damageDesc = `solar flare incinerates ${farmsDestroyed + granariesDestroyed} wooden structures, kills ${fightersKilled.toLocaleString()} fighters`;
  } else if (spellId === "void_storm") {
    // Chaotic void destroys everything randomly (indiscriminate damage)
    const randomDmg = Math.floor(Math.random() * ((target.population || 0) * 0.2 + (target.fighters || 0) * 0.15) * magicRatio * shielded);
    const popLoss = Math.floor(randomDmg * 0.4);
    const troopLoss = Math.floor(randomDmg * 0.6);
    targetUpdates.population = Math.max(0, (target.population || 0) - popLoss);
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - troopLoss);
    damageDesc = `void storm rages — ${popLoss.toLocaleString()} population and ${troopLoss.toLocaleString()} fighters annihilated`;
  } else if (spellId === "apocalyptic_wave") {
    // Kill 2000 fighters and destroy 40 buildings (force wave)
    const fighters = Math.max(1, Math.floor(2000 * magicRatio * shielded));
    const bldTypes = ["guard_towers", "barracks", "mage_towers", "markets", "granaries"];
    let totalBldDmg = 0;
    for (const bldType of bldTypes.slice(0, 8)) {
      const dmg = Math.max(1, getBldDmg(bldType, 8));
      targetUpdates[`bld_${bldType}`] = Math.max(0, (target[`bld_${bldType}`] || 0) - dmg);
      totalBldDmg += dmg;
    }
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - fighters);
    damageDesc = `apocalyptic wave — ${fighters.toLocaleString()} fighters killed, ${totalBldDmg} buildings destroyed`;
  } else if (spellId === "supernova") {
    // Destroy ALL farms and 30% of buildings (fire catastrophe)
    const farmsDestroyed = target.bld_farms || 0;
    targetUpdates.bld_farms = 0;
    let otherBldDmg = 0;
    const bldTypes = ["barracks", "guard_towers", "markets", "granaries", "shrines", "mage_towers", "libraries", "castles"];
    for (const bldType of bldTypes) {
      const dmg = Math.floor((target[`bld_${bldType}`] || 0) * 0.3 * magicRatio * shielded);
      targetUpdates[`bld_${bldType}`] = Math.max(0, (target[`bld_${bldType}`] || 0) - dmg);
      otherBldDmg += dmg;
    }
    damageDesc = `supernova — all ${farmsDestroyed} farms incinerated, ${otherBldDmg} other buildings destroyed`;
  } else if (spellId === "ultimate_deception") {
    // 80% of kingdom hidden for 4 turns (illusion)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.ultimate_deception = { turns_left: 4, visibility_penalty: 0.8 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `ultimate deception — 80% of kingdom hidden for 4 turns`;
  } else if (spellId === "temporal_mirage") {
    // Show past versions; enemy confused (illusion debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.temporal_mirage = { turns_left: 3, confusion: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `temporal mirage shows ghosts of kingdom — enemy confused for 3 turns`;
  } else if (spellId === "false_apocalypse") {
    // Fake attack; enemy flees, loses 500 fighters (illusory panic)
    const fighters = Math.max(1, Math.floor(500 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - fighters);
    damageDesc = `false apocalypse — enemy panics, ${fighters.toLocaleString()} fighters flee`;
  } else if (spellId === "multiversal_echo") {
    // Multiple copies confuse enemy (illusion debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.multiversal_echo = { turns_left: 3, confusion_level: "severe" };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `multiversal echo creates copies — enemy severely confused for 3 turns`;
  } else if (spellId === "existence_masked") {
    // -100% enemy accuracy for 3 turns (complete blindness)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.existence_masked = { turns_left: 3, accuracy_penalty: 1.0 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `existence masked — enemy completely blind for 3 turns`;
  } else if (spellId === "undead_plague") {
    // 1000 undead attack; 1500 fighters killed (necromancy)
    const undeadCount = Math.floor(1000 * magicRatio);
    const enemyKilled = Math.max(1, Math.floor(1500 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - enemyKilled);
    casterUpdates.fighters = (caster.fighters || 0) + undeadCount;
    damageDesc = `undead plague — ${undeadCount} undead attack, ${enemyKilled.toLocaleString()} fighters killed`;
  } else if (spellId === "death_immortal") {
    // Immortal undead with 2000 power serves forever (permanent)
    const immortalCount = Math.floor(2000 * magicRatio);
    casterUpdates.fighters = (caster.fighters || 0) + immortalCount;
    damageDesc = `immortal undead summoned — +${immortalCount.toLocaleString()} eternal undead fighters`;
  } else if (spellId === "soulflare") {
    // Kill 800 and reanimate as undead (conversion)
    const killed = Math.max(1, Math.floor(800 * magicRatio * shielded));
    const reanimated = Math.floor(killed * 0.7);
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - killed);
    casterUpdates.fighters = (caster.fighters || 0) + reanimated;
    damageDesc = `soulflare kills ${killed.toLocaleString()}, reanimates ${reanimated} as undead`;
  } else if (spellId === "cursed_existence") {
    // Cannot be healed for 5 turns; all healing fails (devastating debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.cursed_existence = { turns_left: 5, healing_disabled: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `cursed existence — all healing fails for 5 turns`;
  } else if (spellId === "necromantic_ascension") {
    // Become undead; +50% necromancy for 6 turns (friendly buff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.necromantic_ascension = { turns_left: 6, necromancy_bonus: 0.5 };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `ascended to undeath — +50% necromancy effectiveness for 6 turns`;
  } else if (spellId === "complete_transformation") {
    // 1000 fighters permanently converted (transmutation)
    const converted = Math.max(1, Math.floor(1000 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - converted);
    casterUpdates.fighters = (caster.fighters || 0) + converted;
    damageDesc = `${converted.toLocaleString()} fighters permanently transformed`;
  } else if (spellId === "dragon_form") {
    // Transform into dragon; 5000 power for 5 turns (friendly)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    const dragonPower = Math.floor(5000 * magicRatio);
    tEffects.dragon_form = { turns_left: 5, dragon_power: dragonPower };
    casterUpdates.fighters = (caster.fighters || 0) + dragonPower;
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `dragon form assumed — +${dragonPower.toLocaleString()} power for 5 turns`;
  } else if (spellId === "kingdom_alteration") {
    // Transform enemy terrain; -60% production (debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.kingdom_alteration = { turns_left: 5, production_penalty: 0.6 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `enemy kingdom terrain transformed — production reduced by 60%`;
  } else if (spellId === "transcendence") {
    // Pure magical energy; +100% spells for 6 turns (friendly mega-buff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.transcendence = { turns_left: 6, spell_effectiveness_bonus: 1.0 };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `transcendence achieved — +100% spell effectiveness for 6 turns`;
  } else if (spellId === "mass_metamorphosis") {
    // 2000 population become permanent servants (population conversion)
    const converted = Math.max(1, Math.floor(2000 * magicRatio * shielded));
    targetUpdates.population = Math.max(0, (target.population || 0) - converted);
    casterUpdates.population = (caster.population || 0) + converted;
    damageDesc = `${converted.toLocaleString()} population transformed into permanent servants`;
  }

  // ── TIER 5 SPELLS ──────────────────────────────────────────────────────────

  else if (spellId === "absolute_protection") {
    // Reduce all damage by 75% for 7 turns; impenetrable (legendary defense)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.absolute_protection = { turns_left: 7, damage_reduction: 0.75, impenetrable: true };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `absolute protection activated — -75% all damage for 7 turns, impenetrable`;
  } else if (spellId === "temporal_rewind") {
    // Undo last enemy spell; remove all its effects retroactively (game-changing)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    const spellCount = Object.keys(tEffects).length;
    tEffects = {};
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `temporal rewind — ${spellCount} enemy spell effects retroactively removed`;
  } else if (spellId === "fortress_eternal") {
    // All buildings indestructible for next attack cycle (legendary defense)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.fortress_eternal = { turns_left: 10, indestructible: true };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `fortress eternal — all buildings become indestructible`;
  } else if (spellId === "divine_aegis") {
    // Create protection zone; prevent enemy spells for 3 turns (anti-magic)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.divine_aegis = { turns_left: 3, spell_immunity: true };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `divine aegis formed — enemy spells prevented for 3 turns`;
  } else if (spellId === "unmaking_ward") {
    // Permanently seal a location against enemy expeditions (strategic lock)
    damageDesc = `unmaking ward placed — enemy expeditions permanently sealed out`;
  } else if (spellId === "summon_echo") {
    // Summon kingdom echo; double all bonuses for 7 turns (legendary buff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.summon_echo = { turns_left: 7, bonus_multiplier: 2.0 };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `kingdom echo summoned — all bonuses doubled for 7 turns`;
  } else if (spellId === "conjure_realm") {
    // +50% storage for all buildings for 6 turns (resource mega-buff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.conjure_realm = { turns_left: 6, storage_bonus: 0.5 };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `realm conjured — +50% storage for all buildings for 6 turns`;
  } else if (spellId === "ultimate_resurrection") {
    // Bring back 50% of all troops ever lost (massive troop restoration)
    const resurrected = Math.floor(((target.fighters || 0) * 0.5) * magicRatio);
    casterUpdates.fighters = (caster.fighters || 0) + resurrected;
    damageDesc = `ultimate resurrection — ${resurrected.toLocaleString()} troops restored from the grave`;
  } else if (spellId === "summon_ascendant") {
    // Summon ascendant; +100% spell effectiveness for 5 turns (ultimate buff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.summon_ascendant = { turns_left: 5, spell_effectiveness: 2.0 };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `ascendant summoned — +100% spell effectiveness for 5 turns`;
  } else if (spellId === "conjure_paradise") {
    // Create ideal state; maximize all production for 4 turns (perfect economy)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.conjure_paradise = { turns_left: 4, production_maximized: true };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `paradise conjured — all production maximized for 4 turns`;
  } else if (spellId === "omniscience") {
    // All information about target revealed for 5 turns (legendary divination)
    damageDesc = `omniscience achieved — absolute knowledge of target for 5 turns`;
  } else if (spellId === "see_all_timelines") {
    // Reveal all possible outcomes of next 5 turns (strategic advantage)
    damageDesc = `all timelines visible — reveal all possible enemy actions for 5 turns`;
  } else if (spellId === "divine_blueprint") {
    // Reveal exact blueprint of enemy's next building (divination advantage)
    damageDesc = `divine blueprint revealed — next enemy building revealed in detail`;
  } else if (spellId === "fates_thread") {
    // Reveal target weakness; +40% combat advantage (strategic insight)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.fates_thread = { turns_left: 5, combat_advantage: 0.4 };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `fate's thread woven — target weakness revealed, +40% combat advantage`;
  } else if (spellId === "perfect_foresight") {
    // Immune to surprises; see all enemy actions for 4 turns (omniscience)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.perfect_foresight = { turns_left: 4, omniscience: true };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `perfect foresight — see all enemy actions for 4 turns, immune to surprises`;
  } else if (spellId === "absolute_domination") {
    // Total control of enemy for 4 turns (legendary control)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.absolute_domination = { turns_left: 4, total_control: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `absolute domination achieved — total control for 4 turns`;
  } else if (spellId === "eternal_thralldom") {
    // Enemy population permanently enslaved (total conquest)
    const popEnslaved = (target.population || 0);
    targetUpdates.population = 0;
    casterUpdates.population = (caster.population || 0) + Math.floor(popEnslaved * 0.8);
    damageDesc = `eternal thralldom — all ${popEnslaved.toLocaleString()} population enslaved forever`;
  } else if (spellId === "shatter_consciousness") {
    // Enemy stats reduced 75% for 6 turns (devastating debuff)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.shatter_consciousness = { turns_left: 6, stat_reduction: 0.75 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `consciousness shattered — all enemy stats reduced 75% for 6 turns`;
  } else if (spellId === "puppet_master") {
    // Control enemy leader; force their spells (ultimate control)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.puppet_master = { turns_left: 5, leader_controlled: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `puppet master — enemy leader controlled, forced to cast YOUR spells`;
  } else if (spellId === "ascendant_will") {
    // Enemy cannot act if you forbid for 5 turns (total paralysis)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.ascendant_will = { turns_left: 5, forbidden: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `ascendant will imposed — enemy paralyzed for 5 turns`;
  } else if (spellId === "extinction_event") {
    // Destroy 50% of buildings; kill 3000 fighters + 1000 population (catastrophic)
    let totalBldDmg = 0;
    const bldTypes = ["farms", "barracks", "guard_towers", "markets", "granaries", "shrines", "mage_towers", "libraries"];
    for (const bldType of bldTypes) {
      const dmg = Math.floor((target[`bld_${bldType}`] || 0) * 0.5);
      targetUpdates[`bld_${bldType}`] = Math.max(0, (target[`bld_${bldType}`] || 0) - dmg);
      totalBldDmg += dmg;
    }
    const fighters = Math.max(1, Math.floor(3000 * magicRatio * shielded));
    const pop = Math.max(1, Math.floor(1000 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - fighters);
    targetUpdates.population = Math.max(0, (target.population || 0) - pop);
    damageDesc = `extinction event — ${totalBldDmg} buildings, ${fighters.toLocaleString()} fighters, ${pop.toLocaleString()} population annihilated`;
  } else if (spellId === "dimensional_collapse") {
    // 100 buildings destroyed; 2000 fighters + 1500 population killed (dimensional catastrophe)
    const bldDmg = Math.max(1, getBldDmg("farms", 100));
    const fighters = Math.max(1, Math.floor(2000 * magicRatio * shielded));
    const pop = Math.max(1, Math.floor(1500 * magicRatio * shielded));
    targetUpdates.bld_farms = Math.max(0, (target.bld_farms || 0) - bldDmg);
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - fighters);
    targetUpdates.population = Math.max(0, (target.population || 0) - pop);
    damageDesc = `dimensional collapse — ${bldDmg} buildings, ${fighters.toLocaleString()} fighters, ${pop.toLocaleString()} population lost`;
  } else if (spellId === "infinite_inferno") {
    // Perpetual fire consumes ALL farms, granaries, markets (total resource destruction)
    const farms = target.bld_farms || 0;
    const granaries = target.bld_granaries || 0;
    const markets = target.bld_markets || 0;
    targetUpdates.bld_farms = 0;
    targetUpdates.bld_granaries = 0;
    targetUpdates.bld_markets = 0;
    damageDesc = `infinite inferno — ${farms} farms, ${granaries} granaries, ${markets} markets consumed eternally`;
  } else if (spellId === "entropy_unleashed") {
    // Universe ages kingdom; 60% infrastructure damage (aging decay)
    let totalBldDmg = 0;
    const bldTypes = ["farms", "barracks", "guard_towers", "markets", "granaries", "shrines", "mage_towers", "libraries", "castles", "walls"];
    for (const bldType of bldTypes) {
      const dmg = Math.floor((target[`bld_${bldType}`] || 0) * 0.6 * magicRatio * shielded);
      targetUpdates[`bld_${bldType}`] = Math.max(0, (target[`bld_${bldType}`] || 0) - dmg);
      totalBldDmg += dmg;
    }
    damageDesc = `entropy unleashed — universe ages kingdom, ${totalBldDmg} buildings crumble`;
  } else if (spellId === "cosmic_annihilation") {
    // Ultimate destruction; 75% buildings gone, 3000 fighters + 2000 population lost (apocalypse)
    let totalBldDmg = 0;
    const bldTypes = ["farms", "barracks", "guard_towers", "markets", "granaries", "shrines", "mage_towers", "libraries", "castles"];
    for (const bldType of bldTypes) {
      const dmg = Math.floor((target[`bld_${bldType}`] || 0) * 0.75 * magicRatio * shielded);
      targetUpdates[`bld_${bldType}`] = Math.max(0, (target[`bld_${bldType}`] || 0) - dmg);
      totalBldDmg += dmg;
    }
    const fighters = Math.max(1, Math.floor(3000 * magicRatio * shielded));
    const pop = Math.max(1, Math.floor(2000 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - fighters);
    targetUpdates.population = Math.max(0, (target.population || 0) - pop);
    damageDesc = `cosmic annihilation — ${totalBldDmg} buildings, ${fighters.toLocaleString()} fighters, ${pop.toLocaleString()} population destroyed`;
  } else if (spellId === "perfect_illusion") {
    // So perfect enemy is blind for 5 turns (ultimate blindness)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.perfect_illusion = { turns_left: 5, complete_blindness: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `perfect illusion — enemy completely blind for 5 turns`;
  } else if (spellId === "infinite_reflection") {
    // Infinite copies; enemy loses 1000 fighters (illusory army)
    const fighters = Math.max(1, Math.floor(1000 * magicRatio * shielded));
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - fighters);
    damageDesc = `infinite reflection — ${fighters.toLocaleString()} fighters panicked by infinite copies`;
  } else if (spellId === "paradox_engine") {
    // Reality becomes illusion; can't act for 4 turns (ultimate confusion)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.paradox_engine = { turns_left: 4, reality_broken: true };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `paradox engine ignited — reality broken, enemy paralyzed for 4 turns`;
  } else if (spellId === "false_reality") {
    // 4 enemy spells don't fire (spell negation)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.false_reality = { turns_left: 3, spells_negated: 4 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `false reality created — 4 enemy spells will fail to fire`;
  } else if (spellId === "unreality") {
    // Kingdom hidden while real hidden; 6 turns (ultimate stealth)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.unreality = { turns_left: 6, kingdom_hidden: true };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `unreality achieved — kingdom hidden from reality for 6 turns`;
  } else if (spellId === "death_dominion") {
    // All enemy deaths reanimate under control for 7 turns (eternal slavery)
    const popLoss = Math.floor(((target.fighters || 0) * 0.4) * magicRatio);
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.death_dominion = { turns_left: 7, death_reanimation: true };
    casterUpdates.fighters = (caster.fighters || 0) + popLoss;
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `death dominion — all future enemy deaths reanimate under your control for 7 turns`;
  } else if (spellId === "eternal_undeath") {
    // 3000 permanent undead forever (eternal legion)
    const undead = Math.floor(3000 * magicRatio);
    casterUpdates.fighters = (caster.fighters || 0) + undead;
    damageDesc = `eternal undeath — ${undead.toLocaleString()} permanent undead summoned`;
  } else if (spellId === "apocalyptic_undeath") {
    // All dead from last 10 battles reanimate (resurrection apocalypse)
    const reanimated = Math.floor(((target.fighters || 0) * 2.0) * magicRatio);
    casterUpdates.fighters = (caster.fighters || 0) + reanimated;
    damageDesc = `apocalyptic undeath — ${reanimated.toLocaleString()} undead from past battles reanimated`;
  } else if (spellId === "deaths_embrace") {
    // Kill 2000; all become undead thralls (conversion apocalypse)
    const killed = Math.max(1, Math.floor(2000 * magicRatio * shielded));
    const enslaved = Math.floor(killed * 0.8);
    targetUpdates.fighters = Math.max(0, (target.fighters || 0) - killed);
    casterUpdates.fighters = (caster.fighters || 0) + enslaved;
    damageDesc = `death's embrace — ${killed.toLocaleString()} killed, ${enslaved} enslaved`;
  } else if (spellId === "lich_king") {
    // Ascend to lichdom; immortal, +100% spells, 5000 undead for 6 turns (ultimate transformation)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    const undeadCount = Math.floor(5000 * magicRatio);
    tEffects.lich_king = { turns_left: 6, immortal: true, spell_bonus: 1.0, undead_count: undeadCount };
    casterUpdates.fighters = (caster.fighters || 0) + undeadCount;
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `ascended to lich-king — immortal, +100% spells, +${undeadCount.toLocaleString()} undead for 6 turns`;
  } else if (spellId === "ascendant_transformation") {
    // Become immortal and invincible for 7 turns (godhood)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.ascendant_transformation = { turns_left: 7, immortal: true, invincible: true };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `transcendence achieved — immortal and invincible for 7 turns`;
  } else if (spellId === "reality_reconstruction") {
    // Enemy buildings change purpose; -80% effectiveness (total disruption)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(target.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.reality_reconstruction = { turns_left: 5, building_dysfunction: 0.8 };
    targetUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `reality reconstructed — enemy buildings 80% ineffective`;
  } else if (spellId === "ultimate_metamorphosis") {
    // 5000 population permanently converted (population apocalypse)
    const converted = Math.max(1, Math.floor(5000 * magicRatio * shielded));
    targetUpdates.population = Math.max(0, (target.population || 0) - converted);
    casterUpdates.population = (caster.population || 0) + converted;
    damageDesc = `ultimate metamorphosis — ${converted.toLocaleString()} population permanently transformed`;
  } else if (spellId === "civilization_upheaval") {
    // Enemy bonuses become your bonuses for 5 turns (bonus theft)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.civilization_upheaval = { turns_left: 5, bonus_theft: true };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `civilization upheaval — enemy bonuses stolen for 5 turns`;
  } else if (spellId === "eternal_transmutation") {
    // Master of change; all enemy transformations fail for 6 turns (transformation immunity)
    let tEffects = {};
    try {
      tEffects = safeJsonParse(caster.active_effects, {}, "auto:active_effects");
    } catch {}
    tEffects.eternal_transmutation = { turns_left: 6, transformation_immunity: true };
    casterUpdates.active_effects = JSON.stringify(tEffects);
    damageDesc = `eternal transmutation mastered — immune to enemy transformations for 6 turns`;
  }

  // Apply active effect to target if this is a debuff spell
  if (activeEffect) {
    targetEffects[spellId] = activeEffect;
    targetUpdates.active_effects = JSON.stringify(targetEffects);
  }

  const targetEvent = obscure
    ? `⚡ A mysterious ${spellId.replace(/_/g, " ")} spell struck your kingdom — ${damageDesc}.`
    : `⚡ ${caster.name} cast ${spellId.replace(/_/g, " ")} on your kingdom — ${damageDesc}.`;

  const casterEvent = `✨ You cast ${spellId.replace(/_/g, " ")} on ${target.name}. Effect: ${damageDesc}.`;

  // Discovery logic: Target discovers caster if not obscured
  if (!obscure) {
    let targetDisc = {};
    try {
      targetDisc = safeJsonParse(target.discovered_kingdoms, {}, "auto:discovered_kingdoms");
    } catch {}
    if (!targetDisc[caster.id]) {
      targetDisc[caster.id] = { found: true };
      targetUpdates.discovered_kingdoms = JSON.stringify(targetDisc);
    }
  }

  return {
    casterUpdates,
    targetUpdates,
    report: {
      spellId,
      damageDesc,
      manaCost: totalMana,
      obscure,
      magicRatio: Math.round(magicRatio * 100),
    },
    casterEvent,
    targetEvent,
  };
}

// ── Covert ops ────────────────────────────────────────────────────────────────

function processMageTower(k, events) {
  const updates = {};
  const towers = k.bld_mage_towers;
  if (towers === 0) return updates;

  let alloc = {};
  try {
    alloc = safeJsonParse(k.mage_tower_allocation, {}, "auto:mage_tower_allocation");
  } catch {
    alloc = {};
  }
  let progress = {};
  try {
    progress = safeJsonParse(k.tower_progress, {}, "auto:tower_progress");
  } catch {
    progress = {};
  }
  let scrolls = {};
  try {
    scrolls = safeJsonParse(k.scrolls, {}, "auto:scrolls");
  } catch {
    scrolls = {};
  }

  // Fallback for old schema
  if (alloc.scroll_craft) {
    alloc[alloc.scroll_craft] = alloc.scroll_target || 999;
    delete alloc.scroll_craft;
    delete alloc.scroll_target;
  }

  const capacity = towers * 20;
  const effectiveMages = Math.min(getAvailableUnits(k, "mages"), capacity);
  const mageLvlMult = unitLevelMult(k, "mages");
  const raceMagic = raceBonus(k, "magic");

  let towerUpgrades = {};
  try {
    towerUpgrades = safeJsonParse(k.tower_upgrades, {}, "auto:tower_upgrades");
  } catch {}
  const towerSpeedMult = towerUpgrades.ley_line_tap ? 1.25 : 1.0;

  let activeTasks = Object.keys(alloc).filter(
    (t) => alloc[t] > 0 && SCROLL_REQUIREMENTS[t],
  );

  if (effectiveMages > 0 && activeTasks.length > 0) {
    let magesPerTask = effectiveMages / activeTasks.length;
    let completedAny = false;

    activeTasks.forEach((task) => {
      const req = SCROLL_REQUIREMENTS[task];
      const effective = magesPerTask;
      const progKey = "scroll_" + task;
      const workDone =
        (effective / req.mages) * mageLvlMult * towerSpeedMult * raceMagic;
      let newProg = (progress[progKey] || 0) + workDone;

      while (newProg >= req.turns && alloc[task] > 0) {
        if (task !== "blank_scroll") {
          if ((scrolls.blank_scroll || 0) < 1) {
            newProg = req.turns - 0.01;
            break; // stall
          }
          scrolls.blank_scroll -= 1;
        }

        alloc[task] -= 1;
        newProg -= req.turns;

        const helfBonus = racialUnitBonus(k, "mages");
        const scrollsProduced = helfBonus.doubleScrolls ? 2 : 1;
        scrolls[task] = (scrolls[task] || 0) + scrollsProduced;
        updates.scrolls = JSON.stringify(scrolls);

        updates._craftedScrolls = updates._craftedScrolls || {};
        updates._craftedScrolls[task] =
          (updates._craftedScrolls[task] || 0) + scrollsProduced;
        if (helfBonus.doubleScrolls) updates._helfBonusApplied = true;

        completedAny = true;

        const mXp = awardTroopXp(
          { ...k, troop_levels: updates.troop_levels || k.troop_levels },
          "mages",
          20,
        );
        updates.troop_levels = mXp.troop_levels;
      }

      if (alloc[task] <= 0) delete alloc[task];
      progress[progKey] = alloc[task] > 0 ? newProg : 0;

      if (workDone > 0 && alloc[task] > 0) {
        if (!updates._mage_estimates) updates._mage_estimates = [];
        const pct = Math.floor(((progress[progKey] || 0) / req.turns) * 100);
        const turnsLeft = Math.ceil(
          (req.turns - (progress[progKey] || 0)) / workDone,
        );
        const displayTask =
          task === "blank_scroll"
            ? "Blank scroll"
            : task.replace(/_/g, " ") + " scroll";
        updates._mage_estimates.push(
          `${displayTask} (${pct}%, ${turnsLeft} turns left)`,
        );
      }
    });

    if (updates._craftedScrolls) {
      let msgParts = [];
      for (const [task, count] of Object.entries(updates._craftedScrolls)) {
        const displayTask =
          task === "blank_scroll" ? "Blank" : task.replace(/_/g, " ");
        msgParts.push(`${count}x ${displayTask}`);
      }
      const str = msgParts.join(", ");
      const bonusMsg = updates._helfBonusApplied
        ? " (High Elf mastery — double scrolls produced!)"
        : "";
      const totalScrolls = Object.values(updates._craftedScrolls).reduce(
        (a, b) => a + b,
        0,
      );
      events.push({
        type: "system",
        message: `✨ The Mage Tower has completed: ${str} scroll${totalScrolls > 1 ? "s" : ""}.${bonusMsg}`,
      });
      delete updates._craftedScrolls;
      delete updates._helfBonusApplied;
    }

    if (updates._mage_estimates && updates._mage_estimates.length > 0) {
      events.push({
        type: "system",
        message: `📜 Mage Tower Est: ${updates._mage_estimates.join(" · ")}.`,
      });
      delete updates._mage_estimates;
    }

    if (completedAny) {
      updates.mage_tower_allocation = JSON.stringify(alloc);
    }
  }

  updates.tower_progress = JSON.stringify(progress);
  return updates;
}

// ── Shrine — clerics boost happiness and prepare healing ────────────────────────
function processShrine(k, _events) {
  const updates = {};
  const shrines = k.bld_shrines;
  if (shrines === 0) return updates;

  const shrinePowerMult = fragmentBonusManager.getBonusMultiplier(k, 'shrines', 'power');
  const shrineHealingMult = fragmentBonusManager.getBonusMultiplier(k, 'shrines', 'healing');
  const capacity = Math.floor(shrines * 15 * shrinePowerMult * shrineHealingMult);
  const effectiveClerics = Math.min(getAvailableUnits(k, "clerics"), capacity);

  // Cleric XP for praying
  if (effectiveClerics > 0) {
    const clericXp = Math.max(1, Math.floor(effectiveClerics / 5));
    const resClerics = awardUnitXp({ ...k, ...updates }, "clerics", clericXp);
    if (resClerics) {
      updates.troop_levels = resClerics;
    }
  }

  return updates;
}

// ── Mausoleum — Thralls populate and provide base defense ────────────────────
function processMausoleum(k, events) {
  const updates = {};
  const mausoleums = k.bld_mausoleums;
  if (mausoleums === 0) return updates;

  let mausoleumUpgrades = {};
  try {
    mausoleumUpgrades = safeJsonParse(k.mausoleum_upgrades, {}, "auto:mausoleum_upgrades");
  } catch {}

  const perMausoleum = 100 + (mausoleumUpgrades.soul_vault ? 50 : 0);
  const mausoleumCapacityMult = fragmentBonusManager.getBonusMultiplier(k, 'mausoleums', 'capacity');
  const mausoleumPowerMult = fragmentBonusManager.getBonusMultiplier(k, 'mausoleums', 'power');
  const capacity = Math.floor(mausoleums * perMausoleum * mausoleumCapacityMult * mausoleumPowerMult);
  const currentThralls = k.thralls;

  // Auto-population: 2% of capacity each turn
  if (currentThralls < capacity) {
    const regained = Math.max(1, Math.floor(capacity * 0.02));
    updates.thralls = Math.min(capacity, currentThralls + regained);
    events.push({
      type: "system",
      message: `🪦 Mausoleum: ${regained.toLocaleString()} new Thrall${regained === 1 ? '' : 's'} ${regained === 1 ? 'was' : 'were'} attracted to the crypts. (${updates.thralls}/${capacity})`,
    });
  }

  // Thralls don't earn XP passively here, they gain it through combat
  return updates;
}

// ── Library processing — runs each turn ──────────────────────────────────────
function processLibrary(k, events) {
  const updates = {};
  const libs = k.bld_libraries;
  if (libs === 0) return updates;

  let alloc = {};
  try {
    alloc = safeJsonParse(k.library_allocation, {}, "auto:library_allocation");
  } catch {
    alloc = {};
  }
  let progress = {};
  try {
    progress = safeJsonParse(k.library_progress, {}, "auto:library_progress");
  } catch {
    progress = {};
  }

  // Fallback for old schema
  if (alloc.scribe_craft) {
    alloc[alloc.scribe_craft] = alloc.scribe_target || 999;
    delete alloc.scribe_craft;
    delete alloc.scribe_target;
  }

  // Library upgrades
  let libUpgrades = {};
  try {
    libUpgrades = safeJsonParse(k.library_upgrades, {}, "auto:library_upgrades");
  } catch {}
  const capacityPerLib = 20;
  const scribeSpeedMult = raceBonus(k, "scribe"); // Or similar? I will look up how other racial modifiers are done. Let's look at raceBonus.
  const libraryWorkSpeedMult = fragmentBonusManager.getBonusMultiplier(k, 'libraries', 'decoding_speed');

  const capacity = libs * capacityPerLib;
  const effectiveScribes = Math.min(k.scribes, capacity);

  // Level multipliers
  const scribeLvlMult = unitLevelMult(k, "scribes");

  let activeTasks = Object.keys(alloc).filter(
    (t) => (alloc[t] || 0) > 0 && SCRIBE_ITEMS[t],
  );

  if (effectiveScribes > 0 && activeTasks.length > 0) {
    let totalAllocated = activeTasks.reduce(
      (sum, t) => sum + (Number(alloc[t]) || 0),
      0,
    );

    // Scale down if allocating more scribes than available
    let scale = 1.0;
    if (totalAllocated > effectiveScribes) {
      scale = effectiveScribes / totalAllocated;
    }

    activeTasks.forEach((task) => {
      const effective = (Number(alloc[task]) || 0) * scale;
      if (effective <= 0) return;

      const req = SCRIBE_ITEMS[task];
      const progressKey = "scribe_" + task;
      let disc = {};
      try {
        disc = JSON.parse(
          updates.discovered_kingdoms || k.discovered_kingdoms || "{}",
        );
      } catch {}

      if (task === "location_map") {
        const unmapped = Object.keys(disc).filter(
          (id) => disc[id].found && !disc[id].mapped,
        );
        if (unmapped.length === 0) {
          // "Mapped all known locations" is only true if any were ever
          // known — with zero discovered kingdoms it's really "nothing to
          // map yet", a different situation that reads as a false claim of
          // completion (0 known != 0 unmapped). This is expected to
          // self-resolve as soon as a new kingdom is discovered later the
          // same turn (scouting runs after this in processTurn) or on a
          // subsequent turn — not a stuck state, just this turn's snapshot.
          const totalKnown = Object.keys(disc).filter((id) => disc[id].found).length;
          events.push({
            type: "system",
            message: totalKnown === 0
              ? `⚠️ Scribes paused location mapping — no kingdoms discovered yet.`
              : `⚠️ Scribes paused location mapping — you have mapped all currently known locations!`,
          });
          return;
        }
        if ((updates.maps !== undefined ? updates.maps : k.maps) < 2) {
          events.push({
            type: "system",
            message: `⚠️ Scribes paused location mapping — you need at least 2 maps (one to keep) to continue automation.`,
          });
          return;
        }
      } else if (task === "hybrid_blueprint") {
        let frags = [];
        try {
          frags = JSON.parse(
            updates.world_fragments || k.world_fragments || "[]",
          );
        } catch {}
        if (frags.length === 0 || !frags.some((f) => f.studied)) {
          events.push({
            type: "system",
            message: `⚠️ Scribes paused Hybrid Blueprint research — no studied World Fragments available!`,
          });
          return;
        }
      } else if (task === "study_fragment") {
        let frags = [];
        try {
          frags = JSON.parse(
            updates.world_fragments || k.world_fragments || "[]",
          );
        } catch {}
        if (frags.length === 0 || !frags.some((f) => !f.studied)) {
          events.push({
            type: "system",
            message: `⚠️ Scribes paused Fragment studying — no unstudied World Fragments available!`,
          });
          return;
        }
      }

      const workDone =
        (effective / req.scribes) * scribeLvlMult * scribeSpeedMult * libraryWorkSpeedMult;
      let newProg = (progress[progressKey] || 0) + workDone;

      let itemsCompleted = 0;
      while (newProg >= req.turns) {
        if (task === "map") {
          updates.maps =
            (updates.maps !== undefined ? updates.maps : k.maps) + 1;
          itemsCompleted++;
        } else if (task === "location_map") {
          const unmapped = Object.keys(disc).filter(
            (id) => disc[id].found && !disc[id].mapped,
          );
          if (unmapped.length === 0) break;
          if ((updates.maps !== undefined ? updates.maps : k.maps) < 1)
            break;
          const targetId =
            unmapped[Math.floor(Math.random() * unmapped.length)];
          disc[targetId].mapped = true;
          updates.discovered_kingdoms = JSON.stringify(disc);
          updates.maps =
            (updates.maps !== undefined ? updates.maps : k.maps) - 1;
          const targetName = disc[targetId].name || "an unknown kingdom";
          events.push({
            type: "system",
            message: `📍 Your scribes mapped a new location! You may now interact with ${targetName}.`,
          });
          itemsCompleted++;
        } else if (task === "hybrid_blueprint") {
          let frags = [];
          try {
            frags = JSON.parse(
              updates.world_fragments || k.world_fragments || "[]",
            );
          } catch {}
          const studiedIndexes = frags
            .map((f, i) => (f.studied ? i : -1))
            .filter((i) => i !== -1);
          if (studiedIndexes.length === 0) break;

          let hbp = {};
          try {
            hbp = JSON.parse(
              updates.hybrid_blueprints || k.hybrid_blueprints || "{}",
            );
          } catch {}
          const fragIndex =
            studiedIndexes[Math.floor(Math.random() * studiedIndexes.length)];
          const frag = frags.splice(fragIndex, 1)[0].type;
          updates.world_fragments = JSON.stringify(frags);

          const buildings = [
            "farms",
            "barracks",
            "markets",
            "schools",
            "mage_towers",
            "shrines",
            "guard_towers",
            "castles",
            "smithies",
            "libraries",
          ];
          const targetBld =
            buildings[Math.floor(Math.random() * buildings.length)];

          hbp[frag + "_" + Date.now()] = {
            fragment: frag,
            building: targetBld,
            assigned: false,
          };
          updates.hybrid_blueprints = JSON.stringify(hbp);
          events.push({
            type: "system",
            message: `✨ Your scribes fully conceptualized a ${frag} and devised a Hybrid Blueprint for ${targetBld.replace(/_/g, " ")}!`,
          });
          itemsCompleted++;
        } else if (task === "study_fragment") {
          let frags = [];
          try {
            frags = JSON.parse(
              updates.world_fragments || k.world_fragments || "[]",
            );
          } catch {}
          const unstudiedIndexes = frags
            .map((f, i) => (!f.studied ? i : -1))
            .filter((i) => i !== -1);
          if (unstudiedIndexes.length === 0) break;

          const fragIndex =
            unstudiedIndexes[
              Math.floor(Math.random() * unstudiedIndexes.length)
            ];
          const oldFrag = frags[fragIndex];
          const type =
            typeof oldFrag === "string"
              ? oldFrag
              : oldFrag.type || "Unknown Fragment";
          frags[fragIndex] = { type: type, studied: true };
          updates.world_fragments = JSON.stringify(frags);
          events.push({
            type: "system",
            message: `🧪 Your scribes successfully studied a World Fragment, revealing it to be a ${type}!`,
          });
          itemsCompleted++;
        } else if (task === "certified_blueprint") {
          updates.certified_blueprints_stored =
            (updates.certified_blueprints_stored !== undefined
              ? updates.certified_blueprints_stored
              : k.certified_blueprints_stored) + 1;
          itemsCompleted++;
        } else if (task === "fortified_blueprint") {
          let fortifiedCount =
            updates.fortified_blueprints !== undefined
              ? updates.fortified_blueprints
              : k.fortified_blueprints;
          updates.fortified_blueprints = fortifiedCount + 1;
          itemsCompleted++;
        } else {
          updates.blueprints_stored =
            (updates.blueprints_stored !== undefined
              ? updates.blueprints_stored
              : k.blueprints_stored) + 1;
          itemsCompleted++;
        }

        newProg -= req.turns;
      }

      if (itemsCompleted > 0) {
        updates._libraryCraftedItems = updates._libraryCraftedItems || {};
        updates._libraryCraftedItems[task] =
          (updates._libraryCraftedItems[task] || 0) + itemsCompleted;
        const sXp = awardTroopXp(
          { ...k, troop_levels: updates.troop_levels || k.troop_levels },
          "scribes",
          15 * itemsCompleted,
        );
        updates.troop_levels = sXp.troop_levels;
      }

      progress[progressKey] = newProg;

      if (workDone > 0) {
        if (!updates._scribe_estimates) updates._scribe_estimates = [];
        const pct = Math.floor((progress[progressKey] / req.turns) * 100);
        const turnsLeft = Math.ceil(
          (req.turns - progress[progressKey]) / workDone,
        );
        const displayTask = task.replace(/_/g, " ");
        updates._scribe_estimates.push(
          `${displayTask} (${pct}%, ${turnsLeft} turns left)`,
        );
      }
    });

    if (updates._libraryCraftedItems) {
      let msgParts = [];
      for (const [task, count] of Object.entries(
        updates._libraryCraftedItems,
      )) {
        if (task === "map") {
          msgParts.push(`${count} map(s)`);
        } else if (task === "certified_blueprint") {
          msgParts.push(`${count} Certified Blueprint(s)`);
        } else if (task === "fortified_blueprint") {
          msgParts.push(`${count} Fortified Blueprint(s)`);
        } else if (task === "blueprint") {
          msgParts.push(`${count} blueprint(s)`);
        } else {
          msgParts.push(`${count} ${task.replace(/_/g, " ")}`);
        }
      }
      events.push({
        type: "system",
        message: `📚 Your scribes drafted in the Library: ${msgParts.join(", ")}.`,
      });
      delete updates._libraryCraftedItems;
    }

    if (updates._scribe_estimates && updates._scribe_estimates.length > 0) {
      events.push({
        type: "system",
        message: `📚 Library Est: ${updates._scribe_estimates.join(" · ")}.`,
      });
      delete updates._scribe_estimates;
    }
  }

  updates.library_progress = JSON.stringify(progress);

  if (libUpgrades.surveyors_eyrie && Math.random() < 0.2) {
    updates._find_kingdom_surveyor = true;
  }

  return updates;
}


module.exports = {
  manaPerTurn,
  validateSpellTarget,
  castSpell,
  processMageTower,
  processShrine,
  processMausoleum,
  processLibrary,
};
