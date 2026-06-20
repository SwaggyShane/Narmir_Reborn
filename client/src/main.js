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
import { openRaceLore as openRaceLoreAction } from "./actions/openRaceLore.js";
import { replayWarReport as replayWarReportAction } from "./actions/replayWarReport.js";
import { showHeroLore as showHeroLoreAction } from "./actions/showHeroLore.js";
import { openKingdomProfile as openKingdomProfileAction } from "./actions/openKingdomProfile.js";
import { loadKingdom as loadKingdomAction } from "./actions/loadKingdom.js";
import { loadEconomy as loadEconomyAction } from "./actions/loadEconomy.js";
import { buyUpgrade as buyUpgradeAction } from "./actions/buyUpgrade.js";
import {
  renderCommodityMarket as renderCommodityMarketAction,
  renderActiveMercs as renderActiveMercsAction,
} from "./actions/economyRenderers.js";
import { renderUpgrades as renderUpgradesAction } from "./actions/economyUpgrades.js";
import {
  populateTradeTargets as populateTradeTargetsAction,
  loadTradeOffers as loadTradeOffersAction,
  clearTradeLogs as clearTradeLogsAction,
  sendTradeOffer as sendTradeOfferAction,
  acceptTrade as acceptTradeAction,
  declineTrade as declineTradeAction,
} from "./actions/economyTrades.js";
import { loadWorldMap as loadWorldMapAction } from "./actions/loadWorldMap.js";
import { loadWarfarePanel as loadWarfarePanelAction } from "./actions/loadWarfarePanel.js";
import { applyServerUpdates as applyServerUpdatesAction } from "./utils/gameMutations.js";
import { bindGeneralSocketHandlers as bindGeneralSocketHandlersImpl } from "./utils/socketHandlers.js";
import {
  initLoginModal as initLoginModalImpl,
  showLoginModal as showLoginModalImpl,
  hideLoginModal as hideLoginModalImpl,
  showPasswordReset as showPasswordResetImpl,
  closeRegistrationModal as closeRegistrationModalImpl,
  backToRaceSelection as backToRaceSelectionImpl,
  updatePasswordRequirements as updatePasswordRequirementsImpl,
  clearToken as clearTokenImpl,
  doLogin as doLoginImpl,
  doRegister as doRegisterImpl,
} from "./actions/authModal.js";
import { openLoreModal as openLoreModalImpl, closeLoreModal as closeLoreModalImpl } from "./utils/loreModal.js";
import { closeKingdomProfile as closeKingdomProfileImpl } from "./utils/kingdomProfileModal.js";
import { applyNavLayout as applyNavLayoutImpl } from "./utils/applyNavLayout.js";
import { fmt as fmtImpl } from "./utils/fmt.js";
import { fmtShort as fmtShortImpl, trunc as truncImpl } from "./utils/numberFormat.js";
import { toast as toastImpl } from "./utils/toast.js";
import { apiCall, syncUI, switchTab, initGameStateManager, applyGameMutation, gameState } from "./utils/shellBridge.js";

window.apiCall = apiCall;
window.switchTab = switchTab;
window.applyGameMutation = applyGameMutation;
window.__openRaceLoreImpl = openRaceLoreAction;
window.__replayWarReportImpl = replayWarReportAction;
window.__showHeroLoreImpl = showHeroLoreAction;
window.__openKingdomProfileImpl = openKingdomProfileAction;
window.__loadKingdomImpl = loadKingdomAction;
window.__loadEconomyImpl = loadEconomyAction;
window.__buyUpgradeImpl = buyUpgradeAction;
window.__renderCommodityMarketImpl = renderCommodityMarketAction;
window.__renderActiveMercsImpl = renderActiveMercsAction;
window.__renderUpgradesImpl = renderUpgradesAction;
window.__populateTradeTargetsImpl = populateTradeTargetsAction;
window.__loadTradeOffersImpl = loadTradeOffersAction;
window.__clearTradeLogsImpl = clearTradeLogsAction;
window.__sendTradeOfferImpl = sendTradeOfferAction;
window.__acceptTradeImpl = acceptTradeAction;
window.__declineTradeImpl = declineTradeAction;
window.__loadWorldMapImpl = loadWorldMapAction;
window.__loadWarfarePanelImpl = loadWarfarePanelAction;
window.__applyServerUpdatesImpl = applyServerUpdatesAction;
window.__bindGeneralSocketHandlersImpl = bindGeneralSocketHandlersImpl;
window.__initLoginModalImpl = initLoginModalImpl;
window.__showLoginModalImpl = showLoginModalImpl;
window.__hideLoginModalImpl = hideLoginModalImpl;
window.__showPasswordResetImpl = showPasswordResetImpl;
window.__closeRegistrationModalImpl = closeRegistrationModalImpl;
window.__backToRaceSelectionImpl = backToRaceSelectionImpl;
window.__updatePasswordRequirementsImpl = updatePasswordRequirementsImpl;
window.__clearTokenImpl = clearTokenImpl;
window.__doLoginImpl = doLoginImpl;
window.__doRegisterImpl = doRegisterImpl;
window.__closeKingdomProfileImpl = closeKingdomProfileImpl;
window.__openLoreModalImpl = openLoreModalImpl;
window.__closeLoreModalImpl = closeLoreModalImpl;
window.__applyNavLayoutImpl = applyNavLayoutImpl;
window.__fmtImpl = fmtImpl;
window.__fmtShortImpl = fmtShortImpl;
window.__truncImpl = truncImpl;
window.__toastImpl = toastImpl;

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

  window.__reactAppsMounted = true;
  console.log("[react] All apps mounted");

  if (window.location.hash) {
    switchTab(window.location.hash.substring(1));
  } else {
    switchTab('status');
  }
};

const renderLibraryPanel = async () => {
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
