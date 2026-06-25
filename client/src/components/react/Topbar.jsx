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

  const handleAccount = () => {
    if (state?.username) {
      logout();
      return;
    }
    showLoginModal();
  };

  return (
    <header className="fixed inset-x-0 top-0 z-topbar-mobile flex w-full shrink-0 items-center justify-between gap-2 border-b border-ember-900/40 bg-void-950/95 px-3 shadow-panel backdrop-blur-xl min-h-[calc(3rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] sm:min-h-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:relative lg:col-span-3 lg:row-start-1 lg:z-[1100] lg:min-h-14 lg:pt-0 md:px-4">
      <div className="min-w-0 flex-1">
        <div className="brand-flame text-sm sm:text-base">NARMIR REBORN</div>
        <div className="brand-tagline hidden sm:block" aria-label="Pure. Damn. Evil.">
          <span className="brand-tagline__word brand-tagline__word--pure">Pure.</span>
          <span className="brand-tagline__word brand-tagline__word--damn"> Damn.</span>
          <span className="brand-tagline__word brand-tagline__word--evil"> Evil.</span>
        </div>
      </div>
      <div className="hidden min-w-0 items-center gap-2 rounded-2xl border border-ember-900/30 bg-void-900/70 px-2.5 py-2 shadow-panel sm:flex md:gap-3 md:px-3">
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
            type="button"
            className="turn-btn"
            onClick={takeTurn}
            disabled={loading.takeTurn}
          >
            <span className="turn-btn__label">
              {loading.takeTurn ? 'Processing...' : 'Take Turn'}
            </span>
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