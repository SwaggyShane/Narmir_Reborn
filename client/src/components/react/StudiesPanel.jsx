import React, { useState, useCallback, useMemo, useEffect } from 'react';
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

const TAB_CONFIG = [
  { id: 'tower', label: '🗼 Tower' },
  { id: 'school', label: '🏫 School' },
  { id: 'shrine', label: '⛩️ Shrine', vampireLabel: '🪦 Mausoleum', buttonId: 'studies-tab-shrine-btn' },
  { id: 'slibrary', label: '📖 Library' },
];

const SYNC_BUTTON_CLASS = 'base-btn px-2 py-1 text-[11px] disabled:opacity-60 opacity-70';

const StudiesPanel = () => {
  const [activeTab, setActiveTab] = useState('tower');
  const [schoolForm, setSchoolForm] = useState({
    mageSpellbookValue: 0,
    mageSchoolValue: 0,
    focus1Value: 'economy',
    focus2Value: 'weapons',
  });

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

  // Phase 3A: Zustand-driven refetch (dual source - listener is safety net)
  useEffect(() => {
    fetchStudiesData();
  }, [schoolOfMagic, resEconomy, resWeapons, resArmor, fetchStudiesData]);

  useGameMutationEvents(useCallback((event) => {
    if (String(event?.reason || '') === 'economy-upgrade') {
      fetchStudiesData();
    }
  }, [fetchStudiesData]));

  const handleTabUpgraded = useCallback((category, nextOwned) => {
    syncUpgrades(category, nextOwned);
    fetchStudiesData();
  }, [syncUpgrades, fetchStudiesData]);

  const updateSchoolForm = useCallback((key, value) => {
    setSchoolForm((prev) => ({ ...prev, [key]: value }));
  }, []);

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
          className={SYNC_BUTTON_CLASS}
          onClick={loadStudies}
          disabled={isRefreshing}
        >
          {isRefreshing ? '⟳ Syncing...' : '↻ Sync'}
        </button>
      </div>

      <div className="flex flex-wrap gap-1 mb-4 border-b-2 border-[var(--border2)] pb-0">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            id={tab.buttonId}
            className={`base-btn admin-tab ${activeTab === tab.id ? 'active' : ''} rounded-none`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.id === 'shrine' && race === 'vampire' ? tab.vampireLabel : tab.label}
          </button>
        ))}
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
          mageSpellbookValue={schoolForm.mageSpellbookValue}
          setMageSpellbookValue={(value) => updateSchoolForm('mageSpellbookValue', value)}
          mageSchoolValue={schoolForm.mageSchoolValue}
          setMageSchoolValue={(value) => updateSchoolForm('mageSchoolValue', value)}
          focus1Value={schoolForm.focus1Value}
          setFocus1Value={(value) => updateSchoolForm('focus1Value', value)}
          focus2Value={schoolForm.focus2Value}
          setFocus2Value={(value) => updateSchoolForm('focus2Value', value)}
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
