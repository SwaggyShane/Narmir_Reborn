const express = require('express');
const { requireAuth, requireCsrfToken } = require('./middleware');
const { progressGoal, generateGoals, claimGoal } = require('../game/goals');
const commandHandler = require('../game/command-handler');
const config = require('../game/config');
const { applyKingdomUpdates } = require('../db/schema');
const { calculateHuntingReward } = require('../game/hunting-economy');
const { calculateProspectingReward } = require('../game/prospecting-economy');
const { calculateLandExpansionReward } = require('../game/land-expansion');
const { validateAllocation, getAllocationStatus } = require('../game/scout-allocation');
const { getAllLocations, getLocationById, isPubliclyDiscovered, markLocationDiscovered } = require('../game/world-locations');
const { getDistanceToLocation, getLocationTurnCost } = require('../game/location-distance');
const { resolveInstantExpedition } = require('../game/lib/gameplay');
const { structureUpdates } = require('./response-structurer');

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
    .replace(/â€"/g, '—')
    .replace(/â€"/g, '-')
    .replace(/â€¢/g, '•')
    .replace(/â€˜|â€™/g, "'")
    .replace(/â€œ/g, '"');
  return text;
}

module.exports = function (db) {
  const router = express.Router();
  const EXP_TURNS = config.EXPEDITION_TURNS;

  // Discovered dungeon/mountain locations across every region, with
  // distance/turn-cost computed from the caller's own kingdom — powers the
  // Exploration panel's region picker. Undiscovered locations are omitted;
  // they're public domain only once someone's scouted them into view.
  router.get('/world-locations', requireAuth, async (req, res) => {
    try {
      const k = await db.get('SELECT id, race, turn FROM kingdoms WHERE player_id = $1', [
        req.player.playerId,
      ]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      const fogDisabled = process.env.DISABLE_FOG_OF_WAR === 'true';
      const locations = getAllLocations()
        .filter((loc) => fogDisabled || isPubliclyDiscovered(loc))
        .map((loc) => {
          const distance = getDistanceToLocation(k, loc);
          return {
            id: loc.id,
            type: loc.type,
            region: loc.region_name,
            distance: Math.round(distance * 10) / 10,
            turnCost: getLocationTurnCost(loc.type, distance),
          };
        });

      res.json({ locations });
    } catch (err) {
      console.error('[world-locations]', err.message);
      res.status(500).json({ error: 'Failed to load world locations' });
    }
  });

  router.post('/expedition/start', requireAuth, requireCsrfToken, async (req, res) => {
    const { type, rangers, fighters, locationId } = req.body;
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
          if (r > commandHandler.getAvailableUnits(k, 'rangers')) {
            const error = new Error('Not enough available rangers (some may be in training)');
            error.statusCode = 400;
            throw error;
          }
          if (f > commandHandler.getAvailableUnits(k, 'fighters')) {
            const error = new Error('Not enough available fighters (some may be in training)');
            error.statusCode = 400;
            throw error;
          }

          // Region-specific rewards mean a kingdom can target any region's
          // location, not just its own — the client's picker sends which one.
          const location = getLocationById(locationId);
          if (!location || location.type !== type) {
            const error = new Error('Location not found');
            error.statusCode = 400;
            throw error;
          }
          if (process.env.DISABLE_FOG_OF_WAR !== 'true' && !isPubliclyDiscovered(location)) {
            const error = new Error('You have not discovered this location yet');
            error.statusCode = 400;
            throw error;
          }

          // Calculate distance and turn cost
          const distance = getDistanceToLocation(k, location);
          const turnCost = getLocationTurnCost(type, distance);

          if (k.turns_stored < turnCost) {
            const error = new Error(`${type.charAt(0).toUpperCase() + type.slice(1)} expedition requires ${turnCost} turns (you have ${k.turns_stored})`);
            error.statusCode = 429;
            throw error;
          }

          // Food cost mirrors the async scout/deep/hunting/prospecting formula
          // below — a fixed EXP_TURNS[type] duration, not the distance-based
          // turnCost (that's what turns_stored pays for; food pays for
          // supplying the troops for the raid itself).
          const foodMult = commandHandler.foodConsumptionMult(k.race);
          const foodPerTurn = (r * 0.5 + f * 1.0) * foodMult;
          const foodNeeded = Math.ceil((EXP_TURNS[type] || 0) * foodPerTurn * 0.75);
          if (k.food < foodNeeded) {
            const error = new Error(`${type.charAt(0).toUpperCase() + type.slice(1)} expedition requires ${foodNeeded.toLocaleString()} food (you have ${k.food.toLocaleString()}).`);
            error.statusCode = 400;
            throw error;
          }

          const newTurnsStored = Math.max(0, k.turns_stored - turnCost);
          const newRangers = Math.max(0, k.rangers - r);
          const newFighters = Math.max(0, k.fighters - f);
          const newFood = Math.max(0, k.food - foodNeeded);

          // Deduct turns/rangers/fighters/food, mark location discovered
          await db.run(
            'UPDATE kingdoms SET turns_stored = $1, rangers = $2, fighters = $3, food = $4 WHERE id = $5',
            [newTurnsStored, newRangers, newFighters, newFood, k.id]
          );

          await markLocationDiscovered(db, location.id, k.id);

          // Track first discovery region-wide (use IS NULL to properly handle turn
          // 0, and to leave any kingdom that already has it set alone). Keyed to
          // the location's own region, not the exploring kingdom's race, since
          // a kingdom can now explore a location outside its own region.
          if (type === 'dungeon') {
            await db.run('UPDATE kingdoms SET first_dungeon_found_turn = $1 WHERE race = $2 AND first_dungeon_found_turn IS NULL', [k.turn || 0, location.region_name]);
          } else if (type === 'mountain') {
            await db.run('UPDATE kingdoms SET first_mountain_found_turn = $1 WHERE race = $2 AND first_mountain_found_turn IS NULL', [k.turn || 0, location.region_name]);
          }

          // Resolve the actual raid/journey outcome (attrition, gold, mana,
          // artifacts, air fragment, ultra rares, etc.) -- restores the reward
          // pipeline that scout/deep/hunting/prospecting already get via
          // expeditionRewards(), which Phase 4's location-discovery refactor
          // never wired up for dungeon/mountain.
          const kAfterDeductions = {
            ...k,
            turns_stored: newTurnsStored,
            rangers: newRangers,
            fighters: newFighters,
            food: newFood,
          };
          const resolved = await resolveInstantExpedition(db, kAfterDeductions, type, r, f);

          if (Object.keys(resolved.updates).length > 0) {
            await applyKingdomUpdates(k.id, resolved.updates, db);
          }
          if (resolved.rangersReturned > 0) {
            await db.run('UPDATE kingdoms SET rangers = rangers + $1 WHERE id = $2', [resolved.rangersReturned, k.id]);
          }
          if (resolved.fightersReturned > 0) {
            await db.run('UPDATE kingdoms SET fighters = fighters + $1 WHERE id = $2', [resolved.fightersReturned, k.id]);
          }

          const goalUpdates = {};
          progressGoal(k, goalUpdates, 'expedition_started', 1);
          if (goalUpdates.goals) {
            await db.run('UPDATE kingdoms SET goals = $1 WHERE id = $2', [goalUpdates.goals, k.id]);
          }

          return { turnCost, distance, newTurnsStored, ...resolved };
        });

        const label = type === 'dungeon' ? 'Dungeon' : 'Mountain';
        const message = `${label} expedition complete -- Location found at distance ${result.distance.toFixed(1)} hexes. ${result.turnCost} turns spent exploring.`;

        res.json({
          ok: true,
          turns_left: 0,
          turns_stored: result.newTurnsStored,
          distance: result.distance.toFixed(1),
          updates: { turns_stored: result.newTurnsStored, ...result.updates },
          rewards: result.rewards,
          events: result.events,
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
        if (r > commandHandler.getAvailableUnits(k, 'rangers')) {
          const error = new Error('Not enough available rangers (some may be in training)');
          error.statusCode = 400;
          throw error;
        }
        if (f > commandHandler.getAvailableUnits(k, 'fighters')) {
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

        const foodMult = commandHandler.foodConsumptionMult(k.race);
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
        expeditionEvents = await commandHandler.handle(
          { type: 'expeditions' },
          { kingdom: updatedK, db },
        );      } catch (expErr) {
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

  // POST /expedition/hunting - Hunting for food (instant/5/25 turn variants)
  router.post('/expedition/hunting', requireAuth, requireCsrfToken, async (req, res) => {
    const { duration } = req.body;
    const d = ['instant', '5', '25'].includes(duration) ? duration : 'instant';

    // For instant: use hunting reward calc, deduct 1 turn, apply food (no full turn processing)
    if (d === 'instant') {
      try {
        const { updates, reward } = await db.withTransaction(async () => {
          let k = await db.get('SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE', [req.player.playerId]);
          if (!k) throw new Error('Kingdom not found');
          if (k.turns_stored < 1) throw new Error('No turns available - next +7 turns in 25 minutes');

          const r = Math.max(0, parseInt(req.body.rangers) || 0);
          const t = req.body.terrain || 'forest';
          if (r < 1) throw new Error('Send at least 1 ranger');

          if (r > commandHandler.getAvailableUnits(k, 'rangers')) {
            throw new Error('Not enough available rangers');
          }

          const reward = calculateHuntingReward(r, k.ranger_level || 1, t, k.race, 'instant');

          const newFood = Math.max(0, (k.food || 0) + reward.foodReward);
          const newTurns = Math.max(0, k.turns_stored - 1);

          await db.run('UPDATE kingdoms SET food = $1, turns_stored = $2 WHERE id = $3', [newFood, newTurns, k.id]);

          return {
            updates: { food: newFood, turns_stored: newTurns },
            reward,
          };
        });
        return res.json({ ok: true, updates: structureUpdates(updates), reward, message: `Instant hunt: +${reward.foodReward} food` });
      } catch (err) {
        if (err.message.includes('No turns available')) {
          return res.status(429).json({ error: err.message });
        }
        return res.status(500).json({ error: 'Hunting failed - please try again' });
      }
    }

    // Non-instant: normal hunting logic
    const { rangers, terrain, target_x, target_y } = req.body;
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

        const { calculateTravelTime, calculateExpeditionDuration } = require('../game/expedition-mechanics');
        let totalTurns, targetCol, targetRow;

        if (d === 'instant') {
          totalTurns = 1;
        } else {
          // 5 or 25: require target hex and validate explored
          if (target_x === undefined || target_y === undefined) {
            const error = new Error('Target hex required for 5 or 25-turn expeditions');
            error.statusCode = 400;
            throw error;
          }

          targetCol = Math.floor(Number(target_x) || 0);
          targetRow = Math.floor(Number(target_y) || 0);

          const kingdomCol = Math.floor(Number(k.map_x) || 0);
          const kingdomRow = Math.floor(Number(k.map_y) || 0);
          const travelTurns = calculateTravelTime(kingdomCol, kingdomRow, targetCol, targetRow);
          totalTurns = calculateExpeditionDuration(d, travelTurns);
        }

        if (k.turns_stored < totalTurns) {
          const error = new Error(`Hunting requires ${totalTurns} turns (you have ${k.turns_stored})`);
          error.statusCode = 429;
          throw error;
        }

        if (r > commandHandler.getAvailableUnits(k, 'rangers')) {
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

        const reward = calculateHuntingReward(r, k.ranger_level || 1, t, k.race, d);

        if (d === '5' || d === '25') {
          // 5 or 25: create pending expedition
          await db.run(
            'UPDATE kingdoms SET turns_stored = GREATEST(0, turns_stored - $1) WHERE id = $2',
            [totalTurns, k.id],
          );

          await db.run(
            'INSERT INTO expeditions (kingdom_id, type, turns_left, rangers, fighters, food_taken, rewards, rewards_claimed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [k.id, 'hunting', totalTurns, r, 0, 0, JSON.stringify({ food: reward.foodReward }), 0],
          );
        }

        return {
          updates: { turns_stored: Math.max(0, k.turns_stored - totalTurns) },
          reward,
        };
      });

      const msg = `Expedition started. Rangers will return with ${reward.foodReward.toLocaleString()} food in ${d}-turn expedition.`;

      res.json({
        ok: true,
        updates: updates,
        reward: reward,
        message: msg,
      });
    } catch (err) {
      console.error('[expedition/hunting] failed:', err.message);
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      res.status(500).json({ error: 'Hunting failed - please try again' });
    }
  });

  // POST /expedition/prospecting - Prospecting for gold (instant/5/25 turn variants)
  router.post('/expedition/prospecting', requireAuth, requireCsrfToken, async (req, res) => {
    const { duration } = req.body;
    const d = ['instant', '5', '25'].includes(duration) ? duration : 'instant';

    // For instant: use prospecting reward calc, deduct 1 turn, apply gold (no full turn processing)
    if (d === 'instant') {
      try {
        const { updates, reward } = await db.withTransaction(async () => {
          let k = await db.get('SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE', [req.player.playerId]);
          if (!k) throw new Error('Kingdom not found');
          if (k.turns_stored < 1) throw new Error('No turns available - next +7 turns in 25 minutes');

          const e = Math.max(0, parseInt(req.body.engineers) || 0);
          const t = req.body.terrain || 'mountain';
          if (e < 1) throw new Error('Send at least 1 engineer');

          if (e > commandHandler.getAvailableUnits(k, 'engineers')) {
            throw new Error('Not enough available engineers');
          }

          const reward = calculateProspectingReward(e, k.engineer_level || 1, t, k.race, 'instant');

          const newGold = Math.max(0, (k.gold || 0) + reward.goldReward);
          const newTurns = Math.max(0, k.turns_stored - 1);

          await db.run('UPDATE kingdoms SET gold = $1, turns_stored = $2 WHERE id = $3', [newGold, newTurns, k.id]);

          return {
            updates: { gold: newGold, turns_stored: newTurns },
            reward,
          };
        });
        return res.json({ ok: true, updates: structureUpdates(updates), reward, message: `Instant prospect: +${reward.goldReward} gold` });
      } catch (err) {
        console.error('[expedition/prospecting-instant] failed:', err.message, err.stack);
        if (err.message.includes('No turns available')) {
          return res.status(429).json({ error: err.message });
        }
        return res.status(500).json({ error: err.message || 'Prospecting failed - please try again' });
      }
    }

    // Non-instant: normal prospecting logic
    const { engineers, terrain, target_x, target_y } = req.body;
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

        const { calculateTravelTime, calculateExpeditionDuration } = require('../game/expedition-mechanics');
        let totalTurns, targetCol, targetRow;

        if (d === 'instant') {
          totalTurns = 1;
        } else {
          // 5 or 25: require target hex and validate explored
          if (target_x === undefined || target_y === undefined) {
            const error = new Error('Target hex required for 5 or 25-turn expeditions');
            error.statusCode = 400;
            throw error;
          }

          targetCol = Math.floor(Number(target_x) || 0);
          targetRow = Math.floor(Number(target_y) || 0);

          const kingdomCol = Math.floor(Number(k.map_x) || 0);
          const kingdomRow = Math.floor(Number(k.map_y) || 0);
          const travelTurns = calculateTravelTime(kingdomCol, kingdomRow, targetCol, targetRow);
          totalTurns = calculateExpeditionDuration(d, travelTurns);
        }

        if (k.turns_stored < totalTurns) {
          const error = new Error(`Prospecting requires ${totalTurns} turns (you have ${k.turns_stored})`);
          error.statusCode = 429;
          throw error;
        }

        if (e > commandHandler.getAvailableUnits(k, 'engineers')) {
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

        const reward = calculateProspectingReward(e, k.engineer_level || 1, t, k.race, d);

        // Food cost only for 5/25, not instant
        if (d !== 'instant' && k.food < reward.foodCost) {
          const error = new Error(`Prospecting requires ${reward.foodCost.toLocaleString()} food (you have ${k.food.toLocaleString()})`);
          error.statusCode = 400;
          throw error;
        }

        if (d === '5' || d === '25') {
          // 5 or 25: create pending expedition, deduct food cost
          await db.run(
            'UPDATE kingdoms SET turns_stored = GREATEST(0, turns_stored - $1), food = GREATEST(0, food - $2) WHERE id = $3',
            [totalTurns, reward.foodCost, k.id],
          );

          await db.run(
            'INSERT INTO expeditions (kingdom_id, type, turns_left, rangers, engineers, fighters, food_taken, rewards, rewards_claimed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [k.id, 'prospecting', totalTurns, 0, e, 0, reward.foodCost, JSON.stringify({ gold: reward.goldReward }), 0],
          );
        }

        return {
          updates: {
            turns_stored: Math.max(0, k.turns_stored - totalTurns),
            food: d === '5' || d === '25' ? Math.max(0, k.food - reward.foodCost) : k.food,
          },
          reward,
        };
      });

      const msg = `Expedition started. Engineers will return with ${reward.goldReward.toLocaleString()} gold.`;

      res.json({
        ok: true,
        updates: updates,
        reward: reward,
        message: msg,
      });
    } catch (err) {
      console.error('[expedition/prospecting] failed:', err.message, err.stack);
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      return res.status(500).json({ error: err.message || 'Prospecting failed - please try again' });
    }
  });

  // POST /expedition/land-expansion - Land discovery (home hex only, instant)
  router.post('/expedition/land-expansion', requireAuth, requireCsrfToken, async (req, res) => {
    const { rangers } = req.body;
    const r = Math.max(0, parseInt(rangers) || 0);

    if (r < 1) return res.status(400).json({ error: 'Send at least 1 ranger' });

    try {
      const { updates, reward } = await db.withTransaction(async () => {
        const k = await db.get('SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE', [
          req.player.playerId,
        ]);
        if (!k) throw new Error('Kingdom not found');

        // Land expansion is instant (1 turn) and uses home hex only
        const totalTurns = 1;

        if (k.turns_stored < totalTurns) {
          const error = new Error(`Land expansion requires ${totalTurns} turn (you have ${k.turns_stored})`);
          error.statusCode = 429;
          throw error;
        }

        if (r > commandHandler.getAvailableUnits(k, 'rangers')) {
          const error = new Error('Not enough available rangers');
          error.statusCode = 400;
          throw error;
        }

        // Get home hex terrain for modifier (query grid terrain)
        // For now, use grassland as default. In future, could query hex grid.
        const homeHexTerrain = 'grassland';
        const reward = calculateLandExpansionReward(r, k.ranger_level || 1, homeHexTerrain, k.race, k.population, k.lands || 0);

        if (reward.landsDiscovered === 0) {
          const error = new Error('No land discovered (insufficient population or rangers)');
          error.statusCode = 400;
          throw error;
        }

        await db.run(
          'UPDATE kingdoms SET turns_stored = GREATEST(0, turns_stored - $1), population = GREATEST(0, population - $2), land = land + $3 WHERE id = $4',
          [totalTurns, reward.populationCost, reward.landsDiscovered, k.id],
        );

        await db.run(
          'INSERT INTO expeditions (kingdom_id, type, turns_left, rangers, fighters, food_taken, rewards, rewards_claimed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [k.id, 'land_expansion', totalTurns, r, 0, 0, JSON.stringify({ land: reward.landsDiscovered }), 0],
        );

        let updates = {
          turns_stored: Math.max(0, k.turns_stored - totalTurns),
          population: Math.max(0, k.population - reward.populationCost),
          lands: (k.lands || 0) + reward.landsDiscovered,
        };

        return { updates, reward };
      });

      res.json({
        ok: true,
        updates: updates,
        reward: reward,
        message: `Rangers discovered ${reward.landsDiscovered.toLocaleString()} new lands.`,
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

    res.json({ ok: true, message: result.message, updates: structureUpdates(updates) });
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

        await db.run(
          'UPDATE kingdoms SET scout_allocation = $1 WHERE id = $2',
          [rangerCount, kingdom.id],
        );

        const updatedKingdom = { ...kingdom, scout_allocation: rangerCount };
        const status = getAllocationStatus(updatedKingdom);

        return {
          allocated: rangerCount - kingdom.scout_allocation,
          scoutAllocation: status.allocated,
          availableRangers: status.available,
          updates: {
            scout_allocation: rangerCount,
            rangers: status.available,
          },
        };
      });

      res.json({
        ok: true,
        allocated: k.allocated,
        scoutAllocation: k.scoutAllocation,
        availableRangers: k.availableRangers,
        updates: k.updates,
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
          updates: {
            scout_allocation: 0,
          },
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
