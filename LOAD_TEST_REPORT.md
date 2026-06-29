# Load Testing Report - Item 2

**Date:** 2026-06-29  
**Target:** `http://localhost:3000`  
**Tool:** Artillery v2.x

---

## Executive Summary

Load testing covered three critical endpoints under escalating load:

- `POST /api/turn`
- `GET /api/expedition?limit=20`
- `GET /api/rankings?limit=100&page=1`

The recorded run showed strong baseline application performance, but the environment hit file descriptor and rate-limiter constraints before it could honestly validate the full 5,000-player target with realistic authenticated traffic.

Key takeaway: the application itself stayed fast, but the original run needs one authenticated rerun with generated per-player JWTs before this task can be treated as fully validated.

---

## Recorded Run Summary

| Metric | Value | Notes |
|---|---:|---|
| Total requests | 1,027,000 | High enough for baseline signal |
| Successful responses | 340,207 | Reduced by rate limiting and environment limits |
| Mean latency | 1.4ms | Healthy |
| p95 latency | 5ms | Healthy |
| p99 latency | 10.9ms | Healthy |
| Max latency | 106ms | Acceptable |
| Average request rate | 1,275 req/s | Healthy baseline throughput |

### Main error classes

| Error type | Count | Cause |
|---|---:|---|
| `EMFILE` | 683,779 | Host file descriptor exhaustion |
| `HTTP 429` | 339,053 | Expected rate limiting |
| `ENOTFOUND` | 3,014 | Transient network resolution issue |
| `HTTP 404` | 1,154 | Test-path/reporting noise |
| Capture failures | 135,831 | Original harness mismatch during run |

---

## What the Run Proved

### 1. Core request handling stayed fast

Even under heavy traffic, the recorded response-time profile stayed low:

- mean: 1.4ms
- p95: 5ms
- p99: 10.9ms

That points away from the app server or query path being the first bottleneck in this run.

### 2. Rate limiting is active

The `429` responses are expected protection behavior, especially on mutation-heavy traffic such as `/api/turn`.

### 3. Environment limits were real

The `EMFILE` volume means the host exhausted file descriptors before the test could fully represent 5,000 sustained concurrent authenticated players.

---

## What Changed After the Recorded Run

The original harness had three problems that have now been corrected in this branch:

1. `afterResponse` now safely handles missing response objects
2. `/api/turn` capture now uses `$.ok` instead of `$.success`
3. the branch now includes [scripts/generate-load-test-tokens.js](/C:/Users/king_/Narmir_Reborn/scripts/generate-load-test-tokens.js) so Artillery can use distinct JWTs from real player rows

Important: the checked-in [load-test-tokens.csv](/C:/Users/king_/Narmir_Reborn/load-test-tokens.csv) file is still placeholder data. A real rerun requires freshly generated tokens.

---

## Current Assessment

### Application health

- request latency looks healthy
- no evidence of app crashes from the recorded run
- mutation traffic is protected by rate limiting
- the auth model for load testing is now documented and supported by tooling

### Remaining gap

This item still needs one rerun with generated per-player JWTs before the "5,000+ concurrent players" target can be claimed as validated without qualification.

Recommended command sequence:

```bash
npm run load-test:tokens -- --count 5000
npx artillery run load-test.yml
```

---

## Recommendations

### Before closing the task

1. Generate real per-player JWTs for the target environment.
2. Rerun `load-test.yml` with those tokens.
3. Capture the authenticated rerun results.

### For the target environment

1. Raise file descriptor limits if needed.
2. Monitor `429`, `401`, and `5xx` rates during the rerun.
3. Confirm the token pool is large enough to avoid artificial turn-lock serialization.

---

## Conclusion

This branch now has the right load-test harness direction: real JWT generation, safer processor behavior, and correct `/api/turn` capture semantics.

The baseline run supports a positive performance signal, but the task should be considered complete only after one authenticated rerun with generated per-player tokens.

---

**Session:** https://claude.ai/code/session_011GvnfKpUY6sK4vDK9YoSrw
