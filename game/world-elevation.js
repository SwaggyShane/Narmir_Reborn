/**
 * World Elevation System - Phases 1, 2, 3 Integration
 * Manages elevation generation, river flow, and combat modifiers
 */

const { generateElevationGrid, getElevation, validateElevationBands } = require('./elevation.js');

/**
 * Phase 1: Generate and store elevation data for a world
 */
async function ensureWorldElevation(db, worldState, hexGrid) {
  if (!worldState || !hexGrid) return {};

  // Check if elevation already exists
  if (worldState.elevation_grid && Object.keys(worldState.elevation_grid).length > 0) {
    return worldState.elevation_grid;
  }

  // Generate elevation using world seed
  const elevationMap = generateElevationGrid(worldState.seed, hexGrid);

  // Validate bands
  const validation = validateElevationBands(elevationMap, hexGrid);
  if (!validation.valid) {
    console.warn('[elevation] Validation warnings:', validation.errors.slice(0, 5));
  }

  // Store in database
  await db.run(
    `UPDATE world_state SET elevation_grid = $1 WHERE id = 1`,
    [JSON.stringify(elevationMap)]
  );

  console.log('[elevation] Generated and stored elevation for', Object.keys(elevationMap).length, 'hexes');
  return elevationMap;
}

/**
 * Phase 2: Build downhill neighbor DAG for river flow
 */
function buildDownhillDAG(elevationMap, hexGrid) {
  const dag = {};
  const directions = [
    [-1, 0], [1, 0],   // Left, Right
    [0, -1], [0, 1],   // Up, Down
    [-1, -1], [-1, 1], // Diagonals
    [1, -1], [1, 1]
  ];

  hexGrid.cells.forEach((hex) => {
    let minNeighbor = null;
    let minElevation = getElevation(elevationMap, hex.col, hex.row);

    // Find steepest descent
    for (const [dc, dr] of directions) {
      const neighborCol = hex.col + dc;
      const neighborRow = hex.row + dr;
      const neighborElev = getElevation(elevationMap, neighborCol, neighborRow);

      if (neighborElev < minElevation) {
        minElevation = neighborElev;
        minNeighbor = { col: neighborCol, row: neighborRow };
      }
    }

    const hexId = `${hex.col},${hex.row}`;
    dag[hexId] = {
      terrain: hex.terrain,
      elevation: getElevation(elevationMap, hex.col, hex.row),
      downhill: minNeighbor,
    };
  });

  return dag;
}

/**
 * Phase 2: Compute flow accumulation (river volume per hex)
 */
function computeFlowAccumulation(dag) {
  const flow = {};
  const reverseEdges = {};

  // Initialize flow and build reverse edges
  Object.entries(dag).forEach(([hexId, data]) => {
    flow[hexId] = 1; // Every hex starts with 1 unit
    if (data.downhill) {
      const downhillId = `${data.downhill.col},${data.downhill.row}`;
      if (!reverseEdges[downhillId]) reverseEdges[downhillId] = [];
      reverseEdges[downhillId].push(hexId);
    }
  });

  // Propagate flow downhill (simple iterative approach)
  for (let iter = 0; iter < 100; iter++) {
    let changed = false;
    Object.entries(dag).forEach(([hexId, data]) => {
      if (data.downhill) {
        const downhillId = `${data.downhill.col},${data.downhill.row}`;
        const currentFlow = flow[hexId] || 1;
        flow[downhillId] = (flow[downhillId] || 0) + currentFlow;
        changed = true;
      }
    });
    if (!changed) break;
  }

  return flow;
}

/**
 * Phase 3: Calculate combat elevation modifier
 * Returns damage reduction percentage for defender based on elevation advantage
 */
function calculateElevationBonus(attackerElev, defenderElev, featureFlags = {}) {
  if (!featureFlags.FEATURE_ELEVATION_COMBAT) return 0;

  const elevDiff = (defenderElev || 0) - (attackerElev || 0);
  if (elevDiff < 1) return 0;

  return 0.07; // +7% defense reduction for high ground
}

/**
 * Phase 3: Calculate movement cost modifier based on elevation
 * Returns movement cost multiplier (1.0 = normal, 1.3 = 30% slower)
 */
function calculateMovementCost(fromElev, toElev, featureFlags = {}) {
  if (!featureFlags.FEATURE_ELEVATION_MOVEMENT) return 1.0;

  const elevChange = Math.max(0, (toElev || 0) - (fromElev || 0));
  const fatigueCost = Math.floor(elevChange / 10); // 1 point per 10 units uphill

  // Base mountain penalty (-30%)
  const basePenalty = 1.3; // 30% slower
  return basePenalty + (fatigueCost * 0.05); // Fatigue adds 5% per point
}

/**
 * Phase 3: Check if spell has line-of-sight based on elevation
 * Returns true if target is visible (not blocked by elevation)
 */
function canCastSpell(casterElev, targetElev, featureFlags = {}) {
  if (!featureFlags.FEATURE_ELEVATION_SPELLS) return true;

  // Simple LOS: high ground can always cast down, low ground blocked by higher terrain
  const elevDiff = (casterElev || 0) - (targetElev || 0);
  return elevDiff >= 0; // Caster must be at same or higher elevation
}

module.exports = {
  ensureWorldElevation,
  buildDownhillDAG,
  computeFlowAccumulation,
  calculateElevationBonus,
  calculateMovementCost,
  canCastSpell
};
