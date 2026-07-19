'use strict';

// News, Chat, Scout Status, Portrait, and Happiness — split out of
// routes/kingdom-gameplay.js (A2-8, 2026-07-19). This is the last of the
// gameplay.js route-split series (A2-4 through A2-8) — the remainder that
// didn't cluster with anything else: player-facing feed/social routes
// (scouts status, global chat, news) and small per-kingdom
// customization/status routes (portrait upload, happiness dashboard) that
// share no real domain coupling with each other, just "didn't belong
// anywhere bigger."
//
// None of these routes go through CommandHandler; happiness-status calls
// commandHandler.calculateHappiness (a pure read helper, not a mutator).

const express = require('express');
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const commandHandler = require("../game/command-handler");
const { requireAuth } = require("./middleware");
const { setUnreadCount } = require("../cache.js");
const { normalizeNewsRow } = require('./lib/kingdom-turn-helpers');

const router = express.Router();

const portraitsPath = path.join(__dirname, "..", "public", "portraits");
if (!fs.existsSync(portraitsPath)) {
  fs.mkdirSync(portraitsPath, { recursive: true });
}

const ALLOWED_PORTRAIT_TYPES = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const ALLOWED_PORTRAIT_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const { validateImageSignature } = require('../utils/file-signatures');

// Memory storage: we validate the file's magic bytes before persisting to
// disk so that a forged `.png` filename containing arbitrary bytes (e.g.
// HTML, scripts, or executables) never lands in the public/portraits/
// directory.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_PORTRAIT_TYPES.has(ext)) {
      return cb(new Error("Only image files (jpg, png, gif, webp) are allowed"));
    }
    if (!ALLOWED_PORTRAIT_MIME.has(file.mimetype)) {
      return cb(new Error("Invalid file type - only image files are allowed"));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

const uploadWithErrorHandling = (req, res, next) => {
  upload.single('portrait')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    next();
  });
};

module.exports = function (db) {
  router.get('/scouts', requireAuth, async (req, res) => {
    try {
      const k = await db.get('SELECT scout_allocation, scout_progress FROM kingdoms WHERE player_id = $1', [req.player.playerId]);
      if (!k) {
        return res.status(404).json({ error: 'Kingdom not found' });
      }
      res.json(k);
    } catch (err) {
      console.error('[scouts] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/chat/global', requireAuth, async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(200, Number(req.query.limit) || 100));
      const rows = await db.all(
        `
          SELECT
            cm.id,
            cm.room,
            cm.message,
            cm.created_at,
            cm.username,
            COALESCE(p.chat_name, cm.username) AS from_name,
            COALESCE(p.chat_color, '#e8e9f0') AS chat_color,
            COALESCE(p.is_chat_mod, 0) AS is_chat_mod,
            COALESCE(p.is_admin, 0) AS is_admin
          FROM chat_messages cm
          LEFT JOIN players p ON p.id = cm.player_id
          WHERE cm.room = 'global' AND cm.deleted = 0
          ORDER BY cm.created_at DESC, cm.id DESC
          LIMIT $1
        `,
        [limit],
      );

      res.json({
        messages: rows
          .reverse()
          .map((row) => ({
            id: row.id,
            room: row.room,
            message: row.message,
            ts: row.created_at ? row.created_at * 1000 : Date.now(),
            from: row.from_name || row.username,
            username: row.username,
            chatColor: row.chat_color,
            isMod: !!(row.is_chat_mod || row.is_admin),
          })),
      });
    } catch (err) {
      console.error('[chat/global]', err.message);
      res.status(500).json({ error: 'Failed to load chat' });
    }
  });

  router.get("/news/list", requireAuth, async (req, res) => {
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = $1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const [items] = await Promise.all([
      db.all(
        "SELECT * FROM news WHERE kingdom_id = $1 ORDER BY created_at DESC LIMIT 50",
        [k.id],
      ),
      db.run(
        "UPDATE news SET is_read = 1 WHERE kingdom_id = $1 AND is_read = 0",
        [k.id],
      ),
    ]);
    const normalized = items.map(normalizeNewsRow);
    const repairJobs = [];
    for (let i = 0; i < items.length; i += 1) {
      const original = items[i]?.message ?? "";
      const repaired = normalized[i]?.message ?? original;
      if (typeof original === "string" && repaired !== original) {
        repairJobs.push(db.run("UPDATE news SET message = $1 WHERE id = $2", [repaired, items[i].id]));
      }
    }
    if (repairJobs.length > 0) {
      await Promise.all(repairJobs);
    }
    setUnreadCount(k.id, 0); // Mark all read, so unread count is 0
    res.json(normalized);
  });

  router.delete("/news/clear", requireAuth, async (req, res) => {
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = $1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    await db.run("DELETE FROM news WHERE kingdom_id = $1", [k.id]);
    res.json({ ok: true });
  });

  // POST /api/kingdom/portrait - Upload custom portrait
  router.post('/portrait', requireAuth, uploadWithErrorHandling, async (req, res) => {
    try {
      const playerId = req.player.playerId;
      const k = await db.get('SELECT id FROM kingdoms WHERE player_id = $1', [playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      if (!validateImageSignature(req.file.buffer, ext)) {
        return res.status(400).json({ error: 'File contents do not match the declared image type' });
      }

      const hash = crypto.randomBytes(4).toString('hex');
      const filename = `portrait_${Date.now()}_${hash}${ext}`;
      const diskPath = path.join(portraitsPath, filename);
      await fs.promises.writeFile(diskPath, req.file.buffer);
      const portraitPath = `/portraits/${filename}`;

      // Remove old portrait if exists
      const old = await db.get('SELECT custom_portrait FROM kingdoms WHERE id = $1', [k.id]);
      if (old?.custom_portrait) {
        const safeBasename = path.basename(old.custom_portrait);
        const oldPath = path.join(portraitsPath, safeBasename);
        fs.unlink(oldPath, (e) => {
          if (e) console.warn('Failed to delete old portrait:', e.message);
        });
      }

      // Update database
      await db.run('UPDATE kingdoms SET custom_portrait = $1 WHERE id = $2', [portraitPath, k.id]);

      res.json({ ok: true, portraitUrl: portraitPath });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/kingdom/portrait - Remove custom portrait
  router.delete('/portrait', requireAuth, async (req, res) => {
    try {
      const playerId = req.player.playerId;
      const k = await db.get('SELECT id, custom_portrait FROM kingdoms WHERE player_id = $1', [playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      if (k.custom_portrait) {
        const safeBasename = path.basename(k.custom_portrait);
        const filePath = path.join(portraitsPath, safeBasename);
        fs.unlink(filePath, (e) => {
          if (e) console.warn('Failed to delete portrait file:', e.message);
        });
      }

      await db.run('UPDATE kingdoms SET custom_portrait = NULL WHERE id = $1', [k.id]);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/kingdom/happiness-status - Happiness data + 50-turn history
  router.get('/happiness-status', requireAuth, async (req, res) => {
    try {
      const playerId = req.player.playerId;
      const k = await db.get('SELECT * FROM kingdoms WHERE player_id = $1', [playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      // Get current happiness components
      const happinessResult = commandHandler.calculateHappiness(k);

      // Get last 50 turns of happiness history
      const history = await db.all(
        `SELECT turn, happiness_value FROM happiness_history
         WHERE kingdom_id = $1 ORDER BY turn DESC LIMIT 50`,
        [k.id]
      );

      // Get recent happiness events
      const recentEvents = await db.all(
        `SELECT * FROM happiness_events
         WHERE kingdom_id = $1 ORDER BY turn DESC LIMIT 10`,
        [k.id]
      );

      res.json({
        happiness: happinessResult.happiness,
        components: happinessResult.components,
        recoveryRate: happinessResult.recovery,
        last50Turns: history.reverse().map(h => ({ turn: h.turn, happiness: h.happiness_value })),
        recent: recentEvents
      });
    } catch (err) {
      console.error('[kingdom] happiness-status error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/kingdom/happiness-events - Recent happiness events
  router.get('/happiness-events', requireAuth, async (req, res) => {
    try {
      const playerId = req.player.playerId;
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 500);

      const k = await db.get('SELECT id FROM kingdoms WHERE player_id = $1', [playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      const events = await db.all(
        `SELECT * FROM happiness_events
         WHERE kingdom_id = $1 ORDER BY turn DESC LIMIT $2`,
        [k.id, limit]
      );

      res.json({ events: events.reverse() }); // Reverse to oldest first
    } catch (err) {
      console.error('[kingdom] happiness-events error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
