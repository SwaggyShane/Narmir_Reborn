/**
 * Combat Test Harness - Parameterized Test Runner
 *
 * Executes combat scenarios with configurable parameters.
 * Supports all race matchups, army sizes, defense levels, and edge cases.
 *
 * Usage:
 *   node combat-test-runner.js --attacker human --defender orc --army 1000 --defense high
 *   node combat-test-runner.js --all-scenarios
 *   node combat-test-runner.js --stress-test
 */

const fs = require('fs');
const path = require('path');


const RACES = ['human', 'orc', 'dwarf', 'dark_elf', 'vampire', 'dire_wolf', 'wood_elf', 'ogre'];

// Test result tracking
class CombatTestResults {
  constructor() {
    this.results = [];
    this.startTime = new Date();
  }

  addResult(scenario, result) {
    this.results.push({
      timestamp: new Date().toISOString(),
      scenario,
      result,
      success: !result.error,
    });
  }

  save(filename = null) {
    const name = filename || `combat-test-results-${Date.now()}.json`;
    const filepath = path.join(__dirname, '..', 'test-results', name);

    // Ensure directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const report = {
      metadata: {
        startTime: this.startTime.toISOString(),
        endTime: new Date().toISOString(),
        totalTests: this.results.length,
        passedTests: this.results.filter(r => r.success).length,
        failedTests: this.results.filter(r => !r.success).length,
      },
      results: this.results,
    };

    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`\n✓ Results saved to: ${filepath}`);

    return filepath;
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    attacker: null,
    defender: null,
    attackerArmy: 1000,
    defenderArmy: 1000,
    defenseLevel: 'none', // none, basic, moderate, heavy
    scenario: 'single', // single, all-race-matchups, all-scenarios, stress-test
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--attacker') options.attacker = args[++i];
    else if (args[i] === '--defender') options.defender = args[++i];
    else if (args[i] === '--attacker-army') options.attackerArmy = parseInt(args[++i]);
    else if (args[i] === '--defender-army') options.defenderArmy = parseInt(args[++i]);
    else if (args[i] === '--defense') options.defenseLevel = args[++i];
    else if (args[i] === '--all-scenarios') options.scenario = 'all-scenarios';
    else if (args[i] === '--stress-test') options.scenario = 'stress-test';
    else if (args[i] === '--all-race-matchups') options.scenario = 'all-race-matchups';
    else if (args[i] === '--help') {
      console.log(`
Combat Test Runner - Comprehensive Combat System Testing

Usage:
  node combat-test-runner.js [OPTIONS]

Options:
  --attacker RACE              Attacker race (human, orc, dwarf, etc.)
  --defender RACE              Defender race
  --attacker-army SIZE         Number of attacking fighters (default: 1000)
  --defender-army SIZE         Number of defending fighters (default: 1000)
  --defense LEVEL              Defense level: none, basic, moderate, heavy (default: none)

  --all-scenarios              Run all test scenarios (comprehensive)
  --stress-test                Run extreme stress tests
  --all-race-matchups          Test all race vs race combinations
  --help                       Show this help message

Examples:
  # Single match: Human (1000 fighters) vs Orc (1000 fighters)
  node combat-test-runner.js --attacker human --defender orc

  # Single extreme: 1 Human fighter vs 5000 defending troops
  node combat-test-runner.js --attacker human --defender orc --attacker-army 1 --defender-army 5000

  # Comprehensive testing
  node combat-test-runner.js --all-scenarios
      `);
      process.exit(0);
    }
  }

  return options;
}

// Generate test scenarios based on options
function generateScenarios(options) {
  const scenarios = [];

  if (options.scenario === 'single') {
    if (!options.attacker || !options.defender) {
      console.error('Error: --attacker and --defender required for single scenario');
      process.exit(1);
    }
    scenarios.push({
      name: `${options.attacker} vs ${options.defender}`,
      attacker: options.attacker,
      defender: options.defender,
      attackerTroops: options.attackerArmy,
      defenderTroops: options.defenderArmy,
      defenseLevel: options.defenseLevel,
    });
  } else if (options.scenario === 'all-race-matchups') {
    // All race combinations
    for (const attacker of RACES) {
      for (const defender of RACES) {
        if (attacker === defender) continue; // Skip self-battles
        scenarios.push({
          name: `${attacker} vs ${defender}`,
          attacker,
          defender,
          attackerTroops: 1000,
          defenderTroops: 1000,
          defenseLevel: 'basic',
        });
      }
    }
  } else if (options.scenario === 'all-scenarios') {
    // Comprehensive: all matchups + army sizes + defenses
    const armySizes = [1, 10, 100, 500, 1000, 5000, 10000];
    const defenses = ['none', 'basic', 'moderate', 'heavy'];

    for (const attacker of RACES) {
      for (const defender of RACES) {
        if (attacker === defender) continue;

        for (const size of armySizes) {
          for (const defense of defenses) {
            scenarios.push({
              name: `${attacker}(${size}) vs ${defender}(${size}, ${defense})`,
              attacker,
              defender,
              attackerTroops: size,
              defenderTroops: size,
              defenseLevel: defense,
            });
          }
        }
      }
    }
  } else if (options.scenario === 'stress-test') {
    // Extreme edge cases
    const extremes = [
      { attacker: 'human', defender: 'orc', attackerTroops: 1, defenderTroops: 0, defense: 'none', name: 'Edge: 1 vs 0' },
      { attacker: 'human', defender: 'orc', attackerTroops: 1, defenderTroops: 50000, defense: 'heavy', name: 'Edge: 1 vs 50k heavy' },
      { attacker: 'human', defender: 'orc', attackerTroops: 50000, defenderTroops: 1, defense: 'none', name: 'Edge: 50k vs 1' },
      { attacker: 'human', defender: 'orc', attackerTroops: 100000, defenderTroops: 100000, defense: 'heavy', name: 'Edge: 100k vs 100k heavy' },
      { attacker: 'vampire', defender: 'dire_wolf', attackerTroops: 500, defenderTroops: 500, defense: 'moderate', name: 'Extreme race: Vampire vs Dire Wolf' },
    ];

    scenarios.push(...extremes);
  }

  return scenarios;
}

// Simulate combat (placeholder - will call actual game logic)
async function simulateCombat(scenario, _db) {
  return new Promise((resolve) => {
    // For now, return a mock result structure
    // In production, this would call the actual game engine

    const mockResult = {
      scenario,
      attacker: {
        race: scenario.attacker,
        initialTroops: scenario.attackerTroops,
        casualties: Math.floor(scenario.attackerTroops * 0.1),
        finalTroops: scenario.attackerTroops * 0.9,
        xpGained: scenario.attackerTroops * 10,
        moodChange: 5,
      },
      defender: {
        race: scenario.defender,
        initialTroops: scenario.defenderTroops,
        casualties: Math.floor(scenario.defenderTroops * 0.15),
        finalTroops: scenario.defenderTroops * 0.85,
        xpGained: scenario.defenderTroops * 8,
        moodChange: -10,
      },
      combat: {
        defenseLevel: scenario.defenseLevel,
        landTransferred: Math.max(1, Math.floor(scenario.attackerTroops / 100)),
        goldTransferred: Math.floor(scenario.attackerTroops * 50),
        attackerWon: scenario.attackerTroops > scenario.defenderTroops,
        powerRatio: scenario.attackerTroops / scenario.defenderTroops,
      },
      validation: {
        casualtiesWithinBounds: true, // 5-15% winner, 2-10% loser
        troopsNonNegative: true,
        xpReasonable: true,
      },
    };

    resolve(mockResult);
  });
}

// Main test runner
async function runTests() {
  console.log('🎮 Combat Test Harness - Starting Tests\n');

  const options = parseArgs();
  const scenarios = generateScenarios(options);
  const results = new CombatTestResults();

  console.log(`📊 Test Plan: ${options.scenario}`);
  console.log(`📈 Total scenarios: ${scenarios.length}\n`);

  // Run scenarios
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    const progress = `[${i + 1}/${scenarios.length}]`;

    try {
      const result = await simulateCombat(scenario);

      // Validate result
      const valid = validateCombatResult(result);
      if (valid) {
        console.log(`${progress} ✓ ${scenario.name}`);
        passed++;
      } else {
        console.log(`${progress} ⚠ ${scenario.name} - Validation failed`);
        failed++;
      }

      results.addResult(scenario, result);
    } catch (err) {
      console.log(`${progress} ✗ ${scenario.name} - ${err.message}`);
      failed++;
      results.addResult(scenario, { error: err.message });
    }

    // Progress indicator every 10 tests
    if ((i + 1) % 10 === 0) {
      console.log(`  └─ Progress: ${i + 1}/${scenarios.length}`);
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✓ Passed:  ${passed}`);
  console.log(`✗ Failed:  ${failed}`);
  console.log(`📊 Total:   ${scenarios.length}`);
  console.log(`${'='.repeat(60)}\n`);

  // Save results
  const filepath = results.save();
  console.log('✓ Test execution complete!');
  console.log(`\nAnalyze results with: node test-combat-harness/analyze-results.js ${filepath}`);
}

// Validation function
function validateCombatResult(result) {
  const { attacker, defender } = result;

  // Basic sanity checks
  if (attacker.finalTroops < 0 || defender.finalTroops < 0) {
    console.log('    ✗ Negative troop count');
    return false;
  }

  if (attacker.casualties > attacker.initialTroops || defender.casualties > defender.initialTroops) {
    console.log('    ✗ Casualties exceed initial troops');
    return false;
  }

  return true;
}

// Run
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
