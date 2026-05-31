import React from "react";
import { createRoot } from "react-dom/client";
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
import StudiesPanelReact from "./components/react/StudiesPanel.jsx";
import HeroesPanelReact from "./components/react/HeroesPanel.jsx";
import HirePanelReact from "./components/react/HirePanel.jsx";
import ResourcesPanelReact from "./components/react/ResourcesPanel.jsx";
import GlobalchatPanelReact from "./components/react/GlobalchatPanel.jsx";
import SchoolSelectionPanelReact from "./components/react/SchoolSelectionPanel.jsx";

console.log("[react] main.js execution started at", new Date().toISOString());

export const gameState = {};
window.gameState = gameState;

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
  tryMount("vue-panel-studies", StudiesPanelReact);
  tryMount("vue-panel-heroes", HeroesPanelReact);
  tryMount("vue-panel-hire", HirePanelReact);
  tryMount("vue-panel-resources", ResourcesPanelReact);
  tryMount("vue-panel-globalchat", GlobalchatPanelReact);
  tryMount("vue-panel-school-selection", SchoolSelectionPanelReact);

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
      } catch (e) {}
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

window.takeTurn = async () => {
  try {
    const getCsrfToken = () => {
      try {
        const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
        if (m) return decodeURIComponent(m[1]);
      } catch (e) {}
      return null;
    };

    const headers = { "Content-Type": "application/json" };
    const csrfToken = getCsrfToken();
    if (csrfToken) headers["x-csrf-token"] = csrfToken;

    const response = await fetch("/api/kingdom/turn", {
      method: "POST",
      headers,
    });

    const data = await response.json();
    if (data.error) {
      if (data.error.includes("No turns available")) {
        window.showToast?.("No turns available — next +7 turns in 25 minutes", "warning");
      } else {
        window.showToast?.("Turn processing failed — please try again", "error");
      }
      console.error("[turn] error:", data.error);
    } else if (data.ok) {
      console.log("[turn] processed successfully");
      if (data.updates) {
        Object.assign(window.gameState, data.updates);
        if (window.syncFromState) window.syncFromState();
        if (window.triggerReactUpdates) window.triggerReactUpdates();

        // Refresh display elements safely
        try {
          if (window.updateTurnsDisplay) window.updateTurnsDisplay();
          if (window.updateBuildDisplay) window.updateBuildDisplay();
          if (window.updateTrainingDisplay) window.updateTrainingDisplay();
          if (window.updateXpDisplay) window.updateXpDisplay();
          if (window.updateTroopLevelDisplay) window.updateTroopLevelDisplay();
          if (window.updateMageAllocationDisplay) window.updateMageAllocationDisplay();
          if (window.refreshResourcesPanel) window.refreshResourcesPanel();
        } catch (e) {
          console.error("[turn] Error refreshing display elements:", e);
        }
      }
      if (data.events) {
        const gameEvent = data.events.find(e => e.type !== "system");
        if (gameEvent) window.showToast?.(gameEvent.message, "info");
      }
      window.showToast?.(`Turn ${data.updates?.turn || '?'} processed`, "success");
    }
  } catch (error) {
    console.error("[turn] Error taking turn:", error);
    window.showToast?.("Failed to take turn: " + error.message, "error");
  }
};

// Wait for DOM to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountReactApps);
} else {
  mountReactApps();
}
