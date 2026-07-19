'use strict';

// World Map, Locations, Rivers, and Scout Visibility Debug — split out of
// routes/kingdom-gameplay.js (A2-7, 2026-07-19). Bundled as one file because
// these are layers of the same world-exploration/visibility domain, not just
// naming-adjacent: /locations reads a kingdom's discovered_kingdoms map,
// /world-map renders using that same discovered_kingdoms data gated by
// seenCells visibility, /fix-visibility resets the seenCells/currentCells
// bitmaps that gate what's visible, and /debug/scouts exposes the
// scout_progress that drives seenCells reveals. Four different layers
// (data / render / repair / debug) of one system.
//
// None of these routes go through CommandHandler; that's intentional policy
// (A5-2, Policy B) for already-modularized systems — most of these are plain
// reads/writes, not simulation mutators in the CommandHandler sense at all.

const express = require('express');
const { requireAuth, requireCsrfToken } = require('./middleware');
const { safeJsonParse } = require('../utils/helpers');
const { getKingdomMapCoords } = require('../game/world-map-coords');
const { getAllLocations, isPubliclyDiscovered } = require('../game/world-locations');
const { getTerrainForRace } = require('../game/terrain');
const { getWorldSeed } = require('../game/world-seed');
const { getKingdomVisibility } = require('../game/visibility');
const { safeBitmapHasCell } = require('../game/visibility-cells');
const { pixelToHex } = require('../game/hex-utils');

const router = express.Router();

module.exports = function (db) {
  // â"€â"€ Location — get my discovered kingdoms â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  router.get("/locations", requireAuth, async (req, res) => {
    const k = await db.get(
      "SELECT discovered_kingdoms, location_maps_wip FROM kingdoms WHERE player_id=$1",
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
  router.post("/locations/steal-map", requireAuth, requireCsrfToken, async (req, res) => {
    const { targetId } = req.body;
    const k = await db.get("SELECT id, name, thieves, discovered_kingdoms FROM kingdoms WHERE player_id=$1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });
    const target = await db.get("SELECT id, name, turn, hybrid_blueprints, discovered_kingdoms FROM kingdoms WHERE id=$1", [
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
        "SELECT name FROM kingdoms WHERE id=$1",
        [stolenId],
      );
      delete targetDisc[stolenId];
      await db.run("UPDATE kingdoms SET discovered_kingdoms=$1 WHERE id=$2", [
        JSON.stringify(targetDisc),
        target.id,
      ]);
      let myDisc = {};
      try {
        myDisc = safeJsonParse(k.discovered_kingdoms, {}, "auto:discovered_kingdoms");
      } catch {}
      myDisc[stolenId] = { found: true, mapped: true };
      await db.run("UPDATE kingdoms SET discovered_kingdoms=$1 WHERE id=$2", [
        JSON.stringify(myDisc),
        k.id,
      ]);
      await db.run(
        "INSERT INTO news (kingdom_id,type,message,turn_num) VALUES ($1,$2,$3,$4)",
        [
          target.id,
          "covert",
          `ðŸ—ºï¸ A thief stole your location map for ${stolenKingdom?.name || "a kingdom"}.`,
          target.turn,
        ],
      );
      await db.run(
        "INSERT INTO war_log (action_type,attacker_id,attacker_name,defender_id,defender_name,outcome,detail,obscured) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
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
  // â"€â"€ World map data â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
  router.get("/world-map", requireAuth, async (req, res) => {
    try {
      const k = await db.get(
        "SELECT id, race, discovered_kingdoms, visibility FROM kingdoms WHERE player_id = $1",
        [req.player.playerId],
      );
      if (!k) return res.status(404).json({ error: "Kingdom not found" });

      let discovered = {};
      try {
        discovered = safeJsonParse(k.discovered_kingdoms, {}, "auto:discovered_kingdoms");
      } catch {}

      // Phase 3: load visibility for seen_cells gating (filter content to revealed hexes)
      const vis = await getKingdomVisibility(db, k);
      const seenCells = vis.seenCells;
      // Bypass all seenCells/discovered_kingdoms gating below when fog of war
      // is disabled. A comment further down already claimed this flag
      // "bypasses seenCells gating everywhere else in this response" but
      // only the worldLocations filter actually checked it -- kingdoms,
      // nodes, and expeditions stayed gated regardless of the flag's value.
      const fogDisabledForMap = process.env.DISABLE_FOG_OF_WAR === 'true';

      const kingdoms = await db.all(`
        SELECT k.id, k.name, k.race, k.region, k.land, k.level, k.turn        FROM kingdoms k JOIN players p ON k.player_id = p.id
        ORDER BY k.land DESC`);

      const filtered = kingdoms.filter((r) => {
        if (r.id === k.id) return true;
        if (fogDisabledForMap) return true;
        if (!(discovered[r.id] && discovered[r.id].found)) return false;
        // Phase 3 gating: even discovered kingdoms only visible if their hex is seen
        const coords = getKingdomMapCoords(r);
        const h = pixelToHex(coords.map_x, coords.map_y);
        return safeBitmapHasCell(seenCells, h.col, h.row);
      });

      const kingdomsWithCoords = filtered.map((row) => {
        // land/level/turn are only shown for the caller's own kingdom — for
        // anyone else they're hidden unless revealed by a covert operation
        // (not yet wired up; see covert-intel plan).
        const isSelf = row.id === k.id;
        const { land, level, turn, ...publicRow } = row;
        const stats = isSelf ? { land, level, turn } : {};
        try {
          const coords = getKingdomMapCoords(row);
          return { ...publicRow, ...stats, map_x: coords.map_x, map_y: coords.map_y, terrain: getTerrainForRace(row.race) };
        } catch (err) {
          console.error(`[world-map] ERROR computing coords for K${row.id} ${row.name}:`, err.message);
          return { ...publicRow, ...stats, map_x: 0, map_y: 0, terrain: getTerrainForRace(row.race) };
        }
      });

      const tradeRoutes = await db.all(
        "SELECT * FROM trade_routes WHERE kingdom_id = $1 OR partner_id = $2",
        [k.id, k.id],
      );

      const nodes = await db.all(
        `SELECT id, kingdom_id, name, type, distance, richness, map_x, map_y, terrain
         FROM resource_nodes ORDER BY discovered_at DESC`
      );

      // Phase 3 gating + explicit node reveal: only include nodes in scouted hexes.
      // Scouting an area hex now makes nodes located there visible.
      const visibleNodes = nodes.filter((n) => {
        if (fogDisabledForMap) return true;
        const h = pixelToHex(n.map_x, n.map_y);
        return safeBitmapHasCell(seenCells, h.col, h.row);
      });

      const expeditions = await db.all(
        `SELECT re.id, re.node_id, re.status, re.population_sent, re.depart_at, re.arrive_at, re.return_at,
                rn.name AS node_name, rn.type AS node_type, rn.map_x, rn.map_y
         FROM resource_expeditions re
         JOIN resource_nodes rn ON re.node_id = rn.id
         WHERE re.kingdom_id = $1 AND re.status NOT IN ('completed', 'intercepted')
         ORDER BY re.depart_at DESC`,
        [k.id],
      );

      // Gate expeditions by seen hex of their node (Phase 3)
      const visibleExpeditions = expeditions.filter((e) => {
        if (fogDisabledForMap) return true;
        const h = pixelToHex(e.map_x, e.map_y);
        return safeBitmapHasCell(seenCells, h.col, h.row);
      });

      // Dungeon/mountain hearts: every region's locations are included, not
      // just the player's own — each carries a region-specific reward, so a
      // kingdom needs to be able to see and target any of them, once
      // discovered by ANY kingdom (not specifically this one). Locations
      // aren't owned by whichever kingdom scouts them first; once revealed
      // they're public domain. Also bypassed entirely when fog of war is
      // disabled (DISABLE_FOG_OF_WAR=true), which now genuinely bypasses
      // seenCells/discovered_kingdoms gating everywhere else in this
      // response too (kingdoms/nodes/expeditions above, via fogDisabledForMap).
      const fogDisabled = fogDisabledForMap;
      const worldLocations = getAllLocations().filter((loc) => fogDisabled || isPubliclyDiscovered(loc));

      // Fog of War Phase 1.5: BigInt can't be JSON-serialized directly, so
      // the seed goes over the wire as a string; the client parses it back
      // to BigInt before feeding it into the same seeded-random mixing the
      // server uses, so terrain biome patterns change across resets too.
      // Phase 4: also expose visibility bitmaps (as decimal strings) so client
      // can render fog overlay (unseen/seen/current states).
      res.json({
        playerKingdomId: k.id,  // Client needs to know which kingdom is the player's
        kingdoms: kingdomsWithCoords,
        tradeRoutes,
        nodes: visibleNodes,
        expeditions: visibleExpeditions,
        worldLocations,
        worldSeed: getWorldSeed().toString(),
        visibility: {
          seenCells: seenCells.toString(),
          currentCells: (vis.currentCells || 0n).toString(),
        },
      });
    } catch {
      // region column may not exist yet — fallback query
      try {
        const k = await db.get(
          "SELECT id, race, discovered_kingdoms, visibility FROM kingdoms WHERE player_id = $1",
          [req.player.playerId],
        );
        let discovered = {};
        if (k)
          try {
            discovered = safeJsonParse(k.discovered_kingdoms, {}, "auto:discovered_kingdoms");
          } catch {}

        // Phase 3 fallback path: visibility for gating
        const vis = k ? await getKingdomVisibility(db, k) : { seenCells: 0n };
        const seenCells = vis.seenCells || 0n;
        const fogDisabledForMap = process.env.DISABLE_FOG_OF_WAR === 'true';

        const kingdoms = await db.all(`
          SELECT k.id, k.name, k.race, '' as region, k.land, k.level, k.turn          FROM kingdoms k JOIN players p ON k.player_id = p.id
          ORDER BY k.land DESC`);

        const filtered = kingdoms.filter((r) => {
          if (!k) return false;
          if (r.id === k.id) return true;
          if (fogDisabledForMap) return true;
          if (!(discovered[r.id] && discovered[r.id].found)) return false;
          const coords = getKingdomMapCoords(r);
          const h = pixelToHex(coords.map_x, coords.map_y);
          return safeBitmapHasCell(seenCells, h.col, h.row);
        });

        const kingdomsWithCoords = filtered.map((row) => {
          const coords = getKingdomMapCoords(row);
          return { ...row, map_x: coords.map_x, map_y: coords.map_y, terrain: getTerrainForRace(row.race) };
        });

        const tradeRoutes = k
          ? await db.all(
              "SELECT * FROM trade_routes WHERE kingdom_id = $1 OR partner_id = $2",
              [k.id, k.id],
            )
          : [];

        const nodes = k
          ? await db.all(
              `SELECT id, kingdom_id, name, type, distance, richness, map_x, map_y, terrain
               FROM resource_nodes WHERE kingdom_id = $1 ORDER BY discovered_at DESC`,
              [k.id],
            )
          : [];

        const visibleNodes = nodes.filter((n) => {
          if (fogDisabledForMap) return true;
          const h = pixelToHex(n.map_x, n.map_y);
          return safeBitmapHasCell(seenCells, h.col, h.row);
        });

        const expeditions = k
          ? await db.all(
              `SELECT re.id, re.node_id, re.status, re.population_sent, re.depart_at, re.arrive_at, re.return_at,
                      rn.name AS node_name, rn.type AS node_type, rn.map_x, rn.map_y
               FROM resource_expeditions re
               JOIN resource_nodes rn ON re.node_id = rn.id
               WHERE re.kingdom_id = $1 AND re.status NOT IN ('completed', 'intercepted')
               ORDER BY re.depart_at DESC`,
              [k.id],
            )
          : [];

        // Phase 3 gating for fallback: filter expeditions by seen hex too.
        const visibleExpeditions = expeditions.filter((e) => {
          if (fogDisabledForMap) return true;
          const h = pixelToHex(e.map_x, e.map_y);
          return safeBitmapHasCell(seenCells, h.col, h.row);
        });

        const fogDisabled = fogDisabledForMap;
        const worldLocations = k
          ? getAllLocations().filter((loc) => fogDisabled || isPubliclyDiscovered(loc))
          : [];

        // Fog of War Phase 1.5: BigInt can't be JSON-serialized directly, so
      // the seed goes over the wire as a string; the client parses it back
      // to BigInt before feeding it into the same seeded-random mixing the
      // server uses, so terrain biome patterns change across resets too.
      res.json({
        playerKingdomId: k ? k.id : null,
        kingdoms: kingdomsWithCoords,
        tradeRoutes,
        nodes: visibleNodes,
        expeditions: visibleExpeditions,
        worldLocations,
        worldSeed: getWorldSeed().toString(),
        visibility: {
          seenCells: seenCells.toString(),
          currentCells: (vis.currentCells || 0n).toString(),
        },
      });
      } catch (err2) {
        console.error("[world-map]", err2.message);
        res.status(500).json({ error: "Failed to load map data" });
      }
    }
  });

  // GET /world-river-flow - Phase 2 elevation river-flow DAG (downhill graph
  // + flow accumulation per hex). Computed once at boot (db/schema.js) and
  // cached — these functions had zero callers anywhere before this. Note:
  // the world map's actually-rendered rivers still come from the separate
  // buildRiverNetwork lake/MST system in game/world-hex-grid.js; switching
  // the renderer to this flow-accumulation data is a distinct follow-up.
  router.get("/world-river-flow", requireAuth, async (_req, res) => {
    try {
      const { hasFlowData, getFlowData } = require("../game/world-elevation-cache");
      if (!hasFlowData()) {
        return res.status(503).json({ error: "River flow data not ready yet" });
      }
      const { dag, flow } = getFlowData();
      res.json({ dag, flow });
    } catch (err) {
      console.error("[world-river-flow]", err.message);
      res.status(500).json({ error: "Failed to load river flow data" });
    }
  });
  // Fix visibility corruption: reset currentCells to just the home hex
  // (useful after map expansions or visibility migrations)
  router.post('/fix-visibility', requireAuth, async (req, res) => {
    try {
      console.log('[fix-visibility] Starting for player:', req.player.playerId);
      const { resetCurrentCellsToHome } = require('../game/visibility');
      const k = await db.get('SELECT id, race FROM kingdoms WHERE player_id = $1', [req.player.playerId]);
      if (!k) return res.status(404).json({ error: 'Kingdom not found' });

      console.log('[fix-visibility] Resetting for kingdom:', k.id, 'race:', k.race);
      const updated = await resetCurrentCellsToHome(db, k);
      console.log('[fix-visibility] Updated visibility. currentCells:', updated.currentCells.toString());
      res.json({ message: 'Visibility reset to home hex only', visibility: { seenCells: updated.seenCells.toString(), currentCells: updated.currentCells.toString() } });
    } catch (err) {
      console.error('[fix-visibility] failed:', err.message, err.stack);
      res.status(500).json({ error: 'Failed to fix visibility: ' + err.message });
    }
  });

  router.get("/debug/scouts", requireAuth, async (req, res) => {
    try {
      const k = await db.get("SELECT scout_allocation, scout_progress FROM kingdoms WHERE player_id = $1", [req.player.playerId]);
      if (!k) {
        return res.status(404).json({ error: "Kingdom not found" });
      }
      res.json({
        scout_allocation: k.scout_allocation,
        scout_progress: k.scout_progress,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
