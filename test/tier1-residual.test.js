'use strict';

const assert = require('assert');
const { structureUpdates } = require('../routes/response-structurer');
const { calculateMovementCost } = require('../game/world-elevation');
const { getEpicTrekTurns, getPathHexes } = require('../game/epic-trek-paths');

console.log('Testing Tier-1 residual wires\n');

// Worldmap-shaped updates must domain-structure discovered_kingdoms
{
  const flat = { discovered_kingdoms: JSON.stringify({ '12': { found: true, mapped: true } }) };
  const s = structureUpdates(flat);
  assert.ok(s.economy?.discovered_kingdoms, 'discovered_kingdoms lands in economy (structurer map)');
  assert.strictEqual(typeof s.economy.discovered_kingdoms, 'string');
  console.log('Test 1: structureUpdates worldmap fields ✓');
}

// Elevation movement: flat/downhill free, uphill taxed
{
  const flags = { FEATURE_ELEVATION_MOVEMENT: true };
  assert.strictEqual(calculateMovementCost(100, 100, flags), 1.0);
  assert.strictEqual(calculateMovementCost(100, 80, flags), 1.0);
  // elevChange 10 → fatigue 1 → 1.3 + 0.05; elevChange 1–9 → base 1.3 only
  assert.strictEqual(calculateMovementCost(10, 19, flags), 1.3);
  assert.ok(calculateMovementCost(10, 50, flags) > 1.3);
  assert.strictEqual(calculateMovementCost(10, 50, {}), 1.0, 'flag off → 1.0');
  console.log('Test 2: calculateMovementCost flat vs uphill ✓');
}

// Epic trek: flat grid matches no-elevation cost
{
  const sx = 50, sy = 50, tx = 300, ty = 200;
  const path = getPathHexes(sx, sy, tx, ty);
  const flatGrid = {};
  path.forEach((h) => { flatGrid[`${h.col},${h.row}`] = 20; });
  const getFlag = (n) => n === 'FEATURE_ELEVATION_MOVEMENT';
  const base = getEpicTrekTurns(sx, sy, tx, ty, {});
  const flat = getEpicTrekTurns(sx, sy, tx, ty, { getFlag, elevationGrid: flatGrid });
  assert.strictEqual(flat, base);
  console.log('Test 3: epic trek flat path equals baseline ✓');
}

// active_effects → profile domain
{
  const s = structureUpdates({
    active_effects: JSON.stringify({ shield: { turns_left: 4 } }),
    gold: 100,
  });
  assert.strictEqual(s.profile.active_effects, JSON.stringify({ shield: { turns_left: 4 } }));
  assert.strictEqual(s.economy.gold, 100);
  console.log('Test 4: active_effects routes to profile ✓');
}

console.log('\nAll Tier-1 residual tests passed.');
