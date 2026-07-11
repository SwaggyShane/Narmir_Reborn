const express = require('express');
const { requireAuth, requireCsrfToken } = require('./middleware');
const { safeJsonParse, devLog } = require('../utils/helpers');
const { validateResearchAmount, validateAllocationObject } = require('../utils/numeric-validation');
const { applyKingdomUpdates } = require('../db/schema');
const engine = require('../game/engine');
const { loadTradeRoutes } = require('../game/engine');
const config = require('../game/config');
const { decorateNewsMessage } = require('../game/news-emoji');
const { pgValueTuples } = require('../lib/pg-placeholders');
const { structureUpdates } = require('./response-structurer');

const router = express.Router();

// Shared helper function
async function applyUpdates(db, kingdomId, updates) {
  for (const [key, value] of Object.entries(updates)) {
    if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) {
      console.error(`[applyUpdates] NaN/Infinity detected in field: ${key} = ${value}`);
      throw new Error(`Corrupted numeric data: ${key} contains NaN or Infinity`);
    }
  }

  const updatesForDb = { ...updates };
  if (updatesForDb.research_allocation && typeof updatesForDb.research_allocation === 'object') {
    updatesForDb.research_allocation = JSON.stringify(updatesForDb.research_allocation);
  }
  if (updatesForDb.mage_tower_allocation && typeof updatesForDb.mage_tower_allocation === 'object') {
    updatesForDb.mage_tower_allocation = JSON.stringify(updatesForDb.mage_tower_allocation);
  }
  if (updatesForDb.shrine_allocation && typeof updatesForDb.shrine_allocation === 'object') {
    updatesForDb.shrine_allocation = JSON.stringify(updatesForDb.shrine_allocation);
  }
  if (updatesForDb.library_allocation && typeof updatesForDb.library_allocation === 'object') {
    updatesForDb.library_allocation = JSON.stringify(updatesForDb.library_allocation);
  }

  await applyKingdomUpdates(kingdomId, updatesForDb);
}

// Mojibake repair for malformed unicode in old data
const MOJIBAKE_SIGNATURE = /[ÃÂâïðÅ�]/;

function repairMojibake(value) {
  if (value === null || value === undefined) return value;
  let text = String(value);
  if (!MOJIBAKE_SIGNATURE.test(text)) return text;
  for (let i = 0; i < 20; i++) {
    if (!MOJIBAKE_SIGNATURE.test(text)) break;
    let next;
    try {
      next = Buffer.from(text, "latin1").toString("utf8");
    } catch {
      break;
    }
    if (next === text) break;
    text = next;
  }
  text = text
    .replace(/Â/g, "")
    .replace(/â€”/g, "—")
    .replace(/â€“/g, "-")
    .replace(/â€¢/g, "•")
    .replace(/â€˜|â€™/g, "’")
    .replace(/â€œ/g, "“");
  return text;
}

async function bulkInsertNews(db, rows) {
  if (!rows || rows.length === 0) return;
  const placeholders = pgValueTuples(rows.length, 4);
  const values = rows.flatMap((r) => [
    r.kingdom_id,
    r.type || "system",
    decorateNewsMessage(r.message, repairMojibake),
    r.turn_num || 0,
  ]);
  await db.run(
    `INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ${placeholders}`,
    values,
  );
}

module.exports = function (db) {
  router.post("/research-allocation", requireAuth, requireCsrfToken, async (req, res) => {
    const { allocation } = req.body;

    // Validate allocation using utility (whitelist valid research types, max 10k total)
    const validKeys = ['spellbook', 'school_spellbook'];
    const allocValidation = validateAllocationObject(allocation, {
      validKeys,
      maxPerItem: 10000,
      maxTotal: 10000,
      fieldName: 'allocation',
    });
    if (!allocValidation.valid) {
      return res.status(400).json({ error: allocValidation.error });
    }

    const k = await db.get("SELECT id FROM kingdoms WHERE player_id = $1", [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: "Kingdom not found" });

    await db.run("UPDATE kingdoms SET research_allocation = $1 WHERE id = $2", [
      JSON.stringify(allocValidation.values),
      k.id,
    ]);
    res.json({ ok: true });
  });

  router.post("/research", requireAuth, requireCsrfToken, async (req, res) => {
    const { discipline, researchers } = req.body;

    // Validate researcher amount
    const researchValidation = validateResearchAmount(researchers, { fieldName: 'researchers' });
    if (!researchValidation.valid) {
      return res.status(400).json({ error: researchValidation.error });
    }

    try {
      // Wrap in transaction with row-level lock to prevent concurrent conflicts (using db.withTransaction)
      const { finalUpdates, events: finalEvents, increment } = await db.withTransaction(async () => {
        const k = await db.get("SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE", [
          req.player.playerId,
        ]);
        if (!k) {
          const err = new Error("Kingdom not found");
          err.statusCode = 404;
          throw err;
        }
        if (k.turns_stored < 1) {
          const err = new Error("No turns available");
          err.statusCode = 429;
          throw err;
        }

      // Run full turn first
      await loadTradeRoutes(k);
      const { updates: turnUpdates, events } = engine.processTurn(k);
      turnUpdates.turns_stored = k.turns_stored - 1;

      // Apply research on top of turn state
      const kAfterTurn = { ...k, ...turnUpdates };
      const resResult = engine.studyDiscipline(
        kAfterTurn,
        discipline,
        researchValidation.value,
      );
      if (resResult.error) {
        const err = new Error(resResult.error);
        err.statusCode = 400;
        throw err;
      }

      const finalUpdates = { ...turnUpdates, ...resResult.updates };
      await applyUpdates(db, k.id, finalUpdates);

      const resCol = Object.keys(resResult.updates).find((k) =>
        k.startsWith("res_"),
      );
      const newVal = resCol ? finalUpdates[resCol] : "?";
      events.push({
        type: "system",
        message: `📚 Studied ${discipline} with ${Number(researchers).toLocaleString()} researchers - +${resResult.increment} -> now ${newVal}${discipline !== "spellbook" ? "%" : ""}.`,
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

      return { finalUpdates, events, increment: resResult.increment };
    });

      res.json({
        ok: true,
        increment,
        updates: finalUpdates,
        events: finalEvents,
        turns_stored: finalUpdates.turns_stored,
      });
    } catch (err) {
      console.error("[research] error:", err.message);
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({ error: err.message || "Research processing failed — please try again" });
    }
  });


  router.post("/research-focus", requireAuth, requireCsrfToken, async (req, res) => {
    const { focus } = req.body; // array of 1-2 discipline keys
    const k = await db.get("SELECT id, school_upgrades FROM kingdoms WHERE player_id = $1", [
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
    await db.run("UPDATE kingdoms SET research_focus = $1 WHERE id = $2", [
      JSON.stringify(cleaned),
      k.id,
    ]);
    res.json({ ok: true, research_focus: cleaned });
  });

  router.get("/studies/overview", requireAuth, async (req, res) => {
    const k = await db.get(
      `SELECT id, race, region, prestige_level, alliance_buffs, mages, scribes, researchers, bld_libraries, bld_shrines,
              bld_mausoleums, bld_mage_towers, bld_schools, bld_taverns,
              research_focus, research_allocation, training_allocation,
              mage_tower_allocation, shrine_allocation, library_allocation,
              mausoleum_allocation, tower_upgrades, school_upgrades, shrine_upgrades,
              library_upgrades, mausoleum_upgrades, scrolls, library_progress,
              tower_progress, res_economy, res_weapons, res_armor, res_military,
              res_attack_magic, res_defense_magic, res_entertainment, res_construction,
              res_war_machines, res_spellbook, school_of_magic, school_spellbook,
              divine_sanctuary_used, fragment_bonuses
       FROM kingdoms WHERE player_id = $1`,
      [req.player.playerId]
    );
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
    // Regular spellbook spells with rune encoding
    const regularSpells = [
      'spark', 'fog_of_war', 'mend', 'blight', 'rain', 'dispel',
      'lightning', 'bless', 'silence', 'amnesia', 'drain',
      'plague', 'earthquake', 'tempest', 'shield', 'armageddon'
    ];
    const spellbookSpells = regularSpells.map(name => {
      const def = config.SPELL_DEFS[name] || {};
      const displayName = name.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const minLevel = def.minSB || 0;
      const maxLevel = (regularSpells.indexOf(name) < regularSpells.length - 1)
        ? (config.SPELL_DEFS[regularSpells[regularSpells.indexOf(name) + 1]]?.minSB || minLevel + 100)
        : minLevel + 100;

      const reveals = config.calculateRuneReveals(displayName, k.res_spellbook || 0, minLevel, maxLevel);
      const runeDisplay = config.getPartialRuneSpell(displayName, reveals);

      return {
        id: name,
        name: displayName,
        tier: def.tier || 1,
        min_spellbook: minLevel,
        desc: def.desc || 'Unknown spell',
        runeDisplay: runeDisplay,
        reveals: reveals,
      };
    }).sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return a.min_spellbook - b.min_spellbook;
    });

    let schoolSpells = null;
    if (k.school_of_magic && config.MAGIC_SCHOOLS[k.school_of_magic]) {
      const spellNames = config.MAGIC_SCHOOLS[k.school_of_magic];
      schoolSpells = spellNames.map(name => {
        const def = config.SPELL_DEFS[name] || {};
        const displayName = name.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const minLevel = def.minSB || 0;
        const maxLevel = minLevel + 100;

        const reveals = config.calculateRuneReveals(displayName, k.school_spellbook || 0, minLevel, maxLevel);
        const runeDisplay = config.getPartialRuneSpell(displayName, reveals);

        return {
          id: name,
          name: displayName,
          tier: def.tier || 1,
          min_school_spellbook: minLevel,
          desc: def.desc || 'Unknown spell',
          runeDisplay: runeDisplay,
          reveals: reveals,
        };
      }).sort((a, b) => {
        if (a.tier !== b.tier) return a.tier - b.tier;
        return a.min_school_spellbook - b.min_school_spellbook;
      });
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
      res_spellbook: k.res_spellbook || 0,
      school_spellbook: k.school_spellbook || 0,
      school_of_magic: k.school_of_magic || null,
      school_lore: k.school_of_magic ? config.SCHOOL_LORE[k.school_of_magic] : null,
      spellbook_spells: spellbookSpells,
      school_spells: schoolSpells,
    });
  });

  router.post("/select-school", requireAuth, requireCsrfToken, async (req, res) => {
    devLog('[select-school] Request received', { playerId: req.player?.playerId, school: req.body?.school });
    try {
      const { school } = req.body;
      if (!school?.trim()) return res.status(400).json({ error: 'School name required' });

      const result = await db.withTransaction(async () => {
        const kingdom = await db.get('SELECT * FROM kingdoms WHERE player_id = $1 FOR UPDATE', [req.player.playerId]);
        if (!kingdom) {
          throw new Error('Kingdom not found');
        }

        const result = engine.selectSchool(kingdom, school.trim().toLowerCase());
        if (result.error) {
          const error = new Error(result.error);
          error.statusCode = 400;
          throw error;
        }

        await db.run(
          'UPDATE kingdoms SET school_of_magic = $1, school_spellbook = $2 WHERE id = $3',
          [result.updates.school_of_magic, result.updates.school_spellbook, kingdom.id]
        );

        if (result.events && result.events.length > 0) {
          await db.run(
            'INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1, $2, $3, $4)',
            [kingdom.id, result.events[0].type || 'system', result.events[0].message, kingdom.turn]
          );
        }

        return result;
      });

      res.json({ ok: true, school: result.updates.school_of_magic, events: result.events, updates: structureUpdates(result.updates) });
    } catch (e) {
      if (e.message.includes('Kingdom not found')) {
        return res.status(404).json({ error: e.message });
      }
      if (e.statusCode === 400) {
        return res.status(400).json({ error: e.message });
      }
      if (!res.headersSent) {
        res.status(500).json({ error: e.message });
      }
    }
  });


  return router;
};
