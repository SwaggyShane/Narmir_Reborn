const express = require('express');
const { requireAuth } = require('./middleware');
const { sentryEnabled, Sentry } = require('../instrument');
const path = require('path');
const fs = require('fs');
const { postBugReportToDiscord } = require('../lib/discord-notify');

const BUG_CATEGORIES = new Set(['bug', 'ui', 'gameplay', 'performance', 'other']);

module.exports = (db, _io, _config) => {
  const router = express.Router();

  router.post('/log-error', (req, res) => {
    const logMsg = `[browser-error] ${new Date().toISOString()} MESSAGE: ${req.body.message || "none"}\nSOURCE: ${req.body.source || "none"}\nLINE: ${req.body.line || "none"}\nCOL: ${req.body.col || "none"}\nSTACK: ${req.body.stack || "none"}\n\n`;
    console.error(logMsg);
    if (sentryEnabled) {
      Sentry.captureMessage('Browser error reported', {
        level: 'error',
        tags: { area: 'frontend', source: 'browser' },
        extra: {
          message: req.body.message || 'none',
          source: req.body.source || 'none',
          line: req.body.line || 'none',
          col: req.body.col || 'none',
          stack: req.body.stack || 'none',
        },
      });
    }
    try {
      fs.appendFileSync(path.join(__dirname, '..', 'public', 'browser_logs.txt'), logMsg);
    } catch (e) {
      console.error("[error-logging-failing]", e);
    }
    res.json({ ok: true });
  });

  router.post('/suggestions', requireAuth, async (req, res) => {
    try {
      const { message } = req.body;
      if (!message || message.length < 5) return res.status(400).json({ error: 'Suggestion too short' });
      const k = await db.get('SELECT id FROM kingdoms WHERE player_id = $1', [req.player.playerId]);
      await db.run('INSERT INTO suggestions (player_id, kingdom_id, message) VALUES ($1, $2, $3)', [req.player.playerId, k ? k.id : null, message]);
      res.json({ ok: true, message: 'Thank you!' });
    } catch (e) { console.error('[suggestions] Database error:', e); res.status(500).json({ error: 'Failed to save suggestion' }); }
  });

  router.post('/bug-reports', requireAuth, async (req, res) => {
    try {
      const rawMessage = String(req.body?.message ?? '').trim();
      const category = BUG_CATEGORIES.has(req.body?.category) ? req.body.category : 'bug';
      const contextPanel = String(req.body?.contextPanel ?? '').trim().slice(0, 64) || null;
      const pageUrl = String(req.body?.pageUrl ?? '').trim().slice(0, 512) || null;
      const userAgent = String(req.body?.userAgent ?? '').trim().slice(0, 512) || null;
      const consoleLog = String(req.body?.consoleLog ?? '').trim().slice(0, 6000) || null;

      if (rawMessage.length < 10) return res.status(400).json({ error: 'Please describe the issue in at least 10 characters.' });
      if (rawMessage.length > 2000) return res.status(400).json({ error: 'Report is too long (max 2000 characters).' });

      const playerId = req.player.playerId;
      const { createdAtAgeMs, nowUnix } = require('./game/lib/timestamp');
      const recent = await db.get(
        `SELECT id, created_at FROM bug_reports WHERE player_id = $1 ORDER BY id DESC LIMIT 1`,
        [playerId],
      );
      if (recent?.created_at != null && createdAtAgeMs(recent.created_at) < 60_000) {
        return res.status(429).json({ error: 'Please wait a minute before sending another report.' });
      }

      const kingdom = await db.get(
        'SELECT k.id, k.name FROM kingdoms k WHERE k.player_id = $1',
        [playerId],
      );
      const username = req.player.username || 'Unknown';

      const insert = await db.run(
        `INSERT INTO bug_reports (player_id, kingdom_id, username, kingdom_name, category, message, context_panel, page_url, user_agent, console_log, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          playerId,
          kingdom?.id ?? null,
          username,
          kingdom?.name ?? null,
          category,
          rawMessage,
          contextPanel,
          pageUrl,
          userAgent,
          consoleLog,
          nowUnix(),
        ],
      );

      const reportId = insert?.lastID ?? insert?.lastId ?? null;
      const discordSent = await postBugReportToDiscord({
        reportId,
        username,
        kingdomName: kingdom?.name,
        category,
        message: rawMessage,
        contextPanel,
        pageUrl,
        consoleLog,
      });

      if (discordSent && reportId) {
        await db.run('UPDATE bug_reports SET discord_sent = 1 WHERE id = $1', [reportId]);
      }

      res.json({
        ok: true,
        message: discordSent
          ? 'Report sent — thank you! The team was notified on Discord.'
          : 'Report saved — thank you! It will appear in admin and Discord shortly.',
      });
    } catch (e) {
      console.error('[bug-reports] Error:', e);
      res.status(500).json({ error: 'Failed to save bug report' });
    }
  });

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
