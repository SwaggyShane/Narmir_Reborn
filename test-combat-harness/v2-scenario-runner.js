const enginePath = require.resolve('../game/engine');

function loadEngineV2() {
  process.env.USE_COMBAT_V2 = '1';
  delete require.cache[enginePath];
  return require('../game/engine');
}

const engine = loadEngineV2();

function levels(overrides = {}) {
  return JSON.stringify({
    fighters: { level: 10 },
    rangers: { level: 10 },
    mages: { level: 10 },
    clerics: { level: 10 },
    thralls: { level: 1 },
    ninjas: { level: 10 },
    thieves: { level: 10 },
    engineers: { level: 10 },
    war_machines: { level: 10 },
    ...overrides,
  });
}

function kingdom(overrides = {}) {
  return {
    id: 1,
    name: 'Kingdom',
    race: 'human',
    land: 1000,
    turn: 1,
    level: 1,
    xp: 0,
    xp_sources: '{}',
    troop_levels: levels(),
    happiness: 100,
    injured_troops: '{}',
    training_allocation: '{}',
    weapons_stockpile: 1000,
    armor_stockpile: 1000,
    ladders: 0,
    thralls: 0,
    fighters: 100,
    rangers: 20,
    mages: 10,
    clerics: 10,
    ninjas: 0,
    thieves: 0,
    engineers: 20,
    war_machines: 0,
    ballistae: 0,
    res_weapons: 100,
    res_armor: 100,
    res_war_machines: 100,
    res_military: 100,
    res_attack_magic: 100,
    res_defense_magic: 100,
    bld_walls: 0,
    wall_hp: 0,
    wall_defense_type: 'fortified',
    discovered_kingdoms: '{}',
    ...overrides,
  };
}

function runAttack({ attacker, defender, sent }) {
  return engine.resolveMilitaryAttack(attacker, defender, sent);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function summarize(result) {
  return {
    win: result.win,
    atkPower: result.report.atkPower,
    defPower: result.report.defPower,
    atkLost: (result.report.atkThrallsLost || 0) + result.report.atkFightersLost + result.report.atkRangersLost + result.report.atkMagesLost,
    defLost: (result.report.defThrallsLost || 0) + result.report.defFightersLost + result.report.defRangersLost + result.report.defMagesLost,
    wallDamage: result.report.wallDamage || 0,
    disabledWarMachines: result.report.disabledWarMachines || 0,
    attackerCrew: result.report.diagnostics?.attacker?.warMachines,
    defenderCrew: result.report.diagnostics?.defender?.warMachines,
    attackerHpTypes: Object.keys(result.report.diagnostics?.attacker?.hpByType || {}),
    attackerDmgTypes: Object.keys(result.report.diagnostics?.attacker?.dmgByType || {}),
    criticalHits: result.report.criticalHits || 0,
    criticalKills: result.report.criticalKills || 0,
  };
}

const scenarios = [
  {
    name: 'dwarf_level_24_war_machines_need_two_engineers',
    setup: () => ({
      attacker: kingdom({
        id: 10,
        name: 'Dwarf L24',
        race: 'dwarf',
        engineers: 25,
        war_machines: 20,
        troop_levels: levels({ engineers: { level: 24 } }),
      }),
      defender: kingdom({ id: 11, name: 'Human Defender', race: 'human' }),
      sent: { fighters: 100, engineers: 25, warMachines: 20 },
    }),
    check: (result) => {
      const crew = result.report.diagnostics.attacker.warMachines;
      assert(crew.crewRequired === 2, 'Dwarf engineer level 24 should still require 2 engineers');
      assert(crew.crewed === 12, '25 engineers should crew 12 dwarf machines at level 24');
      assert(crew.inactive === 8, '8 machines should be inactive at level 24');
    },
  },
  {
    name: 'dwarf_level_25_war_machines_solo_crew',
    setup: () => ({
      attacker: kingdom({
        id: 20,
        name: 'Dwarf L25',
        race: 'dwarf',
        engineers: 25,
        war_machines: 20,
        troop_levels: levels({ engineers: { level: 25 } }),
      }),
      defender: kingdom({ id: 21, name: 'Human Defender', race: 'human' }),
      sent: { fighters: 100, engineers: 25, warMachines: 20 },
    }),
    check: (result) => {
      const crew = result.report.diagnostics.attacker.warMachines;
      assert(crew.crewRequired === 1, 'Dwarf engineer level 25 should require 1 engineer');
      assert(crew.crewed === 20, '25 engineers should crew all 20 machines at level 25');
      assert(crew.inactive === 0, 'No machines should be inactive at level 25');
    },
  },
  {
    name: 'thieves_reduce_defender_war_machines',
    setup: () => ({
      attacker: kingdom({
        id: 30,
        name: 'Saboteur',
        thieves: 20,
      }),
      defender: kingdom({
        id: 31,
        name: 'Machine Defender',
        engineers: 60,
        war_machines: 20,
      }),
      sent: { fighters: 100, thieves: 20 },
    }),
    check: (result) => {
      assert(result.report.disabledWarMachines > 0, 'Thieves should disable defender war machines');
      assert(result.report.diagnostics.defender.warMachines.owned < 20, 'Diagnostics should use reduced defender machines');
    },
  },
  {
    name: 'ballistae_add_fixed_structure_defense',
    setup: () => ({
      attacker: kingdom({
        id: 35,
        name: 'Mobile Siege',
        engineers: 40,
        war_machines: 20,
      }),
      defender: kingdom({
        id: 36,
        name: 'Ballista Wall',
        fighters: 100,
        engineers: 0,
        war_machines: 0,
        ballistae: 12,
        bld_walls: 20,
        wall_hp: 2000,
        wall_defense_type: 'fortified',
      }),
      sent: { fighters: 100, engineers: 40, warMachines: 20 },
    }),
    check: (result) => {
      const structureDefense = result.report.diagnostics.defender.structureDefense;
      assert(structureDefense.ballistae === 10, '20 walls should mount 10 of 12 ballistae');
      assert(structureDefense.ballistaPower > 0, 'Ballistae should add structure defense power');
      assert(result.report.diagnostics.defender.warMachines.owned === 0, 'Ballistae should not count as mobile defender war machines');
    },
  },
  {
    name: 'ladders_and_engineers_can_damage_walls',
    setup: () => ({
      attacker: kingdom({
        id: 40,
        name: 'Ladder Attacker',
        race: 'dwarf',
        fighters: 500,
        engineers: 50,
        ladders: 10,
        troop_levels: levels({ engineers: { level: 200 } }),
      }),
      defender: kingdom({
        id: 41,
        name: 'Wall Defender',
        fighters: 1,
        rangers: 0,
        mages: 0,
        clerics: 0,
        engineers: 0,
        bld_walls: 10,
        wall_hp: 1000,
        wall_defense_type: 'fortified',
      }),
      sent: { fighters: 500, engineers: 50, ladders: 10 },
    }),
    check: (result) => {
      assert(typeof result.report.wallHpBefore === 'number', 'Wall HP before should be reported');
      assert(typeof result.report.wallHpAfter === 'number', 'Wall HP after should be reported');
      assert(result.report.wallDamage > 0, 'Winning ladder attack should damage walls');
      assert(result.report.wallHpAfter < result.report.wallHpBefore, 'Wall HP should drop after ladder damage');
    },
  },
  {
    name: 'clerics_create_rescue_diagnostics',
    random: 0,
    setup: () => ({
      attacker: kingdom({
        id: 50,
        name: 'Cleric Attacker',
        fighters: 50,
        clerics: 50,
        injured_troops: JSON.stringify({
          fighters: [{ hp: 0, max_hp: 350 }],
        }),
      }),
      defender: kingdom({
        id: 51,
        name: 'Weak Defender',
        fighters: 1,
        rangers: 0,
        mages: 0,
        clerics: 0,
        engineers: 0,
      }),
      sent: { fighters: 50, clerics: 50 },
    }),
    check: (result) => {
      assert(Array.isArray(result.report.clericRescues), 'Cleric rescues should be reported');
      assert(Array.isArray(result.report.clericRescuesBySide?.attacker), 'Attacker cleric rescues should be reported by side');
      assert(Array.isArray(result.report.clericRescuesBySide?.defender), 'Defender cleric rescues should be reported by side');
      assert(
        result.report.clericRescues.length ===
          result.report.clericRescuesBySide.attacker.length + result.report.clericRescuesBySide.defender.length,
        'Combined cleric rescues should include both sides'
      );
    },
  },
  {
    name: 'mages_contribute_to_v2_diagnostics',
    setup: () => ({
      attacker: kingdom({
        id: 60,
        name: 'Mage Attacker',
        fighters: 1,
        mages: 100,
        race: 'high_elf',
        troop_levels: levels({ mages: { level: 20 } }),
      }),
      defender: kingdom({ id: 61, name: 'Basic Defender', race: 'orc' }),
      sent: { fighters: 1, mages: 100 },
    }),
    check: (result) => {
      assert(result.report.diagnostics.attacker.hpByType.mages > 0, 'Mage HP should be in diagnostics');
      assert(result.report.diagnostics.attacker.dmgByType.mages > 0, 'Mage DMG should be in diagnostics');
      assert(result.report.atkPower > 1000, 'Sent mages should contribute to military attack power');
    },
  },
  {
    name: 'individual_hits_injure_many_targets_without_pooling',
    random: 0.5,
    setup: () => ({
      attacker: kingdom({
        id: 65,
        name: 'Individual Hit Fighters',
        fighters: 1000,
        rangers: 0,
        mages: 0,
        clerics: 0,
        engineers: 0,
      }),
      defender: kingdom({
        id: 66,
        name: 'Individual Hit Rangers',
        fighters: 0,
        rangers: 1000,
        mages: 0,
        clerics: 0,
        engineers: 0,
      }),
      sent: { fighters: 1000 },
    }),
    check: (result) => {
      const defenderDamage = result.report.injuredTroops.defender;
      assert(result.win === true, 'Forced roll should allow the individual-hit attack through');
      assert((defenderDamage.deadByType.rangers || 0) === 0, 'Individual fighter hits should not pool into dead rangers');
      assert((defenderDamage.injuredByType.rangers || 0) > 10, 'Individual fighter hits should create many injured rangers');
    },
  },
  {
    name: 'critical_hits_create_decisive_kills_without_pooling',
    random: 0,
    setup: () => ({
      attacker: kingdom({
        id: 67,
        name: 'Critical Fighters',
        fighters: 100,
        rangers: 0,
        mages: 0,
        clerics: 0,
        engineers: 0,
      }),
      defender: kingdom({
        id: 68,
        name: 'Critical Ranger Targets',
        fighters: 0,
        rangers: 10,
        mages: 0,
        clerics: 0,
        engineers: 0,
      }),
      sent: { fighters: 100 },
    }),
    check: (result) => {
      const defenderDamage = result.report.injuredTroops.defender;
      assert(result.report.criticalHits > 0, 'Critical hits should be reported');
      assert(result.report.criticalKills > 0, 'Critical kills should be reported');
      assert((defenderDamage.deadByType.rangers || 0) > 0, 'Critical hits should be able to kill target rangers');
      assert((defenderDamage.deadByType.rangers || 0) <= 10, 'Critical hits should not kill more rangers than were targeted');
    },
  },
  {
    name: 'stockpiled_weapons_and_armor_gate_v2_research_bonuses',
    setup: () => {
      const sent = { fighters: 100, rangers: 20, clerics: 10, engineers: 20 };
      const gearedAttacker = kingdom({
        id: 70,
        name: 'Geared Attacker',
        weapons_stockpile: 1000,
        armor_stockpile: 1000,
      });
      const ungearedAttacker = kingdom({
        id: 71,
        name: 'Ungeared Attacker',
        weapons_stockpile: 0,
        armor_stockpile: 0,
      });
      const defender = kingdom({
        id: 72,
        name: 'Equipment Defender',
        weapons_stockpile: 1000,
        armor_stockpile: 1000,
      });
      return {
        attacker: gearedAttacker,
        defender,
        sent,
        compare: runAttack({
          attacker: ungearedAttacker,
          defender: kingdom({
            id: 73,
            name: 'Equipment Defender Copy',
            weapons_stockpile: 1000,
            armor_stockpile: 1000,
          }),
          sent,
        }),
      };
    },
    check: (result, setup) => {
      const geared = result.report.diagnostics.attacker;
      const ungeared = setup.compare.report.diagnostics.attacker;
      assert(geared.equipment.totalWeaponsEquipped > 0, 'Geared attacker should equip weapons');
      assert(geared.equipment.totalArmorEquipped > 0, 'Geared attacker should equip armor');
      assert(ungeared.equipment.totalWeaponsEquipped === 0, 'Ungeared attacker should equip no weapons');
      assert(ungeared.equipment.totalArmorEquipped === 0, 'Ungeared attacker should equip no armor');
      assert(geared.totalDmg > ungeared.totalDmg, 'Stockpiled weapons should increase V2 damage budget');
      assert(geared.totalHp > ungeared.totalHp, 'Stockpiled armor should increase V2 HP budget');
    },
  },
  {
    name: 'dead_equipped_troops_remove_weapon_and_armor_stockpile',
    random: 0.999999,
    setup: () => ({
      attacker: kingdom({
        id: 80,
        name: 'Doomed Equipped Fighter',
        fighters: 1,
        rangers: 0,
        mages: 0,
        clerics: 0,
        engineers: 0,
        weapons_stockpile: 1,
        armor_stockpile: 1,
        equipment_levels: JSON.stringify({
          weapons: { level: 30, xp: 0, count: 1 },
          armor: { level: 30, xp: 0, count: 1 },
        }),
      }),
      defender: kingdom({
        id: 81,
        name: 'Overwhelming Defender',
        fighters: 10000,
        rangers: 0,
        mages: 0,
        clerics: 0,
        engineers: 0,
        weapons_stockpile: 1000,
        armor_stockpile: 1000,
        equipment_levels: JSON.stringify({
          weapons: { level: 10, xp: 0, count: 1000 },
          armor: { level: 10, xp: 0, count: 1000 },
        }),
      }),
      sent: { fighters: 1 },
    }),
    check: (result) => {
      const attackerDamage = result.report.injuredTroops.attacker;
      assert(result.win === false, 'Forced roll should repel the weak attacker');
      assert(attackerDamage.deadByType.fighters === 1, 'The equipped fighter should die');
      assert(attackerDamage.weaponsLost === 1, 'Dead equipped fighter should lose one weapon');
      assert(attackerDamage.armorLost === 1, 'Dead equipped fighter should lose one armor');
      assert(result.attackerUpdates.weapons_stockpile === 0, 'Weapon stockpile should subtract dead equipped weapon');
      assert(result.attackerUpdates.armor_stockpile === 0, 'Armor stockpile should subtract dead equipped armor');
      assert(result.defenderUpdates.weapons_stockpile === 1001, 'Defender should recover lost weapon into stockpile');
      assert(result.defenderUpdates.armor_stockpile === 1001, 'Defender should recover lost armor into stockpile');
      const defenderEquipment = JSON.parse(result.defenderUpdates.equipment_levels);
      assert(defenderEquipment.weapons.count === 1001, 'Recovered weapon should dilute into defender weapon quality count');
      assert(defenderEquipment.armor.count === 1001, 'Recovered armor should dilute into defender armor quality count');
      assert(defenderEquipment.weapons.level === 10 && defenderEquipment.weapons.xp > 0, 'High-quality captured weapon should add diluted weapon XP');
      assert(defenderEquipment.armor.level === 10 && defenderEquipment.armor.xp > 0, 'High-quality captured armor should add diluted armor XP');
    },
  },
  {
    name: 'vampire_thralls_do_not_create_cleric_rescues',
    random: 0,
    setup: () => ({
      attacker: kingdom({
        id: 90,
        name: 'Vampire Thrall Host',
        race: 'vampire',
        fighters: 50,
        thralls: 50,
        clerics: 0,
        injured_troops: JSON.stringify({
          fighters: [{ hp: 0, max_hp: 350 }],
        }),
      }),
      defender: kingdom({
        id: 91,
        name: 'Weak Defender',
        fighters: 1,
        rangers: 0,
        mages: 0,
        clerics: 0,
        engineers: 0,
      }),
      sent: { fighters: 50 },
    }),
    check: (result) => {
      assert((result.report.clericRescues || []).length === 0, 'Vampire Thralls should not use cleric rescue mechanics');
      assert((result.report.clericRescuesBySide?.attacker || []).length === 0, 'Vampire attacker rescue list should remain empty');
    },
  },
  {
    name: 'vampire_day_defense_uses_thralls_instead_of_sleeping_troops',
    random: 0,
    setup: () => ({
      attacker: kingdom({
        id: 92,
        name: 'Daylight Attacker',
        race: 'human',
        fighters: 200,
        rangers: 0,
        mages: 0,
        clerics: 0,
        engineers: 0,
      }),
      defender: kingdom({
        id: 93,
        name: 'Daylight Vampire Hold',
        race: 'vampire',
        __combatIsNight: false,
        thralls: 120,
        fighters: 500,
        rangers: 200,
        mages: 100,
        clerics: 0,
        engineers: 40,
        war_machines: 20,
        ballistae: 6,
        bld_walls: 12,
      }),
      sent: { fighters: 200 },
    }),
    check: (result) => {
      const defenderCounts = result.report.diagnostics.defender.countByType;
      assert((defenderCounts.thralls || 0) === 120, 'Daylight vampire defense should field Thralls');
      assert(!defenderCounts.fighters, 'Daylight vampire fighters should remain in mausoleums');
      assert(!defenderCounts.mages, 'Daylight vampire mages should remain in mausoleums');
      assert(result.report.defenderEngaged.thralls === 120, 'News should show Thralls engaged on daylight defense');
      assert(result.report.defenderEngaged.fighters === 0, 'News should not show sleeping fighters engaged');
    },
  },
  {
    name: 'vampire_night_victory_raises_fallen_by_unit_type',
    random: 0,
    setup: () => ({
      attacker: kingdom({
        id: 94,
        name: 'Vampire Reanimator',
        race: 'vampire',
        __combatIsNight: true,
        thralls: 30,
        fighters: 500,
        rangers: 300,
        mages: 300,
        clerics: 0,
        engineers: 100,
      }),
      defender: kingdom({
        id: 95,
        name: 'Critical Victims',
        fighters: 20,
        rangers: 20,
        mages: 20,
        clerics: 20,
        engineers: 0,
        war_machines: 10,
      }),
      sent: { fighters: 500, rangers: 300, mages: 300, engineers: 100 },
    }),
    check: (result) => {
      assert(result.win === true, 'Forced roll should give the vampire the field');
      assert(result.report.vampireReanimation, 'Vampire victory should report reanimation');
      const raised = result.report.vampireReanimation.raisedByType;
      assert((raised.fighters || 0) > 0, 'Fallen fighters should rise as fighters');
      assert((raised.rangers || 0) > 0, 'Fallen rangers should rise as rangers');
      assert((raised.mages || 0) > 0, 'Fallen mages should rise as mages');
      assert((raised.thralls || 0) > 0, 'Fallen clerics should rise as Thralls');
      assert(!raised.clerics, 'Fallen clerics should not rise as clerics');
      assert(!raised.war_machines, 'War machines should not reanimate');
      assert(result.attackerUpdates.thralls > 30, 'Raised clerics should increase Thralls');
    },
  },
];

const results = [];

for (const scenario of scenarios) {
  const setup = scenario.setup();
  const originalRandom = Math.random;
  if (typeof scenario.random === 'number') Math.random = () => scenario.random;
  try {
    const result = runAttack(setup);
    assert(result.report.combatSystem === 'v2', `${scenario.name} did not run through V2`);
    scenario.check(result, setup);
    results.push({ name: scenario.name, summary: summarize(result) });
  } finally {
    Math.random = originalRandom;
  }
}

console.log(JSON.stringify({
  passed: results.length,
  scenarios: results,
}, null, 2));
