# F5: GameStateManager → Zustand Migration Plan

**Status:** Design Phase  
**Priority:** High (post-F4)  
**Effort Estimate:** 15–20 hours across 2–3 PRs  
**Target:** Incremental per-panel refactor (no big bang rewrite)

---

## Executive Summary

Replace the custom `GameStateManager` singleton with Zustand stores. Zustand provides:
- **Better performance** for high-frequency updates (selectors prevent unnecessary re-renders)
- **Simpler API** than current observer pattern
- **DevTools integration** for easier debugging
- **Cleaner separation** between kingdom state and UI state
- **Socket.io friendly** — updates dispatch directly to stores

**Why now:** F4 decomposed backend logic; F5 decomposes frontend state management. Natural progression toward modular architecture.

---

## Current State Analysis

### GameStateManager (client/src/GameStateManager.js)

**What it manages:**

| Category | Data | Usage |
|----------|------|-------|
| **Metrics** | gold, mana, population, happiness, food, land, turn, mana_regen, gold_income, food_balance, tax | High-frequency (every socket.io update, every turn) |
| **Panel state** | Per-panel local state (panelState Map) | Low-frequency (panel switches, user interactions) |
| **Listeners** | Custom pub/sub for state changes | All panels subscribe to notify on change |
| **Mutation tracking** | Logs all state mutations for debugging | DevTools-like tracking |

**Problems:**

1. **All-or-nothing updates** — Any metric change notifies *all* listeners, even if they only care about one metric
2. **No selectors** — No built-in way to say "only re-render if *this* metric changed"
3. **Manual subscription** — Every panel manually calls `subscribe()` and remembers to unsubscribe
4. **Singleton pattern** — Tightly couples all panels to one global object
5. **Panel state mixing** — Stores per-panel state in same manager as kingdom state (conceptually messy)

**High-frequency bottleneck:**
- Turn tick (every 25 min) causes cascading resource updates → notifies all listeners
- Combat resolution updates troop counts, happiness, resources simultaneously → cascading re-renders
- Socket.io broadcasts (alliance events, market prices, population growth) → constant updates
- UI interactions (build queue, research) create local mutations → more listener churn

### Usage patterns in codebase

| Component | Updates | Frequency |
|-----------|---------|-----------|
| KingdomBodyHeader | gold, mana, population, happiness, food, land, tax | Every turn + socket.io |
| BuildPanel | gold, food, land, research_progress | Very high (per-item changes) |
| WarfarePanel | population, troops, happiness | High (combat, troop training) |
| EconomyPanel | gold_income, food_balance, trade_routes | Medium (per turn) |
| ResearchPanel | mana, mana_regen, research_progress | Medium (per turn) |

---

## Proposed Zustand Architecture

### Store Structure

```
client/src/stores/
├── index.js                 (export all stores)
├── kingdomStore.js          (metrics: gold, mana, population, etc.)
├── uiStore.js               (panel state, visibility, active tabs, etc.)
├── combatStore.js           (optional: active combat, V2 diagnostics — see section 3.3)
└── middleware/
    ├── devtools.js          (Redux DevTools integration)
    ├── persistence.js       (localStorage for UI state)
    └── mutations.js         (mutation logging/tracking)
```

### Store 1: Kingdom Metrics Store

**Purpose:** Manage all kingdom-level numeric/resource data.

**Location:** `client/src/stores/kingdomStore.js`

**State:**
```js
{
  // Resources
  gold: 0,
  mana: 0,
  population: 0,
  food: 0,
  land: 0,
  
  // Calculations
  mana_regen: 0,
  gold_income: 0,
  food_balance: 0,
  
  // Progression
  turn: 0,
  happiness: 50,
  tax: 42,
  
  // Computed/Cached (optional, can also be selectors)
  // food_surplus, population_happy_threshold, etc.
}
```

**Actions:**
```js
updateMetrics(updates)      // Batch update multiple fields
applyUpdates(updates)       // Alias for updateMetrics (backward compat)
setGold(amount)             // Direct field setters (for fine-grained updates)
setMana(amount)
setPopulation(amount)
// ... etc for each metric
updateFromServer(data)      // Called when socket.io sends kingdom state
```

**Selectors (crucial for performance):**
```js
// Only re-render if gold changed
useKingdomStore(state => state.gold)

// Multiple fields, but only re-render if ANY changed
useKingdomStore(state => ({
  gold: state.gold,
  mana: state.mana,
  population: state.population
}))

// Computed selectors (memoized)
useKingdomStore(state => state.gold + state.gold_income)
```

**Usage in components:**
```jsx
function GoldDisplay() {
  const gold = useKingdomStore(state => state.gold);
  // ✅ Only re-renders if gold changed, not if mana/population changed
  return <div>{gold}</div>;
}
```

---

### Store 2: UI State Store

**Purpose:** Manage panel visibility, active tabs, sort orders, persistent UI settings — anything that should survive across renders/page reloads.

**Location:** `client/src/stores/uiStore.js`

**⚠️ Important distinction:**
- **In uiStore:** Panel active state, sort order, filter preferences, visible columns (persist across page reloads)
- **As local useState:** Form inputs being typed, hover states, transient animations, temporary selections (don't persist)

**State:**
```js
{
  // Panel visibility/state
  activePanel: 'build',        // Currently visible panel
  panelState: {
    build: {
      sortBy: 'time',
      filter: 'all',
      selectedItem: null,
      visibleColumns: ['name', 'level', 'progress'],
    },
    warfare: {
      selectedDefense: null,
      showReports: false,
    },
    // ... per-panel state
  },
  
  // Modals (persistent state)
  openModals: Set(['confirm-attack']),
  
  // Search/filter state (persistent)
  searchText: '',
  
  // ❌ NOT here: hoveredTroop, form input values — use useState in components
}
```

**Component-level useState (not in uiStore):**
```jsx
function BuildPanel() {
  // Transient state stays local
  const [hoveredItem, setHoveredItem] = useState(null);  // ← stays in component
  const [formInput, setFormInput] = useState('');        // ← stays in component
  
  // Persistent state goes to uiStore
  const sortBy = useUIStore(state => state.panelState.build?.sortBy);
  
  return (
    <div onMouseEnter={() => setHoveredItem(id)} onMouseLeave={() => setHoveredItem(null)}>
      {/* ... */}
    </div>
  );
}
```

**Actions:**
```js
setActivePanel(panelName)           // Switch active panel
setPanelState(panelName, state)     // Update panel's local state
toggleModal(modalName)              // Open/close a modal
setHoveredTroop(troopId)            // Temporary hover state
clearPanelState(panelName)          // Reset panel to defaults
```

**Selectors:**
```js
// Only re-render if this panel's state changed
useUIStore(state => state.panelState.build)

// Only re-render if active panel changed
useUIStore(state => state.activePanel)
```

**Usage in components:**
```jsx
function BuildPanel() {
  const sortBy = useUIStore(state => state.panelState.build?.sortBy);
  // ✅ Only re-renders if build panel's sortBy changed
  return <div>Sorted by: {sortBy}</div>;
}
```

---

### Store 3: Combat Store (Optional, Recommend Defer to F5-Phase2)

**Purpose:** Manage active combat state and Combat V2 diagnostics.

**Note:** Combat state is tied to gameplay and could live in `kingdomStore`. Recommend starting F5 with kingdomStore + uiStore, then extract combat if complexity warrants (Phase 2).

**If extracted, structure:**
```js
{
  activeCombat: {
    id: 'combat-123',
    attacker: { name: 'Kingdom1', troops: {...} },
    defender: { name: 'Kingdom2', troops: {...} },
    state: 'resolving', // resolving | complete
  },
  
  lastCombatResult: {
    win: true,
    atkLost: 50,
    defLost: 120,
    landTransferred: 500,
    diagnostics: { /* V2 data */ },
  },
  
  combatHistory: [],
}
```

**Decision:** Keep in kingdomStore for F5-Phase1. Extract to combatStore in F5-Phase2 if UI components grow complex.

---

## Middleware & Integration

### DevTools Middleware

**Purpose:** Integrate with Redux DevTools for debugging state changes.

**Location:** `client/src/stores/middleware/devtools.js`

**Setup:**
```js
import { devtools } from 'zustand/middleware';

const useKingdomStore = create(
  devtools(
    (set) => ({
      // ... store definition
    }),
    { name: 'kingdom' }  // Name in DevTools
  )
);
```

**Benefit:** See every state update, rewind/replay, inspect diffs, etc.

---

### Immer Middleware (Safe Nested Updates)

**Purpose:** Enable immutable-style updates for complex nested state (e.g., `panelState.build.selectedItem`).

**Location:** Built into Zustand

**Setup:**
```js
import { immer } from 'zustand/middleware/immer';

const useUIStore = create(
  immer((set) => ({
    panelState: { build: { sortBy: 'time' } },
    setPanelState: (panelName, updates) => set((state) => {
      state.panelState[panelName] = { ...state.panelState[panelName], ...updates };
    }),
  }))
);
```

**Benefit:** Avoids spread operator pain; mutations inside `set()` are automatically frozen and converted to immutable updates.

---

### Persistence Middleware (UI State Only)

**Purpose:** Restore UI state (active panel, sort preferences) across page reloads.

**Location:** `client/src/stores/middleware/persistence.js`

**Setup:**
```js
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

const useUIStore = create(
  persist(
    immer((set) => ({
      // ... store definition
    })),
    {
      name: 'ui-state',
      storage: localStorage,
      partialize: (state) => ({
        activePanel: state.activePanel,
        panelState: state.panelState,
      }),
    }
  )
);
```

**Note:** Do NOT persist kingdom metrics (gold, mana, etc.) — always fetch fresh from server.

**Middleware order:** Immer first, then persist (immer wraps the create function).

---

### Socket.io Integration

**Current pattern (GameStateManager):**
```js
socket.on('kingdom-update', (data) => {
  gameStateManager.updateMetrics(data);
});
```

**New pattern (Zustand):**
```js
socket.on('kingdom-update', (data) => {
  useKingdomStore.getState().updateFromServer(data);
});
```

**Benefit:** Direct state dispatch, no intermediate manager object, cleaner event handling.

**⚠️ Batching optimization (Important):**

If socket.io sends frequent updates (e.g., per-troop updates in combat), batching prevents cascading renders:

```js
// ❌ Bad: Each socket event → immediate store update → re-render
socket.on('combat-update', (data) => {
  useKingdomStore.getState().setTroop(data.troopId, data.hp);  // 50 events = 50 re-renders
});

// ✅ Good: Batch updates over a time window
const batchQueue = [];
const BATCH_INTERVAL = 50;  // ms

socket.on('combat-update', (data) => {
  batchQueue.push(data);
});

setInterval(() => {
  if (batchQueue.length > 0) {
    const batchedUpdates = batchQueue.splice(0);
    useKingdomStore.getState().updateMetrics({
      troops: batchedUpdates,  // Apply all at once
    });
  }
}, BATCH_INTERVAL);
```

---

### Initial Hydration (First Page Load)

**Problem:** Stores are empty until server data arrives.

**Solution 1: Eager hydration from initial payload**
```js
// On app start, before rendering React
const initialData = window.__INITIAL_STATE__;  // From server
useKingdomStore.setState(initialData.kingdom);
useUIStore.setState(initialData.ui);

// Then render React
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
```

**Solution 2: Loading state while hydrating**
```jsx
function App() {
  const kingdom = useKingdomStore(state => state.gold);
  const isReady = kingdom > 0;  // Simple check: if gold is 0, we haven't hydrated yet
  
  if (!isReady) return <LoadingScreen />;
  return <GameUI />;
}
```

**Recommendation:** Use Solution 1 (eager hydration from server) to avoid loading screens.

---

## Migration Strategy

### Phase 1: Core Stores (kingdomStore + uiStore)

**Goal:** Get kingdomStore and uiStore wired up and working; migrate 2–3 panels as proof-of-concept.

**Work:**

1. Create `client/src/stores/` directory structure
2. Implement `kingdomStore.js` with all metrics + selectors
3. Implement `uiStore.js` with panel state + selectors
4. Add DevTools and persistence middleware
5. Update socket.io event handlers to use stores
6. Migrate highest-traffic panels first:
   - **KingdomBodyHeader** (displays metrics, high re-render frequency)
   - **BuildPanel** (reads gold, food, land frequently)
   - **WarfarePanel** (reads troops, happiness)

**Testing:**
- Verify metrics update correctly on socket.io events
- Verify only subscribed components re-render (use React DevTools profiler)
- Test persistence (refresh page, check active panel remains)
- Test DevTools replay

**Effort:** ~8 hours

**PR:** `feat(F5-Phase1): Core Zustand stores + initial panel migration`

---

### Phase 2: Remaining Panels

**Goal:** Migrate all remaining panels (economy, research, alliances, etc.) to Zustand.

**Work:**

1. Migrate 3–4 panels per sub-phase (to keep PRs reviewable)
2. Extract combatStore if combat-related state grows complex
3. Audit for any lingering GameStateManager references
4. Remove GameStateManager singleton entirely

**Panels to migrate (suggested order):**
1. KingdomBodyHeader (Phase 1)
2. BuildPanel (Phase 1)
3. WarfarePanel (Phase 1)
4. EconomyPanel (Phase 2)
5. ResearchPanel (Phase 2)
6. AlliancesPanel (Phase 2)
7. SettingsPanel, TavernPanel, other utility panels (Phase 2)

**Testing:**
- Per-panel integration tests (verify store actions trigger correct re-renders)
- Full smoke test (server boot, all panels functional)
- Performance profile (compare before/after render counts)

**Effort:** ~8–10 hours

**PRs:** 2–3 PRs, one per 3–4 panels

---

### Phase 3: Cleanup & Documentation

**Goal:** Remove old GameStateManager, add store documentation, train team.

**Work:**

1. Delete `client/src/GameStateManager.js`
2. Delete any GameStateManager imports/references
3. Write store documentation in `client/src/stores/README.md`:
   - Store overview (what each store does)
   - Common selectors (examples for fast reference)
   - How to add new state
   - How to subscribe/use in components
4. Add TypeScript types (optional, if codebase uses TS)
5. Add unit tests for store actions
6. Add integration test for socket.io → store updates

**Effort:** ~2–3 hours

**PR:** `docs(F5-Phase3): Store documentation + cleanup`

---

## Testing Strategy

### Unit Tests (Store Logic)

**Test file:** `client/src/stores/__tests__/kingdomStore.test.js`

```js
describe('kingdomStore', () => {
  it('updates gold correctly', () => {
    const store = useKingdomStore.getState();
    store.setGold(1000);
    expect(useKingdomStore.getState().gold).toBe(1000);
  });

  it('batch updates multiple metrics', () => {
    const store = useKingdomStore.getState();
    store.updateMetrics({ gold: 500, mana: 100 });
    const state = useKingdomStore.getState();
    expect(state.gold).toBe(500);
    expect(state.mana).toBe(100);
  });
});
```

### Integration Tests (Socket.io → Store)

**Test file:** `client/src/stores/__tests__/socket-integration.test.js`

```js
describe('socket.io integration', () => {
  it('updates kingdom store on kingdom-update event', (done) => {
    socket.emit('kingdom-update', { gold: 2000, mana: 50 });
    
    setTimeout(() => {
      const state = useKingdomStore.getState();
      expect(state.gold).toBe(2000);
      expect(state.mana).toBe(50);
      done();
    }, 100);
  });
});
```

### Component Tests (React + Zustand)

**Test file:** `client/src/components/__tests__/GoldDisplay.test.jsx`

```js
describe('GoldDisplay', () => {
  it('re-renders only when gold changes', () => {
    const { rerender } = render(<GoldDisplay />);
    expect(screen.getByText('0')).toBeInTheDocument();
    
    // Update kingdom store (only mana, not gold)
    useKingdomStore.setState({ mana: 50 });
    expect(screen.getByText('0')).toBeInTheDocument(); // No re-render
    
    // Update gold
    useKingdomStore.setState({ gold: 1000 });
    expect(screen.getByText('1000')).toBeInTheDocument(); // Re-renders
  });
});
```

### Performance Testing

**Profiling before/after:**
- Use React DevTools Profiler to compare render counts
- Measure component update times with/without Zustand
- Verify selector optimization works (components shouldn't re-render on unrelated state changes)
- **Render count test example:**
  ```js
  describe('selector optimization', () => {
    it('GoldDisplay does not re-render when mana changes', () => {
      let renderCount = 0;
      function GoldDisplay() {
        renderCount++;
        const gold = useKingdomStore(state => state.gold);
        return <div>{gold}</div>;
      }
      
      render(<GoldDisplay />);
      expect(renderCount).toBe(1);
      
      useKingdomStore.setState({ mana: 50 });  // Change unrelated state
      expect(renderCount).toBe(1);  // No additional render
      
      useKingdomStore.setState({ gold: 1000 });  // Change related state
      expect(renderCount).toBe(2);  // Now it re-renders
    });
  });
  ```

---

## TypeScript Integration (Optional, Recommended)

If codebase is using TypeScript (or considering it), this is an ideal time to add types to stores.

**Store type definitions:**
```ts
// stores/kingdomStore.ts
import { create } from 'zustand';

interface KingdomState {
  gold: number;
  mana: number;
  population: number;
  happiness: number;
  // ... other fields
  
  updateMetrics: (updates: Partial<KingdomState>) => void;
  updateFromServer: (data: Partial<KingdomState>) => void;
}

export const useKingdomStore = create<KingdomState>((set) => ({
  gold: 0,
  mana: 0,
  population: 0,
  happiness: 50,
  
  updateMetrics: (updates) => set(updates),
  updateFromServer: (data) => set(data),
}));
```

**Benefits:**
- IDE autocomplete for store selectors
- Type safety prevents typos in property names
- Future refactors caught at compile time
- Better documentation (types are self-documenting)

**Migration strategy:** Can add types incrementally (Phase 1 for core stores, expand as needed).

---

## Selector Optimization Strategy

### Problem

Without selectors, any store update notifies all subscribers:
```js
// ❌ Bad: All listeners called, even if they only care about gold
useKingdomStore.subscribe(() => {
  // ...
});
```

### Solution: Granular Selectors

```js
// ✅ Good: Only re-render if gold changed
const gold = useKingdomStore(state => state.gold);

// ✅ Good: Only re-render if any resource changed (but use useShallow!)
const resources = useShallow(state => ({
  gold: state.gold,
  mana: state.mana,
  food: state.food,
}));

// ✅ Good: Memoized computed selector (prevent re-renders due to object identity)
import { useShallow } from 'zustand/react';
const richness = useShallow(state => ({
  isRich: state.gold > 10000,
  isManaFull: state.mana > 500,
}));
```

**Why useShallow matters:**
- Selectors that return objects create a new reference every time
- React sees new reference → re-render, even if values are identical
- `useShallow` uses shallow equality check: re-renders only if object contents changed

### Best Practices

1. **One selector per field** when possible (prevents re-renders from unrelated fields)
2. **Batch related fields** into one selector if they're always read together, **use `useShallow`**
3. **Memoize computed selectors** using `useShallow` for object returns
4. **Avoid object spreads** inside selectors (creates new object reference every time)
5. **Derived/computed values** (e.g., effective gold income) can be calculated in selectors or stored as derived state:
   ```js
   // Option A: Computed selector (calculated on every render)
   const effectiveIncome = useKingdomStore(state => state.gold_income * state.happiness_mult);
   
   // Option B: Derived state in store (cached, updates only when dependencies change)
   const useKingdomStore = create((set) => ({
     gold_income: 100,
     happiness_mult: 1.2,
     effective_income: 120,  // Updated whenever gold_income or happiness_mult changes
   }));
   ```

---

## Backward Compatibility & Rollback

### Safe Migration Approach

1. **Keep GameStateManager during Phase 1** while rolling out kingdomStore
   - GameStateManager syncs from kingdomStore (one-way sync; kingdomStore is source of truth)
   - If migration breaks, quick rollback possible (revert to old panel code)
   
2. **Clear cutover per panel** (not big-bang)
   - Migrate one panel, test, confirm it works
   - Remove that panel's GameStateManager references
   - Move to next panel
   - This prevents "both managers fighting over state" bugs
   
3. **Gradual panel migration** (Phase 1 → Phase 2)
   - Migrate highest-traffic panels first (quick win, biggest impact)
   - If issues found, only one panel needs fixing, others still work

4. **Feature flag for new stores** (optional, recommended)
   - Use environment variable `USE_ZUSTAND_STORES=true`
   - Can toggle back to GameStateManager if needed during testing

### Per-Panel Cutover Checklist

```
[ ] Panel using Zustand selectors (all GameStateManager.subscribe removed)
[ ] Socket.io events dispatch to Zustand stores
[ ] Component re-renders verified in React DevTools
[ ] localStorage/persistence working (if applicable)
[ ] All GameStateManager.getState() calls removed from panel
[ ] Smoke test passes
[ ] Manual testing complete (all panel interactions work)
[ ] Remove panel from GameStateManager fallback
[ ] Move to next panel
```

### Rollback Plan

If critical issues found:
```bash
# Revert last 2–3 commits (panel migrations)
git revert HEAD~2..HEAD

# Restore GameStateManager, remove Zustand
git checkout HEAD~5 -- client/src/GameStateManager.js

# Push hotfix
git push
```

---

## Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Components re-render more after migration | Medium | Performance regression | Use React DevTools Profiler to verify selectors work; add selector tests |
| Panel state lost on migration | Low | UX regression (users lose sort order, etc.) | Implement persistence middleware; test localStorage |
| Socket.io updates not reaching stores | Low | Stale data displayed | Add debug logging; test socket.io events with mock data |
| Socket.io batching — multiple updates cause cascade | Medium | Re-render churn | Batch socket updates before dispatching to store (e.g., collect 50ms worth, then `updateMetrics()` once) |
| Selectors too granular, fragmented state | Medium | Hard to reason about state | Document selector patterns; code review selectors carefully |
| Team unfamiliar with Zustand | Medium | Slow onboarding, bugs | Write store README; do quick knowledge-share meeting |
| Initial page load — stores not hydrated | Low | Empty/null state on first render | Ensure server payload hydrates stores before UI mounts (or use loading state) |
| Both managers active during transition | Medium | Conflicting updates, bugs | Clear cutover per panel (migrate panel → remove old GameStateManager reference for that panel) |

---

## Effort & Timeline

| Phase | Work | Hours | Duration | PR |
|-------|------|-------|----------|-----|
| **1** | Core stores + KingdomBodyHeader/BuildPanel/WarfarePanel migration | 8 | ~3 days | #6XX |
| **2** | Remaining panels (economy, research, alliances, utilities) | 8–10 | ~3 days | #6XX, #6XX |
| **3** | Cleanup, docs, tests, GameStateManager removal | 2–3 | ~1 day | #6XX |
| **Total** | — | 18–21 | ~7 days (if continuous) | — |

**Realistic timeline (accounting for code review, fixes):** 10–14 days spread across 2 weeks.

---

## Success Criteria

- ✅ All panels use Zustand stores (no GameStateManager references)
- ✅ Redux DevTools shows all state updates correctly
- ✅ React DevTools Profiler: components only re-render on relevant state changes
- ✅ Socket.io updates flow to stores and UI updates correctly
- ✅ UI state persists across page reloads (panel visibility, sort order)
- ✅ No performance regression (same or faster render times)
- ✅ Unit + integration tests pass
- ✅ Smoke test passes (all 4 baseline checks + manual panel navigation)
- ✅ GameStateManager.js removed entirely

---

## Questions for Discussion

Before we commit to this plan:

1. **Combat state isolation** — Should combatStore be extracted in Phase 1 or Phase 2?
2. **Persistence scope** — Should only UI state persist, or also kingdom metrics?
3. **TypeScript** — Should we add types to stores, or keep them dynamic?
4. **Middleware priority** — Which is more important: DevTools or persistence?
5. **Panel order** — Does the suggested migration order make sense, or should we prioritize differently?
6. **Feature flag** — Do you want a fallback to GameStateManager during transition?

---

## References

- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Zustand DevTools Middleware](https://github.com/pmndrs/zustand/blob/main/docs/integrations/persisting-store-data.md)
- [React DevTools Profiler](https://react.dev/learn/react-developer-tools)
- Zustand best practices: Selectors, shallow equality, persistence

---

**Next step:** Review this plan, gather feedback, finalize store structure, and schedule Phase 1 kickoff.
