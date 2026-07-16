const express = require('express');
const { requireAuth } = require('./middleware');
const { safeEmit } = require('../game/safe-socket-emit');

module.exports = (db, io) => {
  const router = express.Router();

  router.post('/test-result', requireAuth, async (req, res) => {
    try {
      const { testKey, testGroup, testName, passed, comment } = req.body;
      if (!testKey || testGroup === undefined || testName === undefined) {
        return res.status(400).json({ error: 'Missing test info' });
      }
      const player = req.player;
      await db.run(
        'INSERT INTO test_results (player_id, player_name, test_key, test_group, test_name, passed, comment) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [player.playerId, player.username, testKey, testGroup, testName, passed !== undefined ? (passed ? 1 : 0) : null, comment || null]
      );
      // Dev test harness channel — still uses safeEmit for serializable payloads
      if (io) {
        safeEmit(io, 'test-result-update', {
          player: player.username,
          testKey,
          testGroup,
          testName,
          passed,
          comment,
          timestamp: Date.now(),
        });
      }
      res.json({ ok: true });
    } catch (e) { console.error('[test-result] Database error:', e); res.status(500).json({ error: 'Failed to save test result' }); }
  });

  router.get('/test-results', requireAuth, async (req, res) => {
    try {
      const results = await db.all(`
        SELECT player_id, player_name, test_key, test_group, test_name, passed, comment, submitted_at
        FROM test_results
        ORDER BY submitted_at DESC
        LIMIT 1000
      `);
      res.json(results);
    } catch (e) { console.error('[test-results] Database error:', e); res.status(500).json({ error: 'Failed to fetch results' }); }
  });

  router.get('/test-results/summary', requireAuth, async (req, res) => {
    try {
      const summary = await db.all(`
        SELECT
          test_key,
          test_group,
          test_name,
          COUNT(*) as total_results,
          SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passed_count,
          SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) as failed_count,
          SUM(CASE WHEN passed IS NULL THEN 1 ELSE 0 END) as pending_count,
          COUNT(DISTINCT player_id) as unique_testers
        FROM test_results
        GROUP BY test_key, test_group, test_name
        ORDER BY test_group, test_name
      `);
      res.json(summary);
    } catch (e) { console.error('[test-summary] Database error:', e); res.status(500).json({ error: 'Failed to fetch summary' }); }
  });

  return router;
};
