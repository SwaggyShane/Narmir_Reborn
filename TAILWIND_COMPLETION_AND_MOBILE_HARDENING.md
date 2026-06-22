# Tailwind Completion + Mobile Hardening

## Summary
Finish the mixed-state UI by removing the last legacy CSS / inline-style surfaces, then harden the Tailwind theme, then apply the aggressive mobile plan on top of that stable base. Keep the work split into small, reviewable PRs, with no gameplay logic changes.

Tailwind completion ends when the remaining UI is consistently Tailwind-driven and only thin shared primitives or unavoidable runtime styles remain.

Treat "unavoidable runtime styles" narrowly: only values that are genuinely data-driven or state-driven, not leftover layout work that should be converted into utilities.

## Goals
- Achieve a consistent, modern, dark-fantasy aesthetic across the entire game.
- Make the UI fully responsive and pleasant on mobile.
- Eliminate technical debt from old CSS and vanilla DOM code.
- Keep the UI stable and reviewable at every step.

## Critical Blocking Dependency
Phase 3 vanilla → React conversion is still a hard dependency for anything that needs imperative DOM replacement. Don’t try to force mobile polish or CSS cleanup through components that still rely on heavy `el()` / `style.cssText` mutation.

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
- Smoke test after each component to catch regressions early.

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
