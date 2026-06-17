'use strict';

const assert = require('assert');
const fragmentBonusManager = require('../game/fragment-bonus-manager');

function makeKingdom(fragmentBonuses) {
  return {
    fragment_bonuses: JSON.stringify(fragmentBonuses),
  };
}

console.log('Testing fragment-bonus-manager.js\n');

{
  assert.equal(
    fragmentBonusManager.classifyFragmentStat('combat_power'),
    'combat_offense',
    'combat power should classify as offense'
  );
  assert.equal(
    fragmentBonusManager.classifyFragmentStat('garrison_defense'),
    'combat_defense',
    'garrison defense should classify as defense'
  );
  assert.equal(
    fragmentBonusManager.classifyFragmentStat('manaRegen'),
    'research',
    'mana regen should classify as research'
  );
  assert.equal(
    fragmentBonusManager.classifyFragmentStat('happiness'),
    'utility',
    'happiness should remain utility'
  );
  console.log('Test 1: fragment stat buckets classify correctly ✓');
}

{
  const k = makeKingdom({
    guard_towers: {
      fragment: 'Void Essence',
      passive: { garrison_defense: 1.2, structural_stability: -0.4 },
    },
  });
  assert.equal(
    fragmentBonusManager.getBonusMultiplier(k, 'guard_towers', 'garrison_defense'),
    1.5,
    'combat-relevant garrison defense should cap at +50%'
  );
  assert.equal(
    fragmentBonusManager.getBonusMultiplier(k, 'guard_towers', 'structural_stability'),
    0.6,
    'negative combat-relevant penalties should preserve their intended magnitude'
  );
  console.log('Test 2: combat fragment caps apply to oversized values ✓');
}

{
  const k = makeKingdom({
    taverns: {
      fragment: 'Celestial Feather',
      passive: { happiness: 0.75 },
    },
  });
  assert.equal(
    fragmentBonusManager.getBonusMultiplier(k, 'taverns', 'happiness'),
    1.75,
    'non-combat fragment bonuses should remain unchanged'
  );
  console.log('Test 3: non-combat bonuses remain uncapped ✓');
}

{
  const k = makeKingdom({
    mage_towers: {
      fragment: 'Abyssal Crystal',
      passive: { manaRegen: 0.1, speed: 0.2 },
    },
  });
  assert.equal(
    fragmentBonusManager.getBonusMultiplier(k, 'mage_towers', 'mana_regen'),
    1.1,
    'mana_regen should resolve against manaRegen'
  );
  assert.equal(
    fragmentBonusManager.getBonusMultiplier(k, 'mage_towers', 'research_speed'),
    1.2,
    'research_speed should resolve against speed'
  );
  console.log('Test 4: fragment stat aliases resolve correctly ✓');
}

{
  const k = makeKingdom({
    walls: {
      fragment: 'Void Essence',
      passive: {
        health: 1.2,
        defense: 0.8,
        happiness: 0.4,
      },
    },
  });
  const audit = fragmentBonusManager.getFragmentCombatAudit(k);
  const wallAudit = audit.buildings.find(entry => entry.buildingType === 'walls');
  assert.ok(wallAudit, 'walls should be present in combat audit');
  const health = wallAudit.stats.find(stat => stat.statType === 'health');
  const happiness = wallAudit.stats.find(stat => stat.statType === 'happiness');
  assert.equal(health.bucket, 'combat_defense', 'health should audit as combat defense');
  assert.equal(health.clampedDelta, 0.5, 'health should clamp to +50%');
  assert.equal(happiness.bucket, 'utility', 'happiness stays utility');
  assert.equal(audit.totals.combat_defense > 0, true, 'combat defense total should accumulate');
  assert.equal(audit.totals.utility > 0, true, 'utility total should accumulate separately');
  console.log('Test 5: combat fragment audit groups and clamps stats ✓');
}

console.log('\nAll fragment-bonus-manager tests passed.');
