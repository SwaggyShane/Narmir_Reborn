import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { useGameState } from '../../hooks/useGameState';
import { apiCall } from '../../utils/api.js';
import { fmt } from "../../utils/fmt";
import { applyGameMutation } from '../../utils/gameMutations.js';
import { toast } from '../../utils/toast.js';

const TROOP_TYPES = ['fighters', 'rangers', 'clerics', 'mages', 'thieves', 'ninjas'];

const RACE_TRAINING_BONUS = {
  high_elf: 'Increased XP for Clerics, Mages, and Researchers',
  dwarf: 'Increased XP for Fighters and Engineers',
  dire_wolf: 'Greatly increased XP for Fighters and Rangers',
  dark_elf: 'Greatly increased XP for Ninjas, Thieves, and Rangers',
  human: 'Improved XP for all training units',
  orc: 'Greatly increased XP for Fighters and Clerics',
  vampire: 'Increased XP for Infiltrators and combat units',
};

const TrainingPanel = () => {
  const { state } = useGameState();
  const [trainingAllocations, setTrainingAllocations] = useState({});
  const isVampire = state?.race === 'vampire';

  const getTroopLevel = (unit) => state?.troop_levels?.[unit] || { level: 1, xp: 0 };
  const getTroopXpView = (unit) => {
    const data = getTroopLevel(unit);
    const xpNeeded = 100;
    const xpInLevel = Math.max(0, Number(data.xp || 0) - ((Number(data.level || 1) - 1) * 100));
    const pct = Math.min(100, Math.floor((xpInLevel / xpNeeded) * 100));
    return {
      level: Number(data.level || 1),
      xpText: `${fmt(xpInLevel)} / ${fmt(xpNeeded)} XP`,
      barWidth: `${pct}%`,
    };
  };

  const getTrainingValue = (unit) => trainingAllocations[unit] || 0;
  const setTrainingValue = (unit, value) => {
    setTrainingAllocations((prev) => ({
      ...prev,
      [unit]: Math.max(0, Number(value) || 0),
    }));
  };
  const getAllocatedTraining = () => TROOP_TYPES.reduce((sum, unit) => sum + getTrainingValue(unit), 0);

  const loadTrainingAllocation = () => {
    const alloc = typeof state?.training_allocation === 'string'
      ? (() => {
        try { return JSON.parse(state.training_allocation || '{}'); } catch { return {}; }
      })()
      : (state?.training_allocation || {});
    const nextAllocations = {};
    TROOP_TYPES.forEach((unit) => {
      nextAllocations[unit] = alloc[unit] || 0;
    });
    setTrainingAllocations(nextAllocations);
  };

  const setTrainingMax = (unit) => {
    const capacity = (state?.bld_training || 0) * 100;
    const allocated = getAllocatedTraining();
    const current = Number(getTrainingValue(unit)) || 0;
    const available = capacity - allocated + current;
    setTrainingValue(unit, Math.max(0, Math.min(available, state?.[unit] || 0)));
  };

  const distributeTrainingEvenly = () => {
    const capacity = (state?.bld_training || 0) * 100;
    const each = Math.floor(capacity / TROOP_TYPES.length);
    const nextAllocations = {};
    TROOP_TYPES.forEach((unit) => {
      nextAllocations[unit] = Math.min(each, state?.[unit] || 0);
    });
    setTrainingAllocations(nextAllocations);
  };

  const saveTrainingAllocation = async () => {
    const alloc = {};
    let total = 0;
    TROOP_TYPES.forEach((unit) => {
      const val = getTrainingValue(unit);
      alloc[unit] = val;
      total += val;
    });
    const capacity = (state?.bld_training || 0) * 100;
    if (total > capacity) {
      toast(`Allocated ${fmt(total)} but only have ${fmt(capacity)} training capacity`, 'error');
      return;
    }
    const result = await apiCall('/api/kingdom/training-allocation', {
      method: 'POST',
      body: { allocation: alloc },
    });
    if (result.error) return toast(result.error, 'error');
    applyGameMutation({ training_allocation: alloc }, { reason: 'training-allocation' });
    toast('Training allocation saved', 'success');
  };

  const releaseAllTraining = async () => {
    setTrainingAllocations({});
    const result = await apiCall('/api/kingdom/training-allocation', {
      method: 'POST',
      body: { allocation: {} },
    });
    if (result.error) return toast(result.error, 'error');
    applyGameMutation({ training_allocation: {} }, { reason: 'training-allocation' });
    toast('All training released', 'success');
  };

  useEffect(() => {
    loadTrainingAllocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(state?.training_allocation || {})]);

  const capacity = (state?.bld_training || 0) * 100;
  const totalAllocated = getAllocatedTraining();

  const engineerXpView = getTroopXpView('engineers');
  const scribeXpView = getTroopXpView('scribes');
  const researcherXpView = getTroopXpView('researchers');
  const fighterXpView = getTroopXpView('fighters');
  const rangerXpView = getTroopXpView('rangers');
  const clericXpView = getTroopXpView('clerics');
  const mageXpView = getTroopXpView('mages');
  const thiefXpView = getTroopXpView('thieves');
  const ninjaXpView = getTroopXpView('ninjas');

  return (
    <div id="training" className="panel">
      <div className="card">
        <div className="card-title">Support levels</div>
        <div className="text-[12px] text-[var(--text3)] mb-2.5">
          These units level through their work each turn — not just training
          fields.
        </div>
        <div className="grid [grid-template-columns:repeat(auto-fit,minmax(100px,1fr))] gap-2.5">
          <div className="bg-bg3 rounded-lg p-2.5 text-center">
            <div className="text-[11px] text-[var(--text3)] mb-0.75">ENGINEERS</div>
            <div className="text-[18px] font-bold text-text">{fmt(state?.engineers)}</div>
            <div className="text-[13px] font-semibold text-[var(--text3)] mt-0.5">Lv {engineerXpView.level}</div>
            <div className="text-[10px] text-[var(--text3)] mt-0.5">{engineerXpView.xpText}</div>
          </div>
          <div className="bg-bg3 rounded-lg p-2.5 text-center">
            <div className="text-[11px] text-[var(--text3)] mb-0.75">SCRIBES</div>
            <div className="text-[18px] font-bold text-text">{fmt(state?.scribes)}</div>
            <div className="text-[13px] font-semibold text-[var(--text3)] mt-0.5">Lv {scribeXpView.level}</div>
            <div className="text-[10px] text-[var(--text3)] mt-0.5">{scribeXpView.xpText}</div>
          </div>
          <div className="bg-bg3 rounded-lg p-2.5 text-center">
            <div className="text-[11px] text-[var(--text3)] mb-0.75">RESEARCHERS</div>
            <div className="text-[18px] font-bold text-text">{fmt(state?.researchers)}</div>
            <div className="text-[13px] font-semibold text-[var(--text3)] mt-0.5">Lv {researcherXpView.level}</div>
            <div className="text-[10px] text-[var(--text3)] mt-0.5">{researcherXpView.xpText}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
          <div>
            <div className="card-title mb-0.5">
              Troop Training
            </div>
            <div className="text-[12px] text-[var(--text3)]">
              {'Training fields: '}<span className="text-text">{fmt(state?.bld_training || 0)}</span>
              {' - Capacity: '}
              <span style={{ color: totalAllocated > capacity ? 'var(--red)' : 'var(--gold)' }}>
                {fmt(capacity)}
              </span>
              {' troops/turn - Weapons: '}<span className="text-text">{fmt(state?.weapons_stockpile || 0)}</span>
              {' - Armor: '}<span className="text-text">{fmt(state?.armor_stockpile || 0)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="base-btn variant-accent whitespace-nowrap bg-[var(--accent1)]" onClick={distributeTrainingEvenly}>Distribute evenly</button>
            <button className="base-btn variant-red whitespace-nowrap bg-[var(--red)]" onClick={releaseAllTraining}>Release all</button>
            <button className="base-btn variant-gold whitespace-nowrap bg-[var(--gold)] text-black" onClick={saveTrainingAllocation}>Save allocation</button>
          </div>
        </div>

        <div className="text-[12px] text-[var(--text3)] mb-3 leading-relaxed">
          Assign troops to training fields each turn. Troops need weapons and
          armor equipped to train effectively. Race bonuses apply — troops
          associated with your race's strengths train faster and can exceed Level
          100.
        </div>

        {/* Training Rows */}
        <div className="trow">
          <span className="name">Fighters</span>
          <div className="prog-wrap">
            <div className="prog-bar mil" style={{ width: fighterXpView.barWidth }}></div>
          </div>
          <span className="count min-w-[70px]">Lv {fighterXpView.level}</span>
          <span className="text-[11px] text-[var(--text3)] min-w-[80px]">{fighterXpView.xpText}</span>
          <div className="flex items-center mb-1">
            <input type="number" className="input text-right flex-1" min="0" value={getTrainingValue('fighters')} onChange={(e) => setTrainingValue('fighters', e.target.value)} placeholder="Qty" />
            <button className="base-btn px-2 py-1 text-[10px] ml-1" onClick={() => setTrainingMax('fighters')}>Max</button>
          </div>
        </div>

        <div className="trow">
          <span className="name">Rangers</span>
          <div className="prog-wrap">
            <div className="prog-bar bg-[var(--blue)]" style={{ width: rangerXpView.barWidth }}></div>
          </div>
          <span className="count min-w-[70px]">Lv {rangerXpView.level}</span>
          <span className="text-[11px] text-[var(--text3)] min-w-[80px]">{rangerXpView.xpText}</span>
          <div className="flex items-center mb-1">
            <input type="number" className="input text-right flex-1" min="0" value={getTrainingValue('rangers')} onChange={(e) => setTrainingValue('rangers', e.target.value)} placeholder="Qty" />
            <button className="base-btn px-2 py-1 text-[10px] ml-1" onClick={() => setTrainingMax('rangers')}>Max</button>
          </div>
        </div>

        <div className={clsx('trow', isVampire && 'hidden')}>
          <span className="name">Clerics</span>
          <div className="prog-wrap">
            <div className="prog-bar bg-[var(--green)]" style={{ width: clericXpView.barWidth }}></div>
          </div>
          <span className="count min-w-[70px]">Lv {clericXpView.level}</span>
          <span className="text-[11px] text-[var(--text3)] min-w-[80px]">{clericXpView.xpText}</span>
          <div className="flex items-center mb-1">
            <input type="number" className="input text-right flex-1" min="0" value={getTrainingValue('clerics')} onChange={(e) => setTrainingValue('clerics', e.target.value)} placeholder="Qty" />
            <button className="base-btn px-2 py-1 text-[10px] ml-1" onClick={() => setTrainingMax('clerics')}>Max</button>
          </div>
        </div>

        <div className="trow">
          <span className="name">Mages</span>
          <div className="prog-wrap">
            <div className="prog-bar spell" style={{ width: mageXpView.barWidth }}></div>
          </div>
          <span className="count min-w-[70px]">Lv {mageXpView.level}</span>
          <span className="text-[11px] text-[var(--text3)] min-w-[80px]">{mageXpView.xpText}</span>
          <div className="flex items-center mb-1">
            <input type="number" className="input text-right flex-1" min="0" value={getTrainingValue('mages')} onChange={(e) => setTrainingValue('mages', e.target.value)} placeholder="Qty" />
            <button className="base-btn px-2 py-1 text-[10px] ml-1" onClick={() => setTrainingMax('mages')}>Max</button>
          </div>
        </div>

        <div className="trow">
          <span className="name">Thieves</span>
          <div className="prog-wrap">
            <div className="prog-bar bg-[var(--amber)]" style={{ width: thiefXpView.barWidth }}></div>
          </div>
          <span className="count min-w-[70px]">Lv {thiefXpView.level}</span>
          <span className="text-[11px] text-[var(--text3)] min-w-[80px]">{thiefXpView.xpText}</span>
          <div className="flex items-center mb-1">
            <input type="number" className="input text-right flex-1" min="0" value={getTrainingValue('thieves')} onChange={(e) => setTrainingValue('thieves', e.target.value)} placeholder="Qty" />
            <button className="base-btn px-2 py-1 text-[10px] ml-1" onClick={() => setTrainingMax('thieves')}>Max</button>
          </div>
        </div>

        <div className="trow border-b-0">
          <span className="name">Ninjas</span>
          <div className="prog-wrap">
            <div className="prog-bar bg-[var(--red)]" style={{ width: ninjaXpView.barWidth }}></div>
          </div>
          <span className="count min-w-[70px]">Lv {ninjaXpView.level}</span>
          <span className="text-[11px] text-[var(--text3)] min-w-[80px]">{ninjaXpView.xpText}</span>
          <div className="flex items-center mb-1">
            <input type="number" className="input text-right flex-1" min="0" value={getTrainingValue('ninjas')} onChange={(e) => setTrainingValue('ninjas', e.target.value)} placeholder="Qty" />
            <button className="base-btn px-2 py-1 text-[10px] ml-1" onClick={() => setTrainingMax('ninjas')}>Max</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Race training bonus</div>
        <div className="text-[13px] text-text2 leading-relaxed">
          {RACE_TRAINING_BONUS[state?.race] || '—'}
        </div>
      </div>
    </div>
  );
};

export default TrainingPanel;
