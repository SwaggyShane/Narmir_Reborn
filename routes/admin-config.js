'use strict';

// Server config overrides, location/troop flush, server announcements, and
// sound asset uploads — split out of routes/admin.js (A2-9, 2026-07-19).
// requireAdmin + CSRF are applied once by the composer (routes/admin.js)
// before this router is mounted.

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { safeEmit } = require('../game/safe-socket-emit');
const { pgValueTuples } = require('../lib/pg-placeholders');
const { incrementUnread } = require('../cache');

const ALLOWED_SOUND_EXTENSIONS = new Set([".mp3", ".wav"]);

const soundsPath = path.join(__dirname, "..", "public", "sounds");
if (!fs.existsSync(soundsPath)) {
  fs.mkdirSync(soundsPath, { recursive: true });
}

// Resolve a user-supplied filename to an absolute path inside soundsPath.
// Returns null if the input is unsafe (traversal, wrong extension, or escapes the dir).
function safeSoundPath(rawName) {
  if (typeof rawName !== "string" || !rawName.trim()) return null;
  const base = rawName.split(/[/\\]/).pop();
  if (!base || base === "." || base === "..") return null;
  const ext = path.extname(base).toLowerCase();
  if (!ALLOWED_SOUND_EXTENSIONS.has(ext)) return null;
  const resolved = path.resolve(soundsPath, base);
  if (path.relative(soundsPath, resolved).startsWith("..")) return null;
  return resolved;
}

const ALLOWED_SOUND_MIME = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav']);
const { validateAudioSignature } = require('../utils/file-signatures');

// Memory storage so we can magic-byte check before persisting. A `.mp3`
// filename with arbitrary contents must not reach public/sounds/.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname((file.originalname || "")).toLowerCase();
    if (!ALLOWED_SOUND_EXTENSIONS.has(ext)) {
      return cb(new Error("Only .mp3 and .wav files are allowed"));
    }
    if (file.mimetype && !ALLOWED_SOUND_MIME.has(file.mimetype)) {
      return cb(new Error("Invalid file type - only audio files are allowed"));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = express.Router();

module.exports = function (db, io) {

  router.post("/announce", async (req, res) => {
    try {
      const text = (req.body.message || "").trim();
      if (!text) return res.status(400).json({ error: "message required" });
      if (text.length > 5000) return res.status(400).json({ error: "message cannot exceed 5000 characters" });

      const newsBlurb = `📢 Server announcement: ${text}`;

      const chatInsert = await db.run(
        "INSERT INTO chat_messages (kingdom_id, player_id, username, room, message) VALUES ($1, $2, $3, $4, $5)",
        [null, 0, "[ADMIN]", "global", text],
      );
      const chatId = chatInsert.lastID;

      const BATCH_SIZE = 1000;
      let offset = 0;
      let totalKingdoms = 0;
      let hasMore = true;
      while (hasMore) {
        const batch = await db.all("SELECT id FROM kingdoms LIMIT $1 OFFSET $2", [BATCH_SIZE, offset]);
        if (batch.length === 0) {
          hasMore = false;
          break;
        }
        totalKingdoms += batch.length;
        const placeholders = pgValueTuples(batch.length, 4);
        const values = batch.flatMap((k) => [k.id, "announcement", newsBlurb, 0]);
        await db.run(
          `INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ${placeholders}`,
          values,
        );
        for (const k of batch) {
          incrementUnread(k.id);
          safeEmit(io.to(`kingdom:${k.id}`), "event:news_refresh", {});
        }
        offset += BATCH_SIZE;
      }

      safeEmit(io.to("global"), "chat:message", {
        id: chatId,
        room: "global",
        from: "[ADMIN]",
        race: "admin",
        isMod: true,
        message: text,
        ts: Date.now(),
      });

      res.json({ ok: true, chatId, kingdoms: totalKingdoms });
    } catch (err) {
      console.error("[admin] announce failed:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/config", async (_req, res) => {
    const fs = require("fs");
    const path = require("path");
    const config = require("../game/config");
    let overrides = {};
    try {
      const overridesPath = path.join(
        __dirname,
        "../game/config_overrides.json",
      );
      if (fs.existsSync(overridesPath)) {
        overrides = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
      }
    } catch {}
    res.json({ config, overrides });
  });

  router.post("/config", async (req, res) => {
    const fs = require("fs");
    const path = require("path");
    const config = require("../game/config");
    const { overrides } = req.body;
    if (!overrides)
      return res.status(400).json({ error: "overrides required" });

    const overridesPath = path.join(__dirname, "../game/config_overrides.json");
    let existing = {};
    try {
      if (fs.existsSync(overridesPath)) {
        existing = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
      }
    } catch {}

    // Merge existing overrides and new overrides
    for (const key of Object.keys(overrides)) {
      if (
        typeof overrides[key] === "object" &&
        config[key] &&
        !Array.isArray(config[key])
      ) {
        existing[key] = { ...(existing[key] || {}), ...overrides[key] };
        // Apply immediately to memory
        Object.assign(config[key], overrides[key]);
      } else {
        existing[key] = overrides[key];
        config[key] = overrides[key];
      }
    }

    fs.writeFileSync(overridesPath, JSON.stringify(existing, null, 2));
    res.json({ ok: true, existing });
  });

  router.post("/flush-locations", async (_req, res) => {
    await db.run(
      "UPDATE kingdoms SET discovered_kingdoms='{}', location_maps_wip='[]', world_fragments='[]', hybrid_blueprints='{}'",
    );
    console.log("[admin] All location data flushed");
    res.json({
      ok: true,
      message:
        "All kingdom location data cleared. Players must rediscover kingdoms.",
    });
  });

  router.post("/flush-support-troops", async (_req, res) => {
    await db.run("UPDATE kingdoms SET researchers=0, engineers=0, scribes=0");
    console.log("[admin] All support troops flushed");
    res.json({
      ok: true,
      message:
        "All support troops (researchers, engineers, scribes) set to 0 for all players.",
    });
  });

  router.get("/sounds", (req, res) => {
    fs.readdir(soundsPath, (err, files) => {
      if (err)
        return res
          .status(500)
          .json({ error: "Failed to read sounds directory" });
      const sounds = files.filter(
        (f) => f.endsWith(".mp3") || f.endsWith(".wav"),
      );
      res.json({ ok: true, sounds });
    });
  });

  router.post("/sounds/upload", (req, res) => {
    upload.single("soundFile")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const originalBase = (req.file.originalname || "").split(/[/\\]/).pop();
      const ext = path.extname(originalBase || "").toLowerCase();
      if (!originalBase || !ALLOWED_SOUND_EXTENSIONS.has(ext)) {
        return res.status(400).json({ error: "Invalid filename or extension" });
      }
      if (!validateAudioSignature(req.file.buffer, ext)) {
        return res.status(400).json({ error: "File contents do not match the declared audio type" });
      }

      // Choose disk name: action override or original
      let targetBase = originalBase;
      if (typeof req.body.actionName === "string" && req.body.actionName !== "custom") {
        const requestedBase = req.body.actionName.split(/[/\\]/).pop();
        if (!requestedBase || requestedBase === "." || requestedBase === "..") {
          return res.status(400).json({ error: "Invalid action name" });
        }
        targetBase = requestedBase + ext;
      }
      const targetPath = safeSoundPath(targetBase);
      if (!targetPath) {
        return res.status(400).json({ error: "Invalid filename" });
      }
      fs.writeFile(targetPath, req.file.buffer, (writeErr) => {
        if (writeErr) {
          return res.status(500).json({ error: "Failed to save sound file" });
        }
        res.json({ ok: true, filename: path.basename(targetPath) });
      });
    });
  });

  router.post("/sounds/delete", (req, res) => {
    if (!req.body.filename)
      return res.status(400).json({ error: "Filename required" });
    const targetPath = safeSoundPath(req.body.filename);
    if (!targetPath) {
      return res.status(400).json({ error: "Invalid filename" });
    }
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
    res.json({ ok: true });
  });

  return router;
};
