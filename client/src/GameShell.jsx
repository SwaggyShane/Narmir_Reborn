import React, { useEffect } from 'react';
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
import ToastProvider from './components/react/ToastProvider.jsx';
import HeroXpModalController from './components/react/HeroXpModalController.jsx';
import KingdomXpModalController from './components/react/KingdomXpModalController.jsx';
import ShellFooter from './components/react/ShellFooter.jsx';
import ShellColumnFrame from './components/react/ShellColumnFrame.jsx';
import KingdomBodyHeader from './components/react/KingdomBodyHeader.jsx';
import LoreEntryController from './components/react/LoreEntryController.jsx';
import GenericModalController from './components/react/GenericModalController.jsx';
import SpyReportModalController from './components/react/SpyReportModalController.jsx';

const GameShell = () => {
  const { activePanel } = useActivePanel();

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
        return <div className="panel flex flex-1 items-center justify-center text-center text-text3">Forum lives in the Portal (separate entry point).</div>;
      default:
        return <div className="panel flex flex-1 items-center justify-center text-center text-text3">"{activePanel}" panel not wired yet.</div>;
    }
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-bg">
      <div
        className={[
          'h-full w-full',
          'max-lg:flex max-lg:min-h-0 max-lg:flex-col max-lg:pt-14',
          'lg:grid lg:min-h-0 lg:overflow-hidden',
          'lg:grid-cols-[250px_175px_minmax(0,1fr)]',
          'lg:grid-rows-[56px_minmax(0,1fr)_32px]',
          'lg:gap-x-0.5 lg:gap-y-0',
        ].join(' ')}
      >
        <Topbar />

        <Sidebar />

        <ShellColumnFrame
          as="aside"
          aria-label="Kingdom resources"
          className={[
            'flex min-h-0 w-full flex-col bg-bg',
            'max-lg:shrink-0 max-lg:px-3 max-lg:py-2',
            'lg:col-start-2 lg:row-start-2 lg:gap-2 lg:px-2 lg:py-2.5',
            '[&_.metrics]:mb-0 [&_.metrics]:flex [&_.metrics]:w-full [&_.metrics]:flex-wrap [&_.metrics]:gap-1',
            'lg:[&_.metrics]:flex-1 lg:[&_.metrics]:flex-col lg:[&_.metrics]:gap-1.5',
            'lg:[&_.metric]:w-full lg:[&_.metric]:min-h-[54px] lg:[&_.metric]:rounded-xl lg:[&_.metric]:px-2.5 lg:[&_.metric]:py-2',
            'lg:[&_.metric]:bg-void-950/90 lg:[&_.metric]:shadow-[0_10px_20px_rgba(0,0,0,0.22)]',
            'lg:[&_.metric_.val]:text-right lg:[&_.metric_.sub]:justify-end',
          ].join(' ')}
        >
          <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto">
            <div className="hidden px-1 text-[10px] font-black uppercase tracking-[0.28em] text-ember-400/85 lg:block">
              Resources
            </div>
            <div className="metrics">
              <ResourceStrip />
            </div>
          </div>
        </ShellColumnFrame>

        <ShellColumnFrame
          as="main"
          className={[
            'flex min-h-0 w-full min-w-0 flex-1 flex-col bg-bg',
            'max-lg:pb-[calc(104px+env(safe-area-inset-bottom,0px))]',
            'lg:col-start-3 lg:row-start-2',
          ].join(' ')}
        >
          <KingdomBodyHeader />
          <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            {renderPanel()}
          </div>
        </ShellColumnFrame>

        <ShellFooter />
      </div>

      <BottomNav />
      <AuthModal />
      <KingdomProfileModal />
      <SchoolSelectionController />
      <RaceLoreController />
      <ToastProvider />
      <HeroXpModalController />
      <KingdomXpModalController />
      <LoreEntryController />
      <GenericModalController />
      <SpyReportModalController />
    </div>
  );
};

export default GameShell;