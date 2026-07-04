const express = require('express');
const { requireAuth, requireCsrfToken } = require('./middleware');
const { progressGoal, generateGoals, claimGoal } = require('../game/goals');
const engine = require('../game/engine');
const config = require('../game/config');
const { applyKingdomUpdates } = require('../db/schema');
const { calculateHuntingReward } = require('../game/hunting-economy');
const { calculateProspectingReward } = require('../game/prospecting-economy');
const { calculateLandExpansionReward } = require('../game/land-expansion');
const { validateAllocation, calculateAllocationResult, getAllocationStatus } = require('../game/scout-allocation');
const { getLocationByRegionAndType, markLocationDiscovered } = require('../game/world-locations');
const { getDistanceToLocation, getLocationTurnCost } = require('../game/location-distance');

const MOJIBAKE_SIGNATURE = /[ÃÂâïðÅ�]/;

function repairMojibake(value) {
  if (value === null || value === undefined) return value;
  let text = String(value);
  if (!MOJIBAKE_SIGNATURE.test(text)) return text;
  for (let i = 0; i < 20; i++) {
    if (!MOJIBAKE_SIGNATURE.test(text)) break;
    let next;
    try {
      next = Buffer.from(text, 'latin1').toString('utf8');
    } catch {
      break;
    }
    if (next === text) break;
    text = next;
  }
  text = text
    .replace(/Â/g, '')
    .replace(/â€”/g, '—')
    .replace(/â€“/g, '-')
    .replace(/â€¢/g, '•')
    .replace(/â€˜|â€™/g, '’')
    .replace(/â€œ/g, '“');
  return text;
}

module.exports = function (db) {
  const router = express.Router();
  const EXP_TURNS = config.EXPEDITION_TURNS;

  router.post('/expedition/start', requireAuth, requireCsrfToken, async (req, res) => {
    const { type, rangers, fighters } = req.body;
    if (!EXP_TURNS[type])
      return res.status(400).json({ error: 'Invalid expedition type' });

    const r = Math.max(0, parseInt(rangers) || 0);
    const f = Math.max(0, parseInt(fighters) || 0);
    if (r < 1) return res.status(400).json({ error: 'Send at least 1 ranger' });

    // Phase 4: Handle dungeon/mountain locations with distance-based turn costs
    if (type === 'dungeon' || type === 'mountain') {
      if (f < 1 && type === 'dungeon')
        return res.status(400).json({ error: 'Dungeon raids require fighters' });
      if (f > 0 && type === 'mountain')
        return res.status(400).json({ error: 'Mountain expeditions are rangers only - leave your fighters behind.' });

      try {
        const result = await db.withTransaction(async () => {
          const k = await db.get('SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE', [
            req.player.playerId,
          ]);
          if (!k) throw new Error('Kingdom not found');

          // Validate unit availability
          if (r > engine.getAvailableUnits(k, 'rangers')) {
            const error = new Error('Not enough available rangers (some may be in training)');
            error.statusCode = 400;
            throw error;
          }
          if (f > engine.getAvailableUnits(k, 'fighters')) {
            const error = new Error('Not enough available fighters (some may be in training)');
            error.statusCode = 400;
            throw error;
          }

          // Get the location for this kingdom's region
          const location = getLocationByRegionAndType(k.race, type);
          if (!location) throw new Error(`No ${type} found in your region`);

          // Calculate distance and turn cost
          const distance = getDistanceToLocation(k, location);
          const turnCost = getLocationTurnCost(type, distance);

          if (k.turns_stored < turnCost) {
            const error = new Error(`${type.charAt(0).toUpperCase() + type.slice(1)} expedition requires ${turnCost} turns (you have ${k.turns_stored})`);
            error.statusCode = 429;
            throw error;
          }

          const newTurnsStored = Math.max(0, k.turns_stored - turnCost);

          // Deduct turns and mark location discovered
          await db.run(
            'UPDATE kingdoms SET turns_stored = $1 WHERE id = $2',
            [newTurnsStored, k.id]
          );

          await markLocationDiscovered(db, location.id, k.id);

          // Track first discovery (use === null to properly handle turn 0)
          if (type === 'dungeon' && k.first_dungeon_found_turn === null) {
            await db.run('UPDATE kingdoms SET first_dungeon_found_turn = $1 WHERE id = $2', [k.turn || 0, k.id]);
          } else if (type === 'mountain' && k.first_mountain_found_turn === null) {
            await db.run('UPDATE kingdoms SET first_mountain_found_turn = $1 WHERE id = $2', [k.turn || 0, k.id]);
          }

          return { turnCost, distance, newTurnsStored };
        });

        const label = type === 'dungeon' ? 'Dungeon' : 'Mountain';
        const message = `${label} expedition launched -- Location found at distance ${result.distance.toFixed(1)} hexes. ${result.turnCost} turns spent exploring.`;

        res.json({
          ok: true,
          turns_left: 0,
          turns_stored: result.newTurnsStored,
          distance: result.distance.toFixed(1),
          updates: { turns_stored: result.newTurnsStored },
          events: [],
          message: repairMojibake(message),
        });
        return;
      } catch (err) {
        console.error(`[expedition/start] ${type} failed:`, err.message);
        if (err.message.includes('Kingdom not found')) {
          return res.status(404).json({ error: err.message });
        }
        if (err.statusCode) {
          return res.status(err.statusCode).json({ error: err.message });
        }
        res.status(500).json({ error: `${type.charAt(0).toUpperCase() + type.slice(1)} expedition failed - please try again` });
      }
    }

    // Original logic for scout, deep, hunting, prospecting
    if (type === 'mountain' && r < 10000)
      return res.status(400).json({ error: 'Mountain expedition requires at least 10,000 rangers' });

    try {
      const { k, updates, foodNeeded } = await db.withTransaction(async () => {
        const k = await db.get('SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE', [
          req.player.playerId,
        ]);
        if (!k) {
          throw new Error('Kingdom not found');
        }

        if (k.turns_stored < 1) {
          const error = new Error('No turns available');
          error.statusCode = 429;
          throw error;
        }
        if (r > engine.getAvailableUnits(k, 'rangers')) {
          const error = new Error('Not enough available rangers (some may be in training)');
          error.statusCode = 400;
          throw error;
        }
        if (f > engine.getAvailableUnits(k, 'fighters')) {
          const error = new Error('Not enough available fighters (some may be in training)');
          error.statusCode = 400;
          throw error;
        }

        const existing = await db.get(
          'SELECT id FROM expeditions WHERE kingdom_id = $1 AND type = $2',
          [k.id, type],
        );
        if (existing) {
          const error = new Error(`A ${type} expedition is already underway`);
          error.statusCode = 400;
          throw error;
        }

        const foodMult = engine.FOOD_CONSUMPTION_MULT[k.race] || 1.0;
        const foodPerTurn = (r * 0.5 + f * 1.0) * foodMult;
        const foodNeeded = Math.ceil(EXP_TURNS[type] * foodPerTurn * 0.75);
        if (k.food < foodNeeded) {
          const error = new Error(`${type.charAt(0).toUpperCase() + type.slice(1)} expedition requires ${foodNeeded.toLocaleString()} food (you have ${k.food.toLocaleString()}).`);
          error.statusCode = 400;
          throw error;
        }

        await db.run(
          'UPDATE kingdoms SET rangers = GREATEST(0, rangers - $1), fighters = GREATEST(0, fighters - $2), food = GREATEST(0, food - $3) WHERE id = $4',
          [r, f, foodNeeded, k.id]
        );

        await db.run(
          'INSERT INTO expeditions (kingdom_id, type, turns_left, rangers, fighters, food_taken) VALUES ($1, $2, $3, $4, $5, $6)',
          [k.id, type, EXP_TURNS[type], r, f, foodNeeded],
        );

        let updates = { rangers: Math.max(0, k.rangers - r), fighters: Math.max(0, k.fighters - f), food: Math.max(0, k.food - foodNeeded) };
        progressGoal(k, updates, 'expedition_started', 1);
        if (updates.goals) {
          await db.run('UPDATE kingdoms SET goals = $1 WHERE id = $2', [updates.goals, k.id]);
        }

        return { k, updates, foodNeeded };
      });

      const updatedK = await db.get('SELECT * FROM kingdoms WHERE id = $1', [k.id]);
      let expeditionEvents = [];
      try {
        expeditionEvents = await engine.resolveExpeditions(db, updatedK, engine);
      } catch (expErr) {
        console.error('[expedition/start] immediate resolution error:', expErr.message);
      }

      const label = { scout: 'Scout', deep: 'Deep', dungeon: 'Dungeon', mountain: 'Mountain' }[type];
      const troops = `${r.toLocaleString()} rangers${f > 0 ? ', ' + f.toLocaleString() + ' fighters' : ''}`;

      let message = repairMojibake(
        `${label} expedition launched -- ${troops} deployed for ${EXP_TURNS[type]} turns. ${foodNeeded.toLocaleString()} food taken for the journey.`,
      );
      if (type === 'mountain') {
        message = repairMojibake(
          `MOUNTAIN EXPEDITION LAUNCHED! ${r.toLocaleString()} rangers venture into the peaks for 100 turns. Avalanches, extreme attrition, and danger await. Go big or go home.`,
        );
      }

      res.json({
        ok: true,
        turns_left: EXP_TURNS[type],
        turns_stored: k.turns_stored,
        updates: updates,
        events: expeditionEvents,
        message: message,
      });
    } catch (err) {
      console.error('[expedition/start] failed:', err.message);
      if (err.message.includes('Kingdom not found')) {
        return res.status(404).json({ error: err.message });
      }
      if (err.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      res.status(500).json({ error: 'Expedition failed - please try again' });
    }
  });

  // POST /expedition/hunting — Turn-based hunting for food
  router.post('/expedition/hunting', requireAuth, requireCsrfToken, async (req, res) => {
    const { rangers, terrain } = req.body;
    const r = Math.max(0, parseInt(rangers) || 0);
    const validTerrains = ['forest', 'grassland', 'mountain', 'water'];
    const t = terrain && validTerrains.includes(terrain) ? terrain : 'forest';

    if (r < 1) return res.status(400).json({ error: 'Send at least 1 ranger' });

    try {
      const { updates, reward } = await db.withTransaction(async () => {
        const k = await db.get('SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE', [
          req.player.playerId,
        ]);
        if (!k) throw new Error('Kingdom not found');

        if (k.turns_stored < config.HUNTING_CONSTANTS.TURN_COST) {
          const error = new Error(`Hunting requires ${config.HUNTING_CONSTANTS.TURN_COST} turns (you have ${k.turns_stored})`);
          error.statusCode = 429;
          throw error;
        }

        if (r > engine.getAvailableUnits(k, 'rangers')) {
          const error = new Error('Not enough available rangers');
          error.statusCode = 400;
          throw error;
        }

        const existing = await db.get(
          'SELECT id FROM expeditions WHERE kingdom_id = $1 AND type = $2 AND turns_left > 0',
          [k.id, 'hunting'],
        );
        if (existing) {
          const error = new Error('A hunting expedition is already underway');
          error.statusCode = 400;
          throw error;
        }

        const reward = calculateHuntingReward(r, k.ranger_level || 1, t, k.race);

        await db.run(
          'UPDATE kingdoms SET turns_stored = GREATEST(0, turns_stored - $1), food = food + $2 WHERE id = $3',
          [config.HUNTING_CONSTANTS.TURN_COST, reward.foodReward, k.id],
        );

        await db.run(
          'INSERT INTO expeditions (kingdom_id, type, turns_left, rangers, fighters, food_taken, rewards, rewards_claimed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [k.id, 'hunting', 0, 0, 0, 0, JSON.stringify({ food: reward.foodReward }), 1],
        );

        let updates = {
          turns_stored: Math.max(0, k.turns_stored - config.HUNTING_CONSTANTS.TURN_COST),
          food: k.food + reward.foodReward,
        };

        return { updates, reward };
      });

      res.json({
        ok: true,
        updates: updates,
        reward: reward,
        message: `Hunters returned with ${reward.foodReward.toLocaleString()} food.`,
      });
    } catch (err) {
      console.error('[expedition/hunting] failed:', err.message);
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      res.status(500).json({ error: 'Hunting failed - please try again' });
    }
  });

  // POST /expedition/prospecting — Turn-based prospecting for gold
  router.post('/expedition/prospecting', requireAuth, requireCsrfToken, async (req, res) => {
    const { engineers, terrain } = req.body;
    const e = Math.max(0, parseInt(engineers) || 0);
    const validTerrains = ['forest', 'grassland', 'mountain', 'water'];
    const t = terrain && validTerrains.includes(terrain) ? terrain : 'mountain';

    if (e < 1) return res.status(400).json({ error: 'Send at least 1 engineer' });

    try {
      const { updates, reward } = await db.withTransaction(async () => {
        const k = await db.get('SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE', [
          req.player.playerId,
        ]);
        if (!k) throw new Error('Kingdom not found');

        if (k.turns_stored < config.PROSPECTING_CONSTANTS.TURN_COST) {
          const error = new Error(`Prospecting requires ${config.PROSPECTING_CONSTANTS.TURN_COST} turns (you have ${k.turns_stored})`);
          error.statusCode = 429;
          throw error;
        }

        if (e > engine.getAvailableUnits(k, 'engineers')) {
          const error = new Error('Not enough available engineers');
          error.statusCode = 400;
          throw error;
        }

        const existing = await db.get(
          'SELECT id FROM expeditions WHERE kingdom_id = $1 AND type = $2 AND turns_left > 0',
          [k.id, 'prospecting'],
        );
        if (existing) {
          const error = new Error('A prospecting expedition is already underway');
          error.statusCode = 400;
          throw error;
        }

        const reward = calculateProspectingReward(e, k.engineer_level || 1, t, k.race);

        if (k.food < reward.foodCost) {
          const error = new Error(`Prospecting requires ${reward.foodCost.toLocaleString()} food (you have ${k.food.toLocaleString()})`);
          error.statusCode = 400;
          throw error;
        }

        await db.run(
          'UPDATE kingdoms SET turns_stored = GREATEST(0, turns_stored - $1), food = GREATEST(0, food - $2), gold = gold + $3 WHERE id = $4',
          [config.PROSPECTING_CONSTANTS.TURN_COST, reward.foodCost, reward.goldReward, k.id],
        );

        await db.run(
          'INSERT INTO expeditions (kingdom_id, type, turns_left, rangers, fighters, food_taken, rewards, rewards_claimed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [k.id, 'prospecting', 0, 0, 0, reward.foodCost, JSON.stringify({ gold: reward.goldReward }), 1],
        );

        let updates = {
          turns_stored: Math.max(0, k.turns_stored - config.PROSPECTING_CONSTANTS.TURN_COST),
          food: Math.max(0, k.food - reward.foodCost),
          gold: k.gold + reward.goldReward,
        };

        return { updates, reward };
      });

      res.json({
        ok: true,
        updates: updates,
        reward: reward,
        message: `Prospectors returned with ${reward.goldReward.toLocaleString()} gold.`,
      });
    } catch (err) {
      console.error('[expedition/prospecting] failed:', err.message);
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      res.status(500).json({ error: 'Prospecting failed - please try again' });
    }
  });

  // POST /expedition/land-expansion — Instant land discovery
  router.post('/expedition/land-expansion', requireAuth, requireCsrfToken, async (req, res) => {
    const { rangers, terrain } = req.body;
    const r = Math.max(0, parseInt(rangers) || 0);
    const validTerrains = ['forest', 'grassland', 'mountain', 'water'];
    const t = terrain && validTerrains.includes(terrain) ? terrain : 'grassland';

    if (r < 1) return res.status(400).json({ error: 'Send at least 1 ranger' });

    try {
      const { updates, reward } = await db.withTransaction(async () => {
        const k = await db.get('SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE', [
          req.player.playerId,
        ]);
        if (!k) throw new Error('Kingdom not found');

        if (r > engine.getAvailableUnits(k, 'rangers')) {
          const error = new Error('Not enough available rangers');
          error.statusCode = 400;
          throw error;
        }

        const reward = calculateLandExpansionReward(r, k.ranger_level || 1, t, k.race, k.population);

        if (reward.landsDiscovered === 0) {
          const error = new Error('No land discovered (insufficient population or rangers)');
          error.statusCode = 400;
          throw error;
        }

        await db.run(
          'UPDATE kingdoms SET land = land + $1, population = GREATEST(0, population - $2) WHERE id = $3',
          [reward.landsDiscovered, reward.populationCost, k.id],
        );

        let updates = {
          land: k.land + reward.landsDiscovered,
          population: Math.max(0, k.population - reward.populationCost),
        };

        return { updates, reward };
      });

      res.json({
        ok: true,
        updates: updates,
        reward: reward,
        message: `Discovered ${reward.landsDiscovered.toLocaleString()} new lands.`,
      });
    } catch (err) {
      console.error('[expedition/land-expansion] failed:', err.message);
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      res.status(500).json({ error: 'Land expansion failed - please try again' });
    }
  });

  router.get('/expedition/list', requireAuth, async (req, res) => {
    const k = await db.get('SELECT id FROM kingdoms WHERE player_id = $1', [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: 'Kingdom not found' });
    await db.run(
      'DELETE FROM expeditions WHERE kingdom_id = $1 AND turns_left = 0 AND seen = 1',
      [k.id],
    );
    const completed = await db.all(
      'SELECT * FROM expeditions WHERE kingdom_id = $1 AND turns_left = 0 AND rewards IS NOT NULL AND (seen IS NULL OR seen = 0)',
      [k.id],
    );
    const active = await db.all(
      'SELECT * FROM expeditions WHERE kingdom_id = $1 AND (turns_left > 0 OR (turns_left = 0 AND rewards IS NULL)) ORDER BY created_at DESC',
      [k.id],
    );
    const cleanRewards = (exp) => {
      if (!exp || typeof exp !== 'object') return exp;
      let rewards = exp.rewards;
      if (typeof rewards === 'string') {
        try {
          const parsed = JSON.parse(rewards);
          if (Array.isArray(parsed)) rewards = JSON.stringify(parsed.map((msg) => repairMojibake(msg)));
        } catch {}
      } else if (Array.isArray(rewards)) {
        rewards = rewards.map((msg) => repairMojibake(msg));
      }
      return { ...exp, rewards };
    };
    res.json({ active: active.map(cleanRewards), completed: completed.map(cleanRewards) });
  });

  router.post('/expedition/acknowledge', requireAuth, requireCsrfToken, async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Expedition ID required' });

    try {
      const k = await db.get('SELECT id FROM kingdoms WHERE player_id = $1', [
        req.player.playerId,
      ]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      const result = await db.run(
        'DELETE FROM expeditions WHERE id = $1 AND kingdom_id = $2 AND turns_left <= 0',
        [id, k.id],
      );
      if (result.changes === 0) {
        return res.status(400).json({ error: 'Expedition not found, already acknowledged, or still in progress' });
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('[expedition/acknowledge] failed:', err.message);
      res.status(500).json({ error: 'Failed to acknowledge expedition' });
    }
  });

  router.get('/goals', requireAuth, async (req, res) => {
    const k = await db.get('SELECT id, goals FROM kingdoms WHERE player_id = $1', [req.player.playerId]);
    if (!k) return res.status(404).json({ error: 'Kingdom not found' });
    const { goals, updated } = generateGoals(k);
    if (updated) {
       await db.run('UPDATE kingdoms SET goals = $1 WHERE id = $2', [JSON.stringify(goals), k.id]);
    }
    res.json(goals);
  });

  router.post('/goals/claim', requireAuth, requireCsrfToken, async (req, res) => {
    const { groupId, goalId } = req.body;
    const k = await db.get('SELECT * FROM kingdoms WHERE player_id = $1', [req.player.playerId]);
    if (!k) return res.status(404).json({ error: 'Kingdom not found' });

    let updates = {};
    let events = [];
    const result = claimGoal(k, updates, events, groupId, goalId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    await applyKingdomUpdates(k.id, updates);
    for (const ev of events) {
      await db.run('INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1,$2,$3,$4)',
        [k.id, ev.type, ev.message, k.turn]);
    }

    res.json({ ok: true, message: result.message, updates });
  });

  router.post('/expedition/cancel', requireAuth, requireCsrfToken, async (req, res) => {
    const { id } = req.body;
    const k = await db.get('SELECT id FROM kingdoms WHERE player_id = $1', [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: 'Kingdom not found' });
    const exp = await db.get(
      'SELECT * FROM expeditions WHERE id = $1 AND kingdom_id = $2',
      [id, k.id],
    );
    if (!exp) return res.status(404).json({ error: 'Expedition not found' });
    await db.run(
      'UPDATE kingdoms SET rangers = rangers + $1, fighters = fighters + $2 WHERE id = $3',
      [exp.rangers, exp.fighters, k.id],
    );
    await db.run('DELETE FROM expeditions WHERE id = $1', [id]);
    res.json({ ok: true });
  });

  router.delete('/expedition/clear-all', requireAuth, async (req, res) => {
    const k = await db.get('SELECT id FROM kingdoms WHERE player_id = $1', [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: 'Kingdom not found' });
    const exps = await db.all(
      'SELECT * FROM expeditions WHERE kingdom_id = $1',
      [k.id],
    );
    let rangers = 0,
      fighters = 0;
    exps.forEach((e) => {
      rangers += e.rangers;
      fighters += e.fighters;
    });
    await db.run(
      'UPDATE kingdoms SET rangers = rangers + $1, fighters = fighters + $2 WHERE id = $3',
      [rangers, fighters, k.id],
    );
    await db.run('DELETE FROM expeditions WHERE kingdom_id = $1', [k.id]);
    res.json({ ok: true, cleared: exps.length });
  });

  router.post('/scout/allocate', requireAuth, requireCsrfToken, async (req, res) => {
    const { rangers } = req.body;
    const rangerCount = Math.max(0, parseInt(rangers) || 0);

    try {
      const k = await db.withTransaction(async () => {
        const kingdom = await db.get('SELECT id, rangers, scout_allocation, training_allocation FROM kingdoms WHERE player_id = $1 FOR UPDATE', [
          req.player.playerId,
        ]);
        if (!kingdom) {
          throw new Error('Kingdom not found');
        }

        const validation = validateAllocation(kingdom, rangerCount);
        if (!validation.valid) {
          const err = new Error(validation.reason);
          err.statusCode = 400;
          throw err;
        }

        const result = calculateAllocationResult(kingdom, rangerCount);
        await db.run(
          'UPDATE kingdoms SET scout_allocation = $1 WHERE id = $2',
          [result.newTotal, kingdom.id],
        );

        const updatedKingdom = { ...kingdom, scout_allocation: result.newTotal };
        const status = getAllocationStatus(updatedKingdom);

        return {
          allocated: result.allocated,
          scoutAllocation: status.allocated,
          availableRangers: status.available,
        };
      });

      res.json({
        ok: true,
        ...k,
      });
    } catch (err) {
      console.error('[scout/allocate]', err.message);
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({ error: err.message });
    }
  });

  router.post('/scout/release-all', requireAuth, requireCsrfToken, async (req, res) => {
    try {
      const k = await db.withTransaction(async () => {
        const kingdom = await db.get('SELECT id, rangers, scout_allocation, training_allocation FROM kingdoms WHERE player_id = $1 FOR UPDATE', [
          req.player.playerId,
        ]);
        if (!kingdom) {
          throw new Error('Kingdom not found');
        }

        const released = Number(kingdom.scout_allocation || 0);
        await db.run(
          'UPDATE kingdoms SET scout_allocation = 0 WHERE id = $1',
          [kingdom.id],
        );

        const updatedKingdom = { ...kingdom, scout_allocation: 0 };
        const status = getAllocationStatus(updatedKingdom);

        return {
          released,
          scoutAllocation: status.allocated,
          availableRangers: status.available,
        };
      });

      res.json({
        ok: true,
        ...k,
      });
    } catch (err) {
      console.error('[scout/release-all]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
