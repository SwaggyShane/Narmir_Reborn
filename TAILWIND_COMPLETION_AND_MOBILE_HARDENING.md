# Tailwind Completion + Mobile Hardening

## Summary
Finish the mixed-state UI by removing the last legacy CSS and inline-style surfaces, then harden the Tailwind theme, then apply the aggressive mobile plan on top of that stable base. The work stays split into small, reviewable PRs, with no gameplay logic changes.

Phase 0 is implemented and the remaining work is now in the open PR queue. The remaining work continues with shell/chrome hardening, panel modernization, legacy CSS cleanup, and mobile polish.

## Current Progress Snapshot

| Phase | Status | Open PRs | What still needs finishing |
| --- | --- | --- | --- |
| Phase 0: Tailwind Foundation | Implemented, final review slice still open | #525 | Final Tailwind base-layer polish, including the review note about font smoothing / redundant body color handling. |
| Phase 1: Global Shell & Chrome | In progress | #526, #527, #528, #530 | Shell chrome token cleanup, shell layout/frame cleanup, and final nav/header polish. |
| Phase 2: High-Visibility Panels | In progress | #529 | Panel visual refinements and token alignment. |
| Phase 3: Vanilla -> React Conversion | In progress | #531 | Fix the remaining NewsPanel API-call bug and finish the next React conversion slice. |
| Phase 4: Legacy CSS Cleanup | Not started | None yet | Remove or sharply reduce the old CSS files after the panel migration settles. |
| Phase 5: Aggressive Mobile Hardening | Not started | None yet | Apply the mobile plan once the base Tailwind layer and shell/panel migration are stable. |

### Open Review Notes
- #525: Tailwind base layer review note about font smoothing / redundant body background-text styling.
- #527: unused color prop / Tailwind token consistency in shell components.
- #529: hover translation, recovery contrast, and `border-strong` alignment in the high-visibility panels.
- #531: `apiCall` signature bug in `NewsPanel.jsx`.

## Parallel Ownership
### Codex lane
Own the shared Tailwind and shell infrastructure:
- `tailwind.config.js`
- global Tailwind base/theme layers
- `client/src/main.js`
- topbar, sidebar, bottom nav, and other shell chrome
- responsive layout primitives and mobile shell behavior

### Claude lane
Own the gameplay panel and legacy cleanup work:
- panel-by-panel Tailwind conversion
- remaining inline-style / old-class cleanup inside gameplay panels
- component modernization for dense content areas
- panel-specific mobile polish

### Hard boundary
- No file is edited by both lanes in parallel.
- If a slice needs a shared file, one lane owns that file end-to-end for the slice.
- Handoff happens only after the owning lane has built and smoke-tested the slice.

## Goals
- Achieve a consistent, modern, dark-fantasy aesthetic across the entire game.
- Make the UI fully responsive and pleasant on mobile.
- Eliminate technical debt from old CSS and vanilla DOM code.
- Keep the UI stable and reviewable at every step.

## Execution Phases
### Phase 1: Global Shell & Chrome
**Owner: Codex**
- Convert topbar, sidebar, main container, resource bars, turn display, and similar shell elements.
- Standardize layout containers, spacing, and responsive shell behavior.
- Current Codex shell slices are represented by PRs #526, #527, #528, and #530.

### Phase 2: High-Visibility Panels
**Owner: Claude**
- Convert the visible panels players see constantly:
  - Studies
  - Status
  - Happiness
  - Kingdom overview
- Focus on visual polish first.
- Current panel slice is represented by PR #529.

### Phase 3: Vanilla -> React Conversion
**Owner: Claude**
- Convert the remaining components that still use heavy imperative DOM manipulation.
- Work one panel at a time.
- Use feature flags only for risky behavior changes, not ordinary presentation refactors.
- Treat the remaining component list as a moving backlog, not a fixed promise.
- Smoke test after each component to catch regressions early.
- Current conversion slice is represented by PR #531.

### Phase 4: Legacy CSS Cleanup
**Owner: Claude**
- Remove or drastically reduce old `.css` files.
- Standardize reusable components where repetition justifies it:
  - `GameCard`
  - `PanelHeader`
  - `TabGroup`
  - `Modal`
  - `ResourceStat`
- Prefer shared utility classes or tiny shared components only when the pattern repeats enough to justify the abstraction.

### Phase 5: Aggressive Mobile Hardening
**Owner: Codex for shell/nav, Claude for panel internals**
- Apply the full mobile plan:
  - bottom nav overhaul
  - touch targets
  - safe areas
  - responsive grids
- Codex owns the mobile shell and navigation behavior.
- Claude owns panel-specific mobile layout and spacing.

## Slice Rules
- One slice = one owner = one branch = one draft PR.
- Do not mix Codex and Claude changes in the same slice unless a handoff is explicitly complete.
- Each slice ends with build validation and browser smoke testing before the draft PR is opened.

## Test Plan
After every PR:
- Build the project.
- Smoke test the touched UI in the browser.
- Test at desktop, tablet, and mobile widths.
- Check for console errors.
- Verify there is no gameplay regression.

## Success Criteria
- No more old CSS classes or heavy inline styles in new components.
- Consistent visual language across all panels.
- Mobile experience is comfortable for daily play.
- Old CSS files are minimized or gone.
- The end state is clearly Tailwind-driven, with only thin shared primitives or genuinely unavoidable runtime styles left.
