# Systems Viability Harness

End-to-end style verification that **game systems exist, are wired to endpoints, and actually run**.

This is complementary to:

| Suite | Purpose |
|-------|---------|
| `npm test` | Unit / characterization tests in `test/*.test.js` |
| `npm run smoke:combat-v2` | Combat V2 pure smoke |
| `npm run route-smoke:combat-v2` | Combat V2 DB persistence |
| **`npm run test:systems`** | **All systems: inventory + engine + DB** |
| `npm run test:systems:http` | Above + live HTTP against a running server |

## Layers

1. **Endpoint inventory** — Scans `routes/*.js` and asserts critical systems (combat, covert, spells, economy, turn, hire, heroes, …) have HTTP handlers.
2. **Module surface** — Requires core `game/*` modules and checks expected exports (`castSpell`, `covertSpy`, `resolveMilitaryAttack`, …).
3. **Engine + commands** — Runs live `command-handler` + real `engine` for combat, all four covert ops, offensive + friendly spells, hire, build, research, forge, XP, score (no DB).
4. **DB integration** — Seeds two stocked kingdoms, runs combat/covert/spell/turn/hire, applies updates, writes `war_log`, verifies persistence. Needs `DATABASE_URL`.
5. **HTTP live (optional)** — Hits a running server; asserts routes are not 404 and auth GETs work. Enable with `--http` or `SYSTEMS_HTTP_BASE`.

## Commands

```bash
# Default: inventory + modules + engine + DB (if configured)
npm run test:systems

# Only static + pure engine (no DB)
node test-systems-harness/run-all.js --only=01,02,03

# With live HTTP (start server first)
npm run dev
# other terminal:
SYSTEMS_HTTP_BASE=http://localhost:3000 npm run test:systems:http

# Print full endpoint inventory
npm run inventory:endpoints
```

## What “viable” means here

| System | Endpoint check | Engine check | DB persist |
|--------|----------------|--------------|------------|
| Combat | `POST /attack` | `combat` command | war_log + kingdom updates |
| Spells | `POST /spell` | spark / mend / bless | mana/scrolls + war_log |
| Covert | `POST /covert` | spy/loot/assassinate/sabotage | war_log |
| Turn | `POST /turn` | `processTurn` | apply updates |
| Hire | `POST /hire` | `hire-units` | troop counts |
| Economy | market/bank routes | modules load | — |
| Build / research | routes present | queue / study | — |
| Heroes / forum / alliance | routes present | — | table query |

HTTP suite additionally proves Express wiring (no silent dead mounts).

## Reports

Each run prints a **systems viability matrix** and writes:

```
logs/systems-viability-<timestamp>.json
```

## Extending

1. Add required endpoints to `lib/inventory.js` → `SYSTEM_ENDPOINTS`.
2. Add module exports to `suites/02-module-surface.js`.
3. Add engine exercises to `suites/03-engine-commands.js`.
4. Add persist flows to `suites/04-db-integration.js`.
5. Add HTTP probes to `suites/05-http-live.js`.
