# Tailwind Completion + Mobile Hardening

## Summary
Finish the mixed-state UI by removing the remaining legacy CSS and inline-style surfaces, then harden the Tailwind theme, then apply the aggressive mobile plan on top of that stable base. Keep the work split into reviewable slices and avoid gameplay logic changes.

Tailwind completion ends when the remaining UI is consistently Tailwind-driven and only thin shared primitives or unavoidable runtime styles remain.

## Critical Blocking Dependency: Vanilla JS → React Conversion

**This work CANNOT proceed in parallel with Tailwind completion.** 17 components currently use imperative DOM manipulation (`el()` + `style.cssText`) instead of React:

`AuthModal`, `BuildPanel`, `DefensePanel`, `EconomyPanel`, `GlobalchatPanel`, `HirePanel`, `KingdomProfileModal`, `MapKingdomCard`, `MarketPanel`, `NewsPanel`, `OptionsPanel`, `ResourcesPanel`, `StatusPanel`, `StudiesPanel`, `TrainingPanel`, `WarfarePanel`, `WorldmapLegend`, `WorldmapRenderer`

**These must be converted to React with Tailwind + clsx BEFORE CSS cleanup (Phase 5+).** Leaving them as vanilla JS means:
- Tailwind utilities can't control their display → mixed systems (some panels Tailwind, some inline styles)
- CSS file removal becomes impossible (legacy CSS still needed for vanilla JS mutations)
- Mobile hardening can't be applied consistently
- Long-term maintainability suffers (two parallel UI patterns)

**Execution order:**
1. Tailwind foundation (config, shared component classes)
2. Global layout conversion (Phase 3)
3. Pure React component migration (Phase 4a)
4. **Vanilla JS → React conversion (Phase 4b) — 3 tiers, high risk, must complete before step 5**
5. CSS cleanup + mobile hardening

See `TAILWIND_MIGRATION.md` Phase 4b for detailed execution, tiers, risk mitigation, and success criteria.

## Key Changes
- **Tailwind foundation**
  - Expand `tailwind.config.js` into a fuller dark-fantasy theme system with semantic colors, spacing, borders, shadows, typography, and component tokens.
  - Keep the existing CSS-variable source of truth where it already exists, but map it into clearer Tailwind names for consistent use across panels.

- **Legacy UI cleanup**
  - Convert the remaining inline-style and old-class surfaces into Tailwind utilities, starting with the remaining shell-heavy panels and chrome.
  - Reduce or remove old CSS files that still carry layout responsibility, keeping only truly shared primitives or other genuinely shared base styling if needed.
  - Standardize reusable patterns for card shells, tabs, headers, scroll areas, and modal bodies so panels stop drifting stylistically.

- **Mobile pass**
  - Apply the aggressive mobile plan after the Tailwind base is stable.
  - Prioritize navigation, shell spacing, dense panels, and tap targets first.
  - Keep desktop behavior intact while tightening layout at tablet and phone widths.

## Test Plan
- Run a build after each slice.
- Smoke the touched UI in the browser after each slice.
- Verify layout at desktop, tablet, and narrow phone widths.
- Check for console errors after each change.
- Merge only after the PR slice is clean and the branch is still visually stable.

## Assumptions
- Gameplay behavior stays unchanged; this is presentation and shell/layout work only.
- CSS variables remain the visual source of truth unless a slice explicitly replaces them.
- Work stays split into small PRs so review and rollback stay easy.
- The aggressive mobile plan is applied after the Tailwind base is finished, not in parallel.
- **Vanilla JS → React conversion (Phase 4b) is a hard blocker.** This phase cannot be skipped or deferred—CSS cleanup and mobile hardening both depend on it being complete.
