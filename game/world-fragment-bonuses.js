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
    schools: {
      passive: { output: 0.15, mana_output: 0.10 },
      special: { name: "Thermal Computing", desc: "Underground volcanic steam vents drive mechanical sorting gears, accelerating calculation speeds" },
    },
    mage_towers: {
      passive: { mana: 0.15, spellcasting: 0.10 },
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
      passive: { morale_output: 0.25, stout_strength: 0.10 },
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
    schools: {
      passive: { output: 0.20, stability: 0.25 },
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
      passive: { morale_output: 0.30, forest_sight: 0.25 },
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
    schools: {
      passive: { output: 0.05, spell_defense: 0.35 },
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
      passive: { morale_output: 0.15, anti_arson_shield: 0.40 },
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
    schools: {
      passive: { spellbook_cost: -0.15, dark_magic_output: 0.15 },
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
      passive: { counter_espionage: 0.40, shadow_spells: 0.15 },
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
    schools: {
      passive: { output: 0.25, cleric_power: 0.20 },
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
      passive: { morale_output: 0.40, grace_index: 0.35 },
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
    schools: {
      passive: { output: 0.40, siege_power: 0.10 },
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
      passive: { morale_output: 0.20, brew_preservation: 1.00 },
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
    schools: {
      passive: { output: 0.50, chaos_index: 0.20 },
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
      passive: { morale_output: 0.50, stability: -0.20 },
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
    schools: {
      passive: { output: 0.35, magic_output: 0.30 },
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
      passive: { morale_output: 0.35, mercenary_rent: 0.30 },
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
    schools: {
      passive: { output: 1.20, comfort: -0.40 },
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
      passive: { morale_output: 1.20, mind_stability: -0.40 },
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
    schools: {
      passive: { output: 0.30, efficiency: 0.15 },
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
      passive: { morale_output: 0.30, capacity_bounds: 0.15 },
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
