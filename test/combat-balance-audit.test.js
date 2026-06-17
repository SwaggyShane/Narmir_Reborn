'use strict';

const assert = require('assert');
const { SYNERGIES } = require('../game/fragment-synergies');
const FRAGMENT_BONUSES = require('../game/world-fragment-bonuses');
const attunementManager = require('../game/attunement-manager');
const combatBalanceAudit = require('../game/combat-balance-audit');

function makeKingdomFromSynergy(synergyId, overrides = {}) {
  const synergy = SYNERGIES[synergyId];
  if (!synergy) throw new Error(`Missing synergy ${synergyId}`);

  const fragmentBonuses = {};
  for (const [fragmentName, buildingType] of Object.entries(synergy.requiredFragments)) {
    const fragmentConfig = FRAGMENT_BONUSES[fragmentName]?.[buildingType];
    fragmentBonuses[buildingType] = {
      fragment: fragmentName,
      applied_turn: 1,
      passive: fragmentConfig?.passive || {},
      special: {
        name: fragmentConfig?.special?.name || '',
        desc: fragmentConfig?.special?.desc || '',
      },
    };
  }

  return {
    turn: 20,
    race: 'human',
    fragment_bonuses: JSON.stringify(fragmentBonuses),
    active_effects: '{}',
    synergy_cooldowns: '{}',
    ...overrides,
  };
}

console.log('Testing combat-balance-audit.js\n');

{
  const k = {
    turn: 20,
    race: 'human',
    fragment_bonuses: JSON.stringify({
      walls: {
        fragment: 'Celestial Feather',
        applied_turn: 1,
        passive: { health: 0.30, defense: 0.15 },
        special: {},
      },
      guard_towers: {
        fragment: 'Dwarven Star-Metal',
        applied_turn: 1,
        passive: { detection: 0.30, power: 0.15, reach: 0.20 },
        special: {},
      },
      outposts: {
        fragment: 'Ancient Elven Wood',
        applied_turn: 1,
        passive: { effectiveness: 0.30, scouts: 0.15, power: 0.10 },
        special: {},
      },
      armories: {
        fragment: 'Titan Bone',
        applied_turn: 1,
        passive: { garrison_defense: 0.35, health_recovery: 0.30 },
        special: {},
      },
      castles: {
        fragment: 'Abyssal Crystal',
        applied_turn: 1,
        passive: { income: 0.30, prestige: 0.15 },
        special: {},
      },
    }),
    active_effects: '{}',
    synergy_cooldowns: '{}',
  };

  const audit = combatBalanceAudit.getCombatBalanceAudit(k);
  const wallEntry = audit.combatBuildings.find(entry => entry.buildingType === 'walls');
  const warMachineEntry = audit.combatBuildings.find(entry => entry.buildingType === 'war_machines');
  assert.ok(wallEntry, 'walls should be present in combat audit');
  assert.ok(warMachineEntry, 'war machines should be present in combat audit');
  assert.equal(warMachineEntry.fragment, null, 'war machines are currently not fragment-attuned');
  assert.equal(audit.synergyAudit.active, null, 'no synergy should be active for this stack-only kingdom');
  assert.ok(audit.fragmentAudit.totals.combat_defense > 0, 'fragment combat defense should be counted');
  assert.ok(audit.fragmentAudit.totals.combat_offense > 0, 'fragment combat offense should be counted');
  console.log('Test 1: defensive fragment stack audit passes ✓');
}

{
  const k = makeKingdomFromSynergy('void-convergence');
  const synergy = attunementManager.getActiveSynergy(k);
  assert.ok(synergy, 'Void Convergence synergy should activate');
  assert.equal(synergy.id, 'void-convergence');

  const audit = combatBalanceAudit.getCombatBalanceAudit(k);
  const synergyEffect = audit.synergyAudit.effects.find(effect => effect.effectKey === 'combat_power');
  assert.ok(synergyEffect, 'combat_power should be visible in the synergy audit');
  assert.equal(synergyEffect.bucket, 'combat_offense');
  assert.equal(synergyEffect.clampedDelta, 0.5, 'combat_power should clamp to the audit cap');
  assert.ok(audit.synergyAudit.overages.some(entry => entry.effectKey === 'combat_power'), 'combat_power overage should be reported');
  console.log('Test 2: offensive synergy stack audit passes ✓');
}

console.log('\nAll combat-balance-audit tests passed.');
