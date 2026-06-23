import React from "react";
import { createRoot } from "react-dom/client";
import "./tailwind.css";
import "./tailwind-theme.css";
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
import { apiCall, switchTab, initGameStateManager, applyGameMutation } from "./utils/panelNav.js";
import { applyServerUpdates as applyServerUpdatesAction } from "./utils/gameMutations.js";
import { initSocketHandlers } from "./hooks/useSocket.js";
import AuthModalReact from "./components/react/AuthModal.jsx";
import KingdomProfileModalReact from "./components/react/KingdomProfileModal.jsx";
import { openKingdomProfile as openKingdomProfileImpl, closeKingdomProfile as closeKingdomProfileImpl } from "./components/react/KingdomProfileModal.jsx";
import { loadKingdom as loadKingdomImpl } from "./components/react/AuthModal.jsx";
import newsEmojiTools from "../../game/news-emoji.js";
import { appendNewsItems } from "./utils/newsShell.js";
import { openLoreModal as openLoreModalImpl, closeLoreModal as closeLoreModalImpl } from "./utils/loreShell.js";
import { closeXpModal as closeXpModalImpl } from "./utils/xpShell.js";
import { openSchoolModal as openSchoolModalImpl, closeSchoolModal as closeSchoolModalImpl } from "./utils/schoolShell.js";
import { openGenericModal as openGenericModalImpl, closeGenericModal as closeGenericModalImpl } from "./utils/genericShell.js";
import {
  openAttunementModal as openAttunementModalImpl,
  closeAttunementModal as closeAttunementModalImpl,
  loadAttunementData as loadAttunementDataImpl,
  showFragmentBuildingConfirm as showFragmentBuildingConfirmImpl,
  toggleFragmentDetailsPublic as toggleFragmentDetailsImpl,
  applyAttunement as applyAttunementImpl,
  removeAttunement as removeAttunementImpl,
} from "./utils/attunementShell.js";
import { showHeroLore as showHeroLoreImpl } from "./utils/showHeroLore.js";
import { closeRaceLore as closeRaceLoreImpl } from "./utils/closeRaceLore.js";
import { showToast } from "./utils/toastShell.js";
import { showHeroXpModal as showHeroXpModalImpl } from "./utils/showHeroXpModal.js";

window.apiCall = apiCall;
window.applyGameMutation = applyGameMutation;
window.applyServerUpdatesAction = applyServerUpdatesAction;
window.initSocketHandlers = initSocketHandlers;
window.__NEWS_EMOJI_TOOLS__ = newsEmojiTools;
window.__appendNewsItemsImpl = appendNewsItems;
window.__toastImpl = showToast;
window.__openKingdomProfileImpl = openKingdomProfileImpl;
window.__closeKingdomProfileImpl = closeKingdomProfileImpl;
window.__loadKingdomImpl = loadKingdomImpl;
window.__openLoreModalImpl = openLoreModalImpl;
window.__closeLoreModalImpl = closeLoreModalImpl;
window.__showHeroXpModalImpl = showHeroXpModalImpl;
window.__closeXpModalImpl = closeXpModalImpl;
window.__openSchoolModalImpl = openSchoolModalImpl;
window.__closeSchoolModalImpl = closeSchoolModalImpl;
window.__openGenericModalImpl = openGenericModalImpl;
window.__closeGenericModalImpl = closeGenericModalImpl;
window.__openAttunementModalImpl = openAttunementModalImpl;
window.__closeAttunementModalImpl = closeAttunementModalImpl;
window.__loadAttunementDataImpl = loadAttunementDataImpl;
window.__showFragmentBuildingConfirmImpl = showFragmentBuildingConfirmImpl;
window.__toggleFragmentDetailsImpl = toggleFragmentDetailsImpl;
window.__applyAttunementImpl = applyAttunementImpl;
window.__removeAttunementImpl = removeAttunementImpl;
window.__showHeroLoreImpl = showHeroLoreImpl;
window.__closeRaceLoreImpl = closeRaceLoreImpl;

const reactRoots = new Map();

export const mountReactApps = () => {
  if (window.__reactAppsMounted) {
    if (switchTab) {
      if (window.location.hash) {
        switchTab(window.location.hash.substring(1));
      } else {
        switchTab('status');
      }
    }
    return;
  }

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
  tryMount("login-overlay", AuthModalReact);
  tryMount("kingdom-profile-modal", KingdomProfileModalReact);

  window.__reactAppsMounted = true;
  console.log("[react] All apps mounted");

  if (window.location.hash) {
    switchTab(window.location.hash.substring(1));
  } else {
    switchTab('status');
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initGameStateManager();
    mountReactApps();
  });
} else {
  initGameStateManager();
  mountReactApps();
}
