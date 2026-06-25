import React, { useMemo, useState } from 'react';
import { useActivePanel } from '../../hooks/useActivePanel';
import { useGameState } from '../../hooks/useGameState';
import { logout } from './AuthModal.jsx';
import { switchTab } from '../../utils/switchTab.js';
import { useNavLayout } from '../../hooks/useNavLayout.js';
import { useShellBadges } from '../../hooks/useShellBadges.js';

const CORE_TABS = [
  { id: 'status', label: 'Status', icon: '🏰', color: 'text-sky-300' },
  { id: 'economy', label: 'Economy', icon: '💰', color: 'text-amber-300' },
  { id: 'warfare', label: 'War', icon: '⚔️', color: 'text-red-300' },
  { id: 'news', label: 'News', icon: '🗞️', color: 'text-amber-200', badgeKey: 'news' },
  { id: 'globalchat', label: 'Chat', icon: '💬', color: 'text-fuchsia-300', badgeKey: 'chat' },
];

const DRAWER_TABS = [
  { id: 'messages', label: 'Messages', icon: '✉️', color: 'text-amber-200', badgeKey: 'messages' },
  { id: 'happiness', label: 'Happiness', icon: '😊', color: 'text-amber-300' },
  { id: 'studies', label: 'Studies', icon: '🏛️', color: 'text-red-300' },
  { id: 'build', label: 'Build', icon: '🛠️', color: 'text-orange-300' },
  { id: 'exploration', label: 'Explore', icon: '🧭', color: 'text-lime-300' },
  { id: 'market', label: 'Market', icon: '⚖️', color: 'text-yellow-300' },
  { id: 'resources', label: 'Resources', icon: '🌲', color: 'text-green-300' },
  { id: 'rankings', label: 'Ranks', icon: '🏆', color: 'text-yellow-300' },
  { id: 'hire', label: 'Hire', icon: '🤝', color: 'text-emerald-300' },
  { id: 'defense', label: 'Defense', icon: '🛡️', color: 'text-slate-300' },
  { id: 'bounties', label: 'Bounties', icon: '🪙', color: 'text-yellow-200' },
  { id: 'training', label: 'Training', icon: '🎯', color: 'text-amber-300' },
  { id: 'heroes', label: 'Heroes', icon: '👑', color: 'text-fuchsia-300' },
  { id: 'worldmap', label: 'Map', icon: '🌎', color: 'text-cyan-300' },
  { id: 'alliances', label: 'Alliance', icon: '🤝', color: 'text-purple-300' },
  { id: 'forum', label: 'Forum', icon: '📚', color: 'text-violet-300' },
  { id: 'goals', label: 'Goals', icon: '📝', color: 'text-amber-300' },
  { id: 'races', label: 'Races', icon: '🦄', color: 'text-fuchsia-300' },
  { id: 'changelog', label: 'Changelog', icon: '📋', color: 'text-emerald-300' },
  { id: 'testing', label: 'Testing', icon: '🧪', color: 'text-violet-300' },
  { id: 'options', label: 'Settings', icon: '⚙️', color: 'text-slate-300' },
];

function NavChip({ label, icon, color, active, onClick, showBadge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 py-1.5 text-[10px] font-semibold transition sm:min-h-[56px] sm:gap-1 sm:rounded-2xl sm:px-1 sm:py-2 sm:text-[11px]',
        'active:scale-95',
        active
          ? 'bottom-nav-chip is-active text-text'
          : 'bottom-nav-chip text-text3 hover:text-text',
      ].join(' ')}
    >
      <span className={`text-base leading-none sm:text-lg ${color || 'text-slate-200'}`}>{icon}</span>
      <span className="flex items-center gap-1 whitespace-nowrap max-[380px]:sr-only sm:not-sr-only">
        <span>{label}</span>
        {showBadge ? <span className="nav-badge static !relative !top-0 !right-0" aria-label="Unread" /> : null}
      </span>
    </button>
  );
}

function DrawerChip({ label, icon, color, active, onClick, showBadge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'flex min-h-[54px] items-center gap-3 rounded-2xl border px-3 py-3 text-left transition',
        'active:scale-[0.98]',
        active
          ? 'bottom-nav-chip is-active text-text'
          : 'bottom-nav-chip text-text2 hover:text-text',
      ].join(' ')}
    >
      <span className={`text-xl leading-none ${color || 'text-slate-200'}`}>{icon}</span>
      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold">{label}</span>
        {showBadge ? <span className="nav-badge static !relative !top-0 !right-0" aria-label="Unread" /> : null}
      </span>
    </button>
  );
}

const BottomNav = () => {
  const { state } = useGameState();
  const { activePanel } = useActivePanel();
  const { layout } = useNavLayout();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { hasBadge } = useShellBadges();
  const isAdmin = !!state?.isAdmin;
  const showBottomNav = layout === 'bottom' || layout === 'responsive';

  const drawerActive = useMemo(() => (
    drawerOpen || DRAWER_TABS.some((tab) => tab.id === activePanel)
  ), [drawerOpen, activePanel]);

  const handleSwitchTab = (id) => {
    setDrawerOpen(false);
    switchTab(id);
  };

  if (!showBottomNav) return null;

  return (
    <>
      <nav
        className={[
          'fixed inset-x-0 bottom-0 z-[3000] grid grid-cols-6 gap-1 border-t border-ember-900/40 bg-void-950/95 px-1.5 py-1.5 pb-[env(safe-area-inset-bottom)] shadow-panel backdrop-blur-xl sm:gap-2 sm:px-2 sm:py-2',
          layout === 'responsive' ? 'lg:hidden' : '',
        ].join(' ')}
      >
        {CORE_TABS.map((tab) => (
          <NavChip
            key={tab.id}
            label={tab.label}
            icon={tab.icon}
            color={tab.color}
            active={activePanel === tab.id}
            onClick={() => handleSwitchTab(tab.id)}
            showBadge={hasBadge(tab.badgeKey)}
          />
        ))}

        <button
          type="button"
          className={[
            'flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 py-1.5 text-[10px] font-semibold transition sm:min-h-[56px] sm:gap-1 sm:rounded-2xl sm:px-1 sm:py-2 sm:text-[11px]',
            'active:scale-95',
            drawerActive
              ? 'bottom-nav-chip is-active text-text'
              : 'bottom-nav-chip text-text3 hover:text-text',
          ].join(' ')}
          onClick={() => setDrawerOpen((open) => !open)}
          aria-expanded={drawerOpen}
          aria-controls="bottom-nav-drawer"
        >
          <span className="text-base leading-none text-amber-300 sm:text-lg">⋯</span>
          <span className="max-[380px]:sr-only sm:not-sr-only">More</span>
        </button>
      </nav>

      <div
          className={[
            'fixed inset-0 z-[3100] bg-black/55 backdrop-blur-[1px] transition-opacity duration-200',
          drawerOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        onClick={() => setDrawerOpen(false)}
        role="presentation"
      >
        <div
          id="bottom-nav-drawer"
          className={[
            'absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+72px)] mx-auto max-h-[65vh] max-w-5xl overflow-y-auto rounded-t-[28px] border border-ember-900/40 bg-void-950/98 p-3 shadow-panel transition-transform duration-200',
            drawerOpen ? 'translate-y-0' : 'translate-y-full',
          ].join(' ')}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="More navigation"
        >
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">More</div>
            <button
              type="button"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200 transition active:scale-95"
              onClick={() => setDrawerOpen(false)}
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {DRAWER_TABS.map((tab) => (
              <DrawerChip
                key={tab.id}
                label={tab.label}
                icon={tab.icon}
                color={tab.color}
                active={activePanel === tab.id}
                onClick={() => handleSwitchTab(tab.id)}
                showBadge={hasBadge(tab.badgeKey)}
              />
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/5 pt-3">
            {isAdmin ? (
              <a
                id="admin-bnav-link"
                href="/admin"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 text-sm font-semibold text-amber-100 transition active:scale-95"
              >
                👑 Admin
              </a>
            ) : null}
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 px-4 text-sm font-semibold text-red-100 transition active:scale-95"
              onClick={() => {
                setDrawerOpen(false);
                logout();
              }}
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default BottomNav;