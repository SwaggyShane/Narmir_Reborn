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

### **Phase 2: Critical Sync Point Migrations** (Days 3-4)
**Goal:** Eliminate dual-system updates in core logic

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

### **Phase 3: Hook Migration** (Days 5-7)
**Goal:** Replace all legacy hook calls with Zustand equivalents

#### 3.1 Replace useGameMutationEvents() patterns

**Pattern: Trigger refresh on state changes**

**Before (DefensePanel, EconomyPanel, MarketPanel, etc.):**
```javascript
const [refreshKey, setRefreshKey] = useState(0);

useGameMutationEvents((event) => {
  if (['economy-upgrade', 'accept-trade', 'turn'].includes(event.reason)) {
    setRefreshKey(k => k + 1);
  }
});
```

**After (Option A: Store subscriptions):**
```javascript
useEffect(() => {
  // Subscribe to changes in relevant stores
  const unsubEconomy = useEconomyStore.subscribe(
    (state) => state.gold,
    () => setRefreshKey(k => k + 1),
    { equalityFn: (a, b) => a === b }
  );
  
  const unsubMilitary = useMilitaryStore.subscribe(
    (state) => state.troops,
    () => setRefreshKey(k => k + 1)
  );
  
  return () => {
    unsubEconomy();
    unsubMilitary();
  };
}, []);
```

**After (Option B: Simpler - just re-fetch UI on manual actions):**
```javascript
// Remove useGameMutationEvents entirely
// Let DefensePanel component fetch data on button clicks
// (rely on socket events to trigger full loadKingdom anyway)
```

**Recommendation:** Use Option B (simpler, less overhead)

**Files to update:**
1. `DefensePanel.jsx` — line 36, 157
2. `EconomyPanel.jsx` — line 155  
3. `ExplorationPanel.jsx` — lines 92, 174
4. `HappinessPanel.jsx` — line 65
5. `HappinessWidget.jsx` — line 28
6. `MarketPanel.jsx` — line 191
7. `NewsPanel.jsx` — line 171
8. `StudiesPanel.jsx` — line 58
9. `useActiveExpeditionsSummary.js` — line 22

**For each:** Remove useGameMutationEvents, rely on prop changes or manual refetch

#### 3.2 Replace useGameState() calls

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

#### 3.3 Migrate applyGameMutation() calls

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

### **Pre-Migration**
- [ ] Create comprehensive test fixtures for Zustand stores
- [ ] Document all mutation reasons used in codebase
- [ ] Backup current state (branch)

### **Phase 1**
- [ ] UIStore extended with panel state management
- [ ] usePanelState.js deleted
- [ ] Test fixtures created

### **Phase 2**
- [ ] useGameActions.applyResult() migrated
- [ ] AuthModal.loadKingdom() migrated  
- [ ] useRegenCountdown() migrated
- [ ] All dual-system calls eliminated

### **Phase 3**
- [ ] All useGameMutationEvents() removed from components
- [ ] All useGameState() replaced with specific hooks
- [ ] All applyGameMutation() calls replaced with store actions
- [ ] 15 components migrated
- [ ] 5 hooks migrated
- [ ] **UpgradesList.jsx fully migrated** — ALL 7 upgrade types:
  - [ ] Farm upgrades → economyStore.farm_upgrades
  - [ ] Bank upgrades → economyStore.bank_upgrades
  - [ ] Granary upgrades → economyStore.granary_upgrades
  - [ ] Market upgrades → economyStore.market_upgrades
  - [ ] Tavern upgrades → economyStore.tavern_upgrades
  - [ ] School upgrades → researchStore.school_upgrades
  - [ ] Mausoleum upgrades → economyStore.mausoleum_upgrades

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

| Phase | Duration | Risk |
|-------|----------|------|
| **1: Foundation** | 1-2 days | Low |
| **2: Critical Sync** | 1-2 days | **High** - test thoroughly |
| **3: Hook Migration** | 2-3 days | Medium |
| **4: Utilities** | 1 day | Low |
| **5: Tests** | 1 day | Medium |
| **6: Cleanup** | 0.5 days | Low |
| **Total** | ~8-10 days | |

**Key Insight:** Don't parallelize phases. Complete Phase 2 thoroughly before Phase 3 to ensure stores are synced correctly.

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

