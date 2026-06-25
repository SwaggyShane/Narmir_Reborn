import React from 'react';
import clsx from 'clsx';
import { useGameState } from '../../hooks/useGameState';
import { useActivePanel } from '../../hooks/useActivePanel';
import { switchTab } from '../../utils/switchTab.js';
import { useNavLayout } from '../../hooks/useNavLayout.js';
import ShellColumnFrame from './ShellColumnFrame.jsx';

const SECTION_CLASS = 'px-3 pb-0.5 pt-3 text-[10px] font-black uppercase tracking-[0.3em] text-ember-400/80';

const NAV_BUTTON_CLASS = {
  base: 'relative flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs transition shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]',
  active: 'border-ember-500/50 bg-ember-500/10 text-text shadow-ember',
  idle: 'border-transparent bg-void-900/55 text-text3 hover:border-ember-500/30 hover:bg-void-800/85 hover:text-text',
};

function NavButton({ panel, icon, label, iconClass = 'text-text3' }) {
  const { activePanel } = useActivePanel();
  const active = activePanel === panel;

  return (
    <button
      type="button"
      onClick={() => switchTab(panel)}
      aria-current={active ? 'page' : undefined}
      className={clsx(NAV_BUTTON_CLASS.base, active ? NAV_BUTTON_CLASS.active : NAV_BUTTON_CLASS.idle)}
    >
      <span className={iconClass}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

const Sidebar = () => {
  const { state } = useGameState();
  const { layout } = useNavLayout();
  const isAdmin = !!state?.isAdmin;
  const showSidebar = layout === 'left' || layout === 'responsive';

  return (
    <ShellColumnFrame
      as="nav"
      className={clsx(
        'min-h-0 flex-col bg-bg',
        showSidebar ? 'flex' : 'hidden',
        layout === 'responsive' && 'max-lg:hidden',
        'lg:col-start-1 lg:row-start-2',
      )}
    >
      <div className="scrollbar-none relative z-10 min-h-0 flex-1 overflow-y-auto">
        <div className={SECTION_CLASS}>Kingdom</div>
        <NavButton panel="status" icon="🏰" label="Status" iconClass="text-blue" />
        <NavButton panel="happiness" icon="😊" label="Happiness" iconClass="text-amber" />
        <NavButton panel="studies" icon="🏛️" label="Studies" iconClass="text-red" />
        <NavButton panel="build" icon="🔨" label="Build" iconClass="text-amber" />
        <NavButton panel="exploration" icon="🧭" label="Exploration" iconClass="text-green" />

        <div className={SECTION_CLASS}>Wherewithal</div>
        <NavButton panel="economy" icon="💰" label="Economy" iconClass="text-amber" />
        <NavButton panel="market" icon="⚖️" label="Market" iconClass="text-gold" />
        <NavButton panel="resources" icon="🌲" label="Resources" iconClass="text-green" />

        <div className={SECTION_CLASS}>Warfare</div>
        <NavButton panel="rankings" icon="🏆" label="Rankings" iconClass="text-gold" />
        <NavButton panel="hire" icon="🤝" label="Hire" iconClass="text-green" />
        <NavButton panel="warfare" icon="⚔️" label="Offense" iconClass="text-red" />
        <NavButton panel="defense" icon="🛡️" label="Defense" iconClass="text-text3" />
        <NavButton panel="bounties" icon="🪙" label="Bounties" iconClass="text-gold" />
        <NavButton panel="training" icon="🎯" label="Training" iconClass="text-amber" />
        <NavButton panel="heroes" icon="👑" label="Heroes" iconClass="text-accent2" />
        <NavButton panel="worldmap" icon="🗺️" label="World Map" iconClass="text-blue" />
        <NavButton panel="alliances" icon="🤝" label="Alliance" iconClass="text-accent2" />

        <div className={SECTION_CLASS}>Social</div>
        <NavButton panel="messages" icon="✉️" label="Messages" iconClass="text-accent1" />
        <NavButton panel="forum" icon="📚" label="Forum" iconClass="text-accent2" />
        <NavButton panel="globalchat" icon="💬" label="Chat" iconClass="text-blue" />
        <NavButton panel="news" icon="📰" label="News" iconClass="text-text3" />

        <div className={SECTION_CLASS}>Information</div>
        <NavButton panel="goals" icon="📝" label="Goals" iconClass="text-amber" />
        <NavButton panel="races" icon="🦄" label="Races" iconClass="text-accent2" />
        <NavButton panel="changelog" icon="📋" label="Changelog" iconClass="text-green" />
        <NavButton panel="testing" icon="🧪" label="Testing" iconClass="text-accent2" />
        <NavButton panel="options" icon="⚙️" label="Settings" iconClass="text-text3" />

        {isAdmin && (
          <a
            href="/admin"
            target="_blank"
            rel="noopener noreferrer"
            className={clsx(NAV_BUTTON_CLASS.base, NAV_BUTTON_CLASS.idle, 'mx-1 mt-1 no-underline')}
          >
            <span className="text-amber">👑</span>
            <span>Admin</span>
          </a>
        )}
      </div>
    </ShellColumnFrame>
  );
};

export default Sidebar;