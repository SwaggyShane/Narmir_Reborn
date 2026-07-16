const express = require("express");
const { requireAuth, requireCsrfToken } = require("./middleware");
const commandHandler = require("../game/command-handler");

module.exports = function (db) {
  const router = express.Router();

  // List all heroes owned by the kingdom
  router.get("/list", requireAuth, async (req, res) => {
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = $1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    const heroes = await db.all("SELECT * FROM heroes WHERE kingdom_id = $1", [
      k.id,
    ]);
    res.json(heroes);
  });

  // Get hero classes and stats
  router.get("/classes", requireAuth, async (req, res) => {
    const k = await db.get(
      "SELECT id, race FROM kingdoms WHERE player_id = $1",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    // Fetch existing heroes to filter them out of the selection pool
    const existing = await db.all(
      "SELECT class FROM heroes WHERE kingdom_id = $1",
      [k.id],
    );
    const ownedClasses = existing.map((h) => h.class);

    const allowed = {};
    for (const [id, cls] of Object.entries(commandHandler.getConstants().HERO_CLASSES || {})) {
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
    res.json(commandHandler.getConstants().HERO_CLASSES || {});
  });

  // Recruit a new hero
  router.post("/recruit", requireAuth, requireCsrfToken, async (req, res) => {
    const { name, heroClass } = req.body;
    if (!name || !heroClass)
      return res.status(400).json({ error: "Name and class required" });

    try {
      const { heroId } = await db.withTransaction(async () => {
        const k = await db.get("SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE", [
          req.player.playerId,
        ]);
        if (!k) {
          const err = new Error("Kingdom not found");
          err.statusCode = 404;
          throw err;
        }

        const existing = await db.all(
          "SELECT class FROM heroes WHERE kingdom_id = $1 FOR UPDATE",
          [k.id],
        );
        const existingClasses = existing.map((h) => h.class);

        const castles = k.bld_castles || 0;
        let maxHeroes = 0;
        if (castles >= 10) maxHeroes = 3;
        else if (castles >= 5) maxHeroes = 2;
        else if (castles >= 1) maxHeroes = 1;

        if (existing.length >= maxHeroes) {
          const err = new Error(
            maxHeroes === 0
              ? "Requires a Castle to house a Hero"
              : `You have reached your limit of ${maxHeroes} heroes. Build ${maxHeroes === 1 ? "5" : "10"} Castles to unlock another slot (max 3).`
          );
          err.statusCode = 400;
          throw err;
        }

        if (existingClasses.includes(heroClass)) {
          const err = new Error(`You already have a ${heroClass} in your kingdom. Each hero must be a unique class.`);
          err.statusCode = 400;
          throw err;
        }

        const { hero, cost, error } = await commandHandler.handle(
          { type: 'recruit-hero', name, heroClass },
          { kingdom: k },
        );
        if (error) {
          const err = new Error(error);
          err.statusCode = 400;
          throw err;
        }

        const result = await db.run(
          `INSERT INTO heroes (kingdom_id, name, class, level, xp, abilities, status, hp, max_hp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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
          "UPDATE kingdoms SET gold = gold - $1, mana = mana - $2 WHERE id = $3",
          [cost.gold, cost.mana, k.id],
        );

        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1, $2, $3, $4)",
          [
            k.id,
            "system",
            `✨ ${hero.name} the ${heroClass} has joined your cause!`,
            k.turn,
          ],
        );

        return { heroId: result.lastID };
      });

      res.json({ ok: true, heroId });
    } catch (err) {
      console.error("[recruit] error:", err.message);
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({ error: err.message });
    }
  });

  return router;
};
