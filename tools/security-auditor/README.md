# Security Auditor

AST-based security auditor for Narmir Reborn codebase.

## Quick Start

```bash
cd tools/security-auditor
npm install
npm run audit
```

Generates `AUDIT_REPORT.md` in project root.

## What It Checks

✅ **Middleware**: Helmet, rate limiting, CORS  
❌ **Security**: SQL injection, hardcoded secrets, error disclosure  
✅ **Patterns**: Parameterized queries, safe error handling  

## Output

- Severity levels (CRITICAL, HIGH, MEDIUM, LOW)
- CWE references
- Concrete remediation code
- Positive findings

## Integration

From root:
```bash
npm run audit
```

Or via Railway cron for weekly checks.
