'use strict';

const assert = require('assert');
const {
  EPIC_TREK_DISCOVERY,
  seededUnit,
  rollKingdomDiscovery,
  rollLootDiscovery,
  rollLocationDiscovery,
  processPathDiscoveries,
  applyLootDiscoveries,
} = require('../game/epic-trek-discovery');

// ── seeded RNG stable ───────────────────────────────────────────────────────
{
  const a = seededUnit(3, 7, 11);
  const b = seededUnit(3, 7, 11);
  assert.strictEqual(a, b, 'seededUnit is deterministic');
  assert.ok(a >= 0 && a < 1, 'seededUnit in [0,1)');
  assert.notStrictEqual(seededUnit(3, 7, 11), seededUnit(3, 8, 11), 'different seeds differ');
}
console.log('seededUnit: deterministic and unit interval');

// ── kingdom roll ────────────────────────────────────────────────────────────
{
  const k = { id: 1, turn: 50 };
  // Sample many hexes — some hits expected at ~30%
  let hits = 0;
  for (let c = 0; c < 40; c++) {
    for (let r = 0; r < 5; r++) {
      if (rollKingdomDiscovery(c, r, k)) hits++;
    }
  }
  assert.ok(hits > 0, 'some kingdom discovery hits expected');
  assert.ok(hits < 200, 'not every hex is a kingdom hit');
  assert.strictEqual(rollKingdomDiscovery(0, 0, null), null);
  assert.strictEqual(rollKingdomDiscovery(0, 0, {}), null);
}
console.log('rollKingdomDiscovery: seeded hits, null-safe');

// ── loot roll is type loot, not location ────────────────────────────────────
{
  const k = { id: 42, turn: 10 };
  let lootHits = 0;
  let legacyLocation = 0;
  for (let c = 0; c < 50; c++) {
    for (let r = 0; r < 10; r++) {
      const loot = rollLootDiscovery(c, r, k);
      if (loot) {
        lootHits++;
        assert.strictEqual(loot.type, 'loot', 'discoveries are loot, not fake locations');
        assert.ok(loot.lootType, 'lootType set');
      }
      const alias = rollLocationDiscovery(c, r, k);
      if (alias) {
        assert.strictEqual(alias.type, 'loot');
        legacyLocation++;
      }
    }
  }
  assert.ok(lootHits > 0, 'some loot hits');
  assert.strictEqual(lootHits, legacyLocation, 'rollLocationDiscovery is alias of loot');
}
console.log('rollLootDiscovery: real loot types; location alias maps to loot');

// ── processPathDiscoveries ──────────────────────────────────────────────────
{
  const k = { id: 7, turn: 1 };
  const path = [
    { col: 1, row: 1 },
    { col: 2, row: 2 },
    { col: 3, row: 3 },
    { col: 4, row: 4 },
    { col: 5, row: 5 },
  ];
  const all = processPathDiscoveries(path, k);
  assert.ok(Array.isArray(all));
  for (const d of all) {
    assert.ok(d.type === 'kingdom' || d.type === 'loot', `unexpected type ${d.type}`);
    assert.notStrictEqual(d.type, 'location', 'no bare location type');
  }
  assert.deepStrictEqual(processPathDiscoveries([], k), []);
  assert.deepStrictEqual(processPathDiscoveries(null, k), []);
}
console.log('processPathDiscoveries: only kingdom|loot');

// ── applyLootDiscoveries persists + honest rewards ──────────────────────────
{
  const kingdom = {
    gold: 100,
    wood: 10,
    stone: 10,
    mana: 5,
    food: 50,
    maps: 0,
    land: 200,
    rangers: 20,
  };
  const discoveries = [
    { type: 'loot', lootType: 'gold', amount: 50 },
    { type: 'loot', lootType: 'wood', amount: 12 },
    { type: 'loot', lootType: 'maps', amount: 1 },
    { type: 'loot', lootType: 'troops', unit: 'rangers', amount: 2 },
    { type: 'kingdom', hex_col: 1, hex_row: 1 }, // ignored by applyLoot
  ];
  const { updates, rewards, lootCount } = applyLootDiscoveries(kingdom, discoveries);
  assert.strictEqual(lootCount, 4);
  assert.strictEqual(updates.gold, 150);
  assert.strictEqual(updates.wood, 22);
  assert.strictEqual(updates.maps, 1);
  assert.strictEqual(updates.rangers, 22);
  assert.ok(rewards.length >= 3, 'reward lines for applied loot');
  for (const r of rewards) {
    assert.ok(r.text && !/found \d+ location/i.test(r.text), 'no lying location text');
  }
}
console.log('applyLootDiscoveries: mutates gold/wood/maps/rangers; honest messages');

// ── empty loot → no rewards ─────────────────────────────────────────────────
{
  const { updates, rewards, lootCount } = applyLootDiscoveries({ gold: 0 }, [
    { type: 'kingdom', hex_col: 0, hex_row: 0 },
  ]);
  assert.strictEqual(lootCount, 0);
  assert.deepStrictEqual(updates, {});
  assert.deepStrictEqual(rewards, []);
}
console.log('applyLootDiscoveries: kingdom-only discoveries produce no fake loot text');

// ── table sanity ────────────────────────────────────────────────────────────
{
  assert.ok(EPIC_TREK_DISCOVERY.LOOT_CHANCE > 0 && EPIC_TREK_DISCOVERY.LOOT_CHANCE < 1);
  assert.ok(EPIC_TREK_DISCOVERY.LOOT_OUTCOMES.length >= 5);
  const types = new Set(EPIC_TREK_DISCOVERY.LOOT_OUTCOMES.map((o) => o.type));
  for (const t of ['gold', 'wood', 'stone', 'mana', 'maps', 'troops', 'artifact']) {
    assert.ok(types.has(t), `table includes ${t}`);
  }
}
console.log('EPIC_TREK_DISCOVERY table covers core loot types');

// ── regional locations on path ──────────────────────────────────────────────
{
  const { findRegionalLocationsOnPath } = require('../game/epic-trek-discovery');
  const path = [{ col: 5, row: 5 }, { col: 6, row: 5 }];
  const getLoc = (race, type) => {
    if (type === 'dungeon') return { id: 1, x: 100, y: 200, type: 'dungeon' };
    return null;
  };
  const pixelToHex = (x, y) => {
    if (x === 100 && y === 200) return { col: 5, row: 5 };
    return { col: 0, row: 0 };
  };
  const found = findRegionalLocationsOnPath(path, 'human', getLoc, pixelToHex);
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].type, 'dungeon');
  assert.deepStrictEqual(findRegionalLocationsOnPath([], 'human', getLoc, pixelToHex), []);
}
console.log('findRegionalLocationsOnPath: matches dungeon hex on path');

// ── artifact apply ──────────────────────────────────────────────────────────
{
  const kingdom = { items: '[]', gold: 0 };
  const { updates, rewards } = applyLootDiscoveries(kingdom, [
    { type: 'loot', lootType: 'artifact', artifactId: 'trek_carved_totem', artifactName: 'Carved Path Totem', amount: 1 },
  ]);
  assert.ok(updates.items);
  const items = JSON.parse(updates.items);
  assert.ok(items.some((i) => i.id === 'trek_carved_totem' && i.qty >= 1));
  assert.ok(rewards.some((r) => /artifact/i.test(r.text)));
}
console.log('applyLootDiscoveries: artifacts persist to items');

console.log('\n✅ All epic-trek-discovery tests passed!');
