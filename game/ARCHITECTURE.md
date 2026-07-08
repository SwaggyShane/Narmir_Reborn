# Game Architecture — Module Organization & Import Patterns

## Overview

This document defines the canonical locations for shared utilities, the rationale for server/client separation, and import patterns for different contexts.

## Canonical Module Locations

### Server-Side (CommonJS)

**`game/lib/timestamp.js`** — Canonical server timestamp utilities
- Functions: `createdAtAgeMs`, `formatTimestamp`, `formatTimestampShort`, `nowUnix`
- Module system: CommonJS (`module.exports`)
- Usage: Imported by server code (game/engine.js, lib/changelog-publish.js) and tests

**`game/lib/data-transformations.js`** — Pure data transformation functions
- Functions: `repairMojibake`, `cleanNewsEvent`, `isNight`, `assignRegion`, `getHappinessRecoveryRate`, `calculateHappiness`, `calcDiscoveryChance`, `levelCap`, `getCap`
- Dependencies: config, synergy-cache, race-bonus, population, fragment-bonus-manager
- Module system: CommonJS (`module.exports`)
- Usage: Imported by game/engine.js; can be imported and tested independently

### Client-Side (ES Modules)

**`client/src/utils/timestamp.js`** — Client-side timestamp mirror
- Mirrors all server timestamp functions for client use
- Module system: ES modules (`export function`)
- Rationale: Cannot directly import from game/lib due to server/client build system separation. Functions are duplicated but kept in sync conceptually.
- Comment in file documents this intentional separation

## Import Patterns

### Server Code (CommonJS)

```javascript
// In game/engine.js or any server module:
const { createdAtAgeMs, formatTimestamp, formatTimestampShort, nowUnix } = require('./lib/timestamp');
const { calculateHappiness, levelCap, getCap } = require('./lib/data-transformations');
```

### Client Code (ES Modules)

```javascript
// In client/src/** React components:
import { createdAtAgeMs, formatTimestamp } from '@/utils/timestamp';
// Note: data-transformations functions remain server-only; duplicate in client only if needed
```

## Key Design Decisions

### 1. Why Duplicate Timestamp Functions?

The game uses a dual-module architecture:
- **Server:** Node.js CommonJS (game/, lib/)
- **Client:** React ES modules (client/src/)

Direct imports across this boundary are not possible due to build system constraints. Rather than create a brittle bridge or introduce unnecessary complexity, we maintain intentional mirrors:
- **Server canonical:** game/lib/timestamp.js (CommonJS)
- **Client mirror:** client/src/utils/timestamp.js (ES modules)

Both implement identical transformation logic. When the server version changes, the client version must be updated to stay in sync — **except for locale/timezone settings**, which are context-dependent:
- **Server:** Always uses `'en-US'` + `'America/New_York'` for consistency across environments and logs
- **Client:** Uses browser's default locale/timezone so users see times in their own timezone

The sync requirement applies to: input validation (whitespace trim), date parsing logic, format templates. The timezone difference is intentional and documented.

### Visibility / Fog of War Representations

The codebase intentionally uses two different representations for hex visibility/fog of war because they serve different performance and persistence needs:

- **Server (persistent bitmap):** `game/visibility-cells.js` + `game/visibility.js` stores discovered hexes as a compact BigInt bitmap using `CELL_INDEX_STRIDE = 48` (and `CELL_INDEX_OFFSET = 8`). Used for DB storage, scouting, and ring-based discovery. Throws on invalid cells to prevent silent corruption.
- **Client (fast render grid):** `client/src/utils/hexMap/HexVisibility.ts` (and related HexGeometry) uses a Uint8Array for O(1) fog state lookup (Unseen/Seen/Current) during map rendering. Rebuilt from server data on sync.

**Why dual?** Bitmap is space-efficient for long-term per-kingdom state. Array is optimal for real-time React/SVG rendering. Direct cross-import is impossible due to module system split (see above).

**Consistency requirement:** Changes to map size, stride, or hex math must update both sides and the bridging test. Historical bugs (e.g. stride 32 vs enlarged map) were caused by drift.

See: visibility-cells.js, WorldmapRenderer.jsx, HexSelectionModal.jsx, ARCHIVAL.md (stride migration), and the dedicated consistency test.

### 2. Consolidating Data Transformations

Pure data transformation functions (no I/O, no state mutations) are consolidated in `game/lib/data-transformations.js` rather than scattered through engine.js. This enables:
- Unit testing without full engine context
- Reuse across different orchestration points
- Clarity on what is computation vs. orchestration

### 3. Common Pitfalls to Avoid

**❌ Do not:** Add new duplicated utilities without documenting the split
- If client needs a server utility, document why in a comment (build system constraint, not design choice)

**❌ Do not:** Import client utilities in server code or vice versa
- This breaks the module separation and creates hidden dependencies

**❌ Do not:** Define the same pure function in multiple places
- Consolidate in the canonical location first, then mirror if cross-module use is needed

**✅ Do:** Keep timestamp and data-transformation functions in sync across server/client
- Run tests and smoke checks after any changes to catch divergence

## Testing

### Server Tests
- Import from game/lib/timestamp.js and game/lib/data-transformations.js
- These are CommonJS, so use `require()`

### Client Tests (if any)
- Import from client/src/utils/timestamp.js
- These are ES modules, so use `import`

### Smoke Tests
- Server start-up with DATABASE_URL set
- Baseline checks verify timestamp and transformation functions work in context (forum, auth, portal, game)

## Future Consolidation

If the codebase migrates to a unified module system (all CommonJS or all ES modules), these mirrors can be eliminated. Until then, the separation is intentional and necessary.
