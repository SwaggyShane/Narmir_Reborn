# Load Test Execution Guide

**Last updated:** 2026-07-01

---

## Local Run

1. Seed or confirm the local 5,000-player pool:

```bash
npm run load-test:seed -- --count 5000
```

2. Generate real JWTs:

```bash
npm run load-test:tokens -- --count 5000 --output load-test-tokens.csv
```

3. Start the server with high local rate-limit ceilings so the run measures app capacity, not localhost throttling:

```powershell
$env:RATE_LIMIT_AUTH_MAX='2000000'
$env:RATE_LIMIT_GENERAL_MAX='2000000'
$env:RATE_LIMIT_TURN_MAX='2000000'
powershell -ExecutionPolicy Bypass -File scripts\restart-dev-server.ps1
```

4. Run the full authenticated harness:

```bash
npx artillery run load-test.yml --output roadmap-load-test-report.json
```

5. Run the smaller follow-up sample when you want a cleaner `/turn` and `/expedition/list` read:

```bash
npx artillery run load-test-roadmap-sample.yml --output roadmap-load-test-sample-report.json
```

---

## Real Endpoints

- `POST /api/kingdom/turn`
- `GET /api/kingdom/expedition/list`
- `GET /api/kingdom/rankings`

The Artillery processor generates a per-scenario CSRF token automatically. Bearer-auth requests are allowed through CSRF middleware without cookie-auth coupling.

---

## Artifacts

- `roadmap-load-test-report.json`
- `roadmap-load-test-sample-report.json`
- `LOAD_TEST_REPORT.md`
