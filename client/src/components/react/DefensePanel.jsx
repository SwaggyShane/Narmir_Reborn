import React, { useCallback, useEffect, useState } from 'react';
import { apiCall } from '../../utils/api';
import { useGameState } from '../../hooks/useGameState';
import { fmt } from "../../utils/fmt";
import { applyGameMutation } from '../../utils/gameMutations.js';

const DefensePanel = () => {
  const { state } = useGameState();
  const [activeTab, setActiveTab] = useState('walls');

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
  };

  const refreshDefense = useCallback(async () => {
    const data = await apiCall('/api/kingdom/defense/overview');
    if (data?.error) {
      toast(data.error, 'error');
      return;
    }

    const race = state?.race || 'human';

    const el = (id) => document.getElementById(id);
    const fmt = (value) => {
      const n = Number(value || 0);
      return Number.isFinite(n) ? Math.round(n).toLocaleString() : '0';
    };

    if (el('def-rating')) el('def-rating').textContent = data.defense_rating || '—';

    const du = data.defense_upgrades || {};
    let statusText = 'Not fortified';
    let statusColor = 'var(--text3)';
    let targetWalls = 100;
    let targetTowers = 10;
    let targetOutposts = 10;
    let targetCastles = 0;

    if (du.citadel) {
      statusText = '👑 CITADEL ACHIEVED';
      statusColor = 'var(--gold)';
      targetWalls = 1000;
      targetTowers = 500;
      targetOutposts = 500;
      targetCastles = 1;
    } else if (du.keep) {
      statusText = '🏰 KEEP ACHIEVED';
      statusColor = 'var(--gold)';
      targetWalls = 1000;
      targetTowers = 500;
      targetOutposts = 500;
      targetCastles = 1;
    } else if (du.fortified) {
      statusText = '🛡️ FORTIFIED ACHIEVED';
      statusColor = 'var(--gold)';
      targetWalls = 500;
      targetTowers = 50;
      targetOutposts = 50;
      targetCastles = 0;
    }

    if (el('tier-status')) {
      el('tier-status').textContent = statusText;
      el('tier-status').style.color = statusColor;
    }

    const setBar = (id, val, max) => {
      const node = el(id);
      if (!node) return;
      node.textContent = fmt(val);
      node.style.color = val >= max
        ? 'var(--gold)'
        : val >= Math.floor(max * 0.5)
          ? 'var(--green)'
          : 'var(--text2)';
      const maxEl = el(`${id}-max`);
      if (maxEl) maxEl.textContent = `/ ${fmt(max)}`;
    };

    setBar('cit-walls', data.bld_walls || 0, targetWalls);
    setBar('cit-towers', data.bld_guard_towers || 0, targetTowers);
    setBar('cit-outposts', data.bld_outposts || 0, targetOutposts);
    setBar('cit-castle', data.bld_castles || 0, targetCastles);

    if (el('def-walls')) el('def-walls').textContent = fmt(data.bld_walls || 0);
    if (el('def-wm-walls')) el('def-wm-walls').textContent = fmt(data.wm_on_walls || 0);
    if (el('def-wall-power')) el('def-wall-power').textContent = fmt(data.wall_power || 0);
    if (el('def-wall-race')) el('def-wall-race').textContent = `×${(window.WALL_RACE_MULT?.[race] || 1.0).toFixed(2)}`;

    if (el('def-gtowers')) el('def-gtowers').textContent = fmt(data.bld_guard_towers || 0);
    if (el('def-thieves-watch')) el('def-thieves-watch').textContent = fmt(data.thieves_on_watch || 0);
    if (el('def-tower-cap')) el('def-tower-cap').textContent = fmt((data.bld_guard_towers || 0) * 10);
    if (el('def-tower-power')) el('def-tower-power').textContent = fmt(data.tower_power || 0);
    if (el('def-tower-race')) el('def-tower-race').textContent = `×${(window.TOWER_RACE_MULT?.[race] || 1.0).toFixed(2)}`;

    if (el('def-outposts')) el('def-outposts').textContent = fmt(data.bld_outposts || 0);
    if (el('def-rangers-patrol')) el('def-rangers-patrol').textContent = fmt(data.rangers_on_patrol || 0);
    if (el('def-outpost-cap')) el('def-outpost-cap').textContent = fmt((data.bld_outposts || 0) * 20);
    if (el('def-outpost-power')) el('def-outpost-power').textContent = fmt(data.outpost_power || 0);
    if (el('def-outpost-race')) el('def-outpost-race').textContent = `×${(window.OUTPOST_RACE_MULT?.[race] || 1.0).toFixed(2)}`;

    window.renderUpgrades?.('wall', window.WALL_UPGRADES_JS || {}, data.wall_upgrades || {}, 'wall-upgrade-list');
    window.renderUpgrades?.('tower_def', window.TOWER_DEF_UPGRADES_JS || {}, data.tower_def_upgrades || {}, 'tower-def-upgrade-list');
    window.renderUpgrades?.('outpost', window.OUTPOST_UPGRADES_JS || {}, data.outpost_upgrades || {}, 'outpost-upgrade-list');
  }, [state?.race]);

  useEffect(() => {
    refreshDefense();
  }, [refreshDefense]);

  return (
    <div id="defense" className="panel min-h-0 w-full overflow-y-auto px-4 pb-5" style={{ display: 'none' }}>
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-950/80 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="card-title mb-1 flex items-center gap-2">
            <span>??? Defense</span>
            <span
              id="citadel-badge-title"
              className="hidden rounded-full bg-[var(--gold)]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--gold)]"
            >
              ?? Citadel
            </span>
          </div>
          <div className="text-[13px] text-[var(--text3)]">
            Rating: <span id="def-rating" className="font-bold">?</span>
          </div>
        </div>
        <button className="base-btn rounded-full px-3 py-1.5 text-[11px] font-semibold" onClick={refreshDefense}>? Refresh</button>
      </div>

      <div className="card mb-3 rounded-2xl border border-white/10 bg-zinc-950/80" id="defense-tiers-card">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="card-title m-0">??? Defense Tiers</div>
          <span id="tier-status" className="text-[12px] text-[var(--text3)]">Evaluating...</span>
        </div>
        <div id="tier-desc" className="mb-3 text-[12px] text-[var(--text3)]">
          Build walls, guard towers, outposts, and castles to reach new tiers and
          gain permanent defense and mitigation bonuses.
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-[var(--bg3)] p-2 text-center">
            <div className="mb-1 text-[10px] text-[var(--text3)]">WALLS</div>
            <div className="text-[16px] font-bold" id="cit-walls">0</div>
            <div className="text-[10px] text-[var(--text3)]" id="cit-walls-max">/ 500</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-[var(--bg3)] p-2 text-center">
            <div className="mb-1 text-[10px] text-[var(--text3)]">TOWERS</div>
            <div className="text-[16px] font-bold" id="cit-towers">0</div>
            <div className="text-[10px] text-[var(--text3)]" id="cit-towers-max">/ 50</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-[var(--bg3)] p-2 text-center">
            <div className="mb-1 text-[10px] text-[var(--text3)]">OUTPOSTS</div>
            <div className="text-[16px] font-bold" id="cit-outposts">0</div>
            <div className="text-[10px] text-[var(--text3)]" id="cit-outposts-max">/ 50</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-[var(--bg3)] p-2 text-center">
            <div className="mb-1 text-[10px] text-[var(--text3)]">CASTLE</div>
            <div className="text-[16px] font-bold" id="cit-castle">0</div>
            <div className="text-[10px] text-[var(--text3)]" id="cit-castle-max">/ 1</div>
          </div>
        </div>

        <div className="mt-3 grid gap-1.5 rounded-lg border border-white/10 bg-[var(--bg1)] p-2 text-[11px] text-[var(--text3)]">
          <div id="tier-1" className="flex justify-between p-1">
            <div className="font-semibold text-[var(--text2)]">??? Fortified</div>
            <div>100 Walls ? 10 Towers ? 10 Outposts</div>
          </div>
          <div id="tier-2" className="flex justify-between border-t border-[var(--border)] p-1">
            <div className="font-semibold text-[var(--text2)]">?? Keep</div>
            <div>350 Walls ? 30 Towers ? 30 Outposts</div>
          </div>
          <div id="tier-3" className="flex justify-between border-t border-[var(--border)] p-1">
            <div className="font-semibold text-[var(--text2)]">?? Citadel</div>
            <div>500 Walls ? 50 Towers ? 50 Outposts ? 1 Castle</div>
          </div>
        </div>
      </div>
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          marginBottom: '16px',
          borderBottom: '2px solid var(--border2)',
          paddingBottom: 0,
        }}
      >
        <button
          className={`base-btn admin-tab ${activeTab === 'walls' ? 'active' : ''}`}
          onClick={() => handleTabClick('walls')}
          style={{ borderRadius: '0' }}
        >
          🧱 Walls
        </button>
        <button
          className={`base-btn admin-tab ${activeTab === 'towers' ? 'active' : ''}`}
          onClick={() => handleTabClick('towers')}
          style={{ borderRadius: '0' }}
        >
          🗼 Guard Towers
        </button>
        <button
          className={`base-btn admin-tab ${activeTab === 'outposts' ? 'active' : ''}`}
          onClick={() => handleTabClick('outposts')}
          style={{ borderRadius: '0' }}
        >
          ⛺ Outposts
        </button>
      </div>

      {/* WALLS TAB */}
      <div style={{ display: activeTab === 'walls' ? 'block' : 'none' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '12px',
          }}
        >
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>
              Wall overview
            </div>
            <div className="trow">
              <span className="name">Walls built</span>
              <span className="count" id="def-walls">0</span>
            </div>
            <div className="trow">
              <span className="name">War machines mounted</span>
              <span className="count" id="def-wm-walls" style={{ color: 'var(--gold)' }}>
                0
              </span>
            </div>
            <div className="trow">
              <span className="name">Wall defense power</span>
              <span className="count" id="def-wall-power" style={{ color: 'var(--green)' }}>
                0
              </span>
            </div>
            <div className="trow">
              <span className="name">Race modifier</span>
              <span className="count" id="def-wall-race">×1.00</span>
            </div>
            <div
              className="trow"
              style={{
                borderTop: '1px solid var(--border2)',
                marginTop: '4px',
                paddingTop: '4px',
              }}
            >
              <span className="name" style={{ color: 'var(--amber)', fontSize: '11px' }}>
                No walls = buildings can be damaged by attackers
              </span>
            </div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>
              Wall upgrades
            </div>
            <div id="wall-upgrade-list"></div>
          </div>
        </div>
      </div>

      {/* GUARD TOWERS TAB */}
      <div style={{ display: activeTab === 'towers' ? 'block' : 'none' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '12px',
          }}
        >
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>
              Guard Tower overview
            </div>
            <div className="trow">
              <span className="name">Guard towers</span>
              <span className="count" id="def-gtowers">0</span>
            </div>
            <div className="trow">
              <span className="name">Thieves on watch</span>
              <span
                className="count"
                id="def-thieves-watch"
                style={{ color: 'var(--amber)' }}
              >
                0
              </span>
            </div>
            <div className="trow">
              <span className="name">Max capacity</span>
              <span className="count" id="def-tower-cap">0</span>
            </div>
            <div className="trow">
              <span className="name">Tower defense power</span>
              <span
                className="count"
                id="def-tower-power"
                style={{ color: 'var(--green)' }}
              >
                0
              </span>
            </div>
            <div className="trow">
              <span className="name">Detection modifier</span>
              <span className="count" id="def-tower-race">×1.00</span>
            </div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>
              Tower upgrades
            </div>
            <div id="tower-def-upgrade-list"></div>
          </div>
        </div>
      </div>

      {/* OUTPOSTS TAB */}
      <div style={{ display: activeTab === 'outposts' ? 'block' : 'none' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '12px',
          }}
        >
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>
              Outpost overview
            </div>
            <div className="trow">
              <span className="name">Outposts</span>
              <span className="count" id="def-outposts">0</span>
            </div>
            <div className="trow">
              <span className="name">Rangers on patrol</span>
              <span
                className="count"
                id="def-rangers-patrol"
                style={{ color: 'var(--blue)' }}
              >
                0
              </span>
            </div>
            <div className="trow">
              <span className="name">Max capacity</span>
              <span className="count" id="def-outpost-cap">0</span>
            </div>
            <div className="trow">
              <span className="name">Outpost defense power</span>
              <span
                className="count"
                id="def-outpost-power"
                style={{ color: 'var(--green)' }}
              >
                0
              </span>
            </div>
            <div className="trow">
              <span className="name">Patrol modifier</span>
              <span className="count" id="def-outpost-race">×1.00</span>
            </div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>
              Outpost upgrades
            </div>
            <div id="outpost-upgrade-list"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DefensePanel;
