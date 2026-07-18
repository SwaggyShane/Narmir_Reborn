# Boot order

Traced against the live code, 2026-07-19 (A1 boot refactor). This is the actual
call chain — if it drifts from this doc, fix the doc, not the other way around.

```
index.js
  1. dotenv.config()
  2. Canonicalize NODE_ENV (Railway sends "Production", Node wants "production")
  3. lib/logger.setupFileLogging()
  4. require('./instrument')            — Sentry.init() if SENTRY_DSN set (module-level side effect)
  5. require('./lib/error-handlers')    — no side effects yet, just functions
  6. require('./lib/shutdown')          — no side effects yet, just a factory
  7. require('./lib/bootstrap')         — no side effects yet, just a function
  8. isBootedRef = { value: false }, bootErrorRef = { value: null }
  9. require('./lib/server')()          — creates Express app, http.Server, Socket.io instance
 10. gracefulShutdown = createGracefulShutdown({ server, io })
 11. process.on('SIGTERM' | 'SIGINT', () => gracefulShutdown(0))
 12. setupProcessErrorHandlers(Sentry, sentryEnabled, { flushSentry, gracefulShutdown })
     — registers unhandledRejection + uncaughtException. SINGLE OWNER. Do not add
       a second registration anywhere else — Node calls every listener, so a
       second copy means both fire (this bit us once: a duplicate registration in
       finalizeBoot raced this one, and had no idea a PG error was recoverable).
 13. bootstrap({ app, server, io, PORT, HOST, isBootedRef, bootErrorRef })
     .catch(err => { log; process.exit(1); })   — only unwinds if bootstrap()
       itself throws synchronously before entering its own try/catch.

lib/bootstrap.js — bootstrap()
  1. Rate-limit config log, monitoring config log
  2. Feature flags (elevation combat/movement/spells) from env
  3. setupAppMiddleware(app)  — lib/middleware.js
  4. app.use(generalLimiter)
  5. SecretsManager: ensureSecretsConfigured() + validateRailwayConfig()
  6. If NODE_ENV !== production: setupVite(app, server)  — dev-only, lib/vite-setup.js
  7. try: initDb() → loadBootData(db) → applyCrashSafeRegenCatchup(db) →
     patchDefaultHeroAbilities(db) → startRegenAndMarketSchedulers(db, io)
     — on failure: bootErrorRef.value = err, log, CONTINUE (degraded "DB offline"
       mode — /health reports booted: false, most routes will fail, but the
       process stays up so Railway's health check can see it and so a human can
       still hit /health to diagnose).
  8. setupRoutes(app, { db, io, getBootError: () => bootErrorRef.value })
     — lib/setup-routes.js. Only db/io/getBootError are injected; everything else
       it needs (rate limiters, requireAuth, Sentry, error-handler middleware) is
       a stateless module require done inside setup-routes.js itself.
  9. finalizeBoot({ app, server, PORT, HOST, vite, bootError: bootErrorRef.value,
     isBootedRef, db })
 10. If db exists: db.bootComplete = true  — lets SIGTERM close the pool safely.

lib/finalize-boot.js — finalizeBoot()
  1. setupServing(app)  — lib/serve.js: static/Vite serving based on NODE_ENV
  2. isBootedRef.value = true
  3. server.listen(PORT, HOST)   — server is now actually accepting connections
  4. Background (not awaited, doesn't block the above): setupPostInitBoot(db)
     then setupAuditScheduler(db), raced against a 50s timeout. Failure here logs
     and continues — does not crash the server.

lib/boot.js — setupAuditScheduler(db)
  1. new AuditScheduler(db); await .initialize()
  2. global._audit_scheduler = auditScheduler
     — this is how lib/shutdown.js's gracefulShutdown finds it later. Does NOT
       register its own SIGTERM/SIGINT — shutdown has exactly one owner (below).
```

## Shutdown

Also exactly one owner: `lib/shutdown.js`'s `createGracefulShutdown({ server, io })`,
instantiated once in `index.js` and wired to both `SIGTERM` and `SIGINT`, and
invoked by `lib/error-handlers.js`'s `uncaughtException` handler on any
non-recoverable error (see below) instead of a raw `process.exit`.

`gracefulShutdown(exitCode)`:
1. Arms a 10s `unref()`'d fallback timer that force-calls `process.exit(exitCode)`
   if the steps below hang.
2. `server.close()` — stop accepting new connections.
3. `io.close()` — close Socket.io.
4. `global._audit_scheduler?.shutdown()` if it was ever set.
5. Clear the fallback timer and let the process exit naturally once all handles
   close (this is what lets `db/schema.js`'s pool-close listener finish its async
   `pool.end()` — an explicit `process.exit()` here would cut that off).
6. **If any step throws:** log the error and deliberately do **not** clear the
   fallback timer — it stays armed as the safety net for exactly the case where
   shutdown couldn't complete cleanly. (An earlier version of this code cleared
   the timer in the catch block too, which silently disabled the safety net on
   the one path that needed it — verified fixed via a direct unit-style
   invocation, not just code review, since Windows/Git-Bash doesn't reliably
   deliver `SIGTERM` to a native Node process for interactive testing the way
   Linux/Railway does in production.)

`unhandledRejection` / `uncaughtException` — also exactly one owner:
`lib/error-handlers.js`'s `setupProcessErrorHandlers`, registered once by
`index.js` before `bootstrap()` even runs (so a crash during boot itself gets the
same handling as one after boot completes — there is no longer a window where
only a weaker handler is registered).

- `unhandledRejection`: log + Sentry capture. Does not exit.
- `uncaughtException`, recoverable Postgres/network error (see
  `RECOVERABLE_PG_CODES`/`RECOVERABLE_SYSTEM_CODES` in `lib/error-handlers.js`):
  log + Sentry warning, **does not exit, does not shut down** — the pool is
  expected to reconnect on its own.
- `uncaughtException`, anything else: log + Sentry capture + flush Sentry, then
  `gracefulShutdown(1)` (not a raw `process.exit`) — so a genuinely fatal error
  still gets a clean attempt at closing connections before the process dies,
  bounded by the same 10s fallback timer above.

## Things this doc exists to prevent recurring

- Two places registering `unhandledRejection`/`uncaughtException` (previously:
  `index.js` directly, and `finalizeBoot` → `setupProcessErrorHandlers` — both
  fired on every event, with different, sometimes-contradictory policies).
- Two places owning "shut down the audit scheduler" for the same instance
  (previously: `lib/boot.js`'s own `SIGTERM`/`SIGINT` listeners, and `index.js`'s
  `gracefulShutdown` — harmless since `AuditScheduler.shutdown()` is idempotent,
  but still two untracked owners of the same concern).
- `index.js` re-absorbing boot orchestration over time — enforced now by
  `scripts/architecture-acceptance.js`'s entrypoint line-count check (limit 60;
  `npm run architecture:accept`).
