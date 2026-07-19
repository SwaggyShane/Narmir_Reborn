'use strict';

// Forge & Lava Industry — split out of routes/kingdom-gameplay.js (A2-4,
// 2026-07-18). Toolwright Yard -> Engineers Lodge -> Forge upgrade chain,
// steel/tempered-steel production, Flux-Barge fleet, and lava-draw
// expeditions/vents that feed the same barge fleet + lava_stored economy.
//
// Distinct from the older /smithy/forge-tools route (hammers/scaffolding),
// which stays in kingdom-gameplay.js — see game/COMMAND_COVERAGE.md's
// "legacy smithy tools, not Forge & Lava" note. None of these routes go
// through CommandHandler; that's intentional policy (A5-2, Policy B) for
// already-modularized systems, not a gap.

const express = require('express');
const { requireAuth, requireCsrfToken } = require('./middleware');
const { getKingdomMapCoords } = require('../game/world-map-coords');
const { parseTroopLevel } = require('../game/lib/troops');
const { structureUpdates } = require('./response-structurer');

const router = express.Router();

module.exports = function (db) {
  // POST /forge/install-upgrade — Yard → Lodge → Forge chain
  router.post('/forge/install-upgrade', requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const forgeUpgrades = require('../game/forge-upgrades');
      const upgrade = req.body?.upgrade;
      if (!upgrade || typeof upgrade !== 'string') {
        return res.status(400).json({ error: 'upgrade required' });
      }
      const k = await db.get(
        `SELECT id, wood, stone, iron, gold, toolwright_yard, engineers_lodge, forge, flux_barges
         FROM kingdoms WHERE player_id = $1`,
        [req.player.playerId],
      );
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      const result = forgeUpgrades.installUpgrade(k, upgrade);
      if (result.error) return res.status(400).json({ error: result.error });

      const u = result.updates;
      const sets = ['wood = $1', 'stone = $2', 'iron = $3', 'gold = $4', 'updated_at = $5'];
      const params = [u.wood, u.stone, u.iron, u.gold, u.updated_at];
      let p = 6;
      if (u.toolwright_yard !== undefined) {
        sets.push(`toolwright_yard = $${p++}`);
        params.push(u.toolwright_yard);
      }
      if (u.engineers_lodge !== undefined) {
        sets.push(`engineers_lodge = $${p++}`);
        params.push(u.engineers_lodge);
      }
      if (u.forge !== undefined) {
        sets.push(`forge = $${p++}`);
        params.push(u.forge);
      }
      if (u.flux_barges !== undefined) {
        sets.push(`flux_barges = $${p++}`);
        params.push(u.flux_barges);
      }
      params.push(k.id);
      await db.run(
        `UPDATE kingdoms SET ${sets.join(', ')} WHERE id = $${p}`,
        params,
      );

      const status = forgeUpgrades.upgradeStatus({ ...k, ...u });
      return res.json({
        ok: true,
        message: `Installed ${upgrade.replace(/_/g, ' ')}`,
        upgrade,
        cost: result.cost,
        forge: status,
        flux_barges: u.flux_barges ? JSON.parse(u.flux_barges) : undefined,
      });
    } catch (e) {
      console.error('[forge/install-upgrade] POST:', e.message);
      res.status(500).json({ error: 'Failed to install forge upgrade' });
    }
  });

  // ── Forge production ────────────────────────────────────────────────────
  router.post('/forge/charcoal-allocate', requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const forgeProd = require('../game/forge-production');
      const wood = req.body?.wood;
      const k = await db.get(
        `SELECT id, forge, wood, charcoal_wood_allocation FROM kingdoms WHERE player_id = $1`,
        [req.player.playerId],
      );
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });
      const result = forgeProd.setCharcoalAllocation(k, wood);
      if (result.error) return res.status(400).json({ error: result.error });
      await db.run(
        `UPDATE kingdoms SET charcoal_wood_allocation = $1, updated_at = $2 WHERE id = $3`,
        [result.updates.charcoal_wood_allocation, result.updates.updated_at, k.id],
      );
      return res.json({
        ok: true,
        charcoal_wood_allocation: result.updates.charcoal_wood_allocation,
      });
    } catch (e) {
      console.error('[forge/charcoal-allocate] POST:', e.message);
      res.status(500).json({ error: 'Failed to set charcoal allocation' });
    }
  });

  router.post('/forge/smelt', requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const forgeProd = require('../game/forge-production');
      const k = await db.get(
        `SELECT id, race, forge, iron, coal, steel FROM kingdoms WHERE player_id = $1`,
        [req.player.playerId],
      );
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });
      const result = forgeProd.smeltSteel(k, req.body?.batches);
      if (result.error) return res.status(400).json({ error: result.error });
      const u = result.updates;
      await db.run(
        `UPDATE kingdoms SET iron = $1, coal = $2, steel = $3, updated_at = $4 WHERE id = $5`,
        [u.iron, u.coal, u.steel, u.updated_at, k.id],
      );
      return res.json({
        ok: true,
        batches: result.batches,
        steelOut: result.steelOut,
        steel: u.steel,
        coal: u.coal,
        iron: u.iron,
      });
    } catch (e) {
      console.error('[forge/smelt] POST:', e.message);
      res.status(500).json({ error: 'Failed to smelt steel' });
    }
  });

  router.post('/forge/temper', requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const forgeProd = require('../game/forge-production');
      const k = await db.get(
        `SELECT id, race, forge, engineer_level, steel, lava_stored, tempered_steel, troop_levels
         FROM kingdoms WHERE player_id = $1`,
        [req.player.playerId],
      );
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });
      const engLvl = parseTroopLevel(k.troop_levels, 'engineers') || k.engineer_level || 1;
      const result = forgeProd.temperSteel(k, req.body?.batches, Math.max(engLvl, k.engineer_level || 1));
      if (result.error) return res.status(400).json({ error: result.error });
      const u = result.updates;
      await db.run(
        `UPDATE kingdoms SET steel = $1, lava_stored = $2, tempered_steel = $3, updated_at = $4 WHERE id = $5`,
        [u.steel, u.lava_stored, u.tempered_steel, u.updated_at, k.id],
      );
      return res.json({
        ok: true,
        batches: result.batches,
        temperedOut: result.temperedOut,
        displayName: result.displayName,
        tempered_steel: u.tempered_steel,
        steel: u.steel,
        lava_stored: u.lava_stored,
      });
    } catch (e) {
      console.error('[forge/temper] POST:', e.message);
      res.status(500).json({ error: 'Failed to temper steel' });
    }
  });

  router.post('/forge/craft-gear', requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const forgeProd = require('../game/forge-production');
      const type = req.body?.type;
      const qty = req.body?.qty;
      const k = await db.get(
        `SELECT id, race, forge, engineer_level, gold, steel, tempered_steel,
                steel_weapons, steel_armor, tempered_weapons, tempered_armor, troop_levels
         FROM kingdoms WHERE player_id = $1`,
        [req.player.playerId],
      );
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });
      const engLvl = Math.max(
        parseTroopLevel(k.troop_levels, 'engineers') || 1,
        k.engineer_level || 1,
      );
      const result = forgeProd.craftGear(k, type, qty, engLvl);
      if (result.error) return res.status(400).json({ error: result.error });
      const u = result.updates;
      const cols = ['gold = $1', 'updated_at = $2'];
      const params = [u.gold, u.updated_at];
      let p = 3;
      for (const col of [
        'steel',
        'tempered_steel',
        'steel_weapons',
        'steel_armor',
        'tempered_weapons',
        'tempered_armor',
      ]) {
        if (u[col] !== undefined) {
          cols.push(`${col} = $${p++}`);
          params.push(u[col]);
        }
      }
      params.push(k.id);
      await db.run(`UPDATE kingdoms SET ${cols.join(', ')} WHERE id = $${p}`, params);
      return res.json({
        ok: true,
        type: result.type,
        qty: result.qty,
        stock: u[type],
        gold: u.gold,
      });
    } catch (e) {
      console.error('[forge/craft-gear] POST:', e.message);
      res.status(500).json({ error: 'Failed to craft gear' });
    }
  });

  // POST /forge/build-barge — queue extra Flux-Barge
  router.post('/forge/build-barge', requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const fluxBarge = require('../game/flux-barge');
      const k = await db.get(
        `SELECT id, forge, engineer_level, troop_levels, steel, gold, stone, flux_barges
         FROM kingdoms WHERE player_id = $1`,
        [req.player.playerId],
      );
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });
      const engLvl = Math.max(
        parseTroopLevel(k.troop_levels, 'engineers') || 1,
        k.engineer_level || 1,
      );
      const result = fluxBarge.queueExtraBarge(k, engLvl);
      if (result.error) return res.status(400).json({ error: result.error });
      const u = result.updates;
      await db.run(
        `UPDATE kingdoms SET steel = $1, gold = $2, stone = $3, flux_barges = $4, updated_at = $5 WHERE id = $6`,
        [u.steel, u.gold, u.stone, u.flux_barges, u.updated_at, k.id],
      );
      return res.json({
        ok: true,
        barge_id: result.bargeId,
        turns: result.turns,
        flux_barges: fluxBarge.parseBarges(u.flux_barges),
        steel: u.steel,
        gold: u.gold,
        stone: u.stone,
      });
    } catch (e) {
      console.error('[forge/build-barge] POST:', e.message);
      res.status(500).json({ error: 'Failed to queue Flux-Barge' });
    }
  });

  // POST /expedition/lava-draw — all-or-nothing lava expedition
  router.post('/expedition/lava-draw', requireAuth, requireCsrfToken, async (req, res) => {
    const { target_x, target_y, barge_id } = req.body;
    const { isTargetInBounds } = require('../game/epic-trek-paths');
    const lavaExp = require('../game/lava-expedition');

    try {
      if (!Number.isFinite(target_x) || !Number.isFinite(target_y)) {
        return res.status(400).json({ error: 'Invalid target coordinates' });
      }
      if (!isTargetInBounds(target_x, target_y)) {
        return res.status(400).json({ error: 'Target is outside map bounds' });
      }
      if (!Number.isFinite(barge_id)) {
        return res.status(400).json({ error: 'barge_id required' });
      }

      const result = await db.withTransaction(async () => {
        const k = await db.get('SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE', [
          req.player.playerId,
        ]);
        if (!k) {
          const err = new Error('Kingdom not found');
          err.statusCode = 404;
          throw err;
        }

        const existing = await db.get(
          "SELECT id FROM expeditions WHERE kingdom_id = $1 AND type = 'lava-draw' AND turns_left > 0",
          [k.id],
        );
        if (existing) {
          const err = new Error('A lava draw is already underway');
          err.statusCode = 400;
          throw err;
        }

        const homeCoords = getKingdomMapCoords(k);
        const { getFlag } = require('../game/feature-flags');
        const { hasElevationGrid, getElevationGrid } = require('../game/world-elevation-cache');
        const launch = lavaExp.buildLaunch(k, target_x, target_y, barge_id, {
          homeCoords,
          turnOpts: { getFlag, elevationGrid: hasElevationGrid() ? getElevationGrid() : null },
        });
        if (launch.error) {
          const err = new Error(launch.error);
          err.statusCode = 400;
          throw err;
        }

        const u = launch.updates;
        await db.run(
          `UPDATE kingdoms SET engineers = $1, mages = $2, food = $3, turns_stored = $4, flux_barges = $5 WHERE id = $6`,
          [u.engineers, u.mages, u.food, u.turns_stored, u.flux_barges, k.id],
        );

        await db.run(
          `INSERT INTO expeditions (kingdom_id, type, turns_left, rangers, fighters, food_taken, extra_data)
           VALUES ($1, 'lava-draw', $2, 0, 0, $3, $4)`,
          [
            k.id,
            launch.turnsTotal,
            launch.foodNeeded,
            JSON.stringify({
              path_hexes: launch.pathHexes,
              target_x: launch.targetX,
              target_y: launch.targetY,
              target_hex_col: launch.targetHexCol,
              target_hex_row: launch.targetHexRow,
              barge_id: launch.bargeId,
            }),
          ],
        );

        return launch;
      });

      res.json({
        ok: true,
        turns_left: result.turnsTotal,
        food_used: result.foodNeeded,
        path_hexes: result.pathHexes.length,
        message: `Lava draw launched to (${Math.round(target_x)}, ${Math.round(target_y)}) — ${result.turnsTotal} turns round trip. All or nothing.`,
        // Launching deducts engineers/mages/food/turns_stored and marks the
        // chosen barge busy (flux_barges) directly via SQL above — none of
        // that reached the client before, so its engineer/mage/food/turns
        // counts and barge availability went stale until an unrelated
        // refresh caught up.
        updates: structureUpdates({
          engineers: result.updates.engineers,
          mages: result.updates.mages,
          food: result.updates.food,
          turns_stored: result.updates.turns_stored,
          flux_barges: result.updates.flux_barges,
        }),
      });
    } catch (err) {
      console.error('[expedition/lava-draw] failed:', err.message);
      if (err.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      res.status(500).json({ error: 'Lava draw failed — please try again' });
    }
  });

  // GET /lava-vent?hex_col=&hex_row= — read-only vent status for the volcanic
  // hex card (no row yet means ACTIVE + Free, matching game/lava-vents.js's
  // getVentState default exactly).
  router.get('/lava-vent', requireAuth, async (req, res) => {
    try {
      const hexCol = parseInt(req.query.hex_col, 10);
      const hexRow = parseInt(req.query.hex_row, 10);
      if (!Number.isFinite(hexCol) || !Number.isFinite(hexRow)) {
        return res.status(400).json({ error: 'hex_col and hex_row required' });
      }
      const { getVentState } = require('../game/lava-vents');
      const state = await getVentState(db, hexCol, hexRow);
      res.json(state);
    } catch (err) {
      console.error('[lava-vent] GET failed:', err.message);
      res.status(500).json({ error: 'Failed to fetch vent status' });
    }
  });

  return router;
};
