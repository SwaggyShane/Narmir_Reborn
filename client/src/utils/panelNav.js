import { gameStateManager } from '../GameStateManager.js';
import { setActivePanelGlobal } from '../hooks/useActivePanel.js';
import { repairMojibake } from './repairMojibake.js';
import { fmt } from './fmt.js';
import { xpForLevel } from './xp.js';

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

function setActiveNavButtons(rawTab, activeTab) {
  document.querySelectorAll('.nav-item[data-tab], .bnav-item[data-tab]').forEach((button) => {
    const buttonTab = normalizePanelName(button.dataset.tab);
    const isActive = buttonTab === activeTab;
    button.classList.toggle('active', isActive);
  });
}

function setActivePanels(rawTab, activeTab) {
  const panels = document.querySelectorAll('.panel[id]');
  panels.forEach((panel) => {
    const panelTab = normalizePanelName(panel.id);
    const isActive = panelTab === activeTab || panel.id === `vue-panel-${activeTab}`;
    panel.classList.toggle('active', isActive);
    panel.style.display = isActive ? '' : 'none';
  });

  [...document.body.classList].forEach((className) => {
    if (className.startsWith('panel-')) document.body.classList.remove(className);
  });

  if (activeTab === 'globalchat') {
    document.body.classList.add('panel-globalchat');
    document.body.classList.add('panel-messages');
  } else {
    document.body.classList.add(`panel-${activeTab}`);
  }
}

export const gameState = gameStateManager.getMutableState();

function getTimeOfDay() {
  const h = new Date().getUTCHours();
  const isNight = h >= 1 && h < 13;
  const estHour = (h - 5 + 24) % 24;
  const ampm = estHour >= 12 ? 'PM' : 'AM';
  const display12 = estHour > 12 ? estHour - 12 : (estHour === 0 ? 12 : estHour);
  const timeStr = `${String(display12).padStart(2, ' ')}:00 ${ampm} EST`;
  const isDaylight = h < 1 || h >= 13;
  return { isNight, isDaylight, timeStr, hour: h };
}

export function syncUI() {
  const sourceState = window.state || gameStateManager.getState();
  const kingdomName = repairMojibake(sourceState.kingdomName || sourceState.name || 'My Kingdom');
  const kingdomOwner = repairMojibake(sourceState.username || sourceState.owner_name || sourceState.owner || kingdomName);
  const turn = sourceState.turn ?? 0;
  const score = sourceState.score ?? 0;
  const scorePerTurn = sourceState.score_per_turn ?? sourceState.scorePerTurn ?? sourceState.score_income ?? 0;
  const rank = sourceState.rank ?? sourceState.kingdom_rank ?? sourceState.position;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) {
      el.textContent = String(value);
    }
  };

  setText('kingdom-name', kingdomName);
  setText('kingdom-owner-line', kingdomOwner);
  setText('turn-num', turn);
  setText('kingdom-score-disp', fmt(score));
  setText('kingdom-score-per-turn', `(${scorePerTurn >= 0 ? '+' : ''}${fmt(scorePerTurn)}/turn)`);
  setText('top-rank', rank !== undefined && rank !== null ? `#${rank}` : '-');

  const level = sourceState.level ?? 1;
  const xp = sourceState.xp ?? 0;
  const prestige = sourceState.prestige_level ?? 0;
  const thisLvl = xpForLevel(level, prestige);
  const nextLvl = xpForLevel(level + 1, prestige);
  const xpInLevel = Math.max(0, Math.min(xp - thisLvl, nextLvl - thisLvl));
  const xpNeeded = Math.max(0, nextLvl - thisLvl);
  const xpPct = xpNeeded > 0 ? Math.min(100, Math.floor((xpInLevel / xpNeeded) * 100)) : 100;
  setText('kh-level', level);
  const xpBar = document.getElementById('kh-xp-bar');
  if (xpBar) xpBar.style.width = `${xpPct}%`;
  const xpLabel = document.getElementById('kh-xp-label');
  if (xpLabel) xpLabel.textContent = xpNeeded > 0 ? `${xpInLevel.toLocaleString()} / ${xpNeeded.toLocaleString()} XP` : 'Max Level';

  const timeInfo = getTimeOfDay();
  const timeEl = document.getElementById('time-of-day-badge');
  if (timeEl) {
    timeEl.textContent = timeInfo.timeStr;
    timeEl.style.color = timeInfo.isDaylight ? 'var(--gold)' : 'var(--green)';
  }
  if (sourceState.race === 'vampire') {
    const sunsetBadge = document.getElementById('vampire-sunset-badge');
    if (sunsetBadge) {
      if (timeInfo.isDaylight) {
        const hoursToSunset = timeInfo.hour >= 13 ? 25 - timeInfo.hour : 1 - timeInfo.hour;
        sunsetBadge.textContent = `Sunset in ${hoursToSunset}h`;
        sunsetBadge.style.display = 'inline-flex';
      } else {
        sunsetBadge.style.display = 'none';
      }
    }
  }
}

export function switchTab(tabName) {
  const WARFARE_SUBTAB_ALIASES = { attack: 'attack', spells: 'wspells', covert: 'wcovert' };
  const rawTab = String(tabName || '').trim().replace(/^#/, '') || 'status';
  const activeTab = normalizePanelName(rawTab);
  const warfareSubtab = WARFARE_SUBTAB_ALIASES[rawTab] || null;

  setActivePanelGlobal(activeTab);
  setActiveNavButtons(rawTab, activeTab);
  setActivePanels(rawTab, activeTab);

  if (warfareSubtab) {
    window.__pendingWarfareTab = warfareSubtab;
    if (typeof window.setWarfareTab === 'function') {
      window.setWarfareTab(warfareSubtab);
      window.__pendingWarfareTab = null;
    }
  }

  if (window.location.hash !== `#${rawTab}`) {
    window.location.hash = rawTab;
  }

  syncUI();
}

export function initGameStateManager() {
  const sourceState = window.state || gameStateManager.getState();
  if (sourceState) {
    gameStateManager.setState({
      ...sourceState,
      population: sourceState.population ?? sourceState.pop ?? 0,
    }, { reason: 'init' });
  }
  syncUI();
}

function applyServerUpdatesToGame(updates, context = {}) {
  if (!updates) return;

  const sourceState = window.state || gameStateManager.getState();
  const normalizedState = sourceState
    ? { ...sourceState, population: sourceState.population ?? sourceState.pop }
    : updates;
  gameStateManager.applyUpdates(normalizedState, {
    reason: context.reason || 'server-updates',
    payload: updates,
  });

  try {
    syncUI();
  } catch (error) {
    console.error('[UI] Error during syncUI execution:', error);
  }
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

// Keep vanilla DOM elements in kd-top in sync with game state changes.
// applyGameMutation already calls syncUI(), but this catches direct setState()
// calls (e.g. from the initial loadKingdom on page load) that bypass it.
gameStateManager.subscribe(() => {
  try { syncUI(); } catch { /* ignore */ }
});
