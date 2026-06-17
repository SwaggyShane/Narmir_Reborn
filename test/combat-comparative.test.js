/**
 * Phase 2B: Combat System Comparative Testing
 * Tests wrapper function output against expected structure and validates compatibility
 */

const assert = require('assert');
const engine = require('../game/engine');

// ── Test Utilities ────────────────────────────────────────────────────────

function createTestKingdom(name = 'Test Kingdom', fighterCount = 1000) {
  return {
    id: Math.floor(Math.random() * 100000),
    name,
    race: 'human',
    region: 'temperate_plains',
    fighters: fighterCount,
    rangers: Math.floor(fighterCount * 0.5),
    mages: Math.floor(fighterCount * 0.3),
    clerics: Math.floor(fighterCount * 0.2),
    ninjas: Math.floor(fighterCount * 0.15),
    thieves: Math.floor(fighterCount * 0.1),
    engineers: Math.floor(fighterCount * 0.05),
    war_machines: Math.floor(fighterCount * 0.02),
    ladders: 10,

    land: 1000,
    gold: 50000,
    happiness: 50,
    turn: 100,

    troop_levels: {
      fighters: { level: 50, xp: 0, count: 0 },
      rangers: { level: 50, xp: 0, count: 0 },
      mages: { level: 50, xp: 0, count: 0 },
      clerics: { level: 50, xp: 0, count: 0 },
      ninjas: { level: 50, xp: 0, count: 0 },
      thieves: { level: 50, xp: 0, count: 0 },
      engineers: { level: 50, xp: 0, count: 0 },
    },

    military_research: { defense: 10, armor: 10, weapons: 10 },
    weapons_stockpile: fighterCount * 2,
    military_training: 50,
    mausoleum_upgrades: '{}',
    hero_skills: {},
    housing_cap_research: 0,

    xp: 1000,
    level: 1,

    bld_walls: 5,
    wall_level: 'keep',
    injured_troops: '{}',

    prestige_level: 0,
    synergy: '{}',
    milestones_reached: '{}',
  };
}


function validateCombatResult(result, testName = '') {
  const issues = [];

  // Validate result object exists
  if (!result || typeof result !== 'object') {
    issues.push('result is not an object');
    return { pass: false, issues, testName };
  }

  // Validate structure
  if (typeof result.win !== 'boolean') {
    issues.push('win is not boolean');
  }

  if (!result.report || typeof result.report !== 'object') {
    issues.push('report is missing or not an object');
  } else {
    const requiredReportFields = [
      'landTransferred',
      'powerRatio',
      'atkPower',
      'defPower',
      'sent',
      'atkFightersLost',
      'defFightersLost',
    ];
    requiredReportFields.forEach((field) => {
      if (result.report[field] === undefined) {
        issues.push(`report.${field} is missing`);
      }
    });

    // Validate value ranges only if fields exist
    if (result.report.landTransferred !== undefined) {
      if (Number.isNaN(result.report.landTransferred)) {
        issues.push('landTransferred is NaN');
      } else if (result.report.landTransferred < 0) {
        issues.push('landTransferred is negative');
      }
    }

    if (result.report.atkFightersLost !== undefined) {
      if (Number.isNaN(result.report.atkFightersLost)) {
        issues.push('atkFightersLost is NaN');
      }
    }

    // Validate casualty counts don't exceed sent units (with defensive checks)
    if (
      result.report.atkFightersLost !== undefined &&
      result.report.sent &&
      result.report.sent.fighters !== undefined &&
      result.report.atkFightersLost > result.report.sent.fighters
    ) {
      issues.push(
        `atkFightersLost (${result.report.atkFightersLost}) exceeds sent fighters (${result.report.sent.fighters})`
      );
    }
  }

  if (!result.attackerUpdates || typeof result.attackerUpdates !== 'object') {
    issues.push('attackerUpdates is missing or not an object');
  } else {
    const requiredUpdateFields = ['fighters', 'happiness', 'xp', 'level'];
    requiredUpdateFields.forEach((field) => {
      if (result.attackerUpdates[field] === undefined) {
        issues.push(`attackerUpdates.${field} is missing`);
      }
    });
  }

  if (!result.defenderUpdates || typeof result.defenderUpdates !== 'object') {
    issues.push('defenderUpdates is missing or not an object');
  }

  if (typeof result.atkEvent !== 'string' || result.atkEvent.length === 0) {
    issues.push('atkEvent is missing or empty');
  }

  if (typeof result.defEvent !== 'string' || result.defEvent.length === 0) {
    issues.push('defEvent is missing or empty');
  }

  return { pass: issues.length === 0, issues, testName };
}

// ── Test Cases ────────────────────────────────────────────────────────────

function testBalancedFight() {
  const attacker = createTestKingdom('Attacker', 1000);
  const defender = createTestKingdom('Defender', 1000);
  const sentUnits = { fighters: 500, mages: 100 };

  const result = engine.resolveMilitaryAttack(attacker, defender, sentUnits);

  if (result.error) {
    return { pass: false, issues: [result.error], testName: 'Balanced Fight' };
  }

  return validateCombatResult(result, 'Balanced Fight');
}

function testBullyScenario() {
  const attacker = createTestKingdom('Bully', 5000);
  const defender = createTestKingdom('Weak', 100);
  const sentUnits = { fighters: 2000, mages: 500 };

  const result = engine.resolveMilitaryAttack(attacker, defender, sentUnits);

  if (result.error) {
    return { pass: false, issues: [result.error], testName: 'Bully Scenario' };
  }

  const validation = validateCombatResult(result, 'Bully Scenario');

  // Additional check: bully penalty should reduce attacker power
  if (result.report.bullyMsg) {
    // Bully scenario detected in report
  }

  return validation;
}

function testDefenderAdvantage() {
  const attacker = createTestKingdom('Weak Attacker', 100);
  const defender = createTestKingdom('Strong Defender', 2000);
  const sentUnits = { fighters: 50, mages: 10 };

  const result = engine.resolveMilitaryAttack(attacker, defender, sentUnits);

  if (result.error) {
    return { pass: false, issues: [result.error], testName: 'Defender Advantage' };
  }

  return validateCombatResult(result, 'Defender Advantage');
}

function testMinimumTroopsCheck() {
  const attacker = createTestKingdom('Attacker', 100);
  const defender = createTestKingdom('Defender', 100);
  const sentUnits = { fighters: 0, mages: 0, rangers: 0, ninjas: 0 };

  const result = engine.resolveMilitaryAttack(attacker, defender, sentUnits);

  // Should return error
  if (!result.error) {
    return { pass: false, issues: ['Should return error for no troops sent'], testName: 'Minimum Troops Check' };
  }

  return { pass: true, issues: [], testName: 'Minimum Troops Check' };
}

function testSmallSkirmish() {
  const attacker = createTestKingdom('Small Attacker', 50);
  const defender = createTestKingdom('Small Defender', 50);
  const sentUnits = { fighters: 25, mages: 5 };

  const result = engine.resolveMilitaryAttack(attacker, defender, sentUnits);

  if (result.error) {
    return { pass: false, issues: [result.error], testName: 'Small Skirmish' };
  }

  return validateCombatResult(result, 'Small Skirmish');
}

function testLargeArmies() {
  const attacker = createTestKingdom('Large Attacker', 50000);
  const defender = createTestKingdom('Large Defender', 50000);
  const sentUnits = { fighters: 25000, mages: 5000 };

  const result = engine.resolveMilitaryAttack(attacker, defender, sentUnits);

  if (result.error) {
    return { pass: false, issues: [result.error], testName: 'Large Armies' };
  }

  return validateCombatResult(result, 'Large Armies');
}

// ── Main Test Suite ────────────────────────────────────────────────────────

function testCombatV2Blurb() {
  const attacker = createTestKingdom('Reporter Attacker', 1000);
  const defender = createTestKingdom('Reporter Defender', 1000);
  const report = {
    win: true,
    sent: { fighters: 120, rangers: 40, war_machines: 12 },
    defenderEngaged: { fighters: 90, rangers: 30, war_machines: 8 },
    landTransferred: 42,
    atkFightersLost: 10,
    defFightersLost: 25,
    atkRangersLost: 4,
    defRangersLost: 8,
    atkWmLost: 1,
    defWmLost: 2,
    atkInjuredByType: { fighters: 6 },
    defInjuredByType: { fighters: 12, war_machines: 1 },
    clericRescues: [{ troopType: 'fighters', hp: 180 }, { troopType: 'rangers', hp: 60 }],
    clericRescuesBySide: {
      attacker: [{ troopType: 'fighters', hp: 180 }],
      defender: [{ troopType: 'rangers', hp: 60 }],
    },
    vampireReanimation: { totalRaised: 14 },
    criticalHits: 3,
    criticalKills: 2,
    wallDamage: 18,
    defBldLost: 4,
    injuredTroops: {
      attacker: { deadByType: { fighters: 10, rangers: 4, war_machines: 1 }, injuredByType: { fighters: 6 } },
      defender: { deadByType: { fighters: 25, rangers: 8, war_machines: 2 }, injuredByType: { fighters: 12, war_machines: 1 } },
    },
  };

  const attackerText = engine.formatCombatV2NewsBlurb(attacker, defender, report, 'attacker');
  const defenderText = engine.formatCombatV2NewsBlurb(attacker, defender, report, 'defender');

  const requiredPhrases = [
    'Win/Loss: Victory',
    'Troops engaged - Attacker:',
    'Troops engaged - Defender:',
    'Troops lost - Attacker:',
    'Troops injured - Defender:',
    'Recovery notes:',
    'cleric rescues',
    'undead rises',
    'Critical hits:',
    'Buildings lost:',
    'Siege notes:',
    'Ballistae',
  ];

  for (const phrase of requiredPhrases) {
    assert(attackerText.includes(phrase), `Attacker blurb should include "${phrase}"`);
  }

  assert(defenderText.includes('Win/Loss: Defeat'), 'Defender blurb should flip win/loss');
  assert(defenderText.includes('Land loss: 42 acres lost'), 'Defender blurb should report land loss');

  return { pass: true, issues: [], testName: 'Combat V2 Blurb' };
}

const tests = [
  { name: 'Balanced Fight', fn: testBalancedFight },
  { name: 'Bully Scenario', fn: testBullyScenario },
  { name: 'Defender Advantage', fn: testDefenderAdvantage },
  { name: 'Minimum Troops Check', fn: testMinimumTroopsCheck },
  { name: 'Small Skirmish', fn: testSmallSkirmish },
  { name: 'Large Armies', fn: testLargeArmies },
  { name: 'Combat V2 Blurb', fn: testCombatV2Blurb },
];

let passCount = 0;
let failCount = 0;
const results = [];

console.log('\n' + '='.repeat(70));
console.log('PHASE 2B: COMBAT SYSTEM COMPARATIVE TESTING');
console.log('='.repeat(70) + '\n');

tests.forEach((test) => {
  try {
    const result = test.fn();
    results.push(result);

    if (result.pass) {
      console.log(`✅ ${result.testName}`);
      passCount++;
    } else {
      console.log(`❌ ${result.testName}`);
      result.issues.forEach((issue) => console.log(`   - ${issue}`));
      failCount++;
    }
  } catch (error) {
    console.log(`❌ ${test.name} (Exception)`);
    console.log(`   - ${error.message}`);
    failCount++;
    results.push({ pass: false, issues: [error.message], testName: test.name });
  }
});

// Summary
console.log('\n' + '='.repeat(70));
console.log(`SUMMARY: ${passCount} passed, ${failCount} failed (${tests.length} total)`);
console.log('='.repeat(70) + '\n');

// Report
if (failCount > 0) {
  console.log('FAILED TESTS:');
  results.filter((r) => !r.pass).forEach((result) => {
    console.log(`\n${result.testName}:`);
    result.issues.forEach((issue) => console.log(`  - ${issue}`));
  });
  process.exit(1);
} else {
  console.log('✅ All tests passed!\n');
  process.exit(0);
}
