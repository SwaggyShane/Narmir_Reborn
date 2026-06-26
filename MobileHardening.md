# Narmir Reborn Mobile Hardening Guide

**Goal**: Excellent mobile experience with **maximum content space**. Only the bottom nav is fixed. Everything else scrolls naturally.

## Core Layout Principles (Mobile-First)
- **Single column, full-height app feel** on small screens.
- Use React + Tailwind responsive classes (`md:`, etc.) to switch to desktop layout (sidebar, etc.).
- **Only BottomNav is `fixed`**. No other `sticky` elements.

### Recommended Shell Structure
```jsx
<div className="flex flex-col h-screen overflow-hidden md:overflow-visible">
  {/* Scrollable header — NO sticky */}
  <header className="flex-shrink-0 border-b p-3 md:p-4 bg-background">
    {/* Resource meter + Kingdom header (Stieny of Stolice, Turn/Score/XP, etc.) */}
    {/* Keep compact on mobile: smaller text, tight padding, icons */}
  </header>

  {/* Main scrollable content — everything scrolls together */}
  <main className="flex-1 overflow-y-auto p-3 md:p-6 pb-20">  {/* pb-20 clears fixed nav */}
    {/* Panels, Market cards, etc. */}
  </main>

  {/* ONLY fixed element */}
  <BottomNav className="fixed bottom-0 left-0 right-0 z-50 md:hidden" />
</div>
```
