const express = require("express");
const engine = require("../game/engine");
const { requireAuth } = require("./middleware");
const { progressGoal } = require('../game/goals');

const router = express.Router();

function safeJsonParse(str, fallback = {}, context = "unknown") {
  if (!str) return fallback;
  if (typeof str === "object") return str;
  try {
    return JSON.parse(str);
  } catch (e) {
    console.error(
      `[JSON Parse Error] Context: ${context}. Error: ${e.message}. Data: ${str}`,
    );
    return fallback;
  }
}

module.exports = function (db) {
  router.get("/me", requireAuth, async (req, res) => {
    const k = await db.get(
      "SELECT k.*, p.username, p.chat_name, p.chat_color FROM kingdoms k JOIN players p ON k.player_id = p.id WHERE k.player_id = ?",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    k.research_allocation = safeJsonParse(
      k.research_allocation,
      {},
      "me:research_allocation",
    );
    k.mage_tower_allocation = safeJsonParse(
      k.mage_tower_allocation,
      {},
      "me:mage_tower_allocation",
    );
    k.shrine_allocation = safeJsonParse(
      k.shrine_allocation,
      {},
      "me:shrine_allocation",
    );
    k.library_allocation = safeJsonParse(
      k.library_allocation,
      {},
      "me:library_allocation",
    );
    k.library_progress = safeJsonParse(
      k.library_progress,
      {},
      "me:library_progress",
    );
    k.tower_progress = safeJsonParse(k.tower_progress, {}, "me:tower_progress");
    k.scrolls = safeJsonParse(k.scrolls, {}, "me:scrolls");
    k.active_effects = safeJsonParse(k.active_effects, {}, "me:active_effects");
    k.discovered_kingdoms = safeJsonParse(
      k.discovered_kingdoms,
      {},
      "me:discovered_kingdoms",
    );
    k.build_queue = safeJsonParse(k.build_queue, {}, "me:build_queue");
    k.build_progress = safeJsonParse(k.build_progress, {}, "me:build_progress");
    k.build_allocation = safeJsonParse(
      k.build_allocation,
      {},
      "me:build_allocation",
    );
    k.troop_levels = safeJsonParse(k.troop_levels, {}, "me:troop_levels");
    k.training_allocation = safeJsonParse(
      k.training_allocation,
      {},
      "me:training_allocation",
    );
    k.smithy_allocation = safeJsonParse(
      k.smithy_allocation,
      {},
      "me:smithy_allocation",
    );
    k.racial_bonuses_unlocked = safeJsonParse(
      k.racial_bonuses_unlocked,
      {},
      "me:racial_bonuses_unlocked",
    );
    k.active_event = safeJsonParse(k.active_event, {}, "me:active_event");
    k.location_maps_wip = safeJsonParse(
      k.location_maps_wip,
      [],
      "me:location_maps_wip",
    );
    k.wall_upgrades = safeJsonParse(k.wall_upgrades, {}, "me:wall_upgrades");
    k.tower_def_upgrades = safeJsonParse(
      k.tower_def_upgrades,
      {},
      "me:tower_def_upgrades",
    );
    k.outpost_upgrades = safeJsonParse(
      k.outpost_upgrades,
      {},
      "me:outpost_upgrades",
    );
    k.defense_upgrades = safeJsonParse(
      k.defense_upgrades,
      {},
      "me:defense_upgrades",
    );
    k.tower_upgrades = safeJsonParse(k.tower_upgrades, {}, "me:tower_upgrades");
    k.school_upgrades = safeJsonParse(
      k.school_upgrades,
      {},
      "me:school_upgrades",
    );
    k.shrine_upgrades = safeJsonParse(
      k.shrine_upgrades,
      {},
      "me:shrine_upgrades",
    );
    k.library_upgrades = safeJsonParse(
      k.library_upgrades,
      {},
      "me:library_upgrades",
    );
    k.farm_upgrades = safeJsonParse(k.farm_upgrades, {}, "me:farm_upgrades");
    k.market_upgrades = safeJsonParse(
      k.market_upgrades,
      {},
      "me:market_upgrades",
    );
    k.tavern_upgrades = safeJsonParse(
      k.tavern_upgrades,
      {},
      "me:tavern_upgrades",
    );
    k.bank_upgrades = safeJsonParse(k.bank_upgrades, {}, "me:bank_upgrades");
    k.bank_deposits = safeJsonParse(k.bank_deposits, [], "me:bank_deposits");
    k.mausoleum_upgrades = safeJsonParse(
      k.mausoleum_upgrades,
      {},
      "me:mausoleum_upgrades",
    );
    k.mausoleum_allocation = safeJsonParse(
      k.mausoleum_allocation,
      {},
      "me:mausoleum_allocation",
    );
    k.ledger = safeJsonParse(k.ledger, [], "me:ledger");
    k.mercenaries = safeJsonParse(k.mercenaries, [], "me:mercenaries");
    k.collected_lore = safeJsonParse(k.collected_lore, [], "me:collected_lore");
    k.collected_events = safeJsonParse(
      k.collected_events,
      [],
      "me:collected_events",
    );
    k.achievements = safeJsonParse(k.achievements, [], "me:achievements");
    k.items = safeJsonParse(k.items, [], "me:items");
    k.resource_sequence = safeJsonParse(k.resource_sequence, {}, "me:resource_sequence");

    k.score = engine.calculateScore(k);
    k.defense_rating = engine.defenseRating(k);

    res.json(k);
  });

  // ── Save research allocation ───────────────────────────────────────────────
  router.post("/research-allocation", requireAuth, async (req, res) => {
    const { allocation } = req.body;
    if (!allocation || typeof allocation !== "object")
      return res.status(400).json({ error: "allocation object required" });
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    await db.run("UPDATE kingdoms SET research_allocation = ? WHERE id = ?", [
      JSON.stringify(allocation),
      k.id,
    ]);
    res.json({ ok: true });
  });

  router.post("/description", requireAuth, async (req, res) => {
    const { description } = req.body;
    if (description && typeof description !== "string")
      return res.status(400).json({ error: "Description must be a string" });
    if (description && description.length > 1000)
      return res
        .status(400)
        .json({ error: "Description too long (max 1000 chars)" });
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    await db.run("UPDATE kingdoms SET description = ? WHERE id = ?", [
      description || null,
      k.id,
    ]);
    res.json({ ok: true });
  });

  router.get("/rankings", requireAuth, async (req, res) => {
    const pk = await db.get(
      "SELECT id, discovered_kingdoms FROM kingdoms WHERE player_id = ?",
      [req.player.playerId],
    );
    if (!pk) return res.status(404).json({ error: "Kingdom not found" });

    // Optimized: Use subqueries instead of LEFT JOIN OR (better index utilization)
    let rows = await db.all(`
      SELECT
        k.*,
        p.id as player_id,
        p.username,
        p.is_ai,
        (
          SELECT MAX(created_at) FROM war_log
          WHERE attacker_id = k.id OR defender_id = k.id
          LIMIT 1
        ) as last_combat_at
      FROM kingdoms k
      JOIN players p ON k.player_id = p.id
      ORDER BY k.id
    `);

    // Calculate score
    for (let r of rows) {
      r.score = engine.calculateScore(r);
    }

    // Sort by score DESC
    rows.sort((a, b) => b.score - a.score);

    // Limit and discovery
    let disc = {};
    try {
      disc = safeJsonParse(pk.discovered_kingdoms, {}, "auto:discovered_kingdoms");
    } catch {}

    const rankings = rows
      .filter((r, i) => i < 500 || disc[r.id])
      .map((r, i) => ({
        id: r.id,
        name: r.name,
        race: r.race,
        land: r.land,
        turn: r.turn,
        population: r.population,
        fighters: r.fighters,
        mages: r.mages,
        level: r.level,
        player_id: r.player_id,
        username: r.username,
        is_ai: r.is_ai,
        score: r.score,
        rank: i + 1,
        last_combat_at: r.last_combat_at,
      }));

    res.json({ rankings });
  });

  router.get("/alliance-rankings", requireAuth, async (req, res) => {
    try {
      const rows = await db.all(`
        SELECT a.id, a.name, k.*
        FROM alliances a
        JOIN alliance_members am ON a.id = am.alliance_id
        JOIN kingdoms k ON am.kingdom_id = k.id
      `);

      const allianceMap = {};
      for (const r of rows) {
        if (!allianceMap[r.id]) {
          allianceMap[r.id] = {
            id: r.id,
            name: r.name,
            member_count: 0,
            total_land: 0,
            total_pop: 0,
            total_score: 0,
          };
        }
        allianceMap[r.id].member_count++;
        allianceMap[r.id].total_land += r.land || 0;
        allianceMap[r.id].total_pop += r.population || 0;
        allianceMap[r.id].total_score += engine.calculateScore(r);
      }

      const results = Object.values(allianceMap);
      results.sort((a, b) => b.total_score - a.total_score);

      res.json(results.map((r, i) => ({ ...r, rank: i + 1 })));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/war-log", requireAuth, async (_req, res) => {
    const rows = await db.all(`
      SELECT id, action_type, attacker_id, attacker_name, defender_id, defender_name,
             outcome, detail, obscured, created_at
      FROM war_log
      ORDER BY created_at DESC
      LIMIT 100
    `);
    res.json({ rows });
  });

  router.get("/war-log/:id", requireAuth, async (req, res) => {
    const row = await db.get("SELECT * FROM war_log WHERE id = ?", [
      req.params.id,
    ]);
    if (!row) return res.status(404).json({ error: "Log not found" });
    res.json(row);
  });

  router.get("/news/list", requireAuth, async (req, res) => {
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const [items] = await Promise.all([
      db.all(
        "SELECT * FROM news WHERE kingdom_id = ? ORDER BY created_at DESC LIMIT 50",
        [k.id],
      ),
      db.run(
        "UPDATE news SET is_read = 1 WHERE kingdom_id = ? AND is_read = 0",
        [k.id],
      ),
    ]);
    res.json(items);
  });

  router.delete("/news/clear", requireAuth, async (req, res) => {
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    await db.run("DELETE FROM news WHERE kingdom_id = ?", [k.id]);
    res.json({ ok: true });
  });

  async function loadTradeRoutes(k) {
    const tradeRoutes = await db.all(
      "SELECT * FROM trade_routes WHERE kingdom_id = ? OR partner_id = ?",
      [k.id, k.id],
    );
    k._trade_routes = tradeRoutes.map((r) => {
      if (r.partner_id === k.id) {
        return { ...r, partner_id: r.kingdom_id, kingdom_id: r.partner_id };
      }
      return r;
    });
    return k;
  }

  // ── Shared turn runner — used by ALL routes that consume a turn ──────────────
  async function runTurn(db, k) {
    // Inject region ownership status for bonuses
    const regionStatus = await db.get(
      "SELECT owner_alliance_id, bonus_type FROM regions WHERE name = ?",
      [k.region],
    );
    const myAlliance = await db.get(
      "SELECT alliance_id FROM alliance_members WHERE kingdom_id = ?",
      [k.id],
    );
    k._region_owned_by_my_alliance =
      regionStatus &&
      myAlliance &&
      regionStatus.owner_alliance_id === myAlliance.alliance_id;
    k._region_bonus_type = regionStatus?.bonus_type;

    // Heroes processing
    const heroes = await db.all(
      "SELECT * FROM heroes WHERE kingdom_id = ? AND status = 'idle'",
      [k.id],
    );
    k.heroes = heroes;
    await loadTradeRoutes(k);

    const { updates, events } = engine.processTurn(k);

    const heroBatch = [];
    for (const hero of heroes) {
      const xpResult = engine.awardHeroXp(hero, 10);
      heroBatch.push({ id: hero.id, level: xpResult.level, xp: xpResult.xp });
      engine.applyHeroTurnBonuses(hero, k, updates, events);
    }

    updates.turns_stored = k.turns_stored - 1;

    // Apply kingdom updates in a transaction
    // Dedup news — only insert if we haven't already sent this EXACT message recently
    const filteredEvents = [];
    for (const ev of events) {
      const existing = await db.get(
        "SELECT id FROM news WHERE kingdom_id = ? AND message = ? AND created_at > (unixepoch() - 60) LIMIT 1",
        [k.id, ev.message],
      );
      if (
        existing &&
        !ev.message.includes("Troop upkeep") &&
        !ev.message.includes("🏗️") &&
        !ev.message.includes("📚")
      )
        continue; // already sent — skip
      filteredEvents.push(ev);
    }

    try {
      await applyUpdates(db, k.id, updates);
      for (const h of heroBatch) {
        await db.run("UPDATE heroes SET level = ?, xp = ? WHERE id = ?", [
          h.level,
          h.xp,
          h.id,
        ]);
      }
      const turnNum = updates.turn || k.turn;
      if (filteredEvents.length > 0) {
        await bulkInsertNews(
          db,
          filteredEvents.map((ev) => ({
            kingdom_id: k.id,
            type: ev.type || "system",
            message: ev.message,
            turn_num: turnNum,
          })),
        );
        if (Math.random() < 0.05) await pruneNews(db, k.id, 200);
      }
    } catch (err) {
      console.error("[runTurn] apply error:", err.message);
      throw err;
    }

    // Resolve expeditions OUTSIDE the kingdom transaction so ticks are never rolled back
    let expeditionEvents = [];
    try {
      expeditionEvents = await engine.resolveExpeditions(
        db,
        { ...k, ...updates },
        engine,
      );
      if (expeditionEvents.length > 0) {
        const turnNum = updates.turn || k.turn;
        await bulkInsertNews(
          db,
          expeditionEvents.map((ev) => ({
            kingdom_id: k.id,
            type: ev.type || "system",
            message: ev.message,
            turn_num: turnNum,
          })),
        );
      }

      if (updates._find_kingdom_surveyor) {
        const other = await db.get(
          "SELECT id, name FROM kingdoms WHERE id != ? ORDER BY RANDOM() LIMIT 1",
          [k.id],
        );
        if (other) {
          const freshK = await db.get(
            "SELECT discovered_kingdoms FROM kingdoms WHERE id=?",
            [k.id],
          );
          let disc = {};
          try {
            disc = safeJsonParse(freshK.discovered_kingdoms, {}, "auto:discovered_kingdoms");
          } catch {}
          if (!disc[other.id]) {
            disc[other.id] = { found: true, name: other.name };
            await db.run(
              "UPDATE kingdoms SET discovered_kingdoms = ? WHERE id = ?",
              [JSON.stringify(disc), k.id],
            );
            const turnNum = updates.turn || k.turn;
            await db.run(
              "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?, ?, ?, ?)",
              [
                k.id,
                "system",
                `🔭 Your Surveyors discovered the kingdom of ${other.name}!`,
                turnNum,
              ],
            );
            events.push({
              type: "system",
              message: `🔭 Your Surveyors discovered the kingdom of ${other.name}!`,
            });
          }
        }
      }
    } catch (err) {
      console.error("[runTurn] expedition resolve error:", err.message);
    }

    const allEvents = [...events, ...expeditionEvents];

    // Process real-time resource expeditions and persist their loot
    try {
      const { kUpdates: expUpdates, lootEvents } = await processResourceExpeditionsDb(k.id, { ...k, ...updates });
      if (Object.keys(expUpdates).length > 0) {
        await applyUpdates(db, k.id, expUpdates);
        Object.assign(updates, expUpdates);
      }
      if (lootEvents.length > 0) {
        const turnNum = updates.turn || k.turn;
        await bulkInsertNews(db, lootEvents.map(ev => ({ kingdom_id: k.id, type: ev.type || 'system', message: ev.message, turn_num: turnNum })));
        allEvents.push(...lootEvents);
      }
    } catch (err) {
      console.error('[runTurn] resource expedition resolve error:', err.message);
    }

    // Refresh fields that resolveExpeditions may have updated via SQL
    const refreshed = await db.get(
      "SELECT rangers, fighters, gold, mana, land, scrolls, maps, blueprints_stored, troop_levels, library_progress, tower_progress, racial_bonuses_unlocked FROM kingdoms WHERE id = ?",
      [k.id],
    );
    if (refreshed) Object.assign(updates, refreshed);

    // Fetch unread news count
    const unread = await db.get(
      "SELECT COUNT(*) as c FROM news WHERE kingdom_id = ? AND is_read = 0",
      [k.id],
    );
    updates.unread_news = unread.c;

    // Calculate new score after turn
    const finalState = { ...k, ...updates };
    updates.score = engine.calculateScore(finalState);

    return { updates, events: allEvents };
  }

  // ── Take turn (advance game state) ───────────────────────────────────────────
  router.post("/turn", requireAuth, async (req, res) => {
    try {
      const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
        req.player.playerId,
      ]);
      if (!k) return res.status(404).json({ error: "Kingdom not found" });
      if (k.turns_stored < 1)
        return res
          .status(429)
          .json({ error: "No turns available — next +7 turns in 25 minutes" });
      const { updates, events } = await runTurn(db, k);
      res.json({
        ok: true,
        updates,
        events,
        turns_stored: updates.turns_stored,
      });
    } catch (err) {
      console.error("[turn] failed:", err.message);
      res
        .status(500)
        .json({ error: "Turn processing failed — please try again" });
    }
  });

  // ── Hire units ────────────────────────────────────────────────────────────────
  router.post("/hire", requireAuth, async (req, res) => {
    const { unit, amount } = req.body;
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    // Apply hire updates immediately without consuming a turn
    const hireResult = engine.hireUnits(k, unit, Number(amount));
    if (hireResult.error)
      return res.status(400).json({ error: hireResult.error });

    try {
      const hireUpdates = hireResult.updates;
      await applyUpdates(db, k.id, hireUpdates);
      res.json({
        ok: true,
        updates: hireUpdates,
        events: [],
        turns_stored: k.turns_stored,
      });
    } catch (err) {
      console.error("[hire] failed:", err.message);
      res.status(500).json({ error: "Hire failed — please try again" });
    }
  });

  // ── Research ──────────────────────────────────────────────────────────────────
  router.post("/research", requireAuth, async (req, res) => {
    const { discipline, researchers } = req.body;
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.turns_stored < 1)
      return res.status(429).json({ error: "No turns available" });

    // Run full turn first
    await loadTradeRoutes(k);
    const { updates: turnUpdates, events } = engine.processTurn(k);
    turnUpdates.turns_stored = k.turns_stored - 1;

    // Apply research on top of turn state
    const kAfterTurn = { ...k, ...turnUpdates };
    const resResult = engine.studyDiscipline(
      kAfterTurn,
      discipline,
      Number(researchers),
    );
    if (resResult.error)
      return res.status(400).json({ error: resResult.error });

    const finalUpdates = { ...turnUpdates, ...resResult.updates };
    await applyUpdates(db, k.id, finalUpdates);

    const resCol = Object.keys(resResult.updates).find((k) =>
      k.startsWith("res_"),
    );
    const newVal = resCol ? finalUpdates[resCol] : "?";
    events.push({
      type: "system",
      message: `📚 Studied ${discipline} with ${Number(researchers).toLocaleString()} researchers · +${resResult.increment} → now ${newVal}${discipline !== "spellbook" ? "%" : ""}.`,
    });
    await bulkInsertNews(
      db,
      events.map((ev) => ({
        kingdom_id: k.id,
        type: ev.type || "system",
        message: ev.message,
        turn_num: turnUpdates.turn || k.turn,
      })),
    );
    res.json({
      ok: true,
      increment: resResult.increment,
      updates: finalUpdates,
      events,
      turns_stored: finalUpdates.turns_stored,
    });
  });

  // ── Queue buildings — charges gold, no turn cost ──────────────────────────────
  router.post("/build-queue", requireAuth, async (req, res) => {
    const { orders } = req.body;
    if (!orders || typeof orders !== "object")
      return res.status(400).json({ error: "orders required" });
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    try {
      k.build_queue = safeJsonParse(k.build_queue, {}, "auto:build_queue");
    } catch {
      k.build_queue = {};
    }
    const result = engine.queueBuildings(k, orders);
    if (result.error) return res.status(400).json({ error: result.error });
    await applyUpdates(db, k.id, result.updates);
    res.json({
      ok: true,
      queue: JSON.parse(result.updates.build_queue),
      gold: result.updates.gold,
      totalCost: result.totalCost,
    });
  });

  // ── Save training allocation ───────────────────────────────────────────────
  router.post("/training-allocation", requireAuth, async (req, res) => {
    const { allocation } = req.body;
    if (!allocation || typeof allocation !== "object")
      return res.status(400).json({ error: "allocation required" });
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    let total = 0;
    const capacity = k.bld_training * 100;
    const clean_alloc = {};
    for (const [unit, amount] of Object.entries(allocation)) {
      const amt = Math.max(0, parseInt(amount) || 0);
      if (amt > (k[unit] || 0))
        return res.status(400).json({ error: `Not enough ${unit}` });
      total += amt;
      if (amt > 0) clean_alloc[unit] = amt;
    }
    if (total > capacity)
      return res
        .status(400)
        .json({ error: `Exceeds training capacity (${capacity})` });

    await db.run("UPDATE kingdoms SET training_allocation = ? WHERE id = ?", [
      JSON.stringify(clean_alloc),
      k.id,
    ]);
    res.json({ ok: true });
  });
  router.post("/build-allocation", requireAuth, async (req, res) => {
    const { allocation } = req.body;
    if (!allocation || typeof allocation !== "object")
      return res.status(400).json({ error: "allocation required" });
    const k = await db.get(
      "SELECT id, engineers FROM kingdoms WHERE player_id = ?",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const total = Object.values(allocation).reduce(
      (s, v) => s + (Number(v) || 0),
      0,
    );
    if (total > k.engineers)
      return res.status(400).json({
        error: `Allocated ${total.toLocaleString()} but only have ${k.engineers.toLocaleString()} engineers`,
      });
    await db.run("UPDATE kingdoms SET build_allocation = ? WHERE id = ?", [
      JSON.stringify(allocation),
      k.id,
    ]);
    res.json({ ok: true });
  });

  router.post("/demolish", requireAuth, async (req, res) => {
    const { building, amount } = req.body;
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    const result = engine.demolishBuilding(k, building, parseInt(amount) || 1);
    if (result.error) return res.status(400).json({ error: result.error });

    await applyUpdates(db, k.id, result.updates);
    const msg = `🏗️ Demolished ${result.refund.count} ${building.replace(/_/g, " ")}. Refunded ${result.refund.gold.toLocaleString()} gold and ${result.refund.land} acres.`;
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
      [k.id, "system", msg, k.turn],
    );

    res.json({ ok: true, updates: result.updates, message: msg });
  });

  // ── Forge tools — costs 1 turn + gold for scaffolding ───────────────────────
  router.post("/forge-tools", requireAuth, async (req, res) => {
    const { toolType, quantity } = req.body;
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.turns_stored < 1)
      return res.status(429).json({ error: "No turns available" });
    const smithies = k.bld_smithies;
    if (smithies === 0)
      return res.status(400).json({ error: "Need at least 1 smithy" });
    // Validate caps and cost before running turn
    if (toolType === "hammers") {
      const cap = smithies * 25;
      if (k.hammers_stored >= cap)
        return res
          .status(400)
          .json({ error: `Hammer storage full (${cap}/${cap})` });
    } else if (toolType === "scaffolding") {
      const cap = smithies * 10;
      if (k.scaffolding_stored >= cap)
        return res
          .status(400)
          .json({ error: `Scaffolding storage full (${cap}/${cap})` });
      if (k.gold < 2500)
        return res
          .status(400)
          .json({ error: "Need 2,500 gold to make scaffolding" });
    }
    try {
      const { updates, events } = await runTurn(db, k);
      const kAfterTurn = { ...k, ...updates };
      const toolResult = engine.forgeTools(
        kAfterTurn,
        toolType,
        Number(quantity) || 1,
      );
      if (toolResult.error)
        return res.status(400).json({ error: toolResult.error });
      await applyUpdates(db, k.id, toolResult.updates);
      const finalUpdates = { ...updates, ...toolResult.updates };
      res.json({
        ok: true,
        updates: finalUpdates,
        events,
        turns_stored: finalUpdates.turns_stored,
      });
    } catch (err) {
      console.error("[forge-tools] failed:", err.message);
      res.status(500).json({ error: "Forging failed — please try again" });
    }
  });

  // ── Smithy — buy hammers for gold ─────────────────────────────────────────────
  router.post("/smithy/buy-hammers", requireAuth, async (req, res) => {
    const amount = Math.max(1, parseInt(req.body.amount) || 1);
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id=?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (!(k.bld_smithies > 0))
      return res.status(400).json({ error: "Need at least 1 smithy" });
    const cost = amount * 25;
    if (k.gold < cost)
      return res
        .status(400)
        .json({ error: `Need ${cost.toLocaleString()} gold` });
    const cap = k.bld_smithies * 25;
    const newHammers = Math.min(cap, k.hammers_stored + amount);
    const bought = newHammers - k.hammers_stored;
    if (bought <= 0)
      return res.status(400).json({ error: "Hammer storage full" });
    const actualCost = bought * 25;
    await db.run(
      "UPDATE kingdoms SET gold=gold-?, hammers_stored=? WHERE id=?",
      [actualCost, newHammers, k.id],
    );
    res.json({
      ok: true,
      bought,
      cost: actualCost,
      hammers_stored: newHammers,
      gold: k.gold - actualCost,
    });
  });

  // ── Smithy — buy scaffolding for gold ────────────────────────────────────────
  router.post("/smithy/buy-scaffolding", requireAuth, async (req, res) => {
    const amount = Math.max(1, parseInt(req.body.amount) || 1);
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id=?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    const baseCost = 2500;
    const hasSmithy = k.bld_smithies > 0;
    const unitPrice = hasSmithy ? baseCost : Math.floor(baseCost * 1.25);
    const cost = amount * unitPrice;

    if (k.gold < cost)
      return res
        .status(400)
        .json({ error: `Need ${cost.toLocaleString()} gold` });

    // Base cap of 10 even without smithy, otherwise 10 per smithy
    const cap = Math.max(10, k.bld_smithies * 10);
    const currentScaff = k.scaffolding_stored;
    const newScaff = Math.min(cap, currentScaff + amount);
    const bought = newScaff - currentScaff;

    if (bought <= 0)
      return res.status(400).json({ error: "Scaffolding storage full" });

    const actualCost = bought * unitPrice;
    await db.run(
      "UPDATE kingdoms SET gold=gold-?, scaffolding_stored=? WHERE id=?",
      [actualCost, newScaff, k.id],
    );
    res.json({
      ok: true,
      bought,
      cost: actualCost,
      scaffolding_stored: newScaff,
      gold: k.gold - actualCost,
      markup: !hasSmithy,
    });
  });

  // ── Trade Routes ───────────────────────────────────────────────────────────
  router.get("/trade-routes/list", requireAuth, async (req, res) => {
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id=?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const routes = await db.all(
      `
      SELECT tr.*, k.name as partner_name, k.race as partner_race, k.land as partner_land
      FROM trade_routes tr
      JOIN kingdoms k ON (tr.partner_id = k.id OR tr.kingdom_id = k.id)
      WHERE (tr.kingdom_id = ? OR tr.partner_id = ?) AND k.id != ?
    `,
      [k.id, k.id, k.id],
    );
    res.json({ routes });
  });

  router.post("/trade-routes/establish", requireAuth, async (req, res) => {
    try {
      const targetId = parseInt(req.body.targetId);
      if (isNaN(targetId))
        return res.status(400).json({ error: "Invalid target kingdom" });

      const k = await db.get("SELECT * FROM kingdoms WHERE player_id=?", [
        req.player.playerId,
      ]);
      if (!k) return res.status(404).json({ error: "Kingdom not found" });

      // Requirement Check: Trading Post
      const marketUpgrades = safeJsonParse(
        k.market_upgrades,
        {},
        "establish:market_upgrades",
      );
      if (!marketUpgrades.trading_post) {
        return res
          .status(400)
          .json({
            error:
              "Build a Trading Post in the Markets tab to establish trade routes",
          });
      }

      if (k.id == targetId)
        return res.status(400).json({ error: "Cannot trade with yourself" });

      const target = await db.get("SELECT * FROM kingdoms WHERE id=?", [
        targetId,
      ]);
      if (!target) return res.status(404).json({ error: "Target not found" });

      // Check caps
      const currentRoutes = await db.get(
        "SELECT COUNT(*) as count FROM trade_routes WHERE kingdom_id=? OR partner_id=?",
        [k.id, k.id],
      );
      if (currentRoutes.count >= (engine.TRADE_ROUTE_MAX || 5)) {
        return res
          .status(400)
          .json({
            error: `Maximum trade routes reached (${engine.TRADE_ROUTE_MAX || 5})`,
          });
      }

      // Check if already exists
      const existing = await db.get(
        "SELECT id FROM trade_routes WHERE (kingdom_id=? AND partner_id=?) OR (kingdom_id=? AND partner_id=?)",
        [k.id, targetId, targetId, k.id],
      );
      if (existing)
        return res
          .status(400)
          .json({ error: "Trade route already exists with this kingdom" });

      // Cost
      const cost = engine.TRADE_ROUTE_ESTABLISH_COST || 10000;
      if (k.gold < cost)
        return res
          .status(400)
          .json({
            error: `Establishing a permanent trade route costs ${cost.toLocaleString()} gold. You only have ${Math.floor(k.gold).toLocaleString()}.`,
          });

      // Simple distance calculation
      const distance = Math.floor(Math.random() * 50) + 10;

      await db.run("UPDATE kingdoms SET gold = gold - ? WHERE id = ?", [
        cost,
        k.id,
      ]);
      await db.run(
        "INSERT INTO trade_routes (kingdom_id, partner_id, distance, stability) VALUES (?, ?, ?, ?)",
        [k.id, targetId, distance, 100],
      );

      await db.run(
        "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?, ?, ?, ?)",
        [
          target.id,
          "system",
          `🤝 The merchants of ${k.name} have established a permanent trade route to your kingdom!`,
          target.turn,
        ],
      );

      res.json({
        ok: true,
        message:
          "Trade route established! You can see it in your Economy > Trade Routes tab.",
      });
    } catch (err) {
      console.error("[establishTradeRoute] error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/trade-routes/cancel", requireAuth, async (req, res) => {
    const { routeId } = req.body;
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id=?", [
      req.player.playerId,
    ]);
    await db.run(
      "DELETE FROM trade_routes WHERE id = ? AND (kingdom_id = ? OR partner_id = ?)",
      [routeId, k.id, k.id],
    );
    res.json({ ok: true });
  });

  router.post("/smithy-allocation", requireAuth, async (_req, res) => {
    res.json({ ok: true });
  });
  router.post("/search", requireAuth, async (req, res) => {
    const { type, rangers } = req.body;
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.turns_stored < 1)
      return res.status(429).json({ error: "No turns available" });

    const r = Number(rangers) || 0;
    if (r <= 0)
      return res.status(400).json({ error: "Send at least some rangers" });
    if (r > engine.getAvailableUnits(k, "rangers"))
      return res.status(400).json({
        error: "Not enough available rangers (some may be in training)",
      });

    try {
      const { updates, events } = await runTurn(db, k);
      const kAfterTurn = { ...k, ...updates };
      const tacticsMult = 1 + (kAfterTurn.res_military || 0) / 1000;
      let searchResult = {};
      let searchMessage = "";

      if (type === "land") {
        const exploreBonus =
          {
            dire_wolf: 1.4,
            dark_elf: 1.25,
            human: 1.1,
            orc: 1.05,
            dwarf: 0.9,
            high_elf: 0.95,
          }[kAfterTurn.race] || 1.0;
        const rangerLvBonus = engine.unitLevelMult(kAfterTurn, "rangers");

        const currentLand = kAfterTurn.land || 0;
        // Exponentially harder with more land
        const diminish = Math.exp(-0.0002 * currentLand);

        // 100 human rangers initially find 10 land. So base coefficient is 1 / 11.0
        const found = Math.max(
          1,
          Math.floor(r * (1 / 11.0) * exploreBonus * rangerLvBonus * diminish),
        );

        updates.land = (kAfterTurn.land || 0) + found;
        searchResult = { found, unit: "acres" };
        searchMessage = `🗺️ Rangers discovered +${found.toLocaleString()} acres${found <= 1 ? " (land getting scarce)" : ""}.`;
      } else if (type === "gold") {
        const found = Math.floor(r * 12 * tacticsMult);
        updates.gold = (updates.gold || kAfterTurn.gold || 0) + found;
        searchResult = { found, unit: "GC" };
        searchMessage = `💰 Rangers returned with ${found.toLocaleString()} gold from foraging.`;
      } else if (type === "food") {
        const found = Math.floor(r * 0.5 * tacticsMult);
        updates.food = (kAfterTurn.food || 0) + found;
        searchResult = { found, unit: "food" };
        searchMessage = `🌾 Rangers foraged ${found.toLocaleString()} food from the wilderness.`;
      } else if (type === "targets") {
        const scouts = Math.max(1, r);
        const baseFound = Math.floor(scouts * 0.005) + 1; // scaled down slightly

        // Find random kingdoms I haven't discovered yet
        let disc = {};
        try {
          disc = safeJsonParse(kAfterTurn.discovered_kingdoms, {}, "auto:discovered_kingdoms");
        } catch {}

        const currentIds = Object.keys(disc)
          .map((id) => parseInt(id))
          .filter((id) => !isNaN(id));
        currentIds.push(k.id); // exclude self

        const placeholders = currentIds.map(() => "?").join(",");
        const query = `SELECT id, name FROM kingdoms WHERE id NOT IN (${placeholders}) ORDER BY RANDOM() LIMIT ?`;
        const others = await db.all(query, [...currentIds, baseFound]);

        let foundCount = 0;
        let lastFoundName = "";
        others.forEach((o) => {
          disc[o.id] = { found: true, name: o.name };
          foundCount++;
          lastFoundName = o.name;
        });

        if (foundCount > 0) {
          updates.discovered_kingdoms = JSON.stringify(disc);
        }

        searchResult = { found: foundCount, unit: "kingdoms" };
        searchMessage =
          foundCount > 0
            ? foundCount === 1
              ? `👁️ Rangers scouted a new target: ${lastFoundName}.`
              : `👁️ Rangers scouted ${foundCount} new target kingdoms.`
            : `🔍 Rangers searched the area but found no new settlements.`;
      } else {
        return res.status(400).json({ error: "Invalid search type" });
      }

      await applyUpdates(db, k.id, {
        land: updates.land,
        gold: updates.gold,
        food: updates.food,
        discovered_kingdoms: updates.discovered_kingdoms,
      });

      const turnNum = updates.turn || k.turn;
      // Removed bulkInsertNews for search results as per user request (only in log)

      const xpResult = engine.awardXp(
        kAfterTurn,
        "exploration",
        type === "land"
          ? searchResult.found
          : type === "gold"
            ? Math.floor(searchResult.found / 1000)
            : 5,
      );
      updates.xp = xpResult.xp;
      updates.level = xpResult.level;

      // Award Troop XP to Rangers for exploration
      const rTroopXp = engine.awardTroopXp(
        { ...kAfterTurn, xp: updates.xp, level: updates.level },
        "rangers",
        8,
      );
      updates.troop_levels = rTroopXp.troop_levels;
      if (rTroopXp.levelUps && rTroopXp.levelUps.length > 0) {
        events.push(
          ...rTroopXp.levelUps.map((msg) => ({
            type: "system",
            message: `🎖️ ${msg}`,
          })),
        );
      }

      if (xpResult.levelled) {
        await bulkInsertNews(
          db,
          xpResult.events.map((ev) => ({
            kingdom_id: k.id,
            type: "system",
            message: ev.message,
            turn_num: turnNum,
          })),
        );
        events.push(...xpResult.events);
      }
      await applyUpdates(db, k.id, {
        xp: updates.xp,
        level: updates.level,
        troop_levels: updates.troop_levels,
      });

      res.json({
        ok: true,
        type,
        result: searchResult,
        message: searchMessage,
        updates,
        events: [...events, { type: "system", message: searchMessage }],
        turns_stored: updates.turns_stored,
      });
    } catch (err) {
      console.error("[search] failed:", err.message);
      res.status(500).json({ error: "Search failed — please try again" });
    }
  });

  // ── Mage tower allocation ────────────────────────────────────────────────────
  router.post("/tower-craft", requireAuth, async (req, res) => {
    const { item, qty } = req.body;
    if (!item || qty <= 0)
      return res.status(400).json({ error: "Invalid input" });
    const k = await db.get(
      "SELECT id, bld_mage_towers, mage_tower_allocation FROM kingdoms WHERE player_id = ?",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.bld_mage_towers === 0)
      return res
        .status(400)
        .json({ error: "You need at least 1 Mage Tower first" });

    let alloc = {};
    try {
      alloc = safeJsonParse(k.mage_tower_allocation, {}, "auto:mage_tower_allocation");
    } catch {}
    if (alloc.scroll_craft) {
      alloc[alloc.scroll_craft] = alloc.scroll_target || 999;
      delete alloc.scroll_craft;
      delete alloc.scroll_target;
    }

    alloc[item] = (alloc[item] || 0) + Number(qty);
    await db.run("UPDATE kingdoms SET mage_tower_allocation = ? WHERE id = ?", [
      JSON.stringify(alloc),
      k.id,
    ]);
    res.json({ ok: true, allocation: JSON.stringify(alloc) });
  });

  router.post("/tower-cancel", requireAuth, async (req, res) => {
    const { item } = req.body;
    const k = await db.get(
      "SELECT id, mage_tower_allocation FROM kingdoms WHERE player_id = ?",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    let alloc = {};
    try {
      alloc = safeJsonParse(k.mage_tower_allocation, {}, "auto:mage_tower_allocation");
    } catch {}
    if (alloc.scroll_craft) {
      alloc[alloc.scroll_craft] = alloc.scroll_target || 999;
      delete alloc.scroll_craft;
      delete alloc.scroll_target;
    }

    delete alloc[item];
    await db.run("UPDATE kingdoms SET mage_tower_allocation = ? WHERE id = ?", [
      JSON.stringify(alloc),
      k.id,
    ]);
    res.json({ ok: true, allocation: JSON.stringify(alloc) });
  });

  // ── Shrine allocation ─────────────────────────────────────────────────────────
  router.post("/shrine-allocation", requireAuth, async (req, res) => {
    const { allocation } = req.body;
    if (!allocation || typeof allocation !== "object")
      return res.status(400).json({ error: "allocation required" });
    const k = await db.get(
      "SELECT id, bld_shrines, clerics FROM kingdoms WHERE player_id = ?",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.bld_shrines === 0)
      return res
        .status(400)
        .json({ error: "You need at least 1 Shrine first" });
    const clericsAlloc = Math.min(
      Number(allocation.clerics) || 0,
      k.clerics,
    );
    await db.run("UPDATE kingdoms SET shrine_allocation = ? WHERE id = ?", [
      JSON.stringify({ clerics: clericsAlloc }),
      k.id,
    ]);
    res.json({ ok: true, allocation: { clerics: clericsAlloc } });
  });

  // ── Mausoleum allocation ──────────────────────────────────────────────────────
  router.post("/mausoleum-allocation", requireAuth, async (req, res) => {
    const { allocation } = req.body;
    if (!allocation || typeof allocation !== "object")
      return res.status(400).json({ error: "allocation required" });
    const k = await db.get(
      "SELECT id, bld_mausoleums, thralls FROM kingdoms WHERE player_id = ?",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.bld_mausoleums === 0)
      return res
        .status(400)
        .json({ error: "You need at least 1 Mausoleum first" });

    // Thralls are mostly passive but we use allocation if there's any task for them
    // For now we just store it
    await db.run("UPDATE kingdoms SET mausoleum_allocation = ? WHERE id = ?", [
      JSON.stringify(allocation),
      k.id,
    ]);
    res.json({ ok: true, allocation });
  });

  router.post("/buy-mausoleum-upgrade", requireAuth, async (req, res) => {
    const { upgradeKey } = req.body;
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.race !== "vampire")
      return res
        .status(403)
        .json({ error: "Only vampires can buy mausoleum upgrades" });

    const upgrades = engine.MAUSOLEUM_UPGRADES;
    const upg = upgrades[upgradeKey];
    if (!upg) return res.status(400).json({ error: "Invalid upgrade" });

    const owned = safeJsonParse(k.mausoleum_upgrades, {}, "auto:mausoleum_upgrades");
    if (owned[upgradeKey])
      return res.status(400).json({ error: "Already owned" });

    if (upg.requires && !owned[upg.requires])
      return res
        .status(400)
        .json({
          error: "Prerequisite not met: " + upgrades[upg.requires].name,
        });

    if (k.gold < upg.cost)
      return res.status(400).json({ error: "Not enough gold" });

    owned[upgradeKey] = true;
    await db.run(
      "UPDATE kingdoms SET gold = gold - ?, mausoleum_upgrades = ? WHERE id = ?",
      [upg.cost, JSON.stringify(owned), k.id],
    );
    res.json({ ok: true, upgrade: upg });
  });

  // ── Military attack ───────────────────────────────────────────────────────────
  router.post("/attack", requireAuth, async (req, res) => {
    const {
      targetId,
      fighters,
      rangers,
      mages,
      warMachines,
      ninjas,
      thieves,
      clerics,
      engineers,
      ladders,
    } = req.body;
    const sentUnits = {
      fighters: Math.max(0, parseInt(fighters) || 0),
      rangers: Math.max(0, parseInt(rangers) || 0),
      mages: Math.max(0, parseInt(mages) || 0),
      warMachines: Math.max(0, parseInt(warMachines) || 0),
      ninjas: Math.max(0, parseInt(ninjas) || 0),
      thieves: Math.max(0, parseInt(thieves) || 0),
      clerics: Math.max(0, parseInt(clerics) || 0),
      engineers: Math.max(0, parseInt(engineers) || 0),
      ladders: Math.max(0, parseInt(ladders) || 0),
    };

    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.turns_stored < 1)
      return res.status(429).json({ error: "No turns available" });
    if (
      sentUnits.fighters <= 0 &&
      sentUnits.rangers <= 0 &&
      sentUnits.mages <= 0
    )
      return res.status(400).json({ error: "Send at least some troops" });

    const target = await db.get(
      "SELECT k.*, p.is_ai FROM kingdoms k JOIN players p ON k.player_id = p.id WHERE k.id = ?",
      [targetId],
    );
    if (!target)
      return res.status(404).json({ error: "Target kingdom not found" });
    if (target.id === k.id)
      return res.status(400).json({ error: "Cannot attack yourself" });

    // AI vs AI only - no cross-faction warfare
    const attacker_is_ai = await db.get("SELECT is_ai FROM players WHERE id = ?", [req.player.playerId]);
    if ((attacker_is_ai?.is_ai || false) !== (target.is_ai || false)) {
      return res.status(400).json({ error: "AI and human kingdoms cannot war against each other" });
    }

    if (sentUnits.fighters > engine.getAvailableUnits(k, "fighters"))
      return res.status(400).json({
        error: "Not enough available fighters (some may be in training)",
      });
    if (sentUnits.rangers > engine.getAvailableUnits(k, "rangers"))
      return res.status(400).json({
        error: "Not enough available rangers (some may be in training)",
      });
    if (sentUnits.mages > engine.getAvailableUnits(k, "mages"))
      return res.status(400).json({
        error: "Not enough available mages (some may be in training)",
      });
    if (sentUnits.warMachines > engine.getAvailableUnits(k, "war_machines"))
      return res
        .status(400)
        .json({ error: "Not enough available war machines" });
    if (sentUnits.ninjas > engine.getAvailableUnits(k, "ninjas"))
      return res.status(400).json({
        error: "Not enough available ninjas (some may be in training)",
      });
    if (sentUnits.thieves > engine.getAvailableUnits(k, "thieves"))
      return res.status(400).json({
        error: "Not enough available thieves (some may be in training)",
      });
    if (sentUnits.clerics > engine.getAvailableUnits(k, "clerics"))
      return res.status(400).json({
        error: "Not enough available clerics/thralls (some may be in training)",
      });
    if (sentUnits.engineers > engine.getAvailableUnits(k, "engineers"))
      return res.status(400).json({
        error: "Not enough available engineers (some may be in training)",
      });
    if (sentUnits.ladders > engine.getAvailableUnits(k, "ladders"))
      return res.status(400).json({ error: "Not enough available 🪜 ladders" });

    if (k.turn < 400)
      return res.status(400).json({
        error: `You are under newbie protection until Turn 400. You cannot attack yet.`,
      });
    if ((target.turn || 0) < 400)
      return res.status(400).json({
        error: `${target.name} is under newbie protection until Turn 400`,
      });

    // Location system — must have mapped this kingdom
    let atkDisc = {};
    try {
      atkDisc = safeJsonParse(k.discovered_kingdoms, {}, "auto:discovered_kingdoms");
    } catch {}
    if (!atkDisc[targetId] || !atkDisc[targetId].mapped) {
      return res
        .status(400)
        .json({ error: "You need a location map for this target." });
    }

    // Fetch heroes
    const attackerHeroes = await db.all(
      "SELECT * FROM heroes WHERE kingdom_id = ? AND status = ?",
      [k.id, "idle"],
    );
    const defenderHeroes = await db.all(
      "SELECT * FROM heroes WHERE kingdom_id = ? AND status = ?",
      [target.id, "idle"],
    );

    // Location system — must have mapped this kingdom (warn but don't block during transition)
    try {
      safeJsonParse(k.discovered_kingdoms, {}, "auto:discovered_kingdoms");
    } catch {}
    // Defender auto-stores attacker's location on being attacked
    let defDisc = {};
    try {
      defDisc = safeJsonParse(target.discovered_kingdoms, {}, "auto:discovered_kingdoms");
    } catch {}
    if (!defDisc[k.id]?.mapped) {
      defDisc[k.id] = { found: true, mapped: true };
      await db.run("UPDATE kingdoms SET discovered_kingdoms=? WHERE id=?", [
        JSON.stringify(defDisc),
        target.id,
      ]);
    }

    const result = engine.resolveMilitaryAttack(
      k,
      target,
      sentUnits,
      attackerHeroes,
      defenderHeroes,
    );
    if (result.error) return res.status(400).json({ error: result.error });

    // Update heroes in DB
    for (const h of attackerHeroes) {
      const resHero = engine.awardHeroXp(h, result.win ? 500 : 100);
      await db.run("UPDATE heroes SET xp = ?, level = ? WHERE id = ?", [
        resHero.xp,
        resHero.level,
        h.id,
      ]);
    }
    for (const h of defenderHeroes) {
      const resHero = engine.awardHeroXp(h, result.win ? 100 : 500);
      await db.run("UPDATE heroes SET xp = ?, level = ? WHERE id = ?", [
        resHero.xp,
        resHero.level,
        h.id,
      ]);
    }

    progressGoal(k, result.attackerUpdates, 'attack_made', 1);

    await applyKingdomUpdates(k.id, result.attackerUpdates);
    await applyKingdomUpdates(target.id, result.defenderUpdates);
    await db.run(
      "UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = ?",
      [k.id],
    );

    // Bounty claiming
    if (result.win) {
      const activeBounties = await db.all(
        "SELECT * FROM bounties WHERE target_id = ? AND status = ?",
        [target.id, "active"],
      );
      if (activeBounties.length > 0) {
        let totalClaimed = 0;
        for (const b of activeBounties) {
          totalClaimed += b.amount;
          await db.run(
            "UPDATE bounties SET status = ?, claimed_by_id = ? WHERE id = ?",
            ["claimed", k.id, b.id],
          );
        }
        if (totalClaimed > 0) {
          await db.run("UPDATE kingdoms SET gold = gold + ? WHERE id = ?", [
            totalClaimed,
            k.id,
          ]);
          result.atkEvent += ` 💰 BOUNTY CLAIMED! You collected ${totalClaimed.toLocaleString()} gold in bounties placed on ${target.name}.`;
          await db.run(
            "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
            [
              k.id,
              "system",
              `💰 You claimed ${totalClaimed.toLocaleString()} gold in bounties by defeating ${target.name}!`,
              k.turn,
            ],
          );
        }
      }
    }

    // 4% chance to find a map on a corpse if victory
    if (result.win && Math.random() < 0.04) {
      await db.run("UPDATE kingdoms SET maps = maps + 1 WHERE id = ?", [k.id]);
      result.atkEvent += ` 🗺️ In the aftermath, your troops scavenged a map from a fallen scout's corpse.`;
    }

    // War log
    const detail = JSON.stringify({
      sent: result.report.sent,
      landTaken: result.report.landTransferred,
      atkLost: result.report.atkFightersLost,
      defLost: result.report.defFightersLost,
      ninjaKills: result.report.ninjaKills || 0,
      rangerKills: result.report.rangerKills || 0,
      flankKills: result.report.flankKills || 0,
      buildingsDestroyed: result.report.defBldLost || 0,
      steps: result.report.steps || [],
      ...result.report,
    });
    const logRes = await db.run(
      `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES (?,?,?,?,?,?,?,0)`,
      [
        "attack",
        k.id,
        k.name,
        target.id,
        target.name,
        result.win ? "victory" : "repelled",
        detail,
      ],
    );
    const reportId = logRes.lastID;

    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)",
      [k.id, "attack", result.atkEvent, k.turn, reportId],
    );
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)",
      [target.id, "attack", result.defEvent, target.turn, reportId],
    );

    // Signal tower — warn defender (and alliance) of attack
    let defTowerUpgrades = {};
    try {
      defTowerUpgrades = safeJsonParse(target.tower_def_upgrades, {}, "auto:tower_def_upgrades");
    } catch {}
    if (defTowerUpgrades.watchtower || defTowerUpgrades.signal_tower) {
      await db.run(
        "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
        [
          target.id,
          "system",
          `⚠️ Watchtower scouts have detected ${k.name} massing troops at the border.`,
          target.turn,
        ],
      );
      if (defTowerUpgrades.signal_tower) {
        // Warn all alliance members
        const allianceMembers = await db.all(
          `
          SELECT am.kingdom_id FROM alliance_members am
          JOIN alliance_members am2 ON am.alliance_id = am2.alliance_id
          WHERE am2.kingdom_id = ? AND am.kingdom_id != ?`,
          [target.id, target.id],
        );
        for (const mem of allianceMembers) {
          await db.run(
            "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
            [
              mem.kingdom_id,
              "system",
              `📡 Signal Tower: Your ally ${target.name} is under attack by ${k.name}!`,
              k.turn,
            ],
          );
        }
      }
    }

    // Warmachine damage report
    if (result.win) {
      if (result.report.wallsDestroyed > 0) {
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
          [
            target.id,
            "attack",
            `🧱 ${result.report.wallsDestroyed} walls were destroyed in the bombardment.`,
            target.turn,
          ],
        );
      } else if (result.report.buildingDamaged) {
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
          [
            target.id,
            "attack",
            `🔥 Attackers burned ${result.report.buildingDamaged} with no walls to stop them.`,
            target.turn,
          ],
        );
      }
    }

    const freshK = await db.get("SELECT maps FROM kingdoms WHERE id = ?", [
      k.id,
    ]);
    res.json({
      ok: true,
      report: result.report,
      updates: { ...result.attackerUpdates, maps: freshK.maps },
      event: result.atkEvent,
    });
  });

  // ── Cast spell ───────────────────────────────────────────────────────────────
  router.post("/spell", requireAuth, async (req, res) => {
    const { spellId, targetId, obscure } = req.body;
    if (!spellId) return res.status(400).json({ error: "spellId required" });

    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.turns_stored < 1)
      return res.status(429).json({ error: "No turns available" });

    const def = engine.SPELL_DEFS[spellId];
    if (!def) return res.status(400).json({ error: "Unknown spell" });

    // Friendly spells target yourself (by default); offensive spells require a target + map
    const isFriendly = def.effect === "friendly";
    let target;

    if (isFriendly) {
      if (targetId && targetId != k.id) {
        target = await db.get("SELECT * FROM kingdoms WHERE id = ?", [targetId]);
        if (!target) return res.status(404).json({ error: "Target kingdom not found" });
      } else {
        target = k; // cast on self
      }
    } else {
      if (!targetId)
        return res
          .status(400)
          .json({ error: "targetId required for offensive spells" });
      if (k.turn < 400)
        return res.status(400).json({
          error:
            "You are under newbie protection until Turn 400. You cannot cast offensive spells yet.",
        });
      let atkDisc = {};
      try {
        atkDisc = safeJsonParse(k.discovered_kingdoms, {}, "auto:discovered_kingdoms");
      } catch {}
      if (!atkDisc[targetId] || !atkDisc[targetId].mapped) {
        return res.status(400).json({
          error: "You need a location map for this target.",
        });
      }
      target = await db.get("SELECT k.*, p.is_ai FROM kingdoms k JOIN players p ON k.player_id = p.id WHERE k.id = ?", [targetId]);
      if (!target)
        return res.status(404).json({ error: "Target kingdom not found" });
      if (target.player_id === k.player_id)
        return res
          .status(400)
          .json({ error: "Cannot cast offensive spells on yourself" });

      // AI vs AI only - no cross-faction spell warfare
      const caster_is_ai = await db.get("SELECT is_ai FROM players WHERE id = ?", [req.player.playerId]);
      if ((caster_is_ai?.is_ai || false) !== (target.is_ai || false)) {
        return res.status(400).json({ error: "AI and human kingdoms cannot war against each other" });
      }

      if ((target.turn || 0) < 400)
        return res.status(400).json({
          error: `${target.name} is under newbie protection until Turn 400 (currently Turn ${target.turn})`,
        });
    }

    const result = engine.castSpell(k, target, spellId, !!obscure);
    if (result.error) return res.status(400).json({ error: result.error });

    progressGoal(k, result.casterUpdates, 'spell_cast', 1);

    await applyKingdomUpdates(k.id, result.casterUpdates);
    await applyKingdomUpdates(target.id, result.targetUpdates);

    await db.run(
      "UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = ?",
      [k.id],
    );

    // War log for offensive spells or friendly spells on others
    if (!isFriendly || k.id !== target.id) {
      const logRes = await db.run(
        `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured)
        VALUES (?,?,?,?,?,?,?,?)`,
        [
          isFriendly ? "blessing" : "spell",
          k.id,
          k.name,
          target.id,
          target.name,
          "cast",
          `${spellId.replace(/_/g, " ")} — ${result.report.damageDesc || ""}`,
          obscure ? 1 : 0,
        ],
      );
      const reportId = logRes.lastID;

      if (result.casterEvent) {
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)",
          [k.id, "system", result.casterEvent, k.turn, reportId],
        );
      }
      if (result.targetEvent) {
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)",
          [
            target.id,
            isFriendly ? "system" : "attack",
            result.targetEvent,
            target.turn || 0,
            reportId,
          ],
        );
      }
    } else {
      // Self cast news only
      if (result.casterEvent) {
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
          [k.id, "system", result.casterEvent, k.turn],
        );
      }
    }

    // Consume map on cast (map is used up like a compass — one per interaction)
    // Map consumption for spells disabled - rely on location maps
    // if (!isFriendly) {}

    const freshK = await db.get(
      "SELECT mana, scrolls, maps, active_effects FROM kingdoms WHERE id = ?",
      [k.id],
    );
    res.json({
      ok: true,
      report: result.report,
      updates: {
        mana: freshK.mana,
        scrolls: safeJsonParse(freshK.scrolls, {}, "auto:scrolls"),
        maps: freshK.maps,
        active_effects: safeJsonParse(freshK.active_effects, {}, "auto:active_effects"),
        ...result.casterUpdates,
      },
    });

    // Notify target via socket if online
    if (global._narmir_io && k.id !== target.id) {
      const eventName = isFriendly ? "event:blessing_received" : "event:spell_received";
      global._narmir_io.to(`kingdom:${target.id}`).emit(eventName, {
        from: obscure ? null : k.name,
        spellId: spellId,
        message: result.targetEvent,
      });
      // Also notify unreads
      const uCount = await db.get("SELECT COUNT(*) as c FROM news WHERE kingdom_id = ? AND is_read = 0", [target.id]);
      global._narmir_io.to(`kingdom:${target.id}`).emit("unread_news", { count: uCount ? uCount.c : 0 });
    }
  });

  // ── Covert operations ────────────────────────────────────────────────────────
  router.post("/covert", requireAuth, async (req, res) => {
    const { op, targetId, units, lootType, unitType, bldType } = req.body;
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.turns_stored < 1)
      return res.status(429).json({ error: "No turns available" });

    const target = await db.get(
      "SELECT k.*, p.is_ai FROM kingdoms k JOIN players p ON k.player_id = p.id WHERE k.id = ?",
      [targetId],
    );
    if (!target)
      return res.status(404).json({ error: "Target kingdom not found" });
    if (target.id === k.id)
      return res.status(400).json({ error: "Cannot target your own kingdom" });

    // AI vs AI only - no cross-faction covert ops
    const attacker_is_ai = await db.get("SELECT is_ai FROM players WHERE id = ?", [req.player.playerId]);
    if ((attacker_is_ai?.is_ai || false) !== (target.is_ai || false)) {
      return res.status(400).json({ error: "AI and human kingdoms cannot war against each other" });
    }

    // Check map requirement
    let atkDisc = {};
    try {
      atkDisc = safeJsonParse(k.discovered_kingdoms, {}, "auto:discovered_kingdoms");
    } catch {}
    if (!atkDisc[targetId] || !atkDisc[targetId].mapped) {
      return res.status(400).json({
        error: "You need a location map for this target.",
      });
    }

    // Newbie protection
    if (k.turn < 400)
      return res.status(400).json({
        error: `You are under newbie protection until Turn 400. You cannot perform covert actions yet.`,
      });
    if ((target.turn || 0) < 400)
      return res.status(400).json({
        error: `${target.name} is under newbie protection until Turn 400 (currently Turn ${target.turn})`,
      });

    let result;
    if (op === "spy") {
      const unitsSent = Math.max(1, parseInt(units) || 0);
      if (unitsSent > engine.getAvailableUnits(k, "thieves"))
        return res.status(400).json({ error: "Not enough available thieves" });
      result = engine.covertSpy(k, target, unitsSent);
      if (result.error) return res.status(400).json({ error: result.error });
      await applyKingdomUpdates(k.id, result.spyUpdates || {});
      await db.run(
        "UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = ?",
        [k.id],
      );
      if (result.spyEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
          [k.id, "covert", result.spyEvent, k.turn],
        );
      if (result.targetEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
          [target.id, "covert", result.targetEvent, target.turn],
        );
      // Store spy report
      const reportRow = await db.run(
        `INSERT INTO spy_reports (kingdom_id, target_id, target_name, outcome, report) VALUES (?,?,?,?,?)`,
        [
          k.id,
          target.id,
          target.name,
          result.success ? "success" : "failed",
          result.report ? JSON.stringify(result.report) : null,
        ],
      );
      // War log: obscure attacker on success so target doesn't know who spied
      await db.run(
        `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES (?,?,?,?,?,?,?,?)`,
        [
          "spy",
          k.id,
          k.name,
          target.id,
          target.name,
          result.success ? "success" : "caught",
          "Intelligence gathering",
          result.success ? 1 : 0,
        ],
      );
      return res.json({
        ok: true,
        success: result.success,
        report: result.report || null,
        reportId: reportRow.lastID,
        event: result.spyEvent,
      });
    } else if (op === "loot") {
      const thievesSent = Math.max(1, parseInt(units) || 0);
      if (thievesSent > engine.getAvailableUnits(k, "thieves"))
        return res.status(400).json({ error: "Not enough available thieves" });
      const loot = lootType === "wm" ? "war_machines" : lootType;
      result = engine.covertLoot(k, target, loot, thievesSent);
      if (result.error) return res.status(400).json({ error: result.error });
      await applyKingdomUpdates(k.id, result.thiefUpdates || {});
      await applyKingdomUpdates(target.id, result.targetUpdates || {});
      await db.run(
        "UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = ?",
        [k.id],
      );
      if (result.success) {
        const logRes = await db.run(
          `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES (?,?,?,?,?,?,?,?)`,
          [
            "loot",
            k.id,
            k.name,
            target.id,
            target.name,
            result.success ? "success" : "caught",
            result.success
              ? `Stole ${loot.replace("_", " ")}`
              : "Thieves captured",
            result.success ? 1 : 0,
          ],
        );
        const reportId = logRes.lastID;
        if (result.thiefEvent)
          await db.run(
            "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)",
            [k.id, "covert", result.thiefEvent, k.turn, reportId],
          );
        if (result.targetEvent)
          await db.run(
            "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)",
            [target.id, "covert", result.targetEvent, target.turn, reportId],
          );
      } else {
        if (result.thiefEvent)
          await db.run(
            "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
            [k.id, "covert", result.thiefEvent, k.turn],
          );
        if (result.targetEvent)
          await db.run(
            "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
            [target.id, "covert", result.targetEvent, target.turn],
          );
      }
      return res.json({
        ok: true,
        success: result.success,
        stolen: result.stolen,
        lootType: result.lootType,
        event: result.thiefEvent,
      });
    } else if (op === "assassinate") {
      const ninjasSent = Math.max(1, parseInt(units) || 0);
      if (ninjasSent > engine.getAvailableUnits(k, "ninjas"))
        return res.status(400).json({ error: "Not enough available ninjas" });
      const validTargets = [
        "fighters",
        "rangers",
        "clerics",
        "mages",
        "thieves",
        "ninjas",
        "researchers",
        "engineers",
        "scribes",
      ];
      if (!validTargets.includes(unitType))
        return res.status(400).json({ error: "Invalid target unit type" });
      result = engine.covertAssassinate(k, target, ninjasSent, unitType);
      if (result.error) return res.status(400).json({ error: result.error });
      await applyKingdomUpdates(k.id, result.assassinUpdates || {});
      await applyKingdomUpdates(target.id, result.targetUpdates || {});
      await db.run(
        "UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = ?",
        [k.id],
      );
      if (result.success) {
        const logRes = await db.run(
          `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES (?,?,?,?,?,?,?,?)`,
          [
            "assassinate",
            k.id,
            k.name,
            target.id,
            target.name,
            result.success ? "success" : "caught",
            result.success
              ? `${(result.killed || 0).toLocaleString()} ${unitType} eliminated`
              : "Ninjas compromised",
            result.success ? 1 : 0,
          ],
        );
        const reportId = logRes.lastID;
        if (result.assassinEvent)
          await db.run(
            "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)",
            [k.id, "covert", result.assassinEvent, k.turn, reportId],
          );
        if (result.targetEvent)
          await db.run(
            "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)",
            [target.id, "covert", result.targetEvent, target.turn, reportId],
          );
      } else {
        if (result.assassinEvent)
          await db.run(
            "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
            [k.id, "covert", result.assassinEvent, k.turn],
          );
        if (result.targetEvent)
          await db.run(
            "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
            [target.id, "covert", result.targetEvent, target.turn],
          );
      }
      return res.json({
        ok: true,
        success: result.success,
        killed: result.killed,
        event: result.assassinEvent,
      });
    } else if (op === "sabotage") {
      const ninjasSent = Math.max(1, parseInt(units) || 0);
      if (ninjasSent > engine.getAvailableUnits(k, "ninjas"))
        return res.status(400).json({ error: "Not enough available ninjas" });

      result = engine.covertSabotage(k, target, ninjasSent, bldType);
      if (result.error) return res.status(400).json({ error: result.error });

      await applyKingdomUpdates(k.id, result.assassinUpdates || {});
      await applyKingdomUpdates(target.id, result.targetUpdates || {});

      await db.run(
        "UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = ?",
        [k.id],
      );

      const logRes = await db.run(
        `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES (?,?,?,?,?,?,?,?)`,
        [
          "sabotage",
          k.id,
          k.name,
          target.id,
          target.name,
          result.success ? "success" : "caught",
          result.success
            ? `${result.destroyed.toLocaleString()} ${bldType.replace(/_/g, " ")} destroyed`
            : "Ninjas caught",
          result.success ? 1 : 0,
        ],
      );
      const reportId = logRes.lastID;

      if (result.assassinEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)",
          [k.id, "covert", result.assassinEvent, k.turn, reportId],
        );

      if (result.targetEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num, combat_log_id) VALUES (?,?,?,?,?)",
          [target.id, "covert", result.targetEvent, target.turn, reportId],
        );

      return res.json({
        ok: true,
        success: result.success,
        destroyed: result.destroyed,
        ninjasLost: result.ninjasLost,
        event: result.assassinEvent,
      });
    } else if (op === "raid_trade_route") {
      const thievesSent = Math.max(1, parseInt(units) || 0);
      if (thievesSent > k.thieves)
        return res.status(400).json({ error: "Not enough thieves" });
      result = engine.raidTradeRoute(k, target, thievesSent);
      if (result.error) return res.status(400).json({ error: result.error });
      await applyKingdomUpdates(k.id, result.attackerUpdates || {});
      await applyKingdomUpdates(target.id, result.defenderUpdates || {});
      await db.run(
        "UPDATE kingdoms SET turns_stored = turns_stored - 1 WHERE id = ?",
        [k.id],
      );
      if (result.atkEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
          [k.id, "covert", result.atkEvent, k.turn],
        );
      if (result.defEvent)
        await db.run(
          "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
          [target.id, "covert", result.defEvent, target.turn],
        );
      await db.run(
        `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured) VALUES (?,?,?,?,?,?,?,?)`,
        [
          "raid_trade_route",
          k.id,
          k.name,
          target.id,
          target.name,
          result.success ? "success" : "failed",
          result.success
            ? `Raided ${result.raidedRoutes} routes`
            : "Raid repelled",
          0, // Raiding is public
        ],
      );
      return res.json({
        ok: true,
        success: result.success,
        looted: result.looted,
        event: result.atkEvent,
      });
    } else {
      return res.status(400).json({ error: "Unknown covert operation" });
    }
  });

  // ── Library allocation ────────────────────────────────────────────────────────
  router.post("/library-allocation", requireAuth, async (req, res) => {
    const { allocation } = req.body;
    if (!allocation || typeof allocation !== "object")
      return res.status(400).json({ error: "allocation required" });
    const k = await db.get(
      "SELECT id, bld_libraries, scribes, library_upgrades FROM kingdoms WHERE player_id = ?",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.bld_libraries === 0)
      return res
        .status(400)
        .json({ error: "You need at least 1 library first" });

    // Check prerequisites
    if (allocation["certified_blueprint"] > 0) {
      let upg = {};
      try {
        upg = safeJsonParse(k.library_upgrades, {}, "auto:library_upgrades");
      } catch {}
      if (!upg.mason_sigil)
        return res.status(403).json({
          error:
            "You need the Master Mason Sigil upgrade to assign scribes to Certified Blueprints",
        });
    }

    const capacity = k.bld_libraries * 20;
    const maxScribes = Math.min(k.scribes, capacity);
    const total = Object.values(allocation).reduce(
      (s, v) => s + (Number(v) || 0),
      0,
    );

    if (total > maxScribes)
      return res.status(400).json({
        error: `Allocated ${total.toLocaleString()} but you only have ${maxScribes.toLocaleString()} effective scribes`,
      });

    await db.run("UPDATE kingdoms SET library_allocation = ? WHERE id = ?", [
      JSON.stringify(allocation),
      k.id,
    ]);
    res.json({ ok: true });
  });

  router.post("/trade/clear-logs", requireAuth, async (req, res) => {
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    // Deletes trades involving this kingdom that are NOT pending
    await db.run(
      `
      DELETE FROM trades 
      WHERE (sender_id = ? OR receiver_id = ?) 
      AND status != 'pending'`,
      [k.id, k.id],
    );
    res.json({ ok: true });
  });

  // library-cancel has been replaced by library-allocation.

  // ── Fire units ────────────────────────────────────────────────────────────────
  router.post("/fire", requireAuth, async (req, res) => {
    const { unit, amount } = req.body;
    const validUnits = [
      "fighters",
      "rangers",
      "clerics",
      "mages",
      "thieves",
      "ninjas",
      "researchers",
      "engineers",
      "scribes",
    ];
    if (!validUnits.includes(unit))
      return res.status(400).json({ error: "Invalid unit type" });
    const n = Math.max(0, parseInt(amount) || 0);
    if (n <= 0)
      return res.status(400).json({ error: "Amount must be positive" });
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.race === "vampire" && unit === "clerics") {
      return res
        .status(400)
        .json({
          error:
            "Vampires auto-populate Thralls via Mausoleums and cannot fire them.",
        });
    }
    if (n > (k[unit] || 0))
      return res.status(400).json({
        error: `Only have ${(k[unit] || 0).toLocaleString()} ${unit}`,
      });
    const updates = {
      [unit]: (k[unit] || 0) - n,
      population: k.population + n,
    };
    await applyUpdates(db, k.id, updates);
    res.json({ ok: true, updates });
  });
  const EXP_TURNS = { scout: 10, deep: 25, dungeon: 50 };

  router.post("/expedition/start", requireAuth, async (req, res) => {
    const { type, rangers, fighters } = req.body;
    if (!EXP_TURNS[type])
      return res.status(400).json({ error: "Invalid expedition type" });
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    if (k.turns_stored < 1)
      return res.status(429).json({ error: "No turns available" });
    const r = Math.max(0, parseInt(rangers) || 0);
    const f = Math.max(0, parseInt(fighters) || 0);
    if (r < 1) return res.status(400).json({ error: "Send at least 1 ranger" });
    if (type === "dungeon" && f < 1)
      return res.status(400).json({ error: "Dungeon raids require fighters" });
    if (r > engine.getAvailableUnits(k, "rangers"))
      return res.status(400).json({
        error: "Not enough available rangers (some may be in training)",
      });
    if (f > engine.getAvailableUnits(k, "fighters"))
      return res.status(400).json({
        error: "Not enough available fighters (some may be in training)",
      });
    const existing = await db.get(
      "SELECT id FROM expeditions WHERE kingdom_id = ? AND type = ?",
      [k.id, type],
    );
    if (existing)
      return res
        .status(400)
        .json({ error: `A ${type} expedition is already underway` });

    try {
      // Food requirement: 0.5 per ranger/turn, 1.0 per fighter/turn, 25% discount
      const foodMult = engine.FOOD_CONSUMPTION_MULT[k.race] || 1.0;
      const foodPerTurn = (r * 0.5 + f * 1.0) * foodMult;
      const foodNeeded = Math.ceil(EXP_TURNS[type] * foodPerTurn * 0.75);
      if (k.food < foodNeeded)
        return res.status(400).json({ error: `${type.charAt(0).toUpperCase() + type.slice(1)} expedition requires ${foodNeeded.toLocaleString()} food (you have ${k.food.toLocaleString()}).` });

      // Atomic update — avoids race conditions with concurrent turn processing
      await db.run(
        'UPDATE kingdoms SET rangers = MAX(0, rangers - ?), fighters = MAX(0, fighters - ?), food = MAX(0, food - ?) WHERE id = ?',
        [r, f, foodNeeded, k.id]
      );

      await db.run(
        "INSERT INTO expeditions (kingdom_id, type, turns_left, rangers, fighters, food_taken) VALUES (?, ?, ?, ?, ?, ?)",
        [k.id, type, EXP_TURNS[type], r, f, foodNeeded],
      );

      let updates = { rangers: Math.max(0, k.rangers - r), fighters: Math.max(0, k.fighters - f), food: Math.max(0, k.food - foodNeeded) };
      progressGoal(k, updates, 'expedition_started', 1);
      if (updates.goals) {
         await db.run('UPDATE kingdoms SET goals = ? WHERE id = ?', [updates.goals, k.id]);
      }

      const label = { scout: "Scout", deep: "Deep", dungeon: "Dungeon" }[type];
      const troops = `${r.toLocaleString()} rangers${f > 0 ? ", " + f.toLocaleString() + " fighters" : ""}`;

      res.json({
        ok: true,
        turns_left: EXP_TURNS[type],
        turns_stored: k.turns_stored,
        updates: updates,
        events: [],
        message: `🧭 ${label} expedition launched — ${troops} deployed for ${EXP_TURNS[type]} turns. ${foodNeeded.toLocaleString()} food taken for the journey.`,
      });
    } catch (err) {
      console.error("[expedition/start] failed:", err.message);
      res.status(500).json({ error: "Expedition failed — please try again" });
    }
  });

  router.get("/expedition/list", requireAuth, async (req, res) => {
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    // Clean up old acknowledged rows
    await db.run(
      "DELETE FROM expeditions WHERE kingdom_id = ? AND turns_left = 0 AND seen = 1",
      [k.id],
    );
    // Return completed (turns_left=0, has rewards, not yet acknowledged)
    const completed = await db.all(
      "SELECT * FROM expeditions WHERE kingdom_id = ? AND turns_left = 0 AND rewards IS NOT NULL AND (seen IS NULL OR seen = 0)",
      [k.id],
    );
    const active = await db.all(
      "SELECT * FROM expeditions WHERE kingdom_id = ? AND (turns_left > 0 OR (turns_left = 0 AND rewards IS NULL)) ORDER BY created_at DESC",
      [k.id],
    );
    res.json({ active, completed });
  });

  router.post("/expedition/acknowledge", requireAuth, async (req, res) => {
    const { id } = req.body;
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    await db.run(
      "DELETE FROM expeditions WHERE id = ? AND kingdom_id = ? AND turns_left <= 0",
      [id, k.id],
    );
    res.json({ ok: true });
  });

  const { generateGoals, claimGoal } = require('../game/goals');

  router.get("/goals", requireAuth, async (req, res) => {
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [req.player.playerId]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const { goals, updated } = generateGoals(k);
    if (updated) {
       await db.run('UPDATE kingdoms SET goals = ? WHERE id = ?', [JSON.stringify(goals), k.id]);
    }
    res.json(goals);
  });
  
  router.post("/goals/claim", requireAuth, async (req, res) => {
    const { groupId, goalId } = req.body;
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [req.player.playerId]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    
    let updates = {};
    let events = [];
    const result = claimGoal(k, updates, events, groupId, goalId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    
    const { applyKingdomUpdates } = require('../db/schema');
    await applyKingdomUpdates(k.id, updates);
    for (const ev of events) {
      await db.run("INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)", 
        [k.id, ev.type, ev.message, k.turn]);
    }
    
    res.json({ ok: true, message: result.message, updates });
  });

  router.post("/expedition/cancel", requireAuth, async (req, res) => {
    const { id } = req.body;
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const exp = await db.get(
      "SELECT * FROM expeditions WHERE id = ? AND kingdom_id = ?",
      [id, k.id],
    );
    if (!exp) return res.status(404).json({ error: "Expedition not found" });
    // Return troops
    await db.run(
      "UPDATE kingdoms SET rangers = rangers + ?, fighters = fighters + ? WHERE id = ?",
      [exp.rangers, exp.fighters, k.id],
    );
    await db.run("DELETE FROM expeditions WHERE id = ?", [id]);
    res.json({ ok: true });
  });

  // Admin: clear ALL expeditions for a kingdom (debug tool)
  router.delete("/expedition/clear-all", requireAuth, async (req, res) => {
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const exps = await db.all(
      "SELECT * FROM expeditions WHERE kingdom_id = ?",
      [k.id],
    );
    let rangers = 0,
      fighters = 0;
    exps.forEach((e) => {
      rangers += e.rangers;
      fighters += e.fighters;
    });
    await db.run(
      "UPDATE kingdoms SET rangers = rangers + ?, fighters = fighters + ? WHERE id = ?",
      [rangers, fighters, k.id],
    );
    await db.run("DELETE FROM expeditions WHERE kingdom_id = ?", [k.id]);
    res.json({ ok: true, cleared: exps.length });
  });

  // ── Options ───────────────────────────────────────────────────────────────────
  router.post("/options", requireAuth, async (req, res) => {
    const { tax, name } = req.body;
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const updates = { updated_at: Math.floor(Date.now() / 1000) };
    if (tax !== undefined) {
      const t = Number(tax);
      if (t < 0 || t > 100)
        return res.status(400).json({ error: "Tax must be 0–100" });
      updates.tax = t;
    }
    if (name !== undefined) {
      if (!name.trim())
        return res.status(400).json({ error: "Name cannot be empty" });
      updates.name = name.trim();
    }
    await applyUpdates(db, k.id, updates);
    res.json({ ok: true, updates });
  });

  // ── Defense overview ──────────────────────────────────────────────────────────
  router.get("/defense/overview", requireAuth, async (req, res) => {
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    res.json({
      bld_walls: k.bld_walls,
      bld_guard_towers: k.bld_guard_towers,
      bld_outposts: k.bld_outposts,
      bld_castles: k.bld_castles,
      war_machines: k.war_machines,
      wall_upgrades: safeJsonParse(k.wall_upgrades, {}, "auto:wall_upgrades"),
      tower_def_upgrades: safeJsonParse(k.tower_def_upgrades, {}, "auto:tower_def_upgrades"),
      outpost_upgrades: safeJsonParse(k.outpost_upgrades, {}, "auto:outpost_upgrades"),
      defense_upgrades: safeJsonParse(k.defense_upgrades, {}, "auto:defense_upgrades"),
      defense_rating: engine.defenseRating(k),
      wall_power: engine.wallDefensePower(k),
      tower_power: engine.towerDetectionPower(k),
      outpost_power: engine.outpostRangerPower(k),
      citadel_req: engine.CITADEL_REQ,
      thieves_on_watch: Math.min(
        k.thieves,
        k.bld_guard_towers * 10,
      ),
      rangers_on_patrol: Math.min(k.rangers, k.bld_outposts * 20),
      wm_on_walls: Math.min(k.war_machines, k.bld_walls),
    });
  });
  // ── Season info ───────────────────────────────────────────────────────────────
  router.get("/season", requireAuth, async (_req, res) => {
    const sRow = await db.get(
      "SELECT value FROM server_state WHERE key='current_season'",
    );
    const tRow = await db.get(
      "SELECT value FROM server_state WHERE key='season_started_at'",
    );
    const season = sRow?.value || "spring";
    const startedAt = parseInt(tRow?.value) || Math.floor(Date.now() / 1000);
    const SEASON_DUR = { spring: 3, summer: 5, fall: 2, winter: 3 };
    const SEASON_ICONS = {
      spring: "🌸",
      summer: "☀️",
      fall: "🍂",
      winter: "❄️",
    };
    const daysLeft = Math.max(
      0,
      SEASON_DUR[season] - (Date.now() / 1000 - startedAt) / 86400,
    );
    const now = new Date();
    const h = now.getUTCHours();
    const m = now.getUTCMinutes();
    const isNight = h >= 1 && h < 13; // 8PM EST to 8AM EST
    
    let nextChangeHour = isNight ? 13 : (h >= 13 ? 25 : 1);
    let hoursLeft = nextChangeHour - h - 1;
    let minsLeft = 60 - m;
    if (minsLeft === 60) {
      hoursLeft += 1;
      minsLeft = 0;
    }
    const timeToChangeStr = `${hoursLeft}h ${minsLeft}m to ${isNight ? 'dawn' : 'nightfall'}`;

    res.json({
      season,
      daysLeft: daysLeft.toFixed(1),
      icon: SEASON_ICONS[season] || "🌸",
      isNight,
      timeToChangeStr,
    });
  });

  // ── Location — get my discovered kingdoms ─────────────────────────────────────
  router.get("/locations", requireAuth, async (req, res) => {
    const k = await db.get(
      "SELECT discovered_kingdoms, location_maps_wip FROM kingdoms WHERE player_id=?",
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    let disc = {},
      wip = [];
    try {
      disc = safeJsonParse(k.discovered_kingdoms, {}, "auto:discovered_kingdoms");
    } catch {}
    try {
      wip = safeJsonParse(k.location_maps_wip, [], "auto:location_maps_wip");
    } catch {}
    res.json({ discovered: disc, wip });
  });

  const fragmentBonusManager = require("../game/fragment-bonus-manager");

  // Get available buildings for a hybrid blueprint (for selection modal)
  router.post("/hybrid-blueprint/get-buildings", requireAuth, async (req, res) => {
    const { blueprintId } = req.body;
    if (!blueprintId) return res.status(400).json({ error: "Missing blueprintId" });

    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    let hbp = {};
    try {
      hbp = safeJsonParse(k.hybrid_blueprints, {}, "auto:hybrid_blueprints");
    } catch {}

    if (!hbp[blueprintId]) {
      return res.status(400).json({ error: "Blueprint not found" });
    }
    if (hbp[blueprintId].assigned) {
      return res.status(400).json({ error: "Blueprint already assigned" });
    }

    const fragmentName = hbp[blueprintId].fragment;
    const available = fragmentBonusManager.getAvailableBuildingsWithBonuses(
      k,
      fragmentName
    );

    if (available.error) {
      return res.status(400).json({ error: available.error });
    }

    res.json({
      ok: true,
      fragment: fragmentName,
      blueprintId,
      availableBuildings: available,
    });
  });

  // Confirm building selection with double warning
  router.post("/hybrid-blueprint/confirm-assignment", requireAuth, async (req, res) => {
    const { blueprintId, buildingType, confirmed } = req.body;
    if (!blueprintId || !buildingType)
      return res.status(400).json({ error: "Missing required fields" });

    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    // Check resources
    if (k.gold < 500000)
      return res.status(400).json({ error: "Not enough gold (need 500k)" });
    if (k.mana < 100000)
      return res.status(400).json({ error: "Not enough mana (need 100k)" });

    let hbp = {};
    try {
      hbp = safeJsonParse(k.hybrid_blueprints, {}, "auto:hybrid_blueprints");
    } catch {}

    if (!hbp[blueprintId])
      return res.status(400).json({ error: "Blueprint not found" });
    if (hbp[blueprintId].assigned)
      return res.status(400).json({ error: "Blueprint already assigned" });

    const fragmentName = hbp[blueprintId].fragment;

    // If not confirmed yet, return warning details
    if (!confirmed) {
      const bonusConfig = fragmentBonusManager.getBonusConfig(
        fragmentName,
        buildingType
      );
      if (!bonusConfig)
        return res.status(400).json({ error: "Invalid building for this fragment" });

      return res.json({
        ok: false,
        warning: true,
        message: "This choice is PERMANENT and cannot be undone",
        details: {
          fragment: fragmentName,
          building: buildingType,
          bonus: bonusConfig,
          cost: { gold: 500000, mana: 100000 },
        },
      });
    }

    // Apply the fragment bonus
    const applyResult = fragmentBonusManager.applyFragmentBonus(
      k,
      fragmentName,
      buildingType
    );

    if (applyResult.error) {
      return res.status(400).json({ error: applyResult.error });
    }

    // Update database
    hbp[blueprintId].assigned = true;
    hbp[blueprintId].building = buildingType;
    const newGold = k.gold - 500000;
    const newMana = k.mana - 100000;

    await db.run(
      "UPDATE kingdoms SET hybrid_blueprints = ?, fragment_bonuses = ?, gold = ?, mana = ? WHERE id = ?",
      [JSON.stringify(hbp), applyResult.fragment_bonuses, newGold, newMana, k.id]
    );

    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?, ?, ?, ?)",
      [
        k.id,
        "system",
        `✨ Applied ${fragmentName} to ${buildingType.replace(/_/g, " ")}! Bonuses unlocked: ${applyResult.applied.special.name}`,
        k.turn,
      ]
    );

    res.json({
      ok: true,
      message: "Fragment bonus applied successfully",
      applied: applyResult.applied,
      gold: newGold,
      mana: newMana,
    });
  });

  // Legacy endpoint for backward compatibility
  router.post("/assign-hybrid-blueprint", requireAuth, async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "Missing blueprint id" });

    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    if (k.gold < 500000)
      return res.status(400).json({ error: "Not enough gold (need 500k)" });
    if (k.mana < 100000)
      return res.status(400).json({ error: "Not enough mana (need 100k)" });

    let hbp = {};
    try {
      hbp = safeJsonParse(k.hybrid_blueprints, {}, "auto:hybrid_blueprints");
    } catch {}
    if (!hbp[id]) return res.status(400).json({ error: "Blueprint not found" });
    if (hbp[id].assigned)
      return res.status(400).json({ error: "Blueprint already assigned" });

    // Assign it
    hbp[id].assigned = true;
    const newGold = k.gold - 500000;
    const newMana = k.mana - 100000;

    await db.run(
      "UPDATE kingdoms SET hybrid_blueprints = ?, gold = ?, mana = ? WHERE id = ?",
      [JSON.stringify(hbp), newGold, newMana, k.id],
    );

    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?, ?, ?, ?)",
      [
        k.id,
        "system",
        `✨ Assigned a ${hbp[id].fragment} Hybrid Blueprint to ${hbp[id].building.replace("bld_", "").replace(/_/g, " ")}!`,
        k.turn,
      ],
    );

    res.json({
      ok: true,
      hybrid_blueprints: JSON.stringify(hbp),
      gold: newGold,
      mana: newMana,
    });
  });

  router.post("/locations/steal-map", requireAuth, async (req, res) => {
    const { targetId } = req.body;
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id=?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const target = await db.get("SELECT * FROM kingdoms WHERE id=?", [
      targetId,
    ]);
    if (!target) return res.status(404).json({ error: "Target not found" });
    const successChance = 0.2 + Math.min(0.3, (k.thieves / 1000) * 0.1);
    const success = Math.random() < successChance;
    if (success) {
      let hasLockbox = false;
      let targetHBP = {};
      try {
        targetHBP = safeJsonParse(target.hybrid_blueprints, {}, "auto:target.hybrid_blueprints");
      } catch {}
      for (const key in targetHBP) {
        if (
          targetHBP[key].assigned &&
          targetHBP[key].building === "libraries" &&
          targetHBP[key].fragment === "Dwarven Star-Metal"
        ) {
          hasLockbox = true;
          break;
        }
      }

      if (hasLockbox) {
        return res.json({
          ok: true,
          success: false,
          message: "Target's maps are secured in an Impenetrable Lockbox and cannot be stolen.",
        });
      }

      let targetDisc = {};
      try {
        targetDisc = safeJsonParse(target.discovered_kingdoms, {}, "auto:discovered_kingdoms");
      } catch {}
      const mappedIds = Object.keys(targetDisc).filter(
        (id) => targetDisc[id]?.mapped,
      );
      if (!mappedIds.length)
        return res.json({
          ok: true,
          success: false,
          message: "Target has no location maps to steal.",
        });
      const stolenId = mappedIds[Math.floor(Math.random() * mappedIds.length)];
      const stolenKingdom = await db.get(
        "SELECT name FROM kingdoms WHERE id=?",
        [stolenId],
      );
      delete targetDisc[stolenId];
      await db.run("UPDATE kingdoms SET discovered_kingdoms=? WHERE id=?", [
        JSON.stringify(targetDisc),
        target.id,
      ]);
      let myDisc = {};
      try {
        myDisc = safeJsonParse(k.discovered_kingdoms, {}, "auto:discovered_kingdoms");
      } catch {}
      myDisc[stolenId] = { found: true, mapped: true };
      await db.run("UPDATE kingdoms SET discovered_kingdoms=? WHERE id=?", [
        JSON.stringify(myDisc),
        k.id,
      ]);
      await db.run(
        "INSERT INTO news (kingdom_id,type,message,turn_num) VALUES (?,?,?,?)",
        [
          target.id,
          "covert",
          `🗺️ A thief stole your location map for ${stolenKingdom?.name || "a kingdom"}.`,
          target.turn,
        ],
      );
      await db.run(
        "INSERT INTO war_log (action_type,attacker_id,attacker_name,defender_id,defender_name,outcome,detail,obscured) VALUES (?,?,?,?,?,?,?,?)",
        [
          "steal_map",
          k.id,
          k.name,
          target.id,
          target.name,
          "success",
          JSON.stringify({ stolen: stolenKingdom?.name }),
          1,
        ],
      );
      res.json({
        ok: true,
        success: true,
        updates: { discovered_kingdoms: JSON.stringify(myDisc) },
        message: `Thieves stole a location map for ${stolenKingdom?.name || "a kingdom"} from ${target.name}.`,
      });
    } else {
      res.json({
        ok: true,
        success: false,
        message: "Thieves failed to steal a location map.",
      });
    }
  });

  // ── Market — Buying resources ─────────────────────────────────────────────────
  router.get("/market/prices", requireAuth, async (_req, res) => {
    const prices = await db.all(
      "SELECT * FROM market_prices WHERE id != 'hammers'",
    );
    res.json(prices);
  });

  const MARKET_LIQUIDITY = {
    food: 1000000,
    wood: 500000,
    stone: 250000,
    iron: 100000,
    coal: 150000,
    steel: 75000,
    mana: 250000,
    weapons: 50000,
    armor: 25000,
    war_machines: 1000,
    land: 200
  };

  router.post("/market/buy", requireAuth, async (req, res) => {
    const { resource, amount } = req.body;
    const qty = Math.max(0, parseInt(amount) || 0);
    if (!qty) return res.status(400).json({ error: "Quantity required" });

    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    const priceRow = await db.get("SELECT * FROM market_prices WHERE id = ?", [
      resource,
    ]);
    if (!priceRow || resource === "hammers")
      return res.status(400).json({ error: "Invalid resource" });

    const basePrice = priceRow.base_price;
    const currentPrice = priceRow.current_price;
    const liquidity = MARKET_LIQUIDITY[resource] || 100000;

    const minPrice = basePrice * 0.15;
    const maxPrice = basePrice * 6.0;

    const nextPrice = currentPrice * (1 + (qty / liquidity));
    const clampedNext = Math.max(minPrice, Math.min(maxPrice, nextPrice));
    const avgPrice = (currentPrice + clampedNext) / 2;
    const cost = Math.ceil(qty * avgPrice);

    if (k.gold < cost)
      return res
        .status(400)
        .json({ error: `Need ${cost.toLocaleString()} GC (Avg price: ${avgPrice.toFixed(3)} GC)` });

    const dbCol =
      resource === "weapons"
        ? "weapons_stockpile"
        : resource === "armor"
          ? "armor_stockpile"
          : resource;
    await db.run(
      `UPDATE kingdoms SET gold = gold - ?, ${dbCol} = ${dbCol} + ? WHERE id = ?`,
      [cost, qty, k.id],
    );

    // Impact market: update the price to clamped progress
    await db.run(
      "UPDATE market_prices SET current_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [clampedNext, resource],
    );

    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
      [
        k.id,
        "system",
        `⚖️ Bought ${qty.toLocaleString()} ${resource.replace(/_/g, " ")} from the market for ${cost.toLocaleString()} GC (Avg price: ${avgPrice.toFixed(3)} GC).`,
        k.turn,
      ],
    );

    res.json({
      ok: true,
      bought: qty,
      cost,
      message: `⚖️ Bought ${qty.toLocaleString()} ${resource.replace(/_/g, " ")} from the market for ${cost.toLocaleString()} GC.`,
      updates: { gold: k.gold - cost, [dbCol]: (k[dbCol] || 0) + qty },
    });
  });

  router.post("/market/sell", requireAuth, async (req, res) => {
    const { resource, amount } = req.body;
    const qty = Math.max(0, parseInt(amount) || 0);
    if (!qty) return res.status(400).json({ error: "Quantity required" });

    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const dbCol =
      resource === "weapons"
        ? "weapons_stockpile"
        : resource === "armor"
          ? "armor_stockpile"
          : resource;
    if ((k[dbCol] || 0) < qty)
      return res.status(400).json({ error: "Not enough resource" });

    const priceRow = await db.get("SELECT * FROM market_prices WHERE id = ?", [
      resource,
    ]);
    if (!priceRow || resource === "hammers")
      return res.status(400).json({ error: "Invalid resource" });

    const basePrice = priceRow.base_price;
    const currentPrice = priceRow.current_price;
    const liquidity = MARKET_LIQUIDITY[resource] || 100000;

    const minPrice = basePrice * 0.15;
    const maxPrice = basePrice * 6.0;

    const nextPrice = currentPrice * (1 - (qty / liquidity));
    const clampedNext = Math.max(minPrice, Math.min(maxPrice, nextPrice));
    const avgPrice = (currentPrice + clampedNext) / 2;

    let sellMultiplier = 0.7; // 30% base spread
    if (k.prestige_level && k.prestige_level > 0) {
      sellMultiplier += Math.min(0.1, k.prestige_level * 0.02); // Up to +10% sell value (0.8 max modifier)
    }
    const gain = Math.floor(qty * avgPrice * sellMultiplier);

    await db.run(
      `UPDATE kingdoms SET gold = gold + ?, ${dbCol} = ${dbCol} - ? WHERE id = ?`,
      [gain, qty, k.id],
    );

    // Impact market: update the price to clamped progress
    await db.run(
      "UPDATE market_prices SET current_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [clampedNext, resource],
    );

    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
      [
        k.id,
        "system",
        `⚖️ Sold ${qty.toLocaleString()} ${resource.replace(/_/g, " ")} to the market for ${gain.toLocaleString()} GC (Avg price: ${avgPrice.toFixed(3)} GC).`,
        k.turn,
      ],
    );

    res.json({
      ok: true,
      sold: qty,
      gain,
      message: `⚖️ Sold ${qty.toLocaleString()} ${resource.replace(/_/g, " ")} to the market for ${gain.toLocaleString()} GC.`,
      updates: { gold: k.gold + gain, [dbCol]: (k[dbCol] || 0) - qty },
    });
  });

  // ── Research focus ────────────────────────────────────────────────────────────
  router.post("/research-focus", requireAuth, async (req, res) => {
    const { focus } = req.body; // array of 1-2 discipline keys
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    let schoolUpgrades = {};
    try {
      schoolUpgrades = safeJsonParse(k.school_upgrades, {}, "auto:school_upgrades");
    } catch {}
    const maxSlots = schoolUpgrades.repository ? 2 : 1;
    const validKeys = [
      "economy",
      "weapons",
      "armor",
      "military",
      "attack_magic",
      "defense_magic",
      "entertainment",
      "construction",
      "war_machines",
      "spellbook",
    ];
    const cleaned = (Array.isArray(focus) ? focus : [focus])
      .filter((f) => validKeys.includes(f))
      .slice(0, maxSlots);
    if (!cleaned.length)
      return res.status(400).json({ error: "Invalid discipline" });
    await db.run("UPDATE kingdoms SET research_focus = ? WHERE id = ?", [
      JSON.stringify(cleaned),
      k.id,
    ]);
    res.json({ ok: true, research_focus: cleaned });
  });

  // ── Studies overview ──────────────────────────────────────────────────────────
  router.get("/studies/overview", requireAuth, async (req, res) => {
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    let focus = [];
    try {
      focus = safeJsonParse(k.research_focus, [], "auto:research_focus");
    } catch {}
    if (!focus.length) {
      const disciplines = [
        { key: "economy", col: "res_economy" },
        { key: "weapons", col: "res_weapons" },
        { key: "armor", col: "res_armor" },
        { key: "military", col: "res_military" },
        { key: "attack_magic", col: "res_attack_magic" },
        { key: "defense_magic", col: "res_defense_magic" },
        { key: "entertainment", col: "res_entertainment" },
        { key: "construction", col: "res_construction" },
        { key: "war_machines", col: "res_war_machines" },
        { key: "spellbook", col: "res_spellbook" },
      ];
      focus = [
        disciplines.reduce(
          (b, d) => ((k[d.col] || 0) >= (k[b.col] || 0) ? d : b),
          disciplines[0],
        ).key,
      ];
    }
    res.json({
      tower_upgrades: safeJsonParse(k.tower_upgrades, {}, "studies:tower_upgrades"),
      school_upgrades: safeJsonParse(k.school_upgrades, {}, "studies:school_upgrades"),
      shrine_upgrades: safeJsonParse(k.shrine_upgrades, {}, "studies:shrine_upgrades"),
      library_upgrades: safeJsonParse(k.library_upgrades, {}, "studies:library_upgrades"),
      research_focus: focus,
      divine_sanctuary_used: k.divine_sanctuary_used,
      mana_per_turn: engine.manaPerTurn(k),
      scribes: k.scribes,
      researchers: k.researchers,
      bld_libraries: k.bld_libraries,
      bld_shrines: k.bld_shrines,
      bld_mausoleums: k.bld_mausoleums,
      bld_mage_towers: k.bld_mage_towers,
      bld_schools: k.bld_schools,
      bld_taverns: k.bld_taverns,
      mausoleum_upgrades: safeJsonParse(k.mausoleum_upgrades, {}, "studies:mausoleum_upgrades"),
      mage_tower_allocation: safeJsonParse(k.mage_tower_allocation, {}, "studies:mage_tower"),
      shrine_allocation: safeJsonParse(k.shrine_allocation, {}, "studies:shrine"),
      library_allocation: safeJsonParse(k.library_allocation, {}, "studies:library"),
      mausoleum_allocation: safeJsonParse(k.mausoleum_allocation, {}, "studies:mausoleum"),
      research_allocation: safeJsonParse(k.research_allocation, {}, "studies:research"),
      scrolls: safeJsonParse(k.scrolls, {}, "studies:scrolls"),
      library_progress: safeJsonParse(k.library_progress, {}, "studies:library_progress"),
      tower_progress: safeJsonParse(k.tower_progress, {}, "studies:tower_progress"),
    });
  });
  router.post("/economy/bank-deposit", requireAuth, async (req, res) => {
    const { amount, termIndex } = req.body;
    if (!amount || amount <= 0)
      return res.status(400).json({ error: "Invalid amount." });

    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    if (k.bld_vaults < 25) {
      return res
        .status(400)
        .json({ error: "Bank access requires at least 25 Vaults." });
    }
    if (k.gold < amount) {
      return res.status(400).json({ error: "Not enough gold." });
    }

    const bankUpgrades = safeJsonParse(k.bank_upgrades, {}, "auto:bank_upgrades");

    let interestBonus = 0;
    if (bankUpgrades.trade_guild) interestBonus += 0.03;

    const availableTerms = [
      { turns: 10, interest: 0.02, reqUpgrade: null },
      { turns: 25, interest: 0.07, reqUpgrade: null },
      { turns: 50, interest: 0.15, reqUpgrade: null },
      { turns: 150, interest: 0.25, reqUpgrade: null },
      { turns: 300, interest: 0.6, reqUpgrade: "iron_treasury" },
    ];

    const termDef = availableTerms[termIndex];
    if (!termDef) return res.status(400).json({ error: "Invalid term." });

    if (termDef.reqUpgrade && !bankUpgrades[termDef.reqUpgrade]) {
      return res
        .status(400)
        .json({ error: "This term requires a bank upgrade." });
    }

    const deposits = safeJsonParse(k.bank_deposits, [], "auto:bank_deposits");

    // Add deposit
    const startTurn = k.turn;
    const targetTurn = startTurn + termDef.turns;
    const finalInterest = termDef.interest + interestBonus;
    const returnAmount = Math.floor(amount * (1 + finalInterest));

    // use a unique id to easily withdraw
    deposits.push({
      id: Math.random().toString(36).substring(7),
      amount: parseInt(amount, 10),
      startTurn,
      targetTurn,
      returnAmount,
      termTurns: termDef.turns,
      interest: finalInterest,
      status: "active",
    });

    const updates = {
      gold: k.gold - amount,
      bank_deposits: JSON.stringify(deposits),
    };

    await applyUpdates(db, k.id, updates);
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
      [
        k.id,
        "system",
        `🏦 Deposited ${parseInt(amount).toLocaleString()} gold for ${termDef.turns} turns. Expected payout: ${returnAmount.toLocaleString()} gold.`,
        k.turn,
      ],
    );

    res.json({ message: "Deposit successful.", updates });
  });

  router.post("/economy/bank-withdraw", requireAuth, async (req, res) => {
    const { depositId } = req.body;

    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    const bankUpgrades = safeJsonParse(k.bank_upgrades, {}, "auto:bank_upgrades");
    if (!bankUpgrades.ledger_ancients) {
      return res
        .status(400)
        .json({
          error:
            "You need the Ledger of the Ancients upgrade to withdraw early.",
        });
    }

    let deposits = safeJsonParse(k.bank_deposits, [], "auto:bank_deposits");
    let targetIndex = deposits.findIndex(
      (d) => d.id === depositId && d.status === "active",
    );

    if (targetIndex === -1) {
      return res
        .status(400)
        .json({ error: "Deposit not found or already matured." });
    }

    const dep = deposits[targetIndex];
    dep.status = "withdrawn_early";

    // Forfeit interest, just principal back
    const refund = dep.amount;

    const updates = {
      gold: k.gold + refund,
      bank_deposits: JSON.stringify(deposits),
    };

    await applyUpdates(db, k.id, updates);
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
      [
        k.id,
        "system",
        `🏦 Early Withdrawal: You withdrew ${refund.toLocaleString()} gold and forfeited the interest.`,
        k.turn,
      ],
    );

    res.json({ message: "Withdrawal successful.", updates });
  });

  router.post("/economy/upgrade", requireAuth, async (req, res) => {
    const { category, upgradeKey } = req.body;
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const result = engine.purchaseUpgrade(k, category, upgradeKey);
    if (result.error) return res.status(400).json({ error: result.error });
    await applyUpdates(db, k.id, result.updates);
    const def =
      engine.FARM_UPGRADES[upgradeKey] ||
      engine.GRANARY_UPGRADES[upgradeKey] ||
      engine.MARKET_UPGRADES[upgradeKey] ||
      engine.TAVERN_UPGRADES[upgradeKey] ||
      engine.TOWER_UPGRADES[upgradeKey] ||
      engine.SCHOOL_UPGRADES[upgradeKey] ||
      engine.SHRINE_UPGRADES[upgradeKey] ||
      engine.MAUSOLEUM_UPGRADES[upgradeKey] ||
      engine.LIBRARY_UPGRADES[upgradeKey] ||
      engine.WALL_UPGRADES[upgradeKey] ||
      engine.TOWER_DEF_UPGRADES[upgradeKey] ||
      engine.OUTPOST_UPGRADES[upgradeKey] ||
      engine.BANK_UPGRADES[upgradeKey];
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
      [k.id, "system", `✅ ${def?.name || upgradeKey} purchased.`, k.turn],
    );
    res.json({ ok: true, updates: result.updates });
  });

  // ── Hire mercenaries ──────────────────────────────────────────────────────────
  router.post("/economy/hire-mercs", requireAuth, async (req, res) => {
    const { unitType, tier, count } = req.body;
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const result = engine.hireMercenaries(
      k,
      unitType,
      tier,
      parseInt(count) || 1,
    );
    if (result.error) return res.status(400).json({ error: result.error });
    await applyUpdates(db, k.id, result.updates);
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
      [
        k.id,
        "system",
        `⚔️ Hired ${result.hired.count} ${result.hired.tier} ${result.hired.unitType} (Lv ${result.hired.level}) for ${result.hired.cost.toLocaleString()} gold. Contract: ${result.hired.duration} turns.`,
        k.turn,
      ],
    );
    res.json({ ok: true, hired: result.hired, updates: result.updates });
  });

  // ── Dismiss mercenaries ───────────────────────────────────────────────────────
  router.post("/economy/dismiss-mercs", requireAuth, async (req, res) => {
    const { mercIndex } = req.body;
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    let mercs = [];
    try {
      mercs = safeJsonParse(k.mercenaries, [], "auto:mercenaries");
    } catch {}
    const idx = parseInt(mercIndex);
    if (idx < 0 || idx >= mercs.length)
      return res.status(400).json({ error: "Invalid mercenary index" });
    const m = mercs[idx];
    mercs.splice(idx, 1);
    const newCount = Math.max(0, (k[m.unit_type] || 0) - m.count);
    await db.run(
      `UPDATE kingdoms SET mercenaries = ?, ${m.unit_type} = ? WHERE id = ?`,
      [JSON.stringify(mercs), newCount, k.id],
    );
    res.json({ ok: true, dismissed: m });
  });

  // ── Send trade offer ──────────────────────────────────────────────────────────
  router.post("/economy/trade/send", requireAuth, async (req, res) => {
    const { targetId, offer, request } = req.body;
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    // Check trading post
    let mktUpgrades = {};
    try {
      mktUpgrades = safeJsonParse(k.market_upgrades, {}, "auto:market_upgrades");
    } catch {}
    if (!mktUpgrades.trading_post)
      return res
        .status(400)
        .json({ error: "Build a Trading Post to trade with other kingdoms" });
    if (!targetId || !offer || !request)
      return res.status(400).json({ error: "Missing trade parameters" });
    const target = await db.get("SELECT id, name FROM kingdoms WHERE id = ?", [
      targetId,
    ]);
    if (!target)
      return res.status(404).json({ error: "Target kingdom not found" });
    // Validate sender has the offered goods
    const offerObj = typeof offer === "string" ? JSON.parse(offer) : offer;
    const requestObj =
      typeof request === "string" ? JSON.parse(request) : request;
    for (const [item, qty] of Object.entries(offerObj)) {
      const col =
        item === "food"
          ? "food"
          : item === "gold"
            ? "gold"
            : item === "mana"
              ? "mana"
              : item === "maps"
                ? "maps"
                : item === "blueprints"
                  ? "blueprints_stored"
                  : null;
      if (col && (k[col] || 0) < qty)
        return res.status(400).json({ error: `Not enough ${item}` });
    }
    await db.run(
      `INSERT INTO trade_offers (sender_id, sender_name, receiver_id, receiver_name, offer, request, expires_at) VALUES (?,?,?,?,?,?,?)`,
      [
        k.id,
        k.name,
        target.id,
        target.name,
        JSON.stringify(offerObj),
        JSON.stringify(requestObj),
        Math.floor(Date.now() / 1000) + 3600,
      ],
    );
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
      [
        target.id,
        "system",
        `📦 Trade offer from ${k.name} — check your Economy panel to accept or decline.`,
        k.turn,
      ],
    );
    res.json({ ok: true });
  });

  // ── Get trade offers ──────────────────────────────────────────────────────────
  router.get("/economy/trade/list", requireAuth, async (req, res) => {
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const now = Math.floor(Date.now() / 1000);
    await db.run(
      "UPDATE trade_offers SET status = ? WHERE expires_at < ? AND status = ?",
      ["expired", now, "pending"],
    );
    const sent = await db.all(
      "SELECT * FROM trade_offers WHERE sender_id   = ? ORDER BY created_at DESC LIMIT 20",
      [k.id],
    );
    const received = await db.all(
      "SELECT * FROM trade_offers WHERE receiver_id = ? AND status = ? ORDER BY created_at DESC LIMIT 20",
      [k.id, "pending"],
    );
    res.json({ sent, received });
  });

  // ── Accept trade offer ────────────────────────────────────────────────────────
  router.post("/economy/trade/accept", requireAuth, async (req, res) => {
    const { offerId } = req.body;
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const offer = await db.get(
      "SELECT * FROM trade_offers WHERE id = ? AND receiver_id = ? AND status = ?",
      [offerId, k.id, "pending"],
    );
    if (!offer)
      return res
        .status(404)
        .json({ error: "Offer not found or already resolved" });
    const sender = await db.get("SELECT * FROM kingdoms WHERE id = ?", [
      offer.sender_id,
    ]);
    if (!sender) return res.status(404).json({ error: "Sender not found" });

    const offerItems = JSON.parse(offer.offer); // what sender gives
    const requestItems = JSON.parse(offer.request); // what receiver gives

    const ITEM_COL = {
      gold: "gold",
      food: "food",
      mana: "mana",
      maps: "maps",
      blueprints: "blueprints_stored",
      weapons: "weapons_stockpile",
      armor: "armor_stockpile",
    };

    // Validate both sides still have the goods
    for (const [item, qty] of Object.entries(requestItems)) {
      const col = ITEM_COL[item];
      if (col && (k[col] || 0) < qty)
        return res.status(400).json({ error: `You don't have enough ${item}` });
    }
    for (const [item, qty] of Object.entries(offerItems)) {
      const col = ITEM_COL[item];
      if (col && (sender[col] || 0) < qty)
        return res
          .status(400)
          .json({ error: `Sender no longer has enough ${item}` });
    }

    // Apply exchange
    const kUpdates = {},
      sUpdates = {};
    for (const [item, qty] of Object.entries(offerItems)) {
      const c = ITEM_COL[item];
      if (c) {
        kUpdates[c] =
          (kUpdates[c] !== undefined ? kUpdates[c] : k[c] || 0) + qty;
        sUpdates[c] =
          (sUpdates[c] !== undefined ? sUpdates[c] : sender[c] || 0) - qty;
      }
    }
    for (const [item, qty] of Object.entries(requestItems)) {
      const c = ITEM_COL[item];
      if (c) {
        kUpdates[c] =
          (kUpdates[c] !== undefined ? kUpdates[c] : k[c] || 0) - qty;
        sUpdates[c] =
          (sUpdates[c] !== undefined ? sUpdates[c] : sender[c] || 0) + qty;
      }
    }

    await applyUpdates(db, k.id, kUpdates);
    await applyUpdates(db, sender.id, sUpdates);
    await db.run("UPDATE trade_offers SET status = ? WHERE id = ?", [
      "accepted",
      offer.id,
    ]);
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
      [
        sender.id,
        "system",
        `✅ ${k.name} accepted your trade offer.`,
        sender.turn,
      ],
    );
    res.json({ ok: true, kUpdates, sUpdates });
  });

  // ── Decline trade offer ───────────────────────────────────────────────────────
  router.post("/economy/trade/decline", requireAuth, async (req, res) => {
    const { offerId } = req.body;
    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const offer = await db.get(
      "SELECT * FROM trade_offers WHERE id = ? AND receiver_id = ?",
      [offerId, k.id],
    );
    if (!offer) return res.status(404).json({ error: "Offer not found" });
    await db.run("UPDATE trade_offers SET status = ? WHERE id = ?", [
      "declined",
      offer.id,
    ]);
    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
      [offer.sender_id, "system", `❌ ${k.name} declined your trade offer.`, 0],
    );
    res.json({ ok: true });
  });

  // ── Economy overview ──────────────────────────────────────────────────────────
  router.get("/economy/overview", requireAuth, async (req, res) => {
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    res.json({
      farmProduction: engine.farmProduction(k),
      foodConsumption: engine.foodConsumption(k),
      foodBalance: engine.farmProduction(k) - engine.foodConsumption(k),
      marketIncome: engine.marketIncomeFull(k),
      tavernBonus: engine.tavernEntertainmentBonus(k),
      maxFoodStorage:
        k.bld_granaries *
        (safeJsonParse(k.granary_upgrades, {}, "auto:granary_upgrades").silos ? 150000 : 100000),
      foodSpoilageRate: safeJsonParse(k.granary_upgrades, {}, "auto:granary_upgrades").preservation
        ? 0.05 * 0.7
        : 0.05,
      foodSpoilageAmount: Math.floor(
        k.food *
          (safeJsonParse(k.granary_upgrades, {}, "auto:granary_upgrades").preservation
            ? 0.05 * 0.7
            : 0.05),
      ),
      foodDegradeTurns: (() => {
        const rate = safeJsonParse(k.granary_upgrades, {}, "auto:granary_upgrades").preservation
          ? 0.05 * 0.7
          : 0.05;
        const bal = engine.farmProduction(k) - engine.foodConsumption(k);
        const current = k.food;
        if (current <= 0) return 0;
        // Approximation: how many turns until food is near zero
        // if balance < spoilage, it decreases.
        // spoilage = food * rate.
        // net = bal - (food * rate).
        if (bal >= current * rate) return Infinity; // Technically growing
        // logarithmic decay? no, just simple turn estimate
        let tempFood = current;
        let turns = 0;
        while (tempFood > 100 && turns < 500) {
          tempFood = tempFood + bal - tempFood * rate;
          turns++;
          if (tempFood >= current && turns > 1) return Infinity;
        }
        return turns;
      })(),
      workedFarms: (() => {
        let workers = engine.FARM_WORKERS_PER?.[k.race] || 10;
        const upg = safeJsonParse(k.farm_upgrades, {}, "auto:farm_upgrades");
        if (upg.iron_plows) workers = Math.max(1, workers - 2);
        return Math.min(
          k.bld_farms,
          Math.floor(
            Math.max(
              0,
              k.population -
                (k.fighters +
                  k.rangers +
                  k.clerics +
                  k.mages +
                  k.thieves +
                  k.ninjas +
                  k.researchers +
                  k.engineers +
                  k.scribes),
            ) / workers,
          ),
        );
      })(),
      farm_upgrades: safeJsonParse(k.farm_upgrades, {}, "auto:farm_upgrades"),
      granary_upgrades: safeJsonParse(k.granary_upgrades, {}, "auto:granary_upgrades"),
      market_upgrades: safeJsonParse(k.market_upgrades, {}, "auto:market_upgrades"),
      tavern_upgrades: safeJsonParse(k.tavern_upgrades, {}, "auto:tavern_upgrades"),
      mercenaries: safeJsonParse(k.mercenaries, [], "auto:mercenaries"),
      food_shortage_turns: k.food_shortage_turns,
      food_surplus_turns: k.food_surplus_turns,
      activeTradeRouteCount: (
        await db.get(
          "SELECT COUNT(*) as count FROM trade_routes WHERE kingdom_id=? OR partner_id=?",
          [k.id, k.id],
        )
      ).count,
    });
  });
  router.get("/profile/:name", async (req, res) => {
    try {
      const k = await db.get(
        `
        SELECT k.id, k.name, k.race, k.region, k.level, k.xp, k.land, k.population,
               k.fighters, k.mages, k.rangers, k.morale, k.turn, k.description,
               k.res_military, k.res_economy, k.res_construction, k.res_spellbook,
               k.res_attack_magic, k.res_entertainment,
               p.id as player_id, p.username, p.is_ai
        FROM kingdoms k JOIN players p ON k.player_id = p.id
        WHERE LOWER(k.name) = LOWER(?)`,
        [req.params.name],
      );
      if (!k) return res.status(404).json({ error: "Kingdom not found" });
      const alliance = await db.get(
        `
        SELECT a.name FROM alliances a JOIN alliance_members am ON a.id = am.alliance_id
        WHERE am.kingdom_id = ?`,
        [k.id],
      );
      const news = await db.all(
        `
        SELECT type, message, turn_num FROM news
        WHERE kingdom_id = ? AND type = 'attack'
        ORDER BY created_at DESC LIMIT 8`,
        [k.id],
      );
      const rankRow = await db.get(
        "SELECT COUNT(*)+1 as rank FROM kingdoms WHERE land > ? AND id != ?",
        [k.land, k.id],
      );
      res.json({
        ...k,
        alliance: alliance?.name || null,
        news,
        rank: rankRow?.rank || 1,
      });
    } catch (err) {
      console.error("[profile]", err.message);
      res.status(500).json({ error: "Failed to load profile" });
    }
  });

  // ── World map data ────────────────────────────────────────────────────────────
  router.get("/world-map", requireAuth, async (req, res) => {
    try {
      const k = await db.get(
        "SELECT id, discovered_kingdoms FROM kingdoms WHERE player_id = ?",
        [req.player.playerId],
      );
      if (!k) return res.status(404).json({ error: "Kingdom not found" });

      let discovered = {};
      try {
        discovered = safeJsonParse(k.discovered_kingdoms, {}, "auto:discovered_kingdoms");
      } catch {}

      const kingdoms = await db.all(`
        SELECT k.id, k.name, k.race, k.region, k.land, k.level, k.turn, p.is_ai
        FROM kingdoms k JOIN players p ON k.player_id = p.id
        ORDER BY k.land DESC`);

      const filtered = kingdoms.filter(
        (r) => r.id === k.id || (discovered[r.id] && discovered[r.id].found),
      );

      const tradeRoutes = await db.all(
        "SELECT * FROM trade_routes WHERE kingdom_id = ? OR partner_id = ?",
        [k.id, k.id],
      );

      res.json({ kingdoms: filtered, tradeRoutes });
    } catch {
      // region column may not exist yet — fallback query
      try {
        const k = await db.get(
          "SELECT id, discovered_kingdoms FROM kingdoms WHERE player_id = ?",
          [req.player.playerId],
        );
        let discovered = {};
        if (k)
          try {
            discovered = safeJsonParse(k.discovered_kingdoms, {}, "auto:discovered_kingdoms");
          } catch {}

        const kingdoms = await db.all(`
          SELECT k.id, k.name, k.race, '' as region, k.land, k.level, k.turn, p.is_ai
          FROM kingdoms k JOIN players p ON k.player_id = p.id
          ORDER BY k.land DESC`);

        const filtered = kingdoms.filter(
          (r) =>
            k &&
            (r.id === k.id || (discovered[r.id] && discovered[r.id].found)),
        );

        const tradeRoutes = k
          ? await db.all(
              "SELECT * FROM trade_routes WHERE kingdom_id = ? OR partner_id = ?",
              [k.id, k.id],
            )
          : [];

        res.json({ kingdoms: filtered, tradeRoutes });
      } catch (err2) {
        console.error("[world-map]", err2.message);
        res.status(500).json({ error: "Failed to load map data" });
      }
    }
  });

  router.post("/rebirth", requireAuth, async (req, res) => {
    const k = await db.get("SELECT * FROM kingdoms WHERE player_id = ?", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    if (!engine.canPrestige(k))
      return res
        .status(400)
        .json({ error: "Require Kingdom Level 50 to Rebirth." });

    const result = engine.processPrestige(k);
    await applyUpdates(db, k.id, result.updates);

    await db.run(
      "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?,?,?,?)",
      [
        k.id,
        "system",
        "🌌 YOU HAVE TRANSCENDED. A new era begins for your empire!",
        result.updates.turn,
      ],
    );

    res.json({ ok: true, prestige_level: result.updates.prestige_level });
  });

  router.get("/lore-and-achievements", requireAuth, async (req, res) => {
    try {
      const k = await db.get(
        "SELECT race, collected_lore, achievements FROM kingdoms WHERE player_id = ?",
        [req.player.playerId],
      );
      if (!k) return res.status(404).json({ error: "Kingdom not found" });

      let collectedLore = [];
      try {
        let raw = k.collected_lore;
        // In case it's stored as 'null' literally, or similar
        if (!raw || raw === "null") raw = "[]";
        collectedLore = JSON.parse(raw);
        if (!Array.isArray(collectedLore)) collectedLore = [];
      } catch {
        collectedLore = [];
      }

      let achievements = [];
      try {
        let rawAch = k.achievements;
        if (!rawAch || rawAch === "null") rawAch = "[]";
        achievements = JSON.parse(rawAch);
        if (!Array.isArray(achievements)) achievements = [];
      } catch {
        achievements = [];
      }

      const LORE = require("../game/config").LORE_EVENTS;

      const filterLore = (categoryList) => {
        return (categoryList || [])
          .filter((l, idx) => idx === 0 || collectedLore.includes(l.id))
          .map((l) => ({ id: l.id, title: l.title, msg: l.msg }));
      };

      res.json({
        raceLore: filterLore(LORE[k.race]),
        narmirLore: filterLore(LORE["narmir"]),
        generalLore: filterLore(LORE["general"]),
        achievements,
      });
    } catch (err) {
      console.error("Error in /lore-and-achievements:", err);
      console.error("[lore] GET lore-and-achievements:", err.message);
      res.status(500).json({ error: "Failed to load lore" });
    }
  });

  // ── Spy reports ───────────────────────────────────────────────────────────────
  router.get("/spy-reports", requireAuth, async (req, res) => {
    try {
      const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
        req.player.playerId,
      ]);
      if (!k) return res.status(404).json({ error: "Kingdom not found" });
      const rows = await db.all(
        `SELECT id, target_id, target_name, outcome, report, shared_to_alliance, created_at
         FROM spy_reports WHERE kingdom_id = ? ORDER BY created_at DESC LIMIT 100`,
        [k.id],
      );
      res.json(
        rows.map((r) => ({
          ...r,
          report: r.report ? JSON.parse(r.report) : null,
        })),
      );
    } catch (e) {
      console.error("[spy] GET spy-reports:", e.message);
      res.status(500).json({ error: "Failed to load spy reports" });
    }
  });

  router.post("/spy-reports/:id/share", requireAuth, async (req, res) => {
    try {
      const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
        req.player.playerId,
      ]);
      if (!k) return res.status(404).json({ error: "Kingdom not found" });
      const report = await db.get(
        "SELECT id, shared_to_alliance FROM spy_reports WHERE id = ? AND kingdom_id = ?",
        [req.params.id, k.id],
      );
      if (!report) return res.status(404).json({ error: "Report not found" });
      const newVal = report.shared_to_alliance ? 0 : 1;
      await db.run(
        "UPDATE spy_reports SET shared_to_alliance = ? WHERE id = ?",
        [newVal, report.id],
      );
      res.json({ ok: true, shared: newVal === 1 });
    } catch (e) {
      console.error("[spy] POST spy-reports/share:", e.message);
      res.status(500).json({ error: "Failed to update report" });
    }
  });

  router.get("/spy-reports/alliance", requireAuth, async (req, res) => {
    try {
      const k = await db.get("SELECT id FROM kingdoms WHERE player_id = ?", [
        req.player.playerId,
      ]);
      if (!k) return res.status(404).json({ error: "Kingdom not found" });
      const membership = await db.get(
        "SELECT alliance_id FROM alliance_members WHERE kingdom_id = ?",
        [k.id],
      );
      if (!membership) return res.json([]);
      const rows = await db.all(
        `
        SELECT sr.id, sr.target_id, sr.target_name, sr.outcome, sr.report, sr.created_at,
               k.name as shared_by_name
        FROM spy_reports sr
        JOIN kingdoms k ON sr.kingdom_id = k.id
        JOIN alliance_members am ON am.kingdom_id = sr.kingdom_id
        WHERE am.alliance_id = ? AND sr.shared_to_alliance = 1
        ORDER BY sr.created_at DESC LIMIT 50
      `,
        [membership.alliance_id],
      );
      res.json(
        rows.map((r) => ({
          ...r,
          report: r.report ? JSON.parse(r.report) : null,
        })),
      );
    } catch (e) {
      console.error("[spy] GET spy-reports/alliance:", e.message);
      res.status(500).json({ error: "Failed to load alliance intel" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // RESOURCE GATHERING SYSTEM
  // ──────────────────────────────────────────────────────────────────────────────

  const {
    initItemsArray,
    addItemToInventory,
  } = engine;

  const {
    RARE_RESOURCE_ITEMS,
    RESOURCE_NODE_NAMES,
    HARVEST_DURATION_BY_RICHNESS,
  } = require('../game/config');

  // GET /resource-nodes — list all discovered nodes for this kingdom
  router.get('/resource-nodes', requireAuth, async (req, res) => {
    try {
      const k = await db.get('SELECT id FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });
      const nodes = await db.all('SELECT * FROM resource_nodes WHERE kingdom_id = ? ORDER BY discovered_at DESC', [k.id]);
      res.json(nodes);
    } catch (e) {
      console.error('[resource-nodes] GET:', e.message);
      res.status(500).json({ error: 'Failed to load resource nodes' });
    }
  });

  // GET /expeditions — list all resource expeditions for this kingdom
  router.get('/resource-expeditions', requireAuth, async (req, res) => {
    try {
      const k = await db.get('SELECT id FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });
      const exps = await db.all(
        `SELECT re.*, rn.name as node_name, rn.type as node_type, rn.richness, rn.distance
         FROM resource_expeditions re
         JOIN resource_nodes rn ON re.node_id = rn.id
         WHERE re.kingdom_id = ? AND re.status != 'completed'
         ORDER BY re.depart_at DESC`,
        [k.id]
      );
      res.json(exps.map(e => ({ ...e, loot: safeJsonParse(e.loot, {}, 'expeditions:loot') })));
    } catch (e) {
      console.error('[resource-expeditions] GET:', e.message);
      res.status(500).json({ error: 'Failed to load expeditions' });
    }
  });

  // POST /scout-node — pay 500 gold, generate a random resource node
  router.post('/scout-node', requireAuth, async (req, res) => {
    try {
      const k = await db.get('SELECT * FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });
      if (k.gold < 500) return res.status(400).json({ error: 'Need 500 gold to scout a node.' });

      // Weighted type selection
      const typeRoll = Math.random();
      let nodeType;
      if (typeRoll < 0.35) nodeType = 'wood';
      else if (typeRoll < 0.65) nodeType = 'stone';
      else if (typeRoll < 0.90) nodeType = 'iron';
      else nodeType = 'gold';

      // Weighted richness selection (1:30%, 2:30%, 3:25%, 4:10%, 5:5%)
      const rRoll = Math.random();
      let richness;
      if (rRoll < 0.30) richness = 1;
      else if (rRoll < 0.60) richness = 2;
      else if (rRoll < 0.85) richness = 3;
      else if (rRoll < 0.95) richness = 4;
      else richness = 5;

      // Random distance 600–28800 seconds
      const distance = Math.floor(Math.random() * 28200) + 600;

      // Pick name from pool
      const namePool = RESOURCE_NODE_NAMES[nodeType] || RESOURCE_NODE_NAMES.wood;
      const name = namePool[Math.floor(Math.random() * namePool.length)];

      await db.run('UPDATE kingdoms SET gold = gold - 500 WHERE id = ?', [k.id]);
      const result = await db.run(
        'INSERT INTO resource_nodes (kingdom_id, name, type, distance, richness) VALUES (?, ?, ?, ?, ?)',
        [k.id, name, nodeType, distance, richness]
      );

      res.json({
        ok: true,
        node: { id: result.lastID, kingdom_id: k.id, name, type: nodeType, distance, richness, discovered_at: Math.floor(Date.now() / 1000) }
      });
    } catch (e) {
      console.error('[scout-node] POST:', e.message);
      res.status(500).json({ error: 'Failed to scout node' });
    }
  });

  // POST /expedition/launch — start a resource expedition to a discovered node
  router.post('/expedition/launch', requireAuth, async (req, res) => {
    try {
      const { nodeId, populationSent } = req.body;
      if (!nodeId || !populationSent) return res.status(400).json({ error: 'nodeId and populationSent required' });
      if (populationSent < 10) return res.status(400).json({ error: 'Must send at least 10 population.' });

      const k = await db.get('SELECT * FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      // Free population cap — max 25% of free pop can go on an expedition
      // Also subtract population already deployed on active expeditions (belt-and-suspenders)
      const onExp = await db.get(
        "SELECT SUM(population_sent) as total FROM resource_expeditions WHERE kingdom_id = ? AND status NOT IN ('completed','intercepted')",
        [k.id]
      );
      const freePop = Math.max(0, k.population - engine.totalHiredUnits(k) - (onExp?.total || 0));
      const maxPop = Math.floor(freePop * 0.25);
      if (populationSent > maxPop)
        return res.status(400).json({ error: `Can only send up to 25% of free population (${maxPop.toLocaleString()} max).` });

      const node = await db.get('SELECT * FROM resource_nodes WHERE id = ? AND kingdom_id = ?', [nodeId, k.id]);
      if (!node) return res.status(404).json({ error: 'Node not found or does not belong to you.' });

      // Check no active expedition to this node
      const activeExp = await db.get(
        "SELECT id FROM resource_expeditions WHERE kingdom_id = ? AND node_id = ? AND status NOT IN ('completed','intercepted')",
        [k.id, nodeId]
      );
      if (activeExp) return res.status(400).json({ error: 'You already have an active expedition to this node.' });

      // Get expedition speed bonus
      const raceBonus = engine.raceBonus ? (engine.raceBonus(k, 'expedition_speed') || 1.0) : 1.0;
      const travelTime = Math.ceil(node.distance / raceBonus);
      const harvestDuration = HARVEST_DURATION_BY_RICHNESS[node.richness] || 3600;
      const totalSeconds = travelTime * 2 + harvestDuration; // outbound + harvest + return
      const totalMinutes = totalSeconds / 60;
      const TURNS_PER_MINUTE = 0.28; // 7 turns per 25-minute regen cycle
      const turnsEquiv = totalMinutes * TURNS_PER_MINUTE;
      // Food rate: floor(populationSent / 100) per turn × racial multiplier, same as kingdom pop formula
      const raceFoodMult = engine.FOOD_CONSUMPTION_MULT[k.race] || 1.0;
      const foodPerTurn = Math.max(1, Math.floor(populationSent / 100)) * raceFoodMult;
      const foodNeeded = Math.ceil(turnsEquiv * foodPerTurn * 0.75); // 25% discount
      if (k.food < foodNeeded)
        return res.status(400).json({ error: `Expedition requires ${foodNeeded.toLocaleString()} food for the journey (you have ${k.food.toLocaleString()}).` });

      const now = Math.floor(Date.now() / 1000);
      const arrive_at = now + travelTime;

      // Depart: remove population and food from kingdom for the duration
      await db.run('UPDATE kingdoms SET food = MAX(0, food - ?), population = MAX(0, population - ?) WHERE id = ?', [foodNeeded, populationSent, k.id]);
      await db.run(
        'INSERT INTO resource_expeditions (kingdom_id, node_id, population_sent, depart_at, arrive_at, status, loot, food_taken) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [k.id, nodeId, populationSent, now, arrive_at, 'outbound', '{}', foodNeeded]
      );

      res.json({ ok: true, arrive_at, travelTime, foodTaken: foodNeeded });
    } catch (e) {
      console.error('[expedition/launch] POST:', e.message);
      res.status(500).json({ error: 'Failed to launch expedition' });
    }
  });

  // POST /expedition/intercept — orc-only interception
  router.post('/expedition/intercept', requireAuth, async (req, res) => {
    try {
      const { expeditionId, fighters } = req.body;
      const k = await db.get('SELECT * FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });
      if (k.race !== 'orc') return res.status(403).json({ error: 'Only Orcs can intercept expeditions.' });
      if (!fighters || fighters < 1) return res.status(400).json({ error: 'Must send at least 1 fighter.' });
      if (k.fighters < fighters) return res.status(400).json({ error: 'Not enough fighters.' });

      const exp = await db.get(
        "SELECT re.*, rn.type as node_type, rn.richness FROM resource_expeditions re JOIN resource_nodes rn ON re.node_id = rn.id WHERE re.id = ? AND re.status IN ('outbound','harvesting')",
        [expeditionId]
      );
      if (!exp) return res.status(404).json({ error: 'Expedition not found or not interceptable.' });
      if (exp.kingdom_id === k.id) return res.status(400).json({ error: 'Cannot intercept your own expedition.' });

      const defender = await db.get('SELECT * FROM kingdoms WHERE id = ?', [exp.kingdom_id]);
      if (!defender) return res.status(404).json({ error: 'Defending kingdom not found.' });

      // Combat: attacker power = fighters, defender power = populationSent * 0.1
      const attackPower = fighters;
      const defendPower = exp.population_sent * 0.1;
      const success = attackPower > defendPower * 3;

      let loot = safeJsonParse(exp.loot, {}, 'intercept:loot');
      const newsMessages = [];

      if (success) {
        // Steal loot and return the expedition population to the defender
        await db.run("UPDATE resource_expeditions SET status = 'intercepted', loot = '{}' WHERE id = ?", [exp.id]);
        await db.run('UPDATE kingdoms SET population = population + ? WHERE id = ?', [exp.population_sent, exp.kingdom_id]);
        // Give loot to attacker
        const lootUpdates = {};
        for (const [res, qty] of Object.entries(loot)) {
          if (qty > 0 && ['wood','stone','iron','gold'].includes(res)) {
            lootUpdates[res] = (k[res] || 0) + qty;
          }
        }
        if (Object.keys(lootUpdates).length > 0) {
          const cols = Object.keys(lootUpdates).map(c => `${c} = ?`).join(', ');
          await db.run(`UPDATE kingdoms SET ${cols} WHERE id = ?`, [...Object.values(lootUpdates), k.id]);
        }
        newsMessages.push({ kingdom_id: k.id, message: `⚔️ Your warriors intercepted an expedition! You seized: ${JSON.stringify(loot)}.` });
        newsMessages.push({ kingdom_id: exp.kingdom_id, message: `🚨 Orc raiders from ${k.name} intercepted your expedition and stole your loot! Your ${exp.population_sent.toLocaleString()} people fled home.` });
      } else {
        // Attacker takes casualties
        const casualties = Math.floor(fighters * 0.3);
        await db.run('UPDATE kingdoms SET fighters = fighters - ? WHERE id = ?', [casualties, k.id]);
        newsMessages.push({ kingdom_id: k.id, message: `⚔️ Your warriors failed to intercept the expedition. Lost ${casualties} fighters.` });
        newsMessages.push({ kingdom_id: exp.kingdom_id, message: `🛡️ Your expedition successfully repelled Orc raiders from ${k.name}!` });
      }

      for (const nm of newsMessages) {
        await db.run('INSERT INTO news (kingdom_id, type, message, turn_num) VALUES (?, ?, ?, ?)', [nm.kingdom_id, 'system', nm.message, 0]);
      }

      res.json({ ok: true, success, loot: success ? loot : null });
    } catch (e) {
      console.error('[expedition/intercept] POST:', e.message);
      res.status(500).json({ error: 'Failed to process interception' });
    }
  });

  // GET /expeditions/visible — orc-only, returns other kingdoms' active expeditions
  router.get('/expeditions/visible', requireAuth, async (req, res) => {
    try {
      const k = await db.get('SELECT id, race FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });
      if (k.race !== 'orc') return res.status(403).json({ error: 'Only Orcs can see other expeditions.' });

      const exps = await db.all(
        `SELECT re.id, re.status, re.arrive_at, re.harvest_ends_at, re.return_at,
                re.population_sent, rn.type as node_type, kk.name as kingdom_name
         FROM resource_expeditions re
         JOIN resource_nodes rn ON re.node_id = rn.id
         JOIN kingdoms kk ON re.kingdom_id = kk.id
         WHERE re.kingdom_id != ? AND re.status NOT IN ('completed','intercepted')
         ORDER BY re.depart_at DESC LIMIT 100`,
        [k.id]
      );
      res.json(exps);
    } catch (e) {
      console.error('[expeditions/visible] GET:', e.message);
      res.status(500).json({ error: 'Failed to load visible expeditions' });
    }
  });

  // POST /resource-upgrade — purchase stage 2 or 3 upgrade for a resource type
  router.post('/resource-upgrade', requireAuth, async (req, res) => {
    try {
      const { type, toStage } = req.body;
      if (!['wood','stone','iron'].includes(type)) return res.status(400).json({ error: 'Invalid resource type.' });
      if (![2,3].includes(Number(toStage))) return res.status(400).json({ error: 'toStage must be 2 or 3.' });
      const stage = Number(toStage);

      const k = await db.get('SELECT * FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      const level = k.level || 1;
      const currentBracket = Math.floor((level - 1) / 10);
      const resSeq = safeJsonParse(k.resource_sequence, {}, 'resource-upgrade:resource_sequence');
      const typeSeq = resSeq[type] || { s2_paid_at_bracket: -1, s3_paid_at_bracket: -1, last_s3_bracket: -1 };

      if (stage === 2) {
        // Prerequisites check
        const s1ColMap = { wood: 'bld_woodyard', stone: 'bld_gravel_pit', iron: 'bld_open_pit' };
        const s1Col = s1ColMap[type];
        if ((k[s1Col] || 0) < 3) return res.status(400).json({ error: `Need at least 3 ${s1Col.replace('bld_','')} to unlock stage 2.` });

        const resColMap = { wood: 'wood', stone: 'stone', iron: 'iron' };
        const resCol = resColMap[type];
        if ((k[resCol] || 0) < 200) return res.status(400).json({ error: `Need 200 ${type} stockpile.` });
        if (k.gold < 10000) return res.status(400).json({ error: 'Need 10,000 gold.' });

        // Check not already paid for this bracket
        if (typeSeq.s2_paid_at_bracket > -1) {
          return res.status(400).json({ error: 'Stage 2 upgrade already purchased.' });
        }

        const updatedSeq = { ...resSeq };
        if (!updatedSeq[type]) updatedSeq[type] = { s2_paid_at_bracket: -1, s3_paid_at_bracket: -1, last_s3_bracket: -1 };
        updatedSeq[type].s2_paid_at_bracket = currentBracket;

        await db.run(
          'UPDATE kingdoms SET gold = gold - 10000, resource_sequence = ? WHERE id = ?',
          [JSON.stringify(updatedSeq), k.id]
        );
        // Also deduct the resource
        await db.run(`UPDATE kingdoms SET ${resCol} = ${resCol} - 200 WHERE id = ?`, [k.id]);

        return res.json({ ok: true, message: `Stage 2 ${type} upgrade purchased.` });
      }

      if (stage === 3) {
        // Prerequisites check
        const s2ColMap = { wood: 'bld_lumber_camp', stone: 'bld_blockfield', iron: 'bld_strip_mine' };
        const s2Col = s2ColMap[type];
        if ((k[s2Col] || 0) < 5) return res.status(400).json({ error: `Need at least 5 ${s2Col.replace('bld_','')} to unlock stage 3.` });

        const crossResCol = type === 'iron' ? 'stone' : 'iron';
        if ((k[type] || 0) < 1000) return res.status(400).json({ error: `Need 1000 ${type} stockpile.` });
        if ((k[crossResCol] || 0) < 500) return res.status(400).json({ error: `Need 500 ${crossResCol} stockpile.` });
        if (k.gold < 100000) return res.status(400).json({ error: 'Need 100,000 gold.' });

        if (typeSeq.s3_paid_at_bracket > -1) {
          return res.status(400).json({ error: 'Stage 3 upgrade already purchased.' });
        }

        const updatedSeq = { ...resSeq };
        if (!updatedSeq[type]) updatedSeq[type] = { s2_paid_at_bracket: -1, s3_paid_at_bracket: -1, last_s3_bracket: -1 };
        updatedSeq[type].s3_paid_at_bracket = currentBracket;

        await db.run(
          'UPDATE kingdoms SET gold = gold - 100000, resource_sequence = ? WHERE id = ?',
          [JSON.stringify(updatedSeq), k.id]
        );
        // Deduct resources
        await db.run(`UPDATE kingdoms SET ${type} = ${type} - 1000 WHERE id = ?`, [k.id]);
        await db.run(`UPDATE kingdoms SET ${crossResCol} = ${crossResCol} - 500 WHERE id = ?`, [k.id]);

        return res.json({ ok: true, message: `Stage 3 ${type} upgrade purchased.` });
      }
    } catch (e) {
      console.error('[resource-upgrade] POST:', e.message);
      res.status(500).json({ error: 'Failed to process resource upgrade' });
    }
  });

  // ── Process resource expeditions (called lazily from processTurn endpoint) ────
  async function processResourceExpeditionsDb(kingdomId, k) {
    const now = Math.floor(Date.now() / 1000);
    const exps = await db.all(
      "SELECT re.*, rn.type as node_type, rn.richness FROM resource_expeditions re JOIN resource_nodes rn ON re.node_id = rn.id WHERE re.kingdom_id = ? AND re.status NOT IN ('completed','intercepted')",
      [kingdomId]
    );

    const lootEvents = [];
    const kUpdates = {};

    for (const exp of exps) {
      if (exp.status === 'outbound' && now >= exp.arrive_at) {
        const harvestDuration = HARVEST_DURATION_BY_RICHNESS[exp.richness] || 3600;
        await db.run(
          "UPDATE resource_expeditions SET status = 'harvesting', harvest_ends_at = ? WHERE id = ?",
          [now + harvestDuration, exp.id]
        );
      } else if (exp.status === 'harvesting' && exp.harvest_ends_at && now >= exp.harvest_ends_at) {
        // Compute loot
        const baseLoot = exp.richness * 50 * (exp.population_sent / 100);
        const loot = { [exp.node_type]: Math.floor(baseLoot) };

        // 5% chance bonus rare item
        const rareItems = RARE_RESOURCE_ITEMS[exp.node_type];
        const rareFindMult = engine.raceBonus ? (engine.raceBonus(k, 'rare_find') || 1.0) : 1.0;
        const items = initItemsArray(safeJsonParse(k.items, [], 'processExpeditions:items'));
        let itemsChanged = false;

        if (Math.random() < 0.02 * rareFindMult) {
          // 2% earth fragment
          const ef = items.find(i => i.id === 'earth_fragment');
          if (!ef || (ef.qty || 0) === 0) {
            addItemToInventory(items, 'earth_fragment', 'Earth Fragment', 1);
            itemsChanged = true;
            loot._item = 'Earth Fragment';
          }
        } else if (rareItems && Math.random() < 0.05) {
          // 5% rare resource item
          const chosen = rareItems[Math.floor(Math.random() * rareItems.length)];
          const existing = items.find(i => i.id === chosen.id);
          if (!existing || (existing.qty || 0) < 3) {
            addItemToInventory(items, chosen.id, chosen.name, 1);
            itemsChanged = true;
            loot._item = chosen.name;
          }
        }

        if (itemsChanged) {
          kUpdates.items = JSON.stringify(items);
          k.items = kUpdates.items; // update local reference for subsequent expeditions
        }

        // Get race bonus for speed (already used arrive_at, but for return trip)
        const raceSpeedMult = engine.raceBonus ? (engine.raceBonus(k, 'expedition_speed') || 1.0) : 1.0;
        const travelTime = Math.ceil((exp.distance || 3600) / raceSpeedMult);
        const return_at = now + travelTime;

        await db.run(
          "UPDATE resource_expeditions SET status = 'returning', loot = ?, return_at = ? WHERE id = ?",
          [JSON.stringify(loot), return_at, exp.id]
        );
      } else if (exp.status === 'returning' && exp.return_at && now >= exp.return_at) {
        const loot = safeJsonParse(exp.loot, {}, 'expedition:loot');
        // Apply loot to kingdom
        for (const [res, qty] of Object.entries(loot)) {
          if (res.startsWith('_')) continue; // skip metadata
          if (['wood','stone','iron','gold'].includes(res) && qty > 0) {
            kUpdates[res] = (kUpdates[res] !== undefined ? kUpdates[res] : (k[res] || 0)) + qty;
          }
        }
        // Return population to kingdom
        kUpdates.population = (kUpdates.population !== undefined ? kUpdates.population : k.population) + exp.population_sent;
        await db.run("UPDATE resource_expeditions SET status = 'completed' WHERE id = ?", [exp.id]);
        lootEvents.push({ type: 'system', message: `🗂️ Expedition returned with: ${Object.entries(loot).filter(([k]) => !k.startsWith('_')).map(([r,q]) => `${q} ${r}`).join(', ')}.` });
      }
    }

    return { kUpdates, lootEvents };
  }

  // Attach this helper to be callable from the processTurn route
  router._processResourceExpeditions = processResourceExpeditionsDb;

  // ── Inventory ────────────────────────────────────────────────────────────
  router.get('/inventory', requireAuth, async (req, res) => {
    try {
      const k = await db.get('SELECT items FROM kingdoms WHERE player_id = ?', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      let INVENTORY_ITEMS;
      try {
        ({ INVENTORY_ITEMS } = require('../game/config'));
      } catch (configErr) {
        console.error('[inventory] Failed to load config:', configErr.message);
        return res.status(500).json({ error: 'Server configuration error' });
      }
      const items = safeJsonParse(k.items, {}, 'inventory:items');

      // Format inventory with descriptions
      const formatted = {};
      const deprecated = [];
      for (const [itemId, count] of Object.entries(items)) {
        if (count > 0) {
          if (INVENTORY_ITEMS[itemId]) {
            formatted[itemId] = {
              name: INVENTORY_ITEMS[itemId].name,
              desc: INVENTORY_ITEMS[itemId].desc,
              count,
              rarity: INVENTORY_ITEMS[itemId].rarity
            };
          } else {
            deprecated.push(`${itemId}×${count}`);
          }
        }
      }

      // Log deprecated items for debugging
      if (deprecated.length > 0) {
        console.warn(`[inventory] Kingdom ${k.id} has deprecated items: ${deprecated.join(', ')}`);
      }

      res.json(formatted);
    } catch (err) {
      console.error('[inventory] failed:', err.message);
      res.status(500).json({ error: 'Failed to fetch inventory' });
    }
  });

  return router;
};

const { applyKingdomUpdates } = require("../db/schema");

async function applyUpdates(db, kingdomId, updates) {
  // We pass db parameter as usual, but applyKingdomUpdates just works directly against the global db object via schema
  await applyKingdomUpdates(kingdomId, updates);
}

// Insert multiple news rows in a single query — much faster than N sequential inserts
async function bulkInsertNews(db, rows) {
  if (!rows || rows.length === 0) return;
  const placeholders = rows.map(() => "(?,?,?,?)").join(",");
  const values = rows.flatMap((r) => [
    r.kingdom_id,
    r.type || "system",
    r.message,
    r.turn_num || 0,
  ]);
  await db.run(
    `INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ${placeholders}`,
    values,
  );
}

// Prune old news — keep only the most recent N rows per kingdom
async function pruneNews(db, kingdomId, keep = 200) {
  await db.run(
    `
    DELETE FROM news WHERE kingdom_id = ? AND id NOT IN (
      SELECT id FROM news WHERE kingdom_id = ? ORDER BY created_at DESC LIMIT ?
    )
  `,
    [kingdomId, kingdomId, keep],
  );
}
