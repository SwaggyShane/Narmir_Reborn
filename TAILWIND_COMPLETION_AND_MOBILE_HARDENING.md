# Tailwind Completion + Mobile Hardening

## Summary
Finish the mixed-state UI by removing the last legacy CSS / inline-style surfaces, then harden the Tailwind theme, then apply the aggressive mobile plan on top of that stable base. The work should stay sliced into small, reviewable PRs, with no gameplay logic changes.

## Goals
- Achieve a consistent, modern, dark-fantasy aesthetic across the entire game.
- Make the UI fully responsive and pleasant on mobile.
- Eliminate technical debt from old CSS and vanilla DOM code.
- Keep the UI stable and reviewable at every step.

## Critical Blocking Dependency: Phase 3 Vanilla → React Conversion

**This work CANNOT proceed in parallel.** Approximately 17 components still use imperative DOM manipulation (`el()` + `style.cssText`) instead of React:

`AuthModal`, `BuildPanel`, `DefensePanel`, `EconomyPanel`, `GlobalchatPanel`, `HirePanel`, `KingdomProfileModal`, `MapKingdomCard`, `MarketPanel`, `NewsPanel`, `OptionsPanel`, `ResourcesPanel`, `StatusPanel`, `StudiesPanel`, `TrainingPanel`, `WarfarePanel`, `WorldmapLegend`, `WorldmapRenderer`

**Why it's a hard blocker:**
- Tailwind utilities can't control their display → mixed UI systems (some panels Tailwind, some inline styles)
- CSS file removal in Phase 4 becomes impossible (legacy CSS still needed for vanilla JS mutations)
- Mobile hardening in Phase 5 can't be applied consistently
- Long-term maintainability suffers with two parallel UI patterns

**Phase 3 is HIGH RISK.** Treat the component list as a moving backlog. Not all components may need conversion, but the ones that do cannot be deferred.

## Scope Exception: Splash
**Splash.jsx and Splash.css are completely out of scope.** This is a stable, isolated pre-login landing page. Do not alter it.

## Execution Phases

### Phase 0: Tailwind Foundation
- Expand `tailwind.config.js` into a full dark-fantasy design system:
  - semantic colors
  - spacing scale
  - shadows
  - typography
  - component tokens
- Use `clsx` utility for conditional class composition.
- Set up global base styles and CSS variable mapping.

### Phase 1: Global Shell & Chrome
- Convert topbar, sidebar, main container, resource bars, turn display, and similar shell elements.
- Standardize layout containers and spacing.

### Phase 2: High-Visibility Panels
- Convert the visible panels that players see constantly:
  - Studies
  - Status
  - Happiness
  - Kingdom overview
- Focus on visual polish first.

### Phase 3: Vanilla → React Conversion
- Convert the remaining components that still use heavy imperative DOM manipulation.
- Work one panel at a time.
- Use feature flags only for risky behavior changes, not ordinary presentation refactors.
- Treat the list of remaining components as a moving backlog, not a fixed promise.
- **Smoke test after each component** to catch regressions early.

### Phase 4: Legacy CSS Cleanup
- Remove or drastically reduce old `.css` files.
- Standardize reusable components where repetition justifies it:
  - `GameCard`
  - `PanelHeader`
  - `TabGroup`
  - `Modal`
  - `ResourceStat`
- Prefer shared utility classes or tiny shared components only when the pattern repeats enough to justify the abstraction.

### Phase 5: Aggressive Mobile Hardening
- Apply the full mobile plan:
  - bottom nav overhaul
  - touch targets
  - safe areas
  - responsive grids
- Test thoroughly on real devices.

## Test Plan
After every PR:
- Build the project.
- Smoke test the touched panels in the browser.
- Test at desktop, tablet, and mobile widths.
- Check for console errors.
- Verify no regression in gameplay feel.

## Success Criteria
- No more old CSS classes or heavy inline styles in new components.
- Consistent visual language across all panels.
- Mobile experience is comfortable for daily play.
- Old CSS files are minimized or gone.
- The end state is clearly Tailwind-driven, with only thin shared primitives or genuinely unavoidable runtime styles left.
