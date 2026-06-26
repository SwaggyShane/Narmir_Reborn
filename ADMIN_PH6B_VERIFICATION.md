# Admin Panel Phase 6b — Hard Cutover Verification Checklist

**Purpose:** Verify all admin tabs work correctly before hard cutover (removing legacy fallback, archiving `public/admin.html`).

**Precondition:** React admin (Ph6a) is live at `/admin`. Legacy fallback at `/admin?legacy=1` still works.

**Exit criteria:** All 14 items below checked ✅ on staging/local environment.

---

## Verification Matrix

| # | Area | Action | Expected Result | Status |
|---|------|--------|-----------------|--------|
| **1** | **Manage** | Send test announcement (or dry-run cancel) | Toast confirmation; no errors in console | ☐ |
| **2** | **Manage** | Promote player to admin | Confirm dialog; success toast | ☐ |
| **3** | **Kingdoms** | Edit kingdom scalar field (name, level, gold) | Save succeeds; field updates in table | ☐ |
| **4** | **Kingdoms** | Apply AI preset to AI kingdom | Preset applied; toast shows success | ☐ |
| **5** | **Events** | Load event log | Log displays without errors; filter by season works | ☐ |
| **6** | **Events** | Open event create form | Form renders; effect/race selects work | ☐ |
| **7** | **Config** | Load config | All keys display; expandable sections work | ☐ |
| **8** | **Config** | Edit one key override | Save succeeds; override persists | ☐ |
| **9** | **Sounds** | List sounds category | Sounds grid displays without errors | ☐ |
| **10** | **Prestige** | View prestige reference table | Static table renders correctly | ☐ |
| **11** | **Lore** | Load lore list + add new lore entry | Modal opens; save works | ☐ |
| **12** | **Evolution** | Load wishlist + changelog + admin notes | All three tabs render; notes load from API | ☐ |
| **13** | **Detailed Lists** | View Fragments + Spells sub-tabs | Both tabs load; data displays | ☐ |
| **14** | **Goals** | Load goals grid; add/edit goal | Modal opens; CRUD operations work | ☐ |
| **15** | **Security** | Run security audit | Audit completes; CSRF token sent; findings table displays | ☐ |
| **16** | **Auth** | Logout + re-login | Redirect to login screen; re-auth succeeds; session restored | ☐ |
| **17** | **Fallback** | Visit `/admin?legacy=1` | Legacy HTML admin loads; still functional | ☐ |

---

## Test Environment Setup

1. Start server: `DATABASE_URL="..." JWT_SECRET="..." node index.js`
2. Login to admin: `/admin`
3. Run through checklist items sequentially
4. Document any failures or deviations

---

## Known Risks

| Risk | Mitigation |
|------|-----------|
| Browser cache serving old React bundle | Clear cache; hard reload (Ctrl+Shift+R) |
| Stale admin token | Logout + re-login for each session |
| API CSRF failures | Ensure `adminFetch` includes CSRF header (should be automatic) |
| Mobile responsiveness | Test on 360px width viewport (use DevTools) |

---

## Post-Verification Actions (if ✅ all pass)

1. Commit: "docs: admin ph6b verification matrix complete"
2. Create PR #60x with this checklist as proof
3. Merge PR
4. Then proceed with Ph6b cutover:
   - Remove `?legacy=1` flag support
   - Archive `public/admin.html` → `public/legacy/admin.html`
   - Update `serveAdmin()` in `index.js` to remove fallback
   - Update README.md admin section

---

*Document version: 1.0 — 2026-06-26*
