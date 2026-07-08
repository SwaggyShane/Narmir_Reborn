const express = require('express');

module.exports = (db) => {
  const router = express.Router();

  router.post('/setup-admin', async (req, res) => {
    const { secret, username } = req.body;
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) return res.status(500).json({ error: 'ADMIN_SECRET not set on server' });
    if (!secret || secret !== adminSecret) return res.status(403).json({ error: 'Invalid secret' });
    if (!username) return res.status(400).json({ error: 'username required' });
    const player = await db.get('SELECT id, username FROM players WHERE username = $1', [username]);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    await db.run('UPDATE players SET is_admin = 1 WHERE id = $1', [player.id]);
    res.json({ ok: true, message: username + ' is now an admin. Log out and back in to get the admin token.' });
  });

  router.post('/admin/wipe-players', async (req, res) => {
    const { secret } = req.body;
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) return res.status(500).json({ error: 'ADMIN_SECRET not set on server' });
    if (!secret || secret !== adminSecret) return res.status(403).json({ error: 'Invalid secret' });

    try {
      // Delete all kingdom-related data
      await db.run('DELETE FROM expeditions');
      await db.run('DELETE FROM news');
      await db.run('DELETE FROM war_log');
      await db.run('DELETE FROM combat_log');
      await db.run('DELETE FROM chat_messages');
      await db.run('DELETE FROM heroes');
      await db.run('DELETE FROM spy_reports');
      await db.run('DELETE FROM trade_routes');
      await db.run('DELETE FROM messages');
      await db.run('DELETE FROM bounties');
      await db.run('DELETE FROM suggestions');
      await db.run('DELETE FROM trade_offers');

      // Delete kingdoms and alliance data
      await db.run('DELETE FROM alliance_members');
      await db.run('DELETE FROM alliances');
      await db.run('DELETE FROM kingdoms');

      // Delete players last
      await db.run('DELETE FROM players');

      res.json({ ok: true, message: 'All players, kingdoms, and related data wiped. Ready for re-registration.' });
    } catch (err) {
      console.error('Wipe error:', err);
      res.status(500).json({ error: 'Failed to wipe database' });
    }
  });

  return router;
};
