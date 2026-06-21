import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from '../../utils/toast.js';
import { apiCall } from '../../utils/api';
import { useGameState } from '../../hooks/useGameState';
import WarfareIntelTab from './WarfareIntelTab';
import WarfareReportsTab from './WarfareReportsTab';
import { fmt } from "../../utils/fmt";
import { applyGameMutation } from '../../utils/gameMutations.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

function parseDisc(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
}

// Merge ranked targets with discovered_kingdoms; optionally prepend self for spell tab.
function buildTargetList(targets, disc, state, { prependSelf = false } = {}) {
  const sourceTargets = Array.isArray(targets) ? targets : [];
  const discovered = disc && typeof disc === 'object' ? disc : {};
  const mapped = sourceTargets.filter((t) => t && discovered?.[t.id]?.mapped);

  Object.entries(discovered).forEach(([id, d]) => {
    if (
      d?.mapped &&
      !mapped.find((f) => String(f.id) === String(id)) &&
      String(id) !== String(state?.kingdomId)
    ) {
      mapped.push({
        id,
        name: d.name || `Kingdom #${id}`,
        race: d.race || 'unknown',
        level: d.level || 1,
        rank: d.rank || 'none',
        fighters: d.fighters || 0,
        land: d.land || 0,
        is_ai: d.is_ai || false,
        is_location: true,
      });
    }
  });

  if (prependSelf && !mapped.some((r) => String(r.id) === String(state?.kingdomId))) {
    mapped.unshift({
      id: state?.kingdomId,
      name: `${state?.kingdomName || state?.name || 'My Kingdom'} (You)`,
      race: state?.race || 'human',
      level: state?.level || 1,
      rank: state?.rank || '-',
      fighters: state?.fighters || 0,
      land: state?.land || 0,
      is_ai: false,
    });
  }

  return mapped;
}

function filterByQuery(list, q) {
  if (!q) return list;
  const lq = q.toLowerCase();
  return list.filter((t) => (t.name || '').toLowerCase().includes(lq));
}

// ─── sub-component: target card ───────────────────────────────────────────────

function KingdomTargetCard({ target, isSelected, onSelect }) {
  const raceIcon = (window.RACE_ICONS || {})[target.race] || '👤';
  return (
    <div id="warfare" className="panel panel-immersive min-h-0 w-full overflow-y-auto px-4 pb-5" style={{ display: 'none' }}>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-[var(--border2)] pb-1.5">
        <button className={`base-btn admin-tab rounded-none ${activeTab === 'attack' ? 'active' : ''}`} onClick={() => handleTabClick('attack')}>Attack</button>
        <button className={`base-btn admin-tab rounded-none ${activeTab === 'wspells' ? 'active' : ''}`} onClick={() => handleTabClick('wspells')}>Spells</button>
        <button className={`base-btn admin-tab rounded-none ${activeTab === 'wcovert' ? 'active' : ''}`} onClick={() => handleTabClick('wcovert')}>Covert</button>
        <button className={`base-btn admin-tab rounded-none ${activeTab === 'wintel' ? 'active' : ''}`} onClick={() => handleTabClick('wintel')}>Intel</button>
        <button className={`base-btn admin-tab rounded-none ${activeTab === 'wreports' ? 'active' : ''}`} onClick={() => handleTabClick('wreports')}>Reports</button>
      </div>

      <div className={activeTab === 'attack' ? 'block' : 'hidden'}>
        <div className="card mb-3 rounded-2xl border border-[var(--border)] bg-[var(--bg2)] p-4">
          <div className="card-title mb-2">Select Target</div>
          <TargetListSection
            targets={filteredAtkTargets}
            selected={selectedTarget}
            onSelect={setSelectedTarget}
            searchQ={atkSearchQ}
            onSearchChange={setAtkSearchQ}
            placeholder="Search kingdoms..."
          />
        </div>

        <div className="card rounded-2xl border border-[var(--border)] bg-[var(--bg2)] p-4" id="atk-panel-w">
          <div className="card-title mb-3">Warfare: Army Selection</div>
          <div className="mb-5 flex flex-col gap-1.5">
            <div className="trow">
              <span className="name text-[13px] font-bold">
                Fighters <span id="atk-fighters-avail-w" className="font-normal text-[var(--text3)]"></span>
              </span>
              <div className="flex items-center gap-1">
                <input type="number" className="input w-[90px] p-[6px] text-right" id="atk-fighters-w" min="0" defaultValue="0" onChange={updateAtkEstimateW} placeholder="Qty" />
                <button className="base-btn px-2 py-1 text-[10px]" onClick={() => setMaxValue('atk-fighters-w')}>MAX</button>
              </div>
            </div>
            <div className="trow">
              <span className="name text-[13px] font-bold">
                Rangers <span id="atk-rangers-avail-w" className="font-normal text-[var(--text3)]"></span>
              </span>
              <div className="flex items-center gap-1">
                <input type="number" className="input w-[90px] p-[6px] text-right" id="atk-rangers-w" min="0" defaultValue="0" onChange={updateAtkEstimateW} placeholder="Qty" />
                <button className="base-btn px-2 py-1 text-[10px]" onClick={() => setMaxValue('atk-rangers-w')}>MAX</button>
              </div>
            </div>
            <div className="trow">
              <span className="name text-[13px] font-bold">
                Mages <span id="atk-mages-avail-w" className="font-normal text-[var(--text3)]"></span>
              </span>
              <div className="flex items-center gap-1">
                <input type="number" className="input w-[90px] p-[6px] text-right" id="atk-mages-w" min="0" defaultValue="0" onChange={updateAtkEstimateW} placeholder="Qty" />
                <button className="base-btn px-2 py-1 text-[10px]" onClick={() => setMaxValue('atk-mages-w')}>MAX</button>
              </div>
            </div>
            <div className="trow">
              <span className="name text-[13px] font-bold">
                Clerics <span id="atk-clerics-avail-w" className="font-normal text-[var(--text3)]"></span>
              </span>
              <div className="flex items-center gap-1">
                <input type="number" className="input w-[90px] p-[6px] text-right" id="atk-clerics-w" min="0" defaultValue="0" onChange={updateAtkEstimateW} placeholder="Qty" />
                <button className="base-btn px-2 py-1 text-[10px]" onClick={() => setMaxValue('atk-clerics-w')}>MAX</button>
              </div>
            </div>
            <div className="mt-1 border-t border-[var(--border)] pt-2">
              <div className="trow">
                <span className="name text-[13px] font-bold">
                  War Machines <span id="atk-wm-avail-w" className="font-normal text-[var(--text3)]"></span>
                </span>
                <div className="flex items-center gap-1">
                  <input type="number" className="input w-[90px] p-[6px] text-right" id="atk-wm-w" min="0" defaultValue="0" onChange={updateAtkEstimateW} placeholder="Qty" />
                  <button className="base-btn px-2 py-1 text-[10px]" onClick={() => setMaxValue('atk-wm-w')}>MAX</button>
                </div>
              </div>
              <div className="trow">
                <span className="name text-[13px] font-bold">
                  Ladders <span id="atk-ladders-avail-w" className="font-normal text-[var(--text3)]"></span>
                </span>
                <div className="flex items-center gap-1">
                  <input type="number" className="input w-[90px] p-[6px] text-right" id="atk-ladders-w" min="0" defaultValue="0" onChange={updateAtkEstimateW} placeholder="Qty" />
                  <button className="base-btn px-2 py-1 text-[10px]" onClick={() => setMaxValue('atk-ladders-w')}>MAX</button>
                </div>
              </div>
            </div>
            <div className="mt-1 border-t border-[var(--border)] pt-2">
              <div className="trow">
                <span className="name text-[13px] font-bold">
                  Ninjas <span id="atk-ninjas-avail-w" className="font-normal text-[var(--text3)]"></span>
                </span>
                <div className="flex items-center gap-1">
                  <input type="number" className="input w-[90px] p-[6px] text-right" id="atk-ninjas-w" min="0" defaultValue="0" onChange={updateAtkEstimateW} placeholder="Qty" />
                  <button className="base-btn px-2 py-1 text-[10px]" onClick={() => setMaxValue('atk-ninjas-w')}>MAX</button>
                </div>
              </div>
            </div>
            <button className="btn btn-red mt-2 font-bold" onClick={launchAttackW}>Launch Attack</button>
          </div>
        </div>
      </div>

      <div className={activeTab === 'wspells' ? 'block' : 'hidden'}>
        <div className="card mb-3 rounded-2xl border border-[var(--border)] bg-[var(--bg2)] p-4">
          <div className="card-title mb-2">Select Target</div>
          <TargetListSection
            targets={filteredWspTargets}
            selected={selectedTarget}
            onSelect={setSelectedTarget}
            searchQ={wspSearchQ}
            onSearchChange={setWspSearchQ}
            placeholder="Search kingdoms..."
          />
        </div>
        <div className="card rounded-2xl border border-[var(--border)] bg-[var(--bg2)] p-4">
          <div className="card-title">Warfare Spells</div>
          <div className="mt-3">
            <button className="base-btn" onClick={castWspell}>Prepare Spell Targeting</button>
            <button className="base-btn ml-2" onClick={updateWspellCalc}>Refresh Spell Estimates</button>
          </div>
        </div>
      </div>

      <div className={activeTab === 'wcovert' ? 'block' : 'hidden'}>
        <div className="card mb-3 rounded-2xl border border-[var(--border)] bg-[var(--bg2)] p-4">
          <div className="card-title mb-2">Select Target</div>
          <TargetListSection
            targets={filteredWcovTargets}
            selected={selectedTarget}
            onSelect={setSelectedTarget}
            searchQ={wcovSearchQ}
            onSearchChange={setWcovSearchQ}
            placeholder="Search kingdoms..."
          />
        </div>
        <div className="card rounded-2xl border border-[var(--border)] bg-[var(--bg2)] p-4">
          <div className="card-title">Warfare Covert Ops</div>
          <div className="mt-3">
            <button className="base-btn" onClick={() => doWcovert('spy')}>Spy</button>
            <button className="base-btn ml-2" onClick={() => doWcovert('loot')}>Loot</button>
            <button className="base-btn ml-2" onClick={() => doWcovert('assassinate')}>Assassinate</button>
            <button className="base-btn ml-2" onClick={() => doWcovert('sabotage')}>Sabotage</button>
          </div>
        </div>
      </div>

      <div className={activeTab === 'wintel' ? 'block' : 'hidden'}>
        <WarfareIntelTab
          isActive
          spyContent={spyReportsContent}
          allianceContent={allianceIntelContent}
          onRefreshSpyReports={loadSpyReports}
          onRefreshAllianceIntel={loadAllianceIntel}
        />
      </div>

      <div className={activeTab === 'wreports' ? 'block' : 'hidden'}>
        <WarfareReportsTab
          isActive
          content={warLogContent}
          onRefresh={loadWarLog}
        />
      </div>
    </div>
  );
};

export default WarfarePanel;
