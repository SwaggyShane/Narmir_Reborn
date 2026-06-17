/**
 * Construction System
 * Handles building queue, build queue processing, and demolition
 */

const config = require('./config');
const {
  BUILDING_COST,
  BUILDING_GOLD_COST,
  BUILDING_LAND_COST,
  BUILDING_WOOD_COST,
  BUILDING_STONE_COST,
  BUILDING_IRON_COST,
  BUILDING_COL,
  BUILDING_ALIASES,
  TOOL_COL,
  RESOURCE_BUILDING_CONFIG,
  BLUEPRINT_REQUIRED: BP_REQ,
  SCAFFOLDING_REQUIRED: SCAFF_REQ,
} = config;
const BLUEPRINT_REQUIRED = new Set(BP_REQ);
const SCAFFOLDING_REQUIRED = new Set(SCAFF_REQ);
const { safeJsonParse, devLog } = require('../utils/helpers');
const { raceBonus } = require('./lib/race-bonus');
const { awardTroopXp, unitLevelMult } = require('./lib/troops');
const fragmentBonusManager = require('./fragment-bonus-manager');
const recruitmentMod = require('./recruitment');
const { progressGoal } = require('./goals');
const { awardXp } = require('./xp');

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
    const n = Math.max(0, Number(qty));
    if (n <= 0) continue;

    // Check Cap
    const col = BUILDING_COL[key];
    const currentBuilt = k[col] || 0;
    const currentQueued = queue[key] || 0;
    const cap = recruitmentMod.getCap(col, k.level || 1, k.prestige_level || 0);

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

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Resource building bracket-lock validation + resource cost ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  const level = k.level || 1;
  const resSeqRaw = safeJsonParse(k.resource_sequence, {}, 'queueBuildings:resource_sequence');
  let totalWoodCost = 0;
  let totalStoneCost = 0;
  let totalIronCost = 0;

  // Pre-compute resource types already in queue so we can catch same-type duplicates
  // within a single batch request (neither building would be in queue yet during the loop).
  const queuedTypes = new Set();
  for (const [qKey, qCount] of Object.entries(queue)) {
    if (qCount > 0) {
      const qRbCfg = RESOURCE_BUILDING_CONFIG[qKey];
      if (qRbCfg) queuedTypes.add(qRbCfg.type);
    }
  }

  for (const [key, n] of Object.entries(processedOrders)) {
    const rbCfg = RESOURCE_BUILDING_CONFIG[key];
    if (!rbCfg) continue; // Not a resource building

    // Enforce one-slot-per-resource-type (covers existing queue and current batch)
    if (queuedTypes.has(rbCfg.type)) {
      return { error: `A ${rbCfg.type} building is already in progress or queued. Only one ${rbCfg.type} build slot is allowed at a time.` };
    }
    queuedTypes.add(rbCfg.type);

    const seq = resSeqRaw[rbCfg.type] || { s2_paid_at_bracket: -1, s3_paid_at_bracket: -1, last_s3_bracket: -1 };
    const s3Col = config.RESOURCE_STAGE3_COL[rbCfg.type];
    const s3Cap = Math.floor((level - 1) / 10) + 1;
    const s3Current = k[s3Col] || 0;

    const s1Col = config.RESOURCE_STAGE1_COL[rbCfg.type];
    const s2Col = config.RESOURCE_STAGE2_COL[rbCfg.type];

    if (rbCfg.stage === 1) {
      if (s3Current >= s3Cap) {
        return { error: `${key.replace(/_/g, ' ')} is locked ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â you have reached the maximum number of stage-3 ${rbCfg.type} buildings (${s3Cap}) for your level.` };
      }
      // Stage 1 hard cap of 3
      const s1Current = k[s1Col] || 0;
      if (s1Current + n > 3) {
        return { error: `${key.replace(/_/g, ' ')} cap reached (max 3).` };
      }
      const s2Current = (k[s2Col] || 0) + (queue[config.RESOURCE_STAGE2_BUILDINGS[rbCfg.type]] || 0);
      if (s2Current > 0) {
        return { error: `${key.replace(/_/g, ' ')} is locked ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â you already have Stage 2 ${rbCfg.type} buildings in progress or built.` };
      }
    } else if (rbCfg.stage === 2) {
      if (s3Current >= s3Cap) {
        return { error: `${key.replace(/_/g, ' ')} is locked ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â you have reached the maximum number of stage-3 ${rbCfg.type} buildings (${s3Cap}) for your level.` };
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

  // Tool bonuses
  const hl = TOOL_COL.hammers;
  const sl = TOOL_COL.scaffolding;
  const hammerBonus = 1 + (k[hl] || 0) * 0.05;
  const smithyBonus = 1 + Math.floor((k.bld_smithies || 0) / 15) * 0.02;
  const raceConstr = raceBonus(k, "construction");
  const engLevelMult = unitLevelMult(k, "engineers");
  const resConstr = (k.res_construction || 100) / 100;
  const smithySpeedMult = fragmentBonusManager.getBonusMultiplier(k, 'smithies', 'speed');
  const smithyProdMult = fragmentBonusManager.getBonusMultiplier(k, 'smithies', 'production');
  const smithyQualityMult = fragmentBonusManager.getBonusMultiplier(k, 'smithies', 'quality');
  const effectiveSmithyMult = smithySpeedMult * smithyProdMult * smithyQualityMult;
  const baseToolMult =
    hammerBonus * smithyBonus * raceConstr * engLevelMult * resConstr * effectiveSmithyMult;

  // Consumable tool pools ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â tracked across the building loop this turn
  let blueprintsLeft = k.blueprints_stored || 0;
  let scaffoldingLeft = k[sl] || 0;
  let blueprintsUsed = 0;
  let scaffoldingUsed = 0;

  // Get engineer allocation (both regular builds and resource builds)
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

  // Also check legacy build_queue for any manually queued items
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

  // Normalize progress
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

  // Regular buildings complete from allocation alone; resource buildings require
  // a queue entry. Include both so allocation-driven regular builds are processed.
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

    // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Blueprint gate ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â required for buildings with base cost >= 100 turns ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
    if (BLUEPRINT_REQUIRED.has(building) && blueprintsLeft <= 0) {
      updates._blueprint_needed = updates._blueprint_needed || [];
      if (!updates._blueprint_needed.includes(building))
        updates._blueprint_needed.push(building);
      continue; // skip this building entirely this turn
    }

    // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Scaffolding gate ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â required for buildings > 100 turns base ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
    if (SCAFFOLDING_REQUIRED.has(building) && scaffoldingLeft <= 0) {
      updates._scaffolding_needed = updates._scaffolding_needed || [];
      if (!updates._scaffolding_needed.includes(building))
        updates._scaffolding_needed.push(building);
      continue;
    }

    // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Per-building tool multiplier ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
    let toolMult = baseToolMult;

    // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Resource building race bonus (additional multiplier) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
    if (RESOURCE_BUILDING_CONFIG[building]) {
      toolMult *= raceBonus(k, 'resource_build');
    }

    const buildMb = safeJsonParse(k.milestone_bonuses, {}, "build:mb");
    const buildMilestoneMult = 1 + (buildMb.construction_speed_pct || 0) / 100;
    let workDone = Math.floor(engAssigned * toolMult * buildMilestoneMult);
    if (engAssigned > 0 && workDone <= 0) workDone = 1; // Prevent complete stalling for low bonuses
    if (workDone <= 0) continue;

    // Resource buildings require a queue entry ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â engineers alone cannot build them
    if (RESOURCE_BUILDING_CONFIG[building] && !(queue[building] > 0)) continue;

    totalEngineersWorked += engAssigned;

    // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Completion ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
    const prevProgress = progress[building] || 0;
    const totalProgress = prevProgress + workDone;
    const rawCompleted = Math.floor(totalProgress / cost);
    // Resource buildings require a queue entry ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â completion capped to queue count.
    // Regular buildings (farms, barracks, etc.) complete freely from allocation;
    // they have no per-unit gold/land deduction via queue.
    // Resource buildings: capped by queue count (queue entry required, already
    // enforced by the continue above). Regular buildings: complete from rawCompleted.
    const completed = RESOURCE_BUILDING_CONFIG[building]
      ? Math.min(rawCompleted, queue[building])
      : rawCompleted;

    if (completed > 0) {
      const col =
        k.race === "vampire" &&
        (building === "shrines" || building === "shrine")
          ? "bld_mausoleums"
          : BUILDING_COL[building];
      if (col) {
        const current = updates[col] !== undefined ? updates[col] : k[col] || 0;
        const cap = recruitmentMod.getCap(col, k.level || 1, k.prestige_level || 0);
        let canAdd = Math.max(0, Math.min(completed, cap - current));

        // Regular buildings: units from the queue were already paid in queueBuildings;
        // only deduct gold/land/resources for units built beyond the queue via engineer allocation.
        if (!RESOURCE_BUILDING_CONFIG[building] && canAdd > 0) {
          const goldPerUnit = BUILDING_GOLD_COST[building] ?? 100;
          const landPerUnit = BUILDING_LAND_COST[building] || 0;
          const woodPerUnit = BUILDING_WOOD_COST[building] || 0;
          const stonePerUnit = BUILDING_STONE_COST[building] || 0;
          const ironPerUnit = BUILDING_IRON_COST[building] || 0;

          const fromQueue = Math.min(canAdd, queue[building] || 0);
          let extraUnits = canAdd - fromQueue;

          if (extraUnits > 0) {
            if (goldPerUnit > 0) {
              const curGold = updates.gold !== undefined ? updates.gold : k.gold;
              extraUnits = Math.max(0, Math.min(extraUnits, Math.floor(curGold / goldPerUnit)));
            }
            if (landPerUnit > 0 && extraUnits > 0) {
              let totalUsedLand = 0;
              for (const [bKey, bCost] of Object.entries(BUILDING_LAND_COST)) {
                const bCol = BUILDING_COL[bKey];
                if (bCol) totalUsedLand += (updates[bCol] !== undefined ? updates[bCol] : (k[bCol] || 0)) * bCost;
                totalUsedLand += (queue[bKey] || 0) * bCost;
              }
              const availLand = (updates.land !== undefined ? updates.land : k.land) - totalUsedLand;
              extraUnits = Math.max(0, Math.min(extraUnits, Math.floor(availLand / landPerUnit)));
            }
            if (woodPerUnit > 0 && extraUnits > 0) {
              const curWood = updates.wood !== undefined ? updates.wood : k.wood;
              extraUnits = Math.max(0, Math.min(extraUnits, Math.floor(curWood / woodPerUnit)));
            }
            if (stonePerUnit > 0 && extraUnits > 0) {
              const curStone = updates.stone !== undefined ? updates.stone : k.stone;
              extraUnits = Math.max(0, Math.min(extraUnits, Math.floor(curStone / stonePerUnit)));
            }
            if (ironPerUnit > 0 && extraUnits > 0) {
              const curIron = updates.iron !== undefined ? updates.iron : k.iron;
              extraUnits = Math.max(0, Math.min(extraUnits, Math.floor(curIron / ironPerUnit)));
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
          if (finalCanAdd < canAdd && finalCanAdd === 0) {
            const curGold = updates.gold !== undefined ? updates.gold : k.gold;
            const curWood = updates.wood !== undefined ? updates.wood : k.wood;
            const curStone = updates.stone !== undefined ? updates.stone : k.stone;
            const curIron = updates.iron !== undefined ? updates.iron : k.iron;
            let reason = 'gold';
            if (goldPerUnit > 0 && curGold < goldPerUnit) reason = 'gold';
            else if (woodPerUnit > 0 && curWood < woodPerUnit) reason = 'wood';
            else if (stonePerUnit > 0 && curStone < stonePerUnit) reason = 'stone';
            else if (ironPerUnit > 0 && curIron < ironPerUnit) reason = 'iron';
            constructionNotes.push(`ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â ${building.replace(/_/g, ' ')} paused ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â not enough ${reason}.`);
          }
          canAdd = finalCanAdd;
        }

        updates[col] = current + canAdd;
        if (canAdd < completed && canAdd === 0) {
          constructionNotes.push(
            `ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â ${building.replace(/_/g, " ")} cap reached at level ${k.level || 1} (max ${cap.toLocaleString()}) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â level up to build more.`,
          );
        }
        if (canAdd > 0) {
          completedItems.push(
            `${canAdd.toLocaleString()} ${building.replace(/_/g, " ")}`,
          );

          // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Consume blueprint on completion ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
          if (BLUEPRINT_REQUIRED.has(building)) {
            const consume = Math.min(canAdd, blueprintsLeft);
            blueprintsLeft -= consume;
            blueprintsUsed += consume;
          }

          // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Consume scaffolding on completion ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
          if (SCAFFOLDING_REQUIRED.has(building)) {
            const consume = Math.min(canAdd, scaffoldingLeft);
            scaffoldingLeft -= consume;
            scaffoldingUsed += consume;
          }

          // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Resource building auto-consumption on first completion ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
          // Stage 2 (lumber_camp/blockfield/strip_mine): on first one, consume 3 stage-1
          // Stage 3 (sawmill/stone_quarry/deep_mine): on first one per bracket, consume 5 stage-2
          const rbCfg = RESOURCE_BUILDING_CONFIG[building];
          if (rbCfg) {
            const level = k.level || 1;
            const currentBracket = Math.floor((level - 1) / 10);
            const resSeq = safeJsonParse(k.resource_sequence, {}, 'processBuildQueue:resource_sequence');
            const typeSeq = resSeq[rbCfg.type] || { s2_paid_at_bracket: -1, s3_paid_at_bracket: -1, last_s3_bracket: -1 };

            if (rbCfg.stage === 2) {
              // First stage-2 built: consume 3 stage-1 and return 3 land
              const prevCount = (k[col] !== undefined ? k[col] : 0);
              if (prevCount === 0 && canAdd >= 1) {
                const s1Col = config.RESOURCE_STAGE1_COL[rbCfg.type];
                if (s1Col) {
                  const s1Current = updates[s1Col] !== undefined ? updates[s1Col] : (k[s1Col] || 0);
                  const toConsume = Math.min(s1Current, 3);
                  updates[s1Col] = s1Current - toConsume;
                  updates.land = (updates.land !== undefined ? updates.land : k.land) + toConsume;
                  constructionNotes.push(`ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Å¾ 3 ${s1Col.replace('bld_', '')} converted into ${building.replace(/_/g, ' ')}.`);
                }
              }
            } else if (rbCfg.stage === 3) {
              // First stage-3 in this bracket: consume 5 stage-2, return 10 land, lock bracket
              const newS3Count = current + canAdd;
              // "first one in this bracket" means the new total is now > 0 and bracket wasn't locked
              if (newS3Count > 0 && typeSeq.last_s3_bracket !== currentBracket) {
                const s2Col = config.RESOURCE_STAGE2_COL[rbCfg.type];
                if (s2Col) {
                  const s2Current = updates[s2Col] !== undefined ? updates[s2Col] : (k[s2Col] || 0);
                  const toConsume = Math.min(s2Current, 5);
                  updates[s2Col] = s2Current - toConsume;
                  updates.land = (updates.land !== undefined ? updates.land : k.land) + (toConsume * 3);
                  // Lock the bracket
                  const updatedSeq = safeJsonParse(updates.resource_sequence || k.resource_sequence, {}, 'processBuildQueue:resource_sequence_update');
                  if (!updatedSeq[rbCfg.type]) updatedSeq[rbCfg.type] = { s2_paid_at_bracket: -1, s3_paid_at_bracket: -1, last_s3_bracket: -1 };
                  updatedSeq[rbCfg.type].last_s3_bracket = currentBracket;
                  updates.resource_sequence = JSON.stringify(updatedSeq);
                  constructionNotes.push(`ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Å¾ 5 ${s2Col.replace('bld_', '')} consumed. ${building.replace(/_/g, ' ')} bracket locked.`);
                }
              }
            }
          }
        }
      }
      progress[building] = totalProgress - completed * cost;
      if (queue[building] > 0) {
        queue[building] = Math.max(0, queue[building] - completed);
        if (queue[building] <= 0) {
          delete queue[building];
          if (RESOURCE_BUILDING_CONFIG[building]) {
            // Production buildings auto-release engineers on completion
            delete allocation[building];
          }
          // Reset progress to 0 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â nothing queued to build toward
          delete progress[building];
        }
      }
    } else {
      progress[building] = totalProgress;
    }

    // Calculate active construction details for news
    if (!updates._build_estimates) updates._build_estimates = [];
    if (workDone > 0) {
      const pending = queue[building] || 0;
      const label = building.replace(/_/g, " ");

      const goldPerUnit = BUILDING_GOLD_COST[building] || 0;
      const landPerUnit = BUILDING_LAND_COST[building] || 0;

      const buildResStr = (count) => {
        const resParts = [];
        if (goldPerUnit > 0) resParts.push(`${(goldPerUnit * count).toLocaleString()} gc`);
        if (landPerUnit > 0) resParts.push(`${(landPerUnit * count).toLocaleString()} land`);
        return resParts.length > 0 ? ` (Using ${resParts.join(" & ")})` : "";
      };

      if (workDone >= cost) {
        const nextTurn = Math.floor((progress[building] + workDone) / cost);
        const totalCount = pending + (nextTurn > 0 ? nextTurn : 0);
        updates._build_estimates.push(
          `${totalCount} ${label} concluding [~${nextTurn} next turn]${buildResStr(totalCount)}`,
        );
      } else {
        const turnsLeft = Math.ceil(
          (cost - Math.max(0, progress[building])) / workDone,
        );
        const pct = Math.floor((Math.max(0, progress[building]) / cost) * 100);
        const count = pending || 1;
        updates._build_estimates.push(
          `${count} ${label} [${pct}% done, ~${turnsLeft} turns left]${buildResStr(count)}`,
        );
      }
    }
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Hammer degradation ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  const hammerCount = k[hl] || 0;
  if (hammerCount > 0 && activeBuildings.size > 0 && totalEngineersWorked > 0) {
    const hammersUsedThisTurn = Math.min(hammerCount, totalEngineersWorked);
    const used = (k.hammer_turns_used || 0) + hammersUsedThisTurn;
    const breaks = Math.floor(used / 40); // 1 hammer breaks every 40 turns of use
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

  // News notices for missing tools
  if (updates._blueprint_needed) delete updates._blueprint_needed;
  if (updates._scaffolding_needed) delete updates._scaffolding_needed;
  delete updates._low_gold;

  // Release engineers from resource buildings with no queue entry (stragglers
  // not caught in the loop's completion block).
  for (const b of Object.keys(allocation)) {
    if (RESOURCE_BUILDING_CONFIG[b] && !(queue[b] > 0)) {
      delete allocation[b];
      delete progress[b];
    }
  }

  // Clean up zero-progress entries for fully inactive buildings
  for (const b of Object.keys(progress)) {
    if (!allocation[b] && !queue[b]) delete progress[b];
  }

  updates.build_queue = JSON.stringify(queue);
  updates.build_progress = JSON.stringify(progress);

  // Split allocation back into regular and resource allocations
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

    // Award engineer unit XP per building completed
    const engXpRes = awardTroopXp(
      { ...k, troop_levels: updates.troop_levels || k.troop_levels },
      "engineers",
      totalCompleted * 10,
    );
    updates.troop_levels = typeof engXpRes.troop_levels === "string" ? JSON.parse(engXpRes.troop_levels) : engXpRes.troop_levels;

    let finalMsg = "";
    if (completedItems.length > 0) {
      finalMsg += `Completed: ${completedItems.join(", ")}. `;
    }
    if (updates._build_estimates && updates._build_estimates.length > 0) {
      finalMsg += `Actively constructing: ${updates._build_estimates.join(" Ãƒâ€šÃ‚Â· ")}. `;
    }
    if (constructionNotes.length > 0) {
      finalMsg += constructionNotes.join(" ") + " ";
    }
    if (engXpRes.levelUps.length) {
      const engLvl = safeJsonParse(engXpRes.troop_levels, {}, "auto:troop_levels").engineers?.level || "";
      finalMsg += `ÃƒÂ¢Ã…Â¡Ã¢â‚¬â„¢ÃƒÂ¯Ã‚Â¸Ã‚Â Engineers grew more skilled (Level ${engLvl})!`;
    }

    if (finalMsg) {
      events.push({ type: "system", message: `ÃƒÂ°Ã…Â¸Ã‚ÂÃ¢â‚¬â€ÃƒÂ¯Ã‚Â¸Ã‚Â ${finalMsg.trim()}` });
    }
  } else if (activeBuildings.size > 0) {
    let finalMsg = "";
    if (updates._build_estimates && updates._build_estimates.length > 0) {
      finalMsg += `Actively constructing: ${updates._build_estimates.join(" Ãƒâ€šÃ‚Â· ")}. `;
    } else {
      if (totalEngineersWorked > 0) {
        finalMsg += `Engineers making progress on ${activeBuildings.size} building type${activeBuildings.size > 1 ? "s" : ""}. `;
      } else {
        finalMsg += `No engineers assigned to construct ${activeBuildings.size} building type${activeBuildings.size > 1 ? "s" : ""} in queue. `;
      }
    }
    if (constructionNotes.length > 0) {
      finalMsg += constructionNotes.join(" ");
    }
    events.push({ type: "system", message: `ÃƒÂ°Ã…Â¸Ã‚ÂÃ¢â‚¬â€ÃƒÂ¯Ã‚Â¸Ã‚Â ${finalMsg.trim()}` });
  }

  delete updates._build_estimates;
  delete updates._hammerBreakMsg;

  return updates;
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
  queueBuildings,
  processBuildQueue,
  demolishBuilding,
};
