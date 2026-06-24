import React from 'react';
import clsx from 'clsx';
import { useGameState } from '../../hooks/useGameState';
import { useGameActions } from '../../hooks/useGameActions';
import { showLoginModal, logout } from './AuthModal.jsx';
import { kingdomXpProgress } from '../../utils/xp';
import { showKingdomXpModal } from '../../utils/showKingdomXpModal.js';
import { REGEN_AMOUNT, useRegenCountdown } from '../../hooks/useRegenCountdown.js';
import { fmtShort } from '../../utils/numberFormat.js';

const Topbar = () => {
  const { state } = useGameState();
  const { takeTurn, loading } = useGameActions();
  const regenCountdown = useRegenCountdown();
  const turnsStored = state?.turns_stored ?? 400;
  const level = state?.level ?? 1;
  const xp = state?.xp ?? 0;
  const prestige = state?.prestige_level ?? 0;
  const { xpNeeded, xpIntoLevel, pct } = kingdomXpProgress(level, xp, prestige);
  const openXpModal = () => showKingdomXpModal();

  const handleAccount = () => {
    if (state?.username) {
      logout();
      return;
    }
    showLoginModal();
  };

  const rank = state?.rank ?? state?.kingdom_rank ?? state?.position;
  const isLoggedIn = !!state?.username;
  const kingdomName = state?.name || state?.kingdomName || 'Your Kingdom';
  const playerName = state?.username || state?.owner_name || state?.owner || '';

  return (
    <header className="fixed inset-x-0 top-0 z-topbar-mobile flex min-h-14 w-full shrink-0 items-center justify-between gap-2 border-b border-ember-900/40 bg-void-950/95 px-3 py-2 shadow-panel backdrop-blur-xl lg:relative lg:col-span-3 lg:row-start-1 lg:z-[1100] md:px-4">
      <div className="min-w-0 flex-1">
        {isLoggedIn ? (
          <>
            <div
              className="truncate font-cinzel text-sm font-black uppercase tracking-wide text-gold md:text-base"
              style={{ textShadow: '0 0 12px rgba(240,98,2,0.35)' }}
            >
              {kingdomName}
            </div>
            <div className="truncate text-[11px] text-text2">
              {playerName}
              {rank != null ? <span className="text-text3"> | Rank #{rank}</span> : null}
            </div>
          </>
        ) : (
          <>
            <div className="truncate font-serif text-base font-black uppercase tracking-[0.12em] text-ember-400 md:text-md">
              NARMIR REBORN
            </div>
            <div className="truncate text-sm text-text2">Pure. Damn. Evil.</div>
          </>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-ember-900/30 bg-void-900/70 px-2.5 py-2 shadow-panel md:gap-3 md:px-3">
        {isLoggedIn && (
          <button
            type="button"
            onClick={openXpModal}
            title="Click for XP breakdown"
            className="group hidden min-w-[120px] max-w-[180px] shrink-0 flex-col gap-1 border-r border-white/5 pr-2.5 text-left transition hover:opacity-90 sm:flex"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-text3">
                Level <span className="text-gold underline decoration-dotted decoration-gold/50 underline-offset-2">{level}</span>
              </span>
              <span className="text-[9px] tabular-nums text-text3">
                {fmtShort(xpIntoLevel)}/{fmtShort(xpNeeded)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-bg4">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent1 to-gold transition-all duration-500 group-hover:shadow-[0_0_8px_rgba(240,98,2,0.45)]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </button>
        )}

        {isLoggedIn && (
          <button
            type="button"
            onClick={openXpModal}
            title="Click for XP breakdown"
            className="flex shrink-0 flex-col items-center gap-0.5 border-r border-white/5 pr-2 sm:hidden"
          >
            <span className="text-[10px] font-bold text-gold">Lv {level}</span>
            <div className="h-1 w-14 overflow-hidden rounded-full bg-bg4">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent1 to-gold"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[8px] tabular-nums text-text3">{fmtShort(xpIntoLevel)}/{fmtShort(xpNeeded)}</span>
          </button>
        )}

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
          {!isLoggedIn && (
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