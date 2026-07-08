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
  // Seed and load world locations (dungeons/mountains) at boot
  try {
    const { seedRegionLocations, loadLocationCache } = require('../game/world-locations');
    const { getWorldSeed } = require('../game/world-seed');
    const worldSeed = String(getWorldSeed());
    await seedRegionLocations(db, worldSeed);
    await loadLocationCache(db);
    console.log('[locations] World locations seeded and loaded');
  } catch (err) {
    console.error('[locations] Failed to seed/load world locations:', err.message);
  }

  const { refreshLore } = require('../game/lore');
  await refreshLore(db);
  console.log('[lore] Lore and Random events refreshed');

  // Normalize structured JSON columns so startup can heal bad rows
  try {
    const { repairJsonRows } = require('../db/schema');
    const repairResult = await repairJsonRows(db);
    if (repairResult.fixedCells > 0) {
      console.log(`[db] Fixed ${repairResult.fixedCells} JSON cells across ${repairResult.fixedRows} rows.`);
    }
  } catch (err) {
    console.error('[db] Error in fixing corrupted JSON rows:', err.message);
  }
}

async function setupAuditScheduler(db) {
  const AuditScheduler = require('./audit-scheduler');
  const auditScheduler = new AuditScheduler(db);
  await auditScheduler.initialize();
  console.log('[boot] Audit scheduler initialized');

  // Global for admin panel / external access to scheduler shutdown.
  global._audit_scheduler = auditScheduler;
  const shutdownAuditScheduler = () => {
    try {
      auditScheduler.shutdown();
    } catch (err) {
      console.error('[audit-scheduler] Error during shutdown:', err);
    }
  };
  process.on('SIGTERM', shutdownAuditScheduler);
  process.on('SIGINT', shutdownAuditScheduler);
  return auditScheduler;
}

async function setupPostInitBoot(db) {
  const { refreshInMemoryGoals } = require('../routes/admin');
  await refreshInMemoryGoals(db);
  console.log('[boot] In-memory goals loaded from database');

  const { initializeConstants } = require('../game/constants-loader');
  await initializeConstants(db);
  console.log('[boot] Game constants loaded from database');
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
