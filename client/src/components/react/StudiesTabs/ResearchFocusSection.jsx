import React, { useCallback } from 'react';
import clsx from 'clsx';
import { useResearchStore } from '../../../stores';
import { toast } from '../../../utils/toast.js';

const DISC_COLS = {
  economy: "res_economy",
  weapons: "res_weapons",
  armor: "res_armor",
  military: "res_military",
  attack_magic: "res_attack_magic",
  defense_magic: "res_defense_magic",
  entertainment: "res_entertainment",
  construction: "res_construction",
  war_machines: "res_war_machines",
  spellbook: "res_spellbook",
};

const STUDIES_RESEARCH_ROWS = [
  { label: 'Economy', stateKey: 'res_economy', barClass: 'eco' },
  { label: 'Weapons', stateKey: 'res_weapons', barClass: 'wep' },
  { label: 'Armor', stateKey: 'res_armor', barClass: 'arm' },
  { label: 'Military', stateKey: 'res_military', barClass: 'mil' },
  { label: 'Attack magic', stateKey: 'res_attack_magic', barClass: 'bg-red' },
  { label: 'Defense magic', stateKey: 'res_defense_magic', barClass: 'arm' },
  { label: 'Entertainment', stateKey: 'res_entertainment', barClass: 'bg-green' },
  { label: 'Construction', stateKey: 'res_construction', barClass: 'bg-amber' },
  { label: 'War machines', stateKey: 'res_war_machines', barClass: 'mil' },
  { label: 'Spellbook', stateKey: 'res_spellbook', barClass: 'spell' },
];

export const ResearchFocusSection = ({
  studiesData,
  state,
  focus1Value,
  setFocus1Value,
  focus2Value,
  setFocus2Value,
  fetchStudiesData,
}) => {
  const researchBarWidth = (value) => {
    const n = Number(value) || 0;
    return `${Math.min(100, Math.max(0, n / 10))}%`;
  };

  const saveResearchFocus = useCallback(async () => {
    const hasRepo = !!(studiesData?.school_upgrades || {}).repository;
    const focus = hasRepo && focus2Value ? [focus1Value, focus2Value] : [focus1Value];

    const result = await fetch('/api/kingdom/research-focus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ focus }),
    });
    if (!result.ok) {
      toast('Failed to save research focus', 'error');
      return;
    }
    const data = await result.json();
    if (data.error) {
      toast(data.error, 'error');
      return;
    }
    if (data.research_focus) {
      useResearchStore.getState().setResearchFocus(data.research_focus);
      toast(`Research focus saved — ${data.research_focus.join(' & ')}`, 'success');
    }
  }, [studiesData?.school_upgrades, focus1Value, focus2Value]);

  return (
    <div className="card">
      <div className="card-title !mb-0.5">Researcher Focus</div>
      <div className="text-xs text-[var(--text3)] mb-3">
        Researchers study the general spellbook. Once you reach level 100, you can choose a school of magic.
      </div>
      <div className="mb-3">
        <div className="text-xs font-semibold text-[var(--text2)] mb-1.5">Primary discipline</div>
        <select
          className="input w-full mb-1.5"
          value={focus1Value}
          onChange={(e) => setFocus1Value(e.target.value)}
        >
          <option value="economy">Economy</option>
          <option value="weapons">Weapons</option>
          <option value="armor">Armor</option>
          <option value="military">Military tactics</option>
          <option value="attack_magic">Attack magic</option>
          <option value="defense_magic">Defense magic</option>
          <option value="entertainment">Entertainment</option>
          <option value="construction">Construction</option>
          <option value="war_machines">War machines</option>
          {!state?.school_of_magic && <option value="spellbook">Spellbook</option>}
        </select>
        <div className="text-2xs text-[var(--text3)]">Focus 1 Current: {state?.[DISC_COLS[focus1Value]] || 0}%</div>
      </div>
      {(studiesData?.school_upgrades || {}).repository && (
        <div className="mb-3">
          <div className="text-xs font-semibold text-[var(--text2)] mb-1.5">
            Secondary discipline <span className="text-[var(--gold)] text-2xs">Repository</span>
          </div>
          <select
            className="input w-full mb-1.5"
            value={focus2Value}
            onChange={(e) => setFocus2Value(e.target.value)}
          >
            <option value="economy">Economy</option>
            <option value="weapons">Weapons</option>
            <option value="armor">Armor</option>
            <option value="military">Military tactics</option>
            <option value="attack_magic">Attack magic</option>
            <option value="defense_magic">Defense magic</option>
            <option value="entertainment">Entertainment</option>
            <option value="construction">Construction</option>
            <option value="war_machines">War machines</option>
            {!state?.school_of_magic && <option value="spellbook">Spellbook</option>}
          </select>
          <div className="text-2xs text-[var(--text3)]">Focus 2 Current: {state?.[DISC_COLS[focus2Value]] || 0}%</div>
        </div>
      )}
      <button className="base-btn variant-green w-full" onClick={saveResearchFocus} style={{ background: 'var(--green)' }}>
        Save focus
      </button>
      <div className="mt-4 border-t border-[var(--border)] pt-4">
        <div className="card-title !mb-0.5">Research levels</div>
        {STUDIES_RESEARCH_ROWS.map((row, index) => {
          const rawValue = state?.[row.stateKey];
          return (
            <div
              key={row.stateKey}
              className={clsx('trow', index === STUDIES_RESEARCH_ROWS.length - 1 && 'border-b-0')}
            >
              <span className="name">{row.label}</span>
              <div className="prog-wrap">
                <div
                  className={clsx('prog-bar', row.barClass)}
                  style={{ width: researchBarWidth(rawValue) }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {state?.res_spellbook >= 100 && !state?.school_of_magic && (
        <div className="mt-4 p-3 bg-[var(--bg3)] rounded border border-[var(--gold)] text-[var(--gold)] text-xs text-center">
          ✨ <strong>School selection available!</strong> You can now choose a school of magic. Visit the school selection panel.
        </div>
      )}
    </div>
  );
};
