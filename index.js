require('dotenv').config();
const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const cookieParser = require('cookie-parser');
const bcrypt       = require('bcryptjs');
const path         = require('path');
const fs           = require('fs');

// Server logging to secure logs directory (not public)
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const logFilePath = path.join(logsDir, 'server.log');
try {
  fs.writeFileSync(logFilePath, `=== SERVER LOG STARTED AT ${new Date().toISOString()} ===\nNODE_ENV: ${process.env.NODE_ENV}\n\n`);
} catch(e) {}

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = function(...args) {
  originalLog.apply(console, args);
  try {
    fs.appendFileSync(logFilePath, `[LOG] [${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`);
  } catch (e) {}
};
console.error = function(...args) {
  originalError.apply(console, args);
  try {
    fs.appendFileSync(logFilePath, `[ERROR] [${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`);
  } catch (e) {}
};
console.warn = function(...args) {
  originalWarn.apply(console, args);
  try {
    fs.appendFileSync(logFilePath, `[WARN] [${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`);
  } catch (e) {}
};

// Initial boot state
let isBooted = false;
let bootError = null;

const { initDb, applyKingdomUpdates } = require('./db/schema');
const setupSockets    = require('./game/sockets');
const engine          = require('./game/engine');
const { requireAuth } = require('./routes/middleware');
const config = require('./game/config');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { 
  cors: { 
    origin: process.env.NODE_ENV === 'production' ? (process.env.CORS_ORIGIN || false) : '*', 
    credentials: true 
  } 
});

const PORT = 3000;
const HOST = '0.0.0.0';

// ── Utility functions ────────────────────────────────────────────────────────
function safeJsonParse(jsonString, defaultValue = {}) {
  try {
    return JSON.parse(jsonString || (typeof defaultValue === 'object' ? JSON.stringify(defaultValue) : defaultValue));
  } catch {
    return defaultValue;
  }
}

// Normalize kingdom objects to ensure all expected numeric properties exist with defaults
function normalizeKingdom(kingdom) {
  if (!kingdom) return null;
  return {
    // Core properties
    id: kingdom.id,
    player_id: kingdom.player_id,
    name: kingdom.name,
    race: kingdom.race || 'human',
    // Resources (all default to 0 or configured value)
    gold: kingdom.gold ?? 10000,
    land: kingdom.land ?? 500,
    population: kingdom.population ?? 50000,
    morale: kingdom.morale ?? 100,
    tax: kingdom.tax ?? 42,
    mana: kingdom.mana ?? 5000,
    food: kingdom.food ?? 0,
    turn: kingdom.turn ?? 0,
    turns_stored: kingdom.turns_stored ?? 400,
    // Research
    res_economy: kingdom.res_economy ?? 100,
    res_weapons: kingdom.res_weapons ?? 100,
    res_armor: kingdom.res_armor ?? 100,
    res_military: kingdom.res_military ?? 100,
    res_spellbook: kingdom.res_spellbook ?? 0,
    res_attack_magic: kingdom.res_attack_magic ?? 100,
    res_defense_magic: kingdom.res_defense_magic ?? 100,
    res_entertainment: kingdom.res_entertainment ?? 100,
    res_construction: kingdom.res_construction ?? 100,
    res_war_machines: kingdom.res_war_machines ?? 100,
    // Buildings
    bld_farms: kingdom.bld_farms ?? 200,
    bld_granaries: kingdom.bld_granaries ?? 0,
    bld_barracks: kingdom.bld_barracks ?? 0,
    bld_outposts: kingdom.bld_outposts ?? 0,
    bld_guard_towers: kingdom.bld_guard_towers ?? 0,
    bld_schools: kingdom.bld_schools ?? 0,
    bld_armories: kingdom.bld_armories ?? 0,
    bld_vaults: kingdom.bld_vaults ?? 0,
    bld_smithies: kingdom.bld_smithies ?? 0,
    bld_markets: kingdom.bld_markets ?? 0,
    bld_mage_towers: kingdom.bld_mage_towers ?? 0,
    bld_shrines: kingdom.bld_shrines ?? 0,
    bld_training: kingdom.bld_training ?? 0,
    bld_castles: kingdom.bld_castles ?? 0,
    bld_housing: kingdom.bld_housing ?? 100,
    bld_walls: kingdom.bld_walls ?? 0,
    // Units
    fighters: kingdom.fighters ?? 0,
    rangers: kingdom.rangers ?? 0,
    clerics: kingdom.clerics ?? 0,
    mages: kingdom.mages ?? 0,
    thieves: kingdom.thieves ?? 0,
    ninjas: kingdom.ninjas ?? 0,
    researchers: kingdom.researchers ?? 0,
    engineers: kingdom.engineers ?? 0,
    war_machines: kingdom.war_machines ?? 0,
    weapons_stockpile: kingdom.weapons_stockpile ?? 0,
    armor_stockpile: kingdom.armor_stockpile ?? 0,
    // JSON fields and other properties
    ...Object.fromEntries(
      Object.entries(kingdom).filter(([key]) =>
        !['id', 'player_id', 'name', 'race', 'gold', 'land', 'population', 'morale', 'tax', 'mana', 'food', 'turn', 'turns_stored',
          'res_economy', 'res_weapons', 'res_armor', 'res_military', 'res_spellbook', 'res_attack_magic', 'res_defense_magic', 'res_entertainment', 'res_construction', 'res_war_machines',
          'bld_farms', 'bld_granaries', 'bld_barracks', 'bld_outposts', 'bld_guard_towers', 'bld_schools', 'bld_armories', 'bld_vaults', 'bld_smithies', 'bld_markets', 'bld_mage_towers', 'bld_shrines', 'bld_training', 'bld_castles', 'bld_housing', 'bld_walls',
          'fighters', 'rangers', 'clerics', 'mages', 'thieves', 'ninjas', 'researchers', 'engineers', 'war_machines', 'weapons_stockpile', 'armor_stockpile',
          'mage_tower_allocation', 'shrine_allocation'
        ].includes(key)
      )
    )
  };
}

app.use(express.json());
app.use(cookieParser());

// Very permissive CSP for development
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
     res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src * 'unsafe-inline' 'unsafe-eval' ws: wss:;");
  }
  next();
});

// ── Rate limiting ──────────────────────────────────────────────────────────────
function makeRateLimiter(maxRequests, windowMs) {
  const hits = new Map();

  // Periodically prune stale entries to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    const staleThreshold = now - windowMs;
    for (const [key, timestamps] of hits) {
      if (timestamps.length === 0 || timestamps[timestamps.length - 1] < staleThreshold) {
        hits.delete(key);
      }
    }
  }, windowMs);

  return function(req, res, next) {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create request timestamps for this IP
    let timestamps = hits.get(key) || [];

    // Remove timestamps outside the sliding window
    timestamps = timestamps.filter(timestamp => timestamp > windowStart);

    // Cap array size to prevent memory exhaustion from attackers
    if (timestamps.length <= maxRequests) {
      timestamps.push(now);
    }

    // Update the map
    hits.set(key, timestamps);

    // Check if limit exceeded
    if (timestamps.length > maxRequests) {
      return res.status(429).json({ error: 'Too many requests — slow down' });
    }

    next();
  };
}

const authLimiter   = makeRateLimiter(10, 60 * 1000);      // 10 auth attempts/min
const turnLimiter   = makeRateLimiter(300, 60 * 1000);     // 300 turn/action requests/min (5/sec)
const generalLimiter= makeRateLimiter(500, 60 * 1000);     // 500 general requests/min

// ── BOOTSTRAP ────────────────────────────────────────────────────────────────
let vite;
async function setupVite() {
  if (process.env.NODE_ENV === 'production') return;
  try {
    const { createServer } = require('vite');
    vite = await createServer({
      configFile: path.join(__dirname, 'vite.config.js'),
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
      base: '/',
      root: path.join(__dirname, 'client'),
      mode: 'development'
    });
    // LOGGING MIDDLEWARE BEFORE VITE
    app.use((req, res, next) => {
      if (req.url.includes('main.js')) {
        const checkPath = path.join(__dirname, req.url.split('?')[0]);
        console.log(`[debug] [${new Date().toISOString()}] Request for main.js: ${req.url}. Physical path: ${checkPath}. Exists: ${fs.existsSync(checkPath)}`);
      }
      if (req.url === '/' || req.url.includes('index.html')) {
        console.log(`[debug] [${new Date().toISOString()}] Request for index: ${req.method} ${req.url}`);
      }
      next();
    });
    
    // app.use(vite.middlewares); // Moved to later in start()
    console.log('[vite] Dev server created with root:', __dirname);
  } catch (err) {
    console.error('[vite] Dev middleware failed to start:', err);
  }
}

app.use(generalLimiter);

// ── Turn regen constants ───────────────────────────────────────────────────────
const REGEN_AMOUNT = 7;   // +7 turns every 25 minutes = ~400/day
const REGEN_MAX    = 400;
const REGEN_MS     = 25 * 60 * 1000;

const AI_KINGDOMS = [
  { username: 'ai_ironforge',   kingdomName: 'Ironforge Hold',     race: 'dwarf'     },
  { username: 'ai_shadowveil',  kingdomName: 'Shadowveil Enclave', race: 'dark_elf'  },
  { username: 'ai_stormfang',   kingdomName: 'Stormfang Warpack',  race: 'dire_wolf' },
  { username: 'ai_silverwind',  kingdomName: 'Silverwind Spire',   race: 'high_elf'  },
  { username: 'ai_grimtusk',    kingdomName: 'Grimtusk Horde',     race: 'orc'       },
  { username: 'ai_ashenvale',   kingdomName: 'Ashenvale Republic', race: 'human'     },
  { username: 'ai_deepdelve',   kingdomName: 'Deepdelve Citadel',  race: 'dwarf'     },
  { username: 'ai_nightshade',  kingdomName: 'Nightshade Court',   race: 'dark_elf'  },
  { username: 'ai_bloodmoon',   kingdomName: 'Bloodmoon Clan',     race: 'orc'       },
  { username: 'ai_crystalpeak', kingdomName: 'Crystalpeak Tower',  race: 'high_elf'  },
];

async function seedAiKingdoms(db) {
  let seeded = 0;
  for (const ai of AI_KINGDOMS) {
    const existing = await db.get('SELECT id FROM players WHERE username = ?', [ai.username]);
    if (existing) continue;
    const hash = bcrypt.hashSync(Math.random().toString(36), 8);
    const player = await db.run(
      'INSERT INTO players (username, password, is_ai) VALUES (?, ?, 1)',
      [ai.username, hash]
    );
    await db.run(
      `INSERT INTO kingdoms (player_id, name, race, gold, land, population,
        researchers, engineers, rangers, turns_stored, res_spellbook, blueprints_stored,
        bld_farms, bld_schools, bld_barracks, bld_armories, bld_housing, world_fragments)
       VALUES (?, ?, ?, 10000, 504, 50000, 100, 100, 50, 400, 0, 1, 200, 1, 1, 1, 100, '["Volcanic Rock", "Ancient Elven Wood", "Dragon Scale", "Abyssal Crystal", "Celestial Feather", "Dwarven Star-Metal", "Cursed Bloodstone", "Tears of the World Tree", "Void Essence", "Titan Bone"]')`,
      [player.lastID, ai.kingdomName, ai.race]
    );
    seeded++;
    console.log(`[ai] Seeded: ${ai.kingdomName} (${ai.race})`);
  }
  return seeded;
}

async function processAiTurns(db) {
  try {
    const hiatusRow = await db.get("SELECT value FROM server_state WHERE key = 'ai_hiatus'");
    if (hiatusRow && hiatusRow.value === 'true') {
      console.log('[ai] AI is currently on hiatus. Skipping turn processing.');
      return;
    }
  } catch (e) {
    console.error('[ai] failed to check hiatus status:', e.message);
  }

  const aiPlayers = await db.all('SELECT id FROM players WHERE is_ai = 1');
  if (aiPlayers.length === 0) return;

  // Run all AI kingdoms sequentially to avoid concurrent resource contention
  for (const p of aiPlayers) {
    try {
      if (db.transactionStorage && typeof db.transactionStorage.run === 'function') {
        await db.transactionStorage.run(null, async () => {
          await runAiKingdom(db, engine, p.id);
        });
      } else {
        await runAiKingdom(db, engine, p.id);
      }
    } catch (e) {
      console.error(`[ai] error for player ${p.id}:`, e.message);
    }
  }
  console.log(`[ai] Processed ${aiPlayers.length} AI kingdoms`);
}

async function runAiKingdom(db, engine, playerId) {
  let ai = await db.get('SELECT * FROM kingdoms WHERE player_id = ?', [playerId]);
  if (!ai || ai.turns_stored < 1) return;
  ai = normalizeKingdom(ai);

  async function applyK(kingdom, updates) {
    await applyKingdomUpdates(kingdom.id, updates);
    return updates; // We return the original object or whatever applyK needs
  }

  const turnsToSpend = ai.turns_stored;
  const inDevelopmentPhase = ai.turn < 800;
  const turnsPerCycle = 2; // Double turns for faster development

  try {
    // Pre-fetch region/alliance data outside the loop (doesn't change per turn)
    const regionStatus = await db.get('SELECT owner_alliance_id, bonus_type FROM regions WHERE name = ?', [ai.region]);
    const myAlliance = await db.get('SELECT alliance_id FROM alliance_members WHERE kingdom_id = ?', [ai.id]);
    ai._region_owned_by_my_alliance = (regionStatus && myAlliance && regionStatus.owner_alliance_id === myAlliance.alliance_id);
    ai._region_bonus_type = regionStatus?.bonus_type;

    // Wrap turn processing in transaction for atomicity
    await db.run('BEGIN TRANSACTION');

    for (let i = 0; i < turnsToSpend; i += turnsPerCycle) {
    if (ai.turns_stored < turnsPerCycle) break;
    if (ai.turns_stored < 1) break;

    // ── Process double turn — use in-memory ai state, no re-read needed ──
    let updates = {};
    let events = [];
    for (let t = 0; t < turnsPerCycle; t++) {
      const { updates: u, events: e } = engine.processTurn(ai);
      Object.assign(updates, u);
      events.push(...(e || []));
      ai.turn = ai.turn + 1; // Increment in-memory turn counter
    }
    updates.turns_stored = ai.turns_stored - turnsPerCycle;

    if (events && events.length > 0) {
      // Batch insert all news events at once
      if (events.length > 0) {
        try {
          const placeholders = events.map(() => '(?,?,?,?)').join(',');
          const values = events.flatMap(ev => [ai.id, ev.type || 'system', ev.message, updates.turn || ai.turn]);
          await db.run(
            `INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ${placeholders}`,
            values
          );
        } catch (err) {
          console.error(`[AI] Failed to batch insert news for ${ai.name}:`, err.message);
          throw err;
        }
      }
    }

    // ── Process heroes ──
    const heroes = await db.all("SELECT * FROM heroes WHERE kingdom_id = ? AND status = 'idle'", [ai.id]);

    // Batch update heroes
    if (heroes.length > 0) {
      for (const hero of heroes) {
        const resHero = engine.awardHeroXp(hero, 10);
        await db.run('UPDATE heroes SET level = ?, xp = ? WHERE id = ?', [resHero.level, resHero.xp, hero.id]);
        engine.applyHeroTurnBonuses(hero, ai, updates, events);
      }
    }

    // AI Hero Recruitment
    if (heroes.length === 0 && ai.gold > 150000 && ai.bld_castles > 0) {
      const classes = ['paladin', 'archmage', 'warlord', 'shadowblade', 'sovereign'];
      const myClass = classes[Math.floor(Math.random() * classes.length)];
      const { hero, cost, error } = engine.recruitHero(ai, `${ai.name}'s Hero`, myClass);
      if (hero && !error) {
        await db.run(
          `INSERT INTO heroes (kingdom_id, name, class, level, xp, abilities, status, hp, max_hp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [ai.id, hero.name, hero.class, hero.level, hero.xp, hero.abilities, hero.status, hero.hp, hero.max_hp]
        );
        updates.gold = (updates.gold || ai.gold) - cost.gold;
        updates.mana = (updates.mana || ai.mana) - cost.mana;
      }
    }

    // ── Engineer allocation — race-aware ──
    const eng = ai.engineers;
    if (eng > 0) {
      const needsFarms = ai.bld_farms < Math.floor(ai.land / 4);
      const farmPct    = needsFarms ? 0.30 : 0.15;
      const barPct     = 0.15;
      const schoolPct  = 0.10;
      const restPct    = Math.max(0, 1 - farmPct - barPct - schoolPct);
      updates.build_allocation = JSON.stringify({
        farms:      Math.floor(eng * farmPct),
        barracks:   Math.floor(eng * barPct),
        schools:    Math.floor(eng * schoolPct),
        mage_towers: (ai.race === 'high_elf' || ai.race === 'dark_elf') ? Math.floor(eng * restPct) : 0,
        markets:    (ai.race === 'dwarf'    || ai.race === 'human')     ? Math.floor(eng * restPct) : 0,
        training:   (ai.race === 'dire_wolf'|| ai.race === 'orc')       ? Math.floor(eng * restPct) : 0,
      });
    }

    // ── Research allocation ──
    const researchers = ai.researchers;
    if (researchers > 0) {
      const cap  = ai.bld_schools * 100;
      const eff  = Math.min(researchers, cap);
      const base = Math.floor(eff / 10);
      const extra = eff - base * 10;
      const focus = {
        high_elf:  { spellbook:base+extra, attack_magic:base, defense_magic:base, economy:base, weapons:base, armor:base, military:base, entertainment:base, construction:base, war_machines:base },
        dwarf:     { economy:base+extra, construction:base, war_machines:base, weapons:base, armor:base, military:base, defense_magic:base, entertainment:base, spellbook:0, attack_magic:base },
        dire_wolf: { military:base+extra, weapons:base, armor:base, economy:base, construction:base, war_machines:base, entertainment:base, defense_magic:base, attack_magic:base, spellbook:0 },
        dark_elf:  { attack_magic:base+extra, spellbook:base, defense_magic:base, economy:base, weapons:base, armor:base, military:base, entertainment:base, construction:base, war_machines:base },
        human:     { economy:base, weapons:base, armor:base, military:base, attack_magic:base, defense_magic:base, entertainment:base+extra, construction:base, war_machines:base, spellbook:base },
        orc:       { military:base+extra, weapons:base, armor:base, economy:base, war_machines:base, construction:base, entertainment:base, defense_magic:base, attack_magic:base, spellbook:0 },
      };
      updates.research_allocation = JSON.stringify(focus[ai.race] || focus.human);
    }

    // ── Mage tower allocation ──
    const towers = ai.bld_mage_towers;
    const mages  = ai.mages;
    if (towers > 0 && mages > 0) {
      updates.mage_tower_allocation = JSON.stringify({ mages: Math.min(mages, towers * 20) });
    }

    // Apply updates and merge back into ai state (avoids re-read)
    const applied = await applyK(ai, updates);
    Object.assign(ai, applied);

    await engine.resolveExpeditions(db, ai, engine);

    // ── Turn 1: Development/Hiring ──
    if (inDevelopmentPhase) {
      await aiDevelopment(db, engine, ai, playerId);
    } else {
      await aiHire(db, engine, ai);
    }

      // ── Turn 2: Action/Warfare ──
      if (!inDevelopmentPhase || Math.random() < 0.3) {
        // During development: 30% chance to war. After: always try to war
        await aiAction(db, engine, ai);
      }
    }

    // Commit transaction on successful completion
    await db.run('COMMIT');
  } catch (error) {
    // Rollback on any error to maintain consistency
    await db.run('ROLLBACK').catch(err => console.error('[AI] Rollback failed:', err.message));
    console.error(`[AI] Turn processing failed for player ${playerId}:`, error.message);
  }
}

/**
 * AI Development Phase (Turns 1-799)
 * Focus on race-specific strengths, building defense and economy
 */
async function aiDevelopment(db, engine, ai, _playerId) {
  const gold = ai.gold;
  const spendable = Math.floor(gold * 0.5); // spend up to 50% during development
  if (spendable < 250) return;

  // Race-specific development strategies
  const strategies = {
    dwarf: {
      buildings: ['barracks', 'armories', 'walls', 'guard_towers', 'markets', 'warehouses'],
      units: ['fighters', 'engineers', 'rangers'],
      unitCost: 250,
    },
    high_elf: {
      buildings: ['barracks', 'mage_towers', 'schools', 'walls', 'outposts'],
      units: ['mages', 'rangers', 'clerics'],
      unitCost: 250,
    },
    orc: {
      buildings: ['barracks', 'training_grounds', 'walls', 'guard_towers', 'armories'],
      units: ['fighters', 'rangers', 'ninjas'],
      unitCost: 250,
    },
    dark_elf: {
      buildings: ['barracks', 'mage_towers', 'walls', 'outposts', 'schools'],
      units: ['ninjas', 'thieves', 'mages', 'rangers'],
      unitCost: 250,
    },
    human: {
      buildings: ['barracks', 'markets', 'walls', 'guard_towers', 'schools'],
      units: ['fighters', 'rangers', 'clerics', 'engineers'],
      unitCost: 250,
    },
    dire_wolf: {
      buildings: ['barracks', 'training_grounds', 'walls', 'guard_towers', 'armories'],
      units: ['fighters', 'rangers', 'clerics'],
      unitCost: 250,
    },
  };

  const strat = strategies[ai.race] || strategies.human;
  const updates = {};

  // Phase 1 (Turns 1-300): Build economy and defense infrastructure
  if (ai.turn < 300) {
    // 60% defense buildings, 40% economy
    const buildPct = Math.random() < 0.6 ? 0.7 : 0.3;
    const goldForBuilding = Math.floor(spendable * buildPct);

    // Prioritize walls and guard towers for defense
    const defensePriority = [
      { type: 'walls', cost: 2000, count: ai.bld_walls, target: Math.floor(ai.land / 50) },
      { type: 'guard_towers', cost: 3000, count: ai.bld_guard_towers, target: Math.floor(ai.land / 100) },
      { type: 'barracks', cost: 5000, count: ai.bld_barracks, target: 20 },
    ];

    for (const item of defensePriority) {
      if (item.count < item.target && goldForBuilding >= item.cost) {
        updates.gold = ai.gold - item.cost;
        updates[`bld_${item.type}`] = (ai[`bld_${item.type}`] || 0) + 1;
        ai.gold = updates.gold;
        ai[`bld_${item.type}`] = updates[`bld_${item.type}`];
        break;
      }
    }
  }

  // Phase 2 (Turns 300-600): Build military production and economy
  if (ai.turn >= 300 && ai.turn < 600) {
    // 40% military, 60% economy/tech
    const buildPct = Math.random() < 0.4 ? 0.8 : 0.2;
    const goldForBuilding = Math.floor(spendable * buildPct);

    const econPriority = [
      { type: 'schools', cost: 4000, count: ai.bld_schools, target: 15 },
      { type: 'markets', cost: 3000, count: ai.bld_markets, target: 25 },
    ];

    for (const item of econPriority) {
      if (item.count < item.target && goldForBuilding >= item.cost) {
        updates.gold = ai.gold - item.cost;
        updates[`bld_${item.type}`] = (ai[`bld_${item.type}`] || 0) + 1;
        ai.gold = updates.gold;
        ai[`bld_${item.type}`] = updates[`bld_${item.type}`];
        break;
      }
    }
  }

  // Phase 3 (Turns 600-799): Ramp up military production
  if (ai.turn >= 600) {
    // 80% military units, 20% buildings
    const unitSpend = Math.random() < 0.8 ? spendable * 0.8 : spendable * 0.2;
    const unitCount = Math.floor(unitSpend / strat.unitCost);

    if (unitCount > 0) {
      // Hire race-specific units
      const unitType = strat.units[Math.floor(Math.random() * strat.units.length)];
      const result = engine.hireUnits(ai, unitType, unitCount);
      if (!result.error && result.updates) {
        Object.assign(updates, result.updates);
        Object.assign(ai, result.updates);
      }
    }
  }

  // Apply accumulated updates in a single database call
  if (Object.keys(updates).length > 0) {
    await applyKingdomUpdates(ai.id, updates);
  }
}

async function aiHire(db, engine, ai) {
  const gold = ai.gold;
  const spendable = Math.floor(gold * 0.3); // spend up to 30% of gold on hiring
  if (spendable < 250) return;

  const UNIT_COST = 250;
  const barracksCap = ai.bld_barracks * 500;
  const currentTroops = (ai.fighters||0) + (ai.rangers||0) + (ai.clerics||0) + (ai.thieves||0) + (ai.ninjas||0);
  const barracksRoom = Math.max(0, barracksCap - currentTroops);
  if (barracksRoom <= 0) return;

  const maxAffordable = Math.min(Math.floor(spendable / UNIT_COST), barracksRoom,
    Math.floor(ai.population * 0.1));
  if (maxAffordable <= 0) return;

  // Race-based unit preference
  const unitPref = {
    high_elf:  ['clerics','mages','rangers','fighters','thieves','ninjas'],
    dwarf:     ['fighters','engineers','rangers','clerics','thieves','ninjas'],
    dire_wolf: ['fighters','rangers','clerics','ninjas','thieves','mages'],
    dark_elf:  ['ninjas','thieves','rangers','fighters','clerics','mages'],
    human:     ['fighters','rangers','clerics','thieves','ninjas','mages'],
    orc:       ['fighters','rangers','clerics','ninjas','thieves','mages'],
  }[ai.race] || ['fighters','rangers'];

  let goldLeft = spendable;
  for (const unit of unitPref) {
    if (goldLeft < UNIT_COST) break;
    // Check school/barracks caps
    if (unit === 'researchers') continue; // AI doesn't hire researchers this way
    const BARRACKS_UNITS = ['fighters','rangers','clerics','thieves','ninjas'];
    if (BARRACKS_UNITS.includes(unit) && barracksCap === 0) continue;
    const canHire = Math.min(Math.floor(goldLeft / UNIT_COST), Math.floor(maxAffordable / unitPref.length));
    if (canHire <= 0) continue;
    const result = engine.hireUnits(ai, unit, canHire);
    if (!result.error && result.updates) {
      await applyKingdomUpdates(ai.id, result.updates);
      Object.assign(ai, result.updates);
      goldLeft = ai.gold * 0.3;
    }
    break; // hire one type per tick
  }
}

async function aiAction(db, engine, ai) {
  try {
    // Frequent action to focus on war (act 90% of the time, up from 50%)
    if (Math.random() > 0.90) return;

  // Per-target cooldown — don't act on the same kingdom more than once every 20 minutes
  const cooldownSecs = 20 * 60;
  const recentActions = await db.all(
    `SELECT defender_id FROM war_log WHERE attacker_id = ? AND created_at > ?`,
    [ai.id, Math.floor(Date.now()/1000) - cooldownSecs]
  );
  const recentTargetIds = new Set(recentActions.map(r => r.defender_id));

  // Get potential targets — strictly AI only and ignore humans
  const targets = await db.all(`
    SELECT k.* FROM kingdoms k
    JOIN players p ON k.player_id = p.id
    WHERE k.id != ? AND k.land > 100 AND p.is_ai = 1
    ORDER BY RANDOM() LIMIT 10
  `, [ai.id]);

  // Filter out recently attacked targets
  const validTargets = targets.filter(t => !recentTargetIds.has(t.id));
  if (validTargets.length === 0) return;

  // Pick weakest valid target (easier win)
  const target = validTargets.sort((a, b) => (a.fighters || 0) - (b.fighters || 0))[0];

  // Ensure AI has maps for warfare (batch with combat updates)
  const aiUpdates = {};
  if (ai.maps < 1) {
    aiUpdates.maps = 1;
    ai.maps = 1;
  }

  const fighters = ai.fighters;
  const mages    = ai.mages;
  const ninjas   = ai.ninjas;
  const thieves  = ai.thieves;

  const roll = Math.random();

  // Military attack — only if AI has meaningful power advantage (>20% win estimate)
  if (fighters >= 50 && roll < 0.7) {
    const sendFighters = Math.floor(fighters * (0.4 + Math.random() * 0.3));
    const sendMages    = Math.floor(mages    * (0.3 + Math.random() * 0.2));

    // Power ratio check — don't attack into certain defeat
    const aiPower     = sendFighters + sendMages * 2.5;
    const defPower    = (target.fighters || 0) + (target.mages || 0) * 2.5;
    const winChance   = defPower > 0 ? aiPower / (aiPower + defPower) : 0.9;
    if (winChance < 0.20) return; // lower threshold to encourage more wars

    const sentUnits = { fighters: sendFighters, mages: sendMages, rangers: 0, warMachines: 0, ninjas: 0, thieves: 0, clerics: 0, engineers: 0 };
    const result = engine.resolveMilitaryAttack(ai, target, sentUnits, [], []);
    if (!result.error) {
      const VALID_ATK = new Set(['gold','mana','land','fighters','mages','weapons_stockpile','xp','level','troop_levels']);
      const aSafe = Object.fromEntries(Object.entries(result.attackerUpdates).filter(([c,v]) => VALID_ATK.has(c) && v !== undefined && !isNaN(v)));
      const dSafe = Object.fromEntries(Object.entries(result.defenderUpdates).filter(([c,v]) => VALID_ATK.has(c) && v !== undefined && !isNaN(v)));

      // Batch attacker updates with maps update if needed
      Object.assign(aiUpdates, aSafe);

      // Apply both attacker updates and defender updates in batched calls
      if (Object.keys(aiUpdates).length) {
        await applyKingdomUpdates(ai.id, aiUpdates);
      }
      if (Object.keys(dSafe).length) {
        await applyKingdomUpdates(target.id, dSafe);
      }

      // War log
      const outcome = result.win ? 'victory' : 'repelled';
      const detail  = JSON.stringify({
        ...result.report,
        landTaken: result.report?.landTransferred || 0,
        attackerLost: result.report?.atkFightersLost || 0,
        defenderLost: result.report?.defFightersLost || 0
      });
      const logRes = await db.run(`INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES (?,?,?,?,?,?,?,?)`,
        ['attack', ai.id, ai.name, target.id, target.name, outcome, detail, 0]);
      const reportId = logRes.lastID;

      // News for defender with replay link
      if (result.defEvent) {
        await db.run('INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)',
          [target.id, 'attack', result.defEvent, target.turn, reportId]);
      }
    }

  // Covert loot — needs thieves
  } else if (thieves >= 20 && roll < 0.85) {
    const lootTypes = ['gold','research','war_machines'];
    const lootType  = lootTypes[Math.floor(Math.random() * lootTypes.length)];
    const result    = engine.covertLoot(ai, target, lootType, Math.floor(thieves * 0.5));
    if (!result.error && result.success && result.targetUpdates) {
      const VALID_LOOT = new Set(['gold','res_economy','res_weapons','war_machines']);
      const tSafe = Object.fromEntries(Object.entries(result.targetUpdates).filter(([c,v]) => VALID_LOOT.has(c) && v !== undefined && !isNaN(v)));

      // Apply maps + loot updates in batched call
      if (Object.keys(aiUpdates).length) {
        await applyKingdomUpdates(ai.id, aiUpdates);
      }
      if (Object.keys(tSafe).length) {
        await applyKingdomUpdates(target.id, tSafe);
      }

      if (result.targetEvent) {
        await db.run('INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)',
          [target.id, 'covert', result.targetEvent, target.turn]);
      }
      await db.run(`INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES (?,?,?,?,?,?,?,?)`,
        ['loot', ai.id, ai.name, target.id, target.name, 'success', JSON.stringify({ stolen: result.stolen, type: lootType }), 1]);
    }

  // Assassination — needs ninjas
  } else if (ninjas >= 20) {
    const unitTypes = ['fighters','researchers','engineers'];
    const unitType  = unitTypes[Math.floor(Math.random() * unitTypes.length)];
    const result    = engine.covertAssassinate(ai, target, Math.floor(ninjas * 0.4), unitType);
    if (!result.error && result.success && result.targetUpdates) {
      const validUnits = new Set(['fighters','researchers','engineers']);
      const col    = unitType;
      const newVal = result.targetUpdates[col];
      if (newVal !== undefined && validUnits.has(col)) {
        const tUpdates = { [col]: Math.max(0, newVal) };

        // Apply maps update for attacker if needed
        if (Object.keys(aiUpdates).length) {
          await applyKingdomUpdates(ai.id, aiUpdates);
        }
        // Apply assassination update for target
        await applyKingdomUpdates(target.id, tUpdates);
      }

      if (result.targetEvent) {
        await db.run('INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)',
          [target.id, 'covert', result.targetEvent, target.turn]);
      }
      await db.run(`INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES (?,?,?,?,?,?,?,?)`,
        ['assassinate', ai.id, ai.name, target.id, target.name, 'success', JSON.stringify({ killed: result.killed, unit: unitType }), 1]);
    }
    }
  } catch (error) {
    console.error(`[AI Action] Error for ${ai.name}:`, error.message);
  }
}

const SEASON_ICONS = { spring:'🌸', summer:'☀️', fall:'🍂', winter:'❄️' };

async function fireDailyEvent(db, k, season) {
  const now = Math.floor(Date.now()/1000);
  if ((now - (k.last_event_at||0)) < 86400) return null;
  const allEvents = await db.all(`SELECT * FROM events WHERE is_active=1 AND (season=? OR season='all') ORDER BY RANDOM() LIMIT 10`, [season]);
  if (!allEvents.length) return null;
  const eligible = allEvents.filter(e => !e.race_only || e.race_only === k.race);
  if (!eligible.length) return null;
  const ev = eligible[Math.floor(Math.random()*eligible.length)];
  const updates = { last_event_at: now };
  let message = `${SEASON_ICONS[season]||''} ${ev.name}: ${ev.description}`;
  const val = ev.effect_value, dur = ev.effect_duration;
  switch (ev.effect_type) {
    case 'morale':
      updates.morale = Math.max(0, Math.min(200, (k.morale||100) + val));
      message += val > 0 ? ` (+${val} morale)` : ` (${val} morale)`; break;
    case 'gold': {
      const d = Math.floor((k.gold||0) * Math.abs(val)) * (val>0?1:-1);
      updates.gold = Math.max(0, (k.gold||0)+d);
      message += d>0?` (+${d.toLocaleString()} gold)`:` (${d.toLocaleString()} gold)`; break; }
    case 'food': {
      const fd = Math.abs(val)<1 ? Math.floor((k.food||0)*Math.abs(val))*(val>0?1:-1) : Math.floor(val);
      updates.food = Math.max(0, (k.food||0)+fd);
      message += fd>0?` (+${fd.toLocaleString()} food)`:` (${fd.toLocaleString()} food)`; break; }
    case 'population': {
      const pd = Math.abs(val)<1 ? Math.floor((k.population||0)*Math.abs(val))*(val>0?1:-1) : Math.floor(val);
      updates.population = Math.max(1000, (k.population||0)+pd);
      message += pd>0?` (+${pd.toLocaleString()} pop)`:` (${pd.toLocaleString()} pop)`; break; }
    case 'farm_yield': case 'military': case 'mana': case 'market': {
      let active = safeJsonParse(k.active_event, {});
      active[ev.effect_type] = { mult:1+val, turns_remaining:dur };
      updates.active_event = JSON.stringify(active);
      message += val>0?` (+${Math.round(val*100)}% for ${dur} turns)`:` (${Math.round(val*100)}% for ${dur} turns)`; break; }
  }
  await db.run(`INSERT INTO event_log (kingdom_id,kingdom_name,event_key,event_name,season,fired_at) VALUES (?,?,?,?,?,?)`,
    [k.id, k.name, ev.key, ev.name, season, now]);
  return { updates, message };
}

async function runRegen(db) {
  // Update season first
  const sRow = await db.get("SELECT value FROM server_state WHERE key='current_season'");
  const tRow = await db.get("SELECT value FROM server_state WHERE key='season_started_at'");
  let season = sRow?.value || 'spring';
  const startedAt = parseInt(tRow?.value) || Math.floor(Date.now()/1000);
  const daysSince = (Math.floor(Date.now()/1000) - startedAt) / 86400;
  const SEASON_DUR = { spring:3, summer:5, fall:2, winter:3 };
  if (daysSince >= (SEASON_DUR[season]||3)) {
    const ORDER = ['spring','summer','fall','winter'];
    season = ORDER[(ORDER.indexOf(season)+1)%ORDER.length];
    await db.run("UPDATE server_state SET value=? WHERE key='current_season'", [season]);
    await db.run("UPDATE server_state SET value=CAST(unixepoch() AS TEXT) WHERE key='season_started_at'");
    console.log('[season] Changed to', season);
  }

  // Fire daily events for all kingdoms
  const kingdoms = await db.all('SELECT * FROM kingdoms WHERE turn > 0');
  for (const k of kingdoms) {
    const result = await fireDailyEvent(db, k, season);
    if (result) {
      for (const [col, val] of Object.entries(result.updates)) {
        if (['last_event_at','active_event','gold','food','morale','population'].includes(col)) {
          await db.run(`UPDATE kingdoms SET ${col}=? WHERE id=?`, [val, k.id]);
        }
      }
      await db.run('INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)',
        [k.id, 'system', result.message, k.turn]);
    }
  }

  // Resolve regions - calculate dominance and capture progress
  try {
    await engine.resolveRegions(db, global._narmir_io);
  } catch(e) {
    console.error('[regions] resolution error:', e.message);
  }

  await db.run(`
    UPDATE kingdoms
    SET turns_stored = MIN(?, turns_stored + ?)
    WHERE turns_stored < ?
  `, [REGEN_MAX, REGEN_AMOUNT, REGEN_MAX]);

  // Clean up old logs to prevent unbounded growth
  const now = Math.floor(Date.now() / 1000);
  const RETENTION = { EVENTS: 30, NEWS: 30, WAR: 60, SPY: 45 }; // days

  try {
    let totalCleaned = 0;

    // Clean event logs
    let result = await db.run('DELETE FROM event_log WHERE fired_at < ?', [now - RETENTION.EVENTS * 86400]);
    totalCleaned += result.changes;

    // Clean news logs (fast-growing with AI turn logging)
    result = await db.run('DELETE FROM news WHERE created_at < ?', [now - RETENTION.NEWS * 86400]);
    totalCleaned += result.changes;

    // Clean war logs (keep longer for history)
    result = await db.run('DELETE FROM war_log WHERE created_at < ?', [now - RETENTION.WAR * 86400]);
    totalCleaned += result.changes;

    // Clean spy reports (requires index on created_at for performance)
    result = await db.run('DELETE FROM spy_reports WHERE created_at < ?', [now - RETENTION.SPY * 86400]);
    totalCleaned += result.changes;

    if (totalCleaned > 0) {
      console.log(`[db] Cleaned up ${totalCleaned} old log entries`);
    }
  } catch (err) {
    console.error('[db] Log cleanup failed:', err.message);
  }

  await db.run(
    "UPDATE server_state SET value = CAST(unixepoch() AS TEXT) WHERE key = 'last_regen_at'"
  );
  console.log('[turns] Regen complete — +' + REGEN_AMOUNT + ' turns · season: ' + season);
  try { await processAiTurns(db); } catch(e) { console.error('[ai] turn error:', e.message); }
}

async function updateMarketPrices(db) {
  try {
    const prices = await db.all('SELECT * FROM market_prices');
    for (const p of prices) {
      const drift = (p.base_price - p.current_price) / p.base_price * 0.08;
      const change = 1 + (Math.random() * 0.12 - 0.06) + drift; // increased volatility to [-6%, +6%] per pulse
      let newPrice = p.current_price * change;
      newPrice = Math.max(p.base_price * 0.15, Math.min(p.base_price * 6.0, newPrice));
      await db.run('UPDATE market_prices SET current_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newPrice, p.id]);
    }
    console.log('[market] Prices fluctuated');
  } catch (e) {
    console.error('[market] Fluctuation failed:', e.message);
  }
}

async function refreshLore(db) {
  const loreRows = await db.all("SELECT id, key_id, title, content, category FROM lore_entries");
  const loadedLore = {};
  const defaultRaces = ['high_elf', 'dwarf', 'dire_wolf', 'human', 'dark_elf', 'orc', 'narmir', 'general'];
  defaultRaces.forEach(r => loadedLore[r] = []);
  loreRows.forEach(r => {
    const cat = r.category || 'general';
    if (!loadedLore[cat]) loadedLore[cat] = [];
    loadedLore[cat].push({ id: r.key_id || `lore_${r.id}`, title: r.title || 'Untitled', msg: r.content });
  });
  config.LORE_EVENTS = loadedLore;

  const randomEventRows = await db.all("SELECT id, content FROM random_events");
  config.JUNK_PRIZES = randomEventRows;

  const junkRows = await db.all("SELECT id, content FROM junk_events");
  config.JUNK_EVENTS = junkRows.map(r => r.content);

  const taxRows = await db.all("SELECT id, content FROM tax_events");
  config.TAX_EVENTS = taxRows.map(r => r.content);
}

async function start() {
  console.log('[boot] Starting Narmir server...');

  try {
    if (process.env.NODE_ENV !== 'production') {
      await setupVite();
    }
    
    let db = null;
    try {
      db = await initDb();
      
      await refreshLore(db);
      console.log('[lore] Lore and Random events refreshed');

      // -- Fix database corruption --
      (async () => {
        try {
          const cols = [
            "active_effects", "troop_levels", "research_allocation", "build_queue", "build_progress",
            "build_allocation", "scrolls", "mage_tower_allocation", "shrine_allocation",
            "library_allocation", "mausoleum_allocation", "library_progress", "tower_progress",
            "bank_upgrades", "bank_deposits", "market_upgrades", "mausoleum_upgrades",
            "shrine_upgrades", "school_upgrades", "tower_upgrades", "tower_def_upgrades",
            "outpost_upgrades", "wall_upgrades", "tavern_upgrades", "farm_upgrades",
            "granary_upgrades", "library_upgrades"
          ];
          const validCols = new Set(cols);
          let fixedRows = 0;
          for (let c of cols) {
            if (!validCols.has(c)) continue;
            let res = await db.run(`UPDATE kingdoms SET ${c} = '{}' WHERE ${c} LIKE '{%' AND length(${c}) < 5`);
            if (res.changes) fixedRows += res.changes;
            res = await db.run(`UPDATE kingdoms SET ${c} = '[]' WHERE ${c} LIKE '[%' AND length(${c}) < 5`);
            if (res.changes) fixedRows += res.changes;
          }
          if (fixedRows > 0) console.log(`[db] Fixed ${fixedRows} corrupted JSON rows.`);
        } catch (err) {
          console.error('[db] Error in fixing corrupted JSON rows:', err.message);
        }
      })();

      // ── Crash-safe regen on boot ─────────────────────────────────────────────────
      // Calculate how many 15-min windows passed since last regen and apply them now
      const regenRow = await db.get("SELECT value FROM server_state WHERE key = 'last_regen_at'");
      if (regenRow) {
        const lastRegen = Number(regenRow.value);
        const now       = Math.floor(Date.now() / 1000);
        const elapsed   = now - lastRegen;
        const windows   = Math.floor(elapsed / (REGEN_MS / 1000));
        if (windows > 0) {
          const catchUp = Math.min(windows * REGEN_AMOUNT, REGEN_MAX);
          await db.run(`
            UPDATE kingdoms SET turns_stored = MIN(?, turns_stored + ?)
          `, [REGEN_MAX, catchUp]);
          await db.run(
            "UPDATE server_state SET value = CAST(unixepoch() AS TEXT) WHERE key = 'last_regen_at'"
          );
          console.log('[turns] Boot catch-up: applied ' + windows + ' missed window(s), +'  + catchUp + ' turns');
        }
      }

      // Auto-seed AI kingdoms on boot if they don't exist
      try {
        const seeded = await seedAiKingdoms(db);
        if (seeded > 0) console.log(`[ai] Seeded ${seeded} new AI kingdoms`);
        else console.log('[ai] AI kingdoms already exist');
      } catch(e) { console.error('[ai] Seed error:', e.message); }

      try {
        const heroes = await db.all('SELECT id, class FROM heroes');
        const getHeroConfig = () => ({
          paladin: [{name: "Protective Aura", description: "+10% Military Power"}],
          archmage: [{name: "Arcane Infusion", description: "Harvest +100 mana per turn per level"}],
          warlord: [{name: "War Cry", description: "+25% Military Power"}],
          shadowblade: [{name: "Deadly Strike", description: "Massively boosts assassination success rates"}],
          sovereign: [{name: "Royal Decree", description: "+10% Population Growth"}]
        });
        const c = getHeroConfig();
        for (const h of heroes) {
            if (c[h.class]) await db.run('UPDATE heroes SET abilities = ? WHERE class = ?', [JSON.stringify(c[h.class]), h.class]);
        }
      } catch (err) {
        console.error('[heroes] Error setting hero abilities:', err.message);
      }

      // Schedule ongoing regen with error handling
      setInterval(async () => {
        try {
          await runRegen(db);
        } catch (err) {
          console.error('[turns] CRITICAL: Regen failed:', err.message);
        }
      }, REGEN_MS);
      console.log('[turns] Regen timer started — +' + REGEN_AMOUNT + ' every 25 min (max ' + REGEN_MAX + ')');

      // Market pulse with error handling
      setInterval(async () => {
        try {
          await updateMarketPrices(db);
        } catch (err) {
          console.error('[market] CRITICAL: Market pulse failed:', err.message);
        }
      }, 3600000); 
      try {
        updateMarketPrices(db);
      } catch (err) {
        console.error('[market] Error in market pulse:', err.message);
      }

    } catch (err) {
      bootError = err;
      console.error('[boot] ⚠️ DATABASE ERROR: Server starting up in OFFLINE/ERROR state', err);
    }

    // Intercept API routes if database is not connected
    app.use('/api/', (req, res, next) => {
      if (bootError) {
        // Don't leak internal error details in production
        const details = process.env.NODE_ENV === 'production'
          ? 'Service temporarily unavailable'
          : (bootError.message || String(bootError));
        return res.status(500).json({
          status: 'error',
          error: 'Service Unavailable',
          details: details
        });
      }
      next();
    });

    // ── Routes ────────────────────────────────────────────────────────────────────
    app.use('/api/auth',         authLimiter,  require('./routes/auth')(db));
    app.use('/api/kingdom',      turnLimiter,  require('./routes/kingdom')(db));
    app.use('/api/hero',         turnLimiter,  require('./routes/hero')(db));
    app.use('/api/ai-warfare',               require('./routes/ai-warfare')(db));
    app.use('/api/admin',                    require('./routes/admin')(db, io));

  app.get('/api/alliance/list', requireAuth, async (req, res) => {
    const rows = await db.all(`
      SELECT a.id, a.name, k.name AS leader_name, COUNT(am.kingdom_id) as member_count
      FROM alliances a
      JOIN kingdoms k ON a.leader_id = k.id
      JOIN alliance_members am ON am.alliance_id = a.id
      GROUP BY a.id, a.name, k.name ORDER BY member_count DESC, a.name ASC
    `);
    res.json(rows);
  });

  app.post('/api/alliance/vault/deposit', requireAuth, async (req, res) => {
    const kingdom = await db.get('SELECT id, gold, name FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
    if (!kingdom) return res.status(404).json({ error: 'Kingdom not found' });
    const membership = await db.get('SELECT alliance_id FROM alliance_members WHERE kingdom_id = ?', [kingdom.id]);
    if (!membership) return res.status(400).json({ error: 'Not in an alliance' });
    const { amount } = req.body;
    const goldAmount = parseInt(amount) || 0;
    if (goldAmount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (kingdom.gold < goldAmount) return res.status(400).json({ error: 'Not enough gold' });
    
    await db.run('BEGIN TRANSACTION');
    try {
      await db.run('UPDATE kingdoms SET gold = gold - ? WHERE id = ?', [goldAmount, kingdom.id]);
      await db.run('UPDATE alliances SET vault_gold = vault_gold + ? WHERE id = ?', [goldAmount, membership.alliance_id]);
      const alliance = await db.get('SELECT vault_log FROM alliances WHERE id = ?', [membership.alliance_id]);
      let logs = safeJsonParse(alliance.vault_log, []);
      logs.unshift({ type: 'deposit', kingdom: kingdom.name, amount: goldAmount, date: new Date().toLocaleString() });
      if(logs.length > 20) logs = logs.slice(0, 20);
      await db.run('UPDATE alliances SET vault_log = ? WHERE id = ?', [JSON.stringify(logs), membership.alliance_id]);
      await db.run('COMMIT');
      res.json({ ok: true, deposited: goldAmount });
    } catch(e) {
      await db.run('ROLLBACK');
      console.error(e);
      res.status(500).json({ error: 'Deposit failed' });
    }
  });

  app.post('/api/alliance/vault/project', requireAuth, async (req, res) => {
    const kingdom = await db.get('SELECT id, name FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
    const alliance = await db.get('SELECT * FROM alliances WHERE leader_id = ?', [kingdom.id]);
    if (!alliance) return res.status(403).json({ error: 'Only leader can fund projects' });
    
    const { project } = req.body;
    const allowedProjects = ['merchant_guild', 'shadow_network', 'mercenary_subsidy', 'fortress_walls'];
    if (!allowedProjects.includes(project)) return res.status(400).json({ error: 'Invalid project' });

    let projects = safeJsonParse(alliance.projects, {});
    const currentLevel = projects[project] || 0;
    if (currentLevel >= 10) return res.status(400).json({ error: 'Project is max level' });
    
    const cost = 50000 * (currentLevel + 1);
    if (alliance.vault_gold < cost) return res.status(400).json({ error: 'Not enough vault gold' });
    
    await db.run('BEGIN TRANSACTION');
    try {
      projects[project] = currentLevel + 1;
      await db.run('UPDATE alliances SET vault_gold = vault_gold - ?, projects = ? WHERE id = ?', [cost, JSON.stringify(projects), alliance.id]);

      let logs = safeJsonParse(alliance.vault_log, []);
      logs.unshift({ type: 'project', name: project.replace('_', ' '), level: currentLevel + 1, cost: cost, date: new Date().toLocaleString() });
      if(logs.length > 20) logs = logs.slice(0, 20);
      await db.run('UPDATE alliances SET vault_log = ? WHERE id = ?', [JSON.stringify(logs), alliance.id]);
      
      // Sync buffs to all members with single JOIN query
      const members = await db.all('SELECT k.id, k.alliance_buffs FROM kingdoms k JOIN alliance_members am ON k.id = am.kingdom_id WHERE am.alliance_id = ?', [alliance.id]);
      for (const m of members) {
         let buffs = safeJsonParse(m.alliance_buffs, {});
         buffs[project] = currentLevel + 1;
         await db.run('UPDATE kingdoms SET alliance_buffs = ? WHERE id = ?', [JSON.stringify(buffs), m.id]);
      }
      
      await db.run('COMMIT');
      res.json({ ok: true });
    } catch(e) {
      await db.run('ROLLBACK');
      console.error(e);
      res.status(500).json({ error: 'Project funding failed' });
    }
  });

  app.get('/api/alliance/my', requireAuth, async (req, res) => {
    const kingdom = await db.get('SELECT id FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
    if (!kingdom) return res.status(404).json({ error: 'Kingdom not found' });
    const membership = await db.get('SELECT * FROM alliance_members WHERE kingdom_id = ?', [kingdom.id]);
    if (!membership) return res.json({ alliance: null });
    const alliance = await db.get('SELECT * FROM alliances WHERE id = ?', [membership.alliance_id]);
    if (!alliance) {
      await db.run('DELETE FROM alliance_members WHERE kingdom_id = ?', [kingdom.id]);
      return res.json({ alliance: null });
    }
    const members = await db.all(`
      SELECT k.id, k.name, k.race, k.land, k.fighters, k.level, am.pledge
      FROM kingdoms k JOIN alliance_members am ON k.id = am.kingdom_id
      WHERE am.alliance_id = ? ORDER BY k.land DESC`, [membership.alliance_id]);
    res.json({ alliance, members, myPledge: membership.pledge, isLeader: alliance.leader_id === kingdom.id });
  });

  app.post('/api/alliance/pledge', requireAuth, async (req, res) => {
    const kingdom = await db.get('SELECT id FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
    const { pledge } = req.body;
    const p = Math.max(0, Math.min(10, Number(pledge) || 3));
    await db.run('UPDATE alliance_members SET pledge = ? WHERE kingdom_id = ?', [p, kingdom.id]);
    res.json({ ok: true, pledge: p });
  });

  app.post('/api/alliance/dismiss', requireAuth, async (req, res) => {
    const kingdom = await db.get('SELECT id FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
    const alliance = await db.get('SELECT * FROM alliances WHERE leader_id = ?', [kingdom.id]);
    if (!alliance) return res.status(403).json({ error: 'Only leader can dismiss members' });
    const { targetKingdomId } = req.body;
    if (targetKingdomId === kingdom.id) return res.status(400).json({ error: 'Cannot dismiss yourself' });
    await db.run('DELETE FROM alliance_members WHERE kingdom_id = ? AND alliance_id = ?', [targetKingdomId, alliance.id]);
    await db.run('UPDATE kingdoms SET alliance_buffs = \'{}\' WHERE id = ?', [targetKingdomId]);
    res.json({ ok: true });
  });

  app.post('/api/alliance/create', requireAuth, async (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Alliance name required' });
    const kingdom = await db.get('SELECT * FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
    if (!kingdom) return res.status(404).json({ error: 'Kingdom not found' });
    await db.run('DELETE FROM alliance_members WHERE kingdom_id = ?', [kingdom.id]);
    try {
      const result = await db.run('INSERT INTO alliances (name, leader_id) VALUES (?, ?)', [name.trim(), kingdom.id]);
      await db.run('INSERT INTO alliance_members (alliance_id, kingdom_id, pledge) VALUES (?, ?, 3)', [result.lastID, kingdom.id]);
      res.json({ ok: true, allianceId: result.lastID });
    } catch (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Alliance name taken' });
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.post('/api/alliance/invite', requireAuth, async (req, res) => {
    const kingdom = await db.get('SELECT * FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
    const membership = await db.get('SELECT * FROM alliance_members WHERE kingdom_id = ?', [kingdom.id]);
    if (!membership) return res.status(400).json({ error: 'You are not in an alliance' });
    const alliance = await db.get('SELECT * FROM alliances WHERE id = ?', [membership.alliance_id]);
    if (alliance.leader_id !== kingdom.id) return res.status(403).json({ error: 'Only the leader can invite' });
    try {
      await db.run('INSERT INTO alliance_members (alliance_id, kingdom_id) VALUES (?, ?)', [membership.alliance_id, req.body.targetKingdomId]);
      await db.run('UPDATE kingdoms SET alliance_buffs = ? WHERE id = ?', [alliance.projects || '{}', req.body.targetKingdomId]);
      res.json({ ok: true });
    } catch {
      res.status(409).json({ error: 'Already a member' });
    }
  });

  app.post('/api/alliance/leave', requireAuth, async (req, res) => {
    const kingdom = await db.get('SELECT id FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
    const alliance = await db.get('SELECT * FROM alliances WHERE leader_id = ?', [kingdom.id]);
    if (alliance) {
      await db.run('DELETE FROM alliance_members WHERE alliance_id = ?', [alliance.id]);
      await db.run('DELETE FROM alliances WHERE id = ?', [alliance.id]);
      await db.run('UPDATE kingdoms SET alliance_buffs = \'{}\' WHERE alliance_buffs != \'{}\' AND id NOT IN (SELECT kingdom_id FROM alliance_members)');
    } else {
      await db.run('DELETE FROM alliance_members WHERE kingdom_id = ?', [kingdom.id]);
      await db.run('UPDATE kingdoms SET alliance_buffs = \'{}\' WHERE id = ?', [kingdom.id]);
    }
    res.json({ ok: true });
  });

  app.get('/api/regions', requireAuth, async (req, res) => {
    try {
      const rows = await db.all(`
        SELECT r.*, a.name as owner_name, ca.name as challenger_name
        FROM regions r
        LEFT JOIN alliances a ON r.owner_alliance_id = a.id
        LEFT JOIN alliances ca ON r.contest_alliance_id = ca.id
      `);
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/world/bounties', requireAuth, async (req, res) => {
    try {
      const rows = await db.all(`
        SELECT b.*, k.name as target_name, p.username as placer_name
        FROM bounties b
        JOIN kingdoms k ON b.target_id = k.id
        JOIN players p ON b.placer_id = p.id
        WHERE b.status = 'active'
        ORDER BY b.amount DESC
      `);
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/world/bounties', requireAuth, async (req, res) => {
    try {
      const { target_id, amount } = req.body;
      if (!target_id || !amount || amount <= 0) return res.status(400).json({ error: 'Invalid target or amount' });

      // Check if player has enough gold
      const k = await db.get('SELECT id, gold FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });
      if (k.gold < amount) return res.status(400).json({ error: 'Not enough gold' });
      if (k.id === target_id) return res.status(400).json({ error: 'Cannot place bounty on yourself' });

      await db.run('UPDATE kingdoms SET gold = gold - ? WHERE id = ?', [amount, k.id]);
      await db.run(
        'INSERT INTO bounties (placer_id, target_id, amount) VALUES (?, ?, ?)',
        [req.player.playerId, target_id, amount]
      );

      res.json({ ok: true, message: 'Bounty placed!' });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/messages', requireAuth, async (req, res) => {
    try {
      // Get unique conversations
      const rows = await db.all(`
        SELECT 
          m.*, 
          p1.username as sender_name, 
          p2.username as recipient_name,
          CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END as other_id,
          CASE WHEN m.sender_id = ? THEN p2.username ELSE p1.username END as other_name
        FROM messages m
        JOIN players p1 ON m.sender_id = p1.id
        JOIN players p2 ON m.recipient_id = p2.id
        WHERE m.sender_id = ? OR m.recipient_id = ?
        ORDER BY m.created_at DESC
      `, [req.player.playerId, req.player.playerId, req.player.playerId, req.player.playerId]);
      
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/messages', requireAuth, async (req, res) => {
    try {
      const { recipient_id, content } = req.body;
      if (!recipient_id || !content) return res.status(400).json({ error: 'Missing recipient or content' });
      const myId = req.player.playerId;
      if (myId === recipient_id) return res.status(400).json({ error: 'Cannot message yourself' });

      const result = await db.run(
        'INSERT INTO messages (sender_id, recipient_id, content) VALUES (?, ?, ?)',
        [myId, recipient_id, content]
      );

      // Emit real-time notification
      const senderInfo = await db.get('SELECT username FROM players WHERE id = ?', [myId]);
      io.to(`player:${recipient_id}`).emit('message:received', {
        id: result.lastID,
        sender_id: myId,
        sender_name: senderInfo?.username || 'System',
        content,
        created_at: Math.floor(Date.now()/1000)
      });

      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/alliance/:id', requireAuth, async (req, res) => {
    const alliance = await db.get('SELECT * FROM alliances WHERE id = ?', [req.params.id]);
    if (!alliance) return res.status(404).json({ error: 'Not found' });
    const members = await db.all(`
      SELECT k.id, k.name, k.race, k.land, am.pledge
      FROM kingdoms k JOIN alliance_members am ON k.id = am.kingdom_id
      WHERE am.alliance_id = ?`, [req.params.id]);
    res.json({ ...alliance, members });
  });

  app.get('/api/chat/:room', requireAuth, async (req, res) => {
    const msgs = await db.all(`
      SELECT cm.id, cm.message, cm.created_at, cm.username,
             p.is_chat_mod, p.is_admin, p.chat_color, p.chat_name, k.race
      FROM chat_messages cm
      JOIN players p ON cm.player_id = p.id
      JOIN kingdoms k ON cm.kingdom_id = k.id
      WHERE cm.room = ? AND cm.deleted = 0
      ORDER BY cm.created_at DESC LIMIT 80`, [req.params.room]);
    res.json(msgs.reverse());
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true, uptime: Math.floor(process.uptime()) }));
  
  app.post('/api/log-error', (req, res) => {
    const logMsg = `[browser-error] ${new Date().toISOString()} MESSAGE: ${req.body.message || "none"}\nSOURCE: ${req.body.source || "none"}\nLINE: ${req.body.line || "none"}\nCOL: ${req.body.col || "none"}\nSTACK: ${req.body.stack || "none"}\n\n`;
    console.error(logMsg);
    try {
      fs.appendFileSync(path.join(__dirname, 'public', 'browser_logs.txt'), logMsg);
    } catch (e) {
      console.error("[error-logging-failing]", e);
    }
    res.json({ ok: true });
  });

  app.get(['/admin', '/admin.html'], (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  });
  
  // Vite as middleware should be checked BEFORE static serving but AFTER API routes
  if (vite) {
    app.use(vite.middlewares);
    console.log('[vite] Vite middleware active');
  }

  // Platform health check
  app.get('/health', (req, res) => {
    if (bootError) return res.status(200).json({ status: 'error', error: String(bootError), database_offline: true });
    if (!isBooted) return res.status(503).json({ status: 'booting' });
    res.json({ status: 'ok', uptime: Math.floor(process.uptime()) });
  });

  // Admin: seed or reset AI kingdoms
  app.post('/api/admin/seed-ai', async (req, res) => {
    try {
      const seeded = await seedAiKingdoms(db);
      res.json({ ok: true, seeded, message: seeded > 0 ? `Seeded ${seeded} AI kingdoms` : 'All AI kingdoms already exist' });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/admin/reset-ai', async (req, res) => {
    try {
      const aiPlayers = await db.all('SELECT id FROM players WHERE is_ai = 1');
      for (const p of aiPlayers) {
        const k = await db.get('SELECT id FROM kingdoms WHERE player_id = ?', [p.id]);
        if (k) await db.run(`UPDATE kingdoms SET
          gold=10000, mana=0, land=504, population=50000, food=0, morale=100,
          turn=0, turns_stored=400, fighters=0, rangers=50, clerics=0, mages=0,
          thieves=0, ninjas=0, researchers=100, engineers=100, scribes=0,
          war_machines=0, weapons_stockpile=0, armor_stockpile=0,
          bld_farms=200, bld_barracks=1, bld_schools=1, bld_armories=1,
          bld_housing=100, bld_outposts=0, bld_guard_towers=0, bld_vaults=0,
          bld_smithies=0, bld_markets=0, bld_mage_towers=0, bld_training=0,
          bld_castles=0, bld_shrines=0, bld_libraries=0,
          res_economy=100, res_weapons=100, res_armor=100, res_military=100,
          res_attack_magic=100, res_defense_magic=100, res_entertainment=100,
          res_construction=100, res_war_machines=100, res_spellbook=0,
          xp=0, level=1, research_allocation='{}', build_allocation='{}',
          build_queue='{}', scrolls='{}', maps=0, blueprints_stored=0, active_effects='{}'
          WHERE id = ?`, [k.id]);
      }
      res.json({ ok: true, reset: aiPlayers.length });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/setup-admin', async (req, res) => {
    const { secret, username } = req.body;
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) return res.status(500).json({ error: 'ADMIN_SECRET not set on server' });
    if (!secret || secret !== adminSecret) return res.status(403).json({ error: 'Invalid secret' });
    if (!username) return res.status(400).json({ error: 'username required' });
    const player = await db.get('SELECT id, username FROM players WHERE username = ?', [username]);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    await db.run('UPDATE players SET is_admin = 1 WHERE id = ?', [player.id]);
    res.json({ ok: true, message: username + ' is now an admin. Log out and back in to get the admin token.' });
  });

  app.post('/api/suggestions', requireAuth, async (req, res) => {
    try {
      const { message } = req.body;
      if (!message || message.length < 5) return res.status(400).json({ error: 'Suggestion too short' });
      const k = await db.get('SELECT id FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
      await db.run('INSERT INTO suggestions (player_id, kingdom_id, message) VALUES (?, ?, ?)', [req.player.playerId, k ? k.id : null, message]);
      res.json({ ok: true, message: 'Thank you!' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // Catch-all for API 404s to prevent HTML responses for API calls
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.url} not found` });
  });

  const serveIndex = async (req, res, next) => {
    console.log(`[serveIndex] HIT: ${req.method} ${req.url}`);
    if (req.url === '/admin.html') return next();
    if (req.url.includes('.') && !req.url.endsWith('.html')) return next();
    try {
      const indexPath = path.join(__dirname, 'client', 'index.html');
      let html = fs.readFileSync(indexPath, 'utf-8');
      
if (process.env.NODE_ENV !== 'production' && vite) {
        html = await vite.transformIndexHtml(req.url || '/', html);
      } else {
        const distPath = path.join(__dirname, 'public', 'dist');
        if (fs.existsSync(distPath)) {
          // If Vite produced an index.html in dist, use that instead of the source one
          const distIndexHtml = path.join(distPath, 'index.html');
          if (fs.existsSync(distIndexHtml)) {
             html = fs.readFileSync(distIndexHtml, 'utf-8');
          } else {
            // Fallback: manually inject main.js if index.html isn't in dist
            const files = fs.readdirSync(distPath);
            const mainJs = files.find(f => f.startsWith('main') && f.endsWith('.js'));
            if (mainJs) {
              html = html.replace('</head>', `<script type="module" src="/dist/${mainJs}"></script></head>`);
            }
          }
        }
}

      // Verification log
      if (html.includes('main.js') || html.includes('/assets/main') || html.includes('assets/index.js') || html.includes('/assets/index')) {
          console.log("[vite] Verified JavaScript bundle/script tag found in final HTML response");
      } else {
          console.warn("[vite] WARNING: JavaScript bundle script NOT FOUND in final HTML response!");
      }

      res.set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }).send(html);
    } catch (e) { 
      console.error("[vite] Error in serveIndex:", e);
      next(e); 
    }
  };

  const multer = require('multer');

  // Secure multer configuration with validation
  const upload = multer({
    dest: path.join(__dirname, 'public'),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
    fileFilter: (req, file, cb) => {
      // Only allow video MIME types
      if (!file.mimetype.startsWith('video/')) {
        return cb(new Error('Only video files are allowed'));
      }
      // Whitelist allowed extensions
      const ext = path.extname(file.originalname).toLowerCase();
      const allowedExts = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
      if (!allowedExts.includes(ext)) {
        return cb(new Error('File type not allowed'));
      }
      cb(null, true);
    }
  });

  app.post('/api/upload-bg', authLimiter, upload.single('video'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No video provided' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    const newPath = path.join(__dirname, 'public', 'custom-bg' + ext);
    try {
      fs.renameSync(req.file.path, newPath);
      fs.writeFileSync(path.join(__dirname, 'public', 'bg-config.txt'), '/custom-bg' + ext);
      res.json({ url: '/custom-bg' + ext + '?t=' + Date.now() });
    } catch (e) {
      console.error('[upload] File handling error:', e.message);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  app.get('/api/bg-video', (req, res) => {
    try {
      const bg = fs.readFileSync(path.join(__dirname, 'public', 'bg-config.txt'), 'utf8');
      res.json({ url: bg });
    } catch {
      res.json({ url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4' });
    }
  });

  app.use(['/', '/index.html'], serveIndex);
  app.use(express.static(path.join(__dirname, 'public'), { index: false }));
  app.use(express.static(path.join(__dirname, 'client'), { index: false }));
  app.use('/dist', express.static(path.join(__dirname, 'public', 'dist')));

  if (process.env.NODE_ENV === 'production') {
    app.use('/client', express.static(path.join(__dirname, 'client')));
    app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
  }

  app.get('*', (req, res, next) => {
    if (req.url.includes('.') && !req.url.endsWith('.html')) {
        console.log(`[static] Could not find file: ${req.url}`);
        return next();
    }
    serveIndex(req, res, next);
  });

  setupSockets(io, db);
  engine.io = io;
  global._narmir_io = io;
  console.log('[socket.io] Real-time handlers registered');

  server.listen(PORT, HOST, () => {
    console.log(`[boot] Server listening on http://localhost:${PORT}`);
  });

  isBooted = true;
  console.log('[boot] Startup sequence complete. Server is ready.');
    } catch (err) {
      bootError = err;
      console.error('[boot] FATAL startup error:', err);
    }
  }

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});

module.exports = { refreshLore };
