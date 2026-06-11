/**
 * Advanced Combat Testing - Unit Levels & Race Combinations
 *
 * Tests all race combinations (64 total) with varying unit levels
 * INTEGRATED WITH ACTUAL GAME ENGINE - uses real resolveMilitaryAttack()
 *
 * Phase 1: Fighters only (levels 1-100, increments of 10)
 * Phase 2: Fighters + Rangers (level 1-100)
 * Phase 3: Fighters + Rangers + Mages (level 1-100)
 * Phase 4: Full armies (all units at level 100)
 *
 * Generates detailed MD reports with casualty analysis per unit type/level
 */

const engine = require('../game/engine');
const fs = require('fs');
const path = require('path');

const races = ['human', 'orc', 'dwarf', 'dark_elf', 'vampire', 'dire_wolf', 'wood_elf', 'ogre'];

class AdvancedLevelTester {
  constructor() {
    this.results = {
      phase1: { name: 'Fighters Only (1-100)', tests: [] },
      phase2: { name: 'Fighters + Rangers (1-100)', tests: [] },
      phase3: { name: 'Fighters + Rangers + Mages (1-100)', tests: [] },
      phase4: { name: 'Full Armies (Level 100)', tests: [] },
    };
    this.startTime = new Date();
  }

  async runAllTests() {
    console.log('🧪 Starting Advanced Level Testing Suite...\n');
    console.log('⚠️  Using REAL game engine (resolveMilitaryAttack)\n');

    try {
      await this.phase1_FightersOnly();
      await this.phase2_FightersRangers();
      await this.phase3_FullTroop();
      await this.phase4_FullArmies();

      this.generateReport();
      console.log('\n✅ All tests completed!');
    } catch (err) {
      console.error('❌ Test error:', err.message);
      console.error(err);
    }
  }

  async phase1_FightersOnly() {
    console.log('📊 Phase 1: Fighters Only (Levels 1-100, +10 increments)\n');
    const levels = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    let testCount = 0;

    for (const atkRace of races) {
      for (const defRace of races) {
        for (const level of levels) {
          try {
            const result = await this.simulateCombat({
              attackerRace: atkRace,
              defenderRace: defRace,
              attackerUnits: { fighters: 100 },
              defenderUnits: { fighters: 100 },
              attackerLevels: { fighters: level },
              defenderLevels: { fighters: level },
            });

            this.results.phase1.tests.push({
              matchup: `${atkRace} vs ${defRace}`,
              level,
              attacker: atkRace,
              defender: defRace,
              ...result,
            });
          } catch (err) {
            console.error(`  ❌ Error in ${atkRace} vs ${defRace} (level ${level}):`, err.message);
          }

          testCount++;
          if (testCount % 20 === 0) {
            process.stdout.write(`  ${testCount} tests completed...\r`);
          }
        }
      }
    }
    console.log(`\n✅ Phase 1 complete: ${testCount} tests\n`);
  }

  async phase2_FightersRangers() {
    console.log('📊 Phase 2: Fighters + Rangers (Levels 1-100, +10 increments)\n');
    const levels = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    let testCount = 0;

    for (const atkRace of races) {
      for (const defRace of races) {
        for (const level of levels) {
          try {
            const result = await this.simulateCombat({
              attackerRace: atkRace,
              defenderRace: defRace,
              attackerUnits: { fighters: 50, rangers: 50 },
              defenderUnits: { fighters: 50, rangers: 50 },
              attackerLevels: { fighters: level, rangers: level },
              defenderLevels: { fighters: level, rangers: level },
            });

            this.results.phase2.tests.push({
              matchup: `${atkRace} vs ${defRace}`,
              level,
              attacker: atkRace,
              defender: defRace,
              ...result,
            });
          } catch (err) {
            console.error(`  ❌ Error in ${atkRace} vs ${defRace} (level ${level}):`, err.message);
          }

          testCount++;
          if (testCount % 20 === 0) {
            process.stdout.write(`  ${testCount} tests completed...\r`);
          }
        }
      }
    }
    console.log(`\n✅ Phase 2 complete: ${testCount} tests\n`);
  }

  async phase3_FullTroop() {
    console.log('📊 Phase 3: Fighters + Rangers + Mages (Levels 1-100, +10 increments)\n');
    const levels = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    let testCount = 0;

    for (const atkRace of races) {
      for (const defRace of races) {
        for (const level of levels) {
          try {
            const result = await this.simulateCombat({
              attackerRace: atkRace,
              defenderRace: defRace,
              attackerUnits: { fighters: 40, rangers: 30, mages: 30 },
              defenderUnits: { fighters: 40, rangers: 30, mages: 30 },
              attackerLevels: { fighters: level, rangers: level, mages: level },
              defenderLevels: { fighters: level, rangers: level, mages: level },
            });

            this.results.phase3.tests.push({
              matchup: `${atkRace} vs ${defRace}`,
              level,
              attacker: atkRace,
              defender: defRace,
              ...result,
            });
          } catch (err) {
            console.error(`  ❌ Error in ${atkRace} vs ${defRace} (level ${level}):`, err.message);
          }

          testCount++;
          if (testCount % 20 === 0) {
            process.stdout.write(`  ${testCount} tests completed...\r`);
          }
        }
      }
    }
    console.log(`\n✅ Phase 3 complete: ${testCount} tests\n`);
  }

  async phase4_FullArmies() {
    console.log('📊 Phase 4: Full Armies (All units at Level 100)\n');
    let testCount = 0;

    for (const atkRace of races) {
      for (const defRace of races) {
        try {
          const result = await this.simulateCombat({
            attackerRace: atkRace,
            defenderRace: defRace,
            attackerUnits: {
              fighters: 300, rangers: 150, mages: 150,
              war_machines: 50, ninjas: 50, thieves: 50, clerics: 50, engineers: 50
            },
            defenderUnits: {
              fighters: 300, rangers: 150, mages: 150,
              war_machines: 50, ninjas: 50, thieves: 50, clerics: 50, engineers: 50
            },
            attackerLevels: {
              fighters: 100, rangers: 100, mages: 100,
              war_machines: 100, ninjas: 100, thieves: 100, clerics: 100, engineers: 100
            },
            defenderLevels: {
              fighters: 100, rangers: 100, mages: 100,
              war_machines: 100, ninjas: 100, thieves: 100, clerics: 100, engineers: 100
            },
          });

          this.results.phase4.tests.push({
            matchup: `${atkRace} vs ${defRace}`,
            attacker: atkRace,
            defender: defRace,
            ...result,
          });
        } catch (err) {
          console.error(`  ❌ Error in ${atkRace} vs ${defRace}:`, err.message);
        }

        testCount++;
        if (testCount % 5 === 0) {
          process.stdout.write(`  ${testCount} tests completed...\r`);
        }
      }
    }
    console.log(`\n✅ Phase 4 complete: ${testCount} tests\n`);
  }

  async simulateCombat(params) {
    // Build test kingdoms with specified units and levels
    const attacker = this.buildKingdom({
      race: params.attackerRace,
      units: params.attackerUnits,
      levels: params.attackerLevels,
      name: `ATK_${params.attackerRace}`,
    });

    const defender = this.buildKingdom({
      race: params.defenderRace,
      units: params.defenderUnits,
      levels: params.defenderLevels,
      name: `DEF_${params.defenderRace}`,
    });

    // Call actual combat engine
    const result = engine.resolveMilitaryAttack(
      attacker,
      defender,
      {
        fighters: params.attackerUnits.fighters || 0,
        rangers: params.attackerUnits.rangers || 0,
        mages: params.attackerUnits.mages || 0,
        warMachines: params.attackerUnits.war_machines || 0,
        ninjas: params.attackerUnits.ninjas || 0,
        thieves: params.attackerUnits.thieves || 0,
        clerics: params.attackerUnits.clerics || 0,
        engineers: params.attackerUnits.engineers || 0,
        ladders: 0,
      }
    );

    if (result.error) {
      throw new Error(result.error);
    }

    // Extract detailed casualty data
    return {
      win: result.win,
      winChance: result.report?.powerRatio || 0,
      attackerPower: Math.round(result.report?.atkPower || 0),
      defenderPower: Math.round(result.report?.defPower || 0),
      attackerLosses: {
        fighters: result.report?.atkFightersLost || 0,
        rangers: result.report?.atkRangersLost || 0,
        mages: result.report?.atkMagesLost || 0,
        ninjas: result.report?.atkNinjasLost || 0,
      },
      defenderLosses: {
        fighters: result.report?.defFightersLost || 0,
        rangers: result.report?.defRangersLost || 0,
        mages: result.report?.defMagesLost || 0,
        ninjas: result.report?.defNinjasLost || 0,
      },
      casualtyRatio: this.calculateCasualtyRatio(result.report),
      totalSent: (result.report?.sent?.fighters || 0) + (result.report?.sent?.rangers || 0) + (result.report?.sent?.mages || 0),
    };
  }

  buildKingdom(params) {
    // Build a test kingdom with realistic defaults
    // Transform troop levels to proper format: { unit: { level: X, xp: 0, count: Y } }
    const formattedLevels = {};
    for (const [unit, level] of Object.entries(params.levels || {})) {
      formattedLevels[unit] = { level, xp: 0, count: params.units[unit] || 0 };
    }

    const kingdom = {
      id: Math.random(),
      name: params.name,
      race: params.race,
      turn: 500, // Above newbie protection
      land: 500,
      happiness: 50,

      // Units (no training allocation - all available)
      fighters: params.units.fighters || 0,
      rangers: params.units.rangers || 0,
      mages: params.units.mages || 0,
      war_machines: params.units.war_machines || 0,
      ninjas: params.units.ninjas || 0,
      thieves: params.units.thieves || 0,
      clerics: params.units.clerics || 0,
      engineers: params.units.engineers || 0,
      ladders: 0,

      // No training allocation - all units are available for combat
      training_allocation: undefined,

      // Research (baseline 100)
      res_weapons: 100,
      res_armor: 100,
      res_military: 100,
      res_attack_magic: 100,
      res_defense_magic: 100,
      res_war_machines: 100,

      // Troop levels - convert to JSON string with proper structure
      troop_levels: JSON.stringify(formattedLevels),

      // Buildings - none for fair race comparison testing
      bld_walls: 0,
      bld_castles: 0,
      bld_outposts: 0,
      bld_guard_towers: 0,
      wall_hp: 0,

      // Stockpiles
      weapons_stored: 0,
      armor_stored: 0,

      // Hero data (empty)
      heroes: [],

      // JSON string fields (empty objects)
      fragment_bonuses: '{}',
      milestone_bonuses: '{}',
      alliance_buffs: '{}',
      defense_upgrades: '{}',
      wall_upgrades: '{}',
      mausoleum_upgrades: '{}',
      shrine_upgrades: '{}',
      discovered_kingdoms: '{}',

      // Required for combat
      prestige_level: 0,
      injured_troops: '{}',
    };

    return kingdom;
  }

  calculateCasualtyRatio(report) {
    if (!report) return 0;

    const atkLoss = (report.atkFightersLost || 0) + (report.atkRangersLost || 0) + (report.atkMagesLost || 0);
    const defLoss = (report.defFightersLost || 0) + (report.defRangersLost || 0) + (report.defMagesLost || 0);

    if (atkLoss === 0) return 0;
    return defLoss / atkLoss;
  }

  generateReport() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `advanced-level-testing-${timestamp}.md`;
    const filepath = path.join(__dirname, '..', 'test-results', filename);

    let report = this.buildMarkdownReport();

    // Ensure directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filepath, report, 'utf8');
    console.log(`\n📄 Report saved to: test-results/${filename}`);
  }

  buildMarkdownReport() {
    const duration = ((new Date() - this.startTime) / 1000).toFixed(2);

    let md = `# Advanced Combat Level Testing Report\n\n`;
    md += `**Generated:** ${new Date().toISOString()}\n`;
    md += `**Duration:** ${duration}s\n`;
    md += `**Status:** ✅ REAL ENGINE INTEGRATION\n`;
    md += `**Total Tests:** ${Object.values(this.results).reduce((sum, p) => sum + p.tests.length, 0)}\n\n`;

    // Phase reports
    md += this.generatePhaseReport('phase1');
    md += this.generatePhaseReport('phase2');
    md += this.generatePhaseReport('phase3');
    md += this.generatePhaseReport('phase4');

    // Summary
    md += `\n---\n\n## Summary Statistics\n\n`;
    md += this.generateSummaryStats();

    return md;
  }

  generatePhaseReport(phaseKey) {
    const phase = this.results[phaseKey];
    const tests = phase.tests;

    if (tests.length === 0) {
      return `## ${phase.name}\n\n⚠️ No tests completed\n\n`;
    }

    let md = `## ${phase.name}\n\n`;
    md += `**Total Tests:** ${tests.length}\n\n`;

    // Win rate by matchup
    md += `### Win Rates by Race Combination\n\n`;
    md += `| Attacker | Defender | Win Rate | Avg Atk Loss | Avg Def Loss | Casualty Ratio |\n`;
    md += `|----------|----------|----------|--------------|--------------|----------------|\n`;

    const matchupStats = {};
    for (const test of tests) {
      const key = `${test.attacker}_vs_${test.defender}`;
      if (!matchupStats[key]) {
        matchupStats[key] = {
          wins: 0,
          total: 0,
          atkLosses: [],
          defLosses: [],
          casualtyRatios: [],
        };
      }
      matchupStats[key].total++;
      if (test.win) matchupStats[key].wins++;
      matchupStats[key].atkLosses.push(
        (test.attackerLosses.fighters || 0) + (test.attackerLosses.rangers || 0) + (test.attackerLosses.mages || 0)
      );
      matchupStats[key].defLosses.push(
        (test.defenderLosses.fighters || 0) + (test.defenderLosses.rangers || 0) + (test.defenderLosses.mages || 0)
      );
      matchupStats[key].casualtyRatios.push(test.casualtyRatio || 0);
    }

    for (const [matchup, stats] of Object.entries(matchupStats)) {
      const [atk, def] = matchup.replace('_vs_', '|').split('|');
      const winRate = ((stats.wins / stats.total) * 100).toFixed(1);
      const avgAtkLoss = (stats.atkLosses.reduce((a, b) => a + b, 0) / stats.atkLosses.length).toFixed(1);
      const avgDefLoss = (stats.defLosses.reduce((a, b) => a + b, 0) / stats.defLosses.length).toFixed(1);
      const avgCasRatio = (stats.casualtyRatios.reduce((a, b) => a + b, 0) / stats.casualtyRatios.length).toFixed(2);
      md += `| ${atk} | ${def} | ${winRate}% | ${avgAtkLoss} | ${avgDefLoss} | ${avgCasRatio}x |\n`;
    }

    // Level impact (for phases with levels)
    if (tests[0].level !== undefined) {
      md += `\n### Level Impact Analysis\n\n`;
      md += `| Level | Avg Win Rate (Same Race) | Avg Atk Loss | Avg Def Loss | Casualty Ratio |\n`;
      md += `|-------|--------------------------|--------------|--------------|----------------|\n`;

      const levelStats = {};
      for (const test of tests) {
        if (test.level && test.attacker === test.defender) {
          if (!levelStats[test.level]) {
            levelStats[test.level] = {
              wins: 0,
              total: 0,
              atkLosses: [],
              defLosses: [],
              casualtyRatios: [],
            };
          }
          levelStats[test.level].total++;
          if (test.win) levelStats[test.level].wins++;
          levelStats[test.level].atkLosses.push(
            (test.attackerLosses.fighters || 0) + (test.attackerLosses.rangers || 0) + (test.attackerLosses.mages || 0)
          );
          levelStats[test.level].defLosses.push(
            (test.defenderLosses.fighters || 0) + (test.defenderLosses.rangers || 0) + (test.defenderLosses.mages || 0)
          );
          levelStats[test.level].casualtyRatios.push(test.casualtyRatio || 0);
        }
      }

      for (const level of [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) {
        if (levelStats[level]) {
          const stats = levelStats[level];
          const winRate = ((stats.wins / stats.total) * 100).toFixed(1);
          const avgAtkLoss = (stats.atkLosses.reduce((a, b) => a + b, 0) / stats.atkLosses.length).toFixed(1);
          const avgDefLoss = (stats.defLosses.reduce((a, b) => a + b, 0) / stats.defLosses.length).toFixed(1);
          const avgCasRatio = (stats.casualtyRatios.reduce((a, b) => a + b, 0) / stats.casualtyRatios.length).toFixed(2);
          md += `| ${level} | ${winRate}% | ${avgAtkLoss} | ${avgDefLoss} | ${avgCasRatio}x |\n`;
        }
      }
    }

    md += `\n`;
    return md;
  }

  generateSummaryStats() {
    let md = `### Overall Statistics\n\n`;

    const allTests = Object.values(this.results).flatMap(p => p.tests);
    const totalWins = allTests.filter(t => t.win).length;
    const winRate = ((totalWins / allTests.length) * 100).toFixed(1);

    const totalAtkLoss = allTests.reduce((sum, t) =>
      sum + ((t.attackerLosses.fighters || 0) + (t.attackerLosses.rangers || 0) + (t.attackerLosses.mages || 0)), 0
    );
    const totalDefLoss = allTests.reduce((sum, t) =>
      sum + ((t.defenderLosses.fighters || 0) + (t.defenderLosses.rangers || 0) + (t.defenderLosses.mages || 0)), 0
    );
    const avgCasRatio = (totalDefLoss / Math.max(totalAtkLoss, 1)).toFixed(2);

    md += `- **Total Tests Run:** ${allTests.length}\n`;
    md += `- **Overall Win Rate:** ${winRate}%\n`;
    md += `- **Total Attacker Losses:** ${totalAtkLoss}\n`;
    md += `- **Total Defender Losses:** ${totalDefLoss}\n`;
    md += `- **Average Casualty Ratio:** ${avgCasRatio}x\n`;
    md += `- **Same-Race Win Rate:** ${this.calculateSameRaceWinRate().toFixed(1)}%\n`;

    return md;
  }

  calculateSameRaceWinRate() {
    const allTests = Object.values(this.results).flatMap(p => p.tests);
    const sameRaceTests = allTests.filter(t => t.attacker === t.defender);
    if (sameRaceTests.length === 0) return 0;
    const sameRaceWins = sameRaceTests.filter(t => t.win).length;
    return (sameRaceWins / sameRaceTests.length) * 100;
  }
}

// Run tests if invoked directly
if (require.main === module) {
  const tester = new AdvancedLevelTester();
  tester.runAllTests().catch(console.error);
}

module.exports = AdvancedLevelTester;
