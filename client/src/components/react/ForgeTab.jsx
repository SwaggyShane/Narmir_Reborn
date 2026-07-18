/**
 * Forge tab shell — FORGE_SYSTEM.md §9 / §15.3 B2
 * Gated on forge flag. Four section scaffolds (Fuel / Steel / Barges / Crucible).
 * Section bodies filled in B3–B5.
 */
import React, { useState } from 'react';
import { useForgeFlags } from '../../stores';

const SECTIONS = [
  { id: 'fuel', label: 'Fuel', icon: '🔥' },
  { id: 'steel', label: 'Steel', icon: '⚙️' },
  { id: 'barges', label: 'Barges', icon: '🚤' },
  { id: 'crucible', label: 'Crucible', icon: '🌋' },
];

function SectionPlaceholder({ title, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-bg3/80 p-4 min-h-[120px]">
      <div className="text-[13px] font-semibold text-text mb-2">{title}</div>
      <div className="text-[12px] text-text3">{children}</div>
    </div>
  );
}

const ForgeTab = () => {
  const { forge } = useForgeFlags();
  const [section, setSection] = useState('fuel');

  if (!forge) {
    return null;
  }

  return (
    <div id="forge-tab" className="space-y-4" data-testid="forge-tab">
      <div className="card rounded-2xl border border-amber-500/25 bg-zinc-950/80">
        <div className="card-title mb-1">⚒️ Forge</div>
        <div className="text-[12px] text-text3 mb-3">
          Charcoal, steel, Flux-Barges, and crucible work. Unlock more as you progress.
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={
                'rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ' +
                (section === s.id
                  ? 'border-amber-400 bg-amber-500/15 text-amber-200'
                  : 'border-white/15 text-text3 hover:bg-white/5')
              }
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {section === 'fuel' && (
          <SectionPlaceholder title="🔥 Fuel — Charcoal pit">
            Wood allocation and coal stock will appear here (B3).
          </SectionPlaceholder>
        )}
        {section === 'steel' && (
          <SectionPlaceholder title="⚙️ Steel — Smelt & gear">
            Smelt batches and steel weapons/armor craft will appear here (B3).
          </SectionPlaceholder>
        )}
        {section === 'barges' && (
          <SectionPlaceholder title="🚤 Barges — Flux fleet">
            Hull bars and queue-extra-barge controls will appear here (B4).
          </SectionPlaceholder>
        )}
        {section === 'crucible' && (
          <SectionPlaceholder title="🌋 Crucible — Lava & temper">
            Lava stock, temper, tempered gear, and lava-draw launch will appear here (B5).
          </SectionPlaceholder>
        )}
      </div>
    </div>
  );
};

export default ForgeTab;
