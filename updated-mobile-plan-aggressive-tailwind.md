# Narmir Reborn - Aggressive Tailwind Mobile Rollout Plan

**Goal**: Fully modernize the UI with Tailwind CSS, achieve excellent mobile experience, and lock in a clean, consistent design system while completing the vanilla → React transition.

**Philosophy**: All-in on Tailwind. Utility-first, design tokens, component composition, and minimal custom CSS.

---

## Phase 0: Tailwind Setup (Do This First - Right After Vanilla Removal)

1. Install Tailwind + dependencies
   ```bash
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

2. Configure `tailwind.config.js` (aggressive version)
   - Dark fantasy theme (deep blacks, blood reds, arcane purples, gold accents)
   - Custom design tokens for game elements (resources, happiness levels, race colors, etc.)
   - Extend spacing, typography, and shadows for strategy game feel

3. Update `vite.config.js` and main CSS entry
4. Remove or drastically reduce the old `<style>` block in `index.html`
5. Create a design system:
   - `src/styles/design-system.css` or use `@layer` in Tailwind
   - `src/components/ui/` folder for reusable components (Button, Panel, Modal, ResourceBar, etc.)

**Expected Time**: 1-2 days

---

## Phase 1: Bottom Navigation Overhaul (Highest Priority)

Replace the horrible 28-item horizontal nav with a clean, Tailwind-powered mobile-first nav.

**New Design**:
- 5-6 core tabs at bottom (always visible)
- "More" drawer/sheet for secondary panels
- Use Tailwind for:
  - Responsive grid/flex
  - Touch-friendly sizing (`active:scale-95`, hover effects)
  - Color-coded icons based on active state
  - Safe-area padding (`pb-safe`)

**Implementation**:
- Create `BottomNav.jsx` using Tailwind utilities heavily
- Use React state + context for active tab
- Add swipe gestures if possible (optional)

---

## Phase 2: Global Layout & Responsive Foundation

- Wrap main game in a Tailwind container with proper mobile constraints
- Use `md:`, `lg:`, `xl:` prefixes aggressively
- Implement consistent panel styling:
  ```jsx
  <div className="bg-zinc-950 border border-amber-900/50 rounded-xl p-4 shadow-2xl">
  ```
- Status bar / resource bars become highly responsive grids

---

## Phase 3: Individual Panel Modernization

Convert remaining panels one by one using Tailwind:
- Kingdom Overview
- Buildings / Engineers
- Military / Combat
- Expeditions
- Magic / Research
- Happiness Panel (make the breakdown beautiful)
- Chat

**Pattern**: Create reusable UI components in `src/components/ui/` (Card, StatRow, ProgressBar, etc.)

---

## Phase 4: Polish & Mobile-Specific Enhancements

- Touch feedback everywhere (`active:scale-95 transition-transform`)
- Safe area insets for iPhone (`pb-[env(safe-area-inset-bottom)]`)
- Landscape mode support
- Performance: `React.memo`, proper key usage, minimize re-renders
- Dark mode (already native with Tailwind)
- Loading states, skeletons, micro-animations (via Tailwind + framer-motion later)

---

## Recommended Folder Structure (Aggressive)

```
src/
├── components/
│   ├── ui/              # Reusable Tailwind components
│   ├── game/            # Game-specific panels
│   └── layout/          # Nav, Sidebar, etc.
├── hooks/
├── utils/
├── lib/
├── styles/
│   └── design-system.css
└── App.jsx
```

---

## Benefits of This Aggressive Approach

- Extremely fast iteration once set up
- Perfect consistency across desktop + mobile
- Much easier to maintain long-term
- Professional, polished look that matches the game's depth
- Significantly better mobile experience (your #1 goal)

---

## Testing Checklist

- iOS Safari (iPhone 12+)
- Chrome on Android
- Landscape orientation
- Low-end device performance
- Touch targets (min 44px)
- One-handed use
- Dark mode consistency

---

**Next Step Recommendation**:
Start with Phase 0 this week. Once Tailwind is running, converting panels becomes addictive and fast.

---

Let me know when you're ready and I can generate:
- The full `tailwind.config.js` with fantasy theme
- Sample `BottomNav.jsx`
- A reusable `GamePanel` component example
