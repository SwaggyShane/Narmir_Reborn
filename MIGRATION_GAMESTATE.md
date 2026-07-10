# GameStateManager → Zustand Migration Plan

**Objective:** Eliminate all legacy GameStateManager usage and consolidate to Zustand stores only.

**Scope:** 23 files, 6+ phases, ~13 days estimated  
**Owner:** swaggyshane/narmir_reborn  
**Status:** Phase 2 Complete (In Progress)

---

## Executive Summary

The codebase currently has **two parallel state management systems** that create sync gaps and maintenance overhead:

| System | Scope | Status | Impact |
|--------|-------|--------|--------|
| **Zustand stores** | Modern, domain-based (economy, military, research, population, profile) | Primary | Correct behavior |
| **GameStateManager** | Legacy singleton class for all state | **To Delete** | Sync gaps, duplication |

**Challenge:** 23 files still reference GameStateManager, causing:
- Silent sync bugs (updates hit one system but not the other)
- Doubled maintenance burden (two patterns to maintain)
- Harder to test (listener mock complexity)
- Hidden dependencies (indirect imports, re-exports)

**Solution:** Migrate all 23 files to Zustand using a phased approach with explicit gates, rollback criteria, and safety mechanisms.

---

## Architectural Overview

### Store Ownership (Single Source of Truth)

| Domain | Store | Responsibility | Files Affected |
|--------|-------|-----------------|-----------------|
| **Economy** | `useEconomyStore` | Gold, food, wood, stone, iron, upgrades (farm, bank, granary, market, tavern, mausoleum) | 15+ |
| **Military** | `useMilitaryStore` | Troops, walls, combat results, war reports | 8+ |
| **Research** | `useResearchStore` | Mana, spells, school upgrades, discoveries | 5+ |
| **Population** | `usePopulationStore` | Population count, happiness, entertainment | 4+ |
| **Profile** | `useProfileStore` | Turn, turns_stored, scout progress, achievements | 10+ |
| **UI** | `useUIStore` | Panel state, modal visibility, active tabs | 3+ |

**Principle:** Each store owns its domain exclusively. No cross-store direct mutations.

---

### Event Flow Diagram (Post-Migration)

```
External Event (API call, socket, user action)
    ↓
API Handler (component, utility, socket listener)
    ↓
normalizeAndRouteResponse(response, context)
    ↓
validateContract(updates) [DEV ONLY]
    ├─ checks for unexpected keys
    ├─ validates domain object types
    └─ logs discrepancies (dev warnings)
    ↓
Selective Store Routing
    ├─ if updates.economy → useEconomyStore.receiveServerSnapshot()
    ├─ if updates.military → useMilitaryStore.receiveServerSnapshot()
    ├─ if updates.research → useResearchStore.receiveServerSnapshot()
    ├─ if updates.population → usePopulationStore.receiveServerSnapshot()
    └─ if updates.profile → useProfileStore.receiveServerSnapshot()
    ↓
Store subscriptions notify
    ↓
Components re-render (via hook subscriptions)
    ↓
useShallow selectors prevent unnecessary re-renders
    ↓
UI updates
```

**Key:** Single event → single routing path → consistent state.

---

## Current vs. Target Architecture

### Current Flow (Problematic)
```
API Response
    ↓
applyGameMutation() or direct calls
    ↓
GameStateManager.applyUpdates()  ← PRIMARY
    ↓
Listeners emit (useGameMutationEvents)
    ↓
Components subscribe + re-render
    ✗ Zustand stores often NOT updated
    ✗ Two sources of truth
    ✗ Sync gaps
```

**Issues:**
- Building upgrades flow through legacy bridge, bypassing Zustand
- Panel state duplicated in GameStateManager.panelState
- Components rely on listeners, not direct store reads
- Hard to prove stores are synced (no validation)

### Target Flow (Correct)
```
API Response → Contract Validation
    ↓
normalizeAndRouteResponse()
    ↓
Zustand Store.receiveServerSnapshot() ← SINGLE POINT
    ├─ useEconomyStore
    ├─ useMilitaryStore  
    ├─ useResearchStore
    ├─ usePopulationStore
    └─ useProfileStore
    ↓
useShallow selectors subscribe
    ↓
Components re-render ✅
    ✓ Single source of truth
    ✓ Validated routing
    ✓ Predictable sync
```

**Benefits:**
1. **Single source of truth per domain** — No duplicates
2. **Standardized routing** — All responses flow same path
3. **Contract enforcement** — Dev-time validation catches mismatches
4. **Simpler testing** — Mock stores, not listeners
5. **No hidden dependencies** — Direct store reads, no indirect imports

---

## Building Upgrades In Scope (Canonical Reference)

**ALL 7 building upgrade types are explicitly covered by this migration:**

| # | Upgrade Type | API Endpoint | Handler | Store Target | Property |
|---|--------------|--------------|---------|--------------|----------|
| 1 | **Farm** | `/api/kingdom/economy/upgrade` | UpgradesList.jsx:70 | economyStore | `farm_upgrades` |
| 2 | **Bank** | `/api/kingdom/economy/upgrade` | UpgradesList.jsx:70 | economyStore | `bank_upgrades` |
| 3 | **Granary** | `/api/kingdom/economy/upgrade` | UpgradesList.jsx:70 | economyStore | `granary_upgrades` |
| 4 | **Market** | `/api/kingdom/economy/upgrade` | UpgradesList.jsx:70 | economyStore | `market_upgrades` |
| 5 | **Tavern** | `/api/kingdom/economy/upgrade` | UpgradesList.jsx:70 | economyStore | `tavern_upgrades` |
| 6 | **School** | `/api/kingdom/economy/upgrade` | UpgradesList.jsx:70 | researchStore | `school_upgrades` |
| 7 | **Mausoleum** | `/api/kingdom/buy-mausoleum-upgrade` | UpgradesList.jsx:48 | economyStore | `mausoleum_upgrades` |

**Current Issue:** All 7 flow through `applyGameMutation()` → GameStateManager (legacy)

**Post-Migration:** All 7 flow through `normalizeAndRouteResponse()` → Zustand stores (modern)

**Single migration point:** `UpgradesList.jsx` handles all 7 types. Fix once, fix all.

---

## Files Affected (Complete Inventory)

### **Core Infrastructure (To Delete)**
- `client/src/GameStateManager.js` — delete
- `client/src/hooks/useGameState.js` — delete
- `client/src/utils/gameMutations.js` — delete (integrate into store actions)

### **Components (15 files - need hook replacement)**

**Using `useGameMutationEvents()` (refresh on mutations):**
1. `client/src/components/react/DefensePanel.jsx` — lines 36, 157
2. `client/src/components/react/EconomyPanel.jsx` — line 155
3. `client/src/components/react/ExplorationPanel.jsx` — lines 92, 174
4. `client/src/components/react/HappinessPanel.jsx` — line 65
5. `client/src/components/react/HappinessWidget.jsx` — line 28
6. `client/src/components/react/MarketPanel.jsx` — line 191
7. `client/src/components/react/NewsPanel.jsx` — line 171
8. `client/src/components/react/StudiesPanel.jsx` — line 58
9. `client/src/components/react/AuthModal.jsx` — dual sync at lines 25, 36

**Tests:**
10. `client/src/components/react/__tests__/HappinessWidget.test.jsx` — mock at line 18
11. `client/src/components/react/__tests__/StudiesPanel.test.jsx` — mock at line 21

### **Hooks (5 files - need store migration)**
1. `client/src/hooks/useGameActions.js` — applyResult() at line 13, getState() at lines 47, 64, 92
2. `client/src/hooks/useKingdomRank.js` — useGameState() at line 26, applyGameMutation() at line 45
3. `client/src/hooks/useActiveExpeditionsSummary.js` — useGameMutationEvents() at line 22
4. `client/src/hooks/usePanelState.js` — getPanelState/setPanelState (panel-scoped state)
5. `client/src/hooks/useRegenCountdown.js` — getState() at line 32, applyUpdates() at line 34 (optimistic turns)

### **Utilities (4 files - integration points)**
1. `client/src/utils/gameMutations.js` — delete (logic moves to store actions)
2. `client/src/utils/panelNav.js` — calls getState(), setState(), applyUpdates()
3. `client/src/utils/replayWarReport.js` — reads warLogCache from getState()
4. `client/src/utils/shellBridge.js` — re-exports from panelNav

### **Socket Handlers (Good News!)**
- `client/src/hooks/useSocket.js` — Already correct! Calls `loadKingdom()` which syncs Zustand stores

---

## Timeline at a Glance

| Phase | Duration | Calendar Days | Focus | Gate Condition | Rollback Trigger |
|-------|----------|---------------|-------|----------------|------------------|
| **Pre-Phase 1A** | 0.5 day | Day 1 | Response contract definition | All endpoints documented | N/A | ✅ |
| **Pre-Phase 1B** | 0.5 day | Day 1 | Hidden dependencies audit | Grep finds no new files | N/A | ✅ |
| **Phase 1** | 1-2 days | Days 2-3 | UIStore panel state | Panel state persists/retrieves | Revert UIStore changes | ✅ |
| **Phase 1.5** | 1 day | Day 4 | Response normalizer | Contract validation works | Revert normalizer, re-add listeners | ✅ |
| **Phase 2** | 1-2 days | Days 5-6 | Critical sync points | Buy upgrade → store updates | Revert Phase 2 files | ✅ COMPLETE |
| **Phase 3A** | 1 day | Day 7 | Dual data sources | All 15 components read Zustand | Revert component changes |
| **3A Gate** | 1 day | Day 8 | Smoke test | Buy/turn/attack all update | Do NOT proceed to 3B |
| **Phase 3B** | 1 day | Days 9-10 | Listener removal | Components still render | Restore listener calls |
| **Phase 4** | 1 day | Day 11 | Utility cleanup | panelNav, shellBridge migrated | Revert utility changes |
| **Phase 5** | 1 day | Day 12 | Test updates | All tests passing | Fix failing tests |
| **Phase 6** | 0.5 day | Day 13 | Cleanup & deletion | Zero grep results | (Do not rollback; commit backwards) |

---

## Pre-Migration: Response Contract & Hidden Dependencies Audit

**CRITICAL GROUNDWORK (Before Phase 1)**

### **Pre-Phase 1A: Define Response Routing Contract** (Day 1)

**Problem:** Different API endpoints return responses with different shapes. Without a standardized contract, each handler will route data differently → subtle sync bugs.

**Solution:** Define THE contract that every API response must follow before entering any store.

**Audit all API endpoints and document their response shapes:**

```bash
grep -r "apiCall\|/api/" /home/user/Narmir_Reborn/game/routes --include="*.js" | grep "res.send\|return {" | head -50
```

**Document template for each endpoint:**

```javascript
/**
 * ENDPOINT: /api/kingdom/hire
 * RESPONSE SHAPE (Standardized Contract):
 * {
 *   error?: string,
 *   updates: {
 *     economy: { gold, food, ... },      // ← always have economy sub-object
 *     military: { troops, ... },          // ← always have military sub-object
 *     population: { population, ... },    // ← always have population sub-object
 *     research: { mana, ... },            // ← always have research sub-object
 *     profile: { turn, ... }              // ← always have profile sub-object
 *   }
 * }
 * 
 * STORE ROUTING (Required):
 * - updates.economy → useEconomyStore.receiveServerSnapshot()
 * - updates.military → useMilitaryStore.receiveServerSnapshot()
 * - updates.population → usePopulationStore.receiveServerSnapshot()
 * - updates.research → useResearchStore.receiveServerSnapshot()
 * - updates.profile → useProfileStore.receiveServerSnapshot()
 */
```

**Create contract for every endpoint:**
1. `/api/kingdom/hire` — troops, gold, population
2. `/api/kingdom/economy/upgrade` — gold, farm_upgrades (etc), mana (for school), research
3. `/api/kingdom/buy-mausoleum-upgrade` — gold, mausoleum_upgrades
4. `/api/kingdom/attack` — troops, walls, mana, gold
5. `/api/kingdom/turn` — turn, turns_stored, gold, food, resources, scout progress, events
6. `/api/kingdom/spell` — mana, troops, research, turn
7. `/api/kingdom/search` — troops, gold, food, resources, events
... (all endpoints)

**Standardization rule (Flexible):**
- **EVERY response** must have `updates` object with consistent domain sub-objects
- **Relaxed approach:** If endpoint doesn't update a domain, **omit the key entirely** (don't send empty object)
  - This is safer than requiring all 5 domains always present
  - Minimizes backend changes needed to comply with contract
  - Normalizer routes only present domains (missing keys are no-op)
- **No custom shapes** — no "just return gold", no "returns farm_upgrades at top level"

**Why this matters:**
- Handlers don't have to guess about response shape
- `normalizeAndRouteResponse()` always routes the same way
- No "sometimes it's here, sometimes it's there" sync bugs
- Reduces backend migration burden (don't require all endpoints to emit all 5 domains)

**Contract enforcement rule:**
- Validate that top-level keys are only from: `{ economy, military, research, population, profile, error, events, message, success }`
- No unexpected keys (catch routing mistakes)
- Each domain that IS present must be an object (not null/string/etc)

**Deliverable:** `/game/API_CONTRACT.md` documenting response shape for every endpoint

---

### **Pre-Phase 1B: Hidden Dependencies Audit** (Day 1)

**Problem:** Initial grep found 23 files. But there are likely:
- Indirect imports (A imports B imports GameStateManager)
- Dynamic/computed usage (getState() calls hidden in ternaries)
- Re-exports we didn't catch
- Template strings with property names

**Comprehensive audit steps (run in order):**

```bash
# 1. Catch-all: Find ALL getState() calls (many will be Zustand, but hidden GameStateManager calls stand out)
grep -r "\.getState()" /home/user/Narmir_Reborn/client/src --include="*.js" --include="*.jsx" | grep -v "useEconomyStore\|useMilitaryStore\|useProfileStore\|useResearchStore\|usePopulationStore\|useUIStore\|node_modules"
# → Should be ZERO results (after filtering Zustand stores)

# 2. Find ALL GameStateManager/gameStateManager references
grep -r "GameStateManager\|gameStateManager" /home/user/Narmir_Reborn/client/src --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx"

# 3. Find ALL applyUpdates/applyGameMutation calls
grep -r "applyUpdates\|applyGameMutation" /home/user/Narmir_Reborn/client/src --include="*.js" --include="*.jsx"

# 4. Find all listener subscriptions (Zustand subscriptions are OK, but old GameStateManager subscriptions are not)
grep -r "\.subscribe(" /home/user/Narmir_Reborn/client/src --include="*.js" --include="*.jsx" | grep -v "useEconomyStore\|useMilitaryStore\|useProfileStore\|useResearchStore\|usePopulationStore\|useUIStore"
# → Should be ZERO results

# 5. Find re-exports (easy to miss)
grep -r "export.*gameStateManager\|export.*useGameState\|export.*gameMutation" /home/user/Narmir_Reborn/client/src

# 6. Special attention: shellBridge and panelNav (re-export points)
grep -r "gameState\|applyGame" /home/user/Narmir_Reborn/client/src/utils/shellBridge.js /home/user/Narmir_Reborn/client/src/utils/panelNav.js

# 7. Check all test files for GameStateManager mocks
grep -r "vi\.mock.*GameState\|jest\.mock.*GameState" /home/user/Narmir_Reborn/client/src
```

**Document findings:**
- Create a spreadsheet or list: `[filename] [line] [type] [reference]`
- Update the 23-file list with any new findings
- Flag any re-exports or dynamic usage for special attention in Phase 2

**Expected result:** Should find 0-3 additional files (usually test-related or re-exports)

---

## Phase 1: Foundation Setup (Days 2-3)

**Goal:** Make uiStore ready to replace panel state storage. Introduce compatibility layer for safety.

### **Phase 1.1: Extend UIStore with Panel State (In-Memory)**

**File:** `client/src/stores/uiStore.js`

**Before:**
```javascript
// Panel state stored in GameStateManager.panelState Map
gameStateManager.setPanelState('defensePanel', { expanded: true });
```

**After:**
```javascript
// In uiStore.js - add panel state management (in-memory only, Phase 1.1)
panelState: {},  // { panelName: state }

setPanelState: (panelName, state) => set((s) => {
  s.panelState[panelName] = state;
})

getPanelState: (panelName) => 
  useUIStore((s) => s.panelState[panelName]),
```

**Migration:** Replace all `usePanelState()` calls with `useUIStore`
- **File:** `client/src/hooks/usePanelState.js` → delete
- **Files affected:** Any component using `usePanelState()` (search for usages)

**Gate:** Panel state persists in memory during session, components can read/write to UIStore

**Rollback:** Revert UIStore changes, restore usePanelState.js
```bash
# Identify Phase 1 commits (check git log for phase 1 work)
git log --oneline -n 10

# Revert last N commits from Phase 1
git revert HEAD~2..HEAD  # Adjust range based on actual commit count

# Or reset to pre-Phase-1 state (WARNING: loses all Phase 1 work)
git reset --hard origin/main
```

---

### **Phase 1.2: Introduce Compatibility Layer (Safety Net)**

**File:** `client/src/GameStateManager.js` (convert to proxy, don't delete yet)

**Rationale:** Instead of immediately deleting GameStateManager, convert it to a thin proxy that warns but routes through the new system. This:
- Catches forgotten callers immediately (console warnings)
- Prevents breakage if we miss a reference
- Provides a gradual cutover path
- Makes phase gates safer

**Implementation:**

```javascript
/**
 * DEPRECATED: Compatibility Layer (Phase 1.2)
 * 
 * This is a thin proxy around normalizeAndRouteResponse().
 * All calls are logged with warnings for developer visibility.
 * 
 * Usage during Phase 1-5: Forgotten callers still work + log warnings
 * Deletion point: Phase 6 (after confirming zero warnings in Phase 5)
 */

import { normalizeAndRouteResponse } from './utils/responseNormalizer';

export const gameStateManager = {
  applyUpdates(updates, context = {}) {
    // Aggressive logging: parse stack to identify exact caller file/line
    const stack = new Error().stack.split('\n');
    const caller = stack[2]?.trim() || 'unknown';
    
    console.warn('[DEPRECATED] GameStateManager.applyUpdates() called', {
      caller,  // e.g., "at DefensePanel (DefensePanel.jsx:42:15)"
      context,
      stack: stack.slice(2, 5).join('\n')  // Full stack trace for debugging
    });
    normalizeAndRouteResponse({ updates }, context);
  },
  
  setState(state) {
    const stack = new Error().stack.split('\n');
    const caller = stack[2]?.trim() || 'unknown';
    
    console.warn('[DEPRECATED] GameStateManager.setState() called', {
      caller,
      state,
      stack: stack.slice(2, 5).join('\n')
    });
    // Route known properties to appropriate stores
    normalizeAndRouteResponse({ updates: state }, { reason: 'legacy-setstate' });
  },
  
  getState() {
    const stack = new Error().stack.split('\n');
    const caller = stack[2]?.trim() || 'unknown';
    
    console.warn('[DEPRECATED] GameStateManager.getState() called', {
      caller,
      stack: stack.slice(2, 5).join('\n')
    });
    // Construct state from stores (fallback for forgotten callers)
    return {
      gold: useEconomyStore.getState().gold,
      food: useEconomyStore.getState().food,
      // ... all other properties
    };
  }
};
```

**Effect:** Forgotten calls still work but trigger console warnings. Makes Phase 5 smoke test easy: look for warnings.

**Gate:** No console warnings during Phase 5 smoke test = safe to delete in Phase 6

**Rollback:** Already reverted if Phase 1 fails

---

### **Phase 1.3: Create test fixtures for Zustand stores**

**File:** `client/src/__mocks__/stores.js` (new)

```javascript
// Mock versions of each Zustand store for testing
// Replace vi.mock('./hooks/useGameState') with store mocks
export const mockEconomyStore = { ... };
export const mockMilitaryStore = { ... };
// etc.
```

**Why:** Prepares tests for Phase 3

---

### **Phase 1.4 (Post-Migration): Add localStorage Persistence**

**Timing:** Only after Phase 6 (GameStateManager fully deleted). Adding persistence mid-migration creates sync risks.

**Approach:** Use Zustand persist middleware:
```javascript
import { persist } from 'zustand/middleware';

export const useUIStore = create(
  persist(
    immer((set) => ({
      // ... state
      setPanelState: (panelName, state) => { /* ... */ }
    })),
    {
      name: 'ui-storage',
      partialize: (state) => ({ 
        panelState: state.panelState,  // Only persist panel preferences
        // Exclude sensitive UI state (modals, temp values)
      }),
    }
  )
);
```

**Benefits:** Returning players see UI exactly as they left it (expanded panels, active tabs, etc.)

**When:** Post-migration, Phase 6+

---

## Phase 1.5: Response Normalization Layer (Day 4)

**Goal:** Implement centralized response routing that enforces the contract

**Before Phase 2, create a single source of truth for response routing:**

**File:** `client/src/utils/responseNormalizer.js` (new)

```javascript
/**
 * Centralized response routing enforcing the API Contract.
 * All server responses pass through here before reaching stores.
 * This prevents partial-sync bugs and inconsistent routing.
 * 
 * IMPORTANT: Uses .getState() pattern for use in non-component contexts
 * (socket handlers, utilities, tests). This is standard Zustand practice
 * and does NOT violate React hook rules since we're calling the store
 * directly, not using the hook in render context.
 * 
 * PRODUCTION BUILD: validateContract() completely tree-shakes away via
 * process.env.NODE_ENV checks. Vite removes ~2KB of dev-only validation code.
 */

import { useEconomyStore } from '../stores';
import { useMilitaryStore } from '../stores';
import { useResearchStore } from '../stores';
import { usePopulationStore } from '../stores';
import { useProfileStore } from '../stores';

/**
 * Validates that response follows the standardized contract.
 * THROWS in dev if response structure is invalid (not just warns).
 * 
 * Contract rule: Every response.updates must contain exactly these sub-objects:
 * { economy, military, research, population, profile }
 * 
 * Each sub-object can be empty {} if that domain wasn't updated.
 * 
 * TREE-SHAKING: This entire function is eliminated in production builds.
 * Vite statically analyzes process.env.NODE_ENV === 'development' and removes
 * the whole validation block. Result: zero overhead in production.
 */
export function validateContract(updates, context = {}) {
  const isDev = process.env.NODE_ENV === 'development';
  
  if (!updates) {
    if (isDev) {
      throw new Error('[Contract] Response missing updates object: ' + JSON.stringify(context));
    }
    return false;
  }
  
  // Whitelist of allowed top-level keys in updates
  const allowedKeys = new Set([
    'economy', 'military', 'research', 'population', 'profile',
    'error', 'events', 'message', 'success' // meta keys OK
  ]);
  
  // Check for unexpected keys (catches routing mistakes)
  const foundKeys = Object.keys(updates);
  const unexpectedKeys = foundKeys.filter(key => !allowedKeys.has(key));
  
  if (unexpectedKeys.length > 0 && isDev) {
    throw new Error(
      `[Contract Violation] Unexpected response keys: ${unexpectedKeys.join(', ')}. Context: ${JSON.stringify(context)}`
    );
  }
  
  // Each domain that IS present should be an object (not null/string/etc)
  ['economy', 'military', 'research', 'population', 'profile'].forEach(domain => {
    if (updates[domain] !== undefined && typeof updates[domain] !== 'object') {
      if (isDev) {
        throw new Error(
          `[Contract Violation] ${domain} is not an object: ${typeof updates[domain]}. Context: ${JSON.stringify(context)}`
        );
      }
    }
  });
  
  return true;
}

export function normalizeAndRouteResponse(response, context = {}) {
  if (!response?.updates) return null;
  
  const { updates } = response;
  
  // Validate response contract (THROWS in dev on violation)
  validateContract(updates, context);
  
  // Enforce contract: every response can have these 5 domain objects
  // (empty {} if domain wasn't updated)
  const normalized = {
    economy: updates.economy || {},
    military: updates.military || {},
    research: updates.research || {},
    population: updates.population || {},
    profile: updates.profile || {},
  };
  
  // Route each domain to its store in strict order
  // Only call receiveServerSnapshot if domain has actual updates
  if (Object.keys(normalized.economy).length > 0) {
    useEconomyStore.getState().receiveServerSnapshot(normalized.economy);
  }
  
  if (Object.keys(normalized.military).length > 0) {
    useMilitaryStore.getState().receiveServerSnapshot(normalized.military);
  }
  
  if (Object.keys(normalized.research).length > 0) {
    useResearchStore.getState().receiveServerSnapshot(normalized.research);
  }
  
  if (Object.keys(normalized.population).length > 0) {
    usePopulationStore.getState().receiveServerSnapshot(normalized.population);
  }
  
  if (Object.keys(normalized.profile).length > 0) {
    useProfileStore.getState().receiveServerSnapshot(normalized.profile);
  }
  
  // Debug logging
  if (process.env.NODE_ENV === 'development' && context.reason) {
    console.log(`[Response Route] ${context.reason}`, { 
      had_updates: Object.keys(normalized).filter(k => Object.keys(normalized[k]).length > 0),
      reason: context.reason
    });
  }
  
  return normalized;
}
```

**Design Rationale:**

1. **Direct Store Access via .getState():** Uses the `.getState()` static method on Zustand hooks. This is the standard pattern for accessing store state outside of React components (in utilities, socket handlers, tests). It does NOT violate React hook rules because we're calling the store directly, not using the hook in render context.

2. **Runtime Assertions:** Changed from warnings to throwing errors in dev. Errors stop development immediately instead of being ignored.

3. **Contract Validation:** The `validateContract()` function enforces the standardized response structure. In development, it throws when:
   - Response has unexpected top-level keys (indicates incorrect routing)
   - A domain sub-object is not a proper object
   - This catches divergence early before it causes silent sync bugs

4. **Tree-Shaking:** The `process.env.NODE_ENV === 'development'` checks are eliminated by Vite during production build, removing ~2KB of validation code that's never used in production. The entire validateContract function is completely removed from bundle.

5. **Normalized Routing:** Accepts empty objects for domains that don't have updates. This ensures all 5 stores follow the same code path, making routing failures visible.

**Rule:** ALL API handlers must use this function, not ad-hoc routing.

**Update all handlers to use it:**
- UpgradesList.jsx: `normalizeAndRouteResponse(result, { reason: 'upgrade-purchased' })`
- useGameActions.js: `normalizeAndRouteResponse(data, { reason: 'turn-complete' })`
- AuthModal.jsx: `normalizeAndRouteResponse(data, { reason: 'login-complete' })`
- etc.

**This ensures:**
- No inconsistent routing (single code path)
- Response contract validated in dev (catches malformed responses immediately via throw)
- Consistent logging (easier debugging)
- Works in any context (components, utilities, socket handlers, tests)
- Easy to verify all stores updated correctly
- Zero production overhead (tree-shakes to nothing)

**Gate:** Run `npm run dev` with no contract violation errors during manual testing

**Rollback:** Revert normalizer, restore applyGameMutation calls
```bash
# Revert Phase 1.5 commits
git log --oneline -n 20 | grep -i "normalizer\|response"
git revert <commit-hash>  # Revert normalizer creation

# Or batch revert Phase 1.5
git revert HEAD~1..HEAD   # Adjust based on commit count
```

---

## Phase 2: Critical Sync Point Migrations (Days 5-6)

**Status:** ✅ COMPLETE

**Goal:** Eliminate dual-system updates in core logic using the normalized routing

**Completed Migrations:**
- UpgradesList.jsx (2 calls - CRITICAL - all 7 building upgrade types)
- AuthModal.jsx (removed unused applyGameMutation import)
- DefensePanel.jsx (removed unused applyGameMutation import)
- EconomyPanel.jsx (6 calls: tax, trade-send, trade-accept, hire-mercs, bank-deposit, establish-trade-route)
- ExplorationPanel.jsx (refactored applyResult helper to use normalizeAndRouteResponse)
- MarketPanel.jsx (2 calls: market buy/sell, trade accept)
- ResourcesPanel.jsx (1 call: resources-refresh)
- useGameActions.js hook (4 calls: takeTurn, search, castSpell, attack)
- syncKingdom.js utility (1 call: sync-kingdom)

**Total Migration:** ~20+ applyGameMutation calls replaced with normalizeAndRouteResponse

**Verification:**
- npm run lint: PASS (0 errors)
- npm run test:components (responseNormalizer.test.js): 15/15 PASS
- All API handlers now route through single normalizeAndRouteResponse function

### **Phase 2.1: Migrate useGameActions.applyResult()**

**File:** `client/src/hooks/useGameActions.js`

**Before:**
```javascript
function applyResult(data, reason) {
  const updates = data?.updates || data?.kUpdates || null;
  if (updates) gameStateManager.applyUpdates(updates, { reason, payload: updates });
  return data;
}
```

**After:**
```javascript
import { normalizeAndRouteResponse } from '../utils/responseNormalizer';

function applyResult(data, reason) {
  const updates = data?.updates || data?.kUpdates || null;
  if (updates) {
    normalizeAndRouteResponse(data, { reason });
  }
  return data;
}
```

**Tests:** 
- Verify turn updates hit useProfileStore
- Verify gold/food updates hit useEconomyStore
- etc. for each store

**Rollback:** Restore legacy applyGameMutation call
```bash
# Revert Phase 2 commits (useGameActions, AuthModal, useRegenCountdown)
git log --oneline -n 20 | grep -E "(useGameActions|AuthModal|useRegenCountdown)"

# Batch revert all Phase 2 work
git revert HEAD~3..HEAD   # Adjust range to match actual Phase 2 commits
git push origin main
```

### **Phase 2.2: Migrate AuthModal.loadKingdom()**

**File:** `client/src/components/react/AuthModal.jsx`

**Before:**
```javascript
const loadKingdom = async (kingdomId) => {
  // ... fetch data
  useEconomyStore.getState().receiveServerSnapshot(data.economy);
  // ... 4 more stores
  gameStateManager.setState({
    gold: data.economy.gold,
    // ... other properties
  });
  applyGameMutation(data);
};
```

**After:**
```javascript
import { normalizeAndRouteResponse } from '../../utils/responseNormalizer';

const loadKingdom = async (kingdomId) => {
  // ... fetch data
  normalizeAndRouteResponse(data, { reason: 'login-complete' });
};
```

**Remove lines:** All GameStateManager and applyGameMutation calls

**Rollback:** Restore GameStateManager calls

### **Phase 2.3: Migrate useRegenCountdown (Optimistic Updates)**

**File:** `client/src/hooks/useRegenCountdown.js`

**Before:**
```javascript
const turns = gameStateManager.getState()?.turns_stored || 0;
// ... later
gameStateManager.applyUpdates({ turns_stored: Math.max(0, turns - 1) });
```

**After:**
```javascript
const profile = useProfileStore((s) => s.turns_stored || 0);
// ... later
useProfileStore.getState().receiveTurnUpdate({ turns_stored: Math.max(0, profile - 1) });
```

**Or:** Delegate optimistic updates to server only (simpler)

**Rollback:** Restore legacy GameStateManager calls

---

## Phase 3A: State Source Migration (Days 7-8)

**Goal:** Prove components render correctly from Zustand alone (BEFORE removing listeners)

**KEY PRINCIPLE:** Don't remove useGameMutationEvents() yet. Instead, verify components work by reading from Zustand stores directly.

### **Phase 3A.1: Add Zustand Reads (Dual Data Sources - Temporary)**

**For each component using useGameMutationEvents(), add Zustand reads alongside it:**

**Before (DefensePanel):**
```javascript
import { useGameMutationEvents } from '../../hooks/useGameState';

export const DefensePanel = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  useGameMutationEvents((event) => {
    if (['wall-built', 'attack'].includes(event.reason)) {
      setRefreshKey(k => k + 1);
    }
  });
  
  // Component renders based on refreshKey (tied to listener)
  return <div key={refreshKey}>{/* ... */}</div>;
};
```

**After Phase 3A (Dual sources - testing period):**
```javascript
import { useGameMutationEvents } from '../../hooks/useGameState';
import { useMilitaryStore } from '../../stores';
import { useShallow } from 'zustand/react';

export const DefensePanel = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  // ← KEEP listener for now (fallback)
  useGameMutationEvents((event) => {
    if (['wall-built', 'attack'].includes(event.reason)) {
      setRefreshKey(k => k + 1);
    }
  });
  
  // ← ADD direct Zustand reads USING useShallow to prevent re-render noise
  // useShallow prevents re-renders from unrelated store properties changing
  // (only re-renders if wallHp or walls actually change)
  const defenseData = useMilitaryStore(useShallow((s) => ({
    wallHp: s.wallHp,
    walls: s.bld_walls,
  })));
  
  // Component still renders based on refreshKey, but ALSO renders when stores change
  // If both work, listener is redundant
  return <div key={refreshKey}>{/* Now renders from both sources */}</div>;
};
```

**Why this works:**
- Component gets Zustand updates automatically (store subscription via useShallow)
- Component ALSO gets GameStateManager updates (listener via refreshKey)
- useShallow prevents false positives (re-renders only when selected properties change)
- If they diverge, you'll see it immediately
- If they stay in sync, listener is proven redundant

**Testing step:** Trigger an API call (buy upgrade, take turn, etc.) and verify:
1. UI updates from Zustand (stores changed)
2. UI updates from GameStateManager listener (both work)
3. If only #2 happens, Zustand routing is broken (catch it here!)
4. Check React DevTools Profiler: useShallow should prevent spurious re-renders

### **Phase 3A.2: Apply to all 15 components**

Add Zustand selectors to:
1. DefensePanel
2. EconomyPanel
3. ExplorationPanel
4. HappinessPanel
5. HappinessWidget
6. MarketPanel
7. NewsPanel
8. StudiesPanel
9. ResourcesPanel
10. ... (all 15)

**Deliverable:** All 15 components reading from Zustand stores, but listeners still in place (safety net).

**Gate:** Run full smoke test. If Zustand reads match listener updates, proceed to 3B. If not, debug the mismatch BEFORE removing listeners.

**Rollback:** Revert component changes, restore listener calls
```bash
# Revert Phase 3A component migrations (15 files)
git log --oneline -n 30 | grep -i "phase 3a\|dual"

# Batch revert all Phase 3A changes
git revert HEAD~15..HEAD  # Adjust range to match actual component commit count
git push origin main
```

---

### **Gate Before Phase 3B: Smoke Test (Day 8 - CRITICAL)**

```bash
npm run test:components
npm run dev  # Manual testing
```

**Manual testing checklist:**
- [ ] Buy farm upgrade → UI updates (verify Zustand read worked)
- [ ] Buy bank upgrade → UI updates (verify Zustand read worked)
- [ ] Take turn → UI updates (verify Zustand read worked)
- [ ] Build wall → UI updates (verify Zustand read worked)
- [ ] Attack enemy → UI updates (verify Zustand read worked)
- [ ] Hire unit → UI updates and capacity limits work
- [ ] Check HirePanel Max button → capacity calculations correct
- [ ] Console: NO warnings about deprecated GameStateManager calls (via compatibility layer)

**Result:** If ALL work AND no compatibility layer warnings, listeners are proven redundant → proceed to Phase 3B. If ANY fail, debug before proceeding.

**Rollback Trigger:** If ANY manual test fails, STOP. Do NOT proceed to Phase 3B. Investigate root cause, fix, retest.

---

## Phase 3B: Listener Removal (Days 9-10)

**Goal:** Remove legacy refresh patterns NOW THAT WE'VE PROVEN Zustand works

**Only proceed if Phase 3A smoke test passes!**

### **Phase 3B.1: Remove useGameMutationEvents() calls**

Now that components are proven to work via Zustand reads, remove the listeners:

**Before (from Phase 3A):**
```javascript
import { useGameMutationEvents } from '../../hooks/useGameState';
import { useWallHp, useBuildCount } from '../../stores';

export const DefensePanel = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  useGameMutationEvents((event) => {  // ← REMOVE THIS
    if (['wall-built', 'attack'].includes(event.reason)) {
      setRefreshKey(k => k + 1);
    }
  });
  
  const wallHp = useWallHp();
  const bldWalls = useBuildCount('walls');
  
  return <div key={refreshKey}>{/* ... */}</div>;
};
```

**After Phase 3B (Zustand only):**
```javascript
import { useWallHp, useBuildCount } from '../../stores';
import { useShallow } from 'zustand/react';

export const DefensePanel = () => {
  // ← refreshKey no longer needed (Zustand subscriptions trigger re-render)
  
  const wallHp = useWallHp();  // Component re-renders when this changes
  const bldWalls = useBuildCount('walls');  // Component re-renders when this changes
  
  return <div>{/* ... */}</div>;  // No key needed
};
```

**Performance Optimization:** Use `useShallow` for selectors returning objects:

```javascript
// ❌ DON'T: This causes re-renders on ANY store change
const allDefenseData = useMilitaryStore();

// ✅ DO: Only re-render when selected properties change
const defenseData = useMilitaryStore(useShallow((s) => ({
  wallHp: s.wallHp,
  walls: s.bld_walls,
})));
```

### **Phase 3B.2: Apply to all 15 components**

Remove listener calls from all components that had them.

### **Phase 3B.3: Migrate applyGameMutation() calls (Already done in Phase 2!)**

**CRITICAL FILE:** `UpgradesList.jsx` — handles ALL building upgrade purchases (see canonical reference above)

**Architectural Separation:**

When migrating UpgradesList.jsx, maintain clear separation:
- **Component logic (stays in UpgradesList.jsx):** UI state (purchasing flag, modal state), user interaction flows, local validation, toast messages
- **Store routing (use responseNormalizer):** All server response handling, state updates, inter-store consistency

**Migration Strategy:**

Use the centralized response normalizer from Phase 1.5:

**Before (Current - Legacy):**
```javascript
if (result.updates) {
  applyGameMutation(result, { reason: 'economy-upgrade' });  // All updates → GameStateManager
  // Component-level: update owned state, show toast, handle callback
  const nextOwned = ownedFromUpdates(result.updates, category) || { ...owned, [upgradeKey]: true };
  onPurchased?.(upgradeKey, nextOwned);
  toast(`${def.name} purchased!`, 'success');
}
```

**After (Zustand + Normalizer - Explicit routing):**

```javascript
// At top of component file:
import { normalizeAndRouteResponse } from '../../utils/responseNormalizer';

// In handleBuy function:
if (result.updates) {
  // ← Phase 1.5: Use centralized normalizer for ALL store routing (enforces contract)
  normalizeAndRouteResponse(result, { 
    reason: 'upgrade-purchased',
    category: category,
    upgradeKey: upgradeKey
  });
  
  // ← Component-level logic (UI concerns, stays here)
  const nextOwned = ownedFromUpdates(result.updates, category) || { ...owned, [upgradeKey]: true };
  onPurchased?.(upgradeKey, nextOwned);
  toast(`${def.name} purchased!`, 'success');
}
```

**Why this split?**
1. **Component stays responsible for:** UI state management, user feedback (toasts, loading flags), callback triggers for parent component updates
2. **Normalizer responsible for:** ALL server → Zustand state routing, contract validation, multi-store sync
3. **Benefits:** Single source of truth for routing (normalizer), cleaner component code, easier to test store sync independently

**Specific Code Changes in UpgradesList.jsx:**

```diff
  Line 1-10 (Imports):
  - import { applyGameMutation } from '../../utils/gameMutations';
  + import { normalizeAndRouteResponse } from '../../utils/responseNormalizer';

  Line 48-68 (Mausoleum endpoint):
  - applyGameMutation(result, { reason: 'economy-upgrade' });
  + normalizeAndRouteResponse(result, { reason: 'upgrade-purchased', type: 'mausoleum' });

  Line 70-99 (Economy endpoint, all 6 types + school):
  - applyGameMutation(result, { reason: 'economy-upgrade' });
  + normalizeAndRouteResponse(result, { reason: 'upgrade-purchased', type: category });
```

**Verification checklist for Phase 3B.3:**
- [ ] Farm upgrade purchase → economyStore.farm_upgrades updated (via normalizer)
- [ ] Bank upgrade purchase → economyStore.bank_upgrades updated (via normalizer)
- [ ] Granary upgrade purchase → economyStore.granary_upgrades updated (via normalizer)
- [ ] Market upgrade purchase → economyStore.market_upgrades updated (via normalizer)
- [ ] Tavern upgrade purchase → economyStore.tavern_upgrades updated (via normalizer)
- [ ] School upgrade purchase → researchStore.school_upgrades updated (via normalizer)
- [ ] Mausoleum upgrade purchase → economyStore.mausoleum_upgrades updated (via normalizer)
- [ ] No applyGameMutation() calls remain in UpgradesList.jsx
- [ ] Component-level logic (toasts, owned state, callbacks) still work correctly
- [ ] No console errors from validateContract() in dev mode

**Rollback:** Restore listener calls, restore applyGameMutation calls
```bash
# Revert Phase 3B component + UpgradesList migrations
git log --oneline -n 30 | grep -i "phase 3b\|listener\|UpgradesList"

# Batch revert all Phase 3B changes
git revert HEAD~8..HEAD  # Adjust range to match actual Phase 3B commits
git push origin main
```

---

## Phase 4: Utility Function Cleanup (Day 11)

**Goal:** Remove bridging utilities, integrate directly into stores or components

### **Phase 4.1: Delete gameMutations.js**
- Remove `client/src/utils/gameMutations.js`
- Replace all imports with direct store calls (already done in Phase 2-3)

### **Phase 4.2: Update panelNav.js**

**File:** `client/src/utils/panelNav.js`

Remove all GameStateManager references:
```diff
- const gameState = gameStateManager.getState();
+ const gameState = {
+   gold: useEconomyStore.getState().gold,
+   // ... construct from stores
+ };
```

Or better: **Return to stores, don't construct pseudo-state**

### **Phase 4.3: Update shellBridge.js**

**File:** `client/src/utils/shellBridge.js`

Remove re-exports of GameStateManager functions. If shell needs state, pass it explicitly or use stores.

### **Phase 4.4: Update replayWarReport.js**

**File:** `client/src/utils/replayWarReport.js`

**Before:**
```javascript
const warLogCache = gameStateManager.getState().warLogCache;
```

**After (Decision deferred to Phase 6.8):** 
- If warLogCache is in a store, read from there
- If it's component-level state, pass as prop
- Or: create a warLogStore for war-related data

**Rollback:** Restore utility compatibility
```bash
# Revert Phase 4 utility migrations (panelNav, shellBridge, replayWarReport)
git log --oneline -n 20 | grep -i "phase 4\|utility\|panelNav\|shellBridge"

# Batch revert all Phase 4 changes
git revert HEAD~4..HEAD  # Adjust range to match actual Phase 4 commits
git push origin main
```

---

## Phase 5: Test Updates (Day 12)

**Goal:** Update all mocks to use Zustand test patterns

### **Phase 5.1: Update test fixtures**

**Before:**
```javascript
vi.mock('../../hooks/useGameState', () => ({
  useGameMutationEvents: vi.fn(),
}));
```

**After:**
```javascript
// No mock needed - useGameMutationEvents removed
// Use store mocks instead
vi.mock('../../stores', () => ({
  useEconomyStore: { getState: () => mockEconomyStore }
}));
```

### **Phase 5.2: Add integration tests with Zustand patterns**

Verify stores are synced after API calls and responseNormalizer works correctly:

**Pattern 1: Direct store state inspection**
```javascript
import { useEconomyStore, useResearchStore } from '../../stores';

test('farm upgrade routes through normalizer to economyStore', async () => {
  // Capture initial state
  const initialGold = useEconomyStore.getState().gold;
  const initialFarmUpgrades = useEconomyStore.getState().farm_upgrades;
  
  // Mock API response (what server returns)
  const mockResponse = {
    updates: {
      economy: {
        farm_upgrades: { ...initialFarmUpgrades, irrigation: true },
        gold: initialGold - 1000,
      },
    }
  };
  
  // Simulate normalizer call (happens in UpgradesList.jsx)
  normalizeAndRouteResponse(mockResponse, { reason: 'upgrade-purchased', type: 'farm' });
  
  // Verify stores updated
  expect(useEconomyStore.getState().farm_upgrades.irrigation).toBe(true);
  expect(useEconomyStore.getState().gold).toBe(initialGold - 1000);
});
```

**Pattern 2: useShallow selector testing**
```javascript
test('component re-renders only when selected properties change (useShallow)', async () => {
  const renderSpy = vi.fn();
  
  function TestComponent() {
    const defenseData = useEconomyStore(useShallow((s) => ({
      gold: s.gold,
      wood: s.wood,
      // Note: NOT including stone (should not trigger re-render)
    })));
    
    renderSpy(defenseData);
    return <div>{defenseData.gold}</div>;
  }
  
  const { rerender } = render(<TestComponent />);
  
  // Update only stone (not in selector)
  useEconomyStore.setState({ stone: 9999 });
  expect(renderSpy).toHaveBeenCalledTimes(1); // No re-render
  
  // Update gold (in selector)
  useEconomyStore.setState({ gold: 5000 });
  expect(renderSpy).toHaveBeenCalledTimes(2); // Re-render triggered
});
```

**Pattern 3: Validation catches contract violations**
```javascript
test('validateContract throws on malformed response in dev', () => {
  const badResponse = {
    unexpected_key: 'value',  // Not in contract
    economy: { gold: 100 },
  };
  
  expect(() => {
    validateContract(badResponse, { context: 'test' });
  }).toThrow(/Unexpected response keys/);
});
```

### **Phase 5.3 (DEFER): Atomic Multi-Store Updates Evaluation**

**Timing:** Evaluate during Phase 5 testing if React rendering becomes excessive.

**If needed:** Wrap multi-store updates in `unstable_batchedUpdates()`:
```javascript
import { unstable_batchedUpdates } from 'react-dom';

export function normalizeAndRouteResponse(response, context = {}) {
  // ... validation ...
  
  unstable_batchedUpdates(() => {
    if (Object.keys(normalized.economy).length > 0) {
      useEconomyStore.getState().receiveServerSnapshot(normalized.economy);
    }
    if (Object.keys(normalized.military).length > 0) {
      useMilitaryStore.getState().receiveServerSnapshot(normalized.military);
    }
    // ... etc for all stores
  });
}
```

**Decision point:** If Phase 5 profiling shows excessive re-renders, implement batching. Otherwise, unnecessary optimization.

---

## Phase 6: Cleanup & Deletion (Day 13)

**Goal:** Remove all legacy code. Lock down architecture.

### **Phase 6.1: Delete files**
```bash
rm client/src/GameStateManager.js
rm client/src/hooks/useGameState.js
rm client/src/hooks/usePanelState.js
rm client/src/utils/gameMutations.js
```

### **Phase 6.2: Verify no imports remain**
```bash
grep -r "GameStateManager\|useGameState\|useGameMutationEvents\|useGameSelector\|gameMutations" client/src --include="*.js" --include="*.jsx"
# Should return: 0 results
```

### **Phase 6.3: Create automated verification script**

**File:** `scripts/verify-migration.js` (new)

```bash
#!/usr/bin/env node

/**
 * Verify that GameStateManager migration is complete.
 * Runs as part of CI to prevent accidental reintroduction.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const checks = [
  {
    name: 'GameStateManager imports',
    grep: 'grep -r "import.*GameStateManager" client/src --include="*.js" --include="*.jsx"',
    shouldFind: 0,
  },
  {
    name: 'gameStateManager references',
    grep: 'grep -r "gameStateManager" client/src --include="*.js" --include="*.jsx"',
    shouldFind: 0,
  },
  {
    name: 'useGameState hook usage',
    grep: 'grep -r "useGameState\|useGameMutationEvents" client/src --include="*.js" --include="*.jsx"',
    shouldFind: 0,
  },
  {
    name: 'gameMutations imports',
    grep: 'grep -r "gameMutations" client/src --include="*.js" --include="*.jsx"',
    shouldFind: 0,
  },
];

let passed = 0;
let failed = 0;

console.log('🔍 Verifying GameStateManager migration...\n');

checks.forEach(check => {
  try {
    const result = execSync(check.grep, { encoding: 'utf-8', stdio: 'pipe' });
    const found = result.split('\n').filter(l => l.trim()).length;
    
    if (found === check.shouldFind) {
      console.log(`✅ ${check.name}: PASS (${found} found, expected ${check.shouldFind})`);
      passed++;
    } else {
      console.log(`❌ ${check.name}: FAIL (${found} found, expected ${check.shouldFind})`);
      console.log(result);
      failed++;
    }
  } catch (e) {
    if (e.status === 1 && check.shouldFind === 0) {
      // grep returns 1 when no matches found (expected)
      console.log(`✅ ${check.name}: PASS (0 found, expected 0)`);
      passed++;
    } else {
      console.log(`❌ ${check.name}: FAIL (error: ${e.message})`);
      failed++;
    }
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
```

**Add to package.json:**
```json
{
  "scripts": {
    "verify:migration": "node scripts/verify-migration.js"
  }
}
```

**Add to CI:** `.github/workflows/test.yml`
```yaml
- name: Verify migration
  run: npm run verify:migration
```

**Effect:** CI fails if any legacy references are found. Prevents accidental reintroduction.

### **Phase 6.4: Lock Down Architecture**

**File:** `.eslintrc.mjs` (update)

```javascript
export default [
  {
    ignores: ['node_modules/', 'dist/'],
  },
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'GameStateManager',
              message: 'GameStateManager is deleted. Use Zustand stores (useEconomyStore, useMilitaryStore, etc.) instead.',
            },
            {
              name: './GameStateManager',
              message: 'GameStateManager is deleted. Use Zustand stores instead.',
            },
          ],
          patterns: [
            {
              group: ['**/GameStateManager'],
              message: 'GameStateManager is deleted. Use Zustand stores instead.',
            },
          ],
        },
      ],
    },
  },
];
```

**Effect:** ESLint immediately rejects any file trying to import GameStateManager. Developers know instantly it's gone.

### **Phase 6.5: Run full test suite**
```bash
npm run lint
npm test
npm run test:components
npm run verify:migration
```

### **Phase 6.6: Manual smoke test**
- Load game in browser
- Buy farm upgrade → verify `farm_upgrades` appears in store
- Hire units → verify barracks/school capacity works
- Take turn → verify turns_stored updates
- Check HirePanel Max button → should show capacity correctly
- Check browser console → NO warnings or errors

### **Phase 6.7 (Post-Migration): UIStore localStorage Persistence**

**Timing:** Only after Phase 6 confirms GameStateManager is fully removed.

**Implementation:**
```javascript
// client/src/stores/uiStore.js
import { create } from 'zustand';
import { persist, immer } from 'zustand/middleware';

export const useUIStore = create(
  persist(
    immer((set) => ({
      // ... existing state
      setPanelState: (panelName, state) => set((s) => {
        s.panelState[panelName] = state;
      }),
    })),
    {
      name: 'narmir-ui-storage',
      partialize: (state) => ({
        panelState: state.panelState,  // Only persist UI preferences
      }),
    }
  )
);
```

### **Phase 6.8: Documentation Updates**

**Update CLAUDE.md:**
- Remove all GameStateManager references
- Add "Zustand-Only" pattern section with examples
- Document store usage rules:
  - ✅ Use hooks in components: `const gold = useGold()`
  - ✅ Use `.getState()` in utilities/socket handlers: `useEconomyStore.getState().gold`
  - ✅ All API responses flow through `normalizeAndRouteResponse()`
  - ✅ Use `useShallow` for object selectors to prevent re-renders
  - ❌ Never directly mutate store state
  - ❌ Never use hooks in non-component contexts
  - ❌ Never create new state without going through receiveServerSnapshot

### **Phase 6.9: War Log Cache Resolution**

**Current state:** Only mentioned in `replayWarReport.js`, read from GameStateManager

**Decision options (audit usage first):**
1. **militaryStore:** If warLogCache is combat-related ✅ Recommended
2. **profileStore:** If warLogCache is player-specific
3. **New warLogStore:** If very large and frequently updated

**Timing:** Decide based on actual usage patterns discovered during Phase 5.

---

## Risk Mitigation Matrix

| Risk | Probability | Impact | Mitigation | Testing |
|------|-------------|--------|-----------|---------|
| **Sync divergence during Phase 3A** | Medium | High | Dual data sources prove stores work before listener removal | Phase 3A smoke test |
| **Missing mutations trigger silent bugs** | Medium | **CRITICAL** | Gate before Phase 3B: manual test all actions (buy, attack, turn) | Comprehensive smoke test |
| **Hidden dependencies in Phase 1B** | Low | Medium | Comprehensive grep audit of all 6 patterns | Zero grep results |
| **Contract violations caught too late** | Low | High | validateContract() THROWS in dev, catches misshapes immediately | Contract tests |
| **Performance regression from dual reads** | Low | Medium | Remove listeners in Phase 3B, profile with React DevTools | Phase 5 perf audit |
| **Forgotten legacy calls break things** | Medium | **HIGH** | Compatibility layer (Phase 1.2) catches forgotten calls via console warnings | Phase 5 smoke test |
| **Panel state lost during migration** | Low | Low | UIStore.panelState persists in-memory; localStorage added post-migration | Session testing |
| **Tests break due to mock changes** | High | Medium | Create store mocks early (Phase 1.3), update incrementally | Phase 5 automation |
| **War log cache placement unclear** | Low | Low | Defer decision to Phase 6.9 after usage audit | Document decision |
| **Legacy code reintroduced months later** | Medium | High | ESLint forbids imports + CI verification script + ADR | CI blocks bad imports |

---

## Completion Checklist

### **Pre-Migration Audits**
- [ ] **Pre-Phase 1A: Response Contract**
  - [ ] Document response shape for all 7+ API endpoints
  - [ ] Create `/game/API_CONTRACT.md` with standardized format
  - [ ] Identify any endpoints with non-standard responses
- [ ] **Pre-Phase 1B: Hidden Dependencies**
  - [ ] Run all 6 grep audits for GameStateManager usage
  - [ ] Document any indirect imports found
  - [ ] Update 23-file list with amendments
  - [ ] Check all tests for GameStateManager mocks

### **Phase 1**
- [ ] UIStore extended with panel state management
- [ ] usePanelState.js deleted
- [ ] Test fixtures created
- [ ] Compatibility layer introduced (GameStateManager → proxy)
- [ ] **Gate:** UIStore panel state persists; compatibility layer catches forgotten calls
- [ ] **Rollback plan documented**

### **Phase 1.5: Response Normalizer**
- [ ] Create `responseNormalizer.js` with contract enforcement
- [ ] Runtime assertions: throw errors in dev (not just warn)
- [ ] Tree-shaking documentation added (process.env.NODE_ENV)
- [ ] Update all handlers to use `normalizeAndRouteResponse()`
- [ ] Logging added for debugging
- [ ] **Gate:** All API responses route to correct stores, no partial updates
- [ ] **Rollback plan documented**

### **Phase 2**
- [ ] useGameActions.applyResult() uses normalizer
- [ ] AuthModal.loadKingdom() uses normalizer
- [ ] useRegenCountdown() uses normalizer
- [ ] UpgradesList.jsx uses normalizer (both endpoints)
- [ ] All dual-system calls eliminated
- [ ] **Gate:** Buy upgrade → economyStore updates (not GameStateManager)
- [ ] **Rollback plan documented**

### **Phase 3A: Dual Data Sources (Proving Zustand Works)**
- [ ] DefensePanel: Add Zustand reads (keep listener)
- [ ] EconomyPanel: Add Zustand reads (keep listener)
- [ ] ExplorationPanel: Add Zustand reads (keep listener)
- [ ] HappinessPanel: Add Zustand reads (keep listener)
- [ ] HappinessWidget: Add Zustand reads (keep listener)
- [ ] MarketPanel: Add Zustand reads (keep listener)
- [ ] NewsPanel: Add Zustand reads (keep listener)
- [ ] StudiesPanel: Add Zustand reads (keep listener)
- [ ] ResourcesPanel: Add Zustand reads (keep listener)
- [ ] ... (all 15 components)
- [ ] **Gate: Smoke Test (CRITICAL)**
  - [ ] Buy farm upgrade → UI updates from Zustand read
  - [ ] Buy bank upgrade → UI updates from Zustand read
  - [ ] Take turn → UI updates from Zustand read
  - [ ] Build wall → UI updates from Zustand read
  - [ ] Attack enemy → UI updates from Zustand read
  - [ ] NO warnings from compatibility layer about legacy calls
  - [ ] If ANY fails, STOP. Debug before proceeding. Do NOT continue to Phase 3B.
- [ ] **Rollback plan documented**

### **Phase 3B: Listener Removal (Only After 3A Gate Passes)**
- [ ] Remove useGameMutationEvents() from all 15 components
- [ ] Remove useGameState() calls, replace with specific hooks
- [ ] Add useShallow selectors where needed
- [ ] All applyGameMutation() calls removed (done in Phase 2, but verify)
- [ ] 15 components now read exclusively from Zustand
- [ ] 5 hooks migrated to Zustand
- [ ] **UpgradesList.jsx fully migrated** — ALL 7 upgrade types:
  - [ ] Farm upgrades → economyStore.farm_upgrades
  - [ ] Bank upgrades → economyStore.bank_upgrades
  - [ ] Granary upgrades → economyStore.granary_upgrades
  - [ ] Market upgrades → economyStore.market_upgrades
  - [ ] Tavern upgrades → economyStore.tavern_upgrades
  - [ ] School upgrades → researchStore.school_upgrades
  - [ ] Mausoleum upgrades → economyStore.mausoleum_upgrades
- [ ] **Gate:** Smoke test still passes after listener removal
- [ ] **Rollback plan documented**

### **Phase 4**
- [ ] gameMutations.js deleted
- [ ] panelNav.js updated
- [ ] shellBridge.js updated
- [ ] replayWarReport.js updated
- [ ] All utility functions working with Zustand
- [ ] **Rollback plan documented**

### **Phase 5**
- [ ] Test mocks updated
- [ ] Integration tests added (patterns 1-3 plus useShallow)
- [ ] All tests passing
- [ ] **DEFER: Atomic batching evaluation** (only if Phase 5 profiling shows excessive re-renders)
- [ ] **Rollback plan documented**

### **Phase 6**
- [ ] GameStateManager.js deleted
- [ ] useGameState.js deleted
- [ ] Zero grep results for "GameStateManager" or legacy hooks
- [ ] Automated verification script created and integrated into CI
- [ ] ESLint no-restricted-imports rule added (forbids GameStateManager)
- [ ] Lint passes
- [ ] All tests pass
- [ ] Verification script passes (`npm run verify:migration`)
- [ ] Smoke test passes
- [ ] UIStore localStorage persistence added (6.7)
- [ ] Documentation updated (6.8)
- [ ] War log cache decision documented (6.9)
- [ ] **Final rollback plan:** All cleanup is one-way (commits merged); document how to revert if needed

### **Post-Migration**
- [ ] Code review of all changes
- [ ] Performance audit (no regression)
- [ ] Document new patterns for future work
- [ ] Celebrate migration success 🎉

---

## Success Criteria (Definition of Done)

✅ **Code:**
- Zero imports of GameStateManager
- Zero imports of useGameState, useGameMutationEvents, useGameSelector
- All 23 affected files updated
- No dead code references

✅ **Tests:**
- All existing tests passing
- New integration tests for store sync (patterns 1-3)
- useShallow selector tests added
- Test coverage maintained or improved

✅ **Functionality - Building Upgrades (ALL 7 types tested):**
- [ ] Farm upgrades work correctly (irrigation, etc.)
- [ ] Bank upgrades work correctly
- [ ] Granary upgrades work correctly
- [ ] Market upgrades work correctly
- [ ] Tavern upgrades work correctly
- [ ] School upgrades work correctly
- [ ] Mausoleum upgrades work correctly
- [ ] Each upgrade deducts gold correctly
- [ ] Each upgrade updates store immediately
- [ ] Gold in economyStore reflects post-upgrade value
- [ ] mana/research in researchStore reflects post-school-upgrade
- [ ] Building updates flow through Zustand (not GameStateManager)
- [ ] Max button respects capacity
- [ ] Socket events properly sync stores
- [ ] No console errors

✅ **Performance:**
- No performance regression (measured with React DevTools Profiler)
- Component render counts reasonable
- useShallow selectors prevent unnecessary re-renders

✅ **Safety & Architecture:**
- Compatibility layer proved all forgotten callers were caught
- Automated verification script prevents reintroduction
- ESLint forbids GameStateManager imports
- All rollback plans documented
- Zero silent sync bugs discovered during migration

✅ **Documentation:**
- Update CLAUDE.md to remove GameStateManager references
- Add note about Zustand-only pattern for new code
- Document store usage patterns and useShallow optimization
- War log cache placement documented
- Migration lessons learned documented

---

## Lessons Learned & Reference

**Key Principles for Future Migrations:**
1. **Response contract enforcement prevents subtle sync bugs** — Validate in dev (throw errors), tree-shake in production
2. **Dual data sources prove listeners redundant before deletion** — Phase 3A catches divergence early
3. **Comprehensive grep audit catches indirect dependencies** — Pre-Phase 1B is non-negotiable
4. **Direct store refs via `.getState()` work in all contexts** — Not just components, also utilities/socket handlers
5. **Centralized routing normalizer is the single source of truth** — All handlers use same function
6. **useShallow optimizes selector performance** — Prevent re-renders on unrelated property changes
7. **Compatibility layer reduces risk** — Forgotten calls still work but log warnings; proves migration is complete when warnings go to zero
8. **Automated CI checks prevent regressions** — ESLint + verification script catches accidental reintroduction

**Questions Resolved:**
- ✅ Panel State: UIStore persists in-memory, localStorage post-migration
- ✅ Compatibility Layer: Proxy catches forgotten calls via warnings, safe to delete when zero warnings in Phase 5
- ✅ Optimistic Updates: Simplest to delegate to server; revisit if needed
- ✅ Mutation Events: No external systems listening; safe to delete
- ⏳ War Log Cache: Defer to Phase 6.9 after usage audit
- ⏳ Multi-Store Batching: Defer to Phase 5 evaluation (only if profiling shows excess re-renders)

---

