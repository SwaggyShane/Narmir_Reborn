# Narmir Reborn — Unified Development Roadmap

**Status:** Alpha phase (ongoing) — Tracks A–D complete; E1–E2 fixed; E3 deferred (await discord.js v15); Track F.3 consolidation complete (PR #606–#608); **F.4 engine.js decomposition COMPLETE (PR #611); F.2 Combat V2 complete and alpha-ready (PR #612)**  
**Last updated:** 2026-06-27 (F4 engine decomposition complete; F2 Combat V2 verified + alpha-ready)  
**Single source of truth** for planning, replacing ALPHA_ROADMAP + AdminRoadmap + MAINTENANCE (see **Related Documents**)

---

## Executive Summary

| Area | Today | Target | Track | Status |
|------|-------|--------|-------|--------|
| **Game navigation** | "War" + "Economy" labels | "Offense" + "Wherewithal" | A1 | ✅ Done |
| **Admin panel** | Vanilla JS (`public/admin.html`) | React + Tailwind with AI presets | Admin Ph0–6 | ✅ Ph6b hard cutover complete (PR #602) |
| **Admin CSRF** | Missing on mutating routes | Protected all mutators | E1 | ✅ Done |
| **CI/lint enforcement** | ESLint broken (silent) | `npm run lint` + test job | E2 | ✅ Done |
| **API hygiene** | Mixed snake_plural routes | Canonical kebab + aliases | B1+B2 | ✅ Done |
| **Portal styling** | CSS + Tailwind mixed | Pure Tailwind foundation | C1+C2 | ✅ Done |
| **Forum integration** | Vanilla phpBB rebuild | Categorized index + in-game panel + avatars/badges | — | ✅ Done (fix/topbar-take-turn) |
| **Mobile UI** | Unpolished panels | Responsive refinements across 7 panels | Mobile fixes | ✅ Done (PR #596, #597, #598) |
| **Vite dependency** | 8.0.12 (HIGH vuln) | ≥8.1.0 | E3 | ⏳ Open |
| **Inline CSS patterns** | Static + dynamic mixed | Static → Tailwind, dynamic only inline | Future Tailwind consolidation | 📋 Preventative plan |
| **Monolithic files** | engine.js, kingdom.js, etc. | Split into focused modules | F4–F5 | ⏳ Deferred (P4) |
| **Combat V2** | Complete + feature-flagged | Alpha-ready; 26.8M test scenarios | F2 | ✅ Done (PR #612) |

---

## Strategy Overview

### Three intertwined goals:

1. **Alpha completeness** — Stabilize game UX, admin tooling, and API consistency for beta launch
2. **Admin Tailwind cutover** — Migrate React admin from inline styles to production-ready UI (Phase 6b deferred until verification matrix passes)
3. **Platform health** — Fix security gaps (CSRF, ESLint), dependency vulns, and unlock CI test enforcement

### Dependency order:

```
P0 (parallel): A1 (nav) + E1 (CSRF) + E2 (CI) + E3 (Vite) → unblock P1–P4
P1: B1+B2 (API kebab) + M1 (MAINTENANCE refresh)
P2: C1+C2+C3 (Portal Tailwind)
P3: D1+D2+D3 (Admin Tailwind hard cutover, with verification matrix)
P4: F1–F8 (Architecture debt post-cutover — no dogfood wait)
```

### Rules (from `CLAUDE.md`):

- Draft PRs only; never self-merge
- Lint → smoke → sanity before every commit
- Session URL in all commit messages
- Verify inline styles only for dynamic/calculated values; static → Tailwind utilities
- Preserve panel IDs (`warfare`, `economy`, `alliances`) — only labels change

---

## Track A — Vernacular & Naming (P0)

**Status:** ✅ **DONE** (fix/topbar-take-turn)

| Item | Change | File |
|------|--------|------|
| Bottom nav | "War" → "Offense" | BottomNav.jsx |
| Bottom nav | "Economy" → "Wherewithal" | BottomNav.jsx |
| Admin tab | "Configs" → "Config" | AdminTabNav.jsx |
| Alliance UI | Plural copy → singular panel titles | AlliancesPanel.jsx + related |

**Exit criteria:** Lint + smoke pass; hash routes (`#warfare`, `#economy`, `#alliances`) unchanged; visual check mobile + desktop.

---

## Track B — API Route Normalization (P1)

**Status:** ✅ **DONE** (fix/admin-api-kebab, fix/admin-api-clients)

| Item | Scope |
|------|-------|
| Server canonical routes | `/api/admin/bug-reports`, `/api/admin/admin-notes`, etc. (kebab) |
| Legacy aliases | Preserved with optional `Deprecation` header |
| React admin clients | `EvolutionPanel`, `LorePanel` using canonical paths |

**Pattern:** `dualRoute(router, { canonical, legacy, handler })`

**Deprecation:** Remove aliases in beta (post-alpha).

---

## Track C — Portal → React + Tailwind (P2)

**Status:** ✅ **DONE** (feat/portal-tailwind-foundation, feat/portal-tailwind-forum, PR #603)

| Phase | Work | Status | Notes |
|-------|------|--------|-------|
| **C1** | Import `tailwind.css`; reuse `.card`, `.base-btn`, theme tokens | ✅ | Done |
| **C2** | Forum + race cards to Tailwind; extract patterns to `@layer components` | ✅ | Done |
| **C3** | Add reusable @layer components foundation; keep CSS files for safety | ✅ | PR #603 merged |

**C3 Details (PR #603 - Portal CSS Consolidation):**
- **Phase 1:** ✅ Added 223 lines of `@layer components` to tailwind.css (registration form, cards, tables, buttons, forms)
- **Phase 2 (Revised):** ✅ Kept ALL original CSS class definitions to prevent regressions (no aggressive deletion)
- **Strategy:** @layer components provide reusable foundation; CSS files remain for production stability
- **Future work:** Incremental component-by-component Tailwind utility migration (out of C3 scope, post-cutover)

**Forum overhaul:** Categorized index (Community, Warfare, Alliances, Roleplaying), 4 boards each, avatars, badges, in-game panel.

**Exit criteria:** ✅ Lint + smoke pass; ✅ No style regressions; ✅ @layer components as foundation for future Tailwind adoption; visual parity maintained.

---

## Track D — Admin Tailwind Migration & Hard Cutover (P3)

**Admin roadmap Phases 0–6 mapped to alpha tracks:**

| Phase | Branch | Status | Notes |
|-------|--------|--------|-------|
| **Ph0** | admin-react-00-foundation | ✅ Merged PR #580 | React shell + auth gate + legacy fallback |
| **Ph1** | admin-react-01-shell | ✅ Merged PR #581 | Shell, stats, 12 empty tabs |
| **Ph2a–d** | admin-react-02-kingdoms | ✅ Merged PR #582–585 | Kingdom table + editor + AI presets |
| **Ph3** | admin-react-03-manage | ✅ Merged PR #586 | Announcements, moderation, bulk actions |
| **Ph4** | claude/repo-health-assessment | ✅ Merged PR #587 | Events, Lore, Goals, Evolution panels |
| **Ph5** | claude/repo-health-assessment | ✅ Merged PR #588 | Config, Sounds, Fragments, Prestige, Security |
| **Ph6a** | admin-soft-six-prep | ✅ Merged PR #589 | Soft cutover: React default, legacy fallback at `?legacy=1` |
| **Ph6b** | admin-react-06-cutover | ✅ Merged PR #602 | Hard cutover: React admin default, legacy `admin.html` archived to `/legacy/`, no `?legacy=1` fallback |

### D.1 Tailwind strategy

- Replace 500+ inline `style={{}}` usages with Tailwind utilities
- Reuse shell components (topbar, cards, buttons, CSS variables)
- Admin-specific layers: `.admin-stat-grid`, `.admin-tab-nav`, `.admin-table-scroll`
- **Do not** copy 650-line legacy CSS — map to utilities + tokens

### D.2 Hard cutover checklist (before Ph6b)

Run once on staging/local; all must ✅:

- Manage: announcement + chat mods/bans
- Kingdoms: edit kingdom + apply AI preset
- Events: load log + open form
- Config: load + verify display
- Sounds: list + preview
- Prestige: static table
- Lore: load entries
- Evolution: wishlist + changelog + notes
- Detailed Lists: fragments + spells
- Goals: load grid
- Security: audit (CSRF)
- Auth: logout + re-login + `/admin?legacy=1` fallback

**Decision (alpha policy):** Dogfood soak deferred. Use verification matrix only. Proceed to Ph6b once checklist passes locally.

---

## Track E — Platform Health (P0–P1)

**Status:** ✅ **E1, E2 DONE** | 🟡 **E3 DEFERRED** (await discord.js v15 stable, 3-6+ months)

### E.1 ESLint enforcement

**Status:** ✅ **FIXED**

- Pre-commit hook now enforces `npm run lint` — 0 errors required
- `@eslint/js` resolved; flat-config working

### F.1 Express error handler & silent catch audit

**Status:** ✅ **COMPLETE** (PR #610)

**Findings:**
- ✅ Express error middleware already in place (index.js ~1540–1570)
- ✅ Global handlers: `unhandledRejection`, `uncaughtException` with proper logging
- ✅ Database connection error recovery (distinguishes recoverable vs. fatal)
- ✅ Audited 554 catch blocks; most are intentional (logging I/O, localStorage fallback, API error handling)

**Improvements:**
- Added logging to `game/goals.js` JSON parsing failure with kingdom ID fallback
- Documented which "silent" catches are acceptable vs. problematic
- Verified no critical silent error swallowing exists

**Conclusion:** Error handling is solid. No additional global error handler needed; existing patterns are sufficient.

### E.2 CI lint + test job

**Status:** ✅ **DONE** (ci/lint-test-build)

Added `.github/workflows/ci.yml`:
- `npm ci`
- `npm run lint`
- `npm test` (45+ game logic tests)
- `npm run build`

### E.3 Dependency vulnerabilities

**Status:** 🟡 **DEFERRED INDEFINITELY** — Await discord.js v15 stable release (3-6+ months)

#### Fixed (✅ 4 vulnerabilities)
| Package | Issue | Resolution |
|---------|-------|-----------|
| `vite` | 8.0.12 → ≥8.1.0 | ✅ Already at ^8.1.0 (server FS bypass + NTLM leak on Windows) |
| `multer` | 2.1.1 → 2.2.0 | ✅ Fixed DoS via deeply nested fields (2 HIGH vulns) |
| `ws` | 8.x → 8.21.0 | ✅ Fixed memory exhaustion DoS (1 HIGH vuln) |

#### Remaining (⏳ 4 vulnerabilities — undici chain, deferred)
| Package | Issue | Path forward | Decision |
|---------|-------|--------------|----------|
| `undici` ≤6.26.0 | 4 HIGH: HTTP injection, WebSocket DoS, keep-alive poisoning, SameSite downgrade | (A) **Deferred:** await discord.js v15 stable (3-6 months+), (B) downgrade to discord.js v13.17.1 now (2-3 hr refactor: Intents, EmbedBuilder, Permissions) | **DEFER** — v14.x will not receive undici fix; v15 still in dev. Risk assessment: WebSocket DoS exploitable, others require MITM. Revisit when v15 stable or risk escalates. |

**Analysis:** 
- Tested discord.js 14.26.4 (latest v14) — still uses vulnerable undici 6.24.1
- Fix requires undici >=6.27.0, not available in discord.js v14.x
- discord.js v15 (dev) will have the fix, but ETA uncertain (weeks to months)
- Real-world risk: low-moderate (WebSocket DoS direct, others need MITM)
- Cost to fix now: ~2-3 hours refactoring; Cost to defer: ongoing security debt

**Decision:** Defer indefinitely. Branch `claude/track-e3-dependencies` deleted. Revisit when discord.js v15 stable or if threat escalates (e.g., public WebSocket DoS PoC). No action needed until then.

### E.4 Admin CSRF protection

**Status:** ✅ **FIXED** (fix/admin-csrf)

All mutating routes now use `requireCsrfToken` middleware.

### E.5 MAINTENANCE.md refresh

**Status:** ⏳ **M1** (docs/maintenance-refresh)

Link updated doc to this roadmap; clarify resolved vs. open items.

---

## Track F — Architecture Debt (P4, post-cutover)

**Status:** ✅ **F3 & F4 COMPLETE** — F3 consolidation complete (PR #606–#608); F4 engine.js decomposition complete (PR #609–#611)

### F4 Decomposition Progress

**Goal:** Extract 6,242-line `engine.js` into focused, testable modules across 4 phases.

| Phase | Functions Extracted | Modules Created | Status | PR |
|-------|-------------------|-----------------|--------|-----|
| **Phase 1A** | achievements, scoring | `game/lib/achievements.js` | ✅ | #609 |
| **Phase 1B** | combat helpers, formatting | `game/lib/combat-helpers.js` | ✅ | #609 |
| **Phase 2A** | happiness logging (DB) | `game/lib/happiness-logging.js` | ✅ | #609 |
| **Phase 2B** | expedition utilities, transitions | `game/lib/expeditions.js` | ✅ | #610 |
| **Phase 2C** | rebellion, prestige, trade raids, alliance defense | `game/lib/special-events.js` | ✅ | #611 |
| **Phase 2D** | combat wrappers (~1,260 lines) | `game/lib/combat-wrappers.js` | ✅ | #611 |
| **Phase 3A** | building & research (6 functions) | `game/lib/building-research.js` | ✅ | #611 |
| **Phase 3B** | gameplay (7 functions) | `game/lib/gameplay.js` | ✅ | #611 |
| **Phase 4** | processTurn orchestration | Thin coordinator | ✅ | #611 |

**Architecture:** Pure functions extracted first; medium-risk functions with state mutations second; large orchestrators last.

---

### Other F-track items

| ID | Work | Notes | Timeline | Status |
|----|------|-------|----------|--------|
| **F1** | Express global error handler; audit silent `catch {}` | Audit complete; no critical issues found | ✅ | ✅ **DONE** (PR #610) |
| **F2** | Combat V2 complete + alpha-ready | Individual troop HP/DMG model; 26.8M simulated combats; balanced 48–52% outcomes; feature-flagged `USE_COMBAT_V2=1` | Alpha | ✅ **DONE** (PR #612) |
| **F3** | Module consolidation & architecture foundation | ✅ Phase 1: data-transformations extraction (PR #606)<br/>✅ Phase 2: timestamp consolidation (PR #607)<br/>✅ Phase 3: architecture documentation + mobile hardening (PR #608) | Now | ✅ **DONE** |
| **F4** | `engine.js` decomposition | 4 phases (all complete); 6,241 lines → 8 focused modules + re-exports | Now | ✅ **DONE** (PR #611) |
| **F5** | `GameStateManager` → React Context | Incremental per panel; align with frontend tests | Post-F4 | ⏳ Pending |
| **F6** | Frontend component tests (Vitest + RTL) | Start with shell nav + `panelMeta` | Post-F4 | ⏳ Pending |
| **F7** | Numeric range validation (troops, builds, research) | Prevents balance exploits | Post-F4 | ⏳ Pending |
| **F8** | `kingdom.js` split → `build`, `warfare`, `economy`, `research` modules | Incremental refactor; enabled by F3 foundation | Post-F4 | ⏳ Pending |

---

## Preventative: Inline CSS → Tailwind Consolidation

**Status:** 📋 **Planned future work** (not blocking alpha)

### Problem

React components mix inline `style={{}}` with Tailwind utilities. While dynamic values (widths, gaps, conditional colors) justify inline styles, static properties (font sizes, weights, borders) often duplicate what Tailwind utilities express.

### Why now?

The React migration used "path of least resistance" shortcuts that created maintenance friction later. Documenting the decision upfront prevents a future "huge icky sticky mess."

### Pattern (lock in now)

| Category | Use | Example |
|----------|-----|---------|
| **Static** | Tailwind utility | `text-[11px]`, `font-semibold`, `shrink-0` |
| **Dynamic** | Inline style | `{ width: pct + '%' }`, `{ gap: GAP }` |
| **Conditional** | Inline style | `{ color: isWarning ? 'var(--red)' : 'var(--text)' }` |
| **CSS variables** | Inline style | `{ color: 'var(--gold)' }` |

### Future PR (low urgency)

- Audit `KingdomBodyHeader.jsx`, `BuildPanel.jsx`, other heavily-styled components
- Migrate static inline styles → Tailwind utilities
- Keep inline only for: dynamic values, CSS variables, conditional logic
- Regression test: no visual changes
- Lint + smoke + sanity pass

---

## Splash & Glitch (Standalone)

**Status:** ✅ **DONE** (S0)

The retro phase (`public/retro/*` assets + `Splash.jsx` CSS-only glitch) is **not** folded into portal or game. It remains a separate rendition of the original frameset.

**Optional follow-ups (P3+):** `prefers-reduced-motion` support, `useSplashPhase()` hook extraction.

---

## Mobile UI Refinements (Completed)

**Status:** ✅ **DONE** (PR #596, #597, #598)

| Item | Change |
|------|--------|
| Nav bar | Sticky + visible on forums |
| Take Turn button | Hidden on forums |
| News panel | Line break between turn groups |
| Build panel | Right-justified inputs, aligned headers, tightened layout, 3-iteration refinement |
| Exploration | Diminishing returns note on toast (not button) |
| Resources panel | Guide starts collapsed |
| Hire panel | Building caps in one row |
| Kingdom header | XP/level inline with score; local time/vampire/season on row below; only nav sticky |

---

## Verification Matrix (every PR)

Per `CLAUDE.md`:

1. ✅ `npm run lint` — 0 errors
2. ✅ Fresh server boot + `PostgreSQL connected successfully`
3. ✅ Baseline smoke: forum boards, auth/me, portal, game entry
4. ✅ Track-specific checks (nav labels, `/admin`, portal render, API paths, mobile viewport)
5. ✅ Sanity questions answered in commit message or PR description

**Before hard cutover (Ph6b):** Full admin checklist (§D.2) pass on staging + local.

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Tracks A, B, C, E completion | 100% (P0–P2 done; E1–E2 fixed; E3 deferred) |
| Admin parity (Ph6a) | 100% feature parity with legacy |
| Admin hard cutover (Ph6b) | Deferred until verification matrix passes |
| Lint | 0 errors on all new code |
| CI | Lint + test jobs gate all PRs |
| Mobile responsiveness | No horizontal page scroll at 360px width |
| API coverage | Canonical paths + legacy aliases; deprecation headers |
| Tailwind adoption | Foundation + patterns locked in; inline CSS reserved for dynamic use |

---

## Immediate Next Steps (Sprint Order)

| Priority | Track/Phase | Owner | Status |
|----------|-------------|-------|--------|
| **1** | **S0** Splash retro | — | ✅ Done |
| **2** | **A1** Nav vernacular | — | ✅ Done |
| **3** | **E1** Admin CSRF | — | ✅ Done |
| **4** | **E2** CI lint + test | — | ✅ Done |
| **5** | **B1+B2** API kebab | — | ✅ Done |
| **6** | **C1+C2** Portal Tailwind + forum | — | ✅ Done |
| **7** | **Admin Ph0–6a** React admin soft cutover | — | ✅ Done (PR #589) |
| **8** | **Mobile UI** Responsive refinements | — | ✅ Done (PR #596–#598) |
| **9** | **F3 Consolidation** Module architecture & timestamps | — | ✅ Done (PR #606–#608) |
| **10** | **F4 Decomposition** `engine.js` → 8 focused modules (all phases 1–4) | — | ✅ **DONE** (PR #611: Phases 2D–4 + encoding fix) |
| **11** | **C3** Portal CSS cleanup | — | ⏳ After F4 |
| **12** | **Admin Ph6b** Hard cutover (with verification matrix ✅) | — | ⏳ When ready |
| **13** | **M1** MAINTENANCE refresh | — | ⏳ After F4 completes |
| **14** | **E3** Discord.js v15 migration | — | 🟡 **DEFERRED** (indefinite — await v15 stable) |
| **15** | **Tailwind consolidation** Static → utilities refactor | — | 📋 Future (low urgency) |
| **16** | **Track F (F.2,5–8)** Remaining architecture debt | — | ⏳ Post-F4 |

---

## Related Documents

| Document | Purpose | Status |
|----------|---------|--------|
| `CLAUDE.md` | PR workflow, smoke recipe, quality rules | **Source of truth** |
| `AdminRoadmap.md` | Admin parity detail + Phase 6b checklist | **Detailed reference** |
| `MAINTENANCE.md` | Health audit + F track itemization | **Being refreshed** (M1) |
| `ALPHA_ROADMAP.md` | Alpha phase overview (superseded by this doc) | **Archived** (use ROADMAP.md instead) |
| `TODO.md` | Feature-level todos + Combat V2 notes | Companion reference |

---

## Document History

| Version | Date | Change |
|---------|------|--------|
| 1.2 | 2026-06-27 | **F4 COMPLETE**: Phases 2D (combat-wrappers), 3A (building-research), 3B (gameplay), 4 (orchestration) all extracted; fixed encoding validation (middle dot → hyphen); all CI checks passing (PR #611) |
| 1.1 | 2026-06-27 | F4 Phase 1–2C completion update: achievements, combat-helpers, happiness-logging, expeditions, special-events modules extracted; Phase 2D (combat wrappers) pending |
| 1.0 | 2026-06-26 | Unified ALPHA_ROADMAP + AdminRoadmap + MAINTENANCE into single source of truth; added Tailwind consolidation preventative plan |

