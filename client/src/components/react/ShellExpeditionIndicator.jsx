import React from 'react';
import { useActiveExpeditionsSummary } from '../../hooks/useActiveExpeditionsSummary.js';
import { EXPEDITION_TYPE_LABELS } from '../../utils/panelMeta.js';
import { switchTab } from '../../utils/switchTab.js';

const ShellExpeditionIndicator = () => {
  const active = useActiveExpeditionsSummary();

  if (active.length === 0) return null;

  return (
    <div className="shell-expedition-indicator mx-2 mb-2 rounded-lg border border-white/5 bg-void-900/60 p-2">
      <div className="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-ember-400/80">
        Underway
      </div>
      <div className="flex flex-col gap-1.5">
        {active.slice(0, 3).map((exp) => {
          const type = exp.type || 'scout';
          const label = EXPEDITION_TYPE_LABELS[type] || type;
          const turnsLeft = Math.max(0, Number(exp.turns_left ?? 0));
          const targetTab = type === 'resource-harvest' ? 'nodes' : 'exploration';
          return (
            <button
              key={exp.id}
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-[11px] text-text2 transition hover:bg-white/5"
              onClick={() => switchTab(targetTab)}
              title={targetTab === 'nodes' ? 'Open Resources — Nodes' : 'Open Exploration'}
            >
              <span className="truncate font-semibold text-text">{label}</span>
              <span className="shrink-0 tabular-nums text-gold">
                {turnsLeft > 0 ? `${turnsLeft}t` : '…'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ShellExpeditionIndicator;