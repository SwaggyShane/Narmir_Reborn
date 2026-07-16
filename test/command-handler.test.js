'use strict';

/**
 * P0 §1 slice 1: CommandHandler boundary tests.
 * Uses an injectable mock engine so we verify dispatch + signatures without DB.
 */

const assert = require('assert');
const {
  createCommandHandler,
  COMMAND_TYPES,
  assertSerializable,
} = require('../game/command-handler');

function makeMockEngine(overrides = {}) {
  const calls = [];
  const record = (name, args, ret) => {
    calls.push({ name, args });
    return typeof ret === 'function' ? ret(...args) : ret;
  };

  const engine = {
    processTurn: (...args) => record('processTurn', args, { updates: { turn: 1 }, events: [] }),
    resolveExpeditions: async (...args) => record('resolveExpeditions', args, [{ type: 'exp' }]),
    resolveResourceHarvests: async (...args) => record('resolveResourceHarvests', args, [{ type: 'harvest' }]),
    resolveMilitaryAttack: (...args) => record('resolveMilitaryAttack', args, { win: true }),
    castSpell: (...args) => record('castSpell', args, { ok: true }),
    covertSpy: (...args) => record('covertSpy', args, { success: true }),
    covertLoot: (...args) => record('covertLoot', args, { success: true }),
    covertAssassinate: (...args) => record('covertAssassinate', args, { success: true }),
    covertSabotage: (...args) => record('covertSabotage', args, { success: true }),
    hireUnits: (...args) => record('hireUnits', args, { updates: { fighters: 1 } }),
    hireMercenaries: (...args) => record('hireMercenaries', args, { hired: { count: 1 } }),
    recruitHero: (...args) => record('recruitHero', args, { ok: true }),
    queueBuildings: (...args) => record('queueBuildings', args, { updates: {} }),
    demolishBuilding: (...args) => record('demolishBuilding', args, { updates: {} }),
    processBuildQueue: (...args) => record('processBuildQueue', args, { updates: {} }),
    studyDiscipline: (...args) => record('studyDiscipline', args, { increment: 1, updates: {} }),
    selectSchool: (...args) => record('selectSchool', args, { updates: {} }),
    purchaseUpgrade: (...args) => record('purchaseUpgrade', args, { updates: {} }),
    processPrestige: (...args) => record('processPrestige', args, { updates: {} }),
    calculateScore: (...args) => record('calculateScore', args, 999),
    raidTradeRoute: (...args) => record('raidTradeRoute', args, { success: true }),
    forgeTools: (...args) => record('forgeTools', args, { updates: {} }),
    awardXp: (...args) => record('awardXp', args, { xp: 10, level: 1 }),
    awardTroopXp: (...args) => record('awardTroopXp', args, { troop_levels: '{}' }),
    getAvailableUnits: (...args) => record('getAvailableUnits', args, 10),
    validateSpellTarget: (...args) => record('validateSpellTarget', args, { target: args[1] }),
    canPrestige: (...args) => record('canPrestige', args, true),
    awardHeroXp: (...args) => record('awardHeroXp', args, { xp: 1, level: 1 }),
    applyHeroTurnBonuses: (...args) => record('applyHeroTurnBonuses', args, undefined),
    totalHiredUnits: (...args) => record('totalHiredUnits', args, 0),
    marketIncomeFull: (...args) => record('marketIncomeFull', args, 100),
    tavernEntertainmentBonus: (...args) => record('tavernEntertainmentBonus', args, 5),
    SPELL_DEFS: { fireball: { effect: 'offensive' } },
    TRADE_ROUTE_MAX: 5,
    FOOD_CONSUMPTION_MULT: { human: 1.0, orc: 1.1 },
    ...overrides,
  };

  engine._calls = calls;
  return engine;
}

const kingdom = { id: 1, race: 'human', gold: 100 };
const target = { id: 2, race: 'orc', name: 'Enemy' };
const db = { fake: true };

async function run() {
  // ── assertSerializable ────────────────────────────────────────────────────
  assertSerializable({ a: 1, b: [2, 'x'] }, 'plain object');
  assertSerializable(null, 'null');
  assertSerializable([1, 2, 3], 'array');
  assert.throws(() => assertSerializable({ d: new Date() }, 'date'), /Date is not allowed/);
  assert.throws(() => assertSerializable({ f: () => 1 }, 'fn'), /function is not JSON-safe/);
  console.log('assertSerializable: accepts plain JSON, rejects Date/function');

  // ── registry ──────────────────────────────────────────────────────────────
  assert.ok(COMMAND_TYPES.includes('turn'), 'COMMAND_TYPES includes turn');
  assert.ok(COMMAND_TYPES.includes('combat'), 'COMMAND_TYPES includes combat');
  assert.ok(COMMAND_TYPES.includes('purchase-upgrade'), 'COMMAND_TYPES includes purchase-upgrade');
  assert.ok(COMMAND_TYPES.includes('raid-trade-route'), 'COMMAND_TYPES includes raid-trade-route');
  const handler0 = createCommandHandler(makeMockEngine());
  assert.deepStrictEqual([...handler0.listCommands()], [...COMMAND_TYPES], 'listCommands matches COMMAND_TYPES');
  console.log('COMMAND_TYPES registry stable and listed');

  // ── validation ────────────────────────────────────────────────────────────
  await assert.rejects(
    () => createCommandHandler(makeMockEngine()).handle(null, {}),
    /type property/,
  );
  await assert.rejects(
    () => createCommandHandler(makeMockEngine()).handle({}, {}),
    /type property/,
  );
  await assert.rejects(
    () => createCommandHandler(makeMockEngine()).handle({ type: 'not-a-real-command' }, { kingdom }),
    /Unknown command type/,
  );
  console.log('handle: rejects missing type and unknown type');

  // ── turn ──────────────────────────────────────────────────────────────────
  {
    const eng = makeMockEngine();
    const h = createCommandHandler(eng);
    const result = await h.handle({ type: 'turn' }, { kingdom, db });
    assert.deepStrictEqual(eng._calls[0].name, 'processTurn');
    assert.deepStrictEqual(eng._calls[0].args, [kingdom, db]);
    assert.ok(result.updates);
    assertSerializable(result, 'turn result');
  }
  console.log('turn → processTurn(kingdom, db)');

  // ── expeditions ───────────────────────────────────────────────────────────
  {
    const eng = makeMockEngine();
    const h = createCommandHandler(eng);
    const events = await h.handle({ type: 'expeditions' }, { kingdom, db });
    assert.strictEqual(eng._calls[0].name, 'resolveExpeditions');
    assert.strictEqual(eng._calls[0].args[0], db);
    assert.strictEqual(eng._calls[0].args[1], kingdom);
    assert.strictEqual(eng._calls[0].args[2], eng, 'passes engine instance as third arg');
    assert.strictEqual(eng._calls[1].name, 'resolveResourceHarvests');
    assert.strictEqual(events.length, 2);
  }
  console.log('expeditions → resolveExpeditions + resolveResourceHarvests');

  // ── combat (production signature) ─────────────────────────────────────────
  {
    const eng = makeMockEngine();
    const h = createCommandHandler(eng);
    const sentUnits = { fighters: 5 };
    const atkH = [{ id: 1 }];
    const defH = [{ id: 2 }];
    await h.handle(
      {
        type: 'combat',
        target,
        sentUnits,
        attackerHeroes: atkH,
        defenderHeroes: defH,
      },
      { kingdom },
    );
    assert.strictEqual(eng._calls[0].name, 'resolveMilitaryAttack');
    assert.deepStrictEqual(eng._calls[0].args, [kingdom, target, sentUnits, atkH, defH]);
  }
  {
    const eng = makeMockEngine();
    const h = createCommandHandler(eng);
    await assert.rejects(
      () => h.handle({ type: 'combat', sentUnits: {} }, { kingdom }),
      /payload\.target/,
    );
  }
  console.log('combat → resolveMilitaryAttack(attacker, defender, sentUnits, heroes…)');

  // ── spell ─────────────────────────────────────────────────────────────────
  {
    const eng = makeMockEngine();
    const h = createCommandHandler(eng);
    await h.handle(
      { type: 'spell', target, spellId: 'fireball', obscure: true },
      { kingdom },
    );
    assert.deepStrictEqual(eng._calls[0].args, [kingdom, target, 'fireball', true]);
  }
  console.log('spell → castSpell(caster, target, spellId, obscure)');

  // ── covert ops ────────────────────────────────────────────────────────────
  {
    const eng = makeMockEngine();
    const h = createCommandHandler(eng);
    await h.handle({ type: 'covert-spy', target, unitsSent: 3 }, { kingdom });
    assert.deepStrictEqual(eng._calls[0].args, [kingdom, target, 3]);

    eng._calls.length = 0;
    await h.handle({ type: 'covert-loot', target, lootType: 'gold', thievesSent: 2 }, { kingdom });
    assert.deepStrictEqual(eng._calls[0].args, [kingdom, target, 'gold', 2]);

    eng._calls.length = 0;
    await h.handle({ type: 'covert-assassinate', target, ninjasSent: 4, unitType: 'fighters' }, { kingdom });
    assert.deepStrictEqual(eng._calls[0].args, [kingdom, target, 4, 'fighters']);

    eng._calls.length = 0;
    await h.handle({ type: 'covert-sabotage', target, ninjasSent: 1, bldType: 'bld_farms' }, { kingdom });
    assert.deepStrictEqual(eng._calls[0].args, [kingdom, target, 1, 'bld_farms']);
  }
  console.log('covert-spy/loot/assassinate/sabotage signatures match covert.js');

  // ── hire / mercs / hero ───────────────────────────────────────────────────
  {
    const eng = makeMockEngine();
    const h = createCommandHandler(eng);
    await h.handle({ type: 'hire-units', unitType: 'fighters', quantity: 10 }, { kingdom });
    assert.deepStrictEqual(eng._calls[0].args, [kingdom, 'fighters', 10]);

    eng._calls.length = 0;
    await h.handle({ type: 'hire-mercenaries', unitType: 'fighters', tier: 'bronze', quantity: 2 }, { kingdom });
    assert.deepStrictEqual(eng._calls[0].args, [kingdom, 'fighters', 'bronze', 2]);

    eng._calls.length = 0;
    await h.handle({ type: 'recruit-hero', name: 'Aldric', heroClass: 'warrior' }, { kingdom });
    assert.deepStrictEqual(eng._calls[0].args, [kingdom, 'Aldric', 'warrior']);
  }
  console.log('hire-units / hire-mercenaries / recruit-hero signatures');

  // ── build ─────────────────────────────────────────────────────────────────
  {
    const eng = makeMockEngine();
    const h = createCommandHandler(eng);
    const orders = [{ building: 'bld_farms', amount: 1 }];
    await h.handle({ type: 'queue-buildings', orders }, { kingdom });
    assert.deepStrictEqual(eng._calls[0].args, [kingdom, orders]);

    eng._calls.length = 0;
    await h.handle({ type: 'demolish-building', buildingType: 'bld_farms', amount: 2 }, { kingdom });
    assert.deepStrictEqual(eng._calls[0].args, [kingdom, 'bld_farms', 2]);
  }
  console.log('queue-buildings / demolish-building signatures');

  // ── research / upgrade / prestige / score ─────────────────────────────────
  {
    const eng = makeMockEngine();
    const h = createCommandHandler(eng);
    await h.handle({ type: 'study-discipline', discipline: 'military', allocation: 5 }, { kingdom });
    assert.deepStrictEqual(eng._calls[0].args, [kingdom, 'military', 5]);

    eng._calls.length = 0;
    await h.handle({ type: 'select-school', school: 'fire' }, { kingdom });
    assert.deepStrictEqual(eng._calls[0].args, [kingdom, 'fire']);

    eng._calls.length = 0;
    await h.handle({ type: 'purchase-upgrade', category: 'farm', upgradeKey: 'iron_plow' }, { kingdom });
    assert.deepStrictEqual(eng._calls[0].args, [kingdom, 'farm', 'iron_plow']);

    eng._calls.length = 0;
    await h.handle({ type: 'prestige' }, { kingdom });
    assert.deepStrictEqual(eng._calls[0].args, [kingdom]);

    eng._calls.length = 0;
    const score = await h.handle({ type: 'calculate-score' }, { kingdom });
    assert.strictEqual(score, 999);
    assert.deepStrictEqual(eng._calls[0].args, [kingdom]);
  }
  console.log('study / school / upgrade / prestige / score signatures');

  // ── raid trade route / forge / xp ─────────────────────────────────────────
  {
    const eng = makeMockEngine();
    const h = createCommandHandler(eng);
    await h.handle({ type: 'raid-trade-route', target, thievesSent: 7 }, { kingdom });
    assert.deepStrictEqual(eng._calls[0].args, [kingdom, target, 7]);

    eng._calls.length = 0;
    await h.handle({ type: 'forge-tools', toolType: 'hammers', quantity: 3 }, { kingdom });
    assert.deepStrictEqual(eng._calls[0].args, [kingdom, 'hammers', 3]);

    eng._calls.length = 0;
    await h.handle({ type: 'award-xp', activity: 'exploration', amount: 5 }, { kingdom });
    assert.deepStrictEqual(eng._calls[0].args, [kingdom, 'exploration', 5]);

    eng._calls.length = 0;
    await h.handle({ type: 'award-troop-xp', unitType: 'rangers', amount: 8 }, { kingdom });
    assert.deepStrictEqual(eng._calls[0].args, [kingdom, 'rangers', 8]);
  }
  console.log('raid-trade-route / forge-tools / award-xp / award-troop-xp signatures');

  // ── helpers ───────────────────────────────────────────────────────────────
  {
    const eng = makeMockEngine();
    const h = createCommandHandler(eng);
    assert.strictEqual(h.foodConsumptionMult('orc'), 1.1);
    assert.strictEqual(h.foodConsumptionMult('unknown_race'), 1.0);
    assert.strictEqual(h.marketIncomeFull(kingdom), 100);
    assert.strictEqual(h.tavernEntertainmentBonus(kingdom), 5);
  }
  console.log('read helpers: foodConsumptionMult / market / tavern');

  // ── every COMMAND_TYPES entry is handled (no unknown) ─────────────────────
  {
    const eng = makeMockEngine();
    const h = createCommandHandler(eng);
    for (const type of COMMAND_TYPES) {
      const payload = {
        type,
        target,
        spellId: 'x',
        unitType: 'fighters',
        quantity: 1,
        tier: 'bronze',
        orders: [],
        buildingType: 'bld_farms',
        amount: 1,
        discipline: 'x',
        allocation: 1,
        school: 'x',
        category: 'x',
        upgradeKey: 'x',
        unitsSent: 1,
        lootType: 'gold',
        thievesSent: 1,
        ninjasSent: 1,
        bldType: 'x',
        heroClass: 'warrior',
        name: 'Hero',
        toolType: 'hammers',
        activity: 'exploration',
        sentUnits: {},
        attackerHeroes: [],
        defenderHeroes: [],
        obscure: false,
      };
      await h.handle(payload, { kingdom, db });
    }
  }
  console.log('every COMMAND_TYPES entry is dispatched without Unknown command type');

  // ── live singleton exports ────────────────────────────────────────────────
  {
    const live = require('../game/command-handler');
    assert.strictEqual(typeof live.handle, 'function');
    assert.strictEqual(typeof live.listCommands, 'function');
    assert.ok(live.listCommands().includes('turn'));
    // Live handle with missing type still throws without needing full engine path for validation
    await assert.rejects(() => live.handle({}), /type property/);
  }
  console.log('production singleton exports handle + listCommands');

  // ── regression: OLD wrong combat signature must NOT be what we call ───────
  {
    const eng = makeMockEngine();
    const h = createCommandHandler(eng);
    await h.handle(
      { type: 'combat', target, sentUnits: { fighters: 1 }, attackerHeroes: [], defenderHeroes: [] },
      { kingdom, db },
    );
    const args = eng._calls[0].args;
    // Old bug: (kingdom, targetId, db, rest) — 3rd arg was db object
    assert.notStrictEqual(args[2], db, 'combat must not pass db as third arg (old broken signature)');
    assert.ok(args[2] && typeof args[2] === 'object' && 'fighters' in args[2], 'third arg is sentUnits');
  }
  console.log('regression: combat does not use old (kingdom, targetId, db, rest) shape');

  console.log('\n✅ All command-handler tests passed!');
}

run().catch((err) => {
  console.error('\n❌ command-handler tests failed:', err);
  process.exit(1);
});
