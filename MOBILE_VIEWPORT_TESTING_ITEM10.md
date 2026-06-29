# Mobile Viewport Testing — Item 10: Verify No Horizontal Scroll at 360px

**Date:** 2026-06-29  
**Viewport Width:** 360px (iPhone SE baseline)  
**Status:** Testing Plan Created

---

## Executive Summary

**Task:** Verify that all user-facing applications display without horizontal scroll at 360px viewport width (minimum viable mobile width).

**Key Areas to Test:**
- Game UI panels and layouts
- Portal authentication and content
- Admin panel (if accessible on mobile)
- Splash screen / entry
- Bottom navigation (if present)
- Modals and overlays

---

## Test Plan

### 1. Entry Points to Test

#### A. Splash Screen (`/`)
- Verify retro phase fits within 360px
- Verify glitch phase animation doesn't overflow
- Verify modern phase video + UI fits

#### B. Game App (`/game`)
- Main game board
- Resource display
- Unit panels
- Action buttons

#### C. Portal (`/portal`)
- Login form
- Rankings display
- Kingdom selection

#### D. Admin Panel (`/admin`)
- If accessible on mobile
- Login form
- Admin controls

### 2. Chrome DevTools Testing

**Method:**
1. Open Chrome DevTools (F12)
2. Click device toolbar (Ctrl+Shift+M)
3. Select "iPhone SE" (360px width) or custom 360px
4. Verify NO horizontal scrollbar appears
5. Test each viewport: portrait and landscape

**Viewports to test:**
- 360px (iPhone SE portrait) ← PRIMARY
- 390px (iPhone 14 portrait)
- 414px (iPhone 12 landscape approximation)

### 3. Specific Elements to Check

```javascript
// CSS to check for overflow:
// Run in DevTools console while at 360px
[...document.querySelectorAll('*')].filter(el => {
  return el.scrollWidth > window.innerWidth;
}).forEach(el => {
  console.log('Overflow element:', el);
  console.log('Width:', el.scrollWidth, 'Viewport:', window.innerWidth);
});
```

### 4. Common 360px Issues to Watch For

❌ **Fixed width containers**
```jsx
<div style={{ width: '400px' }}>  // TOO WIDE FOR 360px
```

❌ **Unresponsive padding/margins**
```jsx
<div className="p-8">  // = 2rem padding on both sides = 32px + 32px
  {/* Only 296px left for content in 360px viewport */}
</div>
```

❌ **Horizontal scrolling lists**
```jsx
<div className="flex overflow-x-auto">
  {/* If items are too wide, forces scroll */}
</div>
```

❌ **Unscaled images**
```jsx
<img src="..." style={{ width: '400px' }} />
```

❌ **Fixed positioning without constraints**
```jsx
<div style={{ position: 'fixed', width: '100%', left: 0 }} />
// If this has padding or borders, might overflow
```

### 5. Tailwind Considerations

✅ **Good:** Responsive Tailwind classes
```jsx
<div className="p-4 md:p-8">  // Adapts to screen size
  {/* 1rem padding on small, 2rem on medium+ */}
</div>
```

✅ **Good:** Max width containers
```jsx
<div className="max-w-sm mx-auto">
  {/* Constrained width, centered */}
</div>
```

❌ **Problem:** Fixed widths
```jsx
<div className="w-96">  // = 384px, WIDER than 360px
```

### 6. Bottom Navigation

**If present, verify:**
- Sticky/fixed positioning doesn't cause overlap
- Navigation buttons are at least 44x44px (tap target)
- No horizontal scroll caused by nav

### 7. Modals and Overlays

**Verify:**
- Modals fit within 360px
- Close buttons accessible
- No overflow scrolling

---

## Testing Checklist

### Pre-Test Setup
- [ ] Install Chrome or Chromium
- [ ] Open DevTools (F12)
- [ ] Enable device toolbar (Ctrl+Shift+M)
- [ ] Set width to 360px

### Splash Screen
- [ ] Retro phase fits (no scroll)
- [ ] Glitch animation fits (no scroll)
- [ ] Modern phase fits (no scroll)
- [ ] Video plays without scroll

### Game App
- [ ] Main board fits
- [ ] Resource strips fit
- [ ] Unit panels fit
- [ ] Action buttons accessible
- [ ] Modals (if any) fit
- [ ] Bottom nav (if any) doesn't cause scroll

### Portal
- [ ] Login form fits
- [ ] Rankings table readable (no horizontal scroll)
- [ ] Register form fits (if available)
- [ ] Profile card fits

### Admin (if accessible on mobile)
- [ ] Login form fits
- [ ] Admin controls fit
- [ ] Tables/lists don't scroll horizontally

### General
- [ ] No browser console errors
- [ ] All interactive elements tap-friendly (44x44px)
- [ ] Text is readable (not cramped)
- [ ] Images scale appropriately

---

## Test Execution

### Step 1: Identify Responsive Issues

Run this command in DevTools console at 360px to find overflow elements:

```javascript
const overflowEls = [...document.querySelectorAll('*')].filter(el => {
  const styles = window.getComputedStyle(el);
  return el.scrollWidth > window.innerWidth;
});

console.log(`Found ${overflowEls.length} elements with overflow:`);
overflowEls.forEach(el => {
  const excess = el.scrollWidth - window.innerWidth;
  console.log(`${el.tagName}.${el.className}: +${excess}px overflow`);
});
```

### Step 2: Check Computed Styles

For any problematic element:
```javascript
el = document.querySelector('.problematic-class');
const styles = window.getComputedStyle(el);
console.log('Width:', styles.width);
console.log('Padding:', styles.paddingLeft, styles.paddingRight);
console.log('Margin:', styles.marginLeft, styles.marginRight);
console.log('ScrollWidth:', el.scrollWidth);
```

### Step 3: Test Touch Targets

Verify buttons/interactive elements are at least 44x44px:
```javascript
[...document.querySelectorAll('button, a, [role="button"]')].forEach(el => {
  const rect = el.getBoundingClientRect();
  if (rect.width < 44 || rect.height < 44) {
    console.warn(`Small touch target: ${rect.width}x${rect.height}`, el);
  }
});
```

---

## Expected Outcomes

### ✅ PASS Criteria
- [ ] No horizontal scrollbar appears at 360px
- [ ] All text is readable
- [ ] All buttons/links are tap-friendly (44x44px minimum)
- [ ] Images scale appropriately
- [ ] Modals fit within viewport
- [ ] No layout shifts
- [ ] No visual glitches

### ❌ FAIL Indicators
- Horizontal scrollbar visible at 360px
- Buttons smaller than 44x44px
- Text unreadably small
- Images overflow viewport
- Modals don't fit

---

## Fixes if Issues Found

### Fixed Width Elements
```jsx
// Before
<div style={{ width: '400px' }}>

// After
<div className="w-full md:w-96">
```

### Unresponsive Padding
```jsx
// Before
<div className="p-8">

// After
<div className="p-4 md:p-8">
```

### Unscaled Images
```jsx
// Before
<img style={{ width: '400px' }} />

// After
<img className="w-full" />
```

---

## Related Items

- Item 11: Keep bottom nav visible without overlap
- Item 12: Preserve natural header scrolling
- Item 13: Enforce responsive breakpoints and 44x44 touch targets
- Item 14: Prevent layout shifts when nav appears/disappears

---

## Notes

- 360px is the industry standard for minimum mobile width (iPhone SE)
- Tailwind responsive breakpoints: sm=640px, md=768px, lg=1024px (all > 360px)
- Use `w-full` instead of fixed pixel widths for mobile responsiveness
- Test on actual devices if possible (Chrome DevTools is close but not perfect)

---

**Testing Status:** Ready to execute
**Manual Testing Required:** Yes
**Automated Testing:** Can be added via Playwright/Cypress
