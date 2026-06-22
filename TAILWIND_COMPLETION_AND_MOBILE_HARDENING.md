# Tailwind Completion + Mobile Hardening

## Summary
Finish the mixed-state UI by removing the remaining legacy CSS and inline-style surfaces, then harden the Tailwind theme, then apply the aggressive mobile plan on top of that stable base. Keep the work split into reviewable slices and avoid gameplay logic changes.

Tailwind completion ends when the remaining UI is consistently Tailwind-driven and only thin shared primitives or unavoidable runtime styles remain.

Treat "unavoidable runtime styles" narrowly: only values that are genuinely data-driven or state-driven, not leftover layout work that should be converted into utilities.

## Key Changes
- **Tailwind foundation**
  - Expand `tailwind.config.js` into a fuller dark-fantasy theme system with semantic colors, spacing, borders, shadows, typography, and component tokens.
  - Keep the existing CSS-variable source of truth where it already exists, but map it into clearer Tailwind names for consistent use across panels.

- **Legacy UI cleanup**
  - Convert the remaining inline-style and old-class surfaces into Tailwind utilities, starting with the remaining shell-heavy panels and chrome.
  - Reduce or remove old CSS files that still carry layout responsibility, keeping only truly shared primitives or other genuinely shared base styling if needed.
  - Standardize reusable patterns for card shells, tabs, headers, scroll areas, and modal bodies so panels stop drifting stylistically.
  - Prefer shared utility classes or tiny shared components only when a pattern repeats enough to justify the abstraction; otherwise keep it local and explicit.

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
