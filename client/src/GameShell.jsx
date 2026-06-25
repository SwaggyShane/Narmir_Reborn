import React, { useEffect } from 'react';
import clsx from 'clsx';
import { useActivePanel } from './hooks/useActivePanel.js';

import Sidebar from './components/react/Sidebar.jsx';
import Topbar from './components/react/Topbar.jsx';
import ResourceStrip from './components/react/ResourceStrip.jsx';
import BottomNav from './components/react/BottomNav.jsx';

import StatusPanel from './components/react/StatusPanel.jsx';
import StudiesPanel from './components/react/StudiesPanel.jsx';
import EconomyPanel from './components/react/EconomyPanel.jsx';
import BuildPanel from './components/react/BuildPanel.jsx';
import WarfarePanel from './components/react/WarfarePanel.jsx';
import GlobalchatPanel from './components/react/GlobalchatPanel.jsx';
import ResourcesPanel from './components/react/ResourcesPanel.jsx';
import HappinessPanel from './components/react/HappinessPanel.jsx';
import HeroesPanel from './components/react/HeroesPanel.jsx';
import ExplorationPanel from './components/react/ExplorationPanel.jsx';
import MarketPanel from './components/react/MarketPanel.jsx';
import RankingsPanel from './components/react/RankingsPanel.jsx';
import WorldmapPanel from './components/react/WorldmapPanel.jsx';
import OptionsPanel from './components/react/OptionsPanel.jsx';
import BountiesPanel from './components/react/BountiesPanel.jsx';
import AlliancesPanel from './components/react/AlliancesPanel.jsx';
import MessagesPanel from './components/react/MessagesPanel.jsx';
import DefensePanel from './components/react/DefensePanel.jsx';
import HirePanel from './components/react/HirePanel.jsx';
import TrainingPanel from './components/react/TrainingPanel.jsx';
import NewsPanel from './components/react/NewsPanel.jsx';
import GoalsPanel from './components/react/GoalsPanel.jsx';
import RacesPanel from './components/react/RacesPanel.jsx';
import ChangelogPanel from './components/react/ChangelogPanel.jsx';
import TestingPanel from './components/react/TestingPanel.jsx';
import AuthModal, { restoreAuthSession } from './components/react/AuthModal.jsx';
import KingdomProfileModal from './components/react/KingdomProfileModal.jsx';
import SchoolSelectionController from './components/react/SchoolSelectionController.jsx';
import RaceLoreController from './components/react/RaceLoreController.jsx';
import HeroLoreController from './components/react/HeroLoreController.jsx';
import ToastProvider from './components/react/ToastProvider.jsx';
import PanelContextHeader from './components/react/PanelContextHeader.jsx';
import CommandPalette from './components/react/CommandPalette.jsx';
import MobileTurnFab from './components/react/MobileTurnFab.jsx';
import { useNightCycle } from './hooks/useNightCycle.js';
import HeroXpModalController from './components/react/HeroXpModalController.jsx';
import KingdomXpModalController from './components/react/KingdomXpModalController.jsx';
import ShellFooter from './components/react/ShellFooter.jsx';
import ShellColumnFrame from './components/react/ShellColumnFrame.jsx';
import KingdomBodyHeader from './components/react/KingdomBodyHeader.jsx';
import LoreEntryController from './components/react/LoreEntryController.jsx';
import GenericModalController from './components/react/GenericModalController.jsx';
import SpyReportModalController from './components/react/SpyReportModalController.jsx';
import EmptyState from './components/react/EmptyState.jsx';

const GameShell = () => {
  const { activePanel } = useActivePanel();
  const { isNight } = useNightCycle();
  const isChatPanel = activePanel === 'globalchat';

  useEffect(() => {
    restoreAuthSession().catch((err) => {
      console.warn('[auth] Session restore failed:', err);
    });
  }, []);

  const renderPanel = () => {
    switch (activePanel) {
      case 'status': return <StatusPanel />;
      case 'happiness': return <HappinessPanel />;
      case 'studies': return <StudiesPanel />;
      case 'build': return <BuildPanel />;
      case 'heroes': return <HeroesPanel />;
      case 'exploration': return <ExplorationPanel />;
      case 'economy': return <EconomyPanel />;
      case 'resources': return <ResourcesPanel />;
      case 'market': return <MarketPanel />;
      case 'warfare': return <WarfarePanel />;
      case 'defense': return <DefensePanel />;
      case 'hire': return <HirePanel />;
      case 'training': return <TrainingPanel />;
      case 'rankings': return <RankingsPanel />;
      case 'bounties': return <BountiesPanel />;
      case 'globalchat': return <GlobalchatPanel />;
      case 'alliances': return <AlliancesPanel />;
      case 'news': return <NewsPanel />;
      case 'goals': return <GoalsPanel />;
      case 'races': return <RacesPanel />;
      case 'changelog': return <ChangelogPanel />;
      case 'testing': return <TestingPanel />;
      case 'worldmap': return <WorldmapPanel />;
      case 'options': return <OptionsPanel />;
      case 'messages': return <MessagesPanel />;
      case 'forum':
        return (
          <div className="panel flex flex-1 items-center justify-center">
            <EmptyState
              icon="📚"
              title="Forum lives in the Portal"
              description="Board discussions open from the main portal entry point, not inside the game shell."
              actionLabel="Open Portal"
              onAction={() => { window.location.href = '/portal'; }}
            />
          </div>
        );
      default:
        return <div className="panel flex flex-1 items-center justify-center text-center text-text3">"{activePanel}" panel not wired yet.</div>;
    }
  };

  return (
    <div className="game-shell h-screen w-full max-w-[100vw] overflow-hidden bg-bg" data-night={isNight ? 'true' : 'false'}>
      <div
        className={clsx(
          'h-full w-full min-w-0 max-w-full overflow-x-hidden',
          'max-lg:flex max-lg:min-h-0 max-lg:flex-col max-lg:pt-[calc(3rem+env(safe-area-inset-top,0px))] sm:max-lg:pt-[calc(3.5rem+env(safe-area-inset-top,0px))]',
          'lg:grid lg:min-h-0 lg:overflow-hidden',
          'lg:grid-rows-[56px_minmax(0,1fr)_32px]',
          'lg:gap-x-0.5 lg:gap-y-0',
          isChatPanel
            ? 'lg:grid-cols-[200px_minmax(0,1fr)]'
            : 'lg:grid-cols-[200px_175px_minmax(0,1fr)]',
        )}
      >
        <Topbar />

        <Sidebar />

        {!isChatPanel ? (
          <ShellColumnFrame
            as="aside"
            aria-label="Kingdom resources"
            className={clsx(
              'flex min-h-0 w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-bg',
              'max-lg:shrink-0 max-lg:border-b max-lg:border-white/5 max-lg:px-3 max-lg:py-2',
              'lg:col-start-2 lg:row-start-2 lg:gap-2 lg:px-2 lg:py-2.5',
              '[&_.metrics]:flex [&_.metrics]:w-full',
              'max-lg:[&_.metrics]:mobile-metrics-scroll max-lg:[&_.metrics]:mb-0 max-lg:[&_.metrics]:w-full max-lg:[&_.metrics]:max-w-full max-lg:[&_.metrics]:min-w-0 max-lg:[&_.metrics]:gap-1.5 max-lg:[&_.resource-metrics]:flex-nowrap max-lg:[&_.resource-metrics]:overflow-x-auto max-lg:[&_.resource-metrics]:overscroll-x-contain max-lg:[&_.resource-metrics]:snap-x max-lg:[&_.resource-metrics]:pb-1 max-lg:[&_.metric]:min-w-[88px] max-lg:[&_.metric]:max-w-[120px] max-lg:[&_.metric]:snap-start max-lg:[&_.metric]:shrink-0',
              'lg:[&_.metric_.sub]:justify-end',
            )}
          >
            <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto">
              <div className="shell-nav-section hidden !px-2 !pt-0 lg:block">
                Resources
              </div>
              <div className="metrics resource-metrics">
                <ResourceStrip />
              </div>
            </div>
          </ShellColumnFrame>
        ) : null}

        <ShellColumnFrame
          as="main"
          className={clsx(
            'flex min-h-0 w-full min-w-0 flex-1 flex-col bg-bg',
            'max-lg:pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))]',
            'lg:row-start-2',
            isChatPanel ? 'lg:col-start-2' : 'lg:col-start-3',
            isChatPanel && 'overflow-hidden',
          )}
        >
          <KingdomBodyHeader />
          {!isChatPanel ? <PanelContextHeader /> : null}
          <div
            className={clsx(
              'relative z-10 min-h-0 flex-1',
              isChatPanel ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden',
            )}
          >
            <div
              key={activePanel}
              className={clsx('panel-enter', isChatPanel ? 'flex h-full min-h-0 flex-col overflow-hidden' : 'min-h-full')}
            >
              {renderPanel()}
            </div>
          </div>
        </ShellColumnFrame>

        <ShellFooter />
      </div>

      <BottomNav />
      <AuthModal />
      <KingdomProfileModal />
      <SchoolSelectionController />
      <RaceLoreController />
      <HeroLoreController />
      <ToastProvider />
      <CommandPalette />
      <MobileTurnFab />
      <HeroXpModalController />
      <KingdomXpModalController />
      <LoreEntryController />
      <GenericModalController />
      <SpyReportModalController />
    </div>
  );
};

export default GameShell;