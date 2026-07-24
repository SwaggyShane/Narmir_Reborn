// game/lib/expedition-resolution.js
// resolveEpicTrek, resolveExpeditions, resolveResourceHarvests (engine extract S11).
// resolveExpeditions third arg: { io } or legacy engine-like object with .io.

'use strict';

const { devLog } = require('./data-transformations');
const { racialUnitBonus, awardTroopXp } = require('./troops');
const { junkPrize, expeditionRewards } = require('./gameplay');
const { awardXp } = require('../xp');
const { checkFogDiscoveries } = require('../kingdom-fog-discovery');
const { safeJsonParse, safeJsonStringify, roll } = require('../../utils/helpers');
const { pgInList, pgSetClauseWithNextPlaceholder } = require('../../lib/pg-placeholders');
const { safeEmit } = require('../safe-socket-emit');
const { updateKingdomVisibility } = require('../visibility');
const { cellIndex } = require('../visibility-cells');
const {
  processPathDiscoveries,
  findRegionalLocationsOnPath,
  applyLootDiscoveries,
} = require('../epic-trek-discovery');
const { pixelToHex } = require('../hex-utils');
const { getAllLocations, markLocationDiscovered, isPubliclyDiscovered } = require('../world-locations');
const { resolveLavaDraw } = require('../lava-expedition');
const { mergeKingdomDiscovery } = require('../kingdom-discovery-resolve');
const { THRONE_OF_NAZDREG, WORLD_FRAGMENTS } = require('../config');

async function getRandomKingdom(db, selfId) {
  const countRow = await db.get('SELECT COUNT(*) as c FROM kingdoms WHERE id != $1', [selfId]);
  const total = Number(countRow?.c || 0);
  if (total <= 0) return null;

  for (let attempt = 0; attempt < 8; attempt++) {
    const offset = Math.floor(Math.random() * total);
    const row = await db.get(
      'SELECT id, name FROM kingdoms WHERE id != $1 LIMIT 1 OFFSET $2',
      [selfId, offset],
    );
    if (row) return row;
  }

  return null;
}

/**
 * Process Epic Trek expedition completion: reveal fog along path and process discoveries.
 * Called from resolveExpeditions when an epic-trek expedition turns_left reaches 0.
 *
 * @param {object} db - Database connection
 * @param {object} exp - Expedition row (includes extra_data with path)
 * @param {object} kingdom - Fresh kingdom state
 * @returns {object} { events, updates, rewards } to merge into expedition processing
 */
async function resolveEpicTrek(db, exp, kingdom) {
  const events = [];
  const updates = {};
  const rewards = [];

  // Parse path hexes from extra_data
  const extraData = safeJsonParse(exp.extra_data || '{}', {}, 'epic-trek:extra_data');
  const pathHexes = extraData.path_hexes || [];

  if (pathHexes.length === 0) {
    return { events, updates, rewards };
  }

  // Reveal fog along path
  try {
    await updateKingdomVisibility(db, kingdom.id, (current) => {
      let newSeenCells = current.seenCells;

      for (const hex of pathHexes) {
        if (hex.col !== undefined && hex.row !== undefined) {
          try {
            const idx = cellIndex(hex.col, hex.row);
            newSeenCells |= BigInt(1) << BigInt(idx);
          } catch {
            // Invalid hex coordinates — skip silently
            devLog(`[epic-trek] Invalid hex coordinate: (${hex.col}, ${hex.row})`);
          }
        }
      }

      return {
        seenCells: newSeenCells,
        currentCells: current.currentCells,
        version: current.version,
      };
    });

    rewards.push({
      text: `Your explorers revealed ${pathHexes.length} hexes along the Epic Trek path.`,
    });
  } catch (err) {
    console.error(`[epic-trek] Fog reveal failed for kingdom ${kingdom.id}:`, err.message);
    rewards.push({
      text: `Epic Trek fog reveal encountered an error.`,
    });
  }

  // Kingdom/node discovery is NOT a roll: anything sitting on a hex whose fog
  // just got removed is found unconditionally, same as scout ring-reveal.
  // Resource nodes already work this way for free (the /world-map route
  // filters purely on seenCells, no reveal event needed); kingdoms need the
  // explicit check below since discovered_kingdoms is a persisted list.
  try {
    if (db && kingdom.id) {
      const kingdomDiscoveries = await checkFogDiscoveries(db, kingdom.id);
      for (const d of kingdomDiscoveries) {
        if (d.message) rewards.push({ text: d.message });
      }
    }
  } catch (err) {
    console.error(`[epic-trek] Kingdom fog-discovery check failed for kingdom ${kingdom.id}:`, err.message);
  }

  // Dungeon/mountain hex on path unlocks that region's location — checked
  // against every region, not just the traveler's own (region-specific
  // rewards mean any region's dungeon/mountain is worth finding).
  try {
    const onPath = findRegionalLocationsOnPath(pathHexes, getAllLocations, pixelToHex);
    for (const { type: locType, location } of onPath) {
      if (isPubliclyDiscovered(location)) continue;
      await markLocationDiscovered(db, location.id, kingdom.id);
      const turnColumn = locType === 'dungeon' ? 'first_dungeon_found_turn' : 'first_mountain_found_turn';
      await db.run(
        `UPDATE kingdoms SET ${turnColumn} = $1 WHERE race = $2 AND ${turnColumn} IS NULL`,
        [kingdom.turn || 0, location.region_name],
      );
      // location.region_name is the internal race key (e.g. "dark_elf",
      // "high_elf") — there's no server-side race display-name table
      // (RACE_NAMES is referenced in game/constants-schema.js but never
      // actually defined), so humanize it generically rather than leaking
      // the raw snake_case key into player-facing text.
      const raceLabel = location.region_name
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      rewards.push({
        text: `Your explorers uncovered the ${raceLabel} ${locType}!`,
      });
    }
  } catch (locErr) {
    console.error(`[epic-trek] Regional location check failed:`, locErr.message);
  }

  // Small junk-focused finds no longer roll here — they now happen turn-by-turn
  // while the expedition is actually traveling (resolveExpeditions' tick loop),
  // named and surfaced to the log as each one occurs instead of being
  // batch-simulated and dumped as a single count on arrival.

  // The bigger, end-of-trek prize: real resources/maps/troops/artifacts
  // rolled per hex crossed and delivered as one batch on arrival — a richer
  // tier than the per-turn junk finds above.
  try {
    const discoveries = processPathDiscoveries(pathHexes, kingdom);
    if (discoveries && discoveries.length > 0) {
      const lootResult = applyLootDiscoveries({ ...kingdom, ...updates }, discoveries);
      Object.assign(updates, lootResult.updates);
      for (const r of lootResult.rewards) {
        rewards.push(r);
      }
    }
  } catch (err) {
    console.error(`[epic-trek] Path-loot processing failed for kingdom ${kingdom.id}:`, err.message);
  }

  return { events, updates, rewards };
}

// Shared by resolveExpeditions' tick loop (mid-journey finds) and its
// completion loop (final rewards) — whichever kingdom columns a reward is
// allowed to write. "stone" was missing here despite junkPrize()'s 100th
// suspicious-rock achievement granting +1000 stone: the bonus event still
// fired, but the actual stone was silently filtered out and never applied.
const EXPEDITION_VALID_KINGDOM_COLS = new Set([
  "gold",
  "mana",
  "land",
  "population",
  "happiness",
  "food",
  "fighters",
  "rangers",
  "clerics",
  "mages",
  "thieves",
  "ninjas",
  "researchers",
  "engineers",
  "war_machines",
  "weapons_stockpile",
  "armor_stockpile",
  "res_economy",
  "res_weapons",
  "res_armor",
  "res_military",
  "res_attack_magic",
  "res_defense_magic",
  "res_entertainment",
  "res_construction",
  "res_war_machines",
  "res_spellbook",
  "bld_farms",
  "bld_barracks",
  "bld_markets",
  "bld_mage_towers",
  "blueprints_stored",
  "certified_blueprints_stored",
  "maps",
  "troop_levels",
  "xp",
  "level",
  "xp_sources",
  "discovered_kingdoms",
  "world_fragments",
  "collected_events",
  "last_event_id",
  "achievements",
  "items",
  "stone",
  // Forge system (A6) — lava-draw resolution writes these
  "lava_stored",
  "engineer_level",
  "engineer_xp",
  "flux_barges",
]);

// Mid-journey find chance per real turn tick, for expedition types where
// travel takes real time. Rolled once per tick in the loop below instead of
// being batch-simulated at completion — the player sees each find (and its
// actual item name) as it happens, not all at once dumped on arrival.
// mountain's rate is much lower than its old batch-simulated 60%/turn (which
// only worked because it was invisible math collapsed into one count on
// arrival — surfaced individually that would be ~60 log entries per trip);
// epic-trek and lava-draw keep roughly their old per-turn/per-hex odds.
const MID_TRAVEL_FIND_CONFIG = {
  mountain: { icon: "🏔️", title: "Mountain expedition", chance: 0.05 },
  "epic-trek": { icon: "🛤️", title: "Epic Trek", chance: 0.3 },
  "lava-draw": { icon: "🌋", title: "Lava draw", chance: 0.08 },
};

async function resolveExpeditions(db, k, deps = {}) {
  const io = deps && deps.io ? deps.io : null;
  // Pick up active ones AND unclaimed ones (turns_left=0 but rewards_claimed=0)
  const exps = await db.all(
    "SELECT * FROM expeditions WHERE kingdom_id = $1 AND (turns_left > 0 OR (turns_left = 0 AND rewards_claimed = 0))",
    [k.id],
  );
  devLog(
    `[expedition] kingdom=${k.id} active/unclaimed: ${exps.map((e) => `${e.type}(${e.turns_left}t, claimed=${e.rewards_claimed})`).join(", ") || "none"}`,
  );

  // Fetch fresh kingdom state once instead of once per expedition to prevent data corruption.
  // Rationale: processTurn returns an updates object but doesn't mutate the original kingdom in-place.
  // If we use the pre-fetched kingdom without merging all updates, resolveExpeditions will use stale
  // values when calculating XP/rewards and silently corrupt the database with outdated data.
  const freshK = (await db.get("SELECT * FROM kingdoms WHERE id = $1", [k.id])) || k;

  const expeditionEvents = [];

  // ── BATCH PROCESSING: Collect updates before executing ──────────────────────────
  // This reduces database round-trips from O(exps*turns) to O(turns)
  const tickDowns = [];  // { id, newTurns }
  const completions = []; // ids that complete this turn
  const retries = [];     // ids already completed, retrying claim
  const expsByState = {}; // track by id for later reward processing

  for (const exp of exps) {
    if (exp.turns_left > 0) {
      const direWolfBonus = racialUnitBonus(freshK, "rangers");
      const tickDown = direWolfBonus.earlyReturn ? 2 : 1;
      const newTurns = Math.max(0, exp.turns_left - tickDown);
      devLog(
        `[expedition] kingdom=${k.id} id=${exp.id} type=${exp.type} turns_left=${exp.turns_left} → ${newTurns}`,
      );

      if (newTurns > 0) {
        tickDowns.push({ id: exp.id, newTurns });
        expsByState[exp.id] = { ...exp, turns_left: newTurns, mustProcess: false };

        const findCfg = MID_TRAVEL_FIND_CONFIG[exp.type];
        if (findCfg && roll(findCfg.chance)) {
          const findUpdates = {};
          const found = junkPrize(freshK, findUpdates);
          // Keep in-memory freshK current so a second expedition (or a second
          // roll later this same call) sees this item already in inventory,
          // rather than each write clobbering the last.
          Object.assign(freshK, findUpdates);
          const safeFindUpdates = Object.fromEntries(
            Object.entries(findUpdates).filter(
              ([col, v]) => EXPEDITION_VALID_KINGDOM_COLS.has(col) && v !== undefined && v !== null,
            ),
          );
          if (Object.keys(safeFindUpdates).length > 0) {
            const cols = Object.keys(safeFindUpdates);
            const { setClause, nextPlaceholder } = pgSetClauseWithNextPlaceholder(cols);
            await db.run(`UPDATE kingdoms SET ${setClause} WHERE id = ${nextPlaceholder}`, [
              ...Object.values(safeFindUpdates),
              k.id,
            ]);
          }
          expeditionEvents.push({
            type: "system",
            message: `${findCfg.icon} ${findCfg.title}: your crew found ${found}`,
            skipNews: true,
            expeditionLogEntry: {
              icon: findCfg.icon,
              title: findCfg.title,
              subtitle: `Found: ${found}`,
            },
          });
        }
      } else {
        completions.push(exp.id);
        expsByState[exp.id] = { ...exp, turns_left: 0, mustProcess: true };
        devLog(`[expedition] COMPLETING kingdom=${k.id} id=${exp.id} type=${exp.type}`);
      }
    } else {
      retries.push(exp.id);
      expsByState[exp.id] = { ...exp, mustProcess: true };
      devLog(`[expedition] RETRYING completion for kingdom=${k.id} id=${exp.id} type=${exp.type}`);
    }
  }

  // ── Execute batched updates ──────────────────────────────────────────────────────

  // Batch update: ALL tick-downs in ONE statement using CASE/WHEN
  if (tickDowns.length > 0) {
    const ids = tickDowns.map(t => t.id);
    const caseWhen = tickDowns
      .map(({ id, newTurns }) => `WHEN ${id} THEN ${newTurns}`)
      .join(" ");
    const updateSql = `UPDATE expeditions SET turns_left = CASE id ${caseWhen} END WHERE id = ANY($1)`;
    const result = await db.run(updateSql, [ids]);
    devLog(`[expedition] Batched ${result.changes} turn decrements in single UPDATE`);
  }

  // Batch update: all completions in one statement
  if (completions.length > 0) {
    const markResult = await db.run(
      `UPDATE expeditions SET turns_left = 0, rewards_claimed = 1, completed_at = FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER WHERE id IN (${pgInList(completions.length)}) AND rewards_claimed = 0`,
      completions,
    );
    devLog(`[expedition] Batched completion claim: ${markResult.changes} expeditions marked complete`);
  }

  // Batch update: all retry claims in one statement. COALESCE so a retry
  // (turns_left already 0 from an earlier attempt) doesn't overwrite the
  // real completion time with "now".
  if (retries.length > 0) {
    const claimResult = await db.run(
      `UPDATE expeditions SET rewards_claimed = 1, completed_at = COALESCE(completed_at, FLOOR(EXTRACT(EPOCH FROM NOW()))::INTEGER) WHERE id IN (${pgInList(retries.length)}) AND rewards_claimed = 0`,
      retries,
    );
    devLog(`[expedition] Batched retry claim: ${claimResult.changes} expeditions claimed`);
  }

  // ── Process reward claims for expeditions that completed ─────────────────────────
  for (const exp of exps) {
    const expState = expsByState[exp.id];
    if (!expState || !expState.mustProcess) continue;

    try {
      // Use pre-fetched kingdom state to avoid stale merged values.
      // Prospecting sends engineers, not rangers — the expeditions row
      // stores the sent count in `engineers` (rangers=0, see
      // routes/kingdom-exploration.js), but expeditionRewards()'s
      // attrition/return math (which gameplay.js's "prospecting redirects
      // returned troops from rangers to engineers" logic depends on) reads
      // its `rangers` argument. Passing exp.rangers (always 0 here) meant
      // that redirect always computed 0 returned engineers — the sent
      // engineers were never credited back on completion.
      const sentTroops = exp.type === 'prospecting' ? exp.engineers : exp.rangers;
      const { rewards, updates, events } = expeditionRewards(
        exp.type,
        sentTroops,
        exp.fighters,
        freshK,
        db,
        exp.rewards,
      );

      // Dungeon/mountain expeditions carry their launch-time distance/turn
      // cost in extra_data (routes/kingdom-exploration.js) — surface it as
      // the first reward line so arrival still reports what the old
      // instant-resolve flow's top-level message used to.
      if (exp.type === 'dungeon' || exp.type === 'mountain') {
        const locData = safeJsonParse(exp.extra_data, {}, 'expedition:location-distance');
        if (typeof locData.distance === 'number') {
          rewards.unshift({
            text: `Location found at distance ${locData.distance.toFixed(1)} hexes. ${locData.turnCost || '?'} turns spent exploring.`,
          });
        }
      }

      // ── Epic Trek: Reveal fog along path and process discoveries ──────────
      if (exp.type === 'epic-trek') {
        try {
          const epicTrekResult = await resolveEpicTrek(db, exp, freshK);
          if (epicTrekResult && epicTrekResult.events) {
            events.push(...epicTrekResult.events);
          }
          if (epicTrekResult && epicTrekResult.updates) {
            Object.assign(updates, epicTrekResult.updates);
          }
          if (epicTrekResult && epicTrekResult.rewards) {
            rewards.push(...epicTrekResult.rewards);
          }
        } catch (err) {
          console.error(`[epic-trek] Resolution error for kingdom ${k.id} id=${exp.id}:`, err.message);
          events.push({
            type: 'system',
            message: `Epic Trek returned -- an error occurred processing discoveries (fog reveal may be incomplete).`,
          });
        }
      }

      // ── Lava draw: arrival race, draw or empty-handed, crew return (A6) ──────
      if (exp.type === 'lava-draw') {
        try {
          const lavaResult = await resolveLavaDraw(db, exp, freshK);
          if (lavaResult && lavaResult.events) events.push(...lavaResult.events);
          if (lavaResult && lavaResult.updates) Object.assign(updates, lavaResult.updates);
          if (lavaResult && lavaResult.rewards) rewards.push(...lavaResult.rewards);
        } catch (err) {
          console.error(`[lava-draw] Resolution error for kingdom ${k.id} id=${exp.id}:`, err.message);
          events.push({
            type: 'system',
            message: `Lava draw returned -- an error occurred processing the result.`,
          });
        }
      }

      // ── Throne of Nazdreg check ──────────────────────────────────────────────
      if (updates._check_throne) {
        delete updates._check_throne;
        // Atomic claim: a single conditional insert decides the winner. The row
        // count tells us whether THIS expedition seized the unique drop. This
        // closes the read-then-write race where two kingdoms finishing in the
        // same tick could both observe the throne as unclaimed across the await
        // boundary and each award it.
        const claim = await db.run(
          "INSERT INTO server_state (key, value) VALUES ('throne_found', '1') ON CONFLICT (key) DO NOTHING",
        );
        if (claim && claim.changes === 1) {
          THRONE_OF_NAZDREG.effect(freshK, updates);
          rewards.unshift({ text: THRONE_OF_NAZDREG.text });
          events.push({
            type: "system",
            message: `${freshK.name} has found the Throne of Nazdreg Grishnak. May his memory endure forever.`,
          });
          updates._server_announce = `?? The Throne of Nazdreg Grishnak has been found by ${freshK.name}. His name is remembered.`;
        }
      }

      if (updates._find_kingdom) {
        delete updates._find_kingdom;
        const other = await getRandomKingdom(db, freshK.id);
        const merged = mergeKingdomDiscovery(
          { ...freshK, ...updates },
          updates,
          other,
          { source: 'expedition' },
        );
        if (merged.applied) {
          updates.discovered_kingdoms = merged.discovered_kingdoms;
          rewards.push({ text: merged.message });
        }
      }

      if (updates._find_world_fragment) {
        delete updates._find_world_fragment;
        let frags = [];
        try {
          frags = safeJsonParse(freshK.world_fragments, [], "auto:world_fragments");
        } catch {}
        const frag =
          WORLD_FRAGMENTS[Math.floor(Math.random() * WORLD_FRAGMENTS.length)];
        frags.push(frag);
        updates.world_fragments = safeJsonStringify(frags);
        rewards.push({
          text: `Your rangers recovered a World Fragment: ${frag}`,
        });
        events.push({
          type: "system",
          message: `A World Fragment (${frag}) was discovered during the expedition.`,
        });
      }

      if (updates._suspicious_rocks_achievement) {
        delete updates._suspicious_rocks_achievement;
        rewards.unshift({
          text: `ACHIEVEMENT UNLOCKED: Found 100 mysterious rocks! +1000 stone awarded.`,
        });
        events.push({
          type: "system",
          message: `ACHIEVEMENT: ${freshK.name} collected 100 mysterious rocks and was rewarded with 1000 stone!`,
        });
      }

      const serverAnnounce = updates._server_announce || null;
      delete updates._server_announce;
      delete updates._ultra_rare;

      // Every type resolveExpeditions can actually complete needs an entry
      // here — a miss silently produced "undefined expedition returned..."
      // (hunting/prospecting/land_expansion/epic-trek/lava-draw were missing).
      // The `|| exp.type` fallback means a future type can no longer produce
      // that "undefined" text even if someone forgets to add it here.
      const label = {
        scout: "🔭 Scout",
        deep: "🌲 Deep",
        dungeon: "⚔️ Dungeon",
        mountain: "🏔️ Mountain",
        hunting: "🥩 Hunting",
        prospecting: "⛏️ Prospecting",
        land_expansion: "🗺️ Land Expansion",
        "epic-trek": "🛤️ Epic Trek",
        "lava-draw": "🌋 Lava Draw",
      }[exp.type] || exp.type;

      // Apply kingdom updates
      const rangersReturned =
        updates._rangers_returned !== undefined ? updates._rangers_returned : 0;
      const fightersReturned =
        updates._fighters_returned !== undefined
          ? updates._fighters_returned
          : 0;
      delete updates._rangers_returned;
      delete updates._fighters_returned;

      // Award XP
      const expXpAmount = { scout: 8, deep: 20, dungeon: 40, mountain: 100 }[exp.type] || 8;
      const rXp = awardTroopXp(freshK, "rangers", expXpAmount * exp.rangers);
      updates.troop_levels = rXp.troop_levels;
      if (exp.type === "dungeon" && exp.fighters > 0) {
        const fXp = awardTroopXp(
          { ...freshK, troop_levels: updates.troop_levels },
          "fighters",
          40 * exp.fighters,
        );
        updates.troop_levels = fXp.troop_levels;
      }

      // Award kingdom-level exploration XP (divide by XP_BASE.exploration=5 to get final amounts matching stated values)
      const kingdomXpBase = { scout: 1, deep: 4, dungeon: 8, mountain: 20 }[exp.type] || 1;
      const kingdomXp = awardXp(freshK, "exploration", kingdomXpBase * (exp.rangers + (exp.fighters || 0)));
      updates.xp = kingdomXp.xp;
      updates.level = kingdomXp.level;
      updates.xp_sources = safeJsonStringify(kingdomXp.xp_sources);
      if (kingdomXp.events.length > 0) {
        events.push(...kingdomXp.events);
      }

      if (updates._achievement_unlocked) {
        rewards.push({
          text: "ACHIEVEMENT UNLOCKED: " + updates._achievement_unlocked,
        });
        events.push({
          type: "system",
          message: "ACHIEVEMENT UNLOCKED: " + updates._achievement_unlocked,
        });
        delete updates._achievement_unlocked;
      }

      // Field Collector's _reveal_all_locations flag is handled centrally
      // in routes/kingdom-turn.js's commitTurnResults — checkAchievements()
      // (game/lib/achievements.js) only ever runs against the main per-turn
      // updates object (turn-finalize.js), never this expedition-specific
      // one, so handling it here was dead code that also targeted the
      // wrong field (discovered_kingdoms._all_revealed, which nothing else
      // ever read).

      const safeUpdates = Object.fromEntries(
        Object.entries(updates).filter(
          ([k2, v]) =>
            EXPEDITION_VALID_KINGDOM_COLS.has(k2) && v !== undefined && v !== null,
        ),
      );
      if (Object.keys(safeUpdates).length > 0) {
        const cols = Object.keys(safeUpdates);
        const { setClause, nextPlaceholder } = pgSetClauseWithNextPlaceholder(cols);
        await db.run(`UPDATE kingdoms SET ${setClause} WHERE id = ${nextPlaceholder}`, [
          ...Object.values(safeUpdates),
          k.id,
        ]);
        // Update in-memory freshK so next expedition sees the changes
        Object.assign(freshK, safeUpdates);
      }
      if (rangersReturned > 0)
        await db.run(
          "UPDATE kingdoms SET rangers  = rangers  + $1 WHERE id = $2",
          [rangersReturned, k.id],
        );
      if (fightersReturned > 0)
        await db.run(
          "UPDATE kingdoms SET fighters = fighters + $1 WHERE id = $2",
          [fightersReturned, k.id],
        );

      // Update in-memory freshK for returned units
      if (rangersReturned > 0) freshK.rangers = (freshK.rangers || 0) + rangersReturned;
      if (fightersReturned > 0) freshK.fighters = (freshK.fighters || 0) + fightersReturned;

      // ONE news line only — rewards go to expedition log, not news feed
      const completionMsg = `${label} expedition returned -- check the Explore tab for rewards.`;
      expeditionEvents.push({ type: "system", message: completionMsg });

      // Notable events accumulated above (achievement unlocks, world-fragment
      // finds, Throne of Nazdreg, level-ups) were previously built into
      // `events` but never forwarded anywhere — computed, then silently
      // discarded every time. Forward them now so their toast/sound actually
      // fires instead of the player only finding out via the expedition log.
      if (events.length > 0) {
        expeditionEvents.push(...events);
      }

      // Throne broadcast only (batch inserts to prevent memory spike)
      if (serverAnnounce) {
        const BATCH_SIZE = 1000;
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const batch = await db.all("SELECT id FROM kingdoms LIMIT $1 OFFSET $2", [BATCH_SIZE, offset]);
          if (batch.length === 0) {
            hasMore = false;
            break;
          }
          const placeholders = batch.map((_, i) => `($${i + 1},'system',$${batch.length + 1},$${batch.length + 2})`).join(',');
          const values = [...batch.map(ak => ak.id), serverAnnounce, k.turn];
          await db.run(
            `INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ${placeholders}`,
            values,
          );
          offset += BATCH_SIZE;
        }
        if (io) {
          safeEmit(io, "chat:system", {
            message: serverAnnounce,
            ts: Date.now(),
          });
        }
      }

      // Save rewards to expedition row for log display
      const rewardJson = safeJsonStringify(rewards.map((r) => r.text));
      await db.run("UPDATE expeditions SET rewards = $1 WHERE id = $2", [
        rewardJson,
        exp.id,
      ]);
      console.log(
        `[expedition] completed kingdom=${k.id} type=${exp.type} rewards=${rewards.length}`,
      );
    } catch (err) {
      // Rewards failed — expedition is already marked complete (turns_left=0), troops return, no reward
      console.error(
        `[expedition] reward error kingdom=${k.id} id=${exp.id} type=${exp.type}:`,
        err.message,
        err.stack,
      );
      // Still return troops so they're not lost
      await db.run("UPDATE kingdoms SET rangers = rangers + $1 WHERE id = $2", [
        exp.rangers,
        k.id,
      ]);
      if (exp.fighters > 0)
        await db.run(
          "UPDATE kingdoms SET fighters = fighters + $1 WHERE id = $2",
          [exp.fighters, k.id],
        );
      const errMsg = `${exp.type} expedition returned -- an error occurred calculating rewards (troops returned safely).`;
      await db.run("UPDATE expeditions SET rewards = $1 WHERE id = $2", [
        safeJsonStringify([errMsg]),
        exp.id,
      ]);
      await db.run(
        "INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1, $2, $3, $4)",
        [k.id, "system", errMsg, k.turn],
      );
      expeditionEvents.push({ type: "system", message: errMsg });
    }
  }
  return expeditionEvents;
}

// Turn-based node harvesting (replaces the old real-time resource_expeditions
// flow): each row's turns_left covers travel there+back plus the chosen
// harvest duration, ticking down by 1 per turn. Deliberately isolated from
// resolveExpeditions/expeditionRewards above -- those are built around
// rangers/fighters (attrition, troop XP, forage-rate formulas), none of
// which apply to an engineer-based harvesting party.
// yield = engineers * (richness / 100) * harvestTurns * this. richness is
// stored on a 0-100 scale: regular world-seeded nodes are randomized 25-100
// (game/world-initialization.js), while the guaranteed first-ring node
// (game/first-ring-node.js) is deliberately low (4) since it's meant as an
// easy, modest early find rather than a full-value node.
const HARVEST_YIELD_RATE = 0.1;
async function resolveResourceHarvests(db, k) {
  const events = [];
  const harvests = await db.all(
    "SELECT * FROM resource_harvests WHERE kingdom_id = $1 AND turns_left > 0",
    [k.id],
  );

  for (const h of harvests) {
    const newTurnsLeft = Math.max(0, h.turns_left - 1);
    if (newTurnsLeft > 0) {
      await db.run("UPDATE resource_harvests SET turns_left = $1 WHERE id = $2", [newTurnsLeft, h.id]);
      continue;
    }

    const yieldAmount = Math.round(h.engineers_sent * (h.richness / 100) * h.harvest_turns * HARVEST_YIELD_RATE);
    const col = ["wood", "stone", "iron", "gold"].includes(h.resource_type) ? h.resource_type : "wood";

    await db.run(
      `UPDATE kingdoms SET ${col} = ${col} + $1, engineers = engineers + $2 WHERE id = $3`,
      [yieldAmount, h.engineers_sent, k.id],
    );
    await db.run(
      "UPDATE resource_harvests SET turns_left = 0, yield_amount = $1, rewards_claimed = 1 WHERE id = $2",
      [yieldAmount, h.id],
    );

    events.push({
      type: "system",
      message: `Harvesting party returned from a node with ${yieldAmount.toLocaleString()} ${h.resource_type}.`,
    });
  }

  return events;
}

module.exports = {
  resolveEpicTrek,
  resolveExpeditions,
  resolveResourceHarvests,
  EXPEDITION_VALID_KINGDOM_COLS,
  MID_TRAVEL_FIND_CONFIG,
  HARVEST_YIELD_RATE,
};
