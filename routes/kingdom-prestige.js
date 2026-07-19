'use strict';

// Prestige & Dragon Evolution — split out of routes/kingdom-gameplay.js
// (A2-5, 2026-07-19). Kingdom rebirth (game/prestige/) and the Dragon
// Evolution ritual (game/evolution/) are genuinely coupled, not just
// adjacent by naming: GET /evolution reads prestige_level as its unlock
// gate (evolution.EVOLUTION_PRESTIGE_GATE), so evolution progress is
// meta-gated behind prestige progress. Neither goes through
// CommandHandler; that's intentional policy (A5-2, Policy B) — see
// game/COMMAND_COVERAGE.md's "Prestige — deliberately not CommandHandler"
// note (COMMAND_TYPES has a `prestige` entry but it's a working fence
// that throws, directing callers to this route instead).

const express = require('express');
const { requireAuth, requireCsrfToken } = require('./middleware');
const { structureUpdates } = require('./response-structurer');
const { applyUpdates } = require('./lib/kingdom-turn-helpers');

const router = express.Router();

module.exports = function (db) {
  // FOR UPDATE serializes rebirth vs concurrent /turn on the same kingdom.
  router.post("/rebirth", requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const prestigeApi = require('../game/prestige');
      let kingdomId;
      const payload = await db.withTransaction(async () => {
        const k = await db.get(
          'SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE',
          [req.player.playerId],
        );
        if (!k) {
          const err = new Error('Kingdom not found');
          err.statusCode = 404;
          throw err;
        }
        if (!prestigeApi.canPrestige(k)) {
          const err = new Error(
            `Require Kingdom Level ${prestigeApi.PRESTIGE_LEVEL_GATE} to Rebirth (or cooldown / ritual active).`,
          );
          err.statusCode = 400;
          throw err;
        }
        const result = prestigeApi.processPrestige(k);
        if (result.error) {
          const err = new Error(result.error);
          err.statusCode = 400;
          throw err;
        }
        await applyUpdates(db, k.id, result.updates);
        await prestigeApi.applyPrestigeSideEffects(db, k.id);
        kingdomId = k.id;
        return {
          prestige_level: result.updates.prestige_level,
          updates: result.updates,
          seeds: result.seeds,
          newPrestigeLevel: result.newPrestigeLevel,
        };
      });

      // News best-effort after commit — prestige stands if this fails
      try {
        const title = prestigeApi.getPrestigeTitle(payload.prestige_level);
        await db.run(
          'INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)',
          [
            kingdomId,
            'system',
            `You have transcended (${title}, Prestige ${payload.prestige_level}). A new era begins.`,
            payload.updates.turn || 0,
          ],
        );
      } catch (newsErr) {
        console.error('[rebirth] news insert failed (prestige stands):', newsErr.message);
      }

      res.json({
        ok: true,
        prestige_level: payload.prestige_level,
        seeds: payload.seeds,
        title: prestigeApi.getPrestigeTitle(payload.prestige_level),
        modifiers: prestigeApi.getPrestigeModifiers(payload.prestige_level),
        updates: structureUpdates(payload.updates),
      });
    } catch (err) {
      const code = err.statusCode || 500;
      if (code >= 500) console.error('[rebirth]', err);
      res.status(code).json({ error: err.message || 'Rebirth failed' });
    }
  });

  // Dragon evolution ritual — egg consumed on start; TX + FOR UPDATE
  router.post("/evolution/start", requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const evolution = require('../game/evolution');
      const payload = await db.withTransaction(async () => {
        const k = await db.get(
          'SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE',
          [req.player.playerId],
        );
        if (!k) {
          const err = new Error('Kingdom not found');
          err.statusCode = 404;
          throw err;
        }
        const result = evolution.startDragonRitual(k);
        if (result.error) {
          const err = new Error(result.error);
          err.statusCode = 400;
          throw err;
        }
        await applyUpdates(db, k.id, result.updates);
        return { ritual: result.ritual, updates: result.updates };
      });
      res.json({
        ok: true,
        ritual: payload.ritual,
        updates: structureUpdates(payload.updates),
      });
    } catch (err) {
      const code = err.statusCode || 500;
      if (code >= 500) console.error('[evolution/start]', err);
      res.status(code).json({ error: err.message || 'Evolution start failed' });
    }
  });

  router.post("/evolution/abort", requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const evolution = require('../game/evolution');
      const payload = await db.withTransaction(async () => {
        const k = await db.get(
          'SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE',
          [req.player.playerId],
        );
        if (!k) {
          const err = new Error('Kingdom not found');
          err.statusCode = 404;
          throw err;
        }
        const result = evolution.abortDragonRitual(k);
        if (result.error) {
          const err = new Error(result.error);
          err.statusCode = 400;
          throw err;
        }
        await applyUpdates(db, k.id, result.updates);
        return { updates: result.updates };
      });
      res.json({ ok: true, updates: structureUpdates(payload.updates) });
    } catch (err) {
      const code = err.statusCode || 500;
      if (code >= 500) console.error('[evolution/abort]', err);
      res.status(code).json({ error: err.message || 'Evolution abort failed' });
    }
  });

  router.get("/evolution", requireAuth, async (req, res) => {
    try {
      const evolution = require('../game/evolution');
      const k = await db.get(
        `SELECT prestige_level, bld_castles, evolution_form, evolution_ritual, items
         FROM kingdoms WHERE player_id = $1`,
        [req.player.playerId],
      );
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });
      const gate = evolution.canStartDragonRitual(k);
      res.json({
        form: k.evolution_form || '',
        ritual: evolution.parseRitual(k.evolution_ritual),
        hasEgg: evolution.hasDragonEgg(k),
        isDragon: evolution.isDragon(k),
        isChanneling: evolution.isChanneling(k),
        canStart: gate.ok,
        canStartError: gate.ok ? null : gate.error,
        prestigeGate: evolution.EVOLUTION_PRESTIGE_GATE,
        ritualTurns: evolution.RITUAL_TURNS,
        modifiers: evolution.isDragon(k) ? evolution.DRAGON_FORM : null,
      });
    } catch (err) {
      console.error('[evolution]', err);
      res.status(500).json({ error: err.message || 'Evolution status failed' });
    }
  });

  return router;
};
