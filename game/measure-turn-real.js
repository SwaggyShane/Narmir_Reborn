#!/usr/bin/env node
// Phase 3c Enhanced Measurement Script
// Profiles actual turn execution on a real kingdom to identify CPU bottlenecks
// Usage: node game/measure-turn-real.js <kingdomId> [--json]
// --json : output machine-readable JSON (easier for local scripts / CI)

require('dotenv').config();
const { initDb } = require('../db/schema');
const engine = require('./engine');
const { initProfiler, runWithProfiler } = require('./profiling');

async function measureRealTurn(kingdomId, options = {}) {
  const { json: jsonOutput = false } = options;
  const db = await initDb();

  if (!jsonOutput) {
    console.log(`\n🔍 Measuring REAL turn execution for kingdom ${kingdomId}...\n`);
  }

  // Track errors separately to allow finally block to run for cleanup
  let error = null;

  try {
    // Fetch kingdom from database
    const kingdom = await db.get('SELECT * FROM kingdoms WHERE id = $1', [kingdomId]);
    if (!kingdom) {
      throw new Error(`Kingdom ${kingdomId} not found`);
    }

    if (!jsonOutput) {
      console.log(`📍 Kingdom: ${kingdom.name} (Player ${kingdom.player_id})`);
      console.log(`   Turn: ${kingdom.turn}, Scouts: ${kingdom.rangers}, Happiness: ${kingdom.happiness}`);
    }

    // Initialize profiler and measure processTurn
    const profiler = initProfiler();
    // eslint-disable-next-line no-unused-vars
    let result;

    await runWithProfiler(profiler, async () => {
      result = engine.processTurn(kingdom, db);
    });

    const report = profiler.end();

    if (jsonOutput) {
      // Machine readable for local scripts / future CI
      console.log(JSON.stringify({
        kingdomId,
        totalTime: report.totalTime,
        json: report.jsonOperations,
        attunements: report.attunements,
        synergyLookups: report.synergyLookups,
        summary: report.summary
      }, null, 2));
    } else {
      // Output comprehensive profiling report
      console.log('\n' + '='.repeat(70));
      console.log('📊 TURN PROCESSING PROFILE REPORT');
      console.log('='.repeat(70));

      console.log(`\n⏱️  OVERALL TIMING`);
      console.log(`   Total Time: ${report.totalTime}ms`);

      console.log(`\n📦 JSON OPERATIONS`);
      console.log(`   Parse Count: ${report.jsonOperations.parseCount} (${report.jsonOperations.parseTime}ms)`);
      console.log(`   Stringify Count: ${report.jsonOperations.stringifyCount} (${report.jsonOperations.stringifyTime}ms)`);
      console.log(`   Total JSON Time: ${report.jsonOperations.totalTime}ms (${report.summary.jsonPercentOfTotal}% of turn)`);
      if (report.summary.profileNeeded.jsonHighCost) {
        console.log(`   ⚠️  JSON is a bottleneck (>20% of turn time) - consider caching parsed objects`);
      }

      console.log(`\n🏛️  ATTUNEMENT FUNCTIONS (18 instrumented)`);
      const attunements = report.attunements;
      const slowAttunements = Object.entries(attunements)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.maxTime - a.maxTime);

      if (slowAttunements.length === 0) {
        console.log(`   (No attunements executed this turn)`);
      } else {
        slowAttunements.forEach((att, idx) => {
          const marker = att.maxTime > 10 ? '⚠️  ' : '   ';
          console.log(`   ${marker}${idx + 1}. ${att.name}`);
          console.log(`       Calls: ${att.count}, Total: ${att.totalTime}ms, Max: ${att.maxTime}ms`);
        });
      }

      if (report.summary.profileNeeded.slowAttunementExists) {
        console.log(`\n   ⚠️  SLOW ATTUNEMENTS DETECTED (>10ms max time)`);
        console.log(`       These are candidates for optimization`);
      }

      console.log(`\n🔍 SYNERGY LOOKUPS`);
      console.log(`   Total Count: ${report.synergyLookups}`);
      if (report.summary.profileNeeded.highSynergyLookups) {
        console.log(`   ⚠️  High lookup count (>100/turn) - caching may help`);
      }

      console.log(`\n` + '='.repeat(70));
      console.log(`OPTIMIZATION RECOMMENDATIONS:`);
      console.log('='.repeat(70));
      console.log(`   JSON High Cost: ${report.summary.profileNeeded.jsonHighCost ? '✓ YES - Optimize' : '✗ No'}`);
      console.log(`   Slow Attunements: ${report.summary.profileNeeded.slowAttunementExists ? '✓ YES - Refactor slow functions' : '✗ No'}`);
      console.log(`   High Synergy Lookups: ${report.summary.profileNeeded.highSynergyLookups ? '✓ YES - Implement caching' : '✗ No'}`);
      console.log('='.repeat(70) + '\n');
    }

  } catch (err) {
    error = err;
    console.error('❌ Measurement failed:', err.message);
    console.error(err.stack);
  }

  if (error) {
    process.exit(1);
  }
  process.exit(0);
}

// Run if invoked directly
if (require.main === module) {
  const args = process.argv.slice(2);
  let jsonOutput = false;
  let kingdomIdArg = null;

  for (const arg of args) {
    if (arg === '--json') {
      jsonOutput = true;
    } else if (!kingdomIdArg) {
      kingdomIdArg = arg;
    }
  }

  if (!kingdomIdArg) {
    console.error('Usage: node game/measure-turn-real.js <kingdomId> [--json]');
    process.exit(1);
  }

  measureRealTurn(parseInt(kingdomIdArg, 10), { json: jsonOutput }).catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  });
}

module.exports = { measureRealTurn };
