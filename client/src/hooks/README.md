# Game State Management Hooks

This directory contains hooks for accessing and updating global game state across all React panels.

## Available Hooks

### `useGameMetrics()`
Access and update global metrics (gold, mana, population, happiness, etc.)

```javascript
import { useGameMetrics } from '../hooks/useGameState';

function MyPanel() {
  const { metrics, updateMetrics } = useGameMetrics();

  return (
    <div>
      <p>Gold: {metrics.gold}</p>
      <button onClick={() => updateMetrics({ gold: 1000 })}>
        Add Gold
      </button>
    </div>
  );
}
```

**Metrics available:**
- `gold`
- `mana`
- `population`
- `happiness`
- `food`
- `land`
- `turn`
- `mana_regen`
- `gold_income`
- `food_balance`
- `tax`

### `useGameActions()`
Perform game actions (take turn, search, cast spell, attack)

```javascript
import { useGameActions } from '../hooks/useGameActions';

function MyPanel() {
  const { takeTurn, quickSearch, castSpell, attack } = useGameActions();

  const handleTakeTurn = async () => {
    const result = await takeTurn();
    if (result.success) {
      // Metrics auto-update via useGameMetrics()
      console.log('Turn taken!', result.panelData);
    }
  };

  return <button onClick={handleTakeTurn}>Take Turn</button>;
}
```

**Available actions:**
- `takeTurn()` - Take a turn, auto-updates metrics
- `quickSearch(type)` - Quick search for resources (food/gold/land)
- `castSpell(spellId, targetId)` - Cast spell on target
- `attack(targetId, units)` - Attack another kingdom

### `useActivePanel()`
Track which panel is currently active

```javascript
import { useActivePanel } from '../hooks/useActivePanel';

function MyPanel() {
  const { activePanel } = useActivePanel();

  // Component only updates its specific state when it's the active panel
  if (activePanel === 'myPanel') {
    // Load detailed data
  }

  return <div>{activePanel === 'myPanel' ? 'Active' : 'Inactive'}</div>;
}
```

### `usePanelState(panelName, initialState)`
Manage state for a specific panel

```javascript
import { usePanelState } from '../hooks/usePanelState';

function MyPanel() {
  const { state, setState, isActive } = usePanelState('myPanel', {
    buildings: [],
    selectedBuilding: null,
  });

  return (
    <div>
      {state.buildings.map(b => (
        <div key={b.id}>{b.name}</div>
      ))}
    </div>
  );
}
```

## How It Works

1. **Global Metrics**: Updated by vanilla JS code via `applyServerUpdates()` → synced to `gameStateManager` → all components using `useGameMetrics()` re-render
2. **Actions**: Call `takeTurn()`, `quickSearch()`, etc. → auto-update metrics → active panel gets data
3. **Panel Tracking**: When user switches tabs, `activePanel` updates → only active panel's state is fetched

## Architecture

- `GameStateManager.js`: Global state without React Context (works with multi-root React)
- `useGameState.js`: Hook to read/update global metrics
- `useActivePanel.js`: Hook to track active panel
- `usePanelState.js`: Hook for panel-specific state
- `useGameActions.js`: Hook for all game actions

## Integration

No changes needed to panel mounting! Just use the hooks in any component:

```javascript
import { useGameMetrics } from '../hooks/useGameState';

export default function MyPanel() {
  const { metrics } = useGameMetrics();
  return <div>Gold: {metrics.gold}</div>;
}
```

The metrics will auto-update after any turn/action, regardless of which panel is active or which tab you're on.
