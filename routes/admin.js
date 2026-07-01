const express = require("express");
const bcrypt = require("bcrypt");
const { requireAdmin, requireCsrfToken, ensureCsrfToken } = require("./middleware");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const _config = require("../game/config");
const { _GOAL_COUNTS, DAILY_GOALS, WEEKLY_GOALS, MONTHLY_GOALS } = require("../game/goals");
const engine = require("../game/engine");
const { FRAGMENT_METADATA } = require("../game/fragment-attunements");
const { PRESETS, PRESET_IDS, buildPresetFields } = require("../game/ai-presets");
const { computeNextRunAt } = require("../lib/audit-scheduler");
const { EPOCH_NOW } = require("../lib/db-sql");
const { pgSetClause, pgValueTuples } = require("../lib/pg-placeholders");
const { incrementUnread } = require("../cache");

const ALLOWED_PRIZE_TYPES = ['gold', 'mana', 'rangers', 'researchers', 'war_machines', 'world_fragment'];
const ALLOWED_SOUND_EXTENSIONS = new Set([".mp3", ".wav"]);
const BCRYPT_SALT_ROUNDS = 10;
const AUDIT_FREQUENCIES = new Set(["daily", "weekly", "monthly"]);
const TEST_RACES = [
  "human",
  "high_elf",
  "dwarf",
  "dire_wolf",
  "dark_elf",
  "orc",
  "vampire",
  "wood_elf",
  "ogre",
];

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

/** Register canonical kebab path plus legacy snake_plural alias (alpha backward compat). */
function dualRoute(router, method, canonical, legacy, ...handlers) {
  router[method](canonical, ...handlers);
  if (legacy && legacy !== canonical) {
    router[method](legacy, ...handlers);
  }
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

const ALLOWED_SOUND_MIME = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav']);
const { validateAudioSignature } = require('../utils/file-signatures');

// Memory storage so we can magic-byte check before persisting. A `.mp3`
// filename with arbitrary contents must not reach public/sounds/.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname((file.originalname || "")).toLowerCase();
    if (!ALLOWED_SOUND_EXTENSIONS.has(ext)) {
      return cb(new Error("Only .mp3 and .wav files are allowed"));
    }
    if (file.mimetype && !ALLOWED_SOUND_MIME.has(file.mimetype)) {
      return cb(new Error("Invalid file type — only audio files are allowed"));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = function (db, io) {
  function buildStartingProfile(race) {
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
      bld_mausoleums: 0,
    };

    let fighters = 0;
    let rangers = 50;
    let food = 5000;
    let thralls = 0;

    if (race === "human") buildings.bld_markets = 1;
    if (race === "dwarf") buildings.bld_smithies = 1;
    if (race === "high_elf") buildings.bld_mage_towers = 1;
    if (race === "dark_elf") buildings.bld_shrines = 1;
    if (race === "orc") buildings.bld_training = 1;
    if (race === "vampire") {
      buildings.bld_mausoleums = 1;
      buildings.bld_housing = 50;
      thralls = 50;
    }
    if (race === "dire_wolf") {
      buildings.bld_barracks = 2;
      fighters = 100;
      rangers = 100;
    }
    if (race === "wood_elf") {
      buildings.bld_outposts = 1;
      rangers = 100;
    }
    if (race === "ogre") {
      buildings.bld_training = 1;
      fighters = 100;
      rangers = 0;
    }

    const buildingKeys = {
      bld_farms: "farms",
      bld_schools: "schools",
      bld_barracks: "barracks",
      bld_armories: "armories",
      bld_housing: "housing",
      bld_markets: "markets",
      bld_smithies: "smithies",
      bld_mage_towers: "mage_towers",
      bld_shrines: "shrines",
      bld_outposts: "outposts",
      bld_training: "training",
      bld_mausoleums: "mausoleums",
    };

    let land = 1000;
    for (const [dbCol, configKey] of Object.entries(buildingKeys)) {
      const count = buildings[dbCol] || 0;
      const cost = engine.BUILDING_LAND_COST[configKey] || 0;
      land += count * cost;
    }

    return { buildings, fighters, rangers, food, thralls, land };
  }

  // All admin routes require admin JWT
  router.use(requireAdmin);
  // Issue CSRF cookie on read requests when an admin session exists
  router.use(ensureCsrfToken);
  // All state-changing admin routes require matching CSRF header + cookie
  router.use((req, res, next) => {
    if (!["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) return next();
    return requireCsrfToken(req, res, next);
  });

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
      "UPDATE players SET is_banned = 1, ban_reason = $1 WHERE id = $2",
      [reason || "Banned by admin", playerId],
    );
    res.json({ ok: true });
  });

  // POST /api/admin/unban — unban a player
  router.post("/unban", async (req, res) => {
    const { playerId } = req.body;
    if (!playerId) return res.status(400).json({ error: "playerId required" });
    await db.run(
      "UPDATE players SET is_banned = 0, ban_reason = NULL WHERE id = $1",
      [playerId],
    );
    res.json({ ok: true });
  });

  // POST /api/admin/reset-turns — reset a kingdom's turns to 400
  router.post("/reset-turns", async (req, res) => {
    const { kingdomId } = req.body;
    if (!kingdomId)
      return res.status(400).json({ error: "kingdomId required" });
    await db.run("UPDATE kingdoms SET turns_stored = 400 WHERE id = $1", [
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
      gold = 10000, mana = 0, land = 504, population = 50000, food = $1, happiness = 100,
      turn = 0, turns_stored = 400,
      fighters = $2, rangers = $3, clerics = 0, mages = 0, thieves = 0, ninjas = 0,
      researchers = 100, engineers = 100, scribes = 0,
      war_machines = 0, ballistae = 0, weapons_stockpile = 0, armor_stockpile = 0,
      bld_farms = $4, bld_barracks = $5, bld_outposts = $6, bld_guard_towers = 0,
      bld_schools = $7, bld_armories = $8, bld_vaults = 0, bld_smithies = $9,
      bld_markets = $10, bld_mage_towers = $11, bld_training = $12,
      bld_castles = 0, bld_shrines = $13, bld_libraries = 0, bld_taverns = 0, bld_housing = $14,
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
    await db.run(`${RESET_KINGDOM_SET} WHERE id = $15`, [
      ...buildResetValues(race),
      kingdomId,
    ]);

    // Clear all related tables and data
    await db.run("DELETE FROM expeditions WHERE kingdom_id = $1", [kingdomId]);
    await db.run("DELETE FROM news WHERE kingdom_id = $1", [kingdomId]);
    await db.run(
      "DELETE FROM war_log WHERE attacker_id = $1 OR defender_id = $2",
      [kingdomId, kingdomId],
    );
    await db.run("DELETE FROM heroes WHERE kingdom_id = $1", [kingdomId]);
    await db.run("DELETE FROM trade_routes WHERE kingdom_id = $1 OR partner_id = $2", [kingdomId, kingdomId]);
    await db.run("DELETE FROM bounties WHERE target_id = $1", [kingdomId]);
    await db.run("DELETE FROM spy_reports WHERE kingdom_id = $1 OR target_id = $2", [kingdomId, kingdomId]);
  };

  // POST /api/admin/reset-kingdom — wipe a single kingdom back to starting stats
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

  // POST /api/admin/reset-all-kingdoms — wipe all kingdoms back to starting stats
  router.post("/reset-all-kingdoms", async (_req, res) => {
    // Reset values are race-dependent, so batch with one UPDATE per race
    // instead of nine queries per kingdom.
    const races = await db.all("SELECT DISTINCT race FROM kingdoms");
    for (const { race } of races) {
      await db.run(`${RESET_KINGDOM_SET} WHERE race = $15`, [
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
        const region = engine.assignRegion(race);
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
      } else {
        await db.run(
          "UPDATE kingdoms SET name = $1, race = $2, gender = $3, region = $4 WHERE id = $5",
          [kingdomName, race, "male", engine.assignRegion(race), kingdom.id],
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

  // POST /api/admin/set-gold — set a kingdom's gold
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
    await db.run(`UPDATE kingdoms SET ${col} = $1 WHERE id = $2`, [Math.max(0, Number(amount)), kingdomId]);
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

  // POST /api/admin/chat-unban
  router.post("/chat-unban", async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "username required" });
    await db.run(
      "UPDATE players SET chat_banned = 0, chat_ban_reason = NULL WHERE username = $1",
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

  // POST /api/admin/promote — make a player admin
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

    const cols = Object.keys(safe)
      .map((c) => `${c} = $1`)
      .join(", ");
    await db.run(`UPDATE kingdoms SET ${cols} WHERE id = $1`, [
      ...Object.values(safe),
      kingdomId,
    ]);
    res.json({ ok: true, updated: Object.keys(safe) });
  });

  // POST /api/admin/announce — persist to global chat + every kingdom's news feed
  router.post("/announce", async (req, res) => {
    try {
      const text = (req.body.message || "").trim();
      if (!text) return res.status(400).json({ error: "message required" });
      if (text.length > 5000) return res.status(400).json({ error: "message cannot exceed 5000 characters" });

      const newsBlurb = `📢 Server announcement: ${text}`;

      const chatInsert = await db.run(
        "INSERT INTO chat_messages (kingdom_id, player_id, username, room, message) VALUES ($1, $2, $3, $4, $5)",
        [null, 0, "[ADMIN]", "global", text],
      );
      const chatId = chatInsert.lastID;

      const BATCH_SIZE = 1000;
      let offset = 0;
      let totalKingdoms = 0;
      let hasMore = true;
      while (hasMore) {
        const batch = await db.all("SELECT id FROM kingdoms LIMIT $1 OFFSET $2", [BATCH_SIZE, offset]);
        if (batch.length === 0) {
          hasMore = false;
          break;
        }
        totalKingdoms += batch.length;
        const placeholders = pgValueTuples(batch.length, 4);
        const values = batch.flatMap((k) => [k.id, "announcement", newsBlurb, 0]);
        await db.run(
          `INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ${placeholders}`,
          values,
        );
        for (const k of batch) {
          incrementUnread(k.id);
          io.to(`kingdom:${k.id}`).emit("event:news_refresh");
        }
        offset += BATCH_SIZE;
      }

      io.to("global").emit("chat:message", {
        id: chatId,
        room: "global",
        from: "[ADMIN]",
        race: "admin",
        isMod: true,
        message: text,
        ts: Date.now(),
      });

      res.json({ ok: true, chatId, kingdoms: totalKingdoms });
    } catch (err) {
      console.error("[admin] announce failed:", err.message);
      res.status(500).json({ error: err.message });
    }
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
      await db.run(
        "INSERT INTO server_state (key, value) VALUES ('ai_hiatus', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
        [hiatusValue],
      );
      res.json({ ok: true, hiatus });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/ai/synopsis — per-AI kingdom dashboard stats
  router.get("/ai/synopsis", async (_req, res) => {
    try {
      const rows = await db.all(`
        SELECT k.id, k.name, k.race, k.land, k.population, k.gold, k.happiness, k.food,
               k.fighters, k.ninjas, k.mages, k.rangers, k.thieves, k.turns_stored, k.level,
               k.build_allocation, k.research_allocation,
               p.username,
               (SELECT COUNT(*) FROM war_log WHERE attacker_id = k.id) AS wins,
               (SELECT COUNT(*) FROM war_log WHERE defender_id = k.id) AS losses
        FROM kingdoms k
        JOIN players p ON k.player_id = p.id
        WHERE p.is_ai = 1
        ORDER BY k.land DESC
      `);

      const result = rows.map(r => {
        let topBuild = null;
        let topResearch = null;
        try {
          const ba = JSON.parse(r.build_allocation || '{}');
          let maxBld = -1;
          for (const [k, v] of Object.entries(ba)) {
            if (typeof v === 'number' && v > maxBld) { maxBld = v; topBuild = k; }
          }
        } catch { /* ignore malformed JSON */ }
        try {
          const ra = JSON.parse(r.research_allocation || '{}');
          let maxRes = -1;
          for (const [k, v] of Object.entries(ra)) {
            if (typeof v === 'number' && v > maxRes) { maxRes = v; topResearch = k; }
          }
        } catch { /* ignore malformed JSON */ }
        return {
          id: r.id, name: r.name, race: r.race, username: r.username,
          land: r.land, population: r.population, gold: r.gold,
          happiness: r.happiness, food: r.food,
          fighters: r.fighters, ninjas: r.ninjas, mages: r.mages,
          rangers: r.rangers, thieves: r.thieves,
          turns_stored: r.turns_stored, level: r.level,
          wins: r.wins, losses: r.losses,
          top_build: topBuild, top_research: topResearch,
        };
      });

      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/ai/seed — create AI players+kingdoms for each race (idempotent)
  router.post("/ai/seed", async (req, res) => {
    try {
      const passwordHash = await bcrypt.hash('ai_narmir_internal_2026', BCRYPT_SALT_ROUNDS);
      const results = [];

      for (const race of TEST_RACES) {
        const username = `ai_${race}`;
        const prettyRace = race.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
        const kingdomName = `AI ${prettyRace}`;
        const email = `${username}@narmir.ai`;

        let player = await db.get('SELECT id, is_ai FROM players WHERE username = $1', [username]);
        let created = false;

        if (!player) {
          const pr = await db.run(
            'INSERT INTO players (username, password, email, is_admin, is_ai) VALUES ($1, $2, $3, 0, 1)',
            [username, passwordHash, email],
          );
          player = { id: pr.lastID, is_ai: 1 };
          created = true;
        } else if (!player.is_ai) {
          await db.run('UPDATE players SET is_ai = 1 WHERE id = $1', [player.id]);
        }

        let kingdom = await db.get('SELECT id, race FROM kingdoms WHERE player_id = $1', [player.id]);

        if (!kingdom) {
          const profile = buildStartingProfile(race);
          const region = engine.assignRegion(race);
          const insertResult = await db.run(
            `INSERT INTO kingdoms (
              player_id, name, race, gender, region, gold, land, population, food,
              researchers, engineers, fighters, rangers, thralls, turns_stored,
              res_spellbook, blueprints_stored,
              bld_farms, bld_schools, bld_barracks, bld_armories, bld_housing,
              bld_markets, bld_smithies, bld_mage_towers, bld_shrines, bld_outposts,
              bld_training, bld_mausoleums, world_fragments
            ) VALUES ($1, $2, $3, 'male', $4, 10000, $5, 50000, $6, 100, 100, $7, $8, $9, 400, 0, 0,
              $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, '[]')`,
            [
              player.id, kingdomName, race, region,
              profile.land, profile.food,
              profile.fighters, profile.rangers, profile.thralls,
              profile.buildings.bld_farms, profile.buildings.bld_schools,
              profile.buildings.bld_barracks, profile.buildings.bld_armories,
              profile.buildings.bld_housing, profile.buildings.bld_markets,
              profile.buildings.bld_smithies, profile.buildings.bld_mage_towers,
              profile.buildings.bld_shrines, profile.buildings.bld_outposts,
              profile.buildings.bld_training, profile.buildings.bld_mausoleums,
            ],
          );
          kingdom = { id: insertResult.lastID, race };
        }

        results.push({ race, username, kingdomName, kingdomId: kingdom.id, created });
      }

      res.json({ ok: true, created: results.filter(r => r.created).length, total: results.length, results });
    } catch (e) {
      console.error('[admin] ai/seed error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/admin/ai/reset — reset all AI kingdoms to starting values
  router.post("/ai/reset", async (_req, res) => {
    try {
      const aiKingdoms = await db.all(
        'SELECT k.id, k.race FROM kingdoms k JOIN players p ON k.player_id = p.id WHERE p.is_ai = 1',
      );
      for (const k of aiKingdoms) {
        await resetKingdomLogic(db, k.id, k.race);
      }
      res.json({ ok: true, reset: aiKingdoms.length });
    } catch (e) {
      console.error('[admin] ai/reset error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/ai/presets — list available preset IDs and labels
  router.get("/ai/presets", (_req, res) => {
    const list = PRESET_IDS.map(id => ({
      id,
      label: PRESETS[id].label,
      description: PRESETS[id].description,
    }));
    res.json(list);
  });

  // POST /api/admin/ai/apply-preset — apply a preset to one kingdom
  router.post("/ai/apply-preset", async (req, res) => {
    try {
      const { kingdomId, presetId, force } = req.body;
      if (!kingdomId || !presetId) {
        return res.status(400).json({ error: 'kingdomId and presetId required' });
      }
      if (!PRESET_IDS.includes(presetId)) {
        return res.status(400).json({ error: `Unknown preset: ${presetId}` });
      }

      const kingdom = await db.get(
        'SELECT k.id, k.race, p.is_ai FROM kingdoms k JOIN players p ON k.player_id = p.id WHERE k.id = $1',
        [kingdomId],
      );
      if (!kingdom) return res.status(404).json({ error: 'Kingdom not found' });
      if (!kingdom.is_ai && !force) {
        return res.status(400).json({ error: 'Kingdom is not AI-controlled. Pass force: true to override.' });
      }

      const fields = buildPresetFields(presetId, kingdom.race);
      const fieldKeys = Object.keys(fields);
      const setClauses = pgSetClause(fieldKeys);
      const values = [...Object.values(fields), kingdomId];
      await db.run(`UPDATE kingdoms SET ${setClauses} WHERE id = $${fieldKeys.length + 1}`, values);

      res.json({ ok: true, kingdomId: kingdom.id, presetId, race: kingdom.race, fieldsUpdated: Object.keys(fields).length });
    } catch (e) {
      console.error('[admin] ai/apply-preset error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  // DELETE /api/admin/kingdom/:id — delete a kingdom and all related records
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

  dualRoute(router, "get", "/bug-reports", "/bug_reports", async (_req, res) => {
    const rows = await db.all(`
      SELECT * FROM bug_reports ORDER BY created_at DESC
    `);
    res.json(rows);
  });

  // ── Admin Notes ───────────────────────────────────────────────────────────────
  dualRoute(router, "get", "/admin-notes", "/admin_notes", async (_req, res) => {
    const rows = await db.all(
      `SELECT * FROM admin_notes ORDER BY created_at DESC`,
    );
    res.json(rows);
  });

  dualRoute(router, "post", "/admin-notes", "/admin_notes", async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });
    const author = req.player ? req.player.username : "Unknown Admin";
    await db.run(
      `INSERT INTO admin_notes (author_name, message) VALUES ($1, $2)`,
      [author, message],
    );
    res.json({ ok: true });
  });

  dualRoute(router, "delete", "/admin-notes/:id", "/admin_notes/:id", async (req, res) => {
    await db.run(`DELETE FROM admin_notes WHERE id = $1`, [req.params.id]);
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
      `INSERT INTO wishlist (category, description, completed) VALUES ($1, $2, 0)`,
      [category, description]
    );
    res.json({ ok: true });
  });

  dualRoute(router, "get", "/changelog-entries", "/changelog_entries", async (_req, res) => {
    const rows = await db.all(
      `SELECT * FROM changelog_entries ORDER BY created_at DESC`,
    );
    res.json(rows);
  });

  dualRoute(router, "post", "/changelog-entries", "/changelog_entries", async (req, res) => {
    const { title, description, category } = req.body || {};
    const author = req.player ? req.player.username : "Admin";
    try {
      const { publishChangelogEntry } = require("../lib/changelog-publish");
      const result = await publishChangelogEntry(db, {
        title,
        description,
        category,
        source: "manual",
        authorName: author,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message || "Failed to publish changelog" });
    }
  });

  router.post("/wishlist/:id/complete", async (req, res) => {
    const row = await db.get(`SELECT * FROM wishlist WHERE id = $1`, [req.params.id]);
    if (!row) return res.status(404).json({ error: "Wishlist item not found" });
    if (row.completed) return res.json({ ok: true, alreadyCompleted: true });

    await db.run(`UPDATE wishlist SET completed = 1 WHERE id = $1`, [req.params.id]);

    const { publishChangelogEntry } = require("../lib/changelog-publish");
    const author = req.player ? req.player.username : "Admin";
    const result = await publishChangelogEntry(db, {
      title: row.category || "Wishlist delivery",
      description: row.description,
      category: row.category,
      source: "wishlist",
      sourceId: row.id,
      authorName: author,
    });

    res.json({ ok: true, ...result });
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
      `INSERT INTO events (key,name,description,season,effect_type,effect_value,effect_duration,race_only,is_active,is_positive) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        key,
        name,
        description || "",
        season || "all",
        effect_type || "happiness",
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
      `UPDATE events SET key=$1,name=$2,description=$3,season=$4,effect_type=$5,effect_value=$6,effect_duration=$7,race_only=$8,is_active=$9,is_positive=$10 WHERE id=$11`,
      [
        key,
        name,
        description || "",
        season || "all",
        effect_type || "happiness",
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
    await db.run("DELETE FROM events WHERE id = $1", [id]);
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
      "INSERT INTO lore_entries (key_id, category, title, content) VALUES ($1, $2, $3, $4)",
      [key_id || "", category || "general", title || "", content || ""],
    );
    await require("../../index").refreshLore();
    res.json({ ok: true });
  });
  router.put("/lore/:id", async (req, res) => {
    const { key_id, category, title, content } = req.body;
    await db.run(
      "UPDATE lore_entries SET key_id=$1, category=$2, title=$3, content=$4 WHERE id=$5",
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
    await db.run("DELETE FROM lore_entries WHERE id=$1", [req.params.id]);
    await require("../../index").refreshLore();
    res.json({ ok: true });
  });

  dualRoute(router, "get", "/random-events", "/random_events", async (_req, res) => {
    const list = await db.all("SELECT * FROM random_events ORDER BY id ASC");
    res.json({ ok: true, list });
  });
  dualRoute(router, "post", "/random-events", "/random_events", async (req, res) => {
    const content = (req.body.content || "").trim();
    if (content.length > 10000) return res.status(400).json({ error: "content cannot exceed 10000 characters" });
    await db.run("INSERT INTO random_events (content) VALUES ($1)", [content]);
    await require("../../index").refreshLore();
    res.json({ ok: true });
  });
  dualRoute(router, "put", "/random-events/:id", "/random_events/:id", async (req, res) => {
    const content = (req.body.content || "").trim();
    if (content.length > 10000) return res.status(400).json({ error: "content cannot exceed 10000 characters" });
    await db.run("UPDATE random_events SET content=$1 WHERE id=$2", [
      content,
      req.params.id,
    ]);
    await require("../../index").refreshLore();
    res.json({ ok: true });
  });
  dualRoute(router, "delete", "/random-events/:id", "/random_events/:id", async (req, res) => {
    await db.run("DELETE FROM random_events WHERE id=$1", [req.params.id]);
    await require("../../index").refreshLore();
    res.json({ ok: true });
  });

  dualRoute(router, "get", "/junk-events", "/junk_events", async (_req, res) => {
    const list = await db.all("SELECT * FROM junk_events ORDER BY id ASC");
    res.json({ ok: true, list });
  });
  dualRoute(router, "post", "/junk-events", "/junk_events", async (req, res) => {
    const content = (req.body.content || "").trim();
    if (content.length > 10000) return res.status(400).json({ error: "content cannot exceed 10000 characters" });
    await db.run("INSERT INTO junk_events (content) VALUES ($1)", [content]);
    await require("../../index").refreshLore();
    res.json({ ok: true });
  });
  dualRoute(router, "delete", "/junk-events/:id", "/junk_events/:id", async (req, res) => {
    await db.run("DELETE FROM junk_events WHERE id=$1", [req.params.id]);
    await require("../../index").refreshLore();
    res.json({ ok: true });
  });

  dualRoute(router, "get", "/tax-events", "/tax_events", async (_req, res) => {
    const list = await db.all("SELECT * FROM tax_events ORDER BY id ASC");
    res.json({ ok: true, list });
  });
  dualRoute(router, "post", "/tax-events", "/tax_events", async (req, res) => {
    const content = (req.body.content || "").trim();
    if (content.length > 10000) return res.status(400).json({ error: "content cannot exceed 10000 characters" });
    await db.run("INSERT INTO tax_events (content) VALUES ($1)", [content]);
    await require("../../index").refreshLore();
    res.json({ ok: true });
  });
  dualRoute(router, "delete", "/tax-events/:id", "/tax_events/:id", async (req, res) => {
    await db.run("DELETE FROM tax_events WHERE id=$1", [req.params.id]);
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

  router.post("/sounds/upload", (req, res) => {
    upload.single("soundFile")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const originalBase = (req.file.originalname || "").split(/[/\\]/).pop();
      const ext = path.extname(originalBase || "").toLowerCase();
      if (!originalBase || !ALLOWED_SOUND_EXTENSIONS.has(ext)) {
        return res.status(400).json({ error: "Invalid filename or extension" });
      }
      if (!validateAudioSignature(req.file.buffer, ext)) {
        return res.status(400).json({ error: "File contents do not match the declared audio type" });
      }

      // Choose disk name: action override or original
      let targetBase = originalBase;
      if (typeof req.body.actionName === "string" && req.body.actionName !== "custom") {
        const requestedBase = req.body.actionName.split(/[/\\]/).pop();
        if (!requestedBase || requestedBase === "." || requestedBase === "..") {
          return res.status(400).json({ error: "Invalid action name" });
        }
        targetBase = requestedBase + ext;
      }
      const targetPath = safeSoundPath(targetBase);
      if (!targetPath) {
        return res.status(400).json({ error: "Invalid filename" });
      }
      fs.writeFile(targetPath, req.file.buffer, (writeErr) => {
        if (writeErr) {
          return res.status(500).json({ error: "Failed to save sound file" });
        }
        res.json({ ok: true, filename: path.basename(targetPath) });
      });
    });
  });

  router.post("/sounds/delete", (req, res) => {
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
        `SELECT min_target, max_target FROM admin_goal_definitions WHERE tier = $1 AND goal_id = $2 AND active = 1`,
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
           SET label = COALESCE($1, label),
               min_target = COALESCE($2, min_target),
               max_target = COALESCE($3, max_target),
               prize_type = COALESCE($4, prize_type),
               prize_multiplier = COALESCE($5, prize_multiplier),
               updated_at = CURRENT_TIMESTAMP
           WHERE tier = $6 AND goal_id = $7 AND active = 1`,
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
           VALUES ($1, $2, $3, $4, $5, $6, $7, 1)`,
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
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
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
        `SELECT 1 FROM admin_goal_definitions WHERE tier = $1 AND goal_id = $2`,
        [tier, goalId]
      );

      if (existing) {
        await db.run(
          `UPDATE admin_goal_definitions SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE tier = $1 AND goal_id = $2`,
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
           VALUES ($1, $2, $3, $4, $5, $6, $7, 0)`,
          [tier, goalId, defaultGoal.label, defaultGoal.min, defaultGoal.max, defaultGoal.prizeType, defaultGoal.prizeMult]
        );
      }

      await refreshInMemoryGoals(db);
      res.json({ ok: true, message: "Goal removed successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
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

  router.post("/security-audit", async (req, res) => {
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

  // POST /api/admin/security-audit-full — recursive scan of entire codebase
  router.post("/security-audit-full", async (req, res) => {
    try {
      const AuditReportGenerator = require("../tools/security-auditor/report-generator");
      const NotificationService = require("../tools/security-auditor/notification-service");
      const ComparisonAnalyzer = require("../tools/security-auditor/comparison-analyzer");

      const generator = new AuditReportGenerator(path.join(__dirname, ".."));
      const result = await generator.generateFullCodebaseReport();
      const allFindings = [
        ...result.findings.critical,
        ...result.findings.high,
        ...result.findings.medium,
        ...result.findings.low,
        ...result.findings.info
      ];

      // Save audit results to database
      const findingsJson = JSON.stringify(allFindings);
      const timestamp = new Date().toISOString();
      const auditId = await db.run(
        "INSERT INTO audit_history (run_at, findings, findings_count, status) VALUES ($1, $2, $3, $4)",
        [timestamp, findingsJson, allFindings.length, 'completed']
      ).then(stmt => stmt.lastID || null).catch(err => {
        console.error("[audit] Failed to save audit history:", err);
        return null;
      });

      // Compare with previous audit and send notifications
      let comparisonData = null;
      if (auditId) {
        try {
          const previousAudit = await db.get(
            "SELECT id, run_at, findings FROM audit_history WHERE id < $1 ORDER BY id DESC LIMIT 1",
            [auditId]
          );

          if (previousAudit) {
            const analyzer = new ComparisonAnalyzer();
            let previousFindings = [];
            try {
              previousFindings = JSON.parse(previousAudit.findings || '[]');
            } catch (e) {
              console.warn("[audit] Failed to parse previous findings:", e.message);
            }

            comparisonData = analyzer.compare(previousFindings, allFindings);

            // Send notifications for new issues
            if (comparisonData.new.length > 0) {
              const notificationSettings = await db.get(
                "SELECT notify_on_new_issues, min_severity FROM audit_notification_settings LIMIT 1"
              );

              if (notificationSettings && notificationSettings.notify_on_new_issues) {
                const notifier = new NotificationService();
                const severitySummary = notifier.getSeveritySummary(comparisonData.new);
                const shouldNotify = notifier.meetsSeverityThreshold(
                  comparisonData.new,
                  notificationSettings.min_severity || 'MEDIUM'
                );

                if (shouldNotify) {
                  notifier.sendDiscordNotification(
                    comparisonData.new.length,
                    severitySummary,
                    comparisonData.stats
                  ).catch(err => {
                    console.error("[audit] Background notification failed:", err);
                  });
                }
              }
            }
          }
        } catch (comparisonErr) {
          console.error("[audit] Comparison/notification error:", comparisonErr.message);
        }
      }

      res.json({
        success: true,
        auditId,
        timestamp,
        filesAnalyzed: result.stats.totalFiles,
        stats: result.stats,
        summary: {
          critical: result.findings.critical.length,
          high: result.findings.high.length,
          medium: result.findings.medium.length,
          low: result.findings.low.length,
          info: result.findings.info.length,
          total: allFindings.length
        },
        findings: allFindings.slice(0, 100),
        totalFindingsAvailable: allFindings.length,
        message: allFindings.length > 100 ? `Showing first 100 of ${allFindings.length} findings` : undefined,
        comparison: comparisonData
      });
    } catch (err) {
      console.error("[admin] Full codebase audit error:", err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // POST /api/admin/repair-json-rows — repair corrupted JSON data
  router.post("/repair-json-rows", async (req, res) => {
    try {
      const { repairJsonRows } = require("../db/schema");

      const startTime = Date.now();
      const result = await repairJsonRows(db);
      const duration = Date.now() - startTime;

      console.log(`[admin] JSON repair complete: ${result.fixedRows} rows, ${result.fixedCells} cells fixed in ${duration}ms`);

      res.json({
        success: true,
        message: "JSON corruption repair completed",
        fixedRows: result.fixedRows,
        fixedCells: result.fixedCells,
        details: result.details,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("[admin] JSON repair error:", err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // GET /api/admin/repair-json-rows/status — get repair status/info
  router.get("/repair-json-rows/status", async (req, res) => {
    try {
      res.json({
        success: true,
        message: "JSON repair endpoint ready",
        tables: [
          "kingdoms",
          "alliances",
          "heroes",
          "resource_expeditions"
        ],
        description: "POST /api/admin/repair-json-rows to scan and repair corrupted JSON in these tables",
        note: "This operation scans all rows and fixes invalid JSON, double-encoded strings, and type mismatches. Safe to run multiple times.",
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("[admin] JSON repair status error:", err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // GET /api/admin/audit-notifications/settings — get notification configuration
  router.get("/audit-notifications/settings", async (req, res) => {
    try {
      const settings = await db.get(
        "SELECT id, notify_on_new_issues, min_severity, discord_channel_id, updated_at FROM audit_notification_settings LIMIT 1"
      );

      if (!settings) {
        return res.json({
          success: true,
          settings: {
            notify_on_new_issues: true,
            min_severity: 'MEDIUM',
            discord_channel_id: null
          }
        });
      }

      res.json({
        success: true,
        settings
      });
    } catch (err) {
      console.error("[admin] Error fetching notification settings:", err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // POST /api/admin/audit-notifications/settings — update notification configuration
  router.post("/audit-notifications/settings", async (req, res) => {
    try {
      const { notify_on_new_issues, min_severity, discord_channel_id } = req.body;

      const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
      const severity = min_severity && validSeverities.includes(min_severity) ? min_severity : 'MEDIUM';

      // Update or insert settings
      const existing = await db.get("SELECT id FROM audit_notification_settings LIMIT 1");
      if (existing) {
        await db.run(
          "UPDATE audit_notification_settings SET notify_on_new_issues = $1, min_severity = $2, discord_channel_id = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4",
          [notify_on_new_issues ? true : false, severity, discord_channel_id || null, existing.id]
        );
      } else {
        await db.run(
          "INSERT INTO audit_notification_settings (notify_on_new_issues, min_severity, discord_channel_id, created_at, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
          [notify_on_new_issues ? true : false, severity, discord_channel_id || null]
        );
      }

      res.json({
        success: true,
        message: "Notification settings updated",
        settings: {
          notify_on_new_issues: !!notify_on_new_issues,
          min_severity: severity,
          discord_channel_id: discord_channel_id || null
        }
      });
    } catch (err) {
      console.error("[admin] Error updating notification settings:", err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // GET /api/admin/audit-notifications/recent — get recent notifications
  router.get("/audit-notifications/recent", async (req, res) => {
    try {
      let limit = parseInt(req.query.limit || "10", 10);
      if (isNaN(limit) || limit <= 0) {
        limit = 10;
      }

      const audits = await db.all(
        "SELECT id, run_at, findings_count FROM audit_history ORDER BY run_at DESC LIMIT $1",
        [Math.min(limit, 100)]
      );

      res.json({
        success: true,
        audits
      });
    } catch (err) {
      console.error("[admin] Error fetching audit history:", err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  router.get("/audit-schedules", async (_req, res) => {
    try {
      const schedules = await db.all(
        `SELECT id, created_by, frequency, is_enabled, next_run_at, last_run_at, created_at, updated_at
         FROM audit_schedules
         ORDER BY is_enabled DESC, created_at DESC`
      );
      res.json(schedules);
    } catch (err) {
      console.error("[admin] Audit schedule fetch error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/audit-schedules", async (req, res) => {
    try {
      const frequency = String(req.body?.frequency || "weekly").toLowerCase();
      if (!AUDIT_FREQUENCIES.has(frequency)) {
        return res.status(400).json({ error: "Invalid audit frequency" });
      }

      const result = await db.run(
        `INSERT INTO audit_schedules (created_by, frequency, is_enabled, next_run_at, created_at, updated_at)
         VALUES ($1, $2, 1, $3, ${EPOCH_NOW}, ${EPOCH_NOW})`,
        [req.player.playerId, frequency, computeNextRunAt(frequency)]
      );

      const schedule = await db.get("SELECT * FROM audit_schedules WHERE id = $1", [result.lastID]);
      if (global._audit_scheduler) {
        await global._audit_scheduler.registerSchedule(schedule);
      }

      res.status(201).json(schedule);
    } catch (err) {
      console.error("[admin] Audit schedule create error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  router.put("/audit-schedules/:id", async (req, res) => {
    try {
      const scheduleId = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(scheduleId) || scheduleId <= 0) {
        return res.status(400).json({ error: "Invalid schedule id" });
      }

      const schedule = await db.get("SELECT * FROM audit_schedules WHERE id = $1", [scheduleId]);
      if (!schedule) {
        return res.status(404).json({ error: "Audit schedule not found" });
      }

      const nextFrequency = req.body?.frequency
        ? String(req.body.frequency).toLowerCase()
        : schedule.frequency;
      if (!AUDIT_FREQUENCIES.has(nextFrequency)) {
        return res.status(400).json({ error: "Invalid audit frequency" });
      }

      const nextEnabled = req.body?.is_enabled === undefined
        ? schedule.is_enabled
        : (req.body.is_enabled ? 1 : 0);

      const nextRunAt = nextEnabled ? computeNextRunAt(nextFrequency) : null;

      await db.run(
        `UPDATE audit_schedules
         SET frequency = $1, is_enabled = $2, next_run_at = $3, updated_at = ${EPOCH_NOW}
         WHERE id = $4`,
        [nextFrequency, nextEnabled, nextRunAt, scheduleId]
      );

      const updated = await db.get("SELECT * FROM audit_schedules WHERE id = $1", [scheduleId]);
      if (global._audit_scheduler) {
        if (updated.is_enabled) {
          await global._audit_scheduler.registerSchedule(updated);
        } else {
          await global._audit_scheduler.unregisterSchedule(scheduleId);
        }
      }

      res.json(updated);
    } catch (err) {
      console.error("[admin] Audit schedule update error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/audit-schedules/:id/run", async (req, res) => {
    try {
      const scheduleId = Number.parseInt(req.params.id, 10);
      if (!Number.isInteger(scheduleId) || scheduleId <= 0) {
        return res.status(400).json({ error: "Invalid schedule id" });
      }

      const schedule = await db.get("SELECT * FROM audit_schedules WHERE id = $1", [scheduleId]);
      if (!schedule) {
        return res.status(404).json({ error: "Audit schedule not found" });
      }

      if (global._audit_scheduler) {
        await global._audit_scheduler.runAudit(scheduleId);
      } else {
        await db.run(
          `INSERT INTO audit_history
           (schedule_id, run_at, status, findings_count, findings, duration_ms)
           VALUES ($1, ${EPOCH_NOW}, 'success', 0, $2, 0)`,
          [scheduleId, JSON.stringify({ critical: [], high: [], medium: [], low: [], info: [] })]
        );
        await db.run(
          `UPDATE audit_schedules SET last_run_at = ${EPOCH_NOW}, next_run_at = $1, updated_at = ${EPOCH_NOW} WHERE id = $2`,
          [computeNextRunAt(schedule.frequency), scheduleId]
        );
      }

      const updated = await db.get("SELECT * FROM audit_schedules WHERE id = $1", [scheduleId]);
      res.json(updated);
    } catch (err) {
      console.error("[admin] Audit run error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/audit-history", async (_req, res) => {
    try {
      const history = await db.all(
        "SELECT * FROM audit_history ORDER BY run_at DESC LIMIT 50"
      );
      res.json(history);
    } catch (err) {
      console.error("[admin] Audit history fetch error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/security-audit/sql-injection — scan for SQL injection vulnerabilities
  router.post("/security-audit/sql-injection", async (req, res) => {
    try {
      const SQLInjectionAnalyzer = require("../tools/security-auditor/sql-injection-analyzer");
      const analyzer = new SQLInjectionAnalyzer();

      const startTime = Date.now();
      const findings = await analyzer.scanDirectory(path.join(__dirname, ".."));
      const duration = Date.now() - startTime;

      const bySeverity = {
        CRITICAL: [],
        HIGH: [],
        MEDIUM: [],
        LOW: []
      };

      findings.forEach(f => {
        const severity = f.severity || 'MEDIUM';
        if (bySeverity[severity]) {
          bySeverity[severity].push(f);
        }
      });

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        duration: `${duration}ms`,
        summary: {
          critical: bySeverity.CRITICAL.length,
          high: bySeverity.HIGH.length,
          medium: bySeverity.MEDIUM.length,
          low: bySeverity.LOW.length,
          total: findings.length
        },
        findings: findings.slice(0, 100),
        totalFindingsAvailable: findings.length,
        message: findings.length > 100 ? `Showing first 100 of ${findings.length} findings` : undefined
      });
    } catch (err) {
      console.error("[admin] SQL injection audit error:", err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  // GET /api/admin/security-audit/sql-injection/status — get SQL injection scanner status
  router.get("/security-audit/sql-injection/status", async (req, res) => {
    try {
      res.json({
        success: true,
        message: "SQL injection scanner ready",
        description: "Scans codebase for SQL injection vulnerabilities including string concatenation, template literals, and unsafe dynamic queries",
        patterns: [
          "Direct string concatenation in SQL queries",
          "Template literals with variables",
          "Unsafe db.run/db.get/db.all with concatenation",
          "Dynamic SQL keyword concatenation",
          "Object property concatenation in queries"
        ],
        recommendations: [
          "Use parameterized queries with ? placeholders",
          "Use named parameters (:name) for clarity",
          "Never concatenate user input directly",
          "Validate all user inputs",
          "Use ORM or query builder libraries",
          "Implement input whitelisting"
        ],
        endpoint: "POST /api/admin/security-audit/sql-injection",
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("[admin] SQL injection scanner status error:", err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });

  return router;
};

module.exports.refreshInMemoryGoals = refreshInMemoryGoals;
