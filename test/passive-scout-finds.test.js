'use strict';

const assert = require('assert');
const {
  PASSIVE_SCOUT_FINDS,
  getPassiveFindChance,
  pickWeightedOutcome,
  rollPassiveScoutFind,
  rollJunkFind,
  applyPassiveScoutFind,
  processPassiveScoutFinds,
  totalWeight,
} = require('../game/passive-scout-finds');

function sequenceRandom(values) {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)];
    i += 1;
    return v;
  };
}

// ── allocation scaling ──────────────────────────────────────────────────────
assert.strictEqual(getPassiveFindChance(0), 0, 'allocation 0 → no finds');
assert.strictEqual(getPassiveFindChance(-5), 0, 'negative allocation → 0');
assert.ok(getPassiveFindChance(1) > 0, 'tiny allocation still has thin chance');
assert.ok(
  getPassiveFindChance(1000) > getPassiveFindChance(100),
  'more allocation → higher find chance',
);
assert.ok(
  getPassiveFindChance(1_000_000) <= PASSIVE_SCOUT_FINDS.MAX_FIND_CHANCE + 1e-9,
  'chance never exceeds MAX_FIND_CHANCE',
);
const atRef = getPassiveFindChance(PASSIVE_SCOUT_FINDS.REF_ALLOCATION);
assert.ok(
  Math.abs(atRef - PASSIVE_SCOUT_FINDS.BASE_FIND_CHANCE) < 1e-9,
  'at REF_ALLOCATION chance equals BASE_FIND_CHANCE',
);
console.log('getPassiveFindChance: 0 alloc → 0; scales up; capped');

// ── weighted pick ───────────────────────────────────────────────────────────
{
  const onlyGold = [{ type: 'gold', weight: 1, min: 1, max: 1 }];
  const picked = pickWeightedOutcome(() => 0, onlyGold);
  assert.strictEqual(picked.type, 'gold');
  assert.ok(totalWeight(PASSIVE_SCOUT_FINDS.OUTCOMES) > 0);
}
console.log('pickWeightedOutcome: respects weights');

// ── roll: no allocation → null always ───────────────────────────────────────
{
  for (let i = 0; i < 20; i++) {
    const find = rollPassiveScoutFind({ scout_allocation: 0 }, { random: () => 0 });
    assert.strictEqual(find, null, 'alloc 0 never finds even with random=0');
  }
}
console.log('rollPassiveScoutFind: allocation 0 → always null');

// ── roll: forced hit + forced first outcome (rare table, junk excluded) ────
{
  // chance check: random 0 always passes (0 < chance)
  // weight pick: random 0 picks first outcome in table (gold — junk was
  // moved out of this table entirely, see rollJunkFind below)
  const find = rollPassiveScoutFind(
    { scout_allocation: 1000 },
    { random: sequenceRandom([0, 0]) },
  );
  assert.ok(find, 'expected a find');
  assert.strictEqual(find.type, 'gold');
}
console.log('rollPassiveScoutFind: forced hit yields gold (first weight, junk excluded)');

// ── rollJunkFind: independent flat-chance roll ──────────────────────────────
{
  assert.strictEqual(rollJunkFind({ random: () => 0 }), true, 'random below chance → junk hit');
  assert.strictEqual(
    rollJunkFind({ random: () => PASSIVE_SCOUT_FINDS.JUNK_FIND_CHANCE + 0.01 }),
    false,
    'random above chance → no junk',
  );
  assert.strictEqual(PASSIVE_SCOUT_FINDS.JUNK_FIND_CHANCE, 0.5, 'junk chance is the intended high flat rate');
}
console.log('rollJunkFind: independent flat-chance roll, decoupled from allocation/rare table');

// ── roll: gold outcome ──────────────────────────────────────────────────────
{
  // Build a custom path by using only-gold table via pick — exercise amount range
  // Force hit, then use random that lands in gold band of full table.
  // Simpler: unit-test apply with a synthetic find.
  const kingdom = { gold: 100, wood: 10, stone: 10, mana: 5, land: 50, maps: 0, rangers: 20 };
  const updates = {};
  const events = [];
  applyPassiveScoutFind(kingdom, updates, events, { type: 'gold', amount: 40 });
  assert.strictEqual(updates.gold, 140);
  assert.strictEqual(events.length, 1);
  assert.ok(events[0].message.includes('40'));
  assert.ok(events[0].skipNews);
}
console.log('applyPassiveScoutFind: gold persists on updates');

// ── maps / troops / mana / land ─────────────────────────────────────────────
{
  const kingdom = { maps: 2, rangers: 10, mana: 0, land: 100 };
  const updates = {};
  const events = [];
  applyPassiveScoutFind(kingdom, updates, events, { type: 'maps', amount: 1 });
  assert.strictEqual(updates.maps, 3);
  applyPassiveScoutFind(kingdom, updates, events, { type: 'troops', unit: 'rangers', amount: 2 });
  assert.strictEqual(updates.rangers, 12);
  applyPassiveScoutFind(kingdom, updates, events, { type: 'mana', amount: 7 });
  assert.strictEqual(updates.mana, 7);
  applyPassiveScoutFind(kingdom, updates, events, { type: 'land', amount: 1 });
  assert.strictEqual(updates.land, 101);
}
console.log('applyPassiveScoutFind: maps, troops, mana, land');

// ── resource_node + kingdom_signal ──────────────────────────────────────────
{
  const kingdom = { gold: 0, wood: 0 };
  const updates = {};
  const events = [];
  applyPassiveScoutFind(kingdom, updates, events, { type: 'resource_node', nodeType: 'iron' });
  assert.strictEqual(updates._spawn_resource_node, 'iron');
  applyPassiveScoutFind(kingdom, updates, events, { type: 'kingdom_signal' });
  assert.strictEqual(updates._find_kingdom, true);
  assert.ok(events.some((e) => e.message.includes('kingdom')));
}
console.log('applyPassiveScoutFind: resource_node flag + kingdom_signal flag');

// ── junk via callback ───────────────────────────────────────────────────────
{
  const kingdom = {};
  const updates = {};
  const events = [];
  applyPassiveScoutFind(kingdom, updates, events, { type: 'junk' }, {
    junkPrize: () => 'a shiny button',
  });
  assert.ok(events[0].message.includes('shiny button'));
}
console.log('applyPassiveScoutFind: junkPrize callback');

// ── processPassiveScoutFinds end-to-end ─────────────────────────────────────
{
  // random: () => 0 forces both rollJunkFind (0 < 0.5) AND the rare-table
  // hit check, but scout_allocation: 0 means getPassiveFindChance is 0, so
  // the rare roll can never hit regardless of random() — only junk should
  // land here.
  const kingdom = { scout_allocation: 0, gold: 0 };
  const updates = {};
  const events = [];
  const junkOnly = processPassiveScoutFinds(kingdom, updates, events, {
    random: () => 0,
    junkPrize: () => 'pebble',
  });
  assert.strictEqual(junkOnly.length, 1, 'alloc 0 still allows the independent junk roll to hit');
  assert.strictEqual(junkOnly[0].type, 'junk');
  assert.strictEqual(events.length, 1);

  const kingdom2 = { scout_allocation: 5000, gold: 10 };
  const updates2 = {};
  const events2 = [];
  // random 0 forces junk hit, then rare-roll hit (0 < chance), then first
  // weighted outcome (gold) — both finds land the same turn, independently.
  const both = processPassiveScoutFinds(kingdom2, updates2, events2, {
    random: sequenceRandom([0, 0, 0]),
    junkPrize: () => 'pebble',
  });
  assert.strictEqual(both.length, 2, 'junk and a rare find can both land the same turn');
  assert.strictEqual(both[0].type, 'junk');
  assert.strictEqual(both[1].type, 'gold');
  assert.strictEqual(events2.length, 2);

  // random always above both chances → nothing lands, empty array not null
  const nothing = processPassiveScoutFinds(kingdom2, {}, [], { random: () => 0.999999 });
  assert.deepStrictEqual(nothing, []);
}
console.log('processPassiveScoutFinds: junk and rare finds roll independently, both can land same turn');

// ── outcome table covers roadmap categories (junk excluded — separate roll) ─
{
  const types = new Set(PASSIVE_SCOUT_FINDS.OUTCOMES.map((o) => o.type));
  assert.ok(!types.has('junk'), 'junk must NOT be in the rare-outcomes table — it has its own independent roll');
  for (const t of ['gold', 'wood', 'stone', 'land', 'mana', 'maps', 'troops', 'kingdom_signal', 'resource_node']) {
    assert.ok(types.has(t), `OUTCOMES must include ${t}`);
  }
}
console.log('OUTCOMES table includes gold/wood/land/mana/troops/maps/kingdom/resource_node, excludes junk');

console.log('\n✅ All passive-scout-finds tests passed!');
