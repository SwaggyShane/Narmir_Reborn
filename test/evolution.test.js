'use strict';
// Roadmap B — dragon evolution unit tests (EVOLUTION.md)
// Run: node test/evolution.test.js

const assert = require('assert');
const evo = require('../game/evolution');
const {
  EVOLUTION_PRESTIGE_GATE,
  RITUAL_TURNS,
  DRAGON_EGG_ITEM_ID,
  DRAGON_FORM,
  FIXED_ARMY_BUDGET,
} = require('../game/evolution/balance');
const { applyPrestigeCombatMultiplier } = require('../game/prestige/combat');
const { rollLootDiscovery, TREK_ARTIFACTS } = require('../game/epic-trek-discovery');

function kingdom(over = {}) {
  return {
    id: 1,
    turn: 100,
    prestige_level: 8,
    bld_castles: 2,
    evolution_form: '',
    evolution_ritual: '{}',
    items: JSON.stringify([{ id: DRAGON_EGG_ITEM_ID, name: 'Dragon Egg', qty: 1 }]),
    ...over,
  };
}

console.log('evolution gates');
assert.strictEqual(EVOLUTION_PRESTIGE_GATE, 8);
assert.strictEqual(RITUAL_TURNS, 50);
assert.ok(!evo.canStartDragonRitual(kingdom({ prestige_level: 7 })).ok);
assert.ok(!evo.canStartDragonRitual(kingdom({ bld_castles: 0 })).ok);
assert.ok(!evo.canStartDragonRitual(kingdom({ items: '[]' })).ok, 'no egg');
assert.ok(evo.canStartDragonRitual(kingdom()).ok);

console.log('start ritual consumes egg');
const started = evo.startDragonRitual(kingdom());
assert.ok(!started.error);
assert.ok(started.eggConsumed);
const ritual = JSON.parse(started.updates.evolution_ritual);
assert.strictEqual(ritual.state, 'CHANNELING');
assert.strictEqual(ritual.turns_remaining, RITUAL_TURNS);
const itemsAfter = JSON.parse(started.updates.items);
assert.ok(!itemsAfter.some((i) => i.id === DRAGON_EGG_ITEM_ID && i.qty > 0));

console.log('cannot prestige-channeling is separate; cannot double-start');
const channeling = kingdom({
  evolution_ritual: started.updates.evolution_ritual,
  items: started.updates.items,
});
assert.ok(evo.isChanneling(channeling));
assert.ok(!evo.canStartDragonRitual(channeling).ok);

console.log('ritual tick decrements; castle fail');
const tick1 = evo.processEvolutionTurn({
  ...channeling,
  evolution_ritual: started.updates.evolution_ritual,
  bld_castles: 2,
});
assert.ok(tick1);
const r1 = JSON.parse(tick1.updates.evolution_ritual);
assert.strictEqual(r1.turns_remaining, RITUAL_TURNS - 1);

const fail = evo.processEvolutionTurn({
  ...channeling,
  evolution_ritual: started.updates.evolution_ritual,
  bld_castles: 0,
});
assert.strictEqual(JSON.parse(fail.updates.evolution_ritual).state, 'FAILED');
assert.ok(fail.events.some((ev) => /castle/i.test(ev.message)));

console.log('ritual complete => evolution_form=dragon');
const almost = {
  ...channeling,
  bld_castles: 1,
  evolution_ritual: JSON.stringify({
    state: 'CHANNELING',
    form: 'dragon',
    turns_remaining: 1,
    turns_total: RITUAL_TURNS,
  }),
};
const done = evo.processEvolutionTurn(almost);
assert.strictEqual(done.updates.evolution_form, 'dragon');
assert.strictEqual(JSON.parse(done.updates.evolution_ritual).state, 'COMPLETE');
assert.ok(evo.isDragon({ evolution_form: 'dragon' }));

console.log('abort');
const aborted = evo.abortDragonRitual(channeling);
assert.ok(!aborted.error);
assert.strictEqual(JSON.parse(aborted.updates.evolution_ritual).state, 'ABORTED');

console.log('stacking: no second global combat %; terror vs lower P only');
const base = FIXED_ARMY_BUDGET.baseArmyPower;
const p5 = applyPrestigeCombatMultiplier(base, 5);
const p8 = applyPrestigeCombatMultiplier(base, 8);
assert.strictEqual(p5, 10500);
assert.strictEqual(p8, 10500, 'prestige combat hard-cap');
assert.strictEqual(FIXED_ARMY_BUDGET.dragonCombatMult, 1.0);
// Dragon does not multiply baseline combat further
const dragonAtk = evo.applyDragonTerror(p8, { evolution_form: 'dragon', prestige_level: 8 }, { prestige_level: 5 });
assert.strictEqual(dragonAtk, Math.round(10500 * DRAGON_FORM.terrorVsLowerPrestige));
const peer = evo.applyDragonTerror(p8, { evolution_form: 'dragon', prestige_level: 8 }, { prestige_level: 8 });
assert.strictEqual(peer, 10500, 'no terror vs equal/higher P');
const nonDragon = evo.applyDragonTerror(p8, { evolution_form: '', prestige_level: 8 }, { prestige_level: 1 });
assert.strictEqual(nonDragon, 10500);

assert.strictEqual(evo.getDragonDefenseMult({ evolution_form: 'dragon' }), DRAGON_FORM.defenseMult);
assert.strictEqual(
  evo.getDragonDefenseMult({
    evolution_ritual: JSON.stringify({ state: 'CHANNELING' }),
  }),
  0.85,
);
assert.strictEqual(evo.getDragonUpkeepMult({ evolution_form: 'dragon' }), DRAGON_FORM.upkeepMult);
assert.strictEqual(evo.getDragonHoardEconMult({ evolution_form: 'dragon' }), DRAGON_FORM.hoardEconMult);

console.log('trek egg rarity configured (endgame)');
const { EGG_ARTIFACT_ROLL_CHANCE } = require('../game/evolution/balance');
assert.ok(EGG_ARTIFACT_ROLL_CHANCE > 0 && EGG_ARTIFACT_ROLL_CHANCE <= 0.15, 'egg must be rare fraction of artifacts');
assert.ok(TREK_ARTIFACTS.length >= 1);
// Smoke: rollLootDiscovery is callable (seeded may or may not hit artifact)
const sample = rollLootDiscovery(1, 2, { id: 99, turn: 1 });
assert.ok(sample === null || sample.type === 'loot');

console.log('✓ evolution.test.js passed');
