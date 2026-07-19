'use strict';

// AI kingdom management (hiatus/synopsis/seed/reset/presets) — split out of
// routes/admin.js (A2-9, 2026-07-19). requireAdmin + CSRF are applied once
// by the composer (routes/admin.js) before this router is mounted.

const express = require('express');
const bcrypt = require('bcrypt');
const commandHandler = require('../game/command-handler');
const { PRESETS, PRESET_IDS, buildPresetFields } = require('../game/ai-presets');
const { seedFirstRingNode } = require('../game/first-ring-node');
const { pgSetClause } = require('../lib/pg-placeholders');
const {
  BCRYPT_SALT_ROUNDS,
  TEST_RACES,
  buildStartingProfile,
  resetKingdomLogic,
} = require('./lib/admin-kingdom-helpers');

const router = express.Router();

module.exports = function (db) {

  router.get("/ai-hiatus", async (_req, res) => {
    try {
      const row = await db.get("SELECT value FROM server_state WHERE key = 'ai_hiatus'");
      res.json({ hiatus: row ? row.value === 'true' : false });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

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
          const region = commandHandler.assignRegion(race);
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
          seedFirstRingNode(db, kingdom.id, race).catch((err) =>
            console.error(`[admin] Failed to seed first-ring node for AI kingdom ${kingdom.id}:`, err.message)
          );
        }

        results.push({ race, username, kingdomName, kingdomId: kingdom.id, created });
      }

      res.json({ ok: true, created: results.filter(r => r.created).length, total: results.length, results });
    } catch (e) {
      console.error('[admin] ai/seed error:', e.message);
      res.status(500).json({ error: e.message });
    }
  });

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

  router.get("/ai/presets", (_req, res) => {
    const list = PRESET_IDS.map(id => ({
      id,
      label: PRESETS[id].label,
      description: PRESETS[id].description,
    }));
    res.json(list);
  });

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

  return router;
};
