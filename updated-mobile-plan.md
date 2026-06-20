# Narmir Reborn - Mobile UI Rollout Plan (Updated with Tailwind)

## Current Situation
The UI is currently "all over the place" due to the ongoing vanilla → React migration. Mobile experience is poor (especially the 28-item horizontal bottom nav).

**Goal**: Create a clean, responsive, touch-friendly mobile experience while keeping desktop fully functional.

---

## Recommended Tech Stack Change

**Add Tailwind CSS** (Strongly Recommended)

### Why Tailwind?
- Extremely fast development during React migration
- Built-in responsive design (`sm:`, `md:`, `lg:`, etc.)
- Consistent dark fantasy theme
- Easy maintenance long-term
- Excellent mobile utilities

### Phase 0: Tailwind Setup (Do this first after vanilla removal)

1. Install Tailwind:
   ```bash
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init -p
   ```

2. Update `tailwind.config.js`:
   ```js
   /** @type {import('tailwindcss').Config} */
   export default {
     content: [
       "./client/src/**/*.{js,jsx,ts,tsx}",
     ],
     darkMode: 'class', // or 'media'
     theme: {
       extend: {
         colors: {
           // Your dark fantasy palette
           void: '#0a0a0a',
           blood: '#991b1b',
           arcane: '#6b21a8',
           // etc.
         }
       },
     },
     plugins: [],
   }
   ```

3. Add Tailwind directives to your main CSS file.

---

## Updated Phased Rollout

### Phase 1: Bottom Navigation Overhaul (Highest Priority)

- Replace the massive 28-item horizontal nav with a clean **6–8 tab bottom nav** (icons + labels).
- Use Tailwind for responsive layout (`fixed bottom-0`, flex, etc.).
- "More" drawer for less frequently used panels.
- Touch-friendly tap targets (minimum 44px).

**Tailwind Approach**:
```jsx
<div className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 md:hidden">
  <div className="flex justify-around items-center h-16">
    {/* Tab buttons with Tailwind classes */}
  </div>
</div>
```

### Phase 2: Responsive Layout Foundation

- Use Tailwind responsive prefixes everywhere (`md:`, `lg:`).
- Main game container: `max-w-7xl mx-auto` on desktop, full-width on mobile.
- Status bar / resource bar: Grid or flex that stacks nicely on mobile.
- Panels: Use `grid` and `flex` with responsive columns.

### Phase 3: Touch & Mobile Polish

- Add proper `:active` states and tap feedback.
- Fix dead zones (extra padding at bottom).
- Support landscape mode.
- Safe area insets for iPhone notch:
  ```css
  padding-bottom: env(safe-area-inset-bottom);
  ```

### Phase 4: Component & Style Migration

- Convert remaining inline styles and old CSS to Tailwind classes.
- Create reusable components (e.g. `Panel`, `ResourceBar`, `ActionButton`).
- Use `clsx` + `tailwind-merge` for conditional classes.

### Phase 5: Advanced Mobile Features

- Offline indicators
- Swipe gestures (optional, low priority)
- Performance optimization (memoization on panels)
- Mobile-specific onboarding tips

---

## Best Practices with Tailwind

- Use `clsx` helper for conditional styling.
- Keep class strings readable (group related classes).
- Create common utility components.
- Use arbitrary values when needed (`[44px]`, etc.).
- Maintain a design system in `tailwind.config.js`.

## Testing Checklist

- iOS Safari (iPhone 12+)
- Chrome on Android
- Portrait + Landscape
- Low-end device performance
- Dark mode
- Touch vs mouse
- Screen reader basics

---

## Priority Order

1. Complete vanilla → React migration
2. Phase 0: Add Tailwind
3. Phase 1: New Bottom Navigation
4. Phase 2 + 3: Responsive + Touch polish
5. Final cleanup

---

**This plan keeps risk low while delivering a big mobile UX improvement.**

Let me know if you want code examples for specific components (BottomNav, StatusBar, etc.).
