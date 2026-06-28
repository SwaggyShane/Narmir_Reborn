# Narmir Reborn: Development Todos

Local is truth. This backlog is split into two explicit ownership lanes so we can work in parallel without trampling each other.
Archived reference docs and `BETA_PLAN.md` are intentionally excluded.

## Codex Lane
Local-first lane. I own this lane and keep it current in the working tree.

1. [TODO] Battle Outcome Animation: Animate win/loss banners in combat results.
2. [TODO] Battle Outcome Animation: Animate casualty and critical hit counters.
3. [TODO] Battle Outcome Animation: Animate HP, wall, or power bars when results are shown.
4. [TODO] Battle Outcome Animation: Keep combat resolution deterministic and presentation-only.
5. [CLAUDE] Security vulnerabilities (SQL injection, XSS, etc.)
6. [CLAUDE] Race conditions / transaction safety
7. [CLAUDE] Memory leaks / resource management
8. [CLAUDE] Critical performance bottlenecks
9. [CLAUDE] Code review feedback from automated tools
10. [TODO] Weekly Deep Audit Feature: Add schedule UI to admin panel.
11. [TODO] Weekly Deep Audit Feature: Create database tables for audit schedules and history.
12. [TODO] Weekly Deep Audit Feature: Implement cron job scheduler (node-cron).
13. [TODO] Weekly Deep Audit Feature: Add API endpoints for schedule management.
14. [TODO] Weekly Deep Audit Feature: Expand auditor to scan full codebase recursively.
15. [TODO] Weekly Deep Audit Feature: Generate comparison reports between audits.
16. [TODO] Weekly Deep Audit Feature: Add trend visualization (findings over time).
17. [TODO] Weekly Deep Audit Feature: Implement notifications (email/Slack on new issues).
18. [TODO] Weekly Deep Audit Feature: Investigate what is corrupting JSON rows in the database and add a repeatable guard or repair path.
19. [MAINTENANCE] SQL injection audit (100% coverage)
20. [MAINTENANCE] Rate limiting (currently basic turn limiter; DDoS mitigation untested)
21. [MAINTENANCE] Secrets management (`.env` in .gitignore; no hardcoded keys in repo)
22. [MAINTENANCE] HTTPS enforced in production (Railway SSL; local dev unencrypted)
23. [MAINTENANCE] Load test: 5,000+ concurrent players
24. [MAINTENANCE] Database backup and restore verified
25. [MAINTENANCE] API rate limiting configured
26. [MAINTENANCE] Monitoring/alerting in place (error logs, slow queries)
27. [MAINTENANCE] User-facing docs updated (game mechanics, account management)
28. [MAINTENANCE] Support runbook prepared (common issues, recovery procedures)
29. [MAINTENANCE] Secrets stored in Railway environment (no .env in repo)
30. [MAINTENANCE] Database URL points to production PostgreSQL
31. [MAINTENANCE] Backups automated; retention policy set
32. [MAINTENANCE] Monitoring active (error tracking, performance)
33. [Mobile] Scan `public/` for HTML files with inline `<script>` blocks (legacy patterns)
34. [Mobile] Check for jQuery usage (should be gone; flag if found)
35. [Mobile] Audit `index.html` and fallback HTML templates for non-React entry points
36. [Mobile] Verify all user-facing routes go through React (not vanilla JS templates)
37. [Mobile] Convert any remaining vanilla form handlers → React controlled components
38. [Mobile] Replace inline `<style>` tags in templates → Tailwind utilities
39. [Mobile] Remove inline `onclick` handlers → React event binding
40. [Mobile] Consolidate CSS files used by vanilla templates → single Tailwind source
41. [Mobile] Mobile layout: No horizontal scroll at 360px width
42. [Mobile] Bottom nav: Always visible, not overlapping content (pb-20 padding verified)
43. [Mobile] Header: Scrolls away naturally (no sticky positioning)
44. [Mobile] React: All user-facing routes use React components (no vanilla templates)
45. [Mobile] Tailwind: Responsive breakpoints (`md:`, `lg:`) applied consistently
46. [Mobile] Touch targets: Min 44px × 44px for all buttons/nav items
47. [Mobile] Performance: No layout shifts when nav appears/disappears
48. [F5] Redux DevTools shows correct state transitions
49. [F5] React DevTools Profiler: components re-render only on relevant state changes
50. [F5] Smoke test (fresh server boot, all 4 baseline checks, manual panel navigation)
51. [F5] localStorage persists UI state across page reload (if applicable)
52. [F5] No performance regression
53. [F5] TypeScript configuration ready (or plan to migrate incrementally)
54. [F5] Zustand v4 + Immer v4 versions confirmed in package.json
55. [F5] Redux DevTools browser extension installed for testing
56. [F5] Socket.io event handlers mapped to domain actions (receive handlers documented)
57. [F5] Entity normalization guide created (byId/allIds pattern for armies, routes, etc.)
58. [F5] Test database (`narmir_smoke` or `narmir_local` per WINDOWS_LOCAL_SETUP.md)
59. [F5] Fresh server boot tested (PostgreSQL connection, all 4 baseline smoke checks pass)
60. [F5] Selector optimization profiling setup (React DevTools Profiler enabled)
61. [F5] localStorage inspection ready (DevTools Application tab)
62. [F5] Team trained on Zustand selectors (useShallow, fine-grained selectors, memoization)
63. [F5] Team understands domain action patterns (receiveTurnUpdate, applyCombatResult, etc.)
64. [F5] Team familiar with Zustand middleware (Immer, persist, devtools)
65. [F5] Code review checklist prepared (selector patterns, performance, state separation)
66. [F5] Rollback plan tested (git revert HEAD~4..HEAD, restore GameStateManager from backup)
67. [F5] Feature flag for Zustand toggle prepared (optional: USE_ZUSTAND_STORES env var)
68. [F5] Smoke test framework updated to handle multi-store architecture
69. [F5] Backup of current codebase created (branch point before PR #1)
70. [F4] Achievements module (game/lib/achievements.js) created with checkAchievements, calculateScore
71. [F4] Combat helpers module (game/lib/combat-helpers.js) created with formatting functions
72. [F4] Verify: No lint errors, npm run lint passes
73. [F4] Smoke test: Fresh boot + all 4 baseline checks pass
74. [F4] Sanity: No behavior changes, identical output vs. before
75. [F4] Happiness logging module (game/lib/happiness-logging.js) created
76. [F4] Expeditions module (game/lib/expeditions.js) created with resolveExpeditions
77. [F4] Special events module (game/lib/special-events.js) created with prestige/rebellion/alliance
78. [F4] Combat wrappers module (game/lib/combat-wrappers.js) created (optional: keep legacy combat in engine as fallback)
79. [F4] All modules callable from engine.js with identical behavior
80. [F4] Smoke tests pass, no behavior changes
81. [F4] Each commit is a checkpoint; can rollback if needed
82. [F4] Building module (game/lib/building.js) created with processBuildQueue + research
83. [F4] Gameplay module (game/lib/gameplay.js) created with misc functions
84. [F4] Verify: No lint errors
85. [F4] Smoke tests pass, all baseline + specific gameplay endpoints functional
86. [F4] Verify: Turn processing still calls sub-functions correctly
87. [F4] processTurn refactored to orchestrator (calls extracted modules)
88. [F4] engine.js becomes thin coordinator: ~50 lines, logic-free
89. [F4] All ~100+ exports still re-exported from engine.js (API unchanged)
90. [F4] Lint: 0 errors
91. [F4] Smoke: Fresh boot + all baseline checks pass
92. [F4] Sanity: Output identical, no behavior changes
93. [F4] All commit messages reference this strategy
94. [F4] PR ready for review + merge
95. [TEST] Kingdom generates gold per turn (goldPerTurn)
96. [TEST] Gold changes based on tax rate (0-100%)
97. [TEST] Tax at 42% applies 5% bonus
98. [TEST] Tax above 42% reduces happiness and gold generation
99. [TEST] Tax below 42% increases happiness recovery
100. [TEST] Castle income applied (+100 per castle)
101. [TEST] Market income calculated correctly (varies by race & setup)
102. [TEST] Buy resources at market price (not enough gold = fails)
103. [TEST] Sell resources for gold
104. [TEST] Market prices fluctuate (check commodity_values in config)
105. [TEST] Trade history visible
106. [TEST] Resource limits enforced (can't exceed 1M gold, 100K resources, etc.)
107. [TEST] Establish route to allied/neutral kingdom (costs 50,000 gold)
108. [TEST] Route generates recurring gold per turn
109. [TEST] Max 5 routes per kingdom
110. [TEST] Delete route removes recurring income
111. [TEST] Route efficiency tracked
112. [TEST] Create deposit at correct interest rate (each tier different)
113. [TEST] Deposit matures after correct time
114. [TEST] Withdraw early = interest penalty
115. [TEST] Deposit name/description saved
116. [TEST] Multiple deposits allowed
117. [TEST] Wood/Stone/Iron gathered by tier buildings
118. [TEST] Resource expeditions send population & return resources
119. [TEST] Resource conversion (Coal to Steel) works
120. [TEST] Commodity prices affect buying/selling value
121. [TEST] Blueprint & scroll commodities handled separately
122. [TEST] Recruit fighters/rangers/clerics/mages/thieves/ninjas/engineers
123. [TEST] Sufficient gold deducted on recruit
124. [TEST] Population decreased by unit count
125. [TEST] Unit caps enforced (support capacity)
126. [TEST] All 9 unit types recruitable (including Scribes, Thralls for Vampire)
127. [TEST] Attack calculation considers unit comp, happiness, research, levels
128. [TEST] Attacker/Defender troop losses calculated
129. [TEST] Land transfers to victor
130. [TEST] Gold stolen on win
131. [TEST] Happiness affected (Safety component updates, last_attack_turn recorded)
132. [TEST] Combat multiplier uses happiness (0.5-1.5x)
133. [TEST] Battle report generated with details
134. [TEST] Build war machines (requires engineers)
135. [TEST] War machines reduce land loss in defense
136. [TEST] Engineer crew required (variable by race)
137. [TEST] Dwarf racial bonus: level 5 engineers solo crew at level 5+
138. [TEST] War machines can be stolen in combat
139. [TEST] Hire 4 tiers (Rabble, Sellsword, Veteran, Elite)
140. [TEST] Cost increases per tier
141. [TEST] Mercenaries last X turns then disappear
142. [TEST] Unit limits still apply to mercenaries
143. [TEST] Troops gain XP from combat wins/losses
144. [TEST] Each unit type has separate level tracking
145. [TEST] Level increases at correct XP thresholds
146. [TEST] High-level troops stronger (level mult applied in combat)
147. [TEST] Racial bonuses apply above level 100
148. [TEST] Walls have HP and reduce land loss (-10% per wall upgrade)
149. [TEST] Towers detect incoming attacks (alert sent)
150. [TEST] Defense upgrades (Fortified, Keep, Citadel) increase wall strength
151. [TEST] Tower upgrades improve detection power
152. [TEST] Outpost upgrades enhance ranger detection
153. [TEST] Defense tier multiplier applied in combat
154. [TEST] Assign researchers to discipline
155. [TEST] Research advances at correct rate (researchIncrement)
156. [TEST] Happiness multiplier applied (0.5-1.0+ at 100 happiness)
157. [TEST] School bonus (+2% per 5 schools) applied
158. [TEST] School upgrades boost research speed
159. [TEST] Research slows exponentially past level 100 (5% compounding cost)
160. [TEST] Max cap enforced (varies by discipline & race)
161. [TEST] Players assign researchers across multiple disciplines
162. [TEST] School unlock allows second discipline at higher research
163. [TEST] Second discipline researched independently
164. [TEST] Farm upgrades available (Iron Plows, Irrigated, Plantation)
165. [TEST] School upgrades (Advanced Curriculum, Repository, Grand Academy)
166. [TEST] Wall upgrades (Reinforced, Battlements, Fortress)
167. [TEST] Tower upgrades (Arrow Slits, Watchtower, Signal Tower)
168. [TEST] Shrine upgrades (Divine Favor, Cleansing)
169. [TEST] Market upgrades (Merchant Guild, Trade Hub)
170. [TEST] Library upgrades (increase research speed/bonus)
171. [TEST] Bank upgrades (increase vault capacity & interest)
172. [TEST] Mausoleum upgrades (Vampire-specific benefits)
173. [TEST] Each upgrade costs resources and has requirements
174. [TEST] Engineers gain XP and level independently
175. [TEST] Higher engineer levels reduce tool/resource requirements
176. [TEST] Engineer XP shown in info panel
177. [TEST] Global spellbook unlocks basic spells (Tier 1-3)
178. [TEST] School-specific spellbook unlocks school spells
179. [TEST] Each school has independent research & spell access
180. [TEST] Spell research requirements enforced (min spellbook level)
181. [TEST] Mages create scrolls (turns & mage XP required per spell)
182. [TEST] Higher-tier spells require more resources
183. [TEST] Scrolls stored and listed
184. [TEST] Delete scroll removes from inventory
185. [TEST] Certified blueprint variant available (if scribes studied fragments)
186. [TEST] Cast spell on own kingdom (buffs) or enemy (debuffs)
187. [TEST] Sufficient mana deducted
188. [TEST] Spell effects applied (troops changed, buildings damaged, etc.)
189. [TEST] Buff duration tracked (5-turn effects, permanent effects, etc.)
190. [TEST] Multiple buffs stack on same kingdom
191. [TEST] Spell cooldowns honored (if any)
192. [TEST] Enemy spell effects debuff defender properly
193. [TEST] Mana generates per turn (manaPerTurn)
194. [TEST] Mana from race bonus + mage towers + clerics
195. [TEST] Happiness multiplier applied (0.5-1.0+ at 100 happiness)
196. [TEST] Mana stored in mage towers (cap enforced)
197. [TEST] Mages gain XP when mana regenerated
198. [TEST] Bless: +15 happiness (5 turns), +50% growth during
199. [TEST] Divine Favor: Permanent +5 happiness
200. [TEST] Prosperity: +10 prosperity happiness (3 turns)
201. [TEST] Attack spells: Troops lost, buildings damaged
202. [TEST] Debuff spells: Reduce enemy happiness/production
203. [TEST] Base growth = 0.3% population per turn
204. [TEST] Happiness >= 80: 30% growth boost (1.3x)
205. [TEST] Happiness 50-79: Normal growth
206. [TEST] Happiness 30-49: 30% reduction (0.7x)
207. [TEST] Happiness < 30: 70% reduction (0.3x)
208. [TEST] Happiness <= 0: Population fleeing (-5% per turn, multiplier -0.05)
209. [TEST] Housing cap enforced (blocks growth at 2x capacity)
210. [TEST] Race growth multipliers applied (Human 1.15x, Dwarf 0.9x, etc.)
211. [TEST] Base happiness starts at 50
212. [TEST] Food happiness: 0-30 (based on food_reserves vs population * 0.5)
213. [TEST] Entertainment happiness: 0-20 (from taverns, 1.5 per tavern, max 20)
214. [TEST] Safety happiness: -30 to +20
215. [TEST] Prosperity happiness: 0-20 (gold vs population*2)
216. [TEST] Race modifier: -10 to +10
217. [TEST] Tax effect:
218. [TEST] Recovery rate = (entertainment_research/1000) + (taverns*0.25)
219. [TEST] Final happiness clamped to -50 to 120
220. [TEST] Production efficiency multiplier: 0.5 + happiness/100
221. [TEST] Applied to gold, food, mana, research, all resources
222. [TEST] Happiness <= 0: 5% rebellion chance per turn
223. [TEST] Happiness 0-20: 2% rebellion chance
224. [TEST] Happiness 20-50: 0.5% rebellion chance
225. [TEST] Rebellion cooldown (20 turns) prevents spam
226. [TEST] Event types roll:
227. [TEST] Farm production = workers * 150 * race_yield_mult
228. [TEST] Farm upgrades increase yield (Irrigated, Plantation)
229. [TEST] Food consumption = population/100 * race_consumption_mult * troops
230. [TEST] Food balance = production - consumption per turn
231. [TEST] Food stored (no cap listed, but practical limits)

## Claude Lane
Remote-first lane. Claude can land branches here; I pull those changes down to local truth.

1. [TEST] Shortage auto-triggers happiness recovery spending
2. [TEST] Food shortage = < 20% of population -> 0 food happiness
3. [TEST] Housing capacity = bld_housing * per_building_cap (varies by race)
4. [TEST] Housing fragment bonuses apply (+5% Celestial, +15% Ancient Elven Wood)
5. [TEST] Above housing cap: growth capped at 0.1x
6. [TEST] At 2x capacity: no growth
7. [TEST] Housing buildings take land
8. [TEST] Build command enqueues building (cost gold, land, resources if applicable)
9. [TEST] Insufficient gold/land/resources = fails
10. [TEST] Building progresses in queue (workers allocated)
11. [TEST] Building completes and is added to kingdom
12. [TEST] Land deducted on completion
13. [TEST] Building provides stat bonuses (farms produce food, mage towers mana, etc.)
14. [TEST] Queue up to 20 buildings (or game limit)
15. [TEST] Allocate workers to specific queued buildings
16. [TEST] Workers speed up construction time
17. [TEST] Reorder queue (move building up/down)
18. [TEST] Cancel building (refund partial resources if in progress)
19. [TEST] Hammers increase build speed by 10% each (cap ~500)
20. [TEST] Scaffolding reduces cost by 5% each (cap ~500)
21. [TEST] Specific buildings get double scaffolding bonus (list in config)
22. [TEST] Tools consumed on use
23. [TEST] Tools crafted at Smithies
24. [TEST] Regular blueprints: Basic construction (no bonus)
25. [TEST] Certified blueprints: Studied from fragments, improve durability
26. [TEST] Hybrid blueprints: Combine studied fragments for special effects
27. [TEST] Blueprints consumed on building creation
28. [TEST] Blueprint crafting at Scribe (requires fragment study)
29. [TEST] All 27 building types recruitable
30. [TEST] Hard caps enforced:
31. [TEST] Achievment "Constructor": Bypass hard cap (get 100 smithies, then +100 more)
32. [TEST] Each building type has specific upgrades
33. [TEST] Upgrades cost resources and often research
34. [TEST] Upgrades provide stat bonuses (farm yield, tower detection, etc.)
35. [TEST] Upgrades tracked per building type
36. [TEST] Multiple upgrades can stack on same building
37. [TEST] Spy operation targets enemy kingdom
38. [TEST] Success based on attacker thieves/detection, defender towers
39. [TEST] Failure: Thieves caught/killed
40. [TEST] Success: Report generated (shared with allies)
41. [TEST] Assassination: Remove enemy troops
42. [TEST] Sabotage: Damage buildings
43. [TEST] Recruitment: Steal enemy troops
44. [TEST] Send 3 types: Scout (10 turns), Deep (25 turns), Dungeon (50 turns)
45. [TEST] Allocate fighters & rangers
46. [TEST] Expedition completes, returns with loot
47. [TEST] Loot tables: 40+ junk items, 6+ ultra-rare artifacts
48. [TEST] Rare artifacts: Dragon Egg, Tome, Mana Heart, Vault, Legion Banner, World Tree Seed
49. [TEST] Each artifact provides kingdom bonus
50. [TEST] Expedition participants gain XP
51. [TEST] 10 fragment types exist (Volcanic, Elven Wood, Dragon Scale, etc.)
52. [TEST] Fragments found in expeditions (rare drops)
53. [TEST] Fragments attune to specific building types
54. [TEST] Attunement provides bonus multipliers (capacity, speed, output, etc.)
55. [TEST] Studied fragments unlock hybrid blueprints
56. [TEST] Fragment inventory tracked
57. [TEST] 50+ junk items discoverable
58. [TEST] Each item has description/rarity
59. [TEST] Lore system: 200+ lore entries in categories
60. [TEST] Players discover lore through exploration/events
61. [TEST] Achievement tracking for collections
62. [TEST] Fragments attune to buildings
63. [TEST] Attunement affects specific building properties
64. [TEST] Bonus types: capacity, speed, output, stability, growth, happiness, magic_output, income, prestige
65. [TEST] Multipliers range from 1.0 to 1.5+ depending on fragment
66. [TEST] Multiple fragments on same building multiply effects
67. [TEST] Celestial Realm: +5% capacity, happiness
68. [TEST] Ancient Elven Wood: +15% capacity, happiness
69. [TEST] Abyssal Crystal: magic_output boost
70. [TEST] Void Essence: stability penalty (example: -happiness)
71. [TEST] Cursed Bloodstone: stability penalty (example: -happiness)
72. [TEST] Tears of the World Tree: growth bonus
73. [TEST] Test each of 10 fragments on appropriate buildings
74. [TEST] Verify bonus multipliers correct
75. [TEST] Test stacking (multiple fragments on same building)
76. [TEST] Test hybrid blueprints created from studied fragments
77. [TEST] Verify ultra-rare fragments discovered
78. [TEST] XP gained from: turns, gold earned, combat wins/losses, research, construction, expeditions, spells, covert ops
79. [TEST] XP requirements increase exponentially (level 50+ very slow)
80. [TEST] Level determines unit cap increases
81. [TEST] Prestige levels separate from kingdom levels
82. [TEST] Kingdom level shown in UI
83. [TEST] Each unit type (Fighters, Rangers, etc.) tracks XP separately
84. [TEST] Troops gain XP from combat participation
85. [TEST] Levels go 1-100+ with exponential scaling
86. [TEST] Level thresholds: 1-10 fast, 10-25 medium, 25-50 slow, 50-75 very slow, 75+ extremely slow
87. [TEST] High-level troops apply combat multiplier (level/50)
88. [TEST] Racial bonuses above level 100
89. [TEST] Recruit heroes from castle
90. [TEST] Heroes have classes with stat bonuses (economy, magic, research, etc.)
91. [TEST] Heroes level from XP
92. [TEST] Abilities unlock at levels 1, 5, 10
93. [TEST] Heroes can be idle, wounded, in-combat, on-quest
94. [TEST] Passive stat bonuses apply to kingdom
95. [TEST] Track various achievements (building, combat, research, etc.)
96. [TEST] Show achievement titles (greyed out if not completed)
97. [TEST] Show progress bar toward achievement
98. [TEST] Milestone bonuses apply globally (e.g., +5% gold)
99. [TEST] Multiple milestones can stack
100. [TEST] Create alliance (name, description)
101. [TEST] Invite/accept members
102. [TEST] Leader promote/demote members
103. [TEST] Alliance vault (shared gold pool)
104. [TEST] Vault transactions logged
105. [TEST] Alliance buffs (Merchant Guild, Shadow Network, Mercenary Subsidy)
106. [TEST] Deposit gold into vault
107. [TEST] Withdraw gold from vault (leader approval?)
108. [TEST] Vault balance tracked
109. [TEST] Transaction log visible
110. [TEST] Interest applies to vault balance (if applicable)
111. [TEST] 6 regions exist (Dwarf, High Elf, Orc, Dark Elf, Human, Dire Wolf)
112. [TEST] Alliances contest for region control
113. [TEST] Control = +5% to specific stat (magic, military, economy, etc.)
114. [TEST] Home region bonus: +5% if own race controls native region
115. [TEST] Region display on world map
116. [TEST] Create trade offer (send resources to player)
117. [TEST] Offer expires after 1 hour
118. [TEST] Accept trade (auto-transfer resources)
119. [TEST] Trade history visible
120. [TEST] Can't trade with self
121. [TEST] Global chat
122. [TEST] Alliance-only chat
123. [TEST] Private messages
124. [TEST] Message history (clear history option)
125. [TEST] Online players list
126. [TEST] 4 seasons: Spring (3 turns), Summer (5 turns), Fall (2 turns), Winter (3 turns)
127. [TEST] Farm yield multipliers per season: Spring 1.1x, Summer 1.2x, Fall 0.9x, Winter 0.7x
128. [TEST] Seasons cycle continuously
129. [TEST] Current season shown in UI
130. [TEST] 20+ events with seasonal triggers
131. [TEST] Event effects: happiness, farm yield, gold, population, food, military modifiers
132. [TEST] Event log tracks all triggered events per kingdom
133. [TEST] Random event notifications sent
134. [TEST] Daily, weekly, monthly goals available
135. [TEST] 3 difficulty tiers with different rewards
136. [TEST] Goal types: combat, construction, research, exploration, economy, military
137. [TEST] Reward pools: gold, resources, prestige points, multiplier bonuses
138. [TEST] Goals reset on schedule
139. [TEST] Tax increases sometimes trigger sentiment changes
140. [TEST] Happiness penalties/bonuses from events
141. [TEST] Random events affect various stats
142. [TEST] Thralls function as alternative troops (population conversion)
143. [TEST] Mausoleum building Vampire-exclusive
144. [TEST] Mausoleum upgrades (Blood Sacrifice, Soul Vault, Night Watch)
145. [TEST] Thrall capacity expandable via upgrades
146. [TEST] Thralls provide food efficiency boost
147. [TEST] Thralls provide defense bonus (time-dependent?)
148. [TEST] Discover location maps (from expeditions or enemy surrender)
149. [TEST] Maps stored in inventory
150. [TEST] Maps can be stolen in combat (from thief operations)
151. [TEST] Map data shared with alliance
152. [TEST] Map visibility shows on world map
153. [TEST] News items appear for: attacks, expeditions, research complete, buildings complete
154. [TEST] News turn number shown
155. [TEST] News filtering by type (combat, research, construction, exploration, etc.)
156. [TEST] Happiness news items appear with calculations
157. [TEST] Rebellion news items appear with details
158. [TEST] Detailed combat history visible
159. [TEST] Public record (all players can view)
160. [TEST] Shows: attacker, defender, units lost, land transferred, gold stolen
161. [TEST] Battle report on each entry
162. [TEST] Timestamp for each battle
163. [TEST] All stats displayed: Population, Happiness, Gold, Land, Food, Mana, XP, Level
164. [TEST] Troop counts shown
165. [TEST] Building counts shown
166. [TEST] Research progress shown
167. [TEST] Production rates shown (gold/turn, food/turn, mana/turn)
168. [TEST] Happiness affects production (gold, food, mana, research)
169. [TEST] Happiness affects growth (population multiplier)
170. [TEST] Happiness affects rebellion risk
171. [TEST] Happiness affects combat multiplier
172. [TEST] Low happiness triggers rebellion events
173. [TEST] Rebellion events reduce happiness further
174. [TEST] Tax changes affect happiness
175. [TEST] Combat multiplier uses happiness (not old happiness)
176. [TEST] Combat updates last_attack_turn for attacker & defender
177. [TEST] Defender safety happiness affected by attack
178. [TEST] Winning army gains happiness bonus (safety)
179. [TEST] Losing army loses happiness (safety)
180. [TEST] Land loss affects kingdom prosperity (less gold potential)
181. [TEST] Happiness multiplier applied to ALL production
182. [TEST] Low happiness cascades: less gold → less research → less military
183. [TEST] High happiness cascades: more gold → faster research → stronger military
184. [TEST] Tax rate affects both gold and happiness
185. [TEST] Buildings provide income (taverns, markets, castles)
186. [TEST] Population growth depends on happiness & housing
187. [TEST] Population affects food consumption
188. [TEST] Population loss from rebellion affects everything
189. [TEST] Housing provides capacity
190. [TEST] Troop limits depend on population
191. [TEST] Research speed affected by happiness
192. [TEST] Research enables spells, building upgrades
193. [TEST] Research provides hard caps on units/buildings
194. [TEST] Racial bonuses apply to research
195. [TEST] Spells require mana
196. [TEST] Spells affect troops, buildings, resources
197. [TEST] Buff spells increase happiness
198. [TEST] Debuff spells reduce enemy happiness
199. [TEST] Mana generation affected by happiness
200. [TEST] Zero population: can't recruit troops, can't produce food
201. [TEST] Zero gold: can't build, recruit, cast spells
202. [TEST] Zero food: population starving (happiness penalty)
203. [TEST] Negative happiness: population fleeing
204. [TEST] Negative resources: prevented (clamped at 0)
205. [TEST] Gold capped at 1M (or configured limit)
206. [TEST] Population/troops capped by housing
207. [TEST] Buildings capped by hard limits
208. [TEST] Mana capped by tower storage
209. [TEST] Queued buildings capped at 20
210. [TEST] Can't build building if already at hard cap
211. [TEST] Can't recruit troops if no housing
212. [TEST] Can't cast spell without sufficient mana
213. [TEST] Can't attack self
214. [TEST] Can't trade with self
215. [TEST] Can't join own alliance
216. [TEST] All kingdom stats sum correctly
217. [TEST] Buildings + troops fit within land
218. [TEST] Resources don't go negative
219. [TEST] XP values consistent
220. [TEST] Timestamps accurate
221. [TEST] All turns process without errors
222. [TEST] Happiness recalculated each turn
223. [TEST] Production applied each turn
224. [TEST] Rebellion check happens each turn
225. [TEST] Events triggered appropriately
226. [TEST] News items created for major events
227. [TEST] Invalid JSON in stored fields handled gracefully
228. [TEST] Missing fields use defaults
229. [TEST] Type mismatches caught (happiness_bonus must be number)
230. [TEST] Out-of-range values clamped (happiness -50 to 120)
