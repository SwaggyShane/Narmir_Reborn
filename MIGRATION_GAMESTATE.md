# GameStateManager → Zustand Migration Plan

**Objective:** Eliminate all legacy GameStateManager usage and consolidate to Zustand stores only.

**Completion Criteria:** 
- ✅ GameStateManager.js deleted
- ✅ useGameState.js deleted  
- ✅ Zero imports of GameStateManager or legacy hooks
- ✅ All 23 affected files migrated to Zustand
- ✅ All tests passing with new patterns
- ✅ All socket/API handlers flow through Zustand only

---

## Executive Summary

The codebase currently has **two parallel state management systems**:

| System | Scope | Status |
|--------|-------|--------|
| **Zustand stores** | Modern, domain-based (economy, military, research, population, profile) | Primary |
| **GameStateManager** | Legacy singleton class | **To Delete** |

**23 files** across components, hooks, and utilities still reference GameStateManager. This creates:
- **Sync gaps:** State updates sometimes only hit one system
- **Maintenance burden:** Two patterns to understand and maintain
- **Bug surface:** Farm upgrades and building updates flow through legacy bridge, not Zustand

---

## Current Architecture (To Remove)

```
API Response
    ↓
applyGameMutation()
    ↓
GameStateManager.applyUpdates()  ← TO ELIMINATE
    ↓
Listeners trigger (useGameMutationEvents)
    ↓
Components re-render
```

**Problems with this flow:**
1. Zustand stores not always updated (sync gap)
2. Building updates may not reach all subscribers
3. Panel state stored in GameStateManager.panelState Map (duplication)
4. Two sources of truth for same data

---

## Target Architecture (Post-Migration)

```
API Response
    ↓
{useEconomyStore|useMilitaryStore|etc.}.receiveServerSnapshot(data)
    ↓
Zustand store updates + notifies subscribers
    ↓
useShallow selectors and subscriptions
    ↓
Components re-render
```

**Benefits:**
1. Single source of truth per domain
2. Consistent update patterns
3. Better TypeScript support (Zustand is fully typed)
4. Simpler testing (mock stores, not listeners)
5. No hidden dependencies

---

## Building Upgrades In Scope (Complete List)

**ALL 7 building upgrade types are explicitly covered by this migration:**

| # | Upgrade Type | API Endpoint | Current Handler | Store Target | Property Name |
|---|--------------|--------------|-----------------|---------------|---------------|
| 1 | **Farm** | `/api/kingdom/economy/upgrade` | UpgradesList.jsx line 70 | economyStore | `farm_upgrades` |
| 2 | **Bank** | `/api/kingdom/economy/upgrade` | UpgradesList.jsx line 70 | economyStore | `bank_upgrades` |
| 3 | **Granary** | `/api/kingdom/economy/upgrade` | UpgradesList.jsx line 70 | economyStore | `granary_upgrades` |
| 4 | **Market** | `/api/kingdom/economy/upgrade` | UpgradesList.jsx line 70 | economyStore | `market_upgrades` |
| 5 | **Tavern** | `/api/kingdom/economy/upgrade` | UpgradesList.jsx line 70 | economyStore | `tavern_upgrades` |
| 6 | **School** | `/api/kingdom/economy/upgrade` | UpgradesList.jsx line 70 | researchStore | `school_upgrades` |
| 7 | **Mausoleum** | `/api/kingdom/buy-mausoleum-upgrade` | UpgradesList.jsx line 48 | economyStore | `mausoleum_upgrades` |

**Current Issue:** All 7 flow through `applyGameMutation()` → GameStateManager (legacy)

**Post-Migration:** All 7 flow through Zustand stores directly (modern)

**Migration Point:** Single file (`UpgradesList.jsx`) handles all 7 types, so fixing it fixes all upgrade types at once.

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

## Pre-Migration: Response Contract & Hidden Dependencies Audit

**CRITICAL GROUNDWORK (Before Phase 1)**

### **Pre-Phase 1A: Define Response Routing Contract** (Day 0.5)

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

**Standardization rule:**
- **EVERY response** must have `updates` object with exactly these sub-objects: `{ economy, military, population, research, profile }`
- **If endpoint doesn't update a domain**, pass empty object: `{ research: {} }` not missing
- **No custom shapes** — no "just return gold", no "returns farm_upgrades at top level"

**Why this matters:**
- Handlers don't have to guess about response shape
- `applyResult()` always routes the same way
- No "sometimes it's here, sometimes it's there" sync bugs

**Deliverable:** `/game/API_CONTRACT.md` documenting response shape for every endpoint

---

### **Pre-Phase 1B: Hidden Dependencies Audit** (Day 0.5)

**Problem:** Initial grep found 23 files. But there are likely:
- Indirect imports (A imports B imports GameStateManager)
- Dynamic/computed usage (getState() calls hidden in ternaries)
- Re-exports we didn't catch
- Template strings with property names

**Audit steps:**

```bash
# 1. Find all re-exports
grep -r "export.*gameStateManager\|export.*useGameState\|export.*gameMutation" /home/user/Narmir_Reborn/client/src

# 2. Find computed/dynamic usage
grep -r "getState\|applyUpdates" /home/user/Narmir_Reborn/client/src | grep -v "Zustand\|useEconomyStore\|useMilitaryStore" | grep -v node_modules

# 3. Find any remaining listener subscriptions
grep -r "subscribe\|listener" /home/user/Narmir_Reborn/client/src | grep -v "Zustand\|store\|node_modules"

# 4. Check all tests for mocked GameStateManager
grep -r "vi.mock.*GameState\|jest.mock.*GameState" /home/user/Narmir_Reborn/client/src

# 5. Find config/constant files that might reference it
grep -r "GameState\|applyGame" /home/user/Narmir_Reborn/client/src/utils/config* /home/user/Narmir_Reborn/client/src/constants*

# 6. Check if any plugin/extension system dynamically loads it
grep -r "require.*GameState\|import.*GameState" /home/user/Narmir_Reborn/client/src | grep -v node_modules | grep -v "\.test\."
```

**Document findings as amendments to the 23-file list.**

---

## Migration Phases

### **Phase 1: Foundation Setup** (Days 1-2)
**Goal:** Make uiStore ready to replace panel state storage

#### 1.1 Extend UIStore with Panel State
**File:** `client/src/stores/uiStore.js`

**Before:**
```javascript
// Panel state stored in GameStateManager.panelState Map
gameStateManager.setPanelState('defensePanel', { expanded: true });
```

**After:**
```javascript
// In uiStore.js - add panel state management
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

#### 1.2 Create test fixtures for Zustand stores
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

### **Phase 1.5: Response Normalization Layer** (Day 2.5)
**Goal:** Implement centralized response routing that enforces the contract

**Before Phase 2, create a single source of truth for response routing:**

**File:** `client/src/utils/responseNormalizer.js` (new)

```javascript
/**
 * Centralized response routing enforcing the API Contract.
 * All server responses pass through here before reaching stores.
 * This prevents partial-sync bugs and inconsistent routing.
 */

import { useEconomyStore } from '../stores';
import { useMilitaryStore } from '../stores';
import { useResearchStore } from '../stores';
import { usePopulationStore } from '../stores';
import { useProfileStore } from '../stores';

export function normalizeAndRouteResponse(response, context = {}) {
  if (!response?.updates) return null;
  
  const { updates } = response;
  
  // Enforce contract: every response must have all 5 domain objects
  const normalized = {
    economy: updates.economy || {},
    military: updates.military || {},
    research: updates.research || {},
    population: updates.population || {},
    profile: updates.profile || {},
  };
  
  // Validate: no unexpected top-level keys (catches routing mistakes)
  const validKeys = new Set(['economy', 'military', 'research', 'population', 'profile']);
  for (const key of Object.keys(updates)) {
    if (!validKeys.has(key) && !['error', 'events', 'updates'].includes(key)) {
      console.warn(`[Normalizer] Unexpected response key: ${key}`, response);
    }
  }
  
  // Route each domain to its store in strict order
  if (normalized.economy && Object.keys(normalized.economy).length > 0) {
    useEconomyStore.getState().receiveServerSnapshot(normalized.economy);
  }
  
  if (normalized.military && Object.keys(normalized.military).length > 0) {
    useMilitaryStore.getState().receiveServerSnapshot(normalized.military);
  }
  
  if (normalized.research && Object.keys(normalized.research).length > 0) {
    useResearchStore.getState().receiveServerSnapshot(normalized.research);
  }
  
  if (normalized.population && Object.keys(normalized.population).length > 0) {
    usePopulationStore.getState().receiveServerSnapshot(normalized.population);
  }
  
  if (normalized.profile && Object.keys(normalized.profile).length > 0) {
    useProfileStore.getState().receiveServerSnapshot(normalized.profile);
  }
  
  // Log for debugging
  if (context.reason) {
    console.log(`[Response Route] ${context.reason}`, { normalized });
  }
  
  return normalized;
}
```

**Rule:** ALL API handlers must use this function, not ad-hoc routing.

**Update all handlers to use it:**
- UpgradesList.jsx: `normalizeAndRouteResponse(result, { reason: 'upgrade-purchased' })`
- useGameActions.js: `normalizeAndRouteResponse(data, { reason: 'turn-complete' })`
- AuthModal.jsx: `normalizeAndRouteResponse(data, { reason: 'login-complete' })`
- etc.

**This ensures:**
- No inconsistent routing (single code path)
- Response shape validation (catches malformed responses)
- Consistent logging (easier debugging)
- Easy to verify all stores updated correctly

---

### **Phase 2: Critical Sync Point Migrations** (Days 3-4)
**Goal:** Eliminate dual-system updates in core logic using the normalized routing

#### 2.1 Migrate useGameActions.applyResult()
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
function applyResult(data, reason) {
  const updates = data?.updates || data?.kUpdates || null;
  if (updates) {
    // Route to appropriate store
    if (updates.gold !== undefined || updates.food !== undefined) {
      useEconomyStore.getState().receiveServerSnapshot(updates);
    }
    if (updates.troops !== undefined) {
      useMilitaryStore.getState().receiveServerSnapshot(updates);
    }
    if (updates.research !== undefined) {
      useResearchStore.getState().receiveServerSnapshot(updates);
    }
    if (updates.population !== undefined) {
      usePopulationStore.getState().receiveServerSnapshot(updates);
    }
    if (updates.turn !== undefined) {
      useProfileStore.getState().receiveServerSnapshot(updates);
    }
  }
  return data;
}
```

**Tests:** 
- Verify turn updates hit useProfileStore
- Verify gold/food updates hit useEconomyStore
- etc. for each store

#### 2.2 Migrate AuthModal.loadKingdom()
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
const loadKingdom = async (kingdomId) => {
  // ... fetch data
  useEconomyStore.getState().receiveServerSnapshot(data.economy);
  useMilitaryStore.getState().receiveServerSnapshot(data.military);
  useResearchStore.getState().receiveServerSnapshot(data.research);
  usePopulationStore.getState().receiveServerSnapshot(data.population);
  useProfileStore.getState().receiveServerSnapshot(data.profile);
  // Done - no GameStateManager calls
};
```

**Remove lines:** 25-30 (old gameStateManager.setState calls)

#### 2.3 Migrate useRegenCountdown (Optimistic Updates)
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

---

### **Phase 3A: State Source Migration** (Days 5-6)
**Goal:** Prove components render correctly from Zustand alone (BEFORE removing listeners)

**KEY PRINCIPLE:** Don't remove useGameMutationEvents() yet. Instead, verify components work by reading from Zustand stores directly.

#### 3A.1 Add Zustand Reads (Dual Data Sources - Temporary)

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
import { useWallHp, useBuildCount } from '../../stores';  // ← ADD ZUSTAND READS

export const DefensePanel = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  
  // ← KEEP listener for now (fallback)
  useGameMutationEvents((event) => {
    if (['wall-built', 'attack'].includes(event.reason)) {
      setRefreshKey(k => k + 1);
    }
  });
  
  // ← ADD direct Zustand reads
  const wallHp = useWallHp();  // Changes trigger component re-render via Zustand
  const bldWalls = useBuildCount('walls');
  
  // Component still renders based on refreshKey, but ALSO renders when stores change
  // If both work, listener is redundant
  return <div key={refreshKey}>{/* Now renders from both sources */}</div>;
};
```

**Why this works:**
- Component gets Zustand updates automatically (store subscription)
- Component ALSO gets GameStateManager updates (listener)
- If they diverge, you'll see it immediately
- If they stay in sync, listener is proven redundant

**Testing step:** Trigger an API call (buy upgrade, take turn, etc.) and verify:
1. UI updates from Zustand (stores changed)
2. UI updates from GameStateManager listener (both work)
3. If only #2 happens, Zustand routing is broken (catch it here!)

#### 3A.2 Apply to all 15 components

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

---

### **Phase 3B: Listener Removal** (Days 6-7)
**Goal:** Remove legacy refresh patterns NOW THAT WE'VE PROVEN Zustand works

**Only proceed if Phase 3A smoke test passes!**

#### 3B.1 Remove useGameMutationEvents() calls

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

export const DefensePanel = () => {
  // ← refreshKey no longer needed (Zustand subscriptions trigger re-render)
  
  const wallHp = useWallHp();  // Component re-renders when this changes
  const bldWalls = useBuildCount('walls');  // Component re-renders when this changes
  
  return <div>{/* ... */}</div>;  // No key needed
};
```

#### 3B.2 Apply to all 15 components

Remove listener calls from all components that had them.

#### 3B.3 Replace useGameState() calls

**Before:**
```javascript
const { state } = useGameState();
const gold = state.gold;
```

**After:**
```javascript
const gold = useGold();  // Direct Zustand hook
```

**Gate Before Phase 3B:**
```bash
# Run smoke test for all 15 components
npm run test:components
npm run dev  # Manual testing
# - Buy an upgrade → UI updates (verify Zustand read worked)
# - Take turn → UI updates (verify Zustand read worked)
# - Build structure → UI updates (verify Zustand read worked)
# - Attack → UI updates (verify Zustand read worked)
# If ALL work, listener is proven redundant → proceed to 3B
```

---

### **Phase 3B.2: Replace useGameState() calls** (Parallel to 3B.1)

**Before (ResourcesPanel, useKingdomRank):**
```javascript
const { state } = useGameState();
const gold = state.gold;
```

**After:**
```javascript
const gold = useGold();
const mana = useMana();
// etc. - use specific hooks instead
```

**Files to update:**
1. `ResourcesPanel.jsx` — line 117
2. `useKingdomRank.js` — line 26

#### 3B.3 Migrate applyGameMutation() calls (Already done in Phase 2!)

**CRITICAL FILE:** `UpgradesList.jsx` — handles ALL building upgrade purchases (lines 43-99)

**All Building Upgrade Types (7 total):**

| Upgrade Type | API Endpoint | Store | State Property | File | Line |
|--------------|--------------|-------|----------------|------|------|
| **Farm** | `/api/kingdom/economy/upgrade` | economyStore | `farm_upgrades` | UpgradesList.jsx | 70-99 |
| **Bank** | `/api/kingdom/economy/upgrade` | economyStore | `bank_upgrades` | UpgradesList.jsx | 70-99 |
| **Granary** | `/api/kingdom/economy/upgrade` | economyStore | `granary_upgrades` | UpgradesList.jsx | 70-99 |
| **Market** | `/api/kingdom/economy/upgrade` | economyStore | `market_upgrades` | UpgradesList.jsx | 70-99 |
| **Tavern** | `/api/kingdom/economy/upgrade` | economyStore | `tavern_upgrades` | UpgradesList.jsx | 70-99 |
| **School** | `/api/kingdom/economy/upgrade` | researchStore | `school_upgrades` | UpgradesList.jsx | 70-99 |
| **Mausoleum** | `/api/kingdom/buy-mausoleum-upgrade` | economyStore | `mausoleum_upgrades` | UpgradesList.jsx | 48-68 |

**All upgrade types flow through single component:** `UpgradesList.jsx`

**Files using `applyGameMutation()`:**
- `UpgradesList.jsx` — line 89 (handles ALL 7 upgrade types above!)
  - Line 48-68: Mausoleum upgrades (separate endpoint)
  - Line 70-99: Economy + School upgrades (unified endpoint)
- `useKingdomRank.js` — line 45

**Migration Strategy:**

UpgradesList.jsx needs to route upgrades to correct stores based on type:

**Before (Current - Legacy):**
```javascript
if (result.updates) {
  applyGameMutation(result, { reason: 'economy-upgrade' });  // ALL UPDATES → GameStateManager
}
```

**After (Zustand - Explicit routing by type):**

```javascript
if (result.updates) {
  // Economy upgrades: farm, bank, granary, market, tavern
  // These come back as: { farm_upgrades: {...}, gold: X, ... }
  if (result.updates.economy || result.updates.farm_upgrades !== undefined || 
      result.updates.bank_upgrades !== undefined || result.updates.granary_upgrades !== undefined ||
      result.updates.market_upgrades !== undefined || result.updates.tavern_upgrades !== undefined) {
    useEconomyStore.getState().receiveServerSnapshot(result.updates.economy || result.updates);
  }
  
  // School upgrades: research discipline
  // Comes back as: { school_upgrades: {...} }
  if (result.updates.school_upgrades !== undefined) {
    useResearchStore.getState().receiveServerSnapshot({
      school_upgrades: result.updates.school_upgrades
    });
  }
  
  // Mausoleum upgrades: comes back as { mausoleum_upgrades: {...}, gold: X }
  if (result.updates.mausoleum_upgrades !== undefined) {
    useEconomyStore.getState().receiveServerSnapshot(result.updates);
  }
}
```

**Specific Code Changes in UpgradesList.jsx:**

```diff
  Line 48-68 (Mausoleum endpoint):
  - applyGameMutation(result, { reason: 'economy-upgrade' });
+ if (result.updates) {
+   useEconomyStore.getState().receiveServerSnapshot(result.updates);
+ }

  Line 70-99 (Economy endpoint, all 5 types + school):
  - applyGameMutation(result, { reason: 'economy-upgrade' });
+ if (result.updates) {
+   // Route to economy store for farm/bank/granary/market/tavern
+   if (result.updates.economy) {
+     useEconomyStore.getState().receiveServerSnapshot(result.updates.economy);
+   }
+   // Route to research store for school upgrades
+   if (result.updates.research) {
+     useResearchStore.getState().receiveServerSnapshot(result.updates.research);
+   }
+ }
```

**Verification checklist for Phase 3.3:**
- [ ] Farm upgrade purchase → economyStore.farm_upgrades updated
- [ ] Bank upgrade purchase → economyStore.bank_upgrades updated
- [ ] Granary upgrade purchase → economyStore.granary_upgrades updated
- [ ] Market upgrade purchase → economyStore.market_upgrades updated
- [ ] Tavern upgrade purchase → economyStore.tavern_upgrades updated
- [ ] School upgrade purchase → researchStore.school_upgrades updated
- [ ] Mausoleum upgrade purchase → economyStore.mausoleum_upgrades updated
- [ ] No applyGameMutation() calls remain in UpgradesList.jsx

---

### **Phase 4: Utility Function Cleanup** (Days 8)
**Goal:** Remove bridging utilities, integrate directly into stores or components

#### 4.1 Delete gameMutations.js
- Remove `client/src/utils/gameMutations.js`
- Replace all imports with direct store calls (already done in Phase 2-3)

#### 4.2 Update panelNav.js
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

#### 4.3 Update shellBridge.js
**File:** `client/src/utils/shellBridge.js`

Remove re-exports of GameStateManager functions. If shell needs state, pass it explicitly or use stores.

#### 4.4 Update replayWarReport.js
**File:** `client/src/utils/replayWarReport.js`

**Before:**
```javascript
const warLogCache = gameStateManager.getState().warLogCache;
```

**After:** 
- If warLogCache is in a store, read from there
- If it's component-level state, pass as prop
- Or: create a warLogStore for war-related data

---

### **Phase 5: Test Updates** (Days 9)
**Goal:** Update all mocks to use Zustand test patterns

#### 5.1 Update HappinessWidget.test.jsx
**File:** `client/src/components/react/__tests__/HappinessWidget.test.jsx`

**Before:**
```javascript
vi.mock('../../hooks/useGameState', () => ({
  useGameMutationEvents: vi.fn(),
}));
```

**After:**
```javascript
// No mock needed - useGameMutationEvents removed
// Or if component still needs mutation events:
// Mock store subscriptions instead
```

#### 5.2 Update StudiesPanel.test.jsx
**File:** `client/src/components/react/__tests__/StudiesPanel.test.jsx`

Same pattern as above.

#### 5.3 Add integration tests
Verify stores are synced after API calls:
```javascript
test('farm upgrade updates economyStore', async () => {
  const initialFarmUpgrades = useEconomyStore.getState().farm_upgrades;
  
  await buyFarmUpgrade('irrigation');
  
  const updatedFarmUpgrades = useEconomyStore.getState().farm_upgrades;
  expect(updatedFarmUpgrades.irrigation).toBe(true);
});
```

---

### **Phase 6: Cleanup & Deletion** (Day 10)
**Goal:** Remove all legacy code

#### 6.1 Delete files
```bash
rm client/src/GameStateManager.js
rm client/src/hooks/useGameState.js
rm client/src/hooks/usePanelState.js
rm client/src/utils/gameMutations.js
```

#### 6.2 Verify no imports remain
```bash
grep -r "GameStateManager\|useGameState\|useGameMutationEvents\|useGameSelector\|gameMutations" client/src --include="*.js" --include="*.jsx"
# Should return: 0 results
```

#### 6.3 Run full test suite
```bash
npm run lint
npm test
npm run test:components
```

#### 6.4 Manual smoke test
- Load game in browser
- Buy farm upgrade → verify `farm_upgrades` appears in store
- Hire units → verify barracks/school capacity works
- Take turn → verify turns_stored updates
- Check HirePanel Max button → should show capacity correctly

---

## Detailed File Changes Reference

### **DefensePanel.jsx**
```diff
- import { useGameMutationEvents } from '../../hooks/useGameState';
- 
- useGameMutationEvents((event) => {
-   if (['economy-upgrade', 'attack-resolve'].includes(event.reason)) {
-     setRefreshKey(k => k + 1);
-   }
- });
```

Remove the hook call. If UI needs manual refetch on button clicks, add explicit handlers:
```javascript
const handleBuildWalls = async () => {
  // ... build logic
  setRefreshKey(k => k + 1); // manual refresh
};
```

### **UpgradesList.jsx** (Handles ALL 7 Upgrade Types)

**This is THE critical migration point.** All building upgrades (farm, bank, granary, market, tavern, school, mausoleum) flow through this single component.

**Line 1-10 (Imports):**
```diff
- import { applyGameMutation } from '../../utils/gameMutations';
+ import { useEconomyStore } from '../../stores';
+ import { useResearchStore } from '../../stores';
  // Other imports remain
```

**Lines 48-68 (Mausoleum upgrades - separate endpoint):**
```diff
  const handleBuy = async () => {
    if (purchasing) return;
    setPurchasing(true);
    try {
      if (category === 'mausoleum') {
        const result = await apiCall('/api/kingdom/buy-mausoleum-upgrade', {
          method: 'POST',
          body: { upgradeKey },
        });
        if (result.error) {
          toast(result.error, 'error');
          return;
        }
        playGameSound('upgrade_purchased');
        const nextOwned = { ...owned, [upgradeKey]: true };
+       // UPDATE: Route mausoleum upgrades to economyStore
+       if (result.updates?.economy || result.updates?.mausoleum_upgrades) {
+         useEconomyStore.getState().receiveServerSnapshot(result.updates);
+       }
        applyGameMutation({
          gold: Math.max(0, Number(state?.gold || 0) - Number(def.cost || 0)),
          mausoleum_upgrades: nextOwned,
        }, { reason: 'economy-upgrade' });
        onPurchased?.(upgradeKey, nextOwned);
        toast(`${def.name} purchased!`, 'success');
        return;
      }
```

**Lines 70-99 (Economy + School upgrades - unified endpoint):**
```diff
  // Non-mausoleum upgrades (FARM, BANK, GRANARY, MARKET, TAVERN, SCHOOL)
  const result = await apiCall('/api/kingdom/economy/upgrade', {
    method: 'POST',
    body: {
      category,  // 'farm' | 'bank' | 'granary' | 'market' | 'tavern' | 'school'
      upgradeKey,
    },
  });

  if (result.error) {
    toast(result.error, 'error');
    if (String(result.error).toLowerCase().includes('already purchased')) {
      onPurchased?.(upgradeKey, { ...owned, [upgradeKey]: true });
    }
    return;
  }

  playGameSound('upgrade_purchased');

  if (result.updates) {
-   applyGameMutation(result, { reason: 'economy-upgrade' });
+   // CRITICAL MIGRATION: Route all 6 upgrade types to appropriate stores
+   if (result.updates.economy) {
+     // Farm, Bank, Granary, Market, Tavern upgrades
+     // Server returns: { economy: { farm_upgrades, bank_upgrades, granary_upgrades, market_upgrades, tavern_upgrades, gold, ... } }
+     useEconomyStore.getState().receiveServerSnapshot(result.updates.economy);
+   }
+   if (result.updates.research) {
+     // School upgrades
+     // Server returns: { research: { school_upgrades, mana, ... } }
+     useResearchStore.getState().receiveServerSnapshot(result.updates.research);
+   }
  }

  const nextOwned = ownedFromUpdates(result.updates, category)
    || { ...owned, [upgradeKey]: true };
  onPurchased?.(upgradeKey, nextOwned);
  toast(`${def.name} purchased!`, 'success');
```

**Summary of changes:**
- **Remove:** `import { applyGameMutation }`
- **Add:** `import { useEconomyStore, useResearchStore }` 
- **Line 48-68:** Route mausoleum to economyStore
- **Line 89:** Replace `applyGameMutation()` with explicit store routing
- **Ensure:** All 7 upgrade types hit correct stores

**Post-migration, this component will be the definitive example of "correct" Zustand mutation patterns** for new code.

### **useGameActions.js**
```diff
- function applyResult(data, reason) {
-   const updates = data?.updates || data?.kUpdates || null;
-   if (updates) gameStateManager.applyUpdates(updates, { reason, payload: updates });
-   return data;
- }
+ function applyResult(data, reason) {
+   const updates = data?.updates || data?.kUpdates || null;
+   if (updates) {
+     if (updates.economy) useEconomyStore.getState().receiveServerSnapshot(updates.economy);
+     if (updates.military) useMilitaryStore.getState().receiveServerSnapshot(updates.military);
+     if (updates.research) useResearchStore.getState().receiveServerSnapshot(updates.research);
+     if (updates.population) usePopulationStore.getState().receiveServerSnapshot(updates.population);
+     if (updates.profile) useProfileStore.getState().receiveServerSnapshot(updates.profile);
+   }
+   return data;
+ }
```

### **AuthModal.jsx**
```diff
  const loadKingdom = async (kingdomId) => {
    const data = await apiCall('/api/auth/load-kingdom', { method: 'POST', body: { kingdomId } });
    
    useEconomyStore.getState().receiveServerSnapshot(data.economy);
    useMilitaryStore.getState().receiveServerSnapshot(data.military);
    useResearchStore.getState().receiveServerSnapshot(data.research);
    usePopulationStore.getState().receiveServerSnapshot(data.population);
    useProfileStore.getState().receiveServerSnapshot(data.profile);
-   
-   gameStateManager.setState({
-     gold: data.economy.gold,
-     food: data.economy.food,
-     population: data.population.population,
-     turn: data.profile.turn,
-     mana: data.research.mana,
-     tax: data.economy.tax,
-   });
-   applyGameMutation(data);
  };
```

---

## Testing Strategy

### **Unit Tests**
- Mock Zustand stores in component tests
- Verify `receiveServerSnapshot()` is called with correct data
- Verify store state updates after mutations

### **Integration Tests**
- Load game → verify all stores have data
- Click upgrade button → verify economy store updated
- Take turn → verify profile store has new turn number

### **Smoke Tests**
Manual QA checklist:
- [ ] Farm upgrades show in UI
- [ ] Building capacity affects Max button
- [ ] Hire button works with correct capacity limits
- [ ] Buildings update after purchase
- [ ] Turn increment works
- [ ] Socket events still sync game state

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Sync divergence between stores during migration** | Add logging: `console.log('[Store Sync]', { economyGold, economyStoreGold })` |
| **Missing mutation listeners** | Components may not re-render on state change | Test with explicit refetch handlers first, remove lazy listeners last |
| **Optimistic updates break** | useRegenCountdown optimistic turns may fail | Fallback to server-driven updates (simpler, safer) |
| **Panel state lost** | usePanelState moves to UIStore | Add persistence layer to UIStore if needed |
| **Tests fail** | Old mocks reference deleted modules | Create new store mocks early (Phase 1) |

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
- [ ] **Gate:** UIStore panel state persists and retrieves correctly

### **Phase 1.5: Response Normalizer**
- [ ] Create `responseNormalizer.js` with contract enforcement
- [ ] Validation logic: warns on unexpected keys
- [ ] Update all handlers to use `normalizeAndRouteResponse()`
- [ ] Logging added for debugging
- [ ] **Gate:** All API responses route to correct stores, no partial updates

### **Phase 2**
- [ ] useGameActions.applyResult() uses normalizer
- [ ] AuthModal.loadKingdom() uses normalizer
- [ ] useRegenCountdown() uses normalizer
- [ ] UpgradesList.jsx uses normalizer (both endpoints)
- [ ] All dual-system calls eliminated
- [ ] **Gate:** Buy upgrade → economyStore updates (not GameStateManager)

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
  - [ ] If ANY fails, debug before proceeding (listener is safety net)

### **Phase 3B: Listener Removal (Only After 3A Gate Passes)**
- [ ] Remove useGameMutationEvents() from all 15 components
- [ ] Remove useGameState() calls, replace with specific hooks
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

### **Phase 4**
- [ ] gameMutations.js deleted
- [ ] panelNav.js updated
- [ ] shellBridge.js updated
- [ ] replayWarReport.js updated
- [ ] All utility functions working with Zustand

### **Phase 5**
- [ ] Test mocks updated
- [ ] Integration tests added
- [ ] All tests passing

### **Phase 6**
- [ ] GameStateManager.js deleted
- [ ] useGameState.js deleted
- [ ] Zero grep results for "GameStateManager" or legacy hooks
- [ ] Lint passes
- [ ] All tests pass
- [ ] Smoke test passes

### **Post-Migration**
- [ ] Code review of all changes
- [ ] Performance audit (no regression)
- [ ] Document new patterns for future work

---

## Success Criteria (Definition of Done)

✅ **Code:**
- Zero imports of GameStateManager
- Zero imports of useGameState, useGameMutationEvents, useGameSelector
- All 23 affected files updated
- No dead code references

✅ **Tests:**
- All existing tests passing
- New integration tests for store sync
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
- Building updates flow through Zustand (not GameStateManager)
- Max button respects capacity
- Socket events properly sync stores
- No console errors

✅ **Performance:**
- No performance regression (measured with React DevTools Profiler)
- Component render counts reasonable

✅ **Documentation:**
- Update CLAUDE.md to remove GameStateManager references
- Add note about Zustand-only pattern for new code
- Document store usage patterns

---

## Estimated Timeline

| Phase | Duration | Risk | Gate/Verification |
|-------|----------|------|-------------------|
| **Pre-Phase 1A: Response Contract** | 0.5 days | Low | Document all 7+ endpoints |
| **Pre-Phase 1B: Hidden Dependencies** | 0.5 days | Medium | Run all grep audits, catch hidden imports |
| **1: Foundation** | 1-2 days | Low | UIStore panel state works |
| **1.5: Response Normalizer** | 1 day | **High** | All responses route correctly, no divergence |
| **2: Critical Sync Points** | 1-2 days | **High** | AuthModal, useGameActions, useRegenCountdown sync verified |
| **3A: Dual Data Sources** | 1 day | Medium | All 15 components read from Zustand successfully |
| **3A Gate: Smoke Test** | 1 day | **CRITICAL** | Manual testing: buy upgrade, take turn, build, attack → all update from Zustand |
| **3B: Listener Removal** | 1 day | Medium | Remove useGameMutationEvents after 3A proves it's redundant |
| **4: Utilities** | 1 day | Low | panelNav, shellBridge, replayWarReport updated |
| **5: Tests** | 1 day | Medium | Update mocks, add integration tests |
| **6: Cleanup** | 0.5 days | Low | Delete files, verify zero legacy references |
| **Total** | ~10-13 days | | **More rigorous, safer** |

**Key Principles:**
- **Don't remove listeners until they're proven redundant (Phase 3A gate)**
- **Enforce response contract from Phase 1.5 onward**
- **Audit hidden dependencies before starting (Pre-Phase 1B)**
- **Each phase has explicit gate conditions before proceeding**

---

## Questions to Resolve Before Starting

1. **Panel State:** Should UIStore persist panel state to localStorage? (for UI preferences)
2. **War Log Cache:** Where should warLogCache be stored? (militaryStore? separate? profileStore?)
3. **Optimistic Updates:** Accept server-driven only, or implement optimistic via Zustand actions?
4. **Mutation Events:** Any external systems listening to gameStateManager mutation events? (check shellBridge)

---

## Post-Migration Future State

**All state flows through Zustand:**
```
API → Zustand Store.receiveServerSnapshot()
  ↓
  → useShallow / useCallback selectors
  ↓
  → React components
  ↓
  → useEffect cleanup (unsubscribe)
```

**No more:**
- GameStateManager singleton
- Legacy listener patterns
- Dual-system sync gaps
- Hidden state dependencies

**Result:** Cleaner, faster, more maintainable state management.

