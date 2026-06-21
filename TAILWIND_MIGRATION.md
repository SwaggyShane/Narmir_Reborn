# Narmir Reborn — Tailwind CSS Migration Plan

## Prerequisites

This migration begins **after** the vanilla → React migration is complete. Do not start Phase 1 while shell bridges are still being removed. The vanilla removal must land first so the component surface being migrated is stable.

---

## Overview

| Phase | Name | Risk | Dependency |
|-------|------|------|------------|
| 0 | Install & Config | Zero | Vanilla removal complete |
| 1 | Design Token Bridge | Zero | Phase 0 |
| 2 | Shared Component Classes | Low | Phase 1 |
| 3 | Global Layout | Medium | Phase 2 |
| 4 | React Component Migration | Medium | Phase 3 |
| 5 | Isolated CSS Files | Low | Phase 4 |
| 6 | Panel System Modernization | Medium | Phase 5 |
| 7 | Mobile Nav Overhaul | High | Phase 6 |
| 8 | QA & Dead CSS Removal | Low | Phase 7 |

Each phase ends with a build + smoke test + visual review before the next begins.

---

## Phase 0 — Install & Configure

### Install

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### `tailwind.config.js`

This is the entire design system captured in one file. Every value here maps directly from the existing CSS variables and stylesheet.

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './client/index.html',
    './client/src/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {

      // ── Colors ──────────────────────────────────────────────────────────
      colors: {
        // Backgrounds
        bg:  '#0a0a0b',
        bg2: '#111113',
        bg3: '#070708',
        bg4: '#1c1c21',

        // Text
        text:  '#f8fafc',
        text2: '#cbd5e1',
        text3: '#64748b',

        // Accents
        gold:    '#f06202',
        gold2:   '#d97706',
        accent1: '#b43c00',
        accent2: '#f06202',

        // Semantic
        green: '#10b981',
        red:   '#b43c00',
        blue:  '#3b82f6',
        amber: '#f59e0b',

        // Special
        logo:  '#ffe4b5',
      },

      // ── Borders ─────────────────────────────────────────────────────────
      borderColor: {
        DEFAULT: 'rgba(255, 255, 255, 0.05)',
        strong:  'rgba(255, 255, 255, 0.10)',
      },

      // ── Border Radius ───────────────────────────────────────────────────
      borderRadius: {
        none: '0',
        sm:   '2px',
        DEFAULT: '8px',
        md:   '10px',
        lg:   '12px',   // --radius
        xl:   '24px',   // --radius-lg
        full: '9999px',
      },

      // ── Breakpoints ─────────────────────────────────────────────────────
      // Mapped from existing media queries. Unconventional values preserved.
      screens: {
        'xs':  '380px',   // extra-small mobile (logo shrink)
        'sm':  '500px',   // small mobile/tablet
        'md':  '650px',   // tablet (r-grid-2 kicks in)
        'lg':  '768px',   // desktop layout switch
        'xl':  '900px',   // wide desktop
        '2xl': '1100px',  // max-width desktop (r-grid-sidebar full)
      },

      // ── Spacing extras ───────────────────────────────────────────────────
      spacing: {
        '13': '52px',    // unit-grid role badge column
        '14': '56px',    // topbar height
        '18': '72px',    // bottom nav height
        '30': '120px',   // old .main bottom padding (to be replaced)
        '55': '220px',   // sidebar width
        '75': '300px',   // sidebar wide breakpoint
      },

      // ── Z-Index ──────────────────────────────────────────────────────────
      zIndex: {
        base:           '1',
        sticky:         '20',
        normal:         '100',
        backdrop:       '200',
        overlay:        '500',
        dropdown:       '999',
        sidebar:        '1000',
        topbar:         '1100',
        'topbar-mobile':'2000',
        fixed:          '3000',
        tooltip:        '9999',
        modal:          '10000',
      },

      // ── Typography ───────────────────────────────────────────────────────
      fontFamily: {
        cinzel: ['"Cinzel"', 'serif'],
        sans:   ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono:   ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },

      fontSize: {
        '2xs': ['6.5px', { lineHeight: '1' }],
        '3xs': ['7px',   { lineHeight: '1' }],
        xs:    ['9px',   { lineHeight: '1.4' }],
        sm:    ['11px',  { lineHeight: '1.5' }],
        base:  ['13px',  { lineHeight: '1.5' }],
        md:    ['14px',  { lineHeight: '1.5' }],
        lg:    ['16px',  { lineHeight: '1.4' }],
        xl:    ['18px',  { lineHeight: '1.3' }],
        '2xl': ['20px',  { lineHeight: '1.3' }],
        '3xl': ['24px',  { lineHeight: '1.2' }],
        '4xl': ['32px',  { lineHeight: '1.1' }],
      },

      // ── Animations ───────────────────────────────────────────────────────
      animation: {
        'pulse-red':       'pulse-red 2s infinite',
        'news-flash':      'news-flash 1.5s infinite ease-in-out',
        'chat-flash':      'chat-flash 0.7s infinite alternate',
        'delta-fade':      'delta-fade 2.4s ease-out forwards',
        'happiness-pulse': 'happiness-pulse 0.6s ease-in-out',
      },

      keyframes: {
        'pulse-red': {
          '0%, 100%': { textShadow: '0 0 5px #ff0000', opacity: '0.8', transform: 'scale(1)' },
          '50%':       { textShadow: '0 0 15px #ff0000, 0 0 25px #ff0000', opacity: '1', transform: 'scale(1.05)' },
        },
        'news-flash': {
          '0%, 100%': { backgroundColor: '#b43c00', boxShadow: '0 0 0px #b43c00', transform: 'scale(1)' },
          '50%':       { backgroundColor: '#ff4d4d', boxShadow: '0 0 10px #b43c00', transform: 'scale(1.15)' },
        },
        'chat-flash': {
          '0%':   { backgroundColor: 'transparent' },
          '100%': { backgroundColor: 'rgba(224, 92, 92, 0.25)' },
        },
        'delta-fade': {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '15%':  { opacity: '1', transform: 'translateY(0)' },
          '70%':  { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-6px)' },
        },
        'happiness-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0.7' },
        },
      },

      // ── Gradients (as bg-image shortcuts) ────────────────────────────────
      backgroundImage: {
        'gold-gradient':   'linear-gradient(135deg, #f06202 0%, #d97706 100%)',
        'accent-gradient': 'linear-gradient(135deg, #f06202 0%, #f06202 100%)',
        'card-top-border': 'linear-gradient(90deg, transparent, rgba(240, 98, 2, 0.3), transparent)',
      },

    },
  },
  plugins: [],
};
```

### Add Tailwind directives

Create `client/src/tailwind.css` (new entry file):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Base resets */
@layer base {
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    @apply bg-bg text-text font-sans;
    -webkit-font-smoothing: antialiased;
  }
}
/* Scrollbar styling is NOT global — see Phase 6 .scrollbar-game utility */
```

Import in `client/src/main.js`:
```js
import './tailwind.css';
```

At this point Tailwind is installed and configured. **Zero visual change.** The existing `<style>` block in `index.html` still controls everything. The migration layers on top starting Phase 1.

---

## Phase 1 — Design Token Bridge

**Goal:** Map all CSS variables to Tailwind equivalents so both systems can coexist during transition. No component changes yet.

Add a CSS bridge block at the **top of `client/src/tailwind.css`** (not in `index.html`). The `theme()` function is a PostCSS directive — Vite does not process inline `<style>` blocks in `index.html`, so `theme()` calls placed there would be served raw and break. Placing the bridge in `tailwind.css` ensures PostCSS compiles it correctly:

```css
/* Tailwind token bridge — remove this block when migration is complete */
:root {
  --bg:      theme('colors.bg');
  --bg2:     theme('colors.bg2');
  --bg3:     theme('colors.bg3');
  --bg4:     theme('colors.bg4');
  --text:    theme('colors.text');
  --text2:   theme('colors.text2');
  --text3:   theme('colors.text3');
  --gold:    theme('colors.gold');
  --gold2:   theme('colors.gold2');
  --accent1: theme('colors.accent1');
  --accent2: theme('colors.accent2');
  --green:   theme('colors.green');
  --red:     theme('colors.red');
  --blue:    theme('colors.blue');
  --amber:   theme('colors.amber');
  --radius:  theme('borderRadius.lg');
  --radius-lg: theme('borderRadius.xl');
  --z-base:          theme('zIndex.base');
  --z-sticky:        theme('zIndex.sticky');
  --z-normal:        theme('zIndex.normal');
  --z-backdrop:      theme('zIndex.backdrop');
  --z-overlay:       theme('zIndex.overlay');
  --z-sidebar:       theme('zIndex.sidebar');
  --z-topbar-desktop: theme('zIndex.topbar');
  --z-topbar-mobile: theme('zIndex.topbar-mobile');
  --z-fixed:         theme('zIndex.fixed');
  --z-dropdown:      theme('zIndex.dropdown');
  --z-tooltip:       theme('zIndex.tooltip');
  --z-modal:         theme('zIndex.modal');
}
```

**Exit criteria:** `npm run build` passes. All existing UI still looks identical.

---

## Phase 2 — Shared Component Classes

**Goal:** Define the reusable Tailwind component layer so all panels draw from the same vocabulary. This replaces the hand-rolled `.btn`, `.card`, `.badge`, `.trow` classes in `index.html`.

Add to `tailwind.css`:

```css
@layer components {

  /* ── Cards ── */
  .card {
    @apply relative bg-bg2 rounded-xl border border-white/5 p-4 mb-4;
  }
  .card::before {
    content: '';
    @apply absolute top-0 left-0 right-0 h-px bg-gold-gradient rounded-t-xl opacity-30;
  }
  .card-title {
    @apply text-gold font-extrabold text-base mb-2 font-cinzel;
  }

  /* ── Buttons ── */
  .btn {
    @apply inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg
           font-semibold text-sm cursor-pointer border border-transparent
           transition-opacity active:opacity-70 active:scale-95;
  }
  .btn-gold {
    @apply btn bg-gold-gradient text-bg font-bold;
  }
  .btn-accent {
    @apply btn bg-accent-gradient text-white;
  }
  .btn-red   { @apply btn border-red text-red bg-transparent active:bg-red/15; }
  .btn-green { @apply btn border-green text-green bg-transparent active:bg-green/15; }
  .btn-amber { @apply btn border-amber text-amber bg-transparent active:bg-amber/15; }
  .btn-blue  { @apply btn border-blue text-blue bg-transparent active:bg-blue/15; }

  /* Base button (replaces .base-btn) */
  .base-btn {
    @apply btn bg-bg4 text-text border-white/10;
  }

  /* ── Badges ── */
  .badge {
    @apply inline-flex items-center px-2 py-0.5 rounded-full text-sm font-medium;
  }
  .badge-sm   { @apply badge text-xs py-0 px-1.5; }
  .badge-gold  { @apply badge bg-gold/15 text-gold border border-gold/20; }
  .badge-green { @apply badge bg-green/15 text-green border border-green/20; }
  .badge-blue  { @apply badge bg-blue/15 text-blue border border-blue/20; }
  .badge-red   { @apply badge bg-red/15 text-red border border-red/20; }
  .badge-amber { @apply badge bg-amber/15 text-amber border border-amber/20; }

  /* ── Table Rows ── */
  .trow {
    @apply flex items-center gap-2 py-1.5 border-b border-white/5;
  }
  .trow .name  { @apply flex-1 text-sm text-text; }
  .trow .count { @apply text-sm text-gold font-semibold min-w-[48px] text-right; }

  /* ── Progress Bars ── */
  .prog-wrap { @apply flex-1 min-w-[60px] h-1.5 bg-bg3 rounded-full overflow-hidden; }
  .prog-bar  { @apply h-full rounded-full bg-accent1 transition-all; }
  .prog-bar.eco   { @apply bg-gold; }
  .prog-bar.wep   { @apply bg-red; }
  .prog-bar.arm   { @apply bg-blue; }
  .prog-bar.mil   { @apply bg-amber; }
  .prog-bar.spell { @apply bg-accent1; }
  .prog-bar.mana  { @apply bg-green; }

  /* ── Metrics (resource strip) ── */
  .metric {
    @apply flex flex-col items-center bg-bg2 rounded px-1.5 py-0.5 min-w-[48px];
  }
  .metric .lbl { @apply text-[6.5px] text-text3 uppercase tracking-wider; }
  .metric .val { @apply text-[11px] font-bold text-text; }
  .metric .sub { @apply text-[7px] text-text3; }
  .metric.gold .val  { @apply text-gold; }
  .metric.alert .val { @apply text-red; }

  /* ── Inputs ── */
  .input {
    @apply bg-bg3 border border-white/5 rounded-md px-2 py-1.5 text-text text-sm
           focus:outline-none focus:border-gold/40 transition-colors;
  }

  /* ── Grid layouts ── */
  .two-col   { @apply grid grid-cols-1 lg:grid-cols-2 gap-4; }
  .three-col { @apply grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5; }

  /* ── Nav badge ── */
  .nav-badge {
    @apply absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center
           rounded-full bg-red text-white text-[9px] font-bold px-1;
  }
}
```

After this phase, start replacing class names in `index.html` one section at a time, testing after each group.

**Exit criteria:** All existing classes still work. New Tailwind equivalents defined and tested side by side.

---

## Phase 3 — Global Layout

**Goal:** Replace the structural skeleton in `index.html` — `.app`, `.topbar`, `.sidebar`, `.main`, `.bottom-nav`, panel display system. This is the riskiest structural change and must be done in one coordinated PR.

### App Shell

Use pure fixed positioning — topbar and sidebar are `fixed`, so CSS grid on the parent is redundant (fixed elements are removed from document flow). Keep the layout simple:

```jsx
// App root — no grid needed; children use fixed positioning + margin offset
<div className="min-h-screen bg-bg text-text">
```

### Topbar

```jsx
<header className="fixed top-0 left-0 right-0 h-14 z-topbar-mobile lg:z-topbar bg-bg3 border-b border-white/5 flex items-center px-4 gap-3">
```

### Sidebar (desktop only)

```jsx
<aside className="hidden lg:flex flex-col w-55 fixed top-14 bottom-0 left-0 z-sidebar bg-bg3 border-r border-white/5 overflow-y-auto">
```

### Main content area

```jsx
<main className="pt-14 pb-18 lg:ml-55 lg:pb-4 px-2.5">
```
Note: `pb-18` matches the 72px bottom nav height. `lg:ml-55` offsets the fixed sidebar. Replaces the hardcoded `padding-bottom: 120px` dead zone.

### Bottom nav (mobile only)

```jsx
<nav className="fixed bottom-0 left-0 right-0 z-fixed bg-bg3 border-t border-white/5 flex lg:hidden"
     style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
```

### Panel display system

Replace the CSS variable `--panel-display` approach with a Tailwind-compatible data attribute pattern:

```jsx
// Panel wrapper — hidden by default, shown when active
<div id="status" className="panel hidden data-[active]:block" data-active={isActive || undefined}>
```

In `setActivePanels()` in `main.js`, swap the style.display toggle for a data attribute toggle:

```js
// Before
el.style.display = isActive ? '' : 'none';

// After
if (isActive) el.dataset.active = '';
else delete el.dataset.active;
```

This makes panel visibility a pure CSS/Tailwind concern with no inline style mutation.

**Exit criteria:** Layout is pixel-identical on both mobile and desktop at all existing breakpoints. Smoke test passes.

---

## Phase 4 — React Component Migration

**Goal:** Remove all inline style objects from the 34 React components. Work panel by panel, smallest first.

### Migration order (grouped by complexity)

**Tier 1 — Simple (few inline styles, start here)**
1. `ResourceStrip.jsx` — delta badge animation only
2. `ChangelogPanel.jsx` — minimal styling
3. `SchoolSelectionController.jsx` — invisible watcher, no UI
4. `GoalsPanel.jsx`
5. `OptionsPanel.jsx`
6. `RacesPanel.jsx`
7. `ModeratorManagementPanel.jsx`

**Tier 2 — Medium**
8. `Topbar.jsx`
9. `Sidebar.jsx`
10. `BottomNav.jsx` ← this will be rebuilt in Phase 7 anyway
11. `NewsPanel.jsx`
12. `GlobalchatPanel.jsx`
13. `HappinessPanel.jsx` / `HappinessWidget.jsx` / `HappinessGraph.jsx`
14. `RankingsPanel.jsx`
15. `AlliancesPanel.jsx`
16. `BountiesPanel.jsx`
17. `MarketPanel.jsx`
18. `DefensePanel.jsx`
19. `WorldmapPanel.jsx`
20. `HeroesPanel.jsx`

**Tier 3 — Complex (grid-heavy, many conditional styles)**
21. `StatusPanel.jsx` — unit grid, conditional colors, three stacked cards
22. `EconomyPanel.jsx`
23. `ExplorationPanel.jsx`
24. `HirePanel.jsx` — complex grid columns
25. `ResourcesPanel.jsx`
26. `StudiesPanel.jsx`
27. `TrainingPanel.jsx`
28. `BuildPanel.jsx` — most complex, engineer allocation grid
29. `WarfarePanel.jsx`

**Tier 4 — Modals (isolated, do last)**
30. `SchoolSelectionModal.jsx`
31. `SynergyDetailsModal.jsx`
32. `TestingPanel.jsx`

### Pattern for each component

**Before:**
```jsx
<div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text3)', fontSize: '12px' }}>
```

**After:**
```jsx
<div className="flex items-center gap-2 text-text3 text-sm">
```

### Handling conditional colors

**Before:**
```jsx
style={{ color: Number(state.gold) < 1000 ? 'var(--red)' : undefined }}
```

**After (using clsx):**
```jsx
import clsx from 'clsx';
// ...
className={clsx('text-text', Number(state.gold) < 1000 && 'text-red')}
```

Install clsx: `npm install clsx`

### Handling custom grid columns

Some grids have fixed arbitrary column widths (e.g. `'100px 1fr 52px 52px'` in StatusPanel). Use Tailwind arbitrary values:

```jsx
className="grid gap-1 [grid-template-columns:100px_1fr_52px_52px]"
```

For responsive variants:
```jsx
className="grid gap-1 [grid-template-columns:1fr_auto_40px] lg:[grid-template-columns:100px_1fr_52px_52px]"
```

### Text shadows (no built-in Tailwind utility)

Add to `@layer utilities` in `tailwind.css`:

```css
@layer utilities {
  .text-shadow-gold {
    text-shadow: 0 0 8px rgba(240, 98, 2, 0.3);
  }
  .text-shadow-logo {
    text-shadow: 0 0 10px #ff4500, 0 0 20px #ff8c00;
  }
}
```

### Mouse hover via CSS (replaces onMouseEnter/onMouseLeave inline)

**Before (HappinessWidget.jsx):**
```jsx
onMouseEnter={(e) => e.target.style.background = 'var(--bg3)'}
onMouseLeave={(e) => e.target.style.background = 'none'}
```

**After:**
```jsx
className="hover:bg-bg3 transition-colors cursor-pointer"
// remove onMouseEnter/onMouseLeave entirely
```

---

## Phase 5 — Isolated CSS Files

Each of these files is self-contained and can be migrated independently.

### `happiness.css` (318 lines)

Convert `.happiness-widget`, `.happiness-bar`, `.happiness-bar-fill` variants, `.happiness-event-item` to Tailwind classes directly in the JSX of `HappinessPanel.jsx`, `HappinessWidget.jsx`, `HappinessGraph.jsx`. The `happiness-pulse` animation is already defined in `tailwind.config.js`.

Delete `happiness.css` when done.

### `forum.css`

Convert `.forum-board-card`, `.forum-board-accent`, `.forum-board-name`, `.forum-board-stats` to Tailwind classes in the forum JSX. The accent border is `border-l-[5px] border-gold`.

Delete `forum.css` when done.

### `SchoolSelectionModal.css` / `SynergyDetailsModal.css`

Convert to Tailwind classes inline in the modal JSX. Both are small and self-contained.

### `Portal.css` / `Splash.css`

Migrate last. These are shown pre-login so risk of regression is isolated from the main game UI.

---

## Phase 6 — Panel System Modernization

**Goal:** Clean up any remaining JS-driven style mutations now that Tailwind owns the layout.

### Remove from `main.js`

After Phase 3's data-attribute panel switch:
- Remove all `el.style.display` mutations from `setActivePanels()`
- Remove the `--panel-display` CSS variable and its toggle logic
- Remove `--panel-immersive-display` and `--nav-display` if unused

### Replace `.css-text` injection in `renderLibraryPanel`

`main.js` currently injects HTML with hardcoded `style.cssText` strings for lore cards and progress fills (lines ~387–453). Replace these with Tailwind class names:

```js
// Before
loreDiv.style.cssText = 'padding: 8px; border-left: 3px solid var(--accent1); background: var(--bg2);';

// After
loreDiv.className = 'p-2 border-l-[3px] border-accent1 bg-bg2 rounded';
```

### Scrollbar styling

Move webkit scrollbar overrides to `@layer utilities` in `tailwind.css`. This replaces scattered scrollbar rules across individual CSS files:

```css
@layer utilities {
  .scrollbar-game::-webkit-scrollbar       { width: 6px; height: 6px; }
  .scrollbar-game::-webkit-scrollbar-track { @apply bg-bg3; }
  .scrollbar-game::-webkit-scrollbar-thumb { @apply bg-bg4 rounded; }
}
```

Apply `.scrollbar-game` to `.main`, chat message areas, and any overflow-y scroll containers.

---

## Phase 7 — Mobile Nav Overhaul

Now Tailwind is fully in charge. This is where the mobile plan gets implemented cleanly.

### New BottomNav.jsx

```jsx
import { useActivePanel } from '../../hooks/useActivePanel';

const FIXED_TABS = [
  { id: 'status',      label: 'Status',    icon: '⚔️' },
  { id: 'warfare',     label: 'Warfare',   icon: '🗡️' },
  { id: 'economy',     label: 'Economy',   icon: '💰' },
  { id: 'exploration', label: 'Explore',   icon: '🗺️' },
  { id: 'globalchat',  label: 'Community', icon: '💬' },
];

const BottomNav = () => {
  // useActivePanel must be called at the component level — never inside .map()
  const activeTab = useActivePanel();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreHasBadge, setMoreHasBadge] = useState(false);

  // Bottom nav bar
  return (
<nav className="fixed bottom-0 left-0 right-0 z-fixed bg-bg3 border-t border-white/5 flex lg:hidden"
     style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
  <div className="flex w-full h-16 items-stretch">
    {FIXED_TABS.map(tab => (
      <button
        key={tab.id}
        onClick={() => window.switchTab(tab.id)}
        className={clsx(
          'flex-1 flex flex-col items-center justify-center gap-0.5 text-text3 text-[9px] font-medium',
          'active:opacity-60 active:scale-95 transition-all border-t-2 border-transparent',
          activeTab === tab.id && 'text-gold border-t-gold'
        )}
      >
        <span className="text-lg leading-none">{tab.icon}</span>
        <span>{tab.label}</span>
      </button>
    ))}
    {/* More button */}
    <button
      onClick={() => setDrawerOpen(true)}
      className={clsx(
        'flex-1 flex flex-col items-center justify-center gap-0.5 text-text3 text-[9px] font-medium relative',
        'active:opacity-60 active:scale-95 transition-all border-t-2 border-transparent'
      )}
    >
      <span className="text-lg leading-none">···</span>
      <span>More</span>
      {moreHasBadge && (
        <span className="absolute top-2 right-3 w-2 h-2 rounded-full bg-red" />
      )}
    </button>
  </div>
</nav>

{/* More drawer */}
{drawerOpen && (
  <div className="fixed inset-0 z-overlay" onClick={() => setDrawerOpen(false)}>
    <div
      className="absolute bottom-16 left-0 right-0 bg-bg3 border-t border-white/5 p-4 rounded-t-xl"
      onClick={e => e.stopPropagation()}
    >
      <div className="grid grid-cols-4 gap-3">
        {drawerItems.map(item => (
          <button key={item.id} onClick={() => { window.switchTab(item.id); setDrawerOpen(false); }}
            className="flex flex-col items-center gap-1 p-2 rounded-lg bg-bg2 text-text3 text-[9px] active:bg-bg4">
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  </div>
)}
```

### Landscape guard

Update the Tailwind config's `lg` breakpoint to include height guard:

Since Tailwind doesn't support `min-height` in media queries natively, add this to `tailwind.css`:

```css
@layer utilities {
  /* Override desktop layout for landscape phones (short screens) */
  @media (min-width: 768px) and (max-height: 500px) {
    .sidebar { display: none !important; }
    .bottom-nav { display: flex !important; }
    .main { margin-left: 0 !important; }
  }
}
```

---

## Phase 8 — QA & Dead CSS Removal

### Checklist before deleting `index.html` `<style>` block

- [ ] All 34 React components have zero inline style objects (exceptions: truly dynamic values like animation percentages, `env(safe-area-inset-bottom)`)
- [ ] All 5 isolated CSS files deleted
- [ ] Panel display system uses data attributes, no `style.display` mutations
- [ ] All `var(--*)` references removed from JSX (grep: `var\(--`)
- [ ] All `window.updateBuildDisplay` / `style.cssText` mutations in main.js replaced
- [ ] Tailwind token bridge block in `index.html` removed
- [ ] `npm run build` produces zero CSS from the old stylesheet

### Grep cleanup commands

```bash
# Find any remaining CSS variable references in JSX
grep -r "var(--" client/src/

# Find remaining inline style objects
grep -r "style={{" client/src/components/react/

# Find remaining onMouseEnter style mutations
grep -r "e.target.style" client/src/

# Find remaining style.cssText
grep -r "style.cssText" client/src/
```

### Browser test matrix

| Device | Browser | Portrait | Landscape |
|--------|---------|----------|-----------|
| iPhone 12+ | Safari | ✓ | ✓ |
| Pixel 6 | Chrome | ✓ | ✓ |
| iPad | Safari | ✓ | ✓ |
| Desktop 1080p | Chrome | ✓ | — |
| Desktop 1440p | Chrome | ✓ | — |

### Performance

After Tailwind PurgeCSS runs in production build, the CSS bundle should be dramatically smaller than the current 28,000-line `index.html` stylesheet. Verify with:

```bash
npm run build
ls -lh dist/assets/*.css
```

Target: < 30KB gzipped for the CSS bundle.

---

## PR Sequence

| PR | Phase | Contents |
|----|-------|----------|
| 1 | 0 | Install, tailwind.config.js, tailwind.css entry, token bridge |
| 2 | 1–2 | Design token bridge + shared component @layer classes |
| 3 | 3 | Global layout (app shell, topbar, sidebar, main, bottom nav, panel system) |
| 4–6 | 4 | React components Tier 1 + Tier 2 (one PR per 5–7 components) |
| 7–8 | 4 | React components Tier 3 + Tier 4 |
| 9 | 5 | Isolated CSS files deleted |
| 10 | 6 | Panel system cleanup, main.js cssText removal |
| 11 | 7 | Mobile nav overhaul + landscape guard |
| 12 | 8 | Dead CSS removal, final grep audit |

No single PR changes more than one phase. Phase 3 (global layout) is the one PR that requires the most review — treat it as a mandatory hold point before proceeding.
