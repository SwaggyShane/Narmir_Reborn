'use strict';

// Turn processing — split out of routes/kingdom-gameplay.js (A2-3, 2026-07-19),
// which had grown to 53 handlers covering everything from forge production to
// happiness to epic trek. This file owns exactly one thing: taking a turn.
//
// runTurn/loadTurnContext/commitTurnResults/withTurnLock are also used by
// kingdom-gameplay.js's /smithy/forge-tools and /search routes (instant actions
// that consume a turn's worth of effects without the full /turn HTTP round trip)
// — exported below as named properties on the module's default factory export,
// not duplicated.

const express = require("express");
const commandHandler = require("../game/command-handler");
const { initProfiler, runWithProfiler } = require("../game/profiling");
const { requireAuth, requireCsrfToken } = require("./middleware");
const { convertNumericFields } = require('../db/numeric-fields');
const { structureUpdates } = require('./response-structurer');
const { EPOCH_NOW } = require("../lib/db-sql");
const { pgInList } = require("../lib/pg-placeholders");
const {
  repairMojibake,
  normalizeNewsRow,
  getRandomKingdom,
  applyUpdates,
  bulkInsertNews,
  pruneNews,
} = require('./lib/kingdom-turn-helpers');

const router = express.Router();

// —— Per-player turn processing lock —————————————————————————
// Prevents client-side race conditions from multiple simultaneous turn requests
const turnsInProgress = new Map(); // playerId -> Promise

async function withTurnLock(playerId, fn) {
  // If a turn is already processing for this player, wait for it
  if (turnsInProgress.has(playerId)) {
    await turnsInProgress.get(playerId);
  }

  // Create promise for this turn and store it BEFORE awaiting
  const promise = (async () => {
    try {
      return await fn();
    } finally {
      turnsInProgress.delete(playerId);
    }
  })();

  turnsInProgress.set(playerId, promise);

  // Wait for turn to complete
  return promise;
}

async function loadTradeRoutes(db, k) {
  const tradeRoutes = await db.all(
    "SELECT * FROM trade_routes WHERE kingdom_id = $1 OR partner_id = $2",
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

// —— Load turn input context (init queries + trade routes) - can run outside txn ———
async function loadTurnContext(db, k) {
  if (!k) throw new Error('Kingdom not found');
  console.time(`[turn-${k.id}] init-queries`);
  // Inject region ownership status for bonuses
  // All 3 queries are independent - run them in parallel
  const [regionStatus, myAlliance, heroes] = await Promise.all([
    db.get(
      "SELECT owner_alliance_id, bonus_type FROM regions WHERE name = $1",
      [k.region],
    ),
    db.get(
      "SELECT alliance_id FROM alliance_members WHERE kingdom_id = $1",
      [k.id],
    ),
    db.all(
      "SELECT * FROM heroes WHERE kingdom_id = $1 AND status = 'idle'",
      [k.id],
    ),
  ]);
  console.timeEnd(`[turn-${k.id}] init-queries`);
  k._region_owned_by_my_alliance =
    regionStatus &&
    myAlliance &&
    regionStatus.owner_alliance_id === myAlliance.alliance_id;
  k._region_bonus_type = regionStatus?.bonus_type;
  k.heroes = heroes;
  console.time(`[turn-${k.id}] trade-routes`);
  await loadTradeRoutes(db, k);
  console.timeEnd(`[turn-${k.id}] trade-routes`);
  return { heroes };
}

// —— Commit turn side-effects (applies, hero XP, news, expeditions, resources) ————
// These are the DB writes that benefit from being inside a short transaction.
// Called from both legacy runTurn and the optimized /turn path.
async function commitTurnResults(db, k, updates, incomingEvents) {
  const events = incomingEvents || [];
  const cleanEvents = events.map(normalizeNewsRow);

  const heroBatch = [];
  for (const hero of (k.heroes || [])) {
    const xpResult = commandHandler.awardHeroXp(hero, 10);
    heroBatch.push({ id: hero.id, level: xpResult.level, xp: xpResult.xp });
    commandHandler.applyHeroTurnBonuses(hero, k, updates, events);
  }

  updates.turns_stored = k.turns_stored - 1;

  // Dedup news - only insert if we haven't already sent this EXACT message recently
  const filteredEvents = [];
  // Batch check for duplicate news instead of N+1 queries
  const existingMessages = {};
  if (events.length > 0) {
    // Deduplicate and filter for valid string messages to prevent TypeError and reduce DB load
    const uniqueMessages = [...new Set(cleanEvents.map(e => e && e.message).filter(msg => typeof msg === 'string'))];
    if (uniqueMessages.length > 0) {
      const existingNews = await db.all(
        `SELECT DISTINCT message FROM news WHERE kingdom_id = $1 AND message IN (${pgInList(uniqueMessages.length, 2)}) AND created_at > (${EPOCH_NOW} - 60)`,
        [k.id, ...uniqueMessages]
      );
      existingNews.forEach(row => {
        existingMessages[row.message] = true;
      });
    }
  }

  for (const ev of cleanEvents) {
    // Skip messages marked to not go to news
    if (ev.skipNews) continue;

    const existing = existingMessages[ev.message];
    if (
      existing &&
      !ev.message.includes("Troop upkeep") &&
      !ev.message.includes("Actively constructing") &&
      !ev.message.includes("Library Est:") &&
      !ev.message.includes("Construction complete:")
    )
      continue; // already sent — skip
    filteredEvents.push(ev);
  }

  // Resolve kingdom-discovery flags BEFORE applyUpdates so discovered_kingdoms
  // persists with the turn write. Flags are not DB columns (stripped below).
  // Passive scout kingdom_signal sets _find_kingdom; surveyor sets _find_kingdom_surveyor.
  const discoveryEvents = [];
  {
    const { mergeKingdomDiscovery, stripDiscoveryFlags } = require('../game/kingdom-discovery-resolve');
    const stateForMerge = { ...k, ...updates };

    if (updates._find_kingdom_surveyor) {
      const other = await getRandomKingdom(db, k.id, [], 'id, name');
      const merged = mergeKingdomDiscovery(stateForMerge, updates, other, { source: 'surveyor' });
      if (merged.applied) {
        updates.discovered_kingdoms = merged.discovered_kingdoms;
        stateForMerge.discovered_kingdoms = merged.discovered_kingdoms;
        const msg = repairMojibake(merged.message);
        discoveryEvents.push({ type: 'system', message: msg });
        filteredEvents.push({ type: 'system', message: msg });
      }
    }

    if (updates._find_kingdom) {
      const other = await getRandomKingdom(db, k.id, [], 'id, name');
      const merged = mergeKingdomDiscovery(stateForMerge, updates, other, { source: 'scout' });
      if (merged.applied) {
        updates.discovered_kingdoms = merged.discovered_kingdoms;
        const msg = repairMojibake(merged.message);
        discoveryEvents.push({
          type: 'system',
          message: msg,
          expeditionLogEntry: {
            icon: '🔍',
            title: 'Kingdom discovered',
            subtitle: merged.otherName || 'kingdom',
          },
        });
        filteredEvents.push({ type: 'system', message: msg });
      }
    }

    if (updates._spawn_resource_node) {
      const nodeType = updates._spawn_resource_node;
      delete updates._spawn_resource_node;
      try {
        const { spawnPassiveScoutResourceNode } = require('../game/passive-resource-node-spawn');
        const spawned = await spawnPassiveScoutResourceNode(db, { ...k, ...updates }, nodeType);
        if (spawned.ok) {
          const msg = repairMojibake(
            `🔍 Your scouts charted a new ${spawned.type} deposit on the map`,
          );
          discoveryEvents.push({
            type: 'system',
            message: msg,
            expeditionLogEntry: {
              icon: '🔍',
              title: 'Resource node found',
              subtitle: spawned.type,
            },
          });
          filteredEvents.push({ type: 'system', message: msg });
        }
      } catch (spawnErr) {
        console.error('[commitTurnResults] resource node spawn:', spawnErr.message);
      }
    }

    stripDiscoveryFlags(updates);
    delete updates._spawn_resource_node;
  }

  try {
    console.time(`[turn-${k.id}] applyUpdates`);
    await applyUpdates(db, k.id, updates);
    console.timeEnd(`[turn-${k.id}] applyUpdates`);

    // Batch hero XP updates
    if (heroBatch.length > 0) {
      const heroIds = heroBatch.map(h => h.id);
      const levels = heroBatch.map(h => h.level);
      const xps = heroBatch.map(h => h.xp);
      const placeholders = heroIds.map((_, i) => `$${i + 1}`).join(',');

      await db.run(
        `UPDATE heroes SET level = CAST(CASE id ${heroIds.map((_, i) => `WHEN $${i + 1} THEN $${heroIds.length + i + 1}`).join(' ')} END AS integer),
         xp = CAST(CASE id ${heroIds.map((_, i) => `WHEN $${i + 1} THEN $${heroIds.length * 2 + i + 1}`).join(' ')} END AS real)
         WHERE id IN (${placeholders})`,
        [...heroIds, ...levels, ...xps]
      );
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

  // Resolve expeditions
  let expeditionEvents = [];
  try {
    console.time(`[turn-${k.id}] resolveExpeditions`);
    // commandHandler.handle({type:'expeditions'}) already includes resource harvests
    expeditionEvents = await commandHandler.handle(
      { type: 'expeditions' },
      { kingdom: { ...k, ...updates }, db },
    );
    console.timeEnd(`[turn-${k.id}] resolveExpeditions`);
    expeditionEvents = expeditionEvents.map(normalizeNewsRow);
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
  } catch (err) {
    console.error("[runTurn] expedition resolve error:", err.message);
    // Only throw if in an active transaction (safe to rollback)
    // Endpoints like /search call runTurn without transaction context
    const store = db.transactionStorage?.getStore?.();
    if (store && !store.released) {
      throw err; // Rethrow to trigger transaction rollback
    }
    // If no transaction: log but don't throw (prevent lost turns)
  }

  const allEvents = [...cleanEvents, ...discoveryEvents, ...expeditionEvents];

  return { updates, events: allEvents };
}

// —— Shared turn runner - used by ALL routes that consume a turn ————————————
async function runTurn(db, k) {
  if (!k) throw new Error('Kingdom not found');
  console.time(`[turn-${k.id}] total`);
  await loadTurnContext(db, k);

  console.time(`[turn-${k.id}] commandHandler.turn`);
  const { updates, events } = await commandHandler.handle(
    { type: 'turn' },
    { kingdom: k, db },
  );
  console.timeEnd(`[turn-${k.id}] commandHandler.turn`);

  const { updates: finalUpdates, events: finalEvents } = await commitTurnResults(db, k, updates, events);

  // Refresh fields that resolveExpeditions may have updated via SQL
  console.time(`[turn-${k.id}] refresh-queries`);
  const refreshed = await db.get(
    "SELECT rangers, fighters, gold, mana, land, scrolls, maps, blueprints_stored, troop_levels, library_progress, tower_progress, racial_bonuses_unlocked, scout_progress FROM kingdoms WHERE id = $1",
    [k.id],
  );
  if (refreshed) Object.assign(finalUpdates, refreshed);

  // Fetch unread news count
  const unread = await db.get(
    "SELECT COUNT(*) as c FROM news WHERE kingdom_id = $1 AND is_read = 0",
    [k.id],
  );
  console.timeEnd(`[turn-${k.id}] refresh-queries`);
  finalUpdates.unread_news = unread.c;

  // Calculate new score after turn
  const finalState = { ...k, ...finalUpdates };
  finalUpdates.score = await commandHandler.handle(
    { type: 'calculate-score' },
    { kingdom: finalState },
  );

  console.timeEnd(`[turn-${k.id}] total`);
  return { updates: finalUpdates, events: finalEvents };
}

module.exports = function (db) {
  // —— Take turn (advance game state) ——————————————————————————
  // Optimized to minimize time holding DB transaction/connection (Phase 1):
  // - Prefetch of context (region/alliance/heroes + trade) + final refresh happen outside txn.
  // - Inside txn: FOR UPDATE lock + fresh kingdom snapshot + processTurn (on locked state) + writes.
  // - Context merged onto lockedK to preserve hero XP, bonuses, etc.
  // This shortens txn hold vs. original (init queries + refresh moved out) while preserving correctness.
  router.post("/turn", requireAuth, requireCsrfToken, async (req, res) => {
    const startTime = Date.now();
    try {
      const result = await withTurnLock(req.player.playerId, async () => {
        // === PREFETCH context only (outside transaction) ===
        // Context (region/alliance/heroes/trade) loaded outside to reduce txn hold time.
        // Core kingdom state for processTurn will be fetched fresh *under lock*.
        console.time(`[turn] prefetch`);
        let k = await db.get("SELECT * FROM kingdoms WHERE player_id = $1", [
          req.player.playerId,
        ]);
        if (!k) {
          throw new Error("Kingdom not found");
        }
        if (k.turns_stored < 1) {
          throw new Error("No turns available - next +7 turns in 25 minutes");
        }

        // Load context (init-queries + trade-routes) OUTSIDE txn — parallel reads
        await loadTurnContext(db, k);
        console.timeEnd(`[turn] prefetch`);

        // === SHORT TRANSACTION: lock + fresh snapshot + process + writes ===
        console.time(`[turn] transaction`);
        let txUpdates, txEvents;
        try {
          const txData = await db.withTransaction(async () => {
            // Re-fetch with FOR UPDATE for row lock + authoritative *current* state
            let lockedK = await db.get("SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE", [
              req.player.playerId,
            ]);
            if (!lockedK) {
              throw new Error("Kingdom not found");
            }
            if (lockedK.turns_stored < 1) {
              throw new Error("No turns available - next +7 turns in 25 minutes");
            }

            // Merge the pre-fetched context/heroes onto the fresh lockedK.
            // Critical for: hero XP/turn bonuses, region bonuses in process/resolve, trade routes, etc.
            Object.assign(lockedK, {
              _region_owned_by_my_alliance: k._region_owned_by_my_alliance,
              _region_bonus_type: k._region_bonus_type,
              heroes: k.heroes,
              _trade_routes: k._trade_routes,
            });

            // Run processTurn on the *locked* snapshot (prevents stale absolute updates
            // and lost concurrent modifications from non-turn actions).
            console.time(`[turn-${lockedK.id}] commandHandler.turn`);
            let turnResult;
            if (process.env.NODE_ENV !== 'production') {
              const p = initProfiler();
              turnResult = await runWithProfiler(p, () => commandHandler.handle({ type: 'turn' }, { kingdom: lockedK, db }));
            } else {
              turnResult = await commandHandler.handle({ type: 'turn' }, { kingdom: lockedK, db });
            }
            const { updates, events, _profileReport } = turnResult;
            if (_profileReport && _profileReport.totalTime > 0) {
              console.log(`[profiling] Turn ${updates.turn}: ${_profileReport.totalTime}ms total`);
              const { BUDGETS } = require('../game/profiling');
              const b = BUDGETS || { jsonHighCostMs: 100, slowAttunementMs: 10 };
              if (_profileReport.summary?.jsonPercentOfTotal > 10 || _profileReport.jsonOperations.totalTime > b.jsonHighCostMs) {
                console.log(`[profiling] JSON cost: ${_profileReport.jsonOperations.totalTime}ms (${_profileReport.summary.jsonPercentOfTotal}% of total) (budget ${b.jsonHighCostMs}ms)`);
              }
              if (_profileReport.summary?.slowAttunements || Object.values(_profileReport.attunements || {}).some(a => a.maxTime > b.slowAttunementMs)) {
                console.log(`[profiling] Slow attunements detected (budget ${b.slowAttunementMs}ms)`);
              }
            }
            console.timeEnd(`[turn-${lockedK.id}] commandHandler.turn`);

            // Apply writes inside the same txn (applyUpdates, hero batch, news, expeditions, resources)
            const { updates: committedUpdates, events: committedEvents } = await commitTurnResults(db, lockedK, updates, events);
            return { updates: committedUpdates, events: committedEvents };
          });
          txUpdates = txData.updates;
          txEvents = txData.events;
        } catch (txErr) {
          console.error('[turn] transaction failed:', txErr.message);
          throw new Error('Turn processing failed, please retry', { cause: txErr });
        }
        console.timeEnd(`[turn] transaction`);

        // === POSTFETCH (outside transaction) ===
        console.time(`[turn] postfetch`);
        const refreshed = await db.get(
          "SELECT rangers, fighters, gold, mana, land, scrolls, maps, blueprints_stored, troop_levels, library_progress, tower_progress, racial_bonuses_unlocked, scout_progress FROM kingdoms WHERE id = $1",
          [k.id],
        );
        if (refreshed) {
          convertNumericFields(refreshed);
          Object.assign(txUpdates, refreshed);
        }

        const unread = await db.get(
          "SELECT COUNT(*) as c FROM news WHERE kingdom_id = $1 AND is_read = 0",
          [k.id],
        );
        console.timeEnd(`[turn] postfetch`);

        txUpdates.unread_news = unread.c;

        // Final score on merged state
        const finalState = { ...k, ...txUpdates };
        txUpdates.score = await commandHandler.handle(
          { type: 'calculate-score' },
          { kingdom: finalState },
        );

        const totalTime = Date.now() - startTime;
        console.log(`[turn] complete for player ${req.player.playerId} in ${totalTime}ms (prefetch+process+tx+postfetch)`);

        // Use the shared structurer (response-structurer.js).
        return { ok: true, updates: structureUpdates(txUpdates), events: txEvents };
      });
      res.json(result);
    } catch (err) {
      console.error("[turn] failed:", err.stack || err.message);
      if (err.message.includes("Kingdom not found")) {
        return res.status(404).json({ error: err.message });
      }
      if (err.message.includes("No turns available")) {
        return res.status(429).json({ error: err.message });
      }
      if (err.message.includes("Turn processing failed")) {
        return res.status(500).json({ error: "Turn processing failed — please try again" });
      }
      const detail = process.env.NODE_ENV !== "production"
        ? (err.stack || err.message)
        : undefined;
      res.status(500).json({
        error: "Turn processing failed - please try again",
        ...(detail ? { detail } : {}),
      });
    }
  });

  return router;
};

module.exports.runTurn = runTurn;
module.exports.loadTurnContext = loadTurnContext;
module.exports.commitTurnResults = commitTurnResults;
module.exports.withTurnLock = withTurnLock;
