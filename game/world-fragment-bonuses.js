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
      passive: { capacity: 0.20, dryness: 0.10 },
      special: { name: "Geothermal Dehydration", desc: "Constant heat cures crops. Eliminates 100% of moisture-induced mold and spoilage" },
    },
    housing: {
      passive: { capacity: 0.10, stability: 0.05 },
      special: { name: "Geothermal Hearth", desc: "Underfloor heating pipes tap volcanic veins. Citizens stay warm through brutal winters" },
    },
    libraries: {
      passive: { lore_generation: 0.15, warmth: 0.10 },
      special: { name: "Heat-Hardened Archive", desc: "Warm dry air circulates continuously, preventing parchment decay and humidity damage" },
    },
  },

  "Ancient Elven Wood": {
    farms: {
      passive: { production: 0.20, stability: 0.25 },
      special: { name: "Primordial Fertility", desc: "Crops never fail; immune to blight and natural disasters" },
    },
    granaries: {
      passive: { capacity: 0.25, decay_reduction: 0.15 },
      special: { name: "Organic Preservation", desc: "Roots cocoon stored crops in suspended animation. Food decay over winters reduced to zero" },
    },
    housing: {
      passive: { capacity: 0.20, stability: 0.30 },
      special: { name: "Treehouse Canopy", desc: "Dwellings weave into living canopies. Citizens remain in maximum happiness" },
    },
    libraries: {
      passive: { lore_generation: 0.20, forest_sight: 0.25 },
      special: { name: "Sylvan Whispers", desc: "Living paper pages whisper ancient secrets directly to librarians" },
    },
  },

  "Dragon Scale": {
    farms: {
      passive: { production: 0.05, population: -0.05 },
      special: { name: "Dragon's Shadow", desc: "Crops grow but workers fear the land; morale penalty but high yield" },
    },
    granaries: {
      passive: { capacity: 0.15, raid_security: 0.50 },
      special: { name: "Draconic Ward", desc: "Granary walls lined with draconic scales. Blocks 100% of rats, pests, and enemy food theft" },
    },
    housing: {
      passive: { capacity: 0.10, defenses: 0.25 },
      special: { name: "Fortified Keeps", desc: "Draconic scales line outer walls. Shelters are highly secure and flame-retardant" },
    },
    libraries: {
      passive: { lore_generation: 0.05, document_armor: 0.40 },
      special: { name: "Fireproof Scriptorium", desc: "Dragon scale coatings make all historical papers immune to fire" },
    },
  },

  "Abyssal Crystal": {
    granaries: {
      passive: { capacity: 0.35, magic_output: 0.05 },
      special: { name: "Glacial Cryostasis", desc: "Deep underdark crystals lock granary in lightless frost. Permanently halts organic breakdown" },
    },
    housing: {
      passive: { capacity: 0.15, magic_output: 0.10 },
      special: { name: "Shadow Attunement", desc: "Crystalline-infused houses produce magical output as citizens meditate and rest" },
    },
    libraries: {
      passive: { decoding_speed: 0.30, magic_output: 0.10 },
      special: { name: "Shadow Scripts", desc: "Illuminates invisible texts on ancient scrolls under purple crystal light" },
    },
  },

  "Celestial Feather": {
    farms: {
      passive: { production: 0.25, stability: 0.30 },
      special: { name: "Blessed Fields", desc: "Crops blessed by heaven; harvests are guaranteed and bountiful" },
    },
    granaries: {
      passive: { capacity: 0.25, morale_stability: 0.20 },
      special: { name: "Manna Manifestation", desc: "Stored food is blessed. Portion of reserves auto-distributed to boost morale on unstable turns" },
    },
    housing: {
      passive: { capacity: 0.25, stability: 0.35 },
      special: { name: "Holy Sanctuaries", desc: "Angelic grace prevents civil unrest. Rioting and immigration desertion are greatly reduced" },
    },
    libraries: {
      passive: { lore_generation: 0.25, morale_sight: 0.35 },
      special: { name: "Heavenly Revelations", desc: "Angelic scriptures float down from skylights, resolving complex studies automatically" },
    },
  },

  "Dwarven Star-Metal": {
    granaries: {
      passive: { capacity: 0.50, defensive_armor: 0.15 },
      special: { name: "Piston Silos", desc: "Motorized steam pistons continuously compress and aerate grains, maximizing holding density" },
    },
    housing: {
      passive: { capacity: 0.40, defenses: 0.10 },
      special: { name: "Retractable Apartments", desc: "Dwarven clockwork bunks and fold-out structures fit more citizens in less space" },
    },
    libraries: {
      passive: { lore_generation: 0.40, record_impenetrability: 1.00 },
      special: { name: "Impenetrable Star-Metal Lockboxes", desc: "Maps, locations, and relic coordinates cannot be lost, stolen, or erased by curses" },
    },
  },

  "Cursed Bloodstone": {
    granaries: {
      passive: { capacity: 0.30, combat_attunement: 0.20 },
      special: { name: "Vampiric Silos", desc: "Spoiling food distilled into dark elixir. Increases military attack speed but spikes chaos" },
    },
    housing: {
      passive: { capacity: 0.50, stability: -0.20 },
      special: { name: "Blood Pact Lodgings", desc: "Explosive population density powered by dark covenant. Raw workforce expansion at stability cost" },
    },
    libraries: {
      passive: { lore_generation: 0.50, chaos_index: 0.15 },
      special: { name: "Sanguine Cartography", desc: "Maps drawn in blood update geography in real-time but cause intense psychological stress" },
    },
  },

  "Tears of the World Tree": {
    farms: {
      passive: { production: 0.35, stability: 0.40 },
      special: { name: "Eternal Harvest", desc: "Crops blessed by world-tree; never fail, multiply if overabundant" },
    },
    granaries: {
      passive: { capacity: 0.40, growth_rate: 0.50 },
      special: { name: "Cellular Biosphere", desc: "World Tree spores seed reserves. Stored grains self-replicate at +2% per turn" },
    },
    housing: {
      passive: { capacity: 0.35, stability: 0.25 },
      special: { name: "Lifespring Spores", desc: "Curing waters fill district fonts. Zero infant mortality, natural growth boosted +50%" },
    },
    libraries: {
      passive: { lore_generation: 0.35, spell_efficiency: 0.30 },
      special: { name: "Dew of Understanding", desc: "Sipping microscopic water drops doubles comprehension speed and memory retention" },
    },
  },

  "Void Essence": {
    farms: {
      passive: { production: 1.00, chaos: 0.30 },
      special: { name: "Void Crops", desc: "Food yields doubled but becomes unpredictable; crops either triple or fail" },
    },
    granaries: {
      passive: { capacity: 2.00, quantum_flux: 0.15 },
      special: { name: "Void Pantry", desc: "Granary folds into pocket dimension for massive volume. 5% chance per turn food vanishes" },
    },
    housing: {
      passive: { capacity: 1.20, stability: -0.30 },
      special: { name: "Void Pocket Lofts", desc: "Living rooms fold into pocket dimensions. Massive capacity with mild disorientation penalty" },
    },
    libraries: {
      passive: { research_speed: -0.30, chaos_index: 0.20 },
      special: { name: "Void Codex", desc: "Research becomes unpredictable; studies may jump forward rapidly or regress without warning" },
    },
  },

  "Titan Bone": {
    granaries: {
      passive: { capacity: 1.00, fortifications: 0.20 },
      special: { name: "Megastructures", desc: "Fossilized skeletal columns support towering silos. Storage capabilities scale exponentially" },
    },
    housing: {
      passive: { capacity: 0.60, defenses: 0.15 },
      special: { name: "Goliath Dwellings", desc: "Colossal foundations built on titanic skeletons. Allows massive multi-story structures" },
    },
    libraries: {
      passive: { lore_generation: 0.75, record_capacity: 0.50 },
      special: { name: "Colossal Archives", desc: "Titanic skeletal supports allow libraries to expand indefinitely with vault-like record storage" },
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
