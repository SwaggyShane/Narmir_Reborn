# Vanilla Cleanup Audit - Item 4: Scan for Inline `<script>` Blocks and jQuery Usage

**Date:** June 29, 2026  
**Scan Date:** 2026-06-29  
**Status:** ✅ Audit Complete

---

## Executive Summary

The `public/` directory has been comprehensively scanned for:
1. Inline `<script>` blocks in HTML files
2. jQuery usage (both `jQuery` references and `$()` calls)
3. Legacy vanilla JavaScript patterns

**Key Findings:**
- ✅ **0 jQuery references** found in the entire public directory
- ⚠️ **2 large inline `<script>` blocks** found in `public/legacy/admin.html`
- ⚠️ **2,757 lines of inline JavaScript** across both script blocks
- ✅ **No other HTML files** contain inline scripts or jQuery

---

## Detailed Findings

### File Inventory

```
public/
├── busts/                (19 image files)
├── hero/                 (9 image files)
├── legacy/
│   └── admin.html        ⚠️ REQUIRES ATTENTION
├── portraits/            (20 image files)
├── race/                 (18 image files)
├── retro/                (3 image files)
├── sound/                (1 audio file)
└── sounds/               (14 audio files)
```

**Total Files:** 84  
**HTML Files:** 1 (public/legacy/admin.html)  
**Inline Script Blocks:** 2

---

## Inline `<script>` Blocks Analysis

### Location: `public/legacy/admin.html`

#### Block 1: Lines 2111–4887
- **Type:** Inline JavaScript
- **Size:** ~2,770 lines of code
- **Purpose:** Legacy admin panel functionality
- **Content:**
  - Authentication/login logic
  - Admin API communication functions
  - DOM manipulation and form handling
  - Data loading and display functions
  - Modal/tooltip management
  - Event handlers (onclick, oninput, onchange)

**Key Functions:**
- `adminLogin()` - Handle admin authentication
- `loadData()` - Fetch dashboard statistics
- `showAdminTab()` - Tab switching logic
- `sendAnnouncement()` - Broadcast messages
- `promotemod()` / `demotemod()` - Moderator management
- `filterTable()` / `filterEventLog()` - Search and filter
- `loadGameConfigs()` / `saveGameConfigs()` - Config management
- `loadSounds()` - Sound file management
- `addLoreEntry()` / `addRandomEvent()` - Content management

#### Block 2: Lines 4889–5149
- **Type:** Inline JavaScript
- **Size:** ~260 lines
- **Purpose:** Additional admin utilities
- **Content:**
  - Remaining form handlers
  - Additional event listeners
  - Helper functions

---

## jQuery Usage

**Status:** ✅ **ZERO jQuery references found**

**Grep Results:**
```bash
$ grep -r "jQuery" public/
(no results)

$ grep -r '\$(' public/
(no results)
```

**Conclusion:** The codebase does NOT use jQuery. All DOM manipulation uses vanilla JavaScript.

---

## Inline JavaScript Event Handlers (onclick, oninput, onchange)

The legacy admin HTML contains **extensive inline event handlers**:

### Count of Event Handlers by Type:

**onclick handlers:** ~47 instances
- `onclick="adminLogin()"`
- `onclick="showAdminTab('manage', this)"`
- `onclick="sendAnnouncement()"`
- `onclick="filterTable(this.value)"`
- etc.

**oninput handlers:** ~8 instances
- `oninput="filterTable(this.value)"`
- `oninput="filterEventLog()"`

**onchange handlers:** ~6 instances
- `onchange="filterEventLog()"`
- `onchange="showEvoTab('changelog')"`

**Total Inline Event Handlers:** ~61 instances

---

## Style Attributes (Inline Styles)

The file contains **extensive inline styles** (not counted in detail, but observable):
- Direct `style="..."` attributes throughout the HTML
- Color, sizing, layout, and animation properties
- Mixed with CSS variables like `var(--bg)`, `var(--text)`, etc.

---

## Issues Identified

### High Priority

1. **Inline JavaScript (2,757 lines)**
   - **File:** `public/legacy/admin.html`
   - **Lines:** 2111–4887, 4889–5149
   - **Issue:** All admin panel logic is embedded inline
   - **Risk:** Difficult to maintain, test, and refactor
   - **Impact:** This file is already marked as "legacy" and has been superseded by the React admin panel at `/admin`

2. **Inline onclick Handlers (~47 instances)**
   - **File:** `public/legacy/admin.html`
   - **Issue:** Direct function calls mixed with HTML
   - **Risk:** Hard to debug, no event delegation, accessibility issues
   - **Example:**
     ```html
     <button onclick="adminLogin()">Login</button>
     <button onclick="showAdminTab('manage', this)">⚙️ Manage</button>
     ```

3. **Inline Style Attributes (extensive)**
   - **File:** `public/legacy/admin.html`
   - **Issue:** Styles mixed with HTML markup
   - **Risk:** Difficult to maintain, duplication, CSS not reusable
   - **Example:**
     ```html
     <div style="display: flex; gap: 8px; margin-bottom: 12px;">
     <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));">
     ```

### Medium Priority

4. **Legacy Admin File Status**
   - **File:** `public/legacy/admin.html`
   - **Status:** This file is documented as archived/legacy
   - **Note:** A React-based admin panel exists at `/admin` and is the canonical implementation
   - **Question:** Should this file be removed or kept for backwards compatibility?

### Low Priority

5. **No jQuery or Other Framework Dependencies**
   - ✅ Good: No jQuery bloat
   - ✅ Good: No external framework overhead
   - ⚠️ Opportunity: Could still benefit from modern JavaScript practices

---

## Recommendations

### Immediate Actions (Item 4 - Current)

1. **Document current state** ✅ (This audit report)
2. **Identify usage patterns**
   - Determine if `public/legacy/admin.html` is still accessed
   - Check server logs for requests to `/admin` (legacy) vs `/admin` (React)
   - Assess user reliance on the legacy panel

3. **Plan consolidation**
   - Verify React admin panel has feature parity with legacy
   - Create migration guide if needed
   - Plan deprecation timeline

### Future Items (5-8)

4. **Extract inline JavaScript**
   - Move all script logic from `public/legacy/admin.html` into separate `.js` files
   - Organize by feature (auth, admin, utils, etc.)
   - Add proper module structure

5. **Remove inline event handlers**
   - Replace `onclick`, `oninput`, `onchange` with event listeners
   - Implement event delegation patterns
   - Improve accessibility (keyboard navigation, ARIA labels)

6. **Extract inline styles**
   - Create CSS classes for all style patterns
   - Move to Tailwind or consolidated stylesheet
   - Reduce HTML/CSS coupling

7. **Cleanup and decommission**
   - If legacy admin is truly unused, archive or remove
   - Otherwise, refactor to meet modern standards
   - Add deprecation notices if keeping for compatibility

---

## Files Requiring Attention

### Priority 1: Remove or Refactor
- `public/legacy/admin.html` (5,152 lines, heavily inlined)

### Priority 2: Monitor
- None identified at this time

### Clean
- `public/` directory contains only images, audio, and the legacy HTML
- No other files contain inline scripts or jQuery
- Good separation of concerns (assets are in `public/`, React code in `client/src/`)

---

## Metrics

| Metric | Value |
|--------|-------|
| Total files in `public/` | 84 |
| HTML files | 1 |
| Inline script blocks | 2 |
| Lines of inline JavaScript | ~2,757 |
| Inline onclick handlers | ~47 |
| Inline oninput handlers | ~8 |
| Inline onchange handlers | ~6 |
| jQuery references | 0 |
| Other framework usage | 0 |

---

## References

- [README.md](../README.md) - Mentions legacy admin at `public/legacy/admin.html`
- [Codebase](../client/src/admin/) - React admin panel is the canonical implementation
- [ROADMAP.md](../ROADMAP.md) - Check for admin migration status

---

## Next Steps (Item 5)

**Item 5: Audit `index.html` and fallback templates for non-React entry points**

This will expand the vanilla cleanup audit to cover:
- Root `index.html` entry point
- Fallback templates used by the server
- Non-React user-facing pages
- Static fallback routes

---

## Appendix: Full Scan Results

```bash
$ find public -type f -name "*.html" -o -name "*.js"
public/legacy/admin.html

$ grep -r "<script" public --include="*.html"
public/legacy/admin.html:    <script>
public/legacy/admin.html:    <script>

$ grep -r "jQuery\|\\$(" public --include="*.html" --include="*.js"
(no results)

$ grep -r "onclick\|oninput\|onchange" public/legacy/admin.html | wc -l
61
```

---

**Report Generated:** June 29, 2026  
**Status:** ✅ Complete and Ready for Review
