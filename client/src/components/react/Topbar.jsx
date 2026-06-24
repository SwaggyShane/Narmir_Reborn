import React from 'react';
import clsx from 'clsx';
import { useGameState } from '../../hooks/useGameState';
import { useGameActions } from '../../hooks/useGameActions';
import { showLoginModal, logout } from './AuthModal.jsx';
import { xpForLevel } from '../../utils/xp';
import { showHeroXpModal } from '../../utils/showHeroXpModal.js';
import { REGEN_AMOUNT, useRegenCountdown } from '../../hooks/useRegenCountdown.js';

const Topbar = () => {
  const { state } = useGameState();
  const { takeTurn, loading } = useGameActions();
  const regenCountdown = useRegenCountdown();
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

  const rank = state?.rank ?? state?.kingdom_rank ?? state?.position;

  return (
    <header className="fixed inset-x-0 top-0 z-topbar-mobile flex h-14 w-full shrink-0 items-center justify-between gap-2 border-b border-ember-900/40 bg-void-950/95 px-3 shadow-panel backdrop-blur-xl lg:relative lg:col-span-3 lg:row-start-1 lg:z-[1100] md:px-4">
      <div className="min-w-0">
        <div className="truncate font-serif text-base font-black uppercase tracking-[0.12em] text-ember-400 md:text-md">NARMIR REBORN</div>
        <div className="truncate text-sm text-text2">Pure. Damn. Evil.</div>
      </div>
      <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-ember-900/30 bg-void-900/70 px-2.5 py-2 shadow-panel md:gap-3 md:px-3">
        <div className="hidden shrink-0 md:block">
          <div className="font-cinzel text-base font-black text-text">
            {rank != null ? `#${rank}` : '—'}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-text3">Rank</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right font-serif leading-none">
            <div className="flex items-center gap-1.5">
              <span className="hidden text-sm uppercase tracking-[0.5px] text-text3 xs:inline">
                Turns:
              </span>
              <span className="text-lg font-bold text-gold">
                {turnsStored}
              </span>
              <span className="hidden text-sm text-text3 xs:inline">
                / 400
              </span>
            </div>
            <div className="text-xs font-sans text-text3">
              +{REGEN_AMOUNT} in {regenCountdown}
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
