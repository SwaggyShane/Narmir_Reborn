const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const engine = require("../game/engine");
const { generateCsrfToken, requireAuth } = require("./middleware");

const router = express.Router();

if (!process.env.JWT_SECRET) {
  throw new Error("CRITICAL: JWT_SECRET environment variable is required. Set it before starting the server.");
}
const JWT_SECRET = process.env.JWT_SECRET;

const BCRYPT_SALT_ROUNDS = 10;
const JWT_EXPIRY = "30d";
const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const isProd = process.env.NODE_ENV === 'production';

module.exports = function (db) {
  router.post("/register", async (req, res) => {
    const { username, password, kingdomName, race, email, gender } = req.body;
    if (!username || !password || !kingdomName || !email)
      return res
        .status(400)
        .json({ error: "username, password, kingdomName, and email are required" });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return res
        .status(400)
        .json({ error: "Please provide a valid email address" });
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password))
      return res
        .status(400)
        .json({
          error:
            "Password must be at least 8 characters and contain uppercase, lowercase, number, and special character (@$!%*?&)",
        });
    if (username.length < 3 || username.length > 20)
      return res
        .status(400)
        .json({ error: "Username must be 3–20 characters" });
    if (!/^[a-zA-Z0-9_]+$/.test(username))
      return res
        .status(400)
        .json({
          error: "Username can only contain letters, numbers and underscores",
        });

    const validRaces = [
      "human",
      "high_elf",
      "dwarf",
      "dire_wolf",
      "dark_elf",
      "orc",
      "vampire",
    ];
    const chosenRace = validRaces.includes(race) ? race : "human";
    const validGenders = ["male", "female"];
    const normalizedGender = typeof gender === 'string' ? gender.toLowerCase() : 'male';
    const chosenGender = validGenders.includes(normalizedGender) ? normalizedGender : "male";

    try {
      const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      const isAdminUser = false;
      const playerResult = await db.run(
        "INSERT INTO players (username, password, email, is_admin) VALUES (?, ?, ?, ?)",
        [username, hash, email, 0],
      );
      const region = engine.assignRegion(chosenRace);

      // Starting buildings based on race
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
      let fighters = 0,
        rangers = 50,
        food = 5000;

      if (chosenRace === "human") buildings.bld_markets = 1;
      if (chosenRace === "dwarf") buildings.bld_smithies = 1;
      if (chosenRace === "high_elf") buildings.bld_mage_towers = 1;
      if (chosenRace === "dark_elf") buildings.bld_shrines = 1;
      if (chosenRace === "orc") buildings.bld_training = 1;
      if (chosenRace === "vampire") {
        buildings.bld_mausoleums = 1;
        buildings.bld_farms = 10;
        buildings.bld_housing = 50;
      }
      if (chosenRace === "dire_wolf") {
        buildings.bld_barracks = 2; // Extra barracks for wolf
        fighters = 100;
        rangers = 100;
      }

      // Calculate starting land: building costs + 1000 buffer
      // Use engine's BUILDING_LAND_COST to stay in sync with game balance
      let startingLand = 1000; // Base buffer
      const buildingKeys = {
        bld_farms: 'farms',
        bld_schools: 'schools',
        bld_barracks: 'barracks',
        bld_armories: 'armories',
        bld_housing: 'housing',
        bld_markets: 'markets',
        bld_smithies: 'smithies',
        bld_mage_towers: 'mage_towers',
        bld_shrines: 'shrines',
        bld_training: 'training',
        bld_mausoleums: 'mausoleums'
      };
      for (const [dbCol, configKey] of Object.entries(buildingKeys)) {
        const count = buildings[dbCol] || 0;
        const cost = engine.BUILDING_LAND_COST[configKey] || 0;
        startingLand += count * cost;
      }

      await db.run(
        `INSERT INTO kingdoms (
          player_id, name, race, gender, region, gold, land, population, food,
          researchers, engineers, fighters, rangers, thralls, turns_stored,
          res_spellbook, blueprints_stored,
          bld_farms, bld_schools, bld_barracks, bld_armories, bld_housing,
          bld_markets, bld_smithies, bld_mage_towers, bld_shrines, bld_outposts, bld_training, bld_mausoleums, world_fragments
        ) VALUES (?, ?, ?, ?, ?, 10000, ?, 50000, ?, 100, 100, ?, ?, ?, 400, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '["Volcanic Rock", "Ancient Elven Wood", "Dragon Scale", "Abyssal Crystal", "Celestial Feather", "Dwarven Star-Metal", "Cursed Bloodstone", "Tears of the World Tree", "Void Essence", "Titan Bone"]')`,
        [
          playerResult.lastID,
          kingdomName,
          chosenRace,
          chosenGender,
          region,
          startingLand,
          food,
          fighters,
          rangers,
          chosenRace === "vampire" ? 50 : 0,
          buildings.bld_farms,
          buildings.bld_schools,
          buildings.bld_barracks,
          buildings.bld_armories,
          buildings.bld_housing,
          buildings.bld_markets,
          buildings.bld_smithies,
          buildings.bld_mage_towers,
          buildings.bld_shrines,
          buildings.bld_outposts,
          buildings.bld_training,
          buildings.bld_mausoleums || 0,
        ],
      );
      const token = jwt.sign(
        { playerId: playerResult.lastID, username, isAdmin: isAdminUser },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY },
      );
      const cookieOpts = {
        httpOnly: true,
        path: "/",
        maxAge: COOKIE_MAX_AGE_MS,
        sameSite: isProd ? "none" : "lax",
        secure: isProd,
      };
      const csrfToken = generateCsrfToken();
      const csrfCookieOpts = {
        httpOnly: false,
        path: "/",
        maxAge: COOKIE_MAX_AGE_MS,
        sameSite: isProd ? "none" : "lax",
        secure: isProd,
      };
      res.cookie("token", token, cookieOpts);
      res.cookie("csrf_token", csrfToken, csrfCookieOpts);
      res.json({ ok: true, username, kingdomName, token });
    } catch (err) {
      if (err.message.includes("UNIQUE"))
        return res.status(409).json({ error: "Username already taken" });
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: "username and password required" });

    const player = await db.get("SELECT * FROM players WHERE username = ?", [
      username,
    ]);
    if (!player) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    try {
      const passwordMatch = await bcrypt.compare(password, player.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: "Invalid username or password" });
      }
    } catch (err) {
      console.error("[auth] Password comparison error:", err.message);
      return res.status(500).json({ error: "Authentication failed" });
    }

    if (player.is_banned)
      return res
        .status(403)
        .json({
          error:
            "Account banned" +
            (player.ban_reason ? ": " + player.ban_reason : ""),
        });

    const token = jwt.sign(
      { playerId: player.id, username, isAdmin: player.is_admin === 1 },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY },
    );
    const cookieOpts = {
      httpOnly: true,
      path: "/",
      maxAge: COOKIE_MAX_AGE_MS,
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
    };
    const csrfToken = generateCsrfToken();
    const csrfCookieOpts = {
      httpOnly: false,
      path: "/",
      maxAge: COOKIE_MAX_AGE_MS,
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
    };
    res.cookie("token", token, cookieOpts);
    res.cookie("csrf_token", csrfToken, csrfCookieOpts);
    res.json({ ok: true, username, isAdmin: player.is_admin === 1, token });
  });

  router.post("/logout", (_req, res) => {
    res.clearCookie("token", {
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
      path: "/",
    });
    res.clearCookie("csrf_token", {
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
      path: "/",
    });
    res.json({ ok: true });
  });

  router.post("/force-logout", (_req, res) => {
    const clearOptions = [
      { path: "/", httpOnly: true, sameSite: "none", secure: true },
      { path: "/", httpOnly: true, sameSite: "lax", secure: false },
      { path: "/", httpOnly: true },
      { path: "/" },
      {},
    ];
    clearOptions.forEach(opts => {
      res.clearCookie("token", opts);
      res.clearCookie("csrf_token", opts);
    });
    res.json({ ok: true, forced: true });
  });

  router.get("/me", async (req, res) => {
    const token =
      req.cookies?.token ||
      req.headers.authorization?.split(" ")[1] ||
      req.headers["x-auth-token"];
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    try {
      let decoded = jwt.verify(token, JWT_SECRET);

      res.json({
        playerId: decoded.playerId,
        username: decoded.username,
        isAdmin: decoded.isAdmin || false,
      });
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
    }
  });

  return router;
};
