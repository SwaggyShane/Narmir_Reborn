'use strict';
/**
 * Deeper Roadmap B coverage: multi-tick ritual, trek egg selection, economy upkeep/hoard.
 * Run: node test/evolution-deep.test.js
 */
const assert = require('assert');
const evo = require('../game/evolution');
const {
  RITUAL_TURNS,
  DRAGON_EGG_ITEM_ID,
  DRAGON_EGG_ITEM_NAME,
  EGG_ARTIFACT_ROLL_CHANCE,
  DRAGON_FORM,
  EVOLUTION_PRESTIGE_GATE,
} = require('../game/evolution/balance');
const { rollLootDiscovery, TREK_ARTIFACTS, EPIC_TREK_DISCOVERY } = require('../game/epic-trek-discovery');
const { foodConsumption, marketIncomeFull } = require('../game/economy');
const { applyPrestigeCombatMultiplier } = require('../game/prestige/combat');

console.log('multi-tick CHANNELING decrement to complete');
{
  let k = {
    turn: 1,
    bld_castles: 1,
    evolution_form: '',
    evolution_ritual: JSON.stringify({
      state: 'CHANNELING',
      form: 'dragon',
      turns_remaining: 5,
      turns_total: RITUAL_TURNS,
    }),
  };
  for (let i = 0; i < 4; i++) {
    const r = evo.processEvolutionTurn({ ...k, turn: k.turn + 1 });
    assert.ok(r);
    k = { ...k, ...r.updates, turn: k.turn + 1 };
    assert.strictEqual(JSON.parse(k.evolution_ritual).state, 'CHANNELING');
  }
  const last = evo.processEvolutionTurn({ ...k, turn: k.turn + 1, bld_castles: 1 });
  assert.strictEqual(last.updates.evolution_form, 'dragon');
  assert.strictEqual(JSON.parse(last.updates.evolution_ritual).state, 'COMPLETE');
  console.log('  ✓ 5-tick complete');
}

console.log('full RITUAL_TURNS pure loop completes once');
{
  let remaining = RITUAL_TURNS;
  let form = '';
  let ritual = {
    state: 'CHANNELING',
    form: 'dragon',
    turns_remaining: remaining,
    turns_total: RITUAL_TURNS,
  };
  let completes = 0;
  for (let t = 0; t < RITUAL_TURNS + 5; t++) {
    const r = evo.processEvolutionTurn({
      turn: t + 1,
      bld_castles: 2,
      evolution_form: form,
      evolution_ritual: JSON.stringify(ritual),
    });
    if (!r) break;
    if (r.updates.evolution_form) {
      form = r.updates.evolution_form;
      completes += 1;
    }
    if (r.updates.evolution_ritual) {
      ritual = JSON.parse(r.updates.evolution_ritual);
    }
  }
  assert.strictEqual(completes, 1);
  assert.strictEqual(form, 'dragon');
  assert.strictEqual(ritual.state, 'COMPLETE');
  console.log(`  ✓ ${RITUAL_TURNS}-turn pure loop → dragon once`);
}

console.log('trek artifact catalog can yield dragon_egg (brute force seeds)');
{
  let eggHits = 0;
  let artHits = 0;
  // Sweep kingdom ids / hexes until we observe both egg and non-egg artifacts or cap
  for (let id = 1; id <= 800 && eggHits < 1; id++) {
    for (let col = 0; col < 60; col++) {
      for (let row = 0; row < 60; row++) {
        const loot = rollLootDiscovery(col, row, { id, turn: 1 });
        if (!loot || loot.lootType !== 'artifact') continue;
        artHits += 1;
        if (loot.artifactId === DRAGON_EGG_ITEM_ID) eggHits += 1;
        if (eggHits >= 1 && artHits >= 5) break;
      }
      if (eggHits >= 1) break;
    }
  }
  assert.ok(artHits > 0, 'should find some artifacts in seed space');
  assert.ok(eggHits > 0, 'dragon_egg must still appear (rare) in trek artifact rolls');
  assert.ok(EGG_ARTIFACT_ROLL_CHANCE > 0 && EGG_ARTIFACT_ROLL_CHANCE <= 0.15);
  assert.ok(TREK_ARTIFACTS.length >= 1);
  assert.ok(EPIC_TREK_DISCOVERY.LOOT_OUTCOMES.some((o) => o.type === 'artifact'));
  console.log(`  ✓ egg hits=${eggHits} artifact hits sampled=${artHits} (chance=${EGG_ARTIFACT_ROLL_CHANCE})`);
}

console.log('prestige wipe: keep dragon form; abort channeling');
{
  const { buildWipeUpdates } = require('../game/prestige/wipe');
  const dragonK = {
    level: 500,
    prestige_level: 8,
    turn: 900,
    land: 999,
    gold: 1,
    evolution_form: 'dragon',
    evolution_ritual: JSON.stringify({ state: 'COMPLETE', form: 'dragon' }),
  };
  const wipedDragon = buildWipeUpdates(dragonK);
  assert.strictEqual(wipedDragon.updates.evolution_form, undefined, 'form not rewritten — DB KEEP');
  assert.strictEqual(wipedDragon.updates.evolution_ritual, undefined, 'COMPLETE ritual not rewritten');

  const channelingK = {
    ...dragonK,
    evolution_form: '',
    evolution_ritual: JSON.stringify({
      state: 'CHANNELING',
      form: 'dragon',
      turns_remaining: 30,
    }),
  };
  const wipedCh = buildWipeUpdates(channelingK);
  assert.ok(wipedCh.updates.evolution_ritual);
  assert.strictEqual(JSON.parse(wipedCh.updates.evolution_ritual).state, 'ABORTED');
  assert.strictEqual(JSON.parse(wipedCh.updates.evolution_ritual).reason, 'prestige_rebirth');
  console.log('  ✓ endgame form kept; channeling aborted on prestige');
}

console.log('food upkeep mult for dragon form');
{
  const baseK = {
    race: 'human',
    population: 10000,
    fighters: 100,
    rangers: 0,
    clerics: 0,
    mages: 0,
    thieves: 0,
    ninjas: 0,
    researchers: 0,
    engineers: 0,
    scribes: 0,
    thralls: 0,
    evolution_form: '',
  };
  const normal = foodConsumption(baseK);
  const dragon = foodConsumption({ ...baseK, evolution_form: 'dragon' });
  assert.ok(normal > 0);
  assert.strictEqual(dragon, Math.floor(normal * DRAGON_FORM.upkeepMult));
  console.log(`  ✓ consumption ${normal} → dragon ${dragon} (×${DRAGON_FORM.upkeepMult})`);
}

console.log('market hoard mult for dragon');
{
  const baseK = {
    race: 'human',
    bld_markets: 10,
    population: 5000,
    maps: 5,
    prestige_level: 0,
    fighters: 0,
    rangers: 0,
    clerics: 0,
    mages: 0,
    thieves: 0,
    ninjas: 0,
    researchers: 0,
    engineers: 0,
    scribes: 0,
    thralls: 0,
    market_upgrades: '{}',
    evolution_form: '',
  };
  const normal = marketIncomeFull(baseK);
  const dragon = marketIncomeFull({ ...baseK, evolution_form: 'dragon' });
  if (normal > 0) {
    assert.ok(dragon >= normal, 'hoard should not reduce markets');
    assert.strictEqual(dragon, Math.floor(normal * DRAGON_FORM.hoardEconMult) || dragon);
    // marketIncomeFull floors at end; allow exact or floor relation
    assert.ok(Math.abs(dragon - Math.floor(normal * DRAGON_FORM.hoardEconMult)) <= 1 || dragon === Math.floor(
      // recompute path may apply floor once
      normal * DRAGON_FORM.hoardEconMult,
    ));
  }
  console.log(`  ✓ market ${normal} → dragon ${dragon}`);
}

console.log('fixed-army budget: P8 dragon vs P5 peer (documented curve)');
{
  const base = 10000;
  const p5Power = applyPrestigeCombatMultiplier(base, 5);
  const p8Power = applyPrestigeCombatMultiplier(base, 8);
  assert.strictEqual(p5Power, p8Power); // both 10500
  const p8DragonAtk = evo.applyDragonTerror(
    p8Power,
    { evolution_form: 'dragon', prestige_level: 8 },
    { prestige_level: 5 },
  );
  const p5Def = Math.round(p5Power * 1.0);
  const p8DragonDef = Math.round(p8Power * DRAGON_FORM.defenseMult);
  // Attacking down: terror helps dragon; defending: dragon is slightly softer (0.92)
  assert.ok(p8DragonAtk > p5Def, 'dragon attack with terror beats equal-army P5 raw');
  assert.ok(p8DragonDef < p5Def, 'dragon defense softer than non-dragon same prestige combat');
  console.log(
    `  ✓ P5 atk/def ${p5Power}/${p5Def}; P8 dragon atk/def ${p8DragonAtk}/${p8DragonDef}`,
  );
}

console.log('abort then cannot resume without new egg');
{
  const k = {
    prestige_level: EVOLUTION_PRESTIGE_GATE,
    bld_castles: 2,
    items: JSON.stringify([{ id: DRAGON_EGG_ITEM_ID, name: DRAGON_EGG_ITEM_NAME, qty: 1 }]),
    evolution_form: '',
    evolution_ritual: '{}',
    turn: 10,
  };
  const started = evo.startDragonRitual(k);
  const mid = {
    ...k,
    ...started.updates,
  };
  const aborted = evo.abortDragonRitual(mid);
  const after = { ...mid, ...aborted.updates };
  assert.ok(!evo.canStartDragonRitual(after).ok, 'egg already gone');
  console.log('  ✓ abort spends egg permanently');
}

console.log('✓ evolution-deep.test.js passed');
