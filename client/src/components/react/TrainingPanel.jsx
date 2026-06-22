import React, { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { useGameState } from '../../hooks/useGameState';
import { apiCall } from '../../utils/api.js';
import { fmt } from "../../utils/fmt";
import { applyGameMutation } from '../../utils/gameMutations.js';

const TROOP_TYPES = ['fighters', 'rangers', 'clerics', 'mages', 'thieves', 'ninjas'];

const TrainingPanel = () => {
  const { state } = useGameState();
  const [trainingUiTick, setTrainingUiTick] = useState(0);
  const [trainingAllocations, setTrainingAllocations] = useState({});
  const isVampire = state?.race === 'vampire';
  const fmt = (value) => Number(value || 0).toLocaleString();
  const refreshTrainingUi = useCallback(() => {
    setTrainingUiTick((tick) => tick + 1);
  }, []);
  const handleTrainingValueChange = (unit, value) => {
    setTrainingValue(unit, value);
    refreshTrainingUi();
  };
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
    TROOP_TYPES.forEach((unit) => {
      setTrainingValue(unit, alloc[unit] || 0);
    });
  };
  const updateTroopLevelDisplay = () => {
    TROOP_TYPES.forEach((unit) => {
      const data = getTroopLevel(unit);
      const levelEl = document.getElementById(`tr-level-${unit}`);
      const xpEl = document.getElementById(`tr-xp-${unit}`);
      const barEl = document.getElementById(`tr-bar-${unit}`);
      if (levelEl) levelEl.textContent = `Lv ${data.level}`;
      const xpNeeded = 100;
      const xpInLevel = Math.max(0, Number(data.xp || 0) - ((Number(data.level || 1) - 1) * 100));
      if (xpEl) xpEl.textContent = `${fmt(xpInLevel)} / ${fmt(xpNeeded)} XP`;
      if (barEl) barEl.style.width = `${Math.min(100, Math.floor((xpInLevel / xpNeeded) * 100))}%`;
    });
  };
  const updateTrainingDisplay = () => {
    const capacity = (state?.bld_training || 0) * 100;
    const total = getAllocatedTraining();
    const trFields = document.getElementById('tr-fields');
    const trCap = document.getElementById('tr-capacity');
    const trW = document.getElementById('tr-weapons');
    const trA = document.getElementById('tr-armor');
    if (trFields) trFields.textContent = fmt(state?.bld_training || 0);
    if (trCap) {
      trCap.textContent = fmt(capacity);
      trCap.style.color = total > capacity ? 'var(--red)' : 'var(--gold)';
    }
    if (trW) trW.textContent = fmt(state?.weapons_stockpile || 0);
    if (trA) trA.textContent = fmt(state?.armor_stockpile || 0);

    const rb = document.getElementById('tr-race-bonus');
    if (rb && state?.race) {
      const texts = {
        high_elf: 'Increased XP for Clerics, Mages, and Researchers',
        dwarf: 'Increased XP for Fighters and Engineers',
        dire_wolf: 'Greatly increased XP for Fighters and Rangers',
        dark_elf: 'Greatly increased XP for Ninjas, Thieves, and Rangers',
        human: 'Improved XP for all training units',
        orc: 'Greatly increased XP for Fighters and Clerics',
        vampire: 'Increased XP for Infiltrators and combat units',
      };
      rb.innerHTML = texts[state.race] || '?';
    }
  };
  const setTrainingMax = (unit) => {
    const capacity = (state?.bld_training || 0) * 100;
    const allocated = getAllocatedTraining();
    const current = getTrainingValue(unit);
    const available = capacity - allocated + current;
    const el = document.getElementById(`ta-${unit}`);
    if (el) el.value = Math.max(0, Math.min(available, state?.[unit] || 0));
    refreshTrainingUi();
  };
  const distributeTrainingEvenly = () => {
    const capacity = (state?.bld_training || 0) * 100;
    const count = TROOP_TYPES.length;
    const each = Math.floor(capacity / count);
    TROOP_TYPES.forEach((unit) => {
      const el = document.getElementById(`ta-${unit}`);
      if (el) el.value = Math.min(each, state?.[unit] || 0);
    });
    refreshTrainingUi();
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
      return toast(`Allocated ${fmt(total)} but only have ${fmt(capacity)} training capacity`, 'error');
    }
    const result = await apiCall('/api/kingdom/training-allocation', {
      method: 'POST',
      body: { allocation: alloc },
    });
    if (result.error) return toast(result.error, 'error');
    applyGameMutation({ training_allocation: alloc }, { reason: 'training-allocation' });
    refreshTrainingUi();
    toast('Training allocation saved', 'success');
  };
  const releaseAllTraining = async () => {
    TROOP_TYPES.forEach((unit) => setTrainingValue(unit, 0));
    const result = await apiCall('/api/kingdom/training-allocation', {
      method: 'POST',
      body: { allocation: {} },
    });
    if (result.error) return toast(result.error, 'error');
    applyGameMutation({ training_allocation: {} }, { reason: 'training-allocation' });
    refreshTrainingUi();
    toast('All training released', 'success');
  };
  useEffect(() => {
    loadTrainingAllocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(state?.training_allocation || {})]);
  useEffect(() => {
    updateTroopLevelDisplay();
    updateTrainingDisplay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, trainingUiTick]);
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
    <div id="training" className="panel" data-ui-tick={trainingUiTick}>
      <div className="card">
        <div className="card-title">Support levels</div>
        <div className="text-[12px] text-[var(--text3)] mb-2.5">
          These units level through their work each turn — not just training
          fields.
        </div>
        <div className="grid [grid-template-columns:repeat(auto-fit,minmax(100px,1fr))] gap-2.5">
          <div className="bg-bg3 rounded-lg p-2.5 text-center">
            <div className="text-[11px] text-[var(--text3)] mb-0.75">ENGINEERS</div>
            <div className="text-[18px] font-bold text-text" id="sup-count-engineers">{fmt(state?.engineers)}</div>
            <div id="sup-lv-engineers" className="text-[13px] font-semibold text-[var(--text3)] mt-0.5">Lv {engineerXpView.level}</div>
            <div id="sup-xp-engineers" className="text-[10px] text-[var(--text3)] mt-0.5">{engineerXpView.xpText}</div>
          </div>
          <div className="bg-bg3 rounded-lg p-2.5 text-center">
            <div className="text-[11px] text-[var(--text3)] mb-0.75">SCRIBES</div>
            <div className="text-[18px] font-bold text-text" id="sup-count-scribes">{fmt(state?.scribes)}</div>
            <div id="sup-lv-scribes" className="text-[13px] font-semibold text-[var(--text3)] mt-0.5">Lv {scribeXpView.level}</div>
            <div id="sup-xp-scribes" className="text-[10px] text-[var(--text3)] mt-0.5">{scribeXpView.xpText}</div>
          </div>
          <div className="bg-bg3 rounded-lg p-2.5 text-center">
            <div className="text-[11px] text-[var(--text3)] mb-0.75">RESEARCHERS</div>
            <div className="text-[18px] font-bold text-text" id="sup-count-researchers">{fmt(state?.researchers)}</div>
            <div id="sup-lv-researchers" className="text-[13px] font-semibold text-[var(--text3)] mt-0.5">Lv {researcherXpView.level}</div>
            <div id="sup-xp-researchers" className="text-[10px] text-[var(--text3)] mt-0.5">{researcherXpView.xpText}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
          <div>
            <div className="card-title mb-0.5">
              Troop Training
              <span id="racial-gift-badge" className="badge badge-gold hidden ml-2">✨ Racial Gift</span>
            </div>
            <div className="text-[12px] text-[var(--text3)]">
              Training fields: <span id="tr-fields" className="text-text">{fmt(state?.bld_training || 0)}</span> · Capacity: <span id="tr-capacity" className="text-[var(--gold)]">{fmt((state?.bld_training || 0) * 100)}</span> troops/turn · Weapons: <span id="tr-weapons" className="text-text">{fmt(state?.weapons_stockpile || 0)}</span> · Armor: <span id="tr-armor" className="text-text">{fmt(state?.armor_stockpile || 0)}</span>
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

        <div
          id="racial-gift-banner"
          className="hidden bg-gradient-to-r from-[rgba(232,184,75,0.15)] to-[rgba(232,120,0,0.1)] border border-[var(--gold)] rounded-lg p-3.5 mb-3.5 text-[13px] text-[var(--gold)]"
        >
          ✨ <strong>Racial gift active</strong> — <span id="racial-gift-text"></span>
        </div>

        {/* Training Rows */}
        <div className="trow">
          <span className="name">Fighters</span>
          <div className="prog-wrap">
             <div id="tr-bar-fighters" className="prog-bar mil" style={{ width: fighterXpView.barWidth }}></div>
          </div>
          <span id="tr-level-fighters" className="count min-w-[70px]">Lv {fighterXpView.level}</span>
          <span id="tr-xp-fighters" className="text-[11px] text-[var(--text3)] min-w-[80px]">{fighterXpView.xpText}</span>
          <div className="flex items-center mb-1">
             <input type="number" className="input text-right flex-1" min="0" value={getTrainingValue('fighters')} onChange={(e) => handleTrainingValueChange('fighters', e.target.value)} placeholder="Qty" />
             <button className="base-btn px-2 py-1 text-[10px] ml-1" onClick={() => setTrainingMax('fighters')}>Max</button>
          </div>
        </div>

        <div className="trow">
          <span className="name">Rangers</span>
          <div className="prog-wrap">
             <div id="tr-bar-rangers" className="prog-bar bg-[var(--blue)]" style={{ width: rangerXpView.barWidth }}></div>
          </div>
          <span id="tr-level-rangers" className="count min-w-[70px]">Lv {rangerXpView.level}</span>
          <span id="tr-xp-rangers" className="text-[11px] text-[var(--text3)] min-w-[80px]">{rangerXpView.xpText}</span>
          <div className="flex items-center mb-1">
             <input type="number" className="input text-right flex-1" min="0" value={getTrainingValue('rangers')} onChange={(e) => handleTrainingValueChange('rangers', e.target.value)} placeholder="Qty" />
             <button className="base-btn px-2 py-1 text-[10px] ml-1" onClick={() => setTrainingMax('rangers')}>Max</button>
          </div>
        </div>

        <div id="training-row-clerics" className={clsx('trow', isVampire && 'hidden')}>
          <span className="name">Clerics</span>
          <div className="prog-wrap">
             <div id="tr-bar-clerics" className="prog-bar bg-[var(--green)]" style={{ width: clericXpView.barWidth }}></div>
          </div>
          <span id="tr-level-clerics" className="count min-w-[70px]">Lv {clericXpView.level}</span>
          <span id="tr-xp-clerics" className="text-[11px] text-[var(--text3)] min-w-[80px]">{clericXpView.xpText}</span>
          <div className="flex items-center mb-1">
             <input type="number" className="input text-right flex-1" min="0" value={getTrainingValue('clerics')} onChange={(e) => handleTrainingValueChange('clerics', e.target.value)} placeholder="Qty" />
             <button className="base-btn px-2 py-1 text-[10px] ml-1" onClick={() => setTrainingMax('clerics')}>Max</button>
          </div>
        </div>

        <div className="trow">
          <span className="name">Mages</span>
          <div className="prog-wrap">
             <div id="tr-bar-mages" className="prog-bar spell" style={{ width: mageXpView.barWidth }}></div>
          </div>
          <span id="tr-level-mages" className="count min-w-[70px]">Lv {mageXpView.level}</span>
          <span id="tr-xp-mages" className="text-[11px] text-[var(--text3)] min-w-[80px]">{mageXpView.xpText}</span>
          <div className="flex items-center mb-1">
             <input type="number" className="input text-right flex-1" min="0" value={getTrainingValue('mages')} onChange={(e) => handleTrainingValueChange('mages', e.target.value)} placeholder="Qty" />
             <button className="base-btn px-2 py-1 text-[10px] ml-1" onClick={() => setTrainingMax('mages')}>Max</button>
          </div>
        </div>

        <div className="trow">
          <span className="name">Thieves</span>
          <div className="prog-wrap">
             <div id="tr-bar-thieves" className="prog-bar bg-[var(--amber)]" style={{ width: thiefXpView.barWidth }}></div>
          </div>
          <span id="tr-level-thieves" className="count min-w-[70px]">Lv {thiefXpView.level}</span>
          <span id="tr-xp-thieves" className="text-[11px] text-[var(--text3)] min-w-[80px]">{thiefXpView.xpText}</span>
          <div className="flex items-center mb-1">
             <input type="number" className="input text-right flex-1" min="0" value={getTrainingValue('thieves')} onChange={(e) => handleTrainingValueChange('thieves', e.target.value)} placeholder="Qty" />
             <button className="base-btn px-2 py-1 text-[10px] ml-1" onClick={() => setTrainingMax('thieves')}>Max</button>
          </div>
        </div>

        <div className="trow border-b-0">
          <span className="name">Ninjas</span>
          <div className="prog-wrap">
             <div id="tr-bar-ninjas" className="prog-bar bg-[var(--red)]" style={{ width: ninjaXpView.barWidth }}></div>
          </div>
          <span id="tr-level-ninjas" className="count min-w-[70px]">Lv {ninjaXpView.level}</span>
          <span id="tr-xp-ninjas" className="text-[11px] text-[var(--text3)] min-w-[80px]">{ninjaXpView.xpText}</span>
          <div className="flex items-center mb-1">
             <input type="number" className="input text-right flex-1" min="0" value={getTrainingValue('ninjas')} onChange={(e) => handleTrainingValueChange('ninjas', e.target.value)} placeholder="Qty" />
             <button className="base-btn px-2 py-1 text-[10px] ml-1" onClick={() => setTrainingMax('ninjas')}>Max</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Race training bonus</div>
        <div id="tr-race-bonus" className="text-[13px] text-text2 leading-relaxed">
          —
        </div>
      </div>
    </div>
  );
};

export default TrainingPanel;
