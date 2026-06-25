import React from 'react';
import clsx from 'clsx';
import { logout } from './AuthModal.jsx';
import { useGameState } from '../../hooks/useGameState.js';
import { useCloudSync } from '../../hooks/useCloudSync.js';
import { useServerStatus } from '../../hooks/useServerStatus.js';
import { useEstClock } from '../../hooks/useEstClock.js';
import { useNightCycle } from '../../hooks/useNightCycle.js';
const ShellFooter = () => {
  const { state } = useGameState();
  const synced = useCloudSync();
  const { uptime } = useServerStatus();
  const estClock = useEstClock();
  const { isNight, label: nightLabel } = useNightCycle();
  const isLoggedIn = !!state?.username;

  return (
    <footer
      className={[
        'flex h-8 shrink-0 items-center justify-between gap-3 border-t border-white/5',
        'bg-bg px-4 text-[11px] leading-none text-text2',
        'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[calc(72px+env(safe-area-inset-bottom,0px))] max-lg:z-[2900]',
        'lg:col-span-3 lg:col-start-1 lg:row-start-3',
      ].join(' ')}
    >
      <div className="min-w-0 shrink-0">
        {isLoggedIn ? (
          <button
            type="button"
            onClick={logout}
            className="shell-logout-btn"
          >
            <span aria-hidden="true">&#10005;</span>
            <span>Logout</span>
          </button>
        ) : (
          <span className="text-text3">Guest</span>
        )}
      </div>

      <div className="flex min-w-0 items-center justify-end gap-3 sm:gap-4">
        <div className="hidden font-mono tabular-nums text-text3 xs:block">
          {estClock}
        </div>

        <div
          className={clsx(
            'hidden items-center gap-1 font-mono tabular-nums sm:flex',
            isNight ? 'text-ember-400' : 'text-text3',
          )}
          title={isNight ? 'Night, vampires at full strength' : 'Daylight, vampires weakened'}
        >
          <span aria-hidden="true">🦇</span>
          <span className="max-md:hidden">{nightLabel}</span>
          <span className="md:hidden">
            {nightLabel.replace(' to dawn', '').replace(' to nightfall', '')}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className={clsx(
              'inline-block h-1.5 w-1.5 rounded-full',
              synced
                ? 'bg-green shadow-[0_0_6px_rgba(16,185,129,0.8)]'
                : 'bg-red shadow-[0_0_6px_rgba(239,68,68,0.8)]',
            )}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">{synced ? 'SYSTEM CLOUD SYNCED' : 'SYNC OFFLINE'}</span>
          <span className="sm:hidden">{synced ? 'SYNCED' : 'OFFLINE'}</span>
        </div>

        <div className="font-mono tabular-nums text-text3">
          <span className="hidden sm:inline">UPTIME: </span>
          {uptime}
        </div>
      </div>
    </footer>
  );
};

export default ShellFooter;