# API Response Contract (Zustand normalizer)

**Purpose:** Living reference for API `updates` domain shapes used by the client normalizer.  
**Status:** Migration complete; keep this doc only as the shape contract (not an open task list).

**Principle:** Every endpoint response has an `updates` object with selective domain sub-objects. Missing keys = no update for that domain.

---

## Standardized Response Format

```javascript
{
  ok?: boolean,
  error?: string,
  message?: string,
  updates: {
    economy?: { gold, food, wood, stone, iron, ... upgrades, equipment... },
    military?: { troops, walls, combat_results... },
    research?: { mana, spells, school_upgrades, discoveries... },
    population?: { population, happiness, entertainment... },
    profile?: { turn, turns_stored, scout_progress, achievements... }
  },
  events?: [...],
  // endpoint-specific fields OK (reward, hired, buildTime, etc.)
}
```

**Routing Rule:** `normalizeAndRouteResponse()` will route each present domain to its corresponding store via `receiveServerSnapshot()`.

---

## Endpoint Inventory (Pre-Phase 1A Audit)

### Economy Endpoints

#### POST `/api/kingdom/economy/withdraw`
**File:** `routes/kingdom-economy.js`  
**Returns:** `{ message, updates }`

**updates shape:**
```javascript
{
  economy: {
    gold,         // Reduced after withdrawal
    land,         // Affected by gold→land conversion
    vault_held    // Updated vault amount
  }
}
```

**Routing:** → useEconomyStore.receiveServerSnapshot()

---

#### POST `/api/kingdom/economy/upgrade` (ALL 6 BUILDING TYPES)
**File:** `routes/kingdom-economy.js`  
**Returns:** `{ ok, updates }`

**updates shape:**
```javascript
{
  economy: {
    gold,                   // Deducted for purchase
    farm_upgrades?:  { ... },      // IF farm upgrade
    bank_upgrades?:  { ... },      // IF bank upgrade
    granary_upgrades?: { ... },    // IF granary upgrade
    market_upgrades?: { ... },     // IF market upgrade
    tavern_upgrades?: { ... },     // IF tavern upgrade
    mausoleum_upgrades?: { ... }   // IF mausoleum upgrade
  },
  research?: {              // IF school upgrade
    mana,
    school_upgrades: { ... }
  }
}
```

**Routing:** → useEconomyStore + useResearchStore (if school)  
**NOTE:** This endpoint handles building upgrades — CRITICAL for migration success

---

#### POST `/api/kingdom/buy-mausoleum-upgrade`
**File:** `routes/kingdom-economy.js`  
**Returns:** `{ ok, updates }`

**updates shape:**
```javascript
{
  economy: {
    gold,                     // Deducted
    mausoleum_upgrades: { ... }  // Updated
  }
}
```

**Routing:** → useEconomyStore.receiveServerSnapshot()

---

#### POST `/api/kingdom/economy/hire`
**File:** `routes/kingdom-economy.js`  
**Returns:** `{ ok, hired, updates }`

**updates shape:**
```javascript
{
  economy: {
    gold,     // Deducted for hiring
    food      // Deducted if food cost
  },
  military: {
    [troopType]: count,  // thralls, fighters, rangers, etc.
  },
  population: {
    population: newCount  // Updated total
  }
}
```

**Routing:** → useEconomyStore + useMilitaryStore + usePopulationStore

---

### Exploration Endpoints

#### POST `/api/kingdom/hunt`
**File:** `routes/kingdom-exploration.js`  
**Returns:** `{ ok, message, updates, reward }`

**updates shape:**
```javascript
{
  economy: {
    food: foodReward,
    // resource updates if found
  },
  profile: {
    scout_progress: updatedProgress
  }
}
```

**Routing:** → useEconomyStore + useProfileStore

---

#### POST `/api/kingdom/prospect`
**File:** `routes/kingdom-exploration.js`  
**Returns:** `{ ok, message, updates, reward }`

**updates shape:**
```javascript
{
  economy: {
    gold: goldReward,
    // resource updates if found
  },
  profile: {
    scout_progress: updatedProgress
  }
}
```

**Routing:** → useEconomyStore + useProfileStore

---

#### POST `/api/kingdom/search`
**File:** `routes/kingdom-exploration.js`  
**Returns:** `{ ok, message, updates }`

**updates shape:**
```javascript
{
  economy: {
    gold,
    food,
    wood,
    stone,
    iron,
    // etc
  },
  military: {
    [troopType]: count  // Captures/losses
  },
  profile: {
    scout_progress,
    events: [...]  // Captured units, etc
  }
}
```

**Routing:** → useEconomyStore + useMilitaryStore + useProfileStore

---

### Research Endpoints

#### POST `/api/kingdom/research/start`
**File:** `routes/kingdom-research.js`  
**Returns:** `{ ok, school: result.updates.school_of_magic, events }`

**updates shape:**
```javascript
{
  research: {
    school_of_magic,  // Selected school
    discoveries: [...]  // Unlocked spells
  }
}
```

**Routing:** → useResearchStore.receiveServerSnapshot()

---

#### POST `/api/kingdom/spell`
**File:** `routes/kingdom-research.js`  
**Returns:** `{ ok, updates }`

**updates shape:**
```javascript
{
  research: {
    mana: consumed
  },
  military?: {
    troops: affected,
    walls: affected
  },
  economy?: {
    resources: affected
  }
}
```

**Routing:** → useResearchStore + others (depends on spell type)

---

### Combat Endpoints

#### POST `/api/kingdom/attack`
**File:** `routes/kingdom-warfare.js`  
**Returns:** `{ ok, updates, report }`

**updates shape:**
```javascript
{
  military: {
    fighters, rangers, mages, clerics, ninjas, thieves,
    engineers, war_machines,
    walls,
    injured_troops
  },
  economy: {
    gold: resourcesGained
  },
  profile: {
    turn  // Incremented if used
  }
}
```

**Routing:** → useMilitaryStore + useEconomyStore + useProfileStore

---

### Building Endpoints

#### POST `/api/kingdom/build`
**File:** `routes/kingdom-build.js`  
**Returns:** `{ ok, updates, message, buildTime, cost }`

**updates shape:**
```javascript
{
  economy: {
    wood: deducted,
    stone: deducted,
    gold: deducted,
    [buildingType]: incremented  // bld_walls, bld_farms, etc
  }
}
```

**Routing:** → useEconomyStore.receiveServerSnapshot()

---

### Turn Endpoints

#### POST `/api/kingdom/turn`
**File:** `routes/kingdom-gameplay.js`  
**Returns:** `{ ok, updates }`

**updates shape:**
```javascript
{
  profile: {
    turn: incremented,
    turns_stored: decremented,
    scout_progress: regenerated,
    scout_progress_timestamp: now
  },
  economy: {
    gold: regenerated,
    food: regenerated,
    wood: regenerated,
    stone: regenerated,
    iron: regenerated
  },
  military: {
    // troop healing, etc
  }
}
```

**Routing:** → useProfileStore + useEconomyStore + useMilitaryStore

---

### Prestige/Achievement Endpoints

#### POST `/api/kingdom/prestige-level`
**File:** `routes/kingdom-gameplay.js`  
**Returns:** `{ ok, prestige_level }`

**updates shape:**
```javascript
{
  profile: {
    prestige_level: incremented,
    achievements: updated
  }
}
```

**Routing:** → useProfileStore.receiveServerSnapshot()

---

## Validation Rules

**Contract Validation (validateContract in normalizer):**

1. **Whitelist Top-Level Keys:**
   - ✅ `economy`, `military`, `research`, `population`, `profile` (domain keys)
   - ✅ `ok`, `error`, `message`, `success`, `events` (metadata keys)
   - ❌ Any other key = contract violation (throw in dev)

2. **Each Domain Must Be Object:**
   - ✅ `economy: { gold, food, ... }`
   - ❌ `economy: "gold"` = contract violation
   - ❌ `economy: null` = contract violation

3. **Missing Domains = No-op:**
   - ✅ `{ economy: { gold: 100 } }` = only economy updated
   - ✅ `{ economy: { gold: 100 }, military: { fighters: 50 } }` = both updated
   - ✅ `{ economy: {} }` = empty domain = no store changes (fine)

---

## Audit Checklist (Pre-Phase 1A)

> **Status (2026-07-16):** Historical pre-Phase-1A checklist. **Not** an active work queue.  
> Response-shape work continued via Zustand normalizer / route patterns; do not treat unchecked boxes as current debt without a fresh audit.

- [ ] Hunt endpoint verified
- [ ] Prospect endpoint verified
- [ ] Search endpoint verified
- [ ] Farm upgrade endpoint verified
- [ ] Bank upgrade endpoint verified
- [ ] Granary upgrade endpoint verified
- [ ] Market upgrade endpoint verified
- [ ] Tavern upgrade endpoint verified
- [ ] School upgrade endpoint verified
- [ ] Mausoleum upgrade endpoint verified
- [ ] Hire endpoint verified
- [ ] Turn endpoint verified
- [ ] Attack endpoint verified
- [ ] Build endpoint verified
- [ ] Prestige endpoint verified
- [ ] All other endpoints checked for standard format

**Status:** ⏳ Historical — not current active work

---

## Notes

- **Building Upgrades (7 types):** All route through `/api/kingdom/economy/upgrade` except mausoleum (`/api/kingdom/buy-mausoleum-upgrade`). This is the CRITICAL migration point — all 7 must route correctly.
- **Multi-Domain Updates:** Some endpoints update 3+ stores (e.g., hire updates economy, military, population). Normalizer handles this with selective routing.
- **Events Field:** Optional `events` array for cosmetic logging; not routed to stores (could add eventsStore later).
- **War Log Cache:** Currently stored in GameStateManager; decision deferred to Phase 6.9 (store placement TBD).

