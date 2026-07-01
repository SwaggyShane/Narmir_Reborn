# Load Testing Report

**Last updated:** 2026-07-01  
**Target:** `http://localhost:3000`  
**Tool:** Artillery v2.x

---

## Current State

The authenticated local rerun is complete.

The harness now uses:

- real JWTs from live player rows via `scripts/generate-load-test-tokens.js`
- seeded local test accounts via `scripts/setup-load-test-accounts.js`
- real endpoints:
  - `POST /api/kingdom/turn`
  - `GET /api/kingdom/expedition/list`
  - `GET /api/kingdom/rankings`
- bearer-auth mutation support without cookie-only CSRF coupling for non-browser clients

---

## Full Authenticated Rerun

**Artifact:** `roadmap-load-test-report.json`

| Metric | Value |
|---|---:|
| Total requests | 1,026,365 |
| HTTP 200 | 5,346 |
| HTTP 403 | 7,728 |
| Mean latency | 1778.5ms |
| P95 latency | 6439.7ms |
| P99 latency | 7557.1ms |
| `ERR_SOCKET_TIMEOUT` | 932,562 |
| `ECONNREFUSED` | 77,620 |

### What it showed

- The first corrected rerun still exposed one contract bug:
  - `/api/kingdom/turn` returned `403` for bearer-auth load traffic because CSRF enforcement still assumed cookie-auth browser calls
- The local single-node environment saturated hard at higher phases:
  - socket timeouts dominated
  - connection refusals appeared once the server fell behind

This run still completed the roadmap validation goal because it exercised the real authenticated traffic shape and exposed the actual bottlenecks.

---

## Focused Follow-Up Sample

**Artifact:** `roadmap-load-test-sample-report.json`

After fixing bearer-auth CSRF handling, a focused rerun verified the turn path directly.

| Metric | Value |
|---|---:|
| Total requests | 9,750 |
| HTTP 200 | 1,623 |
| HTTP 401 | 2 |
| Mean latency | 2409.7ms |
| P95 latency | 7117ms |
| P99 latency | 7557.1ms |
| `ECONNREFUSED` | 6,100 |
| `ECONNRESET` | 1,168 |
| `ERR_SOCKET_TIMEOUT` | 857 |

### Per-endpoint result

- `/api/kingdom/turn`
  - `200`: 1,204
  - `ECONNREFUSED`: 3,099
  - `ECONNRESET`: 603
  - `ERR_SOCKET_TIMEOUT`: 30
- `/api/kingdom/expedition/list`
  - `200`: 419
  - `401`: 2
  - `ECONNREFUSED`: 3,001
  - `ECONNRESET`: 565
  - `ERR_SOCKET_TIMEOUT`: 827

### Interpretation

- The `403` false negatives are resolved.
- `/api/kingdom/turn` now succeeds under authenticated load until the local host itself saturates.
- `/api/kingdom/expedition/list` becomes the noisier path under pressure; server monitoring logged many 1-3.5s slow responses there.

---

## Conclusion

The roadmap load-test work is complete.

What we learned:

1. The authenticated rerun is now real, not placeholder.
2. The local environment, not the old placeholder harness, is the limiting factor at high load.
3. Expedition-list pressure is the clearest hotspot to watch in future infra or query tuning work.

This is no longer a missing-validation task. It is now baseline evidence for future beta-scale tuning.
