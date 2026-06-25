import React from 'react';
import { useGameState } from '../../hooks/useGameState';
import { useGameActions } from '../../hooks/useGameActions';
import { showLoginModal, logout } from './AuthModal.jsx';
import { REGEN_AMOUNT, useRegenCountdown } from '../../hooks/useRegenCountdown.js';

const Topbar = () => {
  const { state } = useGameState();
  const { takeTurn, loading } = useGameActions();
  const regenCountdown = useRegenCountdown();
  const turnsStored = state?.turns_stored ?? 400;
  const isLoggedIn = !!state?.username;

  return (
    <header className="fixed inset-x-0 top-0 z-topbar-mobile box-border flex w-full max-w-full shrink-0 items-center justify-between gap-2 border-b border-ember-900/40 bg-void-950/95 px-2.5 shadow-panel backdrop-blur-xl min-h-[calc(3.5rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] sm:min-h-[calc(3.5rem+env(safe-area-inset-top,0px))] sm:px-3 lg:relative lg:col-span-3 lg:row-start-1 lg:z-[1100] lg:min-h-14 lg:max-w-none lg:pt-0 md:px-4">
      <div className="min-w-0 flex-1">
        <div className="brand-flame text-sm sm:text-base">NARMIR REBORN</div>
        <div className="brand-tagline hidden sm:block" aria-label="Pure. Damn. Evil.">
          <span className="brand-tagline__word brand-tagline__word--pure">Pure.</span>
          <span className="brand-tagline__word brand-tagline__word--damn"> Damn.</span>
          <span className="brand-tagline__word brand-tagline__word--evil"> Evil.</span>
        </div>
      </div>

      <div className="flex min-w-0 shrink-0 items-center gap-1.5 rounded-2xl border border-ember-900/30 bg-void-900/70 px-2 py-1.5 shadow-panel sm:gap-2 sm:px-2.5 sm:py-2 md:gap-3 md:px-3">
        <div className="hidden text-right font-serif leading-none sm:block">
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-sm uppercase tracking-[0.5px] text-text3">Turns:</span>
            <span className="text-lg font-bold text-accent1 tabular-nums">
              {turnsStored}
            </span>
            <span className="text-sm text-text3">/ 400</span>
          </div>
          <div className="text-xs font-sans text-text3">
            +{REGEN_AMOUNT} in {regenCountdown}
          </div>
        </div>

        <span
          className="text-sm font-bold text-accent1 tabular-nums sm:hidden"
          title={`${turnsStored} turns stored`}
        >
          {turnsStored}
        </span>

        <button
          type="button"
          className="turn-btn px-2.5 py-1 text-xs sm:px-4 sm:py-1.5 sm:text-sm"
          onClick={takeTurn}
          disabled={loading.takeTurn || turnsStored < 1}
        >
          <span className="turn-btn__label">
            {loading.takeTurn ? '…' : (
              <>
                <span className="sm:hidden">Turn</span>
                <span className="hidden sm:inline">Take Turn</span>
              </>
            )}
          </span>
        </button>

        {isLoggedIn ? (
          <button
            type="button"
            className="shell-logout-btn"
            onClick={logout}
            aria-label="Logout"
          >
            <span aria-hidden="true">&#10005;</span>
            <span className="hidden min-[400px]:inline">Logout</span>
          </button>
        ) : (
          <button
            type="button"
            className="base-btn whitespace-nowrap px-2 py-1 text-xs sm:px-2.5 sm:py-1.5 sm:text-sm"
            onClick={showLoginModal}
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  );
};

export default Topbar;