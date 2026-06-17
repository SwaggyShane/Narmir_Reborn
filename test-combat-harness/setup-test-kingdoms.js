/**
 * Combat Test Harness - Test Kingdom Setup
 *
 * Creates 8 test kingdoms (one per race) with baseline stats for combat testing.
 * Run once to initialize, then use combat-test-runner.js to execute tests.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const RACES = [
  'human', 'orc', 'dwarf', 'dark_elf',
  'vampire', 'dire_wolf', 'wood_elf', 'ogre'
];

const TEST_KINGDOM_BASE_STATS = {
  player_id: null, // Will be created
  name: null, // Race-based name
  race: null,
  turn: 100,
  level: 50,
  land: 5000,
  population: 1000000,
  gold: 500000000,
  food: 100000000,
  mana: 50000000,
  maps: 100,
  happiness: 100,
  xp: 0,
  research_progress: JSON.stringify({
    res_construction: 50000,
    res_economy: 50000,
    res_spellbook: 50000,
    res_armor: 50000,
    res_entertainment: 50000,
    res_attack_magic: 50000,
    res_war_machines: 50000,
    res_defense_magic: 50000,
    res_military: 50000,
    res_weapons: 50000,
  }),
  troop_levels: JSON.stringify({
    fighters: { level: 100, xp: 1000000, count: 10000 },
    rangers: { level: 100, xp: 1000000, count: 5000 },
    mages: { level: 100, xp: 1000000, count: 3000 },
    clerics: { level: 100, xp: 1000000, count: 2000 },
    engineers: { level: 100, xp: 1000000, count: 2000 },
    thieves: { level: 50, xp: 500000, count: 1000 },
    ninjas: { level: 50, xp: 500000, count: 1000 },
    researchers: { level: 50, xp: 500000, count: 500 },
    scribes: { level: 50, xp: 500000, count: 500 },
  }),
  buildings: JSON.stringify({
    farm: 50, granary: 50, market: 50, tavern: 50,
    castle: 1, armory: 50, barracks: 50, wall: 50,
    mage_tower: 50, library: 50, shrine: 50, training_ground: 50,
    vault: 50, school: 50, outpost: 50, housing: 50,
    smithy: 50, guard_tower: 50, mausoleum: 50,
  }),
  market_upgrades: JSON.stringify({
    trading_post: true,
    caravan: true,
    shipping: true,
  }),
};

async function setupTestKingdoms() {
  return new Promise((resolve, reject) => {
    // Try different possible database paths
    const possiblePaths = [
      path.join(__dirname, '..', 'narmir.db'),
      path.join(__dirname, '..', 'dev.db'),
      process.env.DATABASE_FILE || '',
    ].filter(p => p);

    let db = null;

    // Try to open database
    for (const dbPath of possiblePaths) {
      try {
        db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE);
        console.log(`✓ Connected to database: ${dbPath}`);
        break;
      } catch {
        // Try next path
      }
    }

    if (!db) {
      reject(new Error('Could not find database. Set DATABASE_FILE env var or ensure narmir.db exists.'));
      return;
    }

    db.serialize(async () => {
      try {
        // Create test user if not exists
        db.run(
          `INSERT OR IGNORE INTO users (username, password_hash, email)
           VALUES ('test-combat', 'test', 'test-combat@test.local')`,
          function(err) {
            if (err) throw err;

            // Get user ID
            db.get(
              'SELECT id FROM users WHERE username = ?',
              ['test-combat'],
              (err, user) => {
                if (err) throw err;
                const userId = user.id;

                // Create test kingdoms
                let created = 0;
                RACES.forEach((race, idx) => {
                  const stats = {
                    ...TEST_KINGDOM_BASE_STATS,
                    player_id: userId,
                    name: `Test-${race.toUpperCase()}-${idx + 1}`,
                    race: race,
                  };

                  const placeholders = Object.keys(stats)
                    .map(() => '?')
                    .join(',');
                  const columns = Object.keys(stats).join(',');

                  db.run(
                    `INSERT INTO kingdoms (${columns}) VALUES (${placeholders})`,
                    Object.values(stats),
                    function(err) {
                      if (err) {
                        console.error(`✗ Failed to create ${race} kingdom:`, err.message);
                      } else {
                        console.log(`✓ Created test kingdom: ${stats.name} (ID: ${this.lastID})`);
                        created++;
                      }

                      if (created === RACES.length) {
                        console.log(`\n✓ Setup complete! Created ${created} test kingdoms.`);
                        console.log('\nTest kingdoms ready for combat scenarios.');
                        console.log('Run: node test-combat-harness/combat-test-runner.js --help');
                        db.close();
                        resolve();
                      }
                    }
                  );
                });
              }
            );
          }
        );
      } catch (err) {
        db.close();
        reject(err);
      }
    });
  });
}

// Run setup
setupTestKingdoms()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Setup failed:', err.message);
    process.exit(1);
  });
