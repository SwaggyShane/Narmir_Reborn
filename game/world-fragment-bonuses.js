/**
 * World Fragment Bonuses System
 * Each of 10 world fragments provides unique bonuses to each of the 19 building types.
 * All buildings from the build panel are fully populated with balanced passive bonuses,
 * special abilities, and strategic synergies.
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
      passive: { capacity: 0.10, stability: 0.05, morale: 0.05, happiness: 0.05, growth: 0.05 },
      special: { name: "Geothermal Hearth", desc: "Underfloor heating pipes tap volcanic veins. Citizens stay warm through brutal winters" },
    },
    libraries: {
      passive: { research_speed: 0.15, warmth: 0.10 },
      special: { name: "Heat-Hardened Archive", desc: "Warm dry air circulates continuously, preventing parchment decay and humidity damage" },
    },
    schools: {
      passive: { speed: 0.15, output: 0.10 },
      special: { name: "Thermal Computing", desc: "Underground volcanic steam vents drive mechanical sorting gears, accelerating calculation speeds" },
    },
    mage_towers: {
      passive: { mana: 0.15, manaRegen: 0.10, power: 0.05 },
      special: { name: "Magma Conduit", desc: "Plugging direct volcanic channels into the focus prisms overcharges flame and geothermal attacks with raw kinetic force" },
    },
    shrines: {
      passive: { morale: 0.15, healing: 0.10 },
      special: { name: "Geothermal Hearth", desc: "Thermal hot springs heat consecrated bathing basins, accelerating soldier and civilian recovery rates during cold turns" },
    },
    mausoleums: {
      passive: { capacity: 0.15, power: 0.10 },
      special: { name: "Geothermal Reanimation", desc: "Underground lava vents heat sarcophagi, curing necrotic sinew faster and accelerating reanimation turnover" },
    },
    markets: {
      passive: { income: 0.15, metal_trading: 0.10 },
      special: { name: "Geothermal Foundry-Market", desc: "Warm open-air foundries facilitate metal smelting and ingot trade-guilds directly on site, speeding up gold cycles" },
    },
    taverns: {
      passive: { morale: 0.25, happiness: 0.10 },
      special: { name: "Molten Mug Distilleries", desc: "Underground thermal pipe coils heat copper brewing tanks, distilling volatile, hot stouts that keep the working population incredibly merry and motivated" },
    },
    vaults: {
      passive: { gold_security: 0.30, economy_output: 0.15 },
      special: { name: "Thermal Ingot Vaults", desc: "Constant magma pipes keep vault alloy gates heat-fused, making them completely immune to physical lockpicking or tunneling" },
    },
    armories: {
      passive: { garrison_defense: 0.30, siege_output: 0.15 },
      special: { name: "Volcanic Core Mail", desc: "Plates quenched in thermal lava canals gain heat-retentive guards, making them highly resistant to frost weapons or cold fatigue" },
    },
    smithies: {
      passive: { speed: 0.15, production: 0.10, quality: 0.05 },
      special: { name: "Geothermal Blast Forge", desc: "Thermal heat fuels high-temperature bellow vents, accelerating tool-crafting and weapon-forging turn cycles" },
    },
    barracks: {
      passive: { training: 0.30, capacity: 0.15 },
      special: { name: "Pyroclastic Billeting", desc: "Thermal vents located under troop quarters provide constant heating. Troops stay active even in freezing outdoor blizzards, accelerating preparation rounds" },
    },
    walls: {
      passive: { health: 0.30, defense: 0.15 },
      special: { name: "Magma Parapets", desc: "Thermal insulation warms the bricks. Pouring lava-infused liquids down the battlements melts climbing equipment, damaging enemy engineers" },
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
      passive: { capacity: 0.25, decay_reduction: 0.15 },
      special: { name: "Organic Preservation", desc: "Roots cocoon stored crops in suspended animation. Food decay over winters reduced to zero" },
    },
    housing: {
      passive: { capacity: 0.20, stability: 0.30, growth: 0.10 },
      special: { name: "Treehouse Canopy", desc: "Dwellings weave into living canopies. Citizens remain in maximum happiness" },
    },
    libraries: {
      passive: { research_speed: 0.20, forest_sight: 0.25 },
      special: { name: "Sylvan Whispers", desc: "Living paper pages whisper ancient secrets directly to librarians" },
    },
    schools: {
      passive: { speed: 0.20, output: 0.25 },
      special: { name: "Sylvan Whispers", desc: "Communing with the ancient soil opens forgotten histories. Academic morale remains perfectly stabilized" },
    },
    mage_towers: {
      passive: { mana: 0.20, forest_sight: 0.25 },
      special: { name: "Sylvan Wards", desc: "Roots weave directly into the tower's foundational circle, naturally absorbing spell backlash and stabilizing nearby soil" },
    },
    shrines: {
      passive: { healing: 0.20, forest_sight: 0.25 },
      special: { name: "Yggdrasil Communion", desc: "Shrines sprout living roots that merge with natural ley-lines, granting nearby scouts panoramic forest visibility" },
    },
    mausoleums: {
      passive: { power: 0.20, forest_sight: 0.25 },
      special: { name: "Deep Forest Catacombs", desc: "Twisted roots lock coffin vaults, channeling forest shadows to grant scouts enhanced sensory vision" },
    },
    markets: {
      passive: { income: 0.20, forest_trade: 0.25 },
      special: { name: "Sylvan Whispering Bazaars", desc: "Trade booths constructed inside living wood receive woodland wisdom, maintaining stable prices and boosting barter ratios" },
    },
    taverns: {
      passive: { morale: 0.30, happiness: 0.25 },
      special: { name: "Sylvan Forest Bars", desc: "Constructing bars directly within ancient hollow trunks connects drinkers with woodland spirits, ensuring zero brawls and stable peace" },
    },
    vaults: {
      passive: { espionage_shield: 0.30, forest_growth: 0.15 },
      special: { name: "Root-Bound Safes", desc: "Living Elven wood roots tightly wrap gold chests; any tampering triggers roots to constrict and lock down the treasury" },
    },
    armories: {
      passive: { espionage_guard: 0.30, ranged_offense: 0.15 },
      special: { name: "Sylvan Camouflage", desc: "Arming soldiers in living ironwood armor blends them seamlessly into local forests, making patrols extremely hard to spot" },
    },
    smithies: {
      passive: { speed: 0.20, production: 0.15, quality: 0.20 },
      special: { name: "Living Wood Forges", desc: "Fusing wood-sap with iron makes tools lightweight, flexible, and virtually unbreakable, boosting smithy yields" },
    },
    barracks: {
      passive: { training: 0.30, capacity: 0.15 },
      special: { name: "Sylvan Archery Hubs", desc: "Archery ranges set within ancient majestic elven trees improve rangers' natural aiming abilities, granting bonus garrison arrows" },
    },
    walls: {
      passive: { health: 0.30, defense: 0.15 },
      special: { name: "Sylvan Bramble-Weaves", desc: "Living tree roots tightly wrap around the masonry, holding the wall together during catastrophic earth-shake or heavy siege fire" },
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
      passive: { capacity: 0.15, raid_security: 0.50 },
      special: { name: "Draconic Ward", desc: "Granary walls lined with draconic scales. Blocks 100% of rats, pests, and enemy food theft" },
    },
    housing: {
      passive: { capacity: 0.10, defenses: 0.25, growth: 0.05 },
      special: { name: "Fortified Keeps", desc: "Draconic scales line outer walls. Shelters are highly secure and flame-retardant" },
    },
    libraries: {
      passive: { research_speed: 0.05, document_armor: 0.40 },
      special: { name: "Fireproof Scriptorium", desc: "Dragon scale coatings make all historical papers immune to fire" },
    },
    schools: {
      passive: { speed: 0.05, output: 0.35 },
      special: { name: "Draconic Isolation", desc: "Scale-plated shingles reflect hostile magical attacks, insulating laboratories from enemy sabotage" },
    },
    mage_towers: {
      passive: { mana: 0.10, spell_resistance: 0.40 },
      special: { name: "Wyrmfire Focus", desc: "Scale-reinforced glass walls form a natural cage, shielding channelling wizards from external disruption and curses" },
    },
    shrines: {
      passive: { power: 0.10, raid_protection: 0.35 },
      special: { name: "Draconic Sanctuary", desc: "Consecrated vaults are layered with gold dragon scales, preventing dynamic resources or magical relies from being stolen during raids" },
    },
    mausoleums: {
      passive: { capacity: 0.10, defenses: 0.40 },
      special: { name: "Obsidian Spire Wards", desc: "Lining catacomb walls with dragon scales forms standard flame-proof plating, absorbing incoming siege attacks" },
    },
    markets: {
      passive: { income: 0.05, anti_theft_security: 0.40 },
      special: { name: "Draconic Coinage", desc: "Coinage pressed under scaled scales glows if counterfeit, and vaults become impervious to sabotage or raid theft" },
    },
    taverns: {
      passive: { morale: 0.15, happiness: 0.10 },
      special: { name: "The Fire-Drake Hearth", desc: "Insulating fireboxes and furniture boards with dragon scales makes taverns totally flameproof, neutralizing structural fires" },
    },
    vaults: {
      passive: { gold_security: 0.15, hoard_protection: 0.40 },
      special: { name: "Golden Hoard Lairs", desc: "Lining gold piles with scales activates a draconic curse on intruders, burning up to 50% of successful thievish units" },
    },
    armories: {
      passive: { garrison_defense: 0.15, flame_resistance: 0.40 },
      special: { name: "Dragonscale Cuirasses", desc: "Garrison forces receive armor plating forged from actual dragon scales, neutralizing up to 40% of magical fire damage" },
    },
    smithies: {
      passive: { speed: 0.40, production: 0.05, quality: 0.05 },
      special: { name: "Wyrmfire Blast Furnaces", desc: "Dragon-scale insulation allows containing intense draconic flames, accelerating smithy manufacture speeds" },
    },
    barracks: {
      passive: { training: 0.15, flame_endurance: 0.40 },
      special: { name: "Fire-Drake Billeting", desc: "Coating training shields in red wyrmscale increases recruits' heat tolerances enormously, fully protecting them from environmental scorch effects" },
    },
    walls: {
      passive: { health: 0.15, defense: 0.40 },
      special: { name: "Wyrmscale Bastions", desc: "Coating guard turrets in obsidian scales shrugs off incoming siege fireballs, granting immune indicators against burning effects" },
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
    farms: {
      passive: { production: 0.20, chaos: 0.15 },
      special: { name: "Abyssal Growth", desc: "Crops grown in crystalline deep-dark soil produce chaotic, unpredictable yields" },
    },
    granaries: {
      passive: { capacity: 0.35, magic_output: 0.05 },
      special: { name: "Glacial Cryostasis", desc: "Deep underdark crystals lock granary in lightless frost. Permanently halts organic breakdown" },
    },
    housing: {
      passive: { capacity: 0.15, magic_output: 0.10, growth: 0.05 },
      special: { name: "Shadow Attunement", desc: "Crystalline-infused houses produce magical output as citizens meditate and rest" },
    },
    libraries: {
      passive: { decoding_speed: 0.30, magic_output: 0.10 },
      special: { name: "Shadow Scripts", desc: "Illuminates invisible texts on ancient scrolls under purple crystal light" },
    },
    schools: {
      passive: { speed: -0.15, output: 0.15 },
      special: { name: "Void Transcription", desc: "Obsidian crystal glow uncovers ancient underdark runes, reducing all school spellbook costs by 15%" },
    },
    mage_towers: {
      passive: { mana: 0.30, dark_magic_output: 0.15 },
      special: { name: "Singularity Focus", desc: "Deep crystalline focus-stones bend local atmospheric magic, vastly reducing processing cooldowns on underworld spells" },
    },
    shrines: {
      passive: { spell_resistance: 0.30, dark_magic_output: 0.15 },
      special: { name: "Penance Shards", desc: "Harnessing underdark radiation forces deep spiritual introspection, doubling defense values against enemy shadow spells" },
    },
    mausoleums: {
      passive: { capacity: 0.30, spell_resistance: 0.15 },
      special: { name: "Umbral Cryostasis", desc: "Crystalline spires focus absolute shadow light, shielding resting Thralls from holy light or banishing spells" },
    },
    markets: {
      passive: { secret_decoding: 0.30, dark_trade_gains: 0.15 },
      special: { name: "Shadow Exchanges", desc: "Subterranean black-markets use dark crystal lights to evaluate smuggling contracts, significantly boosting dark magical currency income" },
    },
    taverns: {
      passive: { morale: 0.40, happiness: 0.15 },
      special: { name: "Whispering Crystal Parlors", desc: "Subterranean violet crystals capture soundwaves from conversations. Makes it incredibly easy to detect, intercept, or defuse enemy spy networks" },
    },
    vaults: {
      passive: { secret_decryption: 0.30, shadow_trade: 0.15 },
      special: { name: "Crystalline Shadow Pools", desc: "Underdark crystals refract light, concealing accurate treasury valuations and making total gold immune to scout spells" },
    },
    armories: {
      passive: { infiltration_defense: 0.30, stealth_detection: 0.15 },
      special: { name: "Resonant Focusing Shields", desc: "Installing deep violet crystalline arrays in arsenals reveals subtle sound vibrations, catching stealthy intruders instantly" },
    },
    smithies: {
      passive: { speed: 0.20, production: 0.10, quality: 0.30 },
      special: { name: "Void-Crystalline Forges", desc: "Infusing hammers with resonant underdark crystals raises the quality of blades and locks under dark light" },
    },
    barracks: {
      passive: { training: 0.30, capacity: 0.15 },
      special: { name: "Crystalline Echo Ranges", desc: "Shadow crystals capture echo patterns of movement, training troops in silent footfalls and making stealth squads virtually silent" },
    },
    walls: {
      passive: { health: 0.30, defense: 0.15 },
      special: { name: "Resonant Earth-Siren", desc: "Quartz crystal arrays resonate deep in the earth, sounding immediate alarms when miners attempt to tunnel under the fort" },
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
    granaries: {
      passive: { capacity: 0.25, morale_stability: 0.20 },
      special: { name: "Manna Manifestation", desc: "Stored food is blessed. Portion of reserves auto-distributed to boost morale on unstable turns" },
    },
    housing: {
      passive: { capacity: 0.25, stability: 0.35, growth: 0.20 },
      special: { name: "Holy Sanctuaries", desc: "Angelic grace prevents civil unrest. Rioting and immigration desertion are greatly reduced" },
    },
    libraries: {
      passive: { research_speed: 0.25, morale_sight: 0.35 },
      special: { name: "Heavenly Revelations", desc: "Angelic scriptures float down from skylights, resolving complex studies automatically" },
    },
    schools: {
      passive: { speed: 0.25, output: 0.20 },
      special: { name: "Angelic Tutelage", desc: "Holy instructions from celestial visions empower your Cleric recruits, eliminating all school unrest" },
    },
    mage_towers: {
      passive: { mana: 0.25, divine_light: 0.30 },
      special: { name: "Nimbus Shields", desc: "Angelic grace focuses natural sky lumens, casting a soft dome of pure defensive light that neutralizes negative curses" },
    },
    shrines: {
      passive: { healing: 0.35, faith_morale: 0.40 },
      special: { name: "Blessed Resurrections", desc: "Heavenly light baths the healing chambers; wounded units revive with +10% maximum health and zero morale fatigue" },
    },
    mausoleums: {
      passive: { capacity: 0.25, power: 0.35 },
      special: { name: "Penitent Sentinels", desc: "Winds of grace whisper through crypt pillars, keeping the baseline undead completely loyal and free from revolt" },
    },
    markets: {
      passive: { income: 0.25, merchant_morale: 0.35 },
      special: { name: "Heavenly Tithes", desc: "Mercantile angels bless standard exchanges, removing commercial greed or unrest and stabilizing transaction safety" },
    },
    taverns: {
      passive: { morale: 0.40, happiness: 0.35 },
      special: { name: "The Heavenly Angel Tavern", desc: "Bards sing angelic melodies from the rafters, removing baseline societal grief or rioting. Citizen happiness never drops below 50%" },
    },
    vaults: {
      passive: { gold_security: 0.25, grace_index: 0.35 },
      special: { name: "Empyrean Sanctuaries", desc: "Blessed vaults emit divine light, keeping currency stored inside fully immune to curses, corruption, or tax rot" },
    },
    armories: {
      passive: { garrison_defense: 0.25, morale_recovery: 0.35 },
      special: { name: "Aureole Plating", desc: "Blessed armors radiate an absolute aura of purity, keeping soldiers inspired and speeding up combat morale recovery" },
    },
    smithies: {
      passive: { speed: 0.25, production: 0.15, quality: 0.25 },
      special: { name: "Aureole Forging", desc: "Heavenly light purifies raw metals, forging pristine, flawless instruments with blessed precision" },
    },
    barracks: {
      passive: { training: 0.25, capacity: 0.35 },
      special: { name: "Seraphic Parade Grounds", desc: "Recruits study sacred angelic tactical scrolls. Morale failure rates drop to zero, keeping troop units highly disciplined" },
    },
    walls: {
      passive: { health: 0.25, defense: 0.35 },
      special: { name: "Empyrean Divine Barriers", desc: "The wall emits a soothing holy light, regenerating the active HP of defending archers and garrison units stationed on top" },
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
    farms: {
      passive: { production: 0.30, stability: 0.40 },
      special: { name: "Mechanical Harvest", desc: "Automated dwarven harvesters use precision clockwork to maximize crop efficiency" },
    },
    granaries: {
      passive: { capacity: 0.50, defensive_armor: 0.15 },
      special: { name: "Piston Silos", desc: "Motorized steam pistons continuously compress and aerate grains, maximizing holding density" },
    },
    housing: {
      passive: { capacity: 0.40, defenses: 0.10, growth: 0.10 },
      special: { name: "Retractable Apartments", desc: "Dwarven clockwork bunks and fold-out structures fit more citizens in less space" },
    },
    libraries: {
      passive: { research_speed: 0.40, record_impenetrability: 1.00 },
      special: { name: "Impenetrable Star-Metal Lockboxes", desc: "Maps, locations, and relic coordinates cannot be lost, stolen, or erased by curses" },
    },
    schools: {
      passive: { speed: 0.40, output: 0.10 },
      special: { name: "Star-Metal Calculators", desc: "Brass differential engines automate repetitive calculations, vastly speeding up scientific research" },
    },
    mage_towers: {
      passive: { mana: 0.15, spell_precision: 0.50 },
      special: { name: "Harmonic Concentrators", desc: "Perfect clockwork lenses focus spell arrays down to micro-millimeter precision, making bolts impossible to deflect or dodge" },
    },
    shrines: {
      passive: { morale: 0.15, defense_armor: 0.50 },
      special: { name: "Star-Metal Sentinels", desc: "Mechanical incense burners distribute gold dust across armor plates, naturally fortifying defenders against siege attacks" },
    },
    mausoleums: {
      passive: { capacity: 0.40, record_defense: 1.00 },
      special: { name: "Impenetrable Iron Crypts", desc: "Encasing coordinates, blueprints, and relics in seamless Star-Metal boxes makes them incapable of being lost, stolen, or removed by amnesia" },
    },
    markets: {
      passive: { income: 0.40, core_protection: 1.00 },
      special: { name: "Star-Metal Lockbox Ledgers", desc: "Financial records are stored inside clockwork Star-Metal matrices. Accounts cannot be falsified, lost, stolen, or forgotten due to amnesia" },
    },
    taverns: {
      passive: { morale: 0.20, happiness: 0.15 },
      special: { name: "The Vault of Vintage Lockboxes", desc: "Legendary recipes, coordinates, and resources are locked inside code-encrypted Star-Metal drums. Blueprints cannot be lost, stolen, or forgotten by mind curses" },
    },
    vaults: {
      passive: { gold_security: 0.40, core_lockboxes: 1.00 },
      special: { name: "Chronos Gear Locks", desc: "Gears forged of Star-Metal lock main vaults. Treasury cannot be bankrupted or looted, preserving basic transaction safety" },
    },
    armories: {
      passive: { garrison_defense: 0.40, armor_longevity: 1.00 },
      special: { name: "Star-Metal Rivets", desc: "Armor suits are reinforced with clockwork frames. Equipment never breaks, guaranteeing absolute safety in harsh operations" },
    },
    smithies: {
      passive: { speed: 0.40, production: 0.10, quality: 1.00 },
      special: { name: "Clockwork Star-Metal Forges", desc: "Automated clockwork anvils forge indestructible blueprints, gearsets, and hammers with pristine quality" },
    },
    barracks: {
      passive: { capacity: 0.40, training_precision: 1.00 },
      special: { name: "Clockwork Training Dummies", desc: "Steam-powered automatons spar with recruits, maximizing combat precision without risking fatal physical training injuries" },
    },
    walls: {
      passive: { health: 0.40, defense: 1.00 },
      special: { name: "Geared Self-Construction", desc: "Auxiliary clockwork cog-wheels nested within the walls automatically raise fallen bricks, self-repairing wall damage in real-time" },
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
    farms: {
      passive: { production: 0.25, chaos: 0.35 },
      special: { name: "Bloodsoaked Fields", desc: "Cursed soil grows crops stained with dark power - massive yields but unstable harvests" },
    },
    granaries: {
      passive: { capacity: 0.30, combat_attunement: 0.20 },
      special: { name: "Vampiric Silos", desc: "Spoiling food distilled into dark elixir. Increases military attack speed but spikes chaos" },
    },
    housing: {
      passive: { capacity: 0.50, stability: -0.20, growth: -0.10 },
      special: { name: "Blood Pact Lodgings", desc: "Explosive population density powered by dark covenant. Raw workforce expansion at stability cost" },
    },
    libraries: {
      passive: { research_speed: 0.50, chaos_index: 0.15 },
      special: { name: "Sanguine Cartography", desc: "Maps drawn in blood update geography in real-time but cause intense psychological stress" },
    },
    schools: {
      passive: { speed: 0.50, output: 0.20 },
      special: { name: "Taboo Alchemical Arts", desc: "High-intensity experiments with forbidden humors speed up breakthrough turns but raise local chaos" },
    },
    mage_towers: {
      passive: { mana: 0.50, chaos_index: 0.20 },
      special: { name: "Sanguine Battery", desc: "Capping local ley-lines in bloodstone lets summoners feed minor lifeforce pools directly from housing to double spellpower" },
    },
    shrines: {
      passive: { healing: 0.50, chaos_index: 0.20 },
      special: { name: "Sanguine Transfusion", desc: "Clerics transmute raw life force directly. Revives units instantly at high speeds but raises chaotic corruption" },
    },
    mausoleums: {
      passive: { capacity: 0.50, chaos_index: 0.20 },
      special: { name: "Cruor Coils", desc: "Infusing channels with pure vampire bloodstone triples reanimation yields, but causes local populations to panic" },
    },
    markets: {
      passive: { income: 0.50, chaos_index: 0.15 },
      special: { name: "Sanguine Auction Guilds", desc: "Elite auction houses deal in forbidden alchemical drops and life contracts, yielding extreme tax profits at high chaotic costs" },
    },
    taverns: {
      passive: { morale: 0.50, happiness: 0.20 },
      special: { name: "The Cruor Blood Club", desc: "Infusing brewing reservoirs with forbidden nectar maximizes citizen and military morale instantly, but spikes civil chaos indexes" },
    },
    vaults: {
      passive: { economy_output: 0.50, stability: -0.20 },
      special: { name: "Sanguine Vault Tax", desc: "Storing gold in bloodstone alters currency with dark magic, amplifying kingdom tax revenues at high local stability costs" },
    },
    armories: {
      passive: { combat_damage: 0.50, unit_recovery: -0.20 },
      special: { name: "Sanguine Sharpness", desc: "Smearing arsenal blades with cursed ichor converts standard strikes into life-draining hits, but drains troop rest" },
    },
    smithies: {
      passive: { speed: 0.15, production: 0.50, quality: 0.10 },
      special: { name: "Sanguine Crucible", desc: "Sacrificing lifeforce into crucible pools supercharges blacksmith yield rates at dynamic chaotic costs" },
    },
    barracks: {
      passive: { training: 0.50, capacity: 0.20 },
      special: { name: "Sanguine Ritual Circles", desc: "Dipping barracks banners in bloody crucible pools sparks a dark bloodlust, multiplying recruit generation rates at high civil unrest costs" },
    },
    walls: {
      passive: { health: 0.50, defense: -0.20 },
      special: { name: "Sanguine Blood-Thorns", desc: "Pouring dark magic over the stones triggers razor-sharp bloodstone thorns to erupt, shredding any unit that attempts to scale the walls" },
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
      passive: { capacity: 0.40, growth_rate: 0.50 },
      special: { name: "Cellular Biosphere", desc: "World Tree spores seed reserves. Stored grains self-replicate at +2% per turn" },
    },
    housing: {
      passive: { capacity: 0.35, stability: 0.25, growth: 0.25 },
      special: { name: "Lifespring Spores", desc: "Curing waters fill district fonts. Zero infant mortality, natural growth boosted +50%" },
    },
    libraries: {
      passive: { research_speed: 0.35, spell_efficiency: 0.30 },
      special: { name: "Dew of Understanding", desc: "Sipping microscopic water drops doubles comprehension speed and memory retention" },
    },
    schools: {
      passive: { speed: 0.35, output: 0.30 },
      special: { name: "Botanical Courtyards", desc: "Drinking from World Tree dew fonts doubles student comprehension speeds and magic regeneration" },
    },
    mage_towers: {
      passive: { mana: 0.35, mana_efficiency: 0.30 },
      special: { name: "Mana Geyser", desc: "Pristine tree dew floods the cooling pool, allowing active spellbooks to regenerate passive spell slots automatically" },
    },
    shrines: {
      passive: { healing: 0.40, cleric_efficacy: 0.30 },
      special: { name: "Nectar of Life", desc: "Dew collected from wild tree leaves heals injured troops without spending material herbs, cutting upkeep costs" },
    },
    mausoleums: {
      passive: { capacity: 0.35, growth_rate: 0.30 },
      special: { name: "Verdant Rejuvenation", desc: "Dew droplets seep down to graves; flesh and muscle fibers regenerate perfectly, boosting Thrall health" },
    },
    markets: {
      passive: { income: 0.35, trade_stability: 0.30 },
      special: { name: "Oasis Bazaars", desc: "Merchant caravans drinking tree dew experience exceptional stamina, establishing continuous trades without delay" },
    },
    taverns: {
      passive: { morale: 0.35, happiness: 0.30 },
      special: { name: "World-Tree Elixir Fonts", desc: "Drinking the dew improves vitality, reducing the hire cost of tavern mercenaries by 15% and doubling their rest recovery" },
    },
    vaults: {
      passive: { gold_security: 0.35, life_growth: 0.30 },
      special: { name: "Yggdrasil Resin Casings", desc: "Wrapping logs and chests in petrified amber resin ensures financial systems and credit indexes thrive without decay" },
    },
    armories: {
      passive: { garrison_defense: 0.35, health_recovery: 0.30 },
      special: { name: "Amber Breastplates", desc: "Infusing breastplates with glowing petrified sap accelerates natural wound closures, helping soldiers stand" },
    },
    smithies: {
      passive: { speed: 0.35, production: 0.20, quality: 0.30 },
      special: { name: "Yggdrasil Fuel Glands", desc: "Soaking furnaces in glowing sap reduces fuel requirements, keeping bellows pumping continuously" },
    },
    barracks: {
      passive: { capacity: 0.35, unit_health: 0.30 },
      special: { name: "Yggdrasil Rest Chambers", desc: "Sleeping quarters carved adjacent to glowing root nodes revitalize injured soldiers overnight, boosting their overall constitutional healing" },
    },
    walls: {
      passive: { health: 0.35, defense: 0.30 },
      special: { name: "Amber-Slick Ramparts", desc: "Coating walls in Yggdrasil sap makes them incredibly sticky and slippery at the same time, increasing climbing ladder fail rates by 30%" },
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
      passive: { capacity: 2.00, quantum_flux: 0.15 },
      special: { name: "Void Pantry", desc: "Granary folds into pocket dimension for massive volume. 5% chance per turn food vanishes" },
    },
    housing: {
      passive: { capacity: 1.20, stability: -0.30, growth: -0.20 },
      special: { name: "Void Pocket Lofts", desc: "Living rooms fold into pocket dimensions. Massive capacity with mild disorientation penalty" },
    },
    libraries: {
      passive: { research_speed: -0.30, chaos_index: 0.20 },
      special: { name: "Void Codex", desc: "Research becomes unpredictable; studies may jump forward rapidly or regress without warning" },
    },
    schools: {
      passive: { speed: 1.20, output: -0.40 },
      special: { name: "Quantum Paradoxes", desc: "Multi-dimensional lecture halls stretch students' minds, spikes research output but causes odd absences" },
    },
    mage_towers: {
      passive: { mana: 1.20, mind_stability: -0.40 },
      special: { name: "Portal Conduits", desc: "Rips open direct holes in reality, funneling raw astral energies that hypercharge output but trigger local portal leaks" },
    },
    shrines: {
      passive: { morale: 1.20, mind_stability: -0.40 },
      special: { name: "Telescopic Epiphany", desc: "Shrine ceilings fold directly into cosmic rifts, granting astronomical knowledge but driving scholars to eccentricity" },
    },
    mausoleums: {
      passive: { capacity: 1.20, mind_stability: -0.40 },
      special: { name: "Shattered Portal Sarcophagi", desc: "Undead rise from tear-rifts in reality, allowing infinite capacity expansion at the cost of mild local disorientation" },
    },
    markets: {
      passive: { income: 1.20, mind_stability: -0.40 },
      special: { name: "Quantum Shopping Matrix", desc: "Connects trade districts to multi-planar channels, generating outrageous gold flows while causing temporary citizen absences" },
    },
    taverns: {
      passive: { morale: 1.20, happiness: 0.80 },
      special: { name: "The Singularity Saloon", desc: "Connects fireplaces and hallways directly to interdimensional taprooms, providing absolute morale boosts at the price of brief spatial absences" },
    },
    vaults: {
      passive: { gold_security: 1.20, trade_stability: -0.40 },
      special: { name: "Dimensional Pocket Vaults", desc: "Moving gold reserves into sub-spatial pocket dimensions guarantees perfect safety, though loans experience mild delays" },
    },
    armories: {
      passive: { garrison_defense: 1.20, structural_stability: -0.40 },
      special: { name: "Phase-Shifting Arsenals", desc: "Armors are tethered to sub-spatial folds, allowing soldiers to phase through blades, though at structural lag costs" },
    },
    smithies: {
      passive: { speed: -0.40, production: 1.20, quality: 0.30 },
      special: { name: "Quantum Portal Anvils", desc: "Anvils are tethered across multiple spatial dimensions, duplicating weapons but introducing spatial lag" },
    },
    barracks: {
      passive: { training: 0.80, capacity: 1.20 },
      special: { name: "Sub-Spatial Barracks", desc: "Trainees are housed in folding localized pocket-dimension bunks, creating infinite barracks storage space, though space lag delays deployment" },
    },
    walls: {
      passive: { health: 1.20, defense: -0.40 },
      special: { name: "Phased Spatial Displacement", desc: "The wall system fluctuates dimensionally. Up to 40% of standard incoming catapult projectiles pass completely through into the void without doing damage" },
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
    farms: {
      passive: { production: 0.35, stability: 0.20 },
      special: { name: "Colossus Fields", desc: "Enormous fossilized bones buried in soil create naturally rich, stable farmland" },
    },
    granaries: {
      passive: { capacity: 1.00, fortifications: 0.20 },
      special: { name: "Megastructures", desc: "Fossilized skeletal columns support towering silos. Storage capabilities scale exponentially" },
    },
    housing: {
      passive: { capacity: 0.60, defenses: 0.15, growth: 0.15 },
      special: { name: "Goliath Dwellings", desc: "Colossal foundations built on titanic skeletons. Allows massive multi-story structures" },
    },
    libraries: {
      passive: { research_speed: 0.75, record_capacity: 0.50 },
      special: { name: "Colossal Archives", desc: "Titanic skeletal supports allow libraries to expand indefinitely with vault-like record storage" },
    },
    schools: {
      passive: { speed: 0.30, output: 0.15 },
      special: { name: "Anatomical Blueprinting", desc: "Fossilized titanic skeletons provide perfect structural architectural models, making buildings cheaper to construct" },
    },
    mage_towers: {
      passive: { mana: 0.30, tower_integrity: 0.15 },
      special: { name: "Goliath Spire", desc: "Fossilized giant bones serve as massive tuning forks, expanding spell casting ranges across adjacent kingdom provinces" },
    },
    shrines: {
      passive: { capacity: 0.30, fortifications: 0.15 },
      special: { name: "Goliath Temples", desc: "Monolithic bone arches support towering prayer chambers, expanding the maximum space to store wounded soldiers" },
    },
    mausoleums: {
      passive: { power: 0.30, tower_integrity: 0.15 },
      special: { name: "Titan Bone Sentinels", desc: "Weaving fossilized titan rib-cages into the architecture fortifies defenses, creating colossal towers that expand unit ranges" },
    },
    markets: {
      passive: { income: 0.30, capacity_expansion: 0.15 },
      special: { name: "Goliath Trade Halls", desc: "Gigantic columns carved from titan skulls support monumental domes with massive stall capacity, maximizing trader retention" },
    },
    taverns: {
      passive: { morale: 0.30, happiness: 0.15 },
      special: { name: "Goliath Drink Halls", desc: "Massive tables and columns carved out of fossilized titanic ribs support massive halls with immense capacity for holding grand festivals" },
    },
    vaults: {
      passive: { storage_capacity: 0.30, density_bounds: 0.15 },
      special: { name: "Megastructure Sub-Vaults", desc: "Massive load-bearing bone pillars allow drilling incredibly deep, secure chambers, expanding storage scale" },
    },
    armories: {
      passive: { holding_capacity: 0.30, armor_heavy_density: 0.15 },
      special: { name: "Colossal Aegis Slabs", desc: "Massive bone supports allow stocking colossal titan-sized shields, turning local walls into impenetrable monoliths" },
    },
    smithies: {
      passive: { speed: 0.15, production: 0.30, quality: 0.20 },
      special: { name: "Mammoth Anvil Pillars", desc: "Anvils constructed over mammoth fossilized jawbones increase capacity for high-volume metalworking" },
    },
    barracks: {
      passive: { training: 0.30, capacity: 0.15 },
      special: { name: "Titan-Rib Palisades", desc: "Walls constructed out of gargantuan marrow bones reinforce the training grounds, converting barracks into impenetrable sub-citadels during siege times" },
    },
    walls: {
      passive: { health: 0.30, defense: 0.15 },
      special: { name: "Colossal Rib-Buttresses", desc: "Megalithic fossilized bones reinforce the support pillars, completely neutralizing standard wooden battering rams" },
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
