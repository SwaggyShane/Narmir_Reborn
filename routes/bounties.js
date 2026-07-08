const express = require('express');
const { requireAuth } = require('./middleware');
const { bountiesCache } = require('../cache.js');

module.exports = (db) => {
  const router = express.Router();

  router.get('/bounties', requireAuth, async (req, res) => {
    try {
      const cacheKey = "bounties:active";
      if (bountiesCache.has(cacheKey)) {
        return res.json(bountiesCache.get(cacheKey));
      }

      const rows = await db.all(`
        SELECT b.*, k.name as target_name, COALESCE(p.username, 'unknown') as placer_name
        FROM bounties b
        JOIN kingdoms k ON b.target_id = k.id
        LEFT JOIN players p ON b.posted_by = p.id
        WHERE b.status = 'active'
        ORDER BY b.amount DESC
      `);
      bountiesCache.set(cacheKey, rows, 30 * 1000); // 30 sec TTL
      res.json(rows);
    } catch (e) {
      console.error('[bounties-list] Database error:', e);
      res.status(500).json({ error: 'Failed to load bounties' });
    }
  });

  router.post('/bounties', requireAuth, async (req, res) => {
    try {
      const { target_id, amount } = req.body;
      if (!target_id || !amount || amount <= 0) return res.status(400).json({ error: 'Invalid target or amount' });

      await db.run('BEGIN TRANSACTION');
      try {
        // Check gold and lock inside transaction
        const k = await db.get('SELECT id, gold FROM kingdoms WHERE player_id = $1 FOR UPDATE', [req.player.playerId]);
        if (!k) {
          await db.run('ROLLBACK');
          return res.status(404).json({ error: 'Kingdom not found' });
        }
        if (k.gold < amount) {
          await db.run('ROLLBACK');
          return res.status(400).json({ error: 'Not enough gold' });
        }
        if (k.id === target_id) {
          await db.run('ROLLBACK');
          return res.status(400).json({ error: 'Cannot place bounty on yourself' });
        }

        const target = await db.get('SELECT id FROM kingdoms WHERE id = $1', [target_id]);
        if (!target) {
          await db.run('ROLLBACK');
          return res.status(404).json({ error: 'Target kingdom not found' });
        }

        await db.run('UPDATE kingdoms SET gold = gold - $1 WHERE id = $2', [amount, k.id]);
        await db.run(
          'INSERT INTO bounties (posted_by, target_id, amount) VALUES ($1, $2, $3)',
          [req.player.playerId, target_id, amount]
        );

        await db.run('COMMIT');
        bountiesCache.delete("bounties:active"); // Invalidate cache
        res.json({ ok: true, message: 'Bounty placed!' });
      } catch (txErr) {
        await db.run('ROLLBACK').catch(() => {});
        throw txErr;
      }
    } catch (e) {
      console.error('[bounties-place] Database error:', e);
      res.status(500).json({ error: 'Failed to place bounty' });
    }
  });

  return router;
};
