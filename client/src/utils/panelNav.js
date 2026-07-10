/**
 * Legacy navigation bridge - mostly deprecated now that GameStateManager is gone.
 *
 * Keep switchTab and migrate other consumers to Zustand.
 */
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
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  const contentType = response.headers.get('content-type');
  return contentType && contentType.includes('application/json') ? response.json() : { ok: true };
}

function normalizePanelName(tabName) {
  const PANEL_ALIASES = { attack: 'warfare', spells: 'warfare', covert: 'warfare' };
  const raw = String(tabName || '').trim().replace(/^#/, '');
  return raw ? (PANEL_ALIASES[raw] || raw) : 'status';
}

export function switchTab(tabName) {
  const WARFARE_SUBTAB_ALIASES = { attack: 'attack', spells: 'wspells', covert: 'wcovert' };
  const rawTab = String(tabName || '').trim().replace(/^#/, '') || 'status';
  const activeTab = normalizePanelName(rawTab);
  const warfareSubtab = WARFARE_SUBTAB_ALIASES[rawTab] || null;

  setActivePanelGlobal(activeTab);
  if (warfareSubtab) applyWarfareTab(warfareSubtab);
  if (window.location.hash !== `#${rawTab}`) window.location.hash = rawTab;
}

export function initGameStateManager() {
  // Deprecated - no longer needed. GameStateManager removed.
}

export function applyGameMutation(resultOrUpdates, context = {}) {
  // Deprecated - use applyGameMutation from gameMutations.js instead
  console.warn('panelNav.applyGameMutation is deprecated - use gameMutations.applyGameMutation');
  return resultOrUpdates;
}
