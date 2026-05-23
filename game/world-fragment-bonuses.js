/**
 * World Fragment Bonuses System
 * Each of 10 world fragments provides unique bonuses to each building type.
 * Only farms, granaries, and housing are populated based on active core features.
 * All other buildings from the build panel are defined but not populated.
 */

const POPULATED_FRAGMENTS = {
  "Volcanic Rock": {
    farms: {
      passive: { production: 0.15, consumption: 0.05 },
      special: { name: "Geothermal Fertility", desc: "Heat accelerates growth but increases population hunger" },
    },
    granaries: {
      passive: { capacity: 0.20 },
      special: { name: "Heat Preservation", desc: "Food preserved by constant warmth; immune to cold spoilage" },
    },
  },

  "Ancient Elven Wood": {
    farms: {
      passive: { production: 0.20, stability: 0.25 },
      special: { name: "Primordial Fertility", desc: "Crops never fail; immune to blight and natural disasters" },
    },
    granaries: {
      passive: { capacity: 0.50 },
      special: { name: "Eternal Storage", desc: "Food stored in Elven wood ages like fine wine; value increases over time" },
    },
    housing: {
      passive: { capacity: 0.15, morale: 0.10 },
      special: { name: "Elven Halls", desc: "Living spaces feel timeless; citizens never want to leave" },
    },
  },

  "Dragon Scale": {
    farms: {
      passive: { production: 0.05, population: -0.05 },
      special: { name: "Dragon's Shadow", desc: "Crops grow but workers fear the land; morale penalty but high yield" },
    },
    granaries: {
      passive: { capacity: 0.15, security: 0.30 },
      special: { name: "Hoard Guard", desc: "Granaries protected with draconic magic; impossible to steal from" },
    },
  },

  "Abyssal Crystal": {
    granaries: {
      passive: { capacity: 1.00, instability: 0.20 },
      special: { name: "Void Pantry", desc: "Unlimited food storage but food becomes unstable; occasional spontaneous spoilage" },
    },
  },

  "Celestial Feather": {
    farms: {
      passive: { production: 0.25, stability: 0.30 },
      special: { name: "Blessed Fields", desc: "Crops blessed by heaven; harvests are guaranteed and bountiful" },
    },
    housing: {
      passive: { capacity: 0.15, happiness: 0.20 },
      special: { name: "Sanctified Homes", desc: "Dwellings filled with light; citizens never leave, population growth boosted" },
    },
  },

  "Dwarven Star-Metal": {
    granaries: {
      passive: { capacity: 0.30 },
      special: { name: "Star-Metal Granaries", desc: "Food storage secured; no theft possible, quality preserved" },
    },
  },

  "Cursed Bloodstone": {
    granaries: {
      passive: { capacity: 0.30, taint: 0.15 },
      special: { name: "Bloodstone Stores", desc: "Food stained with blood; attracts scavengers but lasts longer" },
    },
  },

  "Tears of the World Tree": {
    farms: {
      passive: { production: 0.35, stability: 0.40 },
      special: { name: "Eternal Harvest", desc: "Crops blessed by world-tree; never fail, multiply if overabundant" },
    },
    granaries: {
      passive: { capacity: 0.25, vitality: 0.30 },
      special: { name: "Living Stores", desc: "Food becomes living; never spoils, grants +1% population growth bonus" },
    },
    housing: {
      passive: { capacity: 0.30, growth: 0.25 },
      special: { name: "Life Dwellings", desc: "Population reproduces faster; natural growth from within" },
    },
  },

  "Void Essence": {
    farms: {
      passive: { production: 1.00, chaos: 0.30 },
      special: { name: "Void Crops", desc: "Food yields doubled but becomes unpredictable; crops either triple or fail" },
    },
    granaries: {
      passive: { capacity: 2.00, volatility: 0.50 },
      special: { name: "Void Pantry", desc: "Infinite storage but unstable; food randomly appears/disappears" },
    },
  },

  "Titan Bone": {
    granaries: {
      passive: { capacity: 0.50 },
      special: { name: "Titan Stores", desc: "Granaries grow enormous; food storage for years, never runs out" },
    },
    housing: {
      passive: { capacity: 0.40 },
      special: { name: "Titan Halls", desc: "Buildings spacious; citizens require less space, population density +40%" },
    },
  },
};

// All buildings inside the build panel
const BUILD_PANEL_BUILDINGS = [
  "farms",
  "granaries",
  "housing",
  "barracks",
  "outposts",
  "guard_towers",
  "schools",
  "armories",
  "vaults",
  "smithies",
  "markets",
  "mage_towers",
  "training",
  "castles",
  "libraries",
  "shrines",
  "walls",
  "taverns",
  "mausoleums"
];

const FRAGMENT_BONUSES = {};

// Build the complete index of fragments where only farms, granaries, and housing
// are populated with their active creative logic, and all other 16 panel buildings
// are initialized but unpopulated.
for (const [fragmentName, bldsObj] of Object.entries(POPULATED_FRAGMENTS)) {
  FRAGMENT_BONUSES[fragmentName] = {};
  for (const bldType of BUILD_PANEL_BUILDINGS) {
    if (bldsObj[bldType]) {
      FRAGMENT_BONUSES[fragmentName][bldType] = bldsObj[bldType];
    } else {
      FRAGMENT_BONUSES[fragmentName][bldType] = {
        passive: {},
        special: {}
      };
    }
  }
}

module.exports = FRAGMENT_BONUSES;
