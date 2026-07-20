import React from 'react';
import { useGameActions } from '../../hooks/useGameActions';
import { useActivePanel } from '../../hooks/useActivePanel';
import { usePlayerName, useTurnsStored, useUsername } from '../../stores';
import { showLoginModal } from './AuthModal.jsx';

const Topbar = () => {
  const username = useUsername();
  const playerName = usePlayerName();
  const turnsStored = useTurnsStored() || 400;
  const { takeTurn, loading } = useGameActions();
  const { activePanel } = useActivePanel();
  const isLoggedIn = !!username;

  return (
    <header className="fixed inset-x-0 top-0 z-topbar-mobile box-border flex w-full max-w-full shrink-0 items-center justify-between gap-1.5 border-b border-ember-900/40 bg-void-950/95 px-2 shadow-panel backdrop-blur-xl min-h-[calc(3.5rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] sm:min-h-[calc(3.5rem+env(safe-area-inset-top,0px))] sm:gap-2 sm:px-3 lg:relative lg:col-span-3 lg:row-start-1 lg:z-[1100] lg:min-h-14 lg:max-w-none lg:pt-0 md:px-4">
      <div className="min-w-0 flex-1">
        <div className="brand-flame text-sm sm:text-base">NARMIR REBORN</div>
        <div className="brand-tagline hidden sm:block" aria-label="Pure. Damn. Evil.">
          <span className="brand-tagline__word brand-tagline__word--pure">Pure.</span>
          <span className="brand-tagline__word brand-tagline__word--damn"> Damn.</span>
          <span className="brand-tagline__word brand-tagline__word--evil"> Evil.</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {activePanel !== 'forum' ? (
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <span
              className="font-mono text-[11px] tabular-nums text-text3 sm:text-xs"
              title="Turns stored"
            >
              {turnsStored}<span className="text-text3/60">/400</span>
            </span>
            <button
              type="button"
              className="turn-btn px-2 py-1 text-[11px] sm:px-4 sm:py-1.5 sm:text-sm"
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
          </div>
        ) : null}

        {!isLoggedIn ? (
          <button
            type="button"
            className="base-btn whitespace-nowrap px-2 py-1 text-xs sm:px-2.5 sm:py-1.5 sm:text-sm"
            onClick={showLoginModal}
          >
            Sign In
          </button>
        ) : null}
      </div>
    </header>
  );
};

export default Topbar;