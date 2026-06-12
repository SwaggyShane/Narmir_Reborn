import React from "react";
import { createRoot } from "react-dom/client";
import { gameStateManager } from "./GameStateManager.js";
import { setActivePanelGlobal, getActivePanelGlobal } from "./hooks/useActivePanel.js";
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
import SchoolSelectionPanelReact from "./components/react/SchoolSelectionPanel.jsx";
import MetricsStripReact from "./components/react/MetricsStrip.jsx";

// API call helper for making authenticated requests from vanilla JS
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

console.log("[react] main.js execution started at", new Date().toISOString());

export const gameState = {};
window.gameState = gameState;

// ─── SINGLE MUTATION ENTRY POINT ──────────────────────────────────────────
//
// Every server-action result in the app goes through this function.
// It accepts the raw response shape ({ ok, updates, events, ... }) and
// handles every cross-cutting concern in one place:
//
//   1. Mirror updates to window.gameState (legacy vanilla code)
//   2. Push updates through gameStateManager.applyUpdates(updates, reason)
//      — React re-renders, mutation listeners fire
//   3. Fan out result.events to toast() and playAchievementSound()
//   4. Run vanilla syncUI() for panels still tied to window.state
//
// Usage:
//   window.applyGameMutation(result, { reason: 'turn' });
//   window.applyGameMutation({ updates: { gold: 500 } }, { reason: 'admin' });
//
// Anything new — a new action, a websocket push, an admin override —
// just calls this. No more "did I remember to toast?" or "did I update
// window.gameState too?". One function. Audited. Tested.
window.applyGameMutation = function(result, opts = {}) {
  if (!result || typeof result !== 'object') return result;
  const reason = opts.reason || 'update';

  // 1 + 2: state
  if (result.updates && typeof result.updates === 'object') {
    Object.assign(window.gameState, result.updates);
    gameStateManager.applyUpdates(result.updates, reason);
  }

  // 3: events → side effects
  if (Array.isArray(result.events)) {
    for (const ev of result.events) {
      if (!ev || !ev.message) continue;
      try { window.toast?.(ev.message, ev.type || 'info'); } catch {}
      if (ev.message.includes('ACHIEVEMENT UNLOCKED')) {
        try { window.playAchievementSound?.(); } catch {}
      }
    }
  }

  // 4: legacy syncUI for non-React panels
  if (result.updates) {
    try { window.syncUI?.(); } catch (e) { console.error('[applyGameMutation] syncUI error:', e); }
  }

  return result;
};

// Initialize game state manager with current state.
// window.gameState is seeded from the vanilla state object via setGameStateObj.
export function initGameStateManager() {
  if (window.gameState && Object.keys(window.gameState).length > 0) {
    gameStateManager.applyUpdates({ ...window.gameState }, 'init');
  }
}

// Legacy vanilla applyServerUpdates(updates) now adapts to applyGameMutation.
// Guard against HMR re-wrapping.
if (!window._applyServerUpdatesWrapped) {
  const originalApplyServerUpdates = window.applyServerUpdates;
  window.applyServerUpdates = function(updates) {
    if (!updates) return;
    // Run the original vanilla function first (it updates window.state and
    // non-React DOM elements), then funnel through applyGameMutation.
    if (originalApplyServerUpdates) originalApplyServerUpdates(updates);
    window.applyGameMutation({ updates }, { reason: 'server_update' });
  };
  window._applyServerUpdatesWrapped = true;
}

// ─── PANEL REFRESH REGISTRY ───────────────────────────────────────────────
//
// Panels that need to FETCH data from the server (not just re-render from
// the store) register a handler with the reasons they care about. On every
// mutation, the ACTIVE panel's handler is called only if its reason set
// includes the mutation reason.
//
//   window.registerPanelHandler('market', {
//     reasons: ['turn', 'market'],
//     handler: async (reason, payload) => { await refreshMarket(); },
//   });
//
// Use '*' to listen to every reason (back-compat default).
//
// Panels that only need local store data should use useGameState() instead —
// they rerender automatically and never need to fetch.
const panelHandlers = new Map();
window.registerPanelHandler = (panelId, { reasons, handler } = {}) => {
  if (typeof handler !== 'function') return () => {};
  const reasonSet = new Set(reasons && reasons.length ? reasons : ['*']);
  panelHandlers.set(panelId, { reasons: reasonSet, handler });
  return () => panelHandlers.delete(panelId);
};

// Deprecated back-compat shim — registers a handler that fires on every reason.
// New panels should call registerPanelHandler with an explicit reasons list.
window.registerPanelReactHook = (panelId, callback) => {
  return window.registerPanelHandler(panelId, { reasons: ['*'], handler: callback });
};

if (!window._panelHandlersWired) {
  gameStateManager.subscribeMutation((reason, payload) => {
    const active = getActivePanelGlobal();
    const entry = panelHandlers.get(active);
    if (!entry) return;
    if (!entry.reasons.has('*') && !entry.reasons.has(reason)) return;
    try { entry.handler(reason, payload); }
    catch (e) { console.error(`[panel:${active}] handler error on ${reason}:`, e); }
  });
  window._panelHandlersWired = true;
}
// Snapshot-push escape hatch: vanilla code that mutated window.gameState
// directly (no server response) calls this to broadcast the snapshot.
window.triggerReactUpdates = () => {
  if (window.gameState && Object.keys(window.gameState).length > 0) {
    window.applyGameMutation({ updates: { ...window.gameState } }, { reason: 'react_sync' });
  } else {
    gameStateManager.emitMutation('react_sync', {});
  }
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
  tryMount("vue-panel-school-selection", SchoolSelectionPanelReact);
  tryMount("vue-metrics-strip-mount", MetricsStripReact);

  console.log("[react] All apps mounted");

  // Hook into switchTab to track active panel (guard against HMR re-wrapping)
  if (!window._switchTabWrapped) {
    const originalSwitchTab = window.switchTab;
    window.switchTab = function(tabName) {
      setActivePanelGlobal(tabName);
      if (originalSwitchTab) {
        originalSwitchTab(tabName);
      }
    };
    window._switchTabWrapped = true;
  }

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

window.takeTurn = async () => {
  try {
    const data = await apiCall("POST", "/api/kingdom/turn");
    if (data.error) {
      if (data.error.includes("No turns available")) {
        window.toast?.("No turns available — next +7 turns in 25 minutes", "warning");
      } else {
        window.toast?.("Turn processing failed — please try again", "error");
      }
      console.error("[turn] error:", data.error);
    } else if (data.ok) {
      console.log("[turn] processed successfully");

      // Single mutation entry point — handles updates, events, syncUI, window.gameState mirror
      window.applyGameMutation(data, { reason: 'turn' });

      // Vanilla panel refreshers that still own their own DOM
      try {
        window.syncFromState?.();
        window.updateBuildDisplay?.();
        window.updateTrainingDisplay?.();
        window.updateXpDisplay?.();
        window.updateTroopLevelDisplay?.();
        window.updateMageAllocationDisplay?.();
        window.refreshResourcesPanel?.();
        window.loadActiveExpeditions?.();
        window.loadNews?.();
      } catch (e) {
        console.error("[turn] Error refreshing legacy panels:", e);
      }

      window.toast?.(`Turn ${data.updates?.turn || '?'} processed`, "success");
    }
  } catch (error) {
    console.error("[turn] Error taking turn:", error);
    window.toast?.("Failed to take turn: " + error.message, "error");
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
