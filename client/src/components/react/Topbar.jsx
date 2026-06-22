import React from 'react';
import clsx from 'clsx';
import { useGameState } from '../../hooks/useGameState';
import { useGameActions } from '../../hooks/useGameActions';
import { showLoginModal, logout } from './AuthModal.jsx';
import { xpForLevel } from '../../utils/xp';
import { showHeroXpModal } from '../../utils/showHeroXpModal.js';

const Topbar = () => {
  const { state } = useGameState();
  const { takeTurn, loading } = useGameActions();
  const turnsStored = state?.turns_stored ?? 400;
  const level = state?.level ?? 1;
  const xp = state?.xp ?? 0;
  const prestige = state?.prestige_level ?? 0;
  const thisLvl = xpForLevel(level, prestige);
  const nextLvl = xpForLevel(level + 1, prestige);
  const xpInLevel = Math.max(0, Math.min(xp - thisLvl, nextLvl - thisLvl));
  const xpNeeded = Math.max(0, nextLvl - thisLvl);
  const xpPct = xpNeeded > 0 ? Math.min(100, Math.floor((xpInLevel / xpNeeded) * 100)) : 100;
  const openXpModal = () => showHeroXpModal();
  const handleAccount = () => {
    if (state?.username) {
      logout();
      return;
    }
    showLoginModal();
  };

  return (
    <header className="topbar flex h-14 items-center justify-between gap-2 border-b border-ember-900/40 bg-void-950/95 px-3 shadow-panel backdrop-blur-xl md:px-4">
      <div className="logo-container min-w-0">
        <div className="logo truncate font-serif text-base font-black uppercase tracking-[0.12em] text-ember-400 md:text-md">NARMIR REBORN</div>
        <div className="tagline truncate text-sm text-text2 md:text-sm">Pure. Damn. Evil.</div>
      </div>
      <div className="topbar-stats flex min-w-0 items-center gap-2 rounded-2xl border border-ember-900/30 bg-void-900/70 px-2.5 py-2 shadow-panel md:gap-3 md:px-3">
        <div className="tstat hide-sm hidden shrink-0 md:block">
          <div className="val text-text" id="top-rank">—</div>
          <div className="lbl text-text3">Rank</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right font-serif leading-none">
            <div className="flex items-center gap-1.5">
              <span className="hide-xs text-sm uppercase tracking-[0.5px] text-text3">
                Turns:
              </span>
              <span id="turns-stored-disp" className="text-lg font-bold text-gold">
                {turnsStored}
              </span>
              <span className="hide-xs text-sm text-text3">
                / 400
              </span>
            </div>
            <div className="countdown text-xs font-sans text-text3">
              +7 in <span id="regen-countdown">25:00</span>
            </div>
          </div>
          <button
            className={clsx('turn-btn shrink-0 px-3.5 py-1.5 text-sm leading-none transition-opacity', loading.takeTurn ? 'opacity-60' : 'opacity-100')}
            onClick={takeTurn}
            disabled={loading.takeTurn}
          >
            Take Turn
          </button>
          {!state?.username && (
            <button
              className="btn ml-2 whitespace-nowrap px-2.5 py-1.5 text-sm"
              onClick={handleAccount}
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
