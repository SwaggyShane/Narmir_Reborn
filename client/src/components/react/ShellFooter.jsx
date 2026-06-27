import React from 'react';
import clsx from 'clsx';
import { useCloudSync } from '../../hooks/useCloudSync.js';
import { useServerStatus } from '../../hooks/useServerStatus.js';
import { useEstClock } from '../../hooks/useEstClock.js';
import { useNightCycle } from '../../hooks/useNightCycle.js';
import { REGEN_AMOUNT, useRegenCountdown } from '../../hooks/useRegenCountdown.js';
import { useTurnsStored } from '../../stores';

const ShellFooter = () => {
  const synced = useCloudSync();
  const { uptime } = useServerStatus();
  const estClock = useEstClock();
  const { isNight, label: nightLabel } = useNightCycle();
  const regenCountdown = useRegenCountdown();
  const turnsStored = useTurnsStored() ?? 400;

  return (
    <footer
      className={[
        'flex h-8 shrink-0 items-center gap-2 border-t border-white/5',
        'bg-bg px-2 text-[11px] leading-none text-text2 sm:px-4',
        'lg:col-span-3 lg:col-start-1 lg:row-start-3',
      ].join(' ')}
    >
      <div className="flex min-w-0 flex-1 items-center justify-evenly gap-1 sm:gap-2">
        <div className="min-w-0 truncate text-center font-mono tabular-nums text-text3">
          {estClock}
        </div>

        <div
          className={clsx(
            'flex min-w-0 items-center justify-center gap-1 truncate font-mono tabular-nums',
            isNight ? 'text-ember-400' : 'text-text3',
          )}
          title={isNight ? 'Night, vampires at full strength' : 'Daylight, vampires weakened'}
        >
          <span aria-hidden="true">🦇</span>
          <span className="hidden truncate sm:inline">{nightLabel}</span>
          <span className="truncate sm:hidden">
            {nightLabel.replace(' to dawn', '').replace(' to nightfall', '')}
          </span>
        </div>

        <div className="flex min-w-0 items-center justify-center gap-1.5">
          <span
            className={clsx(
              'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
              synced
                ? 'bg-green shadow-[0_0_6px_rgba(16,185,129,0.8)]'
                : 'bg-red shadow-[0_0_6px_rgba(239,68,68,0.8)]',
            )}
            aria-hidden="true"
          />
          <span className="hidden truncate sm:inline">{synced ? 'SYSTEM CLOUD SYNCED' : 'SYNC OFFLINE'}</span>
          <span className="truncate sm:hidden">{synced ? 'SYNCED' : 'OFFLINE'}</span>
        </div>

        <div className="min-w-0 truncate text-center font-mono tabular-nums text-text3">
          <span className="hidden sm:inline">UPTIME: </span>
          {uptime}
        </div>
      </div>

      <div className="shrink-0 border-l border-white/5 pl-2 text-right font-serif leading-none sm:pl-3">
        <div className="flex items-center justify-end gap-1">
          <span className="text-[10px] uppercase tracking-[0.5px] text-text3">Turns:</span>
          <span className="text-sm font-bold text-accent1 tabular-nums">
            {turnsStored}
          </span>
          <span className="text-[10px] text-text3">/ 400</span>
        </div>
        <div className="text-[10px] font-sans text-text3">
          +{REGEN_AMOUNT} in {regenCountdown}
        </div>
      </div>
    </footer>
  );
};

export default ShellFooter;