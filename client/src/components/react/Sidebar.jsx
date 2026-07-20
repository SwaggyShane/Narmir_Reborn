import React, { useCallback, useRef, useState } from 'react';
import clsx from 'clsx';
import { useActivePanel } from '../../hooks/useActivePanel';
import { usePlayerName, useIsAdmin, useUsername } from '../../stores';
import { logout } from './AuthModal.jsx';
import { switchTab } from '../../utils/switchTab.js';
import { useNavLayout } from '../../hooks/useNavLayout.js';
import { useShellBadges } from '../../hooks/useShellBadges.js';
import { NAV_SECTIONS, PANEL_META } from '../../utils/panelMeta.js';
import ShellColumnFrame from './ShellColumnFrame.jsx';
import ShellExpeditionIndicator from './ShellExpeditionIndicator.jsx';
import { showBugReportModal } from './BugReportModal.jsx';

const COLLAPSE_STORAGE_KEY = 'shell-nav-collapsed-v1';

const PANEL_ICON_CLASS = {
  status: 'text-blue',
  happiness: 'text-amber',
  studies: 'text-red',
  build: 'text-amber',
  exploration: 'text-green',
  economy: 'text-amber',
  market: 'text-gold',
  resources: 'text-green',
  rankings: 'text-gold',
  hire: 'text-green',
  warfare: 'text-red',
  defense: 'text-text3',
  bounties: 'text-gold',
  training: 'text-amber',
  heroes: 'text-accent2',
  worldmap: 'text-blue',
  alliances: 'text-accent2',
  messages: 'text-accent1',
  forum: 'text-accent2',
  globalchat: 'text-blue',
  news: 'text-text3',
  goals: 'text-amber',
  races: 'text-accent2',
  changelog: 'text-green',
  testing: 'text-accent2',
  options: 'text-text3',
};

function readCollapsedSections() {
  try {
    const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function NavButton({ panel, icon, label, iconClass = 'text-text3', showBadge, buttonRef, onFocusNeighbor }) {
  const { activePanel } = useActivePanel();
  const active = activePanel === panel;

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => switchTab(panel)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          onFocusNeighbor?.(1);
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          onFocusNeighbor?.(-1);
        }
      }}
      aria-current={active ? 'page' : undefined}
      className={clsx('shell-nav-btn', active && 'is-active')}
    >
      <span className="shell-nav-btn__content">
        <span className={clsx('shell-nav-btn__icon text-[16.5px] leading-none', iconClass)}>{icon}</span>
        <span className="shell-nav-btn__label">{label}</span>
        {showBadge ? <span className="nav-badge" aria-label="Unread" /> : null}
      </span>
    </button>
  );
}

const Sidebar = () => {
  const username = useUsername();
  const playerName = usePlayerName();
  const isAdmin = useIsAdmin();
  const { layout } = useNavLayout();
  const { hasBadge } = useShellBadges();
  const isLoggedIn = !!username;
  const showSidebar = layout === 'left' || layout === 'responsive';
  const [collapsed, setCollapsed] = useState(readCollapsedSections);
  const buttonRefs = useRef([]);

  const toggleSection = useCallback((sectionId) => {
    setCollapsed((prev) => {
      const next = { ...prev, [sectionId]: !prev[sectionId] };
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const flatPanels = NAV_SECTIONS.flatMap((section) => section.panels);
  const focusPanelAt = useCallback((flatIndex, delta) => {
    const activeButtons = buttonRefs.current.filter(Boolean);
    const currentBtn = buttonRefs.current[flatIndex];
    const currentIdx = activeButtons.indexOf(currentBtn);
    if (currentIdx !== -1) {
      const nextIdx = Math.min(Math.max(currentIdx + delta, 0), activeButtons.length - 1);
      activeButtons[nextIdx]?.focus();
    }
  }, []);

  if (!showSidebar) return null;

  let flatIndex = -1;

  return (
    <ShellColumnFrame
      as="nav"
      aria-label="Game navigation"
      className={clsx(
        'min-h-0 flex-col bg-bg',
        'flex',
        layout === 'responsive' && 'max-lg:hidden',
        'lg:col-start-1 lg:row-start-2',
      )}
    >
      <div className="scrollbar-none relative z-10 min-h-0 flex-1 overflow-y-auto">
        <button
          type="button"
          onClick={showBugReportModal}
          className="shell-nav-btn mx-1 mt-1"
          title="Report a bug"
        >
          <span className="shell-nav-btn__content">
            <span className="shell-nav-btn__icon text-[16.5px] leading-none" aria-hidden="true">🐛</span>
            <span className="shell-nav-btn__label">Bug Report</span>
          </span>
        </button>
        <ShellExpeditionIndicator />
        {NAV_SECTIONS.map((section) => {
          const isCollapsed = !!collapsed[section.id];
          return (
            <div key={section.id}>
              <button
                type="button"
                className="shell-nav-section flex w-full items-center justify-between"
                onClick={() => toggleSection(section.id)}
                aria-expanded={!isCollapsed}
              >
                <span>{section.label}</span>
                <span className="text-[10px] text-text3" aria-hidden="true">{isCollapsed ? '▶' : '▼'}</span>
              </button>
              {!isCollapsed && section.panels.map((panelId) => {
                flatIndex += 1;
                const idx = flatIndex;
                const meta = PANEL_META[panelId];
                if (!meta) return null;
                return (
                  <NavButton
                    key={panelId}
                    panel={panelId}
                    icon={meta.icon}
                    label={meta.label}
                    iconClass={PANEL_ICON_CLASS[panelId] || 'text-text3'}
                    showBadge={hasBadge(meta.badgeKey)}
                    buttonRef={(el) => { buttonRefs.current[idx] = el; }}
                    onFocusNeighbor={(delta) => focusPanelAt(idx, delta)}
                  />
                );
              })}
            </div>
          );
        })}

        {isAdmin && (
          <a
            href="/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="shell-nav-btn mx-1 mt-1 no-underline"
          >
            <span className="shell-nav-btn__content">
              <span className="shell-nav-btn__icon text-[16.5px] text-amber">👑</span>
              <span className="shell-nav-btn__label">Admin</span>
            </span>
          </a>
        )}
      </div>

      {isLoggedIn ? (
        <div className="relative z-10 shrink-0 border-t border-white/5 p-2">
          <button
            type="button"
            onClick={logout}
            className="shell-logout-btn w-full"
            aria-label="Logout"
          >
            <span aria-hidden="true">&#10005;</span>
            <span>Logout</span>
          </button>
        </div>
      ) : null}
    </ShellColumnFrame>
  );
};

export default Sidebar;