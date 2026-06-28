# Security Audit Report - Narmir Reborn

**Date:** 2026-06-28  
**Branch:** `claude/security-audit-vulnerabilities`  
**Status:** In Progress

## Overview

This document tracks security vulnerabilities and audit findings for the Narmir Reborn codebase. Work is organized by severity and category.

---

## 1. SQL Injection

### Status: ✅ PASS (No immediate issues)

**Findings:**
- All database queries use parameterized queries with `?` placeholders
- No string concatenation in SQL queries detected
- Parameter binding appears consistent across `game/engine.js`, `game/world.js`, `game/sockets.js`

**Examples of good practices found:**
```javascript
const freshK = (await db.get("SELECT * FROM kingdoms WHERE id = ?", [k.id])) || k;
await db.run("UPDATE kingdoms SET ${cols} WHERE id = ?", [...vals, k.id]);
```

**Risk Level:** LOW - Current query patterns are safe.

---

## 2. Cross-Site Scripting (XSS)

### Status: ⚠️ NEEDS REVIEW

**Dangerous patterns detected:**

| File | Issue | Severity |
|------|-------|----------|
| `client/src/components/react/GenericModalController.jsx` | `dangerouslySetInnerHTML` with user content | MEDIUM |
| `client/src/components/react/LoreEntryController.jsx` | `dangerouslySetInnerHTML` with `sanitizeHtml()` | LOW |
| `client/src/components/react/WorldmapPanel.jsx` | `dangerouslySetInnerHTML` with SVG content | MEDIUM |

**Sanitizer Review - `client/src/utils/sanitizeHtml.js`:**

✅ **What it blocks:**
- script, iframe, object, embed, form, base, link, meta, style tags
- Event handlers (on* attributes)
- javascript: protocol in href/src

⚠️ **Gaps identified:**
- Does not block `data:` URIs (can execute JavaScript)
- Does not block `vbscript:` protocol
- Does not validate SVG-specific XSS vectors (animate, set, etc.)
- Case-sensitivity check is only on lowercase comparison

**Actions Required:**
- [ ] Improve sanitizeHtml to block data: URIs
- [ ] Add SVG attack vector blocking
- [ ] Test with known XSS payloads
- [ ] Consider using established library (DOMPurify)

---

## 3. Input Validation

### Status: ⏳ NEEDS SYSTEMATIC REVIEW

**Areas to audit:**
- [ ] Username/password validation on `/api/auth/login` and `/api/auth/register`
- [ ] Kingdom name validation (length, characters)
- [ ] User input in chat, forum posts, descriptions
- [ ] Numeric input validation (quantities, prices, etc.)
- [ ] Array/object input validation

---

## 4. Authentication & Authorization

### Status: ⏳ NEEDS REVIEW

**To investigate:**
- [ ] JWT token validation and expiration
- [ ] CSRF protection on state-changing endpoints
- [ ] Rate limiting on auth endpoints
- [ ] Session fixation risks
- [ ] Admin action authorization checks

---

## 5. Race Conditions & Transaction Safety

### Status: ⏳ NEEDS REVIEW

**To investigate:**
- [ ] Concurrent kingdom updates (turn processing vs player actions)
- [ ] Building queue race conditions
- [ ] Trade/market transaction atomicity
- [ ] Troop recruitment vs population cap
- [ ] Resource deduction before action success

---

## 6. Sensitive Data Exposure

### Status: ⏳ NEEDS REVIEW

**To investigate:**
- [ ] Passwords hashed securely (bcrypt or similar)
- [ ] API keys not in frontend code
- [ ] Secrets not in .git history
- [ ] SQL errors don't leak database schema
- [ ] Error messages don't expose implementation details

---

## 7. Resource Management

### Status: ⏳ NEEDS REVIEW

**To investigate:**
- [ ] Memory leaks in socket.io handlers
- [ ] Database connection pooling limits
- [ ] Large file uploads (lore, maps, etc.)
- [ ] Unbounded query results

---

## Next Steps

1. **Complete XSS audit** - Test sanitizeHtml with payloads
2. **Input validation pass** - Check all user input boundaries
3. **Auth review** - Validate JWT, CSRF, rate limiting
4. **Transaction safety** - Identify race condition vectors
5. **Performance audit** - Check for bottlenecks

---

## Change Log

- **2026-06-28**: Initial audit creation, SQL injection pass completed
