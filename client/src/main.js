import React from "react";
import { createRoot } from "react-dom/client";
import { gameStateManager } from "./GameStateManager.js";
import { setActivePanelGlobal } from "./hooks/useActivePanel.js";
import TopbarReact from "./components/react/Topbar.jsx";
import GoalsPanelReact from "./components/react/GoalsPanel.jsx";
import SidebarReact from "./components/react/Sidebar.jsx";
import BottomNavReact from "./components/react/BottomNav.jsx";
import NewsPanelReact from "./components/react/NewsPanel.jsx";
import OptionsPanelReact from "./components/react/OptionsPanel.jsx";
import ChangelogPanelReact from "./components/react/ChangelogPanel.jsx";
import RacesPanelReact from "./components/react/RacesPanel.jsx";
import BountiesPanelReact from "./components/react/BountiesPanel.jsx";
import AlliancesPanelReact from "./components/react/AlliancesPanel.jsx";
import WorldmapPanelReact from "./components/react/WorldmapPanel.jsx";
import RankingsPanelReact from "./components/react/RankingsPanel.jsx";
import BuildPanelReact from "./components/react/BuildPanel.jsx";
import DefensePanelReact from "./components/react/DefensePanel.jsx";
import EconomyPanelReact from "./components/react/EconomyPanel.jsx";
import ExplorationPanelReact from "./components/react/ExplorationPanel.jsx";
import MarketPanelReact from "./components/react/MarketPanel.jsx";
import WarfarePanelReact from "./components/react/WarfarePanel.jsx";
import TrainingPanelReact from "./components/react/TrainingPanel.jsx";
import StatusPanelReact from "./components/react/StatusPanel.jsx";
import HappinessPanelReact from "./components/react/HappinessPanel.jsx";
import TestingPanelReact from "./components/react/TestingPanel.jsx";
import StudiesPanelReact from "./components/react/StudiesPanel.jsx";
import HeroesPanelReact from "./components/react/HeroesPanel.jsx";
import HirePanelReact from "./components/react/HirePanel.jsx";
import ResourcesPanelReact from "./components/react/ResourcesPanel.jsx";
import GlobalchatPanelReact from "./components/react/GlobalchatPanel.jsx";
import SchoolSelectionControllerReact from "./components/react/SchoolSelectionController.jsx";
import ForumSectionReact from "./components/forum/ForumSection.jsx";
import "./css/forum.css";
import ResourceStripReact from "./components/react/ResourceStrip.jsx";

// API call helper for making authenticated requests from vanilla JS
//
// NOTE: This window.apiCall uses the convention (method, url, body) — e.g.
//   window.apiCall("POST", "/api/kingdom/turn", { foo: 1 })
//
// This differs from client/src/utils/api.js which exports apiCall(url, options)
// where options is a fetch-style object { method, body, headers, ... }.
//
// All existing callers of window.apiCall (MarketPanel.jsx, NewsPanel.jsx, and
// index.html) use the (method, url, body) convention. Do NOT change this
// signature without updating all callers.
async function apiCall(method, endpoint, body = null) {
  const getCsrfToken = () => {
    try {
      const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
      if (m) return decodeURIComponent(m[1]);
    } catch {}
    return null;
  };

  const headers = { 'Content-Type': 'application/json' };
  const csrfToken = getCsrfToken();
  if (csrfToken) headers['x-csrf-token'] = csrfToken;

  const options = { method, headers, credentials: 'include' };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(endpoint, options);

  // Check if response is OK (status 200-299)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  // Check content type before parsing JSON
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }

  // For non-JSON responses (e.g., 204 No Content), return success
  return { ok: true };
}
window.apiCall = apiCall;

function repairDisplayText(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (typeof window !== "undefined" && typeof window.repairMojibake === "function") {
    return window.repairMojibake(text);
  }
  return text
    .replace(/·/g, "·")
    .replace(/—/g, "—")
    .replace(/–/g, "-")
    .replace(/•/g, "•")
    .replace(/‘|’/g, "'")
    .replace(/“|"/g, '"');
}

console.log("[react] main.js execution started at", new Date().toISOString());

export const gameState = gameStateManager.getMutableState();
window.gameState = gameState;

const PANEL_ALIASES = {
  attack: "warfare",
  spells: "warfare",
  covert: "warfare",
};

const WARFARE_SUBTAB_ALIASES = {
  attack: "attack",
  spells: "wspells",
  covert: "wcovert",
};

function normalizePanelName(tabName) {
  const raw = String(tabName || "").trim().replace(/^#/, "");
  return raw ? (PANEL_ALIASES[raw] || raw) : "status";
}

function setActiveNavButtons(rawTab, activeTab) {
  document.querySelectorAll(".nav-item[data-tab], .bnav-item[data-tab]").forEach((button) => {
    const buttonTab = normalizePanelName(button.dataset.tab);
    const isActive = buttonTab === activeTab;
    button.classList.toggle("active", isActive);
  });
}

function setActivePanels(rawTab, activeTab) {
  const panels = document.querySelectorAll(".panel[id]");
  panels.forEach((panel) => {
    const panelTab = normalizePanelName(panel.id);
    const isActive = panelTab === activeTab || panel.id === `vue-panel-${activeTab}`;
    panel.classList.toggle("active", isActive);
    panel.style.display = isActive ? "" : "none";
  });

  document.body.classList.forEach((className) => {
    if (className.startsWith("panel-")) document.body.classList.remove(className);
  });

  if (activeTab === "globalchat") {
    document.body.classList.add("panel-globalchat");
    document.body.classList.add("panel-messages");
  } else {
    document.body.classList.add(`panel-${activeTab}`);
  }
}

window.syncUI = () => {
  const sourceState = window.gameState || window.state || {};
  const kingdomName = repairDisplayText(sourceState.kingdomName || sourceState.name || "My Kingdom");
  const kingdomOwner = repairDisplayText(sourceState.username || sourceState.owner_name || sourceState.owner || kingdomName);
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

  setText("kingdom-name", kingdomName);
  setText("kingdom-owner-line", kingdomOwner);
  setText("turn-num", turn);
  setText("kingdom-score-disp", fmt(score));
  setText("kingdom-score-per-turn", `(${scorePerTurn >= 0 ? "+" : ""}${fmt(scorePerTurn)}/turn)`);
  setText("top-rank", rank !== undefined && rank !== null ? `#${rank}` : "-");

  if (typeof window.updateXpDisplay === "function") {
    window.updateXpDisplay();
  }
  if (typeof window.updateTurnsDisplay === "function") {
    window.updateTurnsDisplay();
  }
};

window.switchTab = (tabName) => {
  const rawTab = String(tabName || "").trim().replace(/^#/, "") || "status";
  const activeTab = normalizePanelName(rawTab);
  const warfareSubtab = WARFARE_SUBTAB_ALIASES[rawTab] || null;

  setActivePanelGlobal(activeTab);
  setActiveNavButtons(rawTab, activeTab);
  setActivePanels(rawTab, activeTab);

  if (warfareSubtab) {
    window.__pendingWarfareTab = warfareSubtab;
    if (typeof window.setWarfareTab === "function") {
      window.setWarfareTab(warfareSubtab);
      window.__pendingWarfareTab = null;
    }
  }

  if (window.location.hash !== `#${rawTab}`) {
    window.location.hash = rawTab;
  }

  window.syncUI?.();
  window.triggerReactUpdates?.();
};

window.switchTabMobile = window.switchTab;

// Initialize game state manager with current state
export function initGameStateManager() {
  const sourceState = window.state || window.gameState;
  if (sourceState) {
    gameStateManager.setState({
      ...sourceState,
      population: sourceState.population ?? sourceState.pop ?? 0,
    }, { reason: 'init' });
  }
}

// WRAP vanilla JS applyServerUpdates to sync metrics to gameStateManager
// Guard against HMR re-wrapping to prevent infinite recursion
if (!window._applyServerUpdatesWrapped) {
  const originalApplyServerUpdates = window.applyServerUpdates;
  window.applyServerUpdates = function(updates, context = {}) {
    if (!updates) return;

    // Let the legacy normalizer update window.state first, then snapshot the full state.
    if (originalApplyServerUpdates) {
      originalApplyServerUpdates(updates);
    }

    const sourceState = window.state || window.gameState;
    const normalizedState = sourceState
      ? { ...sourceState, population: sourceState.population ?? sourceState.pop }
      : updates;
    gameStateManager.applyUpdates(normalizedState, {
      reason: context.reason || 'server-updates',
      payload: updates,
    });

    // Keep non-React legacy surfaces refreshed during the migration.
    try {
      if (typeof window.syncUI === "function") {
        window.syncUI();
      }
    } catch (error) {
      console.error("[UI] Error during syncUI execution:", error);
    }
  };
  window._applyServerUpdatesWrapped = true;
}

const reactHooks = new Map();
window.registerPanelReactHook = (panelId, callback) => {
  reactHooks.set(panelId, callback);
  return () => {
    reactHooks.delete(panelId);
  };
};
window.triggerReactUpdates = () => {
  reactHooks.forEach(cb => {
    try { cb(); } catch (e) { console.error("[react] Hook update error:", e); }
  });
};

const panelRefreshers = new Map();
window.registerPanelRefresh = (panelId, callback) => {
  panelRefreshers.set(panelId, callback);
  return () => {
    if (panelRefreshers.get(panelId) === callback) panelRefreshers.delete(panelId);
  };
};
window.refreshPanel = (panelId, context = {}) => {
  const callback = panelRefreshers.get(panelId);
  if (!callback) return false;
  try {
    callback(context);
    return true;
  } catch (e) {
    console.error(`[react] Panel refresh failed for ${panelId}:`, e);
    return false;
  }
};
window.refreshActivePanel = (context = {}) => {
  const activeEl = document.querySelector('.panel.active[id], .panel[style*="display: block"][id]');
  const panelId = context.panelId || activeEl?.id || window.location.hash?.replace('#', '');
  return panelId ? window.refreshPanel(panelId, context) : false;
};
window.applyGameMutation = (resultOrUpdates, context = {}) => {
  if (!resultOrUpdates) return resultOrUpdates;
  const directUpdateKeys = [
    'gold', 'mana', 'population', 'pop', 'land', 'turn', 'turns_stored',
    'food', 'happiness', 'fighters', 'rangers', 'mages', 'clerics',
    'engineers', 'wood', 'stone', 'iron', 'coal', 'steel', 'thralls',
  ];
  const updates = resultOrUpdates.updates
    || resultOrUpdates.kUpdates
    || (directUpdateKeys.some(key => resultOrUpdates[key] !== undefined) ? resultOrUpdates : null);
  if (updates && typeof window.applyServerUpdates === 'function') {
    window.applyServerUpdates(updates, context);
  } else if (updates) {
    gameStateManager.applyUpdates(updates, {
      reason: context.reason || 'mutation',
      payload: updates,
    });
  }
  window.refreshActivePanel({ ...context, result: resultOrUpdates });
  return resultOrUpdates;
};

if (window.setGameStateObj) {
  window.setGameStateObj(gameState);
}

const reactRoots = new Map();

export const mountReactApps = () => {
  console.log("[react] Starting mount sequence...");

  const tryMount = (elementId, ComponentReact) => {
    try {
      const el = document.getElementById(elementId);
      if (el && !reactRoots.has(elementId)) {
        const root = createRoot(el);
        root.render(React.createElement(ComponentReact));
        reactRoots.set(elementId, root);
        console.log(`[react] SUCCESSFULLY Mounted: ${ComponentReact.name || elementId} to #${elementId}`);
      }
    } catch (err) {
      console.error(`[react] Failed to mount to #${elementId}:`, err);
    }
  };

  tryMount("vue-topbar-mount", TopbarReact);
  tryMount("react-resource-strip", ResourceStripReact);
  tryMount("vue-panel-goals", GoalsPanelReact);
  tryMount("vue-sidebar-mount", SidebarReact);
  tryMount("vue-bottom-nav-mount", BottomNavReact);
  tryMount("vue-panel-news", NewsPanelReact);
  tryMount("vue-panel-options", OptionsPanelReact);
  tryMount("vue-panel-changelog", ChangelogPanelReact);
  tryMount("vue-panel-races", RacesPanelReact);
  tryMount("vue-panel-bounties", BountiesPanelReact);
  tryMount("vue-panel-alliances", AlliancesPanelReact);
  tryMount("vue-panel-worldmap", WorldmapPanelReact);
  tryMount("vue-panel-rankings", RankingsPanelReact);
  tryMount("vue-panel-build", BuildPanelReact);
  tryMount("vue-panel-defense", DefensePanelReact);
  tryMount("vue-panel-economy", EconomyPanelReact);
  tryMount("vue-panel-exploration", ExplorationPanelReact);
  tryMount("vue-panel-market", MarketPanelReact);
  tryMount("vue-panel-warfare", WarfarePanelReact);
  tryMount("vue-panel-training", TrainingPanelReact);
  tryMount("vue-panel-status", StatusPanelReact);
  tryMount("vue-panel-happiness", HappinessPanelReact);
  tryMount("vue-panel-testing", TestingPanelReact);
  tryMount("vue-panel-studies", StudiesPanelReact);
  tryMount("vue-panel-heroes", HeroesPanelReact);
  tryMount("vue-panel-hire", HirePanelReact);
  tryMount("vue-panel-resources", ResourcesPanelReact);
  tryMount("vue-panel-globalchat", GlobalchatPanelReact);
  tryMount("vue-panel-school-selection", SchoolSelectionControllerReact);
  tryMount("vue-panel-forum", ForumSectionReact);

  console.log("[react] All apps mounted");

  if (window.switchTab) {
    if (window.location.hash) {
      window.switchTab(window.location.hash.substring(1));
    } else {
      window.switchTab('status');
    }
  }
};

window.mountReactApps = mountReactApps;

// Audio system
window.playAchievementSound = () => {
  try {
    const audio = new Audio('/sound/achievement.mp3');
    audio.volume = 0.7;
    audio.play().catch(() => {
      // Silently fail if audio can't play (browser restrictions, file not found, etc.)
      console.debug('[audio] Achievement sound failed to play');
    });
  } catch (err) {
    console.debug('[audio] Error playing sound:', err.message);
  }
};

// Mage allocation and study functions
window.updateMageAllocationDisplay = () => {
  const totalMages = (window.gameState && window.gameState.mages) || 0;
  const spellbookAlloc = Math.max(0, parseInt(document.getElementById("mage-alloc-spellbook")?.value, 10) || 0);
  const schoolAlloc = Math.max(0, parseInt(document.getElementById("mage-alloc-school")?.value, 10) || 0);
  const totalAllocated = spellbookAlloc + schoolAlloc;
  const available = totalMages - totalAllocated;

  const totalEl = document.getElementById("mage-total");
  const availEl = document.getElementById("mage-available");
  const allocEl = document.getElementById("mage-allocated");

  if (totalEl) totalEl.textContent = totalMages.toLocaleString();
  if (availEl) availEl.textContent = Math.max(0, available).toLocaleString();
  if (allocEl) allocEl.textContent = totalAllocated.toLocaleString();
};

window.setMageMax = (type) => {
  const totalMages = (window.gameState && window.gameState.mages) || 0;
  const otherType = type === 'spellbook' ? 'mage-alloc-school' : 'mage-alloc-spellbook';
  const otherValue = Math.max(0, parseInt(document.getElementById(otherType)?.value, 10) || 0);
  const maxAllowed = Math.max(0, totalMages - otherValue);

  const targetId = type === 'spellbook' ? 'mage-alloc-spellbook' : 'mage-alloc-school';
  const targetEl = document.getElementById(targetId);
  if (targetEl) targetEl.value = maxAllowed;

  if (window.updateMageAllocationDisplay) window.updateMageAllocationDisplay();
};

window.releaseMageAllocation = () => {
  const spellbookEl = document.getElementById("mage-alloc-spellbook");
  const schoolEl = document.getElementById("mage-alloc-school");
  if (spellbookEl) spellbookEl.value = 0;
  if (schoolEl) schoolEl.value = 0;

  if (window.updateMageAllocationDisplay) window.updateMageAllocationDisplay();
  if (window.studyMagic) window.studyMagic();
};

window.studyMagic = async () => {
  try {
    const spellbook = Math.max(0, parseInt(document.getElementById("mage-alloc-spellbook")?.value, 10) || 0);
    const school_spellbook = Math.max(0, parseInt(document.getElementById("mage-alloc-school")?.value, 10) || 0);

    const totalMages = (window.gameState && window.gameState.mages) || 0;
    if (spellbook + school_spellbook > totalMages) {
      alert(`Allocated ${spellbook + school_spellbook} mages, but only have ${totalMages}`);
      return;
    }

    // Get CSRF token from cookies
    const getCsrfToken = () => {
      try {
        const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
        if (m) return decodeURIComponent(m[1]);
      } catch {}
      return null;
    };

    const headers = { "Content-Type": "application/json" };
    const csrfToken = getCsrfToken();
    if (csrfToken) headers["x-csrf-token"] = csrfToken;

    const response = await fetch("/api/kingdom/school-allocation", {
      method: "POST",
      headers,
      body: JSON.stringify({ spellbook, school_spellbook }),
    });

    const data = await response.json();
    if (data.error) {
      alert(data.error);
    } else if (data.ok) {
      console.log("[studies] Mage allocation saved successfully");
      if (window.updateMageAllocationDisplay) window.updateMageAllocationDisplay();
      if (window.triggerReactUpdates) window.triggerReactUpdates();
    }
  } catch (error) {
    console.error("[studies] Error saving mage allocation:", error);
    alert("Failed to save allocation: " + error.message);
  }
};

window.renderLibraryPanel = async () => {
  try {
    const response = await fetch("/api/kingdom/lore-and-achievements", {
      cache: 'no-store',
      headers: { 'pragma': 'no-cache' }
    });
    if (!response.ok) throw new Error("HTTP " + response.status);

    const data = await response.json();
    const { raceLore = [], narmirLore = [], generalLore = [], achievements = [] } = data;

    const loreContainer = document.getElementById("library-lore-list");
    if (loreContainer) {
      loreContainer.innerHTML = '';
      const allLore = [...raceLore, ...narmirLore, ...generalLore];

      if (allLore.length === 0) {
        loreContainer.innerHTML = '<div style="color: var(--text3);">No lore collected yet.</div>';
      } else {
        allLore.forEach(lore => {
          const loreDiv = document.createElement('div');
          loreDiv.style.cssText = 'padding: 8px; border-left: 3px solid var(--accent1); background: var(--bg2);';
          loreDiv.innerHTML =
            '<div style="font-weight: 500; color: var(--text); margin-bottom: 4px;">' + (lore.title || 'Unknown') + '</div>' +
            '<div style="color: var(--text2); font-size: 12px; line-height: 1.4;">' + (lore.msg || '') + '</div>';
          loreContainer.appendChild(loreDiv);
        });
      }
    }

    const achievementsContainer = document.getElementById("library-achievements");
    if (achievementsContainer) {
      achievementsContainer.innerHTML = '';

      if (achievements.length === 0) {
        const noAchDiv = document.createElement('div');
        noAchDiv.style.color = 'var(--text3)';
        noAchDiv.style.fontSize = '12px';
        noAchDiv.textContent = 'No achievements available.';
        achievementsContainer.appendChild(noAchDiv);
      } else {
        achievements.forEach(ach => {
          const achDiv = document.createElement('div');
          const borderColor = ach.completed ? 'var(--green)' : 'var(--text3)';
          const bgColor = ach.completed ? 'var(--bg2)' : 'transparent';
          achDiv.style.cssText = 'padding: 8px; border-left: 3px solid ' + borderColor + '; background: ' + bgColor + ';';

          const titleDiv = document.createElement('div');
          const titleColor = ach.completed ? 'var(--text)' : 'var(--text2)';
          const titlePrefix = ach.completed ? '⭐ ' : '';
          titleDiv.style.cssText = 'font-weight: ' + (ach.completed ? '500' : '400') + '; color: ' + titleColor + ';';
          titleDiv.textContent = titlePrefix + (ach.title || 'Achievement');
          achDiv.appendChild(titleDiv);

          if (ach.completed) {
            const description = ach.description || '';
            if (description) {
              const descDiv = document.createElement('div');
              descDiv.style.cssText = 'color: var(--text2); font-size: 12px; margin-top: 4px;';
              descDiv.textContent = description;
              achDiv.appendChild(descDiv);
            }

            const reward = ach.reward || '';
            if (reward) {
              const rewardDiv = document.createElement('div');
              rewardDiv.style.cssText = 'color: var(--green); font-size: 12px; font-weight: 500; margin-top: 4px;';
              rewardDiv.textContent = 'Reward: ' + reward;
              achDiv.appendChild(rewardDiv);
            }
          } else {
            const description = ach.description || '';
            if (description) {
              const descDiv = document.createElement('div');
              descDiv.style.cssText = 'color: var(--text2); font-size: 12px; margin-top: 4px; margin-bottom: 8px;';
              descDiv.textContent = description;
              achDiv.appendChild(descDiv);
            }

            if (ach.progress) {
              const progressContainer = document.createElement('div');
              progressContainer.style.cssText = 'margin-top: 8px;';

              const progressBar = document.createElement('div');
              progressBar.style.cssText = 'background: var(--bg3); border-radius: 2px; height: 8px; overflow: hidden; margin-bottom: 4px;';

              const progressFill = document.createElement('div');
              progressFill.style.cssText = 'background: var(--accent1); height: 100%; width: ' + ach.progress.percent + '%; transition: width 0.3s ease;';
              progressBar.appendChild(progressFill);
              progressContainer.appendChild(progressBar);

              const progressLabel = document.createElement('div');
              progressLabel.style.cssText = 'color: var(--text3); font-size: 11px; display: flex; justify-content: space-between;';
              const labelLeft = document.createElement('span');
              labelLeft.textContent = ach.progress.sublabel || '';
              const labelRight = document.createElement('span');
              labelRight.textContent = ach.progress.percent + '%';
              progressLabel.appendChild(labelLeft);
              progressLabel.appendChild(labelRight);
              progressContainer.appendChild(progressLabel);

              const progressText = document.createElement('div');
              progressText.style.cssText = 'color: var(--text3); font-size: 11px; margin-top: 2px;';
              progressText.textContent = ach.progress.label;
              progressContainer.appendChild(progressText);

              achDiv.appendChild(progressContainer);
            }
          }

          achievementsContainer.appendChild(achDiv);
        });
      }
    }
  } catch (error) {
    console.error("[library] Failed to load lore and achievements:", error);
    const loreContainer = document.getElementById("library-lore-list");
    if (loreContainer) {
      loreContainer.innerHTML = '';
      const errorDiv = document.createElement('div');
      errorDiv.style.color = 'var(--red)';
      errorDiv.textContent = 'Failed to load lore: ' + error.message;
      loreContainer.appendChild(errorDiv);
    }
  }
};

window.updateTurnsDisplay = () => {
  const turnsStored = window.gameState?.turns_stored;
  if (turnsStored !== undefined) {
    const el = document.getElementById("turns-stored-disp");
    if (el) {
      el.textContent = String(turnsStored);
    }
  }
};

let canonicalTurnInProgress = false;
window.takeTurn = async () => {
  if (canonicalTurnInProgress) return;
  if ((window.gameState?.turns_stored || 0) < 1) {
    const countdown = document.getElementById("regen-countdown")?.textContent || "25:00";
    window.toast?.(`No turns available. Refills in ${countdown}`, "warning");
    return;
  }

  canonicalTurnInProgress = true;
  const btn = document.querySelector(".turn-btn");
  if (btn) btn.style.opacity = "0.6";
  window.playGameSound?.("take_turn");

  try {
    const data = await apiCall("POST", "/api/kingdom/turn");
    if (data.error) {
      window.toast?.(data.error, data.error.includes("No turns available") ? "warning" : "error");
      console.error("[turn] error:", data.error);
      return;
    }
    if (!data.ok) return;

    const turnUpdates = { ...(data.updates || {}) };
    if (data.turns_stored !== undefined && turnUpdates.turns_stored === undefined) {
      turnUpdates.turns_stored = data.turns_stored;
    }
    if (Object.keys(turnUpdates).length) {
      data.updates = turnUpdates;
      window.applyGameMutation(data, { reason: "turn" });
      window.syncFromState?.();

      try {
        window.updateTurnsDisplay?.();
        window.updateXpDisplay?.();
        window.updateMageAllocationDisplay?.();
        window.refreshResourcesPanel?.();
      } catch (e) {
        console.error("[turn] Error refreshing display elements:", e);
      }
    }

    const currentTurn = window.gameState?.turn || data.updates?.turn;
    const turnEl = document.getElementById("turn-num");
    if (turnEl && currentTurn !== undefined) turnEl.textContent = currentTurn;
    const newsTurn = document.getElementById("news-turn-num");
    if (newsTurn && currentTurn !== undefined) newsTurn.textContent = currentTurn;

    let completedBuildingsMsg = "";
    const blurbs = [];
    if (data.events) {
      window.appendNewsItems?.(data.events);
      for (const ev of data.events) {
        const msg = ev.message || "";
        if (msg.includes("Completed: ")) {
          const index = msg.indexOf("Completed: ");
          const endPart = msg.substring(index + "Completed: ".length);
          const periodIndex = endPart.indexOf(".");
          completedBuildingsMsg = periodIndex !== -1 ? endPart.substring(0, periodIndex) : endPart;
        }
        if (ev.message?.includes("ACHIEVEMENT UNLOCKED")) {
          window.playAchievementSound?.();
        }
      }
      if (completedBuildingsMsg && window.getCompletionBlurb) {
        completedBuildingsMsg.split(",").forEach(item => {
          const blurb = window.getCompletionBlurb(item.trim());
          if (blurb) blurbs.push(blurb);
        });
      }
    }

    const turnsLeft = window.gameState?.turns_stored ?? data.updates?.turns_stored ?? 0;
    if (btn) btn.style.opacity = turnsLeft > 0 ? "1" : "0.4";
    const turnStatus = `Turn ${currentTurn || "?"} - ${turnsLeft} turns left`;
    const buildStatus = completedBuildingsMsg
      ? `Completed: ${completedBuildingsMsg}!\n${blurbs.join("\n") || ""}`
      : "";

    if ((window.gameState?.food || 0) < 1000) {
      window.toast?.(`Warning: Food levels are dangerously low!\n${buildStatus ? `${buildStatus}\n` : ""}${turnStatus}`, "warning");
    } else if ((window.gameState?.gold || 0) < 1000) {
      window.toast?.(`Warning: Gold reserves are almost empty!\n${buildStatus ? `${buildStatus}\n` : ""}${turnStatus}`, "warning");
    } else {
      window.toast?.(buildStatus ? `${buildStatus}\n${turnStatus}` : turnStatus, "success");
    }

    await window.loadActiveExpeditions?.();
    window.checkSchoolSelection?.();
  } catch (error) {
    console.error("[turn] Error taking turn:", error);
    window.toast?.("Failed to take turn: " + error.message, "error");
  } finally {
    canonicalTurnInProgress = false;
    if (btn && (window.gameState?.turns_stored || 0) > 0) btn.style.opacity = "1";
  }
};

// Wait for DOM to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initGameStateManager();
    mountReactApps();
  });
} else {
  initGameStateManager();
  mountReactApps();
}
