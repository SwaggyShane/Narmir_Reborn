const express = require("express");
const { requireAuth, requireCsrfToken } = require("./middleware");
const engine = require("../game/engine");

module.exports = function (db) {
  const router = express.Router();

  // List all heroes owned by the kingdom
  router.get("/list", requireAuth, async (req, res) => {
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    const heroes = await db.all("SELECT * FROM heroes WHERE kingdom_id = ?", [
      k.id,
    ]);
    res.json(heroes);
  });

  // Get hero classes and stats
  router.get("/classes", requireAuth, async (req, res) => {
    const k = await db.get(
      "SELECT id, race FROM kingdoms WHERE player_id = ?",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    // Fetch existing heroes to filter them out of the selection pool
    const existing = await db.all(
      "SELECT class FROM heroes WHERE kingdom_id = ?",
      [k.id],
    );
    const ownedClasses = existing.map((h) => h.class);

    const allowed = {};
    for (const [id, cls] of Object.entries(engine.HERO_CLASSES)) {
      if (
        (!cls.races || cls.races.includes(k.race)) &&
        !ownedClasses.includes(id)
      ) {
        allowed[id] = cls;
      }
    }
    res.json(allowed);
  });

  // Get ALL hero classes for lore documentation
  router.get("/all-classes", async (req, res) => {
    res.json(engine.HERO_CLASSES);
  });

  // Recruit a new hero
  router.post("/recruit", requireAuth, requireCsrfToken, async (req, res) => {
    const { name, heroClass } = req.body;
    if (!name || !heroClass)
      return res.status(400).json({ error: "Name and class required" });

    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    // Check current hero count
    const existing = await db.all(
      "SELECT class FROM heroes WHERE kingdom_id = ?",
      [k.id],
    );
    const existingClasses = existing.map((h) => h.class);

    // 1st hero: 1 castle, 2nd: 5 castles, 3rd: 10 castles
    const castles = k.bld_castles || 0;
    let maxHeroes = 0;
    if (castles >= 10) maxHeroes = 3;
    else if (castles >= 5) maxHeroes = 2;
    else if (castles >= 1) maxHeroes = 1;

    if (existing.length >= maxHeroes) {
      if (maxHeroes === 0)
        return res
          .status(400)
          .json({ error: "Requires a Castle to house a Hero" });
      const nextReq = maxHeroes === 1 ? "5" : "10";
      return res
        .status(400)
        .json({
          error: `You have reached your limit of ${maxHeroes} heroes. Build ${nextReq} Castles to unlock another slot (max 3).`,
        });
    }

    if (existingClasses.includes(heroClass)) {
      return res
        .status(400)
        .json({
          error: `You already have a ${heroClass} in your kingdom. Each hero must be a unique class.`,
        });
    }

    const { hero, cost, error } = engine.recruitHero(k, name, heroClass);
    if (error) return res.status(400).json({ error });

    try {
      const result = await db.run(
        `INSERT INTO heroes (kingdom_id, name, class, level, xp, abilities, status, hp, max_hp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          k.id,
          hero.name,
          hero.class,
          hero.level,
          hero.xp,
          hero.abilities,
          hero.status,
          hero.hp,
          hero.max_hp,
        ],
      );

      await db.run(
        "UPDATE kingdoms SET gold = gold - ?, mana = mana - ? WHERE id = ?",
        [cost.gold, cost.mana, k.id],
      );

      await db.run(
        "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?, ?, ?, ?)",
        [
          k.id,
          "system",
          `✨ ${hero.name} the ${heroClass} has joined your cause!`,
          k.turn,
        ],
      );

      res.json({ ok: true, heroId: result.lastID });
    } catch (err) {
      console.error("[recruit] error:", err.message);
      res.status(500).json({ error: "Recruitment failed" });
    }
  });

  return router;
};
