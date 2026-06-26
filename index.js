require('dotenv').config();
// Railway binds NODE_ENV to the environment's display name ("Production"), but Express,
// Vite, and our own checks all compare against the lowercase Node convention 'production'.
// Canonicalize here — before the Express app is created or anything reads NODE_ENV — so a
// capitalized value can't silently leave the server running in dev mode (Vite dev server,
// CORS '*', no view caching). Trim whitespace to guard against cloud platform UI quirks.
// Mutating process.env is safe: libraries read it lazily.
if ((process.env.NODE_ENV || '').trim().toLowerCase() === 'production') process.env.NODE_ENV = 'production';
const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const cookieParser = require('cookie-parser');
const path         = require('path');
const fs           = require('fs');
const { marketPriceCache, rankingsCache, bountiesCache } = require('./cache.js');

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

const { initDb, repairJsonRows } = require('./db/schema');
const setupSockets    = require('./game/sockets');
const engine          = require('./game/engine');
const { requireAuth, cacheKingdomId } = require('./routes/middleware');
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
app.set('trust proxy', 1);

const PORT = 3000;
const HOST = '0.0.0.0';

// ── Utility functions ────────────────────────────────────────────────────────

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production' && req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.json());
app.use(cookieParser());

// Content-Security-Policy.
//   - In production we ship a strict-ish CSP: only same-origin scripts, plus
//     'unsafe-inline' because the legacy client/index.html still relies on
//     inline event handlers and inline <script> blocks. Crucially we drop
//     'unsafe-eval' and forbid third-party script origins — neither of which
//     the app needs. Fonts/styles are whitelisted to Google Fonts.
//   - In development we keep the permissive policy so hot-reload, Vite's
//     dev-server hooks, and local tooling don't trip the policy.
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob:",
        "media-src 'self'",
        "connect-src 'self' ws: wss:",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
      ].join("; "),
    );
  } else {
    res.setHeader(
      "Content-Security-Policy",
      "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src * 'unsafe-inline' 'unsafe-eval' ws: wss:;",
    );
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

const isProdEnv = process.env.NODE_ENV === 'production';
const authAttemptLimiter = makeRateLimiter(isProdEnv ? 10 : 60, 60 * 1000); // login/register only
const turnLimiter   = makeRateLimiter(300, 60 * 1000);     // 300 turn/action requests/min (5/sec)
const generalLimiter= makeRateLimiter(500, 60 * 1000);     // 500 general requests/min

function isAuthSensitiveRoute(req) {
  if (req.method !== 'POST') return false;
  const path = String(req.path || req.url || '').split('?')[0];
  return path.endsWith('/login') || path.endsWith('/register');
}

function authSensitiveLimiter(req, res, next) {
  if (!isAuthSensitiveRoute(req)) return next();
  return authAttemptLimiter(req, res, next);
}

// ── BOOTSTRAP ────────────────────────────────────────────────────────────────
let vite;
async function setupVite(httpServer) {
  if (process.env.NODE_ENV === 'production') return;
  try {
    const { createServer } = require('vite');
    vite = await createServer({
      configFile: path.join(__dirname, 'vite.config.js'),
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: 'custom',
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
const _BCRYPT_SALT_ROUNDS = 10;



// Fires at most one seasonal event per kingdom per day, drawn from the `events` table.
// Applies the event's effect (happiness/gold/food/population, or a timed multiplier stored
// in active_event) and records it in event_log. Returns { updates, message } or null when
// no event fires (cooldown not elapsed, or no eligible event for this season/race).
async function fireDailyEvent(db, k, season) {
  const now = Math.floor(Date.now() / 1000);
  if ((now - (k.last_event_at || 0)) < 86400) return null;
  const allEvents = await db.all(
    `SELECT * FROM events WHERE is_active=1 AND (season=? OR season='all') ORDER BY RANDOM() LIMIT 10`,
    [season]
  );
  if (!allEvents.length) return null;
  const eligible = allEvents.filter(e => !e.race_only || e.race_only === k.race);
  if (!eligible.length) return null;
  const ev = eligible[Math.floor(Math.random() * eligible.length)];
  const updates = { last_event_at: now };
  let message = `${config.SEASON_ICONS[season] || ''} ${ev.name}: ${ev.description}`;
  // Coerce to numbers defensively — effect_value/effect_duration come from the DB and
  // string values would silently turn arithmetic (e.g. `1 + val`) into concatenation.
  const val = Number(ev.effect_value), dur = Number(ev.effect_duration);
  switch (ev.effect_type) {
    case 'happiness':
      updates.happiness = Math.max(0, Math.min(120, (k.happiness ?? 50) + val));
      message += val > 0 ? ` (+${val} happiness)` : ` (${val} happiness)`; break;
    case 'gold': {
      // |val| < 1 → percentage of current gold; otherwise a flat amount (mirrors the
      // food/population cases so a flat gold event can't multiply the treasury).
      const d = Math.abs(val) < 1 ? Math.floor((k.gold || 0) * Math.abs(val)) * (val > 0 ? 1 : -1) : Math.floor(val);
      updates.gold = Math.max(0, (k.gold || 0) + d);
      message += d > 0 ? ` (+${d.toLocaleString()} gold)` : ` (${d.toLocaleString()} gold)`; break; }
    case 'food': {
      const fd = Math.abs(val) < 1 ? Math.floor((k.food || 0) * Math.abs(val)) * (val > 0 ? 1 : -1) : Math.floor(val);
      updates.food = Math.max(0, (k.food || 0) + fd);
      message += fd > 0 ? ` (+${fd.toLocaleString()} food)` : ` (${fd.toLocaleString()} food)`; break; }
    case 'population': {
      const pd = Math.abs(val) < 1 ? Math.floor((k.population || 0) * Math.abs(val)) * (val > 0 ? 1 : -1) : Math.floor(val);
      updates.population = Math.max(1000, (k.population || 0) + pd);
      message += pd > 0 ? ` (+${pd.toLocaleString()} pop)` : ` (${pd.toLocaleString()} pop)`; break; }
    case 'farm_yield': case 'military': case 'mana': case 'market': {
      const active = safeJsonParse(k.active_event, {});
      active[ev.effect_type] = { mult: 1 + val, turns_remaining: dur };
      updates.active_event = JSON.stringify(active);
      message += val > 0 ? ` (+${Math.round(val * 100)}% for ${dur} turns)` : ` (${Math.round(val * 100)}% for ${dur} turns)`; break; }
  }
  // Return event_log data for batch insertion in runRegen instead of writing individually
  return { updates, message, eventLogData: [k.id, k.name, ev.key, ev.name, season, now] };
}

async function runRegen(db) {
  // Update season first
  const season_row = await db.get("SELECT value FROM server_state WHERE key='current_season'");
  const started_row = await db.get("SELECT value FROM server_state WHERE key='season_started_at'");
  let season = season_row?.value || 'spring';
  const startedAt = parseInt(started_row?.value) || Math.floor(Date.now()/1000);
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
  const kingdoms = await db.all('SELECT id, name, race, happiness, gold, food, population, last_event_at, turn, active_event FROM kingdoms WHERE turn > 0');
  const newsInserts = [];
  const kingdomIds = [];
  const kingdomUpdates = [];
  const eventLogInserts = [];

  for (const k of kingdoms) {
    const result = await fireDailyEvent(db, k, season);
    if (result) {
      kingdomIds.push(k.id);
      kingdomUpdates.push(result.updates);
      newsInserts.push([k.id, 'system', result.message, k.turn]);
      if (result.eventLogData) {
        eventLogInserts.push(result.eventLogData);
      }
    }
  }

  // Batch update all kingdoms in single query using CASE statements per column
  if (kingdomIds.length > 0) {
    const updatesByColumn = {};
    const allKingdomIds = new Set();
    const columns = ['last_event_at','active_event','gold','food','happiness','population'];

    for (let i = 0; i < kingdomIds.length; i++) {
      const k = kingdomIds[i];
      const updates = kingdomUpdates[i];
      allKingdomIds.add(k);

      for (const col of columns) {
        if (updates[col] !== undefined) {
          if (!updatesByColumn[col]) updatesByColumn[col] = { ids: [], values: [] };
          updatesByColumn[col].ids.push(k);
          updatesByColumn[col].values.push(updates[col]);
        }
      }
    }

    if (Object.keys(updatesByColumn).length > 0) {
      const setClauses = [];
      const allValues = [];
      let paramIndex = 1;

      for (const col of columns) {
        if (!updatesByColumn[col]) continue;
        const { ids, values } = updatesByColumn[col];
        const caseWhens = ids.map((_, i) => `WHEN $${paramIndex + i} THEN $${paramIndex + ids.length + i}`).join(' ');
        // ELSE keeps the current value: fireDailyEvent sets a variable column set per
        // kingdom, so a kingdom can be in the WHERE id IN (...) union but absent from
        // this column's WHEN list. Without ELSE the CASE returns NULL and nulls the column.
        setClauses.push(`${col} = CASE id ${caseWhens} ELSE ${col} END`);
        allValues.push(...ids, ...values);
        paramIndex += ids.length * 2;
      }

      const kingdomIdList = Array.from(allKingdomIds);
      const idPlaceholders = kingdomIdList.map((_, i) => `$${paramIndex + i}`).join(',');

      await db.run(
        `UPDATE kingdoms SET ${setClauses.join(', ')} WHERE id IN (${idPlaceholders})`,
        [...allValues, ...kingdomIdList]
      );
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

  // Batch insert all event logs in single query (instead of individual inserts in fireDailyEvent)
  if (eventLogInserts.length > 0) {
    const placeholders = eventLogInserts.map((_, i) => `($${i*6+1},$${i*6+2},$${i*6+3},$${i*6+4},$${i*6+5},$${i*6+6})`).join(',');
    const values = eventLogInserts.flat();
    await db.run(
      `INSERT INTO event_log (kingdom_id, kingdom_name, event_key, event_name, season, fired_at) VALUES ${placeholders}`,
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

    // Clean news logs
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
  console.log('[turns] Regen complete — +' + REGEN_AMOUNT + ' turns | season: ' + season);
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
    marketPriceCache.delete("all_prices");
    marketPriceCache.delete("ai_prices");
    console.log('[market] Prices fluctuated');
  } catch (e) {
    console.error('[market] Fluctuation failed:', e.message);
  }
}

async function refreshLore(db) {
  const loreRows = await db.all("SELECT id, key_id, title, content, category FROM lore_entries");
  const loadedLore = {};
  const defaultRaces = ['high_elf', 'dwarf', 'dire_wolf', 'human', 'dark_elf', 'orc', 'vampire', 'narmir', 'general'];
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
      await setupVite(server);
    }
    
    let db = null;
    try {
      db = await initDb();
      
      await refreshLore(db);
      console.log('[lore] Lore and Random events refreshed');

      // Normalize structured JSON columns so startup can heal bad rows
      try {
        const repairResult = await repairJsonRows(db);
        if (repairResult.fixedCells > 0) {
          console.log(`[db] Fixed ${repairResult.fixedCells} JSON cells across ${repairResult.fixedRows} rows.`);
        }
      } catch (err) {
        console.error('[db] Error in fixing corrupted JSON rows:', err.message);
      }

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
    const { ensureCsrfToken, cleanupOrphanedTransactions } = require('./routes/middleware');
    app.use('/api/auth',         authSensitiveLimiter, require('./routes/auth')(db));
    app.use('/api/forum',        ensureCsrfToken, require('./routes/forum')(db));
    app.use('/api/kingdom',      turnLimiter, cacheKingdomId(db), ensureCsrfToken, cleanupOrphanedTransactions(db), require('./routes/kingdom')(db));
    app.use('/api/hero',         turnLimiter, cacheKingdomId(db), ensureCsrfToken,  require('./routes/hero')(db));
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
      } catch {
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
        console.error('[regions] Database error:', e);
        res.status(500).json({ error: 'Failed to load regions' });
      }
    });

    app.get('/api/world/bounties', requireAuth, async (req, res) => {
      try {
        const cacheKey = "bounties:active";
        if (bountiesCache.has(cacheKey)) {
          return res.json(bountiesCache.get(cacheKey));
        }

        const rows = await db.all(`
          SELECT b.*, k.name as target_name, p.username as placer_name
          FROM bounties b
          JOIN kingdoms k ON b.target_id = k.id
          JOIN players p ON b.placer_id = p.id
          WHERE b.status = 'active'
          ORDER BY b.amount DESC
        `);
        bountiesCache.set(cacheKey, rows, 30 * 1000); // 30 sec TTL
        res.json(rows);
      } catch (e) {
        console.error('[bounties-list] Database error:', e);
        res.status(500).json({ error: 'Failed to load bounties' });
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
          bountiesCache.delete("bounties:active"); // Invalidate cache
          res.json({ ok: true, message: 'Bounty placed!' });
        } catch (txErr) {
          await db.run('ROLLBACK').catch(() => {});
          throw txErr;
        }
      } catch (e) {
        console.error('[bounties-place] Database error:', e);
        res.status(500).json({ error: 'Failed to place bounty' });
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
        console.error('[messages-list] Database error:', e);
        res.status(500).json({ error: 'Failed to load messages' });
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
        console.error('[messages-send] Database error:', e);
        res.status(500).json({ error: 'Failed to send message' });
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

    // Public status bar info — version, node ID, uptime since server boot
    const os = require('os');
    const pkg = require('./package.json');
    app.get('/api/status', (_req, res) => {
      const totalSec = Math.floor(process.uptime());
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      const uptime = `${days}D ${String(hours).padStart(2, '0')}H ${String(mins).padStart(2, '0')}M ${String(secs).padStart(2, '0')}S`;
      res.json({
        version: `alpha ${pkg.version}`,
        nodeId: os.hostname().toUpperCase().slice(0, 12),
        uptime,
      });
    });

    // Public rankings — no auth required, used by the portal page
    app.get('/api/public/rankings', async (req, res) => {
      try {
        const cacheKey = "rankings:top20";
        if (rankingsCache.has(cacheKey)) {
          return res.json({ rankings: rankingsCache.get(cacheKey) });
        }

        const rows = await db.all(`
          SELECT k.id, k.name, k.race, k.land, k.level, k.population, p.username
          FROM kingdoms k
          JOIN players p ON k.player_id = p.id
          ORDER BY k.land DESC, k.level DESC, k.population DESC, k.id ASC
          LIMIT 20
        `);
        rankingsCache.set(cacheKey, rows, 30 * 1000); // 30 sec TTL
        res.json({ rankings: rows });
      } catch (e) {
        console.error('[rankings] Database error:', e);
        res.status(500).json({ error: 'Failed to load rankings' });
      }
    });
  
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
      const wipeAdminPath = path.join(__dirname, 'public', 'wipe-admin.html');
      res.sendFile(wipeAdminPath);
    });

    // /admin is now served by the React admin shell (see serveAdmin below).
    // ?legacy=1 falls back to public/admin.html for the duration of the migration.
  
    // Platform health check
    app.get('/health', (req, res) => {
      if (bootError) return res.status(200).json({ status: 'error', error: String(bootError), database_offline: true });
      if (!isBooted) return res.status(503).json({ status: 'booting' });
      res.json({ status: 'ok', uptime: Math.floor(process.uptime()) });
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
        res.status(500).json({ error: 'Failed to wipe database' });
      }
    });

    app.post('/api/suggestions', requireAuth, async (req, res) => {
      try {
        const { message } = req.body;
        if (!message || message.length < 5) return res.status(400).json({ error: 'Suggestion too short' });
        const k = await db.get('SELECT id FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
        await db.run('INSERT INTO suggestions (player_id, kingdom_id, message) VALUES (?, ?, ?)', [req.player.playerId, k ? k.id : null, message]);
        res.json({ ok: true, message: 'Thank you!' });
      } catch (e) { console.error('[suggestions] Database error:', e); res.status(500).json({ error: 'Failed to save suggestion' }); }
    });

    const { postBugReportToDiscord } = require('./lib/discord-notify');
    const BUG_CATEGORIES = new Set(['bug', 'ui', 'gameplay', 'performance', 'other']);

    app.post('/api/bug-reports', requireAuth, async (req, res) => {
      try {
        const rawMessage = String(req.body?.message ?? '').trim();
        const category = BUG_CATEGORIES.has(req.body?.category) ? req.body.category : 'bug';
        const contextPanel = String(req.body?.contextPanel ?? '').trim().slice(0, 64) || null;
        const pageUrl = String(req.body?.pageUrl ?? '').trim().slice(0, 512) || null;
        const userAgent = String(req.body?.userAgent ?? '').trim().slice(0, 512) || null;

        if (rawMessage.length < 10) return res.status(400).json({ error: 'Please describe the issue in at least 10 characters.' });
        if (rawMessage.length > 2000) return res.status(400).json({ error: 'Report is too long (max 2000 characters).' });

        const playerId = req.player.playerId;
        const recent = await db.get(
          `SELECT id, created_at FROM bug_reports WHERE player_id = ? ORDER BY id DESC LIMIT 1`,
          [playerId],
        );
        if (recent?.created_at) {
          const ageMs = Date.now() - new Date(recent.created_at).getTime();
          if (Number.isFinite(ageMs) && ageMs < 60_000) {
            return res.status(429).json({ error: 'Please wait a minute before sending another report.' });
          }
        }

        const kingdom = await db.get(
          'SELECT k.id, k.name FROM kingdoms k WHERE k.player_id = ?',
          [playerId],
        );
        const username = req.player.username || 'Unknown';

        const insert = await db.run(
          `INSERT INTO bug_reports (player_id, kingdom_id, username, kingdom_name, category, message, context_panel, page_url, user_agent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            playerId,
            kingdom?.id ?? null,
            username,
            kingdom?.name ?? null,
            category,
            rawMessage,
            contextPanel,
            pageUrl,
            userAgent,
          ],
        );

        const reportId = insert?.lastID ?? insert?.lastId ?? null;
        const discordSent = await postBugReportToDiscord({
          reportId,
          username,
          kingdomName: kingdom?.name,
          category,
          message: rawMessage,
          contextPanel,
          pageUrl,
        });

        if (discordSent && reportId) {
          await db.run('UPDATE bug_reports SET discord_sent = 1 WHERE id = ?', [reportId]);
        }

        res.json({
          ok: true,
          message: discordSent
            ? 'Report sent — thank you! The team was notified on Discord.'
            : 'Report saved — thank you! The team will review it in admin.',
        });
      } catch (e) {
        console.error('[bug-reports] Error:', e);
        res.status(500).json({ error: 'Failed to save bug report' });
      }
    });

    // Test Results - Collaborative Testing
    app.post('/api/test-result', requireAuth, async (req, res) => {
      try {
        const { testKey, testGroup, testName, passed, comment } = req.body;
        if (!testKey || testGroup === undefined || testName === undefined) {
          return res.status(400).json({ error: 'Missing test info' });
        }
        const player = req.player;
        await db.run(
          'INSERT INTO test_results (player_id, player_name, test_key, test_group, test_name, passed, comment) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [player.playerId, player.username, testKey, testGroup, testName, passed !== undefined ? (passed ? 1 : 0) : null, comment || null]
        );
        // Broadcast to all connected clients
        if (io) {
          io.emit('test-result-update', { player: player.username, testKey, testGroup, testName, passed, comment, timestamp: Date.now() });
        }
        res.json({ ok: true });
      } catch (e) { console.error('[test-result] Database error:', e); res.status(500).json({ error: 'Failed to save test result' }); }
    });

    app.get('/api/test-results', requireAuth, async (req, res) => {
      try {
        const results = await db.all(`
          SELECT player_id, player_name, test_key, test_group, test_name, passed, comment, submitted_at
          FROM test_results
          ORDER BY submitted_at DESC
          LIMIT 1000
        `);
        res.json(results);
      } catch (e) { console.error('[test-results] Database error:', e); res.status(500).json({ error: 'Failed to fetch results' }); }
    });

    app.get('/api/test-results/summary', requireAuth, async (req, res) => {
      try {
        const summary = await db.all(`
          SELECT
            test_key,
            test_group,
            test_name,
            COUNT(*) as total_results,
            SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passed_count,
            SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) as failed_count,
            SUM(CASE WHEN passed IS NULL THEN 1 ELSE 0 END) as pending_count,
            COUNT(DISTINCT player_id) as unique_testers
          FROM test_results
          GROUP BY test_key, test_group, test_name
          ORDER BY test_group, test_name
        `);
        res.json(summary);
      } catch (e) { console.error('[test-summary] Database error:', e); res.status(500).json({ error: 'Failed to fetch summary' }); }
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
          html = await vite.transformIndexHtml('/game', html);
        } else {
           const distPath = path.join(__dirname, 'dist');
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

  const serveSplash = async (req, res, next) => {
    console.log(`[serveSplash] HIT: ${req.method} ${req.url}`);
    const NO_CACHE = {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    try {
      // Dev: transform via Vite middleware
      if (process.env.NODE_ENV !== 'production' && vite) {
        const splashPath = path.join(__dirname, 'client', 'splash.html');
        let html = fs.readFileSync(splashPath, 'utf-8');
        html = await vite.transformIndexHtml('/splash.html', html);
        return res.set(NO_CACHE).send(html);
      }

      const distPath = path.join(__dirname, 'dist');

      // Primary: serve pre-built splash.html from dist
      const distSplash = path.join(distPath, 'splash.html');
      if (fs.existsSync(distSplash)) {
        console.log('[serveSplash] Serving from dist/splash.html');
        return res.set(NO_CACHE).send(fs.readFileSync(distSplash, 'utf-8'));
      }

      // Fallback: inject splash bundle into source HTML (mirrors serveIndex pattern)
      console.warn('[serveSplash] dist/splash.html not found, attempting bundle injection');
      const assetPath = path.join(distPath, 'assets');
      if (fs.existsSync(assetPath)) {
        const assets = fs.readdirSync(assetPath);
        const splashJs  = assets.find(f => f.startsWith('splash') && f.endsWith('.js'));
        const splashCss = assets.find(f => f.startsWith('splash-') && f.endsWith('.css'));
        if (splashJs) {
          let html = fs.readFileSync(path.join(__dirname, 'client', 'splash.html'), 'utf-8');
          html = html.replace(/<script type="module" src="\/src\/splash-main\.jsx"><\/script>/, '');
          let inject = `<script type="module" crossorigin src="/dist/assets/${splashJs}"></script>`;
          if (splashCss) inject += `\n    <link rel="stylesheet" crossorigin href="/dist/assets/${splashCss}">`;
          html = html.replace('</head>', `    ${inject}\n  </head>`);
          console.log(`[serveSplash] Injection fallback: ${splashJs}`);
          return res.set(NO_CACHE).send(html);
        }
      }

      console.error('[serveSplash] No splash assets found in dist — serving source splash.html');
      let html = fs.readFileSync(path.join(__dirname, 'client', 'splash.html'), 'utf-8');
      return res.set(NO_CACHE).status(503).send(html);
    } catch (e) {
      console.error('[serveSplash] Error:', e);
      next(e);
    }
  };

  const servePortal = async (req, res, next) => {
    console.log(`[servePortal] HIT: ${req.method} ${req.url}`);
    const NO_CACHE = {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    const fsp = fs.promises;
    try {
      if (process.env.NODE_ENV !== 'production' && vite) {
        const portalPath = path.join(__dirname, 'client', 'portal.html');
        let html = await fsp.readFile(portalPath, 'utf-8');
        html = await vite.transformIndexHtml('/portal.html', html);
        return res.set(NO_CACHE).send(html);
      }
      const distPath = path.join(__dirname, 'dist');
      // Primary: serve pre-built portal.html from dist
      try {
        const html = await fsp.readFile(path.join(distPath, 'portal.html'), 'utf-8');
        return res.set(NO_CACHE).send(html);
      } catch { /* not found, try injection fallback */ }
      // Injection fallback
      try {
        const assets = await fsp.readdir(path.join(distPath, 'assets'));
        const portalJs  = assets.find(f => f.startsWith('portal') && f.endsWith('.js'));
        const portalCss = assets.find(f => f.startsWith('portal-') && f.endsWith('.css'));
        if (portalJs) {
          let html = await fsp.readFile(path.join(__dirname, 'client', 'portal.html'), 'utf-8');
          html = html.replace(/<script type="module" src="\/src\/portal-main\.jsx"><\/script>/, '');
          let inject = `<script type="module" crossorigin src="/dist/assets/${portalJs}"></script>`;
          if (portalCss) inject += `\n    <link rel="stylesheet" crossorigin href="/dist/assets/${portalCss}">`;
          html = html.replace('</head>', `    ${inject}\n  </head>`);
          return res.set(NO_CACHE).send(html);
        }
      } catch { /* assets dir missing, fall through */ }
      console.error('[servePortal] No portal assets found in dist — falling back to serveIndex');
      return serveIndex(req, res, next);
    } catch (e) {
      console.error('[servePortal] Error:', e);
      next(e);
    }
  };


  const serveAdmin = async (req, res, next) => {
    if (req.query.legacy === '1') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    }
    console.log(`[serveAdmin] HIT: ${req.method} ${req.url}`);
    const NO_CACHE = {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    const fsp = fs.promises;
    try {
      if (process.env.NODE_ENV !== 'production' && vite) {
        const adminHtmlPath = path.join(__dirname, 'client', 'admin.html');
        let html = await fsp.readFile(adminHtmlPath, 'utf-8');
        html = await vite.transformIndexHtml('/admin.html', html);
        return res.set(NO_CACHE).send(html);
      }
      const distPath = path.join(__dirname, 'dist');
      try {
        const html = await fsp.readFile(path.join(distPath, 'admin.html'), 'utf-8');
        return res.set(NO_CACHE).send(html);
      } catch { /* not found, try injection fallback */ }
      try {
        const assets = await fsp.readdir(path.join(distPath, 'assets'));
        const adminJs  = assets.find(f => f === 'admin.js');
        const adminCss = assets.find(f => f.startsWith('admin-') && f.endsWith('.css'));
        if (adminJs) {
          let html = await fsp.readFile(path.join(__dirname, 'client', 'admin.html'), 'utf-8');
          html = html.replace(/<script type="module" src="\/src\/admin-main\.jsx"><\/script>/, '');
          let inject = `<script type="module" crossorigin src="/dist/assets/${adminJs}"></script>`;
          if (adminCss) inject += `\n    <link rel="stylesheet" crossorigin href="/dist/assets/${adminCss}">`;
          html = html.replace('</head>', `    ${inject}\n  </head>`);
          return res.set(NO_CACHE).send(html);
        }
      } catch { /* assets dir missing */ }
      console.error('[serveAdmin] No admin assets found in dist — falling back to legacy admin');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    } catch (e) {
      console.error('[serveAdmin] Error:', e);
      next(e);
    }
  };

  // HTML entry points MUST register before Vite middleware — otherwise Vite serves
  // client/index.html for /index.html and the splash intro disappears.
  app.get(['/', '/index.html'], serveSplash);
  app.get(['/game', '/game.html'], serveIndex);
  app.get(['/portal', '/portal.html'], servePortal);
  app.get(['/admin', '/admin.html'], serveAdmin);

  if (vite) {
    app.use(vite.middlewares);
    console.log('[vite] Vite middleware active');
  }

  app.use(express.static(path.join(__dirname, 'public'), { index: false }));
  app.use(express.static(path.join(__dirname, 'client'), { index: false }));
  app.use('/dist', express.static(path.join(__dirname, 'dist')));

  if (process.env.NODE_ENV === 'production') {
    app.use('/client', express.static(path.join(__dirname, 'client')));
    app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
  }

  app.get('*', (req, res, next) => {
    if (req.url.includes('.') && !req.url.endsWith('.html')) {
        console.log(`[static] Could not find file: ${req.url}`);
        return next();
    }
    serveSplash(req, res, next);
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

  // Global error handlers to prevent silent crashes
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
  });

  // Postgres connection-termination errors (e.g. idle-in-transaction timeout, admin
  // shutdown, connection reset during a deploy) can surface asynchronously on a pg
  // client/stream with no awaiting promise to catch them. These are recoverable: the
  // pool simply opens a fresh connection on the next query. Exiting the whole process
  // on one of them would crash-loop the server during normal operation. We log and
  // continue for this known class, and only hard-exit on genuinely unexpected errors
  // that may have left the app in an undefined state.
  const RECOVERABLE_PG_CODES = new Set([
    '25P03', // idle_in_transaction_session_timeout
    '57P01', // admin_shutdown / terminating connection due to administrator command
    '57P02', // crash_shutdown
    '57P03', // cannot_connect_now
    '08006', // connection_failure
    '08003', // connection_does_not_exist
    '08000', // connection_exception
  ]);
  // Transient OS-level socket errors that also surface during DB restarts / redeploys /
  // network blips — recoverable for the same reason (the pool reconnects on next query).
  const RECOVERABLE_SYSTEM_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT']);
  const isRecoverablePgError = (error) =>
    !!error && (RECOVERABLE_PG_CODES.has(error.code) || RECOVERABLE_SYSTEM_CODES.has(error.code));

  process.on('uncaughtException', (error) => {
    if (isRecoverablePgError(error)) {
      console.error(`[db] Recovered from PG connection error (${error.code}): ${error.message} — pool will reconnect, not exiting.`);
      return;
    }
    console.error('[CRITICAL] Uncaught Exception:', error);
    // Cannot safely recover - application is in undefined state. Exit for process manager to restart.
    process.exit(1);
  });

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
