import React, { useState, useCallback, useMemo } from 'react';
import clsx from 'clsx';
import { useGameMutationEvents } from '../../hooks/useGameState';
import { useStudiesData } from '../../hooks/useStudiesData';
import {
  useRace,
  useMages,
  useResEconomy,
  useResWeapons,
  useResArmor,
  useResMilitary,
  useResAttackMagic,
  useResDefenseMagic,
  useResEntertainment,
  useResConstruction,
  useResWarMachines,
  useResSpellbook,
  useSchoolOfMagic,
} from '../../stores';
import { TowerTab } from './StudiesTabs/TowerTab.jsx';
import { SchoolTab } from './StudiesTabs/SchoolTab.jsx';
import { ShrineTab } from './StudiesTabs/ShrineTab.jsx';
import { LibraryTab } from './StudiesTabs/LibraryTab.jsx';

const StudiesPanel = () => {
  useGameMutationEvents();
  const [activeTab, setActiveTab] = useState('tower');
  const [mageSpellbookValue, setMageSpellbookValue] = useState(0);
  const [mageSchoolValue, setMageSchoolValue] = useState(0);
  const [focus1Value, setFocus1Value] = useState('economy');
  const [focus2Value, setFocus2Value] = useState('weapons');

  const { studiesData, isRefreshing, loadStudies, fetchStudiesData, syncUpgrades } = useStudiesData();

  const race = useRace();
  const mages = useMages();
  const schoolOfMagic = useSchoolOfMagic();
  const resEconomy = useResEconomy();
  const resWeapons = useResWeapons();
  const resArmor = useResArmor();
  const resMilitary = useResMilitary();
  const resAttackMagic = useResAttackMagic();
  const resDefenseMagic = useResDefenseMagic();
  const resEntertainment = useResEntertainment();
  const resConstruction = useResConstruction();
  const resWarMachines = useResWarMachines();
  const resSpellbook = useResSpellbook();

  useGameMutationEvents(useCallback((event) => {
    if (String(event?.reason || '') === 'economy-upgrade') {
      fetchStudiesData();
    }
  }, [fetchStudiesData]));

  const handleTabUpgraded = useCallback((category, nextOwned) => {
    syncUpgrades(category, nextOwned);
    fetchStudiesData();
  }, [syncUpgrades, fetchStudiesData]);

  const state = useMemo(() => ({
    race,
    mages,
    res_economy: resEconomy,
    res_weapons: resWeapons,
    res_armor: resArmor,
    res_military: resMilitary,
    res_attack_magic: resAttackMagic,
    res_defense_magic: resDefenseMagic,
    res_entertainment: resEntertainment,
    res_construction: resConstruction,
    res_war_machines: resWarMachines,
    res_spellbook: resSpellbook,
    school_of_magic: schoolOfMagic,
  }), [
    race,
    mages,
    resEconomy,
    resWeapons,
    resArmor,
    resMilitary,
    resAttackMagic,
    resDefenseMagic,
    resEntertainment,
    resConstruction,
    resWarMachines,
    resSpellbook,
    schoolOfMagic,
  ]);

  return (
    <div id="studies" className="panel">
      <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
        <div className="card-title">🏛️ Studies</div>
        <button
          className="base-btn"
          onClick={loadStudies}
          disabled={isRefreshing}
          style={{ fontSize: '11px', opacity: isRefreshing ? 0.6 : 0.7, padding: '4px 8px' }}
        >
          {isRefreshing ? '⟳ Syncing...' : '↻ Sync'}
        </button>
      </div>

      <div className="flex flex-wrap gap-1 mb-4 border-b-2 border-[var(--border2)] pb-0">
        <button
          className={clsx('base-btn admin-tab', activeTab === 'tower' && 'active')}
          onClick={() => setActiveTab('tower')}
          style={{ borderRadius: 0 }}
        >
          🗼 Tower
        </button>
        <button
          className={clsx('base-btn admin-tab', activeTab === 'school' && 'active')}
          onClick={() => setActiveTab('school')}
          style={{ borderRadius: 0 }}
        >
          🏫 School
        </button>
        <button
          id="studies-tab-shrine-btn"
          className={clsx('base-btn admin-tab', activeTab === 'shrine' && 'active')}
          onClick={() => setActiveTab('shrine')}
          style={{ borderRadius: 0 }}
        >
          {race === 'vampire' ? '🪦 Mausoleum' : '⛩️ Shrine'}
        </button>
        <button
          className={clsx('base-btn admin-tab', activeTab === 'slibrary' && 'active')}
          onClick={() => setActiveTab('slibrary')}
          style={{ borderRadius: 0 }}
        >
          📖 Library
        </button>
      </div>

      {activeTab === 'tower' && (
        <TowerTab studiesData={studiesData} state={state} onUpgraded={handleTabUpgraded} />
      )}

      {activeTab === 'school' && (
        <SchoolTab
          studiesData={studiesData}
          state={state}
          onUpgraded={handleTabUpgraded}
          mages={mages}
          mageSpellbookValue={mageSpellbookValue}
          setMageSpellbookValue={setMageSpellbookValue}
          mageSchoolValue={mageSchoolValue}
          setMageSchoolValue={setMageSchoolValue}
          focus1Value={focus1Value}
          setFocus1Value={setFocus1Value}
          focus2Value={focus2Value}
          setFocus2Value={setFocus2Value}
          fetchStudiesData={fetchStudiesData}
        />
      )}

      {activeTab === 'shrine' && (
        <ShrineTab studiesData={studiesData} state={state} onUpgraded={handleTabUpgraded} />
      )}

      {activeTab === 'slibrary' && (
        <LibraryTab studiesData={studiesData} state={state} onUpgraded={handleTabUpgraded} />
      )}
    </div>
  );
};

export default StudiesPanel;
