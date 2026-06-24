import React, { useEffect } from 'react';
import { gameStateManager } from './GameStateManager';
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
import DefensePanel from './components/react/DefensePanel.jsx';
import HirePanel from './components/react/HirePanel.jsx';
import TrainingPanel from './components/react/TrainingPanel.jsx';
import NewsPanel from './components/react/NewsPanel.jsx';
import GoalsPanel from './components/react/GoalsPanel.jsx';
import RacesPanel from './components/react/RacesPanel.jsx';
import ChangelogPanel from './components/react/ChangelogPanel.jsx';
import TestingPanel from './components/react/TestingPanel.jsx';
import AuthModal from './components/react/AuthModal.jsx';
import KingdomProfileModal from './components/react/KingdomProfileModal.jsx';
import SchoolSelectionController from './components/react/SchoolSelectionController.jsx';

const GameShell = () => {
  const { activePanel } = useActivePanel();

  useEffect(() => {
    const update = () => {};
    gameStateManager.addListener?.(update);
    return () => gameStateManager.removeListener?.(update);
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
      case 'messages':
        return <div className="panel flex flex-1 items-center justify-center text-center text-text3">Direct messages not yet implemented in React shell. Use Global Chat.</div>;
      case 'forum':
        return <div className="panel flex flex-1 items-center justify-center text-center text-text3">Forum lives in the Portal (separate entry point).</div>;
      default:
        return <div className="panel flex flex-1 items-center justify-center text-center text-text3">"{activePanel}" panel not wired yet.</div>;
    }
  };

  return (
    <>
    <div
      className={[
        'flex h-full min-h-0 w-full flex-col bg-bg pt-14',
        'lg:grid lg:h-full lg:overflow-hidden lg:p-0',
        'lg:grid-cols-[220px_175px_minmax(0,1fr)]',
        'lg:grid-rows-[56px_minmax(0,1fr)_32px]',
        "lg:[grid-template-areas:'top_top_top'_'side_resources_main'_'side_footer_footer']",
      ].join(' ')}
    >
      <Topbar />

      <Sidebar />

      <aside
        aria-label="Kingdom resources"
        className={[
          'shrink-0 border-b border-white/5 bg-bg px-3 py-2 shadow-[0_4px_12px_rgba(0,0,0,0.3)]',
          'lg:flex lg:min-h-0 lg:flex-col lg:gap-2 lg:overflow-x-hidden lg:overflow-y-auto',
          'lg:border-b-0 lg:border-r lg:border-white/5 lg:bg-void-900/80 lg:px-2 lg:py-2.5',
          'lg:[grid-area:resources]',
          '[&_.metrics]:mb-0 [&_.metrics]:flex [&_.metrics]:w-full [&_.metrics]:flex-wrap [&_.metrics]:gap-1',
          'lg:[&_.metrics]:flex-1 lg:[&_.metrics]:flex-col lg:[&_.metrics]:gap-1.5',
          'lg:[&_.metric]:w-full lg:[&_.metric]:min-h-[54px] lg:[&_.metric]:rounded-xl lg:[&_.metric]:px-2.5 lg:[&_.metric]:py-2',
          'lg:[&_.metric]:bg-void-950/90 lg:[&_.metric]:shadow-[0_10px_20px_rgba(0,0,0,0.22)]',
          'lg:[&_.metric_.val]:text-right lg:[&_.metric_.sub]:justify-end',
        ].join(' ')}
      >
        <div className="hidden px-1 text-[10px] font-black uppercase tracking-[0.28em] text-ember-400/85 lg:block">
          Resources
        </div>
        <div className="metrics">
          <ResourceStrip />
        </div>
      </aside>

      <div
        className={[
          'relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg',
          'pb-[calc(72px+env(safe-area-inset-bottom,0px))]',
          'lg:min-w-0 lg:pb-0 lg:[grid-area:main]',
        ].join(' ')}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {renderPanel()}
        </div>
      </div>

      <footer
        className={[
          'hidden h-8 shrink-0 items-center justify-between border-t border-white/5',
          'bg-black/90 px-4 text-[11px] leading-none text-text2',
          'lg:flex lg:min-w-0 lg:[grid-area:footer]',
        ].join(' ')}
      >
        <div>● SYSTEM CLOUD SYNCED</div>
        <div>UPTIME: 00h 00m 00s</div>
      </footer>

      <BottomNav />
    </div>

    <AuthModal />
    <KingdomProfileModal />
    <SchoolSelectionController />
    </>
  );
};

export default GameShell;