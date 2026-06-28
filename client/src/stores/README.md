# Zustand Domain Stores

**Status:** ✅ Current architecture — domain stores implemented with Immer + DevTools + Persist

## Overview

The game state is split into **5 focused domain stores**, replacing the monolithic `GameStateManager` singleton.

### Store Responsibilities

| Store | Owns | Pattern |
|-------|------|---------|
| **economyStore** | gold, food, trade routes, market prices, tax | Game events: `receiveTurnUpdate`, `completeBuild`, `receiveTrade` |
| **militaryStore** | troops, armies, combat, walls, injuries, equipment | Game events: `applyCombatResult`, `injureTroops`, `damageWalls` |
| **researchStore** | research progress, disciplines, mana, research queues | Game events: `completeResearch`, `spendMana`, `receiveResearchXp` |
| **populationStore** | population, happiness, growth rate, rebellion | Game events: `updateHappiness`, `applyCombatResult`, `triggerRebellion` |
| **uiStore** | panel visibility, modal state, sort order, filter preferences | UI events: `setActivePanel`, `openModal`, `setPanelState` |

## Architecture Principles

### 1. Authoritative (Server) vs. Client-Owned State

**Authoritative (never modified by UI directly):**
- gold, food, mana, population, troops, research_progress, wall_hp, injured_troops

**Client-owned (modified by UI):**
- activePanel, selectedArmy, hoveredUnit, pendingAttack, searchText, openModals

**Pattern:** `receiveServerSnapshot()` always overwrites authoritative state (write-once-per-snapshot for multiplayer safety).

### 2. Game-Event Actions (Not Field Setters)

**❌ Never do this:**
```js
setGold(100)
setMana(50)
setPopulation(1000)
```

**✅ Always do this:**
```js
receiveTurnUpdate({ gold: 100, mana: 50, population: 1000 })
completeBuild('barracks')
applyCombatResult({ win: true, casualties: 50 })
finishResearch('warfare_5')
```

**Why:** Actions represent game world events → natural transaction boundaries → testable, auditable.

### 3. Immer Middleware (Mandatory)

Safe nested state updates without spread operator chains:

```js
// Without Immer (painful):
setPanelState: (panelName, updates) =>
  set(state => ({
    panelState: {
      ...state.panelState,
      [panelName]: {
        ...state.panelState[panelName],
        ...updates,
      },
    },
  }))

// With Immer (clean):
setPanelState: (panelName, updates) =>
  set((state) => {
    Object.assign(state.panelState[panelName], updates);
  })
```

### 4. Entity Normalization (byId/allIds)

Collections use normalized pattern for O(1) updates:

```js
// Store structure
armies: {
  byId: {
    'army-1': { id: 'army-1', destination: 'Kingdom2', troops: {...} },
  },
  allIds: ['army-1'],
}

// Update single army (O(1)):
updateArmy: (armyId, updates) =>
  set(state => {
    Object.assign(state.armies.byId[armyId], updates);
  })

// Get all armies (selector transforms structure):
useArmies: () =>
  useStore(state => state.armies.allIds.map(id => state.armies.byId[id]))
```

### 5. Selectors (Performance Optimization)

Selectors prevent unnecessary re-renders by creating fine-grained subscriptions:

```js
// Only re-render if gold changed
const gold = useEconomyStore(state => state.gold);

// Multiple fields with shallow equality check
const resources = useShallow(state => ({
  gold: state.gold,
  food: state.food,
  mana: state.mana,
}));

// Computed selector (memoized)
const richness = useShallow(state => ({
  isRich: state.gold > 10000,
  isManaFull: state.mana > 500,
}));
```

**Import useShallow from zustand/react:**
```js
import { useShallow } from 'zustand/react';
```

## Middleware Stack

**Order matters:**
1. **Immer** (innermost) — Safe nested mutations
2. **DevTools** (middle) — Debugging state transitions
3. **Persist** (outermost) — localStorage for UI state

```js
const useStore = create(
  persist(
    devtools(
      immer((set) => ({
        // store definition
      })),
      { name: 'store-name' }
    ),
    {
      name: 'store-storage-key',
      partialize: (state) => ({
        // only persist UI state, not game metrics
      }),
    }
  )
);
```

## Persistence Strategy

**Only UI state persists across page reloads:**

✅ **Persist:**
- activePanel, sort order, filter preferences, column visibility
- Users resume UI state where they left off

❌ **Don't persist:**
- gold, mana, population, troops (server is authoritative)
- injured_troops, wall_hp, research_progress (server validates)
- pendingAttack, hoveredItem, form inputs (transient optimistic state)

**Pattern:** `receiveServerSnapshot()` always overwrites authoritative state on load.

## Socket.io Integration

```js
// In socket event handlers:
socket.on('kingdom-update', (data) => {
  useEconomyStore.getState().receiveServerSnapshot(data.economy);
  useMilitaryStore.getState().receiveServerSnapshot(data.military);
  useResearchStore.getState().receiveServerSnapshot(data.research);
  usePopulationStore.getState().receiveServerSnapshot(data.population);
});

socket.on('turn-tick', (turnData) => {
  useEconomyStore.getState().receiveTurnUpdate(turnData);
  useMilitaryStore.getState().receiveTurnUpdate(turnData);
  // ... etc
});
```

**Batching:** If socket sends many updates/sec, batch them:

```js
const batchQueue = [];
const BATCH_INTERVAL = 50; // ms
let batchTimeout = null;

socket.on('combat-update', (data) => {
  batchQueue.push(data);
  
  if (!batchTimeout) {
    batchTimeout = setTimeout(() => {
      useStore.getState().applyCombatResult({
        updates: batchQueue.splice(0),
      });
      batchTimeout = null;
    }, BATCH_INTERVAL);
  }
});
```

## Inter-Store Communication

Keep to minimum; each store owns its domain.

When necessary, use `getState()` to access other stores:

```js
// In economyStore.js action:
spendGold: (amount) => set((state) => {
  state.gold = Math.max(0, state.gold - amount);
  
  // Trigger modal in UI store if needed
  if (state.gold === 0) {
    useUIStore.getState().openModal('insufficient-funds');
  }
})
```

**Better pattern:** Have one action trigger another via orchestration:

```js
// In a turn processor or game loop:
handleTurnTick: (turnData) => {
  useEconomyStore.getState().receiveTurnUpdate(turnData);
  useMilitaryStore.getState().receiveTurnUpdate(turnData);
  
  const gold = useEconomyStore.getState().gold;
  if (gold < 100) {
    useUIStore.getState().openModal('low-funds-warning');
  }
}
```

## Adding New State

### Step 1: Identify domain
Does it belong to economy, military, research, population, or UI? Create new store if none fit.

### Step 2: Define state shape

```js
// In appropriate store
{
  newField: defaultValue,
  collection: { byId: {}, allIds: [] },  // if collection
}
```

### Step 3: Add actions (game events, not field setters)

```js
updateNewField: (data) => set((state) => {
  state.newField = data.value;
}),
```

### Step 4: Export selector

```js
export const useNewField = () => useStore(state => state.newField);
```

### Step 5: Test
- ✅ Redux DevTools shows state correctly
- ✅ Component re-renders only on relevant changes
- ✅ Smoke test passes

## Redux DevTools Integration

Open Redux DevTools browser extension to debug:
- See all state changes in timeline
- Inspect diffs between state snapshots
- Rewind/replay actions
- Export/import state

Each store is named for easy filtering (e.g., filter by "economy" to see only economyStore updates).

## Performance Tips

1. **Fine-grained selectors** — Only subscribe to fields you need
   ```js
   const gold = useEconomyStore(state => state.gold);  // ✅
   const allState = useEconomyStore(state => state);   // ❌ re-renders on any change
   ```

2. **useShallow for object selectors** — Shallow equality prevents unnecessary re-renders
   ```js
   const resources = useShallow(state => ({ gold: state.gold, food: state.food }));
   ```

3. **Memoize computed selectors**
   ```js
   const isRich = useShallow(state => ({
     rich: state.gold > 10000,
   }));
   ```

4. **Avoid object spreads in selectors** — Creates new reference every render
   ```js
   // ❌ Bad:
   const troops = useStore(state => ({ ...state.troops }));  // new object every render
   
   // ✅ Good:
   const troops = useStore(state => state.troops);  // same reference until troops change
   ```

5. **High-frequency updates** — Use transient subscriptions for animations
   ```js
   useEffect(() => {
     const unsubscribe = useEconomyStore.subscribe(
       state => state.gold,
       (gold) => {
         // Update DOM directly for animations, no React re-render
         if (goldRef.current) {
           goldRef.current.innerText = gold.toString();
         }
       }
     );
     return unsubscribe;
   }, []);
   ```

## FAQ

**Q: Can I modify authoritative state from a component?**
A: No. Only actions in the store modify authoritative state, and only via `receiveServerSnapshot()` or domain actions (receiveTurnUpdate, applyCombatResult, etc.). Components dispatch actions that go to the server, which sends back state updates.

**Q: Should I persist all UI state?**
A: No, only state that enhances UX when persisted (panel visibility, sort order). Don't persist transient state like hovered items or form inputs.

**Q: How do I ensure multiplayer safety?**
A: Write authoritative state via `receiveServerSnapshot()` (write-once-per-snapshot). Never modify it incrementally from the client. This prevents race conditions.

**Q: Can I add a 6th store?**
A: Yes, if it represents a new domain (diplomacy, markets, replays). Split early to avoid monolithic bloat. Update the index.js and socket integration points.

---

**Next steps:** Migrate individual panels to use stores (PR #2–#5). Remove GameStateManager fallback once all panels use stores.
