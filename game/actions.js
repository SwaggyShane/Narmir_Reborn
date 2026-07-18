// game/actions.js
// Kingdom action handlers: unit hiring, upgrades, research, building, crafting,
// trade raiding, and demolition. Extracted from engine.js (Phase 7).

const config = require('./config');
const fragmentBonusManager = require('./fragment-bonus-manager');
const { safeJsonParse, devLog } = require('../utils/helpers');
const { diluteTroopXp, unitLevelMult } = require('./lib/troops');
const { getCap } = require('./lib/data-transformations');
const { researchIncrement } = require('./population');

const {
  MERC_TIERS,
  UNIT_COST,
  BUILDING_COST,
  BUILDING_GOLD_COST,
  BUILDING_LAND_COST,
  BUILDING_COL,
  BUILDING_ALIASES,
  BUILDING_WOOD_COST,
  BUILDING_STONE_COST,
  BUILDING_IRON_COST,
  RESOURCE_BUILDING_CONFIG,
  TOOL_COL,
  TOOL_GOLD_COST,
  MAGIC_SCHOOLS,
  RESEARCH_MAP,
  MAX_RESEARCH,
  RESEARCH_DISCIPLINE_CAPS,
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
} = config;

function hireMercenaries(k, unitType, tier, count) {
  count = Math.floor(Number(count));
  if (isNaN(count) || count <= 0) return { error: "Count must be a positive integer" };
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
  const currentGold = k.gold || 0;
  if (currentGold < cost)
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
      gold: currentGold - cost,
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
  const currentGold = k.gold || 0;
  if (currentGold < def.cost)
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
  if (def.reqVaults && (k.bld_vaults || 0) < def.reqVaults)
    return {
      error: `Need at least ${def.reqVaults} Vaults for this bank upgrade.`,
    };

  upgrades[upgradeKey] = true;
  return {
    updates: {
      gold: currentGold - def.cost,
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

  // School cap - researchers need schools (100 per school)
  if (unit === "researchers") {
    const schoolCap = (k.bld_schools || 0) * 100;
    const currentResearchers = k.researchers || 0;
    if (schoolCap === 0)
      return { error: "You need at least 1 school to hire researchers" };
    if (currentResearchers >= schoolCap)
      return {
        error: `School capacity full - ${schoolCap.toLocaleString()} researchers max with ${k.bld_schools} school${k.bld_schools > 1 ? "s" : ""} (100 per school)`, 
      };
    if (currentResearchers + amount > schoolCap)
      return {
        error: `Only room for ${(schoolCap - currentResearchers).toLocaleString()} more researchers - build more schools (100 per school)`, 
      };
  }

  // Barracks cap - military troops need barracks (500 per barracks)
  const BARRACKS_TROOPS = [
    "fighters",
    "rangers",
    "clerics",
    "thieves",
    "ninjas",
  ];
  if (BARRACKS_TROOPS.includes(unit)) {
    const barracksCapacityMult = fragmentBonusManager.getBonusMultiplier(k, 'barracks', 'capacity');
    const barracksCap = Math.floor((k.bld_barracks || 0) * 500 * barracksCapacityMult);
    const currentTroops = BARRACKS_TROOPS.reduce((s, u) => s + (k[u] || 0), 0);
    if (barracksCap === 0)
      return { error: "You need at least 1 barracks to hire troops" };
    if (currentTroops >= barracksCap)
      return {
        error: `Barracks full - ${barracksCap.toLocaleString()} troops max with ${k.bld_barracks} barracks (500 per barracks)`, 
      };
    if (currentTroops + amount > barracksCap)
      return {
        error: `Only room for ${(barracksCap - currentTroops).toLocaleString()} more troops - build more barracks (500 per barracks)`, 
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
        error: `Level ${k.level || 1} cap reached for ${unit} (max ${cap.toLocaleString()}) - gain levels to increase`, 
      };
    if (current + amount > cap)
      return {
        error: `Level ${k.level || 1} cap: can only hire ${(cap - current).toLocaleString()} more ${unit} (max ${cap.toLocaleString()})`,
      };
  }

  const cost = amount * UNIT_COST;
  const currentGold = k.gold || 0;
  const currentPopulation = k.population || 0;
  if (currentGold < cost)
    return { error: `Not enough gold - need ${cost.toLocaleString()} gold` };
  if (amount > currentPopulation)
    return { error: "Not enough population available" };

  // Dilute unit XP pool when new recruits join - new troops lower the average
  const dilutedLevels = diluteTroopXp(k, unit, amount);

  return {
    updates: {
      gold: currentGold - cost,
      population: currentPopulation - amount,
      [unit]: (k[unit] || 0) + amount,
      ...(dilutedLevels ? { troop_levels: dilutedLevels } : {}),
      updated_at: Math.floor(Date.now() / 1000),
    },
  };
}

function studyDiscipline(k, discipline, researchersAssigned) {
  const col = RESEARCH_MAP[discipline];
  if (!col) return { error: "Unknown discipline" };
  if (researchersAssigned > (k.researchers || 0))
    return { error: "Not enough researchers" };

  const currentLevel = k[col] || 100;
  const increment = researchIncrement(
    k,
    discipline,
    researchersAssigned,
    currentLevel,
  );
  if (increment === 0)
    return { error: "Need more researchers for any progress" };

  let cap = MAX_RESEARCH;
  if (discipline === "spellbook" || discipline === "school_spellbook") {
    cap = Infinity;
  } else {
    // Apply race-specific hard cap for this discipline (if any)
    const raceCaps = RESEARCH_DISCIPLINE_CAPS[k.race] || {};
    cap = raceCaps[discipline] || MAX_RESEARCH;
  }
  const newVal = Math.min(cap, currentLevel + increment);

  return {
    updates: { [col]: newVal, updated_at: Math.floor(Date.now() / 1000) },
    increment,
  };
}

// Select a school of magic (one-time choice when res_spellbook >= 100)
function _selectSchool(k, schoolName) {
  // Validate school name
  if (!MAGIC_SCHOOLS[schoolName]) {
    return { error: `Unknown school: ${schoolName}` };
  }

  // Can only choose if: school_of_magic is null AND res_spellbook >= 100
  if (k.school_of_magic) {
    return { error: `You have already chosen the school of ${k.school_of_magic}` };
  }

  if ((k.res_spellbook || 0) < 100) {
    return { error: `You must reach spellbook research level 100 to choose a school` };
  }

  // Set school choice
  const schoolLabel = schoolName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return {
    updates: { school_of_magic: schoolName, school_spellbook: 0 },
    events: [{ type: 'system', message: `You have chosen the school of ${schoolLabel}. You can now research school-specific spells!` } ]
  };
}

// Add buildings to the queue - charges gold, no turn cost
function queueBuildings(k, orders) {
  const queue = safeJsonParse(k.build_queue, {}, "queueBuildings:build_queue");

  let totalCost = 0;
  let totalLand = 0;
  const processedOrders = {};

  for (const [building, qty] of Object.entries(orders)) {
    // Normalize building name (e.g., 'library' -> 'libraries')
    const key = BUILDING_ALIASES[building] || building;
    if (!BUILDING_COST[key]) {
      console.warn(
        `[queueBuildings] Unknown building type: ${building} (normalized to ${key})`,
      );
      continue;
    }
    const n = Math.floor(Math.max(0, Number(qty)));
    if (isNaN(n) || n <= 0) continue;

    // Check Cap
    const col = BUILDING_COL[key];
    const currentBuilt = k[col] || 0;
    const currentQueued = queue[key] || 0;
    const cap = getCap(col, k.level || 1);

    if (currentBuilt + currentQueued + n > cap) {
      if (currentBuilt + currentQueued >= cap) {
        return {
          error: `${key.replace(/_/g, " ")} cap reached (max ${cap.toLocaleString()}).`,
        };
      }
      return {
        error: `Cannot queue ${n} more ${key.replace(/_/g, " ")}. Only room for ${cap - currentBuilt - currentQueued}.`,
      };
    }

    const goldPerUnit = BUILDING_GOLD_COST[key] ?? 100;
    const landPerUnit = BUILDING_LAND_COST[key] || 0;
    totalCost += goldPerUnit * n;
    totalLand += landPerUnit * n;
    processedOrders[key] = n;
  }

  let usedLand = 0;
  const landBreakdown = {};
  for (const [key, cost] of Object.entries(BUILDING_LAND_COST)) {
    const col = BUILDING_COL[key];
    const builtCost = (col && k[col]) ? (k[col] || 0) * cost : 0;
    const queuedCost = (queue[key] || 0) * cost;
    const buildingLandCost = builtCost + queuedCost;
    if (buildingLandCost > 0) {
      landBreakdown[key] = { built: k[col] || 0, queued: queue[key] || 0, cost, total: buildingLandCost };
    }
    if (col) usedLand += builtCost;
    usedLand += queuedCost;
  }
  const freeLand = Math.max(0, k.land - usedLand);

  if (totalLand > 0) {
    devLog(`[queueBuildings] Land calculation for ${k.name}: total=${k.land}, used=${usedLand}, free=${freeLand}, requesting=${totalLand}`);
    if (Object.keys(landBreakdown).length > 0) {
      devLog('[queueBuildings] Breakdown:', JSON.stringify(landBreakdown, null, 2));
    }
  }

  const currentGold = k.gold || 0;
  if (totalCost > currentGold) {
    return {
      error: `Need ${totalCost.toLocaleString()} gold but only have ${currentGold.toLocaleString()} gold`,
    };
  }

  if (totalLand > freeLand) {
    return {
      error: `Need ${totalLand.toLocaleString()} land but only have ${freeLand.toLocaleString()} free land`,
    };
  }

  // Resource building bracket-lock validation + resource cost
  const level = k.level || 1;
  const resSeqRaw = safeJsonParse(k.resource_sequence, {}, 'queueBuildings:resource_sequence');
  let totalWoodCost = 0;
  let totalStoneCost = 0;
  let totalIronCost = 0;

  for (const [key, n] of Object.entries(processedOrders)) {
    const rbCfg = RESOURCE_BUILDING_CONFIG[key];
    if (!rbCfg) continue; // Not a resource building

    // Enforce one-slot-per-resource-type: reject if any building of this type is already queued
    for (const [qKey, qCount] of Object.entries(queue)) {
      if (qCount <= 0) continue;
      const qRbCfg = RESOURCE_BUILDING_CONFIG[qKey];
      if (qRbCfg && qRbCfg.type === rbCfg.type) {
        return { error: `A ${rbCfg.type} building (${qKey.replace(/_/g, ' ')}) is already in progress. Only one ${rbCfg.type} build slot is allowed at a time.` };
      }
    }

    const seq = resSeqRaw[rbCfg.type] || { s2_paid_at_bracket: -1, s3_paid_at_bracket: -1, last_s3_bracket: -1 };
    const s3Col = config.RESOURCE_STAGE3_COL[rbCfg.type];
    const s3Cap = Math.floor((level - 1) / 10) + 1;
    const s3Current = k[s3Col] || 0;

    const s1Col = config.RESOURCE_STAGE1_COL[rbCfg.type];
    const s2Col = config.RESOURCE_STAGE2_COL[rbCfg.type];

    if (rbCfg.stage === 1) {
      if (s3Current >= s3Cap) {
        return { error: `${key.replace(/_/g, ' ')} is locked - you have reached the maximum number of stage-3 ${rbCfg.type} buildings (${s3Cap}) for your level.` };
      }
      // Stage 1 hard cap of 3
      const s1Current = k[s1Col] || 0;
      if (s1Current + n > 3) {
        return { error: `${key.replace(/_/g, ' ')} cap reached (max 3).` };
      }
      const s2Current = (k[s2Col] || 0) + (queue[config.RESOURCE_STAGE2_BUILDINGS[rbCfg.type]] || 0);
      if (s2Current > 0) {
        return { error: `${key.replace(/_/g, ' ')} is locked - you already have Stage 2 ${rbCfg.type} buildings in progress or built.` };
      }
    } else if (rbCfg.stage === 2) {
      if (s3Current >= s3Cap) {
        return { error: `${key.replace(/_/g, ' ')} is locked - you have reached the maximum number of stage-3 ${rbCfg.type} buildings (${s3Cap}) for your level.` };
      }
      if (seq.s2_paid_at_bracket <= -1) {
        return { error: `You must purchase the Stage 2 ${rbCfg.type} upgrade before building ${key.replace(/_/g, ' ')}.` };
      }
      const s2Built = k[s2Col] || 0;
      const s2Queued = queue[config.RESOURCE_STAGE2_BUILDINGS[rbCfg.type]] || 0;
      const s1Current = k[s1Col] || 0;
      // If none built or queued, need 3 stage 1s to start
      if (s2Built + s2Queued === 0 && s1Current < 3) {
         return { error: `You need 3 ${s1Col.replace('bld_', '').replace(/_/g, ' ')} built to start building ${key.replace(/_/g, ' ')}.` };
      }
      // Stage 2 hard cap of 5
      if (s2Built + s2Queued + n > 5) {
        return { error: `${key.replace(/_/g, ' ')} cap reached (max 5).` };
      }
    } else if (rbCfg.stage === 3) {
      if (seq.s3_paid_at_bracket <= -1) {
        return { error: `You must purchase the Stage 3 ${rbCfg.type} upgrade before building ${key.replace(/_/g, ' ')}.` };
      }
      const s3Built = k[s3Col] || 0;
      const s3Queued = queue[config.RESOURCE_STAGE3_BUILDINGS[rbCfg.type]] || 0;
      const s2Current = k[s2Col] || 0;
      // If none built or queued, need 5 stage 2s to start
      if (s3Built + s3Queued === 0 && s2Current < 5) {
         return { error: `You need 5 ${s2Col.replace('bld_', '').replace(/_/g, ' ')} built to start building ${key.replace(/_/g, ' ')}.` };
      }
      // Check s3 cap (bracket + 1 total allowed)
      if (s3Current + n > s3Cap) {
        return { error: `${key.replace(/_/g, ' ')} cap reached for your level (max ${s3Cap}).` };
      }
    }

    // Tally resource costs
    totalWoodCost += (BUILDING_WOOD_COST[key] || 0) * n;
    totalStoneCost += (BUILDING_STONE_COST[key] || 0) * n;
    totalIronCost += (BUILDING_IRON_COST[key] || 0) * n;
  }

  // Check resource stockpile sufficiency
  const currentWood = k.wood || 0;
  if (totalWoodCost > 0 && currentWood < totalWoodCost) {
    return { error: `Need ${totalWoodCost.toLocaleString()} wood but only have ${currentWood.toLocaleString()}.` };
  }
  const currentStone = k.stone || 0;
  if (totalStoneCost > 0 && currentStone < totalStoneCost) {
    return { error: `Need ${totalStoneCost.toLocaleString()} stone but only have ${currentStone.toLocaleString()}.` };
  }
  const currentIron = k.iron || 0;
  if (totalIronCost > 0 && currentIron < totalIronCost) {
    return { error: `Need ${totalIronCost.toLocaleString()} iron but only have ${currentIron.toLocaleString()}.` };
  }

  for (const [key, n] of Object.entries(processedOrders)) {
    queue[key] = (queue[key] || 0) + n;
  }

  const queueUpdates = {
    build_queue: JSON.stringify(queue),
    gold: currentGold - totalCost,
  };
  if (totalWoodCost > 0)  queueUpdates.wood  = Math.max(0, currentWood - totalWoodCost);
  if (totalStoneCost > 0) queueUpdates.stone = Math.max(0, currentStone - totalStoneCost);
  if (totalIronCost > 0)  queueUpdates.iron  = Math.max(0, currentIron - totalIronCost);

  return {
    updates: queueUpdates,
    totalCost,
    totalLand,
  };
}

// Forge construction tools - costs gold, no engineer requirement
function forgeTools(k, toolType, quantity) {
  quantity = Math.floor(Number(quantity));
  if (isNaN(quantity) || quantity <= 0) return { error: "Quantity must be a positive integer" };
  const cost = TOOL_GOLD_COST[toolType];
  const col = TOOL_COL[toolType];
  if (cost === undefined || !col) return { error: "Unknown tool type" };
  // Toolwright's Yard — hammer gold ×0.90 (all tool gold costs)
  let goldMult = 1.0;
  try {
    goldMult = require('./forge-upgrades').hammerGoldCostMult(k);
  } catch {
    goldMult = 1.0;
  }
  const totalCost = Math.ceil(cost * quantity * goldMult);
  const currentGold = k.gold || 0;
  if (totalCost > currentGold)
    return {
      error: `Need ${totalCost.toLocaleString()} gold but only have ${currentGold.toLocaleString()} gold`,
    };
  return {
    updates: {
      [col]: (k[col] || 0) + quantity,
      gold: currentGold - totalCost,
      updated_at: Math.floor(Date.now() / 1000),
    },
    totalCost,
  };
}

function raidTradeRoute(attacker, defender, unitCount) {
  unitCount = Math.floor(Number(unitCount));
  if (isNaN(unitCount) || unitCount <= 0) return { error: "Unit count must be a positive integer" };
  if (attacker.race !== "orc")
    return { error: "Only Orcs can raid trade routes" };
  const currentAttackerThieves = attacker.thieves || 0;
  if (currentAttackerThieves < 500)
    return { error: "Need at least 500 thieves to raid trade routes" };
  const defenderTradeRoutes = defender.trade_routes || 0;
  if (defenderTradeRoutes < 1)
    return { error: "Target has no trade routes to raid" };

  const atkLvl = unitLevelMult(attacker, "thieves");
  const defLvl = unitLevelMult(defender, "thieves");
  const successChance = 0.4 + (atkLvl - defLvl) * 0.2;
  const roll = Math.random();

  if (roll < successChance) {
    const raided = Math.min(defenderTradeRoutes, Math.floor(unitCount / 500));
    const loot = raided * 5000;
    const losses = Math.floor(unitCount * 0.05);

    return {
      success: true,
      looted: loot,
      raidedRoutes: raided,
      attackerUpdates: {
        gold: (attacker.gold || 0) + loot,
        thieves: Math.max(0, (attacker.thieves || 0) - losses),
      },
      defenderUpdates: {
        trade_routes: Math.max(0, (defender.trade_routes || 0) - raided),
      },
      atkEvent: `SUCCESS: You raided ${raided} trade routes of ${defender.name} and looted ${loot.toLocaleString()} gold! (Losses: ${losses} thieves)`, 
      defEvent: `RAIDED: ${attacker.name}'s Orcs raided your trade routes! You lost ${raided} routes and ${loot.toLocaleString()} gold was stolen!`,
    };
  } else {
    const losses = Math.floor(unitCount * 0.15);
    return {
      success: false,
      attackerUpdates: {
        thieves: Math.max(0, (attacker.thieves || 0) - losses),
      },
      atkEvent: `FAILURE: Your raid on ${defender.name}'s trade routes failed. You lost ${losses} thieves in the ambush.`,
      defEvent: `Your guards repelled an Orc raid from ${attacker.name} on your trade routes!`,
    };
  }
}

function demolishBuilding(k, buildingKey, amount) {
  amount = Math.floor(Number(amount));
  if (isNaN(amount) || amount <= 0) return { error: "Amount must be a positive integer" };
  const col = BUILDING_COL[buildingKey];
  if (!col) return { error: "Unknown building" };
  const current = k[col] || 0;
  const toDemolish = Math.min(amount, current);
  if (toDemolish <= 0) return { error: "Nothing to demolish" };

  const goldRefund = Math.floor(
    (BUILDING_GOLD_COST[buildingKey] || 0) * 0.25 * toDemolish,
  );
  const landRefund = (BUILDING_LAND_COST[buildingKey] || 0) * toDemolish;

  return {
    updates: {
      [col]: current - toDemolish,
      gold: (k.gold || 0) + goldRefund,
      land: (k.land || 0) + landRefund,
    },
    refund: { gold: goldRefund, land: landRefund, count: toDemolish },
  };
}

module.exports = {
  hireMercenaries,
  purchaseUpgrade,
  hireUnits,
  studyDiscipline,
  selectSchool: _selectSchool,
  queueBuildings,
  forgeTools,
  raidTradeRoute,
  demolishBuilding,
};
