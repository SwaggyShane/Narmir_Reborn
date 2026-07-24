'use strict';
// Regression: processBuildQueue's per-turn construction status message must
// accurately describe why a building isn't progressing.
//
// Bug 1: assigning engineers to a blueprint-gated building (e.g. markets)
// with zero blueprints produced "No engineers assigned..." even though
// engineers WERE assigned — the blueprint gate `continue`s before
// totalEngineersWorked is incremented, and the tracked shortage
// (_blueprint_needed) was computed then silently discarded.
//
// Bug 2: when a build is blocked by a genuinely scarce resource other than
// gold (land, wood, stone, iron), the message-building code recomputed the
// blocking reason from scratch instead of reusing the already-correct
// `blockReason` from the gating logic — and that recompute never checked
// land at all, so a land shortage was misreported as "not enough gold".
//
// Run: node test/build-progress-messages.test.js

const assert = require('assert');
const { processBuildQueue } = require('../game/lib/building-research');

function makeKingdom(overrides = {}) {
  return {
    race: 'human',
    level: 50,
    prestige_level: 0,
    gold: 39000000,
    land: 100000,
    wood: 100000,
    stone: 100000,
    iron: 100000,
    hammers_stored: 0,
    scaffolding_stored: 0,
    blueprints_stored: 0,
    bld_smithies: 0,
    bld_markets: 0,
    build_allocation: '{}',
    resource_build_allocation: '{}',
    build_queue: '{}',
    build_progress: '{}',
    res_construction: 100,
    milestone_bonuses: '{}',
    troop_levels: '{}',
    ...overrides,
  };
}

// processBuildQueue pushes its status onto an `events` array we pass in.
function runTurn(k) {
  const events = [];
  const updates = processBuildQueue(k, events, {});
  const msg = events.find((e) => e.type === 'system' && e.message.includes('🏗️'));
  return { updates, message: msg ? msg.message : '' };
}

// Test 1: engineers assigned to a blueprint-gated building with 0 blueprints
// must NOT be reported as "No engineers assigned" — that's factually wrong.
{
  const k = makeKingdom({
    blueprints_stored: 0,
    build_allocation: JSON.stringify({ markets: 1000 }),
  });
  const { message } = runTurn(k);
  assert.ok(
    !/No engineers assigned/i.test(message),
    `message must not claim no engineers are assigned when 1000 are: "${message}"`,
  );
  assert.ok(
    /blueprints/i.test(message),
    `message should explain the real blocker (blueprints): "${message}"`,
  );
  console.log('Test 1: blueprint-blocked build reports blueprints, not "no engineers" ✓');
}

// Test 2: same, for scaffolding-gated buildings (e.g. training).
{
  const k = makeKingdom({
    blueprints_stored: 1000,
    scaffolding_stored: 0,
    build_allocation: JSON.stringify({ training: 500 }),
  });
  const { message } = runTurn(k);
  assert.ok(
    !/No engineers assigned/i.test(message),
    `message must not claim no engineers are assigned when 500 are: "${message}"`,
  );
  assert.ok(
    /scaffolding/i.test(message),
    `message should explain the real blocker (scaffolding): "${message}"`,
  );
  console.log('Test 2: scaffolding-blocked build reports scaffolding, not "no engineers" ✓');
}

// Test 3: a build blocked by insufficient LAND (not gold) must say "land",
// not fall through to the "gold" default. Give ample gold/wood/stone/iron,
// but almost no free land, and enough progress to complete a unit this turn.
{
  const k = makeKingdom({
    blueprints_stored: 999999,
    gold: 39000000,
    wood: 100000,
    stone: 100000,
    iron: 100000,
    land: 50, // markets cost 100 land/unit — not enough for even a single unit
    bld_farms: 0,
    build_allocation: JSON.stringify({ markets: 100000 }), // huge engineer count -> completes >=1 unit this turn
    build_progress: JSON.stringify({ markets: 1499 }), // 1 short of BUILDING_COST.markets (1500)
  });
  const { message } = runTurn(k);
  assert.ok(
    /you need .*land/i.test(message),
    `message should report the real blocker (land), not gold: "${message}"`,
  );
  assert.ok(
    !/you need .*gold/i.test(message),
    `message must not misreport gold as the blocker when land is scarce: "${message}"`,
  );
  console.log('Test 3: land-blocked build reports land, not the wrong "gold" default ✓');
}

console.log('build-progress-messages checks passed');
