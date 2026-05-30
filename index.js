require('dotenv').config();
const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const cookieParser = require('cookie-parser');
const bcrypt       = require('bcrypt');
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
  // eslint-disable-next-line no-unused-vars
} catch(_e) {}

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = function(...args) {
  originalLog.apply(console, args);
  try {
    fs.appendFileSync(logFilePath, `[LOG] [${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`);
    // eslint-disable-next-line no-unused-vars
  } catch (_e) {}
};
console.error = function(...args) {
  originalError.apply(console, args);
  try {
    // Sanitize errors: log only message/code, not full stack traces (prevent data leaks)
    const sanitized = args.map(a => {
      if (a instanceof Error) {
        return `${a.name}: ${a.message}`;
      } else if (a !== null && typeof a === 'object') {
        // Don't log full objects that might contain sensitive data
        return a.code || a.message || '[Object]';
      }
      return String(a);
    }).join(' ');
    fs.appendFileSync(logFilePath, `[ERROR] [${new Date().toISOString()}] ${sanitized}\n`);
    // eslint-disable-next-line no-unused-vars
  } catch (_e) {}
};
console.warn = function(...args) {
  originalWarn.apply(console, args);
  try {
    fs.appendFileSync(logFilePath, `[WARN] [${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`);
    // eslint-disable-next-line no-unused-vars
  } catch (_e) {}
};

// Initial boot state
let isBooted = false;
let bootError = null;

const { initDb, applyKingdomUpdates } = require('./db/schema');
const setupSockets    = require('./game/sockets');
const engine          = require('./game/engine');
const { requireAuth, requireAdmin } = require('./routes/middleware');
const config = require('./game/config');
const { safeJsonParse } = require('./utils/helpers');

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

// ── Authentication constants ────────────────────────────────────────────────────
const BCRYPT_SALT_ROUNDS = 10;

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
    const hash = await bcrypt.hash(Math.random().toString(36), BCRYPT_SALT_ROUNDS);
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

  // Stagger AI kingdoms evenly across the regen window so they don't all
  // hit the DB in one burst. With 25-minute cycles, spreading 10 kingdoms
  // 2 minutes apart means one AI processes every ~2 min instead of all at once.
  const staggerMs = aiPlayers.length > 1
    ? Math.floor((REGEN_MS * 0.8) / aiPlayers.length)
    : 0;

  for (let i = 0; i < aiPlayers.length; i++) {
    const p = aiPlayers[i];
    if (i > 0 && staggerMs > 0) {
      await new Promise(resolve => setTimeout(resolve, staggerMs));
    }
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
  console.log(`[ai] Processed ${aiPlayers.length} AI kingdoms (stagger: ${staggerMs}ms each)`);
}

async function runAiKingdom(db, engine, playerId) {
  let ai = await db.get('SELECT * FROM kingdoms WHERE player_id = ?', [playerId]);
  if (!ai || ai.turns_stored < 1) return;
  ai = normalizeKingdom(ai);

  async function applyK(kingdom, updates) {
    await applyKingdomUpdates(kingdom.id, updates);
    return updates; // We return the original object or whatever applyK needs
  }

  // Calculate turns to process per cycle to exhaust max daily allocation
  // Example: 400 max / 57.6 cycles per day ≈ 7 turns per cycle
  const minutesPerDay = 24 * 60;
  const cyclesPerDay = minutesPerDay / (REGEN_MS / (60 * 1000));
  const turnsPerRegenCycle = Math.ceil(REGEN_MAX / cyclesPerDay);
  const turnsToSpend = Math.min(ai.turns_stored, turnsPerRegenCycle);
  const _inDevelopmentPhase = ai.turn < 800;
  const turnsPerCycle = 1; // Process one turn at a time for smoother progression

  try {
    // Pre-fetch region/alliance data outside the loop (doesn't change per turn)
    const regionStatus = await db.get('SELECT owner_alliance_id, bonus_type FROM regions WHERE name = ?', [ai.region]);
    const myAlliance = await db.get('SELECT alliance_id FROM alliance_members WHERE kingdom_id = ?', [ai.id]);
    ai._region_owned_by_my_alliance = (regionStatus && myAlliance && regionStatus.owner_alliance_id === myAlliance.alliance_id);
    ai._region_bonus_type = regionStatus?.bonus_type;

    // Pre-fetch market prices once (doesn't change per turn, only during specific market updates)
    const priceRows = await db.all(`SELECT id, current_price FROM market_prices`);
    const priceMap = {};
    priceRows.forEach(p => { priceMap[p.id] = p.current_price; });

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

    // ── Resource Development & Trading (every turn) ──
    // Run on alternating turns: development on odd, market on even
    if (ai.turn % 2 === 1) {
      await aiDevelopment(db, engine, ai, playerId);
    } else {
      await aiTradeMarket(ai, priceMap);
    }
    }
  } catch (error) {
    console.error(`[AI] Turn processing failed for player ${playerId}:`, error.message);
  }
}

/**
 * AI Development Phase (Turns 1-∞)
 * Focus on resource development, unit hiring, and infrastructure
 */
async function aiDevelopment(db, engine, ai, _playerId) {
  const gold = ai.gold;
  const spendable = Math.floor(gold * 0.5); // spend up to 50% on infrastructure
  if (spendable < 250) return;

  const updates = {};

  // Build resource production infrastructure
  const farmTarget = Math.floor(ai.land / 3);
  const schoolTarget = 20;
  const marketTarget = 30;
  const grainTarget = 15;

  const buildPriority = [
    { type: 'farms', cost: 1500, count: ai.bld_farms, target: farmTarget },
    { type: 'granaries', cost: 1200, count: ai.bld_granaries, target: grainTarget },
    { type: 'schools', cost: 4000, count: ai.bld_schools, target: schoolTarget },
    { type: 'markets', cost: 3000, count: ai.bld_markets, target: marketTarget },
  ];

  let goldLeft = spendable;
  for (const item of buildPriority) {
    while (item.count < item.target && goldLeft >= item.cost) {
      const newGold = (updates.gold !== undefined ? updates.gold : ai.gold) - item.cost;
      const buildCount = (updates[`bld_${item.type}`] !== undefined ? updates[`bld_${item.type}`] : ai[`bld_${item.type}`] || 0) + 1;

      updates.gold = newGold;
      updates[`bld_${item.type}`] = buildCount;
      ai.gold = newGold;
      ai[`bld_${item.type}`] = buildCount;

      goldLeft -= item.cost;
      item.count += 1;
    }
  }

  // Hire rangers for exploration
  const rangerTarget = Math.floor(ai.land / 200);
  const currentRangers = updates.rangers !== undefined ? updates.rangers : (ai.rangers || 0);
  if (currentRangers < rangerTarget && goldLeft >= 250) {
    const rangerHires = Math.min(
      Math.floor(goldLeft / 250),
      rangerTarget - currentRangers
    );
    if (rangerHires > 0) {
      const newGold = (updates.gold !== undefined ? updates.gold : ai.gold) - (rangerHires * 250);
      updates.rangers = currentRangers + rangerHires;
      updates.gold = newGold;
      ai.rangers = currentRangers + rangerHires;
      ai.gold = newGold;
      goldLeft = newGold;
    }
  }

  // Hire engineers for building and resource development
  const engineerTarget = Math.min(50, Math.floor((ai.bld_farms || 0) / 10) + 10);
  const currentEngineers = updates.engineers !== undefined ? updates.engineers : (ai.engineers || 0);
  if (currentEngineers < engineerTarget && goldLeft >= 250) {
    const goldAvail = updates.gold !== undefined ? updates.gold : ai.gold;
    const engineerHires = Math.min(
      Math.floor(goldAvail / 250),
      engineerTarget - currentEngineers
    );
    if (engineerHires > 0) {
      const newGold = goldAvail - (engineerHires * 250);
      updates.engineers = currentEngineers + engineerHires;
      updates.gold = newGold;
      ai.engineers = currentEngineers + engineerHires;
      ai.gold = newGold;
    }
  }

  // Apply accumulated updates in a single database call
  if (Object.keys(updates).length > 0) {
    await applyKingdomUpdates(ai.id, updates);
  }

  // Build resource upgrades (farms, granaries, markets) with available resources
  try {
    await aiUpgradeResourceBuildings(db, ai);
  } catch (err) {
    console.error(`[AI Upgrades] Error for ${ai.name}:`, err.message);
  }
}

/**
 * AI upgrades resource buildings with wood, stone, iron resources
 */
async function aiUpgradeResourceBuildings(db, ai) {
  let wood = ai.wood || 0;
  let stone = ai.stone || 0;
  let iron = ai.iron || 0;

  const updates = {};
  const upgrades = [];

  // Farm upgrades: prioritize iron_plows (costs 50 iron)
  if (iron >= 50 && ai.bld_farms > 0) {
    const farmUpgrades = safeJsonParse(ai.farm_upgrades, {});
    if (!farmUpgrades.iron_plows) {
      iron -= 50;
      farmUpgrades.iron_plows = true;
      updates.farm_upgrades = JSON.stringify(farmUpgrades);
      upgrades.push('Iron Plows');
    }
  }

  // Granary upgrades: prioritize silos (costs 30 wood)
  if (wood >= 30 && ai.bld_granaries > 0) {
    const granaryUpgrades = safeJsonParse(ai.granary_upgrades, {});
    if (!granaryUpgrades.silos) {
      wood -= 30;
      granaryUpgrades.silos = true;
      updates.granary_upgrades = JSON.stringify(granaryUpgrades);
      upgrades.push('Tall Silos');
    }
  }

  // Market upgrades: prioritize trading_post (costs 10 iron)
  if (iron >= 10 && ai.bld_markets > 0) {
    const marketUpgrades = safeJsonParse(ai.market_upgrades, {});
    if (!marketUpgrades.trading_post) {
      iron -= 10;
      marketUpgrades.trading_post = true;
      updates.market_upgrades = JSON.stringify(marketUpgrades);
      upgrades.push('Trading Post');
    }
  }

  if (upgrades.length > 0) {
    // Update in-memory state to maintain consistency
    updates.iron = iron;
    updates.wood = wood;
    updates.stone = stone;
    ai.iron = iron;
    ai.wood = wood;
    ai.stone = stone;
    if (updates.farm_upgrades) ai.farm_upgrades = updates.farm_upgrades;
    if (updates.granary_upgrades) ai.granary_upgrades = updates.granary_upgrades;
    if (updates.market_upgrades) ai.market_upgrades = updates.market_upgrades;

    await applyKingdomUpdates(ai.id, updates);

    // Generate news event for upgrade completion (uses "Completed:" format for modal parsing)
    const message = `🏗️ Completed: ${upgrades.join(', ')}.`;
    try {
      await db.run('INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)',
        [ai.id, 'system', message, ai.turn]);
    } catch (err) {
      console.error(`[AI Upgrades] Failed to insert news for ${ai.name}:`, err.message);
    }
  }
}

/**
 * AI Market Trading
 * Buy underpriced resources to boost production, sell excess at profit
 */
async function aiTradeMarket(ai, priceMap) {
  try {
    const gold = ai.gold;
    const spendableGold = Math.floor(gold * 0.2); // Use up to 20% of gold for market trading
    if (spendableGold < 500) return;

    const updates = {};
    let goldUsed = 0;

    // Buy underpriced resources to boost production
    const buyTargets = [
      { resource: 'food', ownedKey: 'food', target: 100000 },
      { resource: 'wood', ownedKey: 'wood', target: 50000 },
      { resource: 'stone', ownedKey: 'stone', target: 30000 },
      { resource: 'iron', ownedKey: 'iron', target: 20000 },
    ];

    for (const target of buyTargets) {
      const owned = ai[target.ownedKey] || 0;
      if (owned < target.target && goldUsed < spendableGold) {
        const price = priceMap[target.resource] || 1;
        const budget = spendableGold - goldUsed;
        const canBuy = Math.floor(budget / price);
        if (canBuy > 0) {
          const buyAmount = Math.min(canBuy, Math.floor(target.target * 0.5));
          if (buyAmount > 0) {
            const totalCost = buyAmount * price;
            const newAmount = owned + buyAmount;
            updates[target.ownedKey] = newAmount;
            ai[target.ownedKey] = newAmount;
            goldUsed += totalCost;
          }
        }
      }
    }

    if (goldUsed > 0) {
      const newGold = Math.max(0, gold - goldUsed);
      updates.gold = newGold;
      ai.gold = newGold;
    }

    // Sell excess resources for profit
    const sellTargets = [
      { resource: 'coal', ownedKey: 'coal', keepAmount: 10000 },
      { resource: 'mana', ownedKey: 'mana', keepAmount: 5000 },
      { resource: 'steel', ownedKey: 'steel', keepAmount: 5000 },
    ];

    let goldGained = 0;
    for (const target of sellTargets) {
      const owned = updates[target.ownedKey] !== undefined ? updates[target.ownedKey] : (ai[target.ownedKey] || 0);
      const excess = Math.max(0, owned - target.keepAmount);
      if (excess > 0) {
        const price = priceMap[target.resource] || 1;
        const sellAmount = Math.floor(excess * 0.3); // Sell 30% of excess
        if (sellAmount > 0) {
          const totalGain = sellAmount * price * 0.7; // Apply 70% sell multiplier
          const newAmount = owned - sellAmount;
          updates[target.ownedKey] = newAmount;
          ai[target.ownedKey] = newAmount;
          goldGained += totalGain;
        }
      }
    }

    if (goldGained > 0) {
      const currentGold = updates.gold !== undefined ? updates.gold : ai.gold;
      const newGold = currentGold + Math.floor(goldGained);
      updates.gold = newGold;
      ai.gold = newGold;
    }

    // Apply updates
    if (Object.keys(updates).length > 0) {
      await applyKingdomUpdates(ai.id, updates);
    }
  } catch (error) {
    console.error(`[AI Market Trading] Error for ${ai.name}:`, error.message);
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
  const newsInserts = [];

  for (const k of kingdoms) {
    const result = await fireDailyEvent(db, k, season);
    if (result) {
      for (const [col, val] of Object.entries(result.updates)) {
        if (['last_event_at','active_event','gold','food','morale','population'].includes(col)) {
          await db.run(`UPDATE kingdoms SET ${col}=? WHERE id=?`, [val, k.id]);
        }
      }
      newsInserts.push([k.id, 'system', result.message, k.turn]);
    }
  }

  // Batch insert all news in single query
  if (newsInserts.length > 0) {
    const placeholders = newsInserts.map((_, i) => `($${i*4+1},$${i*4+2},$${i*4+3},$${i*4+4})`).join(',');
    const values = newsInserts.flat();
    await db.run(
      `INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ${placeholders}`,
      values
    );
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
    if (prices.length === 0) return;

    const priceIds = [];
    const newPrices = [];

    for (const p of prices) {
      const drift = (p.base_price - p.current_price) / p.base_price * 0.22;
      const change = 1 + (Math.random() * 0.54 - 0.27) + drift;
      let newPrice = p.current_price * change;
      newPrice = Math.max(p.base_price * 0.15, Math.min(p.base_price * 6.0, newPrice));
      priceIds.push(p.id);
      newPrices.push(newPrice);
    }

    // Batch update all prices in single query
    const placeholders = priceIds.map((_, i) => `$${i + 1}`).join(',');
    await db.run(
      `UPDATE market_prices SET current_price = CASE id ${priceIds.map((_, i) => `WHEN $${i + 1} THEN $${priceIds.length + i + 1}::REAL`).join(' ')} END,
       updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      [...priceIds, ...newPrices]
    );
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
    const { ensureCsrfToken } = require('./routes/middleware');
    app.use('/api/auth',         authLimiter,  require('./routes/auth')(db));
    app.use('/api/kingdom',      ensureCsrfToken, turnLimiter,  require('./routes/kingdom')(db));
    app.use('/api/hero',         ensureCsrfToken, turnLimiter,  require('./routes/hero')(db));
    const adminRouter = require('./routes/admin')(db, io);
    app.use('/api/admin', adminRouter);
    app.use('/api/discord', require('./routes/discord')(db));

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

      await db.run('BEGIN TRANSACTION');
      try {
        // Lock alliance FIRST (before kingdom) to establish consistent locking order and prevent deadlock
        const alliance = await db.get('SELECT id, vault_log FROM alliances WHERE id = ? FOR UPDATE', [membership.alliance_id]);
        if (!alliance) {
          await db.run('ROLLBACK');
          return res.status(404).json({ error: 'Alliance not found or disbanded' });
        }

        // Check balance inside transaction with row locking
        const k = await db.get('SELECT gold FROM kingdoms WHERE id = ? FOR UPDATE', [kingdom.id]);
        if (!k) {
          await db.run('ROLLBACK');
          return res.status(404).json({ error: 'Kingdom not found' });
        }
        if (k.gold < goldAmount) {
          await db.run('ROLLBACK');
          return res.status(400).json({ error: 'Not enough gold' });
        }

        await db.run('UPDATE kingdoms SET gold = gold - ? WHERE id = ?', [goldAmount, kingdom.id]);
        await db.run('UPDATE alliances SET vault_gold = vault_gold + ? WHERE id = ?', [goldAmount, membership.alliance_id]);
        let logs = safeJsonParse(alliance.vault_log || '[]', []);
        logs.unshift({ type: 'deposit', kingdom: kingdom.name, amount: goldAmount, date: new Date().toLocaleString() });
        if(logs.length > 20) logs = logs.slice(0, 20);
        await db.run('UPDATE alliances SET vault_log = ? WHERE id = ?', [JSON.stringify(logs), membership.alliance_id]);
        await db.run('COMMIT');
        res.json({ ok: true, deposited: goldAmount });
      } catch(e) {
        await db.run('ROLLBACK').catch(() => {});
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

      await db.run('BEGIN TRANSACTION');
      try {
        // Re-fetch alliance with row locking and check state inside transaction
        const a = await db.get('SELECT * FROM alliances WHERE id = ? FOR UPDATE', [alliance.id]);

        let projects = safeJsonParse(a.projects, {});
        const currentLevel = projects[project] || 0;
        if (currentLevel >= 10) {
          await db.run('ROLLBACK');
          return res.status(400).json({ error: 'Project is max level' });
        }

        const cost = 50000 * (currentLevel + 1);
        if (a.vault_gold < cost) {
          await db.run('ROLLBACK');
          return res.status(400).json({ error: 'Not enough vault gold' });
        }

        projects[project] = currentLevel + 1;
        await db.run('UPDATE alliances SET vault_gold = vault_gold - ?, projects = ? WHERE id = ?', [cost, JSON.stringify(projects), a.id]);

        let logs = safeJsonParse(a.vault_log, []);
        logs.unshift({ type: 'project', name: project.replace('_', ' '), level: currentLevel + 1, cost: cost, date: new Date().toLocaleString() });
        if(logs.length > 20) logs = logs.slice(0, 20);
        await db.run('UPDATE alliances SET vault_log = ? WHERE id = ?', [JSON.stringify(logs), a.id]);

        // Sync buffs to all members with a single bulk UPDATE query
        await db.run(
          'UPDATE kingdoms SET alliance_buffs = ? WHERE id IN (SELECT kingdom_id FROM alliance_members WHERE alliance_id = ?)',
          [JSON.stringify(projects), a.id]
        );

        await db.run('COMMIT');
        res.json({ ok: true });
      } catch(e) {
        await db.run('ROLLBACK').catch(() => {});
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

      await db.run('BEGIN TRANSACTION');
      try {
        // Lock kingdom to serialize alliance operations and prevent race conditions
        const k = await db.get('SELECT id FROM kingdoms WHERE id = ? FOR UPDATE', [kingdom.id]);
        if (!k) {
          await db.run('ROLLBACK');
          return res.status(404).json({ error: 'Kingdom not found' });
        }

        // Prevent alliance leaders from abandoning their alliance without disbanding it
        const leading = await db.get('SELECT id FROM alliances WHERE leader_id = ?', [kingdom.id]);
        if (leading) {
          await db.run('ROLLBACK');
          return res.status(400).json({ error: 'You cannot create a new alliance while leading an existing one. Disband it first.' });
        }

        // Remove from any existing alliance and create new one atomically
        await db.run('DELETE FROM alliance_members WHERE kingdom_id = ?', [kingdom.id]);
        const result = await db.run('INSERT INTO alliances (name, leader_id) VALUES (?, ?)', [name.trim(), kingdom.id]);
        await db.run('INSERT INTO alliance_members (alliance_id, kingdom_id, pledge) VALUES (?, ?, 3)', [result.lastID, kingdom.id]);
        await db.run('COMMIT');
        res.json({ ok: true, allianceId: result.lastID });
      } catch (err) {
        await db.run('ROLLBACK').catch(() => {});
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

      const targetKingdomId = req.body.targetKingdomId;
      await db.run('BEGIN TRANSACTION');
      try {
        // Lock target kingdom to prevent concurrent alliance membership changes
        const target = await db.get('SELECT id FROM kingdoms WHERE id = ? FOR UPDATE', [targetKingdomId]);
        if (!target) {
          await db.run('ROLLBACK');
          return res.status(404).json({ error: 'Target kingdom not found' });
        }

        const existingMembership = await db.get('SELECT alliance_id FROM alliance_members WHERE kingdom_id = ?', [targetKingdomId]);
        if (existingMembership) {
          await db.run('ROLLBACK');
          return res.status(400).json({ error: 'Target kingdom is already in an alliance' });
        }

        await db.run('INSERT INTO alliance_members (alliance_id, kingdom_id) VALUES (?, ?)', [membership.alliance_id, targetKingdomId]);
        await db.run('UPDATE kingdoms SET alliance_buffs = ? WHERE id = ?', [alliance.projects || '{}', targetKingdomId]);
        await db.run('COMMIT');
        res.json({ ok: true });
      } catch (err) {
        await db.run('ROLLBACK').catch(() => {});
        res.status(409).json({ error: 'Failed to invite kingdom' });
      }
    });

    app.post('/api/alliance/leave', requireAuth, async (req, res) => {
      const kingdom = await db.get('SELECT id FROM kingdoms WHERE player_id = ?', [req.player.playerId]);

      await db.run('BEGIN TRANSACTION');
      try {
        const alliance = await db.get('SELECT * FROM alliances WHERE leader_id = ? FOR UPDATE', [kingdom.id]);
        if (alliance) {
          // Leader leaving: disband entire alliance
          await db.run('UPDATE kingdoms SET alliance_buffs = \'{}\' WHERE id IN (SELECT kingdom_id FROM alliance_members WHERE alliance_id = ?)', [alliance.id]);
          await db.run('DELETE FROM alliance_members WHERE alliance_id = ?', [alliance.id]);
          await db.run('DELETE FROM alliances WHERE id = ?', [alliance.id]);
        } else {
          // Non-leader leaving: remove from alliance
          await db.run('DELETE FROM alliance_members WHERE kingdom_id = ?', [kingdom.id]);
          await db.run('UPDATE kingdoms SET alliance_buffs = \'{}\' WHERE id = ?', [kingdom.id]);
        }
        await db.run('COMMIT');
        res.json({ ok: true });
      } catch (err) {
        await db.run('ROLLBACK').catch(() => {});
        console.error(err);
        res.status(500).json({ error: 'Failed to leave alliance' });
      }
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

        await db.run('BEGIN TRANSACTION');
        try {
          // Check gold and lock inside transaction
          const k = await db.get('SELECT id, gold FROM kingdoms WHERE player_id = ? FOR UPDATE', [req.player.playerId]);
          if (!k) {
            await db.run('ROLLBACK');
            return res.status(404).json({ error: 'Kingdom not found' });
          }
          if (k.gold < amount) {
            await db.run('ROLLBACK');
            return res.status(400).json({ error: 'Not enough gold' });
          }
          if (k.id === target_id) {
            await db.run('ROLLBACK');
            return res.status(400).json({ error: 'Cannot place bounty on yourself' });
          }

          const target = await db.get('SELECT id FROM kingdoms WHERE id = ?', [target_id]);
          if (!target) {
            await db.run('ROLLBACK');
            return res.status(404).json({ error: 'Target kingdom not found' });
          }

          await db.run('UPDATE kingdoms SET gold = gold - ? WHERE id = ?', [amount, k.id]);
          await db.run(
            'INSERT INTO bounties (placer_id, target_id, amount) VALUES (?, ?, ?)',
            [req.player.playerId, target_id, amount]
          );

          await db.run('COMMIT');
          res.json({ ok: true, message: 'Bounty placed!' });
        } catch (txErr) {
          await db.run('ROLLBACK').catch(() => {});
          throw txErr;
        }
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
        LEFT JOIN players p ON cm.player_id = p.id
        LEFT JOIN kingdoms k ON cm.kingdom_id = k.id
        WHERE cm.room = ? AND cm.deleted = 0
        ORDER BY cm.created_at DESC LIMIT 80`, [req.params.room]);
      res.json(msgs.reverse());
    });

    app.get('/api/spell-definitions', (_req, res) => {
      // Return spell definitions and magic schools for admin panel
      res.json({
        SPELL_DEFS: engine.SPELL_DEFS,
        MAGIC_SCHOOLS: engine.MAGIC_SCHOOLS
      });
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

    app.get('/wipe-admin.html', (_req, res) => {
      res.sendFile(path.join(__dirname, 'public/wipe-admin.html'));
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

    app.post('/api/admin/wipe-players', async (req, res) => {
      const { secret } = req.body;
      const adminSecret = process.env.ADMIN_SECRET;
      if (!adminSecret) return res.status(500).json({ error: 'ADMIN_SECRET not set on server' });
      if (!secret || secret !== adminSecret) return res.status(403).json({ error: 'Invalid secret' });

      try {
        // Delete all kingdom-related data
        await db.run('DELETE FROM expeditions');
        await db.run('DELETE FROM news');
        await db.run('DELETE FROM war_log');
        await db.run('DELETE FROM combat_log');
        await db.run('DELETE FROM chat_messages');
        await db.run('DELETE FROM heroes');
        await db.run('DELETE FROM spy_reports');
        await db.run('DELETE FROM trade_routes');
        await db.run('DELETE FROM messages');
        await db.run('DELETE FROM bounties');
        await db.run('DELETE FROM suggestions');
        await db.run('DELETE FROM trade_offers');

        // Delete kingdoms and alliance data
        await db.run('DELETE FROM alliance_members');
        await db.run('DELETE FROM alliances');
        await db.run('DELETE FROM kingdoms');

        // Delete players last
        await db.run('DELETE FROM players');

        res.json({ ok: true, message: 'All players, kingdoms, and related data wiped. Ready for re-registration.' });
      } catch (err) {
        console.error('Wipe error:', err);
        res.status(500).json({ error: err.message });
      }
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

  app.post('/api/upload-bg', requireAdmin, authLimiter, upload.single('video'), (req, res) => {
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

  app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_PART_COUNT' || err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'File size or field limit exceeded' });
    }
    if (err.message && err.message.includes('Only video')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message && err.message.includes('Not allowed')) {
      return res.status(400).json({ error: 'File type not allowed' });
    }
    next(err);
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

  const { refreshInMemoryGoals } = require('./routes/admin');
  await refreshInMemoryGoals(db);
  console.log('[boot] In-memory goals loaded from database');

  const { initializeConstants } = require('./game/constants-loader');
  await initializeConstants(db);
  console.log('[boot] Game constants loaded from database');

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
