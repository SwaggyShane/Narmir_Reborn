'use strict';
// Prestige Roadmap A — unit tests (EVOLUTION.md)
// Run: node test/prestige.test.js

const assert = require('assert');
const prestige = require('../game/prestige');
const { applyPrestigeCombatMultiplier } = require('../game/prestige/combat');
const { buildWipeUpdates, ZERO_BUILDINGS, STARTER_BUILDINGS, KEEP_COLUMNS, getMappedUpdateKeys } = require('../game/prestige/wipe');
const { landSeed, goldSeed, PRESTIGE_LEVEL_GATE, PRESTIGE_COOLDOWN_TURNS } = require('../game/prestige/balance');

function baseKingdom(over = {}) {
  return {
    id: 1,
    level: 500,
    prestige_level: 0,
    last_prestige_turn: 0,
    turn: 100,
    land: 9999,
    gold: 1,
    race: 'human',
    name: 'Test',
    ...over,
  };
}

console.log('prestige canPrestige gates');
assert.strictEqual(prestige.canPrestige(baseKingdom({ level: 499 })), false);
assert.strictEqual(prestige.canPrestige(baseKingdom({ level: 500 })), true);
assert.strictEqual(prestige.canPrestige(baseKingdom({ level: 500, last_prestige_turn: 0 })), true);
assert.strictEqual(prestige.canPrestige(baseKingdom({ level: 500, last_prestige_turn: null })), true);
assert.strictEqual(
  prestige.canPrestige(baseKingdom({ level: 500, last_prestige_turn: 90, turn: 100 })),
  false,
  'cooldown',
);
assert.strictEqual(
  prestige.canPrestige(baseKingdom({ level: 500, last_prestige_turn: 90, turn: 90 + PRESTIGE_COOLDOWN_TURNS })),
  true,
  'cooldown elapsed',
);
assert.strictEqual(
  prestige.canPrestige(
    baseKingdom({ level: 500, evolution_ritual: JSON.stringify({ state: 'CHANNELING' }) }),
  ),
  false,
  'ritual blocks',
);

console.log('prestige combat invariant P0/P5');
const basePower = 10000;
const p0 = applyPrestigeCombatMultiplier(basePower, 0);
const p5 = applyPrestigeCombatMultiplier(basePower, 5);
assert.strictEqual(p0, 10000);
assert.strictEqual(p5, 10500);
assert.strictEqual(p5 / p0, 1.05);
assert.strictEqual(applyPrestigeCombatMultiplier(basePower, 99), 10500, 'cap at 5');

console.log('prestige wipe contract');
const { updates, newPrestigeLevel } = buildWipeUpdates(baseKingdom({ prestige_level: 2, turn: 55 }));
assert.strictEqual(newPrestigeLevel, 3);
assert.strictEqual(updates.prestige_level, 3);
assert.strictEqual(updates.last_prestige_turn, 55);
assert.strictEqual(updates.level, 1);
assert.strictEqual(updates.xp, 0);
assert.strictEqual(updates.land, landSeed(3));
assert.strictEqual(updates.gold, goldSeed(3));
assert.strictEqual(updates.bld_farms, STARTER_BUILDINGS.bld_farms);
assert.strictEqual(updates.bld_castles, 0);
assert.strictEqual(updates.fighters, 0);
assert.strictEqual(updates.trade_routes, 0);
assert.strictEqual(updates.items, '[]');
assert.strictEqual(updates.world_fragments, '[]');
for (const b of ZERO_BUILDINGS) {
  assert.strictEqual(updates[b], 0, b);
}
assert.notStrictEqual(updates.land, 9999, 'must not keep old land');

console.log('prestige processPrestige');
const bad = prestige.processPrestige(baseKingdom({ level: 10 }));
assert.ok(bad.error);
const good = prestige.processPrestige(baseKingdom({ level: 500, prestige_level: 0 }));
assert.ok(good.updates);
assert.strictEqual(good.newPrestigeLevel, 1);
assert.strictEqual(good.seeds.land, landSeed(1));
assert.strictEqual(PRESTIGE_LEVEL_GATE, 500);

console.log('prestige mapped keys non-empty');
assert.ok(getMappedUpdateKeys().length > 40);
assert.ok(KEEP_COLUMNS.includes('race'));

console.log('✓ prestige.test.js passed');
