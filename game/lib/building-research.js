// game/lib/building-research.js
// Building and research logic: queuing, construction, tool forging, demolition, research discipline study, and magic school selection.
// Pure functions for kingdom state mutations during construction/research phases.

const config = require('../config');
const { progressGoal } = require('../goals');
const { devLog, getCap } = require('./data-transformations');
const { safeJsonParse } = require('../../utils/helpers');
const { raceBonus } = require('./race-bonus');
const { unitLevelMult, awardTroopXp } = require('./troops');
const fragmentBonusManager = require('../fragment-bonus-manager');
const { awardXp } = require('../xp');

const {
  BUILDING_COST,
  BUILDING_ALIASES,
  BUILDING_COL,
  BUILDING_GOLD_COST,
  BUILDING_LAND_COST,
  BUILDING_WOOD_COST,
  BUILDING_STONE_COST,
  BUILDING_IRON_COST,
  RESOURCE_BUILDING_CONFIG,
  TOOL_COL,
  TOOL_GOLD_COST,
  BLUEPRINT_REQUIRED: BP_REQ,
  SCAFFOLDING_REQUIRED: SCAFF_REQ,
  RESEARCH_MAP,
  MAX_RESEARCH,
  RESEARCH_DISCIPLINE_CAPS,
  MAGIC_SCHOOLS,
} = config;

const { researchIncrement } = require('../population');

const BLUEPRINT_REQUIRED = new Set(BP_REQ);
const SCAFFOLDING_REQUIRED = new Set(SCAFF_REQ);

function studyDiscipline(k, discipline, researchersAssigned) {
  const col = RESEARCH_MAP[discipline];
  if (!col) return { error: "Unknown discipline" };
  if (researchersAssigned > k.researchers)
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
    const raceCaps = RESEARCH_DISCIPLINE_CAPS[k.race] || {};
    cap = raceCaps[discipline] || MAX_RESEARCH;
  }
  const newVal = Math.min(cap, k[col] + increment);

  return {
    updates: { [col]: newVal, updated_at: Math.floor(Date.now() / 1000) },
    increment,
  };
}

function _selectSchool(k, schoolName) {
  if (!MAGIC_SCHOOLS[schoolName]) {
    return { error: `Unknown school: ${schoolName}` };
  }

  if (k.school_of_magic) {
    return { error: `You have already chosen the school of ${k.school_of_magic}` };
  }

  if (k.res_spellbook < 100) {
    return { error: `You must reach spellbook research level 100 to choose a school` };
  }

  const schoolLabel = schoolName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return {
    updates: { school_of_magic: schoolName, school_spellbook: 0 },
    events: [{ type: 'system', message: `🔮 You have chosen the school of ${schoolLabel}. You can now research school-specific spells!` }]
  };
}

function queueBuildings(k, orders) {
  const queue = safeJsonParse(k.build_queue, {}, "queueBuildings:build_queue");

  let totalCost = 0;
  let totalLand = 0;
  const processedOrders = {};

  for (const [building, qty] of Object.entries(orders)) {
    const key = BUILDING_ALIASES[building] || building;
    if (!BUILDING_COST[key]) {
      console.warn(
        `[queueBuildings] Unknown building type: ${building} (normalized to ${key})`,
      );
      continue;
    }
    const n = Math.max(0, Number(qty));
    if (n <= 0) continue;

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

  if (totalCost > k.gold) {
    return {
      error: `Need ${totalCost.toLocaleString()} gold but only have ${k.gold.toLocaleString()} gold`,
    };
  }

  if (totalLand > freeLand) {
    return {
      error: `Need ${totalLand.toLocaleString()} land but only have ${freeLand.toLocaleString()} free land`,
    };
  }

  const level = k.level || 1;
  const resSeqRaw = safeJsonParse(k.resource_sequence, {}, 'queueBuildings:resource_sequence');
  let totalWoodCost = 0;
  let totalStoneCost = 0;
  let totalIronCost = 0;

  for (const [key, n] of Object.entries(processedOrders)) {
    const rbCfg = RESOURCE_BUILDING_CONFIG[key];
    if (!rbCfg) continue;

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
        return { error: `${key.replace(/_/g, ' ')} is locked — you have reached the maximum number of stage-3 ${rbCfg.type} buildings (${s3Cap}) for your level.` };
      }
      const s1Current = k[s1Col] || 0;
      if (s1Current + n > 3) {
        return { error: `${key.replace(/_/g, ' ')} cap reached (max 3).` };
      }
      const s2Current = (k[s2Col] || 0) + (queue[config.RESOURCE_STAGE2_BUILDINGS[rbCfg.type]] || 0);
      if (s2Current > 0) {
        return { error: `${key.replace(/_/g, ' ')} is locked — you already have Stage 2 ${rbCfg.type} buildings in progress or built.` };
      }
    } else if (rbCfg.stage === 2) {
      if (s3Current >= s3Cap) {
        return { error: `${key.replace(/_/g, ' ')} is locked — you have reached the maximum number of stage-3 ${rbCfg.type} buildings (${s3Cap}) for your level.` };
      }
      if (seq.s2_paid_at_bracket <= -1) {
        return { error: `You must purchase the Stage 2 ${rbCfg.type} upgrade before building ${key.replace(/_/g, ' ')}.` };
      }
      const s2Built = k[s2Col] || 0;
      const s2Queued = queue[config.RESOURCE_STAGE2_BUILDINGS[rbCfg.type]] || 0;
      const s1Current = k[s1Col] || 0;
      if (s2Built + s2Queued === 0 && s1Current < 3) {
         return { error: `You need 3 ${s1Col.replace('bld_', '').replace(/_/g, ' ')} built to start building ${key.replace(/_/g, ' ')}.` };
      }
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
      if (s3Built + s3Queued === 0 && s2Current < 5) {
         return { error: `You need 5 ${s2Col.replace('bld_', '').replace(/_/g, ' ')} built to start building ${key.replace(/_/g, ' ')}.` };
      }
      if (s3Current + n > s3Cap) {
        return { error: `${key.replace(/_/g, ' ')} cap reached for your level (max ${s3Cap}).` };
      }
    }

    totalWoodCost += (BUILDING_WOOD_COST[key] || 0) * n;
    totalStoneCost += (BUILDING_STONE_COST[key] || 0) * n;
    totalIronCost += (BUILDING_IRON_COST[key] || 0) * n;
  }

  if (totalWoodCost > 0 && k.wood < totalWoodCost) {
    return { error: `Need ${totalWoodCost.toLocaleString()} wood but only have ${k.wood.toLocaleString()}.` };
  }
  if (totalStoneCost > 0 && k.stone < totalStoneCost) {
    return { error: `Need ${totalStoneCost.toLocaleString()} stone but only have ${k.stone.toLocaleString()}.` };
  }
  if (totalIronCost > 0 && k.iron < totalIronCost) {
    return { error: `Need ${totalIronCost.toLocaleString()} iron but only have ${k.iron.toLocaleString()}.` };
  }

  for (const [key, n] of Object.entries(processedOrders)) {
    queue[key] = (queue[key] || 0) + n;
  }

  const queueUpdates = {
    build_queue: JSON.stringify(queue),
    gold: k.gold - totalCost,
  };
  if (totalWoodCost > 0)  queueUpdates.wood  = Math.max(0, k.wood - totalWoodCost);
  if (totalStoneCost > 0) queueUpdates.stone = Math.max(0, k.stone - totalStoneCost);
  if (totalIronCost > 0)  queueUpdates.iron  = Math.max(0, k.iron - totalIronCost);

  return {
    updates: queueUpdates,
    totalCost,
    totalLand,
  };
}

function processBuildQueue(k, events, xpSourcesAccum) {
  const updates = {};
  const constructionNotes = [];

  const hl = TOOL_COL.hammers;
  const sl = TOOL_COL.scaffolding;
  const hammerBonus = 1 + (k[hl] || 0) * 0.05;
  const smithyBonus = 1 + Math.floor(k.bld_smithies / 15) * 0.02;
  const raceConstr = raceBonus(k, "construction");
  const engLevelMult = unitLevelMult(k, "engineers");
  const resConstr = (k.res_construction || 100) / 100;
  const smithySpeedMult = fragmentBonusManager.getBonusMultiplier(k, 'smithies', 'speed');
  const smithyProdMult = fragmentBonusManager.getBonusMultiplier(k, 'smithies', 'production');
  const smithyQualityMult = fragmentBonusManager.getBonusMultiplier(k, 'smithies', 'quality');
  const effectiveSmithyMult = smithySpeedMult * smithyProdMult * smithyQualityMult;
  const baseToolMult =
    hammerBonus * smithyBonus * raceConstr * engLevelMult * resConstr * effectiveSmithyMult;

  let blueprintsLeft = k.blueprints_stored;
  let scaffoldingLeft = k[sl] || 0;
  let blueprintsUsed = 0;
  let scaffoldingUsed = 0;

  const allocationRaw = safeJsonParse(
    k.build_allocation,
    {},
    "processBuildQueue:build_allocation",
  );
  const resourceAllocationRaw = safeJsonParse(
    k.resource_build_allocation,
    {},
    "processBuildQueue:resource_build_allocation",
  );
  let allocation = {};
  for (const b of Object.keys(allocationRaw)) {
    const key = BUILDING_ALIASES[b] || b;
    allocation[key] = (allocation[key] || 0) + (Number(allocationRaw[b]) || 0);
  }
  for (const b of Object.keys(resourceAllocationRaw)) {
    const key = BUILDING_ALIASES[b] || b;
    allocation[key] = (allocation[key] || 0) + (Number(resourceAllocationRaw[b]) || 0);
  }

  const queueRaw = safeJsonParse(
    k.build_queue,
    {},
    "processBuildQueue:build_queue",
  );
  let queue = {};
  for (const b of Object.keys(queueRaw)) {
    const key = BUILDING_ALIASES[b] || b;
    queue[key] = (queue[key] || 0) + (Number(queueRaw[b]) || 0);
  }

  const progressRaw = safeJsonParse(
    k.build_progress,
    {},
    "processBuildQueue:build_progress",
  );
  let progress = {};
  for (const b of Object.keys(progressRaw)) {
    const key = BUILDING_ALIASES[b] || b;
    progress[key] = (progress[key] || 0) + (Number(progressRaw[b]) || 0);
  }

  const activeBuildings = new Set([
    ...Object.keys(allocation).filter((b) => allocation[b] > 0),
    ...Object.keys(queue).filter((b) => queue[b] > 0),
  ]);
  if (activeBuildings.size === 0) return updates;

  const completedItems = [];
  let totalEngineersWorked = 0;

  for (const building of activeBuildings) {
    const engAssigned = allocation[building] || 0;
    if (engAssigned <= 0 && !(queue[building] > 0)) continue;

    const cost = BUILDING_COST[building];
    if (!cost) continue;

    if (BLUEPRINT_REQUIRED.has(building) && blueprintsLeft <= 0) {
      updates._blueprint_needed = updates._blueprint_needed || [];
      if (!updates._blueprint_needed.includes(building)) {
        updates._blueprint_needed.push(building);
        if (engAssigned > 0) {
          constructionNotes.push(`⚠️ ${building.replace(/_/g, ' ')} paused — no blueprints available.`);
        }
      }
      continue;
    }

    if (SCAFFOLDING_REQUIRED.has(building) && scaffoldingLeft <= 0) {
      updates._scaffolding_needed = updates._scaffolding_needed || [];
      if (!updates._scaffolding_needed.includes(building)) {
        updates._scaffolding_needed.push(building);
        if (engAssigned > 0) {
          constructionNotes.push(`⚠️ ${building.replace(/_/g, ' ')} paused — no scaffolding available.`);
        }
      }
      continue;
    }

    let toolMult = baseToolMult;

    if (RESOURCE_BUILDING_CONFIG[building]) {
      toolMult *= raceBonus(k, 'resource_build');
    }

    const buildMb = safeJsonParse(k.milestone_bonuses, {}, "build:mb");
    const buildMilestoneMult = 1 + (buildMb.construction_speed_pct || 0) / 100;
    let workDone = Math.floor(engAssigned * toolMult * buildMilestoneMult);
    if (engAssigned > 0 && workDone <= 0) workDone = 1;
    if (workDone <= 0) continue;

    if (RESOURCE_BUILDING_CONFIG[building] && !(queue[building] > 0)) continue;

    totalEngineersWorked += engAssigned;

    const prevProgress = progress[building] || 0;
    const totalProgress = prevProgress + workDone;
    const rawCompleted = Math.floor(totalProgress / cost);
    const completed = RESOURCE_BUILDING_CONFIG[building]
      ? Math.min(rawCompleted, queue[building])
      : rawCompleted;
    let completedApplied = 0;

    if (completed > 0) {
      const col =
        k.race === "vampire" &&
        (building === "shrines" || building === "shrine")
          ? "bld_mausoleums"
          : BUILDING_COL[building];
      if (col) {
        const current = updates[col] !== undefined ? updates[col] : k[col] || 0;
        const cap = getCap(col, k.level || 1);
        const capSpace = Math.max(0, cap - current);
        const capBlocked = completed > 0 && capSpace <= 0;
        let canAdd = Math.max(0, Math.min(completed, capSpace));

        // Resource-chain buildings (lumber_camp/sawmill and stone/iron
        // equivalents) each individually convert lower-tier buildings —
        // every stage-2 unit costs 3 stage-1 buildings, every stage-3 unit
        // costs 5 stage-2 buildings. This must gate `canAdd` down to what's
        // actually affordable and run for EVERY unit built, not just the
        // first one ever (old stage-2 logic) or once per 10-level bracket
        // (old stage-3 logic) — those were a mismatch with the intended
        // "conversion cycle repeats per building" design.
        const rbCfg = RESOURCE_BUILDING_CONFIG[building];
        let rbConsumedCol = null;
        let rbConsumedAmount = 0;
        if (rbCfg && canAdd > 0 && (rbCfg.stage === 2 || rbCfg.stage === 3)) {
          const lowerCol = rbCfg.stage === 2
            ? config.RESOURCE_STAGE1_COL[rbCfg.type]
            : config.RESOURCE_STAGE2_COL[rbCfg.type];
          const perUnit = rbCfg.stage === 2 ? 3 : 5;
          if (lowerCol) {
            const lowerCurrent = updates[lowerCol] !== undefined ? updates[lowerCol] : (k[lowerCol] || 0);
            const affordable = Math.floor(lowerCurrent / perUnit);
            const affordableAdd = Math.min(canAdd, affordable);
            if (affordableAdd < canAdd) {
              constructionNotes.push(
                `⚠️ ${building.replace(/_/g, ' ')} limited to ${affordableAdd} — needs ${perUnit} ${lowerCol.replace('bld_', '')} per unit.`,
              );
            }
            canAdd = affordableAdd;
            if (canAdd > 0) {
              rbConsumedCol = lowerCol;
              rbConsumedAmount = canAdd * perUnit;
            }
          }
        }

        if (!RESOURCE_BUILDING_CONFIG[building] && canAdd > 0) {
          const goldPerUnit = BUILDING_GOLD_COST[building] ?? 100;
          const landPerUnit = BUILDING_LAND_COST[building] || 0;
          const woodPerUnit = BUILDING_WOOD_COST[building] || 0;
          const stonePerUnit = BUILDING_STONE_COST[building] || 0;
          const ironPerUnit = BUILDING_IRON_COST[building] || 0;

          const fromQueue = Math.min(canAdd, queue[building] || 0);
          let extraUnits = canAdd - fromQueue;
          let blockReason = null;

          if (extraUnits > 0) {
            if (goldPerUnit > 0) {
              const curGold = updates.gold !== undefined ? updates.gold : k.gold;
              const nextExtraUnits = Math.max(0, Math.min(extraUnits, Math.floor(curGold / goldPerUnit)));
              if (nextExtraUnits === 0 && extraUnits > 0) blockReason = 'gold';
              extraUnits = nextExtraUnits;
            }
            if (landPerUnit > 0 && extraUnits > 0) {
              let totalUsedLand = 0;
              for (const [bKey, bCost] of Object.entries(BUILDING_LAND_COST)) {
                const bCol = BUILDING_COL[bKey];
                if (bCol) totalUsedLand += (updates[bCol] !== undefined ? updates[bCol] : (k[bCol] || 0)) * bCost;
                totalUsedLand += (queue[bKey] || 0) * bCost;
              }
              const availLand = (updates.land !== undefined ? updates.land : k.land) - totalUsedLand;
              const nextExtraUnits = Math.max(0, Math.min(extraUnits, Math.floor(availLand / landPerUnit)));
              if (nextExtraUnits === 0 && extraUnits > 0) blockReason = 'land';
              extraUnits = nextExtraUnits;
            }
            if (woodPerUnit > 0 && extraUnits > 0) {
              const curWood = updates.wood !== undefined ? updates.wood : k.wood;
              const nextExtraUnits = Math.max(0, Math.min(extraUnits, Math.floor(curWood / woodPerUnit)));
              if (nextExtraUnits === 0 && extraUnits > 0) blockReason = 'wood';
              extraUnits = nextExtraUnits;
            }
            if (stonePerUnit > 0 && extraUnits > 0) {
              const curStone = updates.stone !== undefined ? updates.stone : k.stone;
              const nextExtraUnits = Math.max(0, Math.min(extraUnits, Math.floor(curStone / stonePerUnit)));
              if (nextExtraUnits === 0 && extraUnits > 0) blockReason = 'stone';
              extraUnits = nextExtraUnits;
            }
            if (ironPerUnit > 0 && extraUnits > 0) {
              const curIron = updates.iron !== undefined ? updates.iron : k.iron;
              const nextExtraUnits = Math.max(0, Math.min(extraUnits, Math.floor(curIron / ironPerUnit)));
              if (nextExtraUnits === 0 && extraUnits > 0) blockReason = 'iron';
              extraUnits = nextExtraUnits;
            }
            if (extraUnits > 0 && goldPerUnit > 0) {
              const curGold = updates.gold !== undefined ? updates.gold : k.gold;
              updates.gold = curGold - goldPerUnit * extraUnits;
            }
            if (extraUnits > 0 && woodPerUnit > 0) {
              const curWood = updates.wood !== undefined ? updates.wood : k.wood;
              updates.wood = curWood - woodPerUnit * extraUnits;
            }
            if (extraUnits > 0 && stonePerUnit > 0) {
              const curStone = updates.stone !== undefined ? updates.stone : k.stone;
              updates.stone = curStone - stonePerUnit * extraUnits;
            }
            if (extraUnits > 0 && ironPerUnit > 0) {
              const curIron = updates.iron !== undefined ? updates.iron : k.iron;
              updates.iron = curIron - ironPerUnit * extraUnits;
            }
          }

          const finalCanAdd = fromQueue + extraUnits;
          if (finalCanAdd < canAdd && finalCanAdd === 0 && blockReason) {
            constructionNotes.push(`⚠️ ${building.replace(/_/g, ' ')} paused — not enough ${blockReason}.`);
          }
          canAdd = finalCanAdd;
        }

        updates[col] = current + canAdd;
        completedApplied = canAdd;
        if (capBlocked && canAdd === 0) {
          constructionNotes.push(
            `⚠️ ${building.replace(/_/g, " ")} cap reached at level ${k.level || 1} (max ${cap.toLocaleString()}) — level up to build more.`,
          );
        }
        if (canAdd > 0) {
          completedItems.push(
            `${canAdd.toLocaleString()} ${building.replace(/_/g, " ")}`,
          );

          if (BLUEPRINT_REQUIRED.has(building)) {
            const consume = Math.min(canAdd, blueprintsLeft);
            blueprintsLeft -= consume;
            blueprintsUsed += consume;
          }

          if (SCAFFOLDING_REQUIRED.has(building)) {
            const consume = Math.min(canAdd, scaffoldingLeft);
            scaffoldingLeft -= consume;
            scaffoldingUsed += consume;
          }

          if (rbConsumedCol && rbConsumedAmount > 0) {
            const landPerConsumed = rbCfg.stage === 3 ? 3 : 1;
            const lowerCurrent = updates[rbConsumedCol] !== undefined ? updates[rbConsumedCol] : (k[rbConsumedCol] || 0);
            updates[rbConsumedCol] = lowerCurrent - rbConsumedAmount;
            updates.land = (updates.land !== undefined ? updates.land : k.land) + (rbConsumedAmount * landPerConsumed);
            constructionNotes.push(
              `🔄 ${rbConsumedAmount} ${rbConsumedCol.replace('bld_', '')} converted into ${canAdd} ${building.replace(/_/g, ' ')}.`,
            );
          }
        }
      }
      progress[building] = totalProgress - completedApplied * cost;
      if (queue[building] > 0) {
        queue[building] = Math.max(0, queue[building] - completedApplied);
        if (queue[building] <= 0) {
          delete queue[building];
          if (RESOURCE_BUILDING_CONFIG[building]) {
            delete allocation[building];
          }
          delete progress[building];
        }
      }
    } else {
      progress[building] = totalProgress;
    }

    if (!updates._build_estimates) updates._build_estimates = [];
    if (workDone > 0 && progress[building] !== undefined) {
      const pending = queue[building] || 0;
      const label = building.replace(/_/g, " ");

      const goldPerUnit = BUILDING_GOLD_COST[building] || 0;
      const landPerUnit = BUILDING_LAND_COST[building] || 0;

      const buildResStr = (count) => {
        const resParts = [];
        if (goldPerUnit > 0) resParts.push(`${(goldPerUnit * count).toLocaleString()} gc`);
        if (landPerUnit > 0) resParts.push(`${(landPerUnit * count).toLocaleString()} land`);
        return resParts.length > 0 ? ` (${resParts.join(", ")})` : "";
      };

      if (progress[building] >= cost) {
        // Effort-complete but not yet applied — for resource-chain buildings
        // this means it's blocked on lower-tier supply (see the "limited
        // to 0 — needs N X per unit" warning above), not that it's slow.
        // Showing "% done"/"turns left" here would read as e.g. "467% done,
        // ~-4 turns left" since progress keeps accumulating while blocked.
        updates._build_estimates.push(
          `${pending || 1} ${label} ready — waiting on resources${buildResStr(pending || 1)}`,
        );
      } else if (workDone >= cost) {
        const nextTurn = Math.floor((progress[building] + workDone) / cost);
        const totalCount = pending + (nextTurn > 0 ? nextTurn : 0);
        if (totalCount > 0) {
          updates._build_estimates.push(
            `${totalCount} ${label} finishing next turn${buildResStr(totalCount)}`,
          );
        }
      } else {
        const turnsLeft = Math.ceil(
          (cost - Math.max(0, progress[building])) / workDone,
        );
        const pct = Math.min(100, Math.floor((Math.max(0, progress[building]) / cost) * 100));
        const count = pending || 1;
        updates._build_estimates.push(
          `${count} ${label} — ${pct}% done, ~${turnsLeft} turn${turnsLeft === 1 ? "" : "s"} left${buildResStr(count)}`,
        );
      }
    }
  }

  const hammerCount = k[hl] || 0;
  if (hammerCount > 0 && activeBuildings.size > 0 && totalEngineersWorked > 0) {
    const hammersUsedThisTurn = Math.min(hammerCount, totalEngineersWorked);
    const used = k.hammer_turns_used + hammersUsedThisTurn;
    const breaks = Math.floor(used / 40);
    if (breaks > 0) {
      const newCount = Math.max(0, hammerCount - breaks);
      updates[hl] = newCount;
      updates.hammer_turns_used = used - breaks * 40;
      updates._hammerBreakMsg = `${breaks} hammer${breaks > 1 ? "s" : ""} wore out and broke.`;
    } else {
      updates.hammer_turns_used = used;
    }
  }

  if (updates._hammerBreakMsg) {
    constructionNotes.push(updates._hammerBreakMsg);
  }

  if (blueprintsUsed > 0)
    updates.blueprints_stored = Math.max(
      0,
      k.blueprints_stored - blueprintsUsed,
    );
  if (scaffoldingUsed > 0) updates[sl] = Math.max(0, scaffoldingLeft);

  if (updates._blueprint_needed) delete updates._blueprint_needed;
  if (updates._scaffolding_needed) delete updates._scaffolding_needed;
  delete updates._low_gold;

  for (const b of Object.keys(allocation)) {
    if (RESOURCE_BUILDING_CONFIG[b] && !(queue[b] > 0)) {
      delete allocation[b];
      delete progress[b];
    }
  }

  for (const b of Object.keys(progress)) {
    if (!allocation[b] && !queue[b]) delete progress[b];
  }

  updates.build_queue = JSON.stringify(queue);
  updates.build_progress = JSON.stringify(progress);

  const finalBuildAlloc = {};
  const finalResourceAlloc = {};
  for (const [building, eng] of Object.entries(allocation)) {
    if (RESOURCE_BUILDING_CONFIG[building]) {
      finalResourceAlloc[building] = eng;
    } else {
      finalBuildAlloc[building] = eng;
    }
  }
  updates.build_allocation = JSON.stringify(finalBuildAlloc);
  updates.resource_build_allocation = JSON.stringify(finalResourceAlloc);

  if (completedItems.length > 0) {
    const totalCompleted = completedItems.reduce(function (s, item) {
      const match = item.match(/^(\d[\d,]*)/);
      return s + (match ? parseInt(match[1].replace(/,/g, "")) : 1);
    }, 0);

    progressGoal(k, updates, 'building_built', totalCompleted);

    const conXp = awardXp({ ...k, xp_sources: xpSourcesAccum }, "construction", totalCompleted);
    updates.xp = conXp.xp;
    updates.level = conXp.level;
    if (conXp.levelled) events.push(...conXp.events);
    updates.xp_sources_updated = conXp.xp_sources;

    const engXpRes = awardTroopXp(
      { ...k, troop_levels: updates.troop_levels || k.troop_levels },
      "engineers",
      totalCompleted * 3,
    );
    updates.troop_levels = typeof engXpRes.troop_levels === "string" ? JSON.parse(engXpRes.troop_levels) : engXpRes.troop_levels;

    let finalMsg = "";
    if (completedItems.length > 0) {
      finalMsg += `Completed: ${completedItems.join(", ")}. `;
    }
    if (updates._build_estimates && updates._build_estimates.length > 0) {
        finalMsg += `Under construction: ${updates._build_estimates.join("; ")}. `;
    }
    if (constructionNotes.length > 0) {
      finalMsg += constructionNotes.join(" ") + " ";
    }
    if (engXpRes.levelUps.length) {
      const engLvl = safeJsonParse(engXpRes.troop_levels, {}, "auto:troop_levels").engineers?.level || "";
      finalMsg += `⚒️ Engineers grew more skilled (Level ${engLvl})!`;
    }

    if (finalMsg) {
      events.push({ type: "system", message: `🏗️ ${finalMsg.trim()}` });
    }
  } else if (activeBuildings.size > 0) {
    let finalMsg = "";
    if (updates._build_estimates && updates._build_estimates.length > 0) {
        finalMsg += `Under construction: ${updates._build_estimates.join("; ")}. `;
    } else if (constructionNotes.length === 0) {
      if (totalEngineersWorked > 0) {
        finalMsg += `Engineers making progress on ${activeBuildings.size} building type${activeBuildings.size > 1 ? "s" : ""}. `;
      } else {
        finalMsg += `No engineers assigned to construct ${activeBuildings.size} building type${activeBuildings.size > 1 ? "s" : ""} in queue. `;
      }
    }
    if (constructionNotes.length > 0) {
      finalMsg += constructionNotes.join(" ");
    }
    events.push({ type: "system", message: `🏗️ ${finalMsg.trim()}` });
  }

  delete updates._build_estimates;
  delete updates._hammerBreakMsg;

  return updates;
}

function forgeTools(k, toolType, quantity) {
  const cost = TOOL_GOLD_COST[toolType];
  const col = TOOL_COL[toolType];
  if (!cost || !col) return { error: "Unknown tool type" };
  const totalCost = cost * quantity;
  if (totalCost > k.gold)
    return {
      error: `Need ${totalCost.toLocaleString()} gold but only have ${k.gold.toLocaleString()} gold`,
    };
  return {
    updates: {
      [col]: (k[col] || 0) + quantity,
      gold: k.gold - totalCost,
      updated_at: Math.floor(Date.now() / 1000),
    },
    totalCost,
  };
}

function demolishBuilding(k, buildingKey, amount) {
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
      gold: k.gold + goldRefund,
      land: k.land + landRefund,
    },
    refund: { gold: goldRefund, land: landRefund, count: toDemolish },
  };
}

module.exports = {
  studyDiscipline,
  _selectSchool,
  queueBuildings,
  processBuildQueue,
  forgeTools,
  demolishBuilding,
};
