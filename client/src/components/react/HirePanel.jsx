import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiCall } from '../../utils/api';
import { fmt } from "../../utils/fmt";
import { toast } from '../../utils/toast';
import { normalizeAndRouteResponse } from '../../utils/responseNormalizer.js';
import { useRace, useGold, usePopulation, useFighters, useRangers, useMages, useClerics, useNinjas, useThieves, useMilitaryEngineers as useEngineers, useBuildCount, useResearchers } from '../../stores';

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
  const race = useRace();
  const population = usePopulation();
  const gold = useGold();
  const fighters = useFighters();
  const rangers = useRangers();
  const mages = useMages();
  const clerics = useClerics();
  const ninjas = useNinjas();
  const thieves = useThieves();
  const engineers = useEngineers();
  const researchers = useResearchers();
  const bldBarracks = useBuildCount('barracks');
  const bldSchools = useBuildCount('schools');
  const [quantities, setQuantities] = useState(initialQuantities);

  const isVampire = race === 'vampire';
  const troopCounts = useMemo(() => ({
    fighters, rangers, mages, clerics, ninjas, thieves, engineers,
  }), [fighters, rangers, mages, clerics, ninjas, thieves, engineers]);
  const unitCount = (key) => fmt(troopCounts[key]);

  const hiredUnits = useMemo(
    () =>
      UNIT_ROWS.reduce((sum, row) => {
        if (row.key === 'clerics' && isVampire) return sum;
        return sum + (Number(troopCounts[row.key] || 0));
      }, 0),
    [isVampire, troopCounts],
  );

  const freePopulation = useMemo(() => {
    return Math.max(
      0,
      Number(population) - hiredUnits,
    );
  }, [hiredUnits, population]);

  const setMaxValue = useCallback((row) => {
    const maxByGold = Math.floor(Number(gold) / Number(row.price || 1));
    const maxByPop = row.key === 'clerics' && isVampire ? 0 : freePopulation;
    let maxByCapacity = Infinity;

    // Only barracks troops are hard-capped by building capacity
    // Non-military units (researchers, scribes, engineers, mages) are unlimited but consume population if not housed
    const BARRACKS_TROOPS = ['fighters', 'rangers', 'clerics', 'thieves', 'ninjas'];
    if (BARRACKS_TROOPS.includes(row.key)) {
      const barracksCap = bldBarracks * 500;
      const barracksUsed = fighters + rangers + clerics + thieves + ninjas;
      maxByCapacity = Math.max(0, barracksCap - barracksUsed);
    }

    const max = Math.max(0, Math.min(maxByGold, maxByPop, maxByCapacity));
    setQuantities((prev) => ({ ...prev, [row.key]: String(max) }));
  }, [freePopulation, isVampire, gold, bldBarracks, fighters, rangers, clerics, thieves, ninjas]);

  const hire = useCallback(async (row) => {
    const amount = Math.max(0, parseInt(quantities[row.key], 10) || 0);
    if (amount <= 0) {
      toast('Enter a valid quantity', 'error');
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
        toast(res.error, 'error');
        return;
      }

      normalizeAndRouteResponse(res, { reason: 'hire', unit: row.key, amount });

      setQuantities((prev) => ({ ...prev, [row.key]: '' }));
      toast(`Hired ${amount} ${row.label.toLowerCase()}`, 'success');
    } catch (err) {
      console.error('[hire] failed:', err);
      toast('Hire failed', 'error');
    }
  }, [quantities]);

  const fire = useCallback(async (row) => {
    const amount = Math.max(0, parseInt(quantities[row.key], 10) || 0);
    if (amount <= 0) {
      toast('Enter a valid quantity', 'error');
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
        toast(res.error, 'error');
        return;
      }

      normalizeAndRouteResponse(res, { reason: 'fire', unit: row.key, amount });

      setQuantities((prev) => ({ ...prev, [row.key]: '' }));
      toast(`Fired ${amount} ${row.label.toLowerCase()}`, 'success');
    } catch (err) {
      console.error('[fire] failed:', err);
      toast('Fire failed', 'error');
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
          <span>Gold: <strong id="hire-strip-gold" className="text-[var(--gold)]">{fmt(gold)}</strong></span>
          <span>Population: <strong id="hire-pop" className="text-[var(--gold)]">{fmt(population)}</strong></span>
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
          if (row.hideWhenRace && row.hideWhenRace === race) return null;
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
