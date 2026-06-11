/**
 * Extended Advanced Combat Testing - War Machines, Ladders & Defensive Buildings
 *
 * Extends the basic advanced testing with:
 * - War machines and engineers
 * - Ladder assault mechanics
 * - Defensive structures (walls, towers, castles)
 *
 * Builds up progressively from simple to complex scenarios
 * INTEGRATED WITH ACTUAL GAME ENGINE - uses real resolveMilitaryAttack()
 */

const engine = require('../game/engine');
const fs = require('fs');
const path = require('path');

const races = ['human', 'orc', 'dwarf', 'dark_elf', 'vampire', 'dire_wolf', 'wood_elf', 'ogre'];

class ExtendedLevelTester {
  constructor() {
    this.results = {
      phase5: { name: 'Fighters + War Machines (1-100)', tests: [] },
      phase6: { name: 'Fighters + Ladders vs Walls (1-100)', tests: [] },
      phase7: { name: 'Fighters vs Defensive Buildings (1-100)', tests: [] },
      phase8: { name: 'Full Combat: All Units + Buildings (Level 100)', tests: [] },
    };
    this.startTime = new Date();
  }

  async runAllTests() {
    console.log('🧪 Starting Extended Combat Testing Suite...\n');
    console.log('⚠️  Testing War Machines, Ladders & Defensive Buildings\n');
    console.log('⚠️  Using REAL game engine (resolveMilitaryAttack)\n');

    try {
      await this.phase5_FightersWarMachines();
      await this.phase6_LaddersVsWalls();
      await this.phase7_DefensiveBuildings();
      await this.phase8_FullCombat();

      this.generateReport();
      console.log('\n✅ All tests completed!');
    } catch (err) {
      console.error('❌ Test error:', err.message);
      console.error(err);
    }
  }

  async phase5_FightersWarMachines() {
    console.log('📊 Phase 5: Fighters + War Machines (Levels 1-100, +10 increments)\n');
    const levels = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    let testCount = 0;

    for (const atkRace of races) {
      for (const defRace of races) {
        for (const level of levels) {
          try {
            const result = await this.simulateCombat({
              attackerRace: atkRace,
              defenderRace: defRace,
              attackerUnits: { fighters: 75, war_machines: 25, engineers: 25 },
              defenderUnits: { fighters: 75, engineers: 25 },
              attackerLevels: { fighters: level, war_machines: level, engineers: level },
              defenderLevels: { fighters: level, engineers: level },
              defenderBuildings: { walls: 0, castles: 0, towers: 0 },
            });

            this.results.phase5.tests.push({
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
    console.log(`\n✅ Phase 5 complete: ${testCount} tests\n`);
  }

  async phase6_LaddersVsWalls() {
    console.log('📊 Phase 6: Fighters + Ladders vs Walls (Levels 1-100, +10 increments)\n');
    const levels = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    let testCount = 0;

    for (const atkRace of races) {
      for (const defRace of races) {
        for (const level of levels) {
          try {
            const result = await this.simulateCombat({
              attackerRace: atkRace,
              defenderRace: defRace,
              attackerUnits: { fighters: 100, engineers: 10 },
              defenderUnits: { fighters: 100 },
              attackerLevels: { fighters: level, engineers: level },
              defenderLevels: { fighters: level },
              attackerLadders: 10,
              defenderBuildings: { walls: 5, castles: 0, towers: 0 },
            });

            this.results.phase6.tests.push({
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
    console.log(`\n✅ Phase 6 complete: ${testCount} tests\n`);
  }

  async phase7_DefensiveBuildings() {
    console.log('📊 Phase 7: Fighters vs Defensive Buildings (Levels 1-100, +10 increments)\n');
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
              defenderBuildings: { walls: 5, castles: 2, towers: 5 },
            });

            this.results.phase7.tests.push({
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
    console.log(`\n✅ Phase 7 complete: ${testCount} tests\n`);
  }

  async phase8_FullCombat() {
    console.log('📊 Phase 8: Full Combat - All Units + Buildings (Level 100)\n');
    let testCount = 0;

    for (const atkRace of races) {
      for (const defRace of races) {
        try {
          const result = await this.simulateCombat({
            attackerRace: atkRace,
            defenderRace: defRace,
            attackerUnits: {
              fighters: 200, rangers: 100, mages: 100,
              war_machines: 30, ninjas: 30, thieves: 30, clerics: 30, engineers: 30
            },
            defenderUnits: {
              fighters: 200, rangers: 100, mages: 100,
              war_machines: 30, ninjas: 30, thieves: 30, clerics: 30, engineers: 30
            },
            attackerLevels: {
              fighters: 100, rangers: 100, mages: 100,
              war_machines: 100, ninjas: 100, thieves: 100, clerics: 100, engineers: 100
            },
            defenderLevels: {
              fighters: 100, rangers: 100, mages: 100,
              war_machines: 100, ninjas: 100, thieves: 100, clerics: 100, engineers: 100
            },
            attackerLadders: 20,
            defenderBuildings: { walls: 5, castles: 2, towers: 5, outposts: 3 },
          });

          this.results.phase8.tests.push({
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
    console.log(`\n✅ Phase 8 complete: ${testCount} tests\n`);
  }

  async simulateCombat(params) {
    // Build test kingdoms
    const attacker = this.buildKingdom({
      race: params.attackerRace,
      units: params.attackerUnits,
      levels: params.attackerLevels,
      name: `ATK_${params.attackerRace}`,
      buildings: { walls: 0, castles: 0, towers: 0 },
      ladders: params.attackerLadders || 0,
    });

    const defender = this.buildKingdom({
      race: params.defenderRace,
      units: params.defenderUnits,
      levels: params.defenderLevels,
      name: `DEF_${params.defenderRace}`,
      buildings: params.defenderBuildings || { walls: 0, castles: 0, towers: 0 },
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
        ladders: params.attackerLadders || 0,
      }
    );

    if (result.error) {
      throw new Error(result.error);
    }

    // Extract casualty data
    return {
      win: result.win,
      winChance: result.report?.powerRatio || 0,
      attackerPower: Math.round(result.report?.atkPower || 0),
      defenderPower: Math.round(result.report?.defPower || 0),
      attackerLosses: {
        fighters: result.report?.atkFightersLost || 0,
        rangers: result.report?.atkRangersLost || 0,
        mages: result.report?.atkMagesLost || 0,
      },
      defenderLosses: {
        fighters: result.report?.defFightersLost || 0,
        rangers: result.report?.defRangersLost || 0,
        mages: result.report?.defMagesLost || 0,
      },
      casualtyRatio: this.calculateCasualtyRatio(result.report),
    };
  }

  buildKingdom(params) {
    // Transform troop levels
    const formattedLevels = {};
    for (const [unit, level] of Object.entries(params.levels || {})) {
      formattedLevels[unit] = { level, xp: 0, count: params.units[unit] || 0 };
    }

    const kingdom = {
      id: Math.random(),
      name: params.name,
      race: params.race,
      turn: 500,
      land: 500,
      happiness: 50,

      // Units
      fighters: params.units.fighters || 0,
      rangers: params.units.rangers || 0,
      mages: params.units.mages || 0,
      war_machines: params.units.war_machines || 0,
      ninjas: params.units.ninjas || 0,
      thieves: params.units.thieves || 0,
      clerics: params.units.clerics || 0,
      engineers: params.units.engineers || 0,
      ladders: params.ladders || 0,

      training_allocation: undefined,

      // Research — match isolated-defense harness so buildings don't dwarf troops
      res_weapons: 500,
      res_armor: 500,
      res_military: 500,
      res_attack_magic: 500,
      res_defense_magic: 500,
      res_war_machines: 500,

      // Troop levels
      troop_levels: JSON.stringify(formattedLevels),

      // Buildings (configurable)
      bld_walls: params.buildings.walls || 0,
      bld_castles: params.buildings.castles || 0,
      bld_guard_towers: params.buildings.towers || 0,
      bld_outposts: params.buildings.outposts || 0,
      wall_hp: params.buildings.walls > 0 ? 100 : 0,

      // Stockpiles — match fighter count so weapon/armor bonuses are consistent
      weapons_stored: params.units.fighters || 0,
      armor_stored: params.units.fighters || 0,

      // Heroes
      heroes: [],

      // JSON fields
      fragment_bonuses: '{}',
      milestone_bonuses: '{}',
      alliance_buffs: '{}',
      defense_upgrades: '{}',
      wall_upgrades: '{}',
      mausoleum_upgrades: '{}',
      shrine_upgrades: '{}',
      discovered_kingdoms: '{}',

      // Required
      prestige_level: 0,
      injured_troops: '{}',
      active_effects: '{}',
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
    const filename = `advanced-extended-testing-${timestamp}.md`;
    const filepath = path.join(__dirname, '..', 'test-results', filename);

    let report = this.buildMarkdownReport();

    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filepath, report, 'utf8');
    console.log(`\n📄 Report saved to: test-results/${filename}`);
  }

  buildMarkdownReport() {
    const duration = ((new Date() - this.startTime) / 1000).toFixed(2);

    let md = `# Extended Combat Testing Report\n\n`;
    md += `**Generated:** ${new Date().toISOString()}\n`;
    md += `**Duration:** ${duration}s\n`;
    md += `**Status:** ✅ REAL ENGINE INTEGRATION\n`;
    md += `**Focus:** War Machines, Ladders & Defensive Buildings\n`;
    md += `**Total Tests:** ${Object.values(this.results).reduce((sum, p) => sum + p.tests.length, 0)}\n\n`;

    // Phase reports
    md += this.generatePhaseReport('phase5');
    md += this.generatePhaseReport('phase6');
    md += this.generatePhaseReport('phase7');
    md += this.generatePhaseReport('phase8');

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
  const tester = new ExtendedLevelTester();
  tester.runAllTests().catch(console.error);
}

module.exports = ExtendedLevelTester;
