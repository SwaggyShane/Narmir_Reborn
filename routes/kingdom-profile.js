const express = require('express');
const { requireAuth, requireCsrfToken } = require('./middleware');
const { safeJsonParse } = require('../utils/helpers');
const engine = require('../game/engine');
const config = require('../game/config');
const { rankingsCache } = require('../cache.js');

const JSON_FIELDS = {
  'research_allocation': {}, 'mage_tower_allocation': {}, 'shrine_allocation': {},
  'library_allocation': {}, 'library_progress': {}, 'tower_progress': {},
  'scrolls': {}, 'active_effects': {}, 'discovered_kingdoms': {},
  'build_queue': {}, 'build_progress': {}, 'build_allocation': {}, 'resource_build_allocation': {},
  'troop_levels': {}, 'training_allocation': {}, 'smithy_allocation': {},
  'racial_bonuses_unlocked': {}, 'active_event': {}, 'location_maps_wip': [],
  'wall_upgrades': {}, 'tower_def_upgrades': {}, 'tower_upgrades': {},
  'school_upgrades': {}, 'shrine_upgrades': {}, 'library_upgrades': {},
  'farm_upgrades': {}, 'market_upgrades': {}, 'tavern_upgrades': {},
  'bank_upgrades': {}, 'bank_deposits': [], 'mausoleum_upgrades': {},
  'mausoleum_allocation': {}, 'ledger': [], 'mercenaries': [],
  'collected_lore': [], 'collected_events': [], 'achievements': [],
  'items': [], 'resource_sequence': {}, 'goals': {},
  'outpost_upgrades': {}, 'defense_upgrades': {}, 'granary_upgrades': {},
};

function parseKingdomJson(k) {
  for (const [field, defaultVal] of Object.entries(JSON_FIELDS)) {
    if (k[field] !== undefined && k[field] !== null) {
      k[field] = safeJsonParse(k[field], defaultVal, `me:${field}`);
    }
  }
  return k;
}

module.exports = function (db) {
  const router = express.Router();

  router.get('/me', requireAuth, async (req, res) => {
    const k = await db.get(
      'SELECT k.*, p.username, p.chat_name, p.chat_color FROM kingdoms k JOIN players p ON k.player_id = p.id WHERE k.player_id = $1',
      [req.player.playerId],
    );
    if (!k) return res.status(404).json({ error: 'Kingdom not found' });

    parseKingdomJson(k);

    k.score = engine.calculateScore(k);
    k.defense_rating = engine.defenseRating(k);

    let builtLand = 0;
    for (const [building, cost] of Object.entries(config.BUILDING_LAND_COST)) {
      const col = config.BUILDING_COL[building];
      if (col && k[col]) {
        builtLand += k[col] * cost;
      }
    }
    k.built_land = builtLand;

    res.json(k);
  });

  router.post('/description', requireAuth, requireCsrfToken, async (req, res) => {
    const { description } = req.body;
    if (description && typeof description !== 'string')
      return res.status(400).json({ error: 'Description must be a string' });
    if (description && description.length > 1000)
      return res
        .status(400)
        .json({ error: 'Description too long (max 1000 chars)' });
    const k = await db.get('SELECT id FROM kingdoms WHERE player_id = $1', [
      req.player.playerId,
    ]);
    if (!k) return res.status(404).json({ error: 'Kingdom not found' });
    await db.run('UPDATE kingdoms SET description = $1 WHERE id = $2', [
      description || null,
      k.id,
    ]);
    res.json({ ok: true });
  });

  router.get('/rankings', requireAuth, async (req, res) => {
    const pk = await db.get(
      'SELECT id, discovered_kingdoms FROM kingdoms WHERE player_id = $1',
      [req.player.playerId],
    );
    if (!pk) return res.status(404).json({ error: 'Kingdom not found' });

    let baseScored = rankingsCache.get('base_scored_top1000');
    if (!baseScored) {
      const rows = await db.all(`
        SELECT
          k.*,
          p.id as player_id,
          p.username,
          (
            SELECT MAX(created_at) FROM war_log
            WHERE attacker_id = k.id OR defender_id = k.id
            LIMIT 1
          ) as last_combat_at
        FROM kingdoms k
        JOIN players p ON k.player_id = p.id
        ORDER BY k.land DESC, k.population DESC
        LIMIT 1000
      `);
      for (const r of rows) {
        r.score = engine.calculateScore(r);
      }
      baseScored = rows;
      rankingsCache.set('base_scored_top1000', baseScored, 30 * 1000);
    }

    let disc = {};
    try {
      disc = safeJsonParse(pk.discovered_kingdoms, {}, 'auto:discovered_kingdoms');
    } catch {}

    const scoredRows = [...baseScored];
    const discoveredIds = new Set(Object.keys(disc).map(id => parseInt(id)));

    if (discoveredIds.size > 0) {
      const topIds = new Set(scoredRows.map(r => r.id));
      if (discoveredIds.size > topIds.size) {
        const missingIds = Array.from(discoveredIds).filter(id => !topIds.has(id));
        if (missingIds.length > 0) {
          const placeholders = missingIds.map((_, i) => `$${i + 1}`).join(',');
          const missingRows = await db.all(`
            SELECT k.*, p.id as player_id, p.username FROM kingdoms k
            JOIN players p ON k.player_id = p.id
            WHERE k.id IN (${placeholders})
          `, missingIds);
          for (let r of missingRows) {
            r.score = engine.calculateScore(r);
            scoredRows.push(r);
          }
        }
      }
    }

    scoredRows.sort((a, b) => b.score - a.score);

    const rankings = scoredRows
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
        score: r.score,
        rank: i + 1,
        last_combat_at: r.last_combat_at,
      }));

    res.json({ rankings });
  });

  router.get('/alliance-rankings', requireAuth, async (req, res) => {
    try {
      const allianceNames = await db.all(`SELECT id, name FROM alliances`);
      const memberRows = await db.all(`
        SELECT k.*, a.id as alliance_id
        FROM alliances a
        JOIN alliance_members am ON a.id = am.alliance_id
        JOIN kingdoms k ON am.kingdom_id = k.id
      `);

      const allianceMap = {};
      for (const alliance of allianceNames) {
        allianceMap[alliance.id] = {
          id: alliance.id,
          name: alliance.name,
          member_count: 0,
          total_land: 0,
          total_pop: 0,
          total_score: 0,
        };
      }

      for (const k of memberRows) {
        if (allianceMap[k.alliance_id]) {
          allianceMap[k.alliance_id].member_count++;
          allianceMap[k.alliance_id].total_land += k.land || 0;
          allianceMap[k.alliance_id].total_pop += k.population || 0;
          allianceMap[k.alliance_id].total_score += engine.calculateScore(k);
        }
      }

      const results = Object.values(allianceMap);
      results.sort((a, b) => b.total_score - a.total_score);

      res.json(results.map((r, i) => ({ ...r, rank: i + 1 })));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};
