# Mobile Plan of Action — Narmir Reborn

## The Core Problem

The game is desktop-first with a responsive skin bolted on. The 28-item horizontal-scroll bottom nav is the single biggest UX failure on mobile — players have to scroll to find anything, nothing signals where they are, and the full 60px nav bar eats into content with a 120px padding-bottom dead zone. Everything else is secondary to fixing the nav.

---

## Phase 1 — Nav Triage (Highest Impact, Do This First)

**Goal:** Replace the 28-item horizontal scroll with a 6-slot tab bar + overflow drawer.

**The 6 fixed slots:**
```
Status | Warfare | Economy | Explore | Community | ···More
```
- `Status`      → `#status`
- `Warfare`     → `#warfare`
- `Economy`     → `#economy`
- `Explore`     → `#exploration`
- `Community`   → `#globalchat` *(decision locked: live chat over async forum for the 6th slot; `#forum` moves to the More drawer)*
- `···`         → opens an upward slide-in drawer listing all remaining panels

**The More drawer:**
- Slides up from behind the bottom nav (z-index just below `--z-fixed: 3000`)
- Grid layout: 4 columns of icon+label buttons
- Closes on outside tap or on any nav item selection
- Remembers recently-used panels and floats them to the top

**Notification badge on the `···` tab:**
Panels like `messages` and `news` carry live notification badges (`#bnav-msg-badge`, `#bnav-news-badge`). Once hidden inside the drawer, those badges disappear from view. Add a single aggregate dot on the `···` More button itself that lights up when any drawer panel has an active badge. After each `setActivePanelGlobal()` call, check if any drawer item has a visible badge and toggle a `.more-has-badge` class on the More button accordingly. Pure JS, no new DOM polling needed.

**Active state indicator:**
- Currently missing entirely on mobile. Add a 2px top border in the tab's accent color on the active tab.
- Body class `panel-{activeTab}` is already set by `setActivePanels()` — use that in CSS, no JS change needed.

**Files touched:**
- `client/src/components/react/BottomNav.jsx` — replace flat list with 6 fixed + drawer; active-state CSS scoped to this component only
- `client/index.html` — CSS for `.bottom-nav`, `.more-drawer`, `.bnav-item.active`
- `client/src/main.js` — `setActivePanelGlobal()` (from `useActivePanel.js`) is already called inside `switchTab`; active state updates automatically

**Scope constraint:** Phase 1 is strictly nav structure and badge behaviour. Do not bundle active-state CSS changes that require edits outside `BottomNav.jsx` (e.g. shell-level `.main` layout changes). Those belong in Phase 2.

**What this does NOT touch:** `switchTab()`, panel display logic, `syncUI()` — those stay untouched.

---

## Phase 2 — Dead Zone Fix

**Goal:** Sync padding-bottom on `.main` to actual nav height.

`.main` currently has `padding: 0 10px 120px`. The bottom nav is ~64px tall (icon + label + safe area). That leaves ~56px of unnecessary dead scroll space at the bottom of every panel.

**Fix:** Add a CSS variable `--bottom-nav-h: 64px` and replace the hardcoded bottom padding:

```css
.main {
  padding: 0 10px calc(var(--bottom-nav-h) + 16px);
}
```

When the More drawer is open, increase it temporarily via a body class. One-line change, zero risk.

---

## Phase 3 — StatusPanel Mobile Layout

**Goal:** Make the military grid readable on 360px screens without breaking desktop.

The unit table uses `gridTemplateColumns: '100px 1fr 52px 52px'` — that's 204px minimum before content. Works at 360px (320px content area) but the role badge is crushed at `font-size: 9px`.

**Fix (Option A — simpler):** On screens < 480px, hide the Role badge column entirely. Role is decorative context, not gameplay-critical.

The unit rows in `StatusPanel.jsx` use inline `style={{ display: 'grid', gridTemplateColumns: '100px 1fr 52px 52px' }}` — CSS media queries cannot override inline styles. The rows need a shared class (`unit-grid`) added in JSX, then the media query works:

```jsx
// In StatusPanel.jsx — add className="unit-grid" to each unit row div
<div className="unit-grid" style={{ alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
```

```css
/* In index.html <style> block */
.unit-grid {
  display: grid;
  grid-template-columns: 100px 1fr 52px 52px;
  gap: 4px;
}
@media (max-width: 480px) {
  .unit-grid {
    grid-template-columns: 1fr auto 40px;
  }
  .unit-grid > span:last-child { display: none; }
}
```

Remove `display: 'grid'`, `gridTemplateColumns`, and `gap` from the inline styles on each row once the class is in place.

**Card reorder on mobile:** The three stacked cards are currently Military → Research → Buildings. Consider reordering to Buildings → Military → Research since Buildings is the most actionable. JSX reorder, no logic change.

---

## Phase 4 — Touch Feedback and Targets

**Goal:** Make taps feel responsive, not laggy.

Currently there is zero tap feedback. Players tap a nav button and wonder if it registered.

**Pure CSS fixes (no JS):**
```css
.bnav-item:active { opacity: 0.6; transform: scale(0.95); }
.base-btn:active  { opacity: 0.8; }
```

**Touch target audit:**
- Bottom nav items: `min-width: 48px` — adequate
- Race portrait card: 80×80px — fine
- Tax slider and Lock button — add `min-height: 44px; padding: 10px 12px;` to ensure grabbability
- Any button measuring under 44px height needs the same treatment

---

## Phase 5 — Swipe Navigation (After Phase 1–4 are stable)

**Goal:** Swipe left/right to move between panels in a logical order.

Do this last. It requires a defined panel order and careful touch event work.

**Proposed swipe map:**
```
Status ↔ Economy ↔ Build ↔ Exploration ↔ Warfare ↔ Defense
```
Side panels (Forum, Rankings, etc.) accessible only via nav or More drawer.

**Implementation:**
- Touch event listeners on `.main` (not on individual panels)
- Threshold: 50px horizontal movement, < 100px vertical drift allowed
- On swipe complete: call `window.switchTab(nextPanel)`
- Visual cue: brief slide animation via CSS transition on `.panel.active`

**Swipe exclusions — check `e.target` before acting:**
Not every horizontal touch should navigate. Exclude swipes that originate on:
- `input[type=range]` (the tax slider `#strip-tax-slider`)
- Elements with `overflow-x: auto` (scrollable tables, the world map)
- Any element with `touch-action: pan-x` already set

```js
mainEl.addEventListener('touchstart', (e) => {
  const tag = e.target.tagName;
  const touchAction = getComputedStyle(e.target).touchAction;
  if (tag === 'INPUT' || touchAction.includes('pan-x')) return;
  // proceed with swipe tracking
}, { passive: true });
```

**Do NOT use a library (Hammer.js etc.)** — vanilla touch events are 15 lines of code and avoid conflicts with existing vertical scroll behavior.

---

## Phase 6 — Landscape and Edge Cases

**Landscape mode on phone:** At 667×375px the game tries to show the desktop layout. The stylesheet in `client/index.html` is already mobile-first — mobile styles are the unwrapped default and desktop overrides live inside `@media (min-width: 768px)`. The fix is to add a `min-height` guard to that existing desktop query so it doesn't fire on short landscape screens:

```css
/* Before */
@media (min-width: 768px) { /* desktop layout */ }

/* After */
@media (min-width: 768px) and (min-height: 500px) { /* desktop layout */ }
```

This keeps the mobile-first architecture intact and ensures landscape phones stay on the mobile nav.

---

## What NOT To Do

- No hamburger menu — the game needs instant one-tap panel access
- Do not try to auto-close the More drawer on `hashchange` — `switchTab()` → `setActivePanelGlobal()` handles it
- Do not add a swipe library — overkill, adds bundle weight
- Do not change `setActivePanels()` or `switchTab()` internals — they're clean
- Do not use localStorage to persist the More drawer state — always open fresh

---

## Delivery Sequence

Layout phases must fully precede interaction polish. Swipe navigation is only safe once the panel set and nav ordering are frozen — do not start Phase 5 until Phase 1 is stable in production and no panel changes are pending.

Wait for local vanilla-removal work to land before touching the nav — BottomNav.jsx will be cleaner to edit once you know which panels are staying.

| PR | Contents | Dependencies |
|----|----------|--------------|
| 1 | Phase 2 (dead zone) + Phase 4 (tap feedback) | None — can go now |
| 2 | Phase 1 (nav overhaul) + Phase 6 (landscape guard) | After vanilla cleanup is merged |
| 3 | Phase 3 (StatusPanel unit-grid) | After PR 2 is stable — nav shell must be final |
| 4 | Phase 5 — Swipe navigation | After PR 3 — panel set and nav order must be frozen |

Four PRs. No routing changes, no game logic changes, no server changes.
