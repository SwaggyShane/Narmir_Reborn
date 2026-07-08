// Extracted from db/schema.js for modularity (M2-4 start)
// Cache numeric field names for efficient conversion (PostgreSQL NUMERIC/INTEGER returns strings)

const NUMERIC_FIELDS = [
  // Core kingdom economy
  'gold', 'mana', 'food', 'land', 'population', 'happiness', 'tax',
  // Turns / time
  'turn', 'turns_stored', 'last_turn_at', 'created_at', 'updated_at',
  'food_surplus_turns', 'food_shortage_turns', 'turn_num',
  // Forum
  'post_count', 'last_post_at', 'deleted_at',
  // Forum Moderation
  'expires_at', 'reviewed_at',
  // XP / levels
  'xp', 'level', 'prestige_level', 'progress',
  // Units
  'fighters', 'rangers', 'clerics', 'mages', 'thieves', 'ninjas',
  'researchers', 'engineers', 'engineer_level', 'engineer_xp', 'scribes', 'thralls',
  // Allocations
  'scout_allocation', 'scout_progress',
  // Military equipment
  'war_machines', 'ballistae', 'weapons_stockpile', 'armor_stockpile', 'ladders',
  // Research
  'res_economy', 'res_weapons', 'res_armor', 'res_military', 'res_spellbook',
  'res_attack_magic', 'res_defense_magic', 'res_entertainment',
  'res_construction', 'res_war_machines', 'school_spellbook',
  // Buildings (base schema)
  'bld_farms', 'bld_granaries', 'bld_barracks', 'bld_outposts',
  'bld_guard_towers', 'bld_schools', 'bld_armories', 'bld_vaults',
  'bld_smithies', 'bld_markets', 'bld_mage_towers', 'bld_shrines',
  'bld_training', 'bld_castles', 'bld_housing', 'bld_libraries',
  // Buildings (migrations)
  'bld_taverns', 'bld_mausoleums', 'bld_woodyard', 'bld_lumber_camp',
  'bld_blockfield', 'bld_stone_quarry', 'bld_strip_mine',
  // Tools / crafting stockpiles
  'tools_hammers', 'tools_scaffolding', 'tools_blueprints',
  'hammers_stored', 'scaffolding_stored',
  // Inventory / resources
  'maps', 'blueprints_stored', 'wood', 'stone', 'iron', 'coal', 'steel',
  // Heroes
  'hp', 'max_hp',
  // Expeditions / resource nodes / trade routes
  'turns_left', 'population_sent', 'distance', 'richness', 'stability',
  'food_taken', 'arrive_at', 'depart_at', 'harvest_ends_at', 'return_at',
  // Misc / admin goals
  'count', 'wall_hp', 'prize_multiplier',
  // Happiness tracking
  'happiness_value', 'food_component', 'entertainment_component',
  'safety_component', 'prosperity_component', 'race_modifier',
  'tax_component', 'overcrowding_component', 'recovery_rate',
  'effects_component', 'synergy_component', 'fragment_component',
];

function convertNumericFields(row) {
  if (!row) return row;
  for (const field of NUMERIC_FIELDS) {
    if (typeof row[field] === 'string') {
      row[field] = parseFloat(row[field]);
    }
  }
  return row;
}

module.exports = { NUMERIC_FIELDS, convertNumericFields };
