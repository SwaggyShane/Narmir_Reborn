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

### Store Structure (Domain-Based)

**Avoid monolithic stores.** Split by domain to keep each store focused and maintainable.

```
client/src/stores/
├── index.js                 (export all stores)
├── economyStore.js          (gold, food, trade, market prices)
├── militaryStore.js         (troops, combat, war machines, battles)
├── researchStore.js         (research progress, disciplines, schools)
├── populationStore.js       (population, happiness, growth)
├── uiStore.js               (panel state, visibility, active tabs, modals)
├── notificationsStore.js    (alerts, news events)
├── chatStore.js             (messages, alliance chat)
└── middleware/
    ├── devtools.js          (Redux DevTools integration)
    ├── persistence.js       (localStorage for UI state only)
    └── serverSync.js        (server snapshot → store updates)
```

**Benefits:**
- Each store stays under 200 lines
- Components depend only on needed stores
- Easier to test (mock one store at a time)
- Clear domain boundaries
- No mega-manager emerging over time

### Store 1: Economy Store

**Purpose:** Manage economy-related state (gold, food, trade, market).

**Location:** `client/src/stores/economyStore.js`

**State:**
```js
{
  // Authoritative (from server)
  gold: 0,
  food: 0,
  mana: 0,
  mana_regen: 0,
  tax: 42,
  
  // Derived selectors (not stored, calculated on demand)
  // gold_income, food_balance, food_surplus → use selectors
  
  // Market state
  commodityPrices: { wheat: 100, lumber: 150, ore: 200 },
  
  // Trade routes (normalized: {byId, allIds})
  tradeRoutes: {
    byId: {
      'route-1': { id: 'route-1', destination: 'Kingdom2', type: 'gold', active: true },
    },
    allIds: ['route-1'],
  },
}
```

**Actions (domain-based, not field setters):**
```js
// Authoritative updates from server
receiveServerSnapshot(data)     // Overwrite authoritative state from server snapshot
receiveTurnUpdate(turnData)     // Turn tick: resources generated, research progressed, etc.
completeBuild(buildingType)     // Construction complete → deduct resources
finishResearch(discipline)      // Research complete → consume mana
applyCombatResult(result)       // Combat over → update gold/food/troops/happiness
receiveTrade(tradeData)         // Trade completed → adjust gold/food

// Client actions (optimistic updates)
proposeTrade(tradeRoute)        // Optimistic UI update (server will confirm/deny)
setTax(newTax)                  // UI change (server validates)

// Clear, intent-driven naming: what happened in the game world
```

**Selectors (derived values):**
```js
// Don't store these; calculate on demand
const goldIncome = useEconomyStore(state => 
  state.gold_income * (state.happiness / 100)
);

const foodSurplus = useEconomyStore(state =>
  state.food - state.population * 0.5
);

const tradingPartners = useEconomyStore(state =>
  state.tradeRoutes.allIds.map(id => state.tradeRoutes.byId[id])
);
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

### Store 2: Military Store

**Purpose:** Manage military state (troops, armies, combat, war machines).

**Location:** `client/src/stores/militaryStore.js`

**State:**
```js
{
  // Authoritative (from server)
  troops: {
    fighters: 100,
    rangers: 50,
    mages: 25,
    // ... unit counts
  },
  
  // Entity collections (normalized)
  armies: {
    byId: {
      'army-1': { id: 'army-1', destination: 'Kingdom2', troops: {...}, eta: 50 },
    },
    allIds: ['army-1'],
  },
  
  // Authoritative from server
  wall_hp: 1000,
  wall_defense_type: 'fortified',
  
  // Client-owned (not from server)
  selectedArmy: 'army-1',  // UI selection
  pendingAttack: null,      // Optimistic state before confirm
}
```

**Actions:**
```js
// Authoritative updates
receiveServerSnapshot(data)     // Overwrite from server
receiveTurnUpdate(turnData)     // Troops recruited, injured troops recovered
applyCombatResult(combat)       // Casualties, injuries, equipment changes
injureTroops(counts)            // Update injured_troops from combat V2
damageWalls(damage)             // Wall HP changes

// Client actions
selectArmy(armyId)              // UI selection (local only)
setPendingAttack(attackData)    // Optimistic: user is about to confirm
cancelPendingAttack()           // User cancels pending action
```

---

### Store 3: Research Store

**Purpose:** Manage research progress and disciplines.

**Location:** `client/src/stores/researchStore.js`

**State:**
```js
{
  // Authoritative (from server)
  mana: 500,
  disciplineProgress: {
    warfare: { level: 5, xp: 300, xp_needed: 1000 },
    economics: { level: 3, xp: 100, xp_needed: 500 },
    // ...
  },
  
  // Entity: active research (normalized)
  activeResearch: {
    byId: {
      'discipline-warfare': { discipline: 'warfare', progress: 300 },
    },
    allIds: ['discipline-warfare'],
  },
  
  // Client-owned
  selectedDiscipline: 'warfare',  // UI selection
  researchAllocation: {},         // User's allocation before submitting
}
```

**Actions:**
```js
// Authoritative
receiveServerSnapshot(data)
completeResearch(discipline)    // Research finished → update xp, level
spendMana(amount, reason)        // Mana spent on research
receiveResearchXp(data)          // XP allocated

// Client
selectDiscipline(discipline)     // UI selection
allocateResearch(allocation)     // User input (not persisted until server accepts)
submitResearchAllocation()       // Send to server
```

---

### Store 4: UI State Store

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

## Critical Architectural Patterns

### Inter-Store Communication

**Problem:** Stores need to talk to each other without circular imports or spaghetti logic.

**Scenario:** Resource drops to zero in economyStore → need to show warning modal in uiStore.

**Solution:** Direct access via `getState()` (Zustand stores are plain JS objects):

```js
// economyStore.js
import { useUIStore } from './uiStore';  // Safe: no circular dependency

export const useEconomyStore = create((set) => ({
  gold: 100,
  
  spendGold: (amount) => set((state) => {
    const newGold = state.gold - amount;
    
    // Direct access to other store
    if (newGold < 0) {
      useUIStore.getState().openModal('insufficient_funds');
    }
    
    return { gold: Math.max(0, newGold) };
  }),
}));
```

**Guidelines:**
- Use `getState()` in actions when you need immediate access to another store
- Only read other stores in actions; don't subscribe to them from components
- For UI reactions, dispatch actions that trigger the modal (cleaner than direct calls)
- Keep cross-store calls to a minimum (prefer: each store owns its domain)

**Pattern for UI reactions:**
```js
// Cleaner: action in one store triggers action in another
spendGold: (amount) => set((state) => {
  const newGold = state.gold - amount;
  
  if (newGold < 0) {
    // Return new state first
    set({ gold: Math.max(0, newGold) });
    // Then trigger side effect via other store
    useUIStore.getState().openModal('insufficient_funds');
  }
  
  return { gold: newGold };
}),
```

---

### Server vs Client State

This distinction prevents multiplayer bugs and keeps architecture clean.

**Authoritative (server-owned) state:**
```js
// These are never modified by UI actions directly
// Instead: server sends update → store receives snapshot
gold
mana
population
troops
research_progress
wall_hp
troop_levels
injuries
```

**Client-owned state:**
```js
// UI controls these directly; server doesn't care about them
activePanel
selectedArmy
hoveredUnit
pendingAttack (optimistic UI before confirmation)
formInputs
searchText
openModals
```

**The pattern:**
```
Server                Client
   ↓                    ↑
Socket event ── receiveServerSnapshot() → overwrite authoritative state
   ↑                    ↓
   └─ user action confirmed
```

**Key rule:** Authoritative state is write-once-per-snapshot. Don't incrementally modify it. This makes multiplayer, undo/redo, and debug much easier.

---

### Entity Collections (Normalization)

As game grows, you'll have arrays of objects: armies, cities, trade routes, research queues, etc.

**❌ Avoid:**
```js
armies: [
  { id: 1, destination: 'Kingdom2', troops: {...} },
  { id: 2, destination: 'Kingdom3', troops: {...} },
]
// Problem: Updating one army recreates entire array
```

**✅ Use normalized pattern:**
```js
armies: {
  byId: {
    'army-1': { id: 'army-1', destination: 'Kingdom2', troops: {...} },
    'army-2': { id: 'army-2', destination: 'Kingdom3', troops: {...} },
  },
  allIds: ['army-1', 'army-2'],
}

// Updating one army is O(1), not O(n)
// Selectors: 
const allArmies = useSelector(state => 
  state.armies.allIds.map(id => state.armies.byId[id])
);

const army1 = useSelector(state => state.armies.byId['army-1']);
```

**Apply to:**
- Armies, trade routes, research queues, build queues
- Any collection where you frequently update individual items

---

### High-Frequency Updates (Transient Subscriptions)

**Problem:** If game metrics update multiple times per second (combat health bars, animated resource tickers), React's render cycle may lag behind state changes.

**Solution:** Use Zustand's direct subscription pattern for elements that need instant visual feedback without re-rendering the component.

**Example: Animated gold counter**
```jsx
function GoldCounter() {
  const goldRef = useRef<HTMLSpanElement>(null);
  const [displayGold, setDisplayGold] = useState(0);
  
  useEffect(() => {
    // Subscribe directly to store updates without triggering component re-render
    const unsubscribe = useEconomyStore.subscribe(
      state => state.gold,
      gold => {
        // Update DOM directly or local state for animation
        if (goldRef.current) {
          goldRef.current.innerText = gold.toString();
        }
      }
    );
    
    return unsubscribe;
  }, []);
  
  return <span ref={goldRef}>{displayGold}</span>;
}
```

**When to use transient subscriptions:**
- Animated counters (resources ticking up/down)
- Combat health bars during active battle
- Real-time status updates (timer countdowns)
- High-frequency socket events (multiple updates per second)

**When NOT to use:**
- Regular panel rendering (use selectors instead)
- State that needs React lifecycle (use hooks)
- Complex UI logic (use components with selectors)

**Performance benefit:**
- Regular selector: triggers component re-render every update
- Transient subscription: updates DOM directly, no React render
- Example: 60 gold updates/sec with transient = 1 render; without = 60 renders

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
      // In Zustand v4, persist middleware defaults to localStorage
      // No need to pass storage option explicitly
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

// ✅ Good: Batch updates over a time window (dynamic timeout, not continuous interval)
const batchQueue = [];
const BATCH_INTERVAL = 50;  // ms
let batchTimeout = null;

socket.on('combat-update', (data) => {
  batchQueue.push(data);
  
  // Schedule batch processing only when first item arrives
  if (!batchTimeout) {
    batchTimeout = setTimeout(() => {
      const batchedUpdates = batchQueue.splice(0);
      useKingdomStore.getState().updateMetrics({
        troops: batchedUpdates,  // Apply all at once
      });
      batchTimeout = null;
    }, BATCH_INTERVAL);
  }
});
```

---

### Initial Hydration (First Page Load)

**Problem:** Stores are empty until server data arrives.

**Solution 1: Eager hydration from initial payload**
```js
// On app start, before rendering React
const initialData = window.__INITIAL_STATE__;  // From server
if (initialData) {
  if (initialData.kingdom) useKingdomStore.setState(initialData.kingdom);
  if (initialData.ui) useUIStore.setState(initialData.ui);
}

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

### Phase 1: Domain Stores + Core Panels (2–3 PRs, Each <300 lines diff)

**Goal:** Set up domain-based stores (split early!) with domain actions; migrate highest-traffic panels with many small PRs.

**Why split domain stores in Phase 1:**
- Prevents monolithic bloat from day one
- Each store stays focused and testable
- Team can work on domains independently
- Clear separation of concerns from the start

**PR Strategy:** Multiple small PRs instead of one big PR
- PR 1: Core store infrastructure (economyStore + uiStore)
- PR 2: Migrate KingdomBodyHeader (uses economyStore)
- PR 3: Migrate BuildPanel (uses economyStore + researchStore)
- PR 4: Create militaryStore + migrate WarfarePanel
- Each PR: <300 lines, single concern, easy to review and rollback

**Phase 1 Work:**

1. **PR 1: Store Infrastructure** (core setup, no panels yet)
   - Create `client/src/stores/` directory structure
   - Implement domain stores with **domain actions** (not field setters):
     - `economyStore.ts` — `receiveTurnUpdate()`, `completeBuild()`, `receiveTrade()`
     - `militaryStore.ts` — `applyCombatResult()`, `injureTroops()`, `damageWalls()`
     - `researchStore.ts` — `completeResearch()`, `spendMana()`
     - `uiStore.ts` — `selectPanel()`, `setPendingAction()`, etc.
   - Add DevTools and persistence middleware (v4 compatible)
   - Add normalized entity collections (byId/allIds pattern)
   - Implement server vs client state separation (`receiveServerSnapshot()` is authoritative)
   - Update socket.io event handlers to dispatch domain actions
   - **Test:** Stores work standalone, DevTools works, no errors

2. **PR 2–4: Migrate Panels Incrementally** (one or two panels per PR)
   - Migrate highest-traffic panels first (fastest wins):
     - **KingdomBodyHeader** — displays resources (high re-render frequency)
     - **BuildPanel** — reads economy store, domain-based actions
     - **WarfarePanel** — reads military store, domain-based actions
   - Each panel PR: extract GameStateManager references, add selectors, test
   - Remove GameStateManager references from migrated panels only
   - **Test:** Panel works, no re-render bloat, localStorage persists UI state

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

## TypeScript Integration (Strongly Recommended)

Transitioning from GameStateManager.js to Zustand is an ideal time to add full TypeScript support. This prevents runtime bugs and enables IDE autocomplete.

### Complete TypeScript Setup

**State Interface:**
```ts
// stores/types.ts
export interface EconomyState {
  // State
  gold: number;
  food: number;
  mana: number;
  mana_regen: number;
  tax: number;
  
  // Derived (if stored)
  effective_income: number;
  
  // Collections (normalized)
  tradeRoutes: {
    byId: Record<string, TradeRoute>;
    allIds: string[];
  };
  
  // Actions
  receiveTurnUpdate: (data: TurnUpdate) => void;
  spendGold: (amount: number) => void;
  completeConstruction: (buildingType: string) => void;
  receiveTrade: (tradeData: TradeResult) => void;
}
```

**Store Implementation:**
```ts
// stores/economyStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';
import type { EconomyState } from './types';

export const useEconomyStore = create<EconomyState>()(
  devtools(
    immer((set) => ({
      // Initial state
      gold: 0,
      food: 0,
      mana: 0,
      mana_regen: 0,
      tax: 42,
      effective_income: 0,
      tradeRoutes: { byId: {}, allIds: [] },
      
      // Actions with full type safety
      receiveTurnUpdate: (data) => set((state) => {
        state.gold += data.gold_generated;
        state.food += data.food_generated;
        state.effective_income = data.gold_generated * (state.tax / 100);
      }),
      
      spendGold: (amount) => set((state) => {
        state.gold = Math.max(0, state.gold - amount);
      }),
      
      completeConstruction: (buildingType) => set((state) => {
        // Logic here — fully typed
      }),
      
      receiveTrade: (tradeData) => set((state) => {
        state.gold += tradeData.gold_received;
        state.gold -= tradeData.gold_spent;
      }),
    })),
    { name: 'economy' }
  )
);
```

**Component Usage (Full Type Safety):**
```tsx
import type { EconomyState } from './types';
import { useEconomyStore } from './economyStore';

function EconomyPanel() {
  // Selector is fully typed; IDE autocompletes state properties
  const gold = useEconomyStore((state: EconomyState) => state.gold);
  
  // Action is fully typed; IDE catches typos and wrong signatures
  const spendGold = useEconomyStore((state) => state.spendGold);
  
  return (
    <div>
      <p>Gold: {gold}</p>
      <button onClick={() => spendGold(100)}>Spend 100 Gold</button>
    </div>
  );
}
```

**Benefits:**
- ✅ IDE autocomplete for all state and actions
- ✅ Type safety: typos caught at compile time, not runtime
- ✅ Refactoring: renaming a field breaks builds, not production
- ✅ Documentation: types are self-documenting
- ✅ Team onboarding: new devs see what's available via autocomplete

**Migration Strategy:**
- Phase 1: Add TypeScript to core stores (economy, military)
- Phase 2: Type remaining stores incrementally
- Can coexist with JS stores during transition (use `any` where needed, migrate gradually)

**Zustand + TypeScript Best Practices:**
- Use `create<State>()(middleware(...))` pattern (note double parens)
- Separate state interface from component props
- Use `Pick<State, 'field1' | 'field2'>` to strongly type component props
- Actions should return `void` (mutations via immer) or new partial state

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
   
   // Option B: Derived state in store (must update manually in actions to avoid staleness)
   const useKingdomStore = create((set) => ({
     gold_income: 100,
     happiness_mult: 1.2,
     effective_income: 120,
     
     // Update derived value explicitly in action
     setIncome: (gold_income, happiness_mult) => set({
       gold_income,
       happiness_mult,
       effective_income: gold_income * happiness_mult
     })
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

## Key Architectural Decisions (Locked In)

### 1. Actions Model: Game Events, Not Field Setters

**❌ Don't do this:**
```js
setGold(100)
setMana(50)
setPopulation(1000)
```

**✅ Do this instead:**
```js
receiveTurnUpdate({ gold: 100, mana: 50, population: 1000 })
completeBuild('barracks')
applyCombatResult({ win: true, casualties: 50 })
finishResearch('warfare_5')
```

**Why:**
- Actions represent what happened in the game world
- Easier to reason about state transitions
- Natural place for side effects (trigger modals, sounds, animations)
- Transactional (all related state changes happen together)
- Testable: given an action, what's the expected state?

---

### 2. Domain Stores Split Early (Phase 1)

**Phase 1 includes full domain split, not a placeholder monolith.**

Stores created in Phase 1:
- `economyStore` — gold, food, trade routes
- `militaryStore` — troops, armies, combat, walls
- `researchStore` — research progress, disciplines
- `populationStore` — population, happiness, growth
- `uiStore` — panels, modals, selections

**Prevents:** monolithic bloat, unclear dependencies, team coordination bottlenecks

**Benefits for future growth:**
- Adding diplomacy system? → new `diplomacyStore`
- Adding markets? → separate `marketStore`
- Adding combat replays? → new `replayStore`
- Each system is isolated, testable, independently deployable

---

### 3. Selective Persistence (UI Only, Locked)

**Do NOT persist:**
- gold, mana, population, troops (server is authoritative)
- research progress, building state (server validates)
- injured_troops, wall_hp (server owns these)

**DO persist:**
- activePanel, sort order, filter preferences, column visibility
- Allows users to resume their UI state across page reloads

**Pattern:** `receiveServerSnapshot()` always overwrites authoritative state

---

## PR Strategy for Phase 1 (Many Small PRs)

To keep reviews manageable and enable rollback, split Phase 1 into many small PRs:

| PR | Scope | Diff | Effort |
|----|-------|------|--------|
| #1 | Store infrastructure (all stores + middleware) | <300 lines | 3 hrs |
| #2 | Migrate KingdomBodyHeader | <150 lines | 1.5 hrs |
| #3 | Migrate BuildPanel | <150 lines | 1.5 hrs |
| #4 | Migrate WarfarePanel | <150 lines | 1.5 hrs |
| #5 | Remove GameStateManager fallback | <50 lines | 0.5 hr |

**Benefits:**
- Each PR is easy to review (tight scope, clear intent)
- Each PR can be tested independently
- If one PR breaks, only that PR needs revert
- Team can merge and deploy incrementally
- Easier to spot bugs (smaller diff = fewer possible issues)

**Timeline:** 5 PRs over 5–7 days (accounting for review cycles)

---

## Phase 1 Kickoff Checklist

Before starting Phase 1, confirm:

- [ ] Plan approved by team and stakeholders (final approval pending)
- [ ] TypeScript setup ready (or upgrade plan documented)
- [ ] Socket.io event handlers identified and mapped to domain actions
- [ ] Middleware versions confirmed (Zustand v4, Immer v4 compatible)
- [ ] DevTools browser extension installed for testing
- [ ] localStorage strategy confirmed (UI state only)
- [ ] Entity normalization patterns documented (byId/allIds for armies, routes, etc.)
- [ ] Rollback plan tested (can revert to GameStateManager if critical issue)
- [ ] Phase 1 PR templates prepared (store infrastructure, panel migration)
- [ ] Team trained on Zustand hooks and selector patterns (useShallow, fine-grained selectors)
- [ ] Test harness for selector optimization ready (render count tests)
- [ ] Socket batching implementation ready (dynamic setTimeout, not setInterval)

---

## References

- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Zustand DevTools Middleware](https://github.com/pmndrs/zustand/blob/main/docs/integrations/persisting-store-data.md)
- [React DevTools Profiler](https://react.dev/learn/react-developer-tools)
- Zustand best practices: Selectors, shallow equality, persistence

---

**Next step:** Review this plan, gather feedback, finalize store structure, and schedule Phase 1 kickoff.
