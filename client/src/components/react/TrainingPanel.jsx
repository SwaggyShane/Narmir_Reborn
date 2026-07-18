import React, { useEffect, useState } from 'react';
import clsx from 'clsx';
import { apiCall } from '../../utils/api.mjs';
import { fmt } from "../../utils/fmt";
import { toast } from '../../utils/toast.js';
import ProgressBar from './ProgressBar';
import { AllocationButtons } from './AllocationButtons.jsx';
import { useRace, useTroopLevels, useTrainingAllocation, useBuildTraining, useWeaponsStockpile, useArmorStockpile, useEngineers, useScribes, useResearchers, useFighters, useRangers, useClerics, useMages, useThieves, useNinjas, useEconomyStore } from '../../stores';

const TROOP_TYPES = ['fighters', 'rangers', 'clerics', 'mages', 'thieves', 'ninjas'];

// Mirrors game/lib/troops.js troopXpForLevel — server is canonical.
function troopXpForLevel(level) {
  if (level <= 1) return 0;
  if (level <= 10) return level * 100;
  if (level <= 25) return level * 300;
  if (level <= 50) return level * 800;
  if (level <= 75) return level * 2000;
  return level * 5000;
}

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
  const race = useRace();
  const troopLevels = useTroopLevels();
  const trainingAllocationData = useTrainingAllocation();
  const buildTraining = useBuildTraining();
  const weaponsStockpile = useWeaponsStockpile();
  const armorStockpile = useArmorStockpile();
  const engineers = useEngineers();
  const scribes = useScribes();
  const researchers = useResearchers();
  const fighters = useFighters();
  const rangers = useRangers();
  const clerics = useClerics();
  const mages = useMages();
  const thieves = useThieves();
  const ninjas = useNinjas();
  const [trainingAllocations, setTrainingAllocations] = useState({});
  const isVampire = race === 'vampire';

  const getTroopLevel = (unit) => troopLevels?.[unit] || { level: 1, xp: 0 };
  const getTroopXpView = (unit) => {
    const data = getTroopLevel(unit);
    const level = Number(data.level || 1);
    // Server (awardTroopXp) stores data.xp as the remainder already earned
    // toward the *next* level, not cumulative XP since level 1.
    const xpInLevel = Math.max(0, Number(data.xp || 0));
    const xpNeeded = level >= 100 ? 0 : troopXpForLevel(level + 1) - troopXpForLevel(level);
    const pct = xpNeeded > 0 ? Math.min(100, Math.floor((xpInLevel / xpNeeded) * 100)) : 100;
    return {
      level,
      xpText: level >= 100 ? 'MAX' : `${fmt(xpInLevel)} / ${fmt(xpNeeded)} XP`,
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
    const alloc = typeof trainingAllocationData === 'string'
      ? (() => {
        try { return JSON.parse(trainingAllocationData || '{}'); } catch { return {}; }
      })()
      : (trainingAllocationData || {});
    const nextAllocations = {};
    TROOP_TYPES.forEach((unit) => {
      nextAllocations[unit] = alloc[unit] || 0;
    });
    setTrainingAllocations(nextAllocations);
  };

  const setTrainingMax = (unit) => {
    const capacity = (buildTraining || 0) * 100;
    const allocated = getAllocatedTraining();
    const current = Number(getTrainingValue(unit)) || 0;
    const unitCounts = { fighters, rangers, clerics, mages, thieves, ninjas };
    const available = capacity - allocated + current;
    setTrainingValue(unit, Math.max(0, Math.min(available, unitCounts[unit] || 0)));
  };

  const distributeTrainingEvenly = () => {
    const capacity = (buildTraining || 0) * 100;
    const each = Math.floor(capacity / TROOP_TYPES.length);
    const unitCounts = { fighters, rangers, clerics, mages, thieves, ninjas };
    const nextAllocations = {};
    TROOP_TYPES.forEach((unit) => {
      nextAllocations[unit] = Math.min(each, unitCounts[unit] || 0);
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
    const capacity = (buildTraining || 0) * 100;
    if (total > capacity) {
      toast(`Allocated ${fmt(total)} but only have ${fmt(capacity)} training capacity`, 'error');
      return;
    }
    const result = await apiCall('/api/kingdom/training-allocation', {
      method: 'POST',
      body: { allocation: alloc },
    });
    if (result.error) return toast(result.error, 'error');
    useEconomyStore.getState().receiveServerSnapshot({
      training_allocation: alloc,
    });
    toast('Training allocation saved', 'success');
  };

  const releaseAllTraining = async () => {
    setTrainingAllocations({});
    const result = await apiCall('/api/kingdom/training-allocation', {
      method: 'POST',
      body: { allocation: {} },
    });
    if (result.error) return toast(result.error, 'error');
    useEconomyStore.getState().receiveServerSnapshot({
      training_allocation: {},
    });
    toast('All training released', 'success');
  };

  useEffect(() => {
    loadTrainingAllocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(trainingAllocationData || {})]);

  const capacity = (buildTraining || 0) * 100;
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
            <div className="text-[18px] font-bold text-text">{fmt(engineers)}</div>
            <div className="text-[13px] font-semibold text-[var(--text3)] mt-0.5">Lv {engineerXpView.level}</div>
            <ProgressBar percent={engineerXpView.barWidth} variant="arm" className="mx-auto mt-2 max-w-[120px]" />
            <div className="text-[10px] text-[var(--text3)] mt-0.5">{engineerXpView.xpText}</div>
          </div>
          <div className="bg-bg3 rounded-lg p-2.5 text-center">
            <div className="text-[11px] text-[var(--text3)] mb-0.75">SCRIBES</div>
            <div className="text-[18px] font-bold text-text">{fmt(scribes)}</div>
            <div className="text-[13px] font-semibold text-[var(--text3)] mt-0.5">Lv {scribeXpView.level}</div>
            <ProgressBar percent={scribeXpView.barWidth} variant="arm" className="mx-auto mt-2 max-w-[120px]" />
            <div className="text-[10px] text-[var(--text3)] mt-0.5">{scribeXpView.xpText}</div>
          </div>
          <div className="bg-bg3 rounded-lg p-2.5 text-center">
            <div className="text-[11px] text-[var(--text3)] mb-0.75">RESEARCHERS</div>
            <div className="text-[18px] font-bold text-text">{fmt(researchers)}</div>
            <div className="text-[13px] font-semibold text-[var(--text3)] mt-0.5">Lv {researcherXpView.level}</div>
            <ProgressBar percent={researcherXpView.barWidth} variant="arm" className="mx-auto mt-2 max-w-[120px]" />
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
              {'Training fields: '}<span className="text-text">{fmt(buildTraining || 0)}</span>
              {' - Capacity: '}
              <span className={totalAllocated > capacity ? 'text-[var(--red)]' : 'text-[var(--gold)]'}>
                {fmt(capacity)}
              </span>
              {' troops/turn - Weapons: '}<span className="text-text">{fmt(weaponsStockpile)}</span>
              {' - Armor: '}<span className="text-text">{fmt(armorStockpile)}</span>
            </div>
          </div>
          <AllocationButtons
            onDistribute={distributeTrainingEvenly}
            onRelease={releaseAllTraining}
            onAllocate={saveTrainingAllocation}
            distributeLabel="Distribute evenly"
          />
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
          <ProgressBar percent={fighterXpView.barWidth} variant="mil" />
          <span className="count min-w-[70px]">Lv {fighterXpView.level}</span>
          <span className="text-[11px] text-[var(--text3)] min-w-[80px]">{fighterXpView.xpText}</span>
          <div className="flex items-center mb-1">
            <input type="number" className="input text-right flex-1" min="0" value={getTrainingValue('fighters')} onChange={(e) => setTrainingValue('fighters', e.target.value)} placeholder="Qty" />
            <button className="base-btn px-2 py-1 text-[10px] ml-1" onClick={() => setTrainingMax('fighters')}>Max</button>
          </div>
        </div>

        <div className="trow">
          <span className="name">Rangers</span>
          <ProgressBar percent={rangerXpView.barWidth} variant="arm" />
          <span className="count min-w-[70px]">Lv {rangerXpView.level}</span>
          <span className="text-[11px] text-[var(--text3)] min-w-[80px]">{rangerXpView.xpText}</span>
          <div className="flex items-center mb-1">
            <input type="number" className="input text-right flex-1" min="0" value={getTrainingValue('rangers')} onChange={(e) => setTrainingValue('rangers', e.target.value)} placeholder="Qty" />
            <button className="base-btn px-2 py-1 text-[10px] ml-1" onClick={() => setTrainingMax('rangers')}>Max</button>
          </div>
        </div>

        <div className={clsx('trow', isVampire && 'hidden')}>
          <span className="name">Clerics</span>
          <ProgressBar percent={clericXpView.barWidth} variant="mana" />
          <span className="count min-w-[70px]">Lv {clericXpView.level}</span>
          <span className="text-[11px] text-[var(--text3)] min-w-[80px]">{clericXpView.xpText}</span>
          <div className="flex items-center mb-1">
            <input type="number" className="input text-right flex-1" min="0" value={getTrainingValue('clerics')} onChange={(e) => setTrainingValue('clerics', e.target.value)} placeholder="Qty" />
            <button className="base-btn px-2 py-1 text-[10px] ml-1" onClick={() => setTrainingMax('clerics')}>Max</button>
          </div>
        </div>

        <div className="trow">
          <span className="name">Mages</span>
          <ProgressBar percent={mageXpView.barWidth} variant="spell" />
          <span className="count min-w-[70px]">Lv {mageXpView.level}</span>
          <span className="text-[11px] text-[var(--text3)] min-w-[80px]">{mageXpView.xpText}</span>
          <div className="flex items-center mb-1">
            <input type="number" className="input text-right flex-1" min="0" value={getTrainingValue('mages')} onChange={(e) => setTrainingValue('mages', e.target.value)} placeholder="Qty" />
            <button className="base-btn px-2 py-1 text-[10px] ml-1" onClick={() => setTrainingMax('mages')}>Max</button>
          </div>
        </div>

        <div className="trow">
          <span className="name">Thieves</span>
          <ProgressBar percent={thiefXpView.barWidth} variant="mil" />
          <span className="count min-w-[70px]">Lv {thiefXpView.level}</span>
          <span className="text-[11px] text-[var(--text3)] min-w-[80px]">{thiefXpView.xpText}</span>
          <div className="flex items-center mb-1">
            <input type="number" className="input text-right flex-1" min="0" value={getTrainingValue('thieves')} onChange={(e) => setTrainingValue('thieves', e.target.value)} placeholder="Qty" />
            <button className="base-btn px-2 py-1 text-[10px] ml-1" onClick={() => setTrainingMax('thieves')}>Max</button>
          </div>
        </div>

        <div className="trow border-b-0">
          <span className="name">Ninjas</span>
          <ProgressBar percent={ninjaXpView.barWidth} variant="wep" />
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
          {RACE_TRAINING_BONUS[race] || '—'}
        </div>
      </div>
    </div>
  );
};

export default TrainingPanel;
