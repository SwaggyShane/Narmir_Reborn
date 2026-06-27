import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiCall } from '../../utils/api';
import { fmt } from "../../utils/fmt";
import { applyGameMutation } from '../../utils/gameMutations.js';

const UNIT_ROWS = [
  {
    key: 'fighters',
    icon: '⚔️',
    label: 'Fighters',
    desc: 'Combat · defense',
    price: 250,
  },
  {
    key: 'rangers',
    icon: '🏹',
    label: 'Rangers',
    desc: 'Scout · ranged · explore',
    price: 250,
  },
  {
    key: 'clerics',
    icon: '💚',
    label: 'Clerics',
    desc: 'Heal · happiness aura · shrine',
    price: 250,
    hideWhenRace: 'vampire',
  },
  {
    key: 'mages',
    icon: '✨',
    label: 'Mages',
    desc: 'Spells · tower · library',
    price: 250,
  },
  {
    key: 'thieves',
    icon: '🗝️',
    label: 'Thieves',
    desc: 'Covert ops · loot · spy',
    price: 250,
  },
  {
    key: 'ninjas',
    icon: '🥷',
    label: 'Ninjas',
    desc: 'Assassinate · sabotage',
    price: 250,
  },
  {
    key: 'researchers',
    icon: '📚',
    label: 'Researchers',
    desc: 'Advance disciplines · school',
    price: 250,
  },
  {
    key: 'scribes',
    icon: '📜',
    label: 'Scribes',
    desc: 'Maps · blueprints · library',
    price: 250,
  },
  {
    key: 'engineers',
    icon: '⚙️',
    label: 'Engineers',
    desc: 'Build · war machines · smithy',
    price: 250,
  },
];

const initialQuantities = UNIT_ROWS.reduce((acc, row) => {
  acc[row.key] = '';
  return acc;
}, {});

const HirePanel = () => {
  const [quantities, setQuantities] = useState(initialQuantities);

  const isVampire = state?.race === 'vampire';
  const unitCount = (key) => fmt(state?.[key]);

  const hiredUnits = useMemo(
    () =>
      UNIT_ROWS.reduce((sum, row) => {
        if (row.key === 'clerics' && isVampire) return sum;
        return sum + (Number(state?.[row.key] || 0));
      }, 0),
    [isVampire, state],
  );

  const freePopulation = useMemo(() => {
    const totalPop = Number(state?.population ?? state?.pop ?? 0);
    return Math.max(
      0,
      totalPop - hiredUnits,
    );
  }, [hiredUnits, state?.population, state?.pop]);

  const setMaxValue = useCallback((row) => {
    const maxByGold = Math.floor(Number(state?.gold || 0) / Number(row.price || 1));
    const maxByPop = row.key === 'clerics' && isVampire ? 0 : freePopulation;
    const max = Math.max(0, Math.min(maxByGold, maxByPop));
    setQuantities((prev) => ({ ...prev, [row.key]: String(max) }));
  }, [freePopulation, isVampire, state?.gold]);

  const hire = useCallback(async (row) => {
    const amount = Math.max(0, parseInt(quantities[row.key], 10) || 0);
    if (amount <= 0) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Enter a valid quantity', 'error');
      return;
    }

    try {
      const res = await apiCall('/api/kingdom/hire', {
        method: 'POST',
        body: {
          unit: row.key,
          amount,
        },
      });

      if (res.error) {
        if (typeof window !== 'undefined' && typeof toast === 'function') toast(res.error, 'error');
        return;
      }

      if (res.updates) applyGameMutation(res.updates);

      setQuantities((prev) => ({ ...prev, [row.key]: '' }));
      if (typeof window !== 'undefined' && typeof toast === 'function') toast(`Hired ${amount} ${row.label.toLowerCase()}`, 'success');
    } catch (err) {
      console.error('[hire] failed:', err);
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Hire failed', 'error');
    }
  }, [quantities]);

  const fire = useCallback(async (row) => {
    const amount = Math.max(0, parseInt(quantities[row.key], 10) || 0);
    if (amount <= 0) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Enter a valid quantity', 'error');
      return;
    }

    try {
      const res = await apiCall('/api/kingdom/fire', {
        method: 'POST',
        body: {
          unit: row.key,
          amount,
        },
      });

      if (res.error) {
        if (typeof window !== 'undefined' && typeof toast === 'function') toast(res.error, 'error');
        return;
      }

      if (res.updates) applyGameMutation(res.updates);

      setQuantities((prev) => ({ ...prev, [row.key]: '' }));
      if (typeof window !== 'undefined' && typeof toast === 'function') toast(`Fired ${amount} ${row.label.toLowerCase()}`, 'success');
    } catch (err) {
      console.error('[fire] failed:', err);
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Fire failed', 'error');
    }
  }, [quantities]);

  useEffect(() => {
    setQuantities((prev) => {
      let changed = false;
      const next = { ...prev };
      UNIT_ROWS.forEach((row) => {
        if (row.key === 'clerics' && isVampire) {
          if (next[row.key] !== '') {
            next[row.key] = '';
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, [isVampire]);

  return (
    <div id="hire" className="panel">
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-950/80 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="card-title mb-1">Hire units</div>
          <div className="text-[13px] text-[var(--text3)]">
            Recruit and dismiss units while keeping an eye on the population pool.
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-[12px] text-[var(--text2)]">
          <span>Gold: <strong id="hire-strip-gold" className="text-[var(--gold)]">{fmt(state?.gold)}</strong></span>
          <span>Population: <strong id="hire-pop" className="text-[var(--gold)]">{fmt(state?.population ?? state?.pop)}</strong></span>
        </div>
      </div>

      <div
        id="hire-caps-container"
        className="mb-5 grid grid-cols-4 gap-1 sm:gap-2 rounded-2xl border border-white/10 bg-black/20 p-2 sm:p-3"
      >
        <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3">
          <div className="text-[9px] uppercase tracking-[1px] text-[var(--text3)]">Barracks</div>
          <div className="text-[13px] font-bold">
              <span id="hire-barracks-used">0</span> <span className="text-[var(--text3)] font-normal">/</span> <span id="hire-barracks-cap" className="text-[var(--gold)]">0</span>
            </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3">
          <div className="text-[9px] uppercase tracking-[1px] text-[var(--text3)]">Schools</div>
          <div className="text-[13px] font-bold">
              <span id="hire-school-used">0</span> <span className="text-[var(--text3)] font-normal">/</span> <span id="hire-school-cap" className="text-[var(--gold)]">0</span>
            </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3">
          <div className="text-[9px] uppercase tracking-[1px] text-[var(--text3)]">Smithies</div>
          <div className="text-[13px] font-bold">
              <span id="hire-smithy-used">0</span> <span className="text-[var(--text3)] font-normal">/</span> <span id="hire-smithy-cap" className="text-[var(--gold)]">0</span>
            </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3">
          <div className="text-[9px] uppercase tracking-[1px] text-[var(--text3)]">Library</div>
          <div className="text-[13px] font-bold">
              <span id="hire-library-used">0</span> <span className="text-[var(--text3)] font-normal">/</span> <span id="hire-library-cap" className="text-[var(--gold)]">0</span>
            </div>
        </div>
      </div>

      <div className="hire-row hire-header border-b-2 border-white/10 pb-2.5 mb-2.5 text-[10px] uppercase tracking-[0.5px] text-[var(--text3)]">
          <span>Unit</span>
          <span>In service</span>
          <span>Price</span>
          <span>Action</span>
        </div>

        {UNIT_ROWS.map((row) => {
          if (row.hideWhenRace && row.hideWhenRace === state?.race) return null;
          return (
            <div className="hire-row" key={row.key}>
              <div>
                <div className="hname">{row.icon} {row.label}</div>
                <div className="hdesc">{row.desc}</div>
              </div>
              <div className="hcount" id={`h-${row.key}`}>{unitCount(row.key)}</div>
              <div className="hprice" id={`hp-${row.key}`}>{row.price} GC</div>
              <div className="hbtns flex items-center gap-1 justify-end">
                <input
                  type="number"
                  className="input text-right w-[60px]"
                  id={`hire-${row.key}`}
                  min="0"
                  value={quantities[row.key] || ''}
                  onChange={(e) => setQuantities((prev) => ({ ...prev, [row.key]: e.target.value }))}
                  placeholder="Qty"
                />
                <button className="base-btn text-[10px] px-1.5 py-0.75" onClick={() => setMaxValue(row)}>Max</button>
                <button className="base-btn variant-gold text-[10px] px-2 py-0.75 bg-[var(--gold)] text-black" onClick={() => hire(row)}>Hire</button>
                <button className="base-btn variant-red text-[10px] px-2 py-0.75 bg-[var(--red)]" onClick={() => fire(row)}>Fire</button>
              </div>
            </div>
          );
        })}
      <div className="text-[12px] text-[var(--text3)] px-1">
        Hired units are subtracted from the population pool. Population returns over time based on happiness and entertainment.
      </div>
    </div>
  );
};

export default HirePanel;
