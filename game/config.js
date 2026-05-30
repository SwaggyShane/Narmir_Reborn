// src/game/config.js
// Configuration constants for game balancing and logic.

// ── NAMING CONVENTIONS ────────────────────────────────────────────────────────
// See TERMINOLOGY.md for complete reference.
//
// Building keys: Plain names e.g., 'farms', 'granaries' (except BUILDING_TIERS uses 'bld_farms')
//   → Maps to database columns: kingdoms.bld_farms via BUILDING_COL
//
// Research keys: Plain names e.g., 'economy', 'weapons'
//   → Maps to database columns: kingdoms.res_economy via RESEARCH_MAP
//
// Units: Plural form in database (fighters, rangers, mages, etc.)
//   → Config uses both plural (TROOP_RACE_BONUS.fighters) and singular (SUPPORT_CAP_RACE.researcher)
//
// INCONSISTENCIES (documented for future migration):
//   - Some storage named 'stockpile' (weapons_stockpile), others '_stored' (hammers_stored)
//   - Some upgrades use building names (vault_upgrades), others use generic (market_upgrades)
//   See TERMINOLOGY.md for migration path.

const config = {
  RACE_BONUSES: {
    high_elf: {
      research: 1.25,
      magic: 1.2,
      economy: 1.05,
      military: 0.9,
      morale: 0.95,
      scribe: 1.2,
      wood_yield: 1.1,
      stone_yield: 0.85,
      iron_yield: 0.8,
      resource_build: 0.85,
      expedition_speed: 1.0,
      rare_find: 1.4,
      food_storage: 0.7, // Prim and proper — strict freshness standards, small immaculate stores
    },
    dwarf: {
      construction: 1.2,
      war_machines: 1.25,
      economy: 1.202,
      magic: 0.75,
      research: 0.9,
      morale: 1.0,
      scribe: 0.85,
      wood_yield: 0.85,
      stone_yield: 1.35,
      iron_yield: 1.3,
      resource_build: 1.15,
      expedition_speed: 0.85,
      rare_find: 1.1,
      food_storage: 1.3, // Deep stone cellars, methodical preservation
    },
    dire_wolf: {
      military: 1.3,
      covert: 1.1,
      research: 0.6,
      magic: 0.25,
      economy: 0.8,
      morale: 1.1,
      scribe: 0.8,
      wood_yield: 1.0,
      stone_yield: 0.8,
      iron_yield: 0.85,
      resource_build: 0.7,
      expedition_speed: 1.4,
      rare_find: 0.75,
      food_storage: 2.0, // Just pile carcasses — crude but high capacity
    },
    dark_elf: {
      covert: 1.25,
      stealth: 1.3,
      magic: 1.1,
      military: 0.85,
      economy: 0.9,
      morale: 0.9,
      scribe: 1.1,
      wood_yield: 0.9,
      stone_yield: 1.1,
      iron_yield: 0.95,
      resource_build: 1.0,
      expedition_speed: 1.2,
      rare_find: 1.25,
      food_storage: 0.9, // Underground, selective — some spoilage from damp
    },
    human: {
      economy: 1.5,
      morale: 1.05,
      scribe: 1.05,
      wood_yield: 1.15,
      stone_yield: 1.0,
      iron_yield: 1.0,
      resource_build: 1.0,
      expedition_speed: 1.1,
      rare_find: 1.0,
      food_storage: 1.0, // Baseline
    },
    orc: {
      military: 1.2,
      economy: 1.1,
      research: 0.8,
      magic: 0.65,
      construction: 0.9,
      morale: 1.05,
      scribe: 0.6,
      wood_yield: 1.0,
      stone_yield: 1.1,
      iron_yield: 1.2,
      resource_build: 0.9,
      expedition_speed: 1.0,
      rare_find: 0.8,
      food_storage: 1.5, // Crude bulk hoarding — quantity over quality
    },
    vampire: {
      military: 1.15,
      covert: 1.25,
      stealth: 1.2,
      economy: 0.9,
      morale: 0.95,
      magic: 1.1,
      construction: 0.9,
      scribe: 1.1,
      wood_yield: 0.8,
      stone_yield: 0.9,
      iron_yield: 1.1,
      resource_build: 0.9,
      expedition_speed: 1.15,
      rare_find: 1.2,
      food_storage: 0.5, // Barely store grain — blood is what they crave
    },
    wood_elf: {
      wood_yield: 1.5,
      stone_yield: 0.8,
      iron_yield: 0.75,
      resource_build: 0.9,
      expedition_speed: 1.2,
      rare_find: 1.3,
      food_storage: 1.2, // Forest caches, natural preservation
    },
  },

  REGION_DATA: {
    dwarf: {
      name: "The Iron Holds",
      bonus: "construction",
      mult: 0.05,
      lore: "Ancient mountain citadels carved from living rock, where forge-fires have burned unbroken for a thousand years.",
    },
    high_elf: {
      name: "The Silverwood",
      bonus: "magic",
      mult: 0.05,
      lore: "A vast enchanted forest where moonlight pools in crystal streams and every leaf hums with residual arcane power.",
    },
    orc: {
      name: "The Bloodplains",
      bonus: "military",
      mult: 0.05,
      lore: "Endless scarred steppe where the ground itself is soaked with the memory of ten thousand wars.",
    },
    dark_elf: {
      name: "The Underspire",
      bonus: "stealth",
      mult: 0.05,
      lore: "A labyrinthine underground city of obsidian towers and shadow-markets, where every corridor hides a blade.",
    },
    human: {
      name: "The Heartlands",
      bonus: "economy",
      mult: 0.05,
      lore: "Fertile central plains criss-crossed by ancient trade roads, where every crossroads is a kingdom in miniature.",
    },
    dire_wolf: {
      name: "The Ashfang Wilds",
      bonus: "military",
      mult: 0.05,
      lore: "Primal wilderness of ash-grey forest and howling ravines, where only the strong survive the first winter.",
    },
    vampire: {
      name: "The Crimson Vales",
      bonus: "covert",
      mult: 0.05,
      lore: "Perpetually shrouded in mist, the sun rarely pierces the canopy here.",
    },
  },

  UNIT_COST: 250,
  MAX_RESEARCH: 1000,
  MAX_POPULATION: 50000,
  MOVE_ARMY: 5,
  EXPEDITION_BASE_SPEED: 25,
  EXPEDITION_YIELD_MULT: 1.0,
  GOAL_RESET_HOURS: {
    daily: 24,
    weekly: 168,
    monthly: 720,
  },

  // Race-specific research discipline hard caps (default 1000 for all disciplines)
  RESEARCH_DISCIPLINE_CAPS: {
    human: { economy: 1500 },           // Humans excel at economy
    high_elf: { attack_magic: 1500 },   // High Elves excel at attack magic
    // All other races: 1000 baseline for all disciplines
  },

  HOUSING_CAP_BY_RACE: {
    dwarf: 975,
    orc: 900,
    human: 750,
    dark_elf: 675,
    high_elf: 525,
    dire_wolf: 1050,
    vampire: 600,
  },

  TROOP_RACE_BONUS: {
    high_elf: { clerics: 1.5, mages: 1.5, researchers: 1.3 },
    dwarf: { fighters: 1.3, engineers: 1.5 },
    dire_wolf: { fighters: 1.8, rangers: 1.5 },
    dark_elf: { ninjas: 1.8, thieves: 1.5, rangers: 1.3 },
    human: {
      fighters: 1.1,
      rangers: 1.1,
      clerics: 1.1,
      mages: 1.1,
      thieves: 1.1,
      ninjas: 1.1,
    },
    orc: { fighters: 1.6, clerics: 1.2 },
    vampire: { thieves: 1.2, clerics: 2.0 },
  },

  WALL_STRENGTH_MULT: {
    human: 1.0,
    dwarf: 1.35,
    high_elf: 1.1,
    orc: 0.85,
    dark_elf: 0.9,
    dire_wolf: 0.8,
    vampire: 0.95,
  },
  TOWER_DETECT_MULT: {
    human: 1.0,
    dwarf: 1.0,
    high_elf: 1.1,
    orc: 0.8,
    dark_elf: 1.4,
    dire_wolf: 0.7,
    vampire: 1.2,
  },
  OUTPOST_RANGER_MULT: {
    human: 1.0,
    dwarf: 0.8,
    high_elf: 0.95,
    orc: 0.9,
    dark_elf: 1.3,
    dire_wolf: 1.4,
    vampire: 1.1,
  },

  WALL_UPGRADES: {
    reinforced: {
      name: "Reinforced Walls",
      cost: 10000,
      costWood: 0,
      costStone: 0,
      costIron: 15,
      desc: "+25% wall strength, −10% land lost per attack",
      requires: null,
    },
    battlements: {
      name: "Battlements",
      cost: 30000,
      costWood: 0,
      costStone: 0,
      costIron: 35,
      desc: "Guard towers +20% effectiveness",
      requires: "reinforced",
    },
    fortress_walls: {
      name: "Fortress Walls",
      cost: 100000,
      costWood: 0,
      costStone: 50,
      costIron: 80,
      desc: "War machines on walls deal +50% damage",
      requires: "battlements",
    },
  },

  TOWER_DEF_UPGRADES: {
    arrow_slits: {
      name: "Arrow Slits",
      cost: 5000,
      costWood: 0,
      costStone: 0,
      costIron: 10,
      desc: "+20% ranged defense from guard towers",
      requires: null,
    },
    watchtower: {
      name: "Watchtower",
      cost: 20000,
      costWood: 0,
      costStone: 0,
      costIron: 30,
      desc: "Thieves detect incoming attacks 1 turn early",
      requires: "arrow_slits",
    },
    signal_tower: {
      name: "Signal Tower",
      cost: 50000,
      costWood: 40,
      costStone: 0,
      costIron: 70,
      desc: "Attack warnings shared with alliance members",
      requires: "watchtower",
    },
  },

  OUTPOST_UPGRADES: {
    ranger_station: {
      name: "Ranger Station",
      cost: 5000,
      costWood: 0,
      costStone: 0,
      costIron: 10,
      desc: "+25% ranger patrol effectiveness",
      requires: null,
    },
    forward_camp: {
      name: "Forward Camp",
      cost: 20000,
      costWood: 0,
      costStone: 0,
      costIron: 30,
      desc: "Rangers detect incoming expeditions targeting land",
      requires: "ranger_station",
    },
    field_hq: {
      name: "Field Headquarters",
      cost: 60000,
      costWood: 40,
      costStone: 0,
      costIron: 70,
      desc: "Expedition rangers return with +10% gold bonus",
      requires: "forward_camp",
    },
  },

  DEFENSE_TIERS: {
    fortified: { walls: 100, guard_towers: 10, outposts: 10, castles: 0 },
    keep: { walls: 350, guard_towers: 30, outposts: 30, castles: 0 },
    citadel: { walls: 500, guard_towers: 50, outposts: 50, castles: 1 },
  },

  SEASON_ORDER: ["spring", "summer", "fall", "winter"],
  SEASON_DURATION: { spring: 3, summer: 5, fall: 2, winter: 3 },
  SEASON_FARM_MULT: { spring: 1.1, summer: 1.2, fall: 0.9, winter: 0.7 },
  SEASON_ICONS: { spring: "🌸", summer: "☀️", fall: "🍂", winter: "❄️" },

  LOCATE_RACE_MULT: {
    human: 1.0,
    dwarf: 0.8,
    high_elf: 0.95,
    orc: 0.9,
    dark_elf: 1.3,
    dire_wolf: 0.7,
    vampire: 1.1,
  },

  FARM_YIELD_MULT: {
    human: 1.0,
    dwarf: 0.9,
    high_elf: 1.15,
    orc: 0.85,
    dark_elf: 0.95,
    dire_wolf: 0.8,
    vampire: 1.0,
  },
  FARM_WORKERS_PER: {
    human: 10,
    dwarf: 8,
    high_elf: 12,
    orc: 15,
    dark_elf: 10,
    dire_wolf: 12,
    vampire: 2,
  },
  FOOD_CONSUMPTION_MULT: {
    human: 1.0,
    dwarf: 0.85,
    high_elf: 0.8,
    orc: 1.35,
    dark_elf: 0.95,
    dire_wolf: 1.4,
    vampire: 0.35,
  },
  MARKET_INCOME_MULT: {
    human: 1.0,
    dwarf: 1.25,
    high_elf: 1.1,
    orc: 0.85,
    dark_elf: 1.05,
    dire_wolf: 0.75,
    vampire: 0.9,
  },
  TRADE_RATE_MULT: {
    human: 1.0,
    dwarf: 1.15,
    high_elf: 1.2,
    orc: 0.8,
    dark_elf: 1.3,
    dire_wolf: 0.7,
    vampire: 0.95,
  },

  // Trade Route constants
  TRADE_ROUTE_MAX: 5,
  TRADE_ROUTE_BASE_GOLD: 1500,
  TRADE_ROUTE_DISTANCE_PENALTY: 10, // gold per distance unit
  TRADE_ROUTE_ESTABLISH_COST: 10000,

  COMMODITY_VALUES: {
    food: 2,
    weapons: 6,
    armor: 8,
    mana: 4,
    maps: 50,
    scrolls: 200,
    blueprints: 150,
    war_machines: 500,
    land: 2000,
  },
  COMMODITY_RACE_DISCOUNT: {
    dwarf: { weapons: 0.85, armor: 0.85 },
    high_elf: { scrolls: 0.8, mana: 0.85 },
    dark_elf: { _all: 0.9 },
    orc: { food: 1.2 },
    dire_wolf: { maps: 0.8 },
    vampire: { food: 0.8 },
    human: {},
  },

  TOWER_UPGRADES: {
    arcane_focus: {
      name: "Arcane Focus",
      cost: 5000,
      costWood: 0,
      costStone: 0,
      costIron: 10,
      desc: "+25% mana production per turn",
      requires: null,
    },
    ley_line_tap: {
      name: "Ley Line Tap",
      cost: 20000,
      costWood: 0,
      costStone: 0,
      costIron: 40,
      desc: "Towers passively generate scroll energy",
      requires: "arcane_focus",
    },
    sanctum_of_power: {
      name: "Sanctum of Power",
      cost: 75000,
      costWood: 0,
      costStone: 60,
      costIron: 100,
      desc: "All spells twice as effective",
      requires: "ley_line_tap",
    },
  },

  SCHOOL_UPGRADES: {
    advanced_curriculum: {
      name: "Advanced Curriculum",
      cost: 3000,
      costWood: 8,
      costStone: 0,
      costIron: 0,
      desc: "+20% research output per turn",
      requires: null,
    },
    repository: {
      name: "Repository",
      cost: 12000,
      costWood: 25,
      costStone: 0,
      costIron: 0,
      desc: "Unlocks a second research discipline",
      requires: "advanced_curriculum",
    },
    grand_academy: {
      name: "Grand Academy",
      cost: 40000,
      costWood: 70,
      costStone: 0,
      costIron: 40,
      desc: "Researchers gain XP 50% faster",
      requires: "repository",
    },
  },

  SHRINE_UPGRADES: {
    divine_favor: {
      name: "Divine Favor",
      cost: 5000,
      costWood: 0,
      costStone: 12,
      costIron: 0,
      desc: "Clerics provide +20% bonus to kingdom morale.",
      requires: null,
    },
    healing_aura: {
      name: "Healing Aura",
      cost: 20000,
      costWood: 0,
      costStone: 40,
      costIron: 0,
      desc: "Troop casualties in defense are reduced by 10%.",
      requires: "divine_favor",
    },
    sanctuary: {
      name: "Sanctuary",
      cost: 50000,
      costWood: 0,
      costStone: 70,
      costIron: 40,
      desc: "Allows clerics to heal a larger portion of casualties after battle.",
      requires: "healing_aura",
    },
  },

  MAUSOLEUM_UPGRADES: {
    blood_sacrifice: {
      name: "Blood Sacrifice",
      cost: 10000,
      costWood: 0,
      costStone: 0,
      costIron: 12,
      desc: "Thralls are 20% more efficient as a food source.",
      requires: null,
    },
    soul_vault: {
      name: "Soul Vault",
      cost: 40000,
      costWood: 0,
      costStone: 0,
      costIron: 50,
      desc: "Increases Thrall capacity by 50%.",
      requires: "blood_sacrifice",
    },
    night_watch: {
      name: "Night Watch",
      cost: 100000,
      costWood: 0,
      costStone: 0,
      costIron: 100,
      desc: "Thralls provide +10% defense bonus in daylight.",
      requires: "soul_vault",
    },
  },

  LIBRARY_UPGRADES: {
    surveyors_eyrie: {
      name: "The Surveyor's Eyrie",
      cost: 25000,
      costWood: 0,
      costStone: 15,
      costIron: 0,
      desc: "Surveyors have a 20% chance of finding a location",
      requires: null,
    },
    mason_sigil: {
      name: "The Master Mason's Sigil",
      cost: 150000,
      costWood: 0,
      costStone: 80,
      costIron: 50,
      desc: "Buildings constructed with Certified plans are more resistant to attacks",
      requires: "surveyors_eyrie",
    },
    specimen_vault: {
      name: "The Specimen Vault",
      cost: 50000,
      costWood: 0,
      costStone: 0,
      costIron: 60,
      desc: "Study World Fragments to create Hybrid Blueprints",
      requires: "mason_sigil",
    },
  },

  BANK_UPGRADES: {
    ledger_ancients: {
      name: "Ledger of the Ancients",
      cost: 25000,
      costWood: 0,
      costStone: 0,
      costIron: 20,
      desc: "Grants ability to withdraw funds early from any term deposit (forfeits interest).",
      requires: null,
      reqVaults: 100,
    },
    trade_guild: {
      name: "Trade Guild Charter",
      cost: 100000,
      costWood: 40,
      costStone: 0,
      costIron: 60,
      desc: "Increases interest earned on all term deposits by an absolute +3%.",
      requires: "ledger_ancients",
      reqVaults: 50,
    },
    iron_treasury: {
      name: "The Iron Treasury",
      cost: 1500000,
      costWood: 80,
      costStone: 100,
      costIron: 150,
      desc: "Unlocks 300-turn deposit yielding 60%. Protects 25% of liquid gold from thieves.",
      requires: "trade_guild",
      reqVaults: 75,
    },
  },

  FARM_UPGRADES: {
    irrigated: {
      name: "Irrigated Farm",
      cost: 25000,
      costWood: 20,
      costStone: 0,
      costIron: 0,
      yieldBonus: 0.15,
      requires: null,
    },
    iron_plows: {
      name: "Iron Plows",
      cost: 75000,
      costWood: 0,
      costStone: 0,
      costIron: 50,
      workerReduction: 2,
      requires: null,
    },
    plantation: {
      name: "Plantation",
      cost: 150000,
      costWood: 0,
      costStone: 40,
      costIron: 80,
      yieldBonus: 0.3,
      requires: "irrigated",
    },
  },

  GRANARY_UPGRADES: {
    silos: {
      name: "Tall Silos",
      cost: 25000,
      costWood: 30,
      costStone: 0,
      costIron: 0,
      desc: "+50% Storage capacity per Granary",
      requires: null,
    },
    preservation: {
      name: "Salt Curing",
      cost: 75000,
      costWood: 60,
      costStone: 0,
      costIron: 0,
      desc: "Lowers food degradation by 30%",
      requires: "silos",
    },
    segregation: {
      name: "Segregated Vaults",
      cost: 150000,
      costWood: 80,
      costStone: 0,
      costIron: 50,
      desc: "Secures a portion of food immune to Blight",
      requires: "preservation",
    },
  },

  MARKET_UPGRADES: {
    trading_post: {
      name: "Trading Post",
      cost: 5000,
      costWood: 0,
      costStone: 0,
      costIron: 10,
      unlocksTrade: true,
      requires: null,
    },
    bazaar: {
      name: "Bazaar",
      cost: 50000,
      costWood: 0,
      costStone: 0,
      costIron: 70,
      incomeBonus: 0.5,
      requires: "trading_post",
    },
    black_market: {
      name: "Black Market",
      cost: 15000,
      costWood: 0,
      costStone: 0,
      costIron: 30,
      raceOnly: "dark_elf",
      requires: "trading_post",
    },
  },

  TAVERN_UPGRADES: {
    inn: {
      name: "Inn",
      cost: 8000,
      costWood: 10,
      costStone: 0,
      costIron: 0,
      unlocksMercTier: "sellsword",
      requires: null,
    },
    guild_hall: {
      name: "Guild Hall",
      cost: 30000,
      costWood: 20,
      costStone: 0,
      costIron: 30,
      unlocksMercTier: "veteran",
      requires: "inn",
    },
  },

  MERC_TIERS: {
    rabble: {
      levelMin: 5,
      levelMax: 10,
      costPer: 50,
      duration: 10,
      upkeepPct: 0.25,
      requires: null,
    },
    sellsword: {
      levelMin: 15,
      levelMax: 25,
      costPer: 150,
      duration: 20,
      upkeepPct: 0.25,
      requires: "inn",
    },
    veteran: {
      levelMin: 30,
      levelMax: 45,
      costPer: 400,
      duration: 30,
      upkeepPct: 0.25,
      requires: "guild_hall",
    },
    elite: {
      levelMin: 50,
      levelMax: 65,
      costPer: 1000,
      duration: 40,
      upkeepPct: 0.25,
      requires: "guild_hall",
    },
  },

  XP_RACE_BONUS: {
    high_elf: { research: 1.5, magic: 1.5 },
    dwarf: { construction: 1.5, economy: 1.25 },
    dire_wolf: { combat: 1.5, exploration: 1.25 },
    dark_elf: { covert: 1.5, magic: 1.25 },
    human: { all: 1.1 },
    orc: { combat: 1.25, economy: 1.25 },
    vampire: { combat: 1.25, covert: 1.5 },
  },

  XP_BASE: {
    turn: 30,
    gold_earned: 0.0001,  // 1 XP per 10,000 gold
    combat_win: 55,
    combat_loss: -10,
    research: 0.05,
    construction: 2,
    exploration: 5,
    spell_cast: 10,
    covert_op: 10,
  },

  // XP requirements per level (cumulative XP needed to reach that level)
  XP_LEVELS: [0, 500, 1010, 1530, 2060, 2601, 3153, 3716, 4290, 4875, 5472, 6081, 6702, 7336, 7982, 8641, 9313, 9999, 10699, 11413, 12141, 12883, 13640, 14412, 15200, 16004, 16832, 17685, 18563, 19468, 20400, 21360, 22349, 23367, 24416, 25496, 26609, 27755, 28936, 30152, 31404, 32694, 34023, 35392, 36802, 38254, 39750, 41290, 42877, 44511, 46194, 47945, 49766, 51660, 53629, 55677, 57807, 60022, 62326, 64722, 67214, 69806, 72501, 75304, 78219, 81251, 84404, 87683, 91094, 94641, 98330, 102167, 106157, 110307, 114623, 119111, 123779, 128634, 133683, 138934, 144395, 150074, 155981, 162124, 168513, 175157, 182067, 189253, 196727, 204500, 212584, 220991, 229734, 238827, 248284, 258119, 268348, 278986, 290049, 301555, 313521, 330487, 352453, 379419, 411385, 448351, 490317, 537283, 589249, 646215, 708181, 775147, 847113, 924079, 1006045, 1093011, 1184977, 1281943, 1383909, 1490875, 1602841, 1719807, 1841773, 1968739, 2100705, 2237671, 2379637, 2526603, 2678569, 2835535, 2997501, 3164467, 3336433, 3513399, 3695365, 3882331, 4074297, 4271263, 4473229, 4680195, 4892161, 5109127, 5331093, 5558059, 5790025, 6026991, 6268957, 6515923, 6767889, 7024855, 7286821, 7553787, 7825753, 8102719, 8384685, 8671651, 8963617, 9260583, 9562549, 9869515, 10181481, 10498447, 10820413, 11147379, 11479345, 11816311, 12158277, 12505243, 12857209, 13214175, 13576141, 13943107, 14315073, 14692039, 15074005, 15460971, 15852937, 16249903, 16651869, 17058835, 17470801, 17887767, 18309733, 18736699, 19168665, 19605631, 20047597, 20494563, 20946529, 21403495, 21865461, 22332427, 22804393, 23281359, 23763325, 24250291, 24742257, 25239223, 25741189, 26248155, 26760121, 27277087, 27799053, 28326019, 28857985, 29394951, 29936917, 30483883, 31035849, 31592815, 32154781, 32721747, 33293713, 33870679, 34452645, 35039611, 35631577, 36228543, 36830509, 37437475, 38049441, 38666407, 39288373, 39915339, 40547305, 41184271, 41826237, 42473203, 43125169, 43782135, 44444101, 45111067, 45783033, 46459999, 47141965, 47828931, 48520897, 49217863, 49919829, 50626795, 51338761, 52055727, 52777693, 53504659, 54236625, 54973591, 55715557, 56462523, 57214489, 57971455, 58733421, 59500387, 60272353, 61049319, 61831285, 62618251, 63410217, 64207183, 65009149, 65816115, 66628081, 67445047, 68267013, 69093979, 69925945, 70762911, 71604877, 72451843, 73303809, 74160775, 75022741, 75889707, 76761673, 77638639, 78520605, 79407571, 80299537, 81196503, 82098469, 83005435, 83917401, 84834367, 85756333, 86683299, 87615265, 88552231, 89494197, 90441163, 91393129, 92350095, 93312061, 94279027, 95250993, 96227959, 97209925, 98196891, 99188857, 100185823, 101187789, 102194755, 103206721, 104223687, 105245653, 106272619, 107304585, 108341551, 109383517, 110430483, 111482449, 112539415, 113601381, 114668347, 115740313, 116817279, 117899245, 118986211, 120078177, 121175143, 122277109, 123384075, 124496041, 125613007, 126734973, 127861939, 128993905, 130130871, 131272837, 132419803, 133571769, 134728735, 135890701, 137057667, 138229633, 139406599, 140588565, 141775531, 142967497, 144164463, 145366429, 146573395, 147785361, 149002327, 150224293, 151451259, 152683225, 153920191, 155162157, 156409123, 157661089, 158918055, 160180021, 161446987, 162718953, 163995919, 165277885, 166564851, 167856817, 169153783, 170455749, 171762715, 173074681, 174391647, 175713613, 177040579, 178372545, 179709511, 181051477, 182398443, 183750409, 185107375, 186469341, 187836307, 189208273, 190585239, 191967205, 193354171, 194746137, 196143103, 197545069, 198952035, 200364001, 201780967, 203202933, 204629899, 206061865, 207498831, 208940797, 210387763, 211839729, 213296695, 214758661, 216225627, 217697593, 219174559, 220656525, 222143491, 223635457, 225132423, 226634389, 228141355, 229653321, 231170287, 232692253, 234219219, 235751185, 237288151, 238830117, 240377083, 241929049, 243486015, 245047981, 246614947, 248186913, 249763879, 251345845, 252932811, 254524777, 256121743, 257723709, 259330675, 260942641, 262559607, 264181573, 265808539, 267440505, 269077471, 270719437, 272366403, 274018369, 275675335, 277337301, 279004267, 280676233, 282353199, 284035165, 285722131, 287414097, 289111063, 290813029, 292519995, 294231961, 295948927, 297670893, 299397859, 301129825, 302866791, 304608757, 306355723, 308107689, 309864655, 311626621, 313393587, 315165553, 316942519, 318724485, 320511451, 322303417, 324100383, 325902349, 327709315, 329521281, 331338247, 333160213, 334987179, 336819145, 338656111, 340498077, 342345043, 344197009, 346053975, 347915941, 349782907, 351654873, 353531839, 355413805, 357300771, 359192737, 361089703, 362991669, 364898635, 366810601, 368727567, 370649533, 372576499, 374508465, 376445431, 378387397, 380334363, 382286329, 384243295, 386205261, 388172227, 390144193, 392121159, 394103125, 396090091, 398082057, 400079023, 402080989, 404087955, 406099921],

  BUILDING_COST: {
    // Tier 1
    farms: 25,
    // Tier 2
    granaries: 350,
    housing: 350,
    taverns: 350,
    // Tier 3
    barracks: 1500,
    markets: 1500,
    libraries: 1500,
    schools: 1500,
    shrines: 1500,
    mausoleums: 1500,
    // Tier 4
    guard_towers: 3500,
    // Tier 5
    outposts: 7000,
    smithies: 7000,
    walls: 7000,
    // Tier 6
    armories: 13000,
    vaults: 13000,
    mage_towers: 13000,
    // Tier 7
    training: 18000,
    // Tier 8
    castles: 40000,
    // Non-tiered (legacy)
    war_machines: 1000,
    weapons: 10,
    armor: 10,
    ladders: 100,
    // Resource buildings
    woodyard: 1000,
    lumber_camp: 10000,
    sawmill: 100000,
    gravel_pit: 9000,
    blockfield: 90000,
    stone_quarry: 900000,
    open_pit: 4000,
    strip_mine: 40000,
    deep_mine: 400000,
  },

  BUILDING_GOLD_COST: {
    farms: 50,
    granaries: 250,
    barracks: 200,
    outposts: 150,
    guard_towers: 150,
    schools: 500,
    armories: 400,
    vaults: 400,
    smithies: 800,
    markets: 2000,
    mage_towers: 3000,
    shrines: 1000,
    training: 10000,
    castles: 25000,
    libraries: 2000,
    housing: 500,
    walls: 300,
    taverns: 1000,
    mausoleums: 2000,
    war_machines: 100,
    weapons: 100,
    armor: 150,
    ladders: 20,
    // Resource buildings — no gold cost
    woodyard: 0,
    lumber_camp: 0,
    sawmill: 0,
    gravel_pit: 0,
    blockfield: 0,
    stone_quarry: 0,
    open_pit: 0,
    strip_mine: 0,
    deep_mine: 0,
  },

  BUILDING_LAND_COST: {
    // Tier 1: 10 land
    farms: 10,
    // Tier 2: Variable land
    granaries: 15,
    housing: 25,
    taverns: 40,
    // Tier 3: Variable land
    barracks: 100,
    markets: 100,
    libraries: 25,
    schools: 125,
    shrines: 150,
    mausoleums: 150,
    // Tier 4: 50 land
    guard_towers: 50,
    // Tier 5: Variable land
    outposts: 25,
    smithies: 200,
    walls: 500,
    // Tier 6: Variable land
    armories: 300,
    vaults: 300,
    mage_towers: 250,
    // Tier 7: 850 land
    training: 850,
    // Tier 8: 1000 land
    castles: 1000,
    // Non-tiered
    war_machines: 0,
    weapons: 0,
    armor: 0,
    ladders: 0,
    // Resource buildings
    woodyard: 1,
    lumber_camp: 3,
    sawmill: 5,
    gravel_pit: 1,
    blockfield: 3,
    stone_quarry: 5,
    open_pit: 1,
    strip_mine: 3,
    deep_mine: 5,
  },

  BUILDING_WOOD_COST: {
    // Tier 1: 0 wood
    farms: 0,
    // Tier 2: 200 wood each
    granaries: 200,
    housing: 200,
    taverns: 200,
    // Tier 3: Variable wood
    barracks: 800,
    markets: 800,
    libraries: 200,
    schools: 800,
    shrines: 800,
    mausoleums: 800,
    // Tier 4: 2000 wood
    guard_towers: 2000,
    // Tier 5: 5000 wood each
    outposts: 5000,
    smithies: 5000,
    walls: 5000,
    // Tier 6: 7500 wood each
    armories: 7500,
    vaults: 7500,
    mage_towers: 7500,
    // Tier 7: 8500 wood
    training: 8500,
    // Tier 8: 10000 wood
    castles: 10000,
    // Non-tiered
    war_machines: 1,
    ladders: 1,
    weapons: 0,
    armor: 0,
    // Resource buildings
    woodyard: 0,
    lumber_camp: 100,
    sawmill: 500,
    gravel_pit: 50,
    blockfield: 100,
    stone_quarry: 500,
    open_pit: 50,
    strip_mine: 100,
    deep_mine: 500,
  },

  BUILDING_STONE_COST: {
    // Tier 1: 0 stone
    farms: 0,
    // Tier 2: 100 stone each
    granaries: 100,
    housing: 100,
    taverns: 100,
    // Tier 3: Variable stone
    barracks: 500,
    markets: 500,
    libraries: 250,
    schools: 500,
    shrines: 500,
    mausoleums: 500,
    // Tier 4: 1500 stone
    guard_towers: 1500,
    // Tier 5: 5000 stone each
    outposts: 5000,
    smithies: 5000,
    walls: 5000,
    // Tier 6: 12500 stone each
    armories: 12500,
    vaults: 12500,
    mage_towers: 12500,
    // Tier 7: 17500 stone
    training: 17500,
    // Tier 8: 25000 stone
    castles: 25000,
    // Non-tiered
    war_machines: 0,
    ladders: 0,
    weapons: 0,
    armor: 0,
    // Resource buildings
    woodyard: 0,
    lumber_camp: 0,
    sawmill: 0,
    gravel_pit: 0,
    blockfield: 100,
    stone_quarry: 500,
    open_pit: 0,
    strip_mine: 50,
    deep_mine: 200,
  },

  BUILDING_IRON_COST: {
    // Tier 1: 0 iron
    farms: 0,
    // Tier 2: 50 iron each
    granaries: 50,
    housing: 50,
    taverns: 50,
    // Tier 3: Variable iron
    barracks: 200,
    markets: 200,
    libraries: 50,
    schools: 200,
    shrines: 200,
    mausoleums: 200,
    // Tier 4: 500 iron
    guard_towers: 500,
    // Tier 5: 1500 iron each
    outposts: 1500,
    smithies: 1500,
    walls: 1500,
    // Tier 6: 3000 iron each
    armories: 3000,
    vaults: 3000,
    mage_towers: 3000,
    // Tier 7: 4000 iron
    training: 4000,
    // Tier 8: 5000 iron
    castles: 5000,
    // Non-tiered
    war_machines: 1,
    ladders: 0,
    weapons: 1,
    armor: 1,
    // Resource buildings
    woodyard: 0,
    lumber_camp: 0,
    sawmill: 100,
    gravel_pit: 0,
    blockfield: 0,
    stone_quarry: 100,
    open_pit: 0,
    strip_mine: 0,
    deep_mine: 100,
  },

  // Future resource types - infrastructure ready for forge feature at Smithy
  BUILDING_STEEL_COST: {
    farms: 0,
    granaries: 0,
    housing: 0,
    schools: 0,
    libraries: 0,
    mage_towers: 0,
    shrines: 0,
    mausoleums: 0,
    markets: 0,
    taverns: 0,
    smithies: 0,
    vaults: 0,
    armories: 0,
    barracks: 0,
    walls: 0,
    guard_towers: 0,
    outposts: 0,
    training: 0,
    castles: 0,
    war_machines: 0,
    ladders: 0,
    weapons: 0,
    armor: 0,
  },

  BUILDING_COAL_COST: {
    farms: 0,
    granaries: 0,
    housing: 0,
    schools: 0,
    libraries: 0,
    mage_towers: 0,
    shrines: 0,
    mausoleums: 0,
    markets: 0,
    taverns: 0,
    smithies: 0,
    vaults: 0,
    armories: 0,
    barracks: 0,
    walls: 0,
    guard_towers: 0,
    outposts: 0,
    training: 0,
    castles: 0,
    war_machines: 0,
    ladders: 0,
    weapons: 0,
    armor: 0,
  },

  // D&D-style schools of magic with spell assignments
  MAGIC_SCHOOLS: {
    abjuration: [
      "arcane_ward", "fortify_stones", "warding_circle", "banish_hex", "mystic_lock",
      "counterspell_aura", "dimensional_shroud", "protective_blessing", "null_field", "seal_the_breach",
      "greater_barrier", "reflect_curse", "sanctuary", "iron_skin_enchantment", "unbreakable_resolve",
      "complete_negation", "prismatic_shield", "planar_anchor", "divine_intervention", "eternal_vigilance",
      "absolute_protection", "temporal_rewind", "fortress_eternal", "divine_aegis", "unmaking_ward",
    ],
    conjuration: [
      "create_food", "summon_servants", "materialize_gold", "conjure_supplies", "summon_light",
      "summon_beasts", "greater_healing", "conjure_arsenal", "create_shelter", "summon_messenger",
      "summon_rats", "conjure_guardian", "mass_resurrection", "materialize_wealth", "summon_scholar",
      "summon_avatar", "conjure_abundance", "summon_plague_doctor", "materialize_army", "conjure_fortress",
      "summon_echo", "conjure_realm", "ultimate_resurrection", "summon_ascendant", "conjure_paradise",
    ],
    divination: [
      "detect_presence", "scry_library", "read_aura", "glimpse_future", "minds_eye",
      "true_sight", "oracles_vision", "foresee_battle", "scry_wealth", "divination_circle",
      "far_seeing", "chrono_vision", "soul_reading", "cosmic_sight", "prophecy",
      "all_knowing_eye", "foresee_disaster", "temporal_sight", "scry_sanctum", "prophetic_dream",
      "omniscience", "see_all_timelines", "divine_blueprint", "fates_thread", "perfect_foresight",
    ],
    enchantment: [
      "minor_charm", "fascinate_crowd", "command_word", "enthrall_scout", "whisper",
      "dominate_soldier", "mass_confusion", "charm_leader", "compulsion", "enchant_minds",
      "dominate_will", "mass_enthrallment", "command_legion", "overwhelming_charm", "psychic_dominion",
      "total_domination", "break_will", "mass_enslavement", "control_kingdom", "unbreakable_bond",
      "absolute_domination", "eternal_thralldom", "shatter_consciousness", "puppet_master", "ascendant_will",
    ],
    evocation: [
      "inferno_burst", "frost_sting", "stone_missile", "chain_bolt", "wind_shear",
      "meteor_shower", "acid_cloud", "inferno_wall", "sonic_blast", "blizzard",
      "cataclysm", "immolation", "disintegration_ray", "gravitational_crush", "absolute_zero",
      "reality_rip", "solar_flare", "void_storm", "apocalyptic_wave", "supernova",
      "extinction_event", "dimensional_collapse", "infinite_inferno", "entropy_unleashed", "cosmic_annihilation",
    ],
    illusion: [
      "mirage_city", "disguise_force", "false_wealth", "shadow_clones", "phantom_wall",
      "mass_hallucination", "false_army", "twisted_landscape", "phantom_spells", "deceptive_echo",
      "great_masquerade", "reality_warping", "phantom_army", "false_victory", "perception_shatter",
      "ultimate_deception", "temporal_mirage", "false_apocalypse", "multiversal_echo", "existence_masked",
      "perfect_illusion", "infinite_reflection", "paradox_engine", "false_reality", "unreality",
    ],
    necromancy: [
      "touch_of_death", "deaths_mark", "corpse_animation", "siphon_life", "death_knell",
      "undead_army", "soul_trap", "plague_of_death", "life_drain_aura", "summon_wraith",
      "mass_undeath", "death_curse", "soulbind", "withering_touch", "zombify_population",
      "undead_plague", "death_immortal", "soulflare", "cursed_existence", "necromantic_ascension",
      "death_dominion", "eternal_undeath", "apocalyptic_undeath", "deaths_embrace", "lich_king",
    ],
    transmutation: [
      "transform_lead_to_gold", "reshape_matter", "flesh_to_stone", "mutate_crops", "transmute_population",
      "mass_petrification", "metallic_skin", "transform_army", "alchemical_conversion", "bestial_transformation",
      "ultimate_petrification", "divine_form", "population_metamorphosis", "landscape_shift", "weapon_corruption",
      "complete_transformation", "dragon_form", "kingdom_alteration", "transcendence", "mass_metamorphosis",
      "ascendant_transformation", "reality_reconstruction", "ultimate_metamorphosis", "civilization_upheaval", "eternal_transmutation",
    ],
  },

  SCHOOL_LORE: {
    abjuration: "The art of warding and protection. Abjurers weave barriers against magical and physical harm, shielding their kingdom from danger with ancient protective wards.",
    conjuration: "The power to manifest and summon. Conjurers call forth creatures and supplies from thin air, providing abundance and reinforcement when needed most.",
    divination: "The gift of foresight and knowledge. Diviners peer into hidden truths and future events, granting strategic advantage through arcane insight.",
    enchantment: "The manipulation of will and desire. Enchanters bend minds and sway hearts, compelling others to serve their kingdom's interests.",
    evocation: "Raw magical power unleashed. Evokers channel destructive force—fire, lightning, and ruin—to devastate enemies and reshape the battlefield.",
    illusion: "The mastery of perception and deception. Illusionists craft false images and phantom armies, confusing enemies and protecting truth with misdirection.",
    necromancy: "The command over death itself. Necromancers raise undead servants and drain life force, building armies that never tire and never question.",
    transmutation: "The transformation of all matter. Transmuters reshape flesh into stone, lead into gold, and ordinary soldiers into unstoppable forces.",
  },

  SPELL_GLYPHS: {
    default: "⬜",
    locked: "❓",
    revealed: "✨",
  },

  SPELL_DEFS: {
    spark: {
      minSB: 100,
      tier: 1,
      effect: "buildings",
      damageType: "fire",
      desc: "Burns a small number of enemy farms",
    },
    fog_of_war: {
      minSB: 150,
      tier: 1,
      effect: "debuff",
      damageType: "illusion",
      desc: "Blinds enemy rangers for 3 turns",
      duration: 3,
    },
    mend: {
      minSB: 200,
      tier: 1,
      effect: "friendly",
      damageType: "none",
      desc: "Heals your own troop casualties from last battle",
    },
    blight: {
      minSB: 250,
      tier: 1,
      effect: "debuff",
      damageType: "poison",
      desc: "Poisons enemy food supply for 5 turns",
      duration: 5,
    },
    rain: {
      minSB: 300,
      tier: 1,
      effect: "buildings",
      damageType: "cool",
      desc: "Floods enemy farms — more damage than Spark",
    },
    dispel: {
      minSB: 400,
      tier: 1,
      effect: "friendly",
      damageType: "none",
      desc: "Removes all active curses and debuffs from your kingdom",
    },
    lightning: {
      minSB: 500,
      tier: 2,
      effect: "troops",
      damageType: "strike",
      desc: "Strikes down enemy fighters",
    },
    bless: {
      minSB: 600,
      tier: 2,
      effect: "friendly",
      damageType: "none",
      desc: "Boosts morale and population growth for 5 turns",
      duration: 5,
    },
    silence: {
      minSB: 700,
      tier: 2,
      effect: "debuff",
      damageType: "mental",
      desc: "Suppresses enemy research progress for 3 turns",
      duration: 3,
    },
    amnesia: {
      minSB: 800,
      tier: 2,
      effect: "research",
      damageType: "mental",
      desc: "Permanently wipes a chunk of enemy economy research",
    },
    drain: {
      minSB: 900,
      tier: 2,
      effect: "mana",
      damageType: "arcane",
      desc: "Siphons mana from enemy kingdom to yours",
    },
    plague: {
      minSB: 1000,
      tier: 3,
      effect: "population",
      damageType: "disease",
      desc: "Kills enemy population over 5 turns",
      duration: 5,
    },
    earthquake: {
      minSB: 1200,
      tier: 3,
      effect: "buildings",
      damageType: "force",
      desc: "Destroys buildings across all types",
    },
    tempest: {
      minSB: 1400,
      tier: 3,
      effect: "troops",
      damageType: "storm",
      desc: "Kills all troop types simultaneously",
    },
    shield: {
      minSB: 1500,
      tier: 3,
      effect: "friendly",
      damageType: "none",
      desc: "Reduces incoming spell damage by 50% for 5 turns",
      duration: 5,
    },
    armageddon: {
      minSB: 2000,
      tier: 4,
      effect: "catastrophic",
      damageType: "void",
      desc: "Destroys land, buildings, and population simultaneously. One cast, total devastation.",
    },

    // ===== ABJURATION SPELLS =====
    arcane_ward: { minSB: 100, tier: 1, effect: "friendly", damageType: "none", desc: "Creates a magical barrier; reduces damage by 20% for 4 turns", duration: 4 },
    fortify_stones: { minSB: 110, tier: 1, effect: "buildings", damageType: "none", desc: "Strengthens buildings; +15% durability temporarily" },
    warding_circle: { minSB: 120, tier: 1, effect: "population", damageType: "none", desc: "Protects population; reduces defense casualties by 10%" },
    banish_hex: { minSB: 130, tier: 1, effect: "debuff", damageType: "none", desc: "Removes a single curse from your kingdom" },
    mystic_lock: { minSB: 150, tier: 1, effect: "research", damageType: "none", desc: "Makes 2 enemy spy attempts fail next turn", duration: 1 },
    counterspell_aura: { minSB: 300, tier: 2, effect: "debuff", damageType: "none", desc: "Negates 1 random enemy spell effect currently active" },
    dimensional_shroud: { minSB: 320, tier: 2, effect: "debuff", damageType: "none", desc: "Makes kingdom harder to locate; -40% spy accuracy for 3 turns", duration: 3 },
    protective_blessing: { minSB: 330, tier: 2, effect: "friendly", damageType: "none", desc: "+10% defense against next 2 attacks" },
    null_field: { minSB: 340, tier: 2, effect: "debuff", damageType: "none", desc: "Suppresses enemy detection towers for 2 turns", duration: 2 },
    seal_the_breach: { minSB: 350, tier: 2, effect: "buildings", damageType: "none", desc: "Restores 30% wall integrity instantly" },
    greater_barrier: { minSB: 500, tier: 3, effect: "friendly", damageType: "none", desc: "Reduces all spell damage by 40% for 5 turns", duration: 5 },
    reflect_curse: { minSB: 520, tier: 3, effect: "debuff", damageType: "none", desc: "Bounces next enemy debuff back to caster" },
    sanctuary: { minSB: 530, tier: 3, effect: "population", damageType: "none", desc: "Protects 20% of population from magical attacks" },
    iron_skin_enchantment: { minSB: 540, tier: 3, effect: "troops", damageType: "none", desc: "Troops gain +25% armor; lasts 4 turns", duration: 4 },
    unbreakable_resolve: { minSB: 550, tier: 3, effect: "friendly", damageType: "none", desc: "Prevents one resource loss from enemy spells for 3 turns", duration: 3 },
    complete_negation: { minSB: 700, tier: 4, effect: "debuff", damageType: "none", desc: "Completely cancels all active enemy debuffs permanently" },
    prismatic_shield: { minSB: 730, tier: 4, effect: "friendly", damageType: "none", desc: "Reduces damage by 50% for 6 turns; reflects 25% back", duration: 6 },
    planar_anchor: { minSB: 760, tier: 4, effect: "debuff", damageType: "none", desc: "Prevents enemy summons entering territory for 5 turns", duration: 5 },
    divine_intervention: { minSB: 790, tier: 4, effect: "troops", damageType: "none", desc: "Resurrects 15% of fallen fighters from last battle" },
    eternal_vigilance: { minSB: 800, tier: 4, effect: "friendly", damageType: "none", desc: "Kingdom immune to assassination for 4 turns", duration: 4 },
    absolute_protection: { minSB: 1000, tier: 5, effect: "friendly", damageType: "none", desc: "Reduces all damage by 75% for 7 turns; impenetrable", duration: 7 },
    temporal_rewind: { minSB: 1050, tier: 5, effect: "debuff", damageType: "none", desc: "Undoes last enemy spell; removes all its effects retroactively" },
    fortress_eternal: { minSB: 1080, tier: 5, effect: "buildings", damageType: "none", desc: "All buildings indestructible for next attack cycle" },
    divine_aegis: { minSB: 1090, tier: 5, effect: "friendly", damageType: "none", desc: "Creates protection zone; prevents enemy spells for 3 turns", duration: 3 },
    unmaking_ward: { minSB: 1100, tier: 5, effect: "research", damageType: "none", desc: "Permanently seals a location against enemy expeditions" },

    // ===== CONJURATION SPELLS =====
    create_food: { minSB: 100, tier: 1, effect: "friendly", damageType: "none", desc: "Generates 500 food for granaries" },
    summon_servants: { minSB: 110, tier: 1, effect: "troops", damageType: "none", desc: "Summons 20 workers; +50% gathering for 2 turns", duration: 2 },
    materialize_gold: { minSB: 120, tier: 1, effect: "friendly", damageType: "none", desc: "Creates 1000 gold from magical energy (once per 5 turns)" },
    conjure_supplies: { minSB: 130, tier: 1, effect: "friendly", damageType: "none", desc: "Creates building materials; +100 wood/stone" },
    summon_light: { minSB: 150, tier: 1, effect: "research", damageType: "none", desc: "Reveals hidden spy network location" },
    summon_beasts: { minSB: 300, tier: 2, effect: "troops", damageType: "none", desc: "Summons 200 wild beasts for defense; last 3 turns", duration: 3 },
    greater_healing: { minSB: 320, tier: 2, effect: "troops", damageType: "none", desc: "Restores 20% of troop casualties from previous battles" },
    conjure_arsenal: { minSB: 330, tier: 2, effect: "friendly", damageType: "none", desc: "Creates 50 weapons and 50 armor instantly" },
    create_shelter: { minSB: 340, tier: 2, effect: "population", damageType: "none", desc: "+100 population capacity for 5 turns", duration: 5 },
    summon_messenger: { minSB: 350, tier: 2, effect: "research", damageType: "none", desc: "Allows instant communication with allied kingdom" },
    summon_rats: { minSB: 500, tier: 3, effect: "buildings", damageType: "none", desc: "Giant rats infest enemy granaries; destroys 15% food for 4 turns", duration: 4 },
    conjure_guardian: { minSB: 520, tier: 3, effect: "troops", damageType: "none", desc: "Creates guardian; +500 fighters for 5 turns", duration: 5 },
    mass_resurrection: { minSB: 530, tier: 3, effect: "troops", damageType: "none", desc: "Resurrects 30% of fallen troops from last battle" },
    materialize_wealth: { minSB: 540, tier: 3, effect: "friendly", damageType: "none", desc: "Creates 5000 gold (costs 10% kingdom mana)" },
    summon_scholar: { minSB: 550, tier: 3, effect: "research", damageType: "none", desc: "Grants temporary researcher; +5000 research XP instantly" },
    summon_avatar: { minSB: 700, tier: 4, effect: "troops", damageType: "none", desc: "Summons avatar; 2000 fighters + 5000 mana protection for 4 turns", duration: 4 },
    conjure_abundance: { minSB: 730, tier: 4, effect: "friendly", damageType: "none", desc: "Creates unlimited food for 3 turns; no starvation", duration: 3 },
    summon_plague_doctor: { minSB: 760, tier: 4, effect: "troops", damageType: "none", desc: "Summons healer; cures all population debuffs instantly" },
    materialize_army: { minSB: 790, tier: 4, effect: "troops", damageType: "none", desc: "Creates 1000 fighters from magical essence" },
    conjure_fortress: { minSB: 800, tier: 4, effect: "buildings", damageType: "none", desc: "+5000 wall strength for 5 turns", duration: 5 },
    summon_echo: { minSB: 1000, tier: 5, effect: "friendly", damageType: "none", desc: "Summons kingdom echo; doubles all bonuses for 7 turns", duration: 7 },
    conjure_realm: { minSB: 1050, tier: 5, effect: "friendly", damageType: "none", desc: "+50% storage for all buildings for 6 turns", duration: 6 },
    ultimate_resurrection: { minSB: 1080, tier: 5, effect: "troops", damageType: "none", desc: "Brings back 50% of all troops ever lost" },
    summon_ascendant: { minSB: 1090, tier: 5, effect: "friendly", damageType: "none", desc: "Summons ascendant; +100% spell effectiveness for 5 turns", duration: 5 },
    conjure_paradise: { minSB: 1100, tier: 5, effect: "friendly", damageType: "none", desc: "Creates ideal state; maximizes all production for 4 turns", duration: 4 },

    // ===== DIVINATION SPELLS =====
    detect_presence: { minSB: 100, tier: 1, effect: "research", damageType: "none", desc: "Reveals nearest enemy kingdom location for 1 turn", duration: 1 },
    scry_library: { minSB: 110, tier: 1, effect: "research", damageType: "none", desc: "Reveals enemy research in one discipline" },
    read_aura: { minSB: 120, tier: 1, effect: "research", damageType: "none", desc: "Discovers random fact about target kingdom" },
    glimpse_future: { minSB: 130, tier: 1, effect: "research", damageType: "none", desc: "Predicts next turn's attack or event" },
    minds_eye: { minSB: 150, tier: 1, effect: "research", damageType: "none", desc: "Reveals exact enemy troop composition" },
    true_sight: { minSB: 300, tier: 2, effect: "research", damageType: "none", desc: "Reveals all active debuffs with remaining duration" },
    oracles_vision: { minSB: 320, tier: 2, effect: "research", damageType: "none", desc: "Shows enemy mage tower status and spellbook level" },
    foresee_battle: { minSB: 330, tier: 2, effect: "research", damageType: "none", desc: "Predicts combat outcome and casualties" },
    scry_wealth: { minSB: 340, tier: 2, effect: "research", damageType: "none", desc: "Discovers exact enemy gold and resources" },
    divination_circle: { minSB: 350, tier: 2, effect: "research", damageType: "none", desc: "Reveals enemy prepared spells" },
    far_seeing: { minSB: 500, tier: 3, effect: "research", damageType: "none", desc: "Shows enemy kingdom layout and building locations" },
    chrono_vision: { minSB: 520, tier: 3, effect: "research", damageType: "none", desc: "Reveals enemy plans for next 3 turns", duration: 3 },
    soul_reading: { minSB: 530, tier: 3, effect: "research", damageType: "none", desc: "Discovers enemy racial bonuses" },
    cosmic_sight: { minSB: 540, tier: 3, effect: "research", damageType: "none", desc: "Shows all allied kingdoms of target" },
    prophecy: { minSB: 550, tier: 3, effect: "research", damageType: "none", desc: "+50% accuracy on next 5 spy operations" },
    all_knowing_eye: { minSB: 700, tier: 4, effect: "research", damageType: "none", desc: "Reveals EVERYTHING about target kingdom" },
    foresee_disaster: { minSB: 730, tier: 4, effect: "research", damageType: "none", desc: "Predicts and prevents 1 enemy attack" },
    temporal_sight: { minSB: 760, tier: 4, effect: "research", damageType: "none", desc: "Reveals kingdom appearance 5 turns ago and future" },
    scry_sanctum: { minSB: 790, tier: 4, effect: "research", damageType: "none", desc: "Reveals mage tower locations and mana reserves" },
    prophetic_dream: { minSB: 800, tier: 4, effect: "friendly", damageType: "none", desc: "+200% to next divination spell for 3 turns", duration: 3 },
    omniscience: { minSB: 1000, tier: 5, effect: "research", damageType: "none", desc: "All information about target revealed for 5 turns", duration: 5 },
    see_all_timelines: { minSB: 1050, tier: 5, effect: "research", damageType: "none", desc: "Reveals all possible outcomes of next 5 turns", duration: 5 },
    divine_blueprint: { minSB: 1080, tier: 5, effect: "research", damageType: "none", desc: "Reveals exact blueprint of enemy's next building" },
    fates_thread: { minSB: 1090, tier: 5, effect: "research", damageType: "none", desc: "Reveals target weakness; +40% combat advantage" },
    perfect_foresight: { minSB: 1100, tier: 5, effect: "friendly", damageType: "none", desc: "Immune to surprises; see all enemy actions for 4 turns", duration: 4 },

    // ===== ENCHANTMENT SPELLS =====
    minor_charm: { minSB: 100, tier: 1, effect: "troops", damageType: "mental", desc: "50 enemy fighters defect to your army" },
    fascinate_crowd: { minSB: 110, tier: 1, effect: "debuff", damageType: "mental", desc: "-20% enemy morale for 3 turns", duration: 3 },
    command_word: { minSB: 120, tier: 1, effect: "debuff", damageType: "mental", desc: "Enemy cannot act next turn", duration: 1 },
    enthrall_scout: { minSB: 130, tier: 1, effect: "research", damageType: "mental", desc: "Captures 1 spy for interrogation" },
    whisper: { minSB: 150, tier: 1, effect: "research", damageType: "mental", desc: "Enemy loses 10% spellbook progress" },
    dominate_soldier: { minSB: 300, tier: 2, effect: "troops", damageType: "mental", desc: "200 enemy fighters fight for you for 2 turns", duration: 2 },
    mass_confusion: { minSB: 320, tier: 2, effect: "debuff", damageType: "mental", desc: "Enemy cannot cast spells for 3 turns", duration: 3 },
    charm_leader: { minSB: 330, tier: 2, effect: "debuff", damageType: "mental", desc: "Convert enemy leader bonuses temporarily" },
    compulsion: { minSB: 340, tier: 2, effect: "research", damageType: "mental", desc: "Force enemy to trade at your rates" },
    enchant_minds: { minSB: 350, tier: 2, effect: "population", damageType: "mental", desc: "100 enemy population joins your kingdom" },
    dominate_will: { minSB: 500, tier: 3, effect: "troops", damageType: "mental", desc: "500 enemy fighters serve you permanently" },
    mass_enthrallment: { minSB: 520, tier: 3, effect: "population", damageType: "mental", desc: "500 enemy population switches sides" },
    command_legion: { minSB: 530, tier: 3, effect: "troops", damageType: "mental", desc: "Enemy troops fight each other for 2 turns", duration: 2 },
    overwhelming_charm: { minSB: 540, tier: 3, effect: "debuff", damageType: "mental", desc: "Enemy spells 50% effective for 4 turns", duration: 4 },
    psychic_dominion: { minSB: 550, tier: 3, effect: "debuff", damageType: "mental", desc: "Enemy morale crashes; paralyzed for 3 turns", duration: 3 },
    total_domination: { minSB: 700, tier: 4, effect: "troops", damageType: "mental", desc: "All enemy fighters serve you for 3 turns", duration: 3 },
    break_will: { minSB: 730, tier: 4, effect: "debuff", damageType: "mental", desc: "Enemy morale -50% permanently" },
    mass_enslavement: { minSB: 760, tier: 4, effect: "population", damageType: "mental", desc: "2000 enemy population becomes your thralls" },
    control_kingdom: { minSB: 790, tier: 4, effect: "research", damageType: "mental", desc: "You control enemy for 2 turns", duration: 2 },
    unbreakable_bond: { minSB: 800, tier: 4, effect: "research", damageType: "mental", desc: "Mind link formed; know all enemy actions for 5 turns", duration: 5 },
    absolute_domination: { minSB: 1000, tier: 5, effect: "research", damageType: "mental", desc: "Total control of enemy for 4 turns", duration: 4 },
    eternal_thralldom: { minSB: 1050, tier: 5, effect: "population", damageType: "mental", desc: "Enemy population permanently enslaved" },
    shatter_consciousness: { minSB: 1080, tier: 5, effect: "debuff", damageType: "mental", desc: "Enemy stats reduced 75% for 6 turns", duration: 6 },
    puppet_master: { minSB: 1090, tier: 5, effect: "research", damageType: "mental", desc: "Control enemy leader; force their spells" },
    ascendant_will: { minSB: 1100, tier: 5, effect: "research", damageType: "mental", desc: "Enemy cannot act if you forbid for 5 turns", duration: 5 },

    // ===== EVOCATION SPELLS =====
    inferno_burst: { minSB: 100, tier: 1, effect: "buildings", damageType: "fire", desc: "Fires destroy 50 enemy farms" },
    frost_sting: { minSB: 110, tier: 1, effect: "troops", damageType: "cold", desc: "Cold damages 100 fighters; slows for 2 turns", duration: 2 },
    stone_missile: { minSB: 120, tier: 1, effect: "buildings", damageType: "force", desc: "Barrage damages 5 buildings" },
    chain_bolt: { minSB: 130, tier: 1, effect: "buildings", damageType: "strike", desc: "Lightning chains; damages 3 buildings" },
    wind_shear: { minSB: 150, tier: 1, effect: "troops", damageType: "force", desc: "Cuts down 75 enemy rangers" },
    meteor_shower: { minSB: 300, tier: 2, effect: "buildings", damageType: "force", desc: "Destroys 100 buildings randomly" },
    acid_cloud: { minSB: 320, tier: 2, effect: "troops", damageType: "poison", desc: "Damages all troops; -30% armor for 4 turns", duration: 4 },
    inferno_wall: { minSB: 330, tier: 2, effect: "buildings", damageType: "fire", desc: "Destroys 200 farms and 5 granaries" },
    sonic_blast: { minSB: 340, tier: 2, effect: "troops", damageType: "force", desc: "Sound wave kills 300 fighters" },
    blizzard: { minSB: 350, tier: 2, effect: "population", damageType: "cold", desc: "Freezing storm kills 250 population" },
    cataclysm: { minSB: 500, tier: 3, effect: "buildings", damageType: "force", desc: "Destroys 50 buildings and kills 400 fighters" },
    immolation: { minSB: 520, tier: 3, effect: "buildings", damageType: "fire", desc: "Destroys ALL enemy farms" },
    disintegration_ray: { minSB: 530, tier: 3, effect: "buildings", damageType: "void", desc: "Vaporizes; destroys 10 largest buildings" },
    gravitational_crush: { minSB: 540, tier: 3, effect: "troops", damageType: "force", desc: "Kills 500 fighters and collapses structures" },
    absolute_zero: { minSB: 550, tier: 3, effect: "buildings", damageType: "cold", desc: "Kills 300 population; spoils food" },
    reality_rip: { minSB: 700, tier: 4, effect: "buildings", damageType: "void", desc: "Destroys 30% of all buildings; kills 1000 fighters" },
    solar_flare: { minSB: 730, tier: 4, effect: "buildings", damageType: "fire", desc: "Incinerates wooden buildings; kills 800" },
    void_storm: { minSB: 760, tier: 4, effect: "buildings", damageType: "void", desc: "Chaotic void destroys everything randomly" },
    apocalyptic_wave: { minSB: 790, tier: 4, effect: "buildings", damageType: "force", desc: "Wave kills 2000 fighters and destroys 40 buildings" },
    supernova: { minSB: 800, tier: 4, effect: "buildings", damageType: "fire", desc: "Destroys ALL farms and 30% of buildings" },
    extinction_event: { minSB: 1000, tier: 5, effect: "catastrophic", damageType: "void", desc: "Destroys 50% of buildings; kills 3000 fighters + 1000 population" },
    dimensional_collapse: { minSB: 1050, tier: 5, effect: "catastrophic", damageType: "void", desc: "100 buildings destroyed; 2000 fighters + 1500 population killed" },
    infinite_inferno: { minSB: 1080, tier: 5, effect: "buildings", damageType: "fire", desc: "Perpetual fire consumes ALL farms, granaries, markets" },
    entropy_unleashed: { minSB: 1090, tier: 5, effect: "buildings", damageType: "void", desc: "Universe ages kingdom; 60% infrastructure damage" },
    cosmic_annihilation: { minSB: 1100, tier: 5, effect: "catastrophic", damageType: "void", desc: "Ultimate destruction; 75% buildings gone, 3000 fighters + 2000 population lost" },

    // ===== ILLUSION SPELLS =====
    mirage_city: { minSB: 100, tier: 1, effect: "debuff", damageType: "illusion", desc: "False buildings; -40% enemy accuracy for 2 turns", duration: 2 },
    disguise_force: { minSB: 110, tier: 1, effect: "friendly", damageType: "illusion", desc: "Troops appear as civilians; -25% enemy damage" },
    false_wealth: { minSB: 120, tier: 1, effect: "debuff", damageType: "illusion", desc: "Illusion makes you look richer; enemy overestimates" },
    shadow_clones: { minSB: 130, tier: 1, effect: "troops", damageType: "illusion", desc: "Duplicate troops that don't exist; confuses enemy" },
    phantom_wall: { minSB: 150, tier: 1, effect: "debuff", damageType: "illusion", desc: "-30% enemy accuracy for 2 turns", duration: 2 },
    mass_hallucination: { minSB: 300, tier: 2, effect: "debuff", damageType: "illusion", desc: "-50% all enemy effectiveness for 3 turns", duration: 3 },
    false_army: { minSB: 320, tier: 2, effect: "debuff", damageType: "illusion", desc: "Fake army appears; affects enemy decisions" },
    twisted_landscape: { minSB: 330, tier: 2, effect: "troops", damageType: "illusion", desc: "200 enemies get lost wandering" },
    phantom_spells: { minSB: 340, tier: 2, effect: "debuff", damageType: "illusion", desc: "Fake spells waste enemy actions" },
    deceptive_echo: { minSB: 350, tier: 2, effect: "debuff", damageType: "illusion", desc: "Copies of kingdom appear; enemy confused" },
    great_masquerade: { minSB: 500, tier: 3, effect: "debuff", damageType: "illusion", desc: "Kingdom appears different; enemy confused" },
    reality_warping: { minSB: 520, tier: 3, effect: "debuff", damageType: "illusion", desc: "Enemy makes poor choices; loses 10% resources" },
    phantom_army: { minSB: 530, tier: 3, effect: "troops", damageType: "illusion", desc: "1000 illusory fighters appear" },
    false_victory: { minSB: 540, tier: 3, effect: "debuff", damageType: "illusion", desc: "Enemy morale surges then crashes; -40% morale" },
    perception_shatter: { minSB: 550, tier: 3, effect: "debuff", damageType: "illusion", desc: "Senses fooled for 3 turns; acts randomly", duration: 3 },
    ultimate_deception: { minSB: 700, tier: 4, effect: "debuff", damageType: "illusion", desc: "80% of kingdom hidden for 4 turns", duration: 4 },
    temporal_mirage: { minSB: 730, tier: 4, effect: "debuff", damageType: "illusion", desc: "Shows past versions; enemy confused" },
    false_apocalypse: { minSB: 760, tier: 4, effect: "troops", damageType: "illusion", desc: "Fake attack; enemy flees, loses 500 fighters" },
    multiversal_echo: { minSB: 790, tier: 4, effect: "debuff", damageType: "illusion", desc: "Multiple copies confuse enemy" },
    existence_masked: { minSB: 800, tier: 4, effect: "debuff", damageType: "illusion", desc: "-100% enemy accuracy for 3 turns", duration: 3 },
    perfect_illusion: { minSB: 1000, tier: 5, effect: "debuff", damageType: "illusion", desc: "So perfect enemy is blind for 5 turns", duration: 5 },
    infinite_reflection: { minSB: 1050, tier: 5, effect: "troops", damageType: "illusion", desc: "Infinite copies; loses 1000 fighters" },
    paradox_engine: { minSB: 1080, tier: 5, effect: "debuff", damageType: "illusion", desc: "Reality becomes illusion; can't act for 4 turns", duration: 4 },
    false_reality: { minSB: 1090, tier: 5, effect: "debuff", damageType: "illusion", desc: "4 enemy spells don't fire" },
    unreality: { minSB: 1100, tier: 5, effect: "friendly", damageType: "illusion", desc: "Kingdom hidden while real hidden; 6 turns", duration: 6 },

    // ===== NECROMANCY SPELLS =====
    touch_of_death: { minSB: 100, tier: 1, effect: "troops", damageType: "disease", desc: "Kills 50 fighters; they rise as undead for 2 turns", duration: 2 },
    deaths_mark: { minSB: 110, tier: 1, effect: "debuff", damageType: "disease", desc: "Target takes +20% damage from next 3 spells" },
    corpse_animation: { minSB: 120, tier: 1, effect: "troops", damageType: "disease", desc: "Raises 30 undead fighters" },
    siphon_life: { minSB: 130, tier: 1, effect: "population", damageType: "disease", desc: "Steals 200 population from enemy" },
    death_knell: { minSB: 150, tier: 1, effect: "debuff", damageType: "disease", desc: "-10% morale and -10% production for 3 turns", duration: 3 },
    undead_army: { minSB: 300, tier: 2, effect: "troops", damageType: "disease", desc: "Raises 200 undead for 4 turns", duration: 4 },
    soul_trap: { minSB: 320, tier: 2, effect: "troops", damageType: "disease", desc: "Traps 150 souls; gain their stats for 3 turns", duration: 3 },
    plague_of_death: { minSB: 330, tier: 2, effect: "population", damageType: "disease", desc: "300 enemy population become zombies" },
    life_drain_aura: { minSB: 340, tier: 2, effect: "population", damageType: "disease", desc: "-10% enemy population per turn for 4 turns", duration: 4 },
    summon_wraith: { minSB: 350, tier: 2, effect: "friendly", damageType: "disease", desc: "Wraith steals 500 gold" },
    mass_undeath: { minSB: 500, tier: 3, effect: "troops", damageType: "disease", desc: "500 undead serve you for 5 turns", duration: 5 },
    death_curse: { minSB: 520, tier: 3, effect: "debuff", damageType: "disease", desc: "-30% enemy production permanently" },
    soulbind: { minSB: 530, tier: 3, effect: "population", damageType: "disease", desc: "1000 souls bound; permanent undead servants" },
    withering_touch: { minSB: 540, tier: 3, effect: "buildings", damageType: "disease", desc: "5% building damage per turn for 4 turns", duration: 4 },
    zombify_population: { minSB: 550, tier: 3, effect: "population", damageType: "disease", desc: "500 population become undead chaos" },
    undead_plague: { minSB: 700, tier: 4, effect: "troops", damageType: "disease", desc: "1000 undead attack; 1500 fighters killed" },
    death_immortal: { minSB: 730, tier: 4, effect: "troops", damageType: "disease", desc: "Immortal undead with 2000 power serves forever" },
    soulflare: { minSB: 760, tier: 4, effect: "troops", damageType: "disease", desc: "Kills 800 and reanimates as undead" },
    cursed_existence: { minSB: 790, tier: 4, effect: "debuff", damageType: "disease", desc: "Cannot be healed for 5 turns; all healing fails", duration: 5 },
    necromantic_ascension: { minSB: 800, tier: 4, effect: "friendly", damageType: "disease", desc: "Become undead; +50% necromancy for 6 turns", duration: 6 },
    death_dominion: { minSB: 1000, tier: 5, effect: "troops", damageType: "disease", desc: "All enemy deaths reanimate under control for 7 turns", duration: 7 },
    eternal_undeath: { minSB: 1050, tier: 5, effect: "troops", damageType: "disease", desc: "3000 permanent undead forever" },
    apocalyptic_undeath: { minSB: 1080, tier: 5, effect: "troops", damageType: "disease", desc: "All dead from last 10 battles reanimate" },
    deaths_embrace: { minSB: 1090, tier: 5, effect: "troops", damageType: "disease", desc: "Kills 2000; all become undead thralls" },
    lich_king: { minSB: 1100, tier: 5, effect: "friendly", damageType: "disease", desc: "Ascend to lichdom; immortal, +100% spells, 5000 undead", duration: 6 },

    // ===== TRANSMUTATION SPELLS =====
    transform_lead_to_gold: { minSB: 100, tier: 1, effect: "friendly", damageType: "none", desc: "Converts 100 stone into 500 gold" },
    reshape_matter: { minSB: 110, tier: 1, effect: "friendly", damageType: "none", desc: "100 wood becomes 100 stone" },
    flesh_to_stone: { minSB: 120, tier: 1, effect: "troops", damageType: "none", desc: "50 fighters turn to stone; immobile" },
    mutate_crops: { minSB: 130, tier: 1, effect: "debuff", damageType: "poison", desc: "-30% enemy food for 3 turns", duration: 3 },
    transmute_population: { minSB: 150, tier: 1, effect: "population", damageType: "none", desc: "30 population become mindless servants" },
    mass_petrification: { minSB: 300, tier: 2, effect: "troops", damageType: "none", desc: "200 fighters turn to stone permanently" },
    metallic_skin: { minSB: 320, tier: 2, effect: "troops", damageType: "none", desc: "+40% armor and health for 4 turns", duration: 4 },
    transform_army: { minSB: 330, tier: 2, effect: "troops", damageType: "none", desc: "300 fighters become harmless creatures" },
    alchemical_conversion: { minSB: 340, tier: 2, effect: "friendly", damageType: "none", desc: "200 iron becomes 200 gold" },
    bestial_transformation: { minSB: 350, tier: 2, effect: "population", damageType: "none", desc: "150 population become wild beasts" },
    ultimate_petrification: { minSB: 500, tier: 3, effect: "troops", damageType: "none", desc: "500 fighters petrified forever" },
    divine_form: { minSB: 520, tier: 3, effect: "troops", damageType: "none", desc: "+50% all stats for 5 turns", duration: 5 },
    population_metamorphosis: { minSB: 530, tier: 3, effect: "population", damageType: "none", desc: "1000 population change race; defect willingly" },
    landscape_shift: { minSB: 540, tier: 3, effect: "buildings", damageType: "none", desc: "Land becomes swamps; -50% effectiveness for 4 turns", duration: 4 },
    weapon_corruption: { minSB: 550, tier: 3, effect: "troops", damageType: "none", desc: "Weapons become useless; -40% enemy troops" },
    complete_transformation: { minSB: 700, tier: 4, effect: "troops", damageType: "none", desc: "1000 fighters permanently converted" },
    dragon_form: { minSB: 730, tier: 4, effect: "troops", damageType: "none", desc: "Transform into dragon; 5000 power for 5 turns", duration: 5 },
    kingdom_alteration: { minSB: 760, tier: 4, effect: "buildings", damageType: "none", desc: "Transforms enemy terrain; -60% production" },
    transcendence: { minSB: 790, tier: 4, effect: "friendly", damageType: "none", desc: "Pure magical energy; +100% spells for 6 turns", duration: 6 },
    mass_metamorphosis: { minSB: 800, tier: 4, effect: "population", damageType: "none", desc: "2000 population become permanent servants" },
    ascendant_transformation: { minSB: 1000, tier: 5, effect: "friendly", damageType: "none", desc: "Become immortal and invincible for 7 turns", duration: 7 },
    reality_reconstruction: { minSB: 1050, tier: 5, effect: "buildings", damageType: "none", desc: "Enemy buildings change purpose; -80% effectiveness" },
    ultimate_metamorphosis: { minSB: 1080, tier: 5, effect: "population", damageType: "none", desc: "5000 population permanently converted" },
    civilization_upheaval: { minSB: 1090, tier: 5, effect: "debuff", damageType: "none", desc: "Enemy bonuses become your bonuses for 5 turns", duration: 5 },
    eternal_transmutation: { minSB: 1100, tier: 5, effect: "friendly", damageType: "none", desc: "Master of change; all enemy transformations fail for 6 turns", duration: 6 },
  },

  SCROLL_REQUIREMENTS: {
    blank_scroll: { mages: 5, turns: 5 },
    spark: { mages: 5, turns: 5 },
    fog_of_war: { mages: 8, turns: 8 },
    mend: { mages: 8, turns: 10 },
    blight: { mages: 10, turns: 12 },
    rain: { mages: 10, turns: 15 },
    dispel: { mages: 12, turns: 15 },
    lightning: { mages: 15, turns: 20 },
    bless: { mages: 15, turns: 20 },
    silence: { mages: 20, turns: 25 },
    amnesia: { mages: 20, turns: 30 },
    drain: { mages: 25, turns: 30 },
    plague: { mages: 30, turns: 40 },
    earthquake: { mages: 35, turns: 50 },
    tempest: { mages: 40, turns: 60 },
    shield: { mages: 40, turns: 60 },
    armageddon: { mages: 100, turns: 200 },

    // ABJURATION SPELLS
    arcane_ward: { mages: 5, turns: 5 },
    fortify_stones: { mages: 6, turns: 6 },
    warding_circle: { mages: 6, turns: 7 },
    banish_hex: { mages: 7, turns: 8 },
    mystic_lock: { mages: 8, turns: 10 },
    counterspell_aura: { mages: 10, turns: 15 },
    dimensional_shroud: { mages: 11, turns: 16 },
    protective_blessing: { mages: 12, turns: 18 },
    null_field: { mages: 12, turns: 20 },
    seal_the_breach: { mages: 14, turns: 22 },
    greater_barrier: { mages: 16, turns: 30 },
    reflect_curse: { mages: 18, turns: 32 },
    sanctuary: { mages: 19, turns: 35 },
    iron_skin_enchantment: { mages: 20, turns: 36 },
    unbreakable_resolve: { mages: 22, turns: 40 },
    complete_negation: { mages: 30, turns: 50 },
    prismatic_shield: { mages: 32, turns: 55 },
    planar_anchor: { mages: 35, turns: 60 },
    divine_intervention: { mages: 38, turns: 65 },
    eternal_vigilance: { mages: 40, turns: 70 },
    absolute_protection: { mages: 50, turns: 100 },
    temporal_rewind: { mages: 55, turns: 110 },
    fortress_eternal: { mages: 60, turns: 120 },
    divine_aegis: { mages: 65, turns: 130 },
    unmaking_ward: { mages: 70, turns: 150 },

    // CONJURATION SPELLS
    create_food: { mages: 5, turns: 5 },
    summon_servants: { mages: 6, turns: 6 },
    materialize_gold: { mages: 6, turns: 7 },
    conjure_supplies: { mages: 7, turns: 8 },
    summon_light: { mages: 8, turns: 10 },
    summon_beasts: { mages: 10, turns: 15 },
    greater_healing: { mages: 11, turns: 16 },
    conjure_arsenal: { mages: 12, turns: 18 },
    create_shelter: { mages: 12, turns: 20 },
    summon_messenger: { mages: 14, turns: 22 },
    summon_rats: { mages: 16, turns: 30 },
    conjure_guardian: { mages: 18, turns: 32 },
    mass_resurrection: { mages: 19, turns: 35 },
    materialize_wealth: { mages: 20, turns: 36 },
    summon_scholar: { mages: 22, turns: 40 },
    summon_avatar: { mages: 30, turns: 50 },
    conjure_abundance: { mages: 32, turns: 55 },
    summon_plague_doctor: { mages: 35, turns: 60 },
    materialize_army: { mages: 38, turns: 65 },
    conjure_fortress: { mages: 40, turns: 70 },
    summon_echo: { mages: 50, turns: 100 },
    conjure_realm: { mages: 55, turns: 110 },
    ultimate_resurrection: { mages: 60, turns: 120 },
    summon_ascendant: { mages: 65, turns: 130 },
    conjure_paradise: { mages: 70, turns: 150 },

    // DIVINATION SPELLS
    detect_presence: { mages: 5, turns: 5 },
    scry_library: { mages: 6, turns: 6 },
    read_aura: { mages: 6, turns: 7 },
    glimpse_future: { mages: 7, turns: 8 },
    minds_eye: { mages: 8, turns: 10 },
    true_sight: { mages: 10, turns: 15 },
    oracles_vision: { mages: 11, turns: 16 },
    foresee_battle: { mages: 12, turns: 18 },
    scry_wealth: { mages: 12, turns: 20 },
    divination_circle: { mages: 14, turns: 22 },
    far_seeing: { mages: 16, turns: 30 },
    chrono_vision: { mages: 18, turns: 32 },
    soul_reading: { mages: 19, turns: 35 },
    cosmic_sight: { mages: 20, turns: 36 },
    prophecy: { mages: 22, turns: 40 },
    all_knowing_eye: { mages: 30, turns: 50 },
    foresee_disaster: { mages: 32, turns: 55 },
    temporal_sight: { mages: 35, turns: 60 },
    scry_sanctum: { mages: 38, turns: 65 },
    prophetic_dream: { mages: 40, turns: 70 },
    omniscience: { mages: 50, turns: 100 },
    see_all_timelines: { mages: 55, turns: 110 },
    divine_blueprint: { mages: 60, turns: 120 },
    fates_thread: { mages: 65, turns: 130 },
    perfect_foresight: { mages: 70, turns: 150 },

    // ENCHANTMENT SPELLS
    minor_charm: { mages: 5, turns: 5 },
    fascinate_crowd: { mages: 6, turns: 6 },
    command_word: { mages: 6, turns: 7 },
    enthrall_scout: { mages: 7, turns: 8 },
    whisper: { mages: 8, turns: 10 },
    dominate_soldier: { mages: 10, turns: 15 },
    mass_confusion: { mages: 11, turns: 16 },
    charm_leader: { mages: 12, turns: 18 },
    compulsion: { mages: 12, turns: 20 },
    enchant_minds: { mages: 14, turns: 22 },
    dominate_will: { mages: 16, turns: 30 },
    mass_enthrallment: { mages: 18, turns: 32 },
    command_legion: { mages: 19, turns: 35 },
    overwhelming_charm: { mages: 20, turns: 36 },
    psychic_dominion: { mages: 22, turns: 40 },
    total_domination: { mages: 30, turns: 50 },
    break_will: { mages: 32, turns: 55 },
    mass_enslavement: { mages: 35, turns: 60 },
    control_kingdom: { mages: 38, turns: 65 },
    unbreakable_bond: { mages: 40, turns: 70 },
    absolute_domination: { mages: 50, turns: 100 },
    eternal_thralldom: { mages: 55, turns: 110 },
    shatter_consciousness: { mages: 60, turns: 120 },
    puppet_master: { mages: 65, turns: 130 },
    ascendant_will: { mages: 70, turns: 150 },

    // EVOCATION SPELLS
    inferno_burst: { mages: 5, turns: 5 },
    frost_sting: { mages: 6, turns: 6 },
    stone_missile: { mages: 6, turns: 7 },
    chain_bolt: { mages: 7, turns: 8 },
    wind_shear: { mages: 8, turns: 10 },
    meteor_shower: { mages: 10, turns: 15 },
    acid_cloud: { mages: 11, turns: 16 },
    inferno_wall: { mages: 12, turns: 18 },
    sonic_blast: { mages: 12, turns: 20 },
    blizzard: { mages: 14, turns: 22 },
    cataclysm: { mages: 16, turns: 30 },
    immolation: { mages: 18, turns: 32 },
    disintegration_ray: { mages: 19, turns: 35 },
    gravitational_crush: { mages: 20, turns: 36 },
    absolute_zero: { mages: 22, turns: 40 },
    reality_rip: { mages: 30, turns: 50 },
    solar_flare: { mages: 32, turns: 55 },
    void_storm: { mages: 35, turns: 60 },
    apocalyptic_wave: { mages: 38, turns: 65 },
    supernova: { mages: 40, turns: 70 },
    extinction_event: { mages: 50, turns: 100 },
    dimensional_collapse: { mages: 55, turns: 110 },
    infinite_inferno: { mages: 60, turns: 120 },
    entropy_unleashed: { mages: 65, turns: 130 },
    cosmic_annihilation: { mages: 70, turns: 150 },

    // ILLUSION SPELLS
    mirage_city: { mages: 5, turns: 5 },
    disguise_force: { mages: 6, turns: 6 },
    false_wealth: { mages: 6, turns: 7 },
    shadow_clones: { mages: 7, turns: 8 },
    phantom_wall: { mages: 8, turns: 10 },
    mass_hallucination: { mages: 10, turns: 15 },
    false_army: { mages: 11, turns: 16 },
    twisted_landscape: { mages: 12, turns: 18 },
    phantom_spells: { mages: 12, turns: 20 },
    deceptive_echo: { mages: 14, turns: 22 },
    great_masquerade: { mages: 16, turns: 30 },
    reality_warping: { mages: 18, turns: 32 },
    phantom_army: { mages: 19, turns: 35 },
    false_victory: { mages: 20, turns: 36 },
    perception_shatter: { mages: 22, turns: 40 },
    ultimate_deception: { mages: 30, turns: 50 },
    temporal_mirage: { mages: 32, turns: 55 },
    false_apocalypse: { mages: 35, turns: 60 },
    multiversal_echo: { mages: 38, turns: 65 },
    existence_masked: { mages: 40, turns: 70 },
    perfect_illusion: { mages: 50, turns: 100 },
    infinite_reflection: { mages: 55, turns: 110 },
    paradox_engine: { mages: 60, turns: 120 },
    false_reality: { mages: 65, turns: 130 },
    unreality: { mages: 70, turns: 150 },

    // NECROMANCY SPELLS
    touch_of_death: { mages: 5, turns: 5 },
    deaths_mark: { mages: 6, turns: 6 },
    corpse_animation: { mages: 6, turns: 7 },
    siphon_life: { mages: 7, turns: 8 },
    death_knell: { mages: 8, turns: 10 },
    undead_army: { mages: 10, turns: 15 },
    soul_trap: { mages: 11, turns: 16 },
    plague_of_death: { mages: 12, turns: 18 },
    life_drain_aura: { mages: 12, turns: 20 },
    summon_wraith: { mages: 14, turns: 22 },
    mass_undeath: { mages: 16, turns: 30 },
    death_curse: { mages: 18, turns: 32 },
    soulbind: { mages: 19, turns: 35 },
    withering_touch: { mages: 20, turns: 36 },
    zombify_population: { mages: 22, turns: 40 },
    undead_plague: { mages: 30, turns: 50 },
    death_immortal: { mages: 32, turns: 55 },
    soulflare: { mages: 35, turns: 60 },
    cursed_existence: { mages: 38, turns: 65 },
    necromantic_ascension: { mages: 40, turns: 70 },
    death_dominion: { mages: 50, turns: 100 },
    eternal_undeath: { mages: 55, turns: 110 },
    apocalyptic_undeath: { mages: 60, turns: 120 },
    deaths_embrace: { mages: 65, turns: 130 },
    lich_king: { mages: 70, turns: 150 },

    // TRANSMUTATION SPELLS
    transform_lead_to_gold: { mages: 5, turns: 5 },
    reshape_matter: { mages: 6, turns: 6 },
    flesh_to_stone: { mages: 6, turns: 7 },
    mutate_crops: { mages: 7, turns: 8 },
    transmute_population: { mages: 8, turns: 10 },
    mass_petrification: { mages: 10, turns: 15 },
    metallic_skin: { mages: 11, turns: 16 },
    transform_army: { mages: 12, turns: 18 },
    alchemical_conversion: { mages: 12, turns: 20 },
    bestial_transformation: { mages: 14, turns: 22 },
    ultimate_petrification: { mages: 16, turns: 30 },
    divine_form: { mages: 18, turns: 32 },
    population_metamorphosis: { mages: 19, turns: 35 },
    landscape_shift: { mages: 20, turns: 36 },
    weapon_corruption: { mages: 22, turns: 40 },
    complete_transformation: { mages: 30, turns: 50 },
    dragon_form: { mages: 32, turns: 55 },
    kingdom_alteration: { mages: 35, turns: 60 },
    transcendence: { mages: 38, turns: 65 },
    mass_metamorphosis: { mages: 40, turns: 70 },
    ascendant_transformation: { mages: 50, turns: 100 },
    reality_reconstruction: { mages: 55, turns: 110 },
    ultimate_metamorphosis: { mages: 60, turns: 120 },
    civilization_upheaval: { mages: 65, turns: 130 },
    eternal_transmutation: { mages: 70, turns: 150 },
  },

  SCRIBE_ITEMS: {
    map: {
      scribes: 3,
      turns: 10,
      desc: "Required to interact with another kingdom",
    },
    blueprint: {
      scribes: 5,
      turns: 20,
      desc: "Required to construct buildings.",
    },
    location_map: {
      scribes: 10,
      turns: 5,
      desc: "Uses 1 map to scribe an unmapped location into a usable map",
    },
    certified_blueprint: {
      scribes: 20,
      turns: 60,
      desc: "Required for constructing Master Mason Certified structures",
    },
    study_fragment: {
      scribes: 50,
      turns: 200,
      desc: "Study a World Fragment to determine its potential.",
    },
    hybrid_blueprint: {
      scribes: 100,
      turns: 300,
      desc: "Convert a studied fragment into a Hybrid Blueprint.",
    },
  },

  SUPPORT_CAP_RACE: {
    high_elf: { researcher: 1.5, engineer: 1.0, scribe: 1.5 },
    dwarf: { researcher: 0.9, engineer: 1.5, scribe: 1.0 },
    dire_wolf: { researcher: 0.7, engineer: 1.0, scribe: 0.7 },
    dark_elf: { researcher: 1.2, engineer: 0.9, scribe: 1.3 },
    human: { researcher: 1.0, engineer: 1.0, scribe: 1.0 },
    orc: { researcher: 0.8, engineer: 1.2, scribe: 0.8 },
    vampire: { researcher: 1.1, engineer: 0.9, scribe: 1.2 },
  },

  WM_CREW_REQUIRED: {
    dwarf: 2,
    human: 3,
    high_elf: 4,
    dark_elf: 4,
    orc: 5,
    dire_wolf: 6,
    vampire: 4,
  },

  ENGINEER_PROGRESSION: {
    10: 100,
    25: 300,
    50: 800,
    75: 2000,
    100: 5000,
  },

  BUILDING_TIER_COSTS: {
    1: { land: 10, wood: 50, stone: 0, iron: 0 },
    2: { land: 50, wood: 200, stone: 100, iron: 50 },
    3: { land: 150, wood: 800, stone: 500, iron: 200 },
    4: { land: 300, wood: 2000, stone: 1500, iron: 500 },
    5: { land: 500, wood: 5000, stone: 5000, iron: 1500 },
    6: { land: 750, wood: 7500, stone: 12500, iron: 3000 },
    7: { land: 850, wood: 8500, stone: 17500, iron: 4000 },
    8: { land: 1000, wood: 10000, stone: 25000, iron: 5000 },
  },

  BUILDING_TIER_TIMES: {
    1: 10,
    2: 100,
    3: 500,
    4: 2500,
    5: 10000,
    6: 25000,
    7: 35000,
    8: 50000,
  },

  BUILDING_TIERS: {
    bld_farms: 1,
    bld_housing: 2,
    bld_granaries: 2,
    bld_taverns: 2,
    bld_markets: 3,
    bld_barracks: 3,
    bld_libraries: 3,
    bld_schools: 3,
    bld_shrines: 3,
    bld_mausoleums: 3,
    bld_guard_towers: 4,
    bld_walls: 5,
    bld_outposts: 5,
    bld_smithies: 5,
    bld_armories: 6,
    bld_vaults: 6,
    bld_mage_towers: 6,
    bld_training: 7,
    bld_castles: 8,
  },

  UNIT_LEVEL_25_BONUSES: {
    dwarf: { unit: "engineers", bonus: "solo_crew_wm" },
    high_elf: { unit: "mages", bonus: "double_scroll_craft" },
    orc: { unit: "fighters", bonus: "free_trainee_generation" },
    dark_elf: { unit: "ninjas", bonus: "silent_assassination" },
    dire_wolf: { unit: "rangers", bonus: "fast_expeditions" },
    human: { unit: "clerics", bonus: "morale_aura" },
    vampire: { unit: "thieves", bonus: "theft_boost" },
  },

  RESEARCH_MAP: {
    economy: "res_economy",
    weapons: "res_weapons",
    armor: "res_armor",
    military: "res_military",
    spellbook: "res_spellbook",
    school_spellbook: "school_spellbook",
    attack_magic: "res_attack_magic",
    defense_magic: "res_defense_magic",
    entertainment: "res_entertainment",
    construction: "res_construction",
    war_machines: "res_war_machines",
  },

  BUILDING_ALIASES: {
    farm: "farms",
    granary: "granaries",
    outpost: "outposts",
    tower: "guard_towers",
    school: "schools",
    armory: "armories",
    vault: "vaults",
    smithy: "smithies",
    market: "markets",
    mage_tower: "mage_towers",
    shrine: "shrines",
    castle: "castles",
    library: "libraries",
    tavern: "taverns",
    weapon: "weapons",
    armour: "armor",
    mausoleum: "mausoleums",
  },

  RACIAL_UNITS: {
    high_elf: "mages",
    dwarf: "engineers",
    dire_wolf: "rangers",
    dark_elf: "ninjas",
    human: "clerics",
    orc: "fighters",
    vampire: "clerics",
  },

  RACIAL_BONUSES_DEFS: {
    mages: {
      name: "Mage Mastery",
      desc: "+25% mana cap, +10% spell resistance",
    },
    engineers: {
      name: "Mason Mastery",
      desc: "+20% structure HP, -15% maintenance cost",
    },
    fighters: { name: "Warrior Mastery", desc: "+15% raw combat strength" },
    ninjas: {
      name: "Shadow Mastery",
      desc: "Assassinate 5% extra troops per combat",
    },
    clerics: {
      name: "Divine Mastery",
      desc: "+20% healing, +10% morale stability",
    },
    rangers: {
      name: "Wolf Mastery",
      desc: "+20% ranged attack and +10% exploration speed",
    },
    thralls: {
      name: "Blood Bond",
      desc: "Thralls defend the stronghold with massive fervor in daylight. Fallen enemies rise as Thralls.",
    },
  },

  WORLD_FRAGMENTS: [
    "Volcanic Rock",
    "Ancient Elven Wood",
    "Dragon Scale",
    "Abyssal Crystal",
    "Celestial Feather",
    "Dwarven Star-Metal",
    "Cursed Bloodstone",
    "Tears of the World Tree",
    "Void Essence",
    "Titan Bone",
  ],

  EXPEDITION_CONSTANTS: {
    deepFragmentChance: 0.05,
    dungeonFragmentChance: 0.1,
    deepUltraRareChance: 0.005,
    dungeonUltraRareChance: 0.01,
  },

  COMBAT_CONSTANTS: {
    baseAttackCost: 10,
    baseSpellCost: 5,
    baseCovertCost: 3,
    defenseDifficulty: 1.0,
  },

  JUNK_EVENTS: [],
  TAX_EVENTS: [],

  INVENTORY_ITEMS: {
    suspicious_rock: { name: "Suspicious Rock", desc: "A mysterious stone found during expeditions. Rumored to have value when collected in large quantities.", rarity: "junk" },
    damp_sock: { name: "Suspiciously Damp Sock", desc: "Still wet for reasons unknown. A collectible curiosity.", rarity: "junk" },
    old_map: { name: "Old Map", desc: "A map to a location that no longer exists. Utterly useless.", rarity: "junk" },
    fortune_cookie: { name: "Fortune Cookie", desc: "A very confident fortune cookie with no fortune inside. The confidence is unwarranted.", rarity: "junk" },
    ration_bar: { name: "Half-Eaten Ration Bar", desc: "Of unknown vintage. Probably not safe to eat.", rarity: "junk" },
    grey_paste: { name: "Mysterious Grey Paste", desc: "In a jar. The label says 'do not eat' but you're not sure if you can trust it.", rarity: "junk" },
    bent_sword: { name: "Slightly Bent Sword", desc: "The previous owner called it 'Destiny'. They were not a good judge of swords.", rarity: "junk" },
    ancient_flag: { name: "Ancient Flag", desc: "A tiny flag from a kingdom that fell 300 years ago. Collectors' item.", rarity: "junk" },
    love_letter: { name: "Love Letter", desc: "Addressed to someone named Grimbold. Awkwardly romantic.", rarity: "junk" },
    dirt_collection: { name: "Dirt Collection", desc: "47 different types of dirt. Some collectors dedicate their lives to this.", rarity: "junk" },
    single_boot: { name: "Single Boot", desc: "Just the one. Its pair has been lost to history.", rarity: "junk" },
    swamp_certificate: { name: "Swamp Festival Certificate", desc: "A certificate of participation from the Third Annual Swamp Festival. Proof you were there.", rarity: "junk" },
    sentient_cheese: { name: "Sentient Cheese", desc: "A wheel of cheese that has achieved sentience (probably). Handle with existential care.", rarity: "junk" },
    magic_beans: { name: "Magic Beans", desc: "A bag of magic beans that are, on closer inspection, just beans. False advertising.", rarity: "junk" },
    knitting_guide: { name: "Knitting Guide", desc: "A very thorough guide to knitting. No one in your kingdom knows how to read.", rarity: "junk" },
    mysterious_smell: { name: "Mysterious Smell", desc: "A suspicious smell that follows rangers home. Possibly permanent.", rarity: "junk" },
    static_crystal: { name: "Crystal Ball", desc: "A crystal ball showing only static. Useless for divination.", rarity: "junk" },
    cloud_painting: { name: "Cloud Painting", desc: "An extremely detailed painting of a cloud. The artist had issues.", rarity: "junk" },
    dwarf_shopping_list: { name: "Dwarf's Shopping List", desc: "Mostly cheese. Dwarves have their priorities.", rarity: "junk" },
    daylight_torch: { name: "Daylight Torch", desc: "A torch that only works in daylight. Defeats the purpose entirely.", rarity: "junk" },
    poverty_book: { name: "How To Stop Being Poor", desc: "All pages blank. Not actually helpful.", rarity: "junk" },
    rusty_key: { name: "Rusty Key", desc: "To an unknown lock. The lock is probably lost anyway.", rarity: "junk" },
    proclamation: { name: "Royal Proclamation", desc: "Declaring your kingdom 'pretty good, probably'. High praise indeed.", rarity: "junk" },
    old_coupon: { name: "Inn Coupon", desc: "10% off at an inn that burned down decades ago. Can't be redeemed.", rarity: "junk" },
  },

  JUNK_PRIZES: [
    { id: "damp_sock", msg: "a suspiciously damp sock" },
    { id: "old_map", msg: "a map to a location that no longer exists" },
    { id: "fortune_cookie", msg: "a very confident fortune cookie with no fortune inside" },
    { id: "ration_bar", msg: "a half-eaten ration bar of unknown vintage" },
    { id: "suspicious_rock", msg: "a mysterious rock" },
    { id: "orcs_pamphlet", msg: 'a pamphlet titled "10 Reasons Orcs Are Actually Quite Misunderstood"' },
    { id: "grey_paste", msg: "a jar of mysterious grey paste (do not eat)" },
    { id: "bent_sword", msg: 'a slightly bent sword that the previous owner called "Destiny"' },
    { id: "ancient_flag", msg: "a tiny flag from a kingdom that fell 300 years ago" },
    { id: "love_letter", msg: "a love letter addressed to someone named Grimbold" },
    { id: "dirt_collection", msg: "a collection of 47 different types of dirt" },
    { id: "single_boot", msg: "a boot (just the one)" },
    { id: "swamp_certificate", msg: "a certificate of participation from the Third Annual Swamp Festival" },
    { id: "sentient_cheese", msg: "a wheel of cheese that has achieved sentience (probably)" },
    { id: "magic_beans", msg: "a bag of magic beans that are, on closer inspection, just beans" },
    { id: "knitting_guide", msg: "a very thorough guide to knitting (no one in your kingdom knows how to read)" },
    { id: "mysterious_smell", msg: "a suspicious smell that follows rangers home" },
    { id: "static_crystal", msg: "a crystal ball showing only static" },
    { id: "cloud_painting", msg: "an extremely detailed painting of a cloud" },
    { id: "dwarf_shopping_list", msg: "a dwarf's shopping list (mostly cheese)" },
    { id: "daylight_torch", msg: "a torch that only works in daylight" },
    { id: "poverty_book", msg: 'a book called "How To Stop Being Poor" — all pages blank' },
    { id: "rusty_key", msg: "a rusty key to an unknown lock" },
    { id: "proclamation", msg: 'a proclamation declaring your kingdom "pretty good, probably"' },
    { id: "old_coupon", msg: "a coupon for 10% off at an inn that burned down decades ago" },
    { id: "moldy_cheese", msg: "a wheel of impressively moldy cheese from an unknown era" },
    { id: "broken_compass", msg: "a broken compass that spins wildly and points in all directions" },
    { id: "empty_potion", msg: "an empty potion bottle with a faint magical smell" },
    { id: "ancient_coin", msg: "a coin from a civilization that never actually existed" },
    { id: "glowing_stone", msg: "a stone that glows faintly at night (and only at night)" },
    { id: "tattered_map", msg: "a map so tattered you can't tell where it points to anymore" },
    { id: "cursed_amulet", msg: "an amulet cursed to give the finder mild inconveniences" },
    { id: "petrified_carrot", msg: "a carrot that has somehow turned to stone" },
    { id: "love_poem", msg: "a love poem written in code no one has ever deciphered" },
    { id: "wanted_poster", msg: "a wanted poster for someone nobody remembers" },
    { id: "broken_lute", msg: "a lute with all the strings snapped at exactly the same length" },
    { id: "mysterious_egg", msg: "an egg of unknown origin that never hatches" },
    { id: "withered_flower", msg: "a flower that bloomed 200 years ago and never wilted" },
    { id: "chipped_crown", msg: "a crown that is definitely not real gold, probably" },
    { id: "faded_portrait", msg: "a portrait of someone nobody can identify" },
    { id: "warped_flute", msg: "a flute that plays notes that shouldn't exist" },
    { id: "golden_acorn", msg: "an acorn that is somehow made of gold but weighs nothing" },
    { id: "incomplete_puzzle", msg: "a puzzle missing exactly one piece (always the same piece)" },
    { id: "bottled_scream", msg: "a bottle containing what sounds suspiciously like a scream" },
    { id: "library_card", msg: "a library card from a library that burned down 500 years ago" },
    { id: "crystallized_honey", msg: "honey so old it has become crystalline and slightly sentient" },
    { id: "stolen_ring", msg: "a ring with 'stolen' engraved on the inside" },
    { id: "night_light", msg: "a magical light that only works at midnight" },
    { id: "ghost_ink", msg: "ink that is invisible except under moonlight" },
    { id: "clock_hands", msg: "two clock hands with no clock, always pointing in different directions" },
  ],

  ULTRA_RARE_PRIZES: [
    {
      id: "ancient_dragon_egg",
      text: "🥚 An ancient dragon egg, still warm — it pulses with primordial magic",
      effect: (k, updates) => {
        updates.res_attack_magic = (k.res_attack_magic || 0) + 75;
        updates.res_spellbook = (k.res_spellbook || 0) + 50;
        updates.mana = (k.mana || 0) + 5000;
      },
    },
    {
      id: "tome_of_forgotten_kings",
      text: "📖 The Tome of Forgotten Kings — ancient military wisdom permanently inscribed in your kingdom's history",
      effect: (k, updates) => {
        updates.res_military = (k.res_military || 0) + 80;
        updates.res_weapons = (k.res_weapons || 0) + 50;
        updates.res_armor = (k.res_armor || 0) + 50;
      },
    },
    {
      id: "crystalline_mana_heart",
      text: "💎 A crystalline mana heart — it hums with a frequency older than the world itself",
      effect: (k, updates) => {
        updates.mana = (k.mana || 0) + 20000;
        updates.res_defense_magic = (k.res_defense_magic || 0) + 60;
        updates.res_spellbook = (k.res_spellbook || 0) + 100;
      },
    },
    {
      id: "vault_of_the_ancients",
      text: "💰 A sealed vault of the Ancient Ones — untold riches beyond imagining",
      effect: (k, updates) => {
        updates.gold = (k.gold || 0) + 500000;
        updates.res_economy = (k.res_economy || 0) + 60;
      },
    },
    {
      id: "lost_legion_banner",
      text: "⚔️ The Banner of the Lost Legion — ten thousand warriors emerge from the mist and pledge their eternal service",
      effect: (k, updates) => {
        updates.fighters = (k.fighters || 0) + 10000;
        updates.res_military = (k.res_military || 0) + 40;
      },
    },
    {
      id: "seed_of_the_world_tree",
      text: "🌳 The Seed of the World Tree — your lands bloom with ancient fertility",
      effect: (k, updates) => {
        updates.land = (k.land || 0) + 500;
        updates.bld_farms = (k.bld_farms || 0) + 100;
        updates.population = (k.population || 0) + 50000;
      },
    },
  ],

  THRONE_OF_NAZDREG: {
    id: "throne_of_nazdreg",
    unique: true,
    text: [
      "👑 The Throne of Nazdreg Grishnak",
      "",
      "Your rangers stumble upon a clearing unlike any other.",
      "Vines have claimed it, but beneath the green — a throne of obsidian and iron,",
      "carved with the fury and grace of a warrior who loved deeply and lived fully.",
      "",
      "Inscribed in the stone, worn smooth by years of wilderness rain:",
      "",
      "    Nazdreg Grishnak",
      "    August 13, 1975 — August 19, 2012",
      "",
      "An orc who sat upon this throne once commanded armies and shaped the world.",
      "His name is remembered. His legacy endures.",
      "",
      "Your people carry the throne home with reverence.",
      "They say the land itself feels stronger for it.",
    ].join("\n"),
    effect: (k, updates) => {
      updates.res_military = (k.res_military || 0) + 100;
      updates.res_economy = (k.res_economy || 0) + 100;
      updates.res_construction = (k.res_construction || 0) + 100;
      updates.res_weapons = (k.res_weapons || 0) + 100;
      updates.res_armor = (k.res_armor || 0) + 100;
      updates.res_entertainment = (k.res_entertainment || 0) + 100;
      updates.gold = (k.gold || 0) + 1000000;
      updates.land = (k.land || 0) + 1000;
      updates.population = (k.population || 0) + 100000;
      const natCap = (k.res_entertainment || 0) + 100; // approximation of new cap
      updates.morale = Math.min(
        natCap * 2,
        (k.morale || 100) + Math.floor(natCap * 0.5),
      );
      updates.fighters = (k.fighters || 0) + 50000;
    },
  },

  EXPEDITION_TURNS: { scout: 10, deep: 25, dungeon: 50 },

  // ── Resource gathering system ─────────────────────────────────────────────────

  RESOURCE_BUILDING_CONFIG: {
    woodyard:     { type: 'wood',  stage: 1, workersPerBuilding: 10,  yield: 1, yieldEvery: 5 },
    lumber_camp:  { type: 'wood',  stage: 2, workersPerBuilding: 25,  yield: 3, yieldEvery: 5 },
    sawmill:      { type: 'wood',  stage: 3, workersPerBuilding: 75,  yield: 1, yieldEvery: 1 },
    gravel_pit:   { type: 'stone', stage: 1, workersPerBuilding: 30,  yield: 1, yieldEvery: 5 },
    blockfield:   { type: 'stone', stage: 2, workersPerBuilding: 75,  yield: 3, yieldEvery: 5 },
    stone_quarry: { type: 'stone', stage: 3, workersPerBuilding: 225, yield: 1, yieldEvery: 1 },
    open_pit:     { type: 'iron',  stage: 1, workersPerBuilding: 20,  yield: 1, yieldEvery: 5 },
    strip_mine:   { type: 'iron',  stage: 2, workersPerBuilding: 50,  yield: 3, yieldEvery: 5 },
    deep_mine:    { type: 'iron',  stage: 3, workersPerBuilding: 150, yield: 1, yieldEvery: 1 },
  },

  // Stage 2 building: consumes 3x stage-1 on first completion
  // Stage 3 building: consumes 5x stage-2 on first completion in bracket
  RESOURCE_STAGE2_BUILDINGS: { wood: 'lumber_camp', stone: 'blockfield', iron: 'strip_mine' },
  RESOURCE_STAGE3_BUILDINGS: { wood: 'sawmill', stone: 'stone_quarry', iron: 'deep_mine' },
  RESOURCE_STAGE1_BUILDINGS: { wood: 'woodyard', stone: 'gravel_pit', iron: 'open_pit' },
  RESOURCE_STAGE1_COL:       { wood: 'bld_woodyard', stone: 'bld_gravel_pit', iron: 'bld_open_pit' },
  RESOURCE_STAGE2_COL:       { wood: 'bld_lumber_camp', stone: 'bld_blockfield', iron: 'bld_strip_mine' },
  RESOURCE_STAGE3_COL:       { wood: 'bld_sawmill', stone: 'bld_stone_quarry', iron: 'bld_deep_mine' },

  // Elemental fragments
  ELEMENTAL_FRAGMENTS: [
    { id: 'earth_fragment', name: 'Earth Fragment' },
    { id: 'water_fragment', name: 'Water Fragment' },
    { id: 'fire_fragment', name: 'Fire Fragment' },
    { id: 'air_fragment', name: 'Air Fragment' },
  ],

  // Rare items by resource type
  RARE_RESOURCE_ITEMS: {
    wood: [
      { id: 'ancient_oak_shard',    name: 'Ancient Oak Shard' },
      { id: 'petrified_heartwood',  name: 'Petrified Heartwood' },
      { id: 'ironbark_splinter',    name: 'Ironbark Splinter' },
    ],
    stone: [
      { id: 'crystalline_core',     name: 'Crystalline Core' },
      { id: 'primordial_geode',     name: 'Primordial Geode' },
      { id: 'fossil_remnant',       name: 'Fossil Remnant' },
    ],
    iron: [
      { id: 'meteoric_shard',       name: 'Meteoric Shard' },
      { id: 'deep_vein_ore',        name: 'Deep Vein Ore' },
      { id: 'lodestone_fragment',   name: 'Lodestone Fragment' },
    ],
  },

  // Junk messages for wood production random events (20% worthless find)
  RESOURCE_JUNK_MESSAGES: [
    "Your lumberjacks found a perfectly round rock. It does nothing. They named it Gerald.",
    "Workers discovered an angry badger living in a hollow log. The badger won.",
    "Your foresters tripped over a tree root so spectacular they stopped to admire it.",
    "Lumberjacks found a bird's nest full of suspiciously shiny pebbles. Not gold.",
    "Workers uncovered a message in a bottle. It just said 'more trees needed'.",
    "A squirrel stole a woodcutter's lunch. The kingdom mourns the sandwiches.",
    "Your foresters found a very old boot. Just the one. They returned it to the forest.",
    "Workers spotted what they thought was a rare herb. It was a weed. A very confident weed.",
    "A lumberjack carved their initials into a log and immediately forgot their initials.",
    "Your crew found a perfect chopping spot, then couldn't agree who should go first.",
    "Workers discovered a hollow tree full of acorns. The squirrels are filing a complaint.",
    "A saw blade snagged on an oddly resilient knot. Everyone blamed a different person.",
    "Your woodcutters found evidence of a previous camp. They left it nicer than they found it.",
    "A large moth disrupted operations for six minutes. Everyone agreed it was impressive.",
    "Workers unearthed a badly decomposed fence post. Historical significance: unknown.",
  ],

  // Resource node name pools by type
  RESOURCE_NODE_NAMES: {
    wood: [
      'Whispering Pines', 'Ashbark Grove', 'Thornwood Stand', 'Ironleaf Forest',
      'Greywood Thicket', 'Mossveil Copse', 'Duskbranch Hollow', 'Splinterfall Woods',
      'Emberbough Forest', 'The Gnarled Reach', 'Rootveil Glade', 'Canopy Vale',
    ],
    stone: [
      'Cracked Bluff', 'Stonehaven Ridge', 'The Flinty Shelf', 'Ashstone Vein',
      'Granite Shelf', 'Quarryman\'s Peak', 'Rubble Scarp', 'The Rimwall',
      'Dustcliff Outcrop', 'The Pale Ledge', 'Ironstone Scarps', 'Slate Hollow',
    ],
    iron: [
      'Rustwater Mine', 'Deep Crescent Shaft', 'The Ochre Seam', 'Ironveil Tunnels',
      'Charcoal Drift', 'Black Lode Pit', 'The Sunken Vein', 'Hammerstrike Dig',
      'Ore Fang Cavern', 'The Bleeding Seam', 'Forge\'s Root', 'Slag Hollow',
    ],
    gold: [
      'Glinting Gorge', 'The Auric Shelf', 'Nugget Ravine', 'Fool\'s Claim',
      'The Lucky Strike', 'Shimmervein Pass', 'Golden Furrow', 'Coin\'s End',
    ],
  },

  // Harvest duration by richness (seconds)
  HARVEST_DURATION_BY_RICHNESS: { 1: 1800, 2: 3600, 3: 7200, 4: 14400, 5: 28800 },

  LORE_EVENTS: (function () {
    const events = {
      high_elf: [
        {
          id: "he_1",
          title: "Lunar Eclipse",
          msg: "A rare lunar eclipse has bathed the Silverwood in violet light. Your mages report that the Ley Lines are thrumming with ancient resonance.",
        },
        {
          id: "he_2",
          title: "Vision of the First Age",
          msg: "The High Council of Elders has shared a vision of the First Age. Immersion in history has bolstered your kingdom's prestige.",
        },
        {
          id: "he_3",
          title: "Envoy from Hidden Glade",
          msg: "A diplomatic envoy from the Hidden Glade has arrived, bringing scrolls of forgotten poetry and architectural secrets.",
        },
      ],
      dwarf: [
        {
          id: "dw_1",
          title: "Living Granite Vein",
          msg: "Deep-scouts have uncovered a vein of 'Living Granite' in the lower depths of the Iron Holds. Ancient runic carvings confirm it was intended for a Great Gate.",
        },
        {
          id: "dw_2",
          title: "Week of Remembrance",
          msg: "The Brewmaster's Guild has declared a week of Remembrance. Hammers fall silent as the songs of the ancestors fill the great caverns.",
        },
        {
          id: "dw_3",
          title: "Archive of Steam",
          msg: "A massive steam-burst in the Geyser-Works revealed a cached archive of steam-engine blueprints from the Era of Industry.",
        },
      ],
      dire_wolf: [
        {
          id: "di_1",
          title: "Gathering under Ashfang",
          msg: "A great pack-gathering occurred under the Ashfang moon. The elders spoke of the 'First Hunt' and the blood-ties that bind the wilds.",
        },
        {
          id: "di_2",
          title: "Monolith of Bone",
          msg: "A blizzard has unearthed an ancient monolith of bone. Your trackers sense a lingering aura of the Great Pack-Mother.",
        },
        {
          id: "di_3",
          title: "Scent of Old Magic",
          msg: "The winds from the northern peaks carry the scent of old magic. Your rangers find signs of the spirit-kin returning to the Ash-Tainted groves.",
        },
      ],
      dark_elf: [
        {
          id: "da_1",
          title: "Quiet Night-Market",
          msg: "The Night-Market in Underspire was unusually quiet tonight. Rumors of the 'Silent Treaty' are circulating among the shadow-cloaks.",
        },
        {
          id: "da_2",
          title: "Mural of Matriarch",
          msg: "A collapse in the lower tunnels revealed a mural depicting the descent of the First Matriarch. The historical weight is palpable.",
        },
        {
          id: "da_3",
          title: "Cipher Decoded",
          msg: "The Poisoner's Guild has decoded a cipher from the Age of Betrayal. Subtle shifts in the power balance follow.",
        },
      ],
      human: [
        {
          id: "hu_1",
          title: "Saga of the Unbroken",
          msg: "A traveling troupe of bards in the Heartlands is performing the 'Saga of the Unbroken Kingdom'. Loyalty to the throne swells.",
        },
        {
          id: "hu_2",
          title: "Antique Ledgers",
          msg: "A hidden cellar in a crossroads inn yielded a collection of antique trade ledgers dating back to the Merchant-King's reign.",
        },
        {
          id: "hu_3",
          title: "Harvest Festival",
          msg: "The harvest festival this year is particularly vibrant. Eldest villagers recount tales of the land's bounty before the Great Sundering.",
        },
      ],
      orc: [
        {
          id: "or_1",
          title: "War-drums of Bloodplains",
          msg: "The war-drums of the Bloodplains beat with a rhythm not heard for generations. The spirit of the Great Khan is said to be stirring.",
        },
        {
          id: "or_2",
          title: "Ghosts of Old Guard",
          msg: "A trial by combat near the Scarred Monolith ended in a draw, with both warriors claiming they saw the ghosts of the Old Guard.",
        },
        {
          id: "or_3",
          title: "Cache of Axe-heads",
          msg: "Your scouts found a buried cache of obsidian axe-heads. The craftsmanship predates even the earliest known Orcish settlements.",
        },
      ],
      vampire: [
        {
          id: "va_1",
          title: "Blood Moon Rising",
          msg: "The Blood Moon bathes the Crimson Vales in a crimson glow. The Thralls have begun working with renewed, tireless vigor.",
        },
        {
          id: "va_2",
          title: "Unearthed Crypt",
          msg: "A sinkhole has revealed an ancient, subterranean crypt. The elder vampires recognize the sigils of the Night-Kings.",
        },
        {
          id: "va_3",
          title: "Bat Swarms",
          msg: "Unnatural swarms of bats have blotted out the sun, extending the night by precious hours. The infiltrators are emboldened.",
        },
      ],
    };
    return events;
  })(),

  CAPS: {
    fighters: { base: 500, max: 5000000 },
    rangers: { base: 250, max: 2000000 },
    clerics: { base: 100, max: 1000000 },
    mages: { base: 100, max: 1000000 },
    thieves: { base: 100, max: 500000 },
    ninjas: { base: 50, max: 250000 },
    bld_walls: { base: 50, max: 1000, capLevel: 500 },
    bld_granaries: { base: 5, max: 200, capLevel: 500 },
    bld_barracks: { base: 5, max: 150, capLevel: 500 },
    bld_outposts: { base: 5, max: 100, capLevel: 500 },
    bld_guard_towers: { base: 5, max: 100, capLevel: 500 },
    bld_schools: { base: 5, max: 100, capLevel: 500 },
    bld_armories: { base: 5, max: 150, capLevel: 500 },
    bld_vaults: { base: 5, max: 100, capLevel: 500 },
    bld_smithies: { base: 3, max: 50, capLevel: 400 },
    bld_markets: { base: 3, max: 50, capLevel: 500 },
    bld_mage_towers: { base: 2, max: 25, capLevel: 400 },
    bld_shrines: { base: 3, max: 50, capLevel: 400 },
    bld_mausoleums: { base: 3, max: 50, capLevel: 400 },
    bld_taverns: { base: 3, max: 50, capLevel: 400 },
    bld_libraries: { base: 3, max: 75, capLevel: 500 },
    bld_training: { base: 1, max: 15, capLevel: 400 },
    bld_castles: { base: 1, max: 10, capLevel: 400 },
    war_machines: { base: 1000, max: 10000 },
    res_economy: { base: 100, max: 10000 },
    res_weapons: { base: 100, max: 10000 },
    res_armor: { base: 100, max: 10000 },
    res_military: { base: 100, max: 10000 },
    res_spellbook: { base: 500, max: 500000 },
    res_attack_magic: { base: 100, max: 10000 },
    res_defense_magic: { base: 100, max: 10000 },
    res_entertainment: { base: 100, max: 10000 },
    res_construction: { base: 100, max: 10000 },
    res_war_machines: { base: 100, max: 10000 },
  },

  // Level milestones: every 25 levels (25–500). Each entry has a title and
  // race-keyed rewards. Missing races fall back to "default".
  // Reward keys: gold, land, fighters, researchers, thieves, ninjas,
  // bonus: { gold_income_pct, attack_pct, defense_pct, research_speed_pct,
  //          construction_speed_pct, covert_pct }
  MILESTONES: {
    25:  { title: "Budding Ruler",       rewards: { default: { gold: 25000 }, human: { gold: 31250 }, dwarf: { gold: 37500 }, vampire: { gold: 31250 } } },
    50:  { title: "Established Lord",    rewards: { default: { gold: 50000, fighters: 100 }, human: { gold: 62500, fighters: 100 }, high_elf: { gold: 50000, researchers: 100 }, dwarf: { gold: 75000, fighters: 100 }, dire_wolf: { gold: 50000, fighters: 200 }, dark_elf: { gold: 50000, thieves: 100 }, orc: { gold: 50000, fighters: 200 }, vampire: { gold: 62500, fighters: 150 } } },
    75:  { title: "Regional Power",      rewards: { default: { gold: 75000, land: 50 }, human: { gold: 93750, land: 50 }, dwarf: { gold: 112500, land: 50 }, vampire: { gold: 93750, land: 50 } } },
    100: { title: "Grand Duke",          rewards: { default: { gold: 150000, fighters: 200, bonus: { gold_income_pct: 1 } }, human: { gold: 187500, fighters: 200, bonus: { gold_income_pct: 1 } }, high_elf: { gold: 150000, researchers: 200, bonus: { gold_income_pct: 1 } }, dwarf: { gold: 225000, fighters: 200, bonus: { gold_income_pct: 2 } }, dire_wolf: { gold: 150000, fighters: 400, bonus: { gold_income_pct: 1 } }, dark_elf: { gold: 150000, thieves: 200, bonus: { gold_income_pct: 1 } }, orc: { gold: 150000, fighters: 400, bonus: { gold_income_pct: 1 } }, vampire: { gold: 187500, fighters: 300, bonus: { gold_income_pct: 1 } } } },
    125: { title: "Proven Warlord",      rewards: { default: { gold: 100000, bonus: { attack_pct: 1 } }, human: { gold: 125000, bonus: { attack_pct: 1 } }, high_elf: { gold: 100000, bonus: { attack_pct: 1 } }, dwarf: { gold: 150000, bonus: { attack_pct: 1 } }, dire_wolf: { gold: 100000, bonus: { attack_pct: 1.5 } }, dark_elf: { gold: 100000, bonus: { attack_pct: 1 } }, orc: { gold: 100000, bonus: { attack_pct: 1.5 } }, vampire: { gold: 125000, bonus: { attack_pct: 1 } } } },
    150: { title: "Master Builder",      rewards: { default: { gold: 125000, land: 100, bonus: { construction_speed_pct: 1 } }, human: { gold: 156250, land: 100, bonus: { construction_speed_pct: 1 } }, high_elf: { gold: 125000, land: 100, bonus: { construction_speed_pct: 1 } }, dwarf: { gold: 187500, land: 100, bonus: { construction_speed_pct: 2 } }, dire_wolf: { gold: 125000, land: 100, bonus: { construction_speed_pct: 1 } }, dark_elf: { gold: 125000, land: 100, bonus: { construction_speed_pct: 1 } }, orc: { gold: 125000, land: 100, bonus: { construction_speed_pct: 1 } }, vampire: { gold: 156250, land: 100, bonus: { construction_speed_pct: 1 } } } },
    175: { title: "Sage of the Realm",   rewards: { default: { gold: 125000, bonus: { research_speed_pct: 1 } }, human: { gold: 156250, bonus: { research_speed_pct: 1 } }, high_elf: { gold: 125000, bonus: { research_speed_pct: 2 } }, dwarf: { gold: 187500, bonus: { research_speed_pct: 1 } }, dire_wolf: { gold: 125000, bonus: { research_speed_pct: 1 } }, dark_elf: { gold: 125000, bonus: { research_speed_pct: 1 } }, orc: { gold: 125000, bonus: { research_speed_pct: 1 } }, vampire: { gold: 156250, bonus: { research_speed_pct: 1 } } } },
    200: { title: "High King",           rewards: { default: { gold: 300000, fighters: 500, bonus: { gold_income_pct: 1, defense_pct: 1 } }, human: { gold: 375000, fighters: 500, bonus: { gold_income_pct: 1, defense_pct: 1 } }, high_elf: { gold: 300000, researchers: 500, bonus: { gold_income_pct: 1, defense_pct: 1 } }, dwarf: { gold: 450000, fighters: 500, bonus: { gold_income_pct: 2, defense_pct: 1 } }, dire_wolf: { gold: 300000, fighters: 1000, bonus: { gold_income_pct: 1, defense_pct: 1 } }, dark_elf: { gold: 300000, thieves: 500, bonus: { gold_income_pct: 1, defense_pct: 1 } }, orc: { gold: 300000, fighters: 1000, bonus: { gold_income_pct: 1, defense_pct: 1 } }, vampire: { gold: 375000, fighters: 750, bonus: { gold_income_pct: 1, defense_pct: 1 } } } },
    225: { title: "Strategist",          rewards: { default: { gold: 200000, bonus: { attack_pct: 1 } }, human: { gold: 250000, bonus: { attack_pct: 1 } }, high_elf: { gold: 200000, bonus: { attack_pct: 1 } }, dwarf: { gold: 300000, bonus: { attack_pct: 1 } }, dire_wolf: { gold: 200000, bonus: { attack_pct: 1.5 } }, dark_elf: { gold: 200000, bonus: { attack_pct: 1 } }, orc: { gold: 200000, bonus: { attack_pct: 1.5 } }, vampire: { gold: 250000, bonus: { attack_pct: 1 } } } },
    250: { title: "Dominator",           rewards: { default: { gold: 250000, land: 200, bonus: { covert_pct: 1 } }, human: { gold: 312500, land: 200, bonus: { covert_pct: 1 } }, high_elf: { gold: 250000, land: 200, bonus: { covert_pct: 1 } }, dwarf: { gold: 375000, land: 200, bonus: { covert_pct: 1 } }, dire_wolf: { gold: 250000, land: 200, bonus: { covert_pct: 1 } }, dark_elf: { gold: 250000, land: 200, bonus: { covert_pct: 2 } }, orc: { gold: 250000, land: 200, bonus: { covert_pct: 1 } }, vampire: { gold: 312500, land: 200, bonus: { covert_pct: 1.5 } } } },
    275: { title: "Arcane Authority",    rewards: { default: { gold: 200000, bonus: { research_speed_pct: 1 } }, human: { gold: 250000, bonus: { research_speed_pct: 1 } }, high_elf: { gold: 200000, bonus: { research_speed_pct: 2 } }, dwarf: { gold: 300000, bonus: { research_speed_pct: 1 } }, dire_wolf: { gold: 200000, bonus: { research_speed_pct: 1 } }, dark_elf: { gold: 200000, bonus: { research_speed_pct: 1 } }, orc: { gold: 200000, bonus: { research_speed_pct: 1 } }, vampire: { gold: 250000, bonus: { research_speed_pct: 1 } } } },
    300: { title: "Realm Sovereign",     rewards: { default: { gold: 500000, fighters: 1000, bonus: { gold_income_pct: 1, attack_pct: 1 } }, human: { gold: 625000, fighters: 1000, bonus: { gold_income_pct: 1, attack_pct: 1 } }, high_elf: { gold: 500000, researchers: 1000, bonus: { gold_income_pct: 1, attack_pct: 1 } }, dwarf: { gold: 750000, fighters: 1000, bonus: { gold_income_pct: 2, attack_pct: 1 } }, dire_wolf: { gold: 500000, fighters: 2000, bonus: { gold_income_pct: 1, attack_pct: 1.5 } }, dark_elf: { gold: 500000, thieves: 1000, bonus: { gold_income_pct: 1, attack_pct: 1 } }, orc: { gold: 500000, fighters: 2000, bonus: { gold_income_pct: 1, attack_pct: 1.5 } }, vampire: { gold: 625000, fighters: 1500, bonus: { gold_income_pct: 1, attack_pct: 1 } } } },
    325: { title: "Grand Marshal",       rewards: { default: { gold: 300000, land: 250, bonus: { defense_pct: 1 } }, human: { gold: 375000, land: 250, bonus: { defense_pct: 1 } }, high_elf: { gold: 300000, land: 250, bonus: { defense_pct: 1 } }, dwarf: { gold: 450000, land: 250, bonus: { defense_pct: 1 } }, dire_wolf: { gold: 300000, land: 250, bonus: { defense_pct: 1 } }, dark_elf: { gold: 300000, land: 250, bonus: { defense_pct: 1 } }, orc: { gold: 300000, land: 250, bonus: { defense_pct: 1 } }, vampire: { gold: 375000, land: 250, bonus: { defense_pct: 1 } } } },
    350: { title: "Emperor",             rewards: { default: { gold: 400000, bonus: { gold_income_pct: 1, covert_pct: 1 } }, human: { gold: 500000, bonus: { gold_income_pct: 1, covert_pct: 1 } }, high_elf: { gold: 400000, bonus: { gold_income_pct: 1, covert_pct: 1 } }, dwarf: { gold: 600000, bonus: { gold_income_pct: 2, covert_pct: 1 } }, dire_wolf: { gold: 400000, bonus: { gold_income_pct: 1, covert_pct: 1 } }, dark_elf: { gold: 400000, bonus: { gold_income_pct: 1, covert_pct: 2 } }, orc: { gold: 400000, bonus: { gold_income_pct: 1, covert_pct: 1 } }, vampire: { gold: 500000, bonus: { gold_income_pct: 1, covert_pct: 1.5 } } } },
    375: { title: "Immortal General",    rewards: { default: { gold: 350000, fighters: 1500, bonus: { attack_pct: 1 } }, human: { gold: 437500, fighters: 1500, bonus: { attack_pct: 1 } }, high_elf: { gold: 350000, researchers: 1500, bonus: { attack_pct: 1 } }, dwarf: { gold: 525000, fighters: 1500, bonus: { attack_pct: 1 } }, dire_wolf: { gold: 350000, fighters: 3000, bonus: { attack_pct: 1.5 } }, dark_elf: { gold: 350000, ninjas: 1500, bonus: { attack_pct: 1 } }, orc: { gold: 350000, fighters: 3000, bonus: { attack_pct: 1.5 } }, vampire: { gold: 437500, fighters: 2250, bonus: { attack_pct: 1 } } } },
    400: { title: "Legendary Sovereign", rewards: { default: { gold: 750000, land: 400, bonus: { gold_income_pct: 2, defense_pct: 1 } }, human: { gold: 937500, land: 400, bonus: { gold_income_pct: 2, defense_pct: 1 } }, high_elf: { gold: 750000, land: 400, bonus: { gold_income_pct: 2, defense_pct: 1 } }, dwarf: { gold: 1125000, land: 400, bonus: { gold_income_pct: 4, defense_pct: 1 } }, dire_wolf: { gold: 750000, land: 400, bonus: { gold_income_pct: 2, defense_pct: 1 } }, dark_elf: { gold: 750000, land: 400, bonus: { gold_income_pct: 2, defense_pct: 1 } }, orc: { gold: 750000, land: 400, bonus: { gold_income_pct: 2, defense_pct: 1 } }, vampire: { gold: 937500, land: 400, bonus: { gold_income_pct: 2, defense_pct: 1 } } } },
    425: { title: "Mythic Conqueror",    rewards: { default: { gold: 500000, fighters: 2000, bonus: { attack_pct: 1, covert_pct: 1 } }, human: { gold: 625000, fighters: 2000, bonus: { attack_pct: 1, covert_pct: 1 } }, high_elf: { gold: 500000, researchers: 2000, bonus: { attack_pct: 1, covert_pct: 1 } }, dwarf: { gold: 750000, fighters: 2000, bonus: { attack_pct: 1, covert_pct: 1 } }, dire_wolf: { gold: 500000, fighters: 4000, bonus: { attack_pct: 1.5, covert_pct: 1 } }, dark_elf: { gold: 500000, ninjas: 2000, bonus: { attack_pct: 1, covert_pct: 2 } }, orc: { gold: 500000, fighters: 4000, bonus: { attack_pct: 1.5, covert_pct: 1 } }, vampire: { gold: 625000, fighters: 3000, bonus: { attack_pct: 1, covert_pct: 1.5 } } } },
    450: { title: "Eternal Ruler",       rewards: { default: { gold: 600000, land: 500, bonus: { gold_income_pct: 2 } }, human: { gold: 750000, land: 500, bonus: { gold_income_pct: 2 } }, high_elf: { gold: 600000, land: 500, bonus: { gold_income_pct: 2 } }, dwarf: { gold: 900000, land: 500, bonus: { gold_income_pct: 4 } }, dire_wolf: { gold: 600000, land: 500, bonus: { gold_income_pct: 2 } }, dark_elf: { gold: 600000, land: 500, bonus: { gold_income_pct: 2 } }, orc: { gold: 600000, land: 500, bonus: { gold_income_pct: 2 } }, vampire: { gold: 750000, land: 500, bonus: { gold_income_pct: 2 } } } },
    475: { title: "God-King",            rewards: { default: { gold: 700000, fighters: 2500, bonus: { attack_pct: 1, defense_pct: 1 } }, human: { gold: 875000, fighters: 2500, bonus: { attack_pct: 1, defense_pct: 1 } }, high_elf: { gold: 700000, researchers: 2500, bonus: { attack_pct: 1, defense_pct: 1 } }, dwarf: { gold: 1050000, fighters: 2500, bonus: { attack_pct: 1, defense_pct: 1 } }, dire_wolf: { gold: 700000, fighters: 5000, bonus: { attack_pct: 1.5, defense_pct: 1 } }, dark_elf: { gold: 700000, ninjas: 2500, bonus: { attack_pct: 1, defense_pct: 1 } }, orc: { gold: 700000, fighters: 5000, bonus: { attack_pct: 1.5, defense_pct: 1 } }, vampire: { gold: 875000, fighters: 3750, bonus: { attack_pct: 1, defense_pct: 1 } } } },
    500: { title: "Ascended",            rewards: { default: { gold: 1000000, land: 750, bonus: { gold_income_pct: 2, attack_pct: 2 } }, human: { gold: 1250000, land: 750, bonus: { gold_income_pct: 2, attack_pct: 2 } }, high_elf: { gold: 1000000, land: 750, bonus: { gold_income_pct: 2, attack_pct: 2 } }, dwarf: { gold: 1500000, land: 750, bonus: { gold_income_pct: 4, attack_pct: 2 } }, dire_wolf: { gold: 1000000, land: 750, bonus: { gold_income_pct: 2, attack_pct: 3 } }, dark_elf: { gold: 1000000, land: 750, bonus: { gold_income_pct: 2, attack_pct: 2 } }, orc: { gold: 1000000, land: 750, bonus: { gold_income_pct: 2, attack_pct: 3 } }, vampire: { gold: 1250000, land: 750, bonus: { gold_income_pct: 2, attack_pct: 2 } } } },
  },

  BUILDING_COL: {
    farms: "bld_farms",
    granaries: "bld_granaries",
    barracks: "bld_barracks",
    outposts: "bld_outposts",
    guard_towers: "bld_guard_towers",
    schools: "bld_schools",
    armories: "bld_armories",
    vaults: "bld_vaults",
    smithies: "bld_smithies",
    markets: "bld_markets",
    mage_towers: "bld_mage_towers",
    shrines: "bld_shrines",
    training: "bld_training",
    castles: "bld_castles",
    libraries: "bld_libraries",
    housing: "bld_housing",
    walls: "bld_walls",
    taverns: "bld_taverns",
    mausoleums: "bld_mausoleums",
    war_machines: "war_machines",
    weapons: "weapons_stockpile",
    armor: "armor_stockpile",
    ladders: "ladders",
    // Resource buildings
    woodyard: "bld_woodyard",
    lumber_camp: "bld_lumber_camp",
    sawmill: "bld_sawmill",
    gravel_pit: "bld_gravel_pit",
    blockfield: "bld_blockfield",
    stone_quarry: "bld_stone_quarry",
    open_pit: "bld_open_pit",
    strip_mine: "bld_strip_mine",
    deep_mine: "bld_deep_mine",
  },

  TOOL_COL: {
    hammers: "hammers_stored",
    scaffolding: "scaffolding_stored",
    blueprints: "blueprints_stored",
  },
  TOOL_GOLD_COST: { hammers: 0, scaffolding: 2500, blueprints: 0 },

  BLUEPRINT_REQUIRED: [
    "vaults",
    "smithies",
    "markets",
    "mage_towers",
    "training",
    "castles"
  ],
  SCAFFOLDING_REQUIRED: ["mage_towers", "training", "castles", "libraries"],
  SCAFFOLDING_BONUS_BUILDINGS: [
    "farms",
    "barracks",
    "outposts",
    "guard_towers",
    "schools",
    "armories",
    "shrines",
    "housing",
  ],

  HERO_CLASSES: {
    paladin: {
      name: "Paladin",
      description: "Holy warrior who protects troops and heals casualties.",
      abilities: [
        { name: "Protective Aura", description: "+10% Military Power" },
        { name: "Holy Heal", description: "Heals up to 10% of casualties" },
        { name: "Unyielding Faith", description: "+15% Morale retention" },
      ],
      recruitCost: 50000,
      recruitMana: 10000,
      statBonus: { military: 1.1, morale: 1.15 },
      races: ["human"],
    },
    grand_chancellor: {
      name: "Grand Chancellor",
      description:
        "Charismatic leader who focuses on prosperity, law, and growth.",
      abilities: [
        { name: "Royal Decree", description: "+10% Population Growth" },
        {
          name: "Golden Touch",
          description: "Collect +250 gold per turn per level",
        },
        {
          name: "Inspiring Presence",
          description: "+20% Morale and +20% Economy",
        },
      ],
      recruitCost: 100000,
      recruitMana: 10000,
      statBonus: { economy: 1.2, morale: 1.2, population: 1.1 },
      races: ["human"],
    },
    high_consul: {
      name: "High Consul",
      description:
        "Master statesman who forges alliances and bends rivals through diplomacy and cunning.",
      abilities: [
        {
          name: "Diplomatic Immunity",
          description: "+15% Defense against Covert Operations",
        },
        { name: "Silver Tongue", description: "+20% Gold from Trade Routes" },
        {
          name: "Alliance Broker",
          description: "Alliances grant +10% more bonus stats",
        },
      ],
      recruitCost: 90000,
      recruitMana: 15000,
      statBonus: { diplomacy: 1.25, economy: 1.15 },
      races: ["human"],
    },
    archmage: {
      name: "Archmage",
      description: "Master of the arcane who boosts mana and spell power.",
      abilities: [
        {
          name: "Arcane Infusion",
          description: "Harvest +100 mana per turn per level",
        },
        { name: "Mana Surge", description: "+25% Magic Power" },
        {
          name: "Elemental Storm",
          description: "Chance to massively augment military attacks",
        },
      ],
      recruitCost: 50000,
      recruitMana: 25000,
      statBonus: { magic: 1.25, research: 1.1 },
      races: ["high_elf"],
    },
    warlord: {
      name: "Warlord",
      description: "Battle-hardened leader who maximizes military might.",
      abilities: [
        { name: "War Cry", description: "+25% Military Power" },
        {
          name: "Tactical Mastery",
          description: "Reduces troop losses in battle",
        },
        { name: "Bloodlust", description: "+10% Morale per successful attack" },
      ],
      recruitCost: 75000,
      recruitMana: 5000,
      statBonus: { military: 1.25, morale: 1.1 },
      races: ["orc"],
    },
    assassin: {
      name: "Assassin",
      description:
        "Lethal killer who excels in covert operations and silent removals.",
      abilities: [
        {
          name: "Deadly Strike",
          description: "Massively boosts assassination success rates",
        },
        { name: "Shadow Veil", description: "+30% Covert Operation Power" },
        {
          name: "Infiltrator",
          description: "Thieves steal significantly more goods",
        },
      ],
      recruitCost: 60000,
      recruitMana: 15000,
      statBonus: { covert: 1.3, stealth: 1.2 },
      races: ["dark_elf"],
    },
    siegebreaker: {
      name: "Siegebreaker",
      description:
        "Master engineer who dominates with war machines and fortification.",
      abilities: [
        { name: "Ironclad Vanguard", description: "+35% War Machine damage" },
        {
          name: "Architect's Insight",
          description: "+25% Construction Efficiency",
        },
        {
          name: "Impenetrable Bastion",
          description: "Walls and Guard Towers are vastly more resilient",
        },
      ],
      recruitCost: 60000,
      recruitMana: 5000,
      statBonus: { military: 1.15, construction: 1.25 },
      races: ["dwarf"],
    },
    forge_lord: {
      name: "Forge Lord",
      description: "Master of commerce and craftsmanship.",
      abilities: [
        {
          name: "Master Crafter",
          description:
            "Halves the cost of forging weapons, armor, and war machines",
        },
        {
          name: "Deep Earth Mining",
          description: "+20% Gold and overall economy",
        },
        {
          name: "Dwarven Resilience",
          description: "Troops consume less food and retain higher morale",
        },
      ],
      recruitCost: 80000,
      recruitMana: 8000,
      statBonus: { economy: 1.25, morale: 1.15 },
      races: ["dwarf"],
    },
    stonelord: {
      name: "Stonelord",
      description:
        "Ancient earth-binder who commands living rock and raises impregnable fortifications.",
      abilities: [
        { name: "Earth's Embrace", description: "+30% Fortification strength" },
        {
          name: "Living Rock",
          description: "Walls deal passive damage to attackers",
        },
        {
          name: "Mountain's Heart",
          description: "+25% resource yield from mines",
        },
      ],
      recruitCost: 90000,
      recruitMana: 12000,
      statBonus: { construction: 1.3, defense: 1.25 },
      races: ["dwarf"],
    },
    alpha: {
      name: "Alpha Pack-Leader",
      description:
        "Fierce alpha that instills terror in enemies and unifies the pack.",
      abilities: [
        {
          name: "Howl of the Wild",
          description: "Massive boost to Ranger effectiveness in combat",
        },
        {
          name: "Predatory Growth",
          description: "+15% Population Growth and Food Yield",
        },
        {
          name: "Terrifying Presence",
          description: "Greatly lowers enemy morale on attacks",
        },
      ],
      recruitCost: 40000,
      recruitMana: 12000,
      statBonus: { military: 1.2, population: 1.2 },
      races: ["dire_wolf"],
    },
    storm_howler: {
      name: "Storm Howler",
      description:
        "Shamanistic wolf that commands the elements and rallies the pack.",
      abilities: [
        { name: "Thunderous Howl", description: "+20% Military Power" },
        { name: "Lightning Reflexes", description: "+15% Stealth and Evasion" },
        {
          name: "Nature's Wrath",
          description: "Farms yields more food as if in perpetual spring",
        },
      ],
      recruitCost: 55000,
      recruitMana: 18000,
      statBonus: { military: 1.15, stealth: 1.25, economy: 1.1 },
      races: ["dire_wolf"],
    },
    blood_shaman: {
      name: "Blood Shaman",
      description: "Primal caster that channels raw power into the army.",
      abilities: [
        {
          name: "Blood Sacrifice",
          description: "Converts minor population into immense Mana",
        },
        {
          name: "Feral Fury",
          description: "+25% Fighter offensive capabilities",
        },
        {
          name: "Earth's Tremor",
          description: "Cast spells with much higher destructiveness",
        },
      ],
      recruitCost: 65000,
      recruitMana: 20000,
      statBonus: { magic: 1.2, military: 1.1 },
      races: ["dire_wolf"],
    },
    night_lord: {
      name: "Night Lord",
      description:
        "Ageless vampire noble who commands the shadows and the dead.",
      abilities: [
        {
          name: "Vampiric Command",
          description: "Fallen enemy soldiers rise as Thralls at a higher rate",
        },
        { name: "Shadow Mastery", description: "+35% Infiltrator power" },
        {
          name: "Crimson Ritual",
          description: "+20% Magic power during the night",
        },
      ],
      recruitCost: 85000,
      recruitMana: 25000,
      statBonus: { covert: 1.25, magic: 1.2, military: 1.1 },
      races: ["vampire"],
    },
    lunar_sentinel: {
      name: "Lunar Sentinel",
      description:
        "Mystic guardian who protects the Silverwood under the stars.",
      abilities: [
        { name: "Moonbeam Shield", description: "+15% Defense Power" },
        { name: "Celestial Guidance", description: "+20% Ranger efficiency" },
        {
          name: "Silver Flash",
          description: "Increased chance to evade enemy spells",
        },
      ],
      recruitCost: 60000,
      recruitMana: 15000,
      statBonus: { military: 1.15, magic: 1.1, stealth: 1.15 },
      races: ["high_elf"],
    },
    void_weaver: {
      name: "Void Weaver",
      description:
        "Dark sorcerer who manipulates the void to dismantle enemy defenses.",
      abilities: [
        {
          name: "Void Rifts",
          description: "-20% Enemy Defense Power during attacks",
        },
        {
          name: "Essence Drain",
          description: "Steals mana from the target during spellcasts",
        },
        {
          name: "Shadow Sculpting",
          description: "+25% Construction Efficiency",
        },
      ],
      recruitCost: 70000,
      recruitMana: 30000,
      statBonus: { magic: 1.3, construction: 1.2 },
      races: ["dark_elf"],
    },
    sanguine_oracle: {
      name: "Sanguine Oracle",
      description:
        "Mystic vampire who channels blood magic to manipulate time and research.",
      abilities: [
        { name: "Temporal Harvest", description: "+20% research speed" },
        {
          name: "Blood Offering",
          description: "Increase turn production by 10%",
        },
        {
          name: "Eternal Wisdom",
          description: "+25% Scribe energy generation",
        },
      ],
      recruitCost: 70000,
      recruitMana: 20000,
      statBonus: { research: 1.25, scribe: 1.2 },
      races: ["vampire"],
    },
    blood_matriarch: {
      name: "Blood Matriarch",
      description:
        "Ancient vampire ruler who inspires dread and absolute loyalty.",
      abilities: [
        {
          name: "Sanguine Bond",
          description: "+20% Morale and Housing efficiency",
        },
        {
          name: "Eternal Legion",
          description: "Higher chance to recover fallen troops",
        },
        {
          name: "Night's Majesty",
          description: "+15% Military and Magic during night",
        },
      ],
      recruitCost: 90000,
      recruitMana: 15000,
      statBonus: { morale: 1.3, population: 1.2, military: 1.1 },
      races: ["vampire"],
    },
    shadowmaster: {
      name: "Shadowmaster",
      description: "Elite operative who commands a network of shadow agents.",
      abilities: [
        {
          name: "Ghost Network",
          description: "+40% Intelligence gathering power",
        },
        {
          name: "Assassination Protocol",
          description: "Greatly increased success in targeted kills",
        },
        {
          name: "Shadow Economy",
          description: "Steals a percentage of enemy gold production",
        },
      ],
      recruitCost: 80000,
      recruitMana: 10000,
      statBonus: { covert: 1.35, stealth: 1.25 },
      races: ["dark_elf"],
    },
    mage_king: {
      name: "Mage-King",
      description:
        "Ancient ruler dedicated to total mastery of forbidden and high magic.",
      abilities: [
        {
          name: "Leyline Control",
          description: "Massive boost to Mana generation",
        },
        {
          name: "Ritual Dominance",
          description: "+30% Spell Success and Power",
        },
        {
          name: "Eternal Library",
          description: "+20% speed to all Magic and Research studies",
        },
      ],
      recruitCost: 120000,
      recruitMana: 50000,
      statBonus: { magic: 1.4, research: 1.2 },
      races: ["high_elf"],
    },
    high_chieftain: {
      name: "High Chieftain",
      description:
        "Unified tribal leader focused on raw strength and land conquest.",
      abilities: [
        {
          name: "Tribal Unity",
          description: "+20% Fighter and Ranger training speed",
        },
        {
          name: "Path of Conquest",
          description: "Gain extra land from successful attacks",
        },
        {
          name: "Primal Might",
          description: "+25% Defense Power against raids",
        },
      ],
      recruitCost: 70000,
      recruitMana: 8000,
      statBonus: { military: 1.2, economy: 1.15, construction: 1.15 },
      races: ["orc"],
    },
    warshaman: {
      name: "Warshaman",
      description:
        "Spirit-caller who channels ancestral fury, bridging brute strength with primal magic.",
      abilities: [
        {
          name: "Ancestral Fury",
          description: "+15% Military Power when attacking",
        },
        { name: "Spirit Totem", description: "+20% Defense Power" },
        {
          name: "Blood Rite",
          description: "Sacrifice population for short-term stat boosts",
        },
      ],
      recruitCost: 65000,
      recruitMana: 12000,
      statBonus: { military: 1.15, magic: 1.1 },
      races: ["orc"],
    },
  },

  STRINGS: {
    LEVEL_500_ACHIEVED: "🌟 Kingdom reached Level 500! You've achieved max level and unlocked Prestige mode.",
    PRESTIGE_SYSTEM_TITLE: "✨ Prestige System",
    PRESTIGE_COMING_SOON: "Coming Soon",
    PRESTIGE_DEVELOPMENT_TEXT: "The prestige system is currently under development. Return when it's ready to explore new heights of power!",
    PRESTIGE_BUTTON_TITLE: "You've reached max level! Click to explore prestige.",
  },
};

const fs = require("fs");
const path = require("path");
try {
  const overridesPath = path.join(__dirname, "config_overrides.json");
  if (fs.existsSync(overridesPath)) {
    const overrides = JSON.parse(fs.readFileSync(overridesPath, "utf8"));
    for (const key of Object.keys(overrides)) {
      if (
        typeof overrides[key] === "object" &&
        config[key] &&
        !Array.isArray(config[key])
      ) {
        Object.assign(config[key], overrides[key]);
      } else {
        config[key] = overrides[key];
      }
    }
  }
} catch (e) {
  console.error("[CONFIG] Error loading overrides:", e.message);
}

module.exports = config;
