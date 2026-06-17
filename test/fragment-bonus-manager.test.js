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
  console.log('Test 1: combat fragment caps apply to oversized values ✓');
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
  console.log('Test 2: non-combat bonuses remain uncapped ✓');
}

console.log('\nAll fragment-bonus-manager tests passed.');
