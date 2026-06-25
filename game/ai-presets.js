'use strict';

// AI Kingdom Preset Catalog
// Each preset is a partial field patch applied on top of current kingdom state.
// All fields must be in the set-kingdom ALLOWED whitelist.

const PRESETS = {
  balanced: {
    label: 'Balanced',
    description: 'Fair PvP sparring partner with moderate all-around stats',
    fields: {
      gold: 50000, mana: 5000, food: 15000, population: 80000, land: 2000,
      fighters: 2000, rangers: 1000, mages: 500, clerics: 500, thieves: 200, ninjas: 100,
      war_machines: 100, researchers: 300, engineers: 300,
      bld_barracks: 5, bld_outposts: 3, bld_training: 2, bld_armories: 3,
      bld_farms: 15, bld_housing: 120, bld_markets: 2, bld_schools: 2,
      res_weapons: 400, res_armor: 400, res_military: 400, res_economy: 300,
      res_attack_magic: 200, res_defense_magic: 200,
      turns_stored: 400,
    },
  },
  high_defense: {
    label: 'High Defense',
    description: 'Turtle kingdom heavy on walls, castles, and clerics',
    fields: {
      gold: 50000, food: 15000, population: 80000, land: 2000,
      fighters: 3000, clerics: 1500, rangers: 500, mages: 300, thieves: 50, ninjas: 0,
      war_machines: 0, researchers: 300, engineers: 500,
      bld_barracks: 5, bld_walls: 10, bld_guard_towers: 8, bld_castles: 3,
      bld_armories: 6, bld_farms: 15, bld_housing: 120,
      res_weapons: 400, res_armor: 800, res_military: 400, res_defense_magic: 800,
      res_economy: 200, wall_hp: 5000,
      turns_stored: 400,
    },
  },
  high_attack: {
    label: 'High Attack',
    description: 'Aggressive raider with heavy troop counts and weapons research',
    fields: {
      gold: 50000, food: 15000, population: 80000, land: 2000,
      fighters: 4000, rangers: 2000, mages: 300, clerics: 300, thieves: 100, ninjas: 0,
      war_machines: 500, researchers: 300, engineers: 300,
      bld_barracks: 10, bld_armories: 8, bld_outposts: 5, bld_farms: 15,
      bld_walls: 2, bld_guard_towers: 2, bld_housing: 120,
      res_weapons: 800, res_military: 800, res_armor: 400,
      res_economy: 200, weapons_stockpile: 2000,
      turns_stored: 400,
    },
  },
  fighter_heavy: {
    label: 'Fighter Heavy',
    description: 'Melee blob dominated by fighters with barracks and training',
    fields: {
      gold: 50000, food: 15000, population: 80000, land: 2000,
      fighters: 8000, rangers: 200, mages: 100, clerics: 200, thieves: 50, ninjas: 50,
      war_machines: 0, researchers: 200, engineers: 300,
      bld_barracks: 15, bld_training: 10, bld_armories: 6, bld_farms: 15, bld_housing: 120,
      res_weapons: 600, res_military: 600, res_armor: 400,
      turns_stored: 400,
    },
  },
  ranged_focus: {
    label: 'Ranger Focus',
    description: 'Archer fortress heavy on rangers and outpost buildings',
    fields: {
      gold: 50000, food: 15000, population: 80000, land: 2000,
      fighters: 500, rangers: 6000, mages: 200, clerics: 200, thieves: 100, ninjas: 0,
      war_machines: 300, researchers: 200, engineers: 300,
      bld_barracks: 3, bld_outposts: 12, bld_armories: 5, bld_farms: 15, bld_housing: 120,
      res_weapons: 800, res_military: 600, res_armor: 300,
      turns_stored: 400,
    },
  },
  magic_focus: {
    label: 'Magic Focus',
    description: 'Spellcaster kingdom with heavy mage count and magic research',
    fields: {
      gold: 50000, mana: 20000, food: 15000, population: 80000, land: 2000,
      fighters: 500, rangers: 200, mages: 4000, clerics: 500, thieves: 0, ninjas: 0,
      researchers: 500, engineers: 200,
      bld_barracks: 2, bld_mage_towers: 10, bld_farms: 15, bld_housing: 120, bld_schools: 3,
      res_weapons: 200, res_military: 300, res_attack_magic: 800, res_spellbook: 500,
      res_defense_magic: 500,
      turns_stored: 400,
    },
  },
  covert_ops: {
    label: 'Covert Ops',
    description: 'Thief and ninja pressure kingdom with shrine support',
    fields: {
      gold: 50000, food: 15000, population: 80000, land: 2000,
      fighters: 500, rangers: 300, mages: 200, clerics: 100, thieves: 3000, ninjas: 2000,
      researchers: 300, engineers: 200,
      bld_barracks: 3, bld_shrines: 5, bld_farms: 15, bld_housing: 120,
      res_weapons: 300, res_military: 600, res_attack_magic: 300,
      turns_stored: 400,
    },
  },
  economy_boom: {
    label: 'Economy Boom',
    description: 'Trade-focused kingdom with massive gold and food reserves',
    fields: {
      gold: 500000, mana: 10000, food: 100000, population: 200000, land: 3000,
      fighters: 500, rangers: 500, researchers: 600, engineers: 600,
      bld_barracks: 2, bld_farms: 25, bld_markets: 15, bld_granaries: 5, bld_housing: 200,
      bld_vaults: 5,
      res_economy: 800, res_weapons: 200, res_military: 200,
      turns_stored: 400,
    },
  },
  glass_cannon: {
    label: 'Glass Cannon',
    description: 'Maximum attack power with virtually no defensive structures',
    fields: {
      gold: 50000, food: 15000, population: 80000, land: 2000,
      fighters: 6000, rangers: 1000, mages: 200, clerics: 0, thieves: 0, ninjas: 0,
      war_machines: 500, researchers: 300, engineers: 200,
      bld_barracks: 12, bld_walls: 0, bld_guard_towers: 0, bld_castles: 0,
      bld_armories: 8, bld_farms: 15, bld_housing: 120,
      res_weapons: 900, res_military: 900, res_armor: 100,
      weapons_stockpile: 3000,
      turns_stored: 400,
    },
  },
  turn_ready: {
    label: 'Turn Ready',
    description: 'Fill turns to 400 without touching any other stats',
    fields: {
      turns_stored: 400,
    },
  },
};

// Race modifier values are ADDED to the preset field value.
// Use null to force a field to 0 regardless of preset value.
const RACE_MODIFIERS = {
  human: {},
  vampire: {
    clerics: null,
    thralls: 500,
    bld_mausoleums: 3,
  },
  dire_wolf: {
    fighters: 1000,
    rangers: 500,
  },
  high_elf: {
    mages: 1500,
    bld_mage_towers: 3,
    res_attack_magic: 200,
  },
  dwarf: {
    bld_smithies: 3,
    war_machines: 200,
    res_armor: 200,
  },
  wood_elf: {
    rangers: 1500,
    bld_outposts: 3,
  },
  dark_elf: {
    thieves: 1500,
    ninjas: 1000,
    bld_shrines: 2,
  },
  orc: {
    fighters: 1500,
    bld_training: 3,
    res_military: 100,
  },
  ogre: {
    fighters: 2000,
    rangers: null,
  },
};

const PRESET_IDS = Object.keys(PRESETS);

/**
 * Build the field patch for a given preset + race combination.
 * Returns a plain object suitable for passing to the set-kingdom route.
 */
function buildPresetFields(presetId, race) {
  const preset = PRESETS[presetId];
  if (!preset) throw new Error(`Unknown preset: ${presetId}`);

  const fields = { ...preset.fields };

  const mod = RACE_MODIFIERS[race] || {};
  for (const [key, delta] of Object.entries(mod)) {
    if (delta === null) {
      fields[key] = 0;
    } else {
      fields[key] = (fields[key] || 0) + delta;
    }
  }

  // Clamp any negative values to 0
  for (const key of Object.keys(fields)) {
    if (typeof fields[key] === 'number' && fields[key] < 0) {
      fields[key] = 0;
    }
  }

  return fields;
}

module.exports = { PRESETS, PRESET_IDS, RACE_MODIFIERS, buildPresetFields };
