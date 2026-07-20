'use strict';

// Kingdom management (ban/unban/reset/edit) + chat moderation — split out of
// routes/admin.js (A2-9, 2026-07-19). requireAdmin + CSRF are applied once
// by the composer (routes/admin.js) before this router is mounted — do not
// re-add router.use(requireAdmin) here.

const express = require('express');
const bcrypt = require('bcrypt');
const { requireAdmin, requireCsrfToken } = require('./middleware');
const commandHandler = require('../game/command-handler');
const { seedFirstRingNode } = require('../game/first-ring-node');
const { pgSetClauseWithNextPlaceholder } = require('../lib/pg-placeholders');
const {
  BCRYPT_SALT_ROUNDS,
  TEST_RACES,
  buildStartingProfile,
  buildResetValues,
  RESET_KINGDOM_SET,
  resetKingdomLogic,
} = require('./lib/admin-kingdom-helpers');

const router = express.Router();

module.exports = function (db) {

  router.get("/kingdoms", async (_req, res) => {
    const rows = await db.all(`
      SELECT k.id, k.name, k.race, k.land, k.gold, k.turn, k.turns_stored,
             k.fighters, k.mages, k.created_at,
             p.username, p.is_banned, p.ban_reason, p.is_admin, p.id AS player_id
      FROM kingdoms k JOIN players p ON k.player_id = p.id
      ORDER BY k.land DESC
    `);
    res.json(rows);
  });

  router.get("/stats", async (_req, res) => {
    const playerCount = await db.get("SELECT COUNT(*) as c FROM players");
    const kingdomCount = await db.get("SELECT COUNT(*) as c FROM kingdoms");
    const bannedCount = await db.get(
      "SELECT COUNT(*) as c FROM players WHERE is_banned = 1",
    );
    const combatCount = await db.get("SELECT COUNT(*) as c FROM combat_log");
    const chatCount = await db.get("SELECT COUNT(*) as c FROM chat_messages");
    const lastRegen = await db.get(
      "SELECT value FROM server_state WHERE key = 'last_regen_at'",
    );
    res.json({
      players: playerCount.c,
      kingdoms: kingdomCount.c,
      banned: bannedCount.c,
      combats: combatCount.c,
      messages: chatCount.c,
      lastRegen: lastRegen ? Number(lastRegen.value) : null,
    });
  });

  router.post("/ban", async (req, res) => {
    const { playerId, reason } = req.body;
    if (!playerId) return res.status(400).json({ error: "playerId required" });
    await db.run(
      "UPDATE players SET is_banned = 1, ban_reason = $1 WHERE id = $2",
      [reason || "Banned by admin", playerId],
    );
    res.json({ ok: true });
  });

  router.post("/unban", async (req, res) => {
    const { playerId } = req.body;
    if (!playerId) return res.status(400).json({ error: "playerId required" });
    await db.run(
      "UPDATE players SET is_banned = 0, ban_reason = NULL WHERE id = $1",
      [playerId],
    );
    res.json({ ok: true });
  });

  router.post("/reset-turns", async (req, res) => {
    const { kingdomId } = req.body;
    if (!kingdomId)
      return res.status(400).json({ error: "kingdomId required" });
    await db.run("UPDATE kingdoms SET turns_stored = 400 WHERE id = $1", [
      kingdomId,
    ]);
    res.json({ ok: true });
  });

  router.post("/reset-turns-all", async (_req, res) => {
    await db.run("UPDATE kingdoms SET turns_stored = 400");
    res.json({ ok: true });
  });

  router.post("/reset-kingdom", async (req, res) => {
    const { kingdomId } = req.body;
    if (!kingdomId)
      return res.status(400).json({ error: "kingdomId required" });
    const k = await db.get("SELECT id, race FROM kingdoms WHERE id = $1", [
      kingdomId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    await resetKingdomLogic(db, k.id, k.race);
    res.json({ ok: true });
  });

  router.post("/reset-all-kingdoms", async (_req, res) => {
    // Reset values are race-dependent, so batch with one UPDATE per race
    // instead of nine queries per kingdom.
    const races = await db.all("SELECT DISTINCT race FROM kingdoms");
    for (const { race } of races) {
      await db.run(`${RESET_KINGDOM_SET} WHERE race = $17`, [
        ...buildResetValues(race),
        race,
      ]);
    }

    await db.run("DELETE FROM expeditions");
    await db.run("DELETE FROM news");
    await db.run("DELETE FROM war_log");
    await db.run("DELETE FROM trade_offers");
    await db.run("DELETE FROM heroes");
    await db.run("DELETE FROM trade_routes");
    await db.run("DELETE FROM bounties");
    await db.run("DELETE FROM spy_reports");
    // Dungeon/Mountain's Heart discovery is tracked globally (not per-kingdom
    // — see game/world-locations.js isPubliclyDiscovered), so a fresh world
    // must also clear it; otherwise locations discovered by kingdoms that
    // just got wiped stay "publicly discovered" forever.
    await db.run("UPDATE world_locations SET discovered_by_kingdom_ids = '{}'");
    res.json({ ok: true });
  });

  router.post("/test-kingdoms/setup", async (req, res) => {
    const usernamePrefixRaw = String(req.body?.usernamePrefix || "test").trim().toLowerCase();
    const kingdomPrefixRaw = String(req.body?.kingdomPrefix || "Test").trim();
    const password = String(req.body?.password || "").trim();
    const resetExisting = req.body?.resetExisting !== false;

    if (!usernamePrefixRaw || !/^[a-z0-9_]+$/.test(usernamePrefixRaw)) {
      return res.status(400).json({ error: "usernamePrefix must contain only lowercase letters, numbers, and underscores" });
    }
    if (!kingdomPrefixRaw) {
      return res.status(400).json({ error: "kingdomPrefix is required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "password must be at least 8 characters" });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const results = [];

    for (const race of TEST_RACES) {
      const username = `${usernamePrefixRaw}_${race}`;
      const prettyRace = race.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
      const kingdomName = `${kingdomPrefixRaw} ${prettyRace}`;
      const email = `${username}@narmir.test`;

      let player = await db.get("SELECT id FROM players WHERE username = $1", [username]);
      let createdPlayer = false;
      if (!player) {
        const playerResult = await db.run(
          "INSERT INTO players (username, password, email, is_admin) VALUES ($1, $2, $3, 0)",
          [username, passwordHash, email],
        );
        player = { id: playerResult.lastID };
        createdPlayer = true;
      }

      let kingdom = await db.get("SELECT id, race FROM kingdoms WHERE player_id = $1", [player.id]);
      let action = createdPlayer ? "created" : "updated";

      if (!kingdom) {
        const profile = buildStartingProfile(race);
        const region = commandHandler.assignRegion(race);
        const gender = "male";
        const insertResult = await db.run(
          `INSERT INTO kingdoms (
            player_id, name, race, gender, region, gold, land, population, food,
            researchers, engineers, fighters, rangers, thralls, turns_stored,
            res_spellbook, blueprints_stored,
            bld_farms, bld_schools, bld_barracks, bld_armories, bld_housing,
            bld_markets, bld_smithies, bld_mage_towers, bld_shrines, bld_outposts, bld_training, bld_mausoleums, world_fragments
          ) VALUES ($1, $2, $3, $4, $5, 10000, $6, 50000, $7, 100, 100, $8, $9, $10, 400, 0, 0, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, '["Volcanic Rock", "Ancient Elven Wood", "Dragon Scale", "Abyssal Crystal", "Celestial Feather", "Dwarven Star-Metal", "Cursed Bloodstone", "Tears of the World Tree", "Void Essence", "Titan Bone"]')`,
          [
            player.id,
            kingdomName,
            race,
            gender,
            region,
            profile.land,
            profile.food,
            profile.fighters,
            profile.rangers,
            profile.thralls,
            profile.buildings.bld_farms,
            profile.buildings.bld_schools,
            profile.buildings.bld_barracks,
            profile.buildings.bld_armories,
            profile.buildings.bld_housing,
            profile.buildings.bld_markets,
            profile.buildings.bld_smithies,
            profile.buildings.bld_mage_towers,
            profile.buildings.bld_shrines,
            profile.buildings.bld_outposts,
            profile.buildings.bld_training,
            profile.buildings.bld_mausoleums,
          ],
        );
        kingdom = { id: insertResult.lastID, race };
        seedFirstRingNode(db, kingdom.id, race).catch((err) =>
          console.error(`[admin] Failed to seed first-ring node for kingdom ${kingdom.id}:`, err.message)
        );
      } else {
        await db.run(
          "UPDATE kingdoms SET name = $1, race = $2, gender = $3, region = $4 WHERE id = $5",
          [kingdomName, race, "male", commandHandler.assignRegion(race), kingdom.id],
        );
        if (resetExisting) {
          await resetKingdomLogic(db, kingdom.id, race);
        }
      }

      results.push({
        race,
        username,
        kingdomName,
        kingdomId: kingdom.id,
        action,
        reset: !!kingdom && !createdPlayer && resetExisting,
      });
    }

    res.json({
      ok: true,
      count: results.length,
      resetExisting,
      results,
    });
  });

  router.post("/set-gold", async (req, res) => {
    const { kingdomId, amount } = req.body;
    if (!kingdomId || amount === undefined)
      return res.status(400).json({ error: "kingdomId and amount required" });
    await db.run("UPDATE kingdoms SET gold = $1 WHERE id = $2", [
      Number(amount),
      kingdomId,
    ]);
    res.json({ ok: true });
  });

  router.post("/set-building", async (req, res) => {
    const { kingdomId, building, amount } = req.body;
    if (!kingdomId || !building || amount === undefined)
      return res.status(400).json({ error: "kingdomId, building, and amount required" });
    const col = 'bld_' + building.replace(/-/g, '_');
    const allowed = [
      'bld_woodyard','bld_lumber_camp','bld_sawmill',
      'bld_gravel_pit','bld_blockfield','bld_stone_quarry',
      'bld_open_pit','bld_strip_mine','bld_deep_mine',
    ];
    if (!allowed.includes(col))
      return res.status(400).json({ error: `Unknown building column: ${col}` });
    await db.run(`UPDATE kingdoms SET ${col} = $1 WHERE id = $2`, [Math.max(0, Number(amount)), kingdomId]);
    res.json({ ok: true, col, amount: Math.max(0, Number(amount)) });
  });

  router.get("/chat-mods", async (_req, res) => {
    const mods = await db.all(
      "SELECT username FROM players WHERE is_chat_mod = 1 ORDER BY username",
    );
    res.json(mods);
  });

  router.get("/chat-bans", async (_req, res) => {
    const banned = await db.all(
      "SELECT username, chat_ban_reason FROM players WHERE chat_banned = 1 ORDER BY username",
    );
    res.json(banned);
  });

  router.post("/chat-mod", async (req, res) => {
    const { username, action } = req.body; // action: 'promote' | 'demote'
    if (!username || !action)
      return res.status(400).json({ error: "username and action required" });
    const val = action === "promote" ? 1 : 0;
    const p = await db.get("SELECT id FROM players WHERE username = $1", [
      username,
    ]);
    if (!p)
      return res.status(404).json({ error: `Player "${username}" not found` });
    await db.run("UPDATE players SET is_chat_mod = $1 WHERE id = $2", [
      val,
      p.id,
    ]);
    res.json({ ok: true });
  });

  router.post("/chat-unban", async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "username required" });
    await db.run(
      "UPDATE players SET chat_banned = 0, chat_ban_reason = NULL WHERE username = $1",
      [username],
    );
    res.json({ ok: true });
  });

  router.get("/kingdom-detail/:id", async (req, res) => {
    try {
      const k = await db.get(
        `
        SELECT k.*, p.username, p.is_admin, p.is_banned
        FROM kingdoms k JOIN players p ON k.player_id = p.id
        WHERE k.id = $1
      `,
        [req.params.id],
      );
      if (!k) return res.status(404).json({ error: "Kingdom not found" });
      res.json(k);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/promote", async (req, res) => {
    const { playerId, username } = req.body;
    if (!playerId && !username)
      return res.status(400).json({ error: "playerId or username required" });
    let player;
    if (username) {
      player = await db.get("SELECT id FROM players WHERE username = $1", [
        username,
      ]);
      if (!player)
        return res
          .status(404)
          .json({ error: `Player "${username}" not found` });
    }
    const id = playerId || player.id;
    await db.run("UPDATE players SET is_admin = 1 WHERE id = $1", [id]);
    res.json({ ok: true });
  });

  router.post("/set-kingdom", async (req, res) => {
    try {
    const { kingdomId, fields } = req.body;
    if (!kingdomId || !fields || typeof fields !== "object")
      return res.status(400).json({ error: "kingdomId and fields required" });

    // Whitelist every settable kingdom column
    const ALLOWED = new Set([
      "name",
      "race",
      "gold",
      "mana",
      "land",
      "population",
      "happiness",
      "happiness",
      "food",
      "turn",
      "turns_stored",
      "tax",
      "fighters",
      "rangers",
      "clerics",
      "mages",
      "thieves",
      "ninjas",
      "thralls",
      "ladders",
      "researchers",
      "engineers",
      "scribes",
      "war_machines",
      "ballistae",
      "weapons_stockpile",
      "armor_stockpile",
      "maps",
      "blueprints_stored",
      "scaffolding_stored",
      "hammers_stored",
      "bld_farms",
      "bld_granaries",
      "bld_barracks",
      "bld_outposts",
      "bld_guard_towers",
      "bld_schools",
      "bld_armories",
      "bld_vaults",
      "bld_smithies",
      "bld_markets",
      "bld_mage_towers",
      "bld_training",
      "bld_taverns",
      "bld_castles",
      "bld_libraries",
      "bld_shrines",
      "bld_housing",
      "bld_walls",
      "bld_mausoleums",
      "bld_woodyard",
      "bld_lumber_camp",
      "bld_sawmill",
      "bld_gravel_pit",
      "bld_blockfield",
      "bld_stone_quarry",
      "bld_open_pit",
      "bld_strip_mine",
      "bld_deep_mine",
      "wood",
      "stone",
      "iron",
      "coal",
      "steel",
      "res_economy",
      "res_weapons",
      "res_armor",
      "res_military",
      "res_attack_magic",
      "res_defense_magic",
      "res_entertainment",
      "res_construction",
      "res_war_machines",
      "res_spellbook",
      "xp",
      "level",
      "description",
      "region",
      "prestige_level",
      "active_effects",
      "troop_levels",
      "injured_troops",
      "wall_hp",
      "research_allocation",
      "build_queue",
      "build_progress",
      "build_allocation",
      "scrolls",
      "world_fragments",
      "fragment_bonuses",
      "hybrid_blueprints",
      "fortified_blueprints",
      "fortified_buildings",
      "wall_defense_type",
      "racial_bonuses_unlocked",
      "divine_sanctuary_used",
      "alliance_buffs",
      "items",
      "mercenaries",
      "gender",
      "school_of_magic",
      "milestone_title",
    ]);

    // Fields that must remain valid JSON strings
    const JSON_FIELDS = new Set([
      "world_fragments", "fragment_bonuses", "hybrid_blueprints", "fortified_buildings",
      "active_effects", "troop_levels", "injured_troops", "research_allocation",
      "build_queue", "build_progress", "build_allocation", "scrolls",
      "alliance_buffs", "items", "mercenaries",
    ]);
    const INT32_MIN = -2147483648;
    const INT32_MAX = 2147483647;

    const safe = Object.fromEntries(
      Object.entries(fields)
        .filter(
          ([k, v]) =>
            ALLOWED.has(k) && v !== null && v !== undefined,
        )
        .map(([k, v]) => {
          // If it's empty string and ALLOWED, we might want to clear it or set to 0/def
          if (v === "") return [k, null];

          // Try to cast to number if it's a numeric-only string
          // This allows "123" -> 123, but "Orc" -> "Orc"
          if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) {
            return [k, Number(v)];
          }
          return [k, v];
        }),
    );

    if (Object.keys(safe).length === 0)
      return res.status(400).json({ error: "No valid fields to update" });

    const GOLD_MAX_SAFE = Number.MAX_SAFE_INTEGER;

    // Validate that JSON fields contain parseable JSON before hitting the DB
    for (const [k, v] of Object.entries(safe)) {
      if (JSON_FIELDS.has(k) && typeof v === "string") {
        try { JSON.parse(v); } catch {
          return res.status(400).json({ error: `Invalid JSON in field "${k}"` });
        }
      }
      if (typeof v === "number" && !Number.isInteger(v)) {
        return res.status(400).json({ error: `Field "${k}" must be a whole number` });
      }
      if (k === "gold" && typeof v === "number" && (v < 0 || v > GOLD_MAX_SAFE)) {
        return res.status(400).json({
          error: `Field "${k}" is out of range. Please use a value between 0 and ${GOLD_MAX_SAFE.toLocaleString()}.`,
        });
      }
      if (k !== "gold" && typeof v === "number" && (v < INT32_MIN || v > INT32_MAX)) {
        return res.status(400).json({
          error: `Field "${k}" is out of range. Please use a value between ${INT32_MIN.toLocaleString()} and ${INT32_MAX.toLocaleString()}.`,
        });
      }
    }

    // Input validation for kingdom name (defense-in-depth, same rules as registration)
    if (typeof safe.name === 'string') {
      const name = safe.name.trim();
      if (name.length < 3 || name.length > 50) {
        return res.status(400).json({ error: 'Kingdom name must be 3–50 characters' });
      }
      if (!/^[a-zA-Z0-9\s'-]+$/.test(name)) {
        return res.status(400).json({
          error: "Kingdom name can only contain letters, numbers, spaces, apostrophes, and hyphens",
        });
      }
      safe.name = name; // use trimmed
    }

    const safeKeys = Object.keys(safe);
    const { setClause, nextPlaceholder } = pgSetClauseWithNextPlaceholder(safeKeys, 1);
    await db.run(`UPDATE kingdoms SET ${setClause} WHERE id = ${nextPlaceholder}`, [
      ...Object.values(safe),
      kingdomId,
    ]);
    res.json({ ok: true, updated: safeKeys });
    } catch (err) {
      console.error("[admin] set-kingdom failed:", err.message);
      res.status(500).json({ error: "Failed to update kingdom" });
    }
  });

  router.delete("/kingdom/:id", async (req, res) => {
    const kid = req.params.id;
    try {
      // Clear out relations so foreign keys don't block
      await db.run("DELETE FROM alliance_members WHERE kingdom_id = $1", [kid]);
      await db.run("DELETE FROM alliances WHERE leader_id = $1", [kid]); // Or pick a new leader, but taking easiest route
      await db.run("DELETE FROM news WHERE kingdom_id = $1", [kid]);
      await db.run("DELETE FROM war_log WHERE attacker_id = $1 OR defender_id = $2", [kid, kid]);
      await db.run("DELETE FROM expeditions WHERE kingdom_id = $1", [kid]);
      await db.run("DELETE FROM combat_log WHERE attacker_id = $1 OR defender_id = $2", [kid, kid]);
      await db.run("DELETE FROM chat_messages WHERE kingdom_id = $1", [kid]);
      await db.run("DELETE FROM heroes WHERE kingdom_id = $1", [kid]);
      await db.run("DELETE FROM spy_reports WHERE kingdom_id = $1 OR target_id = $2", [kid, kid]);
      await db.run("DELETE FROM trade_routes WHERE kingdom_id = $1 OR partner_id = $2", [kid, kid]);
      await db.run("DELETE FROM bounties WHERE target_id = $1 OR claimed_by_id = $2", [kid, kid]);
      await db.run("DELETE FROM trade_offers WHERE sender_id = $1 OR receiver_id = $2", [kid, kid]);
      await db.run("DELETE FROM mercenaries WHERE kingdom_id = $1", [kid]);
      await db.run("DELETE FROM event_log WHERE kingdom_id = $1", [kid]);
      // Finally delete the kingdom
      await db.run("DELETE FROM kingdoms WHERE id = $1", [kid]);
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to delete: " + e.message });
    }
  });

  router.post("/repair-resource-allocations", async (req, res) => {
    try {
      const kingdomId = req.body.kingdomId;
      if (!kingdomId) return res.status(400).json({ error: "kingdomId required" });

      const k = await db.get("SELECT * FROM kingdoms WHERE id = $1", [kingdomId]);
      if (!k) return res.status(404).json({ error: "Kingdom not found" });

      let buildProgress = {};
      try {
        buildProgress = JSON.parse(k.build_progress || "{}");
      } catch {}

      const RESOURCE_BUILDINGS = ['woodyard', 'lumber_camp', 'sawmill', 'gravel_pit', 'blockfield', 'stone_quarry', 'open_pit', 'strip_mine', 'deep_mine'];

      // Auto-assign 1 engineer to each resource building with active progress
      const repair = {};
      for (const building of RESOURCE_BUILDINGS) {
        if ((buildProgress[building] || 0) > 0) {
          repair[building] = 1;
        }
      }

      await db.run("UPDATE kingdoms SET resource_build_allocation = $1 WHERE id = $2", [
        JSON.stringify(repair),
        k.id,
      ]);

      res.json({
        ok: true,
        message: `Repaired resource allocations. Assigned engineers to: ${Object.keys(repair).join(', ') || 'none'}`,
        repaired: repair
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/reset-allocations", requireAdmin, requireCsrfToken, async (req, res) => {
    try {
      const { kingdomId } = req.body;
      if (!kingdomId) return res.status(400).json({ error: "kingdomId required" });

      const k = await db.get("SELECT id, player_id FROM kingdoms WHERE id = $1", [kingdomId]);
      if (!k) return res.status(404).json({ error: "Kingdom not found" });

      await db.run(
        "UPDATE kingdoms SET build_allocation = $1, resource_build_allocation = $1, training_allocation = $1, scout_allocation = 0 WHERE id = $2",
        [JSON.stringify({}), k.id]
      );

      res.json({ ok: true, message: "Engineer allocations cleared" });
    } catch (err) {
      console.error("[admin] reset-allocations error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
