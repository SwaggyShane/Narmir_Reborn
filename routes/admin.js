const express = require("express");
const { requireAdmin, requireCsrfToken } = require("./middleware");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const _config = require("../game/config");
const { _GOAL_COUNTS, DAILY_GOALS, WEEKLY_GOALS, MONTHLY_GOALS } = require("../game/goals");

const ALLOWED_PRIZE_TYPES = ['gold', 'mana', 'rangers', 'researchers', 'war_machines', 'world_fragment'];
const ALLOWED_SOUND_EXTENSIONS = new Set([".mp3", ".wav"]);

let ORIGINAL_DAILY_GOALS = [];
let ORIGINAL_WEEKLY_GOALS = [];
let ORIGINAL_MONTHLY_GOALS = [];

const soundsPath = path.join(__dirname, "..", "public", "sounds");
if (!fs.existsSync(soundsPath)) {
  fs.mkdirSync(soundsPath, { recursive: true });
}

// Resolve a user-supplied filename to an absolute path inside soundsPath.
// Returns null if the input is unsafe (traversal, wrong extension, or escapes the dir).
function safeSoundPath(rawName) {
  if (typeof rawName !== "string" || !rawName.trim()) return null;
  const base = rawName.split(/[/\\]/).pop();
  if (!base || base === "." || base === "..") return null;
  const ext = path.extname(base).toLowerCase();
  if (!ALLOWED_SOUND_EXTENSIONS.has(ext)) return null;
  const resolved = path.resolve(soundsPath, base);
  if (path.relative(soundsPath, resolved).startsWith("..")) return null;
  return resolved;
}

async function refreshInMemoryGoals(db) {
  try {
    if (ORIGINAL_DAILY_GOALS.length === 0) {
      ORIGINAL_DAILY_GOALS = DAILY_GOALS.map(g => ({ ...g }));
      ORIGINAL_WEEKLY_GOALS = WEEKLY_GOALS.map(g => ({ ...g }));
      ORIGINAL_MONTHLY_GOALS = MONTHLY_GOALS.map(g => ({ ...g }));
    }

    const overrides = await db.all(
      `SELECT tier, goal_id, label, min_target, max_target, prize_type, prize_multiplier, active
       FROM admin_goal_definitions ORDER BY tier, goal_id`
    );

    DAILY_GOALS.length = 0;
    DAILY_GOALS.push(...ORIGINAL_DAILY_GOALS.map(g => ({ ...g })));

    WEEKLY_GOALS.length = 0;
    WEEKLY_GOALS.push(...ORIGINAL_WEEKLY_GOALS.map(g => ({ ...g })));

    MONTHLY_GOALS.length = 0;
    MONTHLY_GOALS.push(...ORIGINAL_MONTHLY_GOALS.map(g => ({ ...g })));

    for (const override of overrides) {
      const tier = override.tier;
      const pool = tier === 'daily' ? DAILY_GOALS : tier === 'weekly' ? WEEKLY_GOALS : tier === 'monthly' ? MONTHLY_GOALS : null;
      if (!pool) continue;

      const idx = pool.findIndex(g => g.id === override.goal_id);

      if (override.active === 0) {
        if (idx !== -1) {
          pool.splice(idx, 1);
        }
      } else {
        if (idx !== -1) {
          pool[idx] = {
            ...pool[idx],
            label: override.label,
            min: override.min_target,
            max: override.max_target,
            prizeStr: override.prize_type,
            prizeType: override.prize_type,
            prizeMult: override.prize_multiplier
          };
        } else {
          pool.push({
            id: override.goal_id,
            label: override.label,
            min: override.min_target,
            max: override.max_target,
            prizeStr: override.prize_type,
            prizeType: override.prize_type,
            prizeMult: override.prize_multiplier
          });
        }
      }
    }
  } catch (err) {
    console.error("[admin] Error refreshing goals:", err.message);
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, soundsPath),
    filename: (req, file, cb) => {
      const base = (file.originalname || "").split(/[/\\]/).pop();
      const ext = path.extname(base).toLowerCase();
      if (!base || !ALLOWED_SOUND_EXTENSIONS.has(ext)) {
        return cb(new Error("Invalid filename or extension"));
      }
      cb(null, base);
    },
  }),
  fileFilter: (req, file, cb) => {
    const ext = path.extname((file.originalname || "")).toLowerCase();
    if (!ALLOWED_SOUND_EXTENSIONS.has(ext)) {
      return cb(new Error("Only .mp3 and .wav files are allowed"));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = function (db, io) {
  // All admin routes require admin JWT
  router.use(requireAdmin);

  // GET /api/admin/kingdoms — all kingdoms with player info
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

  // GET /api/admin/stats — server overview
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

  // POST /api/admin/ban — ban a player
  router.post("/ban", async (req, res) => {
    const { playerId, reason } = req.body;
    if (!playerId) return res.status(400).json({ error: "playerId required" });
    await db.run(
      "UPDATE players SET is_banned = 1, ban_reason = ? WHERE id = ?",
      [reason || "Banned by admin", playerId],
    );
    res.json({ ok: true });
  });

  // POST /api/admin/unban — unban a player
  router.post("/unban", async (req, res) => {
    const { playerId } = req.body;
    if (!playerId) return res.status(400).json({ error: "playerId required" });
    await db.run(
      "UPDATE players SET is_banned = 0, ban_reason = NULL WHERE id = ?",
      [playerId],
    );
    res.json({ ok: true });
  });

  // POST /api/admin/reset-turns — reset a kingdom's turns to 400
  router.post("/reset-turns", async (req, res) => {
    const { kingdomId } = req.body;
    if (!kingdomId)
      return res.status(400).json({ error: "kingdomId required" });
    await db.run("UPDATE kingdoms SET turns_stored = 400 WHERE id = ?", [
      kingdomId,
    ]);
    res.json({ ok: true });
  });

  // POST /api/admin/reset-turns-all — give all kingdoms full turns
  router.post("/reset-turns-all", async (_req, res) => {
    await db.run("UPDATE kingdoms SET turns_stored = 400");
    res.json({ ok: true });
  });

  const buildResetValues = (race) => {
    const buildings = {
      bld_farms: 10,
      bld_schools: 1,
      bld_barracks: 1,
      bld_armories: 1,
      bld_housing: 100,
      bld_markets: 0,
      bld_smithies: 0,
      bld_mage_towers: 0,
      bld_shrines: 0,
      bld_outposts: 0,
      bld_training: 0,
    };
    let fighters = 0,
      rangers = 50,
      food = 5000;

    if (race === "human") buildings.bld_markets = 1;
    if (race === "dwarf") buildings.bld_smithies = 1;
    if (race === "high_elf") buildings.bld_mage_towers = 1;
    if (race === "dark_elf") buildings.bld_shrines = 1;
    if (race === "orc") buildings.bld_training = 1;
    if (race === "dire_wolf") {
      buildings.bld_barracks = 2; // Extra barracks for wolf
      fighters = 100;
      rangers = 100;
    }

    return [
      food,
      fighters,
      rangers,
      buildings.bld_farms,
      buildings.bld_barracks,
      buildings.bld_outposts,
      buildings.bld_schools,
      buildings.bld_armories,
      buildings.bld_smithies,
      buildings.bld_markets,
      buildings.bld_mage_towers,
      buildings.bld_training,
      buildings.bld_shrines,
      buildings.bld_housing,
    ];
  };

  const RESET_KINGDOM_SET = `UPDATE kingdoms SET
      gold = 10000, mana = 0, land = 504, population = 50000, food = ?, morale = 100,
      turn = 0, turns_stored = 400,
      fighters = ?, rangers = ?, clerics = 0, mages = 0, thieves = 0, ninjas = 0,
      researchers = 100, engineers = 100, scribes = 0,
      war_machines = 0, ballistae = 0, weapons_stockpile = 0, armor_stockpile = 0,
      bld_farms = ?, bld_barracks = ?, bld_outposts = ?, bld_guard_towers = 0,
      bld_schools = ?, bld_armories = ?, bld_vaults = 0, bld_smithies = ?,
      bld_markets = ?, bld_mage_towers = ?, bld_training = ?,
      bld_castles = 0, bld_shrines = ?, bld_libraries = 0, bld_taverns = 0, bld_housing = ?,
      bld_walls = 0, bld_granaries = 0, bld_mausoleums = 0,
      res_economy = 100, res_weapons = 100, res_armor = 100, res_military = 100,
      res_attack_magic = 100, res_defense_magic = 100, res_entertainment = 100,
      res_construction = 100, res_war_machines = 100, res_spellbook = 0,
      xp = 0, level = 1, xp_sources = '{}', troop_levels = '{}',
      research_allocation = '{}', build_allocation = '{}', build_queue = '{}',
      mage_tower_allocation = '{}', shrine_allocation = '{}', library_allocation = '{}',
      library_progress = '{}', tower_progress = '{}', scrolls = '{}', active_effects = '{}',
      world_fragments = '[]', collected_lore = '[]', collected_events = '[]',
      achievements = '[]', fortified_blueprints = '{}', fortified_buildings = '{}',
      hybrid_blueprints = '{}', maps = 0, blueprints_stored = 0,
      scaffolding_stored = 0, hammers_stored = 0,
      certified_blueprints_stored = 0, prestige_level = 0,
      thralls = 0, last_event_at = 0, active_event = '{}',
      discovered_kingdoms = '{}', location_maps_wip = '[]',
      farm_upgrades = '{}', market_upgrades = '{}', tavern_upgrades = '{}',
      tower_upgrades = '{}', school_upgrades = '{}', shrine_upgrades = '{}', library_upgrades = '{}',
      wall_upgrades = '{}', tower_def_upgrades = '{}', outpost_upgrades = '{}',
      defense_upgrades = '{}', granary_upgrades = '{}', mausoleum_upgrades = '{}',
      food_shortage_turns = 0, food_surplus_turns = 0, mercenaries = '[]',
      wood = 0, stone = 0, iron = 0, coal = 0, steel = 0,
      bld_woodyard = 0, bld_lumber_camp = 0, bld_sawmill = 0,
      bld_gravel_pit = 0, bld_blockfield = 0, bld_stone_quarry = 0,
      bld_open_pit = 0, bld_strip_mine = 0, bld_deep_mine = 0,
      resource_sequence = '{}', ladders = 0, trade_routes = 0, active_trade_routes = '[]',
      milestones_claimed = '[]', milestone_bonuses = '{}', milestone_title = ''`;

  const resetKingdomLogic = async (db, kingdomId, race) => {
    await db.run(`${RESET_KINGDOM_SET} WHERE id = ?`, [
      ...buildResetValues(race),
      kingdomId,
    ]);

    // Clear all related tables and data
    await db.run("DELETE FROM expeditions WHERE kingdom_id = ?", [kingdomId]);
    await db.run("DELETE FROM news WHERE kingdom_id = ?", [kingdomId]);
    await db.run(
      "DELETE FROM war_log WHERE attacker_id = ? OR defender_id = ?",
      [kingdomId, kingdomId],
    );
    await db.run("DELETE FROM heroes WHERE kingdom_id = ?", [kingdomId]);
    await db.run("DELETE FROM trade_routes WHERE kingdom_id = ? OR partner_id = ?", [kingdomId, kingdomId]);
    await db.run("DELETE FROM bounties WHERE target_id = ?", [kingdomId]);
    await db.run("DELETE FROM spy_reports WHERE kingdom_id = ? OR target_id = ?", [kingdomId, kingdomId]);
  };

  // POST /api/admin/reset-kingdom — wipe a single kingdom back to starting stats
  router.post("/reset-kingdom", async (req, res) => {
    const { kingdomId } = req.body;
    if (!kingdomId)
      return res.status(400).json({ error: "kingdomId required" });
    const k = await db.get("SELECT id, race FROM kingdoms WHERE id = ?", [
      kingdomId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    await resetKingdomLogic(db, k.id, k.race);
    res.json({ ok: true });
  });

  // POST /api/admin/reset-all-kingdoms — wipe all kingdoms back to starting stats
  router.post("/reset-all-kingdoms", async (_req, res) => {
    // Reset values are race-dependent, so batch with one UPDATE per race
    // instead of nine queries per kingdom.
    const races = await db.all("SELECT DISTINCT race FROM kingdoms");
    for (const { race } of races) {
      await db.run(`${RESET_KINGDOM_SET} WHERE race = ?`, [
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
    res.json({ ok: true });
  });

  // POST /api/admin/set-gold — set a kingdom's gold
  router.post("/set-gold", async (req, res) => {
    const { kingdomId, amount } = req.body;
    if (!kingdomId || amount === undefined)
      return res.status(400).json({ error: "kingdomId and amount required" });
    await db.run("UPDATE kingdoms SET gold = ? WHERE id = ?", [
      Number(amount),
      kingdomId,
    ]);
    res.json({ ok: true });
  });

  // POST /api/admin/set-building — set a specific building count on a kingdom
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
    await db.run(`UPDATE kingdoms SET ${col} = ? WHERE id = ?`, [Math.max(0, Number(amount)), kingdomId]);
    res.json({ ok: true, col, amount: Math.max(0, Number(amount)) });
  });

  // GET /api/admin/chat-mods
  router.get("/chat-mods", async (_req, res) => {
    const mods = await db.all(
      "SELECT username FROM players WHERE is_chat_mod = 1 ORDER BY username",
    );
    res.json(mods);
  });

  // GET /api/admin/chat-bans
  router.get("/chat-bans", async (_req, res) => {
    const banned = await db.all(
      "SELECT username, chat_ban_reason FROM players WHERE chat_banned = 1 ORDER BY username",
    );
    res.json(banned);
  });

  // POST /api/admin/chat-mod — promote/demote
  router.post("/chat-mod", async (req, res) => {
    const { username, action } = req.body; // action: 'promote' | 'demote'
    if (!username || !action)
      return res.status(400).json({ error: "username and action required" });
    const val = action === "promote" ? 1 : 0;
    const p = await db.get("SELECT id FROM players WHERE username = ?", [
      username,
    ]);
    if (!p)
      return res.status(404).json({ error: `Player "${username}" not found` });
    await db.run("UPDATE players SET is_chat_mod = ? WHERE id = ?", [
      val,
      p.id,
    ]);
    res.json({ ok: true });
  });

  // POST /api/admin/chat-unban
  router.post("/chat-unban", async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "username required" });
    await db.run(
      "UPDATE players SET chat_banned = 0, chat_ban_reason = NULL WHERE username = ?",
      [username],
    );
    res.json({ ok: true });
  });

  // GET /api/admin/kingdom-detail/:id — fetch single kingdom with all fields
  router.get("/kingdom-detail/:id", async (req, res) => {
    try {
      const k = await db.get(
        `
        SELECT k.*, p.username, p.is_admin, p.is_banned
        FROM kingdoms k JOIN players p ON k.player_id = p.id
        WHERE k.id = ?
      `,
        [req.params.id],
      );
      if (!k) return res.status(404).json({ error: "Kingdom not found" });
      res.json(k);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/promote — make a player admin
  router.post("/promote", async (req, res) => {
    const { playerId, username } = req.body;
    if (!playerId && !username)
      return res.status(400).json({ error: "playerId or username required" });
    let player;
    if (username) {
      player = await db.get("SELECT id FROM players WHERE username = ?", [
        username,
      ]);
      if (!player)
        return res
          .status(404)
          .json({ error: `Player "${username}" not found` });
    }
    const id = playerId || player.id;
    await db.run("UPDATE players SET is_admin = 1 WHERE id = ?", [id]);
    res.json({ ok: true });
  });

  // POST /api/admin/announce — broadcast a global message via Socket.io
  router.post("/set-kingdom", async (req, res) => {
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
      "morale",
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
    ]);

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

    const cols = Object.keys(safe)
      .map((c) => `${c} = ?`)
      .join(", ");
    await db.run(`UPDATE kingdoms SET ${cols} WHERE id = ?`, [
      ...Object.values(safe),
      kingdomId,
    ]);
    res.json({ ok: true, updated: Object.keys(safe) });
  });

  // POST /api/admin/announce — broadcast a global message via Socket.io
  router.post("/announce", async (req, res) => {
    const { message } = req.body;
    if (!message?.trim())
      return res.status(400).json({ error: "message required" });
    io.to("global").emit("chat:message", {
      room: "global",
      from: "[ADMIN]",
      race: "admin",
      message: message.trim(),
      ts: Date.now(),
    });
    res.json({ ok: true });
  });

  // GET /api/admin/ai-hiatus — check current AI hiatus status
  router.get("/ai-hiatus", async (_req, res) => {
    try {
      const row = await db.get("SELECT value FROM server_state WHERE key = 'ai_hiatus'");
      res.json({ hiatus: row ? row.value === 'true' : false });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/ai-hiatus — update AI hiatus status
  router.post("/ai-hiatus", async (req, res) => {
    try {
      const { hiatus } = req.body;
      const hiatusValue = hiatus ? 'true' : 'false';
      await db.run("INSERT OR REPLACE INTO server_state (key, value) VALUES ('ai_hiatus', ?)", [hiatusValue]);
      res.json({ ok: true, hiatus });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/admin/kingdom/:id — delete a kingdom and all related records
  router.delete("/kingdom/:id", async (req, res) => {
    const kid = req.params.id;
    try {
      // Clear out relations so foreign keys don't block
      await db.run("DELETE FROM alliance_members WHERE kingdom_id = ?", [kid]);
      await db.run("DELETE FROM alliances WHERE leader_id = ?", [kid]);
      await db.run("DELETE FROM news WHERE kingdom_id = ?", [kid]);
      await db.run("DELETE FROM war_log WHERE attacker_id = ? OR defender_id = ?", [kid, kid]);
      await db.run("DELETE FROM expeditions WHERE kingdom_id = ?", [kid]);
      await db.run("DELETE FROM combat_log WHERE attacker_id = ? OR defender_id = ?", [kid, kid]);
      await db.run("DELETE FROM chat_messages WHERE kingdom_id = ?", [kid]);
      await db.run("DELETE FROM heroes WHERE kingdom_id = ?", [kid]);
      await db.run("DELETE FROM spy_reports WHERE kingdom_id = ? OR target_id = ?", [kid, kid]);
      await db.run("DELETE FROM trade_routes WHERE kingdom_id = ? OR partner_id = ?", [kid, kid]);
      await db.run("DELETE FROM bounties WHERE target_id = ? OR claimed_by_id = ?", [kid, kid]);
      await db.run("DELETE FROM trade_offers WHERE sender_id = ? OR receiver_id = ?", [kid, kid]);
      await db.run("DELETE FROM mercenaries WHERE kingdom_id = ?", [kid]);
      await db.run("DELETE FROM event_log WHERE kingdom_id = ?", [kid]);
      // Finally delete the kingdom
      await db.run("DELETE FROM kingdoms WHERE id = ?", [kid]);
      res.json({ ok: true });
    } catch (err) {
      console.error("[admin] delete kingdom error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/admin/kingdom/:id — delete a kingdom and all related records
  router.delete("/kingdom/:id", async (req, res) => {
    const kid = req.params.id;
    try {
      // Clear out relations so foreign keys don't block
      await db.run("DELETE FROM alliance_members WHERE kingdom_id = ?", [kid]);
      await db.run("DELETE FROM alliances WHERE leader_id = ?", [kid]); // Or pick a new leader, but taking easiest route
      await db.run("DELETE FROM news WHERE kingdom_id = ?", [kid]);
      await db.run("DELETE FROM war_log WHERE attacker_id = ? OR defender_id = ?", [kid, kid]);
      await db.run("DELETE FROM expeditions WHERE kingdom_id = ?", [kid]);
      await db.run("DELETE FROM combat_log WHERE attacker_id = ? OR defender_id = ?", [kid, kid]);
      await db.run("DELETE FROM chat_messages WHERE kingdom_id = ?", [kid]);
      await db.run("DELETE FROM heroes WHERE kingdom_id = ?", [kid]);
      await db.run("DELETE FROM spy_reports WHERE kingdom_id = ? OR target_id = ?", [kid, kid]);
      await db.run("DELETE FROM trade_routes WHERE kingdom_id = ? OR partner_id = ?", [kid, kid]);
      await db.run("DELETE FROM bounties WHERE target_id = ? OR claimed_by_id = ?", [kid, kid]);
      await db.run("DELETE FROM trade_offers WHERE sender_id = ? OR receiver_id = ?", [kid, kid]);
      await db.run("DELETE FROM mercenaries WHERE kingdom_id = ?", [kid]);
      await db.run("DELETE FROM event_log WHERE kingdom_id = ?", [kid]);
      // Finally delete the kingdom
      await db.run("DELETE FROM kingdoms WHERE id = ?", [kid]);
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to delete: " + e.message });
    }
  });

  router.get("/config", async (_req, res) => {
    const fs = require("fs");
    const path = require("path");
    const config = require("../game/config");
    let overrides = {};
    try {
      const overridesPath = path.join(
        __dirname,
        "../game/config_overrides.json",
      );
      if (fs.existsSync(overridesPath)) {
        overrides = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
      }
    } catch {}
    res.json({ config, overrides });
  });

  router.post("/config", async (req, res) => {
    const fs = require("fs");
    const path = require("path");
    const config = require("../game/config");
    const { overrides } = req.body;
    if (!overrides)
      return res.status(400).json({ error: "overrides required" });

    const overridesPath = path.join(__dirname, "../game/config_overrides.json");
    let existing = {};
    try {
      if (fs.existsSync(overridesPath)) {
        existing = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
      }
    } catch {}

    // Merge existing overrides and new overrides
    for (const key of Object.keys(overrides)) {
      if (
        typeof overrides[key] === "object" &&
        config[key] &&
        !Array.isArray(config[key])
      ) {
        existing[key] = { ...(existing[key] || {}), ...overrides[key] };
        // Apply immediately to memory
        Object.assign(config[key], overrides[key]);
      } else {
        existing[key] = overrides[key];
        config[key] = overrides[key];
      }
    }

    fs.writeFileSync(overridesPath, JSON.stringify(existing, null, 2));
    res.json({ ok: true, existing });
  });

  // ── Flush all location data ───────────────────────────────────────────────────
  router.post("/flush-locations", async (_req, res) => {
    await db.run(
      "UPDATE kingdoms SET discovered_kingdoms='{}', location_maps_wip='[]', world_fragments='[]', hybrid_blueprints='{}'",
    );
    console.log("[admin] All location data flushed");
    res.json({
      ok: true,
      message:
        "All kingdom location data cleared. Players must rediscover kingdoms.",
    });
  });

  router.post("/flush-support-troops", async (_req, res) => {
    await db.run("UPDATE kingdoms SET researchers=0, engineers=0, scribes=0");
    console.log("[admin] All support troops flushed");
    res.json({
      ok: true,
      message:
        "All support troops (researchers, engineers, scribes) set to 0 for all players.",
    });
  });
  router.get("/events/log", async (_req, res) => {
    const rows = await db.all(
      `SELECT * FROM event_log ORDER BY fired_at DESC LIMIT 200`,
    );
    res.json(rows);
  });

  router.get("/events/list", async (_req, res) => {
    const rows = await db.all(`SELECT * FROM events ORDER BY season, name`);
    res.json(rows);
  });

  router.get("/suggestions", async (_req, res) => {
    const rows = await db.all(`
      SELECT s.*, k.name as kingdom_name, p.username 
      FROM suggestions s
      LEFT JOIN kingdoms k ON s.kingdom_id = k.id
      LEFT JOIN players p ON s.player_id = p.id
      ORDER BY s.created_at DESC
    `);
    res.json(rows);
  });

  // ── Admin Notes ───────────────────────────────────────────────────────────────
  router.get("/admin_notes", async (_req, res) => {
    const rows = await db.all(
      `SELECT * FROM admin_notes ORDER BY created_at DESC`,
    );
    res.json(rows);
  });

  router.post("/admin_notes", async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });
    const author = req.player ? req.player.username : "Unknown Admin";
    await db.run(
      `INSERT INTO admin_notes (author_name, message) VALUES (?, ?)`,
      [author, message],
    );
    res.json({ ok: true });
  });

  router.delete("/admin_notes/:id", async (req, res) => {
    await db.run(`DELETE FROM admin_notes WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  });

  // ── Wishlist ───────────────────────────────────────────────────────────────
  router.get("/wishlist", async (_req, res) => {
    const rows = await db.all(`SELECT * FROM wishlist ORDER BY id DESC`);
    res.json(rows);
  });

  router.post("/wishlist", async (req, res) => {
    const { category, description } = req.body;
    if (!description || !category) return res.status(400).json({ error: "Category and description required" });
    await db.run(
      `INSERT INTO wishlist (category, description, completed) VALUES (?, ?, 0)`,
      [category, description]
    );
    res.json({ ok: true });
  });

  router.post("/wishlist/:id/complete", async (req, res) => {
    await db.run(`UPDATE wishlist SET completed = 1 WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  });

  router.post("/events/create", async (req, res) => {
    const {
      key,
      name,
      description,
      season,
      effect_type,
      effect_value,
      effect_duration,
      race_only,
      is_active,
      is_positive,
    } = req.body;
    if (!key || !name)
      return res.status(400).json({ error: "Key and name required" });
    await db.run(
      `INSERT INTO events (key,name,description,season,effect_type,effect_value,effect_duration,race_only,is_active,is_positive) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        key,
        name,
        description || "",
        season || "all",
        effect_type || "morale",
        effect_value || 0,
        effect_duration || 1,
        race_only || null,
        is_active ? 1 : 0,
        is_positive ? 1 : 0,
      ],
    );
    res.json({ ok: true });
  });

  router.post("/events/update", async (req, res) => {
    const {
      id,
      key,
      name,
      description,
      season,
      effect_type,
      effect_value,
      effect_duration,
      race_only,
      is_active,
      is_positive,
    } = req.body;
    if (!id) return res.status(400).json({ error: "ID required" });
    await db.run(
      `UPDATE events SET key=?,name=?,description=?,season=?,effect_type=?,effect_value=?,effect_duration=?,race_only=?,is_active=?,is_positive=? WHERE id=?`,
      [
        key,
        name,
        description || "",
        season || "all",
        effect_type || "morale",
        effect_value || 0,
        effect_duration || 1,
        race_only || null,
        is_active ? 1 : 0,
        is_positive ? 1 : 0,
        id,
      ],
    );
    res.json({ ok: true });
  });

  router.post("/events/delete", async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "ID required" });
    await db.run("DELETE FROM events WHERE id = ?", [id]);
    res.json({ ok: true });
  });

  router.get("/lore", async (_req, res) => {
    const list = await db.all(
      "SELECT * FROM lore_entries ORDER BY category ASC, id ASC",
    );
    res.json({ ok: true, list });
  });
  router.post("/lore", async (req, res) => {
    const { key_id, category, title, content } = req.body;
    await db.run(
      "INSERT INTO lore_entries (key_id, category, title, content) VALUES (?, ?, ?, ?)",
      [key_id || "", category || "general", title || "", content || ""],
    );
    await require("../../index").refreshLore();
    res.json({ ok: true });
  });
  router.put("/lore/:id", async (req, res) => {
    const { key_id, category, title, content } = req.body;
    await db.run(
      "UPDATE lore_entries SET key_id=?, category=?, title=?, content=? WHERE id=?",
      [
        key_id || "",
        category || "general",
        title || "",
        content || "",
        req.params.id,
      ],
    );
    await require("../../index").refreshLore();
    res.json({ ok: true });
  });
  router.delete("/lore/:id", async (req, res) => {
    await db.run("DELETE FROM lore_entries WHERE id=?", [req.params.id]);
    await require("../../index").refreshLore();
    res.json({ ok: true });
  });

  router.get("/random_events", async (_req, res) => {
    const list = await db.all("SELECT * FROM random_events ORDER BY id ASC");
    res.json({ ok: true, list });
  });
  router.post("/random_events", async (req, res) => {
    await db.run("INSERT INTO random_events (content) VALUES (?)", [
      req.body.content || "",
    ]);
    await require("../../index").refreshLore();
    res.json({ ok: true });
  });
  router.put("/random_events/:id", async (req, res) => {
    await db.run("UPDATE random_events SET content=? WHERE id=?", [
      req.body.content || "",
      req.params.id,
    ]);
    await require("../../index").refreshLore();
    res.json({ ok: true });
  });
  router.delete("/random_events/:id", async (req, res) => {
    await db.run("DELETE FROM random_events WHERE id=?", [req.params.id]);
    await require("../../index").refreshLore();
    res.json({ ok: true });
  });

  router.get("/junk_events", async (_req, res) => {
    const list = await db.all("SELECT * FROM junk_events ORDER BY id ASC");
    res.json({ ok: true, list });
  });
  router.post("/junk_events", async (req, res) => {
    await db.run("INSERT INTO junk_events (content) VALUES (?)", [
      req.body.content || "",
    ]);
    await require("../../index").refreshLore();
    res.json({ ok: true });
  });
  router.delete("/junk_events/:id", async (req, res) => {
    await db.run("DELETE FROM junk_events WHERE id=?", [req.params.id]);
    await require("../../index").refreshLore();
    res.json({ ok: true });
  });

  router.get("/tax_events", async (_req, res) => {
    const list = await db.all("SELECT * FROM tax_events ORDER BY id ASC");
    res.json({ ok: true, list });
  });
  router.post("/tax_events", async (req, res) => {
    await db.run("INSERT INTO tax_events (content) VALUES (?)", [
      req.body.content || "",
    ]);
    await require("../../index").refreshLore();
    res.json({ ok: true });
  });
  router.delete("/tax_events/:id", async (req, res) => {
    await db.run("DELETE FROM tax_events WHERE id=?", [req.params.id]);
    await require("../../index").refreshLore();
    res.json({ ok: true });
  });

  router.get("/sounds", (req, res) => {
    fs.readdir(soundsPath, (err, files) => {
      if (err)
        return res
          .status(500)
          .json({ error: "Failed to read sounds directory" });
      const sounds = files.filter(
        (f) => f.endsWith(".mp3") || f.endsWith(".wav"),
      );
      res.json({ ok: true, sounds });
    });
  });

  router.post("/sounds/upload", requireAdmin, requireCsrfToken, (req, res) => {
    upload.single("soundFile")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      let finalName = req.file.filename;
      if (typeof req.body.actionName === "string" && req.body.actionName !== "custom") {
        const ext = path.extname(req.file.filename);
        const requestedBase = req.body.actionName.split(/[/\\]/).pop();
        if (!requestedBase || requestedBase === "." || requestedBase === "..") {
          return res.status(400).json({ error: "Invalid action name" });
        }
        const candidateName = requestedBase + ext;
        const newPath = safeSoundPath(candidateName);
        const oldPath = safeSoundPath(req.file.filename);
        if (!newPath || !oldPath) {
          return res.status(400).json({ error: "Invalid filename" });
        }
        if (fs.existsSync(oldPath)) {
          fs.renameSync(oldPath, newPath);
          finalName = path.basename(newPath);
        }
      }
      res.json({ ok: true, filename: finalName });
    });
  });

  router.post("/sounds/delete", requireAdmin, requireCsrfToken, (req, res) => {
    if (!req.body.filename)
      return res.status(400).json({ error: "Filename required" });
    const targetPath = safeSoundPath(req.body.filename);
    if (!targetPath) {
      return res.status(400).json({ error: "Invalid filename" });
    }
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
    res.json({ ok: true });
  });

  router.get("/fragments", (req, res) => {
    const FRAGMENT_BONUSES = require("../game/world-fragment-bonuses");
    const FRAGMENT_METADATA = {
      "Volcanic Rock": { emoji: "🌋", description: "Fire, Creation, Forge, Transformation through Heat" },
      "Ancient Elven Wood": { emoji: "🧝", description: "Nature, Magic, Growth, Timelessness, Grace" },
      "Dragon Scale": { emoji: "🐉", description: "Power, Combat, Dominance, Draconic Might" },
      "Abyssal Crystal": { emoji: "🔮", description: "Void, Chaos, Forbidden Power, High Risk/High Reward" },
      "Celestial Feather": { emoji: "🪶", description: "Light, Hope, Divine Blessing, Integrity" },
      "Dwarven Star-Metal": { emoji: "⚒️", description: "Craftsmanship, Eternal Quality, Fortress Defense" },
      "Cursed Bloodstone": { emoji: "🩸", description: "Sacrifice, Dark Magic, Blood Rituals, Relentless War" },
      "Tears of the World Tree": { emoji: "💧", description: "Life, Healing, Renewal, Infinite Growth" },
      "Void Essence": { emoji: "🌌", description: "Ultimate Power, Chaos, Reality Warping, Total Volatility" },
      "Titan Bone": { emoji: "🦴", description: "Spaciousness, Ancient Strength, Monumental Scale" }
    };

    const result = {};
    for (const [name, blds] of Object.entries(FRAGMENT_BONUSES)) {
      const meta = FRAGMENT_METADATA[name] || { emoji: "✨", description: "Ancient world anomaly" };
      
      result[name] = {
        emoji: meta.emoji,
        description: meta.description,
        buildings: blds
      };
    }
    res.json(result);
  });

  // ── GOALS MANAGEMENT ──────────────────────────────────────────────────────
  router.get("/goals", async (_req, res) => {
    res.json({
      daily: DAILY_GOALS,
      weekly: WEEKLY_GOALS,
      monthly: MONTHLY_GOALS
    });
  });

  // POST /api/admin/goals/edit — update an existing goal definition
  router.post("/goals/edit", async (req, res) => {
    const { tier, goalId, label, minTarget, maxTarget, prizeType, prizeMultiplier } = req.body;

    if (!tier || !goalId) {
      return res.status(400).json({ error: "tier and goalId required" });
    }

    const validTiers = ['daily', 'weekly', 'monthly'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: "Invalid tier (daily/weekly/monthly)" });
    }

    // Validation
    if (minTarget !== undefined && (minTarget < 1 || minTarget > 500)) {
      return res.status(400).json({ error: "minTarget must be between 1 and 500" });
    }
    if (maxTarget !== undefined && (maxTarget < 2 || maxTarget > 1000)) {
      return res.status(400).json({ error: "maxTarget must be between 2 and 1000" });
    }
    if (prizeMultiplier !== undefined && (prizeMultiplier < 0.5 || prizeMultiplier > 100)) {
      return res.status(400).json({ error: "prizeMultiplier must be between 0.5 and 100" });
    }
    if (prizeType !== undefined && !ALLOWED_PRIZE_TYPES.includes(prizeType)) {
      return res.status(400).json({ error: `Invalid prizeType. Allowed: ${ALLOWED_PRIZE_TYPES.join(', ')}` });
    }

    try {
      const existing = await db.get(
        `SELECT min_target, max_target FROM admin_goal_definitions WHERE tier = ? AND goal_id = ? AND active = 1`,
        [tier, goalId]
      );

      const defaultsPool = tier === 'daily' ? DAILY_GOALS : tier === 'weekly' ? WEEKLY_GOALS : tier === 'monthly' ? MONTHLY_GOALS : [];
      const defaultGoal = defaultsPool.find(g => g.id === goalId);
      if (!existing && !defaultGoal) {
        return res.status(404).json({ error: "Goal not found in defaults or overrides" });
      }

      const currentMin = existing ? existing.min_target : defaultGoal.min;
      const currentMax = existing ? existing.max_target : defaultGoal.max;
      const finalMin = minTarget !== undefined ? minTarget : currentMin;
      const finalMax = maxTarget !== undefined ? maxTarget : currentMax;

      if (finalMin >= finalMax) {
        return res.status(400).json({ error: "minTarget must be less than maxTarget" });
      }

      if (existing) {
        await db.run(
          `UPDATE admin_goal_definitions
           SET label = COALESCE(?, label),
               min_target = COALESCE(?, min_target),
               max_target = COALESCE(?, max_target),
               prize_type = COALESCE(?, prize_type),
               prize_multiplier = COALESCE(?, prize_multiplier),
               updated_at = CURRENT_TIMESTAMP
           WHERE tier = ? AND goal_id = ? AND active = 1`,
          [
            label !== undefined ? label : null,
            minTarget !== undefined ? minTarget : null,
            maxTarget !== undefined ? maxTarget : null,
            prizeType !== undefined ? prizeType : null,
            prizeMultiplier !== undefined ? prizeMultiplier : null,
            tier,
            goalId
          ]
        );
      } else {
        await db.run(
          `INSERT INTO admin_goal_definitions (tier, goal_id, label, min_target, max_target, prize_type, prize_multiplier, active)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            tier,
            goalId,
            label !== undefined ? label : defaultGoal.label,
            minTarget !== undefined ? minTarget : defaultGoal.min,
            maxTarget !== undefined ? maxTarget : defaultGoal.max,
            prizeType !== undefined ? prizeType : defaultGoal.prizeType,
            prizeMultiplier !== undefined ? prizeMultiplier : defaultGoal.prizeMult
          ]
        );
      }

      await refreshInMemoryGoals(db);
      res.json({ ok: true, message: "Goal updated successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/goals/add — add a new goal
  router.post("/goals/add", async (req, res) => {
    const { tier, goalId, label, minTarget, maxTarget, prizeType, prizeMultiplier } = req.body;

    if (!tier || !goalId || !label || minTarget === undefined || maxTarget === undefined || !prizeType || prizeMultiplier === undefined) {
      return res.status(400).json({ error: "All fields required: tier, goalId, label, minTarget, maxTarget, prizeType, prizeMultiplier" });
    }

    const validTiers = ['daily', 'weekly', 'monthly'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: "Invalid tier (daily/weekly/monthly)" });
    }

    // Validation
    if (minTarget < 1 || minTarget > 500) {
      return res.status(400).json({ error: "minTarget must be between 1 and 500" });
    }
    if (maxTarget < 2 || maxTarget > 1000) {
      return res.status(400).json({ error: "maxTarget must be between 2 and 1000" });
    }
    if (minTarget >= maxTarget) {
      return res.status(400).json({ error: "minTarget must be less than maxTarget" });
    }
    if (prizeMultiplier < 0.5 || prizeMultiplier > 10000) {
      return res.status(400).json({ error: "prizeMultiplier must be between 0.5 and 10000" });
    }
    if (!['gold', 'mana', 'rangers', 'researchers', 'war_machines', 'world_fragment'].includes(prizeType)) {
      return res.status(400).json({ error: `Invalid prizeType. Allowed: ${['gold', 'mana', 'rangers', 'researchers', 'war_machines', 'world_fragment'].join(', ')}` });
    }

    try {
      await db.run(
        `INSERT INTO admin_goal_definitions (tier, goal_id, label, min_target, max_target, prize_type, prize_multiplier, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT (tier, goal_id) DO UPDATE SET
           label = EXCLUDED.label,
           min_target = EXCLUDED.min_target,
           max_target = EXCLUDED.max_target,
           prize_type = EXCLUDED.prize_type,
           prize_multiplier = EXCLUDED.prize_multiplier,
           active = 1,
           updated_at = CURRENT_TIMESTAMP`,
        [tier, goalId, label, minTarget, maxTarget, prizeType, prizeMultiplier]
      );
      await refreshInMemoryGoals(db);
      res.json({ ok: true, message: "Goal added successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/goals/remove — soft-delete a goal
  router.post("/goals/remove", async (req, res) => {
    const { tier, goalId } = req.body;

    if (!tier || !goalId) {
      return res.status(400).json({ error: "tier and goalId required" });
    }

    const validTiers = ['daily', 'weekly', 'monthly'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: "Invalid tier (daily/weekly/monthly)" });
    }

    try {
      const existing = await db.get(
        `SELECT 1 FROM admin_goal_definitions WHERE tier = ? AND goal_id = ?`,
        [tier, goalId]
      );

      if (existing) {
        await db.run(
          `UPDATE admin_goal_definitions SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE tier = ? AND goal_id = ?`,
          [tier, goalId]
        );
      } else {
        const defaultsPool = tier === 'daily' ? DAILY_GOALS : tier === 'weekly' ? WEEKLY_GOALS : tier === 'monthly' ? MONTHLY_GOALS : [];
        const defaultGoal = defaultsPool.find(g => g.id === goalId);
        if (!defaultGoal) {
          return res.status(404).json({ error: "Goal not found" });
        }

        await db.run(
          `INSERT INTO admin_goal_definitions (tier, goal_id, label, min_target, max_target, prize_type, prize_multiplier, active)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
          [tier, goalId, defaultGoal.label, defaultGoal.min, defaultGoal.max, defaultGoal.prizeType, defaultGoal.prizeMult]
        );
      }

      await refreshInMemoryGoals(db);
      res.json({ ok: true, message: "Goal removed successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/repair-resource-allocations", requireAdmin, requireCsrfToken, async (req, res) => {
    try {
      const kingdomId = req.body.kingdomId;
      if (!kingdomId) return res.status(400).json({ error: "kingdomId required" });

      const k = await db.get("SELECT * FROM kingdoms WHERE id = ?", [kingdomId]);
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

      await db.run("UPDATE kingdoms SET resource_build_allocation = ? WHERE id = ?", [
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

  router.post("/security-audit", requireAdmin, requireCsrfToken, async (req, res) => {
    try {
      const AuditReportGenerator = require("../tools/security-auditor/report-generator");
      const generator = new AuditReportGenerator(path.join(__dirname, ".."));

      const analysis = generator.analyzer.analyzeProject(['index.js', 'database.js', 'config.js']);
      const findings = generator.compileFinding(analysis);

      const allFindings = [
        ...findings.critical,
        ...findings.high,
        ...findings.medium,
        ...findings.low,
        ...findings.info
      ];

      const summary = {
        critical: findings.critical.length,
        high: findings.high.length,
        medium: findings.medium.length,
        low: findings.low.length,
        info: findings.info.length
      };

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        summary,
        findings: allFindings
      });
    } catch (err) {
      console.error("[admin] Security audit error:", err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  return router;
};

module.exports.refreshInMemoryGoals = refreshInMemoryGoals;
