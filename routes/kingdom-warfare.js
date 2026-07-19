const express = require("express");
const commandHandler = require("../game/command-handler");
const { requireAuth, requireCsrfToken } = require("./middleware");
const { progressGoal } = require('../game/goals');
const { safeJsonParse } = require('../utils/helpers');
const { applyKingdomUpdates } = require('../db/schema');
const { pgInList } = require('../lib/pg-placeholders');
const { getKingdomVisibility } = require('../game/visibility');
const { safeBitmapHasCell } = require('../game/visibility-cells');
const { pixelToHex } = require('../game/hex-utils');
const { getKingdomMapCoords } = require('../game/world-map-coords');
const { structureUpdates } = require('./response-structurer');
const { convertNumericFields } = require('../db/numeric-fields');

const router = express.Router();

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function lockKingdomRows(db, kingdomIds) {
  const ids = [...new Set(kingdomIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b);
  if (ids.length === 0) return [];
  return db.all(
    `SELECT * FROM kingdoms WHERE id IN (${pgInList(ids.length)}) ORDER BY id FOR UPDATE`,
    ids,
  );
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
    const row = await db.get("SELECT * FROM war_log WHERE id = $1", [
      req.params.id,
    ]);
    if (!row) return res.status(404).json({ error: "Log not found" });
    res.json(row);
  });

  // â"€â"€ Military attack â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  router.post("/attack", requireAuth, requireCsrfToken, async (req, res) => {
    try {
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

      if (sentUnits.fighters <= 0 && sentUnits.rangers <= 0 && sentUnits.mages <= 0) {
        throw httpError(400, 'Send at least some troops');
      }

      const attackerIdRow = await db.get('SELECT id FROM kingdoms WHERE player_id = $1', [req.player.playerId]);
      if (!attackerIdRow) throw httpError(404, 'Kingdom not found');

      const attackerId = attackerIdRow.id;
      let response;
      const targetIdNum = Number(targetId);
      if (!Number.isInteger(targetIdNum) || targetIdNum <= 0) {
        throw httpError(400, 'Target kingdom not found');
      }
      if (targetIdNum === attackerId) {
        throw httpError(400, 'Cannot attack yourself');
      }

      await db.withTransaction(async () => {
        const lockedKingdoms = await lockKingdomRows(db, [attackerId, targetIdNum]);
        if (lockedKingdoms.length < 2) throw httpError(404, 'Target kingdom not found');

        const k = lockedKingdoms.find((row) => row.id === attackerId);
        const target = lockedKingdoms.find((row) => row.id === targetIdNum);
        if (!k) throw httpError(404, 'Kingdom not found');
        if (!target) throw httpError(404, 'Target kingdom not found');

        if (k.turns_stored < 1) throw httpError(429, 'No turns available');

        if (sentUnits.fighters > commandHandler.getAvailableUnits(k, 'fighters')) {
          throw httpError(400, 'Not enough available fighters (some may be in training)');
        }
        if (sentUnits.rangers > commandHandler.getAvailableUnits(k, 'rangers')) {
          throw httpError(400, 'Not enough available rangers (some may be in training)');
        }
        if (sentUnits.mages > commandHandler.getAvailableUnits(k, 'mages')) {
          throw httpError(400, 'Not enough available mages (some may be in training)');
        }
        if (sentUnits.warMachines > commandHandler.getAvailableUnits(k, 'war_machines')) {
          throw httpError(400, 'Not enough available war machines');
        }
        if (sentUnits.ninjas > commandHandler.getAvailableUnits(k, 'ninjas')) {
          throw httpError(400, 'Not enough available ninjas (some may be in training)');
        }
        if (sentUnits.thieves > commandHandler.getAvailableUnits(k, 'thieves')) {
          throw httpError(400, 'Not enough available thieves (some may be in training)');
        }
        if (sentUnits.clerics > commandHandler.getAvailableUnits(k, 'clerics')) {
          throw httpError(400, 'Not enough available clerics/thralls (some may be in training)');
        }
        if (sentUnits.engineers > commandHandler.getAvailableUnits(k, 'engineers')) {
          throw httpError(400, 'Not enough available engineers (some may be in training)');
        }
        if (sentUnits.ladders > commandHandler.getAvailableUnits(k, 'ladders')) {
          throw httpError(400, 'Not enough available ladders');
        }

        if (k.turn < 400) {
          throw httpError(400, 'You are under newbie protection until Turn 400. You cannot attack yet.');
        }
        if ((target.turn || 0) < 400) {
          throw httpError(400, `${target.name} is under newbie protection until Turn 400`);
        }

        // Phase 3: gate attack using seen_cells instead of discovered_kingdoms
        const vis = await getKingdomVisibility(db, k);
        const targetCoords = getKingdomMapCoords({ id: targetIdNum, race: target.race });
        const targetHex = pixelToHex(targetCoords.map_x, targetCoords.map_y);
        if (!safeBitmapHasCell(vis.seenCells, targetHex.col, targetHex.row)) {
          throw httpError(400, 'You need a location map for this target.');
        }

        const attackerHeroes = await db.all('SELECT * FROM heroes WHERE kingdom_id = $1 AND status = $2', [k.id, 'idle']);
        const defenderHeroes = await db.all('SELECT * FROM heroes WHERE kingdom_id = $1 AND status = $2', [target.id, 'idle']);

        // Defender learns attacker via combat V2 post-combat discovery (defenderUpdates.discovered_kingdoms)

        const result = await commandHandler.handle(
          {
            type: 'combat',
            target,
            sentUnits,
            attackerHeroes,
            defenderHeroes,
          },
          { kingdom: k },
        );
        if (result.error) throw httpError(400, result.error);

        const heroUpdates = [];
        for (const h of attackerHeroes) {
          const resHero = commandHandler.awardHeroXp(h, result.win ? 500 : 100);
          heroUpdates.push([resHero.xp, resHero.level, h.id]);
        }
        for (const h of defenderHeroes) {
          const resHero = commandHandler.awardHeroXp(h, result.win ? 100 : 500);
          heroUpdates.push([resHero.xp, resHero.level, h.id]);
        }

        if (heroUpdates.length > 0) {
          const heroIds = heroUpdates.map((u) => u[2]);
          const xps = heroUpdates.map((u) => u[0]);
          const levels = heroUpdates.map((u) => u[1]);
          const placeholders = heroIds.map((_, i) => `$${i + 1}`).join(',');
          await db.run(
            `UPDATE heroes SET xp = CAST(CASE id ${heroIds.map((id, i) => `WHEN $${i + 1} THEN $${heroIds.length + i + 1}`).join(' ')} END AS real),
             level = CAST(CASE id ${heroIds.map((id, i) => `WHEN $${i + 1} THEN $${heroIds.length * 2 + i + 1}`).join(' ')} END AS integer)
             WHERE id IN (${placeholders})`,
            [...heroIds, ...xps, ...levels],
          );
        }

        progressGoal(k, result.attackerUpdates, 'attack_made', 1);

        await applyKingdomUpdates(k.id, result.attackerUpdates);
        await applyKingdomUpdates(target.id, result.defenderUpdates);
        await db.run('UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = $1', [k.id]);

        if (result.win) {
          const activeBounties = await db.all('SELECT * FROM bounties WHERE target_id = $1 AND status = $2', [target.id, 'active']);
          if (activeBounties.length > 0) {
            let totalClaimed = 0;
            const bountyIds = [];
            for (const b of activeBounties) {
              totalClaimed += b.amount;
              bountyIds.push(b.id);
            }
            if (bountyIds.length > 0) {
              const placeholders = bountyIds.map((_, i) => `$${i + 3}`).join(',');
              await db.run('UPDATE bounties SET status = $1, claimed_by_id = $2 WHERE id IN (' + placeholders + ')', ['claimed', k.id, ...bountyIds]);
            }
            if (totalClaimed > 0) {
              await db.run('UPDATE kingdoms SET gold = gold + $1 WHERE id = $2', [totalClaimed, k.id]);
              result.atkEvent += ` BOUNTY CLAIMED! You collected ${totalClaimed.toLocaleString()} gold in bounties placed on ${target.name}.`;
              await db.run('INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)', [k.id, 'system', `You claimed ${totalClaimed.toLocaleString()} gold in bounties by defeating ${target.name}!`, k.turn]);
            }
          }
        }

        if (result.win && Math.random() < 0.04) {
          await db.run('UPDATE kingdoms SET maps = maps + 1 WHERE id = $1', [k.id]);
          result.atkEvent += ' In the aftermath, your troops scavenged a map from a fallen scout\'s corpse.';
        }

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
        const logRes = await db.run('INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES ($1,$2,$3,$4,$5,$6,$7,0)', ['attack', k.id, k.name, target.id, target.name, result.win ? 'victory' : 'repelled', detail]);
        const reportId = logRes.lastID;

        await db.run('INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES ($1,$2,$3,$4,$5)', [k.id, 'attack', result.atkEvent, k.turn, reportId]);
        await db.run('INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES ($1,$2,$3,$4,$5)', [target.id, 'attack', result.defEvent, target.turn, reportId]);

        let defTowerUpgrades = {};
        try {
          defTowerUpgrades = safeJsonParse(target.tower_def_upgrades, {}, 'auto:tower_def_upgrades');
        } catch {}
        if (defTowerUpgrades.watchtower || defTowerUpgrades.signal_tower) {
          await db.run('INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)', [target.id, 'system', `⚠️ Watchtower scouts have detected ${k.name} massing troops at the border.`, target.turn]);
          if (defTowerUpgrades.signal_tower) {
            const allianceMembers = await db.all(`
              SELECT am.kingdom_id FROM alliance_members am
              JOIN alliance_members am2 ON am.alliance_id = am2.alliance_id
              WHERE am2.kingdom_id = $1 AND am.kingdom_id != $2`, [target.id, target.id]);
            if (allianceMembers.length > 0) {
              const placeholders = allianceMembers.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(',');
              const params = [];
              const message = `📡 Signal Tower: Your ally ${target.name} is under attack by ${k.name}!`;
              for (const mem of allianceMembers) params.push(mem.kingdom_id, 'system', message, k.turn);
              await db.run(`INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ${placeholders}`, params);
            }
          }
        }

        if (result.win) {
          if (result.report.wallsDestroyed > 0) {
            await db.run('INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)', [target.id, 'attack', `${result.report.wallsDestroyed} walls were destroyed in the bombardment.`, target.turn]);
          } else if (result.report.buildingDamaged) {
            await db.run('INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)', [target.id, 'attack', `Attackers burned ${result.report.buildingDamaged} with no walls to stop them.`, target.turn]);
          }
        }
        response = { result, attackerId };
      });

      // gold/turns_stored are refreshed here rather than trusted from
      // attackerUpdates because they can change outside it: turns_stored is
      // decremented via raw SQL above, and gold can also be bumped by a
      // bounty claim (raw SQL, only when result.win) a few lines up — same
      // "refetch what raw SQL might have touched" pattern as
      // routes/kingdom-turn.js's postfetch (A3-7).
      const freshK = await db.get("SELECT maps, gold, turns_stored FROM kingdoms WHERE id = $1", [attackerId]);
      if (freshK) convertNumericFields(freshK);
      const result = response?.result;
      return res.json({
        ok: true,
        report: result?.report,
        updates: structureUpdates({
          ...result?.attackerUpdates,
          maps: freshK?.maps ?? 0,
          gold: freshK?.gold,
          turns_stored: freshK?.turns_stored,
        }),
        event: result?.atkEvent,
      });
    } catch (err) {
      if (err?.status) return res.status(err.status).json({ error: err.message });
      console.error("❌ Attack route failed:", err);
      return res.status(500).json({ error: "Failed to resolve attack" });
    }
  });
  router.post("/spell", requireAuth, requireCsrfToken, async (req, res) => {
    const { spellId, targetId, obscure } = req.body;
    if (!spellId) return res.status(400).json({ error: "spellId required" });

    const attackerRow = await db.get("SELECT id FROM kingdoms WHERE player_id = $1", [req.player.playerId]);
    if (!attackerRow) return res.status(404).json({ error: "Kingdom not found" });

    const attackerId = attackerRow.id;
    const targetIdNum = targetId != null ? Number(targetId) : null;
    const isFriendlySpell = commandHandler.getConstants().SPELL_DEFS?.[spellId]?.effect === "friendly";

    try {
      let response;
      await db.withTransaction(async () => {
        const kingdomIds = [attackerId];
        if (targetIdNum && targetIdNum !== attackerId) kingdomIds.push(targetIdNum);
        const lockedKingdoms = await lockKingdomRows(db, kingdomIds);

        const attackerK = lockedKingdoms.find((row) => row.id === attackerId);
        if (!attackerK) throw httpError(404, "Kingdom not found");
        if (attackerK.turns_stored < 1) throw httpError(429, "No turns available");

        let target = attackerK;
        if (targetIdNum && targetIdNum !== attackerId) {
          target = lockedKingdoms.find((row) => row.id === targetIdNum);
          if (!target) throw httpError(404, "Target kingdom not found");
        } else if (!isFriendlySpell) {
          throw httpError(400, "targetId required for offensive spells");
        }

        // Phase 3: gate offensive spells using seen_cells
        if (!isFriendlySpell) {
          const vis = await getKingdomVisibility(db, attackerK);
          const targetCoords = getKingdomMapCoords({ id: targetIdNum, race: target.race });
          const targetHex = pixelToHex(targetCoords.map_x, targetCoords.map_y);
          if (!safeBitmapHasCell(vis.seenCells, targetHex.col, targetHex.row)) {
            throw httpError(400, "You need a location map for this target.");
          }
        }

        const validation = commandHandler.validateSpellTarget(attackerK, target, spellId);
        if (validation.error) throw httpError(400, validation.error);

        const result = await commandHandler.handle(
          {
            type: 'spell',
            target: validation.target,
            spellId,
            obscure: !!obscure,
          },
          { kingdom: attackerK },
        );
        if (result.error) throw httpError(400, result.error);

        progressGoal(attackerK, result.casterUpdates, 'spell_cast', 1);

        await applyKingdomUpdates(attackerK.id, result.casterUpdates);
        await applyKingdomUpdates(validation.target.id, result.targetUpdates);
        await db.run('UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = $1', [attackerK.id]);

        if (!validation.isFriendly || attackerK.id !== validation.target.id) {
          const logRes = await db.run(
            `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              validation.isFriendly ? 'blessing' : 'spell',
              attackerK.id,
              attackerK.name,
              validation.target.id,
              validation.target.name,
              'cast',
              `${spellId.replace(/_/g, ' ')} - ${result.report.damageDesc || ''}`,
              obscure ? 1 : 0,
            ],
          );
          const reportId = logRes.lastID;
          if (result.casterEvent) {
            await db.run('INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES ($1,$2,$3,$4,$5)', [attackerK.id, 'system', result.casterEvent, attackerK.turn, reportId]);
          }
          if (result.targetEvent) {
            await db.run('INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES ($1,$2,$3,$4,$5)', [validation.target.id, validation.isFriendly ? 'system' : 'attack', result.targetEvent, validation.target.turn || 0, reportId]);
          }
        } else if (result.casterEvent) {
          await db.run('INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)', [attackerK.id, 'system', result.casterEvent, attackerK.turn]);
        }

        response = { result, attackerId };
      });

      const freshK = await db.get('SELECT mana, scrolls, maps, active_effects FROM kingdoms WHERE id = $1', [attackerId]);
      const result = response?.result;
      return res.json({
        ok: true,
        report: result?.report,
        updates: {
          mana: freshK?.mana,
          scrolls: safeJsonParse(freshK?.scrolls, {}, 'auto:scrolls'),
          maps: freshK?.maps,
          active_effects: safeJsonParse(freshK?.active_effects, {}, 'auto:active_effects'),
          ...result?.casterUpdates,
        },
      });
    } catch (err) {
      if (err?.status) return res.status(err.status).json({ error: err.message });
      console.error('❌ Spell route failed:', err);
      return res.status(500).json({ error: 'Failed to cast spell' });
    }
  });
  router.post("/covert", requireAuth, requireCsrfToken, async (req, res) => {
    const { op, targetId, units, lootType, unitType, bldType } = req.body;

    try {
      const response = await db.withTransaction(async () => {
        // Lock kingdoms in ascending ID order to prevent deadlock
        // First fetch attacker without lock to get its ID
        const k = await db.get("SELECT id FROM kingdoms WHERE player_id = $1", [
          req.player.playerId,
        ]);
        if (!k) {
          throw httpError(404, "Kingdom not found");
        }

        // Lock both kingdoms in ascending ID order (prevents deadlock)
        const kingdomIds = [k.id, targetId].sort((a, b) => a - b);
        const lockedKingdoms = await db.all(
          `SELECT ${KINGDOM_COVERT} FROM kingdoms WHERE id IN (${pgInList(kingdomIds.length)}) ORDER BY id FOR UPDATE`,
          kingdomIds,
        );

        if (lockedKingdoms.length < 2) {
          throw httpError(404, "One or both kingdoms not found");
        }

        // Find attacker and target in locked kingdoms
        const attackerK = lockedKingdoms.find(kd => kd.id === k.id);
        const target = lockedKingdoms.find(kd => kd.id === targetId);

        if (!attackerK || !target) {
          throw httpError(404, "Kingdom lookup failed");
        }

        if (!attackerK.turns_stored || attackerK.turns_stored < 1) {
          throw httpError(429, "No turns available");
        }
        if (target.id === attackerK.id) {
          throw httpError(400, "Cannot target your own kingdom");
        }

        // AI vs AI only - no cross-faction covert ops
        // Phase 3: gate using seen_cells
        const vis = await getKingdomVisibility(db, attackerK);
        const targetCoords = getKingdomMapCoords({ id: targetId, race: target.race });
        const targetHex = pixelToHex(targetCoords.map_x, targetCoords.map_y);
        if (!safeBitmapHasCell(vis.seenCells, targetHex.col, targetHex.row)) {
          throw httpError(400, "You need a location map for this target.",);
        }

        // Newbie protection
        if (attackerK.turn < 400) {
          throw httpError(400, `You are under newbie protection until Turn 400. You cannot perform covert actions yet.`,);
        }
        if ((target.turn || 0) < 400) {
          throw httpError(400, `${target.name} is under newbie protection until Turn 400 (currently Turn ${target.turn})`);
        }

        // All validations passed - execute covert operation
        let result;
    if (op === "spy") {
      const unitsSent = Math.max(1, parseInt(units) || 0);
      if (unitsSent > commandHandler.getAvailableUnits(k, "thieves")) {
        throw httpError(400, "Not enough available thieves");
      }
      result = await commandHandler.handle(
        { type: 'covert-spy', target, unitsSent },
        { kingdom: attackerK },
      );
      if (result.error) {
        throw httpError(400, result.error);
      }
      const spyAttackerUpdates = { ...(result.spyUpdates || {}) };
      spyAttackerUpdates.turns_stored = (attackerK.turns_stored || 0) - 1;
      await applyKingdomUpdates(attackerK.id, result.spyUpdates || {});
      await db.run(
        "UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = $1",
        [attackerK.id],
      );
      if (result.spyEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)",
          [attackerK.id, "covert", result.spyEvent, attackerK.turn],
        );
      if (result.targetEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)",
          [target.id, "covert", result.targetEvent, target.turn],
        );
      // Store spy report
      const reportRow = await db.run(
        `INSERT INTO spy_reports (kingdom_id, target_id, target_name, outcome, report) VALUES ($1,$2,$3,$4,$5)`,
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
        `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
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
      return ({
        ok: true,
        success: result.success,
        report: result.report || null,
        reportId: reportRow.lastID,
        event: result.spyEvent,
        updates: spyAttackerUpdates,
      });
    } else if (op === "loot") {
      const thievesSent = Math.max(1, parseInt(units) || 0);
      if (thievesSent > commandHandler.getAvailableUnits(attackerK, "thieves")) {
        throw httpError(400, "Not enough available thieves");
      }
      const loot = lootType === "wm" ? "war_machines" : lootType;
      result = await commandHandler.handle(
        { type: 'covert-loot', target, lootType: loot, thievesSent },
        { kingdom: attackerK },
      );
      if (result.error) {
        throw httpError(400, result.error);
      }
      const lootAttackerUpdates = { ...(result.thiefUpdates || {}) };
      lootAttackerUpdates.turns_stored = (attackerK.turns_stored || 0) - 1;
      await applyKingdomUpdates(attackerK.id, result.thiefUpdates || {});
      await applyKingdomUpdates(target.id, result.targetUpdates || {});
      await db.run(
        "UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = $1",
        [attackerK.id],
      );
      const logRes = await db.run(
        `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
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
          "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES ($1,$2,$3,$4,$5)",
          [attackerK.id, "covert", result.thiefEvent, attackerK.turn, reportId],
        );
      if (result.targetEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES ($1,$2,$3,$4,$5)",
          [target.id, "covert", result.targetEvent, target.turn, reportId],
        );
      return ({
        ok: true,
        success: result.success,
        stolen: result.stolen,
        lootType: result.lootType,
        event: result.thiefEvent,
        updates: lootAttackerUpdates,
      });
    } else if (op === "assassinate") {
      const ninjasSent = Math.max(1, parseInt(units) || 0);
      if (ninjasSent > commandHandler.getAvailableUnits(attackerK, "ninjas")) {
        throw httpError(400, "Not enough available ninjas");
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
        throw httpError(400, "Invalid target unit type");
      }
      result = await commandHandler.handle(
        { type: 'covert-assassinate', target, ninjasSent, unitType },
        { kingdom: attackerK },
      );
      if (result.error) {
        throw httpError(400, result.error);
      }
      const assassinAttackerUpdates = { ...(result.assassinUpdates || {}) };
      assassinAttackerUpdates.turns_stored = (attackerK.turns_stored || 0) - 1;
      await applyKingdomUpdates(attackerK.id, result.assassinUpdates || {});
      await applyKingdomUpdates(target.id, result.targetUpdates || {});
      await db.run(
        "UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = $1",
        [attackerK.id],
      );
      const logRes = await db.run(
        `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
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
          "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES ($1,$2,$3,$4,$5)",
          [attackerK.id, "covert", result.assassinEvent, attackerK.turn, reportId],
        );
      if (result.targetEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES ($1,$2,$3,$4,$5)",
          [target.id, "covert", result.targetEvent, target.turn, reportId],
        );
      return ({
        ok: true,
        success: result.success,
        killed: result.killed,
        event: result.assassinEvent,
        updates: assassinAttackerUpdates,
      });
    } else if (op === "sabotage") {
      const ninjasSent = Math.max(1, parseInt(units) || 0);
      if (ninjasSent > commandHandler.getAvailableUnits(attackerK, "ninjas")) {
        throw httpError(400, "Not enough available ninjas");
      }

      result = await commandHandler.handle(
        { type: 'covert-sabotage', target, ninjasSent, bldType },
        { kingdom: attackerK },
      );
      if (result.error) {
        throw httpError(400, result.error);
      }

      const sabotageAttackerUpdates = { ...(result.assassinUpdates || {}) };
      sabotageAttackerUpdates.turns_stored = (attackerK.turns_stored || 0) - 1;
      await applyKingdomUpdates(attackerK.id, result.assassinUpdates || {});
      await applyKingdomUpdates(target.id, result.targetUpdates || {});

      await db.run(
        "UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = $1",
        [attackerK.id],
      );

      const logRes = await db.run(
        `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
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
          "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES ($1,$2,$3,$4,$5)",
          [attackerK.id, "covert", result.assassinEvent, attackerK.turn, reportId],
        );

      if (result.targetEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES ($1,$2,$3,$4,$5)",
          [target.id, "covert", result.targetEvent, target.turn, reportId],
        );

      return ({
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
        throw httpError(400, "Not enough thieves");
      }
      result = await commandHandler.handle(
        { type: 'raid-trade-route', target, thievesSent },
        { kingdom: attackerK },
      );
      if (result.error) {
        throw httpError(400, result.error);
      }
      const raidAttackerUpdates = { ...(result.attackerUpdates || {}) };
      raidAttackerUpdates.turns_stored = (attackerK.turns_stored || 0) - 1;
      await applyKingdomUpdates(attackerK.id, result.attackerUpdates || {});
      await applyKingdomUpdates(target.id, result.defenderUpdates || {});
      await db.run(
        "UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = $1",
        [attackerK.id],
      );
      if (result.atkEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)",
          [attackerK.id, "covert", result.atkEvent, attackerK.turn],
        );
      if (result.defEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)",
          [target.id, "covert", result.defEvent, target.turn],
        );
      await db.run(
        `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
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
      return ({
        ok: true,
        success: result.success,
        looted: result.looted,
        event: result.atkEvent,
        updates: raidAttackerUpdates,
      });
    } else {
      throw httpError(400, "Unknown covert operation");
    }
      });
      return res.json(response);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
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
    const k = await db.get("SELECT id, race, population, fighters, rangers, mages, clerics, thieves, ninjas, researchers, engineers, scribes, war_machines FROM kingdoms WHERE player_id = $1", [
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
    res.json({ ok: true, updates: structureUpdates(updates) });
  });

  // â"€â"€ Defense overview â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  router.get("/defense/overview", requireAuth, async (req, res) => {
    const k = await db.get(
      `SELECT id, race, region, prestige_level, bld_walls, bld_guard_towers, bld_outposts, bld_castles,
              war_machines, ballistae, thieves, rangers, wall_upgrades, tower_def_upgrades,
              outpost_upgrades, defense_upgrades, alliance_buffs, res_war_machines,
              troop_levels, fragment_bonuses, wall_hp, wall_defense_type
       FROM kingdoms WHERE player_id = $1`,
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
      defense_rating: commandHandler.defenseRating(k),
      wall_power: commandHandler.wallDefensePower(k),
      tower_power: commandHandler.towerDetectionPower(k),
      outpost_power: commandHandler.outpostRangerPower(k),
      citadel_req: commandHandler.getConstants().CITADEL_REQ,
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
      const k = await db.get("SELECT id FROM kingdoms WHERE player_id = $1", [
        req.player.playerId,
      ]);
      if (!k) return res.status(404).json({ error: "Kingdom not found" });
      const rows = await db.all(
        `SELECT id, target_id, target_name, outcome, report, shared_to_alliance, created_at
         FROM spy_reports WHERE kingdom_id = $1 ORDER BY created_at DESC LIMIT 100`,
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
      const k = await db.get("SELECT id FROM kingdoms WHERE player_id = $1", [
        req.player.playerId,
      ]);
      if (!k) return res.status(404).json({ error: "Kingdom not found" });
      const report = await db.get(
        "SELECT id, shared_to_alliance FROM spy_reports WHERE id = $1 AND kingdom_id = $2",
        [req.params.id, k.id],
      );
      if (!report) return res.status(404).json({ error: "Report not found" });
      const newVal = (report.shared_to_alliance === 1 || report.shared_to_alliance === "1") ? 0 : 1;
      await db.run(
        "UPDATE spy_reports SET shared_to_alliance = $1 WHERE id = $2",
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
      const k = await db.get("SELECT id FROM kingdoms WHERE player_id = $1", [
        req.player.playerId,
      ]);
      if (!k) return res.status(404).json({ error: "Kingdom not found" });
      const membership = await db.get(
        "SELECT alliance_id FROM alliance_members WHERE kingdom_id = $1",
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
        WHERE am.alliance_id = $1 AND sr.shared_to_alliance = 1
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
