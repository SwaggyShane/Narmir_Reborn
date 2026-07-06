#!/usr/bin/env node
// Phase 3a Measurement Script
// Profiles a single turn execution to identify CPU bottlenecks
// Usage: node game/measure-turn.js <kingdomId>

const { initProfiler, runWithProfiler } = require('./profiling');

async function measureTurn(kingdomId) {
  console.log(`\n🔍 Measuring turn execution for kingdom ${kingdomId}...\n`);

  const profiler = initProfiler();

  try {
    // Run profiling in AsyncLocalStorage context for thread-safety
    await runWithProfiler(profiler, async () => {
      // In a real scenario, would fetch kingdom from DB and call processTurn
      // For now, this script demonstrates the profiling structure
      console.log('Profiling infrastructure created (AsyncLocalStorage, high-resolution timing).');
      console.log('Next: Integrate profiler into processTurn and run measurement');
    });
  } catch (error) {
    console.error('Measurement failed:', error.message);
  }

  const report = profiler.end();

  // Output profiling report
  console.log('\n📊 Turn Processing Profile Report');
  console.log('='.repeat(60));
  console.log(`Total Time: ${report.totalTime}ms`);
  console.log(`\nJSON Operations:`);
  console.log(`  Parse Calls: ${report.jsonOperations.parseCount} (${report.jsonOperations.parseTime}ms)`);
  console.log(`  Stringify Calls: ${report.jsonOperations.stringifyCount} (${report.jsonOperations.stringifyTime}ms)`);
  console.log(`  Total JSON Time: ${report.jsonOperations.totalTime}ms (${report.summary.jsonPercentOfTotal}% of total)`);

  if (report.synergyLookups > 0) {
    console.log(`\nSynergy Lookups: ${report.synergyLookups}`);
    if (report.summary.profileNeeded.highSynergyLookups) {
      console.log('  ⚠️  High synergy lookup count - caching may help');
    }
  }

  if (report.summary.slowAttunements) {
    console.log(`\nSlow Attunement Functions (>10ms):`);
    report.summary.slowAttunements.forEach(([name, data]) => {
      console.log(`  ${name}: max ${data.maxTime}ms, total ${data.totalTime}ms (${data.count} calls)`);
    });
  }

  console.log(`\nOptimization Targets:`);
  console.log(`  JSON High Cost: ${report.summary.profileNeeded.jsonHighCost ? '✓ YES' : '✗ no'}`);
  console.log(`  Slow Attunements: ${report.summary.profileNeeded.slowAttunementExists ? '✓ YES' : '✗ no'}`);
  console.log(`  High Synergy Lookups: ${report.summary.profileNeeded.highSynergyLookups ? '✓ YES' : '✗ no'}`);

  console.log('\n' + '='.repeat(60));
  console.log('Phase 3a Profiling: Foundation ready for processTurn integration\n');
}

// Run if invoked directly
if (require.main === module) {
  const kingdomId = process.argv[2];
  if (!kingdomId) {
    console.error('Usage: node game/measure-turn.js <kingdomId>');
    process.exit(1);
  }
  measureTurn(kingdomId).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { measureTurn };
