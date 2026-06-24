import { gameStateManager } from '../GameStateManager.js';
import { setActivePanelGlobal } from '../hooks/useActivePanel.js';
import { setWarfareTab as applyWarfareTab } from './warfareTabs.js';

function getCsrfToken() {
  try {
    const match = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

export async function apiCall(method, endpoint, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const csrfToken = getCsrfToken();
  if (csrfToken) headers['x-csrf-token'] = csrfToken;

  const options = { method, headers, credentials: 'include' };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(endpoint, options);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }

  return { ok: true };
}

function normalizePanelName(tabName) {
  const PANEL_ALIASES = { attack: 'warfare', spells: 'warfare', covert: 'warfare' };
  const raw = String(tabName || '').trim().replace(/^#/, '');
  return raw ? (PANEL_ALIASES[raw] || raw) : 'status';
}

export const gameState = gameStateManager.getMutableState();

export function switchTab(tabName) {
  const WARFARE_SUBTAB_ALIASES = { attack: 'attack', spells: 'wspells', covert: 'wcovert' };
  const rawTab = String(tabName || '').trim().replace(/^#/, '') || 'status';
  const activeTab = normalizePanelName(rawTab);
  const warfareSubtab = WARFARE_SUBTAB_ALIASES[rawTab] || null;

  setActivePanelGlobal(activeTab);

  if (warfareSubtab) {
    applyWarfareTab(warfareSubtab);
  }

  if (window.location.hash !== `#${rawTab}`) {
    window.location.hash = rawTab;
  }
}

export function initGameStateManager() {
  const sourceState = gameStateManager.getState();
  if (sourceState) {
    gameStateManager.setState({
      ...sourceState,
      population: sourceState.population ?? sourceState.pop ?? 0,
    }, { reason: 'init' });
  }
}

function applyServerUpdatesToGame(updates, context = {}) {
  if (!updates) return;

  const sourceState = gameStateManager.getState();
  const normalizedState = sourceState
    ? { ...sourceState, population: sourceState.population ?? sourceState.pop }
    : updates;
  gameStateManager.applyUpdates(normalizedState, {
    reason: context.reason || 'server-updates',
    payload: updates,
  });
}

export function applyGameMutation(resultOrUpdates, context = {}) {
  if (!resultOrUpdates) return resultOrUpdates;
  const directUpdateKeys = [
    'gold', 'mana', 'population', 'pop', 'land', 'turn', 'turns_stored',
    'food', 'happiness', 'fighters', 'rangers', 'mages', 'clerics',
    'engineers', 'wood', 'stone', 'iron', 'coal', 'steel', 'thralls',
  ];
  const updates = resultOrUpdates.updates
    || resultOrUpdates.kUpdates
    || (directUpdateKeys.some(key => resultOrUpdates[key] !== undefined) ? resultOrUpdates : null);
  if (updates) {
    applyServerUpdatesToGame(updates, context);
  }
  return resultOrUpdates;
}