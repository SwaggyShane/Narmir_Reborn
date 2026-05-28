/**
 * World Fragment Bonuses System
 * Each of 10 world fragments provides unique bonuses to each building type.
 * Farms, granaries, housing, guard_towers, outposts, training, and castles are fully populated.
 * All other buildings from the build panel are defined but empty.
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
    guard_towers: {
      passive: { detection: 0.30, power: 0.15, reach: 0.15 },
      special: { name: "Magma Scrying Lenses", desc: "Lava obsidian crystals ground into precision scrying mirrors capture thermal body heats, making cold invisible units glow vividly" },
    },
    outposts: {
      passive: { power: 0.30, effectiveness: 0.15, scouts: 0.10 },
      special: { name: "Sulfur Smoke Signals", desc: "Continuous volcanic smoke flares billowed from outpost peaks mask local troop redeployments while illuminating the surrounding landscape" },
    },
    training: {
      passive: { speed: 0.30, power: 0.15, output: 0.10 },
      special: { name: "Magma Endurance Drill", desc: "Training under extreme high-heat geothermal vents tempers unit pain tolerances, boosting stamina during active battlefield maneuvers" },
    },
    castles: {
      passive: { income: 0.30, prestige: 0.15 },
      special: { name: "Geothermal Cast-Heaters", desc: "Channels warm volcanic steam through castle walls and floors, reducing heating costs and keeping garrison forces warm, improving active defense" },
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
    guard_towers: {
      passive: { reach: 0.30, power: 0.15, detection: 0.10 },
      special: { name: "Living Canopy Sight", desc: "Watch platforms integrated into the highest elven trunks extend observation horizons, allowing early eagle-eye scout alerts" },
    },
    outposts: {
      passive: { effectiveness: 0.30, scouts: 0.15, power: 0.10 },
      special: { name: "Sylvan Veil-Posts", desc: "Outposts built into giant living ironwood boles blend perfectly into the canopy, rendering patrolling scouts completely invisible to standard recon" },
    },
    training: {
      passive: { speed: 0.30, power: 0.15, output: 0.10 },
      special: { name: "Canopy Acrobatics", desc: "Recruits train on top of flexible giant forest branches to unlock superior acrobatics, completely bypassing marsh or mud terrain slowdowns" },
    },
    castles: {
      passive: { prestige: 0.30, income: 0.15 },
      special: { name: "Yggdrasil Embassy Pillars", desc: "Inlaid elven ironwood beams elevate the castle's diplomatic standing, double diplomatic weight during trade negotiation councils" },
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
    guard_towers: {
      passive: { detection: 0.15, power: 0.40, reach: 0.25 },
      special: { name: "Wyrm-Eye Sentry Lamps", desc: "Hanging brass lanterns fueled by draconic oil cast a revealing ruby light over the walls, exposing hidden stealth trackers instantly" },
    },
    outposts: {
      passive: { scouts: 0.15, power: 0.40, effectiveness: 0.25 },
      special: { name: "Drake-Perch Watchpoints", desc: "High stone platforms serve as nesting roosts for young drakes, who join ranger patrol details to unleash warning shrieks and scorched-earth containment fire" },
    },
    training: {
      passive: { output: 0.15, power: 0.40, speed: 0.25 },
      special: { name: "Wyrm-Flame Sparring", desc: "Soldiers wear flameproof drakehide suits during live-combat drills, forging legendary, battle-hardened courage against incoming magic fire" },
    },
    castles: {
      passive: { prestige: 0.15, income: 0.40 },
      special: { name: "Drake-Fire Deflection Girders", desc: "Coating the primary keeps in cured red-dragon scales completely shields the high towers from incoming fire spells or catapult payload collisions" },
    },
  },

  "Abyssal Crystal": {
    granaries: {
      passive: { capacity: 1.00, instability: 0.20 },
      special: { name: "Void Pantry", desc: "Unlimited food storage but food becomes unstable; occasional spontaneous spoilage" },
    },
    guard_towers: {
      passive: { detection: 0.30, power: 0.15, reach: 0.20 },
      special: { name: "Obsidian Beam Arrays", desc: "Crystalline focus scopes cast concentrated underdark violet spotlights across nearby lines, detecting shifting stealthy silhouettes" },
    },
    outposts: {
      passive: { effectiveness: 0.30, power: 0.15, scouts: 0.20 },
      special: { name: "Resonant Cryo-Sensors", desc: "Tuning crystal spires capture underground movements, sending hum alerts through structural ground lines to reveal tunnelling squads" },
    },
    training: {
      passive: { speed: 0.30, power: 0.15, output: 0.20 },
      special: { name: "Echo Blindfold Drills", desc: "Training under heavy blindfolds guided by subterranean crystal sound harmonics multiplies night-fighting and ambush detection rates" },
    },
    castles: {
      passive: { income: 0.30, prestige: 0.15 },
      special: { name: "Dark Quartz Spire Network", desc: "Crystal focus crystals harness deep underdark energy lines to channel warning defensive barriers, absorbing incoming hostile projectile forces" },
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
    guard_towers: {
      passive: { reach: 0.25, power: 0.35, detection: 0.20 },
      special: { name: "Sanctified Signal Glares", desc: "High towers shine with a pure, sacred celestial spotlight that continuously alerts nearby defense details and restores combat focus" },
    },
    outposts: {
      passive: { effectiveness: 0.25, power: 0.35, scouts: 0.20 },
      special: { name: "Empyrean Light-Spire", desc: "Outposts project a beam of celestial light that bolsters the resolve and accuracy of rangers on patrol while healing nearby injured border guards" },
    },
    training: {
      passive: { speed: 0.25, power: 0.35, output: 0.20 },
      special: { name: "Aureole Combat Focus", desc: "Divine light radiating over the training fields elevates trainee focus, raising their base critical hit rates on their first active campaign turns" },
    },
    castles: {
      passive: { prestige: 0.35, income: 0.25 },
      special: { name: "Radiant Sovereign Spire", desc: "A towering holy anchor at the castle's peak continuously baths the surrounding courtyard in a bright celestial glow, repelling shadow curses and keeping morale high" },
    },
  },

  "Dwarven Star-Metal": {
    granaries: {
      passive: { capacity: 0.30 },
      special: { name: "Star-Metal Granaries", desc: "Food storage secured; no theft possible, quality preserved" },
    },
    guard_towers: {
      passive: { power: 0.40, detection: 1.00, reach: 0.50 },
      special: { name: "Pneumatic Bolt Launchers", desc: "Heavy watch platforms are equipped with automated pivot mechanisms and steel reinforcement, preventing alignment decay" },
    },
    outposts: {
      passive: { power: 0.40, effectiveness: 1.00, scouts: 0.50 },
      special: { name: "Steam-Powered Bolt-Throwers", desc: "Outposts are equipped with automated rapid-fire heavy ballistas, multiplying defensive archery capability during sieges" },
    },
    training: {
      passive: { power: 0.40, speed: 1.00, output: 0.50 },
      special: { name: "Pneumatic Sparring Rings", desc: "Automated clockwork drills run continuously, training recruits with precision-timed thrusts and parries with zero training injury decay" },
    },
    castles: {
      passive: { income: 0.40, prestige: 1.00 },
      special: { name: "Runed Aegis Plates", desc: "Plating the castle walls in legendary runed Star-Metal provides unprecedented structural durability and multiplies defense during heavy sieges" },
    },
  },

  "Cursed Bloodstone": {
    granaries: {
      passive: { capacity: 0.30, taint: 0.15 },
      special: { name: "Bloodstone Stores", desc: "Food stained with blood; attracts scavengers but lasts longer" },
    },
    guard_towers: {
      passive: { detection: 0.50, power: 0.20, reach: -0.20 },
      special: { name: "Brimstone Signal Fire", desc: "Burning raw bloodstone on high watch-towers casts an eerie crimson haze over the territory, warning of movements but inducing horror" },
    },
    outposts: {
      passive: { power: 0.50, effectiveness: 0.20, scouts: -0.20 },
      special: { name: "Sanguine Warning Totems", desc: "Displaying impaled sacrifices and necrotic runes spikes defensive ranger combat bloodlust but deteriorates the sanity of nearby scouts" },
    },
    training: {
      passive: { power: 0.50, speed: 0.20, output: -0.20 },
      special: { name: "Crucible Agony Training", desc: "Troops undergo high-pain blood rites that amplify battlefield rage and raw damage output, but their chaotic focus reduces overall tactical compliance" },
    },
    castles: {
      passive: { income: 0.50, prestige: -0.20 },
      special: { name: "Blood-Sacrifice Vaults", desc: "Underground chambers dedicated to dark bloodstones convert dead siege soldiers as defensive energy, raising defense but scaring away foreign envoys" },
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
    guard_towers: {
      passive: { reach: 0.35, detection: 0.30, power: 0.20 },
      special: { name: "Dewdrop Lens Arrays", desc: "Large, crystal-pure water lenses formed from petrified sap magnify tiny motion paths, highlighting forest movements clearly" },
    },
    outposts: {
      passive: { effectiveness: 0.35, scouts: 0.30, power: 0.20 },
      special: { name: "Yggdrasil Whisper-Vines", desc: "Living vines wrapped around the posts whisper forest secrets to sentries, conveying real-time geographical shifts and scout intelligence" },
    },
    training: {
      passive: { speed: 0.35, output: 0.30, power: 0.20 },
      special: { name: "Yggdrasil Sap Infusions", desc: "Providing recruits with diluted, nutrient-packed World Tree sap enhances bone recovery speeds, accelerating physical conditioning limits" },
    },
    castles: {
      passive: { income: 0.35, prestige: 0.30 },
      special: { name: "Elder Sap Tapestries", desc: "Living sap-pulsing tapestries decorate the keep, boosting citizens' health and loyalty, increasing tax yields and prestige" },
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
    guard_towers: {
      passive: { reach: 1.20, detection: 0.80, power: -0.40 },
      special: { name: "Astral Sight Rifts", desc: "Sentry platforms are warped to shift slightly above standard space, giving guards wide-angle visual reach with spatial vertigo" },
    },
    outposts: {
      passive: { scouts: 1.20, effectiveness: 0.80, power: -0.40 },
      special: { name: "Sub-Spatial Watchtowers", desc: "The outpost's tower peaks are phased into the astral plane, granting rangers unmatched high-altitude surveillance across multiple dimensional folds" },
    },
    training: {
      passive: { output: 1.20, speed: 0.80, power: -0.40 },
      special: { name: "Dimensional Slip Sparring", desc: "Recruits drill inside folding spatial gates to master half-step phase slips, allowing them to dodge lethal swings at the price of sensory displacement" },
    },
    castles: {
      passive: { prestige: 1.20, income: -0.40 },
      special: { name: "Astral Phasing Throne", desc: "Harnesses void tears to phase the inner castle sanctum out of the physical world during attacks, granting vast cosmic prestige and immunity to normal physical siege" },
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
    guard_towers: {
      passive: { reach: 0.30, power: 0.15, detection: 0.20 },
      special: { name: "Mammoth Fossil Beacon", desc: "Gigantic rib towers allow constructing extremely high sentinel watch nests, extending heavy siege ballistics coverage" },
    },
    outposts: {
      passive: { power: 0.30, effectiveness: 0.15, scouts: 0.20 },
      special: { name: "Gargantuan Colossus Sentry", desc: "Skeletal frameworks from ancient monolith titans reinforce watchtowers, providing absolute high-ground cover against counter-artillery" },
    },
    training: {
      passive: { power: 0.30, speed: 0.15, output: 0.20 },
      special: { name: "Gargantuan Rucksack Drills", desc: "Lifting petrified titan bones forces unparalleled muscle and bone density expansions, allowing troops to shoulder heavier steel armor easily" },
    },
    castles: {
      passive: { income: 0.30, prestige: 0.15 },
      special: { name: "Megalith Titan Rib Gates", desc: "Replaces traditional drawgates and watch-towers with monolithic fossilized titan bones, easily deflecting standard siege ram blows" },
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

// Build the complete index of fragments where farms, granaries, housing, guard_towers,
// outposts, training, and castles are fully populated with their attunement logic,
// and all other 12 panel buildings are initialized but empty.
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
