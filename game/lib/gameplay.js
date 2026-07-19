// game/lib/gameplay.js
// Gameplay mechanics: unit hiring, upgrade purchasing, mercenary management, active effects, and adventure rewards.
// Pure functions for kingdom state mutations during gameplay actions.

const config = require('../config');
const { safeJsonParse, roll, rand } = require('../../utils/helpers');
const { unitLevelMult, effectiveTroopLevel, diluteTroopXp, awardTroopXp } = require('./troops');
const { getCap, calcDiscoveryChance, repairMojibake, cleanNewsEvent } = require('./data-transformations');
const fragmentBonusManager = require('../fragment-bonus-manager');
const { checkAchievements } = require('./achievements');
const { addItemToInventory } = require('./items');
const { awardXp } = require('../xp');

const {
  MERC_TIERS,
  FARM_UPGRADES,
  GRANARY_UPGRADES,
  MARKET_UPGRADES,
  TAVERN_UPGRADES,
  TOWER_UPGRADES,
  SCHOOL_UPGRADES,
  SHRINE_UPGRADES,
  MAUSOLEUM_UPGRADES,
  LIBRARY_UPGRADES,
  WALL_UPGRADES,
  TOWER_DEF_UPGRADES,
  OUTPOST_UPGRADES,
  BANK_UPGRADES,
  UNIT_COST,
  INVENTORY_ITEMS,
  JUNK_PRIZES,
  EXPEDITION_TURNS,
  ULTRA_RARE_PRIZES,
  THRONE_OF_NAZDREG,
  WORLD_FRAGMENTS,
} = config;

function processMercenaries(k, events) {
  const updates = {};
  const mercs = safeJsonParse(
    k.mercenaries,
    [],
    "processMercenaries:mercenaries",
  );
  if (!mercs.length) return updates;

  const currentTurn = k.turn;
  let gold = k.gold;
  const active = [];
  let totalUpkeepPaid = 0;

  for (const m of mercs) {
    const served = currentTurn - (m.hired_at_turn || 0);
    const upkeep = m.upkeep_per_turn || 0;
    if (served >= m.duration_turns) {
      updates[m.unit_type] = Math.max(
        0,
        (updates[m.unit_type] ?? (k[m.unit_type] || 0)) - m.count,
      );
      events.push({
        type: "system",
        message: `⚔️ ${m.count} ${m.tier} ${m.unit_type} completed their contract and departed.`,
      });
    } else if (gold >= upkeep) {
      gold -= upkeep;
      totalUpkeepPaid += upkeep;
      active.push(m);
    } else {
      updates[m.unit_type] = Math.max(
        0,
        (updates[m.unit_type] ?? (k[m.unit_type] || 0)) - m.count,
      );
      events.push({
        type: "system",
        message: `⚔️ ${m.count} ${m.tier} ${m.unit_type} left — upkeep unpaid.`,
      });
    }
  }

  if (totalUpkeepPaid > 0) {
    events.push({
      type: "system",
      message: `⚔️ Mercenary upkeep: -${totalUpkeepPaid.toLocaleString()} gold.`,
    });
  }

  updates.mercenaries = JSON.stringify(active);
  updates.gold = gold;
  return updates;
}

function hireMercenaries(k, unitType, tier, count) {
  const tierDef = MERC_TIERS[tier];
  if (!tierDef) return { error: "Invalid tier" };
  const tavUpgrades = safeJsonParse(
    k.tavern_upgrades,
    {},
    "hireMercenaries:tavern_upgrades",
  );
  if (tierDef.requires && !tavUpgrades[tierDef.requires])
    return { error: `Requires ${tierDef.requires.replace("_", " ")} upgrade` };
  if (!(k.bld_taverns > 0)) return { error: "Need at least 1 tavern" };

  const level =
    tierDef.levelMin +
    Math.floor(Math.random() * (tierDef.levelMax - tierDef.levelMin + 1));
  const cost = tierDef.costPer * count;
  const upkeep = Math.ceil((cost * tierDef.upkeepPct) / tierDef.duration);
  if (k.gold < cost)
    return { error: `Need ${cost.toLocaleString()} gold` };

  const mercs = safeJsonParse(k.mercenaries, [], "hireMercenaries:mercenaries");
  mercs.push({
    unit_type: unitType,
    tier,
    level,
    count,
    hired_at_turn: k.turn,
    duration_turns: tierDef.duration,
    upkeep_per_turn: upkeep,
  });

  return {
    updates: {
      gold: k.gold - cost,
      [unitType]: (k[unitType] || 0) + count,
      mercenaries: JSON.stringify(mercs),
    },
    hired: {
      tier,
      level,
      count,
      unitType,
      duration: tierDef.duration,
      upkeep,
      cost,
    },
  };
}

function purchaseUpgrade(k, category, upgradeKey) {
  category = (category || "").toLowerCase();
  const defs = {
    farm: FARM_UPGRADES,
    granary: GRANARY_UPGRADES,
    market: MARKET_UPGRADES,
    tavern: TAVERN_UPGRADES,
    tower: TOWER_UPGRADES,
    school: SCHOOL_UPGRADES,
    shrine: SHRINE_UPGRADES,
    mausoleum: MAUSOLEUM_UPGRADES,
    library: LIBRARY_UPGRADES,
    wall: WALL_UPGRADES,
    tower_def: TOWER_DEF_UPGRADES,
    outpost: OUTPOST_UPGRADES,
    bank: BANK_UPGRADES,
  }[category];
  if (!defs) return { error: "Invalid category" };
  const def = defs[upgradeKey];
  if (!def) return { error: "Invalid upgrade" };
  const colName = `${category}_upgrades`;
  const upgrades = safeJsonParse(k[colName], {}, `purchaseUpgrade:${colName}`);
  if (upgrades[upgradeKey]) return { error: "Already purchased" };
  if (def.requires && !upgrades[def.requires])
    return { error: `Requires ${def.requires.replace(/_/g, " ")} first` };
  if (def.raceOnly && k.race !== def.raceOnly)
    return { error: `Only available to ${def.raceOnly.replace(/_/g, " ")}` };
  if (k.gold < def.cost)
    return { error: `Need ${def.cost.toLocaleString()} gold` };

  // Check resource costs
  const costWood = def.costWood || 0;
  const costStone = def.costStone || 0;
  const costIron = def.costIron || 0;

  const currentWood = k.wood || 0;
  const currentStone = k.stone || 0;
  const currentIron = k.iron || 0;

  const shortWood = Math.max(0, costWood - currentWood);
  const shortStone = Math.max(0, costStone - currentStone);
  const shortIron = Math.max(0, costIron - currentIron);

  const shortages = [];
  if (shortWood > 0) shortages.push(`${shortWood.toLocaleString()} more wood`);
  if (shortStone > 0) shortages.push(`${shortStone.toLocaleString()} more stone`);
  if (shortIron > 0) shortages.push(`${shortIron.toLocaleString()} more iron`);

  if (shortages.length > 0) {
    return { error: `Need ${shortages.join(", ")}` };
  }

  const bldCheck = {
    farm: "bld_farms",
    market: "bld_markets",
    tavern: "bld_taverns",
    tower: "bld_mage_towers",
    school: "bld_schools",
    shrine: "bld_shrines",
    mausoleum: "bld_mausoleums",
    library: "bld_libraries",
    bank: "bld_vaults",
    wall: "bld_walls",
    tower_def: "bld_guard_towers",
    outpost: "bld_outposts",
  };
  if (bldCheck[category] && !((k[bldCheck[category]] || 0) > 0))
    return { error: `Need at least 1 ${category}` };
  if (def.reqVaults && k.bld_vaults < def.reqVaults)
    return {
      error: `Need at least ${def.reqVaults} Vaults for this bank upgrade.`,
    };

  upgrades[upgradeKey] = true;
  return {
    updates: {
      gold: k.gold - def.cost,
      ...(costWood > 0 ? { wood: currentWood - costWood } : {}),
      ...(costStone > 0 ? { stone: currentStone - costStone } : {}),
      ...(costIron > 0 ? { iron: currentIron - costIron } : {}),
      [colName]: JSON.stringify(upgrades),
    },
  };
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
  if (amount <= 0) return { error: "Amount must be positive" };

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

function junkPrize(k, updates) {
  if (!JUNK_PRIZES || JUNK_PRIZES.length === 0)
    return "a particularly shiny pebble";
  const eventsCollected = safeJsonParse(
    updates.collected_events || k.collected_events,
    [],
    "junkPrize",
  );
  const lastId = updates.last_event_id || k.last_event_id;

  let available = JUNK_PRIZES.filter((p) => p.id !== lastId);
  if (available.length === 0) available = JUNK_PRIZES;
  const ev = available[Math.floor(Math.random() * available.length)];

  if (ev) {
    if (!eventsCollected.includes(ev.id)) {
      eventsCollected.push(ev.id);
      updates.collected_events = JSON.stringify(eventsCollected);

      if (eventsCollected.length >= 50) {
        updates._collector_unlocked = true;
      }
    }
    updates.last_event_id = ev.id;

    // Add item to inventory
    let inventory = safeJsonParse(updates.items || k.items, [], "junkPrize:items");
    if (!Array.isArray(inventory)) inventory = [];

    const existingItem = inventory.find((i) => i.id === ev.id);
    if (existingItem) {
      existingItem.qty = (existingItem.qty || 0) + 1;
    } else {
      // Get item name from INVENTORY_ITEMS if available
      const itemDef = INVENTORY_ITEMS?.[ev.id];
      inventory.push({ id: ev.id, name: itemDef?.name || ev.id, qty: 1 });
    }
    updates.items = JSON.stringify(inventory);

    // Check for 100 suspicious rocks achievement (only trigger once)
    if (ev.id === "suspicious_rock") {
      const rockCount = (existingItem?.qty || 0) + 1;
      if (rockCount >= 100) {
        let achievements = safeJsonParse(updates.achievements || k.achievements, [], "junkPrize:achievements");
        if (!achievements.includes("suspicious_rocks_100")) {
          achievements.push("suspicious_rocks_100");
          updates.achievements = JSON.stringify(achievements);
          updates.stone = (updates.stone ?? k.stone ?? 0) + 1000;
          updates._suspicious_rocks_achievement = true;
        }
      }
    }

    return ev.msg || ev.content || "a mysterious rock";
  }
  return "a strange pebble";
}

function expeditionRewards(type, rangers, fighters, k, db, originalRewards) {
  const tacBonus = 1 + k.res_military / 2000;

  // Race exploration bonus — affects all reward quantities
  const exploreBonus =
    {
      dire_wolf: 1.4,
      dark_elf: 1.25,
      human: 1.1,
      orc: 1.05,
      dwarf: 0.9,
      high_elf: 0.95,
    }[k.race] || 1.0;

  // Ranger level bonus — higher level rangers are better scouts
  const rangerLvBonus = unitLevelMult(k, "rangers");

  // Attrition reduced for skilled explorer races
  const attritionMult = { dire_wolf: 0.5, dark_elf: 0.6 }[k.race] || 1.0;
  const rewards = [];
  const events = [];
  const updates = {};

  // Attrition — skilled explorer races lose fewer rangers. Mountain runs its
  // own full multi-turn attrition simulation further down and overwrites
  // _rangers_returned unconditionally, so this generic calc is skipped for
  // it entirely rather than pushing a reward line whose number never
  // actually applies.
  if (type !== "mountain") {
    const attritionPct = type === "dungeon" ? rand(0, 3) : rand(0, 2);
    const lost = Math.floor(((rangers * attritionPct) / 100) * attritionMult);
    const returned = rangers - lost;
    if (lost > 0)
      rewards.push({
        text: `${lost} ranger${lost > 1 ? "s" : ""} did not return from the expedition`,
      });
    // Rangers returned stored separately so resolveExpeditions can use SQL increment
    updates._rangers_returned = returned;
  }

  const expTurns = EXPEDITION_TURNS[type] || 10;

  // Gold base = forage rate (rangers × 12 × tacBonus) × turns × race bonus × random 5–30% bonus
  const foragePerTurn = rangers * 2 * tacBonus * exploreBonus * rangerLvBonus;
  const randomBonus = 1 + rand(5, 30) / 100;
  const goldBase = Math.floor(foragePerTurn * expTurns * randomBonus);

  if (type === "scout") {
    rewards.push({ text: `+${goldBase.toLocaleString()} gold from foraging` });
    updates.gold = k.gold + goldBase;

    // Resource Yield: Wood
    const rollWood = Math.random() * 100;
    let woodGained = 0;
    if (rollWood < 0.5) {
      woodGained = 25;
    } else if (rollWood < 5.5) {
      woodGained = 5;
    } else if (rollWood < 30.5) {
      woodGained = 2;
    } else if (rollWood < 80.5) {
      woodGained = 1;
    }

    if (woodGained > 0) {
      updates.wood = (updates.wood !== undefined ? updates.wood : k.wood || 0) + woodGained;
      rewards.push({ text: `🪵 +${woodGained} wood discovered` });
    }

    const land = Math.max(
      1,
      Math.floor(rand(rangers * 0.01, rangers * 0.03) * exploreBonus),
    );
    rewards.push({
      text: `+${land} acre${land > 1 ? "s" : ""} of unclaimed land`,
    });
    updates.land = k.land + land;

    if (roll(0.3)) {
      const mana = rand(
        Math.floor(rangers * 0.2 * exploreBonus),
        Math.floor(rangers * 0.8 * exploreBonus),
      );
      rewards.push({ text: `+${mana.toLocaleString()} mana from a hidden shrine` });
      updates.mana = k.mana + mana;
    }
    if (roll(0.1)) {
      const troops = rand(
        2,
        Math.max(3, Math.floor(rangers * 0.02 * exploreBonus)),
      );
      if (k.race === "vampire") {
        rewards.push({
          text: `Your troops captured ${troops} wandering souls and bound them as Thralls`,
        });
        updates.clerics = k.clerics + troops;
      } else {
        rewards.push({
          text: `${troops} wandering fighter${troops > 1 ? "s" : ""} pledge allegiance to your kingdom`,
        });
        updates.fighters = k.fighters + troops;
      }
    }
    if (roll(0.03)) {
      const bonus = rand(
        Math.floor(rangers * 0.03 * exploreBonus),
        Math.floor(rangers * 0.08 * exploreBonus),
      );
      rewards.push({
        text: `An ancient map reveals ${bonus} additional acres — scouts claim them!`,
      });
      updates.land = (updates.land || k.land) + bonus;
    }
    if (roll(0.45))
      rewards.push({
        text: `Your rangers also found ${junkPrize(k, updates)}`,
      });

    // Map drop — 5% chance on scout
    if (roll(0.05)) {
      updates.maps = k.maps + 1;
      rewards.push({
        text: `🗺️ A map was found — you can now interact with other kingdoms`,
      });
    }

    // DISCOVERY: Chance to find another kingdom
    if (roll(calcDiscoveryChance(k))) {
      updates._find_kingdom = true;
    }
  } else if (type === "deep" || type === "epic-trek") {
    const goldSource = type === "epic-trek" ? "along the expedition path" : "from deep wilderness caches";
    rewards.push({
      text: `+${goldBase.toLocaleString()} gold ${goldSource}`,
    });
    updates.gold = k.gold + goldBase;

    // Resource Yield: Wood and Stone
    const rollDeep = Math.random() * 100;
    let deepWood = 0;
    let deepStone = 0;
    if (rollDeep < 0.5) {
      deepWood = 25;
      deepStone = 25;
    } else if (rollDeep < 5.5) {
      deepWood = 5;
      deepStone = 5;
    } else if (rollDeep < 30.5) {
      deepWood = 2;
      deepStone = 2;
    } else if (rollDeep < 80.5) {
      deepWood = 1;
      deepStone = 1;
    }

    if (deepWood > 0) {
      updates.wood = (updates.wood !== undefined ? updates.wood : k.wood || 0) + deepWood;
      updates.stone = (updates.stone !== undefined ? updates.stone : k.stone || 0) + deepStone;
      rewards.push({ text: `+${deepWood} wood and ?? +${deepStone} stone unearthed` });
    }

    const land = Math.max(
      2,
      Math.floor(rand(rangers * 0.04, rangers * 0.1) * exploreBonus),
    );
    rewards.push({ text: `+${land} acres of fertile territory` });
    updates.land = k.land + land;

    if (roll(0.55)) {
      const mana = rand(
        Math.floor(rangers * 0.5 * exploreBonus),
        Math.floor(rangers * 2 * exploreBonus),
      );
      rewards.push({
        text: `+${mana.toLocaleString()} mana from ley lines discovered deep in the wilderness`,
      });
      updates.mana = k.mana + mana;
    }
    if (roll(0.25)) {
      const disc = [
        "res_economy",
        "res_weapons",
        "res_armor",
        "res_military",
        "res_entertainment",
      ][rand(0, 4)];
      const boost = rand(1, Math.max(2, Math.floor(5 * exploreBonus)));
      const discLabel = disc.replace("res_", "").replace("_", " ");
      rewards.push({
        text: `A research scroll found ? ${discLabel} +${boost}%`,
      });
      updates[disc] = (k[disc] || 0) + boost;
    }
    if (roll(0.2)) {
      const troops = rand(
        Math.floor(rangers * 0.03 * exploreBonus),
        Math.floor(rangers * 0.08 * exploreBonus),
      );
      const ttype = roll(0.5) ? "fighters" : "rangers";
      if (troops > 0) {
        if (k.race === "vampire") {
          rewards.push({
            text: `${troops} mercenaries were subdued and turned into Thralls`,
          });
          updates.clerics = k.clerics + troops;
        } else {
          rewards.push({
            text: `${troops} mercenary ${ttype} join your cause`,
          });
          updates[ttype] = (k[ttype] || 0) + troops;
        }
      }
    }
    if (roll(0.08)) {
      const bonus = rand(
        Math.floor(rangers * 0.05 * exploreBonus),
        Math.floor(rangers * 0.15 * exploreBonus),
      );
      rewards.push({
        text: `Ruins of an abandoned kingdom found ? you claim ${bonus} acres of its former territory`,
      });
      updates.land = (updates.land || k.land) + bonus;
    }
    if (roll(0.02)) {
      const disc = [
        "res_spellbook",
        "res_attack_magic",
        "res_defense_magic",
        "res_war_machines",
        "res_construction",
      ][rand(0, 4)];
      const boost = rand(
        Math.floor(5 * exploreBonus),
        Math.floor(15 * exploreBonus),
      );
      const discLabel = disc.replace("res_", "").replace("_", " ");
      rewards.push({
        text: `⚡ An ancient artifact of ${discLabel} — permanent +${boost}%`,
      });
      updates[disc] = (k[disc] || 0) + boost;
    }

    if (roll(calcDiscoveryChance(k))) {
      updates._find_kingdom = true;
    }
    if (roll(0.6))
      rewards.push({
        text: `Hidden deep in the wilderness, your rangers also discovered ${junkPrize(k, updates)}`,
      });

    // Map drop — 15% chance on deep
    if (roll(0.15)) {
      updates.maps = (updates.maps || k.maps) + 1;
      rewards.push({ text: `🗺️ A map was discovered in the deep wilderness` });
    }

    if (roll(0.05)) {
      updates._find_world_fragment = true;
    }
  } else if (type === "dungeon") {
    const power = (rangers + fighters * 2) * tacBonus * exploreBonus;
    const successChance = Math.min(0.9, 0.25 + power / 24000);
    const success = roll(successChance);

    if (!success) {
      const fLost = Math.min(
        fighters,
        rand(Math.floor(fighters * 0.05), Math.floor(fighters * 0.15)),
      );
      const fReturned = fighters - fLost;
      if (fReturned > 0) updates._fighters_returned = fReturned;
      rewards.push({
        text: `The dungeon proved too dangerous — ${fLost} fighters lost in retreat`,
      });
      events.push({
        type: "attack",
        message: `💀 Dungeon raid FAILED — your forces were overwhelmed. ${fLost.toLocaleString()} fighters lost.`,
      });
    } else {
      updates._fighters_returned = fighters;

      const dungeonMult =
        { orc: 2.0, dire_wolf: 1.5, high_elf: 0.5 }[k.race] || 1.0;

      const dungeonGold = Math.floor(
        fighters *
          rand(8, 12) *
          tacBonus *
          exploreBonus *
          randomBonus *
          dungeonMult,
      );
      rewards.push({
        text: `+${dungeonGold.toLocaleString()} gold plundered from the dungeon`,
      });
      updates.gold = k.gold + dungeonGold;

      // Resource Yield: Iron only (on success)
      const rollDungeon = Math.random() * 100;
      let ironGained = 0;
      if (rollDungeon < 0.5) {
        ironGained = 150;
      } else if (rollDungeon < 5.5) {
        ironGained = 50;
      } else if (rollDungeon < 30.5) {
        ironGained = 10;
      } else if (rollDungeon < 80.5) {
        ironGained = 2;
      }

      if (ironGained > 0) {
        updates.iron = (updates.iron !== undefined ? updates.iron : k.iron || 0) + ironGained;
        rewards.push({ text: `🔗 +${ironGained} iron plundered` });
      }

      const mana = Math.floor(
        rand(
          Math.floor(rangers * 1 * exploreBonus),
          Math.floor(rangers * 4 * exploreBonus),
        ) * dungeonMult,
      );
      rewards.push({ text: `+${mana.toLocaleString()} mana from dungeon ley stones` });
      updates.mana = k.mana + mana;

      const disc = [
        "res_weapons",
        "res_armor",
        "res_military",
        "res_attack_magic",
        "res_spellbook",
      ][rand(0, 4)];
      const boost = Math.floor(
        rand(3, Math.floor(12 * exploreBonus)) * dungeonMult,
      );
      const discLabel = disc.replace("res_", "").replace("_", " ");
      rewards.push({
        text: `Dungeon tome found — ${discLabel} permanently +${boost}%`,
      });
      updates[disc] = (k[disc] || 0) + boost;

      if (roll(0.12)) {
        const wm = Math.max(
          1,
          Math.floor(
            rand(1, Math.max(2, Math.floor((fighters / 500) * exploreBonus))) *
              dungeonMult,
          ),
        );
        rewards.push({
          text: `⚡ Ancient war machine${wm > 1 ? "s" : ""} recovered from the dungeon depths — +${wm}`,
        });
        updates.war_machines = k.war_machines + wm;
      }
      if (roll(0.06)) {
        const boost2 = Math.floor(
          rand(10, Math.floor(40 * exploreBonus)) * dungeonMult,
        );
        rewards.push({
          text: `⚡ The dungeon's heart pulsed with ancient magic — spellbook permanently +${boost2}`,
        });
        updates.res_spellbook =
          (updates.res_spellbook || k.res_spellbook) + boost2;
      }
      if (roll(0.5))
        rewards.push({
          text: `Amid the carnage, someone pocketed ${junkPrize(k, updates)}`,
        });

      // Map drop — 25% chance on dungeon
      if (roll(0.25)) {
        updates.maps = (updates.maps || k.maps) + 1;
        rewards.push({ text: `🗺️ A map was found among the dungeon spoils` });
      }
      // Blueprint drop — 20% chance on dungeon
      if (roll(0.2)) {
        const smithyCap = k.bld_smithies * 25;
        const curBP =
          updates.blueprints_stored !== undefined
            ? updates.blueprints_stored
            : k.blueprints_stored;
        if (smithyCap === 0 || curBP < smithyCap) {
          updates.blueprints_stored = curBP + 1;
          rewards.push({
            text: `⚙️ A blueprint was recovered from the dungeon depths`,
          });
        }
      }

      if (roll(0.1)) {
        updates._find_world_fragment = true;
      }
    }
  } else if (type === "mountain") {
    // Mountain Expedition: Rangers only, balanced high-risk/high-reward attrition
    const mountainMult = { dire_wolf: 0.8, human: 1.0, dwarf: 1.1 }[k.race] || 1.0;
    const rangerLevel = effectiveTroopLevel(k, "rangers");

    // Avalanche attrition per turn: random between 0 and level-based max (targeting ~75% total attrition)
    const expTurns = EXPEDITION_TURNS["mountain"] || 100;
    let totalArriving = rangers;
    const attritionLog = [];

    for (let turn = 1; turn <= expTurns; turn++) {
      // Determine max loss % based on ranger level. These per-turn caps look
      // small in isolation but compound multiplicatively across `expTurns`
      // (100) iterations — the previous 8/6/5/4% tiers compounded to
      // 87-98.5% average total attrition (verified by simulation), blowing
      // past the "~75%" target below. Recalibrated so the base (<=20) tier's
      // *compounded* average lands on ~75%, with higher tiers scaling down
      // proportionally for a meaningfully better survival rate.
      let maxLoss = 2.75;
      if (rangerLevel >= 21 && rangerLevel <= 30) maxLoss = 2.2;
      else if (rangerLevel >= 31 && rangerLevel <= 40) maxLoss = 1.8;
      else if (rangerLevel >= 41) maxLoss = 1.4;

      // Roll between 0 and maxLoss (always allows zero-loss outcome)
      const lossPercent = rand(0, maxLoss);
      const lostThisTurn = Math.ceil((totalArriving * lossPercent) / 100);
      totalArriving -= lostThisTurn;

      if (lostThisTurn > 0) {
        attritionLog.push(lostThisTurn);
      }
    }

    const survived = totalArriving;
    const totalLost = rangers - survived;
    const casualtyRate = (totalLost / rangers * 100).toFixed(1);

    if (totalLost > 0) {
      rewards.push({
        text: `Avalanches claimed ${totalLost.toLocaleString()} rangers (${casualtyRate}%) — ${survived.toLocaleString()} returned`,
      });
    } else {
      rewards.push({
        text: `Against the odds, all ${rangers.toLocaleString()} rangers navigated the mountain unscathed`,
      });
    }

    updates._rangers_returned = survived;

    // Apply casualty losses to kingdom ranger count
    updates.rangers = Math.max(0, (k.rangers || 0) - totalLost);

    // Mountain rewards only granted if rangers survived the expedition
    if (survived > 0) {
      // Gold scaled to troop count and level (200-500 per ranger)
      const goldPerRanger = rand(200, 500);
      const mountainGold = Math.floor(
        rangers * goldPerRanger * tacBonus * exploreBonus * mountainMult * (1 + rand(5, 30) / 100)
      );
      rewards.push({
        text: `+${mountainGold.toLocaleString()} gold from mountain artifacts`,
      });
      updates.gold = k.gold + mountainGold;

      // Mana from ley lines (scaled)
      const mountainMana = Math.floor(
        rand(rangers * 10, rangers * 50) * mountainMult * exploreBonus
      );
      rewards.push({
        text: `+${mountainMana.toLocaleString()} mana from ancient ley lines`,
      });
      updates.mana = k.mana + mountainMana;

      // Research boost from ancient knowledge (scaled)
      const res = ["res_weapons", "res_armor", "res_construction"][rand(0, 2)];
      const resBoost = Math.floor(rand(50, 150) * mountainMult);
      rewards.push({
        text: `Ancient runes revealed — ${res.replace("res_", "").replace("_", " ")} +${resBoost}`,
      });
      updates[res] = (k[res] || 0) + resBoost;

      // Junk prizes more frequent on mountain (60% chance per turn) — consolidated summary
      let junkCount = 0;
      for (let t = 0; t < expTurns; t++) {
        if (roll(0.6)) {
          junkPrize(k, updates);
          junkCount++;
        }
      }
      if (junkCount > 0) {
        rewards.push({
          text: `Rangers discovered ${junkCount} artifacts in the mountain passes`,
        });
      }
    }

    // No land rewards from mountain — focus purely on artifacts/magic
    // (explicitly 0 land)
  } else if (type === "hunting" || type === "prospecting") {
    if (type === "prospecting") {
      // Prospecting uses engineers, not rangers. Redirect returned troops to engineers.
      updates.engineers = (k.engineers || 0) + updates._rangers_returned;
      delete updates._rangers_returned;
    }
    // Hunting and Prospecting: Use pre-calculated rewards from expedition creation
    // These were computed in the endpoint and stored as JSON.stringify({ food/gold: amount })
    // The originalRewards parameter (if provided) contains this data
    // Don't generate new rewards—just preserve what was calculated at expedition start
    if (originalRewards) {
      try {
        const parsed = typeof originalRewards === "string" ? JSON.parse(originalRewards) : originalRewards;
        if (parsed.food !== undefined) {
          const foodAmount = Number(parsed.food) || 0;
          rewards.push({ text: `Rangers returned with ${foodAmount} food` });
          updates.food = (k.food || 0) + foodAmount;
        } else if (parsed.gold !== undefined) {
          const goldAmount = Number(parsed.gold) || 0;
          rewards.push({ text: `Prospectors returned with ${goldAmount} gold` });
          updates.gold = (k.gold || 0) + goldAmount;
        }
      } catch {
        // If we can't parse the original rewards, don't add a fallback message
        // The expedition will return troops but no rewards message will display
      }
    }
  }

  // ── Ultra-rare prizes ──────────────────────────────────────────────────
  // deep/epic-trek: 0.5%, dungeon success: 1%, mountain: 2.5% per turn (MAX 1 per expedition for mountain)
  const ultraChance = type === "dungeon" ? 0.01 : (type === "deep" || type === "epic-trek") ? 0.005 : type === "mountain" ? 0.025 : 0;

  // For mountain expeditions, track if we already got an ultra-rare during the 100 turns
  if (type === "mountain" && updates._rangers_returned > 0) {
    let ultraRareObtained = false;
    const mountainUltraRares = ULTRA_RARE_PRIZES.filter(p =>
      ["iceflow_crown", "snowpeak_chalice", "frostbind_amulet", "avalanche_heart", "stormcaller_gem"].includes(p.id)
    );
    for (let turn = 1; turn <= (EXPEDITION_TURNS["mountain"] || 100); turn++) {
      if (!ultraRareObtained && roll(ultraChance)) {
        if (mountainUltraRares.length > 0) {
          const prize = mountainUltraRares[Math.floor(Math.random() * mountainUltraRares.length)];
          prize.effect(k, updates);
          rewards.push({ text: `ULTRA RARE: ${prize.text}` });

          // Add ultra-rare item to inventory
          let inventory = safeJsonParse(updates.items || k.items, [], "expeditionRewards:ultra_rare_items");
          if (!Array.isArray(inventory)) inventory = [];
          const itemDef = INVENTORY_ITEMS?.[prize.id];
          addItemToInventory(inventory, prize.id, itemDef?.name || prize.id, 1);
          updates.items = JSON.stringify(inventory);

          ultraRareObtained = true; // Prevent more ultra-rares this expedition
        }
      }
    }
  } else if (ultraChance > 0 && roll(ultraChance)) {
    // Non-mountain expeditions: regular ultra-rare drop (can be multiple)
    const prize =
      ULTRA_RARE_PRIZES[Math.floor(Math.random() * ULTRA_RARE_PRIZES.length)];
    prize.effect(k, updates);
    rewards.push({ text: `ULTRA RARE: ${prize.text}` });

    // Add ultra-rare item to inventory
    let inventory = safeJsonParse(updates.items || k.items, [], "expeditionRewards:ultra_rare_items");
    if (!Array.isArray(inventory)) inventory = [];
    const itemDef = INVENTORY_ITEMS?.[prize.id];
    addItemToInventory(inventory, prize.id, itemDef?.name || prize.id, 1);
    updates.items = JSON.stringify(inventory);
  }

  // ── Throne of Nazdreg (0.1% on epic-trek/dungeon, unique forever) ────────────────
  const throneChance = (type === "epic-trek" || type === "dungeon") ? 0.001 : 0;
  if (throneChance > 0 && roll(throneChance)) {
    updates._check_throne = true; // resolveExpeditions will check server_state and apply if unclaimed
  }

  // ── Air Fragment (rare mountain drop, ~1-2% chance, only if rangers survive) ────────────────
  if (type === "mountain" && updates._rangers_returned > 0 && roll(0.015)) {
    // Add air fragment to inventory
    let inventory = safeJsonParse(updates.items || k.items, [], "expeditionRewards:air_fragment");
    if (!Array.isArray(inventory)) inventory = [];
    const itemDef = INVENTORY_ITEMS?.["air_fragment"];
    addItemToInventory(inventory, "air_fragment", itemDef?.name || "Air Fragment", 1);
    updates.items = JSON.stringify(inventory);
    rewards.push({
      text: `🌬️ An Air Fragment pulses with the fury of ancient storms — a collectible of immense power`,
    });
  }

  const preAchLength = events.length;
  checkAchievements(k, updates, events);
  for (let i = preAchLength; i < events.length; i++) {
    rewards.push({ text: events[i].message });
  }

  return {
    rewards: rewards.map((reward) =>
      reward && typeof reward === "object" && typeof reward.text === "string"
        ? { ...reward, text: repairMojibake(reward.text) }
        : reward,
    ),
    updates,
    events: events.map(cleanNewsEvent),
  };
}

/**
 * Resolve a dungeon/mountain expedition that completes instantly (Phase 4:
 * paid for with turns_stored rather than a real-time turns_left countdown).
 * Wraps expeditionRewards() with the same post-processing
 * game/engine.js's resolveExpeditions() applies for the async expedition
 * types (throne-of-Nazdreg atomic claim, world-fragment discovery, troop/
 * kingdom exploration XP) so dungeon/mountain get the same reward pipeline
 * instead of the bare "location discovered" message Phase 4 originally
 * shipped with.
 *
 * @param {object} db - Database connection (used for the throne atomic claim)
 * @param {object} k - Kingdom row, already reflecting the rangers/fighters/
 *   food/turns_stored deducted for this expedition
 * @param {'dungeon'|'mountain'} type
 * @param {number} rangers - Rangers sent
 * @param {number} fighters - Fighters sent (dungeon only; 0 for mountain)
 * @returns {Promise<{rewards: object[], events: object[], updates: object,
 *   rangersReturned: number, fightersReturned: number}>} `updates` excludes
 *   rangers/fighters — those come back as rangersReturned/fightersReturned
 *   for the caller to add back via a SQL increment (they were already fully
 *   deducted at launch, matching how the async flow partially refunds
 *   survivors on completion).
 */
async function resolveInstantExpedition(db, k, type, rangers, fighters) {
  const { rewards, updates, events } = expeditionRewards(type, rangers, fighters, k, db, null);

  // Throne of Nazdreg (dungeon only, 0.1% chance) — atomic claim: a single
  // conditional insert decides the winner across concurrent completions.
  if (updates._check_throne) {
    delete updates._check_throne;
    const claim = await db.run(
      "INSERT INTO server_state (key, value) VALUES ('throne_found', '1') ON CONFLICT (key) DO NOTHING",
    );
    if (claim && claim.changes === 1) {
      THRONE_OF_NAZDREG.effect(k, updates);
      rewards.unshift({ text: THRONE_OF_NAZDREG.text });
      events.push({
        type: "system",
        message: `${k.name} has found the Throne of Nazdreg Grishnak. May his memory endure forever.`,
      });
    }
  }

  // World Fragment (dungeon only, 10% chance)
  if (updates._find_world_fragment) {
    delete updates._find_world_fragment;
    let frags = [];
    try {
      frags = safeJsonParse(k.world_fragments, [], "auto:world_fragments");
    } catch {}
    const frag = WORLD_FRAGMENTS[Math.floor(Math.random() * WORLD_FRAGMENTS.length)];
    frags.push(frag);
    updates.world_fragments = JSON.stringify(frags);
    rewards.push({ text: `Your rangers recovered a World Fragment: ${frag}` });
    events.push({
      type: "system",
      message: `A World Fragment (${frag}) was discovered during the expedition.`,
    });
  }

  // Troop XP + kingdom exploration XP — matches engine.js resolveExpeditions'
  // award amounts for these two types exactly.
  const expXpAmount = { dungeon: 40, mountain: 100 }[type] || 0;
  if (expXpAmount > 0) {
    const rXp = awardTroopXp(k, "rangers", expXpAmount * rangers);
    updates.troop_levels = rXp.troop_levels;
    if (type === "dungeon" && fighters > 0) {
      const fXp = awardTroopXp({ ...k, troop_levels: updates.troop_levels }, "fighters", 40 * fighters);
      updates.troop_levels = fXp.troop_levels;
    }
  }
  const kingdomXpBase = { dungeon: 8, mountain: 20 }[type] || 0;
  if (kingdomXpBase > 0) {
    const kingdomXp = awardXp(k, "exploration", kingdomXpBase * (rangers + (fighters || 0)));
    updates.xp = kingdomXp.xp;
    updates.level = kingdomXp.level;
    updates.xp_sources = JSON.stringify(kingdomXp.xp_sources);
    if (kingdomXp.events.length > 0) events.push(...kingdomXp.events);
  }

  // expeditionRewards()'s mountain branch also sets an absolute `updates.rangers`
  // (= k.rangers - totalLost) alongside _rangers_returned. Applying both would
  // subtract the lost rangers twice for any kingdom with more total rangers
  // than it sent (k.rangers here already excludes the sent troops, deducted at
  // launch) — the async engine.js path this was written for currently can
  // never receive a dungeon/mountain row (Phase 4 always intercepts them
  // first), so this has no live effect there today, but reconnecting it here
  // would make the bug real again. Drop the absolute value; the increment
  // below is the correct one.
  delete updates.rangers;
  delete updates.fighters;
  const rangersReturned = updates._rangers_returned !== undefined ? updates._rangers_returned : 0;
  const fightersReturned = updates._fighters_returned !== undefined ? updates._fighters_returned : 0;
  delete updates._rangers_returned;
  delete updates._fighters_returned;

  return {
    rewards: rewards.map((reward) =>
      reward && typeof reward === "object" && typeof reward.text === "string"
        ? { ...reward, text: repairMojibake(reward.text) }
        : reward,
    ),
    events: events.map(cleanNewsEvent),
    updates,
    rangersReturned,
    fightersReturned,
  };
}

function processActiveEffects(k, events) {
  let effects = {};
  try {
    effects = safeJsonParse(k.active_effects, {}, "auto:active_effects");
  } catch {
    effects = {};
  }
  if (Object.keys(effects).length === 0) return {};

  const updates = {};
  const expired = [];

  for (const [effect, data] of Object.entries(effects)) {
    const remaining = (data.turns_left || 1) - 1;
    if (remaining <= 0) {
      expired.push(effect);
      events.push({
        type: "system",
        message: `The ${effect.replace("_", " ")} effect on your kingdom has expired.`,
      });
    } else {
      // Apply ongoing effect
      if (effect === "blight") {
        const upgrades = safeJsonParse(
          k.granary_upgrades,
          {},
          "processTurn:granary_upgrades",
        );
        const damage = (updates._blightDamaged = Math.floor(
          (data.damage || 500) * (upgrades.segregation ? 0.5 : 1.0),
        ));
        updates.food = Math.max(
          0,
          (updates.food !== undefined ? updates.food : k.food) - damage,
        );
      } else if (effect === "plague") {
        let lost = Math.floor(k.population * 0.02);
        // Special housing effects (Celestial Feather: Holy Sanctuaries, Ancient Elven Wood: Treehouse Canopy)
        const activeHousingSpecial = fragmentBonusManager.getSpecialEffect(k, 'housing');
        if (activeHousingSpecial?.name === "Holy Sanctuaries") {
          lost = Math.floor(lost * 0.2); // 80% reduction in plague loss
        } else if (activeHousingSpecial?.name === "Treehouse Canopy") {
          lost = Math.floor(lost * 0.5); // 50% reduction in plague loss
        }
        updates.population = Math.max(0, k.population - lost);
        events.push({
          type: "attack",
          message: `☠️ Plague ravages your kingdom — ${lost.toLocaleString()} citizens have perished.`,
        });
      } else if (effect === "silence") {
        // Research suppressed — handled in processTurn by checking for silence
      } else if (effect === "summon_rats") {
        const foodDmg = data.food_damage_per_turn || 0;
        if (foodDmg > 0) {
          updates.food = Math.max(0, (updates.food !== undefined ? updates.food : k.food) - foodDmg);
          events.push({ type: "attack", message: `🐀 Summoned rats devour ${foodDmg.toLocaleString()} food from your stores.` });
        }
      } else if (effect === "life_drain_aura") {
        const drainPct = data.population_drain || 0.1;
        const lost = Math.floor(k.population * drainPct);
        if (lost > 0) {
          updates.population = Math.max(0, (updates.population !== undefined ? updates.population : k.population) - lost);
          events.push({ type: "attack", message: `💀 Life drain aura saps ${lost.toLocaleString()} population from your kingdom.` });
        }
      } else if (effect === "mutate_crops") {
        const penalty = data.food_penalty || 0.3;
        const foodLost = Math.floor(k.food * penalty);
        if (foodLost > 0) {
          updates.food = Math.max(0, (updates.food !== undefined ? updates.food : k.food) - foodLost);
          events.push({ type: "attack", message: `🌿 Mutated crops rot — ${foodLost.toLocaleString()} food spoiled.` });
        }
      } else if (effect === "command_legion") {
        const friendlyFire = data.damage_per_turn || 0;
        if (friendlyFire > 0) {
          updates.fighters = Math.max(0, (updates.fighters !== undefined ? updates.fighters : k.fighters) - friendlyFire);
          events.push({ type: "attack", message: `⚔️ Command legion confusion — ${friendlyFire.toLocaleString()} fighters lost to friendly fire.` });
        }
      } else if (effect === "conjure_abundance") {
        // Unlimited food: generate food equal to 20% of population each turn
        const foodGenerated = Math.floor(k.population * 0.2);
        updates.food = (updates.food !== undefined ? updates.food : k.food) + foodGenerated;
        events.push({ type: "system", message: `🌽 Conjured abundance generates ${foodGenerated.toLocaleString()} food.` });
      } else if (effect === "death_dominion") {
        // Enemy deaths reanimate under control — bonus fighters each turn based on flag
        const bonusFighters = Math.floor(k.fighters * 0.01);
        if (bonusFighters > 0) {
          updates.fighters = (updates.fighters !== undefined ? updates.fighters : k.fighters) + bonusFighters;
        }
      }
      effects[effect] = { ...data, turns_left: remaining };
    }
  }

  expired.forEach((e) => delete effects[e]);
  updates.active_effects = JSON.stringify(effects);
  return updates;
}


module.exports = {
  processMercenaries,
  hireMercenaries,
  purchaseUpgrade,
  hireUnits,
  junkPrize,
  expeditionRewards,
  resolveInstantExpedition,
  processActiveEffects,
};
