# Narmir Reborn - Testing Checklists by System Group

## 1. CORE ECONOMY SYSTEM
**Systems**: Gold, Market Trading, Trade Routes, Banking, Resources, Commodities

### Basic Income Flow
- [ ] Kingdom generates gold per turn (goldPerTurn)
- [ ] Gold changes based on tax rate (0-100%)
- [ ] Tax at 42% applies 5% bonus
- [ ] Tax above 42% reduces happiness and gold generation
- [ ] Tax below 42% increases happiness recovery
- [ ] Castle income applied (+100 per castle)
- [ ] Market income calculated correctly (varies by race & setup)

### Market Trading
- [ ] Buy resources at market price (not enough gold = fails)
- [ ] Sell resources for gold
- [ ] Market prices fluctuate (check commodity_values in config)
- [ ] Trade history visible
- [ ] Resource limits enforced (can't exceed 1M gold, 100K resources, etc.)

### Trade Routes
- [ ] Establish route to allied/neutral kingdom (costs 50,000 gold)
- [ ] Route generates recurring gold per turn
- [ ] Max 5 routes per kingdom
- [ ] Delete route removes recurring income
- [ ] Route efficiency tracked

### Banking System
- [ ] Create deposit at correct interest rate (each tier different)
- [ ] Deposit matures after correct time
- [ ] Withdraw early = interest penalty
- [ ] Deposit name/description saved
- [ ] Multiple deposits allowed

### Resource Management
- [ ] Wood/Stone/Iron gathered by tier buildings
- [ ] Resource expeditions send population & return resources
- [ ] Resource conversion (Coal to Steel) works
- [ ] Commodity prices affect buying/selling value
- [ ] Blueprint & scroll commodities handled separately

---

## 2. COMBAT & MILITARY SYSTEM
**Systems**: Troops, Combat Resolver, War Machines, Mercenaries, Leveling, Defense

### Troop Management
- [ ] Recruit fighters/rangers/clerics/mages/thieves/ninjas/engineers
- [ ] Sufficient gold deducted on recruit
- [ ] Population decreased by unit count
- [ ] Unit caps enforced (support capacity)
- [ ] All 9 unit types recruitable (including Scribes, Thralls for Vampire)

### Combat Resolution
- [ ] Attack calculation considers unit comp, morale, research, levels
- [ ] Attacker/Defender troop losses calculated
- [ ] Land transfers to victor
- [ ] Gold stolen on win
- [ ] Happiness affected (Safety component updates, last_attack_turn recorded)
- [ ] Combat multiplier uses happiness (0.5-1.5x)
- [ ] Battle report generated with details

### War Machines
- [ ] Build war machines (requires engineers)
- [ ] War machines reduce land loss in defense
- [ ] Engineer crew required (variable by race)
- [ ] Dwarf racial bonus: level 5 engineers solo crew at level 5+
- [ ] War machines can be stolen in combat

### Mercenaries
- [ ] Hire 4 tiers (Rabble, Sellsword, Veteran, Elite)
- [ ] Cost increases per tier
- [ ] Mercenaries last X turns then disappear
- [ ] Unit limits still apply to mercenaries

### Troop Leveling
- [ ] Troops gain XP from combat wins/losses
- [ ] Each unit type has separate level tracking
- [ ] Level increases at correct XP thresholds
- [ ] High-level troops stronger (level mult applied in combat)
- [ ] Racial bonuses apply above level 100

### Defense System
- [ ] Walls have HP and reduce land loss (-10% per wall upgrade)
- [ ] Towers detect incoming attacks (alert sent)
- [ ] Defense upgrades (Fortified, Keep, Citadel) increase wall strength
- [ ] Tower upgrades improve detection power
- [ ] Outpost upgrades enhance ranger detection
- [ ] Defense tier multiplier applied in combat

---

## 3. RESEARCH & DEVELOPMENT SYSTEM
**Systems**: Research, Schools, Building Upgrades, Engineers

### Research Progression
- [ ] Assign researchers to discipline
- [ ] Research advances at correct rate (researchIncrement)
- [ ] Happiness multiplier applied (0.5-1.0+ at 100 happiness)
- [ ] School bonus (+2% per 5 schools) applied
- [ ] School upgrades boost research speed
- [ ] Research slows exponentially past level 100 (5% compounding cost)
- [ ] Max cap enforced (varies by discipline & race)

### Multiple Disciplines
- [ ] Players assign researchers across multiple disciplines
- [ ] School unlock allows second discipline at higher research
- [ ] Second discipline researched independently

### Building Upgrades
- [ ] Farm upgrades available (Iron Plows, Irrigated, Plantation)
- [ ] School upgrades (Advanced Curriculum, Repository, Grand Academy)
- [ ] Wall upgrades (Reinforced, Battlements, Fortress)
- [ ] Tower upgrades (Arrow Slits, Watchtower, Signal Tower)
- [ ] Shrine upgrades (Divine Favor, Cleansing)
- [ ] Market upgrades (Merchant Guild, Trade Hub)
- [ ] Library upgrades (increase research speed/bonus)
- [ ] Bank upgrades (increase vault capacity & interest)
- [ ] Mausoleum upgrades (Vampire-specific benefits)
- [ ] Each upgrade costs resources and has requirements

### Engineer Leveling
- [ ] Engineers gain XP and level independently
- [ ] Higher engineer levels reduce tool/resource requirements
- [ ] Engineer XP shown in info panel

---

## 4. MAGIC & SPELL SYSTEM
**Systems**: Spell Casting, Spellbook, Scrolls, Mana, Schools

### Spellbook Research
- [ ] Global spellbook unlocks basic spells (Tier 1-3)
- [ ] School-specific spellbook unlocks school spells
- [ ] Each school has independent research & spell access
- [ ] Spell research requirements enforced (min spellbook level)

### Scroll Crafting
- [ ] Mages create scrolls (turns & mage XP required per spell)
- [ ] Higher-tier spells require more resources
- [ ] Scrolls stored and listed
- [ ] Delete scroll removes from inventory
- [ ] Certified blueprint variant available (if scribes studied fragments)

### Spell Casting
- [ ] Cast spell on own kingdom (buffs) or enemy (debuffs)
- [ ] Sufficient mana deducted
- [ ] Spell effects applied (troops changed, buildings damaged, etc.)
- [ ] Buff duration tracked (5-turn effects, permanent effects, etc.)
- [ ] Multiple buffs stack on same kingdom
- [ ] Spell cooldowns honored (if any)
- [ ] Enemy spell effects debuff defender properly

### Mana Management
- [ ] Mana generates per turn (manaPerTurn)
- [ ] Mana from race bonus + mage towers + clerics
- [ ] Happiness multiplier applied (0.5-1.0+ at 100 happiness)
- [ ] Mana stored in mage towers (cap enforced)
- [ ] Mages gain XP when mana regenerated

### Spell Effects - Various
- [ ] Bless: +15 happiness (5 turns), +50% growth during
- [ ] Divine Favor: Permanent +5 happiness
- [ ] Prosperity: +10 prosperity happiness (3 turns)
- [ ] Attack spells: Troops lost, buildings damaged
- [ ] Debuff spells: Reduce enemy happiness/production

---

## 5. POPULATION & HAPPINESS SYSTEM
**Systems**: Population, Happiness Components, Food, Housing, Growth

### Population Growth
- [ ] Base growth = 0.3% population per turn
- [ ] Happiness >= 80: 30% growth boost (1.3x)
- [ ] Happiness 50-79: Normal growth
- [ ] Happiness 30-49: 30% reduction (0.7x)
- [ ] Happiness < 30: 70% reduction (0.3x)
- [ ] Happiness <= 0: Population fleeing (-5% per turn, multiplier -0.05)
- [ ] Housing cap enforced (blocks growth at 2x capacity)
- [ ] Race growth multipliers applied (Human 1.15x, Dwarf 0.9x, etc.)

### Happiness Calculation
- [ ] Base happiness starts at 50
- [ ] Food happiness: 0-30 (based on food_reserves vs population * 0.5)
  - 0 food = 0 happiness
  - 50% reserves = 15 happiness
  - 100%+ reserves = 30 happiness
- [ ] Entertainment happiness: 0-20 (from taverns, 1.5 per tavern, max 20)
- [ ] Safety happiness: -30 to +20
  - Never attacked = +20
  - 10+ turns since attack = +20
  - Recent attack = -10
  - Linear recovery: -10 + turns*3 (smooth over 10 turns)
- [ ] Prosperity happiness: 0-20 (gold vs population*2)
  - < population = 0
  - = population*2 = 10
  - >= population*5 = 20
- [ ] Race modifier: -10 to +10
  - Dire Wolf +10, Human/Orc +5, Dwarf 0, High Elf/Dark Elf/Vampire -10
- [ ] Tax effect:
  - Tax > 42%: penalty = floor(((tax-42)/58)*30)
  - Tax < 42%: bonus = floor(45*((42-tax)/42))
- [ ] Recovery rate = (entertainment_research/1000) + (taverns*0.25)
- [ ] Final happiness clamped to -50 to 120

### Happiness Effects
- [ ] Production efficiency multiplier: 0.5 + happiness/100
  - 0 happiness = 0.5x (50% production)
  - 50 happiness = 1.0x (normal)
  - 100 happiness = 1.5x (150% production)
  - Below -50: clamped to 0 (no production)
- [ ] Applied to gold, food, mana, research, all resources

### Rebellion System
- [ ] Happiness <= 0: 5% rebellion chance per turn
- [ ] Happiness 0-20: 2% rebellion chance
- [ ] Happiness 20-50: 0.5% rebellion chance
- [ ] Rebellion cooldown (20 turns) prevents spam
- [ ] Event types roll:
  1. Unrest: 5-10% population loss
  2. Tax Revolt: Tax reduced by 10% (one-time)
  3. Sabotage: 1-3 random buildings destroyed (filters for available)
  4. Food Riot: 1-3 granaries/farms destroyed (if food < 10% of pop)
  5. Military Mutiny: 5-10% troop desertion (all unit types)

### Food System
- [ ] Farm production = workers * 150 * race_yield_mult
- [ ] Farm upgrades increase yield (Irrigated, Plantation)
- [ ] Food consumption = population/100 * race_consumption_mult * troops
- [ ] Food balance = production - consumption per turn
- [ ] Food stored (no cap listed, but practical limits)
- [ ] Shortage auto-triggers happiness recovery spending
- [ ] Food shortage = < 20% of population -> 0 food happiness

### Housing & Capacity
- [ ] Housing capacity = bld_housing * per_building_cap (varies by race)
- [ ] Housing fragment bonuses apply (+5% Celestial, +15% Ancient Elven Wood)
- [ ] Above housing cap: growth capped at 0.1x
- [ ] At 2x capacity: no growth
- [ ] Housing buildings take land

---

## 6. BUILDING & CONSTRUCTION SYSTEM
**Systems**: Buildings, Queues, Tools, Blueprints, Costs, Upgrades

### Basic Building
- [ ] Build command enqueues building (cost gold, land, resources if applicable)
- [ ] Insufficient gold/land/resources = fails
- [ ] Building progresses in queue (workers allocated)
- [ ] Building completes and is added to kingdom
- [ ] Land deducted on completion
- [ ] Building provides stat bonuses (farms produce food, mage towers mana, etc.)

### Build Queue
- [ ] Queue up to 20 buildings (or game limit)
- [ ] Allocate workers to specific queued buildings
- [ ] Workers speed up construction time
- [ ] Reorder queue (move building up/down)
- [ ] Cancel building (refund partial resources if in progress)

### Construction Tools
- [ ] Hammers increase build speed by 10% each (cap ~500)
- [ ] Scaffolding reduces cost by 5% each (cap ~500)
- [ ] Specific buildings get double scaffolding bonus (list in config)
- [ ] Tools consumed on use
- [ ] Tools crafted at Smithies

### Blueprints
- [ ] Regular blueprints: Basic construction (no bonus)
- [ ] Certified blueprints: Studied from fragments, improve durability
- [ ] Hybrid blueprints: Combine studied fragments for special effects
- [ ] Blueprints consumed on building creation
- [ ] Blueprint crafting at Scribe (requires fragment study)

### Building Types & Caps
- [ ] All 27 building types recruitable
- [ ] Hard caps enforced:
  - Walls: 100
  - Guard Towers: 100
  - Outposts: 50
  - Farms: 10,000
  - Housing: 5,000
  - Taverns: 100
  - Schools: 200
  - Other buildings: varies
- [ ] Achievment "Constructor": Bypass hard cap (get 100 smithies, then +100 more)

### Building Upgrades
- [ ] Each building type has specific upgrades
- [ ] Upgrades cost resources and often research
- [ ] Upgrades provide stat bonuses (farm yield, tower detection, etc.)
- [ ] Upgrades tracked per building type
- [ ] Multiple upgrades can stack on same building

---

## 7. ADVANCED MECHANICS - COVERT OPS & EXPEDITIONS
**Systems**: Spying, Expeditions, Items, Lore

### Covert Operations
- [ ] Spy operation targets enemy kingdom
- [ ] Success based on attacker thieves/detection, defender towers
- [ ] Failure: Thieves caught/killed
- [ ] Success: Report generated (shared with allies)
- [ ] Assassination: Remove enemy troops
- [ ] Sabotage: Damage buildings
- [ ] Recruitment: Steal enemy troops

### Expeditions
- [ ] Send 3 types: Scout (10 turns), Deep (25 turns), Dungeon (50 turns)
- [ ] Allocate fighters & rangers
- [ ] Expedition completes, returns with loot
- [ ] Loot tables: 40+ junk items, 6+ ultra-rare artifacts
- [ ] Rare artifacts: Dragon Egg, Tome, Mana Heart, Vault, Legion Banner, World Tree Seed
- [ ] Each artifact provides kingdom bonus
- [ ] Expedition participants gain XP

### World Fragments & Attunement
- [ ] 10 fragment types exist (Volcanic, Elven Wood, Dragon Scale, etc.)
- [ ] Fragments found in expeditions (rare drops)
- [ ] Fragments attune to specific building types
- [ ] Attunement provides bonus multipliers (capacity, speed, output, etc.)
- [ ] Studied fragments unlock hybrid blueprints
- [ ] Fragment inventory tracked

### Item Collection & Lore
- [ ] 50+ junk items discoverable
- [ ] Each item has description/rarity
- [ ] Lore system: 200+ lore entries in categories
- [ ] Players discover lore through exploration/events
- [ ] Achievement tracking for collections

---

## 8. WORLD FRAGMENTS & SPECIAL MECHANICS
**Systems**: Fragment Bonuses, Attunement, Hybrid Blueprints

### Fragment Application
- [ ] Fragments attune to buildings
- [ ] Attunement affects specific building properties
- [ ] Bonus types: capacity, speed, output, stability, growth, morale, magic_output, income, prestige
- [ ] Multipliers range from 1.0 to 1.5+ depending on fragment
- [ ] Multiple fragments on same building multiply effects

### Housing Fragment Bonuses
- [ ] Celestial Realm: +5% capacity, happiness
- [ ] Ancient Elven Wood: +15% capacity, happiness
- [ ] Abyssal Crystal: magic_output boost
- [ ] Void Essence: stability penalty (example: -morale)
- [ ] Cursed Bloodstone: stability penalty (example: -morale)
- [ ] Tears of the World Tree: growth bonus

### Specific Fragment Tests
- [ ] Test each of 10 fragments on appropriate buildings
- [ ] Verify bonus multipliers correct
- [ ] Test stacking (multiple fragments on same building)
- [ ] Test hybrid blueprints created from studied fragments
- [ ] Verify ultra-rare fragments discovered

---

## 9. PROGRESSION & LEVELING SYSTEM
**Systems**: Kingdom XP, Troop XP, Heroes, Achievements, Milestones

### Kingdom XP & Levels
- [ ] XP gained from: turns, gold earned, combat wins/losses, research, construction, expeditions, spells, covert ops
- [ ] XP requirements increase exponentially (level 50+ very slow)
- [ ] Level determines unit cap increases
- [ ] Prestige levels separate from kingdom levels
- [ ] Kingdom level shown in UI

### Troop XP & Levels
- [ ] Each unit type (Fighters, Rangers, etc.) tracks XP separately
- [ ] Troops gain XP from combat participation
- [ ] Levels go 1-100+ with exponential scaling
- [ ] Level thresholds: 1-10 fast, 10-25 medium, 25-50 slow, 50-75 very slow, 75+ extremely slow
- [ ] High-level troops apply combat multiplier (level/50)
- [ ] Racial bonuses above level 100

### Hero System
- [ ] Recruit heroes from castle
- [ ] Heroes have classes with stat bonuses (economy, magic, research, etc.)
- [ ] Heroes level from XP
- [ ] Abilities unlock at levels 1, 5, 10
- [ ] Heroes can be idle, wounded, in-combat, on-quest
- [ ] Passive stat bonuses apply to kingdom

### Achievements & Milestones
- [ ] Track various achievements (building, combat, research, etc.)
- [ ] Show achievement titles (greyed out if not completed)
- [ ] Show progress bar toward achievement
- [ ] Milestone bonuses apply globally (e.g., +5% gold)
- [ ] Multiple milestones can stack

---

## 10. SOCIAL SYSTEMS - ALLIANCES & TRADING
**Systems**: Alliances, Alliance Vault, Regional Control, Trading, Messaging

### Alliances
- [ ] Create alliance (name, description)
- [ ] Invite/accept members
- [ ] Leader promote/demote members
- [ ] Alliance vault (shared gold pool)
- [ ] Vault transactions logged
- [ ] Alliance buffs (Merchant Guild, Shadow Network, Mercenary Subsidy)

### Alliance Vault
- [ ] Deposit gold into vault
- [ ] Withdraw gold from vault (leader approval?)
- [ ] Vault balance tracked
- [ ] Transaction log visible
- [ ] Interest applies to vault balance (if applicable)

### Regional Control
- [ ] 6 regions exist (Dwarf, High Elf, Orc, Dark Elf, Human, Dire Wolf)
- [ ] Alliances contest for region control
- [ ] Control = +5% to specific stat (magic, military, economy, etc.)
- [ ] Home region bonus: +5% if own race controls native region
- [ ] Region display on world map

### Player-to-Player Trading
- [ ] Create trade offer (send resources to player)
- [ ] Offer expires after 1 hour
- [ ] Accept trade (auto-transfer resources)
- [ ] Trade history visible
- [ ] Can't trade with self

### Messaging
- [ ] Global chat
- [ ] Alliance-only chat
- [ ] Private messages
- [ ] Message history (clear history option)
- [ ] Online players list

---

## 11. EVENTS & RANDOMNESS SYSTEM
**Systems**: Seasonal Events, Custom Goals, Sentiment Events, Event Log

### Seasonal System
- [ ] 4 seasons: Spring (3 turns), Summer (5 turns), Fall (2 turns), Winter (3 turns)
- [ ] Farm yield multipliers per season: Spring 1.1x, Summer 1.2x, Fall 0.9x, Winter 0.7x
- [ ] Seasons cycle continuously
- [ ] Current season shown in UI

### Global Events
- [ ] 20+ events with seasonal triggers
- [ ] Event effects: morale, farm yield, gold, population, food, military modifiers
- [ ] Event log tracks all triggered events per kingdom
- [ ] Random event notifications sent

### Custom Goals
- [ ] Daily, weekly, monthly goals available
- [ ] 3 difficulty tiers with different rewards
- [ ] Goal types: combat, construction, research, exploration, economy, military
- [ ] Reward pools: gold, resources, prestige points, multiplier bonuses
- [ ] Goals reset on schedule

### Sentiment Events
- [ ] Tax increases sometimes trigger sentiment changes
- [ ] Morale penalties/bonuses from events
- [ ] Random events affect various stats

---

## 12. SPECIALIZED & MISC SYSTEMS
**Systems**: Vampire Thralls, Map Discovery, News, War Log, Chat

### Vampire-Specific Mechanics
- [ ] Thralls function as alternative troops (population conversion)
- [ ] Mausoleum building Vampire-exclusive
- [ ] Mausoleum upgrades (Blood Sacrifice, Soul Vault, Night Watch)
- [ ] Thrall capacity expandable via upgrades
- [ ] Thralls provide food efficiency boost
- [ ] Thralls provide defense bonus (time-dependent?)

### Location Mapping
- [ ] Discover location maps (from expeditions or enemy surrender)
- [ ] Maps stored in inventory
- [ ] Maps can be stolen in combat (from thief operations)
- [ ] Map data shared with alliance
- [ ] Map visibility shows on world map

### News Feed
- [ ] News items appear for: attacks, expeditions, research complete, buildings complete
- [ ] News turn number shown
- [ ] News filtering by type (combat, research, construction, exploration, etc.)
- [ ] Happiness news items appear with calculations
- [ ] Rebellion news items appear with details

### War Log
- [ ] Detailed combat history visible
- [ ] Public record (all players can view)
- [ ] Shows: attacker, defender, units lost, land transferred, gold stolen
- [ ] Battle report on each entry
- [ ] Timestamp for each battle

### Kingdom Info Panel
- [ ] All stats displayed: Population, Happiness, Gold, Land, Food, Mana, XP, Level
- [ ] Troop counts shown
- [ ] Building counts shown
- [ ] Research progress shown
- [ ] Production rates shown (gold/turn, food/turn, mana/turn)

---

## 13. SYSTEM INTEGRATION TESTS
**Cross-System Interactions to Verify**

### Happiness Integration
- [ ] Happiness affects production (gold, food, mana, research)
- [ ] Happiness affects growth (population multiplier)
- [ ] Happiness affects rebellion risk
- [ ] Happiness affects combat multiplier
- [ ] Low happiness triggers rebellion events
- [ ] Rebellion events reduce happiness further
- [ ] Tax changes affect happiness

### Combat Integration
- [ ] Combat multiplier uses happiness (not old morale)
- [ ] Combat updates last_attack_turn for attacker & defender
- [ ] Defender safety happiness affected by attack
- [ ] Winning army gains happiness bonus (safety)
- [ ] Losing army loses happiness (safety)
- [ ] Land loss affects kingdom prosperity (less gold potential)

### Production Integration
- [ ] Happiness multiplier applied to ALL production
- [ ] Low happiness cascades: less gold → less research → less military
- [ ] High happiness cascades: more gold → faster research → stronger military
- [ ] Tax rate affects both gold and happiness
- [ ] Buildings provide income (taverns, markets, castles)

### Population Integration
- [ ] Population growth depends on happiness & housing
- [ ] Population affects food consumption
- [ ] Population loss from rebellion affects everything
- [ ] Housing provides capacity
- [ ] Troop limits depend on population

### Research Integration
- [ ] Research speed affected by happiness
- [ ] Research enables spells, building upgrades
- [ ] Research provides hard caps on units/buildings
- [ ] Racial bonuses apply to research

### Magic Integration
- [ ] Spells require mana
- [ ] Spells affect troops, buildings, resources
- [ ] Buff spells increase happiness
- [ ] Debuff spells reduce enemy happiness
- [ ] Mana generation affected by happiness

---

## 14. EDGE CASES & ERROR HANDLING

### Zero/Low Resource States
- [ ] Zero population: can't recruit troops, can't produce food
- [ ] Zero gold: can't build, recruit, cast spells
- [ ] Zero food: population starving (happiness penalty)
- [ ] Negative happiness: population fleeing
- [ ] Negative resources: prevented (clamped at 0)

### Overflow Conditions
- [ ] Gold capped at 1M (or configured limit)
- [ ] Population/troops capped by housing
- [ ] Buildings capped by hard limits
- [ ] Mana capped by tower storage
- [ ] Queued buildings capped at 20

### Invalid Actions
- [ ] Can't build building if already at hard cap
- [ ] Can't recruit troops if no housing
- [ ] Can't cast spell without sufficient mana
- [ ] Can't attack self
- [ ] Can't trade with self
- [ ] Can't join own alliance

---

## 15. PERFORMANCE & DATA INTEGRITY

### Database Consistency
- [ ] All kingdom stats sum correctly
- [ ] Buildings + troops fit within land
- [ ] Resources don't go negative
- [ ] XP values consistent
- [ ] Timestamps accurate

### Turn Processing
- [ ] All turns process without errors
- [ ] Happiness recalculated each turn
- [ ] Production applied each turn
- [ ] Rebellion check happens each turn
- [ ] Events triggered appropriately
- [ ] News items created for major events

### Data Validation
- [ ] Invalid JSON in stored fields handled gracefully
- [ ] Missing fields use defaults
- [ ] Type mismatches caught (happiness_bonus must be number)
- [ ] Out-of-range values clamped (happiness -50 to 120)

---

## Testing Priority Matrix

### CRITICAL (Test First)
- Population & Happiness (new system)
- Production Multiplier (affects everything)
- Combat (core gameplay)
- Turn Processing (must be bulletproof)
- Database Integrity

### HIGH (Test Early)
- Economy System (gold income, market)
- Military System (troops, training)
- Research System (progression)
- Rebellion Events (feedback loop)

### MEDIUM (Test Thoroughly)
- Magic System
- Building System
- Defense System
- Expeditions

### LOW (Verify Completeness)
- UI Display
- Chat/Messaging
- Map Discovery
- Rare Artifacts
