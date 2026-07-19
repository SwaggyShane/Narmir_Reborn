'use strict';

// Server events, suggestions, wishlist, changelog, bug reports, admin notes
// — split out of routes/admin.js (A2-9, 2026-07-19). requireAdmin + CSRF are
// applied once by the composer (routes/admin.js) before this router is
// mounted.

const express = require('express');
const { dualRoute } = require('./lib/admin-dual-route');

const router = express.Router();

module.exports = function (db) {

  router.get("/events/log", async (_req, res) => {
    const rows = await db.all(
      `SELECT * FROM event_log ORDER BY fired_at DESC LIMIT 200`,
    );
    res.json(rows);
  });

  router.get("/events/list", async (_req, res) => {
    const rows = await db.all(`SELECT * FROM events ORDER BY season, name`);
    res.json(rows);
  });

  router.get("/suggestions", async (_req, res) => {
    const rows = await db.all(`
      SELECT s.*, k.name as kingdom_name, p.username 
      FROM suggestions s
      LEFT JOIN kingdoms k ON s.kingdom_id = k.id
      LEFT JOIN players p ON s.player_id = p.id
      ORDER BY s.created_at DESC
    `);
    res.json(rows);
  });

  dualRoute(router, "get", "/bug-reports", "/bug_reports", async (_req, res) => {
    const rows = await db.all(`
      SELECT * FROM bug_reports ORDER BY created_at DESC
    `);
    res.json(rows);
  });

  dualRoute(router, "get", "/admin-notes", "/admin_notes", async (_req, res) => {
    const rows = await db.all(
      `SELECT * FROM admin_notes ORDER BY created_at DESC`,
    );
    res.json(rows);
  });

  dualRoute(router, "post", "/admin-notes", "/admin_notes", async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });
    const author = req.player ? req.player.username : "Unknown Admin";
    await db.run(
      `INSERT INTO admin_notes (author_name, message) VALUES ($1, $2)`,
      [author, message],
    );
    res.json({ ok: true });
  });

  dualRoute(router, "delete", "/admin-notes/:id", "/admin_notes/:id", async (req, res) => {
    await db.run(`DELETE FROM admin_notes WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  });

  router.get("/wishlist", async (_req, res) => {
    const rows = await db.all(`SELECT * FROM wishlist ORDER BY id DESC`);
    res.json(rows);
  });

  router.post("/wishlist", async (req, res) => {
    const { category, description } = req.body;
    if (!description || !category) return res.status(400).json({ error: "Category and description required" });
    await db.run(
      `INSERT INTO wishlist (category, description, completed) VALUES ($1, $2, 0)`,
      [category, description]
    );
    res.json({ ok: true });
  });

  dualRoute(router, "get", "/changelog-entries", "/changelog_entries", async (_req, res) => {
    const rows = await db.all(
      `SELECT * FROM changelog_entries ORDER BY created_at DESC`,
    );
    res.json(rows);
  });

  dualRoute(router, "post", "/changelog-entries", "/changelog_entries", async (req, res) => {
    const { title, description, category } = req.body || {};
    const author = req.player ? req.player.username : "Admin";
    try {
      const { publishChangelogEntry } = require("../lib/changelog-publish");
      const result = await publishChangelogEntry(db, {
        title,
        description,
        category,
        source: "manual",
        authorName: author,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message || "Failed to publish changelog" });
    }
  });

  router.post("/wishlist/:id/complete", async (req, res) => {
    const row = await db.get(`SELECT * FROM wishlist WHERE id = $1`, [req.params.id]);
    if (!row) return res.status(404).json({ error: "Wishlist item not found" });
    if (row.completed) return res.json({ ok: true, alreadyCompleted: true });

    await db.run(`UPDATE wishlist SET completed = 1 WHERE id = $1`, [req.params.id]);

    const { publishChangelogEntry } = require("../lib/changelog-publish");
    const author = req.player ? req.player.username : "Admin";
    const result = await publishChangelogEntry(db, {
      title: row.category || "Wishlist delivery",
      description: row.description,
      category: row.category,
      source: "wishlist",
      sourceId: row.id,
      authorName: author,
    });

    res.json({ ok: true, ...result });
  });

  router.post("/events/create", async (req, res) => {
    const {
      key,
      name,
      description,
      season,
      effect_type,
      effect_value,
      effect_duration,
      race_only,
      is_active,
      is_positive,
    } = req.body;
    if (!key || !name)
      return res.status(400).json({ error: "Key and name required" });
    await db.run(
      `INSERT INTO events (key,name,description,season,effect_type,effect_value,effect_duration,race_only,is_active,is_positive) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        key,
        name,
        description || "",
        season || "all",
        effect_type || "happiness",
        effect_value || 0,
        effect_duration || 1,
        race_only || null,
        is_active ? 1 : 0,
        is_positive ? 1 : 0,
      ],
    );
    res.json({ ok: true });
  });

  router.post("/events/update", async (req, res) => {
    const {
      id,
      key,
      name,
      description,
      season,
      effect_type,
      effect_value,
      effect_duration,
      race_only,
      is_active,
      is_positive,
    } = req.body;
    if (!id) return res.status(400).json({ error: "ID required" });
    await db.run(
      `UPDATE events SET key=$1,name=$2,description=$3,season=$4,effect_type=$5,effect_value=$6,effect_duration=$7,race_only=$8,is_active=$9,is_positive=$10 WHERE id=$11`,
      [
        key,
        name,
        description || "",
        season || "all",
        effect_type || "happiness",
        effect_value || 0,
        effect_duration || 1,
        race_only || null,
        is_active ? 1 : 0,
        is_positive ? 1 : 0,
        id,
      ],
    );
    res.json({ ok: true });
  });

  router.post("/events/delete", async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "ID required" });
    await db.run("DELETE FROM events WHERE id = $1", [id]);
    res.json({ ok: true });
  });

  return router;
};
