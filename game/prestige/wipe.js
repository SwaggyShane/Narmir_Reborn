'use strict';
// Data-driven wipe updates + side-effect flags.
// Tests import ZERO_FIELDS / KEEP_COLUMNS / buildWipeUpdates.

const {
  STARTER_BUILDINGS,
  RESOURCE_SEEDS,
  landSeed,
  goldSeed,
} = require('./balance');
const { safeJsonParse } = require('../../utils/helpers');

/** Buildings zeroed (all except starter). */
const ZERO_BUILDINGS = Object.freeze([
  'bld_granaries', 'bld_outposts', 'bld_guard_towers', 'bld_armories', 'bld_vaults',
  'bld_smithies', 'bld_markets', 'bld_mage_towers', 'bld_shrines', 'bld_training',
  'bld_castles', 'bld_libraries', 'bld_taverns', 'bld_mausoleums', 'bld_walls',
  'bld_woodyard', 'bld_lumber_camp', 'bld_sawmill', 'bld_gravel_pit', 'bld_blockfield',
  'bld_stone_quarry', 'bld_open_pit', 'bld_strip_mine', 'bld_deep_mine',
  // Forge system upgrade chain — install state resets like other buildings
  'toolwright_yard', 'engineers_lodge', 'forge',
]);

const ZERO_TROOPS = Object.freeze([
  'fighters', 'rangers', 'clerics', 'mages', 'thieves', 'ninjas',
  'researchers', 'engineers', 'scribes', 'thralls',
  'war_machines', 'ballistae',
  'weapons_stockpile', 'armor_stockpile', 'ladders',
]);

const ZERO_RESOURCES = Object.freeze([
  'wood', 'stone', 'iron', 'coal', 'steel',
  'tools_hammers', 'tools_scaffolding', 'tools_blueprints',
  'hammers_stored', 'scaffolding_stored', 'blueprints_stored',
  'trade_routes',
  // Forge system stockpiles
  'tempered_steel', 'lava_stored', 'steel_weapons', 'steel_armor',
  'tempered_weapons', 'tempered_armor',
]);

const ZERO_RESEARCH = Object.freeze([
  'res_economy', 'res_weapons', 'res_armor', 'res_military', 'res_spellbook',
  'res_attack_magic', 'res_defense_magic', 'res_entertainment',
  'res_construction', 'res_war_machines', 'school_spellbook',
]);

/** JSON/text fields reset to empty schema defaults (string form for DB). */
const EMPTY_JSON_STRING = Object.freeze({
  build_queue: '{}',
  build_progress: '{}',
  research_progress: '{}',
  mage_research_progress: '{}',
  build_allocation: '{}',
  resource_build_allocation: '{}',
  training_allocation: '{}',
  smithy_allocation: '{}',
  mage_tower_allocation: '{}',
  shrine_allocation: '{}',
  research_allocation: '{}',
  active_effects: '{}',
  active_trade_routes: '[]',
  world_fragments: '[]',
  fragment_bonuses: '{}',
  items: '[]',
  troop_levels: '{}',
  equipment_levels: '{}',
  injured_troops: '{}',
  racial_bonuses_unlocked: '{}',
  mercenaries: '[]',
  bank_deposits: '{}',
  market_upgrades: '{}',
  farm_upgrades: '{}',
  granary_upgrades: '{}',
  bank_upgrades: '{}',
  vault_upgrades: '{}',
  school_upgrades: '{}',
  shrine_upgrades: '{}',
  library_upgrades: '{}',
  mausoleum_upgrades: '{}',
  tavern_upgrades: '{}',
  defense_upgrades: '{}',
  outpost_upgrades: '{}',
  alliance_buffs: '{}',
  xp_sources: '{}',
  wall_upgrades: '{}',
  tower_def_upgrades: '{}',
  tower_upgrades: '{}',
  research_focus: '{}',
  ledger: '{}',
  active_event: '{}',
  location_maps_wip: '[]',
  wounded_troops: '{}',
  flux_barges: '[]',
});

/** Explicit keep list for schema-coverage tests (not written in updates). */
const KEEP_COLUMNS = Object.freeze([
  'id', 'player_id', 'name', 'race', 'region', 'turn', 'maps',
  'discovered_kingdoms', 'achievements', 'collected_lore', 'collected_events',
  'description', 'milestone_bonuses', 'milestones_claimed', 'milestone_title',
  'evolution_form', 'evolution_ritual', 'custom_portrait',
  'last_lore_id', 'last_event_id', 'happiness', 'tax',
  'turns_stored', 'created_at', 'updated_at',
  // Map / fog / identity extras
  'gender', 'x', 'y', 'visibility',
  'first_dungeon_found_turn', 'first_mountain_found_turn',
  'last_turn_at', 'last_event_at', 'goals',
]);

const ZERO_FIELDS = Object.freeze([
  ...ZERO_BUILDINGS,
  ...ZERO_TROOPS,
  ...ZERO_RESOURCES,
  ...ZERO_RESEARCH,
  'scout_allocation', 'scout_progress', 'hammer_turns_used',
  'wall_hp', 'school_of_magic',
  // Extra numeric columns found via live schema reflection
  'last_attack_turn', 'rebellion_cooldown',
  'charcoal_wood_allocation',
  'engineer_level', 'engineer_xp',
  'scrolls', 'hybrid_blueprints', 'fortified_blueprints', 'fortified_buildings',
  'certified_blueprints_stored',
  'food_shortage_turns', 'food_surplus_turns',
  'divine_sanctuary_used',
  'library_allocation', 'mausoleum_allocation',
  'library_progress', 'tower_progress',
  'resource_sequence',
]);

/**
 * Build kingdom column updates for prestige wipe.
 * @param {object} k - kingdom row (locked snapshot)
 * @returns {{ updates: object, newPrestigeLevel: number }}
 */
function buildWipeUpdates(k) {
  const newP = (Number(k.prestige_level) || 0) + 1;
  const updates = {
    prestige_level: newP,
    last_prestige_turn: Number(k.turn) || 0,
    level: 1,
    xp: 0,
    land: landSeed(newP),
    gold: goldSeed(newP),
    population: RESOURCE_SEEDS.population,
    food: RESOURCE_SEEDS.food,
    mana: RESOURCE_SEEDS.mana,
    ...STARTER_BUILDINGS,
  };

  for (const f of ZERO_FIELDS) {
    updates[f] = f === 'school_of_magic' ? '' : 0;
  }

  for (const [key, val] of Object.entries(EMPTY_JSON_STRING)) {
    updates[key] = val;
  }

  // Wall defense type clear
  updates.wall_defense_type = '';

  // Keep turn explicitly (timeline continuity) — also safe if apply merges
  updates.turn = k.turn;

  // Endgame dragon form: KEEP evolution_form (not written = unchanged).
  // Mid-channel ritual cannot survive castle wipe — abort so next turn does not
  // auto-FAIL with castles=0 (egg already spent; endgame identity).
  try {
    const raw = k.evolution_ritual;
    if (raw && raw !== '{}' && raw !== '') {
      const ritual = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (ritual && ritual.state === 'CHANNELING') {
        updates.evolution_ritual = JSON.stringify({
          state: 'ABORTED',
          form: 'dragon',
          reason: 'prestige_rebirth',
          aborted_turn: Number(k.turn) || 0,
        });
      }
    }
  } catch {
    /* corrupt ritual left alone / ignored */
  }

  return { updates, newPrestigeLevel: newP };
}

/**
 * Side effects inside same TX as wipe (heroes, expeditions, trade).
 * @param {object} db - transaction-aware db
 * @param {number} kingdomId
 */
async function applyPrestigeSideEffects(db, kingdomId) {
  // Heroes: keep top 3 by level DESC, id ASC
  const heroes = await db.all(
    'SELECT id, level FROM heroes WHERE kingdom_id = $1 ORDER BY level DESC, id ASC',
    [kingdomId],
  );
  if (heroes && heroes.length > 3) {
    const dropIds = heroes.slice(3).map((h) => h.id);
    for (const hid of dropIds) {
      await db.run('DELETE FROM heroes WHERE id = $1', [hid]);
    }
  }

  // Expeditions: cancel — rewards lost (delete active rows)
  try {
    await db.run('DELETE FROM expeditions WHERE kingdom_id = $1 AND turns_left > 0', [kingdomId]);
  } catch {
    /* table may vary */
  }
  try {
    await db.run(
      `DELETE FROM resource_expeditions WHERE kingdom_id = $1 AND status IN ('active','outbound','returning','in_progress')`,
      [kingdomId],
    );
  } catch {
    try {
      await db.run('DELETE FROM resource_expeditions WHERE kingdom_id = $1 AND status = $2', [
        kingdomId,
        'active',
      ]);
    } catch {
      /* ignore */
    }
  }

  // Trade routes table: both directions
  const partnerRows = await db.all(
    'SELECT id, kingdom_id, partner_id FROM trade_routes WHERE kingdom_id = $1 OR partner_id = $1',
    [kingdomId],
  );
  const partnerIds = new Set();
  for (const row of partnerRows || []) {
    if (row.kingdom_id !== kingdomId) partnerIds.add(row.kingdom_id);
    if (row.partner_id !== kingdomId) partnerIds.add(row.partner_id);
  }
  await db.run('DELETE FROM trade_routes WHERE kingdom_id = $1 OR partner_id = $1', [kingdomId]);

  // Scrub partners' active_trade_routes JSON of references to this kingdom
  for (const pid of partnerIds) {
    const prow = await db.get('SELECT id, active_trade_routes FROM kingdoms WHERE id = $1 FOR UPDATE', [pid]);
    if (!prow) continue;
    const arr = safeJsonParse(prow.active_trade_routes, [], 'prestige:partner_routes');
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const filtered = arr.filter((entry) => {
      if (entry == null) return false;
      if (typeof entry === 'number') return entry !== kingdomId;
      if (typeof entry === 'object') {
        const other =
          entry.partner_id ?? entry.kingdom_id ?? entry.partnerId ?? entry.target_id ?? entry.id;
        return other !== kingdomId;
      }
      return true;
    });
    if (filtered.length !== arr.length) {
      await db.run('UPDATE kingdoms SET active_trade_routes = $1 WHERE id = $2', [
        JSON.stringify(filtered),
        pid,
      ]);
    }
  }
}

/**
 * All field names that wipe updates touch (for coverage tests).
 */
function getMappedUpdateKeys() {
  const keys = new Set([
    'prestige_level',
    'last_prestige_turn',
    'level',
    'xp',
    'land',
    'gold',
    'population',
    'food',
    'mana',
    'turn',
    'wall_defense_type',
    ...Object.keys(STARTER_BUILDINGS),
    ...ZERO_FIELDS,
    ...Object.keys(EMPTY_JSON_STRING),
  ]);
  return [...keys];
}

module.exports = {
  ZERO_BUILDINGS,
  ZERO_TROOPS,
  ZERO_RESOURCES,
  ZERO_RESEARCH,
  ZERO_FIELDS,
  EMPTY_JSON_STRING,
  KEEP_COLUMNS,
  STARTER_BUILDINGS,
  buildWipeUpdates,
  applyPrestigeSideEffects,
  getMappedUpdateKeys,
};
