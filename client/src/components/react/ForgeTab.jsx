/**
 * Forge tab
 * Gated on forge flag. Fuel / Steel / Barges / Crucible.
 */
import React, { useState } from 'react';
import { useForgeFlags } from '../../stores';
import ForgeFuelSection from './ForgeFuelSection.jsx';
import ForgeSteelSection from './ForgeSteelSection.jsx';
import ForgeBargesSection from './ForgeBargesSection.jsx';
import ForgeCrucibleSection from './ForgeCrucibleSection.jsx';

const SECTIONS = [
  { id: 'fuel', label: 'Fuel', icon: '🔥' },
  { id: 'steel', label: 'Steel', icon: '⚙️' },
  { id: 'barges', label: 'Barges', icon: '🚤' },
  { id: 'crucible', label: 'Crucible', icon: '🌋' },
];

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

        {section === 'fuel' && <ForgeFuelSection />}
        {section === 'steel' && <ForgeSteelSection />}
        {section === 'barges' && <ForgeBargesSection />}
        {section === 'crucible' && <ForgeCrucibleSection />}
      </div>
    </div>
  );
};

export default ForgeTab;
