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
- `Community`   → `#globalchat` (or `#forum` — whichever is more used)
- `···`         → opens an upward slide-in drawer listing all remaining panels

**The More drawer:**
- Slides up from behind the bottom nav (z-index just below `--z-fixed: 3000`)
- Grid layout: 4 columns of icon+label buttons
- Closes on outside tap or on any nav item selection
- Remembers recently-used panels and floats them to the top

**Active state indicator:**
- Currently missing entirely on mobile. Add a 2px top border in the tab's accent color on the active tab.
- Body class `panel-{activeTab}` is already set by `setActivePanels()` — use that in CSS, no JS change needed.

**Files touched:**
- `client/src/components/react/BottomNav.jsx` — replace flat list with 6 fixed + drawer
- `client/index.html` — CSS for `.bottom-nav`, `.more-drawer`, `.bnav-item.active`
- `client/src/main.js` — `setActiveNavButtons()` already handles active class; should just work

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

```css
@media (max-width: 480px) {
  .unit-role-col { display: none; }
}
```

Columns become `gridTemplateColumns: '1fr auto 40px'`. One media query, zero restructuring.

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

**Do NOT use a library (Hammer.js etc.)** — vanilla touch events are 15 lines of code and avoid conflicts with existing vertical scroll behavior.

---

## Phase 6 — Landscape and Edge Cases

**Landscape mode on phone:** At 667×375px the game tries to show the desktop layout. The mobile breakpoint at `768px` should also trigger on height:

```css
@media (max-width: 768px), (max-height: 500px) {
  /* mobile layout */
}
```

This ensures landscape phones still get the mobile nav instead of a half-broken desktop sidebar.

---

## What NOT To Do

- No hamburger menu — the game needs instant one-tap panel access
- Do not try to auto-close the More drawer on `hashchange` — `switchTab()` → `setActiveNavButtons()` handles it
- Do not add a swipe library — overkill, adds bundle weight
- Do not change `setActivePanels()` or `switchTab()` internals — they're clean
- Do not use localStorage to persist the More drawer state — always open fresh

---

## Delivery Sequence

Wait for local vanilla-removal work to land before touching the nav — BottomNav.jsx will be cleaner to edit once you know which panels are staying.

| PR | Contents | Dependencies |
|----|----------|--------------|
| 1 | Phase 2 (dead zone) + Phase 3 (StatusPanel grid) + Phase 4 (tap feedback) | None — can go now |
| 2 | Phase 1 — Nav overhaul (6-slot + More drawer) | After vanilla cleanup is merged |
| 3 | Phase 5 — Swipe navigation | After PR 2 is stable in production |
| — | Phase 6 (landscape) | Roll into whichever PR touches the breakpoints |

Three PRs. No routing changes, no game logic changes, no server changes.
