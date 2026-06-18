const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const engine = require("../game/engine");
const config = require("../game/config");
const { requireAuth, requireCsrfToken } = require("./middleware");
const { progressGoal, generateGoals, claimGoal } = require('../game/goals');
const { safeJsonParse, devLog } = require('../utils/helpers');
const { getKingdomAttunements } = require('../game/fragment-attunements');
const fragmentBonusManager = require("../game/fragment-bonus-manager");
const attunementManager = require('../game/attunement-manager');
const synergiesModule = require('../game/fragment-synergies');
const abilityManager = require('../game/active-ability-manager');
const { applyKingdomUpdates } = require('../db/schema');
const { marketPriceCache, rankingsCache, setUnreadCount } = require("../cache.js");

const router = express.Router();

function repairMojibake(value) {
  if (value === null || value === undefined) return value;
  let text = String(value);
  if (!/[ÃƒÃ‚Ã¢Ã°Å¸ðâÂï¿½]/.test(text)) return text;
  for (let i = 0; i < 20; i++) {
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
    .replace(/Â/g, "")
    .replace(/—/g, "—")
    .replace(/–/g, "-")
    .replace(/•/g, "•")
    .replace(/‘|’/g, "'")
    .replace(/“|"/g, '"');
  return text;
}

function normalizeNewsRow(row) {
  if (!row || typeof row !== "object") return row;
  if (typeof row.message === "string") {
    return { ...row, message: repairMojibake(row.message) };
  }
  return row;
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
      return cb(new Error("Invalid file type — only image files are allowed"));
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

// ── Per-player turn processing lock ──────────────────────────────────────────
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

async function withTransaction(db, fn) {
  await db.run("BEGIN TRANSACTION");
  try {
    const result = await fn();
    await db.run("COMMIT");
    return result;
  } catch (err) {
    try {
      await db.run("ROLLBACK");
    } catch {}
    throw err;
  }
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
const KINGDOM_COVERT = `${KINGDOM_CORE}, thieves, ninjas, troop_levels,
  bld_guard_towers, bld_walls, bld_mage_towers, bld_libraries, bld_armories, bld_vaults, bld_mausoleums,
  level, prestige_level, milestone_bonuses, bank_upgrades, trade_routes, thralls, mausoleum_upgrades,
  discovered_kingdoms`;
const _KINGDOM_ECONOMY = `${KINGDOM_CORE}, gold, market_upgrades, bank_upgrades, farm_upgrades, discovered_kingdoms`;

// Parse all JSON fields on a kingdom object (used by /me endpoint)
const JSON_FIELDS = {
  'research_allocation': {}, 'mage_tower_allocation': {}, 'shrine_allocation': {},
  'library_allocation': {}, 'library_progress': {}, 'tower_progress': {},
  'scrolls': {}, 'active_effects': {}, 'discovered_kingdoms': {},
  'build_queue': {}, 'build_progress': {}, 'build_allocation': {}, 'resource_build_allocation': {},
  'troop_levels': {}, 'training_allocation': {}, 'smithy_allocation': {},
  'racial_bonuses_unlocked': {}, 'active_event': {}, 'location_maps_wip': [],
  'wall_upgrades': {}, 'tower_def_upgrades': {}, 'tower_upgrades': {},
  'school_upgrades': {}, 'shrine_upgrades': {}, 'library_upgrades': {},
  'farm_upgrades': {}, 'market_upgrades': {}, 'tavern_upgrades': {},
  'bank_upgrades': {}, 'bank_deposits': [], 'mausoleum_upgrades': {},
  'mausoleum_allocation': {}, 'ledger': [], 'mercenaries': [],
  'collected_lore': [], 'collected_events': [], 'achievements': [],
  'items': [], 'resource_sequence': {}, 'goals': {},
  'outpost_upgrades': {}, 'defense_upgrades': {}, 'granary_upgrades': {},
};

function parseKingdomJson(k) {
  for (const [field, defaultVal] of Object.entries(JSON_FIELDS)) {
    if (k[field] !== undefined && k[field] !== null) {
      k[field] = safeJsonParse(k[field], defaultVal, `me:${field}`);
    }
  }
  return k;
}


module.exports = function (db) {
  router.get("/me", requireAuth, async (req, res) => {
    const k = await db.get(
      "SELECT k.*, p.username, p.chat_name, p.chat_color FROM kingdoms k JOIN players p ON k.player_id = p.id WHERE k.player_id = ?",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    parseKingdomJson(k);

    k.score = engine.calculateScore(k);
    k.defense_rating = engine.defenseRating(k);

    // Calculate built_land from all building types
    let builtLand = 0;
    for (const [building, cost] of Object.entries(config.BUILDING_LAND_COST)) {
      const col = config.BUILDING_COL[building];
      if (col && k[col]) {
        builtLand += k[col] * cost;
      }
    }
    k.built_land = builtLand;

    res.json(k);
  });

  // ── Save research allocation ───────────────────────────────────────────────
  router.get("/chat/global", requireAuth, async (req, res) => {
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

  router.post("/research-allocation", requireAuth, requireCsrfToken, async (req, res) => {
    const { allocation } = req.body;
    if (!allocation || typeof allocation !== "object")
      return res.status(400).json({ error: "allocation object required" });

    // Validate allocation keys (whitelist valid research types)
    const validKeys = new Set(['spellbook', 'school_spellbook']);
    let totalAllocated = 0;

    for (const [key, value] of Object.entries(allocation)) {
      // Whitelist validation: reject unknown keys
      if (!validKeys.has(key)) {
        return res.status(400).json({ error: `Invalid allocation key: ${key}` });
      }

      // Type and range validation: ensure non-negative integers
      const numVal = Number(value);
      if (!Number.isInteger(numVal) || numVal < 0) {
        return res.status(400).json({ error: `Allocation values must be non-negative integers (got ${value})` });
      }

      totalAllocated += numVal;
    }

    // Sanity check: prevent unreasonable allocations (max 10k researchers)
    if (totalAllocated > 10000) {
      return res.status(400).json({ error: "Allocation exceeds maximum of 10000" });
    }

    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    await db.run("UPDATE kingdoms SET research_allocation = ? WHERE id = ?", [
      JSON.stringify(allocation),
      k.id,
    ]);
    res.json({ ok: true });
  });

  router.post("/description", requireAuth, requireCsrfToken, async (req, res) => {
    const { description } = req.body;
    if (description && typeof description !== "string")
      return res.status(400).json({ error: "Description must be a string" });
    if (description && description.length > 1000)
      return res
        .status(400)
        .json({ error: "Description too long (max 1000 chars)" });
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    await db.run("UPDATE kingdoms SET description = ? WHERE id = ?", [
      description || null,
      k.id,
    ]);
    res.json({ ok: true });
  });

  router.get("/rankings", requireAuth, async (req, res) => {
    const pk = await db.get(
      "SELECT id, discovered_kingdoms FROM kingdoms WHERE player_id = ?",
      [req.player.playerId],
    );
    if (!pk) return res.status(404).json({ error: "Kingdom not found" });

    // The top-1000 query + scoring is user-independent and expensive
    // (calculateScore parses troop_levels JSON per row), so cache it briefly.
    // Per-user work (discovered kingdoms) happens below on a copy.
    let baseScored = rankingsCache.get("base_scored_top1000");
    if (!baseScored) {
      // Optimized: Use subqueries instead of LEFT JOIN OR (better index utilization)
      const rows = await db.all(`
        SELECT
          k.*,
          p.id as player_id,
          p.username,
          (
            SELECT MAX(created_at) FROM war_log
            WHERE attacker_id = k.id OR defender_id = k.id
            LIMIT 1
          ) as last_combat_at
        FROM kingdoms k
        JOIN players p ON k.player_id = p.id
        ORDER BY k.land DESC, k.population DESC
        LIMIT 1000
      `);
      for (const r of rows) {
        r.score = engine.calculateScore(r);
      }
      baseScored = rows;
      rankingsCache.set("base_scored_top1000", baseScored, 30 * 1000);
    }

    // Get discovered kingdoms for user
    let disc = {};
    try {
      disc = safeJsonParse(pk.discovered_kingdoms, {}, "auto:discovered_kingdoms");
    } catch {}

    const scoredRows = [...baseScored];
    const discoveredIds = new Set(Object.keys(disc).map(id => parseInt(id)));

    // Add any discovered kingdoms not in top 1000 (but skip expensive calculation if not needed)
    if (discoveredIds.size > 0) {
      const topIds = new Set(scoredRows.map(r => r.id));
      if (discoveredIds.size > topIds.size) {
        // Some discovered kingdoms aren't in top 1000, need to fetch and score them
        const missingIds = Array.from(discoveredIds).filter(id => !topIds.has(id));
        if (missingIds.length > 0) {
          const placeholders = missingIds.map((_, i) => `$${i + 1}`).join(',');
          const missingRows = await db.all(`
            SELECT k.*, p.id as player_id, p.username FROM kingdoms k
            JOIN players p ON k.player_id = p.id
            WHERE k.id IN (${placeholders})
          `, missingIds);
          for (let r of missingRows) {
            r.score = engine.calculateScore(r);
            scoredRows.push(r);
          }
        }
      }
    }

    // Sort by score DESC
    scoredRows.sort((a, b) => b.score - a.score);

    const rankings = scoredRows
      .filter((r, i) => i < 500 || disc[r.id])
      .map((r, i) => ({
        id: r.id,
        name: r.name,
        race: r.race,
        land: r.land,
        turn: r.turn,
        population: r.population,
        fighters: r.fighters,
        mages: r.mages,
        level: r.level,
        player_id: r.player_id,
        username: r.username,
          score: r.score,
        rank: i + 1,
        last_combat_at: r.last_combat_at,
      }));

    res.json({ rankings });
  });

  router.get("/alliance-rankings", requireAuth, async (req, res) => {
    try {
      // Get alliance names and all members
      const allianceNames = await db.all(`SELECT id, name FROM alliances`);
      const memberRows = await db.all(`
        SELECT k.*, a.id as alliance_id
        FROM alliances a
        JOIN alliance_members am ON a.id = am.alliance_id
        JOIN kingdoms k ON am.kingdom_id = k.id
      `);

      // Build alliance map with aggregates from members
      const allianceMap = {};
      for (const alliance of allianceNames) {
        allianceMap[alliance.id] = {
          id: alliance.id,
          name: alliance.name,
          member_count: 0,
          total_land: 0,
          total_pop: 0,
          total_score: 0,
        };
      }

      // Aggregate from members
      for (const k of memberRows) {
        if (allianceMap[k.alliance_id]) {
          allianceMap[k.alliance_id].member_count++;
          allianceMap[k.alliance_id].total_land += k.land || 0;
          allianceMap[k.alliance_id].total_pop += k.population || 0;
          allianceMap[k.alliance_id].total_score += engine.calculateScore(k);
        }
      }

      const results = Object.values(allianceMap);
      results.sort((a, b) => b.total_score - a.total_score);

      res.json(results.map((r, i) => ({ ...r, rank: i + 1 })));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/war-log", requireAuth, async (_req, res) => {
    const rows = await db.all(`
      SELECT id, action_type, attacker_id, attacker_name, defender_id, defender_name,
             outcome, detail, obscured, created_at
      FROM war_log
      ORDER BY created_at DESC
      LIMIT 100
    `);
    res.json({ rows });
  });

  router.get("/war-log/:id", requireAuth, async (req, res) => {
    const row = await db.get("SELECT * FROM war_log WHERE id = ?", [
      req.params.id,
    ]);
    if (!row) return res.status(404).json({ error: "Log not found" });
    res.json(row);
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
    setUnreadCount(k.id, 0); // Mark all read, so unread count is 0
    res.json(items.map(normalizeNewsRow));
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

  // ── Shared turn runner — used by ALL routes that consume a turn ──────────────
  async function runTurn(db, k) {
    if (!k) throw new Error('Kingdom not found');
    // Inject region ownership status for bonuses
    // All 3 queries are independent — run them in parallel
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
    // Dedup news — only insert if we haven't already sent this EXACT message recently
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
        !ev.message.includes("🏗️") &&
        !ev.message.includes("📚") &&
        !ev.message.includes("✅")
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
        const other = await db.get(
          "SELECT id, name FROM kingdoms WHERE id != ? ORDER BY RANDOM() LIMIT 1",
          [k.id],
        );
        if (other) {
          const freshK = await db.get(
            "SELECT discovered_kingdoms FROM kingdoms WHERE id=?",
            [k.id],
          );
          let disc = {};
          try {
            disc = safeJsonParse(freshK.discovered_kingdoms, {}, "auto:discovered_kingdoms");
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
                repairMojibake(`🔭 Your Surveyors discovered the kingdom of ${other.name}!`),
                turnNum,
              ],
            );
            events.push({
              type: "system",
              message: repairMojibake(`🔭 Your Surveyors discovered the kingdom of ${other.name}!`),
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

  // ── Take turn (advance game state) ───────────────────────────────────────────
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
            throw new Error("No turns available — next +7 turns in 25 minutes");
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
      res.status(500).json({ error: "Turn processing failed — please try again" });
    }
  });

  // ── Hire units ────────────────────────────────────────────────────────────────
  router.post("/hire", requireAuth, requireCsrfToken, async (req, res) => {
    const { unit, amount } = req.body;
    const k = await db.get(`SELECT ${KINGDOM_HIRE} FROM kingdoms WHERE player_id = ?`, [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    // Apply hire updates immediately without consuming a turn
    const hireResult = engine.hireUnits(k, unit, Number(amount));
    if (hireResult.error)
      return res.status(400).json({ error: hireResult.error });

    try {
      const hireUpdates = hireResult.updates;
      await applyUpdates(db, k.id, hireUpdates);
      res.json({
        ok: true,
        updates: hireUpdates,
        events: [],
        turns_stored: k.turns_stored,
      });
    } catch (err) {
      console.error("[hire] failed:", err.message);
      res.status(500).json({ error: "Hire failed — please try again" });
    }
  });

  // ── Research ──────────────────────────────────────────────────────────────────
  router.post("/research", requireAuth, requireCsrfToken, async (req, res) => {
    const { discipline, researchers } = req.body;
    try {
      // Wrap in transaction with row-level lock to prevent concurrent conflicts
      await db.run("BEGIN TRANSACTION");
      const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ? FOR UPDATE", [
        req.player.playerId,
      ]);
      if (!k) {
        await db.run("ROLLBACK");
        return res.status(404).json({ error: "Kingdom not found" });
      }
      if (k.turns_stored < 1) {
        await db.run("ROLLBACK");
        return res.status(429).json({ error: "No turns available" });
      }

      // Run full turn first
      await loadTradeRoutes(k);
      const { updates: turnUpdates, events } = engine.processTurn(k);
      turnUpdates.turns_stored = k.turns_stored - 1;

      // Apply research on top of turn state
      const kAfterTurn = { ...k, ...turnUpdates };
      const resResult = engine.studyDiscipline(
        kAfterTurn,
        discipline,
        Number(researchers),
      );
      if (resResult.error) {
        await db.run("ROLLBACK");
        return res.status(400).json({ error: resResult.error });
      }

      const finalUpdates = { ...turnUpdates, ...resResult.updates };
      await applyUpdates(db, k.id, finalUpdates);

      const resCol = Object.keys(resResult.updates).find((k) =>
        k.startsWith("res_"),
      );
      const newVal = resCol ? finalUpdates[resCol] : "?";
      events.push({
        type: "system",
        message: `📚 Studied ${discipline} with ${Number(researchers).toLocaleString()} researchers · +${resResult.increment} → now ${newVal}${discipline !== "spellbook" ? "%" : ""}.`,
      });
      await bulkInsertNews(
        db,
        events.map((ev) => ({
          kingdom_id: k.id,
          type: ev.type || "system",
          message: ev.message,
          turn_num: turnUpdates.turn || k.turn,
        })),
      );
      await db.run("COMMIT");

      res.json({
        ok: true,
        increment: resResult.increment,
        updates: finalUpdates,
        events,
        turns_stored: finalUpdates.turns_stored,
      });
    } catch (err) {
      console.error("[research] error:", err.message);
      try {
        await db.run("ROLLBACK");
      } catch (rollbackErr) {
        console.error("[research] rollback error:", rollbackErr.message);
      }
      res.status(500).json({ error: "Research processing failed — please try again" });
    }
  });

  // ── Queue buildings — charges gold, no turn cost ──────────────────────────────
  router.post("/build-queue", requireAuth, requireCsrfToken, async (req, res) => {
    const { orders } = req.body;
    if (!orders || typeof orders !== "object")
      return res.status(400).json({ error: "orders required" });
    const k = await db.get(`SELECT ${KINGDOM_RESOURCE} FROM kingdoms WHERE player_id = ?`, [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    try {
      k.build_queue = safeJsonParse(k.build_queue, {}, "auto:build_queue");
    } catch {
      k.build_queue = {};
    }
    const result = engine.queueBuildings(k, orders);
    if (result.error) return res.status(400).json({ error: result.error });
    await applyUpdates(db, k.id, result.updates);
    res.json({
      ok: true,
      queue: JSON.parse(result.updates.build_queue),
      gold: result.updates.gold,
      totalCost: result.totalCost,
      engineers: k.engineers,
    });
  });

  // ── Get training allocation ────────────────────────────────────────────────
  router.get("/training-allocation", requireAuth, async (req, res) => {
    const k = await db.get("SELECT training_allocation FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const allocation = safeJsonParse(k.training_allocation, {}, "GET /training-allocation");
    res.json({ allocation });
  });

  // ── Save training allocation ───────────────────────────────────────────────
  router.post("/training-allocation", requireAuth, requireCsrfToken, async (req, res) => {
    const { allocation } = req.body;
    if (!allocation || typeof allocation !== "object")
      return res.status(400).json({ error: "allocation required" });

    // Whitelist valid unit types to prevent injection of arbitrary keys
    const validUnits = new Set(['fighters', 'rangers', 'mages', 'clerics', 'thieves', 'ninjas']);

    const k = await db.get(`SELECT id, bld_training, fighters, rangers, mages, clerics, thieves, ninjas FROM kingdoms WHERE player_id = ?`, [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    let total = 0;
    const capacity = k.bld_training * 100;
    const clean_alloc = {};
    for (const [unit, amount] of Object.entries(allocation)) {
      // Whitelist validation: reject unknown unit types
      if (!validUnits.has(unit)) {
        return res.status(400).json({ error: `Invalid unit type: ${unit}` });
      }

      // Type validation: ensure non-negative integers
      const numVal = Number(amount);
      if (!Number.isInteger(numVal) || numVal < 0) {
        return res.status(400).json({ error: `Unit allocations must be non-negative integers (${unit}: ${amount})` });
      }

      const amt = numVal;
      if (amt > (k[unit] || 0))
        return res.status(400).json({ error: `Not enough ${unit}` });
      total += amt;
      if (amt > 0) clean_alloc[unit] = amt;
    }
    if (total > capacity)
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
    if (!allocation || typeof allocation !== "object")
      return res.status(400).json({ error: "allocation required" });
    const k = await db.get(
      "SELECT id, engineers FROM kingdoms WHERE player_id = ?",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const total = Object.values(allocation).reduce(
      (s, v) => s + (Number(v) || 0),
      0,
    );
    if (total > k.engineers)
      return res.status(400).json({
        error: `Allocated ${total.toLocaleString()} but only have ${k.engineers.toLocaleString()} engineers`,
      });
    await db.run("UPDATE kingdoms SET build_allocation = ? WHERE id = ?", [
      JSON.stringify(allocation),
      k.id,
    ]);
    res.json({ ok: true });
  });

  router.post("/resource-build-allocation", requireAuth, requireCsrfToken, async (req, res) => {
    const { allocation } = req.body;
    if (!allocation || typeof allocation !== "object")
      return res.status(400).json({ error: "allocation required" });
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
    const total = Object.values(allocation).reduce(
      (s, v) => s + (Number(v) || 0),
      0,
    );
    if (total + buildTotal > k.engineers)
      return res.status(400).json({
        error: `Allocated ${total.toLocaleString()} resource engineers and ${buildTotal.toLocaleString()} build engineers, but only have ${k.engineers.toLocaleString()} engineers total`,
      });
    await db.run("UPDATE kingdoms SET resource_build_allocation = ? WHERE id = ?", [
      JSON.stringify(allocation),
      k.id,
    ]);
    res.json({ ok: true });
  });

  router.post("/school-allocation", requireAuth, requireCsrfToken, async (req, res) => {
    const { spellbook, school_spellbook } = req.body;
    if (!Number.isInteger(spellbook) || !Number.isInteger(school_spellbook) || spellbook < 0 || school_spellbook < 0)
      return res.status(400).json({ error: "spellbook and school_spellbook must be non-negative integers" });

    const k = await db.get(
      "SELECT id, mages, school_of_magic, research_allocation FROM kingdoms WHERE player_id = ?",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (!k.school_of_magic) return res.status(400).json({ error: "Must choose a school first" });

    const total = spellbook + school_spellbook;
    if (total > (k.mages || 0))
      return res.status(400).json({
        error: `Allocated ${total.toLocaleString()} mages, but only have ${(k.mages || 0).toLocaleString()} mages`,
      });

    const researchAlloc = safeJsonParse(k.research_allocation, {}, "school-allocation:research_allocation");
    researchAlloc.spellbook_mages = spellbook;
    researchAlloc.school_spellbook_mages = school_spellbook;

    await db.run(
      "UPDATE kingdoms SET research_allocation = ? WHERE id = ?",
      [JSON.stringify(researchAlloc), k.id],
    );
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
    const msg = `🏗️ Demolished ${result.refund.count} ${building.replace(/_/g, " ")}. Refunded ${result.refund.gold.toLocaleString()} gold and ${result.refund.land} acres.`;
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
      [k.id, "system", msg, k.turn],
    );

    res.json({ ok: true, updates: result.updates, message: msg });
  });

  // ── Build structures — start construction with engineer allocation ──────────
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
    const msg = `🏗️ Construction started: ${buildingId.replace(/^bld_/, "").replace(/_/g, " ")}. Estimated completion: ${buildTime} turns.`;
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
      [k.id, "system", msg, k.turn],
    );

    res.json({ ok: true, updates, message: msg, buildTime, cost });
  });

  // ── Cancel building — refund resources ────────────────────────────────────
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
    const msg = `🏗️ Construction cancelled: ${buildJob.building.replace(/_/g, " ")}. Resources refunded.`;
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
      [k.id, "system", msg, k.turn],
    );

    res.json({ ok: true, updates, message: msg });
  });

  // ── Forge tools — costs 1 turn + gold for scaffolding ───────────────────────
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
      res.status(500).json({ error: "Forging failed — please try again" });
    }
  });

  // ── Smithy — buy hammers for gold ─────────────────────────────────────────────
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

  // ── Smithy — buy scaffolding for gold ────────────────────────────────────────
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

  // ── Trade Routes ───────────────────────────────────────────────────────────
  router.get("/trade-routes/list", requireAuth, async (req, res) => {
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id=?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const routes = await db.all(
      `
      SELECT tr.*, k.name as partner_name, k.race as partner_race, k.land as partner_land
      FROM trade_routes tr
      JOIN kingdoms k ON (tr.partner_id = k.id OR tr.kingdom_id = k.id)
      WHERE (tr.kingdom_id = ? OR tr.partner_id = ?) AND k.id != ?
    `,
      [k.id, k.id, k.id],
    );
    res.json({ routes });
  });

  router.post("/trade-routes/establish", requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const targetId = parseInt(req.body.targetId);
      if (isNaN(targetId))
        return res.status(400).json({ error: "Invalid target kingdom" });

      const k = await db.get("SELECT id, name, gold, market_upgrades FROM kingdoms WHERE player_id=?", [
        req.player.playerId,
      ]);
      if (!k) return res.status(404).json({ error: "Kingdom not found" });

      // Requirement Check: Trading Post
      const marketUpgrades = safeJsonParse(
        k.market_upgrades,
        {},
        "establish:market_upgrades",
      );
      if (!marketUpgrades.trading_post) {
        return res
          .status(400)
          .json({
            error:
              "Build a Trading Post in the Markets tab to establish trade routes",
          });
      }

      if (k.id == targetId)
        return res.status(400).json({ error: "Cannot trade with yourself" });

      const target = await db.get("SELECT id, turn FROM kingdoms WHERE id=?", [
        targetId,
      ]);
      if (!target) return res.status(404).json({ error: "Target not found" });

      // Check caps (UNION allows index optimization vs OR)
      const routeCount = await db.get(
        `SELECT COUNT(*) as count FROM (
          SELECT id FROM trade_routes WHERE kingdom_id=?
          UNION ALL
          SELECT id FROM trade_routes WHERE partner_id=?
        ) t`,
        [k.id, k.id],
      );
      if (routeCount.count >= (engine.TRADE_ROUTE_MAX || 5)) {
        return res
          .status(400)
          .json({
            error: `Maximum trade routes reached (${engine.TRADE_ROUTE_MAX || 5})`,
          });
      }

      // Check if already exists
      const existing = await db.get(
        "SELECT id FROM trade_routes WHERE (kingdom_id=? AND partner_id=?) OR (kingdom_id=? AND partner_id=?)",
        [k.id, targetId, targetId, k.id],
      );
      if (existing)
        return res
          .status(400)
          .json({ error: "Trade route already exists with this kingdom" });

      // Cost
      const cost = engine.TRADE_ROUTE_ESTABLISH_COST || 10000;
      if (k.gold < cost)
        return res
          .status(400)
          .json({
            error: `Establishing a permanent trade route costs ${cost.toLocaleString()} gold. You only have ${Math.floor(k.gold).toLocaleString()}.`,
          });

      // Simple distance calculation
      const distance = Math.floor(Math.random() * 50) + 10;

      await db.run("BEGIN TRANSACTION");
      try {
        // Atomic balance check: verify sufficient gold within the UPDATE statement to prevent
        // concurrent requests from both bypassing the check and creating negative balances
        const goldResult = await db.run("UPDATE kingdoms SET gold = gold - ? WHERE id = ? AND gold >= ?", [
          cost,
          k.id,
          cost,
        ]);
        if (goldResult.changes === 0) {
          await db.run("ROLLBACK");
          return res.status(400).json({
            error: `Establishing a permanent trade route costs ${cost.toLocaleString()} gold. You only have ${Math.floor(k.gold).toLocaleString()}.`,
          });
        }
        await db.run(
          "INSERT INTO trade_routes (kingdom_id, partner_id, distance, stability) VALUES (?, ?, ?, ?)",
          [k.id, targetId, distance, 100],
        );
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?, ?, ?, ?)",
          [
            target.id,
            "system",
            `🤝 The merchants of ${k.name} have established a permanent trade route to your kingdom!`,
            target.turn,
          ],
        );
        await db.run("COMMIT");
      } catch (txErr) {
        await db.run("ROLLBACK");
        throw txErr;
      }

      res.json({
        ok: true,
        message:
          "Trade route established! You can see it in your Economy > Trade Routes tab.",
      });
    } catch (err) {
      console.error("[establishTradeRoute] error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/trade-routes/cancel", requireAuth, requireCsrfToken, async (req, res) => {
    const { routeId } = req.body;
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id=?", [
      req.player.playerId,
    ]);
    await db.run(
      "DELETE FROM trade_routes WHERE id = ? AND (kingdom_id = ? OR partner_id = ?)",
      [routeId, k.id, k.id],
    );
    res.json({ ok: true });
  });

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
        searchMessage = `🗺️ Rangers discovered +${found.toLocaleString()} acres${found <= 1 ? " (land getting scarce)" : ""}.`;
      } else if (type === "gold") {
        const found = Math.floor(r * 12 * tacticsMult);
        updates.gold = (updates.gold || kAfterTurn.gold || 0) + found;
        searchResult = { found, unit: "GC" };
        searchMessage = `💰 Rangers returned with ${found.toLocaleString()} gold from foraging.`;
      } else if (type === "food") {
        const found = Math.floor(r * 0.5 * tacticsMult);
        updates.food = (kAfterTurn.food || 0) + found;
        searchResult = { found, unit: "food" };
        searchMessage = `🌾 Rangers foraged ${found.toLocaleString()} food from the wilderness.`;
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

        const placeholders = currentIds.map(() => "?").join(",");
        const query = `SELECT id, name FROM kingdoms WHERE id NOT IN (${placeholders}) ORDER BY RANDOM() LIMIT ?`;
        const others = await db.all(query, [...currentIds, baseFound]);

        let foundCount = 0;
        let lastFoundName = "";
        others.forEach((o) => {
          disc[o.id] = { found: true, name: o.name };
          foundCount++;
          lastFoundName = o.name;
        });

        if (foundCount > 0) {
          updates.discovered_kingdoms = JSON.stringify(disc);
        }

        searchResult = { found: foundCount, unit: "kingdoms" };
        searchMessage =
          foundCount > 0
            ? foundCount === 1
              ? `👁️ Rangers scouted a new target: ${lastFoundName}.`
              : `👁️ Rangers scouted ${foundCount} new target kingdoms.`
            : `🔍 Rangers searched the area but found no new settlements.`;
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
            message: `🎖️ ${msg}`,
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

  // ── Mage tower allocation ────────────────────────────────────────────────────
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

  // ── Shrine allocation ─────────────────────────────────────────────────────────
  router.post("/shrine-allocation", requireAuth, requireCsrfToken, async (req, res) => {
    const { allocation } = req.body;
    if (!allocation || typeof allocation !== "object")
      return res.status(400).json({ error: "allocation required" });
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
      Number(allocation.clerics) || 0,
      k.clerics,
    );
    await db.run("UPDATE kingdoms SET shrine_allocation = ? WHERE id = ?", [
      JSON.stringify({ clerics: clericsAlloc }),
      k.id,
    ]);
    res.json({ ok: true, allocation: { clerics: clericsAlloc } });
  });

  // ── Mausoleum allocation ──────────────────────────────────────────────────────
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

  // ── Military attack ───────────────────────────────────────────────────────────
  router.post("/attack", requireAuth, requireCsrfToken, async (req, res) => {
    const {
      targetId,
      fighters,
      rangers,
      mages,
      warMachines,
      ninjas,
      thieves,
      clerics,
      engineers,
      ladders,
    } = req.body;
    const sentUnits = {
      fighters: Math.max(0, parseInt(fighters) || 0),
      rangers: Math.max(0, parseInt(rangers) || 0),
      mages: Math.max(0, parseInt(mages) || 0),
      warMachines: Math.max(0, parseInt(warMachines) || 0),
      ninjas: Math.max(0, parseInt(ninjas) || 0),
      thieves: Math.max(0, parseInt(thieves) || 0),
      clerics: Math.max(0, parseInt(clerics) || 0),
      engineers: Math.max(0, parseInt(engineers) || 0),
      ladders: Math.max(0, parseInt(ladders) || 0),
    };

    // Consolidate 3 queries into 2: attacker + target with AI status
    const k = await db.get(
      `SELECT k.* FROM kingdoms k JOIN players p ON k.player_id = p.id WHERE k.player_id = ?`,
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.turns_stored < 1)
      return res.status(429).json({ error: "No turns available" });
    if (
      sentUnits.fighters <= 0 &&
      sentUnits.rangers <= 0 &&
      sentUnits.mages <= 0
    )
      return res.status(400).json({ error: "Send at least some troops" });

    const target = await db.get(
      `SELECT k.* FROM kingdoms k
       JOIN players p ON k.player_id = p.id
       WHERE k.id = ?`,
      [targetId],
    );
    if (!target)
      return res.status(404).json({ error: "Target kingdom not found" });
    if (target.id === k.id)
      return res.status(400).json({ error: "Cannot attack yourself" });

    if (sentUnits.fighters > engine.getAvailableUnits(k, "fighters"))
      return res.status(400).json({
        error: "Not enough available fighters (some may be in training)",
      });
    if (sentUnits.rangers > engine.getAvailableUnits(k, "rangers"))
      return res.status(400).json({
        error: "Not enough available rangers (some may be in training)",
      });
    if (sentUnits.mages > engine.getAvailableUnits(k, "mages"))
      return res.status(400).json({
        error: "Not enough available mages (some may be in training)",
      });
    if (sentUnits.warMachines > engine.getAvailableUnits(k, "war_machines"))
      return res
        .status(400)
        .json({ error: "Not enough available war machines" });
    if (sentUnits.ninjas > engine.getAvailableUnits(k, "ninjas"))
      return res.status(400).json({
        error: "Not enough available ninjas (some may be in training)",
      });
    if (sentUnits.thieves > engine.getAvailableUnits(k, "thieves"))
      return res.status(400).json({
        error: "Not enough available thieves (some may be in training)",
      });
    if (sentUnits.clerics > engine.getAvailableUnits(k, "clerics"))
      return res.status(400).json({
        error: "Not enough available clerics/thralls (some may be in training)",
      });
    if (sentUnits.engineers > engine.getAvailableUnits(k, "engineers"))
      return res.status(400).json({
        error: "Not enough available engineers (some may be in training)",
      });
    if (sentUnits.ladders > engine.getAvailableUnits(k, "ladders"))
      return res.status(400).json({ error: "Not enough available 🪜 ladders" });

    if (k.turn < 400)
      return res.status(400).json({
        error: `You are under newbie protection until Turn 400. You cannot attack yet.`,
      });
    if ((target.turn || 0) < 400)
      return res.status(400).json({
        error: `${target.name} is under newbie protection until Turn 400`,
      });

    // Location system