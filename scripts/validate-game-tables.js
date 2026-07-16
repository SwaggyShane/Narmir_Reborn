#!/usr/bin/env node
/**
 * Validate live game reward/command tables used by P0 honesty systems.
 *
 * This is NOT the fictional RPG JSON-pack validator from the architecture
 * aspirational roadmap. It loads the real CommonJS modules the server uses:
 *   - command-handler COMMAND_TYPES ↔ handle() dispatch
 *   - passive scout find outcomes + weights
 *   - epic trek loot outcomes + artifacts
 *   - terrain scout difficulty table
 *   - passive resource-node type set
 *
 * Usage: node scripts/validate-game-tables.js
 *        npm run validate:game-tables
 *
 * Exit 0 on success, 1 on any failure. No DB required.
 */

'use strict';

const path = require('path');

const failures = [];

function fail(msg) {
  failures.push(msg);
  console.error(`  FAIL: ${msg}`);
}

function ok(msg) {
  console.log(`  ok: ${msg}`);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
  else ok(msg);
}

function validateCommandTypes() {
  console.log('\n[command-handler]');
  const {
    COMMAND_TYPES,
    createCommandHandler,
  } = require('../game/command-handler');

  assert(Array.isArray(COMMAND_TYPES) && COMMAND_TYPES.length > 0, 'COMMAND_TYPES non-empty');
  assert(COMMAND_TYPES.length === new Set(COMMAND_TYPES).size, 'COMMAND_TYPES unique');

  const stubEngine = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') return undefined;
        return () => ({ ok: true, via: String(prop) });
      },
    },
  );
  const handler = createCommandHandler(stubEngine);
  const listed = new Set(handler.listCommands());
  for (const type of COMMAND_TYPES) {
    assert(listed.has(type), `listCommands includes ${type}`);
    try {
      // calculate-score and pure helpers may not need full payload
      handler.handle({ type }, { kingdom: { id: 1 }, db: null });
      ok(`dispatch ${type} (no Unknown command type)`);
    } catch (err) {
      if (String(err.message).includes('Unknown command type')) {
        fail(`COMMAND_TYPES entry not dispatched: ${type}`);
      } else {
        // Signature/payload errors are fine — proves the case exists
        ok(`dispatch ${type} reached handler (${err.message.slice(0, 60)})`);
      }
    }
  }
}

function validatePassiveScout() {
  console.log('\n[passive-scout-finds]');
  const {
    PASSIVE_SCOUT_FINDS,
    getPassiveFindChance,
    totalWeight,
    pickWeightedOutcome,
  } = require('../game/passive-scout-finds');

  const outcomes = PASSIVE_SCOUT_FINDS.OUTCOMES;
  assert(Array.isArray(outcomes) && outcomes.length > 0, 'OUTCOMES non-empty');
  assert(totalWeight(outcomes) > 0, 'OUTCOMES total weight > 0');

  const allowed = new Set([
    'junk',
    'gold',
    'wood',
    'stone',
    'mana',
    'land',
    'maps',
    'troops',
    'resource_node',
    'kingdom_signal',
  ]);
  for (const o of outcomes) {
    assert(allowed.has(o.type), `outcome type known: ${o.type}`);
    assert(Number(o.weight) > 0, `outcome weight > 0: ${o.type}`);
    if (o.min != null || o.max != null) {
      assert(Number(o.min) <= Number(o.max), `min<=max for ${o.type}`);
    }
  }

  assert(getPassiveFindChance(0) === 0, 'alloc 0 → chance 0');
  assert(getPassiveFindChance(1000) > 0, 'alloc 1000 → chance > 0');
  assert(
    getPassiveFindChance(1e9) <= PASSIVE_SCOUT_FINDS.MAX_FIND_CHANCE + 1e-9,
    'chance capped at MAX_FIND_CHANCE',
  );

  const picked = pickWeightedOutcome(() => 0);
  assert(picked && picked.type, 'pickWeightedOutcome returns an outcome');
}

function validateEpicTrek() {
  console.log('\n[epic-trek-discovery]');
  const {
    EPIC_TREK_DISCOVERY,
    TREK_ARTIFACTS,
    processPathDiscoveries,
    applyLootDiscoveries,
  } = require('../game/epic-trek-discovery');

  assert(
    EPIC_TREK_DISCOVERY.KINGDOM_CHANCE > 0 && EPIC_TREK_DISCOVERY.KINGDOM_CHANCE < 1,
    'KINGDOM_CHANCE in (0,1)',
  );
  assert(
    EPIC_TREK_DISCOVERY.LOOT_CHANCE > 0 && EPIC_TREK_DISCOVERY.LOOT_CHANCE < 1,
    'LOOT_CHANCE in (0,1)',
  );

  const loot = EPIC_TREK_DISCOVERY.LOOT_OUTCOMES;
  assert(Array.isArray(loot) && loot.length > 0, 'LOOT_OUTCOMES non-empty');
  const lootTypes = new Set([
    'gold',
    'wood',
    'stone',
    'mana',
    'maps',
    'food',
    'troops',
    'land',
    'artifact',
  ]);
  let weightSum = 0;
  for (const o of loot) {
    assert(lootTypes.has(o.type), `loot type known: ${o.type}`);
    assert(Number(o.weight) > 0, `loot weight > 0: ${o.type}`);
    weightSum += o.weight;
  }
  assert(weightSum > 0, 'loot total weight > 0');

  assert(Array.isArray(TREK_ARTIFACTS) && TREK_ARTIFACTS.length > 0, 'TREK_ARTIFACTS non-empty');
  const ids = new Set();
  for (const a of TREK_ARTIFACTS) {
    assert(a.id && a.name, `artifact has id+name: ${JSON.stringify(a)}`);
    assert(!ids.has(a.id), `artifact id unique: ${a.id}`);
    ids.add(a.id);
  }

  // Honesty smoke: non-loot discoveries produce zero loot updates
  const noLoot = applyLootDiscoveries(
    { id: 1, gold: 0, items: '[]' },
    [{ type: 'kingdom' }],
  );
  assert(noLoot.lootCount === 0, 'kingdom-only discoveries → lootCount 0');
  assert(!noLoot.updates.gold, 'kingdom-only discoveries → no gold update');
  assert(noLoot.rewards.length === 0, 'kingdom-only discoveries → no loot reward text');

  // empty path → no discoveries
  const empty = processPathDiscoveries([], { id: 1 });
  assert(Array.isArray(empty) && empty.length === 0, 'empty path → no discoveries');
}

function validateTerrainScout() {
  console.log('\n[terrain-scout]');
  const {
    TERRAIN_SCOUT,
    getTerrainScoutModifiers,
    getKingdomScoutRate,
  } = require('../game/terrain-scout');

  const required = [
    'plains',
    'forest',
    'mountains',
    'hills',
    'swamp',
    'desert',
    'coast',
    'tundra',
    'volcanic',
    'lake',
    'ocean',
  ];
  for (const t of required) {
    const row = TERRAIN_SCOUT[t];
    assert(row, `TERRAIN_SCOUT has ${t}`);
    if (row) {
      assert(row.scoutRate > 0, `${t}.scoutRate > 0`);
      assert(row.foodCostMult > 0, `${t}.foodCostMult > 0`);
    }
  }
  assert(
    TERRAIN_SCOUT.plains.scoutRate > TERRAIN_SCOUT.mountains.scoutRate,
    'plains easier to scout than mountains',
  );
  const def = getTerrainScoutModifiers(null);
  assert(def.scoutRate === 1 && def.foodCostMult === 1, 'null terrain → defaults 1.0');
  // race fallback without hex cache should still return a number
  const rate = getKingdomScoutRate({ race: 'human', id: 1 });
  assert(typeof rate === 'number' && rate > 0, 'getKingdomScoutRate returns positive number');
}

function validateResourceNodeTypes() {
  console.log('\n[passive-resource-node-spawn]');
  const { VALID_TYPES } = require('../game/passive-resource-node-spawn');
  const expected = ['wood', 'stone', 'iron', 'gold'];
  for (const t of expected) {
    assert(VALID_TYPES.has(t), `VALID_TYPES has ${t}`);
  }
  assert(VALID_TYPES.size === expected.length, 'VALID_TYPES exact set size');
}

function validateKingdomDiscovery() {
  console.log('\n[kingdom-discovery-resolve]');
  const {
    mergeKingdomDiscovery,
    stripDiscoveryFlags,
  } = require('../game/kingdom-discovery-resolve');

  const updates = {};
  const none = mergeKingdomDiscovery({ id: 1 }, updates, null, { source: 'scout' });
  assert(none && none.applied === false, 'null other → not applied');

  const first = mergeKingdomDiscovery(
    { id: 1, discovered_kingdoms: '{}' },
    updates,
    { id: 99, name: 'Testia' },
    { source: 'scout' },
  );
  assert(first.applied === true, 'first find applied');
  assert(typeof first.discovered_kingdoms === 'string', 'persists discovered_kingdoms string');

  const stripped = stripDiscoveryFlags({ _find_kingdom: true, gold: 1 });
  assert(stripped._find_kingdom === undefined && stripped.gold === 1, 'stripDiscoveryFlags removes flag only');
}

function main() {
  console.log('validate-game-tables: live P0 reward/command tables');
  console.log(`cwd: ${path.resolve('.')}`);

  validateCommandTypes();
  validatePassiveScout();
  validateEpicTrek();
  validateTerrainScout();
  validateResourceNodeTypes();
  validateKingdomDiscovery();

  console.log('');
  if (failures.length) {
    console.error(`FAILED: ${failures.length} check(s)`);
    process.exit(1);
  }
  console.log('PASSED: all game-table checks');
  process.exit(0);
}

main();
