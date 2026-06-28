const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const engine = require("../game/engine");
const config = require("../game/config");
const { requireAuth, requireCsrfToken } = require("./middleware");
const { safeJsonParse, devLog } = require('../utils/helpers');
const { validateTroopAmount, validateAllocationObject } = require('../utils/numeric-validation');
const { getKingdomAttunements } = require('../game/fragment-attunements');
const fragmentBonusManager = require("../game/fragment-bonus-manager");
const attunementManager = require('../game/attunement-manager');
const synergiesModule = require('../game/fragment-synergies');
const abilityManager = require('../game/active-ability-manager');
const { applyKingdomUpdates } = require('../db/schema');
const { setUnreadCount } = require("../cache.js");
const { decorateNewsMessage } = require("../game/news-emoji");

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
  const countRow = await db.get("SELECT COUNT(*) as c FROM kingdoms WHERE id != ?", [selfId]);
  const total = Number(countRow?.c || 0);
  if (total <= 0) return null;

  const exclusionSet = new Set(uniqueForbidden);

  for (let attempt = 0; attempt < 8; attempt++) {
    const offset = Math.floor(Math.random() * total);
    const row = await db.get(
      `SELECT ${columns} FROM kingdoms WHERE id != ? LIMIT 1 OFFSET ?`,
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
      return cb(new Error("Invalid file type â€” only image files are allowed"));
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

// â”€â”€ Per-player turn processing lock â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
const KINGDOM_RESOURCE = `${KINGDOM_CORE}, wood, stone, iron, coal, steel, build_queue, level, resource_sequence, engineer_level, ballistae,
  bld_farms, bld_granaries, bld_barracks, bld_outposts, bld_guard_towers, bld_schools, bld_armories, bld_vaults, bld_smithies, bld_markets, bld_mage_towers, bld_shrines, bld_training, bld_castles, bld_libraries, bld_taverns, bld_mausoleums, bld_walls, bld_housing, bld_woodyard, bld_lumber_camp, bld_sawmill, bld_gravel_pit, bld_blockfield, bld_stone_quarry, bld_open_pit, bld_strip_mine, bld_deep_mine`;
const KINGDOM_SMITHY = 'id, player_id, gold, bld_smithies, hammers_stored, scaffolding_stored';
const _KINGDOM_ATTACK = `${KINGDOM_CORE}, fighters, rangers, mages, thieves, ninjas, clerics, thralls, engineers, war_machines, ballistae,
  bld_walls, bld_guard_towers, bld_mage_towers, bld_outposts, bld_castles,
  res_military, res_weapons, res_armor, res_war_machines, res_attack_magic, res_defense_magic,
  troop_levels, equipment_levels, injured_troops, wall_hp, wall_defense_type, ladders, weapons_stockpile, armor_stockpile,
  level, mausoleum_upgrades, shrine_upgrades, wall_upgrades, tower_def_upgrades, outpost_upgrades,
  defense_upgrades, milestone_bonuses, prestige_level, xp, xp_sources, discovered_kingdoms`;
const _KINGDOM_ECONOMY = `${KINGDOM_CORE}, gold, market_upgrades, bank_upgrades, farm_upgrades, discovered_kingdoms`;

module.exports = function (db) {
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
        LIMIT ?
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
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const [items] = await Promise.all([
      db.all(
        "SELECT * FROM news WHERE kingdom_id = ? ORDER BY created_at DESC LIMIT 50",
        [k.id],
      ),
      db.run(
        "UPDATE news SET is_read = 1 WHERE kingdom_id = ? AND is_read = 0",
        [k.id],
      ),
    ]);
    const normalized = items.map(normalizeNewsRow);
    const repairJobs = [];
    for (let i = 0; i < items.length; i += 1) {
      const original = items[i]?.message ?? "";
      const repaired = normalized[i]?.message ?? original;
      if (typeof original === "string" && repaired !== original) {
        repairJobs.push(db.run("UPDATE news SET message = ? WHERE id = ?", [repaired, items[i].id]));
      }
    }
    if (repairJobs.length > 0) {
      await Promise.all(repairJobs);
    }
    setUnreadCount(k.id, 0); // Mark all read, so unread count is 0
    res.json(normalized);
  });

  router.delete("/news/clear", requireAuth, async (req, res) => {
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    await db.run("DELETE FROM news WHERE kingdom_id = ?", [k.id]);
    res.json({ ok: true });
  });

  async function loadTradeRoutes(k) {
    const tradeRoutes = await db.all(
      "SELECT * FROM trade_routes WHERE kingdom_id = ? OR partner_id = ?",
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

  // â”€â”€ Shared turn runner â€” used by ALL routes that consume a turn â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function runTurn(db, k) {
    if (!k) throw new Error('Kingdom not found');
    // Inject region ownership status for bonuses
    // All 3 queries are independent â€” run them in parallel
    const [regionStatus, myAlliance, heroes] = await Promise.all([
      db.get(
        "SELECT owner_alliance_id, bonus_type FROM regions WHERE name = ?",
        [k.region],
      ),
      db.get(
        "SELECT alliance_id FROM alliance_members WHERE kingdom_id = ?",
        [k.id],
      ),
      db.all(
        "SELECT * FROM heroes WHERE kingdom_id = ? AND status = 'idle'",
        [k.id],
      ),
    ]);
    k._region_owned_by_my_alliance =
      regionStatus &&
      myAlliance &&
      regionStatus.owner_alliance_id === myAlliance.alliance_id;
    k._region_bonus_type = regionStatus?.bonus_type;
    k.heroes = heroes;
    await loadTradeRoutes(k);

    const { updates, events } = engine.processTurn(k, db);
    const cleanEvents = events.map(normalizeNewsRow);

    const heroBatch = [];
    for (const hero of heroes) {
      const xpResult = engine.awardHeroXp(hero, 10);
      heroBatch.push({ id: hero.id, level: xpResult.level, xp: xpResult.xp });
      engine.applyHeroTurnBonuses(hero, k, updates, events);
    }

    updates.turns_stored = k.turns_stored - 1;

    // Apply kingdom updates in a transaction
    // Dedup news â€” only insert if we haven't already sent this EXACT message recently
    const filteredEvents = [];
    // Batch check for duplicate news instead of N+1 queries
    const existingMessages = {};
    if (events.length > 0) {
      // Deduplicate and filter for valid string messages to prevent TypeError and reduce DB load
      const uniqueMessages = [...new Set(cleanEvents.map(e => e && e.message).filter(msg => typeof msg === 'string'))];
      if (uniqueMessages.length > 0) {
        const placeholders = uniqueMessages.map(() => '?').join(',');
        const existingNews = await db.all(
          `SELECT DISTINCT message FROM news WHERE kingdom_id = ? AND message IN (${placeholders}) AND created_at > (unixepoch() - 60)`,
          [k.id, ...uniqueMessages]
        );
        existingNews.forEach(row => {
          existingMessages[row.message] = true;
        });
      }
    }

    for (const ev of cleanEvents) {
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

    try {
      await applyUpdates(db, k.id, updates);

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

    // Resolve expeditions OUTSIDE the kingdom transaction so ticks are never rolled back
    let expeditionEvents = [];
    try {
      expeditionEvents = await engine.resolveExpeditions(
        db,
        { ...k, ...updates },
        engine,
      );
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

      if (updates._find_kingdom_surveyor) {
        const discoveredSource = updates.discovered_kingdoms ?? k.discovered_kingdoms;
        const other = await getRandomKingdom(db, k.id, [], "id, name");
        if (other) {
          let disc = {};
          try {
            disc = safeJsonParse(discoveredSource, {}, "auto:discovered_kingdoms");
          } catch {}
          if (!disc[other.id]) {
            disc[other.id] = { found: true, name: other.name };
            await db.run(
              "UPDATE kingdoms SET discovered_kingdoms = ? WHERE id = ?",
              [JSON.stringify(disc), k.id],
            );
            const turnNum = updates.turn || k.turn;
            await db.run(
              "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?, ?, ?, ?)",
              [
                k.id,
                "system",
                repairMojibake(`ðŸ”­ Your Surveyors discovered the kingdom of ${other.name}!`),
                turnNum,
              ],
            );
            events.push({
              type: "system",
              message: repairMojibake(`ðŸ”­ Your Surveyors discovered the kingdom of ${other.name}!`),
            });
          }
        }
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

    const allEvents = [...cleanEvents, ...expeditionEvents];

    // Process real-time resource expeditions and persist their loot
    try {
      const { kUpdates: expUpdates, lootEvents } = await processResourceExpeditionsDb(k.id, { ...k, ...updates });
      if (Object.keys(expUpdates).length > 0) {
        await applyUpdates(db, k.id, expUpdates);
        Object.assign(updates, expUpdates);
      }
      if (lootEvents.length > 0) {
        const turnNum = updates.turn || k.turn;
        const cleanLootEvents = lootEvents.map(normalizeNewsRow);
        await bulkInsertNews(db, cleanLootEvents.map(ev => ({ kingdom_id: k.id, type: ev.type || 'system', message: ev.message, turn_num: turnNum })));
        allEvents.push(...cleanLootEvents);
      }
    } catch (err) {
      console.error('[runTurn] resource expedition resolve error:', err.message);
      // Only throw if in an active transaction (safe to rollback)
      // Endpoints like /search call runTurn without transaction context
      const store = db.transactionStorage?.getStore?.();
      if (store && !store.released) {
        throw err; // Rethrow to trigger transaction rollback
      }
      // If no transaction: log but don't throw (prevent lost turns)
    }

    // Refresh fields that resolveExpeditions may have updated via SQL
    const refreshed = await db.get(
      "SELECT rangers, fighters, gold, mana, land, scrolls, maps, blueprints_stored, troop_levels, library_progress, tower_progress, racial_bonuses_unlocked FROM kingdoms WHERE id = ?",
      [k.id],
    );
    if (refreshed) Object.assign(updates, refreshed);

    // Fetch unread news count
    const unread = await db.get(
      "SELECT COUNT(*) as c FROM news WHERE kingdom_id = ? AND is_read = 0",
      [k.id],
    );
    updates.unread_news = unread.c;

    // Calculate new score after turn
    const finalState = { ...k, ...updates };
    updates.score = engine.calculateScore(finalState);

    return { updates, events: allEvents };
  }

  // â”€â”€ Take turn (advance game state) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.post("/turn", requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const result = await withTurnLock(req.player.playerId, async () => {
        // Wrap entire turn in transaction
        await db.run("BEGIN TRANSACTION");
        try {
          // Fetch kingdom with row-level lock INSIDE transaction
          const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ? FOR UPDATE", [
            req.player.playerId,
          ]);
          if (!k) {
            await db.run("ROLLBACK");
            throw new Error("Kingdom not found");
          }
          if (k.turns_stored < 1) {
            await db.run("ROLLBACK");
            throw new Error("No turns available â€” next +7 turns in 25 minutes");
          }

          const { updates, events } = await runTurn(db, k);
          await db.run("COMMIT");
          return { ok: true, updates, events, turns_stored: updates.turns_stored };
        } catch (err) {
          await db.run("ROLLBACK");
          throw err;
        }
      });
      res.json(result);
    } catch (err) {
      console.error("[turn] failed:", err.message);
      if (err.message.includes("Kingdom not found")) {
        return res.status(404).json({ error: err.message });
      }
      if (err.message.includes("No turns available")) {
        return res.status(429).json({ error: err.message });
      }
      res.status(500).json({ error: "Turn processing failed â€” please try again" });
    }
  });

  // â”€â”€ Hire units â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.post("/hire", requireAuth, requireCsrfToken, async (req, res) => {
    const { unit, amount } = req.body;

    const amountValidation = validateTroopAmount(amount, { fieldName: 'amount' });
    if (!amountValidation.valid) {
      return res.status(400).json({ error: amountValidation.error });
    }

    try {
      await db.run("BEGIN TRANSACTION");

      const k = await db.get(`SELECT ${KINGDOM_HIRE} FROM kingdoms WHERE player_id = ? FOR UPDATE`, [
        req.player.playerId,
      ]);
      if (!k) {
        await db.run("ROLLBACK");
        return res.status(404).json({ error: "Kingdom not found" });
      }

      const hireResult = engine.hireUnits(k, unit, amountValidation.value);
      if (hireResult.error) {
        await db.run("ROLLBACK");
        return res.status(400).json({ error: hireResult.error });
      }

      const hireUpdates = hireResult.updates;
      const updatesForDb = { ...hireUpdates };
      if (updatesForDb.troop_levels && typeof updatesForDb.troop_levels === 'object') {
        updatesForDb.troop_levels = JSON.stringify(updatesForDb.troop_levels);
      }

      const cols = Object.keys(updatesForDb).map(col => `${col} = ?`).join(', ');
      const vals = Object.values(updatesForDb);
      await db.run(
        `UPDATE kingdoms SET ${cols} WHERE id = ?`,
        [...vals, k.id],
      );

      await db.run("COMMIT");

      res.json({
        ok: true,
        updates: hireUpdates,
        events: [],
        turns_stored: k.turns_stored,
      });
    } catch (err) {
      try {
        await db.run("ROLLBACK");
      } catch (rollbackErr) {
        console.error("[hire] rollback error:", rollbackErr.message);
      }
      console.error("[hire] failed:", err.message);
      res.status(500).json({ error: "Hire failed — please try again" });
    }
  });

  // â”€â”€ Research â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // â”€â”€ Queue buildings â€” charges gold, no turn cost â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.post("/build-queue", requireAuth, requireCsrfToken, async (req, res) => {
    const { orders } = req.body;

    // Validate orders object using utility (max 10k per building type per order)
    const ordersValidation = validateAllocationObject(orders, {
      maxPerItem: 10000,
      maxTotal: 100000,
      fieldName: 'orders',
    });
    if (!ordersValidation.valid) {
      return res.status(400).json({ error: ordersValidation.error });
    }

    try {
      await db.run("BEGIN TRANSACTION");

      const k = await db.get(`SELECT ${KINGDOM_RESOURCE} FROM kingdoms WHERE player_id = ? FOR UPDATE`, [
        req.player.playerId,
      ]);
      if (!k) {
        await db.run("ROLLBACK");
        return res.status(404).json({ error: "Kingdom not found" });
      }

      try {
        k.build_queue = safeJsonParse(k.build_queue, {}, "auto:build_queue");
      } catch {
        k.build_queue = {};
      }

      const result = engine.queueBuildings(k, ordersValidation.values);
      if (result.error) {
        await db.run("ROLLBACK");
        return res.status(400).json({ error: result.error });
      }

      const updatesForDb = { ...result.updates };
      if (updatesForDb.troop_levels && typeof updatesForDb.troop_levels === 'object') {
        updatesForDb.troop_levels = JSON.stringify(updatesForDb.troop_levels);
      }

      const cols = Object.keys(updatesForDb).map(col => `${col} = ?`).join(', ');
      const vals = Object.values(updatesForDb);
      await db.run(
        `UPDATE kingdoms SET ${cols} WHERE id = ?`,
        [...vals, k.id],
      );

      await db.run("COMMIT");

      res.json({
        ok: true,
        queue: JSON.parse(result.updates.build_queue),
        gold: result.updates.gold,
        totalCost: result.totalCost,
        engineers: k.engineers,
      });
    } catch (err) {
      try {
        await db.run("ROLLBACK");
      } catch (rollbackErr) {
        console.error("[build-queue] rollback error:", rollbackErr.message);
      }
      console.error("[build-queue] error:", err.message);
      res.status(500).json({ error: "Build queue failed" });
    }
  });

  // â”€â”€ Get training allocation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.get("/training-allocation", requireAuth, async (req, res) => {
    const k = await db.get("SELECT training_allocation FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const allocation = safeJsonParse(k.training_allocation, {}, "GET /training-allocation");
    res.json({ allocation });
  });

  // â”€â”€ Save training allocation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.post("/training-allocation", requireAuth, requireCsrfToken, async (req, res) => {
    const { allocation } = req.body;

    // Validate allocation using utility (whitelist valid unit types)
    const validUnits = ['fighters', 'rangers', 'mages', 'clerics', 'thieves', 'ninjas'];
    const allocValidation = validateAllocationObject(allocation, {
      validKeys: validUnits,
      maxPerItem: 1000000,
      maxTotal: 1000000,
      fieldName: 'allocation',
    });
    if (!allocValidation.valid) {
      return res.status(400).json({ error: allocValidation.error });
    }

    const k = await db.get(`SELECT id, bld_training, fighters, rangers, mages, clerics, thieves, ninjas FROM kingdoms WHERE player_id = ?`, [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    const capacity = k.bld_training * 100;
    const clean_alloc = allocValidation.values;

    // Business logic validations (unit availability and capacity)
    for (const [unit, amount] of Object.entries(clean_alloc)) {
      if (amount > (k[unit] || 0))
        return res.status(400).json({ error: `Not enough ${unit}` });
    }
    if (allocValidation.total > capacity)
      return res
        .status(400)
        .json({ error: `Exceeds training capacity (${capacity})` });

    await db.run("UPDATE kingdoms SET training_allocation = ? WHERE id = ?", [
      JSON.stringify(clean_alloc),
      k.id,
    ]);
    res.json({ ok: true });
  });
  router.post("/build-allocation", requireAuth, requireCsrfToken, async (req, res) => {
    const { allocation } = req.body;

    // Validate allocation using utility
    const allocValidation = validateAllocationObject(allocation, {
      maxPerItem: 10000000,
      maxTotal: 10000000,
      fieldName: 'allocation',
    });
    if (!allocValidation.valid) {
      return res.status(400).json({ error: allocValidation.error });
    }

    const k = await db.get(
      "SELECT id, engineers, resource_build_allocation FROM kingdoms WHERE player_id = ?",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    // Account for resource_build_allocation when checking engineer capacity
    const resourceAlloc = safeJsonParse(k.resource_build_allocation, {}, "build-allocation:resource_build_allocation");
    const resourceTotal = Object.values(resourceAlloc).reduce(
      (s, v) => s + (Number(v) || 0),
      0,
    );

    // Check engineer capacity
    if (allocValidation.total + resourceTotal > k.engineers)
      return res.status(400).json({
        error: `Allocated ${allocValidation.total.toLocaleString()} build engineers and ${resourceTotal.toLocaleString()} resource engineers, but only have ${k.engineers.toLocaleString()} engineers total`,
      });
    await db.run("UPDATE kingdoms SET build_allocation = ? WHERE id = ?", [
      JSON.stringify(allocValidation.values),
      k.id,
    ]);
    res.json({ ok: true });
  });

  router.post("/resource-build-allocation", requireAuth, requireCsrfToken, async (req, res) => {
    const { allocation } = req.body;

    // Validate allocation using utility (whitelist valid resource building types)
    const validResourceBuildings = ['woodyard', 'lumber_camp', 'sawmill', 'gravel_pit', 'blockfield', 'stone_quarry', 'open_pit', 'strip_mine', 'deep_mine'];
    const allocValidation = validateAllocationObject(allocation, {
      validKeys: validResourceBuildings,
      maxPerItem: 10000000,
      maxTotal: 10000000,
      fieldName: 'allocation',
    });
    if (!allocValidation.valid) {
      return res.status(400).json({ error: allocValidation.error });
    }

    const k = await db.get(
      "SELECT id, engineers, build_allocation FROM kingdoms WHERE player_id = ?",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    const buildAlloc = safeJsonParse(k.build_allocation, {}, "resource-build-allocation:build_allocation");
    const buildTotal = Object.values(buildAlloc).reduce(
      (s, v) => s + (Number(v) || 0),
      0,
    );

    if (allocValidation.total + buildTotal > k.engineers)
      return res.status(400).json({
        error: `Allocated ${allocValidation.total.toLocaleString()} resource engineers and ${buildTotal.toLocaleString()} build engineers, but only have ${k.engineers.toLocaleString()} engineers total`,
      });
    await db.run("UPDATE kingdoms SET resource_build_allocation = ? WHERE id = ?", [
      JSON.stringify(allocValidation.values),
      k.id,
    ]);
    res.json({ ok: true });
  });

  router.post("/demolish", requireAuth, requireCsrfToken, async (req, res) => {
    const { building, amount } = req.body;
    const k = await db.get(`SELECT ${KINGDOM_RESOURCE} FROM kingdoms WHERE player_id = ?`, [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    const result = engine.demolishBuilding(k, building, parseInt(amount) || 1);
    if (result.error) return res.status(400).json({ error: result.error });

    await applyUpdates(db, k.id, result.updates);
    const msg = `ðŸ—ï¸ Demolished ${result.refund.count} ${building.replace(/_/g, " ")}. Refunded ${result.refund.gold.toLocaleString()} gold and ${result.refund.land} acres.`;
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
      [k.id, "system", msg, k.turn],
    );

    res.json({ ok: true, updates: result.updates, message: msg });
  });

  // â”€â”€ Build structures â€” start construction with engineer allocation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.post("/build", requireAuth, requireCsrfToken, async (req, res) => {
    const { building } = req.body;

    const k = await db.get(`SELECT ${KINGDOM_RESOURCE} FROM kingdoms WHERE player_id = ?`, [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    // Normalize building ID (add bld_ prefix if missing)
    const buildingId = building.startsWith('bld_') ? building : `bld_${building}`;

    // Validate building exists in tier system
    const tier = config.BUILDING_TIERS[buildingId];
    if (!tier) return res.status(400).json({ error: "Invalid building" });

    // Calculate build time and cost
    const buildTime = engine.calculateBuildTime(k, tier);
    const cost = engine.calculateBuildCost(k, tier);

    // Validate resources (land is checked, not consumed)
    if (k.land < cost.land) return res.status(400).json({ error: "Insufficient land" });
    if (k.wood < cost.wood) return res.status(400).json({ error: "Insufficient wood" });
    if (k.stone < cost.stone) return res.status(400).json({ error: "Insufficient stone" });
    if (k.iron < cost.iron) return res.status(400).json({ error: "Insufficient iron" });

    // Atomic update: deduct resources and add to queue in single transaction
    const buildQueue = safeJsonParse(k.build_queue, {}, "build:existing_queue");
    const queueId = `${buildingId}_${Date.now()}`;
    buildQueue[queueId] = {
      building: buildingId,
      started_at: k.turn,
      turns_needed: buildTime,
      turns_remaining: buildTime,
      cost,
    };

    const updates = {
      wood: k.wood - cost.wood,
      stone: k.stone - cost.stone,
      iron: k.iron - cost.iron,
      build_queue: JSON.stringify(buildQueue),
    };

    await applyUpdates(db, k.id, updates);
    const msg = `ðŸ—ï¸ Construction started: ${buildingId.replace(/^bld_/, "").replace(/_/g, " ")}. Estimated completion: ${buildTime} turns.`;
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
      [k.id, "system", msg, k.turn],
    );

    res.json({ ok: true, updates, message: msg, buildTime, cost });
  });

  // â”€â”€ Cancel building â€” refund resources â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.post("/cancel-building", requireAuth, requireCsrfToken, async (req, res) => {
    const { queueId } = req.body;

    const k = await db.get(`SELECT id, build_queue, land, wood, stone, iron, turn FROM kingdoms WHERE player_id = ?`, [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    const buildQueue = safeJsonParse(k.build_queue, {}, "build:cancel_queue");

    if (!buildQueue[queueId])
      return res.status(404).json({ error: "Building not found in queue" });

    const buildJob = buildQueue[queueId];
    delete buildQueue[queueId];

    // Refund resources (full refund for cancellation)
    const updates = {
      land: k.land + buildJob.cost.land,
      wood: k.wood + buildJob.cost.wood,
      stone: k.stone + buildJob.cost.stone,
      iron: k.iron + buildJob.cost.iron,
      build_queue: JSON.stringify(buildQueue),
    };

    await applyUpdates(db, k.id, updates);
    const msg = `ðŸ—ï¸ Construction cancelled: ${buildJob.building.replace(/_/g, " ")}. Resources refunded.`;
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
      [k.id, "system", msg, k.turn],
    );

    res.json({ ok: true, updates, message: msg });
  });

  // â”€â”€ Forge tools â€” costs 1 turn + gold for scaffolding â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.post("/smithy/forge-tools", requireAuth, requireCsrfToken, async (req, res) => {
    const { toolType, quantity } = req.body;
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
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
      const toolResult = engine.forgeTools(
        kAfterTurn,
        toolType,
        Number(quantity) || 1,
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
      res.status(500).json({ error: "Forging failed â€” please try again" });
    }
  });

  // â”€â”€ Smithy â€” buy hammers for gold â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.post("/smithy/buy-hammers", requireAuth, requireCsrfToken, async (req, res) => {
    const amount = Math.max(1, parseInt(req.body.amount) || 1);

    try {
      await db.run("BEGIN TRANSACTION");

      const k = await db.get(`SELECT ${KINGDOM_SMITHY} FROM kingdoms WHERE player_id=? FOR UPDATE`, [
        req.player.playerId,
      ]);
      if (!k) {
        await db.run("ROLLBACK");
        return res.status(404).json({ error: "Kingdom not found" });
      }
      if (!(k.bld_smithies > 0)) {
        await db.run("ROLLBACK");
        return res.status(400).json({ error: "Need at least 1 smithy" });
      }

      const cost = amount * 25;
      if (k.gold < cost) {
        await db.run("ROLLBACK");
        return res.status(400).json({ error: `Need ${cost.toLocaleString()} gold` });
      }

      const cap = k.bld_smithies * 25;
      const newHammers = Math.min(cap, k.hammers_stored + amount);
      const bought = newHammers - k.hammers_stored;
      if (bought <= 0) {
        await db.run("ROLLBACK");
        return res.status(400).json({ error: "Hammer storage full" });
      }

      const actualCost = bought * 25;
      await db.run(
        "UPDATE kingdoms SET gold=gold-?, hammers_stored=? WHERE id=?",
        [actualCost, newHammers, k.id],
      );
      await db.run("COMMIT");

      res.json({
        ok: true,
        bought,
        cost: actualCost,
        hammers_stored: newHammers,
        gold: k.gold - actualCost,
      });
    } catch (err) {
      try {
        await db.run("ROLLBACK");
      } catch (rollbackErr) {
        console.error("[smithy/buy-hammers] rollback error:", rollbackErr.message);
      }
      console.error("[smithy/buy-hammers] error:", err.message);
      res.status(500).json({ error: "Purchase failed" });
    }
  });

  // â”€â”€ Smithy â€” buy scaffolding for gold â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.post("/smithy/buy-scaffolding", requireAuth, requireCsrfToken, async (req, res) => {
    const amount = Math.max(1, parseInt(req.body.amount) || 1);

    try {
      await db.run("BEGIN TRANSACTION");

      const k = await db.get(`SELECT ${KINGDOM_SMITHY} FROM kingdoms WHERE player_id=? FOR UPDATE`, [
        req.player.playerId,
      ]);
      if (!k) {
        await db.run("ROLLBACK");
        return res.status(404).json({ error: "Kingdom not found" });
      }

      const baseCost = 2500;
      const hasSmithy = k.bld_smithies > 0;
      const unitPrice = hasSmithy ? baseCost : Math.floor(baseCost * 1.25);
      const cost = amount * unitPrice;

      if (k.gold < cost) {
        await db.run("ROLLBACK");
        return res.status(400).json({ error: `Need ${cost.toLocaleString()} gold` });
      }

      // Base cap of 10 even without smithy, otherwise 10 per smithy
      const cap = Math.max(10, k.bld_smithies * 10);
      const currentScaff = k.scaffolding_stored;
      const newScaff = Math.min(cap, currentScaff + amount);
      const bought = newScaff - currentScaff;

      if (bought <= 0) {
        await db.run("ROLLBACK");
        return res.status(400).json({ error: "Scaffolding storage full" });
      }

      const actualCost = bought * unitPrice;
      await db.run(
        "UPDATE kingdoms SET gold=gold-?, scaffolding_stored=? WHERE id=?",
        [actualCost, newScaff, k.id],
      );
      await db.run("COMMIT");

      res.json({
        ok: true,
        bought,
        cost: actualCost,
        scaffolding_stored: newScaff,
        gold: k.gold - actualCost,
        markup: !hasSmithy,
      });
    } catch (err) {
      try {
        await db.run("ROLLBACK");
      } catch (rollbackErr) {
        console.error("[smithy/buy-scaffolding] rollback error:", rollbackErr.message);
      }
      console.error("[smithy/buy-scaffolding] error:", err.message);
      res.status(500).json({ error: "Purchase failed" });
    }
  });

  // â”€â”€ Trade Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.post("/smithy-allocation", requireAuth, requireCsrfToken, async (_req, res) => {
    res.json({ ok: true });
  });
  router.post("/search", requireAuth, requireCsrfToken, async (req, res) => {
    const { type, rangers } = req.body;
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.turns_stored < 1)
      return res.status(429).json({ error: "No turns available" });

    const r = Number(rangers) || 0;
    if (r <= 0)
      return res.status(400).json({ error: "Send at least some rangers" });
    if (r > engine.getAvailableUnits(k, "rangers"))
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
        const rangerLvBonus = engine.unitLevelMult(kAfterTurn, "rangers");

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

      const xpResult = engine.awardXp(
        kAfterTurn,
        "exploration",
        type === "land"
          ? searchResult.found
          : type === "gold"
            ? Math.floor(searchResult.found / 1000)
            : 5,
      );
      updates.xp = xpResult.xp;
      updates.level = xpResult.level;

      // Award Troop XP to Rangers for exploration
      const rTroopXp = engine.awardTroopXp(
        { ...kAfterTurn, xp: updates.xp, level: updates.level },
        "rangers",
        8,
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
      res.status(500).json({ error: "Search failed â€” please try again" });
    }
  });

  // â”€â”€ Mage tower allocation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.post("/tower-craft", requireAuth, requireCsrfToken, async (req, res) => {
    const { item, qty } = req.body;
    if (!item || qty <= 0)
      return res.status(400).json({ error: "Invalid input" });
    const k = await db.get(
      "SELECT id, bld_mage_towers, mage_tower_allocation FROM kingdoms WHERE player_id = ?",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.bld_mage_towers === 0)
      return res
        .status(400)
        .json({ error: "You need at least 1 Mage Tower first" });

    let alloc = {};
    try {
      alloc = safeJsonParse(k.mage_tower_allocation, {}, "auto:mage_tower_allocation");
    } catch {}
    if (alloc.scroll_craft) {
      alloc[alloc.scroll_craft] = alloc.scroll_target || 999;
      delete alloc.scroll_craft;
      delete alloc.scroll_target;
    }

    alloc[item] = (alloc[item] || 0) + Number(qty);
    await db.run("UPDATE kingdoms SET mage_tower_allocation = ? WHERE id = ?", [
      JSON.stringify(alloc),
      k.id,
    ]);
    res.json({ ok: true, allocation: JSON.stringify(alloc) });
  });

  router.post("/tower-cancel", requireAuth, requireCsrfToken, async (req, res) => {
    const { item } = req.body;
    const k = await db.get(
      "SELECT id, mage_tower_allocation FROM kingdoms WHERE player_id = ?",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    let alloc = {};
    try {
      alloc = safeJsonParse(k.mage_tower_allocation, {}, "auto:mage_tower_allocation");
    } catch {}
    if (alloc.scroll_craft) {
      alloc[alloc.scroll_craft] = alloc.scroll_target || 999;
      delete alloc.scroll_craft;
      delete alloc.scroll_target;
    }

    delete alloc[item];
    await db.run("UPDATE kingdoms SET mage_tower_allocation = ? WHERE id = ?", [
      JSON.stringify(alloc),
      k.id,
    ]);
    res.json({ ok: true, allocation: JSON.stringify(alloc) });
  });

  // â”€â”€ Shrine allocation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.post("/shrine-allocation", requireAuth, requireCsrfToken, async (req, res) => {
    const { allocation } = req.body;

    // Validate allocation object
    const allocValidation = validateAllocationObject(allocation, {
      validKeys: ['clerics'],
      maxPerItem: 1000000,
      maxTotal: 1000000,
      fieldName: 'allocation',
    });
    if (!allocValidation.valid) {
      return res.status(400).json({ error: allocValidation.error });
    }

    const k = await db.get(
      "SELECT id, bld_shrines, clerics FROM kingdoms WHERE player_id = ?",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.bld_shrines === 0)
      return res
        .status(400)
        .json({ error: "You need at least 1 Shrine first" });

    const clericsAlloc = Math.min(
      allocValidation.values.clerics || 0,
      k.clerics,
    );
    await db.run("UPDATE kingdoms SET shrine_allocation = ? WHERE id = ?", [
      JSON.stringify({ clerics: clericsAlloc }),
      k.id,
    ]);
    res.json({ ok: true, allocation: { clerics: clericsAlloc } });
  });

  // â”€â”€ Mausoleum allocation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.post("/mausoleum-allocation", requireAuth, requireCsrfToken, async (req, res) => {
    const { allocation } = req.body;
    if (!allocation || typeof allocation !== "object")
      return res.status(400).json({ error: "allocation required" });
    const k = await db.get(
      "SELECT id, bld_mausoleums, thralls FROM kingdoms WHERE player_id = ?",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.bld_mausoleums === 0)
      return res
        .status(400)
        .json({ error: "You need at least 1 Mausoleum first" });

    // Thralls are mostly passive but we use allocation if there's any task for them
    // For now we just store it
    await db.run("UPDATE kingdoms SET mausoleum_allocation = ? WHERE id = ?", [
      JSON.stringify(allocation),
      k.id,
    ]);
    res.json({ ok: true, allocation });
  });

  router.post("/buy-mausoleum-upgrade", requireAuth, requireCsrfToken, async (req, res) => {
    const { upgradeKey } = req.body;
    const k = await db.get("SELECT id, turn, race, gold, mausoleum_upgrades FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.race !== "vampire")
      return res
        .status(403)
        .json({ error: "Only vampires can buy mausoleum upgrades" });

    const upgrades = engine.MAUSOLEUM_UPGRADES;
    const upg = upgrades[upgradeKey];
    if (!upg) return res.status(400).json({ error: "Invalid upgrade" });

    const owned = safeJsonParse(k.mausoleum_upgrades, {}, "auto:mausoleum_upgrades");
    if (owned[upgradeKey])
      return res.status(400).json({ error: "Already owned" });

    if (upg.requires && !owned[upg.requires])
      return res
        .status(400)
        .json({
          error: "Prerequisite not met: " + upgrades[upg.requires].name,
        });

    if (k.gold < upg.cost)
      return res.status(400).json({ error: "Not enough gold" });

    owned[upgradeKey] = true;
    await db.run(
      "UPDATE kingdoms SET gold = gold - ?, mausoleum_upgrades = ? WHERE id = ?",
      [upg.cost, JSON.stringify(owned), k.id],
    );
    res.json({ ok: true, upgrade: upg });
  });

  // â”€â”€ Library allocation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.post("/library-allocation", requireAuth, requireCsrfToken, async (req, res) => {
    const { allocation } = req.body;
    if (!allocation || typeof allocation !== "object")
      return res.status(400).json({ error: "allocation required" });
    const k = await db.get(
      "SELECT id, bld_libraries, scribes, library_upgrades FROM kingdoms WHERE player_id = ?",
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

    await db.run("UPDATE kingdoms SET library_allocation = ? WHERE id = ?", [
      JSON.stringify(allocation),
      k.id,
    ]);
    res.json({ ok: true });
  });

  // library-cancel has been replaced by library-allocation.
  // Admin: clear ALL expeditions for a kingdom (debug tool)
  // â”€â”€ Options â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.post("/options", requireAuth, requireCsrfToken, async (req, res) => {
    const { tax, name } = req.body;
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const updates = { updated_at: Math.floor(Date.now() / 1000) };
    if (tax !== undefined) {
      const t = Number(tax);
      if (t < 0 || t > 100)
        return res.status(400).json({ error: "Tax must be 0â€“100" });
      updates.tax = t;
    }
    if (name !== undefined) {
      if (!name.trim())
        return res.status(400).json({ error: "Name cannot be empty" });
      updates.name = name.trim();
    }
    await applyUpdates(db, k.id, updates);
    res.json({ ok: true, updates });
  });
  // â”€â”€ Season info â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Location â€” get my discovered kingdoms â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.get("/locations", requireAuth, async (req, res) => {
    const k = await db.get(
      "SELECT discovered_kingdoms, location_maps_wip FROM kingdoms WHERE player_id=?",
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
       FROM kingdoms WHERE player_id = ?`,
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

    const k = await db.get("SELECT id, turn, gold, mana, world_fragments, hybrid_blueprints, fragment_bonuses FROM kingdoms WHERE player_id = ?", [
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
      "UPDATE kingdoms SET hybrid_blueprints = ?, fragment_bonuses = ?, gold = ?, mana = ? WHERE id = ?",
      [JSON.stringify(hbp), applyResult.fragment_bonuses, newGold, newMana, k.id]
    );

    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?, ?, ?, ?)",
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

    const k = await db.get("SELECT id, turn, gold, mana, hybrid_blueprints FROM kingdoms WHERE player_id = ?", [
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
      "UPDATE kingdoms SET hybrid_blueprints = ?, gold = ?, mana = ? WHERE id = ?",
      [JSON.stringify(hbp), newGold, newMana, k.id],
    );

    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?, ?, ?, ?)",
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
    const k = await db.get("SELECT id, name, thieves, discovered_kingdoms FROM kingdoms WHERE player_id=?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const target = await db.get("SELECT id, name, turn, hybrid_blueprints, discovered_kingdoms FROM kingdoms WHERE id=?", [
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
        "SELECT name FROM kingdoms WHERE id=?",
        [stolenId],
      );
      delete targetDisc[stolenId];
      await db.run("UPDATE kingdoms SET discovered_kingdoms=? WHERE id=?", [
        JSON.stringify(targetDisc),
        target.id,
      ]);
      let myDisc = {};
      try {
        myDisc = safeJsonParse(k.discovered_kingdoms, {}, "auto:discovered_kingdoms");
      } catch {}
      myDisc[stolenId] = { found: true, mapped: true };
      await db.run("UPDATE kingdoms SET discovered_kingdoms=? WHERE id=?", [
        JSON.stringify(myDisc),
        k.id,
      ]);
      await db.run(
        "INSERT INTO news (kingdom_id,type,message,turn_num) VALUES (?,?,?,?)",
        [
          target.id,
          "covert",
          `ðŸ—ºï¸ A thief stole your location map for ${stolenKingdom?.name || "a kingdom"}.`,
          target.turn,
        ],
      );
      await db.run(
        "INSERT INTO war_log (action_type,attacker_id,attacker_name,defender_id,defender_name,outcome,detail,obscured) VALUES (?,?,?,?,?,?,?,?)",
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

  // â”€â”€ Market â€” Buying resources â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // â”€â”€ Research focus â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // â”€â”€ Studies overview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.get("/profile/:name", async (req, res) => {
    try {
      const k = await db.get(
        `
        SELECT k.id, k.name, k.race, k.gender, k.region, k.level, k.xp, k.land, k.population,
               k.fighters, k.mages, k.rangers, k.happiness, k.turn, k.description,
               k.res_military, k.res_economy, k.res_construction, k.res_spellbook,
               k.res_attack_magic, k.res_entertainment,
               p.id as player_id, p.username        FROM kingdoms k JOIN players p ON k.player_id = p.id
        WHERE LOWER(k.name) = LOWER(?)`,
        [req.params.name],
      );
      if (!k) return res.status(404).json({ error: "Kingdom not found" });
      const alliance = await db.get(
        `
        SELECT a.name FROM alliances a JOIN alliance_members am ON a.id = am.alliance_id
        WHERE am.kingdom_id = ?`,
        [k.id],
      );
      const news = await db.all(
        `
        SELECT type, message, turn_num FROM news
        WHERE kingdom_id = ? AND type = 'attack'
        ORDER BY created_at DESC LIMIT 8`,
        [k.id],
      );
      const rankRow = await db.get(
        "SELECT COUNT(*)+1 as rank FROM kingdoms WHERE land > ? AND id != ?",
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

  // â”€â”€ World map data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.get("/world-map", requireAuth, async (req, res) => {
    try {
      const k = await db.get(
        "SELECT id, discovered_kingdoms FROM kingdoms WHERE player_id = ?",
        [req.player.playerId],
      );
      if (!k) return res.status(404).json({ error: "Kingdom not found" });

      let discovered = {};
      try {
        discovered = safeJsonParse(k.discovered_kingdoms, {}, "auto:discovered_kingdoms");
      } catch {}

      const kingdoms = await db.all(`
        SELECT k.id, k.name, k.race, k.region, k.land, k.level, k.turn        FROM kingdoms k JOIN players p ON k.player_id = p.id
        ORDER BY k.land DESC`);

      const filtered = kingdoms.filter(
        (r) => r.id === k.id || (discovered[r.id] && discovered[r.id].found),
      );

      const tradeRoutes = await db.all(
        "SELECT * FROM trade_routes WHERE kingdom_id = ? OR partner_id = ?",
        [k.id, k.id],
      );

      res.json({ kingdoms: filtered, tradeRoutes });
    } catch {
      // region column may not exist yet â€” fallback query
      try {
        const k = await db.get(
          "SELECT id, discovered_kingdoms FROM kingdoms WHERE player_id = ?",
          [req.player.playerId],
        );
        let discovered = {};
        if (k)
          try {
            discovered = safeJsonParse(k.discovered_kingdoms, {}, "auto:discovered_kingdoms");
          } catch {}

        const kingdoms = await db.all(`
          SELECT k.id, k.name, k.race, '' as region, k.land, k.level, k.turn          FROM kingdoms k JOIN players p ON k.player_id = p.id
          ORDER BY k.land DESC`);

        const filtered = kingdoms.filter(
          (r) =>
            k &&
            (r.id === k.id || (discovered[r.id] && discovered[r.id].found)),
        );

        const tradeRoutes = k
          ? await db.all(
              "SELECT * FROM trade_routes WHERE kingdom_id = ? OR partner_id = ?",
              [k.id, k.id],
            )
          : [];

        res.json({ kingdoms: filtered, tradeRoutes });
      } catch (err2) {
        console.error("[world-map]", err2.message);
        res.status(500).json({ error: "Failed to load map data" });
      }
    }
  });

  router.post("/rebirth", requireAuth, requireCsrfToken, async (req, res) => {
    const k = await db.get("SELECT id, level, prestige_level, land, turn FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    if (!engine.canPrestige(k))
      return res
        .status(400)
        .json({ error: "Require Kingdom Level 50 to Rebirth." });

    const result = engine.processPrestige(k);
    await applyUpdates(db, k.id, result.updates);

    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
      [
        k.id,
        "system",
        "ðŸŒŒ YOU HAVE TRANSCENDED. A new era begins for your empire!",
        result.updates.turn,
      ],
    );

    res.json({ ok: true, prestige_level: result.updates.prestige_level });
  });

  router.get("/lore-and-achievements", requireAuth, async (req, res) => {
    try {
      const k = await db.get(
        "SELECT race, collected_lore, achievements, population, gold, mana, bld_farms, bld_granaries, bld_barracks, bld_outposts, bld_guard_towers, bld_schools, bld_armories, bld_vaults, bld_smithies, bld_markets, bld_mage_towers, bld_shrines, bld_mausoleums, bld_taverns, bld_libraries, bld_housing, bld_walls, bld_training, bld_castles, bld_woodyard, bld_lumber_camp, bld_sawmill, bld_gravel_pit, bld_blockfield, bld_stone_quarry, bld_open_pit, bld_strip_mine, bld_deep_mine FROM kingdoms WHERE player_id = ?",
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



  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // RESOURCE GATHERING SYSTEM
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const {
    initItemsArray,
    addItemToInventory,
  } = engine;

  const { RARE_RESOURCE_ITEMS, RESOURCE_NODE_NAMES, HARVEST_DURATION_BY_RICHNESS } = config;

  // GET /resource-nodes â€” list all discovered nodes for this kingdom
  router.get('/resource-nodes', requireAuth, async (req, res) => {
    try {
      const k = await db.get('SELECT id FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });
      const nodes = await db.all('SELECT * FROM resource_nodes WHERE kingdom_id = ? ORDER BY discovered_at DESC', [k.id]);
      res.json(nodes);
    } catch (e) {
      console.error('[resource-nodes] GET:', e.message);
      res.status(500).json({ error: 'Failed to load resource nodes' });
    }
  });

  // GET /expeditions â€” list all resource expeditions for this kingdom
  router.get('/resource-expeditions', requireAuth, async (req, res) => {
    try {
      const k = await db.get('SELECT id FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });
      const exps = await db.all(
        `SELECT re.*, rn.name as node_name, rn.type as node_type, rn.richness, rn.distance
         FROM resource_expeditions re
         JOIN resource_nodes rn ON re.node_id = rn.id
         WHERE re.kingdom_id = ? AND re.status != 'completed'
         ORDER BY re.depart_at DESC`,
        [k.id]
      );
      res.json(exps.map(e => ({ ...e, loot: safeJsonParse(e.loot, {}, 'expeditions:loot') })));
    } catch (e) {
      console.error('[resource-expeditions] GET:', e.message);
      res.status(500).json({ error: 'Failed to load expeditions' });
    }
  });

  // POST /scout-node â€” pay 500 gold, generate a random resource node
  router.post('/scout-node', requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const k = await db.get('SELECT id, gold FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });
      if (k.gold < 500) return res.status(400).json({ error: 'Need 500 gold to scout a node.' });

      // Weighted type selection
      const typeRoll = Math.random();
      let nodeType;
      if (typeRoll < 0.35) nodeType = 'wood';
      else if (typeRoll < 0.65) nodeType = 'stone';
      else if (typeRoll < 0.90) nodeType = 'iron';
      else nodeType = 'gold';

      // Weighted richness selection (1:30%, 2:30%, 3:25%, 4:10%, 5:5%)
      const rRoll = Math.random();
      let richness;
      if (rRoll < 0.30) richness = 1;
      else if (rRoll < 0.60) richness = 2;
      else if (rRoll < 0.85) richness = 3;
      else if (rRoll < 0.95) richness = 4;
      else richness = 5;

      // Random distance 600â€“28800 seconds
      const distance = Math.floor(Math.random() * 28200) + 600;

      // Pick name from pool
      const namePool = RESOURCE_NODE_NAMES[nodeType] || RESOURCE_NODE_NAMES.wood;
      const name = namePool[Math.floor(Math.random() * namePool.length)];

      let result;
      await db.run("BEGIN TRANSACTION");
      try {
        // Atomic balance check: verify sufficient gold within UPDATE to prevent race conditions
        const goldResult = await db.run('UPDATE kingdoms SET gold = gold - 500 WHERE id = ? AND gold >= 500', [k.id]);
        if (goldResult.changes === 0) {
          await db.run("ROLLBACK");
          return res.status(400).json({ error: 'Need 500 gold to scout a node.' });
        }
        result = await db.run(
          'INSERT INTO resource_nodes (kingdom_id, name, type, distance, richness) VALUES (?, ?, ?, ?, ?)',
          [k.id, name, nodeType, distance, richness]
        );
        await db.run("COMMIT");
      } catch (txErr) {
        await db.run("ROLLBACK");
        throw txErr;
      }

      res.json({
        ok: true,
        node: { id: result.lastID, kingdom_id: k.id, name, type: nodeType, distance, richness, discovered_at: Math.floor(Date.now() / 1000) }
      });
    } catch (e) {
      console.error('[scout-node] POST:', e.message);
      res.status(500).json({ error: 'Failed to scout node' });
    }
  });

  // POST /expedition/launch â€” start a resource expedition to a discovered node
  router.post('/expedition/launch', requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const { nodeId, populationSent } = req.body;
      if (!nodeId || !populationSent) return res.status(400).json({ error: 'nodeId and populationSent required' });
      if (populationSent < 10) return res.status(400).json({ error: 'Must send at least 10 population.' });

      // Lock kingdom to prevent concurrent launches from using same resources
      const k = await db.get('SELECT * FROM kingdoms WHERE player_id = ? FOR UPDATE', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      // Free population cap â€” max 25% of free pop can go on an expedition
      // Also subtract population already deployed on active expeditions (belt-and-suspenders)
      const onExp = await db.get(
        "SELECT SUM(population_sent) as total FROM resource_expeditions WHERE kingdom_id = ? AND status NOT IN ('completed','intercepted')",
        [k.id]
      );
      const freePop = Math.max(0, k.population - engine.totalHiredUnits(k) - (onExp?.total || 0));
      const maxPop = Math.floor(freePop * 0.25);
      if (populationSent > maxPop)
        return res.status(400).json({ error: `Can only send up to 25% of free population (${maxPop.toLocaleString()} max).` });

      const node = await db.get('SELECT * FROM resource_nodes WHERE id = ? AND kingdom_id = ?', [nodeId, k.id]);
      if (!node) return res.status(404).json({ error: 'Node not found or does not belong to you.' });

      // Check no active expedition to this node
      const activeExp = await db.get(
        "SELECT id FROM resource_expeditions WHERE kingdom_id = ? AND node_id = ? AND status NOT IN ('completed','intercepted')",
        [k.id, nodeId]
      );
      if (activeExp) return res.status(400).json({ error: 'You already have an active expedition to this node.' });

      // Get expedition speed bonus
      const raceBonus = engine.raceBonus ? (engine.raceBonus(k, 'expedition_speed') || 1.0) : 1.0;
      const travelTime = Math.ceil(node.distance / raceBonus);
      const harvestDuration = HARVEST_DURATION_BY_RICHNESS[node.richness] || 3600;
      const totalSeconds = travelTime * 2 + harvestDuration; // outbound + harvest + return
      const totalMinutes = totalSeconds / 60;
      const TURNS_PER_MINUTE = 0.28; // 7 turns per 25-minute regen cycle
      const turnsEquiv = totalMinutes * TURNS_PER_MINUTE;
      // Food rate: floor(populationSent / 100) per turn Ã— racial multiplier, same as kingdom pop formula
      const raceFoodMult = engine.FOOD_CONSUMPTION_MULT[k.race] || 1.0;
      const foodPerTurn = Math.max(1, Math.floor(populationSent / 100)) * raceFoodMult;
      const foodNeeded = Math.ceil(turnsEquiv * foodPerTurn * 0.75); // 25% discount
      if (k.food < foodNeeded)
        return res.status(400).json({ error: `Expedition requires ${foodNeeded.toLocaleString()} food for the journey (you have ${k.food.toLocaleString()}).` });

      const now = Math.floor(Date.now() / 1000);
      const arrive_at = now + travelTime;

      // Depart: remove population and food from kingdom atomically
      await db.run("BEGIN TRANSACTION");
      try {
        // Atomic check-and-deduct: verify sufficient resources AND deduct in single UPDATE
        // This prevents two simultaneous launches from both seeing sufficient food
        const foodResult = await db.run(
          'UPDATE kingdoms SET food = MAX(0, food - ?), population = MAX(0, population - ?) WHERE id = ? AND food >= ? AND population >= ?',
          [foodNeeded, populationSent, k.id, foodNeeded, populationSent]
        );
        if (foodResult.changes === 0) {
          await db.run("ROLLBACK");
          return res.status(400).json({
            error: `Expedition requires ${foodNeeded.toLocaleString()} food and ${populationSent.toLocaleString()} population. Check your resources.`
          });
        }
        await db.run(
          'INSERT INTO resource_expeditions (kingdom_id, node_id, population_sent, depart_at, arrive_at, status, loot, food_taken) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [k.id, nodeId, populationSent, now, arrive_at, 'outbound', '{}', foodNeeded]
        );
        await db.run("COMMIT");
      } catch (txErr) {
        await db.run("ROLLBACK");
        throw txErr;
      }

      res.json({ ok: true, arrive_at, travelTime, foodTaken: foodNeeded });
    } catch (e) {
      console.error('[expedition/launch] POST:', e.message);
      res.status(500).json({ error: 'Failed to launch expedition' });
    }
  });

  // POST /expedition/intercept â€” orc-only interception
  router.post('/expedition/intercept', requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const { expeditionId, fighters } = req.body;
      const k = await db.get('SELECT id, name, turn, race, fighters, wood, stone, iron, gold FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });
      if (k.race !== 'orc') return res.status(403).json({ error: 'Only Orcs can intercept expeditions.' });
      if (!fighters || fighters < 1) return res.status(400).json({ error: 'Must send at least 1 fighter.' });
      if (k.fighters < fighters) return res.status(400).json({ error: 'Not enough fighters.' });

      const exp = await db.get(
        "SELECT re.*, rn.type as node_type, rn.richness FROM resource_expeditions re JOIN resource_nodes rn ON re.node_id = rn.id WHERE re.id = ? AND re.status IN ('outbound','harvesting')",
        [expeditionId]
      );
      if (!exp) return res.status(404).json({ error: 'Expedition not found or not interceptable.' });
      if (exp.kingdom_id === k.id) return res.status(400).json({ error: 'Cannot intercept your own expedition.' });

      const defender = await db.get('SELECT id FROM kingdoms WHERE id = ?', [exp.kingdom_id]);
      if (!defender) return res.status(404).json({ error: 'Defending kingdom not found.' });

      // Combat: attacker power = fighters, defender power = populationSent * 0.1
      const attackPower = fighters;
      const defendPower = exp.population_sent * 0.1;
      const success = attackPower > defendPower * 3;

      let loot = safeJsonParse(exp.loot, {}, 'intercept:loot');
      const newsMessages = [];

      if (success) {
        // Steal loot and return the expedition population to the defender
        await db.run("UPDATE resource_expeditions SET status = 'intercepted', loot = '{}' WHERE id = ?", [exp.id]);
        await db.run('UPDATE kingdoms SET population = population + ? WHERE id = ?', [exp.population_sent, exp.kingdom_id]);
        // Give loot to attacker
        const lootUpdates = {};
        for (const [res, qty] of Object.entries(loot)) {
          if (qty > 0 && ['wood','stone','iron','gold'].includes(res)) {
            lootUpdates[res] = (k[res] || 0) + qty;
          }
        }
        if (Object.keys(lootUpdates).length > 0) {
          const cols = Object.keys(lootUpdates).map(c => `${c} = ?`).join(', ');
          await db.run(`UPDATE kingdoms SET ${cols} WHERE id = ?`, [...Object.values(lootUpdates), k.id]);
        }
      newsMessages.push({ kingdom_id: k.id, message: repairMojibake(`âš”ï¸ Your warriors intercepted an expedition! You seized: ${JSON.stringify(loot)}.`) });
      newsMessages.push({ kingdom_id: exp.kingdom_id, message: repairMojibake(`ðŸš¨ Orc raiders from ${k.name} intercepted your expedition and stole your loot! Your ${exp.population_sent.toLocaleString()} people fled home.`) });
      } else {
        // Attacker takes casualties
        const casualties = Math.floor(fighters * 0.3);
        await db.run('UPDATE kingdoms SET fighters = fighters - ? WHERE id = ?', [casualties, k.id]);
        newsMessages.push({ kingdom_id: k.id, message: repairMojibake(`âš”ï¸ Your warriors failed to intercept the expedition. Lost ${casualties} fighters.`) });
        newsMessages.push({ kingdom_id: exp.kingdom_id, message: repairMojibake(`ðŸ›¡ï¸ Your expedition successfully repelled Orc raiders from ${k.name}!`) });
      }

      for (const nm of newsMessages) {
        await db.run('INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?, ?, ?, ?)', [nm.kingdom_id, 'system', nm.message, 0]);
      }

      res.json({ ok: true, success, loot: success ? loot : null });
    } catch (e) {
      console.error('[expedition/intercept] POST:', e.message);
      res.status(500).json({ error: 'Failed to process interception' });
    }
  });

  // GET /expeditions/visible â€” orc-only, returns other kingdoms' active expeditions
  router.get('/expeditions/visible', requireAuth, async (req, res) => {
    try {
      const k = await db.get('SELECT id, race FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });
      if (k.race !== 'orc') return res.status(403).json({ error: 'Only Orcs can see other expeditions.' });

      const exps = await db.all(
        `SELECT re.id, re.status, re.arrive_at, re.harvest_ends_at, re.return_at,
                re.population_sent, rn.type as node_type, kk.name as kingdom_name
         FROM resource_expeditions re
         JOIN resource_nodes rn ON re.node_id = rn.id
         JOIN kingdoms kk ON re.kingdom_id = kk.id
         WHERE re.kingdom_id != ? AND re.status NOT IN ('completed','intercepted')
         ORDER BY re.depart_at DESC LIMIT 100`,
        [k.id]
      );
      res.json(exps);
    } catch (e) {
      console.error('[expeditions/visible] GET:', e.message);
      res.status(500).json({ error: 'Failed to load visible expeditions' });
    }
  });

  // POST /resource-upgrade â€” purchase stage 2 or 3 upgrade for a resource type
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
         FROM kingdoms WHERE player_id = ?`,
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
          `UPDATE kingdoms SET gold = gold - 10000, ${resCol} = ${resCol} - 200, resource_sequence = ? WHERE id = ?`,
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
          `UPDATE kingdoms SET gold = gold - 100000, ${type} = ${type} - 1000, ${crossResCol} = ${crossResCol} - 500, resource_sequence = ? WHERE id = ?`,
          [JSON.stringify(updatedSeq), k.id]
        );

        return res.json({ ok: true, message: `Stage 3 ${type} upgrade purchased.` });
      }
    } catch (e) {
      console.error('[resource-upgrade] POST:', e.message);
      res.status(500).json({ error: 'Failed to process resource upgrade' });
    }
  });

  // â”€â”€ Process resource expeditions (called lazily from processTurn endpoint) â”€â”€â”€â”€
  async function processResourceExpeditionsDb(kingdomId, k) {
    const now = Math.floor(Date.now() / 1000);
    const exps = await db.all(
      "SELECT re.*, rn.type as node_type, rn.richness FROM resource_expeditions re JOIN resource_nodes rn ON re.node_id = rn.id WHERE re.kingdom_id = ? AND re.status NOT IN ('completed','intercepted')",
      [kingdomId]
    );

    const lootEvents = [];
    const kUpdates = {};

    for (const exp of exps) {
      const arriveAt = Number(exp.arrive_at) || 0;
      const harvestEndsAt = Number(exp.harvest_ends_at) || 0;
      const returnAt = Number(exp.return_at) || 0;

      if (exp.status === 'outbound' && now >= arriveAt) {
        const harvestDuration = HARVEST_DURATION_BY_RICHNESS[exp.richness] || 3600;
        await db.run(
          "UPDATE resource_expeditions SET status = 'harvesting', harvest_ends_at = ? WHERE id = ?",
          [now + harvestDuration, exp.id]
        );
      } else if (exp.status === 'harvesting' && harvestEndsAt && now >= harvestEndsAt) {
        // Compute loot
        const baseLoot = exp.richness * 50 * (exp.population_sent / 100);
        const loot = { [exp.node_type]: Math.floor(baseLoot) };

        // 5% chance bonus rare item
        const rareItems = RARE_RESOURCE_ITEMS[exp.node_type];
        const rareFindMult = engine.raceBonus ? (engine.raceBonus(k, 'rare_find') || 1.0) : 1.0;
        const items = initItemsArray(safeJsonParse(k.items, [], 'processExpeditions:items'));
        let itemsChanged = false;

        if (Math.random() < 0.02 * rareFindMult) {
          // 2% earth fragment
          const ef = items.find(i => i.id === 'earth_fragment');
          if (!ef || (ef.qty || 0) === 0) {
            addItemToInventory(items, 'earth_fragment', 'Earth Fragment', 1);
            itemsChanged = true;
            loot._item = 'Earth Fragment';
          }
        } else if (rareItems && Math.random() < 0.05) {
          // 5% rare resource item
          const chosen = rareItems[Math.floor(Math.random() * rareItems.length)];
          const existing = items.find(i => i.id === chosen.id);
          if (!existing || (existing.qty || 0) < 3) {
            addItemToInventory(items, chosen.id, chosen.name, 1);
            itemsChanged = true;
            loot._item = chosen.name;
          }
        }

        if (itemsChanged) {
          kUpdates.items = JSON.stringify(items);
          k.items = kUpdates.items; // update local reference for subsequent expeditions
        }

        // Get race bonus for speed (already used arrive_at, but for return trip)
        const raceSpeedMult = engine.raceBonus ? (engine.raceBonus(k, 'expedition_speed') || 1.0) : 1.0;
        const travelTime = Math.ceil((exp.distance || 3600) / raceSpeedMult);
        const return_at = now + travelTime;

        await db.run(
          "UPDATE resource_expeditions SET status = 'returning', loot = ?, return_at = ? WHERE id = ?",
          [JSON.stringify(loot), return_at, exp.id]
        );
      } else if (exp.status === 'returning' && returnAt && now >= returnAt) {
        const loot = safeJsonParse(exp.loot, {}, 'expedition:loot');
        // Apply loot to kingdom
        for (const [res, qty] of Object.entries(loot)) {
          if (res.startsWith('_')) continue; // skip metadata
          if (['wood','stone','iron','gold'].includes(res) && qty > 0) {
            kUpdates[res] = (kUpdates[res] !== undefined ? kUpdates[res] : (k[res] || 0)) + qty;
          }
        }
        // Return population to kingdom
        kUpdates.population = (kUpdates.population !== undefined ? kUpdates.population : k.population) + exp.population_sent;
        await db.run("UPDATE resource_expeditions SET status = 'completed' WHERE id = ?", [exp.id]);
        lootEvents.push({ type: 'system', message: `ðŸ—‚ï¸ Expedition returned with: ${Object.entries(loot).filter(([k]) => !k.startsWith('_')).map(([r,q]) => `${q} ${r}`).join(', ')}.` });
      }
    }

    return { kUpdates, lootEvents };
  }

  // Attach this helper to be callable from the processTurn route
  router._processResourceExpeditions = processResourceExpeditionsDb;

  // â”€â”€ Inventory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.get('/inventory', requireAuth, async (req, res) => {
    try {
      const k = await db.get('SELECT id, items FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
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

  // â”€â”€ WORLD FRAGMENT ATTUNEMENTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // GET /api/kingdom/attunements â€” Get current attunement status
  router.get('/attunements', requireAuth, async (req, res) => {
    try {
      const kingdom = await db.get("SELECT id, fragment_bonuses, world_fragments FROM kingdoms WHERE player_id = ?", [
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

  // GET /api/kingdom/available-attunements â€” Get available attunement options
  router.get('/available-attunements', requireAuth, async (req, res) => {
    try {
      const kingdom = await db.get(
        `SELECT id, fragment_bonuses, world_fragments, bld_farms, bld_barracks, bld_markets,
                bld_schools, bld_mage_towers, bld_shrines, bld_guard_towers, bld_castles,
                bld_smithies, bld_libraries, bld_taverns, bld_mausoleums, bld_walls,
                bld_outposts, bld_granaries, bld_housing, bld_training, bld_vaults, bld_armories
         FROM kingdoms WHERE player_id = ?`,
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

  // POST /api/kingdom/attune-fragment â€” Apply a fragment attunement to a building
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
         FROM kingdoms WHERE player_id = ?`,
        [req.player.playerId]
      );
      if (!kingdom) return res.status(404).json({ error: "Kingdom not found" });

      // Apply attunement logic
      const result = attunementManager.applyAttunement(kingdom, fragmentName, buildingType);
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }

      await db.run(
        `UPDATE kingdoms SET fragment_bonuses = ? WHERE id = ?`,
        [result.fragment_bonuses, kingdom.id]
      );

      await db.run(
        "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?, ?, ?, ?)",
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

  // POST /api/kingdom/remove-attunement â€” Remove fragment attunement from building
  router.post('/remove-attunement', requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const { buildingType } = req.body;

      if (!buildingType) {
        return res.status(400).json({ error: 'buildingType required' });
      }

      await db.run("BEGIN TRANSACTION");
      try {
        const kingdom = await db.get("SELECT id, fragment_bonuses FROM kingdoms WHERE player_id = ? FOR UPDATE", [
          req.player.playerId,
        ]);
        if (!kingdom) {
          await db.run("ROLLBACK");
          return res.status(404).json({ error: "Kingdom not found" });
        }

        // Check if any synergy cooldown is active â€” if so, block removal to prevent synergy-hopping
        const now = Math.floor(Date.now() / 1000);
        const activeCooldown = await db.get(
          "SELECT synergy_id FROM synergy_cooldowns WHERE kingdom_id = ? AND cooldown_until > ? LIMIT 1",
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
          `UPDATE kingdoms SET fragment_bonuses = ? WHERE id = ?`,
          [JSON.stringify(currentAttunements), kingdom.id]
        );

        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?, ?, ?, ?)",
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

  // GET /api/kingdom/contributing-synergies â€” Check which synergies a building/fragment contributes to
  // Returns an opaque "resonance" tier instead of the synergy recipes so the
  // client can't reveal the formula via devtools â€” players discover combos
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
          "SELECT fragment_bonuses FROM kingdoms WHERE player_id = ?",
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
        // Keep names/emojis out â€” they would let players reverse-engineer
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

  // GET /api/kingdom/synergy-status â€” Get active synergy and near-activation hints
  router.get('/synergy-status', requireAuth, async (req, res) => {
    try {
      const kingdom = await db.get(
        "SELECT id, fragment_bonuses FROM kingdoms WHERE player_id = ?",
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

  // GET /api/kingdom/synergy-cooldown â€” Check cooldown status for a synergy ability
  router.get('/synergy-cooldown', requireAuth, async (req, res) => {
    try {
      const { synergy_id } = req.query;
      if (!synergy_id) {
        return res.status(400).json({ error: 'synergy_id required' });
      }

      const kingdom = await db.get(
        "SELECT id FROM kingdoms WHERE player_id = ?",
        [req.player.playerId]
      );
      if (!kingdom) {
        return res.status(404).json({ error: 'Kingdom not found' });
      }

      // Check if cooldown exists in database
      const cooldown = await db.get(
        "SELECT cooldown_until FROM synergy_cooldowns WHERE kingdom_id = ? AND synergy_id = ?",
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

  // POST /api/kingdom/activate-synergy-ability â€” Activate a synergy's active ability
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
          "SELECT * FROM kingdoms WHERE player_id = ? FOR UPDATE",
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
          "SELECT cooldown_until FROM synergy_cooldowns WHERE kingdom_id = ? AND synergy_id = ? FOR UPDATE",
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
          "INSERT INTO synergy_cooldowns (kingdom_id, synergy_id, cooldown_until) VALUES (?, ?, ?) ON CONFLICT(kingdom_id, synergy_id) DO UPDATE SET cooldown_until = ?",
          [kingdom.id, synergy_id, Math.floor(cooldownUntil), Math.floor(cooldownUntil)]
        );

        // Write a news entry so the player sees the activation in their feed (inside transaction for atomicity)
        const newsMessage = synergy.emoji + " " + synergy.name + ": " + (synergy.active?.name || "") + " activated! " + (synergy.active?.desc || "");
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?, ?, ?, ?)",
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
      const k = await db.get('SELECT id FROM kingdoms WHERE player_id = ?', [playerId]);
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
      const old = await db.get('SELECT custom_portrait FROM kingdoms WHERE id = ?', [k.id]);
      if (old?.custom_portrait) {
        const safeBasename = path.basename(old.custom_portrait);
        const oldPath = path.join(portraitsPath, safeBasename);
        fs.unlink(oldPath, (e) => {
          if (e) console.warn('Failed to delete old portrait:', e.message);
        });
      }

      // Update database
      await db.run('UPDATE kingdoms SET custom_portrait = ? WHERE id = ?', [portraitPath, k.id]);

      res.json({ ok: true, portraitUrl: portraitPath });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/kingdom/portrait - Remove custom portrait
  router.delete('/portrait', requireAuth, async (req, res) => {
    try {
      const playerId = req.player.playerId;
      const k = await db.get('SELECT id, custom_portrait FROM kingdoms WHERE player_id = ?', [playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      if (k.custom_portrait) {
        const safeBasename = path.basename(k.custom_portrait);
        const filePath = path.join(portraitsPath, safeBasename);
        fs.unlink(filePath, (e) => {
          if (e) console.warn('Failed to delete portrait file:', e.message);
        });
      }

      await db.run('UPDATE kingdoms SET custom_portrait = NULL WHERE id = ?', [k.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/kingdom/happiness-status - Happiness data + 50-turn history
  router.get('/happiness-status', requireAuth, async (req, res) => {
    try {
      const playerId = req.player.playerId;
      const k = await db.get('SELECT * FROM kingdoms WHERE player_id = ?', [playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      // Get current happiness components
      const happinessResult = engine.calculateHappiness(k);

      // Get last 50 turns of happiness history
      const history = await db.all(
        `SELECT turn, happiness_value FROM happiness_history
         WHERE kingdom_id = ? ORDER BY turn DESC LIMIT 50`,
        [k.id]
      );

      // Get recent happiness events
      const recentEvents = await db.all(
        `SELECT * FROM happiness_events
         WHERE kingdom_id = ? ORDER BY turn DESC LIMIT 10`,
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

      const k = await db.get('SELECT id FROM kingdoms WHERE player_id = ?', [playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      const events = await db.all(
        `SELECT * FROM happiness_events
         WHERE kingdom_id = ? ORDER BY turn DESC LIMIT ?`,
        [k.id, limit]
      );

      res.json({ events: events.reverse() }); // Reverse to oldest first
    } catch (err) {
      console.error('[kingdom] happiness-events error:', err);
      res.status(500).json({ error: err.message });
    }
  });

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
  // We pass db parameter as usual, but applyKingdomUpdates just works directly against the global db object via schema
  await applyKingdomUpdates(kingdomId, updatesForDb);
}

// Insert multiple news rows in a single query â€” much faster than N sequential inserts
async function bulkInsertNews(db, rows) {
  if (!rows || rows.length === 0) return;
  const placeholders = rows.map(() => "(?,?,?,?)").join(",");
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

// Prune old news â€” keep only the most recent N rows per kingdom
async function pruneNews(db, kingdomId, keep = 200) {
  await db.run(
    `
    DELETE FROM news WHERE kingdom_id = ? AND id NOT IN (
      SELECT id FROM news WHERE kingdom_id = ? ORDER BY created_at DESC LIMIT ?
    )
  `,
    [kingdomId, kingdomId, keep],
  );
}
