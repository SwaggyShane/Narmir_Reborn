const express = require('express');
const { requireAuth, requireCsrfToken } = require('./middleware');
const { progressGoal, generateGoals, claimGoal } = require('../game/goals');
const engine = require('../game/engine');
const config = require('../game/config');
const { applyKingdomUpdates } = require('../db/schema');

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
    if (type === 'mountain' && r < 10000)
      return res.status(400).json({ error: 'Mountain expedition requires at least 10,000 rangers' });
    if (type === 'dungeon' && f < 1)
      return res.status(400).json({ error: 'Dungeon raids require fighters' });
    if (type === 'mountain' && f > 0)
      return res.status(400).json({ error: 'Mountain expeditions are rangers only - leave your fighters behind.' });

    try {
      const { k, updates, foodNeeded } = await db.withTransaction(async () => {
        const k = await db.get('SELECT * FROM kingdoms WHERE player_id = ? FOR UPDATE', [
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
          'SELECT id FROM expeditions WHERE kingdom_id = ? AND type = ?',
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
          'UPDATE kingdoms SET rangers = MAX(0, rangers - ?), fighters = MAX(0, fighters - ?), food = MAX(0, food - ?) WHERE id = ?',
          [r, f, foodNeeded, k.id]
        );

        await db.run(
          'INSERT INTO expeditions (kingdom_id, type, turns_left, rangers, fighters, food_taken) VALUES (?, ?, ?, ?, ?, ?)',
          [k.id, type, EXP_TURNS[type], r, f, foodNeeded],
        );

        let updates = { rangers: Math.max(0, k.rangers - r), fighters: Math.max(0, k.fighters - f), food: Math.max(0, k.food - foodNeeded) };
        progressGoal(k, updates, 'expedition_started', 1);
        if (updates.goals) {
          await db.run('UPDATE kingdoms SET goals = ? WHERE id = ?', [updates.goals, k.id]);
        }

        return { k, updates, foodNeeded };
      });

      const updatedK = await db.get('SELECT * FROM kingdoms WHERE id = ?', [k.id]);
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

  router.get('/expedition/list', requireAuth, async (req, res) => {
    const k = await db.get('SELECT id FROM kingdoms WHERE player_id = ?', [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: 'Kingdom not found' });
    await db.run(
      'DELETE FROM expeditions WHERE kingdom_id = ? AND turns_left = 0 AND seen = 1',
      [k.id],
    );
    const completed = await db.all(
      'SELECT * FROM expeditions WHERE kingdom_id = ? AND turns_left = 0 AND rewards IS NOT NULL AND (seen IS NULL OR seen = 0)',
      [k.id],
    );
    const active = await db.all(
      'SELECT * FROM expeditions WHERE kingdom_id = ? AND (turns_left > 0 OR (turns_left = 0 AND rewards IS NULL)) ORDER BY created_at DESC',
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
      const k = await db.get('SELECT id FROM kingdoms WHERE player_id = ?', [
        req.player.playerId,
      ]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      const result = await db.run(
        'DELETE FROM expeditions WHERE id = ? AND kingdom_id = ? AND turns_left <= 0',
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
    const k = await db.get('SELECT id, goals FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
    if (!k) return res.status(404).json({ error: 'Kingdom not found' });
    const { goals, updated } = generateGoals(k);
    if (updated) {
       await db.run('UPDATE kingdoms SET goals = ? WHERE id = ?', [JSON.stringify(goals), k.id]);
    }
    res.json(goals);
  });

  router.post('/goals/claim', requireAuth, requireCsrfToken, async (req, res) => {
    const { groupId, goalId } = req.body;
    const k = await db.get('SELECT * FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
    if (!k) return res.status(404).json({ error: 'Kingdom not found' });

    let updates = {};
    let events = [];
    const result = claimGoal(k, updates, events, groupId, goalId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    await applyKingdomUpdates(k.id, updates);
    for (const ev of events) {
      await db.run('INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)',
        [k.id, ev.type, ev.message, k.turn]);
    }

    res.json({ ok: true, message: result.message, updates });
  });

  router.post('/expedition/cancel', requireAuth, requireCsrfToken, async (req, res) => {
    const { id } = req.body;
    const k = await db.get('SELECT id FROM kingdoms WHERE player_id = ?', [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: 'Kingdom not found' });
    const exp = await db.get(
      'SELECT * FROM expeditions WHERE id = ? AND kingdom_id = ?',
      [id, k.id],
    );
    if (!exp) return res.status(404).json({ error: 'Expedition not found' });
    await db.run(
      'UPDATE kingdoms SET rangers = rangers + ?, fighters = fighters + ? WHERE id = ?',
      [exp.rangers, exp.fighters, k.id],
    );
    await db.run('DELETE FROM expeditions WHERE id = ?', [id]);
    res.json({ ok: true });
  });

  router.delete('/expedition/clear-all', requireAuth, async (req, res) => {
    const k = await db.get('SELECT id FROM kingdoms WHERE player_id = ?', [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: 'Kingdom not found' });
    const exps = await db.all(
      'SELECT * FROM expeditions WHERE kingdom_id = ?',
      [k.id],
    );
    let rangers = 0,
      fighters = 0;
    exps.forEach((e) => {
      rangers += e.rangers;
      fighters += e.fighters;
    });
    await db.run(
      'UPDATE kingdoms SET rangers = rangers + ?, fighters = fighters + ? WHERE id = ?',
      [rangers, fighters, k.id],
    );
    await db.run('DELETE FROM expeditions WHERE kingdom_id = ?', [k.id]);
    res.json({ ok: true, cleared: exps.length });
  });

  return router;
};
