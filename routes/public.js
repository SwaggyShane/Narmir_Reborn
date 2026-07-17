const express = require('express');
const { requireAuth } = require('./middleware');

module.exports = (db, engine, config, rankingsCache, pkg) => {
  const router = express.Router();

  router.get('/regions', requireAuth, async (req, res) => {
    try {
      const rows = await db.all(`
        SELECT r.*, a.name as owner_name, ca.name as challenger_name
        FROM regions r
        LEFT JOIN alliances a ON r.owner_alliance_id = a.id
        LEFT JOIN alliances ca ON r.contest_alliance_id = ca.id
      `);
      res.json(rows);
    } catch (e) {
      console.error('[regions] Database error:', e);
      res.status(500).json({ error: 'Failed to load regions' });
    }
  });

  router.get('/spell-definitions', (_req, res) => {
    // Return spell definitions and magic schools for admin panel + the
    // Mage Tower crafting UI (which also needs the mages/turns cost table).
    res.json({
      SPELL_DEFS: engine.SPELL_DEFS,
      MAGIC_SCHOOLS: config.MAGIC_SCHOOLS,
      SCROLL_REQUIREMENTS: engine.SCROLL_REQUIREMENTS,
    });
  });

  router.get('/health', (_req, res) => res.json({ ok: true, uptime: Math.floor(process.uptime()) }));

  // Public status bar info — version, node ID, uptime since server boot
  const os = require('os');
  router.get('/status', (_req, res) => {
    const totalSec = Math.floor(process.uptime());
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const uptime = `${days}D ${String(hours).padStart(2, '0')}H ${String(mins).padStart(2, '0')}M ${String(secs).padStart(2, '0')}S`;
    res.json({
      version: `alpha ${pkg.version}`,
      nodeId: os.hostname().toUpperCase().slice(0, 12),
      uptime,
    });
  });

  // Public rankings — no auth required, used by the portal page
  router.get('/public/rankings', async (req, res) => {
    try {
      const cacheKey = "rankings:top20";
      if (rankingsCache.has(cacheKey)) {
        return res.json({ rankings: rankingsCache.get(cacheKey) });
      }

      const rows = await db.all(`
        SELECT k.id, k.name, k.race, k.land, k.level, k.population, p.username
        FROM kingdoms k
        JOIN players p ON k.player_id = p.id
        ORDER BY k.land DESC, k.level DESC, k.population DESC, k.id ASC
        LIMIT 20
      `);
      // land/level are used for sort order only — not sent to the (unauthenticated)
      // client, per the same "no stats without a covert op" rule as the in-game
      // rankings/profile/world-map endpoints.
      const stripped = rows.map(({ land: _land, level: _level, ...rest }) => rest);
      rankingsCache.set(cacheKey, stripped, 30 * 1000); // 30 sec TTL
      res.json({ rankings: stripped });
    } catch (e) {
      console.error('[rankings] Database error:', e);
      res.status(500).json({ error: 'Failed to load rankings' });
    }
  });

  router.get('/changelog', async (_req, res) => {
    try {
      const rows = await db.all(
        `SELECT id, title, description, body_md, category, source, created_at
         FROM changelog_entries ORDER BY created_at DESC LIMIT 50`,
      );
      res.json(rows);
    } catch (e) {
      console.error('[changelog] Database error:', e);
      res.status(500).json({ error: 'Failed to load changelog' });
    }
  });

  return router;
};
