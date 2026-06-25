import React from 'react';
import { useSessionUptime } from '../../hooks/useSessionUptime.js';

const ShellFooter = () => {
  const uptime = useSessionUptime();

  return (
    <footer
      className={[
        'flex h-8 shrink-0 items-center justify-between border-t border-white/5',
        'bg-bg px-4 text-[11px] leading-none text-text2',
        'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[calc(72px+env(safe-area-inset-bottom,0px))] max-lg:z-[2900]',
        'lg:col-span-2 lg:col-start-2 lg:row-start-3',
      ].join(' ')}
    >
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-green shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
        <span>SYSTEM CLOUD SYNCED</span>
      </div>
      <div className="font-mono tabular-nums text-text3">UPTIME: {uptime}</div>
    </footer>
  );
};

export default ShellFooter;