# Narmir Reborn — Mobile Hardening + Vanilla JS Audit

**Date**: June 2026  
**Focus**: Max content space on mobile (only bottom nav fixed) + finish React migration.

---

## 1. Mobile Hardening (Core Rules)

**Goal**: Excellent mobile experience with **maximum content space**. Only the bottom nav is fixed. Everything else scrolls naturally.

### Principles (Mobile-First)
- **Single column, full-height app feel** on small screens.
- Use React + Tailwind responsive classes (`md:`, etc.) to switch to desktop layout (sidebar, etc.).
- **Only BottomNav is `fixed`**. No other `sticky` elements.
- Header scrolls away naturally (not sticky).
- All content scrolls as a single unified stream.
- Bottom nav is always accessible (fixed, visible above content via `pb-20` padding).

### Root Layout — Copy-Paste Ready

```jsx
<div className="flex flex-col h-screen overflow-hidden md:overflow-visible">
  {/* Scrollable header — NO sticky */}
  <header className="flex-shrink-0 border-b p-3 md:p-4 bg-background">
    {/* Resource meter + Kingdom header (Stieny of Stolice, Turn/Score/XP, etc.) */}
    {/* Keep compact on mobile: smaller text, tight padding, icons */}
  </header>

  {/* Main scrollable content — everything scrolls together */}
  <main className="flex-1 overflow-y-auto p-3 md:p-6 pb-20">
    {/* Panels, Market cards, etc. */}
    {/* pb-20 clears fixed bottom nav */}
  </main>

  {/* ONLY fixed element */}
  <BottomNav className="fixed bottom-0 left-0 right-0 z-50 md:hidden" />
</div>
```

### Mobile-Only Optimizations
- **Typography**: Use smaller text on mobile (e.g., `text-xs md:text-sm`)
- **Spacing**: Tighter padding on mobile (`p-3`) → relaxed on desktop (`md:p-6`)
- **Icons**: Prefer icons over text labels in nav items
- **Touch targets**: Min 44px × 44px for interactive elements
- **Viewport**: `<meta name="viewport" content="width=device-width, initial-scale=1.0">`

---

## 2. Vanilla JS Audit (React Migration Completion)

**Status**: Identify remaining vanilla JS that should be React, and flag problematic patterns.

### Scope
- [ ] Scan `public/` for HTML files with inline `<script>` blocks (legacy patterns)
- [ ] Check for jQuery usage (should be gone; flag if found)
- [ ] Audit `index.html` and fallback HTML templates for non-React entry points
- [ ] Verify all user-facing routes go through React (not vanilla JS templates)

### Known Vanilla JS (Intentional)
- `public/retro/*` — Splash screen (CSS-only glitch effect, no logic)
- Admin legacy fallback (archived, no longer in use post-Ph6b)
- Inline event handlers in legacy portal template (being phased out)

### Action Items
- [ ] Convert any remaining vanilla form handlers → React controlled components
- [ ] Replace inline `<style>` tags in templates → Tailwind utilities
- [ ] Remove inline `onclick` handlers → React event binding
- [ ] Consolidate CSS files used by vanilla templates → single Tailwind source

---

## 3. Integration Checklist

Before shipping mobile + React refinements:

- [ ] Mobile layout: No horizontal scroll at 360px width
- [ ] Bottom nav: Always visible, not overlapping content (pb-20 padding verified)
- [ ] Header: Scrolls away naturally (no sticky positioning)
- [ ] React: All user-facing routes use React components (no vanilla templates)
- [ ] Tailwind: Responsive breakpoints (`md:`, `lg:`) applied consistently
- [ ] Touch targets: Min 44px × 44px for all buttons/nav items
- [ ] Performance: No layout shifts when nav appears/disappears

---

## 4. Testing

**Mobile (360px–600px):**
1. Tap bottom nav items — no scroll jump
2. Scroll up header — scrolls away smoothly
3. Tap a button in content — responds without delay
4. Rotate device — layout adjusts, no overflow

**Desktop (md breakpoint):**
1. Navigation changes (sidebar or tabs visible)
2. Padding/spacing relaxes as per design
3. Content width adjusts (multi-column if applicable)

---

## Reference

- **Tailwind breakpoints**: `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`
- **Safe padding for nav**: `pb-20` = 5rem = ~80px (accounts for nav height + margin)
- **Z-index hierarchy**: nav=50, modals=60, tooltips=70
