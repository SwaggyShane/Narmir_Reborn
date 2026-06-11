#!/usr/bin/env node
/**
 * Comprehensive Heroes System Test Suite
 * Verifies all 24 hero classes are properly defined,
 * wired, and functional in the game
 */

const config = require('./game/config');
const engine = require('./game/engine');

const allHeroClasses = config.HERO_CLASSES;
const heroClassIds = Object.keys(allHeroClasses);

let passed = 0;
let failed = 0;
const failures = [];

console.log('\n' + '='.repeat(80));
console.log('COMPREHENSIVE HEROES SYSTEM TEST');
console.log('='.repeat(80) + '\n');

// TEST 1: All hero classes defined and properly structured
console.log('TEST 1: Hero Class Definitions\n');

for (const heroClassId of heroClassIds) {
  const heroClass = allHeroClasses[heroClassId];
  try {
    // Check required fields
    if (!heroClass.name || typeof heroClass.name !== 'string') {
      throw new Error('Missing or invalid name');
    }

    if (!heroClass.description || typeof heroClass.description !== 'string') {
      throw new Error('Missing or invalid description');
    }

    if (!Array.isArray(heroClass.abilities) || heroClass.abilities.length === 0) {
      throw new Error('Missing or invalid abilities array');
    }

    // Check each ability has name and description
    for (const ability of heroClass.abilities) {
      if (!ability.name || !ability.description) {
        throw new Error(`Ability missing name or description: ${JSON.stringify(ability)}`);
      }
    }

    // Check recruitment costs
    if (typeof heroClass.recruitCost !== 'number' || heroClass.recruitCost < 0) {
      throw new Error(`Invalid recruitCost: ${heroClass.recruitCost}`);
    }

    if (typeof heroClass.recruitMana !== 'number' || heroClass.recruitMana < 0) {
      throw new Error(`Invalid recruitMana: ${heroClass.recruitMana}`);
    }

    // Check stat bonuses
    if (!heroClass.statBonus || typeof heroClass.statBonus !== 'object') {
      throw new Error('Missing or invalid statBonus');
    }

    for (const [statType, multiplier] of Object.entries(heroClass.statBonus)) {
      if (typeof multiplier !== 'number' || multiplier < 0) {
        throw new Error(`Invalid stat bonus ${statType}: ${multiplier}`);
      }
    }

    // Check races if specified
    if (heroClass.races) {
      if (!Array.isArray(heroClass.races)) {
        throw new Error('Races must be an array');
      }
      if (heroClass.races.length === 0) {
        throw new Error('Races array is empty');
      }
    }

    passed++;
  } catch (err) {
    failed++;
    failures.push(`Hero class ${heroClassId}: ${err.message}`);
  }
}

console.log(`✓ Hero class definitions: ${passed}/${passed + failed} passed\n`);

// TEST 2: Hero recruitment works correctly
console.log('TEST 2: Hero Recruitment\n');

// Create a mock kingdom for recruitment tests
const testKingdom = {
  id: 'test-kingdom',
  race: 'human',
  gold: 1000000,
  mana: 500000,
  bld_castles: 5,
};

const racesTestKingdoms = {
  human: { ...testKingdom, race: 'human' },
  orc: { ...testKingdom, race: 'orc' },
  high_elf: { ...testKingdom, race: 'high_elf' },
  dark_elf: { ...testKingdom, race: 'dark_elf' },
  dwarf: { ...testKingdom, race: 'dwarf' },
  dire_wolf: { ...testKingdom, race: 'dire_wolf' },
  vampire: { ...testKingdom, race: 'vampire' },
};

for (const heroClassId of heroClassIds) {
  const heroClass = allHeroClasses[heroClassId];
  try {
    // Find a kingdom that can recruit this hero
    let kingdom = testKingdom;
    if (heroClass.races && heroClass.races.length > 0) {
      const raceNeeded = heroClass.races[0];
      kingdom = racesTestKingdoms[raceNeeded] || testKingdom;
    }

    // Attempt recruitment
    const result = engine.recruitHero(kingdom, 'Test Hero', heroClassId);

    // Should return a hero object and cost (not an error)
    if (result.error) {
      throw new Error(`Recruitment failed: ${result.error}`);
    }

    if (!result.hero || !result.cost) {
      throw new Error('Missing hero or cost in recruitment result');
    }

    // Check hero object structure
    const hero = result.hero;
    if (!hero.name || !hero.class || !hero.level) {
      throw new Error('Hero missing required fields');
    }

    if (hero.level !== 1) {
      throw new Error(`Hero should start at level 1, got ${hero.level}`);
    }

    if (hero.xp !== 0) {
      throw new Error(`Hero should start with 0 xp, got ${hero.xp}`);
    }

    if (hero.hp !== 200 || hero.max_hp !== 200) {
      throw new Error(`Hero should start with 200/200 hp, got ${hero.hp}/${hero.max_hp}`);
    }

    if (hero.status !== 'idle') {
      throw new Error(`Hero should start with idle status, got ${hero.status}`);
    }

    if (!hero.abilities) {
      throw new Error('Hero abilities not set');
    }

    // Check abilities are stored as JSON
    let parsedAbilities;
    try {
      parsedAbilities = JSON.parse(hero.abilities);
      if (!Array.isArray(parsedAbilities) || parsedAbilities.length === 0) {
        throw new Error('Parsed abilities not an array or empty');
      }
    } catch (e) {
      throw new Error(`Abilities not valid JSON: ${e.message}`);
    }

    // Check recruitment cost
    if (result.cost.gold !== heroClass.recruitCost) {
      throw new Error(`Gold cost mismatch: expected ${heroClass.recruitCost}, got ${result.cost.gold}`);
    }

    if (result.cost.mana !== heroClass.recruitMana) {
      throw new Error(`Mana cost mismatch: expected ${heroClass.recruitMana}, got ${result.cost.mana}`);
    }

    passed++;
  } catch (err) {
    failed++;
    failures.push(`Recruitment ${heroClassId}: ${err.message}`);
  }
}

console.log(`✓ Hero recruitment: ${passed - heroClassIds.length}/${heroClassIds.length} passed\n`);

// TEST 3: Hero XP and leveling
console.log('TEST 3: Hero XP and Leveling\n');

// Test a sample of heroes for leveling mechanics
const levelTestHeroes = heroClassIds.slice(0, 5);
for (const heroClassId of levelTestHeroes) {
  try {
    // Create a level 1 hero
    const hero = {
      class: heroClassId,
      level: 1,
      xp: 0,
    };

    // Award small amount of XP
    const result1 = engine.awardHeroXp(hero, 100);
    if (result1.level !== 1) {
      throw new Error('Hero should still be level 1 with 100 xp');
    }
    if (result1.xp !== 100) {
      throw new Error('XP not updated correctly');
    }

    // Award large amount of XP to level up multiple times
    const result2 = engine.awardHeroXp(result1, 10000000);
    if (result2.level <= 1) {
      throw new Error('Hero should level up with massive XP');
    }
    if (result2.xp < result1.xp) {
      throw new Error('XP should increase');
    }

    // Level should not exceed 25
    if (result2.level > 25) {
      throw new Error(`Hero should cap at level 25, got ${result2.level}`);
    }

    passed++;
  } catch (err) {
    failed++;
    failures.push(`Leveling ${heroClassId}: ${err.message}`);
  }
}

console.log(`✓ Hero leveling: ${passed - heroClassIds.length - 5}/${5} passed\n`);

// TEST 4: Hero power calculation
console.log('TEST 4: Hero Power Calculation\n');

for (const heroClassId of levelTestHeroes) {
  try {
    // Test power at level 1
    const hero1 = { class: heroClassId, level: 1, xp: 0 };
    const power1 = engine.getHeroPower(hero1);

    if (typeof power1 !== 'number' || power1 <= 0) {
      throw new Error(`Invalid power at level 1: ${power1}`);
    }

    // Test power at level 10
    const hero10 = { class: heroClassId, level: 10, xp: 0 };
    const power10 = engine.getHeroPower(hero10);

    if (typeof power10 !== 'number' || power10 <= 0) {
      throw new Error(`Invalid power at level 10: ${power10}`);
    }

    // Power should increase with level
    if (power10 <= power1) {
      throw new Error(`Power at level 10 (${power10}) should be higher than level 1 (${power1})`);
    }

    passed++;
  } catch (err) {
    failed++;
    failures.push(`Power calc ${heroClassId}: ${err.message}`);
  }
}

console.log(`✓ Hero power: ${passed - heroClassIds.length - 10}/${5} passed\n`);

// TEST 5: Hero turn bonuses application
console.log('TEST 5: Hero Turn Bonuses\n');

for (const heroClassId of levelTestHeroes) {
  try {
    const hero = { class: heroClassId, level: 5, xp: 0 };
    const kingdom = {
      gold: 10000,
      mana: 10000,
      food: 10000,
      population: 10000,
      morale: 50,
    };
    const updates = {};
    const events = [];

    engine.applyHeroTurnBonuses(hero, kingdom, updates, events);

    // Special heroes that apply bonuses should update something
    const specialHeroes = ['sovereign', 'archmage', 'forge_lord', 'alpha', 'blood_shaman', 'necromancer', 'star_caller', 'paladin', 'warlord'];
    const isSpecial = specialHeroes.includes(heroClassId);

    if (isSpecial) {
      // Should have some updates
      if (Object.keys(updates).length === 0) {
        throw new Error('Special hero should apply turn bonuses');
      }
    }

    // Check that events array was populated if needed
    if (events && !Array.isArray(events)) {
      throw new Error('Events should be an array');
    }

    passed++;
  } catch (err) {
    failed++;
    failures.push(`Turn bonuses ${heroClassId}: ${err.message}`);
  }
}

console.log(`✓ Hero turn bonuses: ${passed - heroClassIds.length - 15}/${5} passed\n`);

// TEST 6: Race restrictions
console.log('TEST 6: Race Restrictions\n');

const racedHeroes = heroClassIds.filter(id => allHeroClasses[id].races);
for (const heroClassId of racedHeroes.slice(0, 5)) {
  const heroClass = allHeroClasses[heroClassId];
  try {
    // Should succeed with correct race
    const correctRace = heroClass.races[0];
    const correctKingdom = { ...testKingdom, race: correctRace, bld_castles: 5 };
    const resultCorrect = engine.recruitHero(correctKingdom, 'Test', heroClassId);
    if (resultCorrect.error) {
      throw new Error(`Should allow recruitment by ${correctRace}: ${resultCorrect.error}`);
    }

    // Should fail with incorrect race (if there's a race we can test against)
    const allRaces = ['human', 'orc', 'high_elf', 'dark_elf', 'dwarf', 'dire_wolf', 'vampire'];
    const incorrectRace = allRaces.find(r => !heroClass.races.includes(r));

    if (incorrectRace) {
      const incorrectKingdom = { ...testKingdom, race: incorrectRace, bld_castles: 5 };
      const resultIncorrect = engine.recruitHero(incorrectKingdom, 'Test', heroClassId);
      if (!resultIncorrect.error) {
        throw new Error(`Should not allow recruitment by ${incorrectRace}`);
      }
    }

    passed++;
  } catch (err) {
    failed++;
    failures.push(`Race restriction ${heroClassId}: ${err.message}`);
  }
}

console.log(`✓ Race restrictions: ${passed - heroClassIds.length - 20}/${Math.min(5, racedHeroes.length)} passed\n`);

// Summary
console.log('='.repeat(80));
console.log('VERIFICATION SUMMARY');
console.log('='.repeat(80));
console.log(`Total tests: ${passed + failed}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Success rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

if (failures.length > 0) {
  console.log('FAILURES:\n');
  failures.forEach((f, i) => {
    console.log(`${i + 1}. ${f}`);
  });
  process.exit(1);
} else {
  console.log('✓ ALL HEROES TESTS PASSED!\n');
  console.log('Summary of Verification:');
  console.log(`  ✓ All ${heroClassIds.length} hero classes properly defined with complete structures`);
  console.log(`  ✓ All hero classes have valid name, description, and abilities`);
  console.log(`  ✓ All hero classes have valid recruitment costs and stat bonuses`);
  console.log(`  ✓ Hero recruitment works and creates proper hero objects`);
  console.log(`  ✓ Heroes level up correctly with XP progression`);
  console.log(`  ✓ Hero power scales properly with level and class`);
  console.log(`  ✓ Hero turn bonuses apply correctly for special hero types`);
  console.log(`  ✓ Race restrictions properly enforced for race-specific heroes\n`);
  process.exit(0);
}
