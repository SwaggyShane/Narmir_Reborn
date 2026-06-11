/**
 * Combat Test Harness - Results Analysis
 *
 * Analyzes test results to identify:
 * - Viability issues (broken mechanics)
 * - Balance problems (overpowered races/strategies)
 * - Efficiency concerns (calculation errors)
 * - Edge cases that fail or behave unexpectedly
 *
 * Usage:
 *   node analyze-results.js combat-test-results-TIMESTAMP.json
 */

const fs = require('fs');
const path = require('path');

class CombatAnalyzer {
  constructor(resultsFile) {
    const filepath = path.join(__dirname, '..', 'test-results', resultsFile);
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

    this.results = data.results || [];
    this.metadata = data.metadata || {};
  }

  analyze() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║          COMBAT SYSTEM ANALYSIS REPORT                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Print metadata
    console.log('📊 TEST METADATA');
    console.log(`  Tests Run: ${this.metadata.totalTests}`);
    console.log(`  Passed: ${this.metadata.passedTests}`);
    console.log(`  Failed: ${this.metadata.failedTests}`);
    console.log(`  Duration: ${this._calculateDuration()}`);
    console.log('');

    // Run analyses
    this.analyzeViability();
    this.analyzeBalance();
    this.analyzeEfficiency();
    this.analyzeEdgeCases();
    this.generateSummary();
  }

  analyzeViability() {
    console.log('🔧 VIABILITY ANALYSIS');
    console.log('─'.repeat(60));

    const failures = this.results.filter(r => !r.success);

    if (failures.length === 0) {
      console.log('  ✓ All combat scenarios executed successfully\n');
      return;
    }

    console.log(`  ✗ ${failures.length} failures detected:\n`);

    const failuresByType = {};
    failures.forEach(f => {
      const error = f.result.error || 'Unknown error';
      failuresByType[error] = (failuresByType[error] || 0) + 1;
    });

    Object.entries(failuresByType).forEach(([error, count]) => {
      console.log(`    • ${error}: ${count} occurrence(s)`);
    });

    console.log('\n  Recommendations:');
    if (failures.length > 0) {
      console.log('    • Review error logs for affected scenarios');
      console.log('    • Check combat calculation boundaries');
      console.log('    • Verify database constraints are correct');
    }
    console.log('');
  }

  analyzeBalance() {
    console.log('⚖️  BALANCE ANALYSIS');
    console.log('─'.repeat(60));

    const successfulResults = this.results.filter(r => r.success && r.result.attacker);
    const raceWinrates = {};
    const raceVsRaceStats = {};

    successfulResults.forEach(r => {
      const { combat } = r.result;
      const attRace = r.scenario.attacker;
      const defRace = r.scenario.defender;

      // Track win rates by race
      if (!raceWinrates[attRace]) raceWinrates[attRace] = { wins: 0, losses: 0 };
      if (combat.attackerWon) {
        raceWinrates[attRace].wins++;
      } else {
        raceWinrates[attRace].losses++;
      }

      // Track race matchups
      const key = `${attRace} vs ${defRace}`;
      if (!raceVsRaceStats[key]) {
        raceVsRaceStats[key] = { wins: 0, losses: 0, powerRatios: [] };
      }
      if (combat.attackerWon) {
        raceVsRaceStats[key].wins++;
      } else {
        raceVsRaceStats[key].losses++;
      }
      raceVsRaceStats[key].powerRatios.push(combat.powerRatio);
    });

    console.log('  Race Win Rates (as attacker):');
    Object.entries(raceWinrates)
      .sort((a, b) => (b[1].wins / (b[1].wins + b[1].losses || 1)) - (a[1].wins / (a[1].wins + a[1].losses || 1)))
      .forEach(([race, stats]) => {
        const total = stats.wins + stats.losses;
        const winrate = total > 0 ? ((stats.wins / total) * 100).toFixed(1) : 0;
        const indicator = winrate > 60 ? '⚠️ ' : winrate < 40 ? '⚠️ ' : '  ';
        console.log(`    ${indicator}${race.padEnd(12)} ${winrate.padStart(5)}% (${stats.wins}W/${stats.losses}L)`);
      });

    console.log('\n  Balance Observations:');
    const extremeRates = Object.entries(raceWinrates).filter(
      ([_, stats]) => {
        const total = stats.wins + stats.losses;
        const rate = total > 0 ? stats.wins / total : 0.5;
        return rate > 0.65 || rate < 0.35;
      }
    );

    if (extremeRates.length > 0) {
      console.log('    ⚠️  Potential balance issues detected:');
      extremeRates.forEach(([race, stats]) => {
        const rate = ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1);
        if (rate > 65) {
          console.log(`      • ${race} has high win rate (${rate}%) - may be overpowered`);
        } else {
          console.log(`      • ${race} has low win rate (${rate}%) - may be underpowered`);
        }
      });
    } else {
      console.log('    ✓ Win rates relatively balanced across races');
    }
    console.log('');
  }

  analyzeEfficiency() {
    console.log('⚡ EFFICIENCY ANALYSIS');
    console.log('─'.repeat(60));

    const successfulResults = this.results.filter(r => r.success && r.result.attacker);

    // Casualty ratio analysis
    const casualtyStats = [];
    successfulResults.forEach(r => {
      const { attacker, defender } = r.result;
      const attCasualtyRate = attacker.casualties / attacker.initialTroops;
      const defCasualtyRate = defender.casualties / defender.initialTroops;

      casualtyStats.push({
        attCasualtyRate,
        defCasualtyRate,
        scenario: r.scenario.name,
      });
    });

    const avgAttCasualties = (casualtyStats.reduce((s, c) => s + c.attCasualtyRate, 0) / casualtyStats.length * 100).toFixed(2);
    const avgDefCasualties = (casualtyStats.reduce((s, c) => s + c.defCasualtyRate, 0) / casualtyStats.length * 100).toFixed(2);

    console.log('  Casualty Rates (as percentage):');
    console.log(`    Attackers: ${avgAttCasualties}% average`);
    console.log(`    Defenders: ${avgDefCasualties}% average`);

    // Validate casualty bounds (should be ~5-15% winner, 2-10% loser)
    const abnormalCasualties = casualtyStats.filter(c =>
      (c.attCasualtyRate > 0.3 || c.defCasualtyRate > 0.3) ||
      (c.attCasualtyRate < 0.01 && c.defCasualtyRate < 0.01)
    );

    if (abnormalCasualties.length > 0) {
      console.log(`\n    ⚠️  ${abnormalCasualties.length} scenarios with abnormal casualty rates:`);
      abnormalCasualties.slice(0, 5).forEach(c => {
        console.log(`      • ${c.scenario}: Att ${(c.attCasualtyRate * 100).toFixed(1)}%, Def ${(c.defCasualtyRate * 100).toFixed(1)}%`);
      });
    } else {
      console.log('\n    ✓ Casualty calculations within expected bounds');
    }
    console.log('');
  }

  analyzeEdgeCases() {
    console.log('🔍 EDGE CASE ANALYSIS');
    console.log('─'.repeat(60));

    const edgeCases = this.results.filter(r => {
      const { scenario } = r;
      return scenario.name.includes('Edge') || scenario.name.includes('Extreme');
    });

    if (edgeCases.length === 0) {
      console.log('  ℹ️  No specific edge cases found in test results\n');
      return;
    }

    console.log(`  Found ${edgeCases.length} edge case scenarios:\n`);

    let issues = 0;
    edgeCases.forEach(r => {
      const { scenario, success, result } = r;
      if (!success) {
        console.log(`    ✗ ${scenario.name}`);
        console.log(`      Error: ${result.error}`);
        issues++;
      } else {
        console.log(`    ✓ ${scenario.name}`);
        if (result.attacker && result.defender) {
          console.log(`      Att: ${result.attacker.finalTroops}/${result.attacker.initialTroops}, Def: ${result.defender.finalTroops}/${result.defender.initialTroops}`);
        }
      }
    });

    if (issues > 0) {
      console.log(`\n    ⚠️  ${issues} edge case(s) failed or behaved unexpectedly`);
      console.log('    Recommendations:');
      console.log('      • Add boundary validation for army sizes');
      console.log('      • Test with 0 defenders/attackers');
      console.log('      • Verify calculation stability with extreme values');
    } else {
      console.log('\n    ✓ All edge cases handled gracefully');
    }
    console.log('');
  }

  generateSummary() {
    console.log('📋 SUMMARY & RECOMMENDATIONS');
    console.log('─'.repeat(60));

    const passRate = ((this.metadata.passedTests / this.metadata.totalTests) * 100).toFixed(1);

    console.log(`\n  Overall Status: ${passRate}% pass rate`);

    if (passRate === '100') {
      console.log('  ✓ Combat system appears viable for deployment');
      console.log('\n  Next Steps:');
      console.log('    • Monitor balance metrics in production');
      console.log('    • Track player-reported issues');
      console.log('    • Plan periodic rebalancing if needed');
    } else if (passRate >= 90) {
      console.log('  ⚠️  Minor issues detected - review above sections');
      console.log('\n  Next Steps:');
      console.log('    • Fix identified failures');
      console.log('    • Re-run full test suite');
      console.log('    • Consider soft launch with monitoring');
    } else {
      console.log('  ✗ Significant issues detected - do not deploy');
      console.log('\n  Next Steps:');
      console.log('    • Fix all viability issues first');
      console.log('    • Re-run full test suite');
      console.log('    • Consider alternative design approach if many failures');
    }

    console.log('\n  Detailed Data: Check test-results/ directory for full JSON data\n');
  }

  _calculateDuration() {
    try {
      const start = new Date(this.metadata.startTime);
      const end = new Date(this.metadata.endTime);
      const seconds = Math.round((end - start) / 1000);
      return `${seconds}s`;
    } catch {
      return 'Unknown';
    }
  }
}

// Main
const resultsFile = process.argv[2];
if (!resultsFile) {
  console.error('Usage: node analyze-results.js <results-filename>');
  console.error('Example: node analyze-results.js combat-test-results-1234567890.json');
  process.exit(1);
}

try {
  const analyzer = new CombatAnalyzer(resultsFile);
  analyzer.analyze();
} catch (err) {
  console.error('Analysis failed:', err.message);
  process.exit(1);
}
