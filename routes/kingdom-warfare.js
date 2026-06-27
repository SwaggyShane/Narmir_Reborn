const express = require("express");
const engine = require("../game/engine");
const { requireAuth, requireCsrfToken } = require("./middleware");
const { progressGoal } = require('../game/goals');
const { safeJsonParse } = require('../utils/helpers');
const { applyKingdomUpdates } = require('../db/schema');

const router = express.Router();

// â"€â"€ Transaction support â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

// â"€â"€ Column Selection Constants â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
const KINGDOM_CORE = 'id, player_id, name, race, turn, turns_stored, gold, food, population, land, happiness';
const KINGDOM_COVERT = `${KINGDOM_CORE}, thieves, ninjas, troop_levels,
  bld_guard_towers, bld_walls, bld_mage_towers, bld_libraries, bld_armories, bld_vaults, bld_mausoleums,
  level, prestige_level, milestone_bonuses, bank_upgrades, trade_routes, thralls, mausoleum_upgrades,
  discovered_kingdoms`;

module.exports = function (db) {
  // â"€â"€ War log endpoints â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

  // â"€â"€ Military attack â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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
      return res.status(400).json({ error: "Not enough available ðŸªœ ladders" });

    if (k.turn < 400)
      return res.status(400).json({
        error: `You are under newbie protection until Turn 400. You cannot attack yet.`,
      });
    if ((target.turn || 0) < 400)
      return res.status(400).json({
        error: `${target.name} is under newbie protection until Turn 400`,
      });

    // Location system â€" must have mapped this kingdom
    let atkDisc = {};
    try {
      atkDisc = safeJsonParse(k.discovered_kingdoms, {}, "auto:discovered_kingdoms");
    } catch {}
    if (!atkDisc[targetId] || !atkDisc[targetId].mapped) {
      return res
        .status(400)
        .json({ error: "You need a location map for this target." });
    }

    // Fetch heroes
    const attackerHeroes = await db.all(
      "SELECT * FROM heroes WHERE kingdom_id = ? AND status = ?",
      [k.id, "idle"],
    );
    const defenderHeroes = await db.all(
      "SELECT * FROM heroes WHERE kingdom_id = ? AND status = ?",
      [target.id, "idle"],
    );

    // Location system â€" must have mapped this kingdom (warn but don't block during transition)
    try {
      safeJsonParse(k.discovered_kingdoms, {}, "auto:discovered_kingdoms");
    } catch {}
    // Defender auto-stores attacker's location on being attacked
    let defDisc = {};
    try {
      defDisc = safeJsonParse(target.discovered_kingdoms, {}, "auto:discovered_kingdoms");
    } catch {}
    if (!defDisc[k.id]?.mapped) {
      defDisc[k.id] = { found: true, mapped: true };
      await db.run("UPDATE kingdoms SET discovered_kingdoms=? WHERE id=?", [
        JSON.stringify(defDisc),
        target.id,
      ]);
    }

    const result = engine.resolveMilitaryAttack(
      k,
      target,
      sentUnits,
      attackerHeroes,
      defenderHeroes,
    );
    if (result.error) return res.status(400).json({ error: result.error });

    // Update heroes in DB (batch updates)
    const heroUpdates = [];
    for (const h of attackerHeroes) {
      const resHero = engine.awardHeroXp(h, result.win ? 500 : 100);
      heroUpdates.push([resHero.xp, resHero.level, h.id]);
    }
    for (const h of defenderHeroes) {
      const resHero = engine.awardHeroXp(h, result.win ? 100 : 500);
      heroUpdates.push([resHero.xp, resHero.level, h.id]);
    }

    if (heroUpdates.length > 0) {
      const heroIds = heroUpdates.map(u => u[2]);
      const xps = heroUpdates.map(u => u[0]);
      const levels = heroUpdates.map(u => u[1]);
      const placeholders = heroIds.map((_, i) => `$${i + 1}`).join(',');

      await db.run(
        `UPDATE heroes SET xp = CAST(CASE id ${heroIds.map((id, i) => `WHEN $${i + 1} THEN $${heroIds.length + i + 1}`).join(' ')} END AS real),
         level = CAST(CASE id ${heroIds.map((id, i) => `WHEN $${i + 1} THEN $${heroIds.length * 2 + i + 1}`).join(' ')} END AS integer)
         WHERE id IN (${placeholders})`,
        [...heroIds, ...xps, ...levels]
      );
    }

    progressGoal(k, result.attackerUpdates, 'attack_made', 1);

    await withTransaction(db, async () => {
      await applyKingdomUpdates(k.id, result.attackerUpdates);
      await applyKingdomUpdates(target.id, result.defenderUpdates);
      await db.run(
        "UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = ?",
        [k.id],
      );

    // Bounty claiming
    if (result.win) {
      const activeBounties = await db.all(
        "SELECT * FROM bounties WHERE target_id = ? AND status = ?",
        [target.id, "active"],
      );
      if (activeBounties.length > 0) {
        let totalClaimed = 0;
        const bountyIds = [];
        for (const b of activeBounties) {
          totalClaimed += b.amount;
          bountyIds.push(b.id);
        }

        // Batch update all bounties in single query
        if (bountyIds.length > 0) {
          const placeholders = bountyIds.map((_, i) => `$${i + 3}`).join(',');
          await db.run(
            `UPDATE bounties SET status = $1, claimed_by_id = $2 WHERE id IN (${placeholders})`,
            ["claimed", k.id, ...bountyIds],
          );
        }

        if (totalClaimed > 0) {
          await db.run("UPDATE kingdoms SET gold = gold + ? WHERE id = ?", [
            totalClaimed,
            k.id,
          ]);
          result.atkEvent += ` ðŸ'° BOUNTY CLAIMED! You collected ${totalClaimed.toLocaleString()} gold in bounties placed on ${target.name}.`;
          await db.run(
            "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
            [
              k.id,
              "system",
              `ðŸ'° You claimed ${totalClaimed.toLocaleString()} gold in bounties by defeating ${target.name}!`,
              k.turn,
            ],
          );
        }
      }
    }

    // 4% chance to find a map on a corpse if victory
    if (result.win && Math.random() < 0.04) {
      await db.run("UPDATE kingdoms SET maps = maps + 1 WHERE id = ?", [k.id]);
      result.atkEvent += ` ðŸ—ºï¸ In the aftermath, your troops scavenged a map from a fallen scout's corpse.`;
    }

    // War log
    const detail = JSON.stringify({
      sent: result.report.sent,
      landTaken: result.report.landTransferred,
      atkLost: result.report.atkFightersLost,
      defLost: result.report.defFightersLost,
      ninjaKills: result.report.ninjaKills || 0,
      rangerKills: result.report.rangerKills || 0,
      flankKills: result.report.flankKills || 0,
      buildingsDestroyed: result.report.defBldLost || 0,
      steps: result.report.steps || [],
      ...result.report,
    });
    const logRes = await db.run(
      `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES (?,?,?,?,?,?,?,0)`,
      [
        "attack",
        k.id,
        k.name,
        target.id,
        target.name,
        result.win ? "victory" : "repelled",
        detail,
      ],
    );
    const reportId = logRes.lastID;

    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)",
      [k.id, "attack", result.atkEvent, k.turn, reportId],
    );
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)",
      [target.id, "attack", result.defEvent, target.turn, reportId],
    );

    // Signal tower â€" warn defender (and alliance) of attack
    let defTowerUpgrades = {};
    try {
      defTowerUpgrades = safeJsonParse(target.tower_def_upgrades, {}, "auto:tower_def_upgrades");
    } catch {}
    if (defTowerUpgrades.watchtower || defTowerUpgrades.signal_tower) {
      await db.run(
        "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
        [
          target.id,
          "system",
          `⚠️ Watchtower scouts have detected ${k.name} massing troops at the border.`,
          target.turn,
        ],
      );
      if (defTowerUpgrades.signal_tower) {
        // Warn all alliance members
        const allianceMembers = await db.all(
          `
          SELECT am.kingdom_id FROM alliance_members am
          JOIN alliance_members am2 ON am.alliance_id = am2.alliance_id
          WHERE am2.kingdom_id = ? AND am.kingdom_id != ?`,
          [target.id, target.id],
        );
        if (allianceMembers.length > 0) {
          const placeholders = allianceMembers.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(',');
          const params = [];
          const message = `📡 Signal Tower: Your ally ${target.name} is under attack by ${k.name}!`;
          for (const mem of allianceMembers) {
            params.push(mem.kingdom_id, "system", message, k.turn);
          }
          await db.run(
            `INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ${placeholders}`,
            params
          );
        }
      }
    }

    // Warmachine damage report
    if (result.win) {
      if (result.report.wallsDestroyed > 0) {
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
          [
            target.id,
            "attack",
            `ðŸ§± ${result.report.wallsDestroyed} walls were destroyed in the bombardment.`,
            target.turn,
          ],
        );
      } else if (result.report.buildingDamaged) {
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
          [
            target.id,
            "attack",
            `ðŸ"¥ Attackers burned ${result.report.buildingDamaged} with no walls to stop them.`,
            target.turn,
          ],
        );
      }
    }

    });

    const freshK = await db.get("SELECT maps FROM kingdoms WHERE id = ?", [
      k.id,
    ]);
    res.json({
      ok: true,
      report: result.report,
      updates: { ...result.attackerUpdates, maps: freshK.maps },
      event: result.atkEvent,
    });
  });

  // â"€â"€ Cast spell â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  router.post("/spell", requireAuth, requireCsrfToken, async (req, res) => {
    const { spellId, targetId, obscure } = req.body;
    if (!spellId) return res.status(400).json({ error: "spellId required" });

    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.turns_stored < 1)
      return res.status(429).json({ error: "No turns available" });

    const isFriendlySpell = engine.SPELL_DEFS[spellId]?.effect === "friendly";
    let target = null;
    if (targetId && targetId != k.id) {
      target = await db.get(
        "SELECT k.* FROM kingdoms k JOIN players p ON k.player_id = p.id WHERE k.id = ?",
        [targetId],
      );
      if (!target) return res.status(404).json({ error: "Target kingdom not found" });
    } else if (isFriendlySpell) {
      target = k;
    } else {
      return res.status(400).json({ error: "targetId required for offensive spells" });
    }

    const validation = engine.validateSpellTarget(k, target, spellId);
    if (validation.error) return res.status(400).json({ error: validation.error });

    const result = engine.castSpell(k, validation.target, spellId, !!obscure);
    if (result.error) return res.status(400).json({ error: result.error });

    progressGoal(k, result.casterUpdates, 'spell_cast', 1);

    await withTransaction(db, async () => {
      await applyKingdomUpdates(k.id, result.casterUpdates);
      await applyKingdomUpdates(validation.target.id, result.targetUpdates);

      await db.run(
        "UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = ?",
        [k.id],
      );

    // War log for offensive spells or friendly spells on others
      if (!validation.isFriendly || k.id !== validation.target.id) {
      const logRes = await db.run(
        `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured)
        VALUES (?,?,?,?,?,?,?,?)`,
        [
            validation.isFriendly ? "blessing" : "spell",
          k.id,
          k.name,
            validation.target.id,
            validation.target.name,
          "cast",
          `${spellId.replace(/_/g, " ")} - ${result.report.damageDesc || ""}`,
          obscure ? 1 : 0,
        ],
      );
      const reportId = logRes.lastID;

      if (result.casterEvent) {
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)",
          [k.id, "system", result.casterEvent, k.turn, reportId],
        );
      }
        if (result.targetEvent) {
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)",
          [
              validation.target.id,
              validation.isFriendly ? "system" : "attack",
            result.targetEvent,
              validation.target.turn || 0,
            reportId,
          ],
        );
      }
      } else {
      // Self cast news only
      if (result.casterEvent) {
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
          [k.id, "system", result.casterEvent, k.turn],
        );
      }
    }

    // Consume map on cast (map is used up like a compass â€" one per interaction)
    // Map consumption for spells disabled - rely on location maps
    // if (!isFriendly) {}

    });

    const freshK = await db.get(
      "SELECT mana, scrolls, maps, active_effects FROM kingdoms WHERE id = ?",
      [k.id],
    );
    res.json({
      ok: true,
      report: result.report,
      updates: {
        mana: freshK.mana,
        scrolls: safeJsonParse(freshK.scrolls, {}, "auto:scrolls"),
        maps: freshK.maps,
        active_effects: safeJsonParse(freshK.active_effects, {}, "auto:active_effects"),
        ...result.casterUpdates,
      },
    });

    // Notify target via socket if online
    if (global._narmir_io && k.id !== validation.target.id) {
      const eventName = validation.isFriendly ? "event:blessing_received" : "event:spell_received";
      global._narmir_io.to(`kingdom:${validation.target.id}`).emit(eventName, {
        from: obscure ? null : k.name,
        spellId: spellId,
        message: result.targetEvent,
      });
      // Also notify unreads
      const uCount = await db.get("SELECT COUNT(*) as c FROM news WHERE kingdom_id = ? AND is_read = 0", [validation.target.id]);
      global._narmir_io.to(`kingdom:${validation.target.id}`).emit("unread_news", { count: uCount ? uCount.c : 0 });
    }
  });

  // â"€â"€ Covert operations â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  router.post("/covert", requireAuth, requireCsrfToken, async (req, res) => {
    const { op, targetId, units, lootType, unitType, bldType } = req.body;

    try {
      // Begin transaction first - all locking happens inside
      await db.run("BEGIN TRANSACTION");
        // Lock kingdoms in ascending ID order to prevent deadlock
        // First fetch attacker without lock to get its ID
        const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
          req.player.playerId,
        ]);
        if (!k) {
          await db.run("ROLLBACK");
          return res.status(404).json({ error: "Kingdom not found" });
        }

        // Lock both kingdoms in ascending ID order (prevents deadlock)
        const kingdomIds = [k.id, targetId].sort((a, b) => a - b);
        const lockedKingdoms = await db.all(
          `SELECT ${KINGDOM_COVERT} FROM kingdoms WHERE id IN (${kingdomIds.map(() => '?').join(',')}) ORDER BY id FOR UPDATE`,
          kingdomIds,
        );

        if (lockedKingdoms.length < 2) {
          await db.run("ROLLBACK");
          return res.status(404).json({ error: "One or both kingdoms not found" });
        }

        // Find attacker and target in locked kingdoms
        const attackerK = lockedKingdoms.find(kd => kd.id === k.id);
        const target = lockedKingdoms.find(kd => kd.id === targetId);

        if (!attackerK || !target) {
          await db.run("ROLLBACK");
          return res.status(404).json({ error: "Kingdom lookup failed" });
        }

        if (!attackerK.turns_stored || attackerK.turns_stored < 1) {
          await db.run("ROLLBACK");
          return res.status(429).json({ error: "No turns available" });
        }
        if (target.id === attackerK.id) {
          await db.run("ROLLBACK");
          return res.status(400).json({ error: "Cannot target your own kingdom" });
        }

        // AI vs AI only - no cross-faction covert ops
        // Check map requirement
        let atkDisc = {};
        try {
          atkDisc = safeJsonParse(attackerK.discovered_kingdoms, {}, "auto:discovered_kingdoms");
        } catch {}
        if (!atkDisc[targetId] || !atkDisc[targetId].mapped) {
          await db.run("ROLLBACK");
          return res.status(400).json({
            error: "You need a location map for this target.",
          });
        }

        // Newbie protection
        if (attackerK.turn < 400) {
          await db.run("ROLLBACK");
          return res.status(400).json({
            error: `You are under newbie protection until Turn 400. You cannot perform covert actions yet.`,
          });
        }
        if ((target.turn || 0) < 400) {
          await db.run("ROLLBACK");
          return res.status(400).json({
            error: `${target.name} is under newbie protection until Turn 400 (currently Turn ${target.turn})`,
          });
        }

        // All validations passed - execute covert operation
        let result;
    if (op === "spy") {
      const unitsSent = Math.max(1, parseInt(units) || 0);
      if (unitsSent > engine.getAvailableUnits(k, "thieves")) {
        await db.run("ROLLBACK");
        return res.status(400).json({ error: "Not enough available thieves" });
      }
      result = engine.covertSpy(attackerK, target, unitsSent);
      if (result.error) {
        await db.run("ROLLBACK");
        return res.status(400).json({ error: result.error });
      }
      const spyAttackerUpdates = { ...(result.spyUpdates || {}) };
      spyAttackerUpdates.turns_stored = (attackerK.turns_stored || 0) - 1;
      await applyKingdomUpdates(attackerK.id, result.spyUpdates || {});
      await db.run(
        "UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = ?",
        [attackerK.id],
      );
      if (result.spyEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
          [attackerK.id, "covert", result.spyEvent, attackerK.turn],
        );
      if (result.targetEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
          [target.id, "covert", result.targetEvent, target.turn],
        );
      // Store spy report
      const reportRow = await db.run(
        `INSERT INTO spy_reports (kingdom_id, target_id, target_name, outcome, report) VALUES (?,?,?,?,?)`,
        [
          attackerK.id,
          target.id,
          target.name,
          result.success ? "success" : "failed",
          result.report ? JSON.stringify(result.report) : null,
        ],
      );
      // War log: obscure attacker on success so target doesn't know who spied
      await db.run(
        `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES (?,?,?,?,?,?,?,?)`,
        [
          "spy",
          attackerK.id,
          attackerK.name,
          target.id,
          target.name,
          result.success ? "success" : "caught",
          "Intelligence gathering",
          result.success ? 1 : 0,
        ],
      );
      await db.run("COMMIT");
      return res.json({
        ok: true,
        success: result.success,
        report: result.report || null,
        reportId: reportRow.lastID,
        event: result.spyEvent,
        updates: spyAttackerUpdates,
      });
    } else if (op === "loot") {
      const thievesSent = Math.max(1, parseInt(units) || 0);
      if (thievesSent > engine.getAvailableUnits(attackerK, "thieves")) {
        await db.run("ROLLBACK");
        return res.status(400).json({ error: "Not enough available thieves" });
      }
      const loot = lootType === "wm" ? "war_machines" : lootType;
      result = engine.covertLoot(attackerK, target, loot, thievesSent);
      if (result.error) {
        await db.run("ROLLBACK");
        return res.status(400).json({ error: result.error });
      }
      const lootAttackerUpdates = { ...(result.thiefUpdates || {}) };
      lootAttackerUpdates.turns_stored = (attackerK.turns_stored || 0) - 1;
      await applyKingdomUpdates(attackerK.id, result.thiefUpdates || {});
      await applyKingdomUpdates(target.id, result.targetUpdates || {});
      await db.run(
        "UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = ?",
        [attackerK.id],
      );
      const logRes = await db.run(
        `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES (?,?,?,?,?,?,?,?)`,
        [
          "loot",
          attackerK.id,
          attackerK.name,
          target.id,
          target.name,
          result.success ? "success" : "caught",
          result.success
            ? `Stole ${loot.replace("_", " ")}`
            : "Thieves captured",
          result.success ? 1 : 0,
        ],
      );
      const reportId = logRes.lastID;
      if (result.thiefEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)",
          [attackerK.id, "covert", result.thiefEvent, attackerK.turn, reportId],
        );
      if (result.targetEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)",
          [target.id, "covert", result.targetEvent, target.turn, reportId],
        );
      await db.run("COMMIT");
      return res.json({
        ok: true,
        success: result.success,
        stolen: result.stolen,
        lootType: result.lootType,
        event: result.thiefEvent,
        updates: lootAttackerUpdates,
      });
    } else if (op === "assassinate") {
      const ninjasSent = Math.max(1, parseInt(units) || 0);
      if (ninjasSent > engine.getAvailableUnits(attackerK, "ninjas")) {
        await db.run("ROLLBACK");
        return res.status(400).json({ error: "Not enough available ninjas" });
      }
      const validTargets = [
        "fighters",
        "rangers",
        "clerics",
        "mages",
        "thieves",
        "ninjas",
        "researchers",
        "engineers",
        "scribes",
      ];
      if (!validTargets.includes(unitType)) {
        await db.run("ROLLBACK");
        return res.status(400).json({ error: "Invalid target unit type" });
      }
      result = engine.covertAssassinate(attackerK, target, ninjasSent, unitType);
      if (result.error) {
        await db.run("ROLLBACK");
        return res.status(400).json({ error: result.error });
      }
      const assassinAttackerUpdates = { ...(result.assassinUpdates || {}) };
      assassinAttackerUpdates.turns_stored = (attackerK.turns_stored || 0) - 1;
      await applyKingdomUpdates(attackerK.id, result.assassinUpdates || {});
      await applyKingdomUpdates(target.id, result.targetUpdates || {});
      await db.run(
        "UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = ?",
        [attackerK.id],
      );
      const logRes = await db.run(
        `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES (?,?,?,?,?,?,?,?)`,
        [
          "assassinate",
          attackerK.id,
          attackerK.name,
          target.id,
          target.name,
          result.success ? "success" : "caught",
          result.success
            ? `${(result.killed || 0).toLocaleString()} ${unitType} eliminated`
            : "Ninjas compromised",
          result.success ? 1 : 0,
        ],
      );
      const reportId = logRes.lastID;
      if (result.assassinEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)",
          [attackerK.id, "covert", result.assassinEvent, attackerK.turn, reportId],
        );
      if (result.targetEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)",
          [target.id, "covert", result.targetEvent, target.turn, reportId],
        );
      await db.run("COMMIT");
      return res.json({
        ok: true,
        success: result.success,
        killed: result.killed,
        event: result.assassinEvent,
        updates: assassinAttackerUpdates,
      });
    } else if (op === "sabotage") {
      const ninjasSent = Math.max(1, parseInt(units) || 0);
      if (ninjasSent > engine.getAvailableUnits(attackerK, "ninjas")) {
        await db.run("ROLLBACK");
        return res.status(400).json({ error: "Not enough available ninjas" });
      }

      result = engine.covertSabotage(attackerK, target, ninjasSent, bldType);
      if (result.error) {
        await db.run("ROLLBACK");
        return res.status(400).json({ error: result.error });
      }

      const sabotageAttackerUpdates = { ...(result.assassinUpdates || {}) };
      sabotageAttackerUpdates.turns_stored = (attackerK.turns_stored || 0) - 1;
      await applyKingdomUpdates(attackerK.id, result.assassinUpdates || {});
      await applyKingdomUpdates(target.id, result.targetUpdates || {});

      await db.run(
        "UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = ?",
        [attackerK.id],
      );

      const logRes = await db.run(
        `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES (?,?,?,?,?,?,?,?)`,
        [
          "sabotage",
          attackerK.id,
          attackerK.name,
          target.id,
          target.name,
          result.success ? "success" : "caught",
          result.success
            ? `${result.destroyed.toLocaleString()} ${bldType.replace(/_/g, " ")} destroyed`
            : "Ninjas caught",
          result.success ? 1 : 0,
        ],
      );
      const reportId = logRes.lastID;

      if (result.assassinEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)",
          [attackerK.id, "covert", result.assassinEvent, attackerK.turn, reportId],
        );

      if (result.targetEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)",
          [target.id, "covert", result.targetEvent, target.turn, reportId],
        );

      await db.run("COMMIT");
      return res.json({
        ok: true,
        success: result.success,
        destroyed: result.destroyed,
        ninjasLost: result.ninjasLost,
        event: result.assassinEvent,
        updates: sabotageAttackerUpdates,
      });
    } else if (op === "raid_trade_route") {
      const thievesSent = Math.max(1, parseInt(units) || 0);
      if (thievesSent > attackerK.thieves) {
        await db.run("ROLLBACK");
        return res.status(400).json({ error: "Not enough thieves" });
      }
      result = engine.raidTradeRoute(attackerK, target, thievesSent);
      if (result.error) {
        await db.run("ROLLBACK");
        return res.status(400).json({ error: result.error });
      }
      const raidAttackerUpdates = { ...(result.attackerUpdates || {}) };
      raidAttackerUpdates.turns_stored = (attackerK.turns_stored || 0) - 1;
      await applyKingdomUpdates(attackerK.id, result.attackerUpdates || {});
      await applyKingdomUpdates(target.id, result.defenderUpdates || {});
      await db.run(
        "UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = ?",
        [attackerK.id],
      );
      if (result.atkEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
          [attackerK.id, "covert", result.atkEvent, attackerK.turn],
        );
      if (result.defEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
          [target.id, "covert", result.defEvent, target.turn],
        );
      await db.run(
        `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES (?,?,?,?,?,?,?,?)`,
        [
          "raid_trade_route",
          attackerK.id,
          attackerK.name,
          target.id,
          target.name,
          result.success ? "success" : "failed",
          result.success
            ? `Raided ${result.raidedRoutes} routes`
            : "Raid repelled",
          0, // Raiding is public
        ],
      );
      await db.run("COMMIT");
      return res.json({
        ok: true,
        success: result.success,
        looted: result.looted,
        event: result.atkEvent,
        updates: raidAttackerUpdates,
      });
    } else {
      await db.run("ROLLBACK");
      return res.status(400).json({ error: "Unknown covert operation" });
    }
  } catch (err) {
    try {
      await db.run("ROLLBACK");
    } catch (rollbackErr) {
      console.error("[covert] rollback error:", rollbackErr.message);
    }
    console.error("[covert] operation failed:", err.message);
    return res.status(500).json({ error: "Covert operation failed - please try again" });
  }
  });

  // â"€â"€ Fire units â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  router.post("/fire", requireAuth, requireCsrfToken, async (req, res) => {
    const { unit, amount } = req.body;
    const validUnits = [
      "fighters",
      "rangers",
      "clerics",
      "mages",
      "thieves",
      "ninjas",
      "researchers",
      "engineers",
      "scribes",
    ];
    if (!validUnits.includes(unit))
      return res.status(400).json({ error: "Invalid unit type" });
    const n = Math.max(0, parseInt(amount) || 0);
    if (n <= 0)
      return res.status(400).json({ error: "Amount must be positive" });
    const k = await db.get("SELECT id, race, population, fighters, rangers, mages, clerics, thieves, ninjas, researchers, engineers, scribes, war_machines FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.race === "vampire" && unit === "clerics") {
      return res
        .status(400)
        .json({
          error:
            "Vampires auto-populate Thralls via Mausoleums and cannot fire them.",
        });
    }
    if (n > (k[unit] || 0))
      return res.status(400).json({
        error: `Only have ${(k[unit] || 0).toLocaleString()} ${unit}`,
      });
    const updates = {
      [unit]: (k[unit] || 0) - n,
      population: k.population + n,
    };
    await applyKingdomUpdates(k.id, updates);
    res.json({ ok: true, updates });
  });

  // â"€â"€ Defense overview â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  router.get("/defense/overview", requireAuth, async (req, res) => {
    const k = await db.get(
      `SELECT id, race, region, prestige_level, bld_walls, bld_guard_towers, bld_outposts, bld_castles,
              war_machines, ballistae, thieves, rangers, wall_upgrades, tower_def_upgrades,
              outpost_upgrades, defense_upgrades, alliance_buffs, res_war_machines,
              troop_levels, fragment_bonuses, wall_hp, wall_defense_type
       FROM kingdoms WHERE player_id = ?`,
      [req.player.playerId]
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    res.json({
      bld_walls: k.bld_walls,
      bld_guard_towers: k.bld_guard_towers,
      bld_outposts: k.bld_outposts,
      bld_castles: k.bld_castles,
      war_machines: k.war_machines,
      ballistae: k.ballistae,
      wall_upgrades: safeJsonParse(k.wall_upgrades, {}, "auto:wall_upgrades"),
      tower_def_upgrades: safeJsonParse(k.tower_def_upgrades, {}, "auto:tower_def_upgrades"),
      outpost_upgrades: safeJsonParse(k.outpost_upgrades, {}, "auto:outpost_upgrades"),
      defense_upgrades: safeJsonParse(k.defense_upgrades, {}, "auto:defense_upgrades"),
      defense_rating: engine.defenseRating(k),
      wall_power: engine.wallDefensePower(k),
      tower_power: engine.towerDetectionPower(k),
      outpost_power: engine.outpostRangerPower(k),
      citadel_req: engine.CITADEL_REQ,
      thieves_on_watch: Math.min(
        k.thieves,
        k.bld_guard_towers * 10,
      ),
      rangers_on_patrol: Math.min(k.rangers, k.bld_outposts * 20),
      wm_on_walls: Math.min(k.ballistae || 0, k.bld_walls),
    });
  });

  // â"€â"€ Spy reports â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  router.get("/spy-reports", requireAuth, async (req, res) => {
    try {
      const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
        req.player.playerId,
      ]);
      if (!k) return res.status(404).json({ error: "Kingdom not found" });
      const rows = await db.all(
        `SELECT id, target_id, target_name, outcome, report, shared_to_alliance, created_at
         FROM spy_reports WHERE kingdom_id = ? ORDER BY created_at DESC LIMIT 100`,
        [k.id],
      );
      res.json(
        rows.map((r) => ({
          ...r,
          report: r.report ? JSON.parse(r.report) : null,
        })),
      );
    } catch (e) {
      console.error("[spy] GET spy-reports:", e.message);
      res.status(500).json({ error: "Failed to load spy reports" });
    }
  });

  router.post("/spy-reports/:id/share", requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
        req.player.playerId,
      ]);
      if (!k) return res.status(404).json({ error: "Kingdom not found" });
      const report = await db.get(
        "SELECT id, shared_to_alliance FROM spy_reports WHERE id = ? AND kingdom_id = ?",
        [req.params.id, k.id],
      );
      if (!report) return res.status(404).json({ error: "Report not found" });
      const newVal = (report.shared_to_alliance === 1 || report.shared_to_alliance === "1") ? 0 : 1;
      await db.run(
        "UPDATE spy_reports SET shared_to_alliance = ? WHERE id = ?",
        [newVal, report.id],
      );
      res.json({ ok: true, shared: newVal === 1 });
    } catch (e) {
      console.error("[spy] POST spy-reports/share:", e.message);
      res.status(500).json({ error: "Failed to update report" });
    }
  });

  router.get("/spy-reports/alliance", requireAuth, async (req, res) => {
    try {
      const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
        req.player.playerId,
      ]);
      if (!k) return res.status(404).json({ error: "Kingdom not found" });
      const membership = await db.get(
        "SELECT alliance_id FROM alliance_members WHERE kingdom_id = ?",
        [k.id],
      );
      if (!membership) return res.json([]);
      const rows = await db.all(
        `
        SELECT sr.id, sr.target_id, sr.target_name, sr.outcome, sr.report, sr.created_at,
               k.name as shared_by_name
        FROM spy_reports sr
        JOIN kingdoms k ON sr.kingdom_id = k.id
        JOIN alliance_members am ON am.kingdom_id = sr.kingdom_id
        WHERE am.alliance_id = ? AND sr.shared_to_alliance = 1
        ORDER BY sr.created_at DESC LIMIT 50
      `,
        [membership.alliance_id],
      );
      res.json(
        rows.map((r) => ({
          ...r,
          report: r.report ? JSON.parse(r.report) : null,
        })),
      );
    } catch (e) {
      console.error("[spy] GET spy-reports/alliance:", e.message);
      res.status(500).json({ error: "Failed to load alliance intel" });
    }
  });

  return router;
};
