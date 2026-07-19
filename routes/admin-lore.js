'use strict';

// Lore entries, random/junk/tax flavor events, world fragment metadata —
// split out of routes/admin.js (A2-9, 2026-07-19). All of these feed the
// same in-memory game/lore.js refreshLore() cache, hence bundled together.
// requireAdmin + CSRF are applied once by the composer (routes/admin.js)
// before this router is mounted.

const express = require('express');
const { dualRoute } = require('./lib/admin-dual-route');
const { FRAGMENT_METADATA } = require('../game/fragment-attunements');

const router = express.Router();

module.exports = function (db) {

  router.get("/lore", async (_req, res) => {
    const list = await db.all(
      "SELECT * FROM lore_entries ORDER BY category ASC, id ASC",
    );
    res.json({ ok: true, list });
  });

  router.post("/lore", async (req, res) => {
    const { key_id, category, title, content } = req.body;
    await db.run(
      "INSERT INTO lore_entries (key_id, category, title, content) VALUES ($1, $2, $3, $4)",
      [key_id || "", category || "general", title || "", content || ""],
    );
    await require("../game/lore").refreshLore(db);
    res.json({ ok: true });
  });

  router.put("/lore/:id", async (req, res) => {
    const { key_id, category, title, content } = req.body;
    await db.run(
      "UPDATE lore_entries SET key_id=$1, category=$2, title=$3, content=$4 WHERE id=$5",
      [
        key_id || "",
        category || "general",
        title || "",
        content || "",
        req.params.id,
      ],
    );
    await require("../game/lore").refreshLore(db);
    res.json({ ok: true });
  });

  router.delete("/lore/:id", async (req, res) => {
    await db.run("DELETE FROM lore_entries WHERE id=$1", [req.params.id]);
    await require("../game/lore").refreshLore(db);
    res.json({ ok: true });
  });

  dualRoute(router, "get", "/random-events", "/random_events", async (_req, res) => {
    const list = await db.all("SELECT * FROM random_events ORDER BY id ASC");
    res.json({ ok: true, list });
  });

  dualRoute(router, "post", "/random-events", "/random_events", async (req, res) => {
    const content = (req.body.content || "").trim();
    if (content.length > 10000) return res.status(400).json({ error: "content cannot exceed 10000 characters" });
    await db.run("INSERT INTO random_events (content) VALUES ($1)", [content]);
    await require("../game/lore").refreshLore(db);
    res.json({ ok: true });
  });

  dualRoute(router, "put", "/random-events/:id", "/random_events/:id", async (req, res) => {
    const content = (req.body.content || "").trim();
    if (content.length > 10000) return res.status(400).json({ error: "content cannot exceed 10000 characters" });
    await db.run("UPDATE random_events SET content=$1 WHERE id=$2", [
      content,
      req.params.id,
    ]);
    await require("../game/lore").refreshLore(db);
    res.json({ ok: true });
  });

  dualRoute(router, "delete", "/random-events/:id", "/random_events/:id", async (req, res) => {
    await db.run("DELETE FROM random_events WHERE id=$1", [req.params.id]);
    await require("../game/lore").refreshLore(db);
    res.json({ ok: true });
  });

  dualRoute(router, "get", "/junk-events", "/junk_events", async (_req, res) => {
    const list = await db.all("SELECT * FROM junk_events ORDER BY id ASC");
    res.json({ ok: true, list });
  });

  dualRoute(router, "post", "/junk-events", "/junk_events", async (req, res) => {
    const content = (req.body.content || "").trim();
    if (content.length > 10000) return res.status(400).json({ error: "content cannot exceed 10000 characters" });
    await db.run("INSERT INTO junk_events (content) VALUES ($1)", [content]);
    await require("../game/lore").refreshLore(db);
    res.json({ ok: true });
  });

  dualRoute(router, "delete", "/junk-events/:id", "/junk_events/:id", async (req, res) => {
    await db.run("DELETE FROM junk_events WHERE id=$1", [req.params.id]);
    await require("../game/lore").refreshLore(db);
    res.json({ ok: true });
  });

  dualRoute(router, "get", "/tax-events", "/tax_events", async (_req, res) => {
    const list = await db.all("SELECT * FROM tax_events ORDER BY id ASC");
    res.json({ ok: true, list });
  });

  dualRoute(router, "post", "/tax-events", "/tax_events", async (req, res) => {
    const content = (req.body.content || "").trim();
    if (content.length > 10000) return res.status(400).json({ error: "content cannot exceed 10000 characters" });
    await db.run("INSERT INTO tax_events (content) VALUES ($1)", [content]);
    await require("../game/lore").refreshLore(db);
    res.json({ ok: true });
  });

  dualRoute(router, "delete", "/tax-events/:id", "/tax_events/:id", async (req, res) => {
    await db.run("DELETE FROM tax_events WHERE id=$1", [req.params.id]);
    await require("../game/lore").refreshLore(db);
    res.json({ ok: true });
  });

  router.get("/fragments", (req, res) => {
    const FRAGMENT_BONUSES = require("../game/world-fragment-bonuses");

    const result = {};
    for (const [name, blds] of Object.entries(FRAGMENT_BONUSES)) {
      const meta = FRAGMENT_METADATA[name] || { emoji: "✨", description: "Ancient world anomaly" };

      result[name] = {
        emoji: meta.emoji,
        description: meta.description,
        buildings: blds
      };
    }
    res.json(result);
  });

  return router;
};
