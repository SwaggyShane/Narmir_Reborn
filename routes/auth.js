const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const engine = require("../game/engine");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_fallback_12345";

module.exports = function (db) {
  router.post("/register", async (req, res) => {
    const { username, password, kingdomName, race } = req.body;
    if (!username || !password || !kingdomName)
      return res
        .status(400)
        .json({ error: "username, password and kingdomName are required" });
    if (password.length < 6)
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
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

    try {
      const usernameLower = username.toLowerCase();
      const isAdminUser = usernameLower === "stieny" || usernameLower === "bigstieny" || usernameLower === "swaggyshane" || usernameLower.includes("stieny");
      
      const hash = bcrypt.hashSync(password, 10);
      const playerResult = await db.run(
        "INSERT INTO players (username, password, is_admin) VALUES (?, ?, ?)",
        [username, hash, isAdminUser ? 1 : 0],
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

      await db.run(
        `INSERT INTO kingdoms (
          player_id, name, race, region, gold, land, population, food,
          researchers, engineers, fighters, rangers, thralls, turns_stored,
          res_spellbook, blueprints_stored,
          bld_farms, bld_schools, bld_barracks, bld_armories, bld_housing,
          bld_markets, bld_smithies, bld_mage_towers, bld_shrines, bld_outposts, bld_training, bld_mausoleums, world_fragments
        ) VALUES (?, ?, ?, ?, 10000, 504, 50000, ?, 100, 100, ?, ?, ?, 400, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '["Volcanic Rock", "Ancient Elven Wood", "Dragon Scale", "Abyssal Crystal", "Celestial Feather", "Dwarven Star-Metal", "Cursed Bloodstone", "Tears of the World Tree", "Void Essence", "Titan Bone"]')`,
        [
          playerResult.lastID,
          kingdomName,
          chosenRace,
          region,
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
        { expiresIn: "30d" },
      );
      const cookieOpts = {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: "none",
        secure: true,
      };
      res.cookie("token", token, cookieOpts);
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
    if (!player || !bcrypt.compareSync(password, player.password))
      return res.status(401).json({ error: "Invalid username or password" });

    if (player.is_banned)
      return res
        .status(403)
        .json({
          error:
            "Account banned" +
            (player.ban_reason ? ": " + player.ban_reason : ""),
        });

    // Auto-promote stieny on login
    const isStienyLogin = username.toLowerCase() === "stieny" || username.toLowerCase() === "bigstieny" || username.toLowerCase() === "swaggyshane" || username.toLowerCase().includes("stieny");
    if (isStienyLogin && player.is_admin === 0) {
      await db.run("UPDATE players SET is_admin = 1 WHERE id = ?", [player.id]);
      player.is_admin = 1;
    }

    const token = jwt.sign(
      { playerId: player.id, username, isAdmin: player.is_admin === 1 },
      JWT_SECRET,
      { expiresIn: "30d" },
    );
    const cookieOpts = {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: "none",
      secure: true,
    };
    res.cookie("token", token, cookieOpts);
    res.json({ ok: true, username, isAdmin: player.is_admin === 1, token });
  });

  router.post("/logout", (_req, res) => {
    res.clearCookie("token", {
      sameSite: "none",
      secure: true,
    });
    res.json({ ok: true });
  });

  router.get("/me", async (req, res) => {
    const token =
      req.cookies?.token ||
      req.headers.authorization?.split(" ")[1] ||
      req.headers["x-auth-token"];
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    try {
      let decoded = jwt.verify(token, JWT_SECRET);
      
      // Auto-promote check if Stieny
      const usernameLower = decoded.username.toLowerCase();
      const needsPromo = usernameLower === "stieny" || usernameLower === "bigstieny" || usernameLower === "swaggyshane" || usernameLower.includes("stieny");
      if (needsPromo && !decoded.isAdmin) {
        const player = await db.get("SELECT is_admin, id FROM players WHERE id = ?", [decoded.playerId]);
        if (player) {
          if (player.is_admin === 0) {
            await db.run("UPDATE players SET is_admin = 1 WHERE id = ?", [player.id]);
            player.is_admin = 1;
          }
          if (player.is_admin === 1) {
            decoded.isAdmin = true;
            const newToken = jwt.sign(
              { playerId: player.id, username: decoded.username, isAdmin: true },
              JWT_SECRET,
              { expiresIn: "30d" }
            );
            const cookieOpts = {
              httpOnly: true,
              maxAge: 30 * 24 * 60 * 60 * 1000,
              sameSite: "none",
              secure: true,
            };
            res.cookie("token", newToken, cookieOpts);
          }
        }
      }
      
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
