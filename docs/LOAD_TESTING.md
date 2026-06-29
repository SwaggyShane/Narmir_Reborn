# Load Testing

Load testing for Narmir Reborn should exercise real authenticated gameplay traffic, not anonymous endpoint pings.

## Goal

Validate these endpoints at up to 5,000 concurrent players:

- `POST /api/turn`
- `GET /api/expedition?limit=20`
- `GET /api/rankings?limit=100&page=1`

Success target:

- p95 latency under 3s
- expected `429` behavior under protection limits
- no crashes, lock storms, or runaway resource usage

## Required Setup

`/api/turn` and `/api/expedition` are authenticated and player-specific. They must be tested with valid JWTs for distinct player accounts.

The checked-in [load-test-tokens.csv](/C:/Users/king_/Narmir_Reborn/load-test-tokens.csv) file is placeholder data only. Regenerate it before any real run.

### 1. Ensure prerequisites

- `JWT_SECRET` must match the server being tested
- the database must contain enough non-banned players with kingdoms
- the target server must be running

### 2. Generate real tokens

```bash
npm run load-test:tokens -- --count 5000
```

Optional custom output path:

```bash
npm run load-test:tokens -- --count 5000 --output tmp/load-test-tokens.csv
```

The generator reads eligible player rows from the database, signs fresh JWTs with `JWT_SECRET`, and writes a single-column CSV for Artillery.

## Run the Artillery Suite

Default target:

```bash
npx artillery run load-test.yml
```

Custom target:

```bash
npx artillery run --target https://narmirreborn.com load-test.yml
```

What it does:

- `POST /api/turn` with per-player bearer tokens
- `GET /api/expedition?limit=20` with per-player bearer tokens
- `GET /api/rankings?limit=100&page=1` as public traffic

## Test Shape

| Phase | Duration | Arrival Rate |
|---|---:|---:|
| Warm up | 30s | 100 req/s |
| Ramp up | 120s | 1000 req/s |
| Peak | 180s | 5000 req/s |
| Ramp down | 30s | 100 req/s |

## Interpreting Results

Healthy runs should show:

- mostly `200` and expected `400` responses on `/api/turn`
- some `429` responses once protections engage
- no widespread `401` responses if tokens are valid
- no Artillery processor crashes when responses are missing

Investigate immediately if you see:

- `401` spikes: token file is stale, invalid, or signed with the wrong `JWT_SECRET`
- `EMFILE`: host file descriptor limit is too low
- `5xx`: application or database bottleneck
- flat throughput with heavy lock contention: too few distinct player tokens

## Troubleshooting

### Too many open files

```bash
ulimit -n
ulimit -n 65536
```

### Tokens fail with `401`

- confirm the generator ran against the same environment being tested
- confirm `JWT_SECRET` matches the target server
- confirm the selected player rows still exist and own kingdoms

### Test is unrealistically serialized

If many requests are queued behind turn locking, the token pool is too small. Regenerate with more distinct players.

## Related Files

- [load-test.yml](/C:/Users/king_/Narmir_Reborn/load-test.yml)
- [load-test-processor.js](/C:/Users/king_/Narmir_Reborn/load-test-processor.js)
- [scripts/generate-load-test-tokens.js](/C:/Users/king_/Narmir_Reborn/scripts/generate-load-test-tokens.js)
- [LOAD_TEST_REPORT.md](/C:/Users/king_/Narmir_Reborn/LOAD_TEST_REPORT.md)
