# Final Vanilla Removal

## Goal
Remove the remaining vanilla shell, hybrid bridge code, and legacy DOM mutation paths so the client is fully React-owned, with only thin shared helpers left where they genuinely make sense.

## Working Rules
- Codex and Claude work in parallel.
- Do not touch the same file at the same time.
- Each slice ends with:
  - a build
  - a browser smoke test
  - a draft PR
- Keep gameplay behavior unchanged unless a slice explicitly needs a small fix to preserve existing behavior.
- Prefer moving logic out of `client/index.html` before touching lower-level helpers.

### Quick Global Searches (Do These First)
- `document.getElementById`
- `el(`
- `.innerHTML =`
- `.style.`
- `window.someGlobal`

## Codex Lane

### 1. Kill the shell in `client/index.html`
- [ ] Remove remaining orchestration logic from `client/index.html`
- [ ] Move panel switching into React-owned code or a small shared helper
- [ ] Remove remaining global shell wiring that is only there to bootstrap the old UI
- [ ] Keep `client/index.html` focused on bootstrapping, not UI ownership

### 2. Reduce hybrid bridge code
- [ ] Search for direct DOM mutation paths in `client/src/main.js`
- [ ] Remove or thin any bridge code that still mutates the DOM directly
- [ ] Keep `GameStateManager` as the state source only, not a renderer
- [ ] Convert any remaining shell-era event forwarding into React-safe helpers

### 3. Triage the heaviest hybrid panels
- [ ] Review `WorldmapRenderer.jsx` for imperative DOM behavior
- [ ] Review `WarfarePanel.jsx` for remaining legacy global calls
- [ ] Review any other panel still reaching into shell globals
- [ ] Convert one panel at a time and keep each PR narrow

### 4. Trim the last CSS dependency edges
- [ ] Identify old CSS files still carrying layout responsibility
- [ ] Remove only CSS that is no longer needed by active React surfaces
- [ ] Keep shared primitives if they are still genuinely reused

## Claude Lane

### 1. Inventory remaining imperative client calls
- [ ] Search the client for `document.getElementById`
- [ ] Search the client for `el(`
- [ ] Search the client for `innerHTML`
- [ ] Search the client for `.style.`
- [ ] Search for any remaining direct DOM mutation helpers in `socket-client.js`

### 2. Audit `GameStateManager` and socket paths
- [ ] Check for DOM mutation methods inside `GameStateManager`
- [ ] Move render behavior out of state mutation paths where possible
- [ ] Confirm socket listeners only update state or dispatch React-safe events

### 3. Remove or replace legacy bridge helpers
- [ ] Find remaining shell-era globals still used by React panels
- [ ] Replace them with shared helpers or local React props/state
- [ ] Keep compatibility shims only where a slice cannot be moved safely in one step

### 4. Clean up the remaining legacy CSS surfaces
- [ ] Review files still importing from `client/src/css/`
- [ ] Remove obsolete styles after the owning panel has been converted
- [ ] Leave shared utility styles alone if they still serve active UI

## File Order Recommendation
1. `client/index.html`
2. `client/src/main.js`
3. `socket-client.js`
4. `GameStateManager`
5. `WorldmapRenderer.jsx`
6. `WarfarePanel.jsx`
7. remaining `client/src/css/*`

## Success Criteria
- `client/index.html` is boot-only, with no real UI ownership left in it.
- React panels no longer depend on shell-era DOM mutation for normal rendering.
- Remaining helpers are shared utilities, not bridge glue.
- Legacy CSS is reduced to the minimum needed for shared primitives.
- Each slice is reviewable, testable, and safe to merge on its own.
