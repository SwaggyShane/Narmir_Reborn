const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const config = require("../game/config");
const commandHandler = require("../game/command-handler");
const { initProfiler, runWithProfiler } = require("../game/profiling");
const { requireAuth, requireCsrfToken } = require("./middleware");
const { safeJsonParse, devLog } = require('../utils/helpers');
const { validateTroopAmount } = require('../utils/numeric-validation');
const { getKingdomAttunements } = require('../game/fragment-attunements');
const fragmentBonusManager = require("../game/fragment-bonus-manager");
const attunementManager = require('../game/attunement-manager');
const synergiesModule = require('../game/fragment-synergies');
const abilityManager = require('../game/active-ability-manager');
const { applyKingdomUpdates } = require('../db/schema');
const { convertNumericFields } = require('../db/numeric-fields');
const { setUnreadCount } = require("../cache.js");
const { structureUpdates } = require('./response-structurer');
const { decorateNewsMessage } = require("../game/news-emoji");
const { EPOCH_NOW } = require("../lib/db-sql");
const { pgInList, pgValueTuples } = require("../lib/pg-placeholders");
const { getKingdomMapCoords } = require("../game/world-map-coords");
const { getRegionLocations, isPubliclyDiscovered } = require("../game/world-locations");
const { getTerrainForRace } = require("../game/terrain");
const { getWorldSeed } = require("../game/world-seed");
const { getKingdomVisibility, updateKingdomVisibility } = require('../game/visibility');
const { getCompletedRing } = require('../game/scout-rings');
const { safeBitmapHasCell, safeBitmapAddCell, isValidCell } = require('../game/visibility-cells');
const { pixelToHex, getHexesInRadius, isFrontier, hexUnitDistance } = require('../game/hex-utils');
const { scoutRevealRadius, scoutFoodCostPerHex } = require('../game/scout-economy');
const { validateRangerAllocation } = require('../game/ranger-allocation');
const { parseTroopLevel } = require('../game/lib/troops');

const router = express.Router();

const MOJIBAKE_SIGNATURE = /[\u00C3\u00C2\u00E2\u00EF\u00F0\u00C5\uFFFD]/;

function repairMojibake(value) {
  if (value === null || value === undefined) return value;
  let text = String(value);
  if (!MOJIBAKE_SIGNATURE.test(text)) return text;
  for (let i = 0; i < 20; i++) {
    if (!MOJIBAKE_SIGNATURE.test(text)) break;
    let next;
    try {
      next = Buffer.from(text, "latin1").toString("utf8");
    } catch {
      break;
    }
    if (next === text) break;
    text = next;
  }
  text = text
    .replace(/\u00c2/g, "")
    .replace(/\u00e2\u20ac\u201d/g, "\u2014")
    .replace(/\u00e2\u20ac\u201c/g, "-")
    .replace(/\u00e2\u20ac\u00a2/g, "\u2022")
    .replace(/\u00e2\u20ac\u02dc|\u00e2\u20ac\u2122/g, "\u2019")
    .replace(/\u00e2\u20ac\u0153/g, "\u201c");
  return text;
}

function normalizeNewsRow(row) {
  if (!row || typeof row !== "object") return row;
  if (typeof row.message === "string") {
    return { ...row, message: decorateNewsMessage(row.message, repairMojibake) };
  }
  return row;
}

async function getRandomKingdom(db, selfId, excludedIds = [], columns = "id, name") {
  const forbidden = [selfId, ...excludedIds]
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  const uniqueForbidden = [...new Set(forbidden)];
  const countRow = await db.get("SELECT COUNT(*) as c FROM kingdoms WHERE id != $1", [selfId]);
  const total = Number(countRow?.c || 0);
  if (total <= 0) return null;

  const exclusionSet = new Set(uniqueForbidden);

  for (let attempt = 0; attempt < 8; attempt++) {
    const offset = Math.floor(Math.random() * total);
    const row = await db.get(
      `SELECT ${columns} FROM kingdoms WHERE id != $1 LIMIT 1 OFFSET $2`,
      [selfId, offset],
    );
    if (!row) continue;
    if (!exclusionSet.has(Number(row.id))) return row;
  }

  return null;
}

// Kingdoms we've already logged deprecated-inventory items for, so the warning fires
// once per process instead of on every (frequently polled) inventory fetch.
const _loggedDeprecatedInventory = new Set();

const portraitsPath = path.join(__dirname, "..", "public", "portraits");
if (!fs.existsSync(portraitsPath)) {
  fs.mkdirSync(portraitsPath, { recursive: true });
}

const ALLOWED_PORTRAIT_TYPES = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const ALLOWED_PORTRAIT_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const { validateImageSignature } = require('../utils/file-signatures');

// Memory storage: we validate the file's magic bytes before persisting to
// disk so that a forged `.png` filename containing arbitrary bytes (e.g.
// HTML, scripts, or executables) never lands in the public/portraits/
// directory.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_PORTRAIT_TYPES.has(ext)) {
      return cb(new Error("Only image files (jpg, png, gif, webp) are allowed"));
    }
    if (!ALLOWED_PORTRAIT_MIME.has(file.mimetype)) {
      return cb(new Error("Invalid file type - only image files are allowed"));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const uploadWithErrorHandling = (req, res, next) => {
  upload.single('portrait')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    next();
  });
};

// —— Per-player turn processing lock —————————————————————————
// Prevents client-side race conditions from multiple simultaneous turn requests
const turnsInProgress = new Map(); // playerId -> Promise

async function withTurnLock(playerId, fn) {
  // If a turn is already processing for this player, wait for it
  if (turnsInProgress.has(playerId)) {
    await turnsInProgress.get(playerId);
  }

  // Create promise for this turn and store it BEFORE awaiting
  const promise = (async () => {
    try {
      return await fn();
    } finally {
      turnsInProgress.delete(playerId);
    }
  })();

  turnsInProgress.set(playerId, promise);

  // Wait for turn to complete
  return promise;
}

// ── Column Selection Constants for Query Optimization ──────────────────────────
// Avoid SELECT * for better performance: network, parsing, memory
// Column sets: choose what's actually needed to reduce network/parsing overhead
const _KINGDOM_FULL = '*'; // Only use when truly necessary (GET /me)
const KINGDOM_CORE = 'id, player_id, name, race, turn, turns_stored, gold, food, population, land, happiness';
const _KINGDOM_BUILD = `${KINGDOM_CORE}, wood, stone, iron, coal, steel, food_shortage_turns,
  bld_farms, bld_granaries, bld_walls, bld_guard_towers, bld_libraries, bld_mage_towers, bld_shrines, bld_vaults`;
const _KINGDOM_UNITS = `${KINGDOM_CORE}, fighters, rangers, clerics, mages, thieves, ninjas, researchers, engineers, scribes`;
const _KINGDOM_RESEARCH = `${KINGDOM_CORE}, res_spellbook, res_economy, res_weapons, res_armor, res_military, school_of_magic, school_spellbook`;
const _KINGDOM_TURN = `${KINGDOM_CORE},
  research_allocation, mage_tower_allocation, build_allocation, training_allocation,
  fighters, rangers, clerics, mages, thieves, ninjas, researchers, engineers, scribes,
  bld_farms, bld_granaries, active_effects, discovered_kingdoms, build_queue`;
const KINGDOM_HIRE = 'id, player_id, gold, population, race, fighters, rangers, clerics, mages, thieves, ninjas, researchers, engineers, scribes, bld_schools, bld_barracks, level, troop_levels, turns_stored, fragment_bonuses';
const _KINGDOM_ATTACK = `${KINGDOM_CORE}, fighters, rangers, mages, thieves, ninjas, clerics, thralls, engineers, war_machines, ballistae,
  bld_walls, bld_guard_towers, bld_mage_towers, bld_outposts, bld_castles,
  res_military, res_weapons, res_armor, res_war_machines, res_attack_magic, res_defense_magic,
  troop_levels, equipment_levels, injured_troops, wall_hp, wall_defense_type, ladders, weapons_stockpile, armor_stockpile,
  level, mausoleum_upgrades, shrine_upgrades, wall_upgrades, tower_def_upgrades, outpost_upgrades,
  defense_upgrades, milestone_bonuses, prestige_level, xp, xp_sources, discovered_kingdoms`;
const _KINGDOM_ECONOMY = `${KINGDOM_CORE}, gold, market_upgrades, bank_upgrades, farm_upgrades, discovered_kingdoms`;

module.exports = function (db) {
  router.get('/scouts', requireAuth, async (req, res) => {
    try {
      const k = await db.get('SELECT scout_allocation, scout_progress FROM kingdoms WHERE player_id = $1', [req.player.playerId]);
      if (!k) {
        return res.status(404).json({ error: 'Kingdom not found' });
      }
      res.json(k);
    } catch (err) {
      console.error('[scouts] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/chat/global', requireAuth, async (req, res) => {
    const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 100));
    const rows = await db.all(
      `
        SELECT
          cm.id,
          cm.room,
          cm.message,
          cm.created_at,
          cm.username,
          COALESCE(p.chat_name, cm.username) AS from_name,
          COALESCE(p.chat_color, '#e8e9f0') AS chat_color,
          COALESCE(p.is_chat_mod, 0) AS is_chat_mod,
          COALESCE(p.is_admin, 0) AS is_admin
        FROM chat_messages cm
        LEFT JOIN players p ON p.id = cm.player_id
        WHERE cm.room = 'global' AND cm.deleted = 0
        ORDER BY cm.created_at DESC, cm.id DESC
        LIMIT $1
      `,
      [limit],
    );

    res.json({
      messages: rows
        .reverse()
        .map((row) => ({
          id: row.id,
          room: row.room,
          message: row.message,
          ts: row.created_at ? row.created_at * 1000 : Date.now(),
          from: row.from_name || row.username,
          username: row.username,
          chatColor: row.chat_color,
          isMod: !!(row.is_chat_mod || row.is_admin),
        })),
    });
  });

  router.get("/news/list", requireAuth, async (req, res) => {
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = $1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const [items] = await Promise.all([
      db.all(
        "SELECT * FROM news WHERE kingdom_id = $1 ORDER BY created_at DESC LIMIT 50",
        [k.id],
      ),
      db.run(
        "UPDATE news SET is_read = 1 WHERE kingdom_id = $1 AND is_read = 0",
        [k.id],
      ),
    ]);
    const normalized = items.map(normalizeNewsRow);
    const repairJobs = [];
    for (let i = 0; i < items.length; i += 1) {
      const original = items[i]?.message ?? "";
      const repaired = normalized[i]?.message ?? original;
      if (typeof original === "string" && repaired !== original) {
        repairJobs.push(db.run("UPDATE news SET message = $1 WHERE id = $2", [repaired, items[i].id]));
      }
    }
    if (repairJobs.length > 0) {
      await Promise.all(repairJobs);
    }
    setUnreadCount(k.id, 0); // Mark all read, so unread count is 0
    res.json(normalized);
  });

  router.delete("/news/clear", requireAuth, async (req, res) => {
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = $1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    await db.run("DELETE FROM news WHERE kingdom_id = $1", [k.id]);
    res.json({ ok: true });
  });

  async function loadTradeRoutes(k) {
    const tradeRoutes = await db.all(
      "SELECT * FROM trade_routes WHERE kingdom_id = $1 OR partner_id = $2",
      [k.id, k.id],
    );
    k._trade_routes = tradeRoutes.map((r) => {
      if (r.partner_id === k.id) {
        return { ...r, partner_id: r.kingdom_id, kingdom_id: r.partner_id };
      }
      return r;
    });
    return k;
  }

  // —— Load turn input context (init queries + trade routes) - can run outside txn ———
  async function loadTurnContext(db, k) {
    if (!k) throw new Error('Kingdom not found');
    console.time(`[turn-${k.id}] init-queries`);
    // Inject region ownership status for bonuses
    // All 3 queries are independent - run them in parallel
    const [regionStatus, myAlliance, heroes] = await Promise.all([
      db.get(
        "SELECT owner_alliance_id, bonus_type FROM regions WHERE name = $1",
        [k.region],
      ),
      db.get(
        "SELECT alliance_id FROM alliance_members WHERE kingdom_id = $1",
        [k.id],
      ),
      db.all(
        "SELECT * FROM heroes WHERE kingdom_id = $1 AND status = 'idle'",
        [k.id],
      ),
    ]);
    console.timeEnd(`[turn-${k.id}] init-queries`);
    k._region_owned_by_my_alliance =
      regionStatus &&
      myAlliance &&
      regionStatus.owner_alliance_id === myAlliance.alliance_id;
    k._region_bonus_type = regionStatus?.bonus_type;
    k.heroes = heroes;
    console.time(`[turn-${k.id}] trade-routes`);
    await loadTradeRoutes(k);
    console.timeEnd(`[turn-${k.id}] trade-routes`);
    return { heroes };
  }

  // —— Commit turn side-effects (applies, hero XP, news, expeditions, resources) ————
  // These are the DB writes that benefit from being inside a short transaction.
  // Called from both legacy runTurn and the optimized /turn path.
  async function commitTurnResults(db, k, updates, incomingEvents) {
    const events = incomingEvents || [];
    const cleanEvents = events.map(normalizeNewsRow);

    const heroBatch = [];
    for (const hero of (k.heroes || [])) {
      const xpResult = commandHandler.awardHeroXp(hero, 10);
      heroBatch.push({ id: hero.id, level: xpResult.level, xp: xpResult.xp });
      commandHandler.applyHeroTurnBonuses(hero, k, updates, events);
    }

    updates.turns_stored = k.turns_stored - 1;

    // Dedup news - only insert if we haven't already sent this EXACT message recently
    const filteredEvents = [];
    // Batch check for duplicate news instead of N+1 queries
    const existingMessages = {};
    if (events.length > 0) {
      // Deduplicate and filter for valid string messages to prevent TypeError and reduce DB load
      const uniqueMessages = [...new Set(cleanEvents.map(e => e && e.message).filter(msg => typeof msg === 'string'))];
      if (uniqueMessages.length > 0) {
        const existingNews = await db.all(
          `SELECT DISTINCT message FROM news WHERE kingdom_id = $1 AND message IN (${pgInList(uniqueMessages.length, 2)}) AND created_at > (${EPOCH_NOW} - 60)`,
          [k.id, ...uniqueMessages]
        );
        existingNews.forEach(row => {
          existingMessages[row.message] = true;
        });
      }
    }

    for (const ev of cleanEvents) {
      // Skip messages marked to not go to news
      if (ev.skipNews) continue;

      const existing = existingMessages[ev.message];
      if (
        existing &&
        !ev.message.includes("Troop upkeep") &&
        !ev.message.includes("Actively constructing") &&
        !ev.message.includes("Library Est:") &&
        !ev.message.includes("Construction complete:")
      )
        continue; // already sent — skip
      filteredEvents.push(ev);
    }

    // Resolve kingdom-discovery flags BEFORE applyUpdates so discovered_kingdoms
    // persists with the turn write. Flags are not DB columns (stripped below).
    // Passive scout kingdom_signal sets _find_kingdom; surveyor sets _find_kingdom_surveyor.
    const discoveryEvents = [];
    {
      const { mergeKingdomDiscovery, stripDiscoveryFlags } = require('../game/kingdom-discovery-resolve');
      const stateForMerge = { ...k, ...updates };

      if (updates._find_kingdom_surveyor) {
        const other = await getRandomKingdom(db, k.id, [], 'id, name');
        const merged = mergeKingdomDiscovery(stateForMerge, updates, other, { source: 'surveyor' });
        if (merged.applied) {
          updates.discovered_kingdoms = merged.discovered_kingdoms;
          stateForMerge.discovered_kingdoms = merged.discovered_kingdoms;
          const msg = repairMojibake(merged.message);
          discoveryEvents.push({ type: 'system', message: msg });
          filteredEvents.push({ type: 'system', message: msg });
        }
      }

      if (updates._find_kingdom) {
        const other = await getRandomKingdom(db, k.id, [], 'id, name');
        const merged = mergeKingdomDiscovery(stateForMerge, updates, other, { source: 'scout' });
        if (merged.applied) {
          updates.discovered_kingdoms = merged.discovered_kingdoms;
          const msg = repairMojibake(merged.message);
          discoveryEvents.push({
            type: 'system',
            message: msg,
            expeditionLogEntry: {
              icon: '🔍',
              title: 'Kingdom discovered',
              subtitle: merged.otherName || 'kingdom',
            },
          });
          filteredEvents.push({ type: 'system', message: msg });
        }
      }

      if (updates._spawn_resource_node) {
        const nodeType = updates._spawn_resource_node;
        delete updates._spawn_resource_node;
        try {
          const { spawnPassiveScoutResourceNode } = require('../game/passive-resource-node-spawn');
          const spawned = await spawnPassiveScoutResourceNode(db, { ...k, ...updates }, nodeType);
          if (spawned.ok) {
            const msg = repairMojibake(
              `🔍 Your scouts charted a new ${spawned.type} deposit on the map`,
            );
            discoveryEvents.push({
              type: 'system',
              message: msg,
              expeditionLogEntry: {
                icon: '🔍',
                title: 'Resource node found',
                subtitle: spawned.type,
              },
            });
            filteredEvents.push({ type: 'system', message: msg });
          }
        } catch (spawnErr) {
          console.error('[commitTurnResults] resource node spawn:', spawnErr.message);
        }
      }

      stripDiscoveryFlags(updates);
      delete updates._spawn_resource_node;
    }

    try {
      console.time(`[turn-${k.id}] applyUpdates`);
      await applyUpdates(db, k.id, updates);
      console.timeEnd(`[turn-${k.id}] applyUpdates`);

      // Batch hero XP updates
      if (heroBatch.length > 0) {
        const heroIds = heroBatch.map(h => h.id);
        const levels = heroBatch.map(h => h.level);
        const xps = heroBatch.map(h => h.xp);
        const placeholders = heroIds.map((_, i) => `$${i + 1}`).join(',');

        await db.run(
          `UPDATE heroes SET level = CAST(CASE id ${heroIds.map((_, i) => `WHEN $${i + 1} THEN $${heroIds.length + i + 1}`).join(' ')} END AS integer),
           xp = CAST(CASE id ${heroIds.map((_, i) => `WHEN $${i + 1} THEN $${heroIds.length * 2 + i + 1}`).join(' ')} END AS real)
           WHERE id IN (${placeholders})`,
          [...heroIds, ...levels, ...xps]
        );
      }

      const turnNum = updates.turn || k.turn;
      if (filteredEvents.length > 0) {
        await bulkInsertNews(
          db,
          filteredEvents.map((ev) => ({
            kingdom_id: k.id,
            type: ev.type || "system",
            message: ev.message,
            turn_num: turnNum,
          })),
        );
        if (Math.random() < 0.05) await pruneNews(db, k.id, 200);
      }
    } catch (err) {
      console.error("[runTurn] apply error:", err.message);
      throw err;
    }

    // Resolve expeditions 
    let expeditionEvents = [];
    try {
      console.time(`[turn-${k.id}] resolveExpeditions`);
      // commandHandler.handle({type:'expeditions'}) already includes resource harvests
      expeditionEvents = await commandHandler.handle(
        { type: 'expeditions' },
        { kingdom: { ...k, ...updates }, db },
      );
      console.timeEnd(`[turn-${k.id}] resolveExpeditions`);
      expeditionEvents = expeditionEvents.map(normalizeNewsRow);
      if (expeditionEvents.length > 0) {
        const turnNum = updates.turn || k.turn;
        await bulkInsertNews(
          db,
          expeditionEvents.map((ev) => ({
            kingdom_id: k.id,
            type: ev.type || "system",
            message: ev.message,
            turn_num: turnNum,
          })),
        );
      }
    } catch (err) {
      console.error("[runTurn] expedition resolve error:", err.message);
      // Only throw if in an active transaction (safe to rollback)
      // Endpoints like /search call runTurn without transaction context
      const store = db.transactionStorage?.getStore?.();
      if (store && !store.released) {
        throw err; // Rethrow to trigger transaction rollback
      }
      // If no transaction: log but don't throw (prevent lost turns)
    }

    const allEvents = [...cleanEvents, ...discoveryEvents, ...expeditionEvents];

    return { updates, events: allEvents };
  }

  // —— Process turn effects without deducting another turn (for instant actions like hunt) ——
  async function processTurnEffectsOnly(db, k) {
    if (!k) throw new Error('Kingdom not found');
    console.time(`[turn-${k.id}] effects-only`);

    // Load context before transaction
    await loadTurnContext(db, k);

    console.time(`[turn-${k.id}] effects-only-transaction`);
    const { updates: finalUpdates, events: finalEvents } = await db.withTransaction(async () => {
      // Re-fetch with FOR UPDATE for row lock in transaction
      let lockedK = await db.get("SELECT * FROM kingdoms WHERE id = $1 FOR UPDATE", [k.id]);
      if (!lockedK) throw new Error('Kingdom not found');

      // Merge the pre-fetched context onto the fresh lockedK
      Object.assign(lockedK, {
        _region_owned_by_my_alliance: k._region_owned_by_my_alliance,
        _region_bonus_type: k._region_bonus_type,
        heroes: k.heroes,
        _trade_routes: k._trade_routes,
      });

      console.time(`[turn-${k.id}] engine.processTurn`);
      const { updates, events } = await commandHandler.handle(
        { type: 'turn' },
        { kingdom: lockedK, db },
      );
      console.timeEnd(`[turn-${k.id}] engine.processTurn`);

      // Don't deduct a turn (it was already deducted by the action that called this)
      updates.turns_stored = lockedK.turns_stored;

      const { updates: txUpdates, events: txEvents } = await commitTurnResults(db, lockedK, updates, events);

      // Fix turns_stored since commitTurnResults would have deducted another turn
      txUpdates.turns_stored = lockedK.turns_stored;

      return { updates: txUpdates, events: txEvents };
    });
    console.timeEnd(`[turn-${k.id}] effects-only-transaction`);

    // Refresh fields that resolveExpeditions may have updated via SQL
    console.time(`[turn-${k.id}] refresh-queries`);
    const refreshed = await db.get(
      "SELECT rangers, fighters, gold, mana, land, scrolls, maps, blueprints_stored, troop_levels, library_progress, tower_progress, racial_bonuses_unlocked, scout_progress FROM kingdoms WHERE id = $1",
      [k.id],
    );
    if (refreshed) Object.assign(finalUpdates, refreshed);

    // Fetch unread news count
    const unread = await db.get(
      "SELECT COUNT(*) as c FROM news WHERE kingdom_id = $1 AND is_read = 0",
      [k.id],
    );
    console.timeEnd(`[turn-${k.id}] refresh-queries`);
    finalUpdates.unread_news = unread.c;

    // Calculate new score after turn
    const finalState = { ...k, ...finalUpdates };
    finalUpdates.score = await commandHandler.handle(
      { type: 'calculate-score' },
      { kingdom: finalState },
    );

    console.timeEnd(`[turn-${k.id}] effects-only`);
    return { updates: finalUpdates, events: finalEvents };
  }

  // —— Shared turn runner - used by ALL routes that consume a turn ————————————
  async function runTurn(db, k) {
    if (!k) throw new Error('Kingdom not found');
    console.time(`[turn-${k.id}] total`);
    await loadTurnContext(db, k);

    console.time(`[turn-${k.id}] engine.processTurn`);
    const { updates, events } = await commandHandler.handle(
      { type: 'turn' },
      { kingdom: k, db },
    );
    console.timeEnd(`[turn-${k.id}] engine.processTurn`);

    const { updates: finalUpdates, events: finalEvents } = await commitTurnResults(db, k, updates, events);

    // Refresh fields that resolveExpeditions may have updated via SQL
    console.time(`[turn-${k.id}] refresh-queries`);
    const refreshed = await db.get(
      "SELECT rangers, fighters, gold, mana, land, scrolls, maps, blueprints_stored, troop_levels, library_progress, tower_progress, racial_bonuses_unlocked, scout_progress FROM kingdoms WHERE id = $1",
      [k.id],
    );
    if (refreshed) Object.assign(finalUpdates, refreshed);

    // Fetch unread news count
    const unread = await db.get(
      "SELECT COUNT(*) as c FROM news WHERE kingdom_id = $1 AND is_read = 0",
      [k.id],
    );
    console.timeEnd(`[turn-${k.id}] refresh-queries`);
    finalUpdates.unread_news = unread.c;

    // Calculate new score after turn
    const finalState = { ...k, ...finalUpdates };
    finalUpdates.score = await commandHandler.handle(
      { type: 'calculate-score' },
      { kingdom: finalState },
    );

    console.timeEnd(`[turn-${k.id}] total`);
    return { updates: finalUpdates, events: finalEvents };
  }

  // —— Take turn (advance game state) ——————————————————————————
  // Optimized to minimize time holding DB transaction/connection (Phase 1):
  // - Prefetch of context (region/alliance/heroes + trade) + final refresh happen outside txn.
  // - Inside txn: FOR UPDATE lock + fresh kingdom snapshot + processTurn (on locked state) + writes.
  // - Context merged onto lockedK to preserve hero XP, bonuses, etc.
  // This shortens txn hold vs. original (init queries + refresh moved out) while preserving correctness.
  router.post("/turn", requireAuth, requireCsrfToken, async (req, res) => {
    const startTime = Date.now();
    try {
      const result = await withTurnLock(req.player.playerId, async () => {
        // === PREFETCH context only (outside transaction) ===
        // Context (region/alliance/heroes/trade) loaded outside to reduce txn hold time.
        // Core kingdom state for processTurn will be fetched fresh *under lock*.
        console.time(`[turn] prefetch`);
        let k = await db.get("SELECT * FROM kingdoms WHERE player_id = $1", [
          req.player.playerId,
        ]);
        if (!k) {
          throw new Error("Kingdom not found");
        }
        if (k.turns_stored < 1) {
          throw new Error("No turns available - next +7 turns in 25 minutes");
        }

        // Load context (init-queries + trade-routes) OUTSIDE txn — parallel reads
        await loadTurnContext(db, k);
        console.timeEnd(`[turn] prefetch`);

        // === SHORT TRANSACTION: lock + fresh snapshot + process + writes ===
        console.time(`[turn] transaction`);
        let txUpdates, txEvents;
        try {
          const txData = await db.withTransaction(async () => {
            // Re-fetch with FOR UPDATE for row lock + authoritative *current* state
            let lockedK = await db.get("SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE", [
              req.player.playerId,
            ]);
            if (!lockedK) {
              throw new Error("Kingdom not found");
            }
            if (lockedK.turns_stored < 1) {
              throw new Error("No turns available - next +7 turns in 25 minutes");
            }

            // Merge the pre-fetched context/heroes onto the fresh lockedK.
            // Critical for: hero XP/turn bonuses, region bonuses in process/resolve, trade routes, etc.
            Object.assign(lockedK, {
              _region_owned_by_my_alliance: k._region_owned_by_my_alliance,
              _region_bonus_type: k._region_bonus_type,
              heroes: k.heroes,
              _trade_routes: k._trade_routes,
            });

            // Run processTurn on the *locked* snapshot (prevents stale absolute updates
            // and lost concurrent modifications from non-turn actions).
            console.time(`[turn-${lockedK.id}] engine.processTurn`);
            let turnResult;
            if (process.env.NODE_ENV !== 'production') {
              const p = initProfiler();
              turnResult = await runWithProfiler(p, () => commandHandler.handle({ type: 'turn' }, { kingdom: lockedK, db }));
            } else {
              turnResult = await commandHandler.handle({ type: 'turn' }, { kingdom: lockedK, db });
            }
            const { updates, events, _profileReport } = turnResult;
            if (_profileReport && _profileReport.totalTime > 0) {
              console.log(`[profiling] Turn ${updates.turn}: ${_profileReport.totalTime}ms total`);
              const { BUDGETS } = require('../game/profiling');
              const b = BUDGETS || { jsonHighCostMs: 100, slowAttunementMs: 10 };
              if (_profileReport.summary?.jsonPercentOfTotal > 10 || _profileReport.jsonOperations.totalTime > b.jsonHighCostMs) {
                console.log(`[profiling] JSON cost: ${_profileReport.jsonOperations.totalTime}ms (${_profileReport.summary.jsonPercentOfTotal}% of total) (budget ${b.jsonHighCostMs}ms)`);
              }
              if (_profileReport.summary?.slowAttunements || Object.values(_profileReport.attunements || {}).some(a => a.maxTime > b.slowAttunementMs)) {
                console.log(`[profiling] Slow attunements detected (budget ${b.slowAttunementMs}ms)`);
              }
            }
            console.timeEnd(`[turn-${lockedK.id}] engine.processTurn`);

            // Apply writes inside the same txn (applyUpdates, hero batch, news, expeditions, resources)
            const { updates: committedUpdates, events: committedEvents } = await commitTurnResults(db, lockedK, updates, events);
            return { updates: committedUpdates, events: committedEvents };
          });
          txUpdates = txData.updates;
          txEvents = txData.events;
        } catch (txErr) {
          console.error('[turn] transaction failed:', txErr.message);
          throw new Error('Turn processing failed, please retry', { cause: txErr });
        }
        console.timeEnd(`[turn] transaction`);

        // === POSTFETCH (outside transaction) ===
        console.time(`[turn] postfetch`);
        const refreshed = await db.get(
          "SELECT rangers, fighters, gold, mana, land, scrolls, maps, blueprints_stored, troop_levels, library_progress, tower_progress, racial_bonuses_unlocked, scout_progress FROM kingdoms WHERE id = $1",
          [k.id],
        );
        if (refreshed) {
          convertNumericFields(refreshed);
          Object.assign(txUpdates, refreshed);
        }

        const unread = await db.get(
          "SELECT COUNT(*) as c FROM news WHERE kingdom_id = $1 AND is_read = 0",
          [k.id],
        );
        console.timeEnd(`[turn] postfetch`);

        txUpdates.unread_news = unread.c;

        // Final score on merged state
        const finalState = { ...k, ...txUpdates };
        txUpdates.score = await commandHandler.handle(
          { type: 'calculate-score' },
          { kingdom: finalState },
        );

        const totalTime = Date.now() - startTime;
        console.log(`[turn] complete for player ${req.player.playerId} in ${totalTime}ms (prefetch+process+tx+postfetch)`);

        // Separate fields into proper domains for contract compliance
        const profileFields = new Set(['turn', 'turns_stored', 'level', 'xp', 'xp_sources', 'scout_progress', 'score', 'unread_news', 'last_turn_at', 'updated_at']);
        const economyFields = new Set(['gold', 'food', 'mana', 'wood', 'stone', 'iron', 'steel', 'coal', 'maps', 'scrolls', 'blueprints_stored', 'land', 'food_surplus_turns', 'food_shortage_turns', '_spoilage']);
        const researchFields = new Set(['research_focus', 'research_progress']);
        const populationFields = new Set(['population', 'happiness', 'goals']);
        const militaryFields = new Set(['rangers', 'fighters', 'troop_levels', 'tower_progress']);

        const structuredUpdates = {};

        // Distribute fields into domains
        Object.entries(txUpdates).forEach(([key, value]) => {
          if (profileFields.has(key)) {
            if (!structuredUpdates.profile) structuredUpdates.profile = {};
            structuredUpdates.profile[key] = value;
          } else if (economyFields.has(key)) {
            if (!structuredUpdates.economy) structuredUpdates.economy = {};
            structuredUpdates.economy[key] = value;
          } else if (researchFields.has(key)) {
            if (!structuredUpdates.research) structuredUpdates.research = {};
            structuredUpdates.research[key] = value;
          } else if (populationFields.has(key)) {
            if (!structuredUpdates.population) structuredUpdates.population = {};
            structuredUpdates.population[key] = value;
          } else if (militaryFields.has(key)) {
            if (!structuredUpdates.military) structuredUpdates.military = {};
            structuredUpdates.military[key] = value;
          }
          // Any other fields are silently dropped (shouldn't happen)
        });

        return { ok: true, updates: structuredUpdates, events: txEvents };
      });
      res.json(result);
    } catch (err) {
      console.error("[turn] failed:", err.stack || err.message);
      if (err.message.includes("Kingdom not found")) {
        return res.status(404).json({ error: err.message });
      }
      if (err.message.includes("No turns available")) {
        return res.status(429).json({ error: err.message });
      }
      if (err.message.includes("Turn processing failed")) {
        return res.status(500).json({ error: "Turn processing failed — please try again" });
      }
      const detail = process.env.NODE_ENV !== "production"
        ? (err.stack || err.message)
        : undefined;
      res.status(500).json({
        error: "Turn processing failed - please try again",
        ...(detail ? { detail } : {}),
      });
    }
  });

  // —— Hire units ————————————————————————————————————————————————
  router.post("/hire", requireAuth, requireCsrfToken, async (req, res) => {
    const { unit, amount } = req.body;

    const amountValidation = validateTroopAmount(amount, { fieldName: 'amount' });
    if (!amountValidation.valid) {
      return res.status(400).json({ error: amountValidation.error });
    }

    try {
      const tx = await db.withTransaction(async () => {

      const k = await db.get(`SELECT ${KINGDOM_HIRE} FROM kingdoms WHERE player_id = $1 FOR UPDATE`, [
        req.player.playerId,
      ]);
      if (!k) {
        throw new Error("Kingdom not found");
      }

      const hireResult = await commandHandler.handle(
        { type: 'hire-units', unitType: unit, quantity: amountValidation.value },
        { kingdom: k },
      );
      if (hireResult.error) {
        const error = new Error(hireResult.error);
        error.statusCode = 400;
        throw error;
      }

      const hireUpdates = hireResult.updates;
      const updatesForDb = { ...hireUpdates };
      if (updatesForDb.troop_levels && typeof updatesForDb.troop_levels === 'object') {
        updatesForDb.troop_levels = JSON.stringify(updatesForDb.troop_levels);
      }

      await applyKingdomUpdates(k.id, updatesForDb);
      return { k, hireUpdates };
      });

      const { k, hireUpdates } = tx;

      res.json({
        ok: true,
        updates: hireUpdates,
        events: [],
        turns_stored: k.turns_stored,
      });
    } catch (err) {
      console.error("[hire] failed:", err.message);
      if (err.message.includes("Kingdom not found")) {
        return res.status(404).json({ error: err.message });
      }
      if (err.statusCode === 400) {
        return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: "Hire failed — please try again" });
    }
  });

  // —— Research ——————————————————————————————————————————————————
  // —— Queue buildings - charges gold, no turn cost —————————————â"€

  // —— Get training allocation ———————————————————————————————

  // —— Save training allocation ———————————————————————————————



  // —— Build structures - start construction with engineer allocation ——————

  // —— Cancel building - refund resources —————————————————————

  // —— Forge tools - costs 1 turn + gold for scaffolding ————————————
  router.post("/smithy/forge-tools", requireAuth, requireCsrfToken, async (req, res) => {
    const { toolType, quantity } = req.body;
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = $1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.turns_stored < 1)
      return res.status(429).json({ error: "No turns available" });
    const smithies = k.bld_smithies;
    if (smithies === 0)
      return res.status(400).json({ error: "Need at least 1 smithy" });
    // Validate caps and cost before running turn
    if (toolType === "hammers") {
      const cap = smithies * 25;
      if (k.hammers_stored >= cap)
        return res
          .status(400)
          .json({ error: `Hammer storage full (${cap}/${cap})` });
    } else if (toolType === "scaffolding") {
      const cap = smithies * 10;
      if (k.scaffolding_stored >= cap)
        return res
          .status(400)
          .json({ error: `Scaffolding storage full (${cap}/${cap})` });
      if (k.gold < 2500)
        return res
          .status(400)
          .json({ error: "Need 2,500 gold to make scaffolding" });
    }
    try {
      const { updates, events } = await runTurn(db, k);
      const kAfterTurn = { ...k, ...updates };
      const toolResult = await commandHandler.handle(
        {
          type: 'forge-tools',
          toolType,
          quantity: Number(quantity) || 1,
        },
        { kingdom: kAfterTurn },
      );
      if (toolResult.error)
        return res.status(400).json({ error: toolResult.error });
      await applyUpdates(db, k.id, toolResult.updates);
      const finalUpdates = { ...updates, ...toolResult.updates };
      res.json({
        ok: true,
        updates: finalUpdates,
        events,
        turns_stored: finalUpdates.turns_stored,
      });
    } catch (err) {
      console.error("[smithy/forge-tools] failed:", err.message);
      res.status(500).json({ error: "Forging failed - please try again" });
    }
  });

  // —— Smithy - buy hammers for gold —————————————————————————

  // —— Smithy - buy scaffolding for gold —————————————————————

  // â"€â"€ Trade Routes â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  router.post("/search", requireAuth, requireCsrfToken, async (req, res) => {
    const { type, rangers } = req.body;
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = $1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.turns_stored < 1)
      return res.status(429).json({ error: "No turns available" });

    const r = Number(rangers) || 0;
    if (r <= 0)
      return res.status(400).json({ error: "Send at least some rangers" });
    if (r > commandHandler.getAvailableUnits(k, "rangers"))
      return res.status(400).json({
        error: "Not enough available rangers (some may be in training)",
      });

    try {
      const { updates, events } = await runTurn(db, k);
      const kAfterTurn = { ...k, ...updates };
      const tacticsMult = 1 + (kAfterTurn.res_military || 0) / 1000;
      let searchResult = {};
      let searchMessage = "";

      if (type === "land") {
        const exploreBonus =
          {
            dire_wolf: 1.4,
            dark_elf: 1.25,
            human: 1.1,
            orc: 1.05,
            dwarf: 0.9,
            high_elf: 0.95,
          }[kAfterTurn.race] || 1.0;
        const rangerLvBonus = commandHandler.unitLevelMult(kAfterTurn, "rangers");

        const currentLand = kAfterTurn.land || 0;
        // Exponentially harder with more land
        const diminish = Math.exp(-0.0002 * currentLand);

        // 100 human rangers initially find 10 land. So base coefficient is 1 / 11.0
        const found = Math.max(
          1,
          Math.floor(r * (1 / 11.0) * exploreBonus * rangerLvBonus * diminish),
        );

        updates.land = (kAfterTurn.land || 0) + found;
        searchResult = { found, unit: "acres" };
        searchMessage = `Rangers discovered +${found.toLocaleString()} acres${found <= 1 ? " (land getting scarce)" : ""}.`;
      } else if (type === "gold") {
        const found = Math.floor(r * 12 * tacticsMult);
        updates.gold = (updates.gold || kAfterTurn.gold || 0) + found;
        searchResult = { found, unit: "GC" };
        searchMessage = `Rangers returned with ${found.toLocaleString()} gold from foraging.`;
      } else if (type === "food") {
        const found = Math.floor(r * 0.5 * tacticsMult);
        updates.food = (kAfterTurn.food || 0) + found;
        searchResult = { found, unit: "food" };
        searchMessage = `Rangers foraged ${found.toLocaleString()} food from the wilderness.`;
      } else if (type === "targets") {
        const scouts = Math.max(1, r);
        const baseFound = Math.floor(scouts * 0.005) + 1; // scaled down slightly

        // Find random kingdoms I haven't discovered yet
        let disc = {};
        try {
          disc = safeJsonParse(kAfterTurn.discovered_kingdoms, {}, "auto:discovered_kingdoms");
        } catch {}

        const currentIds = Object.keys(disc)
          .map((id) => parseInt(id))
          .filter((id) => !isNaN(id));
        currentIds.push(k.id); // exclude self

        let foundCount = 0;
        let lastFoundName = "";
        const excluded = new Set(currentIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0));
        const attemptsLimit = Math.max(12, baseFound * 8);
        let attempts = 0;
        while (foundCount < baseFound && attempts < attemptsLimit) {
          attempts++;
          const other = await getRandomKingdom(db, k.id, Array.from(excluded), "id, name");
          if (!other) break;

          const otherId = Number(other.id);
          if (excluded.has(otherId)) continue;

          excluded.add(otherId);
          disc[otherId] = { found: true, name: other.name };
          foundCount++;
          lastFoundName = other.name;
        }

        if (foundCount > 0) {
          updates.discovered_kingdoms = JSON.stringify(disc);
        }

        searchResult = { found: foundCount, unit: "kingdoms" };
        searchMessage =
          foundCount > 0
            ? foundCount === 1
              ? `Rangers scouted a new target: ${lastFoundName}.`
              : `Rangers scouted ${foundCount} new target kingdoms.`
            : `Rangers searched the area but found no new settlements.`;
      } else {
        return res.status(400).json({ error: "Invalid search type" });
      }

      await applyUpdates(db, k.id, {
        land: updates.land,
        gold: updates.gold,
        food: updates.food,
        discovered_kingdoms: updates.discovered_kingdoms,
      });

      const turnNum = updates.turn || k.turn;
      // Removed bulkInsertNews for search results as per user request (only in log)

      const xpResult = await commandHandler.handle(
        {
          type: 'award-xp',
          activity: 'exploration',
          amount:
            type === 'land'
              ? searchResult.found
              : type === 'gold'
                ? Math.floor(searchResult.found / 1000)
                : 5,
        },
        { kingdom: kAfterTurn },
      );
      updates.xp = xpResult.xp;
      updates.level = xpResult.level;

      // Award Troop XP to Rangers for exploration
      const rTroopXp = await commandHandler.handle(
        {
          type: 'award-troop-xp',
          unitType: 'rangers',
          amount: 8,
        },
        { kingdom: { ...kAfterTurn, xp: updates.xp, level: updates.level } },
      );
      updates.troop_levels = rTroopXp.troop_levels;
      if (rTroopXp.levelUps && rTroopXp.levelUps.length > 0) {
        events.push(
          ...rTroopXp.levelUps.map((msg) => ({
            type: "system",
            message: msg,
          })),
        );
      }

      if (xpResult.levelled) {
        await bulkInsertNews(
          db,
          xpResult.events.map((ev) => ({
            kingdom_id: k.id,
            type: "system",
            message: ev.message,
            turn_num: turnNum,
          })),
        );
        events.push(...xpResult.events);
      }
      await applyUpdates(db, k.id, {
        xp: updates.xp,
        level: updates.level,
        troop_levels: updates.troop_levels,
      });

      res.json({
        ok: true,
        type,
        result: searchResult,
        message: searchMessage,
        updates,
        events: [...events, { type: "system", message: searchMessage }],
        turns_stored: updates.turns_stored,
      });
    } catch (err) {
      console.error("[search] failed:", err.message);
      res.status(500).json({ error: "Search failed — please try again" });
    }
  });

  // â"€â"€ Mage tower allocation â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€


  // â"€â"€ Shrine allocation â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  // â"€â"€ Mausoleum allocation â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€


  // â"€â"€ Library allocation â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  router.post("/library-allocation", requireAuth, requireCsrfToken, async (req, res) => {
    const { allocation } = req.body;
    if (!allocation || typeof allocation !== "object")
      return res.status(400).json({ error: "allocation required" });
    const k = await db.get(
      "SELECT id, bld_libraries, scribes, library_upgrades FROM kingdoms WHERE player_id = $1",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.bld_libraries === 0)
      return res
        .status(400)
        .json({ error: "You need at least 1 library first" });

    // Check prerequisites
    if (allocation["certified_blueprint"] > 0) {
      let upg = {};
      try {
        upg = safeJsonParse(k.library_upgrades, {}, "auto:library_upgrades");
      } catch {}
      if (!upg.mason_sigil)
        return res.status(403).json({
          error:
            "You need the Master Mason Sigil upgrade to assign scribes to Certified Blueprints",
        });
    }

    const capacity = k.bld_libraries * 20;
    const maxScribes = Math.min(k.scribes, capacity);
    const total = Object.values(allocation).reduce(
      (s, v) => s + (Number(v) || 0),
      0,
    );

    if (total > maxScribes)
      return res.status(400).json({
        error: `Allocated ${total.toLocaleString()} but you only have ${maxScribes.toLocaleString()} effective scribes`,
      });

    await db.run("UPDATE kingdoms SET library_allocation = $1 WHERE id = $2", [
      JSON.stringify(allocation),
      k.id,
    ]);
    res.json({ ok: true });
  });

  // library-cancel has been replaced by library-allocation.
  // Admin: clear ALL expeditions for a kingdom (debug tool)
  // â"€â"€ Options â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  router.post("/options", requireAuth, requireCsrfToken, async (req, res) => {
    const { tax, name } = req.body;
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = $1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const updates = { updated_at: Math.floor(Date.now() / 1000) };
    if (tax !== undefined) {
      const t = Number(tax);
      if (t < 0 || t > 100)
        return res.status(400).json({ error: "Tax must be 0—100" });
      updates.tax = t;
    }
    if (name !== undefined) {
      if (!name.trim())
        return res.status(400).json({ error: "Name cannot be empty" });
      updates.name = name.trim();
    }
    await applyUpdates(db, k.id, updates);
    res.json({ ok: true, updates: structureUpdates(updates) });
  });
  // â"€â"€ Season info â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  router.get("/season", requireAuth, async (_req, res) => {
    const sRow = await db.get(
      "SELECT value FROM server_state WHERE key='current_season'",
    );
    const tRow = await db.get(
      "SELECT value FROM server_state WHERE key='season_started_at'",
    );
    const season = sRow?.value || "spring";
    const startedAt = parseInt(tRow?.value) || Math.floor(Date.now() / 1000);
    const SEASON_DUR = { spring: 3, summer: 5, fall: 2, winter: 3 };
    const SEASON_ICONS = {
      spring: "ðŸŒ¸",
      summer: "â˜€ï¸",
      fall: "ðŸ‚",
      winter: "\u2744\uFE0F",
    };
    const daysLeft = Math.max(
      0,
      SEASON_DUR[season] - (Date.now() / 1000 - startedAt) / 86400,
    );
    const now = new Date();
    const h = now.getUTCHours();
    const m = now.getUTCMinutes();
    const isNight = h >= 1 && h < 13; // 8PM EST to 8AM EST
    
    let nextChangeHour = isNight ? 13 : (h >= 13 ? 25 : 1);
    let hoursLeft = nextChangeHour - h - 1;
    let minsLeft = 60 - m;
    if (minsLeft === 60) {
      hoursLeft += 1;
      minsLeft = 0;
    }
    const timeToChangeStr = `${hoursLeft}h ${minsLeft}m to ${isNight ? 'dawn' : 'nightfall'}`;

    res.json({
      season,
      daysLeft: daysLeft.toFixed(1),
      icon: SEASON_ICONS[season] || "ðŸŒ¸",
      isNight,
      timeToChangeStr,
    });
  });

  // â"€â"€ Location — get my discovered kingdoms â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  router.get("/locations", requireAuth, async (req, res) => {
    const k = await db.get(
      "SELECT discovered_kingdoms, location_maps_wip FROM kingdoms WHERE player_id=$1",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    let disc = {},
      wip = [];
    try {
      disc = safeJsonParse(k.discovered_kingdoms, {}, "auto:discovered_kingdoms");
    } catch {}
    try {
      wip = safeJsonParse(k.location_maps_wip, [], "auto:location_maps_wip");
    } catch {}
    res.json({ discovered: disc, wip });
  });

  // Get available buildings for a hybrid blueprint (for selection modal)
  router.post("/hybrid-blueprint/get-buildings", requireAuth, requireCsrfToken, async (req, res) => {
    const { blueprintId } = req.body;
    if (!blueprintId) return res.status(400).json({ error: "Missing blueprintId" });

    const k = await db.get(
      `SELECT id, hybrid_blueprints, fragment_bonuses,
              bld_farms, bld_granaries, bld_housing, bld_libraries, bld_schools,
              bld_mage_towers, bld_shrines, bld_mausoleums, bld_markets, bld_taverns,
              bld_vaults, bld_armories, bld_smithies, bld_barracks, bld_walls,
              bld_guard_towers, bld_outposts, bld_training, bld_castles
       FROM kingdoms WHERE player_id = $1`,
      [req.player.playerId]
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    let hbp = {};
    try {
      hbp = safeJsonParse(k.hybrid_blueprints, {}, "auto:hybrid_blueprints");
    } catch {}

    if (!hbp[blueprintId]) {
      return res.status(400).json({ error: "Blueprint not found" });
    }
    if (hbp[blueprintId].assigned) {
      return res.status(400).json({ error: "Blueprint already assigned" });
    }

    const fragmentName = hbp[blueprintId].fragment;
    const available = fragmentBonusManager.getAvailableBuildingsWithBonuses(
      k,
      fragmentName
    );

    if (available.error) {
      return res.status(400).json({ error: available.error });
    }

    res.json({
      ok: true,
      fragment: fragmentName,
      blueprintId,
      availableBuildings: available,
    });
  });

  // Confirm building selection with double warning
  router.post("/hybrid-blueprint/confirm-assignment", requireAuth, requireCsrfToken, async (req, res) => {
    const { blueprintId, buildingType, confirmed } = req.body;
    if (!blueprintId || !buildingType)
      return res.status(400).json({ error: "Missing required fields" });

    const k = await db.get("SELECT id, turn, gold, mana, world_fragments, hybrid_blueprints, fragment_bonuses FROM kingdoms WHERE player_id = $1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    // Check resources
    if (k.gold < 500000)
      return res.status(400).json({ error: "Not enough gold (need 500k)" });
    if (k.mana < 100000)
      return res.status(400).json({ error: "Not enough mana (need 100k)" });

    let hbp = {};
    try {
      hbp = safeJsonParse(k.hybrid_blueprints, {}, "auto:hybrid_blueprints");
    } catch {}

    if (!hbp[blueprintId])
      return res.status(400).json({ error: "Blueprint not found" });
    if (hbp[blueprintId].assigned)
      return res.status(400).json({ error: "Blueprint already assigned" });

    const fragmentName = hbp[blueprintId].fragment;

    // Validate kingdom owns and has studied this fragment
    let worldFragments = [];
    if (Array.isArray(k.world_fragments)) {
      worldFragments = k.world_fragments;
    } else if (typeof k.world_fragments === 'string') {
      worldFragments = safeJsonParse(k.world_fragments, []);
    }

    const ownedFragment = Array.isArray(worldFragments)
      ? worldFragments.find(f => f && f.type === fragmentName)
      : null;

    if (!ownedFragment) {
      return res.status(400).json({ error: `Kingdom does not own fragment '${fragmentName}'` });
    }

    const isStudied = typeof ownedFragment === 'object' && ownedFragment.studied === true;
    if (!isStudied) {
      return res.status(400).json({ error: `Fragment '${fragmentName}' must be studied before attunement` });
    }

    // If not confirmed yet, return warning details
    if (!confirmed) {
      const bonusConfig = fragmentBonusManager.getBonusConfig(
        fragmentName,
        buildingType
      );
      if (!bonusConfig)
        return res.status(400).json({ error: "Invalid building for this fragment" });

      return res.json({
        ok: false,
        warning: true,
        message: "This choice is PERMANENT and cannot be undone",
        details: {
          fragment: fragmentName,
          building: buildingType,
          bonus: bonusConfig,
          cost: { gold: 500000, mana: 100000 },
        },
      });
    }

    // Apply the fragment bonus
    const applyResult = fragmentBonusManager.applyFragmentBonus(
      k,
      fragmentName,
      buildingType
    );

    if (applyResult.error) {
      return res.status(400).json({ error: applyResult.error });
    }

    // Update database
    hbp[blueprintId].assigned = true;
    hbp[blueprintId].building = buildingType;
    const newGold = k.gold - 500000;
    const newMana = k.mana - 100000;

    await db.run(
      "UPDATE kingdoms SET hybrid_blueprints = $1, fragment_bonuses = $2, gold = $3, mana = $4 WHERE id = $5",
      [JSON.stringify(hbp), applyResult.fragment_bonuses, newGold, newMana, k.id]
    );

    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1, $2, $3, $4)",
      [
        k.id,
        "system",
        `âœ¨ Applied ${fragmentName} to ${buildingType.replace(/_/g, " ")}! Bonuses unlocked: ${applyResult.applied.special.name}`,
        k.turn,
      ]
    );

    res.json({
      ok: true,
      message: "Fragment bonus applied successfully",
      applied: applyResult.applied,
      gold: newGold,
      mana: newMana,
    });
  });

  // Legacy endpoint for backward compatibility
  router.post("/assign-hybrid-blueprint", requireAuth, requireCsrfToken, async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "Missing blueprint id" });

    const k = await db.get("SELECT id, turn, gold, mana, hybrid_blueprints FROM kingdoms WHERE player_id = $1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    if (k.gold < 500000)
      return res.status(400).json({ error: "Not enough gold (need 500k)" });
    if (k.mana < 100000)
      return res.status(400).json({ error: "Not enough mana (need 100k)" });

    let hbp = {};
    try {
      hbp = safeJsonParse(k.hybrid_blueprints, {}, "auto:hybrid_blueprints");
    } catch {}
    if (!hbp[id]) return res.status(400).json({ error: "Blueprint not found" });
    if (hbp[id].assigned)
      return res.status(400).json({ error: "Blueprint already assigned" });

    // Assign it
    hbp[id].assigned = true;
    const newGold = k.gold - 500000;
    const newMana = k.mana - 100000;

    await db.run(
      "UPDATE kingdoms SET hybrid_blueprints = $1, gold = $2, mana = $3 WHERE id = $4",
      [JSON.stringify(hbp), newGold, newMana, k.id],
    );

    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1, $2, $3, $4)",
      [
        k.id,
        "system",
        `âœ¨ Assigned a ${hbp[id].fragment} Hybrid Blueprint to ${hbp[id].building.replace("bld_", "").replace(/_/g, " ")}!`,
        k.turn,
      ],
    );

    res.json({
      ok: true,
      hybrid_blueprints: JSON.stringify(hbp),
      gold: newGold,
      mana: newMana,
    });
  });

  router.post("/locations/steal-map", requireAuth, requireCsrfToken, async (req, res) => {
    const { targetId } = req.body;
    const k = await db.get("SELECT id, name, thieves, discovered_kingdoms FROM kingdoms WHERE player_id=$1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const target = await db.get("SELECT id, name, turn, hybrid_blueprints, discovered_kingdoms FROM kingdoms WHERE id=$1", [
      targetId,
    ]);
    if (!target) return res.status(404).json({ error: "Target not found" });
    const successChance = 0.2 + Math.min(0.3, (k.thieves / 1000) * 0.1);
    const success = Math.random() < successChance;
    if (success) {
      let hasLockbox = false;
      let targetHBP = {};
      try {
        targetHBP = safeJsonParse(target.hybrid_blueprints, {}, "auto:target.hybrid_blueprints");
      } catch {}
      for (const key in targetHBP) {
        if (
          targetHBP[key].assigned &&
          targetHBP[key].building === "libraries" &&
          targetHBP[key].fragment === "Dwarven Star-Metal"
        ) {
          hasLockbox = true;
          break;
        }
      }

      if (hasLockbox) {
        return res.json({
          ok: true,
          success: false,
          message: "Target's maps are secured in an Impenetrable Lockbox and cannot be stolen.",
        });
      }

      let targetDisc = {};
      try {
        targetDisc = safeJsonParse(target.discovered_kingdoms, {}, "auto:discovered_kingdoms");
      } catch {}
      const mappedIds = Object.keys(targetDisc).filter(
        (id) => targetDisc[id]?.mapped,
      );
      if (!mappedIds.length)
        return res.json({
          ok: true,
          success: false,
          message: "Target has no location maps to steal.",
        });
      const stolenId = mappedIds[Math.floor(Math.random() * mappedIds.length)];
      const stolenKingdom = await db.get(
        "SELECT name FROM kingdoms WHERE id=$1",
        [stolenId],
      );
      delete targetDisc[stolenId];
      await db.run("UPDATE kingdoms SET discovered_kingdoms=$1 WHERE id=$2", [
        JSON.stringify(targetDisc),
        target.id,
      ]);
      let myDisc = {};
      try {
        myDisc = safeJsonParse(k.discovered_kingdoms, {}, "auto:discovered_kingdoms");
      } catch {}
      myDisc[stolenId] = { found: true, mapped: true };
      await db.run("UPDATE kingdoms SET discovered_kingdoms=$1 WHERE id=$2", [
        JSON.stringify(myDisc),
        k.id,
      ]);
      await db.run(
        "INSERT INTO news (kingdom_id,type,message,turn_num) VALUES ($1,$2,$3,$4)",
        [
          target.id,
          "covert",
          `ðŸ—ºï¸ A thief stole your location map for ${stolenKingdom?.name || "a kingdom"}.`,
          target.turn,
        ],
      );
      await db.run(
        "INSERT INTO war_log (action_type,attacker_id,attacker_name,defender_id,defender_name,outcome,detail,obscured) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          "steal_map",
          k.id,
          k.name,
          target.id,
          target.name,
          "success",
          JSON.stringify({ stolen: stolenKingdom?.name }),
          1,
        ],
      );
      res.json({
        ok: true,
        success: true,
        updates: { discovered_kingdoms: JSON.stringify(myDisc) },
        message: `Thieves stole a location map for ${stolenKingdom?.name || "a kingdom"} from ${target.name}.`,
      });
    } else {
      res.json({
        ok: true,
        success: false,
        message: "Thieves failed to steal a location map.",
      });
    }
  });

  // â"€â"€ Market — Buying resources â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  // â"€â"€ Research focus â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  // â"€â"€ Studies overview â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  router.get("/profile/:name", requireAuth, async (req, res) => {
    try {
      const k = await db.get(
        `
        SELECT k.id, k.name, k.race, k.gender, k.region, k.level, k.xp, k.land, k.population,
               k.fighters, k.mages, k.rangers, k.happiness, k.turn, k.description,
               k.res_military, k.res_economy, k.res_construction, k.res_spellbook,
               k.res_attack_magic, k.res_entertainment,
               p.id as player_id, p.username        FROM kingdoms k JOIN players p ON k.player_id = p.id
        WHERE LOWER(k.name) = LOWER($1)`,
        [req.params.name],
      );
      if (!k) return res.status(404).json({ error: "Kingdom not found" });

      // Phase 3: gate profile to visible or self (authenticated users only)
      const caller = await db.get("SELECT id, visibility, race FROM kingdoms WHERE player_id = $1", [req.player.playerId]);
      if (!caller) {
        return res.status(404).json({ error: "Kingdom not found" });
      }
      const vis = await getKingdomVisibility(db, caller);
      const targetCoords = getKingdomMapCoords({ id: k.id, race: k.race });
      const targetHex = pixelToHex(targetCoords.map_x, targetCoords.map_y);
      if (k.id !== caller.id && !safeBitmapHasCell(vis.seenCells, targetHex.col, targetHex.row)) {
        return res.status(404).json({ error: "Kingdom not visible" });
      }
      const alliance = await db.get(
        `
        SELECT a.name FROM alliances a JOIN alliance_members am ON a.id = am.alliance_id
        WHERE am.kingdom_id = $1`,
        [k.id],
      );
      const news = await db.all(
        `
        SELECT type, message, turn_num FROM news
        WHERE kingdom_id = $1 AND type = 'attack'
        ORDER BY created_at DESC LIMIT 8`,
        [k.id],
      );
      const rankRow = await db.get(
        "SELECT COUNT(*)+1 as rank FROM kingdoms WHERE land > $1 AND id != $2",
        [k.land, k.id],
      );
      res.json({
        ...k,
        alliance: alliance?.name || null,
        news,
        rank: rankRow?.rank || 1,
      });
    } catch (err) {
      console.error("[profile]", err.message);
      res.status(500).json({ error: "Failed to load profile" });
    }
  });

  // â"€â"€ World map data â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  router.get("/world-map", requireAuth, async (req, res) => {
    try {
      const k = await db.get(
        "SELECT id, race, discovered_kingdoms, visibility FROM kingdoms WHERE player_id = $1",
        [req.player.playerId],
      );
      if (!k) return res.status(404).json({ error: "Kingdom not found" });

      let discovered = {};
      try {
        discovered = safeJsonParse(k.discovered_kingdoms, {}, "auto:discovered_kingdoms");
      } catch {}

      // Phase 3: load visibility for seen_cells gating (filter content to revealed hexes)
      const vis = await getKingdomVisibility(db, k);
      const seenCells = vis.seenCells;

      const kingdoms = await db.all(`
        SELECT k.id, k.name, k.race, k.region, k.land, k.level, k.turn        FROM kingdoms k JOIN players p ON k.player_id = p.id
        ORDER BY k.land DESC`);

      const filtered = kingdoms.filter((r) => {
        if (r.id === k.id) return true;
        if (!(discovered[r.id] && discovered[r.id].found)) return false;
        // Phase 3 gating: even discovered kingdoms only visible if their hex is seen
        const coords = getKingdomMapCoords(r);
        const h = pixelToHex(coords.map_x, coords.map_y);
        return safeBitmapHasCell(seenCells, h.col, h.row);
      });

      const kingdomsWithCoords = filtered.map((row) => {
        try {
          const coords = getKingdomMapCoords(row);
          return { ...row, map_x: coords.map_x, map_y: coords.map_y, terrain: getTerrainForRace(row.race) };
        } catch (err) {
          console.error(`[world-map] ERROR computing coords for K${row.id} ${row.name}:`, err.message);
          return { ...row, map_x: 0, map_y: 0, terrain: getTerrainForRace(row.race) };
        }
      });

      const tradeRoutes = await db.all(
        "SELECT * FROM trade_routes WHERE kingdom_id = $1 OR partner_id = $2",
        [k.id, k.id],
      );

      const nodes = await db.all(
        `SELECT id, kingdom_id, name, type, distance, richness, map_x, map_y, terrain
         FROM resource_nodes ORDER BY discovered_at DESC`
      );

      // Phase 3 gating + explicit node reveal: only include nodes in scouted hexes.
      // Scouting an area hex now makes nodes located there visible.
      const visibleNodes = nodes.filter((n) => {
        const h = pixelToHex(n.map_x, n.map_y);
        return safeBitmapHasCell(seenCells, h.col, h.row);
      });

      const expeditions = await db.all(
        `SELECT re.id, re.node_id, re.status, re.population_sent, re.depart_at, re.arrive_at, re.return_at,
                rn.name AS node_name, rn.type AS node_type, rn.map_x, rn.map_y
         FROM resource_expeditions re
         JOIN resource_nodes rn ON re.node_id = rn.id
         WHERE re.kingdom_id = $1 AND re.status NOT IN ('completed', 'intercepted')
         ORDER BY re.depart_at DESC`,
        [k.id],
      );

      // Gate expeditions by seen hex of their node (Phase 3)
      const visibleExpeditions = expeditions.filter((e) => {
        const h = pixelToHex(e.map_x, e.map_y);
        return safeBitmapHasCell(seenCells, h.col, h.row);
      });

      // Dungeon/mountain heart: only the player's own region's locations, and
      // only once discovered — by ANY kingdom, not specifically this one.
      // Locations aren't owned by whichever kingdom scouts them first; once
      // revealed they're public domain for the whole region. Also bypassed
      // entirely when fog of war is disabled (DISABLE_FOG_OF_WAR=true), which
      // bypasses seenCells gating everywhere else in this response too.
      const fogDisabled = process.env.DISABLE_FOG_OF_WAR === 'true';
      const regionLocations = getRegionLocations(k.race);
      const worldLocations = regionLocations
        ? Object.values(regionLocations).filter((loc) => fogDisabled || isPubliclyDiscovered(loc))
        : [];

      // Fog of War Phase 1.5: BigInt can't be JSON-serialized directly, so
      // the seed goes over the wire as a string; the client parses it back
      // to BigInt before feeding it into the same seeded-random mixing the
      // server uses, so terrain biome patterns change across resets too.
      // Phase 4: also expose visibility bitmaps (as decimal strings) so client
      // can render fog overlay (unseen/seen/current states).
      res.json({
        playerKingdomId: k.id,  // Client needs to know which kingdom is the player's
        kingdoms: kingdomsWithCoords,
        tradeRoutes,
        nodes: visibleNodes,
        expeditions: visibleExpeditions,
        worldLocations,
        worldSeed: getWorldSeed().toString(),
        visibility: {
          seenCells: seenCells.toString(),
          currentCells: (vis.currentCells || 0n).toString(),
        },
      });
    } catch {
      // region column may not exist yet — fallback query
      try {
        const k = await db.get(
          "SELECT id, race, discovered_kingdoms, visibility FROM kingdoms WHERE player_id = $1",
          [req.player.playerId],
        );
        let discovered = {};
        if (k)
          try {
            discovered = safeJsonParse(k.discovered_kingdoms, {}, "auto:discovered_kingdoms");
          } catch {}

        // Phase 3 fallback path: visibility for gating
        const vis = k ? await getKingdomVisibility(db, k) : { seenCells: 0n };
        const seenCells = vis.seenCells || 0n;

        const kingdoms = await db.all(`
          SELECT k.id, k.name, k.race, '' as region, k.land, k.level, k.turn          FROM kingdoms k JOIN players p ON k.player_id = p.id
          ORDER BY k.land DESC`);

        const filtered = kingdoms.filter((r) => {
          if (!k) return false;
          if (r.id === k.id) return true;
          if (!(discovered[r.id] && discovered[r.id].found)) return false;
          const coords = getKingdomMapCoords(r);
          const h = pixelToHex(coords.map_x, coords.map_y);
          return safeBitmapHasCell(seenCells, h.col, h.row);
        });

        const kingdomsWithCoords = filtered.map((row) => {
          const coords = getKingdomMapCoords(row);
          return { ...row, map_x: coords.map_x, map_y: coords.map_y, terrain: getTerrainForRace(row.race) };
        });

        const tradeRoutes = k
          ? await db.all(
              "SELECT * FROM trade_routes WHERE kingdom_id = $1 OR partner_id = $2",
              [k.id, k.id],
            )
          : [];

        const nodes = k
          ? await db.all(
              `SELECT id, kingdom_id, name, type, distance, richness, map_x, map_y, terrain
               FROM resource_nodes WHERE kingdom_id = $1 ORDER BY discovered_at DESC`,
              [k.id],
            )
          : [];

        const visibleNodes = nodes.filter((n) => {
          const h = pixelToHex(n.map_x, n.map_y);
          return safeBitmapHasCell(seenCells, h.col, h.row);
        });

        const expeditions = k
          ? await db.all(
              `SELECT re.id, re.node_id, re.status, re.population_sent, re.depart_at, re.arrive_at, re.return_at,
                      rn.name AS node_name, rn.type AS node_type, rn.map_x, rn.map_y
               FROM resource_expeditions re
               JOIN resource_nodes rn ON re.node_id = rn.id
               WHERE re.kingdom_id = $1 AND re.status NOT IN ('completed', 'intercepted')
               ORDER BY re.depart_at DESC`,
              [k.id],
            )
          : [];

        // Phase 3 gating for fallback: filter expeditions by seen hex too.
        const visibleExpeditions = expeditions.filter((e) => {
          const h = pixelToHex(e.map_x, e.map_y);
          return safeBitmapHasCell(seenCells, h.col, h.row);
        });

        const fogDisabled = process.env.DISABLE_FOG_OF_WAR === 'true';
        const regionLocations = k ? getRegionLocations(k.race) : null;
        const worldLocations = regionLocations
          ? Object.values(regionLocations).filter((loc) => fogDisabled || isPubliclyDiscovered(loc))
          : [];

        // Fog of War Phase 1.5: BigInt can't be JSON-serialized directly, so
      // the seed goes over the wire as a string; the client parses it back
      // to BigInt before feeding it into the same seeded-random mixing the
      // server uses, so terrain biome patterns change across resets too.
      res.json({
        playerKingdomId: k ? k.id : null,
        kingdoms: kingdomsWithCoords,
        tradeRoutes,
        nodes: visibleNodes,
        expeditions: visibleExpeditions,
        worldLocations,
        worldSeed: getWorldSeed().toString(),
        visibility: {
          seenCells: seenCells.toString(),
          currentCells: (vis.currentCells || 0n).toString(),
        },
      });
      } catch (err2) {
        console.error("[world-map]", err2.message);
        res.status(500).json({ error: "Failed to load map data" });
      }
    }
  });

  // GET /world-river-flow - Phase 2 elevation river-flow DAG (downhill graph
  // + flow accumulation per hex). Computed once at boot (db/schema.js) and
  // cached — these functions had zero callers anywhere before this. Note:
  // the world map's actually-rendered rivers still come from the separate
  // buildRiverNetwork lake/MST system in game/world-hex-grid.js; switching
  // the renderer to this flow-accumulation data is a distinct follow-up.
  router.get("/world-river-flow", requireAuth, async (_req, res) => {
    try {
      const { hasFlowData, getFlowData } = require("../game/world-elevation-cache");
      if (!hasFlowData()) {
        return res.status(503).json({ error: "River flow data not ready yet" });
      }
      const { dag, flow } = getFlowData();
      res.json({ dag, flow });
    } catch (err) {
      console.error("[world-river-flow]", err.message);
      res.status(500).json({ error: "Failed to load river flow data" });
    }
  });

  router.post("/rebirth", requireAuth, requireCsrfToken, async (req, res) => {
    const k = await db.get("SELECT id, level, prestige_level, land, turn FROM kingdoms WHERE player_id = $1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    if (!commandHandler.canPrestige(k))
      return res
        .status(400)
        .json({ error: "Require Kingdom Level 50 to Rebirth." });

    const result = await commandHandler.handle({ type: 'prestige' }, { kingdom: k });
    await applyUpdates(db, k.id, result.updates);

    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)",
      [
        k.id,
        "system",
        "ðŸŒŒ YOU HAVE TRANSCENDED. A new era begins for your empire!",
        result.updates.turn,
      ],
    );

    res.json({ ok: true, prestige_level: result.updates.prestige_level, updates: structureUpdates(result.updates) });
  });

  router.get("/lore-and-achievements", requireAuth, async (req, res) => {
    try {
      const k = await db.get(
        "SELECT race, collected_lore, achievements, population, gold, mana, bld_farms, bld_granaries, bld_barracks, bld_outposts, bld_guard_towers, bld_schools, bld_armories, bld_vaults, bld_smithies, bld_markets, bld_mage_towers, bld_shrines, bld_mausoleums, bld_taverns, bld_libraries, bld_housing, bld_walls, bld_training, bld_castles, bld_woodyard, bld_lumber_camp, bld_sawmill, bld_gravel_pit, bld_blockfield, bld_stone_quarry, bld_open_pit, bld_strip_mine, bld_deep_mine FROM kingdoms WHERE player_id = $1",
        [req.player.playerId],
      );
      if (!k) return res.status(404).json({ error: "Kingdom not found" });

      let collectedLore = [];
      try {
        let raw = k.collected_lore;
        // In case it's stored as 'null' literally, or similar
        if (!raw || raw === "null") raw = "[]";
        collectedLore = JSON.parse(raw);
        if (!Array.isArray(collectedLore)) collectedLore = [];
      } catch {
        collectedLore = [];
      }

      let achievements = [];
      try {
        let rawAch = k.achievements;
        if (!rawAch || rawAch === "null") rawAch = "[]";
        achievements = JSON.parse(rawAch);
        if (!Array.isArray(achievements)) achievements = [];
      } catch {
        achievements = [];
      }

      const LORE = config.LORE_EVENTS;
      const ACHIEVEMENT_DEFS = config.ACHIEVEMENTS || {};

      const filterLore = (categoryList) => {
        return (categoryList || [])
          .filter((l, idx) => idx === 0 || collectedLore.includes(l.id))
          .map((l) => ({ id: l.id, title: l.title, msg: l.msg }));
      };

      // Filter completed achievements to valid strings
      const completedAchIds = achievements.filter(ach => typeof ach === 'string' && ach.length > 0);
      const completedSet = new Set(completedAchIds);

      // Calculate progress for achievements
      const getAchievementProgress = (achId) => {
        switch(achId) {
          case 'ach_founder': {
            // Progress: any building built = 100%
            const totalBuildings = Object.values(config.BUILDING_COL)
              .filter(col => col.startsWith('bld_'))
              .reduce((sum, col) => sum + (parseInt(k[col], 10) || 0), 0);
            return { current: Math.min(totalBuildings, 1), target: 1, label: `${totalBuildings} building${totalBuildings !== 1 ? 's' : ''}` };
          }
          case 'ach_warlord': {
            const warlordPop = parseInt(k.population, 10) || 0;
            return { current: warlordPop, target: 50000, label: `${warlordPop.toLocaleString()} / 50,000` };
          }
          case 'ach_constructor': {
            const totalBlds = Object.values(config.BUILDING_COL)
              .filter(col => col.startsWith('bld_'))
              .reduce((sum, col) => sum + (parseInt(k[col], 10) || 0), 0);
            return { current: totalBlds, target: 1500, label: `${totalBlds} / 1,500` };
          }
          case 'ach_colossus': {
            const colossusPopulation = parseInt(k.population, 10) || 0;
            return { current: colossusPopulation, target: 10000000, label: `${colossusPopulation.toLocaleString()} / 10,000,000` };
          }
          case 'ach_wealthy': {
            const wealthyGold = parseInt(k.gold, 10) || 0;
            return { current: wealthyGold, target: 10000000, label: `${wealthyGold.toLocaleString()} / 10,000,000` };
          }
          case 'ach_arcane': {
            const arcaneMana = parseInt(k.mana, 10) || 0;
            return { current: arcaneMana, target: 1000000, label: `${arcaneMana.toLocaleString()} / 1,000,000` };
          }
          case 'ach_grandmaster': {
            const towers = parseInt(k.bld_mage_towers, 10) || 0;
            const libs = parseInt(k.bld_libraries, 10) || 0;
            const schools = parseInt(k.bld_schools, 10) || 0;
            const min = Math.min(towers, libs, schools);
            return {
              current: min,
              target: 25,
              label: `${towers}/${libs}/${schools}`,
              sublabel: 'Towers/Libraries/Schools'
            };
          }
          default:
            return { current: 0, target: 1, label: 'Unknown' };
        }
      };

      // Create objects for all achievements (completed and uncompleted)
      const achievementObjects = Object.entries(ACHIEVEMENT_DEFS).map(([achId, def]) => {
        const isCompleted = completedSet.has(achId);
        const progress = !isCompleted ? getAchievementProgress(achId) : null;
        return {
          id: achId,
          title: def.title || achId.replace(/^ach_/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          completed: isCompleted,
          ...(isCompleted && {
            description: def.description || '',
            reward: def.reward || '',
          }),
          ...(!isCompleted && progress && {
            description: def.description || '',
            progress: {
              current: progress.current,
              target: progress.target,
              percent: Math.min(100, Math.floor((progress.current / progress.target) * 100)),
              label: progress.label,
              sublabel: progress.sublabel || null,
            },
          }),
        };
      });

      res.json({
        raceLore: filterLore(LORE[k.race]),
        narmirLore: filterLore(LORE["narmir"]),
        generalLore: filterLore(LORE["general"]),
        achievements: achievementObjects,
      });
    } catch (err) {
      console.error("Error in /lore-and-achievements:", err);
      console.error("[lore] GET lore-and-achievements:", err.message);
      res.status(500).json({ error: "Failed to load lore" });
    }
  });



  // â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  // RESOURCE GATHERING SYSTEM
  // â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  // GET /resource-nodes — list world-seeded nodes this kingdom has revealed
  // (scouted into view via fog of war), each annotated with hex distance
  // from home and the turn cost to travel there and back (1.5 turns/hex,
  // matching game/location-distance.js's dungeon/mountain convention).
  router.get('/resource-nodes', requireAuth, async (req, res) => {
    try {
      const k = await db.get('SELECT id, race, visibility FROM kingdoms WHERE player_id = $1', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      const vis = await getKingdomVisibility(db, k);
      const homeCoords = getKingdomMapCoords(k);

      const nodes = await db.all('SELECT * FROM resource_nodes WHERE kingdom_id IS NULL ORDER BY id ASC');
      const revealed = nodes
        .filter((n) => {
          const h = pixelToHex(n.map_x, n.map_y);
          return safeBitmapHasCell(vis.seenCells, h.col, h.row);
        })
        .map((n) => {
          const hexDistance = hexUnitDistance(homeCoords.map_x, homeCoords.map_y, n.map_x, n.map_y);
          return {
            ...n,
            hex_distance: Math.round(hexDistance * 10) / 10,
            travel_turns: Math.ceil(hexDistance * 1.5),
          };
        });

      res.json(revealed);
    } catch (e) {
      console.error('[resource-nodes] GET:', e.message);
      res.status(500).json({ error: 'Failed to load resource nodes' });
    }
  });

  // GET /resource-harvests — list this kingdom's active turn-based harvest engagements
  router.get('/resource-harvests', requireAuth, async (req, res) => {
    try {
      const k = await db.get('SELECT id FROM kingdoms WHERE player_id = $1', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });
      const harvests = await db.all(
        `SELECT rh.*, rn.name as node_name
         FROM resource_harvests rh
         JOIN resource_nodes rn ON rh.node_id = rn.id
         WHERE rh.kingdom_id = $1 AND rh.turns_left > 0
         ORDER BY rh.created_at DESC`,
        [k.id],
      );
      res.json(harvests);
    } catch (e) {
      console.error('[resource-harvests] GET:', e.message);
      res.status(500).json({ error: 'Failed to load resource harvests' });
    }
  });

  // POST /resource-harvest/launch — send population to harvest a revealed node.
  // Travel turns are fixed by distance; harvest turns are player-chosen
  // (higher turns = higher yield). Food for the whole engagement (travel
  // there + harvest + travel back) is deducted upfront, matching how
  // dungeon/mountain/epic-trek expeditions already charge food up front.
  router.post('/resource-harvest/launch', requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const { nodeId, population, harvestTurns } = req.body;
      const pop = parseInt(population, 10);
      const hTurns = parseInt(harvestTurns, 10);
      if (!nodeId || !Number.isInteger(pop) || pop < 1) {
        return res.status(400).json({ error: 'nodeId and a positive population are required' });
      }
      if (!Number.isInteger(hTurns) || hTurns < 1) {
        return res.status(400).json({ error: 'harvestTurns must be a positive integer' });
      }

      const k = await db.get('SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      const node = await db.get('SELECT * FROM resource_nodes WHERE id = $1 AND kingdom_id IS NULL', [nodeId]);
      if (!node) return res.status(404).json({ error: 'Node not found' });

      const vis = await getKingdomVisibility(db, k);
      const nodeHex = pixelToHex(node.map_x, node.map_y);
      if (!safeBitmapHasCell(vis.seenCells, nodeHex.col, nodeHex.row)) {
        return res.status(400).json({ error: 'You have not revealed this node yet' });
      }

      const homeCoords = getKingdomMapCoords(k);
      const hexDistance = hexUnitDistance(homeCoords.map_x, homeCoords.map_y, node.map_x, node.map_y);
      const travelTurns = Math.ceil(hexDistance * 1.5);
      const totalTurns = travelTurns + hTurns;

      const onHarvest = await db.get(
        "SELECT COALESCE(SUM(population_sent), 0) as total FROM resource_harvests WHERE kingdom_id = $1 AND turns_left > 0",
        [k.id],
      );
      const freePop = Math.max(0, (k.population || 0) - commandHandler.totalHiredUnits(k) - Number(onHarvest.total));
      if (pop > freePop) {
        return res.status(400).json({ error: `Only ${freePop.toLocaleString()} free population available.` });
      }

      const FOOD_PER_POP_PER_TURN = 0.5; // matches the Mountain's Heart expedition's away-from-home food rate
      const foodNeeded = Math.ceil(pop * totalTurns * FOOD_PER_POP_PER_TURN);
      if (k.food < foodNeeded) {
        return res.status(400).json({ error: `Requires ${foodNeeded.toLocaleString()} food for the journey (you have ${Math.floor(k.food).toLocaleString()}).` });
      }

      await db.run('BEGIN TRANSACTION');
      try {
        const deduct = await db.run(
          'UPDATE kingdoms SET food = GREATEST(0, food - $1), population = GREATEST(0, population - $2) WHERE id = $3 AND food >= $4 AND population >= $5',
          [foodNeeded, pop, k.id, foodNeeded, pop],
        );
        if (deduct.changes === 0) {
          await db.run('ROLLBACK');
          return res.status(400).json({ error: 'Insufficient food or population (concurrent change).' });
        }
        await db.run(
          `INSERT INTO resource_harvests
             (kingdom_id, node_id, population_sent, travel_turns, harvest_turns, turns_left, food_taken, resource_type, richness)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [k.id, nodeId, pop, travelTurns, hTurns, totalTurns, foodNeeded, node.type, node.richness],
        );
        await db.run('COMMIT');
      } catch (txErr) {
        await db.run('ROLLBACK');
        throw txErr;
      }

      res.json({ ok: true, travelTurns, totalTurns, foodTaken: foodNeeded });
    } catch (e) {
      console.error('[resource-harvest/launch] POST:', e.message);
      res.status(500).json({ error: 'Failed to launch harvest' });
    }
  });

  // POST /scout-area — Fog of War Phase 3: frontier-only hex area scouting.
  // Reveals the target hex + splash radius based on rangers/level.
  // Area scouting reveals nodes whose positions fall inside the scouted hexes (user requirement).
  // Auto-adds any kingdoms in newly revealed hexes to discovered_kingdoms.
  router.post('/scout-area', requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const { col, row, rangers } = req.body || {};
      const targetCol = parseInt(col, 10);
      const targetRow = parseInt(row, 10);
      const rangersSent = parseInt(rangers, 10);

      if (!Number.isInteger(targetCol) || !Number.isInteger(targetRow)) {
        return res.status(400).json({ error: 'col and row (hex coordinates) required' });
      }
      if (!Number.isInteger(rangersSent) || rangersSent < 1) {
        return res.status(400).json({ error: 'rangers (positive integer) required' });
      }

      // Load kingdom (include visibility + fields for costs/allocation)
      const k = await db.get(
        'SELECT id, player_id, race, food, rangers, troop_levels, visibility, discovered_kingdoms FROM kingdoms WHERE player_id = $1',
        [req.player.playerId]
      );
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      // Validate ranger allocation for this action (scouting pool) - check against active expeditions
      const totalRangers = Number(k.rangers) || 0;
      const expRangersRow = await db.get(
        `SELECT COALESCE(SUM(rangers), 0) as r FROM expeditions WHERE kingdom_id = $1 AND turns_left > 0`,
        [k.id]
      );
      const currentExpRangers = Number(expRangersRow.r) || 0;
      const allocCheck = validateRangerAllocation({ scouting: rangersSent, expeditions: currentExpRangers }, totalRangers);
      if (!allocCheck.valid) {
        return res.status(400).json({ error: allocCheck.reason });
      }

      // Ranger level from troop data (for power + food discount)
      const rangerLevel = parseTroopLevel(k.troop_levels || {}, 'rangers') || 1;

      if (!isValidCell(targetCol, targetRow)) {
        return res.status(400).json({ error: 'Invalid hex coordinates' });
      }

      // Current visibility (lazy seeds home hex)
      const vis = await getKingdomVisibility(db, k);

      // Reject re-scout (no cost charged)
      if (safeBitmapHasCell(vis.seenCells, targetCol, targetRow)) {
        return res.status(400).json({ error: 'Already scouted', alreadySeen: true });
      }

      // Frontier check: target must be adjacent to at least one currently seen hex.
      // Uses extracted production helper from game/hex-utils (so tests validate real code, not inline duplication).
      if (!isFrontier(targetCol, targetRow, (c, r) => safeBitmapHasCell(vis.seenCells, c, r))) {
        return res.status(400).json({ error: 'Target hex is not on the frontier (must be adjacent to known territory)' });
      }

      // Compute cells: target + splash
      const radius = scoutRevealRadius(rangersSent, rangerLevel);
      let cellsToConsider = getHexesInRadius(targetCol, targetRow, radius);
      // Guarantee target
      if (!cellsToConsider.some((c) => c.col === targetCol && c.row === targetRow)) {
        cellsToConsider = cellsToConsider.concat([{ col: targetCol, row: targetRow }]);
      }

      // Apply reveals (only new)
      let newSeen = vis.seenCells;
      const newlyRevealed = [];
      for (const cell of cellsToConsider) {
        if (!safeBitmapHasCell(newSeen, cell.col, cell.row)) {
          newSeen = safeBitmapAddCell(newSeen, cell.col, cell.row);
          newlyRevealed.push(cell);
        }
      }
      if (newlyRevealed.length === 0) {
        return res.status(400).json({ error: 'No new hexes revealed' });
      }

      // Costs: food per *newly* revealed hex — average terrain food mult on those hexes (FoW 5C frontier)
      let foodCost = 0;
      try {
        const { getTerrainScoutModifiers, getKingdomScoutFoodMult } = require('../game/terrain-scout');
        const { getTerrainAt, hasHexGrid } = require('../game/world-hex-grid-cache');
        const homeMult = getKingdomScoutFoodMult(k);
        for (const cell of newlyRevealed) {
          let mult = homeMult;
          if (hasHexGrid()) {
            const t = getTerrainAt(cell.col, cell.row);
            if (t) mult = getTerrainScoutModifiers(t).foodCostMult;
          }
          foodCost += scoutFoodCostPerHex(rangerLevel, mult);
        }
      } catch {
        foodCost = scoutFoodCostPerHex(rangerLevel) * newlyRevealed.length;
      }
      const currentFood = Number(k.food) || 0;
      if (currentFood < foodCost) {
        return res.status(400).json({ error: `Not enough food (need ${foodCost})` });
      }

      // === Critical section under single transaction for atomicity (concurrency safety) ===
      await db.withTransaction(async () => {
        // Persist visibility update (seen + current for v1) — helper also uses withTransaction internally but we are already in one
        await updateKingdomVisibility(db, k.id, (current) => ({
          seenCells: newSeen,
          currentCells: newSeen,
          version: current.version || 1,
        }));

        // Spend food atomically with check
        if (foodCost > 0) {
          const foodResult = await db.run(
            'UPDATE kingdoms SET food = food - $1 WHERE id = $2 AND food >= $1',
            [foodCost, k.id]
          );
          if (foodResult.changes === 0) {
            throw new Error('Insufficient food (concurrent change)');
          }
        }

        // Auto-add kingdoms located in newly revealed hexes to discovered_kingdoms (plan rule)
        let disc = safeJsonParse(k.discovered_kingdoms, {});
        if (Object.prototype.toString.call(disc) !== '[object Object]') disc = {};
        let discUpdated = false;
        const otherKingdoms = await db.all('SELECT id, race FROM kingdoms WHERE id != $1', [k.id]);
        for (const ok of otherKingdoms) {
          const coords = getKingdomMapCoords({ id: ok.id, race: ok.race });
          const h = pixelToHex(coords.map_x, coords.map_y);
          const matchesNew = newlyRevealed.some((c) => c.col === h.col && c.row === h.row);
          if (matchesNew && !disc[ok.id]) {
            disc[ok.id] = { found: true };
            discUpdated = true;
          }
        }
        if (discUpdated) {
          await db.run('UPDATE kingdoms SET discovered_kingdoms = $1 WHERE id = $2', [JSON.stringify(disc), k.id]);
        }

        // Explicitly surface nodes in the newly revealed hexes (user requirement)
        const newlyKeys = new Set(newlyRevealed.map((c) => `${c.col},${c.row}`));
        const playerNodes = await db.all('SELECT id, map_x, map_y FROM resource_nodes WHERE kingdom_id = $1', [k.id]);
        for (const nd of playerNodes) {
          const h = pixelToHex(nd.map_x, nd.map_y);
          if (newlyKeys.has(`${h.col},${h.row}`)) {
            await db.run(
              'UPDATE resource_nodes SET discovered_at = COALESCE(discovered_at, ?) WHERE id = ?',
              [Math.floor(Date.now() / 1000), nd.id]
            );
          }
        }
      });

      res.json({
        ok: true,
        revealedHexes: newlyRevealed.length,
        radius,
        foodSpent: foodCost,
        rangersUsed: rangersSent,
        newlyRevealed,
      });
    } catch (e) {
      console.error('[scout-area] POST:', e.message);
      if (e.message && e.message.includes('Insufficient food')) {
        return res.status(400).json({ error: 'Not enough food (concurrent change)' });
      }
      res.status(500).json({ error: 'Failed to scout area' });
    }
  });

  // POST /resource-upgrade — purchase stage 2 or 3 upgrade for a resource type
  router.post('/resource-upgrade', requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const { type, toStage } = req.body;
      if (!['wood','stone','iron'].includes(type)) return res.status(400).json({ error: 'Invalid resource type.' });
      if (![2,3].includes(Number(toStage))) return res.status(400).json({ error: 'toStage must be 2 or 3.' });
      const stage = Number(toStage);

      const k = await db.get(
        `SELECT id, level, resource_sequence, gold, wood, stone, iron,
                bld_woodyard, bld_gravel_pit, bld_open_pit,
                bld_lumber_camp, bld_blockfield, bld_strip_mine
         FROM kingdoms WHERE player_id = $1`,
        [req.player.playerId]
      );
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      const level = k.level || 1;
      const currentBracket = Math.floor((level - 1) / 10);
      const resSeq = safeJsonParse(k.resource_sequence, {}, 'resource-upgrade:resource_sequence');
      const typeSeq = resSeq[type] || { s2_paid_at_bracket: -1, s3_paid_at_bracket: -1, last_s3_bracket: -1 };

      if (stage === 2) {
        // Prerequisites check
        const s1ColMap = { wood: 'bld_woodyard', stone: 'bld_gravel_pit', iron: 'bld_open_pit' };
        const s1Col = s1ColMap[type];
        if ((k[s1Col] || 0) < 3) return res.status(400).json({ error: `Need at least 3 ${s1Col.replace('bld_','')} to unlock stage 2.` });

        const resColMap = { wood: 'wood', stone: 'stone', iron: 'iron' };
        const resCol = resColMap[type];
        if ((k[resCol] || 0) < 200) return res.status(400).json({ error: `Need 200 ${type} stockpile.` });
        if (k.gold < 10000) return res.status(400).json({ error: 'Need 10,000 gold.' });

        // Check not already paid for this bracket
        if (typeSeq.s2_paid_at_bracket > -1) {
          return res.status(400).json({ error: 'Stage 2 upgrade already purchased.' });
        }

        const updatedSeq = { ...resSeq };
        if (!updatedSeq[type]) updatedSeq[type] = { s2_paid_at_bracket: -1, s3_paid_at_bracket: -1, last_s3_bracket: -1 };
        updatedSeq[type].s2_paid_at_bracket = currentBracket;

        await db.run(
          `UPDATE kingdoms SET gold = gold - 10000, ${resCol} = ${resCol} - 200, resource_sequence = $1 WHERE id = $2`,
          [JSON.stringify(updatedSeq), k.id]
        );

        return res.json({ ok: true, message: `Stage 2 ${type} upgrade purchased.` });
      }

      if (stage === 3) {
        // Prerequisites check
        const s2ColMap = { wood: 'bld_lumber_camp', stone: 'bld_blockfield', iron: 'bld_strip_mine' };
        const s2Col = s2ColMap[type];
        if ((k[s2Col] || 0) < 5) return res.status(400).json({ error: `Need at least 5 ${s2Col.replace('bld_','')} to unlock stage 3.` });

        const crossResCol = type === 'iron' ? 'stone' : 'iron';
        if ((k[type] || 0) < 1000) return res.status(400).json({ error: `Need 1000 ${type} stockpile.` });
        if ((k[crossResCol] || 0) < 500) return res.status(400).json({ error: `Need 500 ${crossResCol} stockpile.` });
        if (k.gold < 100000) return res.status(400).json({ error: 'Need 100,000 gold.' });

        if (typeSeq.s3_paid_at_bracket > -1) {
          return res.status(400).json({ error: 'Stage 3 upgrade already purchased.' });
        }

        const updatedSeq = { ...resSeq };
        if (!updatedSeq[type]) updatedSeq[type] = { s2_paid_at_bracket: -1, s3_paid_at_bracket: -1, last_s3_bracket: -1 };
        updatedSeq[type].s3_paid_at_bracket = currentBracket;

        await db.run(
          `UPDATE kingdoms SET gold = gold - 100000, ${type} = ${type} - 1000, ${crossResCol} = ${crossResCol} - 500, resource_sequence = $1 WHERE id = $2`,
          [JSON.stringify(updatedSeq), k.id]
        );

        return res.json({ ok: true, message: `Stage 3 ${type} upgrade purchased.` });
      }
    } catch (e) {
      console.error('[resource-upgrade] POST:', e.message);
      res.status(500).json({ error: 'Failed to process resource upgrade' });
    }
  });

  // â"€â"€ Inventory â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  router.get('/inventory', requireAuth, async (req, res) => {
    try {
      const k = await db.get('SELECT id, items FROM kingdoms WHERE player_id = $1', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      const { INVENTORY_ITEMS } = config;
      let items = safeJsonParse(k.items, [], 'inventory:items');
      if (!Array.isArray(items)) items = [];

      // Format inventory with descriptions
      const formatted = {};
      const deprecated = [];
      for (const item of items) {
        if (item.qty && item.qty > 0) {
          if (INVENTORY_ITEMS[item.id]) {
            formatted[item.id] = {
              name: INVENTORY_ITEMS[item.id].name,
              desc: INVENTORY_ITEMS[item.id].desc,
              count: item.qty,
              rarity: INVENTORY_ITEMS[item.id].rarity
            };
          } else if (!item.name?.includes('Fragment')) {
            // Log non-fragment deprecated items
            deprecated.push(`${item.id}Ã—${item.qty}`);
          }
        }
      }

      // Log deprecated items once per kingdom per process (the inventory endpoint is
      // polled frequently, so logging on every request just spams the error stream).
      if (deprecated.length > 0 && !_loggedDeprecatedInventory.has(k.id)) {
        _loggedDeprecatedInventory.add(k.id);
        console.warn(`[inventory] Kingdom ${k.id} has deprecated items: ${deprecated.join(', ')}`);
      }

      res.json(formatted);
    } catch (err) {
      console.error('[inventory] failed:', err.message);
      res.status(500).json({ error: 'Failed to fetch inventory' });
    }
  });

  // â"€â"€ WORLD FRAGMENT ATTUNEMENTS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  // GET /api/kingdom/attunements — Get current attunement status
  router.get('/attunements', requireAuth, async (req, res) => {
    try {
      const kingdom = await db.get("SELECT id, fragment_bonuses, world_fragments FROM kingdoms WHERE player_id = $1", [
        req.player.playerId,
      ]);
      if (!kingdom) return res.status(404).json({ error: "Kingdom not found" });

      const status = attunementManager.getAttunementStatus(kingdom);
      res.json({
        ok: true,
        attunements: status,
        total: status.length,
      });
    } catch (err) {
      console.error('[attunement] get status failed:', err.message);
      res.status(500).json({ error: 'Failed to fetch attunement status' });
    }
  });

  // GET /api/kingdom/available-attunements — Get available attunement options
  router.get('/available-attunements', requireAuth, async (req, res) => {
    try {
      const kingdom = await db.get(
        `SELECT id, fragment_bonuses, world_fragments, bld_farms, bld_barracks, bld_markets,
                bld_schools, bld_mage_towers, bld_shrines, bld_guard_towers, bld_castles,
                bld_smithies, bld_libraries, bld_taverns, bld_mausoleums, bld_walls,
                bld_outposts, bld_granaries, bld_housing, bld_training, bld_vaults, bld_armories
         FROM kingdoms WHERE player_id = $1`,
        [req.player.playerId]
      );
      if (!kingdom) return res.status(404).json({ error: "Kingdom not found" });

      const available = attunementManager.getAvailableAttunements(kingdom);
      res.json({
        ok: true,
        available,
        count: available.reduce((sum, f) => sum + f.buildings.length, 0),
      });
    } catch (err) {
      console.error('[attunement] get available failed:', err.message);
      res.status(500).json({ error: 'Failed to fetch available attunements' });
    }
  });

  // POST /api/kingdom/attune-fragment — Apply a fragment attunement to a building
  router.post('/attune-fragment', requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const { fragmentName, buildingType } = req.body;

      // Validate input
      if (!fragmentName || !buildingType) {
        return res.status(400).json({ error: 'fragmentName and buildingType required' });
      }

      const kingdom = await db.get(
        `SELECT id, turn, fragment_bonuses, world_fragments, bld_farms, bld_barracks, bld_markets,
                bld_schools, bld_mage_towers, bld_shrines, bld_guard_towers, bld_castles,
                bld_smithies, bld_libraries, bld_taverns, bld_mausoleums, bld_walls,
                bld_outposts, bld_granaries, bld_housing, bld_training, bld_vaults, bld_armories
         FROM kingdoms WHERE player_id = $1`,
        [req.player.playerId]
      );
      if (!kingdom) return res.status(404).json({ error: "Kingdom not found" });

      // Apply attunement logic
      const result = attunementManager.applyAttunement(kingdom, fragmentName, buildingType);
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }

      await db.run(
        `UPDATE kingdoms SET fragment_bonuses = $1 WHERE id = $2`,
        [result.fragment_bonuses, kingdom.id]
      );

      await db.run(
        "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1, $2, $3, $4)",
        [
          kingdom.id,
          "system",
          repairMojibake(
            `âœ¨ ${fragmentName} attuned to ${buildingType.replace(/_/g, " ")}! ${result.attunement.special?.name ? `${result.attunement.special.name}.` : "Fragment power resonates through the structure."}`,
          ),
          kingdom.turn || 0,
        ]
      );

      res.json({
        ok: true,
        attunement: result.attunement,
        message: `${fragmentName} attuned to ${buildingType}`,
      });

      devLog(`[attunement] Kingdom ${kingdom.id}: ${fragmentName} â†’ ${buildingType}`);
    } catch (err) {
      console.error('[attunement] apply failed:', err.message);
      res.status(500).json({ error: 'Failed to apply attunement' });
    }
  });

  // POST /api/kingdom/remove-attunement — Remove fragment attunement from building
  router.post('/remove-attunement', requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const { buildingType } = req.body;

      if (!buildingType) {
        return res.status(400).json({ error: 'buildingType required' });
      }

      await db.run("BEGIN TRANSACTION");
      try {
        const kingdom = await db.get("SELECT id, fragment_bonuses FROM kingdoms WHERE player_id = $1 FOR UPDATE", [
          req.player.playerId,
        ]);
        if (!kingdom) {
          await db.run("ROLLBACK");
          return res.status(404).json({ error: "Kingdom not found" });
        }

        // Check if any synergy cooldown is active — if so, block removal to prevent synergy-hopping
        const now = Math.floor(Date.now() / 1000);
        const activeCooldown = await db.get(
          "SELECT synergy_id FROM synergy_cooldowns WHERE kingdom_id = $1 AND cooldown_until > $2 LIMIT 1",
          [kingdom.id, now]
        );
        if (activeCooldown) {
          await db.run("ROLLBACK");
          return res.status(429).json({
            error: "Cannot remove attunements while a synergy cooldown is active. Wait for the cooldown to expire.",
          });
        }

        const currentAttunements = getKingdomAttunements(kingdom.fragment_bonuses || '{}');

        if (!Object.prototype.hasOwnProperty.call(currentAttunements, buildingType)) {
          await db.run("ROLLBACK");
          return res.status(400).json({ error: `${buildingType} has no attunement` });
        }

        delete currentAttunements[buildingType];

        await db.run(
          `UPDATE kingdoms SET fragment_bonuses = $1 WHERE id = $2`,
          [JSON.stringify(currentAttunements), kingdom.id]
        );

        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1, $2, $3, $4)",
          [
            kingdom.id,
            "system",
            repairMojibake(
              `âœ¨ Attunement removed from ${buildingType.replace(/_/g, " ")}. The fragment's resonance fades.`,
            ),
            kingdom.turn || 0,
          ]
        );

        await db.run("COMMIT");

        res.json({
          ok: true,
          message: `Attunement removed from ${buildingType}`,
        });

        devLog(`[attunement] Kingdom ${kingdom.id}: Removed from ${buildingType}`);
      } catch (txErr) {
        await db.run("ROLLBACK").catch(() => {});
        throw txErr;
      }
    } catch (err) {
      console.error('[attunement] remove failed:', err.message);
      res.status(500).json({ error: 'Failed to remove attunement' });
    }
  });

  // GET /api/kingdom/contributing-synergies — Check which synergies a building/fragment contributes to
  // Returns an opaque "resonance" tier instead of the synergy recipes so the
  // client can't reveal the formula via devtools — players discover combos
  // by experimentation, not by reading network responses.
  router.get('/contributing-synergies', requireAuth, async (req, res) => {
    try {
      const { building_type, fragment_name } = req.query;
      if (!building_type || !fragment_name) {
        return res.status(400).json({ error: 'building_type and fragment_name required' });
      }

      const contributing = attunementManager.getContributingSynergies(building_type, fragment_name);

      let resonanceTier = null;
      if (contributing.length > 0) {
        const kingdom = await db.get(
          "SELECT fragment_bonuses FROM kingdoms WHERE player_id = $1",
          [req.player.playerId]
        );
        const placements = {};
        if (kingdom) {
          const atts = getKingdomAttunements(kingdom.fragment_bonuses || '{}');
          for (const [bld, att] of Object.entries(atts)) {
            if (att) placements[bld] = att;
          }
        }
        let best = 0;
        for (const syn of contributing) {
          const reqs = syn.requiredFragments || {};
          let satisfied = 0;
          for (const [fragName, reqBld] of Object.entries(reqs)) {
            if (placements[reqBld] === fragName) satisfied++;
          }
          if (satisfied > best) best = satisfied;
        }
        if (best >= 7) resonanceTier = 'convergence';
        else if (best >= 4) resonanceTier = 'alignment';
        else resonanceTier = 'faint';
      }

      res.json({
        // Keep names/emojis out — they would let players reverse-engineer
        // which combos contribute. Only signal whether ANY contribution exists.
        contributes: contributing.length > 0,
        contributingCount: contributing.length,
        resonanceTier,
      });
    } catch (err) {
      console.error('[synergy] contributing check failed:', err.message);
      res.status(500).json({ error: 'Failed to check contributing synergies' });
    }
  });

  // GET /api/kingdom/synergy-status — Get active synergy and near-activation hints
  router.get('/synergy-status', requireAuth, async (req, res) => {
    try {
      const kingdom = await db.get(
        "SELECT id, fragment_bonuses FROM kingdoms WHERE player_id = $1",
        [req.player.playerId]
      );
      if (!kingdom) {
        return res.status(404).json({ error: 'Kingdom not found' });
      }

      const status = attunementManager.getSynergyStatus(kingdom);
      res.json(status);
    } catch (err) {
      console.error('[synergy] get status failed:', err.message);
      res.status(500).json({ error: 'Failed to fetch synergy status' });
    }
  });

  // GET /api/kingdom/synergy-cooldown — Check cooldown status for a synergy ability
  router.get('/synergy-cooldown', requireAuth, async (req, res) => {
    try {
      const { synergy_id } = req.query;
      if (!synergy_id) {
        return res.status(400).json({ error: 'synergy_id required' });
      }

      const kingdom = await db.get(
        "SELECT id FROM kingdoms WHERE player_id = $1",
        [req.player.playerId]
      );
      if (!kingdom) {
        return res.status(404).json({ error: 'Kingdom not found' });
      }

      // Check if cooldown exists in database
      const cooldown = await db.get(
        "SELECT cooldown_until FROM synergy_cooldowns WHERE kingdom_id = $1 AND synergy_id = $2",
        [kingdom.id, synergy_id]
      );

      if (!cooldown) {
        return res.json({
          on_cooldown: false,
          cooldown_remaining_seconds: 0,
          cooldown_remaining_days: 0,
          cooldown_remaining_formatted: 'Ready',
        });
      }

      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, cooldown.cooldown_until - now);
      const remainingDays = (remaining / 86400).toFixed(1);
      const hours = Math.floor((remaining % 86400) / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const seconds = remaining % 60;

      let formatted = 'Ready';
      if (remaining > 0) {
        if (remaining >= 86400) {
          formatted = `${Math.floor(remaining / 86400)}d ${hours}h remaining`;
        } else if (remaining >= 3600) {
          formatted = `${hours}h ${minutes}m remaining`;
        } else if (remaining >= 60) {
          formatted = `${minutes}m remaining`;
        } else {
          formatted = `${seconds}s remaining`;
        }
      }

      res.json({
        on_cooldown: remaining > 0,
        cooldown_remaining_seconds: remaining,
        cooldown_remaining_days: parseFloat(remainingDays),
        cooldown_remaining_formatted: formatted,
      });
    } catch (err) {
      console.error('[synergy] cooldown check failed:', err.message);
      res.status(500).json({ error: 'Failed to check cooldown status' });
    }
  });

  // POST /api/kingdom/activate-synergy-ability — Activate a synergy's active ability
  router.post('/activate-synergy-ability', requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const { synergy_id } = req.body;
      if (!synergy_id) {
        return res.status(400).json({ error: 'synergy_id required' });
      }

      // Use transaction to prevent race conditions where multiple requests could activate simultaneously
      await db.run('BEGIN TRANSACTION');
      try {
        const kingdom = await db.get(
          "SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE",
          [req.player.playerId]
        );
        if (!kingdom) {
          await db.run('ROLLBACK');
          return res.status(404).json({ error: 'Kingdom not found' });
        }

        // Get active synergy to verify it's the current active one
        const activeSynergy = attunementManager.getActiveSynergy(kingdom);
        if (!activeSynergy) {
          await db.run('ROLLBACK');
          return res.status(400).json({ error: 'No synergy currently active' });
        }

        if (activeSynergy.id !== synergy_id) {
          await db.run('ROLLBACK');
          return res.status(400).json({ error: 'This synergy is not currently active' });
        }

        // Check cooldown with lock to prevent race condition
        const cooldown = await db.get(
          "SELECT cooldown_until FROM synergy_cooldowns WHERE kingdom_id = $1 AND synergy_id = $2 FOR UPDATE",
          [kingdom.id, synergy_id]
        );

        const now = Math.floor(Date.now() / 1000);
        if (cooldown && cooldown.cooldown_until > now) {
          await db.run('ROLLBACK');
          const remaining = cooldown.cooldown_until - now;
          return res.status(429).json({
            error: `Ability still on cooldown. ${Math.ceil(remaining / 86400)} day(s) remaining`,
          });
        }

        // Get synergy definition to apply effects
        const synergy = synergiesModule.getSynergy(synergy_id);
        if (!synergy) {
          await db.run('ROLLBACK');
          return res.status(400).json({ error: 'Invalid synergy ID' });
        }

        // Use ability manager to trigger the ability (applies costs/benefits/penalties)
        const abilityResult = abilityManager.triggerAbility(kingdom, synergy_id);
        if (!abilityResult.ok) {
          await db.run('ROLLBACK');
          return res.status(400).json({ error: abilityResult.error });
        }

        // Get the updated kingdom with effects applied
        const cooldownUntil = new Date(abilityResult.cooldownExpires).getTime() / 1000;

        // Apply all kingdom updates to database using the helper function
        // This ensures validation of column names and prevents SQL injection
        const updates = {
          ...abilityResult.kingdom,
        };
        delete updates.id; // Don't update the ID field

        await applyKingdomUpdates(kingdom.id, updates);

        // Upsert cooldown record within transaction
        await db.run(
          "INSERT INTO synergy_cooldowns (kingdom_id, synergy_id, cooldown_until) VALUES ($1, $2, $3) ON CONFLICT(kingdom_id, synergy_id) DO UPDATE SET cooldown_until = $4",
          [kingdom.id, synergy_id, Math.floor(cooldownUntil), Math.floor(cooldownUntil)]
        );

        // Write a news entry so the player sees the activation in their feed (inside transaction for atomicity)
        const newsMessage = synergy.emoji + " " + synergy.name + ": " + (synergy.active?.name || "") + " activated! " + (synergy.active?.desc || "");
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1, $2, $3, $4)",
          [kingdom.id, 'synergy', newsMessage, kingdom.turn || 0]
        );

        await db.run('COMMIT');

        // Log the ability activation
        devLog(`[synergy] Kingdom ${kingdom.id}: ${synergy_id} ability activated by ${synergy.active?.name}`);

        res.json({
          ok: true,
          message: `${synergy.active?.name} activated!`,
          cooldown_until: Math.floor(cooldownUntil),
          synergy: {
            id: synergy.id,
            name: synergy.name,
            active_name: synergy.active?.name,
          },
        });
      } catch (txErr) {
        await db.run('ROLLBACK');
        throw txErr;
      }
    } catch (err) {
      console.error('[synergy] activate ability failed:', err.message);
      res.status(500).json({ error: 'Failed to activate synergy ability' });
    }
  });

  // POST /api/kingdom/portrait - Upload custom portrait
  router.post('/portrait', requireAuth, uploadWithErrorHandling, async (req, res) => {
    try {
      const playerId = req.player.playerId;
      const k = await db.get('SELECT id FROM kingdoms WHERE player_id = $1', [playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      if (!validateImageSignature(req.file.buffer, ext)) {
        return res.status(400).json({ error: 'File contents do not match the declared image type' });
      }

      const hash = crypto.randomBytes(4).toString('hex');
      const filename = `portrait_${Date.now()}_${hash}${ext}`;
      const diskPath = path.join(portraitsPath, filename);
      await fs.promises.writeFile(diskPath, req.file.buffer);
      const portraitPath = `/portraits/${filename}`;

      // Remove old portrait if exists
      const old = await db.get('SELECT custom_portrait FROM kingdoms WHERE id = $1', [k.id]);
      if (old?.custom_portrait) {
        const safeBasename = path.basename(old.custom_portrait);
        const oldPath = path.join(portraitsPath, safeBasename);
        fs.unlink(oldPath, (e) => {
          if (e) console.warn('Failed to delete old portrait:', e.message);
        });
      }

      // Update database
      await db.run('UPDATE kingdoms SET custom_portrait = $1 WHERE id = $2', [portraitPath, k.id]);

      res.json({ ok: true, portraitUrl: portraitPath });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/kingdom/portrait - Remove custom portrait
  router.delete('/portrait', requireAuth, async (req, res) => {
    try {
      const playerId = req.player.playerId;
      const k = await db.get('SELECT id, custom_portrait FROM kingdoms WHERE player_id = $1', [playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      if (k.custom_portrait) {
        const safeBasename = path.basename(k.custom_portrait);
        const filePath = path.join(portraitsPath, safeBasename);
        fs.unlink(filePath, (e) => {
          if (e) console.warn('Failed to delete portrait file:', e.message);
        });
      }

      await db.run('UPDATE kingdoms SET custom_portrait = NULL WHERE id = $1', [k.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/kingdom/happiness-status - Happiness data + 50-turn history
  router.get('/happiness-status', requireAuth, async (req, res) => {
    try {
      const playerId = req.player.playerId;
      const k = await db.get('SELECT * FROM kingdoms WHERE player_id = $1', [playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      // Get current happiness components
      const happinessResult = commandHandler.calculateHappiness(k);

      // Get last 50 turns of happiness history
      const history = await db.all(
        `SELECT turn, happiness_value FROM happiness_history
         WHERE kingdom_id = $1 ORDER BY turn DESC LIMIT 50`,
        [k.id]
      );

      // Get recent happiness events
      const recentEvents = await db.all(
        `SELECT * FROM happiness_events
         WHERE kingdom_id = $1 ORDER BY turn DESC LIMIT 10`,
        [k.id]
      );

      res.json({
        happiness: happinessResult.happiness,
        components: happinessResult.components,
        recoveryRate: happinessResult.recovery,
        last50Turns: history.reverse().map(h => ({ turn: h.turn, happiness: h.happiness_value })),
        recent: recentEvents
      });
    } catch (err) {
      console.error('[kingdom] happiness-status error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/kingdom/happiness-events - Recent happiness events
  router.get('/happiness-events', requireAuth, async (req, res) => {
    try {
      const playerId = req.player.playerId;
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 500);

      const k = await db.get('SELECT id FROM kingdoms WHERE player_id = $1', [playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      const events = await db.all(
        `SELECT * FROM happiness_events
         WHERE kingdom_id = $1 ORDER BY turn DESC LIMIT $2`,
        [k.id, limit]
      );

      res.json({ events: events.reverse() }); // Reverse to oldest first
    } catch (err) {
      console.error('[kingdom] happiness-events error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ═══ EPIC TREK ═══════════════════════════════════════════════════════════════════════════════════════════════════
  // POST /expedition/epic-trek - Point-and-go targeted exploration
  // Gated: Hidden until Ring 2 Scout complete
  // Cost: 1.5 turns per hex distance
  router.post('/expedition/epic-trek', requireAuth, requireCsrfToken, async (req, res) => {
    const { target_x, target_y } = req.body;
    const { getPathHexes, getEpicTrekTurns, isTargetInBounds } = require('../game/epic-trek-paths');

    try {
      // Validate input
      if (!Number.isFinite(target_x) || !Number.isFinite(target_y)) {
        return res.status(400).json({ error: 'Invalid target coordinates' });
      }

      if (!isTargetInBounds(target_x, target_y)) {
        return res.status(400).json({ error: 'Target is outside map bounds' });
      }

      const result = await db.withTransaction(async () => {
        const k = await db.get('SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE', [
          req.player.playerId,
        ]);
        if (!k) {
          const err = new Error('Kingdom not found');
          err.statusCode = 404;
          throw err;
        }

        // Gating: Ring 2 completion check. scout_progress (not the
        // visibility JSON's dead `highest_completed_ring`, which nothing
        // ever wrote) is the single source of truth for ring progress —
        // getCompletedRing derives the ring from it the same way the
        // client's Epic Trek button visibility does. Bypassed entirely
        // when fog of war is disabled (test/debug mode).
        const fogDisabled = process.env.DISABLE_FOG_OF_WAR === 'true';
        if (!fogDisabled && getCompletedRing(k.scout_progress) < 2) {
          const err = new Error('Epic Trek unlocks at Ring 2 Scout completion');
          err.statusCode = 403;
          throw err;
        }

        // Get kingdom position and calculate distance/cost
        const { map_x, map_y } = getKingdomMapCoords(k);
        const distance = hexUnitDistance(map_x, map_y, target_x, target_y);
        // Phase 3B: pass elevation data so getEpicTrekTurns' movement-penalty
        // branch actually runs — previously called with 4 args, so its
        // `opts.elevationGrid` check always failed and FEATURE_ELEVATION_MOVEMENT
        // did nothing regardless of the flag's value.
        const { getFlag } = require('../game/feature-flags');
        const { hasElevationGrid, getElevationGrid } = require('../game/world-elevation-cache');
        const turnsNeeded = getEpicTrekTurns(map_x, map_y, target_x, target_y, {
          getFlag,
          elevationGrid: hasElevationGrid() ? getElevationGrid() : null,
        });

        if (k.turns_stored < turnsNeeded) {
          const err = new Error(`Epic Trek requires ${turnsNeeded} turns (you have ${k.turns_stored})`);
          err.statusCode = 429;
          throw err;
        }

        // Calculate path and food cost
        const pathHexes = getPathHexes(map_x, map_y, target_x, target_y);
        const DEEP_EXP_FOOD_COST_PER_HEX = 50;
        const rangerCount = k.rangers || 0;
        const rangerLevel = parseTroopLevel(k.troop_levels || {}, 'rangers') || 1;
        const levelMult = 1 + (rangerLevel - 1) * 0.05;
        const foodNeeded = Math.ceil(pathHexes.length * DEEP_EXP_FOOD_COST_PER_HEX * levelMult);

        if (k.food < foodNeeded) {
          const err = new Error(`Epic Trek requires ${foodNeeded.toLocaleString()} food (you have ${k.food.toLocaleString()})`);
          err.statusCode = 400;
          throw err;
        }

        // Check for existing active epic-trek
        const existing = await db.get(
          'SELECT id FROM expeditions WHERE kingdom_id = $1 AND type = $2 AND turns_left > 0',
          [k.id, 'epic-trek'],
        );
        if (existing) {
          const err = new Error('An Epic Trek is already underway');
          err.statusCode = 400;
          throw err;
        }

        // Deduct turns and food
        await db.run(
          'UPDATE kingdoms SET turns_stored = GREATEST(0, turns_stored - $1), food = GREATEST(0, food - $2) WHERE id = $3',
          [turnsNeeded, foodNeeded, k.id]
        );

        // Create expedition with path stored as JSON
        await db.run(
          'INSERT INTO expeditions (kingdom_id, type, turns_left, rangers, fighters, food_taken, extra_data) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [k.id, 'epic-trek', turnsNeeded, rangerCount, 0, foodNeeded, JSON.stringify({ path_hexes: pathHexes, target_x, target_y })]
        );

        return { turnsNeeded, distance, pathHexes, foodNeeded };
      });

      res.json({
        ok: true,
        turns_left: result.turnsNeeded,
        distance: result.distance.toFixed(1),
        path_hexes: result.pathHexes.length,
        food_used: result.foodNeeded,
        message: `Epic Trek launched to (${Math.round(target_x)}, ${Math.round(target_y)}) — ${result.turnsNeeded} turns, ${result.pathHexes.length} hexes to explore.`,
      });
    } catch (err) {
      console.error('[expedition/epic-trek] failed:', err.message);
      if (err.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      res.status(500).json({ error: 'Epic Trek failed — please try again' });
    }
  });

  // Fix visibility corruption: reset currentCells to just the home hex
  // (useful after map expansions or visibility migrations)
  router.post('/fix-visibility', requireAuth, async (req, res) => {
    try {
      console.log('[fix-visibility] Starting for player:', req.player.playerId);
      const { resetCurrentCellsToHome } = require('../game/visibility');
      const k = await db.get('SELECT id, race FROM kingdoms WHERE player_id = $1', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      console.log('[fix-visibility] Resetting for kingdom:', k.id, 'race:', k.race);
      const updated = await resetCurrentCellsToHome(db, k);
      console.log('[fix-visibility] Updated visibility. currentCells:', updated.currentCells.toString());
      res.json({ message: 'Visibility reset to home hex only', visibility: { seenCells: updated.seenCells.toString(), currentCells: updated.currentCells.toString() } });
    } catch (err) {
      console.error('[fix-visibility] failed:', err.message, err.stack);
      res.status(500).json({ error: 'Failed to fix visibility: ' + err.message });
    }
  });

  router.get("/debug/scouts", requireAuth, async (req, res) => {
    try {
      const k = await db.get("SELECT scout_allocation, scout_progress FROM kingdoms WHERE player_id = $1", [req.player.playerId]);
      if (!k) {
        return res.status(404).json({ error: "Kingdom not found" });
      }
      res.json({
        scout_allocation: k.scout_allocation,
        scout_progress: k.scout_progress,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Export helper functions for use in other routes
  router.withTurnLock = withTurnLock;
  router.runTurn = runTurn;
  router.processTurnEffectsOnly = processTurnEffectsOnly;
  router.loadTurnContext = loadTurnContext;
  router.commitTurnResults = commitTurnResults;

  return router;
};

async function applyUpdates(db, kingdomId, updates) {
  // Validate no numeric values are NaN/Infinity (corrupted data protection)
  // Dynamically check all values instead of maintaining a hardcoded field list
  // This ensures future fields (new troop types, resources, etc.) are automatically protected
  for (const [key, value] of Object.entries(updates)) {
    if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) {
      console.error(`[applyUpdates] NaN/Infinity detected in field: ${key} = ${value}`);
      throw new Error(`Corrupted numeric data: ${key} contains NaN or Infinity`);
    }
  }

  // Stringify JSON fields that are kept as objects during processTurn
  const updatesForDb = { ...updates };
  if (updatesForDb.troop_levels && typeof updatesForDb.troop_levels === 'object') {
    updatesForDb.troop_levels = JSON.stringify(updatesForDb.troop_levels);
  }
  // Pass the transaction-aware db connection so updates happen inside the transaction context
  await applyKingdomUpdates(kingdomId, updatesForDb, db);
}

// Insert multiple news rows in a single query — much faster than N sequential inserts
async function bulkInsertNews(db, rows) {
  if (!rows || rows.length === 0) return;
  const placeholders = pgValueTuples(rows.length, 4);
  const values = rows.flatMap((r) => [
    r.kingdom_id,
    r.type || "system",
    decorateNewsMessage(r.message, repairMojibake),
    r.turn_num || 0,
  ]);
  await db.run(
    `INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ${placeholders}`,
    values,
  );
}

// Prune old news — keep only the most recent N rows per kingdom
async function pruneNews(db, kingdomId, keep = 200) {
  await db.run(
    `
    DELETE FROM news WHERE kingdom_id = $1 AND id NOT IN (
      SELECT id FROM news WHERE kingdom_id = $2 ORDER BY created_at DESC LIMIT $3
    )
  `,
    [kingdomId, kingdomId, keep],
  );
}
