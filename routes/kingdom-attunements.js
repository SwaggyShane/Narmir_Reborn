'use strict';

// Inventory, World Fragment Attunements, and Synergies — split out of
// routes/kingdom-gameplay.js (A2-6, 2026-07-19). Bundled as one file because
// they share real state, not just naming: a kingdom's fragment_bonuses column
// IS its attunement placements, and synergies are derived directly from those
// placements (attunementManager.getContributingSynergies/getSynergyStatus/
// getActiveSynergy all read the same fragment_bonuses-derived attunement map
// that /attune-fragment and /remove-attunement write). Inventory (raw item
// storage) is a separate, unrelated concern that happened to sit adjacent in
// the original file — kept in this file rather than split further since it's
// a single small read-only route, not worth its own file.
//
// None of these routes go through CommandHandler; that's intentional policy
// (A5-2, Policy B) for already-modularized systems.

const express = require('express');
const config = require('../game/config');
const { requireAuth, requireCsrfToken } = require('./middleware');
const { safeJsonParse, devLog } = require('../utils/helpers');
const { getKingdomAttunements } = require('../game/fragment-attunements');
const attunementManager = require('../game/attunement-manager');
const synergiesModule = require('../game/fragment-synergies');
const abilityManager = require('../game/active-ability-manager');
const { applyKingdomUpdates } = require('../db/schema');
const { repairMojibake } = require('./lib/kingdom-turn-helpers');

const router = express.Router();

// Kingdoms we've already logged deprecated-inventory items for, so the warning fires
// once per process instead of on every (frequently polled) inventory fetch.
const _loggedDeprecatedInventory = new Set();

module.exports = function (db) {
  // â"€â"€ Inventory â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  router.get('/inventory', requireAuth, async (req, res) => {
    try {
      const k = await db.get('SELECT id, items FROM kingdoms WHERE player_id = $1', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      const { INVENTORY_ITEMS } = config;
      let items = safeJsonParse(k.items, [], 'inventory:items');
      if (!Array.isArray(items)) items = [];

      // Format inventory with descriptions
      const formatted = {};
      const deprecated = [];
      for (const item of items) {
        if (item.qty && item.qty > 0) {
          if (INVENTORY_ITEMS[item.id]) {
            formatted[item.id] = {
              name: INVENTORY_ITEMS[item.id].name,
              desc: INVENTORY_ITEMS[item.id].desc,
              count: item.qty,
              rarity: INVENTORY_ITEMS[item.id].rarity
            };
          } else if (!(typeof item.name === 'string' && item.name.includes('Fragment'))) {
            // Log non-fragment deprecated items. item.name/id may be legacy
            // non-string values from a defunct pre-string-slug item format
            // (no current writer produces this — see game/lib/items.js) —
            // tolerate rather than crash.
            deprecated.push(`${item.id}x${item.qty}`);
          }
        }
      }

      // Log deprecated items once per kingdom per process (the inventory endpoint is
      // polled frequently, so logging on every request just spams the error stream).
      if (deprecated.length > 0 && !_loggedDeprecatedInventory.has(k.id)) {
        _loggedDeprecatedInventory.add(k.id);
        console.warn(`[inventory] Kingdom ${k.id} has deprecated items: ${deprecated.join(', ')}`);
      }

      res.json(formatted);
    } catch (err) {
      console.error('[inventory] failed:', err.message);
      res.status(500).json({ error: 'Failed to fetch inventory' });
    }
  });

  // â"€â"€ WORLD FRAGMENT ATTUNEMENTS â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  // GET /api/kingdom/attunements — Get current attunement status
  router.get('/attunements', requireAuth, async (req, res) => {
    try {
      const kingdom = await db.get("SELECT id, fragment_bonuses, world_fragments FROM kingdoms WHERE player_id = $1", [
        req.player.playerId,
      ]);
      if (!kingdom) return res.status(404).json({ error: "Kingdom not found" });

      const status = attunementManager.getAttunementStatus(kingdom);
      res.json({
        ok: true,
        attunements: status,
        total: status.length,
      });
    } catch (err) {
      console.error('[attunement] get status failed:', err.message);
      res.status(500).json({ error: 'Failed to fetch attunement status' });
    }
  });

  // GET /api/kingdom/available-attunements — Get available attunement options
  router.get('/available-attunements', requireAuth, async (req, res) => {
    try {
      const kingdom = await db.get(
        `SELECT id, fragment_bonuses, world_fragments, bld_farms, bld_barracks, bld_markets,
                bld_schools, bld_mage_towers, bld_shrines, bld_guard_towers, bld_castles,
                bld_smithies, bld_libraries, bld_taverns, bld_mausoleums, bld_walls,
                bld_outposts, bld_granaries, bld_housing, bld_training, bld_vaults, bld_armories
         FROM kingdoms WHERE player_id = $1`,
        [req.player.playerId]
      );
      if (!kingdom) return res.status(404).json({ error: "Kingdom not found" });

      const available = attunementManager.getAvailableAttunements(kingdom);
      res.json({
        ok: true,
        available,
        count: available.reduce((sum, f) => sum + f.buildings.length, 0),
      });
    } catch (err) {
      console.error('[attunement] get available failed:', err.message);
      res.status(500).json({ error: 'Failed to fetch available attunements' });
    }
  });

  // POST /api/kingdom/attune-fragment — Apply a fragment attunement to a building
  router.post('/attune-fragment', requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const { fragmentName, buildingType } = req.body;

      // Validate input
      if (!fragmentName || !buildingType) {
        return res.status(400).json({ error: 'fragmentName and buildingType required' });
      }

      const kingdom = await db.get(
        `SELECT id, turn, fragment_bonuses, world_fragments, bld_farms, bld_barracks, bld_markets,
                bld_schools, bld_mage_towers, bld_shrines, bld_guard_towers, bld_castles,
                bld_smithies, bld_libraries, bld_taverns, bld_mausoleums, bld_walls,
                bld_outposts, bld_granaries, bld_housing, bld_training, bld_vaults, bld_armories
         FROM kingdoms WHERE player_id = $1`,
        [req.player.playerId]
      );
      if (!kingdom) return res.status(404).json({ error: "Kingdom not found" });

      // Apply attunement logic
      const result = attunementManager.applyAttunement(kingdom, fragmentName, buildingType);
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }

      await db.run(
        `UPDATE kingdoms SET fragment_bonuses = $1 WHERE id = $2`,
        [result.fragment_bonuses, kingdom.id]
      );

      await db.run(
        "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1, $2, $3, $4)",
        [
          kingdom.id,
          "system",
          repairMojibake(
            `âœ¨ ${fragmentName} attuned to ${buildingType.replace(/_/g, " ")}! ${result.attunement.special?.name ? `${result.attunement.special.name}.` : "Fragment power resonates through the structure."}`,
          ),
          kingdom.turn || 0,
        ]
      );

      res.json({
        ok: true,
        attunement: result.attunement,
        message: `${fragmentName} attuned to ${buildingType}`,
      });

      devLog(`[attunement] Kingdom ${kingdom.id}: ${fragmentName} â†’ ${buildingType}`);
    } catch (err) {
      console.error('[attunement] apply failed:', err.message);
      res.status(500).json({ error: 'Failed to apply attunement' });
    }
  });

  // POST /api/kingdom/remove-attunement — Remove fragment attunement from building
  router.post('/remove-attunement', requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const { buildingType } = req.body;

      if (!buildingType) {
        return res.status(400).json({ error: 'buildingType required' });
      }

      const result = await db.withTransaction(async () => {
        const kingdom = await db.get("SELECT id, fragment_bonuses FROM kingdoms WHERE player_id = $1 FOR UPDATE", [
          req.player.playerId,
        ]);
        if (!kingdom) {
          const err = new Error("Kingdom not found");
          err.statusCode = 404;
          throw err;
        }

        // Check if any synergy cooldown is active — if so, block removal to prevent synergy-hopping
        const now = Math.floor(Date.now() / 1000);
        const activeCooldown = await db.get(
          "SELECT synergy_id FROM synergy_cooldowns WHERE kingdom_id = $1 AND cooldown_until > $2 LIMIT 1",
          [kingdom.id, now]
        );
        if (activeCooldown) {
          const err = new Error(
            "Cannot remove attunements while a synergy cooldown is active. Wait for the cooldown to expire.",
          );
          err.statusCode = 429;
          throw err;
        }

        const currentAttunements = getKingdomAttunements(kingdom.fragment_bonuses || '{}');

        if (!Object.prototype.hasOwnProperty.call(currentAttunements, buildingType)) {
          const err = new Error(`${buildingType} has no attunement`);
          err.statusCode = 400;
          throw err;
        }

        delete currentAttunements[buildingType];

        await db.run(
          `UPDATE kingdoms SET fragment_bonuses = $1 WHERE id = $2`,
          [JSON.stringify(currentAttunements), kingdom.id]
        );

        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1, $2, $3, $4)",
          [
            kingdom.id,
            "system",
            repairMojibake(
              `âœ¨ Attunement removed from ${buildingType.replace(/_/g, " ")}. The fragment's resonance fades.`,
            ),
            kingdom.turn || 0,
          ]
        );

        return { kingdomId: kingdom.id, buildingType };
      });

      res.json({
        ok: true,
        message: `Attunement removed from ${result.buildingType}`,
      });

      devLog(`[attunement] Kingdom ${result.kingdomId}: Removed from ${result.buildingType}`);
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      console.error('[attunement] remove failed:', err.message);
      res.status(500).json({ error: 'Failed to remove attunement' });
    }
  });

  // GET /api/kingdom/contributing-synergies — Check which synergies a building/fragment contributes to
  // Returns an opaque "resonance" tier instead of the synergy recipes so the
  // client can't reveal the formula via devtools — players discover combos
  // by experimentation, not by reading network responses.
  router.get('/contributing-synergies', requireAuth, async (req, res) => {
    try {
      const { building_type, fragment_name } = req.query;
      if (!building_type || !fragment_name) {
        return res.status(400).json({ error: 'building_type and fragment_name required' });
      }

      const contributing = attunementManager.getContributingSynergies(building_type, fragment_name);

      let resonanceTier = null;
      if (contributing.length > 0) {
        const kingdom = await db.get(
          "SELECT fragment_bonuses FROM kingdoms WHERE player_id = $1",
          [req.player.playerId]
        );
        const placements = {};
        if (kingdom) {
          const atts = getKingdomAttunements(kingdom.fragment_bonuses || '{}');
          for (const [bld, att] of Object.entries(atts)) {
            if (att) placements[bld] = att;
          }
        }
        let best = 0;
        for (const syn of contributing) {
          const reqs = syn.requiredFragments || {};
          let satisfied = 0;
          for (const [fragName, reqBld] of Object.entries(reqs)) {
            if (placements[reqBld] === fragName) satisfied++;
          }
          if (satisfied > best) best = satisfied;
        }
        if (best >= 7) resonanceTier = 'convergence';
        else if (best >= 4) resonanceTier = 'alignment';
        else resonanceTier = 'faint';
      }

      res.json({
        // Keep names/emojis out — they would let players reverse-engineer
        // which combos contribute. Only signal whether ANY contribution exists.
        contributes: contributing.length > 0,
        contributingCount: contributing.length,
        resonanceTier,
      });
    } catch (err) {
      console.error('[synergy] contributing check failed:', err.message);
      res.status(500).json({ error: 'Failed to check contributing synergies' });
    }
  });

  // GET /api/kingdom/synergy-status — Get active synergy and near-activation hints
  router.get('/synergy-status', requireAuth, async (req, res) => {
    try {
      const kingdom = await db.get(
        "SELECT id, fragment_bonuses FROM kingdoms WHERE player_id = $1",
        [req.player.playerId]
      );
      if (!kingdom) {
        return res.status(404).json({ error: 'Kingdom not found' });
      }

      const status = attunementManager.getSynergyStatus(kingdom);
      res.json(status);
    } catch (err) {
      console.error('[synergy] get status failed:', err.message);
      res.status(500).json({ error: 'Failed to fetch synergy status' });
    }
  });

  // GET /api/kingdom/synergy-cooldown — Check cooldown status for a synergy ability
  router.get('/synergy-cooldown', requireAuth, async (req, res) => {
    try {
      const { synergy_id } = req.query;
      if (!synergy_id) {
        return res.status(400).json({ error: 'synergy_id required' });
      }

      const kingdom = await db.get(
        "SELECT id FROM kingdoms WHERE player_id = $1",
        [req.player.playerId]
      );
      if (!kingdom) {
        return res.status(404).json({ error: 'Kingdom not found' });
      }

      // Check if cooldown exists in database
      const cooldown = await db.get(
        "SELECT cooldown_until FROM synergy_cooldowns WHERE kingdom_id = $1 AND synergy_id = $2",
        [kingdom.id, synergy_id]
      );

      if (!cooldown) {
        return res.json({
          on_cooldown: false,
          cooldown_remaining_seconds: 0,
          cooldown_remaining_days: 0,
          cooldown_remaining_formatted: 'Ready',
        });
      }

      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, cooldown.cooldown_until - now);
      const remainingDays = (remaining / 86400).toFixed(1);
      const hours = Math.floor((remaining % 86400) / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const seconds = remaining % 60;

      let formatted = 'Ready';
      if (remaining > 0) {
        if (remaining >= 86400) {
          formatted = `${Math.floor(remaining / 86400)}d ${hours}h remaining`;
        } else if (remaining >= 3600) {
          formatted = `${hours}h ${minutes}m remaining`;
        } else if (remaining >= 60) {
          formatted = `${minutes}m remaining`;
        } else {
          formatted = `${seconds}s remaining`;
        }
      }

      res.json({
        on_cooldown: remaining > 0,
        cooldown_remaining_seconds: remaining,
        cooldown_remaining_days: parseFloat(remainingDays),
        cooldown_remaining_formatted: formatted,
      });
    } catch (err) {
      console.error('[synergy] cooldown check failed:', err.message);
      res.status(500).json({ error: 'Failed to check cooldown status' });
    }
  });

  // POST /api/kingdom/activate-synergy-ability — Activate a synergy's active ability
  router.post('/activate-synergy-ability', requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const { synergy_id } = req.body;
      if (!synergy_id) {
        return res.status(400).json({ error: 'synergy_id required' });
      }

      // Use transaction to prevent race conditions where multiple requests could activate simultaneously
      const payload = await db.withTransaction(async () => {
        const kingdom = await db.get(
          "SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE",
          [req.player.playerId]
        );
        if (!kingdom) {
          const err = new Error('Kingdom not found');
          err.statusCode = 404;
          throw err;
        }

        const activeSynergy = attunementManager.getActiveSynergy(kingdom);
        if (!activeSynergy) {
          const err = new Error('No synergy currently active');
          err.statusCode = 400;
          throw err;
        }

        if (activeSynergy.id !== synergy_id) {
          const err = new Error('This synergy is not currently active');
          err.statusCode = 400;
          throw err;
        }

        const cooldown = await db.get(
          "SELECT cooldown_until FROM synergy_cooldowns WHERE kingdom_id = $1 AND synergy_id = $2 FOR UPDATE",
          [kingdom.id, synergy_id]
        );

        const now = Math.floor(Date.now() / 1000);
        if (cooldown && cooldown.cooldown_until > now) {
          const remaining = cooldown.cooldown_until - now;
          const err = new Error(
            `Ability still on cooldown. ${Math.ceil(remaining / 86400)} day(s) remaining`,
          );
          err.statusCode = 429;
          throw err;
        }

        const synergy = synergiesModule.getSynergy(synergy_id);
        if (!synergy) {
          const err = new Error('Invalid synergy ID');
          err.statusCode = 400;
          throw err;
        }

        const abilityResult = abilityManager.triggerAbility(kingdom, synergy_id);
        if (!abilityResult.ok) {
          const err = new Error(abilityResult.error);
          err.statusCode = 400;
          throw err;
        }

        const cooldownUntil = new Date(abilityResult.cooldownExpires).getTime() / 1000;

        const updates = {
          ...abilityResult.kingdom,
        };
        delete updates.id;

        await applyKingdomUpdates(kingdom.id, updates);

        await db.run(
          "INSERT INTO synergy_cooldowns (kingdom_id, synergy_id, cooldown_until) VALUES ($1, $2, $3) ON CONFLICT(kingdom_id, synergy_id) DO UPDATE SET cooldown_until = $4",
          [kingdom.id, synergy_id, Math.floor(cooldownUntil), Math.floor(cooldownUntil)]
        );

        const newsMessage = synergy.emoji + " " + synergy.name + ": " + (synergy.active?.name || "") + " activated! " + (synergy.active?.desc || "");
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1, $2, $3, $4)",
          [kingdom.id, 'synergy', newsMessage, kingdom.turn || 0]
        );

        return {
          kingdomId: kingdom.id,
          synergy_id,
          activeName: synergy.active?.name,
          cooldown_until: Math.floor(cooldownUntil),
          synergy: {
            id: synergy.id,
            name: synergy.name,
            active_name: synergy.active?.name,
          },
        };
      });

      devLog(`[synergy] Kingdom ${payload.kingdomId}: ${payload.synergy_id} ability activated by ${payload.activeName}`);

      res.json({
        ok: true,
        message: `${payload.activeName} activated!`,
        cooldown_until: payload.cooldown_until,
        synergy: payload.synergy,
      });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      console.error('[synergy] activate ability failed:', err.message);
      res.status(500).json({ error: 'Failed to activate synergy ability' });
    }
  });

  return router;
};
