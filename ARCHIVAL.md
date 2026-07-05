# Narmir Reborn: Completed Work Archive

**Purpose:** Historical record of completed work and verification in chronological order.

**Last updated:** 2026-07-05 (Test infrastructure fixed; Worldmap features restored and Gemini feedback addressed; Terrain System Phases 1-3, Admin CSS Phase 4R verified complete; TODO audit completed)

---

## Recent Chronology

### 2026-07-05

- **Test Infrastructure Fix: JWT_SECRET Setup in Middleware Test** (PR #830, merged `c83bea5` 2026-07-05): Restored JWT_SECRET environment variable setup in middleware-csrf.test.js to fix test suite execution.
  - **Issue:** middleware-csrf.test.js was failing because routes/middleware.js throws an error at module import time if JWT_SECRET is not set. Test execution was blocked because the test couldn't import the middleware module.
  - **Fix Applied:** Added JWT_SECRET setup (minimum 32-character secret) before importing middleware in test file
  - **Impact:** All 63 test files now pass successfully; test suite can execute in all environments
  - **Quality Gates:** CI ✅ (Lint/Test/Build, Validate Text Encoding, Validate Security Configuration)
  - **Gemini Review:** Approved with no feedback needed
  - **Commits:** `dab156b` (restore JWT_SECRET setup)

- **Terrain System Phases 1-3 Complete** (PR #751, squash-merged `79a5ae72` 2026-07-04; Phase 3 commit `b22962f` 2026-07-04): Completed terrain type system with visual layer and combat integration.
  - **Phase 1+2:** Data model and visual layer (terrain type system, toggleable visual layer with GSAP animation, expedition travel time & loot yield modifiers)
  - **Phase 3:** Combat modifiers (CombatDef/Atk modifiers wired into calculateCombatPower, terrain added to battle reports)
  - **Commits:** `79a5ae72` (Phase 1+2 squash), `b22962f` (Phase 3 complete)

- **Admin CSS Consolidation Phase 4R (ResourcesPanel)** (PR #814, merged `82d1296` 2026-07-05): Converted ~45 inline styles in ResourcesPanel to Tailwind CSS, completed Gemini review feedback cycle.
  - **Conversions:** Stockpiles flex/colors, buildings tabs/cards/progress bars, expeditions cards/buttons/inputs, inventory grid/cards
  - **Gemini Feedback:** Addressed invalid Tailwind classes and duplicate attributes
  - **Quality Gates:** CI ✅ (Lint/Test/Build, Validate Text Encoding, Validate Security Configuration), Smoke test ✅, no functional regressions
  - **Follow-up:** Phase 4S (PR #815) completed as continuation
  - **Commits:** `bd1b285` (initial refactor), `3425b85` (Gemini feedback), `82d1296` (merge)

- **Security Audit Complete** (2026-07-05): All categories in TODO.md Security Audit reviewed, gaps addressed, and documented.
  - **Categories reviewed:** SQL Injection (already PASS), XSS (sanitizeHtml improved + tests for data:/vbscript:/SVG/case), Input Validation (systematic + admin name rules added), AuthZ (JWT/CSRF/rate/admin confirmed), Race Conditions (tx migration in forum/research/warfare wrapper), Sensitive Data, Resource Mgmt.
  - **Code changes:** sanitizeHtml.js hardened (blocked tags/protocols, entity decode); admin set-kingdom name validation added; forum + research + warfare partial tx migration from manual BEGIN to `db.withTransaction()`.
  - **Docs:** SECURITY_AUDIT.md fully populated with PASS findings per category; TODO updated; this archival entry.
  - **References:** `SECURITY_AUDIT.md`, `SQL_INJECTION_AUDIT_REPORT.md`, `utils/numeric-validation.js`, `routes/middleware.js`

- **Critical Bug Fix: Hunting/Prospecting Expeditions Reward Processing** (PR #825, merged 2026-07-05): Fixed critical bug where hunting and prospecting expeditions returned 0 rangers/engineers with no resource rewards. User reported "Returned | 0 rangers" with no food gained after hunting.
  - **Root Cause:** `expeditionRewards()` function in `game/lib/gameplay.js` was missing case handling for hunting and prospecting types, causing it to return empty rewards arrays that overwrote the pre-calculated rewards stored at expedition creation time.
  - **Impact:** All hunting and prospecting expeditions lost their resources (food/gold) when completing, troops returned but with no rewards.
  - **Fix Applied:**
    - Extended `expeditionRewards()` signature to accept `originalRewards` parameter containing the pre-calculated JSON reward data
    - Added case handling for "hunting" and "prospecting" types that:
      - Parses the stored JSON rewards (`{ food: X }` or `{ gold: Y }`)
      - Adds the parsed amounts to `updates.food` or `updates.gold` for database persistence
      - Returns formatted reward text for expedition log display
    - For prospecting expeditions: Redirected returned troops from rangers to engineers (prospecting uses engineers, not rangers)
    - Updated `resolveExpeditions()` caller to pass `exp.rewards` to the function
  - **Gemini Review:** One round of code review feedback requesting resource persistence and engineer handling — all feedback addressed and committed
  - **Testing:** 
    - Lint ✅ (0 errors throughout)
    - Smoke test ✅ (fresh PostgreSQL, all baseline checks pass)
    - CI ✅ (all 3 checks passed: Lint/Test/Build, Validate Text Encoding, Validate Security Configuration)
  - **Files Changed:** `game/lib/gameplay.js` (expeditionRewards function), `game/engine.js` (call site)
  - **Commits:**
    - `1ace0b8`: Initial fix with reward preservation logic
    - `ef0e7c1`: Apply Gemini feedback — properly award resources and handle prospecting engineers
    - `8ad2334`: Update TODO.md documentation

- **Exploration System Enhancement: Clickable Hex Map Modal for Resource Gathering** (PR #818, merged 2026-07-05): Remedial work completing PR #817 — replaced text-based coordinate input with visual, interactive SVG hex grid for resource gathering operations. Players now click on a hex to select targets for Hunting, Prospecting, Land Expansion, and Epic Trek expeditions with auto-triggering on selection.
  - **HexSelectionModal Complete Rewrite:**
    - SVG hex grid rendering with pan/zoom controls via mouse drag
    - Click-to-select hex cells with immediate visual feedback (highlighted cell, coordinates displayed)
    - Auto-close modal on hex selection with automatic endpoint trigger
    - Removed separate confirm button — action triggers immediately on hex click
  - **New Utilities:**
    - Created `client/src/utils/hexUtils.js` — shared client-side hex math matching server logic (pixelToHex, hexCenter, hexCorners)
    - Hex coordinate conversion from pixel clicks using pixelToHex (odd-r offset, pointy-top hexagons)
  - **ExplorationPanel Integration:**
    - Updated `handleHexSelected` callback to auto-trigger endpoints immediately (hunting, prospecting, land-expansion, epic-trek)
    - Modal now closes and action starts without user confirmation step
    - Endpoints accept optional target_x/target_y coordinates for future expansion
  - **Backend Routes Updated:**
    - `/api/kingdom/expedition/hunting`: Now accepts optional target coordinates
    - `/api/kingdom/expedition/prospecting`: Now accepts optional target coordinates
    - `/api/kingdom/expedition/land-expansion`: Now accepts optional target coordinates
  - **CI/Testing:**
    - Initial build failed: Missing export of HEX_SIZE constant from hexUtils.js
    - Fixed with minimal commit adding export statements
    - Final CI: All 3 checks passed ✅ (Lint/Test/Build, Validate Text Encoding, Validate Security Configuration)
  - **Commits:**
    - `3d181b8`: Initial implementation with clickable hex grid modal and hexUtils
    - `8edf6fe`: Fix missing exports (HEX_SIZE, HEX_W constants)
  - **Code Quality:** Lint ✅ (0 errors after fix). Build ✅. All smoke test baselines pass. No regressions.

- **Restore Missing Worldmap Visual Features** (PR #828, merged 2026-07-05): Restored three critical worldmap visualization features that were previously missing or broken.
  - **Features Restored:**
    - **SVG Terrain Symbols Layer**: Added distinct visual symbols for each terrain type (plains grass, forest trees, mountain peaks, hills curves, swamp water, desert sand, coast waves, tundra snowflake, volcanic craters) to improve terrain recognition. Symbols render above terrain fill but below fog of war for clear visibility.
    - **River Layer Z-Order Fix**: Moved rivers layer to render BEFORE fog of war so rivers appear beneath fog overlays, maintaining geographic underlay while fog indicates exploration state.
    - **WorldmapLegend.jsx Restoration**: Re-added previously deleted component from git history (commit d39be2e, created 2026-06-21). Note: Legend functionality already exists in WorldmapPanel as RegionLegend, so this file archived for reference.
  - **Gemini Code Review Feedback Addressed:**
    - ✅ HIGH: Imported REGION_META and REGION_BONUSES from raceData.js (instead of duplicated outdated constants missing vampire, ogre, wood_elf races)
    - ✅ HIGH: Bound highlightRegion function to global window object to prevent ReferenceError on legend onclick handlers
    - ✅ MEDIUM: Optimized tundra symbol rendering (3 intersecting lines instead of loop with trigonometry, reduces SVG elements 50% and eliminates Math.cos/Math.sin per cell)
  - **Quality Gates:** Lint ✅ (0 errors), Smoke test ✅ (combat-v2 adapter), Text Encoding ✅ (fixed mojibake middle-dot character), CI ✅
  - **Commits:**
    - `7cad79b`: Initial restoration with terrain symbols layer and river z-order fix
    - `ab0dc0d`: Fix text encoding issue (middle-dot → pipe in legend)
    - `040ed22`: Address Gemini feedback (raceData import, window binding, tundra optimization)
  - **Files Changed:** `client/src/components/react/WorldmapRenderer.jsx` (terrain symbols + river layer order), `client/src/components/react/WorldmapLegend.jsx` (raceData imports + window binding)

- **Terrain Legend Component & Middleware Test Fix** (PR #829, merged 2026-07-05): Added terrain legend UI component to worldmap panel with refined emoji symbols and 2-column grid layout. Fixed pre-existing JWT_SECRET test failure in middleware-csrf test.
  - **Features Added:**
    - **TerrainLegend Component**: React component displaying all 9 terrain types (plains, forest, mountains, hills, swamp, desert, coast, tundra, volcanic) with distinct emoji symbols in compact 2-column grid layout
    - **TERRAIN_LEGEND Constant**: Array of terrain objects with type, name, and symbol for rendering legend entries
    - **Test Infrastructure Fix**: Set JWT_SECRET environment variable before importing middleware in middleware-csrf.test.js to prevent module-load-time errors
  - **Gemini Code Review Feedback Addressed:**
    - ✅ MEDIUM: Fixed duplicate emoji (swamp and coast both used 🌊) by changing swamp to 🐊 (crocodile)
    - ✅ MEDIUM: Fixed inverted emoji (mountains had ⛰️, hills had 🏔️) by swapping: mountains→🏔️ (snow-capped), hills→⛰️
    - ✅ MEDIUM: Refactored TerrainLegend from full-width vertical list to 2-column grid layout for space efficiency (reduced ~300px vertical height)
  - **Quality Gates:** Lint ✅ (0 errors), Test suite ✅ (all 63 test files pass), CI ✅ (all 3 checks: Lint/Test/Build, Validate Text Encoding, Validate Security Configuration)
  - **Commits:**
    - `3b96183`: feat: Add terrain legend to worldmap panel for terrain type reference
    - `326e38e`: fix: Set JWT_SECRET in middleware-csrf test before middleware import
    - `40bc4b8`: Fix terrain legend: correct emoji, improve layout (address Gemini feedback)
  - **Files Changed:** `client/src/components/react/WorldmapPanel.jsx` (TerrainLegend component + TERRAIN_LEGEND constant), `test/middleware-csrf.test.js` (JWT_SECRET initialization)

- **Exploration System Enhancement: Resource Gathering UI Refactor** (PR #817, merged 2026-07-05): Refactored resource gathering system in ExplorationPanel with duration-based expeditions and reusable hex selection modal. Moved from single-button per resource to [Instant] [5] [25] duration options with visual hex targeting.
  - **UI Improvements:**
    - Updated "Available Rangers" card to "Available Units" with three-column layout (Rangers/Engineers/Population)
    - Refactored Hunting/Prospecting/Land Expansion cards from single buttons to [Instant] [5] [25] duration buttons per resource
    - Added "Launch" buttons for 5/25 turn expeditions (appears when target hex is selected)
    - Show selected target coordinates and duration below buttons for user feedback
  - **New Component:**
    - Created `HexSelectionModal.jsx`: Reusable modal for hex selection (used by both resource gathering and Epic Trek)
    - Supports coordinate manual input with X/Y fields
    - Clear button unconditionally resets selection for better UX
    - Validates both X and Y present before confirmation
  - **Integration:**
    - Updated Epic Trek card with "Select on Map" button to use hex selection modal
    - Terrain modifier constants added (forest→hunting, mountain→prospecting, etc.) for future return scaling implementation
  - **Gemini Review & Fixes:** 5 code review issues addressed in follow-up commit:
    - ✅ Critical: Restored missing terrain state variables (huntingTerrain, prospectingTerrain, landExpansionTerrain) to fix ReferenceError
    - ✅ High: Added "Launch" buttons for 5/25 turn expeditions (shown when target hex selected)
    - ✅ Medium: Fixed HexSelectionModal input clearing UX (allow empty strings for backspacing)
    - ✅ Medium: Fixed Clear button logic (unconditionally reset instead of showing error)
    - ✅ Medium: Added coordinate validation in handleConfirm (ensure both X and Y present)
    - ✅ Medium: Removed unused TERRAIN_MODIFIERS constant
  - **Testing:** Lint ✅ (0 errors), Smoke test ✅ (fresh PostgreSQL, all baseline checks), CI ✅ (all 3 checks: Lint/Test/Build, Validate Text Encoding, Validate Security Configuration)
  - **Commits:** 
    - `baa611a`: Initial refactor with [Instant] [5] [25] buttons and HexSelectionModal
    - `d480a8e`: Gemini feedback fixes (restored terrain vars, added Launch buttons, fixed UX issues)
  - **Code Quality:** All changes lint ✅. No functional regressions. Improved UX for resource gathering target selection.

### 2026-07-04

- **Exploration System Redesign — All 4 Phases Complete** (PR #779-#789, all merged 2026-07-04): Comprehensive transformation of instant single-turn searches + generic expeditions into turn-based, progression-gated exploration system with scout allocation rings, Epic Trek point-and-go targeting, resource gathering mechanics, and regional locations.
  - **Phase 0: Hex Foundation Validation** (PR #779): Verified pixelToHex, hexUnitDistance, getHexesInRadius functions; verified visibility-cells bitmap functions; performance validation (Ring 1-11 <1ms, Ring 12-17 <5ms); fixed blueprint code bugs
  - **Phase 1: Turn-based Actions Refactor** (PR #780 backend, #781 UI): Converted instant searches to turn-based actions with proper state management and UI integration
  - **Phase 2A: Scout Allocation Database** (PR #783): Database schema and persistence layer for scout allocation system
  - **Phase 2B: Scout Ring Geometry** (PR #784): Ring progression calculations and spatial system
  - **Phase 2C: Engine Integration** (PR #785): Core game engine wiring for ring progression and turn calculation
  - **Phase 2D: Visibility Integration** (PR #786): Fog of War system integration with ring-based discovery
  - **Phase 2E: Scout UI & Progression Display** (PR #787): User interface for scout allocation management and ring progress display
  - **Phase 3: Epic Trek Exploration** (PR #788): Point-and-go targeting system for extended exploration
  - **Phase 4: Regional Locations** (PR #789): Dungeon/mountain discovery system with deterministic seeding and location-based turn costs
  - **Specifications:** `EXPLORATION_SYSTEM_LOCKED.md` (complete specification, all parameters locked), `IMPLEMENTATION_PLAN.md` (4-phase roadmap with file manifest)
  - **Quality Gates:** Lint ✅, Smoke tests ✅, Gemini reviews addressed, all CI checks passing
  - **Impact:** Complete exploration system overhaul enabling turn-based progression-gated discovery mechanics as foundation for post-beta features

- **ProgressBar Component Extraction & Refactoring** (PR #794, merged 2026-07-04): Created reusable `ProgressBar.jsx` component to eliminate 200+ individual progress bar div pairs scattered across panels. Enhanced component with flexible styling support via `wrapperClassName` and `barClassName` props for panel-specific customization while maintaining consistent reusable base.
  - **Component improvements:**
    - Auto-clamps percent values (0-100)
    - Handles string percentage parsing (e.g., "45%") gracefully
    - Supports custom DOM IDs for E2E test selectors
    - Flexible wrapper/bar styling via optional className props
    - Backward compatible with existing usage patterns
  - **Panels refactored:**
    - **TrainingPanel:** 6 support unit XP bars (engineers, scribes, researchers) + 6 troop unit XP bars (fighters, rangers, clerics, mages, thieves, ninjas)
    - **StatusPanel:** 10 research/stat progress bars with correct colors and DOM IDs preserved
    - **BuildPanel:** Build progress bars with custom h-[5px]/rounded-sm/bg-amber styling via custom className props
  - **Code reduction:** ~200+ inline div pairs → 1 reusable component across 3+ panels
  - **Gemini Review:** Initial review identified visual regressions (missing layout classes, broken colors, missing IDs) and component robustness gaps. All feedback addressed in follow-up commits: enhanced ProgressBar signature, restored layout classes, fixed color classes, restored DOM IDs, removed redundant parseFloat calls.
  - **Testing:** Lint ✅ (0 errors), Smoke test ✅ (fresh PostgreSQL, all baseline checks), Sanity ✅, CI ✅ (all 3 checks green after final fix)
  - **Approach:** Created single reusable component instead of batch CSS consolidation, enabling architectural improvement over individual style refactoring. More maintainable and reduces future bloat.

- **Admin CSS Consolidation: Phase 1-3** (PR #793, merged 2026-07-04): Batch refactoring of inline styles to Tailwind CSS classes across three React panels. Total: 42 static styles converted using Python automation script with regex pattern mapping.
  - **Phase 1 - TrainingPanel:** 1 style converted (conditional capacity color from inline style to className with ternary logic). Dynamic width styles (progress bars) remain as inline (correct pattern).
  - **Phase 2 - BuildPanel:** 1 style converted (demolish button color from inline style={{}} to className). Remaining styles are dynamic (dependent on state).
  - **Phase 3 - ResourcesPanel:** 40 styles converted (batch refactoring via Python script targeting common patterns: color utilities, font-weight combinations, flex layouts, typography, card styling, grid layouts). Remaining ~51 styles are dynamic.
  - **Approach:** Created Python automation script (`resources-panel-refactor.py`) with STYLE_MAPPINGS database containing 21 regex patterns for static-to-Tailwind conversions. Applied to identify and convert all matching patterns efficiently.
  - **Testing:** Phase 1: Lint ✅, Smoke test ✅ (fresh PostgreSQL, all baseline checks). Phase 2-3: Included in same PR, monitoring scheduled.
  - **Gemini Review:** Phase 1 reviewed cleanly — "no review comments, no additional feedback to provide."
  - **Next Steps:** Phases 4+ (TestingPanel, RankingsPanel, remaining 15+ panels) deferred as continuation work. Conditional styles and dynamic properties require more complex refactoring (ternaries, state-dependent values).
  - **Code Quality:** All changes lint ✅. No functional regressions (CSS consolidation only).

- **Admin CSS Consolidation: Phase 4 (TestingPanel)** (PR #795, merged 2026-07-04): Refactoring TestingPanel component to convert 146 static inline styles to Tailwind CSS classes. Complex testing dashboard UI with tabs, progress bars, test groups, and stats grid.
  - **Conversion Results:** 146 static styles converted (82% success), 17 dynamic styles preserved inline (ternaries, state-dependent colors), 14 unmapped edge cases kept inline (complex rgba values, special grid patterns)
  - **Key Improvements:**
    - Tab navigation: Converted padding/fontSize/borders to Tailwind classes, preserved dynamic font-weight and background colors via clsx
    - Progress bars: Converted padding/height/borders, preserved dynamic width calculations and color transitions
    - Test grid: Converted spacing, sizing, typography to Tailwind, preserved dynamic row highlighting and test status colors
    - Test descriptions: Converted backgrounds and text styling with conditional styling via clsx
    - Failure comment boxes: Converted styling with preserved dynamic backgrounds (rgba colors)
  - **Approach:** Python automation script with 95+ STYLE_MAPPINGS, 100% automated conversion with manual review of dynamic patterns
  - **Gemini Review:** 15+ critical issues identified on first review (invalid Tailwind classes, dropped styles, missing styling). All addressed in follow-up commits:
    - ✅ Fixed invalid classes: bg-border → bg-[var(--border)], border-border → border, bg-bg1 → bg-bg
    - ✅ Restored dropped styles: progress bar width/transitions, grid layouts, alignments
    - ✅ Restored visual styling: test descriptions (bg-white/[0.03]), failure comments (bg-red/10), active tabs (text-black)
    - ✅ Restored accessibility: cursor-pointer, resize-y on textarea
    - ✅ Conditional styling refactored to use clsx instead of inline ternaries
  - **Testing:** Lint ✅ (0 errors), Smoke test ✅ (fresh PostgreSQL, all baseline checks), Sanity ✅ (no logic changes, no new CSS variables)
  - **Code Quality:** All changes lint ✅. No functional regressions.

- **Admin CSS Consolidation: Phase 4B (RankingsPanel)** (PR #796, merged 2026-07-04): Refactoring RankingsPanel component to convert 105 static inline styles to Tailwind CSS classes. Two ranking tables (kingdoms and alliances) with complex row styling and action buttons.
  - **Conversion Results:** 105 static styles converted (100% success — pure static, no dynamic patterns), 2 dynamic styles preserved inline (rankColor, nameStyle), 10 unmapped edge cases kept inline (borderCollapse, letterSpacing, padding variants)
  - **Key Improvements:**
    - Table headers: Converted color/font/text styling to Tailwind, preserved uppercase/letter-spacing via tracking class
    - Table rows: Converted padding/colors/alignment, preserved dynamic rank colors (gold/amber/text3) and name styling (accent1/white)
    - Action buttons: Converted padding/fontSize to Tailwind classes with conditional visibility
    - Tab buttons: Converted padding/font styling to classes, preserved active state styling
    - Kingdom highlight: Restored missing background highlight for current user (isMe) with transition-colors
    - Race icon sizing: Fixed font size from text-xl to text-lg (18px accuracy)
  - **Gemini Review:** 10 feedback items identified on first review. All addressed in follow-up commits:
    - ✅ Row background highlight and transition restored for isMe rows
    - ✅ Converted remaining inline styles to Tailwind arbitrary classes (color, padding, margin, tracking)
    - ✅ Fixed font size accuracy: text-lg (18px) instead of text-xl (20px)
    - ✅ Removed all inline style={{}} blocks except for 2 dynamic patterns
  - **Testing:** Lint ✅ (0 errors), Smoke test ✅ (fresh PostgreSQL, endpoints respond), Sanity ✅ (no logic changes)
  - **Code Quality:** All changes lint ✅. No functional regressions. 100% style conversion (no unmapped mappable styles remain).

- **Admin CSS Consolidation: Phase 4C (DefensePanel)** (PR #797, merged 2026-07-04): Refactoring DefensePanel component to convert 5 inline color styles to Tailwind CSS classes. Defense tiers UI with stat displays and upgrade lists.
  - **Conversion Results:** 5 static color styles converted (100% success), 0 dynamic styles, 0 unmapped edge cases. Refactored getStatColor() → getStatColorClass() to return Tailwind class names instead of CSS variable strings. Updated tierStatus state to use colorClass property instead of color.
  - **Key Improvements:**
    - Stat color styling: Changed from inline style={{color: ...}} with CSS variables to className-based approach using text-gold, text-green, text-text2 Tailwind classes
    - tierStatus colors: Refactored state structure from color property to colorClass property for consistency with component-level styling
    - Function signature change: getStatColor (returns CSS var strings) → getStatColorClass (returns Tailwind class names)
  - **Gemini Review:** 1 feedback item identified on first review: edge case where stat targets (`max`) value of 0 (e.g., targetCastles) incorrectly evaluated to gold status. Fixed with guard clause `if (!max || max <= 0) return 'text-text2'` to return neutral color for inactive stats.
    - ✅ Edge case fix applied: zero/negative targets now render as neutral (text-text2) instead of gold
  - **Testing:** Lint ✅ (0 errors), Smoke test ✅ (fresh PostgreSQL, all baseline checks), Sanity ✅ (no logic changes, all CSS variables mapped to valid Tailwind classes)
  - **Code Quality:** All changes lint ✅. No functional regressions. Clean refactoring with improved maintainability via class-name-based styling.

- **Admin CSS Consolidation: Phase 4D (EconomyPanel)** (PR #800, merged 2026-07-04): Refactoring EconomyPanel component to convert 10 inline style instances to Tailwind CSS utility classes and direct className expressions. Economy management UI with commodity markets, trade offers, bank deposits, and trade routes.
  - **Conversion Results:** 10 static/conditional styles converted (100% success), 0 dynamic styles remaining inline, 0 unmapped edge cases. Patterns: conditional text colors (4 instances), static text colors (2 instances), font-weight (1 instance), conditional display (2 instances), extracted dtColorClass and statusColorClass for computed class names.
  - **Key Improvements:**
    - Conditional colors: Replaced `style={{color: ...}}` with className ternaries for net income (2 instances), food balance (1 instance), trade status (1 instance)
    - Static colors: Converted spoilage and market income to direct text-[var(...)] classes
    - Font weight: Changed `fontWeight: 700` to `font-bold` class
    - Display states: Replaced `display: none/block` with `hidden`/`block` classes via conditional className
    - Class name computation: Extracted dtColor and statusColor variables to dtColorClass and statusColorClass for ternary-based class generation
  - **Gemini Review:** 6 feedback items on first review: Simplify redundant clsx() wrappers and replace with direct ternaries or string concatenation. All addressed in follow-up commit:
    - ✅ Lines 348, 401, 735: Removed clsx wrapper from single ternary expressions
    - ✅ Lines 436, 478, 515, 730: Replaced clsx with string concatenation for multiple classes
  - **Testing:** Lint ✅ (0 errors), Smoke test ✅ (fresh PostgreSQL, all 4 baseline checks: forum, auth, portal, game), Sanity ✅ (no logic changes, no new CSS variables)
  - **CI Status:** All 3 checks passed ✅ (Validate Security Configuration, Validate Text Encoding, Lint/Test/Build)
  - **Code Quality:** All changes lint ✅. No functional regressions. Simplified className expressions per Gemini feedback.

- **Admin CSS Consolidation: Phase 4E (BuildPanel)** (PR #801, merged 2026-07-04): Refactoring BuildPanel component to convert 4 inline styles to Tailwind CSS classes and refactor conditional colors to className expressions. Build queue UI with dynamic color indicators and conditional state displays.
  - **Conversion Results:** 4 static/conditional styles converted (100% success), 1 partial conversion (resonance color extracted to template literal ternary, opacity remains inline), 1 intentionally preserved (icon.color background state-dependent).
  - **Key Improvements:**
    - Build completion button (line 708): Static background → `bg-[var(--accent1)]` class
    - Build demolish button (line 711): Static background → `bg-[var(--red)]` class
    - Resonance hint container (line 737): Conditional margin → `mb-2` via string concatenation
    - Hammer durability display (lines 1021-1027): 3-tier color via template literal ternary (text-green/text-amber/text-red based on durability threshold)
    - Resonance detail (line 827): Resonance tier color extracted to className ternary via template literal (convergence=text-gold, alignment=text-amber, other=text-text3), opacity/letterSpacing remain inline as dynamic
    - Icon background (line 623): Kept inline style={{background: icon.color}} — state-dependent, correctly preserved
  - **Approach:** Hybrid pattern — static backgrounds to Tailwind classes, conditional colors to className expressions with template literals and ternaries (cleaner than JSX IIFE), state-dependent values remain inline
  - **Gemini Review:** 1 critical feedback item on first review: IIFE used in JSX render path for resonance color logic was unidiomatic and introduced unnecessary overhead. Fixed by replacing IIFE with direct template literal ternary expression.
    - ✅ IIFE → template literal ternary fix applied, reducing JSX complexity and improving idiomatic React patterns
  - **Testing:** Lint ✅ (0 errors), Smoke test ✅ (fresh PostgreSQL, all 4 baseline checks: forum, auth, portal, game), Sanity ✅ (no logic changes, HTML appearance identical)
  - **CI Status:** All 3 checks passed ✅ (Validate Security Configuration, Validate Text Encoding, Lint/Test/Build)
  - **Code Quality:** All changes lint ✅. No functional regressions. Improved idiomatic React rendering patterns.

- **Admin CSS Consolidation: Phase 4F (HappinessPanel)** (PR #802, merged 2026-07-04): Refactoring HappinessPanel component to convert 1 inline happiness bar color style to Tailwind CSS class. Progress bar UI with dynamic color indicators based on happiness threshold.
  - **Conversion Results:** 1 static/conditional style converted (100% success). Extracted conditional happiness bar background color from inline `style={{ ... }}` to className.
  - **Key Improvements:**
    - Happiness bar background color (lines 117-130): Extracted 4-tier conditional color logic to `happinessBarColorClass` variable, converted to className with ternary
      - happiness >= 80: `bg-[var(--green)]`
      - happiness >= 50: `bg-[var(--gold)]`
      - happiness >= 30: `bg-[var(--amber)]`
      - else: `bg-[var(--red)]`
    - Width property remains inline (dynamic, computed per turn)
  - **Approach:** Extracted conditional color logic to computed variable, direct className assignment with ternary operator
  - **Gemini Review:** No feedback. Clean conversion, no issues identified.
  - **Testing:** Lint ✅ (0 errors), Smoke test ✅ (fresh PostgreSQL, all 4 baseline checks: forum, auth, portal, game), Sanity ✅ (no logic changes, color thresholds preserved)
  - **CI Status:** All 3 checks passed ✅ (Validate Security Configuration, Validate Text Encoding, Lint/Test/Build)
  - **Code Quality:** All changes lint ✅. No functional regressions. Clean, single-pattern conversion.

- **Admin CSS Consolidation: Phase 4G (MarketPanel)** (PR #803, merged 2026-07-04): Refactoring MarketPanel component to convert 1 inline trade status color style to Tailwind CSS class. Trade management UI with dynamic status indicators.
  - **Conversion Results:** 1 static/conditional style converted (100% success). Extracted conditional trade status text color from inline `style={{ color: ... }}` to className.
  - **Key Improvements:**
    - Trade status color (lines 445-448): Extracted 3-tier conditional color logic to `statusColorClass` variable, converted to className with ternary
      - status === 'accepted': `text-[var(--green)]`
      - status === 'declined': `text-[var(--red)]`
      - else (pending): `text-[var(--amber)]`
    - Span element now uses className instead of style prop
  - **Approach:** Extracted conditional color logic to computed variable, direct className assignment with ternary operator
  - **Gemini Review:** No feedback. Clean conversion, no issues identified.
  - **Testing:** Lint ✅ (0 errors), Smoke test ✅ (fresh PostgreSQL, all 4 baseline checks: forum, auth, portal, game), Sanity ✅ (no logic changes, status colors preserved)
  - **CI Status:** Validate Security Configuration ✅, Lint/Test/Build ⏳ (in progress), Validate Text Encoding ⏳ (in progress)
  - **Code Quality:** All changes lint ✅. No functional regressions. Clean, single-pattern conversion.

- **Admin CSS Consolidation: Phase 4H (OptionsPanel)** (PR #804, merged 2026-07-04): Refactoring OptionsPanel component to convert 3 conditional inline styles to Tailwind CSS classes via clsx. Discord link settings UI with status indicators and message boxes.
  - **Conversion Results:** 3 static/conditional styles converted (100% success). Theme button preview (line 448) kept inline — state-dependent dynamic value (`theme.preview`), not statically analyzable.
  - **Key Improvements:**
    - Discord link status box (lines 109-115): background + borderColor conditional converted to `clsx('...', linkStatus?.linked ? 'border-[#58a6ff] bg-[rgba(88,166,255,0.12)]' : 'border-[var(--border)] bg-[var(--bg3)]')`
    - Discord status text (lines 111-117): color conditional converted to `clsx('text-[13px]', linkStatus?.linked ? 'text-[#58a6ff]' : 'text-[var(--text3)]')`
    - Message box (lines 131-137): background + color + borderColor conditional converted to `clsx('...', msg.type === 'ok' ? 'border-[var(--green)] bg-[rgba(63,185,80,0.15)] text-[var(--green)]' : 'border-[var(--red)] bg-[rgba(248,81,73,0.15)] text-[var(--red)]')`
  - **Gemini Review:** 3 feedback items — use `clsx()` instead of template-literal ternaries for readability. All addressed in follow-up commit.
  - **Testing:** Lint ✅ (0 errors), Smoke test ✅ (fresh PostgreSQL, all 4 baseline checks), Sanity ✅ (no logic changes), CI ✅ (all 3 checks green after fix)
  - **Code Quality:** All changes lint ✅. No functional regressions.

- **Admin CSS Consolidation: Phase 4I (NewsPanel)** (PR #805, merged 2026-07-04): Refactoring NewsPanel component to convert 1 inline text color style to Tailwind CSS class via clsx. News feed UI with per-type icons, borders, and message bodies.
  - **Conversion Results:** 1 static/conditional style converted (100% success). Per-type border-left color (line 245) correctly kept inline — `meta.color` is a runtime value from a lookup table (`game/news-emoji.mjs`), not statically analyzable by Tailwind's JIT compiler.
  - **Key Improvements:**
    - News body text color (line 249): Converted `style={{ color: isBorderType ? 'var(--text)' : 'var(--text2)' }}` to `className={clsx('news-body', isBorderType ? 'text-[var(--text)]' : 'text-[var(--text2)]')}`
  - **Approach:** Direct clsx conversion, no new variables needed since `clsx` was already imported and used elsewhere in the file.
  - **Gemini Review:** No feedback. Clean conversion, no issues identified.
  - **Testing:** Lint ✅ (0 errors), Smoke test ✅ (fresh PostgreSQL, all 4 baseline checks), Sanity ✅ (no logic changes, existing CSS vars reused), CI ✅ (all 3 checks green)
  - **Code Quality:** All changes lint ✅. No functional regressions.

- **Admin CSS Consolidation: Phase 4J (HeroesPanel)** (PR #806, merged 2026-07-04): Refactoring HeroesPanel component to convert 3 inline styles to Tailwind CSS classes via clsx. Hero cards, hero class recruitment options, and hero slots capacity bar.
  - **Conversion Results:** 3 static/conditional styles converted (100% success). Dynamic width percentages kept inline in all three cases (runtime values, not statically analyzable by Tailwind).
  - **Key Improvements:**
    - Hero XP progress bar background color: `clsx('h-full rounded-[2px]', levelReady ? 'bg-[var(--green)]' : 'bg-[var(--gold)]')`, width remains inline
    - Hero class option border color: `clsx('hero-class-opt ...', selectedHeroClass === id ? 'border-[var(--accent1)]' : 'border-[var(--border)]')`
    - Hero slots bar: static `transition: 'width 0.3s'` converted to `transition-[width] duration-300` Tailwind class, width remains inline
  - **Gemini Review:** 1 feedback item — redundant `!isMaxLevel && levelReady` condition simplified to `levelReady` (levelReady's definition already requires level < 25, the exact inverse of isMaxLevel). Addressed in follow-up commit.
  - **Testing:** Lint ✅ (0 errors), Smoke test ✅ (fresh PostgreSQL, all 4 baseline checks), Sanity ✅ (no logic changes, existing CSS vars reused), CI ✅ (all 3 checks green after fix)
  - **Code Quality:** All changes lint ✅. No functional regressions.

- **Admin CSS Consolidation: Phase 4K (KingdomXpModal)** (PR #807, merged 2026-07-04): Refactoring KingdomXpModal component to convert 2 inline styles to Tailwind CSS classes. Kingdom level progress bar in the level-up modal.
  - **Conversion Results:** 2 static styles converted (100% success). Dynamic width percentage kept inline (runtime value).
  - **Key Improvements:**
    - Progress bar track: fully static `{ height: 10, background: 'var(--bg4)' }` converted to `h-2.5 bg-[var(--bg4)]`
    - Progress bar fill: static gradient background extracted to `bg-gradient-to-r from-[var(--accent1)] to-[var(--gold)]`, dynamic width remains inline
  - **Gemini Review:** 2 feedback items — use Tailwind's built-in gradient utilities instead of an arbitrary `bg-[linear-gradient(...)]` value, and narrow `transition-all` to `transition-[width]` since only width animates on the element. Both addressed in follow-up commit.
  - **Testing:** Lint ✅ (0 errors), Smoke test ✅ (fresh PostgreSQL, all 4 baseline checks), Sanity ✅ (no logic changes, gradient renders identically, `h-2.5` matches the original 10px exactly), CI ✅ (all 3 checks green after fix)
  - **Code Quality:** All changes lint ✅. No functional regressions.

- **Admin CSS Consolidation: Phase 4L (WarfarePanel)** (PR #808, merged 2026-07-05): Refactoring WarfarePanel component to convert its 2 remaining inline color styles to Tailwind CSS classes. Attack estimate panel and war reports list.
  - **Conversion Results:** 2 conditional styles converted (100% success). WarfarePanel now has zero inline `style={{}}` occurrences.
  - **Key Improvements:**
    - Attack estimate win-chance color: `winColor` renamed to `winColorClass` in the `atkEstimate` memo — 3-tier ternary (`text-[var(--green)]` ≥60%, `text-[var(--amber)]` ≥40%, `text-[var(--red)]` below)
    - War report outcome color: `outcomeColor` renamed to `outcomeColorClass` (`text-[var(--green)]` success, `text-[var(--amber)]` caught, `text-[var(--text3)]` repelled), applied via `clsx('font-bold', outcomeColorClass)`
    - Removed dead `?? 'var(--text2)'` / `?? 'var(--text)'` fallbacks — the ternaries always produce a value, so those branches were unreachable
  - **Gemini Review:** No feedback. Clean conversion, no issues identified.
  - **Testing:** Lint ✅ (0 errors), Smoke test ✅ (fresh PostgreSQL, all 4 baseline checks), Sanity ✅ (grepped renamed symbols — zero stale references; same colors and thresholds), CI ✅ (all 3 checks green)
  - **Code Quality:** All changes lint ✅. No functional regressions.

- **Admin CSS Consolidation: Phase 4M (small panels batch)** (PR #809, merged 2026-07-05): Converting the last static/conditional inline styles across four small components — StatusPanel, UpgradesList, ResourceStrip, ToastProvider — one style each.
  - **Conversion Results:** 4 styles converted. Remaining inline styles in these files are runtime values (dynamic happiness-mask width, TOAST_THEME lookup colors) and stay inline by design.
  - **Key Improvements:**
    - StatusPanel: Thralls Defense badge `background: '#444'` → `bg-[#444]` (base `.badge` class sets no background — no cascade conflict)
    - UpgradesList: Buy button opacity ternary → `disabled:opacity-50` variant; the opacity condition was exactly the inverse of the `disabled` prop, so the variant replaces the JS with a static class
    - ResourceStrip: `defenseColor` → `defenseColorClass` using `!text-[var(--red)]` / `!text-[var(--gold)]`; the `!` modifier is required because `.metric .val` is a two-class descendant selector that would beat a plain utility, and the replaced inline style outranked it
    - ToastProvider: static `color: '#0a0a0a'` split out of the icon style object into `text-[#0a0a0a]`; runtime `theme.border` background stays inline
  - **Gemini Review:** No feedback. Clean conversion, no issues identified.
  - **Testing:** Lint ✅ (0 errors), Smoke test ✅ (fresh PostgreSQL, all 4 baseline checks), Sanity ✅ (cascade audit of .badge/.btn:disabled/.metric .val before each conversion; grepped renamed defenseColor — zero stale references), CI ✅ (all 3 checks green)
  - **Code Quality:** All changes lint ✅. No functional regressions.

- **Admin CSS Consolidation: Phase 4N (BattleReportModal)** (PR #810, merged 2026-07-05): Converting all 26 static inline styles in the GSAP-animated battle report modal to Tailwind classes (net −70 lines pre-fix).
  - **Conversion Results:** 26 static styles converted. Kept inline (runtime only): SummaryCard `borderLeftColor`/`color` from the `tone` prop, and the three bar widths (dynamic percentages, GSAP-animated).
  - **Key Improvements:**
    - Backdrop/panel/close/subtitle/dismiss → utility classes; title `titleColor` variable → clsx win/loss ternary; result rows `valColor` → `valColorClass`; outcome banner `outcomeStyle` object → `outcomeClass` clsx branch (gradients/borders/shadows as arbitrary-value utilities); SummaryCard chrome → clsx `impact` branch
    - GSAP interplay safe by construction: GSAP writes inline styles at runtime, which override classes — entrance timeline, reduced-motion path, win pulse, and loss shake unchanged
  - **Gemini Review:** 9 feedback items, 2 high-priority. Root cause: the project's `tailwind.config.js` overrides the fontSize scale (sm=11px, base=13px, md=14px, lg=16px, xl=18px), so `text-base`/`text-sm` picks were real size regressions (16px→13px title, 14px→11px row values). Fixed to `text-lg`/`text-md`, and swapped arbitrary `text-[11/13/18px]` for theme classes `text-sm`/`text-base`/`text-xl`. All addressed in follow-up commit.
  - **Testing:** Lint ✅ (0 errors), Smoke test ✅ (fresh PostgreSQL, all 4 baseline checks, re-run after fixes), Sanity ✅ (full file re-read; grepped removed titleColor/outcomeStyle/valColor — zero stale references), CI ✅
  - **Code Quality:** All changes lint ✅. No functional regressions.

- **Admin CSS Consolidation: Phase 4O (KingdomBodyHeader)** (PR #811, merged 2026-07-05): Converting all 7 static inline styles in the kingdom header to Tailwind classes; only the XP bar's dynamic width stays inline.
  - **Key Improvements:**
    - `GAP = 8` module constant removed — all five inline `gap`/`marginTop` styles → `gap-2`/`mt-2` (one inline gap even duplicated an existing `gap-2` class)
    - Kingdom name glow → `[text-shadow:0_0_10px_rgba(var(--theme-rgb),0.35)]` arbitrary property
    - XP bar: static gradient → `bg-gradient-to-r from-[var(--accent1)] to-[var(--gold)]`; conditional glow (`pct > 0`) → clsx conditional `shadow-[...]`
    - `Stat` component: `valueStyle` object prop → `valueClass` string prop (file-local; the only override was a static gold color) — exactly one color class present at a time, no cascade ambiguity
  - **Gemini Review:** 1 item — `transition-all duration-400` → `transition-[width] duration-500`. Verified: `duration-400` is not in the config and used nowhere else, so it was silently non-functional pre-existing dead weight. Applied.
  - **Testing:** Lint ✅ (0 errors), Smoke test ✅ (fresh PostgreSQL, all 4 baseline checks), Sanity ✅ (grepped removed GAP/valueStyle — zero stale references; all 5 Stat usages accounted for), CI ✅
  - **Code Quality:** All changes lint ✅. No functional regressions.

- **Admin CSS Consolidation: Phase 4P (ReplayModal/RankingsPanel/ExplorationPanel batch)** (PR #812, merged 2026-07-05): Converting 9 inline styles across three components; HappinessGraph audited alongside (0 convertible — all runtime `getColor()` values driving SVG currentColor).
  - **Key Improvements:**
    - ReplayModal fully converted (zero inline styles remain): StepCard static chrome + combat/normal border ternary + `visible` enter/exit state via clsx (`translate-x-5 opacity-0` ↔ `translate-x-0 opacity-100`, `transition-all duration-300 ease-[ease]`); backdrop/panel to utilities
    - RankingsPanel: `rankColor`/`nameStyle` style objects → `rankColorClass`/`nameClass` theme-class ternaries (`text-gold font-bold`/`text-amber`/`text-text3`; `text-accent1 font-bold`/`text-text font-semibold`); static td paddings → `px-1.5 py-2.5`/`py-6`; alliance name → `text-text`
    - ExplorationPanel (partial by design): static `borderLeftWidth: 3px` split to `border-l-[3px]`; loot rarity border ternary → clsx; `meta.border`/`meta.color` runtime lookups stay inline
    - Compile-verified with the project's Tailwind 3.4.17 that `border-l-[var(--x)]` resolves to border-left-color and is ordered after `border-[var(--border)]`
  - **Gemini Review:** 2 items — add explicit `color:` type hints to `border-l-[var(...)]` values (ambiguous between width/color in Tailwind v3). Applied even though compile-verified, as the hint is strictly more robust.
  - **Testing:** Lint ✅ (0 errors), Smoke test ✅ (fresh PostgreSQL, all 4 baseline checks, re-run after fix), Sanity ✅ (grepped removed rankColor/nameStyle — zero stale references), CI ✅
  - **Code Quality:** All changes lint ✅. No functional regressions.

- **Admin CSS Consolidation: Phase 4Q (TestingPanel)** (PR #813, merged 2026-07-05): Converting 7 remaining inline styles in TestingPanel to Tailwind CSS classes. Testing dashboard UI with progress indicators and test status displays.
  - **Conversion Results:** 7 static/conditional styles converted (100% success). Dynamic flex weight values (lines 385/391/397) kept inline by design.
  - **Key Improvements:**
    - Progress percent color (line 454): 2-tier ternary (100% = green, else = amber) → `className={clsx('text-sm font-bold', progressPercent === 100 ? 'text-[#4ade80]' : 'text-[#fbbf24]')}`
    - Progress bar fill color (line 464): 2-tier ternary → `className={clsx('h-full transition-all duration-300 ease-in-out', progressPercent === 100 ? 'bg-[#4ade80]' : 'bg-[#fbbf24]')}`, width remains inline
    - Test row margin (line 486): Conditional bottom margin → `clsx('flex items-center gap-2', (!!TEST_DESCRIPTIONS[key] || isFailing) && 'mb-1.5')` with boolean coercion for clarity
    - Finished test strikethrough (line 496): Strikethrough + text color ternary → `className={clsx('flex-1 font-medium', test.finished && 'line-through text-[var(--text2)]')}`
    - Pass button color (line 502): 2-tier ternary → `className={clsx('px-2 py-1 text-sm border-none rounded-sm cursor-pointer', test.passed === true ? 'bg-[#4ade80]' : 'bg-[var(--border)]')}`
    - Fail button color (line 514): similar pattern to pass button
    - Static indent (line 530): `marginLeft: '28px'` → `ml-7` (7 * 4px = 28px)
  - **Gemini Review:** 1 item — boolean coercion on `TEST_DESCRIPTIONS[key]` lookup (change from `(TEST_DESCRIPTIONS[key] || isFailing)` to `(!!TEST_DESCRIPTIONS[key] || isFailing)`) for explicit type safety. Applied in follow-up commit.
  - **Testing:** Lint ✅ (0 errors), Smoke test ✅ (fresh PostgreSQL, all 4 baseline checks), Sanity ✅ (no logic changes, all colors static), CI ✅ (all 3 checks green after fix)
  - **Code Quality:** All changes lint ✅. No functional regressions.

- **Admin CSS Consolidation: Phase 4R (ResourcesPanel)** (PR #814, merged 2026-07-05): Converting ~45 inline styles in ResourcesPanel to Tailwind CSS classes. Large-scale refactoring across stockpiles, buildings, expeditions, and inventory sections.
  - **Conversion Results:** ~45 static/conditional styles converted (100% success). Dynamic values correctly preserved inline (grid-template-columns, progress bar width percentage, statusColor function call).
  - **Key Improvements:**
    - Stockpiles: flex layout + text colors → Tailwind classes, conditional status color (green/red) via clsx
    - Buildings: tab navigation (padding/color/border conditional) → clsx, card layouts, progress bar container + fill with dynamic width inline
    - Expeditions: card styling, dispatch/scan buttons, node/expedition input fields, countdown text colors
    - Inventory: grid layout (dynamic gridTemplateColumns stays inline), item cards with conditional border color (green/border based on qty)
  - **Dynamic values preserved:** 
    - `gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))'` (auto-fill responsive grid)
    - `width: getBuildPct(bld.key) + '%'` (dynamic progress percentage)
    - `statusColor(exp.status)` (function-driven color lookup)
  - **Gemini Review:** Pending (PR #814 awaiting Gemini review; CI all 3 checks passed)
  - **Testing:** Lint ✅ (0 errors), Smoke test ✅ (fresh PostgreSQL, all 4 baseline checks), Sanity ✅ (no logic changes, dynamic values correctly preserved), CI ✅ (all 3 checks green)
  - **Code Quality:** All changes lint ✅. No functional regressions.

- **Admin CSS Consolidation: Phase 4S (Final Audit & Completion)** (Merged 2026-07-05): Comprehensive final audit of all remaining React panel components to confirm CSS consolidation work is complete. Verified that all remaining inline styles are dynamic (calculated values, runtime data, function calls) and cannot be converted to Tailwind classes.
  - **Audit Scope:** HappinessGraph, ExplorationPanel, BattleReportModal, GoalsPanel, WorldmapPanel, TestingPanel, ResourceStrip, HappinessWidget, ChatMessageRow, GlobalchatPanel, KingdomProfileModal, ToastProvider, ProgressBar, and all other panel components.
  - **Findings:**
    - **HappinessGraph:** 4 inline styles (all dynamic color lookups from getColor() function and currentColor variable)
    - **ExplorationPanel:** 3 inline styles (all dynamic meta.* runtime values: borderLeftColor, color, width percentages, box-shadow)
    - **BattleReportModal:** 5 inline styles (all dynamic tone colors and GSAP-animated percentage widths)
    - **GoalsPanel:** 2 inline styles (both dynamic progress percentage calculations)
    - **WorldmapPanel:** 2 inline styles (both dynamic metadata lookups: meta.color/stroke, REGION_META lookups)
    - **Remaining panels:** All other inline styles verified as dynamic (runtime data, calculated values, function calls)
  - **Conclusion:** All static/conditional styles that could be converted have been converted in Phases 4A-4R (~190+ total conversions across 15+ panels). All remaining inline styles are intentionally preserved because they cannot be pre-calculated by Tailwind's JIT compiler.
  - **Work Summary:** CSS Consolidation project complete. All panels audited. No further static-to-Tailwind conversions possible without breaking dynamic behavior.
  - **Testing:** Comprehensive audit verified no missing conversions. Code quality: all remaining inline styles are justified and necessary.

- **Dead Route Handlers Cleanup** (PR #791, merged 2026-07-04): Removed 17 duplicate unreachable route handlers from `kingdom-gameplay.js` (16 routes) and `kingdom-research.js` (1 route). These routes were previously moved to `kingdom-build.js` but remain as dead code since Express matches the first router that handles a given path+method on the same prefix.
  - **Routes removed:**
    - `kingdom-gameplay.js`: POST /build-queue, GET/POST /training-allocation, POST /build-allocation, POST /resource-build-allocation, POST /demolish, POST /build, POST /cancel-building, POST /smithy/buy-hammers, POST /smithy/buy-scaffolding, POST /smithy-allocation, POST /tower-craft, POST /tower-cancel, POST /shrine-allocation, POST /mausoleum-allocation, POST /buy-mausoleum-upgrade (16 total)
    - `kingdom-research.js`: POST /school-allocation (1 total)
  - **Code reduction:** ~600 lines removed (604 deletions, 2 additions net)
  - **Cleanup:** Removed unused imports (`validateAllocationObject`, `validateNonNegativeInteger`) and dead constants (`_KINGDOM_RESOURCE`, `_KINGDOM_SMITHY`)
  - **Gemini Review:** Feedback to remove dead constants entirely (not just prefix) was addressed immediately in follow-up commit. Review comment marked outdated after fix applied.
  - **Testing:** Lint ✅ (0 errors), CI (Lint/Test/Build, Security, Text Encoding) ✅, Smoke test ✅
  - **Impact:** No functional impact (dead routes never reached). Reduces maintenance surface area and codebase complexity.

- **Transaction Context Safety Fix: db.withTransaction Migration** (PR #790, merged 2026-07-04): Critical race condition fix migrating all 13 transaction endpoints from manual `BEGIN TRANSACTION`/`ROLLBACK`/`COMMIT` pattern to `db.withTransaction()` helper. Ensures transaction context is properly propagated via `transactionStorage`, enabling reliable row-locking with `SELECT...FOR UPDATE` to prevent lost-update race conditions on concurrent requests.
  - **Problem:** Manual transaction pattern does not propagate transaction context correctly, causing `transactionStorage.getStore()` to return null after `BEGIN`, breaking `SELECT...FOR UPDATE` row locking. Concurrent requests on same row have no mutual exclusion, risking lost updates. Manual pattern also leaks connections (~40-50s until reaper reclaims).
  - **Solution:** `db.withTransaction(fn)` wraps callback in `transactionStorage.run()`, which propagates context correctly. Verified via testing: concurrent `Promise.all` repro drops from ~50s (waiting on reaper) to under 1s with zero leaked connections.
  - **Files modified:**
    - `routes/hero.js` — 1 endpoint refactored (POST /recruit)
    - `routes/kingdom-build.js` — 8 endpoints refactored (training-allocation, build-allocation, demolish, build, cancel-building, smithy/buy-hammers, smithy/buy-scaffolding, tower-craft)
    - `routes/kingdom-economy.js` — 4 endpoints refactored (trade-routes/establish, market/buy, market/sell, economy/bank-deposit)
  - **Pattern:** Replaced `await db.run("BEGIN TRANSACTION")` with `await db.withTransaction(async () => {...})`, converted `ROLLBACK; return res.status(xxx)` to `throw Error` with `statusCode` property, replaced `COMMIT` with callback close, wrapped outer `res.json()` in try-catch with `statusCode` error handler.
  - **Gemini Review:** Initial review identified 3 critical issues (missing statusCode properties, hardcoded 500 status, missing game validations). All fixed in follow-up commit, CI green, ready to merge.
  - **Testing:** Lint ✅, CI (Lint/Test/Build, Security, Text Encoding) ✅, Sanity check ✅ (patterns verified across 3 files, proper error handling confirmed).
  - **Severity:** HIGH — data integrity issue affecting all transaction endpoints. Moderate-to-large blast radius but isolated to error handling pattern.

- **Exploration System Phase 1: Complete Turn-Based Resource Gathering** (PR #780 backend + PR #781 UI, merged 2026-07-04): Full implementation of turn-based resource gathering with both backend endpoints and frontend UI integration.
  - **Phase 1a - Endpoints & Economy:** Refactored instant searches to turn-based actions with three new endpoints and economy modules
    - **Hunting:** 5 turns, 10 food per ranger L1, forest terrain bonus (1.3x), no food cost, no unit loss on completion
    - **Prospecting:** 5 turns, 5 gold per engineer L1, mountain terrain bonus (1.3x), food cost scales by engineer count and level, formula corrected (multiply by multiplier, not divide)
    - **Land Expansion:** Instant action, 10 rangers = 1 land, 100 population per land, terrain modifiers apply (forest/grassland/mountain/water)
    - **Files created:** `game/hunting-economy.js`, `game/prospecting-economy.js`, `game/land-expansion.js`
    - **Files modified:** `game/config.js` (constants), `routes/kingdom-exploration.js` (endpoints)
    - **Gemini review (Phase 1a):** 5 critical issues identified and addressed (unit loss, double-processing, hardcoded terrain, broken lookup, formula discrepancy). All fixed before merge. CI green.
  - **Phase 1b - UI Integration:** Added turn-based resource gathering cards to ExplorationPanel component
    - **UI Cards:** Hunting, Prospecting, and Land Expansion action panels with ranger/engineer inputs and Max buttons
    - **Event Handlers:** Three new async handlers with validation, error handling, toast notifications, and instant entry logging
    - **State Management:** New state variables for unit counts and terrain selection (terrain defaults hardcoded to optimal values)
    - **Files modified:** `client/src/components/react/ExplorationPanel.jsx` (added UI, state, handlers)
    - **Gemini review (Phase 1b):** Type safety issue in handleProspecting (use availableEngineers consistently). Fixed immediately. Dependency array corrected. CI green.
  - **Full Phase 1 Status:** ✅ COMPLETE. Both backend and UI fully functional. Ready for Phase 2 (Scout allocation system).

- **Exploration System Phase 2A: Scout Allocation Database & Persistence** (PR #783, merged 2026-07-04): Foundation for scout ring progression system. Database schema, allocation logic, REST endpoints, and training-aware validation.
  - **Database:** Added `scout_allocation INT DEFAULT 0` column to kingdoms table for tracking allocated scout rangers
  - **Config:** Added `SCOUT_CONSTANTS` (SCOUT_BASE_TURNS=20, SCOUT_RING_INCREMENT=5, MAX_RING=17) for flexible tuning
  - **Module:** Created `game/scout-allocation.js` with three core functions:
    - `validateAllocation(kingdom, rangerCount)` — Check available rangers (accounts for training_allocation)
    - `calculateAllocationResult(kingdom, rangerCount)` — Compute new allocation state
    - `getAllocationStatus(kingdom)` — Return current allocation metrics
  - **Endpoints:** Two new REST endpoints in `routes/kingdom-exploration.js`:
    - `POST /api/kingdom/scout/allocate` — Allocate N rangers to scout pool
    - `POST /api/kingdom/scout/release-all` — Release all scouts back to rangers
  - **Safety:** Both endpoints use `db.withTransaction()` for row-locking and training_allocation is parsed/validated in all helper functions
  - **Gemini review:** No feedback. CI: all green. Ready for Phase 2B (Ring Geometry).

- **Exploration System Phase 2B: Scout Ring Geometry System** (PR #784, merged 2026-07-04): Ring progression infrastructure for turn-based scout advancement. Provides core math and enumeration for Rings 1-17 discovery.
  - **Module:** Created `game/scout-rings.js` with six core functions:
    - `getRingTurnCost(ring)` — Turn cost for specific ring: 20 + (N-1) × 5
    - `getRingHexes(homeHex, ring)` — All hexes in ring N (distance N from home, via hex-utils)
    - `getTotalHexesInRings(ring)` — Cumulative hex count in rings 1..N
    - `getTotalTurnsToCompleteRing(ring)` — Cumulative turn cost for rings 1..N
    - `getCompletedRing(scoutProgress)` — Highest completed ring from accumulated scout-turns
    - `getProgressMetrics(scoutProgress)` — Current ring, progress %, turns toward next ring
  - **Config:** SCOUT_CONSTANTS now used throughout (already added in Phase 2A)
  - **Dependencies:** Requires `getHexesInRadius` from hex-utils (already available)
  - **Performance:** Ring enumeration <5ms even for Ring 17 (919 hexes); suitable for turn-based (Phase 0 validated)
  - **Gemini review:** None (force-push after branch rebase fixed inverted diff; new commit reviewed cleanly). CI green. Ready for Phase 2C (Engine integration).

- **Exploration System Phase 2C: Engine Integration & Scout Progress Ticking** (PR #785, merged 2026-07-04): Turn-based scout ring progression with automatic advancement. Scouts allocated to scout pool accumulate progress each turn based on ranger level and race modifiers.
  - **Database:** Added `scout_progress INT DEFAULT 0` column to kingdoms table for tracking cumulative scout-turns
  - **New Module:** Created `game/scout-progress.js` with two core functions:
    - `getScoutProgressThisTurn(kingdom)` — Calculate scout-turns gained this turn (rangers × level_multiplier × race_modifier)
      - Level multiplier: 1 + (level-1) × 0.1 (L1=1x, L10=1.9x)
      - Race modifiers: human 1.0, orc 1.1, high/dark/wood_elf 1.15, dwarf 0.9, dire_wolf/vampire/ogre 1.0
      - Parses ranger_level from `troop_levels.rangers.level` JSON
    - `processScoutProgress(kingdom, db)` — Detect ring completion and flag visibility updates
      - Accumulates progress in `scout_progress` counter
      - Determines completed ring via `getCompletedRing()`
      - Returns {progress_gained, new_total, ring_completed, completed_ring_number, visibility_update_needed}
  - **Engine Integration:** Wired scout progress into `processTurn()` (section 4e-i)
    - Runs after active event tick-down
    - Logs system event when rings complete
    - Passes `db` parameter for future visibility updates
  - **Gemini Review:** 5 critical issues identified on first commit; all fixed in follow-up commit
    - ✅ Ranger level parsing (from troop_levels JSON)
    - ✅ Race modifiers (corrected to actual database races)
    - ✅ Coordinate extraction (getKingdomMapCoords + pixelToHex)
    - ✅ DB parameter passing (for visibility updates)
    - ✅ Error handling (try-catch for coordinate failures)
  - **CI:** All checks green after fixes. Ready for Phase 2D (Visibility integration).

- **Exploration System Phase 2D: Visibility Integration & Ring Hex Reveal** (PR #786, merged 2026-07-04): Fog reveal system for scout rings. When rings complete, all hexes at ring distance from home hex are automatically revealed in visibility bitmap (permanent discovery).
  - **New Function:** Created `revealRingHexes(db, kingdomId, kingdom, ring)` in visibility.js
    - Derives home hex from kingdom coordinates using getKingdomMapCoords() + pixelToHex()
    - Calculates ring hexes using getRingHexes(homeHex, ring) from scout-rings module
    - Adds all ring hex cells to seen_cells bitmap via cellIndex(col, row) 
    - Handles both string ("col,row") and object ({col, row}) hex formats
    - Updates visibility atomically via updateKingdomVisibility with db.withTransaction
    - Error handling prevents visibility loss on failures
  - **Engine Integration:** Updated processTurn() scout progress section (4e-i) in engine.js
    - Ring completion defers async revealRingHexes() call (non-blocking)
    - Fire-and-forget pattern with error logging
    - Visibility update happens after turn processing
  - **Gemini Review:** Identified 2 critical bugs; both fixed:
    - ✅ cellIndex invocation — Now correctly extracts col and row before calling cellIndex(col, row)
    - ✅ Boundary check — Removed incorrect `idx < 195` filter; now uses `idx >= 0`
  - **Result:** Ring hexes now properly revealed on ring completion. No hexes lost to invalid filtering.
  - **CI:** All checks green after fixes. Ready for Phase 2E (UI integration).

- **Exploration System Phase 3: Epic Trek Point-and-Go Exploration** (PR #788, merged 2026-07-04): Complete implementation of targeted long-distance expeditions with path revelation and discovery mechanics. Players select a destination on the worldmap, expedition reveals fog along the entire path, and discovers kingdoms/locations en route.
  - **Phase 3A - Backend Foundation:**
    - **game/epic-trek-paths.js** — Path calculation and distance metrics:
      - Straight-line hex enumeration (Bresenham-style interpolation)
      - Distance calculation in hex units
      - Turn cost: 1.5 turns per hex distance
      - Bounds validation (1999×1380 map)
    - **game/epic-trek-discovery.js** — Location discovery mechanics:
      - rollKingdomDiscovery: 30% chance per hex (seeded random)
      - rollLocationDiscovery: 15% chance per hex (seeded random)
      - processPathDiscoveries: batch discovery processing along entire path
    - **routes/kingdom-gameplay.js** — POST `/expedition/epic-trek` endpoint:
      - Ring 2 Scout completion gating (403 if not met)
      - Target coordinate validation
      - Turn cost calculation (1.5 per hex)
      - Food cost calculation (Deep Expedition formula × ranger level)
      - Creates expedition with path stored in `extra_data` JSON
      - Atomic updates via db.withTransaction()
    - **db/schema.js** — Schema migration for extra_data column
    - **Gemini review (Phase 3A):** 4 critical issues identified and fixed:
      - ✅ Missing expeditions.extra_data column (added migration)
      - ✅ Incorrect kingdom property access (kingdom.id, not kingdom.kingdom_id)
      - ✅ Ranger level parsing from troop_levels JSON
      - ✅ HTTP status codes (404 for not found, not 500)
  
  - **Phase 3B - UI & Hex Click Coordination:**
    - **client/src/components/react/ExplorationPanel.jsx**:
      - Epic Trek card with coordinate inputs (X, Y)
      - Launch button with turn/food validation
      - Toast feedback on success
      - Auto-populate from worldmap clicks via lifted state
    - **client/src/GameShell.jsx**:
      - Lifts selectedHex coordinates to parent state
      - Passes to both WorldmapPanel and ExplorationPanel
      - Enables hex click coordination across separate panels
    - **client/src/components/react/WorldmapPanel.jsx**:
      - Interactive hex layer with data attributes
      - Calls onHexClick when hex clicked
  
  - **Phase 3C - Expedition Resolution:**
    - **game/engine.js** — resolveEpicTrek function:
      - Processes Epic Trek completion
      - Reveals fog along entire path (updates seen_cells bitmap atomically)
      - Queries database to find kingdoms at discovered coordinates
      - Updates discovered_kingdoms JSON with actual kingdom IDs
      - Generates reward messages
      - Integrated into resolveExpeditions loop
      - Graceful error handling
  
  - **Gemini review (Phase 3B/3C):** 6 critical issues identified and fixed:
    - ✅ Property mismatch: path vs path_hexes in extra_data
    - ✅ Undefined discovered.id: Added database lookup for kingdoms at coordinates
    - ✅ React callback state bug: Lifted selectedHex coordinates instead of storing callback
    - ✅ Updated GameShell props for ExplorationPanel and WorldmapPanel
    - ✅ Removed unused handleHexClick function
    - ✅ Added effect to auto-populate coordinates on hex selection
  
  - **Result:** Complete Epic Trek system. Player can click worldmap to select destination, expedition calculates path and cost, reveals fog en route, discovers kingdoms, stores results. All Gemini feedback addressed, CI green. Ready for Phase 4 (Regional dungeons/mountains).

- **Exploration System Phase 4: Regional Dungeon/Mountain Locations** (PR #789, merged 2026-07-04): Distance-based turn costs for regional exploration. One dungeon and one mountain per region (18 total), seeded deterministically and discovered progressively.
  - **game/world-locations.js** — Location seeding and discovery tracking:
    - `seedRegionLocations(db, worldSeed)` — Creates all 18 regional locations at boot using seeded random with water avoidance (retry up to 10 times)
    - `getRegionLocationCoords()` — Generates reproducible coordinates within 500px of region home
    - `getLocationByRegionAndType()` — Cache lookup by region and type
    - `markLocationDiscovered(db, locationId, kingdomId)` — Tracks which kingdoms have discovered each location
    - `loadLocationCache(db)` — In-memory cache loading for fast runtime access
  - **game/location-distance.js** — Distance and turn cost calculations:
    - `getDistanceToLocation(kingdom, location)` — Hex distance from kingdom home to location using pixel coordinates
    - `getLocationTurnCost(type, distance)` — Base 50 (dungeon) or 100 (mountain) + distance × 1.5
  - **db/schema.js** — Added world_locations table:
    - One dungeon + one mountain per region (18 total)
    - `discovered_by_kingdom_ids` array tracking kingdoms that have discovered each location
    - UNIQUE(type, region_name) constraint
    - Added first_dungeon_found_turn and first_mountain_found_turn to kingdoms
  - **index.js** — Server boot integration:
    - Calls seedRegionLocations() and loadLocationCache() after initDb()
    - Locations ready immediately for gameplay
  - **routes/kingdom-exploration.js** — Modified POST /expedition/start:
    - Detects dungeon/mountain types and uses location-based turn costs instead of fixed EXP_TURNS
    - Validates unit availability (rangers/fighters) before deduction
    - Calculates distance to actual regional location and turn cost
    - Marks location as discovered, tracks first discovery turn
    - Returns correct newTurnsStored in response for UI turn counter
  - **Gemini review (5 critical issues identified, all fixed):**
    - ✅ hexUnitDistance call: Pass pixel coordinates directly, not hex objects
    - ✅ Unit availability: Added engine.getAvailableUnits() verification before deduction
    - ✅ Column name: k.turn instead of k.turn_num; use === null for turn 0
    - ✅ UI turn counter: Return actual newTurnsStored instead of hardcoded 0
    - ✅ Database pollution: Simplified markLocationDiscovered query, removed NULL appending
  - **Result:** Complete regional location system. Players discover and raid dungeons/mountains at distance-based turn costs. All Gemini feedback addressed in follow-up commit. Smoke test green, all baselines pass. Exploration System Redesign (Phases 1-4) fully complete.

- **Exploration System Phase 2E: Scout Allocation UI & Progression Display** (PR #787, merged 2026-07-04): Scout allocation interface and ring progress display in ExplorationPanel. Enables players to manage scout allocation from game UI.
  - **Client Store:** Added scout_allocation and scout_progress state to profileStore with server sync
  - **UI Card:** New Scout Allocation card in ExplorationPanel with:
    - Ranger allocation slider with Min/Max controls
    - Allocate and Release All button handlers calling /scout/allocate and /scout/release-all
    - Ring progress display showing allocated rangers and cumulative turns
    - Status badge indicating passive ring progression
  - **Gemini Review:** 4 actionable comments (high/medium priority); all addressed:
    - ✅ Removed unused kingdom_level/race selectors (prevent unnecessary re-renders)
    - ✅ Fixed availableRangers calculation to subtract scout_allocation (allocated rangers unavailable)
    - ✅ Enforce r > 0 in handleScoutAllocate (backend endpoint only adds rangers)
    - ✅ Updated UI labels to clarify additive behavior ('Rangers to add', 'Add to Allocation')
  - **Backend Integration:** Endpoints /scout/allocate and /scout/release-all already exist (Phase 2A implementation)
  - **CI:** All 3 checks passed (Lint/Test/Build, Text Encoding, Security Config)
  - **Status:** Phase 2E complete. Scout allocation system now fully integrated (Phases 2A-2E). Ready for Phase 3 (Epic Trek point-and-go exploration).

- **Exploration System Redesign — Design Phase Complete** (PR #778, merged `977c712`): Complete locked specification and 4-phase implementation plan for exploration system transformation. Replaces instant single-turn searches + generic expeditions with turn-based, progression-gated actions:
  - **Scout (allocation-based):** Ring progression (Ring N = 20 + (N-1) × 5 turns), auto-advances through 17 rings, discovers locations/lore/junk, no food cost, greyed out at Ring 17 only, no hard cap on rangers
  - **Epic Trek (point-and-go):** 1.5 turns per hex distance, reveals fog en route, random discovery per hex, food cost scales by ranger count, hidden until Ring 2 Scout complete
  - **Hunting:** 5 turns, 10 food per ranger L1, no food cost, forest terrain bonus
  - **Prospecting:** 5 turns, 5 gold per engineer L1, deep expedition food cost, mountain terrain bonus
  - **Land Expansion:** Instant, 10 rangers L1 = 1 land, 100 population per land, race modifiers apply
  - **Dungeon Raid:** 50 + (distance × 1.5) turns, weapons/armor loot, hidden until first dungeon found
  - **Mountain's Heart:** 100 + (distance × 1.5) turns, combat rewards, hidden until first mountain found
  - Created: `EXPLORATION_REDESIGN.md` (high-level), `EXPLORATION_SYSTEM_LOCKED.md` (complete specification), `IMPLEMENTATION_PLAN.md` (4-phase roadmap with file manifest)
  - Updated: `game/scout-economy.js` with new BASE_HEX_EXPLORATION_PER_RANGER formula (0.00001)
  - All specs locked 2026-07-04; ready for Phase 1 implementation (Refactor Instant Searches → Turn-Based)

- **Elevation System Plan: Complete Production Spec** (PR #799 + follow-up commits 39d1007, 74bf22e, 8ee9aa2; 2026-07-04): Comprehensive deferred-work specification for elevation system enabling organic rivers and combat depth. Full implementation-ready spec with expert feedback, 17 robustness improvements, and 3 polish sections.
  
  **Phase 1 (Elevation Generation):**
  - Multi-octave Perlin/Simplex FBM with world-seed seeding (includes FBM code skeleton with simplex-noise library pseudocode)
  - Explicit elevation bands: Ocean 0, Coast 1-30, Plains 31-90, Hills 91-149, Mountains 150-255
  - Biome-aware normalization (terrain type shapes elevation, not raw noise)
  - Server-side generation pipeline (shared world primitive, not client-only)
  - DB storage strategy: STORE in database (not regenerate) for consistency + migration logic for pre-elevation worlds
  - Precomputed at boot, O(hex count) one-time cost
  
  **Phase 2 (Organic Rivers):**
  - Concrete DAG algorithm: downhill neighbor graph + flow accumulation + sink rules
  - Tributary merging via flow convergence (multiple hexes → same downstream hex)
  - Bezier smoothing after DAG topology validation (prevents pathing bugs hidden by curves)
  - Proportional river width based on accumulated flow
  
  **Phase 3 (Combat & Gameplay, feature-flagged):**
  - Phase 3A: High-ground modifier (+7% defense, conservative within 5-10% window) behind FEATURE_ELEVATION_COMBAT
  - Phase 3B: Movement penalties (-30% mountains) + elevation fatigue (1 per 10 units uphill) behind FEATURE_ELEVATION_MOVEMENT
  - Phase 3C: Spell LOS checks + siege bonuses (+10% structure HP) behind FEATURE_ELEVATION_SPELLS
  - Battle outcome logging for balance tuning
  
  **Robustness Improvements (17 integrated):**
  - Feature flags: FEATURE_ELEVATION_COMBAT, FEATURE_ELEVATION_MOVEMENT, FEATURE_ELEVATION_SPELLS (independent toggles)
  - Save compatibility: Existing kingdoms migrate with defaults (elevation = 0)
  - Rollback strategies for each phase (disable flag, revert code, no player impact)
  - Failure scenarios & error codes: ELEVATION_LOOKUP_FAILED, SPELL_LOS_BLOCKED, etc.
  - Concurrency: Transaction-locked combat (SELECT FOR UPDATE), atomic elevation bonus
  - Configuration table: All magic numbers in one place (bands, modifiers, costs)
  - Cache invalidation rules (server restart, world regen, admin reset)
  - Logging events: Band assignments, DAG validation, battle outcomes, flag toggles
  - Performance targets: 5000 kingdoms, 100k+ expeditions, <100ms generation, <1ms lookup
  - Deterministic seeding rules (world_seed + hex_coordinate + turn_number)
  - Migration validation (row counts, JSON validity, indexes, constraints)
  - Phase 3A sequence diagram (ASCII flow showing atomicity, logging, rollback)
  - Out-of-scope features list (naval, scout heroes, shared discoveries, etc. deferred)
  - Release checklist: 40+ verification items (migrations, rollback tests, PvP balance, mobile/desktop)
  
  **Polish Sections (3 integrated):**
  - FBM code skeleton: JavaScript pseudocode using simplex-noise, seeded generation, biome correlation function
  - Data storage strategy: Explicit decision to STORE (not regenerate), with migration logic and fallback for pre-elevation worlds
  - Testing strategy: 40+ concrete test cases (determinism, band correlation, DAG acyclicity, flow conservation, modifier isolation, crash recovery, etc.)
  - Deferred elevation tint layer: Optional visual polish (post-launch) to keep Phase 1 scope tight
  
  **Expert Feedback Integration:**
  - Evaluated 20 suggestions: integrated 17, deferred 2, minor 1
  - Concurred on: server-side generation pipeline, explicit elevation bands, DAG river algorithm, conservative feature-flagged combat, regression testing
  - Architecture: Elevation as shared world primitive (not client-only), deterministic seeding, immutable storage
  
  **Status:** Design-locked, specification complete, implementation-ready. All commits merged to main. Ready for Phase 1 development whenever elevation system begins (post-Beta).
  - Commit 39d1007: Expert feedback integration (architecture, algorithms, scope)
  - Commit 74bf22e: 17 robustness improvements (rollback, error codes, concurrency, logging, release checklist)
  - Commit 8ee9aa2: 3 polish sections (FBM skeleton, storage strategy, test suite)

### 2026-07-03

- **Fog of War Phase 3: Scout Economy Formulas Locked** (PR #761, squash-merged as
  `88590bf8`): Resolved all remaining Phase 3 balance decisions from
  `FOG_OF_WAR_PLAN.md`'s "Still Open" list — fog_of_war debuff (total blind, no tick),
  scout cost (rangers capped at 1,000/action, level improves both reveal radius and
  food efficiency: `reveal_radius = floor(sqrt(effective_power)/12)`,
  `food_cost = 50/level_multiplier` floored at 20), expedition reveal mode (`'ahead'`),
  ranger/expedition allocation (player-assigned, matching the engineer-allocation
  pattern), and node delivery turns (`ceil(distance^1.2)`, increasing cost-per-hex at
  range). Implemented as `game/scout-economy.js` (config + formula functions) and
  `game/ranger-allocation.js` (`validateRangerAllocation`), tested in
  `test/scout-economy.test.js`.
  - Gemini review (high-severity security finding, applied): `validateRangerAllocation`
    had a real exploit — a negative `scouting` value combined with a positive
    `expeditions` value could sum to a total that passed the `total<=totalRangers`
    check while still allocating more rangers than the kingdom has. Fixed with
    integer/non-negative validation before computing the total; also fixed 3
    NaN-propagation gaps across the formula functions (any NaN input would eventually
    reach `applyKingdomUpdates`, which rejects NaN and fails the write).
  - Phase 3 (Scout Loop + Server Gating) is now unblocked and ready to start.

- **Fog of War Phase 3: Initial Implementation Slice** (PR #762, merged `54089e33` 2026-07-03): 
  - Implemented `/scout-area` endpoint (frontier-only reveal, uses locked `scout-economy.js` + `ranger-allocation.js`, visibility updates via `updateKingdomVisibility`).
  - Area scouting also reveals nodes in the hex (explicit `discovered_at` updates for own nodes in revealed hexes + server gating).
  - Initial server-side gating in `/world-map` (filters kingdoms and nodes to only those with positions in `seen_cells`, using `pixelToHex` + bitmap checks).
  - Added `getHexesInRadius` BFS helper in `hex-utils.js` for reveal splash.
  - Gemini review comments (wrap in `db.withTransaction` for atomicity; safe wrappers for bitmap ops to avoid throws on bad coords) fixed in follow-up commit `0c7382c3` (included in merge).
  - Full Claude.md compliance for slice: feature branch, pre-push confirmations + open PR check, lint+smoke+sanity before commits, push to existing PR.

- **Fog of War Phase 3 continuation: trade route gating, expedition ahead reveal, world-map expeditions filter** (PR #764, merged `7e93941d` 2026-07-03): 
  - Gated `/trade-routes/list` and `/trade-routes/establish` to only visible (seen hex) partners/targets.
  - Added ahead reveal for the target node hex on expedition launch, and in `processResourceExpeditionsDb` when outbound status changes.
  - Filtered expeditions in `/world-map` to only those with seen node hex.
  - Addressed Gemini review (missing `race` in queries, try-catch for visibility update) in follow-up commit `3cb86e91` (included in merge).
  - Full Claude.md compliance: feature branch, pre-push checks (branch/commits/PR), lint+smoke+sanity before commits, push to existing PR, addressed review with commit + comment.

- **Fog of War Phase 3: Client Scout UI** (PR #769): Added client-side support and form in ExplorationPanel.jsx for the area hex scout (`POST /api/kingdom/scout-area`). Includes col/row/rangers inputs, Max button, validation (non-negative for coords, cap at 1000 rangers per server limits and Gemini feedback), and handler. Gemini review addressed with input restrictions and caps before merge.

- **Fog of War Phase 3: Validation Matrix Tests** (PR #770): Added comprehensive validation matrix tests in `test/scout-economy.test.js` covering valid frontier reveal, non-frontier rejection, already-seen hex (zero cost), ranger-pool contention with active expeditions, and per-turn budget cap (per FOG_OF_WAR_PLAN.md). Extracted `isFrontier()` helper to production code in `game/hex-utils.js` (so tests validate real code, not duplication). Gemini review (inline logic, false-green tests, redundancy) addressed in follow-up commit before merge. CI green.

- **Fog of War Phase 3: Full Endpoints Gating (diplomacy/etc.)** (PR #771): Gated `/alliance-rankings` (and related) so only visible kingdoms (via seen_cells) contribute to totals. Addressed Gemini performance review by caching coords with `rankingsCache` in follow-up. CI green. Full Claude.md compliance followed.

- **Fog of War Phase 4: Fog Rendering completion** (PR #774): Added explicit reduced-motion support (static styles) and improved fog visuals (solid rgb fills + opacity to fix double-transparency per Gemini; no transitions as SVG static). Gemini addressed once. CI green.

- **Fog of War Phase 4: fog_of_war debuff effect to current visibility** (PR #775, merged `d17e57b7` 2026-07-03): 
  - Wired the `fog_of_war` debuff (enemy-cast, 3-turn, locked total blind radius=0) into visibility: in `game/visibility.js` `getKingdomVisibility` now checks active_effects for `fog_of_war` and overrides `currentCells` to the home-hex initial bitmap (seenCells left untouched). Lazy home-hex seed + cached `getInitialVisibility`; direct `safeJsonParse` (no redundant try-catch).
  - Debuff does not mutate stored data on write; dynamic override on read; no auto-tick/re-apply.
  - The one Gemini review (cache + remove try-catch) addressed in follow-up commit before merge.
  - All CI green (Lint/Test/Build, security checks). PR was MERGEABLE/CLEAN.
  - Full CLAUDE.md compliance followed explicitly: correct feature branch, pre-push branch/commits/open-PR checks, lint+smoke (Windows fresh boot + baselines) + sanity before commits, pushed to open PR, responded to Gemini **ONCE** (fix), self-merged only after exactly one Gemini + green PR; post-merge docs housekeeping started immediately.
  - Completes Phase 4 (see also PR #774 for the SVG fog layer).

- **Fog of War Phase 2: Visibility Persistence** (PR #760, squash-merged as `1727e39f`):
  Kingdom-scoped visibility storage — `seen_cells` authoritative, `current_cells`
  derived, BigInt hex-cell bitmaps serialized as decimal strings in a new
  `kingdoms.visibility` TEXT column (registered in `JSON_REPAIR_SPECS` like every other
  kingdom JSON column). `game/visibility-cells.js` (new): hex-cell ↔ bit-index mapping
  + bitmap encode/decode, unit-tested independent of the DB. `game/visibility.js`
  (new): `getInitialVisibility` (home hex only, the locked initial-visibility
  decision), `getKingdomVisibility` (lazily seeds + persists home-hex visibility on
  first read rather than touching the 3 kingdom-creation call sites in `routes/auth.js`
  and `routes/admin.js` — also uniformly backfilled the ~5,000 pre-Phase-2 kingdoms in
  the local dev DB with no separate migration script), `updateKingdomVisibility`
  (row-locked read-modify-write).
  - **Major finding, fixed within this PR, not deferred:** while verifying
    `updateKingdomVisibility`'s row locking, direct tracing
    (`transactionStorage.getStore()` logged at each step) showed the codebase's manual
    `BEGIN TRANSACTION`/`db.run('COMMIT')` pattern does not reliably propagate
    transaction context — confirmed the store is already `null` by the statement right
    after `BEGIN`, in a single continuous function, no concurrency required. This means
    `FOR UPDATE` row locking provides no actual mutual exclusion anywhere that manual
    pattern is used (`routes/hero.js`, `kingdom-build.js`, `kingdom-economy.js` — all
    pre-existing, untouched by this PR), and every such transaction leaks its
    connection for ~40-50s until the stale-transaction reaper reclaims it.
    `game/visibility.js`'s own `updateKingdomVisibility` was switched to the existing
    (and already correct) `db.withTransaction()` helper instead — verified directly:
    `RUN_DB_PERSISTENCE=1` dropped from ~50s per run to under 1s with zero leaked
    connections, and a genuine concurrent `Promise.all` repro correctly serialized
    with no lost writes. The pre-existing bug in the other 3 route files is
    **not fixed** (out of scope for this PR, different call sites/blast radius) — see
    `TODO.md`'s Known Technical Debt section.
  - Gemini review (high + medium priority, both applied): use `db.withTransaction`
    instead of manual BEGIN/COMMIT (see above); add bounds validation to `cellIndex`
    to fail loudly instead of silently colliding bitmap bits on an out-of-range
    coordinate — caught by this: my own test was using an out-of-range placeholder
    (99, 99), fixed to a valid value.
  - First two PRs (#759, #760) self-merged under the newly-updated `CLAUDE.md` rule
    (self-merge authorized once Gemini review is addressed/refuted and the PR is
    green).

- **Fog of War Phase 1.5: Terrain Biome Randomization (final piece)** (PR #759,
  squash-merged as `049a3c52`): Completed Phase 1.5 by threading the world seed into
  client-side terrain generation. `GET /world-map` (`routes/kingdom-gameplay.js`) now
  includes `worldSeed` in its response (both query paths, serialized as a string since
  JSON can't carry BigInt); `WorldmapPanel.jsx` threads it through `loadWorldMap` state
  into `renderWorldMap`'s options; `WorldmapRenderer.jsx`'s `hexSeededRandom` takes an
  additional seed parameter folded into its integer mix (default 0, backward compatible),
  with a new `seedToInt32()` helper parsing the incoming seed independently from the
  server's identical-purpose helper (this file is a browser-only bundle). Deliberately
  left `oceanBandForColumn` (the tundra/ocean strait's shape) unseeded — Phase 1.5's
  scope was biome *distribution*, not climate band *geometry*.
  - Live-verified in browser, not just code-reviewed: extracted all 263 hex fill colors
    from the rendered SVG at one world seed, changed `world_state.seed` directly in the
    DB, restarted the server (seed loads at boot, not live), reloaded, and re-extracted
    fills — **82/263 (31%) differed** between the two seeds, confirming the
    randomization actually changes what renders.
  - Gemini review: no feedback ("no review comments to address").
  - Self-merged per the updated `CLAUDE.md` rule (self-merge authorized once Gemini
    review is addressed/refuted and the PR is green) — the first PR merged under that
    rule.

- **Fog of War Phase 1.5: Seeded World Randomization (kingdom/node placement)** (PR #758,
  squash-merged as `c6c23c88`): Replaced the fully-deterministic `REGION_SEEDS` kingdom/node placement
  (confirmed by Phase 1's validation to misalign 53% of kingdoms and spawn 6/5,000 in
  water) with rejection-sampling placement seeded by a new per-world `world_state.seed`
  (`db/schema.js`) — stable within a world, different across resets. Extracted
  `RACE_HOMES`/`nearestRaceHome`/water-band logic into `game/world-regions.js` (was
  duplicated between the renderer and the Phase 1 validation script). Added
  `game/world-seed.js`, an in-memory seed cache loaded once at boot (kept
  `getKingdomMapCoords`/`placeResourceNodeCoords` synchronous — no `.map()` →
  `Promise.all()` rewrite needed on the `/world-map` hot path). `scripts/admin-wipe-
  players.js` regenerates the seed on wipe (picked up on the next restart, matching how
  this alpha resets).
  - **Result on the local dev DB's 5,000 kingdoms: 100% region-aligned, 0% water spawns**
    (was 47%/99.88%).
  - Two bugs found and fixed via direct verification, not assumption: (1) validating a
    candidate point as a float then returning `Math.round()` of it could shift it across
    a hex boundary by up to half a pixel, silently invalidating the just-passed check —
    caught by comparing the validation script's hex-cell-based alignment check against
    the placement function's own (initially raw-point-based) check and finding
    disagreement for `human` kingdoms near the `dire_wolf`/`vampire` region boundary; (2)
    `db/schema.js`'s `initDb()` already calls `backfillResourceNodeMapCoords()`
    internally, which now needs the world seed — but that runs before `initDb()` returns
    to `index.js`, where the seed load was originally planned, which would have crashed
    boot the first time a fresh DB had a resource node needing backfill. Verified by
    forcing the exact scenario (inserted a node with `NULL` coords, re-ran `initDb()`
    standalone) before and after the fix.
  - Gemini review (medium): `loadWorldSeed()` silently fell back to a fixed seed if the
    `world_state` row was missing, with no way to notice; added a `console.warn()` on
    that path, verified directly by mocking the missing-row case.
  - Terrain biome randomization (the remaining Phase 1.5 item at the time) completed
    separately in PR #759, above.

- **Fog of War Phase 1: Hex Foundation** (PR #757, squash-merged as `c3c44ceb`): Added
  `game/hex-utils.js`, a shared hex-grid math module built from the Red Blob Games hex
  guide (primary reference), matching the odd-r offset pointy-top tessellation already
  rendered by `WorldmapRenderer.jsx` exactly — `hexCenter`, `hexCorners`,
  `hexNeighborKeys`, plus the previously-missing reverse direction `pixelToHex`
  (fractional axial → cube rounding), `isPixelInHex`, and `hexUnitDistance` (the
  scouting/expedition balance metric — the game world itself stays continuous x,y;
  hexes are visual/measurement overlay only). Full unit test coverage in
  `test/hex-utils.test.js` (round-trip, boundary cases, neighbor symmetry, distance,
  frontier detection).
  - Added `scripts/validate-kingdom-hex-placement.js`, a read-only validation script
    run against the local dev DB's 5,000 kingdoms. **Confirmed concrete findings**:
    only 47% of kingdoms land in a hex region matching their own race (systemic
    misalignment concentrated in `human` kingdoms, whose region seeds sit close
    enough to `dire_wolf`'s `RACE_HOMES` point that the Voronoi assignment
    misclassifies them — not a rare edge case), and 6/5,000 kingdoms (including
    kingdom #1 "Stolice") spawn in ocean/tundra hexes. Both findings confirm
    Phase 1.5 (randomize world generation, region-seed realignment, water-spawn
    prohibition) is required work, documented in `FOG_OF_WAR_PLAN.md`.
  - Two medium-priority findings from automated Gemini review applied before merge:
    normalized a `-0` edge case in `pixelToHex`'s cube-rounding output (Node's
    `assert.strictEqual` uses `Object.is`, which distinguishes `-0` from `0`), and
    replaced a per-call `Object.entries().forEach()` allocation in the validation
    script's `nearestRaceHome` with a precomputed array + plain loop (runs 5,000
    times per validation pass).

### 2026-07-02

- **World Map Terrain System, Phase 1 + 2** (PR #751, squash-merged as `79a5ae72`): Added
  a terrain type system (`game/terrain.js`: `TERRAIN_TYPES`, `TERRAIN_DATA` modifiers,
  `RACE_TO_TERRAIN` bootstrap mapping), a `terrain` column on `resource_nodes` with
  idempotent backfill, terrain fields on `/world-map` and `/scout-node` responses, and a
  toggleable terrain visual layer on the world map (solid biome fills, GSAP entrance
  animation, hover tooltip). Phase 2 wired the first mechanic — expedition travel time and
  loot yield both respond to the destination node's terrain via `getTerrainModifiers()`.
  Coordinated across three parallel work lanes (Grok/Claude/Codex) using `MAP_TERRAIN.md`
  as an append-only handshake log; that file and `LANE_DIRECTIONS.md` document the full
  process, including a caught-and-corrected instance of an unverified "500-turn validation
  complete" claim whose cited artifact files didn't actually match the claim.
  - Found and fixed a real, independently-verified pre-existing bug while stabilizing the
    turn path for validation: `resolveExpeditions()` in `game/engine.js` built a dynamic
    `UPDATE kingdoms SET ...` that mapped every column to the literal placeholder `$1`
    instead of incrementing, and reused `$1` for the `WHERE id` clause too. Whenever 2+
    differently-typed columns needed updating in the same call (e.g. numeric `gold` +
    JSON `troop_levels`), Postgres couldn't resolve a single type for `$1` and threw,
    aborting the transaction and cascading into a `/kingdom/turn` 500 on any subsequent
    query in that request. Fixed using the existing `pgSetClauseWithNextPlaceholder`
    helper (already the correct pattern elsewhere in the codebase).
  - Gemini review caught the terrain visual layer being effectively invisible in practice:
    the regions layer's opaque landmass fill (0.85 opacity, identical geometry) rendered
    on top of it. Fixed by dropping that fill-opacity to 0.5 when the terrain layer is
    enabled, rather than reordering layers (which would have buried region borders/labels
    under terrain, contrary to the Phase 1 spec). Also fixed an inefficient unconditional
    backfill query and a missing color fallback for unmapped terrain types.
  - Validation: lint 0 errors and fresh Windows PostgreSQL smoke on every commit; two
    independently-verified real Codex 500-turn runs (baseline vs. terrain-labeled) whose
    reported expedition travel times matched the implemented formula to the exact second.

- **World Map Terrain System, Phase 3** (solo on main after 79a5ae72): Wired combat terrain modifiers (`combatDef` for defender power multiplier, `combatAtk` for attacker) from `TERRAIN_DATA` into `calculateCombatPower` in `combat-resolver.js`. Battle reports now record `attackerTerrain`/`defenderTerrain` and the applied mods. Added terrain flavor note to `formatCombatV2NewsBlurb` in combat-news. Modifiers now affect all combat types (military/covert/magic).
  - Verified in monolith: no prior wiring; now power adjusted post-calc, reports updated.
  - MD updated to mark Phase 3 complete.
  - No new PR (post 1+2 merge); committed directly as part of solo finish.

### 2026-07-01

- Cleared the active `TODO.md` deferred work backlog in one pass (PRs #737–#742). Several
  Known Technical Debt (Post-Beta) items remain open — admin inline CSS consolidation
  (partially addressed, see PR #741), component test coverage expansion, and the dead
  route handlers found in PR #738.
- **Query performance verification** (PR #737): re-ran the 2026-06-29 analysis empirically
  against a stress-seeded local database; all `/turn` and `/expedition` hot-path queries
  already resolve via index scans in sub-millisecond time. Added `idx_heroes_kingdom_status`
  and dropped the now-redundant `idx_heroes_kingdom` (Gemini review).
- **API documentation restore** (PR #738): `docs/API_ENDPOINTS.md` had been accidentally
  deleted in the 2026-06-30 markdown cleanup; restored and refreshed against actual routes,
  including the previously-undocumented `kingdom-build.js` router and the full
  `kingdom-economy.js`/`admin.js` surfaces. Documented (but did not fix) 17 dead route
  handlers caused by router mount-order shadowing.
- **Component test coverage** (PR #739): added `HappinessWidget.test.jsx` and
  `BountiesPanel.test.jsx`. Found and fixed a real state-mutation bug in
  `GoalsPanel.jsx`'s `claimGoal()` — a shallow `{ ...goalsData }` copy followed by a
  direct nested mutation (`goal.claimed = true`) that also silently corrupted the test
  file's shared mock fixture across test runs.
- **Happiness/rebellion logic dedup** (PR #740): `game/happiness.js` had dead local copies
  of `happinessMult`/`happinessCombatMult`/`rebellionCheck`/`rebellionEvent` never actually
  used by `engine.js` (which imports the real ones from `combat-helpers.js`/
  `special-events.js`); converted to re-exports. Deleted `game/rebellion.js`, a third,
  fully-orphaned duplicate of the same rebellion logic.
- **Admin inline CSS consolidation** (PR #741): converted 59 static inline styles to
  Tailwind in `EvolutionPanel.jsx`/`ManagePanel.jsx`, scoped to zero-dynamic-value cases
  only. Caught and fixed a real visual regression flagged by Gemini review — this
  project's `tailwind.config.js` overrides `text-xs` to `9px` (not the Tailwind default
  `12px`), so `fontSize: 12` had been incorrectly mapped to `text-xs` in 8 places; fixed
  to `text-[12px]`.
- **Advanced rebellion events** (PR #742): added a 6th rebellion event type, Treasury
  Looting (5-15% gold loss). Gemini review caught a critical, pre-existing bug this
  surfaced: `processTurn()` in `engine.js` unconditionally overwrote `updates.gold` and
  `updates.population` right after `rebellionCheck` ran, silently discarding rebellion
  effects on both — meaning the original Unrest event's population loss had likely never
  worked in production. Fixed both overwrite sites and added an integration-level
  regression test proving the fix (and that it fails without it).
- Validation across all six PRs: `npm run lint` clean, full test suite passing (55 files),
  fresh PostgreSQL smoke boot with all baseline checks, on every PR before merge.

- World map Sprint 1 — resource nodes on map (PR #732, merge `88e68c63`).
- Added `resource_nodes.map_x/map_y` with boot backfill; `/api/kingdom/world-map` returns nodes and expeditions.
- Scout-node assigns coordinates; `WorldmapRenderer` plots nodes, expedition lanes, and layer toggles.
- GSAP entrance/layer animations, pan/zoom viewport, empty-state scout hint when no nodes discovered.
- Validation completed:
  - `npm run lint` passed
  - `npm test` passed (53 files, including `world-map-coords.test.js`)
  - fresh PostgreSQL smoke boot passed
  - GitHub CI green on PR #732

- Completed the roadmap validation lane and retired `ROADMAP.md`.
- Verified live Railway production secrets exist, production boot succeeds, and no secret-startup block remains.
- Verified live domain enforcement:
  - `http://narmirreborn.com` redirects to `https://narmirreborn.com`
  - HTTPS responds successfully
  - HSTS is present
- Completed authenticated load-test validation on local PostgreSQL with a real 5,000-player pool:
  - added `scripts/setup-load-test-accounts.js`
  - corrected Artillery endpoints to `/api/kingdom/turn`, `/api/kingdom/expedition/list`, and `/api/kingdom/rankings`
  - completed full rerun (`roadmap-load-test-report.json`) and focused follow-up sample (`roadmap-load-test-sample-report.json`)
  - documented the current result in `LOAD_TEST_REPORT.md`: local single-node saturation is the limiting factor; expedition list degrades earlier than turn processing under pressure
- Completed restore verification against a real local backup artifact:
  - added `scripts/verify-backup-restore.js`
  - restored into an isolated scratch schema because the local app role cannot create databases
  - matched counts exactly for `players`, `kingdoms`, `expeditions`, and `resource_expeditions`
- Completed header-auth CSRF cleanup:
  - bearer-token requests now bypass cookie-CSRF enforcement only when no auth cookie is present
  - added `test/middleware-csrf.test.js`
- Completed `StudiesPanel` cleanup: removed duplicate mutation subscription, collapsed school-form state, rendered tabs from config, and added focused Vitest coverage.
- Continued static inline-style consolidation in `EconomyPanel` commodity/trade sections using shared Tailwind class constants while keeping dynamic color logic inline.
- Reduced additional static inline styling in studies-tab helpers and `MarketPanel`, leaving only runtime width/color/display cases inline in those touched areas.
- Validation completed:
  - `npm run lint` passed
  - `npm test -- --runInBand` passed
  - `node test/middleware-csrf.test.js` passed
  - `npx vitest run client/src/components/react/__tests__/StudiesPanel.test.jsx` passed
  - `npx vitest run client/src/components/react/__tests__/ResearchFocusSection.test.jsx client/src/components/react/__tests__/StudiesPanel.test.jsx` passed

- Retired the SQLite-to-PostgreSQL SQL compatibility layer (Phases A–D, PR #730, merge `7d820dff`).
- **Phase A:** PG-native runtime SQL fragments (`lib/db-sql.js`); runtime queries use `LEAST`/`GREATEST`, native epoch expressions.
- **Phase B:** Dropped PRAGMA emulation; schema introspection via `information_schema` (`lib/db-schema-introspection.js`).
- **Phase C:** PG-native boot DDL in `db/schema.js` (`SERIAL`, `TIMESTAMP`, `EXTRACT(EPOCH...)`, `ON CONFLICT DO NOTHING`).
- **Phase D:** Repo-wide `$1, $2, ...` placeholders; removed `translateSqlForPg`; added `lib/pg-placeholders.js` for dynamic IN/SET/tuple builders.
- Post-merge fixes: multi-row news `pgValueTuples()` (admin announce, gameplay/research bulk insert); Gemini review (pg-mem epoch regex, Gravatar URL, forum-seed `$1`/`$2`).
- Validation completed:
  - `npm test` passed (51 files, including phase A–D and bulk-news regression tests)
  - `npm run lint` passed
  - fresh PostgreSQL smoke boot passed
  - GitHub CI green on PR #730

### 2026-06-30

- Cleared repo-side beta-prep backlog and collapsed active tracking into `ROADMAP.md`.
- Wired Sentry runtime capture for Express errors, browser error intake, slow endpoints, and crash reporting.
- Hardened production secret validation for `JWT_SECRET`, `ADMIN_SECRET`, and `CORS_ORIGIN`.
- Completed audit scheduler wiring: admin schedule routes, manual runs, history feed, and next-run tracking.
- Verified app-side HTTPS redirect, HSTS, trust-proxy handling, and secure production cookies in code.
- Validation completed:
  - `eslint` passed for touched files
  - route/module smoke load passed
  - `npm test` passed
  - `npm run build` passed

### 2026-06-29

- SQL injection audit completed and route/query handling tightened.
- Backup and restore verification completed.
- API rate limiting configuration completed.
- User-facing documentation refreshed and shortened.
- Support runbook completed.
- API documentation refreshed and shortened.
- Query performance analysis completed.
- Load-test harness/tooling hardened for authenticated reruns.

### 2026-06-28

- Alpha phase declared complete.
- Admin hard cutover verified.
- Tailwind consolidation completed.
- Combat system documentation and validation consolidated.

---

## Chronological Summary

### Phase: Alpha Completion (2026-06-28)

**Status:** ✅ COMPLETE

All major development tracks finished. Platform ready for beta launch.

---

## Track A: Vernacular & Naming (P0)

**Status:** ✅ COMPLETE (fix/topbar-take-turn)  
**Completion date:** 2026-Q2  
**PR:** Multiple

### Completed Items
- ✅ Bottom nav "War" → "Offense"
- ✅ Bottom nav "Economy" → "Wherewithal"
- ✅ Admin tab "Configs" → "Config"
- ✅ Alliance UI plural copy → singular panel titles

### Files Modified
- BottomNav.jsx
- AdminTabNav.jsx
- AlliancesPanel.jsx + related

### Verification
- ✅ Lint + smoke pass
- ✅ Hash routes unchanged (`#warfare`, `#economy`, `#alliances`)
- ✅ Mobile + desktop visual check passed

---

## Track B: API Route Normalization (P1)

**Status:** ✅ COMPLETE (fix/admin-api-kebab, fix/admin-api-clients)  
**Completion date:** 2026-Q2  
**PR:** Multiple

### Completed Items
- ✅ Server canonical routes (kebab-case: `/api/admin/bug-reports`, `/api/admin/admin-notes`, etc.)
- ✅ Legacy aliases preserved with optional `Deprecation` header
- ✅ React admin clients (`EvolutionPanel`, `LorePanel`) using canonical paths

### Pattern Established
- `dualRoute(router, { canonical, legacy, handler })`
- Deprecation headers for backwards compatibility

### Notes
- Legacy aliases scheduled for removal in beta (post-alpha)

---

## Track C: Portal — React + Tailwind (P2)

**Status:** ✅ COMPLETE (feat/portal-tailwind-foundation, feat/portal-tailwind-forum, PR #603)  
**Completion date:** 2026-Q2  
**PR:** #603

### Phase C1: Foundation
- ✅ Import `tailwind.css`
- ✅ Reuse `.card`, `.base-btn`, theme tokens
- ✅ Establish component patterns

### Phase C2: Forum & Cards
- ✅ Forum + race cards migrated to Tailwind
- ✅ Patterns extracted to `@layer components`
- ✅ Categorized forum index (Community, Warfare, Alliances, Roleplaying)
- ✅ 4 boards per category
- ✅ Avatar/badge system
- ✅ In-game panel integration

### Phase C3: CSS Consolidation
- ✅ Added 223 lines of `@layer components` to tailwind.css
- ✅ Registration form, cards, tables, buttons, forms
- ✅ Kept ALL original CSS class definitions (no aggressive deletion)
- ✅ `@layer components` as foundation for incremental Tailwind adoption

### Verification
- ✅ Lint + smoke pass
- ✅ No style regressions
- ✅ Visual parity maintained

---

## Track D: Admin Tailwind Migration & Hard Cutover (P3)

**Status:** ✅ COMPLETE (PR #602)  
**Completion date:** 2026-Q2  
**PR:** #602

### Phase Ph0: Foundation
- ✅ React shell + auth gate + legacy fallback
- ✅ Merged PR #580

### Phase Ph1: Shell
- ✅ Shell, stats, 12 empty tabs
- ✅ Merged PR #581

### Phase Ph2: Kingdoms
- ✅ Kingdom table + editor + AI presets
- ✅ Merged PR #582–585

### Phase Ph3: Management
- ✅ Announcements, moderation, bulk actions
- ✅ Merged PR #586

### Phase Ph4: Content
- ✅ Events, Lore, Goals, Evolution panels
- ✅ Merged PR #587

### Phase Ph5: Config & Security
- ✅ Config, Sounds, Fragments, Prestige, Security
- ✅ Merged PR #588

### Phase Ph6a: Soft Cutover
- ✅ React default, legacy fallback at `?legacy=1`
- ✅ Merged PR #589

### Phase Ph6b: Hard Cutover
- ✅ React admin default, legacy `admin.html` archived to `/legacy/`
- ✅ No `?legacy=1` fallback
- ✅ Merged PR #602
- ✅ Verified all 12 checklist items (2026-06-28)

### Verification Matrix (Ph6b)

**Completion date:** 2026-06-28  
**Method:** Fresh PostgreSQL boot + API endpoint testing + server verification  
**All 17 items passed ✅**

#### Functional Verification (16 items)
- ✅ Manage — announcements, player promotion, chat/mods/bans
- ✅ Kingdoms — edit kingdom fields (name, level, gold), apply AI presets
- ✅ Events — load log with filters, open create form
- ✅ Config — load all keys, expandable sections, edit overrides
- ✅ Sounds — list sounds category without errors
- ✅ Prestige — static reference table renders
- ✅ Lore — load list, add entries via modal
- ✅ Evolution — wishlist + changelog + admin notes (3 tabs)
- ✅ Detailed Lists — Fragments + Spells tabs load data
- ✅ Goals — load grid, CRUD operations (add/edit/delete)
- ✅ Security — run audit, CSRF token sent, findings table displays
- ✅ Auth — logout + re-login, session restored
- ✅ CSRF — all mutating routes protected
- ✅ Portal — integration functional
- ✅ Game entry — page loads
- ✅ Forum API — responds with categorized boards

#### Hard Cutover Completion (1 item)
- ✅ Legacy admin archived — `public/admin.html` → `public/legacy/admin.html`
- ✅ No `?legacy=1` fallback (removed per hard cutover)
- ✅ React admin is sole interface at `/admin`

#### Known Risks (Mitigated)
- ✅ Browser cache — clear cache + hard reload (Ctrl+Shift+R)
- ✅ Stale admin token — logout + re-login per session
- ✅ API CSRF failures — adminFetch includes CSRF header
- ✅ Mobile responsiveness — tested at 360px width

---

## Track E: Platform Health (P0–P1)

**Status:** ✅ COMPLETE  
**Completion date:** 2026-Q2

### E1: ESLint Enforcement
- ✅ Pre-commit hook enforces `npm run lint` → 0 errors required
- ✅ `@eslint/js` resolved; flat-config working
- ✅ Merged PR #651

### E2: CI Lint + Test Job
- ✅ `.github/workflows/ci.yml` active
- ✅ `npm ci`
- ✅ `npm run lint` (0 errors)
- ✅ `npm test` (45+ game logic tests)
- ✅ `npm run build`
- ✅ Merged ci/lint-test-build

### E3: Dependency Vulnerabilities (Mitigated)
- ✅ vite 8.0.12 → 8.1.0 (server FS bypass + NTLM leak)
- ✅ multer 2.1.1 → 2.2.0 (DoS, 2 HIGH)
- ✅ ws 8.x → 8.21.0 (memory exhaustion DoS)
- ✅ undici via npm override (discord.js dependency; HIGH vulns mitigated)
- ✅ Merged dependency audit PR

### E4: Admin CSRF Protection
- ✅ All mutating routes protected with `requireCsrfToken`
- ✅ Merged fix/admin-csrf

### E5: MAINTENANCE.md Refresh (M1)
- ✅ Comprehensive system health audit
- ✅ Merged PR #654

---

## Track F: Architecture Debt (P4, post-cutover)

**Status:** ✅ COMPLETE  
**Completion date:** 2026-Q2

### F1: Express Error Handler & Silent Catch Audit
- ✅ Global error handler verified (already in place)
- ✅ 554 catch blocks audited; most intentional
- ✅ Logging added to `game/goals.js` JSON parsing
- ✅ No critical silent error swallowing
- ✅ Merged PR #610

### F2: Combat Complete & Alpha-Ready
- ✅ Individual troop HP/DMG/injury system
- ✅ Critical hit + kill tracking
- ✅ Equipment capture/loss/recovery mechanics
- ✅ Thief sabotage, Cleric rescue, Engineer ladder walls
- ✅ Structure defense budgets
- ✅ War machine crew requirements (race-dependent)
- ✅ Wall HP persistence + damage tracking
- ✅ 26.8M simulated combats; balanced 48–52% outcomes
- ✅ Feature-flagged `USE_COMBAT_V2=1`
- ✅ Merged PR #612

#### Combat V2 Model Design (Reference)

**Core Mechanics:**
- HP = Base HP × racial modifier + armor research × coverage + (troop level × scale)
- DMG = Base DMG × racial modifier + (weapon research × coverage × 0.1) + (troop level × scale)
- Injury states: healthy (75-100%), lightly_injured (50-74%), moderately_injured (25-49%), heavily_injured (1-24%), dead (0%)
- Critical hits: Per-unit independent roll; multiplies damage on successful hit
- Damage resolution: Individual in-memory hits (no overkill spillover)

**Unit Roles & Base Stats:**
- **Fighters** (HP: 250, DMG: 25): Front-line, high HP/DMG
- **Rangers** (HP: 100, DMG: 15): Mid-line, medium pressure
- **Mages** (HP: 25, DMG: 30): High DMG, low HP
- **Clerics** (HP: 150, DMG: 15): Support/healing/death prevention
- **Ninjas** (HP: 50, DMG: 10): Backline assassination
- **Thieves** (HP: 75, DMG: 15): War machine sabotage
- **Engineers** (HP: 100, DMG: 0): Crew requirements, ladder specialists (level 25 perk)
- **War machines** (HP: 500, DMG: 40): Heavy siege, crew-dependent DMG

**Wall/Structure HP:**
- Fortified: 100 HP; Keep: 500 HP; Citadel: 1000 HP
- Ladder hit chance: engineer_level × 0.5% (max 2% wall HP damage per hit)

**Equipment System:**
- Captured equipment tracked per troop type and quality
- Injured troops retain gear; dead troops lose it
- Equipment quality preserved from source
- Legacy kingdoms derive quality: res_weapons/10, res_armor/10

**Required Diagnostics (Battle Report):**
- HP/DMG budgets by type (attacker/defender)
- Healthy/injured/dead troop counts before/after
- Cleric rescues and healing applied
- War machines: owned, crewed, inactive, effective DMG
- Engineers: available count, effective level
- Ladders: sent, active, successful hits, wall damage
- Wall HP before/after
- Structure/race modifiers applied
- Research values used (HP/DMG sources)
- Win chance inputs

**Battle Flow:**
1. Load troops, injured pools, research, levels, race modifiers, structures
2. Calculate HP/DMG budgets by type
3. Apply crew requirements to war machines
4. Apply target focus and line-distance modifiers
5. Resolve wall/structure interaction
6. Apply damage to individual HP pools
7. Apply cleric death prevention/healing
8. Apply special mechanics (ninjas, thieves, ladders, wall damage)
9. Persist changes (healthy count, injured JSON, wall HP)
10. Return report compatible with engine-level contract

**Files:** game/combat-new.js, game/combat-resolver.js, game/lib/combat-wrappers.js
**Feature Flag:** USE_COMBAT_V2=1
**Test Coverage:** 26.8M simulated combats; balanced 48–52% outcomes
**See:** PROTECTED_WORK.md (critical protected system)

### F3: Module Consolidation & Architecture
- ✅ Phase 1: data-transformations extraction (PR #606)
- ✅ Phase 2: timestamp consolidation (PR #607)
- ✅ Phase 3: architecture documentation + mobile hardening (PR #608)
- ✅ Merged PRs #606–608

### F4: Engine.js Decomposition (6,242 lines → 8 modules)
- ✅ achievements.js
- ✅ combat-helpers.js
- ✅ happiness-logging.js
- ✅ expeditions.js
- ✅ special-events.js
- ✅ combat-wrappers.js
- ✅ building-research.js
- ✅ gameplay.js
- ✅ Merged PR #611

#### Detailed Decomposition Strategy (Reference)

**Strategic Goals:** Extract ~38 remaining functions from engine.js (6,041 lines) into focused, testable modules; reduce orchestrator size to ~50 lines (from ~1,362).

**Extraction Phases (Completed):**

**Phase 1: Low-Risk Pure Functions**
- Achievements & Scoring: `checkAchievements()`, `calculateScore()` → game/lib/achievements.js (~215 lines)
- Combat Formatting Helpers: `normalizeCombatUnits()`, `formatCombatUnitCounts()`, `formatCombatBuildingsLost()`, `formatCombatV2NewsBlurb()`, `happinessMult()`, `happinessCombatMult()`, `sumRecordValues()` → game/lib/combat-helpers.js (~100 lines)

**Phase 2: Medium-Risk Async/State Functions**
- Happiness & Event Logging: `recordHappinessHistory()`, `logHappinessEvent()` → game/lib/happiness-logging.js (~70 lines)
- Expeditions & Locations: `resolveExpeditions()`, `processLocationMapsWip()`, `computeExpeditionTransitions()`, `expeditionRewards()` → game/lib/expeditions.js (~510 lines)
- Prestige & Special Events: `processPrestige()`, `canPrestige()`, `rebellionCheck()`, `rebellionEvent()`, `resolveAllianceDefense()`, `raidTradeRoute()` → game/lib/special-events.js (~185 lines)
- Combat Wrappers: `resolveMilitaryAttackV2Adapter()`, `resolveMilitaryAttack()` → game/lib/combat-wrappers.js (~1,260 lines)

**Phase 3: Large Orchestrators**
- Building & Research: `processBuildQueue()`, `studyDiscipline()`, `queueBuildings()`, `_selectSchool()`, `forgeTools()` → game/lib/building.js (~750 lines)
- Miscellaneous Gameplay: `processMercenaries()`, `hireMercenaries()`, `hireUnits()`, `purchaseUpgrade()`, `processActiveEffects()`, `demolishBuilding()`, `junkPrize()`, `wmCrewRequired()`, `resolveRegions()` → game/lib/gameplay.js (~400 lines)

**Phase 4: Final Integration**
- processTurn() refactored: Orchestrator calling extracted modules (coordinator pattern: ~50 lines)
- engine.js re-exports all functions (API unchanged)

**Pattern Applied:** Identify → Extract to focused module → Import in engine.js → Verify lint/smoke/sanity → Commit

**Risk Mitigation:** Each commit is a checkpoint; per-phase testing; rollback capability preserved

**Verification:** Lint 0 errors; smoke test fresh boot; sanity check unchanged behavior; all 4 baseline checks pass

### F5: GameStateManager → Zustand Migration
- ✅ All 16/16 components migrated
- ✅ profileStore, economyStore, populationStore, militaryStore, researchStore
- ✅ Selectors pattern; no stale closures
- ✅ Complete

#### Store Architecture (Reference)

**Domain-Based Store Split (Phase 1):**
- `economyStore.js` — gold, food, mana, tax, trade routes, market prices; actions: receiveTurnUpdate, completeBuild, receiveTrade
- `militaryStore.js` — troops, armies, combat, wall HP, injured troops; actions: applyCombatResult, injureTroops, damageWalls
- `researchStore.js` — research progress, disciplines, mana allocation; actions: completeResearch, spendMana
- `populationStore.js` — population, happiness, growth; actions: updatePopulation, updateHappiness
- `uiStore.js` — panel state, visibility, active tabs, modals; actions: setActivePanel, toggleModal, setPanelState (with Immer for nested updates)

**Middleware Stack (Critical Order):**
1. Immer first (enables clean nested mutations without spread chains)
2. DevTools second (Redux DevTools integration for debugging)
3. Persist last (localStorage for UI state only)

**Key Patterns:**
- **Game Events as Actions:** `receiveTurnUpdate()`, `applyCombatResult()`, not field setters like `setGold()`
- **Server vs Client State:** Authoritative (gold, mana, troops) updated via `receiveServerSnapshot()`; client-owned (UI, optimistic state) managed locally
- **Selectors with Fine-Grained Optimization:** Components re-render only on relevant state changes; `useShallow()` for object selectors
- **Entity Normalization:** Collections stored as `{byId: {...}, allIds: [...]}` for O(1) updates
- **Inter-Store Communication:** Use `getState()` in actions for immediate access to other stores; batch updates to prevent re-render cascades
- **Persistence Selective:** Only UI state (panel visibility, sort order) persists via localStorage; kingdom state always from server

**Socket.io Integration:** Events dispatch domain actions directly to stores; batching middleware prevents update cascades

**Testing Strategy:** Unit tests for actions; integration tests for socket.io → store flow; React DevTools Profiler verification of selector optimization

### F6: Frontend Component Tests (Vitest + RTL)
- ✅ Component test infrastructure in place
- ✅ 57 tests implemented (panelMeta, BottomNav)
- ✅ Complete

### F7: Numeric Range Validation
- ✅ Phase 1: Validators built (PR #643)
- ✅ Phase 2: Endpoint integration (PR #644)
- ✅ Phase 3: Allocation endpoint protection (PR #645)
- ✅ Prevents balance exploits
- ✅ Merged PRs #643–645

### F8: Kingdom.js Split (Incremental Refactor)
- ✅ Phase 1: BUILD module extraction (PR #646)
- ✅ Phase 2: WARFARE module extraction + Gemini review fixes (PR #647)
- ✅ Phase 2b: Concurrency fix (PR #649)
- ✅ Phase 3: Profile/rankings extraction (PR #650)
- ✅ Phase 4: Economy module extraction
- ✅ Phase 5: Research module extraction
- ✅ Phase 6.1: Profile/rankings extraction
- ✅ Phase 6.2: Exploration/expeditions extraction
- ✅ Phase 6.3: Gameplay core extraction
- ✅ Complete (7 focused modules + kingdom-economy bridge)

### Architecture Audit (2026-06-27)

**Status:** Complete  
**Scope:** Vanilla JS removal, Tailwind purity, Zustand migration, legacy admin cleanup, monolith avoidance

#### Current State Assessment
- ✅ Tailwind is dominant React styling path (not only, but primary)
- ✅ Zustand established with domain stores (economyStore, militaryStore, researchStore, populationStore, uiStore)
- ✅ GameStateManager still active (cleanup in progress)
- ✅ Legacy admin archived in docs (`public/legacy/admin.html`); fallback routes removed (hard cutover Ph6b)
- ✅ Large coordination files refactored (engine.js → 8 modules; kingdom.js → 7 modules)

#### Main Gaps (Pre-Closure)
- ❌ GameStateManager consumers still exist (bridges: useGameState.js, usePanelState.js, useGameActions.js)
- ❌ Vanilla JS styling still present in some components (static inline styles)
- ❌ Component test coverage incomplete (57 tests; gaps remain)

#### Cleanup Roadmap (Post-Alpha)
1. **Zustand Completion:** Remove GameStateManager and all bridge hooks after all panels fully migrate
2. **Tailwind Purity:** Enforce Tailwind-only defaults for static styling; flag new vanilla CSS
3. **Legacy Admin Removal:** Confirm ph6b hard cutover stable; delete legacy fallback routes from index.js
4. **Monolith Prevention:** Guardrails in place; decomposition pattern established (modular design)

#### Cleanup Order (Priority)
1. Finish Zustand cutover (remove GameStateManager consumers)
2. Remove `GameStateManager.js` after all imports gone
3. Enforce Tailwind-only defaults for static styling
4. Remove legacy admin compatibility routes from index.js
5. Add guardrails to prevent new monoliths

#### Red Flags (Prevention)
- ✅ New GameStateManager imports → prevented via review
- ✅ New hooks reading state from singletons → prevented via review
- ✅ New static inline styles → flagged for Tailwind conversion
- ✅ New one-off CSS files → prevented via review
- ✅ New admin fallback flags → prevented via hard cutover
- ✅ Large patches mixing index.js and game logic → prevented via modular design

#### Success Criteria
- ✅ All panels use Zustand stores (no GameStateManager fallback)
- ✅ Tailwind dominant for static properties; inline styles only for dynamic values
- ✅ No legacy admin fallback routes (hard cutover verified)
- ✅ Modular architecture enforced (no new monoliths)
- ✅ Component test coverage expanding
- ✅ Documentation updated for maintainability

---

## Features: Completed Implementations

### Happiness System (✅ IMPLEMENTED)

**Status:** Complete and verified  
**Completion date:** 2026-Q2  
**Integration:** Game logic + spell system + world fragments

#### Components
- ✅ Happiness calculation engine (food, entertainment, safety, prosperity, race modifiers)
- ✅ Population growth scaling based on happiness thresholds
- ✅ Production efficiency multiplier (affected by happiness)
- ✅ Rebellion event system (triggered by low happiness)
- ✅ Entertainment research mechanic (drives recovery speed)
- ✅ Combat happiness multiplier tied to happiness
- ✅ Spell integrations (Bless, Divine Favor, etc.)
- ✅ World fragment bonuses for happiness
- ✅ Database schema (kingdoms.happiness column)

#### Notes
- UI happiness breakdown deferred (not blocking alpha)
- Historical tracking deferred (enhancement)
- Potential code quality cleanup identified (deferred to post-alpha)

---

### Mobile UI Refinements (✅ COMPLETE)

**Status:** Complete  
**Completion date:** 2026-Q2  
**PR:** #596–598

#### Completed Items
- ✅ Nav bar sticky + visible on forums
- ✅ Take Turn button hidden on forums
- ✅ News panel line break between turn groups
- ✅ Build panel right-justified inputs, aligned headers, tightened layout (3 iterations)
- ✅ Exploration diminishing returns note on toast (not button)
- ✅ Resources panel guide starts collapsed
- ✅ Hire panel building caps in one row
- ✅ Kingdom header XP/level inline with score; local time/vampire/season on row below

#### Verification
- ✅ No horizontal scroll at 360px width
- ✅ Mobile + desktop responsive

---

### Tailwind CSS Consolidation (✅ COMPLETE)

**Status:** Complete  
**Completion date:** 2026-06-28  
**PR:** #656–659

#### Pattern Established
- **Static properties** → Tailwind utilities (e.g., `text-[11px]`, `font-semibold`, `shrink-0`)
- **Dynamic values** → Inline styles (e.g., `{ width: pct + '%' }`, `{ gap: GAP }`)
- **Conditional logic** → Inline styles (e.g., color switching)
- **CSS variables** → Inline styles (e.g., `{ color: 'var(--gold)' }`)

#### Components Migrated (9)
- ✅ BuildPanel.jsx (removed width styles, consolidated classes)
- ✅ EconomyPanel.jsx (border/color to Tailwind)
- ✅ HappinessGraph.jsx (removed duplicate class attributes)
- ✅ KingdomBodyHeader.jsx (color to text-[var(--text)])
- ✅ ResourcesPanel.jsx (margin to mt-3)
- ✅ RankingsPanel.jsx (button styles to Tailwind)
- ✅ StudiesPanel.jsx (clsx → template literals, added rounded-none)
- ✅ StudiesTabs/SchoolTab.jsx (emoji sizing + DOM IDs)
- ✅ StudiesTabs/SpellsGrid.jsx (emoji sizing)

#### Issues Fixed
- ✅ Duplicate className attributes consolidated
- ✅ Emoji sizes corrected (text-8xl → text-4xl, text-6xl → text-2xl)
- ✅ Critical DOM IDs restored (st-researchers, st-school-cap, st-general-spellbook-level)
- ✅ SQL injection vulnerabilities hardened (forum.js sort parameter, kingdom-economy.js resource validation)

#### Verification
- ✅ Lint 0 errors
- ✅ Smoke baseline pass
- ✅ Sanity checks passed
- ✅ All Gemini Code Assist review issues addressed

---

### Splash & Glitch Phase (✅ COMPLETE)

**Status:** Complete  
**Completion date:** 2026-Q1  
**Phase:** S0

#### Completed Items
- ✅ Retro phase assets in `public/retro/*`
- ✅ `Splash.jsx` CSS-only glitch effect
- ✅ Separate from portal and game (standalone rendition)

#### Notes
- Optional enhancements deferred: `prefers-reduced-motion` support, `useSplashPhase()` hook extraction

---

### Forum Integration (✅ COMPLETE)

**Status:** Complete  
**Completion date:** 2026-Q2  
**Branch:** fix/topbar-take-turn

#### Completed Items
- ✅ Vanilla phpBB rebuild
- ✅ Categorized index (Community, Warfare, Alliances, Roleplaying)
- ✅ 4 boards per category
- ✅ Avatar system
- ✅ Badge system
- ✅ In-game panel integration

---

## Security Audits & Fixes

### SQL Injection Prevention (✅ HARDENED)

**Status:** Complete  
**Completion date:** 2026-06-28  
**PR:** #659

#### Forum Route Fix
- ✅ Sort parameter regression fixed (defaulting to "newest")
- ✅ Backward compatibility maintained
- ✅ File: routes/forum.js line 169

#### Market Route Validation
- ✅ getResourceColumn simplified (returns undefined for invalid input)
- ✅ Validation added at call site (/market/sell route)
- ✅ Graceful 400 error instead of 500
- ✅ File: routes/kingdom-economy.js lines 61–67, 378–382

---

## Documentation Updates

### ROADMAP.md Update (✅ COMPLETE)

**Status:** Complete  
**Completion date:** 2026-06-28  
**PR:** #660

#### Changes
- ✅ Status updated to "ALPHA PHASE COMPLETE"
- ✅ All tracks A-F marked complete
- ✅ Admin Ph6b marked verified
- ✅ Tailwind consolidation marked done
- ✅ Success metrics all achieved
- ✅ Corrupted character fixes (5 items: Admin Ph0?6 → Ph0-Ph6, etc.)

### MAINTENANCE.md Refresh (✅ COMPLETE)

**Status:** Complete  
**Completion date:** 2026-06-28  
**PR:** #654

#### Coverage
- ✅ System health audit
- ✅ Component status assessment
- ✅ Architecture debt itemization
- ✅ Performance notes
- ✅ Recommended next actions

---

## Verification & Testing

### Admin Ph6b Verification (✅ COMPLETE)

**Status:** Complete  
**Completion date:** 2026-06-28  
**Method:** Fresh server boot + PostgreSQL + all endpoints tested

#### 12-Item Checklist (All Passed)
1. ✅ Manage (Announcements, Chat, Mods/Bans)
2. ✅ Kingdoms (Edit + AI Presets)
3. ✅ Events (Load Log + Form)
4. ✅ Config (Load + Display)
5. ✅ Sounds (List + Preview)
6. ✅ Prestige (Static Table)
7. ✅ Lore (Load Entries)
8. ✅ Evolution (Wishlist, Changelog, Notes)
9. ✅ Detailed Lists (Fragments, Spells)
10. ✅ Goals (Load Grid)
11. ✅ Security (CSRF Protection)
12. ✅ Auth (Logout + Re-login)

#### Integration Checks
- ✅ Admin React app loads (admin-main.jsx)
- ✅ All 10 API endpoints respond
- ✅ Portal integration functional
- ✅ Game entry page functional
- ✅ Forum API functional

---

## Notes for Future Reference

### Deferred Work
- **E3: Discord integration review** — Completed and no longer active
- **UI Happiness Breakdown** — Enhancement, low priority
- **Historical Happiness Tracking** — Enhancement, low priority
- **Advanced Rebellion Events** — Enhancement
- **Happiness Code Quality Cleanup** — Deferred to post-alpha

### Known Technical Debt (Post-Alpha)
- Admin inline CSS consolidation (500+ usages) deferred
- Component test coverage expansion (57 tests; gaps remain)
- Query analysis for /expedition and /turn endpoints
- API documentation refresh (outdated)
- Happiness logic code quality cleanup (consolidation of duplicated functions)

### Next Phase: Beta Preparation
- Address remaining CSS consolidation
- Expand component test coverage
- Refresh API documentation
- Plan happiness system code quality work
- Investigate JSON row corruption (PROTECTED_WORK.md notes)

---

## Summary Statistics

| Category | Count | Status |
|----------|-------|--------|
| **Completed Tracks** | 6 (A, B, C, D, E, F) | ✅ |
| **Completed Phases** | 13 (Admin Ph0–Ph6b + F1–F8) | ✅ |
| **Completed Features** | 4+ (Happiness, Combat, Forum, Mobile UI) | ✅ |
| **Files Refactored** | 8+ (engine.js, kingdom.js, components) | ✅ |
| **Components Migrated** | 16 (Zustand) + 9 (Tailwind) | ✅ |
| **Tests Implemented** | 57 (component) + 45+ (game logic) | ✅ |
| **Security Fixes** | 5+ (CSRF, SQL injection, dependency vulns) | ✅ |
| **CI Checks** | 3 (Lint, Test, Build + Security + Encoding) | ✅ |
| **PRs Merged** | 60+ | ✅ |

---

## Claude Lane: Alpha Phase Completion (Items 1-22)

**Completion date:** 2026-06-28  
**Status:** ✅ ALL COMPLETE

**Work Items:**
1. ✅ Battle Outcome Animation: Animate casualty and critical hit counters
2. ✅ Battle Outcome Animation: Animate HP, wall, or power bars when results are shown
3. ✅ Battle Outcome Animation: Keep combat resolution deterministic and presentation-only
4. ✅ Mobile and Vanilla Cleanup: Scan `public/` for inline `<script>` blocks and jQuery usage
5. ✅ Mobile and Vanilla Cleanup: Audit `index.html` and fallback templates for non-React entry points
6. ✅ Mobile and Vanilla Cleanup: Move remaining user-facing vanilla routes to React
7. ✅ Mobile and Vanilla Cleanup: Convert remaining vanilla form handlers to controlled components
8. ✅ Mobile and Vanilla Cleanup: Replace inline styles and `onclick` handlers with Tailwind and React bindings
9. ✅ Mobile and Vanilla Cleanup: Consolidate vanilla template CSS into one Tailwind source
10. ✅ Mobile and Vanilla Cleanup: Verify no horizontal scroll at 360px
11. ✅ Mobile and Vanilla Cleanup: Keep bottom nav visible without overlap
12. ✅ Mobile and Vanilla Cleanup: Preserve natural header scrolling
13. ✅ Mobile and Vanilla Cleanup: Enforce responsive breakpoints and 44x44 touch targets
14. ✅ Mobile and Vanilla Cleanup: Prevent layout shifts when nav appears or disappears
15. ✅ Beta Architecture Debt: Remove remaining GameStateManager bridge hooks after full Zustand coverage
16. ✅ Beta Architecture Debt: Enforce Tailwind-only defaults for static styling
17. ✅ Beta Architecture Debt: Remove legacy admin compatibility routes from `index.js`
18. ✅ Beta Architecture Debt: Expand component test coverage
19. ✅ Beta Architecture Debt: Refresh API documentation
20. ✅ Beta Architecture Debt: Investigate `/expedition` and `/turn` query performance
21. ✅ Beta Architecture Debt: Clean up duplicate happiness logic and related code-quality debt
22. ✅ Beta Architecture Debt: Confirm Discord integration is stable and keep the current implementation

---

## Archive Completion Date

**Final status:** 2026-06-28  
**Platform state:** Alpha phase complete, ready for beta launch  
**Work quality:** All quality gates passed (lint, smoke, security, verification)

---

## Backlog Cleanup Archive

**Updated:** 2026-06-29

Completed work that was previously tracked in `ROADMAP.md` has been consolidated here so the live backlog only contains unfinished tasks.

- Battle Outcome Animation win/loss banner emphasis completed and merged via PR #668
- Battle Outcome Animation casualty and critical-hit counters completed and merged via PR #678
- Battle Outcome Animation HP, wall, and power bars completed and merged via PR #681
- Battle Outcome Animation combat resolution remains deterministic and presentation-only in `game/lib/combat-wrappers.js`; `BattleReportModal.jsx` stays render-only
- Claude health-assessment work (`todoCLAUDEcompleted.md`) verified against the branch work and archived
- Completed platform-health work archived into the main completion record
- Completed engine, combat, admin, and migration checkpoints remain recorded above for reference
- Beta Launch Prerequisites (11 items): All Tier 1 Critical and Tier 2 Important items complete as of 2026-06-30
