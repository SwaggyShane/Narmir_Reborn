'use strict';

const { EPOCH_NOW_TEXT } = require('./db-sql');
const { runRegen, updateMarketPrices } = require('../game/regen');

const REGEN_AMOUNT = 7;
const REGEN_MAX = 400;
const REGEN_MS = 25 * 60 * 1000;

// Crash-safe regen catch-up on boot (how many missed windows)
async function applyCrashSafeRegenCatchup(db) {
  try {
    const regenRow = await db.get("SELECT value FROM server_state WHERE key = 'last_regen_at'");
    if (regenRow) {
      const lastRegen = Number(regenRow.value);
      const now = Math.floor(Date.now() / 1000);
      const elapsed = now - lastRegen;
      const windows = Math.floor(elapsed / (REGEN_MS / 1000));
      if (windows > 0) {
        const catchUp = Math.min(windows * REGEN_AMOUNT, REGEN_MAX);
        await db.run(`
          UPDATE kingdoms SET turns_stored = LEAST($1, turns_stored + $2)
        `, [REGEN_MAX, catchUp]);
        await db.run(
          `UPDATE server_state SET value = ${EPOCH_NOW_TEXT} WHERE key = 'last_regen_at'`
        );
        console.log('[turns] Boot catch-up: applied ' + windows + ' missed window(s), +' + catchUp + ' turns');
      }
    }
  } catch (err) {
    console.error('[turns] Error during boot regen catch-up:', err.message);
  }
}

// Ugly one-time hero abilities default patch at boot (kept for backward compat with old rows)
async function patchDefaultHeroAbilities(db) {
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
      if (c[h.class]) await db.run('UPDATE heroes SET abilities = $1 WHERE class = $2', [JSON.stringify(c[h.class]), h.class]);
    }
  } catch (err) {
    console.error('[heroes] Error setting hero abilities:', err.message);
  }
}

// Start the periodic timers (non-blocking)
function startRegenAndMarketSchedulers(db, io) {
  // Schedule ongoing regen with error handling
  setInterval(async () => {
    try {
      await runRegen(db, io);
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
}

// Boot data loads (locations, lore, json repair). Extracted to reduce index bloat.
async function loadBootData(db) {
  // Guard against null db
  if (!db) {
    console.warn('[boot] Database not available for boot data loading');
    return;
  }

  // Run boot tasks in parallel where safe, to minimize startup time
  // Use allSettled so one failing task doesn't prevent others from running
  const tasks = [
    // Seed and load world locations (dungeons/mountains) at boot
    (async () => {
      try {
        const { seedRegionLocations, loadLocationCache } = require('../game/world-locations');
        const { getWorldSeed } = require('../game/world-seed');
        const worldSeed = String(getWorldSeed());
        await seedRegionLocations(db, worldSeed);
        await loadLocationCache(db);
      } catch (err) {
        console.error('[locations] Failed to seed/load world locations:', err.message);
        throw err; // Re-throw so Promise.allSettled can detect the failure
      }
    })(),

    // Refresh lore independently
    (async () => {
      try {
        const { refreshLore } = require('../game/lore');
        await refreshLore(db);
      } catch (err) {
        console.error('[lore] Failed to refresh lore:', err.message);
        throw err; // Re-throw so Promise.allSettled can detect the failure
      }
    })(),

    // Repair JSON rows independently
    (async () => {
      try {
        const { repairJsonRows } = require('../db/schema');
        await repairJsonRows(db);
      } catch (err) {
        console.error('[db] Error in fixing corrupted JSON rows:', err.message);
        throw err; // Re-throw so Promise.allSettled can detect the failure
      }
    })(),
  ];

  // Run all boot data tasks in parallel, don't fail the entire boot if one task fails
  const results = await Promise.allSettled(tasks);
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    console.warn(`[boot] ${failures.length} boot data task(s) failed, but continuing startup`);
  }
}

async function setupAuditScheduler(db) {
  const AuditScheduler = require('./audit-scheduler');
  const auditScheduler = new AuditScheduler(db);
  await auditScheduler.initialize();
  console.log('[boot] Audit scheduler initialized');

  // Global for admin panel access AND for lib/shutdown.js's single graceful
  // shutdown path to find and shut it down. Do not register SIGTERM/SIGINT here —
  // that used to double-call auditScheduler.shutdown() alongside the shutdown
  // path in index.js (harmless since AuditScheduler.shutdown() is idempotent, but
  // a second, untracked owner of "how do we shut down" all the same). Shutdown
  // has exactly one owner now: lib/shutdown.js's createGracefulShutdown.
  global._audit_scheduler = auditScheduler;
  return auditScheduler;
}

async function setupPostInitBoot(db) {
  // Guard against null db (can happen if boot sequence fails early)
  if (!db) {
    console.warn('[boot] Database not available for post-init setup - continuing with reduced functionality');
    return;
  }

  // Run post-init tasks in parallel where safe, but catch individual errors
  const results = await Promise.allSettled([
    (async () => {
      try {
        const { refreshInMemoryGoals } = require('../routes/admin');
        await refreshInMemoryGoals(db);
      } catch (err) {
        console.error('[boot] Error loading in-memory goals:', err.message);
        throw err; // Re-throw so Promise.allSettled can detect the failure
      }
    })(),
    (async () => {
      try {
        const { initializeConstants } = require('../game/constants-loader');
        await initializeConstants(db);
      } catch (err) {
        console.error('[boot] Error initializing constants:', err.message);
        throw err; // Re-throw so Promise.allSettled can detect the failure
      }
    })(),
  ]);

  // Log summary of what succeeded/failed
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    console.warn(`[boot] ${failures.length} post-init task(s) failed, but boot continuing`);
  }
}

module.exports = {
  REGEN_AMOUNT,
  REGEN_MAX,
  REGEN_MS,
  applyCrashSafeRegenCatchup,
  patchDefaultHeroAbilities,
  startRegenAndMarketSchedulers,
  setupAuditScheduler,
  loadBootData,
  setupPostInitBoot,
};
