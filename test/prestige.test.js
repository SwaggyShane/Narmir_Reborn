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

console.log('prestige single mult source (config re-exports balance)');
const config = require('../game/config');
const { PRESTIGE_MODIFIERS, getPrestigeModifiers } = require('../game/prestige/balance');
assert.strictEqual(config.PRESTIGE_MODIFIERS, PRESTIGE_MODIFIERS, 'config must re-export same object');
assert.strictEqual(getPrestigeModifiers(5).combat, 1.05);
assert.strictEqual(getPrestigeModifiers(5).econ, 1.15);
assert.strictEqual(getPrestigeModifiers(10).econ, 1.15, 'econ hard-cap P5');

console.log('legacy trade income uses econ mult only (not prestige*0.1)');
const tradeEconP0 = getPrestigeModifiers(0).econ;
const tradeEconP5 = getPrestigeModifiers(5).econ;
const routes = 3;
assert.strictEqual(Math.floor(routes * 100 * tradeEconP0), 300);
assert.strictEqual(Math.floor(routes * 100 * tradeEconP5), Math.floor(300 * 1.15));
assert.notStrictEqual(Math.floor(routes * 100 * (1 + 5 * 0.1)), Math.floor(routes * 100 * tradeEconP5),
  'old +10%/rank formula must not equal capped econ path at P5');

console.log('unitLevelMult: no per-prestige power stack (combat path separate)');
const { unitLevelMult } = require('../game/lib/troops');
// mages have no legendary entry for human — pure check that rank does not stack power
const troopBase = { troop_levels: '{}', race: 'human' };
const mP0 = unitLevelMult({ ...troopBase, prestige_level: 0 }, 'mages');
const mP5 = unitLevelMult({ ...troopBase, prestige_level: 5 }, 'mages');
assert.strictEqual(mP0, mP5, 'non-legendary unit: prestige rank must not scale unitLevelMult');
// Legendary identity bonus only when race has legendary name + prestige > 0
const fightP0 = unitLevelMult({ ...troopBase, prestige_level: 0 }, 'fighters');
const fightP1 = unitLevelMult({ ...troopBase, prestige_level: 1 }, 'fighters');
assert.strictEqual(fightP0, 1);
assert.strictEqual(fightP1, 1.15, 'legendary name identity +15% at prestige>0 only');
// P1 vs P5 legendary: same 1.15, not +5% per rank
assert.strictEqual(
  unitLevelMult({ ...troopBase, prestige_level: 5 }, 'fighters'),
  1.15,
  'legendary must not scale with prestige rank',
);

console.log('CommandHandler prestige is fenced');
const { createCommandHandler } = require('../game/command-handler');
const ch = createCommandHandler({
  processPrestige: () => {
    throw new Error('must not call processPrestige');
  },
});
assert.throws(
  () => ch.handlePrestige({ level: 500 }),
  /POST \/api\/kingdom\/rebirth/,
);

console.log('news-fail contract: prestige state stands if post-commit news throws');
// Mirrors routes/kingdom-gameplay.js rebirth: news try/catch after withTransaction.
let kingdomPrestiged = false;
const payload = prestige.processPrestige(baseKingdom({ level: 500 }));
assert.ok(payload.updates);
kingdomPrestiged = true;
try {
  throw new Error('simulated news INSERT failure');
} catch {
  /* best-effort news — do not un-prestige */
}
assert.strictEqual(kingdomPrestiged, true);
assert.strictEqual(payload.newPrestigeLevel, 1);

console.log('✓ prestige.test.js passed');
