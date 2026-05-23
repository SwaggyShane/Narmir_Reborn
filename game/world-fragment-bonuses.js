/**
 * World Fragment Bonuses System
 * Each of 10 world fragments provides unique bonuses to each building type
 * Combines passive bonuses (production multipliers, capacity) with special mechanics
 *
 * Structure:
 * {
 *   fragmentName: {
 *     buildingType: {
 *       passive: { production, capacity, speed multipliers },
 *       special: { unique mechanics, abilities, restrictions }
 *     }
 *   }
 * }
 */

const FRAGMENT_BONUSES = {
  // ════════════════════════════════════════════════════════════════════════════
  // VOLCANIC ROCK - Fire, Creation, Forge, Transformation through Heat
  // ════════════════════════════════════════════════════════════════════════════
  "Volcanic Rock": {
    // Agriculture
    farms: {
      passive: { production: 0.15, consumption: 0.05 },
      special: { name: "Geothermal Fertility", desc: "Heat accelerates growth but increases population hunger" },
    },
    granaries: {
      passive: { capacity: 0.20 },
      special: { name: "Heat Preservation", desc: "Food preserved by constant warmth; immune to cold spoilage" },
    },

    // Crafting & Industry
    smithies: {
      passive: { production: 0.40, speed: 0.25 },
      special: { name: "Eternal Forge", desc: "Smithy never cools; forge quality improves with each use" },
    },
    war_machines: {
      passive: { production: 0.25 },
      special: { name: "Heated Metal", desc: "War machines deal +10% fire damage" },
    },
    weapons: {
      passive: { production: 0.30 },
      special: { name: "Tempered Blades", desc: "Weapons never dull; maintain effectiveness indefinitely" },
    },
    armor: {
      passive: { production: 0.30 },
      special: { name: "Hardened Steel", desc: "Armor resistant to shattering; durability +50%" },
    },

    // Magic & Research
    mage_towers: {
      passive: { production: 0.20, manaRegen: 0.15 },
      special: { name: "Inferno Codex", desc: "Fire spells 20% more powerful; heat-based magic mastery" },
    },
    schools: {
      passive: { speed: -0.10 },
      special: { name: "Heated Debate", desc: "Researchers argue passionately; +5% quality but -10% output speed" },
    },

    // Defense
    walls: {
      passive: { health: 0.10 },
      special: { name: "Lava Moat", desc: "Walls glow with molten energy; small damage to siegers each turn" },
    },
    guard_towers: {
      passive: { detection: 0.15 },
      special: { name: "Beacon Fires", desc: "Watch fires never dim; vision range increased significantly" },
    },

    // Economy
    markets: {
      passive: { income: 0.15 },
      special: { name: "Hot Market", desc: "Goods pass through quickly; higher turnover, faster sales" },
    },
    vaults: {
      passive: { capacity: 0.10 },
      special: { name: "Magma Locks", desc: "Doors sealed by lava-flow; impossible to breach by normal means" },
    },

    // Other
    taverns: {
      passive: { morale: 0.10 },
      special: { name: "Hot Spirits", desc: "Drinks served warm; morale events more frequent" },
    },
    castles: {
      passive: { defense: 0.15 },
      special: { name: "Volcanic Seat", desc: "Castle foundation resonates with earth-power; +20% defense vs magic" },
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // ANCIENT ELVEN WOOD - Nature, Magic, Growth, Timelessness, Grace
  // ════════════════════════════════════════════════════════════════════════════
  "Ancient Elven Wood": {
    // Agriculture
    farms: {
      passive: { production: 0.20, stability: 0.25 },
      special: { name: "Primordial Fertility", desc: "Crops never fail; immune to blight and natural disasters" },
    },
    granaries: {
      passive: { capacity: 0.50 },
      special: { name: "Eternal Storage", desc: "Food stored in Elven wood ages like fine wine; value increases over time" },
    },

    // Buildings & Infrastructure
    housing: {
      passive: { capacity: 0.15, morale: 0.10 },
      special: { name: "Elven Halls", desc: "Living spaces feel timeless; citizens never want to leave" },
    },
    libraries: {
      passive: { speed: 0.25, knowledge: 0.15 },
      special: { name: "Scrolls of Ages", desc: "Wood preserves knowledge; all research is permanent and cannot be forgotten" },
    },
    schools: {
      passive: { speed: 0.20, output: 0.15 },
      special: { name: "Ancient Teaching", desc: "Wisdom of ages flows through; researchers live longer, accumulate more XP" },
    },

    // Magic
    mage_towers: {
      passive: { mana: 0.25, spellSpeed: 0.15 },
      special: { name: "Ley-Line Anchor", desc: "Tower becomes nexus point; nearby mage towers gain +10% power" },
    },
    shrines: {
      passive: { healing: 0.20, morale: 0.15 },
      special: { name: "Sacred Grove", desc: "Shrine becomes sacred grove; injured troops heal twice as fast" },
    },

    // Craftwork
    smithies: {
      passive: { quality: 0.20 },
      special: { name: "Elven Craft", desc: "Smiths achieve perfect balance; all equipment crafted is unbreakable" },
    },

    // Defense
    outposts: {
      passive: { effectiveness: 0.15, scouts: 0.20 },
      special: { name: "Ranger Sanctuary", desc: "Rangers report home safely always; ambushes become rarer" },
    },
    guard_towers: {
      passive: { detection: 0.20 },
      special: { name: "Watcher's Nest", desc: "Guardians achieve clarity; can detect invisible/covert ops" },
    },

    // Resource Gathering
    woodyard: {
      passive: { production: 0.30 },
      special: { name: "Kin of the Forest", desc: "Wood speaks to its kin; woodcutters never get lost or injured" },
    },
    lumber_camp: {
      passive: { production: 0.40 },
      special: { name: "Living Timber", desc: "Trees regrow faster; each harvest is more efficient than the last" },
    },
    sawmill: {
      passive: { production: 0.35 },
      special: { name: "Perfect Grain", desc: "Every cut is perfect; no waste, maximum yield per tree" },
    },

    // Other
    taverns: {
      passive: { morale: 0.20, happiness: 0.15 },
      special: { name: "Elvish Mead", desc: "Brew improves with age; patrons stay indefinitely" },
    },
    castles: {
      passive: { grace: 0.20 },
      special: { name: "Eternal Seat", desc: "Castle becomes timeless monument; all citizens feel honored living under its shadow" },
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // DRAGON SCALE - Raw Power, Combat, Dominance, Territorial
  // ════════════════════════════════════════════════════════════════════════════
  "Dragon Scale": {
    // Combat
    barracks: {
      passive: { training: 0.25, morale: 0.15 },
      special: { name: "Dragon Roost", desc: "Soldiers feel draconic strength; +15% combat power, fear enemies" },
    },
    training: {
      passive: { speed: 0.20, effectiveness: 0.20 },
      special: { name: "Draconic Trials", desc: "Training becomes legendary; graduates are permanent veterans" },
    },
    war_machines: {
      passive: { damage: 0.20, power: 0.15 },
      special: { name: "Scaled Siege", desc: "Machines adorned with scales; increase in damage vs walls significantly" },
    },
    weapons: {
      passive: { damage: 0.20 },
      special: { name: "Dragonbane Edge", desc: "Weapons hum with draconic power; +25% vs heavily armored foes" },
    },
    armor: {
      passive: { defense: 0.25 },
      special: { name: "Scale Plate", desc: "Armor deflects blows like scales; ricochet hits to nearby enemies" },
    },
    armories: {
      passive: { storage: 0.25, maintenance: -0.10 },
      special: { name: "Dragon's Hoard", desc: "Equipment stored here gleams with power; never rusts or degrades" },
    },

    // Defense
    walls: {
      passive: { defense: 0.20 },
      special: { name: "Scaled Ramparts", desc: "Walls ripple with scale texture; enemy siege towers slide off ineffectively" },
    },
    castles: {
      passive: { defense: 0.30, prestige: 0.20 },
      special: { name: "Dragon's Seat", desc: "Castle becomes true fortress; enemy troops must pass draconic fear test" },
    },
    guard_towers: {
      passive: { power: 0.20 },
      special: { name: "Aerie Towers", desc: "Towers become dragon aeries; guards shoot with draconic precision" },
    },

    // Agriculture (intimidation effect)
    farms: {
      passive: { production: 0.05, population: -0.05 },
      special: { name: "Dragon's Shadow", desc: "Crops grow but workers fear the land; morale penalty but high yield" },
    },
    granaries: {
      passive: { capacity: 0.15, security: 0.30 },
      special: { name: "Hoard Guard", desc: "Granaries protected with draconic magic; impossible to steal from" },
    },

    // Magic
    mage_towers: {
      passive: { power: 0.25 },
      special: { name: "Draconic Incantations", desc: "Spells gain draconic essence; offensive spells gain area damage" },
    },

    // Other
    taverns: {
      passive: { morale: 0.15 },
      special: { name: "Dragon's Mead Hall", desc: "Heroes gather; legendary stories born, morale events guarantee triumphs" },
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // ABYSSAL CRYSTAL - Void, Chaos, Darkness, Deep Power, Forbidden Knowledge
  // ════════════════════════════════════════════════════════════════════════════
  "Abyssal Crystal": {
    // Magic & Research
    mage_towers: {
      passive: { mana: 0.40, power: 0.20 },
      special: { name: "Void Conduit", desc: "Tap void directly for mana; unlimited mana generation but sanity costs" },
    },
    libraries: {
      passive: { forbidden_knowledge: 0.25 },
      special: { name: "Forbidden Codex", desc: "Unlock forbidden research paths; hidden bonuses to all magic" },
    },
    schools: {
      passive: { speed: 0.20 },
      special: { name: "Dark Tutoring", desc: "Knowledge flows unfiltered; researchers gain wisdom but lose some morale" },
    },
    shrines: {
      passive: { alternative_power: 0.30 },
      special: { name: "Void Devotion", desc: "Draw power from void; healing works differently, can revive dead troops (ritual cost)" },
    },

    // Combat
    war_machines: {
      passive: { power: 0.30, ammo: 0.25 },
      special: { name: "Void Catapults", desc: "Projectiles tear through reality; ignore 50% of defensive walls" },
    },
    barracks: {
      passive: { power: 0.15, cost: -0.20 },
      special: { name: "Abyssal Conscription", desc: "Recruit from void itself; troops cost less but have sanity problems" },
    },

    // Defenses
    walls: {
      passive: { intangibility: 0.10 },
      special: { name: "Void Walls", desc: "Walls become semi-real; some attacks pass through harmlessly" },
    },

    // Economy & Storage
    vaults: {
      passive: { capacity: 1.50, security: 0.50 },
      special: { name: "Void Treasury", desc: "Store unlimited gold in void pockets; but 1% randomly vanishes weekly" },
    },
    granaries: {
      passive: { capacity: 1.00, instability: 0.20 },
      special: { name: "Void Pantry", desc: "Unlimited food storage but food becomes unstable; occasional spontaneous spoilage" },
    },

    // Resources
    deep_mine: {
      passive: { production: 0.50, rare_finds: 0.30 },
      special: { name: "Void Extraction", desc: "Mine into the void itself; find impossible ores and cursed metals" },
    },

    // Other
    mausoleums: {
      passive: { power: 0.40 },
      special: { name: "Void Tombs", desc: "Dead linger in void; undead minions persist and grow in power" },
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // CELESTIAL FEATHER - Light, Heaven, Hope, Transcendence, Divine Blessing
  // ════════════════════════════════════════════════════════════════════════════
  "Celestial Feather": {
    // Morale & Healing
    shrines: {
      passive: { healing: 0.35, morale: 0.25 },
      special: { name: "Divine Sanctuary", desc: "Prayers answered directly; no limit to injured troops that can heal simultaneously" },
    },
    taverns: {
      passive: { morale: 0.30 },
      special: { name: "Heavenly Haven", desc: "Spirits lifted by divine presence; morale never drops below 50%" },
    },

    // Magic & Knowledge
    mage_towers: {
      passive: { mana: 0.20, healing_spells: 0.40 },
      special: { name: "Light Tower", desc: "Light magic becomes pure; healing spells affect allies in adjacent kingdoms" },
    },
    libraries: {
      passive: { speed: 0.15, preservation: 0.30 },
      special: { name: "Celestial Archive", desc: "Knowledge becomes eternal; no research can be lost to amnesia or disaster" },
    },
    schools: {
      passive: { speed: 0.20, happiness: 0.15 },
      special: { name: "Academy of Light", desc: "Teaching becomes inspired; all graduates become natural leaders" },
    },

    // Defense
    guard_towers: {
      passive: { power: 0.25 },
      special: { name: "Holy Watchtowers", desc: "Sentries blessed; can see covert operations and detect lies/deception" },
    },
    walls: {
      passive: { defense: 0.25, morale: 0.15 },
      special: { name: "Blessed Ramparts", desc: "Walls inspire defenders; defending against siege boosts morale instead of draining it" },
    },
    castles: {
      passive: { defense: 0.20, hope: 0.25 },
      special: { name: "Sacred Seat", desc: "Castle becomes beacon of hope; citizens fight 20% harder in defense" },
    },

    // Agriculture
    farms: {
      passive: { production: 0.25, stability: 0.30 },
      special: { name: "Blessed Fields", desc: "Crops blessed by heaven; harvests are guaranteed and bountiful" },
    },

    // Other
    housing: {
      passive: { capacity: 0.15, happiness: 0.20 },
      special: { name: "Sanctified Homes", desc: "Dwellings filled with light; citizens never leave, population growth boosted" },
    },
    markets: {
      passive: { income: 0.20, trust: 0.25 },
      special: { name: "Honest Exchange", desc: "Divine oversight prevents fraud; prices always fair, customers return" },
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // DWARVEN STAR-METAL - Craftsmanship, Durability, Quality, Eternal, Dwarvish Pride
  // ════════════════════════════════════════════════════════════════════════════
  "Dwarven Star-Metal": {
    // Core Dwarvish Buildings
    smithies: {
      passive: { quality: 0.35, durability: 0.50 },
      special: { name: "Master Forge", desc: "All equipment becomes legendary; +40% effectiveness, never breaks" },
    },
    vaults: {
      passive: { capacity: 0.60, security: 0.40 },
      special: { name: "Star-Metal Vault", desc: "Impenetrable; gold stored here gains interest +5% per turn" },
    },
    armories: {
      passive: { storage: 0.40, maintenance: -0.25 },
      special: { name: "Star-Armory", desc: "Weapons and armor maintained perfectly; never rust, always effective" },
    },

    // Defensive Structures
    walls: {
      passive: { health: 0.40, repair: 0.25 },
      special: { name: "Star-Metal Ramparts", desc: "Walls repair themselves slowly; damage heals over time naturally" },
    },
    guard_towers: {
      passive: { longevity: 0.30 },
      special: { name: "Eternal Watchtowers", desc: "Guards age slowly; same guards serve for centuries, becoming legendary" },
    },
    castles: {
      passive: { permanence: 0.50 },
      special: { name: "Star-Metal Seat", desc: "Castle becomes eternal monument; cannot be destroyed, only damaged" },
    },

    // Knowledge
    libraries: {
      passive: { durability: 0.40 },
      special: { name: "Impenetrable Archives", desc: "Books and scrolls cannot be lost, stolen, or forgotten by amnesia" },
    },

    // Crafting
    weapons: {
      passive: { quality: 0.30, durability: 0.40 },
      special: { name: "Eternal Blades", desc: "Weapons become heirlooms; pass damage to next generation" },
    },
    armor: {
      passive: { durability: 0.50, protection: 0.15 },
      special: { name: "Star-Mail", desc: "Armor cannot be broken; protects across generations" },
    },
    ladders: {
      passive: { durability: 0.60 },
      special: { name: "Star-Metal Ladders", desc: "Ladders never fall; engineer success rate doubled" },
    },
    war_machines: {
      passive: { durability: 0.45, maintenance: -0.15 },
      special: { name: "Eternal Engines", desc: "Machines last forever; no maintenance needed, damage heals slowly" },
    },

    // Other
    granaries: {
      passive: { capacity: 0.30 },
      special: { name: "Star-Metal Granaries", desc: "Food storage secured; no theft possible, quality preserved" },
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // CURSED BLOODSTONE - Sacrifice, Dark Magic, Blood Pacts, Forbidden Power
  // ════════════════════════════════════════════════════════════════════════════
  "Cursed Bloodstone": {
    // Combat & Power
    barracks: {
      passive: { strength: 0.30, cost: -0.25 },
      special: { name: "Blood Oath", desc: "Soldiers gain dark power but pay life-debt; troops 30% stronger but lose 1% HP per turn" },
    },
    training: {
      passive: { power: 0.35, morale: -0.15 },
      special: { name: "Sacrifice Trials", desc: "Training through combat; graduates are battle-scarred and relentless" },
    },
    war_machines: {
      passive: { damage: 0.25, blood_hunger: 0.15 },
      special: { name: "Blood-Fueled Catapults", desc: "Deal more damage when killing enemies; vampiric ammunition" },
    },

    // Magic & Research
    mage_towers: {
      passive: { power: 0.40, cost: -0.20 },
      special: { name: "Blood Rituals", desc: "Spells powered by sacrifice; cast for free but -population per spell" },
    },
    shrines: {
      passive: { power: 0.30, healing: 0.15 },
      special: { name: "Blood Altar", desc: "Healing requires sacrifice; heal more troops but lose population" },
    },

    // Defense
    walls: {
      passive: { defense: 0.20, hunger: 0.10 },
      special: { name: "Blood Ward", desc: "Walls glow red; first attack each turn is reflected back at attacker" },
    },
    castles: {
      passive: { power: 0.25 },
      special: { name: "Blood Throne", desc: "Castle drinks blood of enemies; each victory heals all castle damage" },
    },

    // Other
    mausoleums: {
      passive: { power: 0.50, undead: 0.40 },
      special: { name: "Blood Crypts", desc: "Dead rise as powerful undead; necromancy becomes viable" },
    },
    granaries: {
      passive: { capacity: 0.30, taint: 0.15 },
      special: { name: "Bloodstone Stores", desc: "Food stained with blood; attracts scavengers but lasts longer" },
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // TEARS OF THE WORLD TREE - Life, Healing, Renewal, Pure Vitality, Rebirth
  // ════════════════════════════════════════════════════════════════════════════
  "Tears of the World Tree": {
    // Life & Growth
    farms: {
      passive: { production: 0.35, stability: 0.40 },
      special: { name: "Eternal Harvest", desc: "Crops blessed by world-tree; never fail, multiply if overabundant" },
    },
    housing: {
      passive: { capacity: 0.30, growth: 0.25 },
      special: { name: "Life Dwellings", desc: "Population reproduces faster; natural growth from within" },
    },
    granaries: {
      passive: { capacity: 0.25, vitality: 0.30 },
      special: { name: "Living Stores", desc: "Food becomes living; never spoils, grants +1% population growth bonus" },
    },

    // Healing
    shrines: {
      passive: { healing: 0.50, power: 0.25 },
      special: { name: "Life Sanctuary", desc: "Healing becomes miracle; wounded troops fully recover, gain +10% HP permanently" },
    },

    // Magic
    mage_towers: {
      passive: { mana: 0.20, vitality: 0.25 },
      special: { name: "Life Conduit", desc: "Mana infused with vitality; healing spells double in effect" },
    },

    // Knowledge
    libraries: {
      passive: { wisdom: 0.25 },
      special: { name: "Living Wisdom", desc: "Knowledge grows like tree; research compounds (each turn adds small bonus)" },
    },

    // Defense
    walls: {
      passive: { regeneration: 0.15 },
      special: { name: "Living Ramparts", desc: "Walls slowly regenerate damage; heal 2% of max HP per turn naturally" },
    },
    guard_towers: {
      passive: { endurance: 0.20 },
      special: { name: "Life Towers", desc: "Guards never tire; can defend indefinitely without rotation" },
    },

    // Resources
    lumber_camp: {
      passive: { production: 0.30, regrowth: 0.40 },
      special: { name: "Living Forests", desc: "Trees regrow immediately; each harvest plants the next generation" },
    },

    // Other
    taverns: {
      passive: { morale: 0.20, vitality: 0.15 },
      special: { name: "Life Tavern", desc: "Drinks grant health; patrons live longer, rare assassination target" },
    },
    mausoleums: {
      passive: { resurrection: 0.25 },
      special: { name: "Rebirth Tombs", desc: "Dead can be resurrected; allows fallen heroes to return (cost: resources)" },
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // VOID ESSENCE - Ultimate Void, Nothingness, Reality Bending, Infinite Power
  // ════════════════════════════════════════════════════════════════════════════
  "Void Essence": {
    // Everything responds dramatically to Void Essence
    farms: {
      passive: { production: 1.00, chaos: 0.30 },
      special: { name: "Void Crops", desc: "Food yields doubled but becomes unpredictable; crops either triple or fail" },
    },
    granaries: {
      passive: { capacity: 2.00, volatility: 0.50 },
      special: { name: "Void Pantry", desc: "Infinite storage but unstable; food randomly appears/disappears" },
    },
    vaults: {
      passive: { capacity: 3.00, loss: 0.10 },
      special: { name: "Void Vault", desc: "Infinite gold storage; 10% of gold randomly vanishes but reappears later" },
    },
    barracks: {
      passive: { power: 0.50, stability: -0.40 },
      special: { name: "Void Legion", desc: "Soldiers warp in from void; powerful but erratic, sometimes disappear" },
    },
    mage_towers: {
      passive: { power: 1.00, sanity: -0.30 },
      special: { name: "Void Nexus", desc: "Unlimited spell power; cast reality-bending spells but risk kingdom sanity" },
    },
    walls: {
      passive: { defense: 0.50, intangibility: 0.50 },
      special: { name: "Void Walls", desc: "Walls flicker in/out of reality; attacks sometimes pass through" },
    },
    castles: {
      passive: { power: 0.60, anomaly: 0.40 },
      special: { name: "Void Throne", desc: "Castle phases between realities; becomes immune to attacks but also phases partially out" },
    },
    shrines: {
      passive: { power: 0.40, safety: -0.20 },
      special: { name: "Void Altar", desc: "Miracles happen unpredictably; healing becomes powerful but unreliable" },
    },
    libraries: {
      passive: { knowledge: 0.50, memory: -0.20 },
      special: { name: "Void Archives", desc: "Infinite knowledge but hard to remember; research paradox possible (gain knowledge, lose memory)" },
    },
    smithies: {
      passive: { quality: 0.50, mutation: 0.30 },
      special: { name: "Void Forge", desc: "Equipment becomes reality-warped; sometimes gain impossible properties randomly" },
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // TITAN BONE - Ancient Giants, Strength, Permanence, Massive Scale
  // ════════════════════════════════════════════════════════════════════════════
  "Titan Bone": {
    // Size & Scale
    castles: {
      passive: { size: 0.50, majesty: 0.40 },
      special: { name: "Titanic Seat", desc: "Castle grows impossibly large; can house entire armies, morale x2" },
    },
    walls: {
      passive: { health: 0.60, height: 0.40 },
      special: { name: "Titan Walls", desc: "Walls reach impossible heights; siege scaling impossible, first assault always fails" },
    },

    // Strength & Power
    barracks: {
      passive: { training: 0.30, strength: 0.25 },
      special: { name: "Titan Training", desc: "Soldiers grow to giant proportions; damage +30%, health +50%" },
    },
    training: {
      passive: { output: 0.35 },
      special: { name: "Trials of Giants", desc: "Warriors become titan-blessed; each soldier worth 1.5x in combat" },
    },
    war_machines: {
      passive: { damage: 0.40, size: 0.30 },
      special: { name: "Titan Siege", desc: "Machines become colossal; can destroy walls in seconds" },
    },

    // Structure & Defense
    guard_towers: {
      passive: { reach: 0.50 },
      special: { name: "Titan Towers", desc: "Towers grow massive; vision range tripled, cover entire territories" },
    },
    outposts: {
      passive: { coverage: 0.40 },
      special: { name: "Titan Outposts", desc: "Outposts become massive fortresses; control vast territories" },
    },

    // Scale & Capacity
    granaries: {
      passive: { capacity: 0.50 },
      special: { name: "Titan Stores", desc: "Granaries grow enormous; food storage for years, never runs out" },
    },
    vaults: {
      passive: { capacity: 0.40 },
      special: { name: "Titan Treasury", desc: "Vaults become colossal; gold stored here becomes legendary hoard" },
    },

    // Other
    housing: {
      passive: { capacity: 0.40 },
      special: { name: "Titan Halls", desc: "Buildings spacious; citizens require less space, population density +40%" },
    },
    taverns: {
      passive: { capacity: 0.50, legend: 0.30 },
      special: { name: "Titan Tavern", desc: "Becomes legendary watering hole; heroes naturally gather, morale events guaranteed" },
    },
    libraries: {
      passive: { grandeur: 0.25 },
      special: { name: "Titan Archives", desc: "Library becomes monument; attracts scholars, research +25%" },
    },
  },
};

module.exports = FRAGMENT_BONUSES;
