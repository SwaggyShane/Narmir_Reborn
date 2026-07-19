'use strict';

/**
 * Suite 02: Core game modules load and expose expected entry points.
 * Pure require + typeof checks — no DB.
 */

const path = require('path');
const { assert } = require('../lib/report');

const ROOT = path.join(__dirname, '..', '..');

/** module path relative to repo root → required export names */
const MODULE_SURFACE = {
  'game/engine.js': [
    'processTurn',
    'resolveMilitaryAttack',
    'castSpell',
    'covertSpy',
    'covertLoot',
    'covertAssassinate',
    'covertSabotage',
    'hireUnits',
    'hireMercenaries',
    'queueBuildings',
    'studyDiscipline',
    'selectSchool',
    'purchaseUpgrade',
    'forgeTools',
    'awardXp',
    'calculateScore',
    'SPELL_DEFS',
  ],
  'game/command-handler.js': [
    'createCommandHandler',
    'COMMAND_TYPES',
    'assertSerializable',
  ],
  'game/combat.js': [], // may re-export; just must load
  'game/combat-resolver.js': [],
  'game/covert.js': [
    'covertSpy',
    'covertLoot',
    'covertAssassinate',
    'covertSabotage',
  ],
  'game/magic.js': ['castSpell', 'manaPerTurn', 'validateSpellTarget'],
  'game/economy.js': [],
  'game/defense.js': [],
  'game/recruitment.js': [],
  'game/heroes.js': [],
  'game/happiness.js': [],
  'game/population.js': [],
  'game/prestige.js': [],
  'game/visibility.js': [],
  'game/attunements.js': [],
  'game/xp.js': [],
  'game/goals.js': [],
  'game/config.js': ['SPELL_DEFS'],
  'game/turn-systems.js': [],
  'game/regen.js': [],
  'game/active-ability-manager.js': [],
  'game/fragment-bonus-manager.js': [],
  'game/synergy-effects-processor.js': [],
};

async function run(report) {
  const system = 'modules';
  console.log('\n▶ Suite 02 — Module surface (load + exports)');

  for (const [rel, exportsNeeded] of Object.entries(MODULE_SURFACE)) {
    await report.run(system, `load ${rel}`, async () => {
      const mod = require(path.join(ROOT, rel));
      assert(mod != null, `${rel} exported null/undefined`);
      for (const name of exportsNeeded) {
        assert(
          mod[name] !== undefined,
          `${rel} missing export ${name}`,
        );
        if (typeof mod[name] === 'function' || typeof mod[name] === 'object') {
          // ok
        } else {
          throw new Error(`${rel}.${name} has unexpected type ${typeof mod[name]}`);
        }
      }
      return exportsNeeded.length ? `${exportsNeeded.length} exports` : 'loads';
    });
  }

  await report.run(system, 'COMMAND_TYPES covers combat/spell/covert', async () => {
    const { COMMAND_TYPES } = require(path.join(ROOT, 'game/command-handler.js'));
    for (const t of [
      'turn',
      'combat',
      'spell',
      'covert-spy',
      'covert-loot',
      'covert-assassinate',
      'covert-sabotage',
      'hire-units',
      'hire-mercenaries',
      'queue-buildings',
      'study-discipline',
      'forge-tools',
    ]) {
      assert(COMMAND_TYPES.includes(t), `COMMAND_TYPES missing ${t}`);
    }
    return `${COMMAND_TYPES.length} command types`;
  });

  await report.run(system, 'SPELL_DEFS has tier-1 combat spells', async () => {
    const { SPELL_DEFS } = require(path.join(ROOT, 'game/config.js'));
    for (const id of ['spark', 'mend', 'fog_of_war', 'lightning', 'bless']) {
      assert(SPELL_DEFS[id], `SPELL_DEFS missing ${id}`);
      assert(SPELL_DEFS[id].tier >= 1, `${id} missing tier`);
      assert(SPELL_DEFS[id].minSB > 0, `${id} missing minSB`);
    }
    return `${Object.keys(SPELL_DEFS).length} spells defined`;
  });
}

module.exports = { run, name: '02-module-surface' };
