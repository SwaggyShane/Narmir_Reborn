# Tailwind Migration: Complete Execution Plan

**Status**: In Progress  
**Created**: 2026-06-22  
**Goal**: Achieve 100% Tailwind utility adoption across all React components, eliminate legacy CSS classes and bulk inline styles.

---

## Phase Overview

| Phase | Task | Owner | Status | Est. Effort |
|-------|------|-------|--------|-------------|
| **Phase 0** | ✅ Tailwind setup, config, design tokens | Claude | ✅ Complete | N/A |
| **Phase 1** | ✅ 8 fully-Tailwind components | Claude | ✅ Complete | N/A |
| **Phase 2** | Define component layer (@layer components) | **Claude (Haiku)** | 🔴 Blocked | 4-6 hours |
| **Phase 3** | Migrate 25 Tier 1-2 components | **Codex** | 🔴 Waiting | 12-16 hours |
| **Phase 4** | Migrate 31 Tier 3 complex components | **Claude (Haiku)** | 🔴 Waiting | 24-32 hours |
| **Phase 5** | Integration testing, final polish | **Codex** | 🔴 Waiting | 4-8 hours |

---

## Phase 2: Component Layer Foundation (Claude — Haiku)

**Why this must come first**: All downstream work depends on these base classes.

### Tasks

1. **Create `client/src/styles/tailwind-components.css`**
   - Implement `.card`, `.btn`, `.base-btn`, `.badge`, `.panel`, `.trow`, `.prog-wrap`, `.build-sticky-header`, `.hire-row`, `.nav-item`, `.nav-section`, `.kingdom-header`, `.metrics`, `.card-title` as `@layer components`
   - Each class should:
     - Use Tailwind `@apply` to compose utilities
     - Use design tokens (CSS variables) for colors/spacing
     - Support modifier states (`.card.selected`, `.btn:hover`, etc.)
   - Reference: `client/index.html` lines 1500-2700 for current definitions

2. **Update `client/src/main.css` or `tailwind.css`**
   - Import the new components layer
   - Verify design token CSS variables are available globally

3. **Test Phase 2 locally**
   - Run `npm run build` — should compile with no errors
   - Verify in dev server that all legacy classes still render correctly
   - No functional changes yet; just moving CSS to Tailwind layer

4. **Commit & Push**
   - Commit message: "Phase 2: Define Tailwind component layer (@layer components)"
   - Push to feature branch: `phase2/tailwind-components`
   - Create draft PR for visibility

**Blockers**: None — this is foundational work.  
**Exit criteria**: Build succeeds, legacy classes render identically to before.

---

## Phase 3: Tier 1-2 Component Migrations (Codex)

**Scope**: 25 files with simpler logic and fewer inline styles.  
**Goal**: Reduce inline `style={{}}` usage by 60%, adopt Tailwind utilities.

### Tier 1 (Codex — Start Here)

**Files**: `ChangelogPanel`, `GoalsPanel`, `OptionsPanel`, `RacesPanel`, `ResourceStrip`

**Per-file checklist**:
1. Keep all `.card`, `.btn`, `.badge`, `.panel` class references (now backed by Tailwind @layer)
2. Convert inline `style={{}}` to Tailwind utilities:
   - `display: 'flex'` → `className="flex"`
   - `gap: '10px'` → `className="gap-[10px]"` or `gap-2.5`
   - `padding: '12px 16px'` → `className="px-4 py-3"`
   - Color vars like `color: 'var(--text3)'` → `className="text-[var(--text3)]"` (keep var refs for now)
3. Use `clsx()` for conditional classes (already in use elsewhere)
4. Run lint, smoke test, build before committing each file
5. Commit individually with message: `"Migrate <Component>: Tailwind utilities, reduce inline styles"`

**Effort per file**: 30–60 min  
**Total Tier 1**: ~4 hours

### Tier 2 (Codex — Next)

**Files**: `Topbar`, `Sidebar`, `NewsPanel`, `HappinessPanel`, `HappinessWidget`, `HappinessGraph`, `AuthModal`, `KingdomProfileModal`, `LoreModal`, `WarfareIntelTab`, `WarfareReportsTab`, `SchoolSelectionModal`

**Same checklist as Tier 1**, plus:
- Handle dynamic color logic (e.g., `color: happiness >= 100 ? 'var(--green)' : 'var(--amber)'`)
  - Use template conditional: `` className={`text-${happiness >= 100 ? '[var(--green)]' : '[var(--amber)]'}`} `` (or clsx with ternary)
- For Topbar/Sidebar: preserve layout grid/flex structure, just convert utility style values
- Modals: clean up centered layout, use Tailwind centering utilities (`flex items-center justify-center`)

**Effort per file**: 45–90 min  
**Total Tier 2**: ~12–14 hours (10 files)

### Phase 3 Exit Criteria
- All 25 files build without errors
- No runtime errors in browser
- Inline `style={{}}` count reduced from 1,331 to ~300–400 (mostly dynamic color logic)
- Commit all 25 files to feature branch `phase3/tier1-tier2-migration`
- Create draft PR with test checklist

---

## Phase 4: Tier 3 Complex Component Migrations (Claude — Haiku)

**Scope**: 31 files with complex grids, tables, state-driven layout, high inline-style density.  
**Goal**: Achieve <100 inline styles per file, complete Tailwind adoption.

### Strategy

These files will be migrated in sub-phases to avoid merge conflicts:

#### Phase 4a: Panels with grids (BuildPanel, HirePanel, TrainingPanel)
- **Highest effort**: Complex multi-row grids, per-row allocation logic, card layouts
- **Approach**:
  1. Extract grid structure to Tailwind: `.panel .grid .grid-cols-2 gap-4`
  2. Convert row styling: `.trow` usage → Tailwind flex/grid utilities
  3. Refactor allocation logic: keep JS logic, move styles to className
  4. Test with sample game state (via smoke test + local dev server)
- **Files**: `BuildPanel`, `HirePanel`, `TrainingPanel`, `StatusPanel`, `EconomyPanel`
- **Effort**: 60–90 min each = 5 hours total

#### Phase 4b: Warfare/covert panels (WarfarePanel, ResourcesPanel, DefensePanel, ExplorationPanel)
- **Complexity**: Multi-tab layout, dynamic target card rendering, complex intel displays
- **Approach**:
  1. Migrate tab container to Tailwind
  2. Refactor target card component (already in WarfarePanel) to use Tailwind
  3. Convert report/intel display grids
- **Files**: `WarfarePanel`, `DefensePanel`, `ExplorationPanel`
- **Effort**: 45–75 min each = 3+ hours total

#### Phase 4c: Remaining panels (MarketPanel, StudiesPanel, AlliancesPanel, RankingsPanel, BountiesPanel, HeroesPanel, WorldmapPanel, ResourcesPanel)
- **Complexity**: Moderate; mostly table rows and card repeaters
- **Approach**: Similar to 4a/4b — extract table structure, convert row styling
- **Files**: 8 files
- **Effort**: 30–60 min each = 4–5 hours total

#### Phase 4d: Specialized rendering components (ForumSection.jsx, MapKingdomCard.jsx, WorldmapRenderer.jsx)
- **Already mostly clean** or non-React; minimal work
- **Effort**: 1–2 hours total

### Per-File Checklist

1. Read file top-to-bottom (sanity rule #2)
2. Identify inline `style={{}}` patterns:
   - Layout (flex, grid, gap, padding) → Tailwind utilities
   - Colors (var(--*)) → Tailwind with var ref, or Tailwind color system
   - Shadows, borders, radius → Tailwind utilities
3. Refactor conditionals: use `clsx()` and ternaries for dynamic values
4. Keep legacy `.panel`, `.card`, `.btn` classes (they're now backed by Tailwind @layer)
5. Run `npm run lint` → 0 errors required (pre-commit hook enforces)
6. Run smoke test: `npm run build` + baseline checks (forum, auth/me, portal)
7. Commit with clear message: `"Migrate <Component>: complete Tailwind adoption, <X> inline styles → <Y>"`
8. Grep for all usages of any removed CSS variables (sanity rule #3)

### Merge strategy for Phase 4
- Create 3 feature branches:
  - `phase4a/complex-grids` (BuildPanel, HirePanel, TrainingPanel, StatusPanel, EconomyPanel)
  - `phase4b/warfare-panels` (WarfarePanel, DefensePanel, ExplorationPanel)
  - `phase4c/remaining-panels` (8 remaining)
- Merge 4a → main, **wait 1 hour for deployment**, merge 4b → main, **wait 1 hour**, merge 4c → main
- Stagger to minimize conflict risk and allow testing between merges

### Phase 4 Exit Criteria
- All 31 complex files build without errors
- Smoke tests pass on production build
- Inline `style={{}}` count reduced to **<100 total across all files**
- All 3 feature branches merged to main (68 commits total)
- No CSS variable references remain in component code (moved to Tailwind layer)

---

## Phase 5: Integration Testing & Polish (Codex)

**Scope**: Verify the entire app works end-to-end after all migrations.

### Tests

1. **Visual Regression Testing** (manually in browser)
   - Open http://localhost:3000
   - Click through every panel (Status, Build, Heroes, Training, Exploration, Market, etc.)
   - Verify layout, colors, spacing match pre-migration screenshots
   - Check mobile responsiveness

2. **Functional Testing**
   - Open dev console: verify no JS errors
   - Try interactive features:
     - BuildPanel: allocate units, verify grid updates
     - HirePanel: hire units, verify row count/cost updates
     - WarfarePanel: select target, verify card renders
     - NewsPanel: verify news items display with correct icons/colors
     - Topbar: hover effects, dropdown menus work

3. **Browser Compatibility**
   - Test in Chrome, Firefox, Safari (if available)
   - Verify no CSS Grid/Flexbox layout breaks

4. **Performance Check**
   - `npm run build` file size before/after
   - Verify CSS bundle size didn't bloat unexpectedly

5. **Final Cleanup**
   - Remove any unused legacy CSS variables from `client/index.html` (once all components migrated)
   - Update CLAUDE.md: document Tailwind adoption, future patterns
   - Create "Tailwind Migration Complete" commit

### Phase 5 Exit Criteria
- All panels render correctly in dev and production builds
- No console errors
- Smoke tests pass
- PR #520 (Phase 5 integration) merged to main
- Documentation updated

---

## Work Division Summary

| Phase | Owner | Commits | Effort | Deadline |
|-------|-------|---------|--------|----------|
| **Phase 2** | Claude (Haiku) | 1–3 | 4–6h | Day 1 (today) |
| **Phase 3** | Codex | 25–30 | 12–16h | Day 1–2 |
| **Phase 4** | Claude (Haiku) | 31–40 | 24–32h | Day 2–3 |
| **Phase 5** | Codex | 1–2 | 4–8h | Day 3 |

**Total**: ~65 hours of dev time, 3–4 calendar days.

---

## Key Rules (From CLAUDE.md)

### Before Every Commit
1. ✅ **Lint**: `npm run lint` → 0 errors (warnings OK if pre-existing)
2. ✅ **Smoke Test**: `npm run build` + baseline checks (forum, auth/me, portal)
3. ✅ **Sanity Check**:
   - What breaks? (Answer explicitly)
   - Did I read every file top-to-bottom? (Yes)
   - Did I grep for all symbol usages if I renamed/removed anything? (Yes)
   - Does the change work in both contexts (portal + game)? (Yes)
   - New CSS variables/classes in all contexts? (No)

### Git Workflow
- **Always**: `git branch --show-current` before pushing
- **Always**: `git fetch origin main && git log --oneline origin/main..HEAD` to confirm commits to push
- **Always**: Check for existing open PR before creating a new one
- **Always**: Create PRs as drafts (no exceptions)
- **Always**: Commit messages end with session URL: `https://claude.ai/code/session_013FXYCffQew15xm1VV51vXW`

---

## Branching Strategy

```
main (current)
├── phase2/tailwind-components (Claude)
│   └── Merge → main (after Phase 2 exit criteria met)
├── phase3/tier1-tier2-migration (Codex)
│   └── Merge → main (after Phase 3 exit criteria met)
├── phase4a/complex-grids (Claude)
│   └── Merge → main (wait 1h, then...)
├── phase4b/warfare-panels (Claude)
│   └── Merge → main (wait 1h, then...)
├── phase4c/remaining-panels (Claude)
│   └── Merge → main (then...)
└── phase5/integration-polish (Codex)
    └── Merge → main (final)
```

---

## Success Criteria (Final)

- [ ] 0% legacy CSS classes (`.card`, `.btn`, `.panel`, etc.) in className attributes
- [ ] 0% inline `style={{}}` objects (except unavoidable dynamic colors via clsx)
- [ ] 100% of React components use Tailwind utilities
- [ ] All panels render correctly in browser (no layout breaks)
- [ ] Build size stable or reduced
- [ ] Smoke tests pass
- [ ] All PRs merged to main
- [ ] CLAUDE.md updated with Tailwind patterns & future guidelines
- [ ] No console errors or warnings in dev tools

---

## Next Steps

1. **Today (Claude)**: Start Phase 2 — implement component layer, create PR #518
2. **Today (Codex)**: Once Phase 2 merges, start Phase 3 — Tier 1 components
3. **Tomorrow (Claude)**: Start Phase 4a (complex grids) while Codex finishes Phase 3
4. **Stagger merges**: 4a → main (wait 1h) → 4b → main (wait 1h) → 4c → main
5. **Day 3 (Codex)**: Start Phase 5 integration testing
6. **Day 3 (Claude)**: Monitor Phase 5 tests, assist with fixes

---

## Questions & Clarifications

- **CSS Variable Migration**: Currently `.card` uses `background: var(--bg3);`. After Phase 2, do we keep var refs or move to Tailwind colors? **Answer**: Keep var refs for now (safe, minimal refactor). Phase 6 can unify the design token system if needed.
- **Unused Classes**: After migration, will old CSS classes in `client/index.html` be removed? **Answer**: Yes, Phase 5 cleanup removes any unused legacy CSS.
- **Testing Frequency**: How often should we run smoke tests? **Answer**: Before every commit (CLAUDE.md rule).

