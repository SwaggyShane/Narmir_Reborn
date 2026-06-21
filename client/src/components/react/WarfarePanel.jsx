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
  const mapped = targets.filter((t) => disc[t.id]?.mapped);

  Object.entries(disc).forEach(([id, d]) => {
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
    <div
      className={`target-row${isSelected ? ' selected' : ''}`}
      style={{ marginBottom: '4px', cursor: 'pointer' }}
      onClick={() => onSelect(target)}
    >
      <span style={{ fontSize: '18px', marginRight: '10px' }}>
        {target.is_location ? '📍' : raceIcon}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: 'var(--text)' }}>
          {target.name}{target.is_ai ? ' (AI)' : ''}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text3)' }}>
          {target.is_location
            ? 'Discovered Site'
            : `Lv ${target.level} · ${(target.race || '').replace(/_/g, ' ')}`}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '12px', color: 'var(--gold)', fontWeight: 600 }}>
          {target.is_location ? '???' : fmt(target.land)} ac
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text3)' }}>#{target.rank || '?'}</div>
      </div>
    </div>
  );
}

// ─── target list section ──────────────────────────────────────────────────────

function TargetListSection({ targets, selected, onSelect, searchQ, onSearchChange, placeholder }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <input
        type="text"
        className="input"
        placeholder={placeholder || 'Search kingdoms…'}
        value={searchQ}
        onChange={(e) => onSearchChange(e.target.value)}
        style={{ width: '100%', marginBottom: '8px', padding: '6px 10px', fontSize: '13px' }}
      />
      {selected && (
        <div style={{
          padding: '8px 10px', marginBottom: '8px', borderRadius: 'var(--radius)',
          background: 'var(--bg2)', border: '1px solid var(--accent)', fontSize: '13px',
        }}>
          <span style={{ color: 'var(--text3)', marginRight: '6px' }}>Target:</span>
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>{selected.name}</span>
          <span style={{ color: 'var(--text3)', marginLeft: '8px', fontSize: '11px' }}>
            {selected.is_location ? '📍 Site' : `${fmt(selected.land)} ac · #${selected.rank || '?'}`}
          </span>
          <button
            className="base-btn"
            style={{ float: 'right', fontSize: '10px', padding: '2px 6px' }}
            onClick={() => onSelect(null)}
          >✕</button>
        </div>
      )}
      <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
        {targets.length === 0
          ? (
            <div style={{ color: 'var(--text3)', fontSize: '13px', padding: '16px', textAlign: 'center' }}>
              No mapped targets found.{' '}
              <button className="btn" style={{ fontSize: '11px' }} onClick={() => window.switchTab?.('exploration')}>
                Go Explore
              </button>
            </div>
          )
          : targets.map((t) => (
            <KingdomTargetCard
              key={t.id}
              target={t}
              isSelected={selected && String(selected.id) === String(t.id)}
              onSelect={onSelect}
            />
          ))
        }
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

const WarfarePanel = () => {
  const { state } = useGameState();
  const [activeTab, setActiveTab] = useState('attack');

  // target data
  const [targets, setTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [atkSearchQ, setAtkSearchQ] = useState('');
  const [wspSearchQ, setWspSearchQ] = useState('');
  const [wcovSearchQ, setWcovSearchQ] = useState('');
  const [wcovTargetRace, setWcovTargetRace] = useState(null);

  // report data
  const [warLogRows, setWarLogRows] = useState([]);
  const [spyReports, setSpyReports] = useState([]);
  const [allianceIntel, setAllianceIntel] = useState([]);
  const [loadingWarLog, setLoadingWarLog] = useState(true);
  const [loadingSpyReports, setLoadingSpyReports] = useState(true);
  const [loadingAllianceIntel, setLoadingAllianceIntel] = useState(true);
  const [warLogError, setWarLogError] = useState('');
  const [spyError, setSpyError] = useState('');
  const [allianceError, setAllianceError] = useState('');

  // Keep window.selectedTargetW in sync for vanilla interop (wspells, wcovert still use it)
  useEffect(() => {
    window.selectedTargetW = selectedTarget;
  }, [selectedTarget]);

  // Derived: disc kingdoms parsed from state
  const disc = useMemo(() => parseDisc(state?.discovered_kingdoms), [state?.discovered_kingdoms]);

  // Filtered target lists per tab
  const filteredAtkTargets = useMemo(
    () => filterByQuery(buildTargetList(targets, disc, state), atkSearchQ),
    [targets, disc, state, atkSearchQ],
  );
  const filteredWspTargets = useMemo(
    () => filterByQuery(buildTargetList(targets, disc, state, { prependSelf: true }), wspSearchQ),
    [targets, disc, state, wspSearchQ],
  );
  const filteredWcovTargets = useMemo(() => {
    const list = buildTargetList(targets, disc, state);
    const byRace = wcovTargetRace ? list.filter((t) => t.race === wcovTargetRace) : list;
    return filterByQuery(byRace, wcovSearchQ);
  }, [targets, disc, state, wcovTargetRace, wcovSearchQ]);

  const refreshAttackTargets = useCallback(async () => {
    try {
      const result = await apiCall('/api/kingdom/rankings');
      if (result?.error) throw new Error(result.error);

      const kingdoms = Array.isArray(result?.rankings) ? result.rankings : [];
      const mappedTargets = kingdoms
        .filter((row) => String(row.id) !== String(state?.kingdomId))
        .map((row) => ({
          id: row.id,
          name: row.name || 'Unknown',
          race: row.race || 'human',
          rank: row.rank || '?',
          land: row.land || 0,
          population: row.population || 0,
          fighters: row.fighters || 0,
          mages: row.mages || 0,
          level: row.level || 1,
          is_ai: row.is_ai || 0,
        }));

      window.rankingsCache = kingdoms;
      window.targets = mappedTargets;
      setTargets(mappedTargets);
    } catch (err) {
      console.error('[WarfarePanel] Failed to refresh attack targets:', err);
    }
  }, [state?.kingdomId]);

  const loadWarLog = useCallback(async () => {
    setLoadingWarLog(true);
    setWarLogError('');
    try {
      const result = await apiCall('/api/kingdom/war-log');
      if (result?.error) throw new Error(result.error);
      const rows = Array.isArray(result) ? result : Array.isArray(result?.rows) ? result.rows : [];
      window.warLogCache = rows;
      setWarLogRows(rows);
    } catch (err) {
      console.error('[WarfarePanel] Failed to load war log:', err);
      setWarLogError(err.message || 'Failed to load war log');
    } finally {
      setLoadingWarLog(false);
    }
  }, []);

  const loadSpyReports = useCallback(async () => {
    setLoadingSpyReports(true);
    setSpyError('');
    try {
      const result = await apiCall('/api/kingdom/spy-reports');
      if (result?.error) throw new Error(result.error);
      setSpyReports(Array.isArray(result) ? result : []);
      window.spyReportsCache = Array.isArray(result) ? result : [];
    } catch (err) {
      console.error('[WarfarePanel] Failed to load spy reports:', err);
      setSpyError(err.message || 'Failed to load spy reports');
    } finally {
      setLoadingSpyReports(false);
    }
  }, []);

  const loadAllianceIntel = useCallback(async () => {
    setLoadingAllianceIntel(true);
    setAllianceError('');
    try {
      const result = await apiCall('/api/kingdom/spy-reports/alliance');
      if (result?.error) throw new Error(result.error);
      setAllianceIntel(Array.isArray(result) ? result : []);
      window.allianceIntelCache = Array.isArray(result) ? result : [];
    } catch (err) {
      console.error('[WarfarePanel] Failed to load alliance intel:', err);
      setAllianceError(err.message || 'Failed to load alliance intel');
    } finally {
      setLoadingAllianceIntel(false);
    }
  }, []);

  useEffect(() => {
    const handleRaceChange = (e) => setWcovTargetRace(e.detail);
    window.addEventListener('wcovTargetRaceChange', handleRaceChange);
    window.setWarfareTab = setActiveTab;
    if (window.__pendingWarfareTab) {
      setActiveTab(window.__pendingWarfareTab);
      window.__pendingWarfareTab = null;
    }
    return () => {
      window.removeEventListener('wcovTargetRaceChange', handleRaceChange);
      delete window.setWarfareTab;
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'attack') {
      refreshAttackTargets();
    } else if (activeTab === 'wreports') {
      loadWarLog();
    } else if (activeTab === 'wintel') {
      loadSpyReports();
      loadAllianceIntel();
    } else if ((activeTab === 'wspells' || activeTab === 'wcovert') && targets.length === 0) {
      refreshAttackTargets();
    }
  }, [activeTab, loadAllianceIntel, loadSpyReports, loadWarLog, refreshAttackTargets, targets.length]);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'wspells' && window.initWspells) window.initWspells();
    if (tabId === 'wcovert' && window.initWcovert) window.initWcovert();
  };

  const updateAtkEstimateW = useCallback(() => {
    const fmtN = (value) => {
      const n = Number(value || 0);
      return Number.isFinite(n) ? Math.round(n).toLocaleString() : '0';
    };

    const setAvail = (id, val) => {
      const node = document.getElementById(id);
      if (node) node.textContent = `(${fmtN(val)})`;
    };

    setAvail('atk-fighters-avail-w', state?.fighters || 0);
    setAvail('atk-rangers-avail-w', state?.rangers || 0);
    setAvail('atk-mages-avail-w', state?.mages || 0);
    setAvail('atk-wm-avail-w', state?.war_machines || 0);
    setAvail('atk-ninjas-avail-w', state?.ninjas || 0);
    setAvail('atk-thieves-avail-w', state?.thieves || 0);
    setAvail('atk-clerics-avail-w', (state?.clerics || 0) + (state?.thralls || 0));
    setAvail('atk-engineers-avail-w', state?.engineers || 0);
    setAvail('atk-ladders-avail-w', state?.ladders || 0);

    const f = parseInt(document.getElementById('atk-fighters-w')?.value, 10) || 0;
    const rn = parseInt(document.getElementById('atk-rangers-w')?.value, 10) || 0;
    const m = parseInt(document.getElementById('atk-mages-w')?.value, 10) || 0;
    const wm = parseInt(document.getElementById('atk-wm-w')?.value, 10) || 0;
    const ld = parseInt(document.getElementById('atk-ladders-w')?.value, 10) || 0;
    const cle = parseInt(document.getElementById('atk-clerics-w')?.value, 10) || 0;
    const eng = parseInt(document.getElementById('atk-engineers-w')?.value, 10) || 0;
    if (f + rn + m + wm + ld + cle + eng === 0) return;

    const target = selectedTarget;
    const engLvlArray = state?.troop_levels?.engineers?.level || 1;
    const baseCrew = state?.race === 'human' ? 10 : state?.race === 'dwarf' ? 8 : 12;
    const crewReq = Math.max(1, Math.round(baseCrew * (1 - Math.min(0.5, (engLvlArray - 1) / 100))));
    const totalEng = (state?.engineers || 0) + eng;
    const wmCrewable = Math.min(wm, Math.floor(totalEng / crewReq));
    const weaponBonus = 1 + Math.min(1, (state?.weapons_stockpile || 0) / Math.max(f, 1)) * 0.25;
    const atkF = f * ((state?.res_weapons || 100) / 100) * weaponBonus * ((state?.res_military || 100) / 100);
    const atkRn = rn * 0.7 * ((state?.res_military || 100) / 100);
    const atkM = m * 2.5 * ((state?.res_attack_magic || 100) / 100);
    const atkWm = wmCrewable * 500 * ((state?.res_war_machines || 100) / 100);
    const happiness = state?.happiness !== undefined && state?.happiness !== null ? state.happiness : 50;
    const mMult = Math.max(0.5, Math.min(1.5, 0.5 + happiness / 120));
    let bullyRatio = target
      ? Math.max(
        (state?.land || 1) / Math.max(1, target.land || 1),
        ((state?.fighters || 1) / Math.max(1, target.fighters || 1)) * 0.5,
      )
      : 0;
    if (target && target.is_ai) bullyRatio = 1.0;
    const bullyPenalty = bullyRatio >= 8 ? 0.4 : bullyRatio >= 4 ? 0.6 : bullyRatio >= 2 ? 0.8 : 1.0;
    const bullyMsg = bullyRatio >= 8
      ? '🚨 ×8+ — will be shamed. −60% power.'
      : bullyRatio >= 4
        ? '⚠️ ×4–8 — happiness suffers. −40%.'
        : bullyRatio >= 2
          ? '⚠️ ×2–4 — −20% power.'
          : '';
    const atkPower = Math.round((atkF + atkRn + atkM + atkWm) * mMult * bullyPenalty);
    const defPower = target
      ? Math.round((target.fighters || 0) * 1.0 + (target.mages || 0) * 1.5)
      : 0;
    const winPct = defPower > 0
      ? Math.min(95, Math.max(5, Math.round((atkPower / (atkPower + defPower)) * 100)))
      : 90;
    const winColor = winPct >= 60 ? 'var(--green)' : winPct >= 40 ? 'var(--amber)' : 'var(--red)';
    const land = target ? Math.floor((target.land || 0) * 0.1) : 0;
    const g = (id) => document.getElementById(id);

    if (g('atk-est-power-w')) {
      g('atk-est-power-w').textContent = fmtN(atkPower);
      g('atk-est-power-w').style.color = winPct >= 50 ? 'var(--green)' : 'var(--amber)';
    }
    if (g('atk-est-def-w')) {
      g('atk-est-def-w').textContent = defPower > 0 ? `~${fmtN(defPower)} (est.)` : '—';
    }
    if (g('atk-est-winpct-w')) {
      g('atk-est-winpct-w').textContent = `${winPct}%`;
      g('atk-est-winpct-w').style.color = winColor;
    }
    if (g('atk-est-land-w')) {
      g('atk-est-land-w').textContent = land > 0 ? `+${fmtN(land)} ac` : '—';
    }
    if (g('atk-bully-warn-w')) {
      g('atk-bully-warn-w').style.display = bullyMsg ? 'block' : 'none';
      g('atk-bully-warn-w').textContent = bullyMsg;
    }
  }, [state, selectedTarget]);

  useEffect(() => {
    updateAtkEstimateW();
  }, [updateAtkEstimateW]);

  const setMaxValue = (inputId) => {
    const el = document.getElementById(inputId);
    if (!el) return;

    let val = 0;
    if (inputId.startsWith('atk-')) {
      let key = inputId.replace('atk-', '').replace('-w', '');
      if (key === 'wm') key = 'war_machines';
      val = Number(state?.[key] || 0);
    } else if (inputId.startsWith('spy-') || inputId.startsWith('wcov-spy-')) {
      val = Number(state?.thieves || 0) + Number(state?.ninjas || 0);
    } else if (inputId.startsWith('loot-') || inputId.startsWith('wcov-loot-')) {
      val = Number(state?.thieves || 0);
    } else if (inputId.startsWith('assn-') || inputId.startsWith('wcov-assn-')) {
      val = Number(state?.ninjas || 0);
    } else if (inputId.startsWith('sab-') || inputId.startsWith('wcov-sab-')) {
      val = Number(state?.thieves || 0);
    } else if (inputId.startsWith('raid-')) {
      val = Number(state?.thieves || 0);
    } else if (inputId.startsWith('exp-')) {
      val = inputId.includes('rangers') ? Number(state?.rangers || 0) : Number(state?.fighters || 0);
    } else {
      val = Number(state?.[inputId] || 0);
    }

    el.value = String(Math.max(0, val));
    if (el.oninput) el.oninput();
    if (el.onchange) el.onchange();
  };

  const launchAttackW = useCallback(async () => {
    if (!selectedTarget) {
      toast('Select a target kingdom first', 'error');
      return;
    }

    const fmtN = (value) => {
      const n = Number(value || 0);
      return Number.isFinite(n) ? Math.round(n).toLocaleString() : '0';
    };

    const f = parseInt(document.getElementById('atk-fighters-w')?.value, 10) || 0;
    const rn = parseInt(document.getElementById('atk-rangers-w')?.value, 10) || 0;
    const m = parseInt(document.getElementById('atk-mages-w')?.value, 10) || 0;
    const wm = parseInt(document.getElementById('atk-wm-w')?.value, 10) || 0;
    const ld = parseInt(document.getElementById('atk-ladders-w')?.value, 10) || 0;
    const nj = parseInt(document.getElementById('atk-ninjas-w')?.value, 10) || 0;
    const th = parseInt(document.getElementById('atk-thieves-w')?.value, 10) || 0;
    const cle = parseInt(document.getElementById('atk-clerics-w')?.value, 10) || 0;
    const eng = parseInt(document.getElementById('atk-engineers-w')?.value, 10) || 0;

    if (f + rn + m <= 0) return toast('Send at least some troops', 'error');
    if (f > (state?.fighters || 0)) return toast('Not enough fighters', 'error');
    if (rn > (state?.rangers || 0)) return toast('Not enough rangers', 'error');
    if (m > (state?.mages || 0)) return toast('Not enough mages', 'error');
    if (wm > (state?.war_machines || 0)) return toast('Not enough war machines', 'error');
    if (ld > (state?.ladders || 0)) return toast('Not enough 🪜 ladders', 'error');
    if (nj > (state?.ninjas || 0)) return toast('Not enough ninjas', 'error');
    if (th > (state?.thieves || 0)) return toast('Not enough thieves', 'error');
    if (cle > (state?.clerics || 0) + (state?.thralls || 0)) return toast('Not enough clerics/thralls', 'error');
    if (eng > (state?.engineers || 0)) return toast('Not enough engineers', 'error');

    const result = await apiCall('/api/kingdom/attack', {
      method: 'POST',
      body: {
        targetId: selectedTarget.id,
        fighters: f,
        rangers: rn,
        mages: m,
        warMachines: wm,
        ladders: ld,
        ninjas: nj,
        thieves: th,
        clerics: cle,
        engineers: eng,
      },
    });

    if (result?.error) {
      toast(result.error, 'error');
      return;
    }

    const r = result.report || {};
    const rows = [
      ['Outcome', r.win ? '🏆 Victory' : '❌ Repelled'],
      ['Land Seized', `+${fmtN(r.landTransferred || 0)} acres`],
      ['Your Power', fmtN(r.atkPower)],
      ['Enemy Power', fmtN(r.defPower)],
    ];

    if (r.ninjaKills > 0) rows.push(['Assassinations (Ninjas)', fmtN(r.ninjaKills)]);
    if (r.flankKills > 0) rows.push(['Flank Action', fmtN(r.flankKills)]);
    if (r.rangerKills > 0) rows.push(['Opening Volley', fmtN(r.rangerKills)]);
    if (r.thiefSabotage > 0) rows.push(['Enemy WM Disabled', fmtN(r.thiefSabotage)]);

    rows.push(['---', 'YOUR LOSSES']);
    if (r.atkFightersLost > 0) rows.push(['Fighters Lost', fmtN(r.atkFightersLost)]);
    if (r.atkRangersLost > 0) rows.push(['Rangers Lost', fmtN(r.atkRangersLost)]);
    if (r.atkMagesLost > 0) rows.push(['Mages Lost', fmtN(r.atkMagesLost)]);
    if (r.atkNinjasLost > 0) rows.push(['Ninjas Lost', fmtN(r.atkNinjasLost)]);
    if (r.atkClericsLost > 0) rows.push(['Clerics Lost', fmtN(r.atkClericsLost)]);
    if (r.atkThievesLost > 0) rows.push(['Thieves Lost', fmtN(r.atkThievesLost)]);
    if (r.atkEngineersLost > 0) rows.push(['Engineers Lost', fmtN(r.atkEngineersLost)]);
    if (r.atkWmLost > 0) rows.push(['War Machines Lost', fmtN(r.atkWmLost)]);

    rows.push(['---', 'ENEMY LOSSES']);
    if (r.defFightersLost > 0) rows.push(['Fighters Slain', fmtN(r.defFightersLost)]);
    if (r.defRangersLost > 0) rows.push(['Rangers Slain', fmtN(r.defRangersLost)]);
    if (r.defMagesLost > 0) rows.push(['Mages Slain', fmtN(r.defMagesLost)]);
    if (r.defNinjasLost > 0) rows.push(['Ninjas Slain', fmtN(r.defNinjasLost)]);
    if (r.defClericsLost > 0) rows.push(['Clerics Slain', fmtN(r.defClericsLost)]);
    if (r.defThievesLost > 0) rows.push(['Thieves Slain', fmtN(r.defThievesLost)]);
    if (r.defEngineersLost > 0) rows.push(['Engineers Slain', fmtN(r.defEngineersLost)]);
    if (r.defWmLost > 0) rows.push(['War Machines Slain', fmtN(r.defWmLost)]);
    if (r.wallsDestroyed > 0) rows.push(['Walls Destroyed', fmtN(r.wallsDestroyed)]);
    if (r.bullyMsg) rows.push(['⚠️ Penalty', r.bullyMsg]);

    applyGameMutation(result, { reason: 'attack' });
    window.showBattleReport?.({
      type: 'Military attack',
      target: selectedTarget.name,
      win: r.win,
      rows,
    });
    refreshAttackTargets();
  }, [refreshAttackTargets, state, selectedTarget]);

  const castWspell = () => {
    if (window.castWspell) window.castWspell();
  };

  const doWcovert = (type) => {
    if (window.doWcovert) window.doWcovert(type);
  };

  const updateWspellCalc = () => {
    if (window.updateWspellCalc) window.updateWspellCalc();
  };

  const fmtDate = (value) => {
    if (!value) return 'Just now';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Just now' : date.toLocaleString();
  };

  const renderDetail = (detail) => {
    if (!detail) return null;
    if (typeof detail === 'string') {
      const trimmed = detail.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          return JSON.stringify(JSON.parse(trimmed), null, 2);
        } catch {
          return detail;
        }
      }
      return detail;
    }
    try {
      return JSON.stringify(detail, null, 2);
    } catch {
      return String(detail);
    }
  };

  const warLogContent = useMemo(() => {
    if (loadingWarLog) {
      return <div style={{ color: 'var(--text3)', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>Loading...</div>;
    }
    if (warLogError) {
      return <div style={{ color: 'var(--red)', textAlign: 'center', padding: '20px' }}>{warLogError}</div>;
    }
    if (!warLogRows.length) {
      return (
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: '32px', marginBottom: '10px' }}>🕊️</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text2)', marginBottom: '6px' }}>It&apos;s been a quiet day.</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--red)' }}>BREAK SOME $#@&amp;!</div>
        </div>
      );
    }
    return warLogRows.map((row) => {
      const icon = ({
        attack: '⚔️',
        raid: '🛶',
        spy: '🕵️',
        loot: '💰',
        assassinate: '🗡️',
        sabotage: '🧨',
      })[row.action_type] || '⚔️';
      const outcome = row.outcome === 'victory' || row.outcome === 'success'
        ? 'Success'
        : row.outcome === 'caught'
          ? 'Caught'
          : 'Repelled';
      const outcomeColor = row.outcome === 'victory' || row.outcome === 'success'
        ? 'var(--green)'
        : row.outcome === 'caught'
          ? 'var(--amber)'
          : 'var(--text3)';
      return (
        <div key={row.id} style={{ borderBottom: '1px solid var(--border)', padding: '12px 4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <div style={{ color: 'var(--text)', fontWeight: 700 }}>
              <span style={{ marginRight: '8px' }}>{icon}</span>
              {row.action_type || 'event'} — {row.attacker_name || 'Unknown'} vs {row.defender_name || 'Unknown'}
            </div>
            <div style={{ color: outcomeColor, fontWeight: 700 }}>{outcome}</div>
          </div>
          {row.detail ? (
            <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', color: 'var(--text2)', fontSize: '12px' }}>{renderDetail(row.detail)}</pre>
          ) : null}
          <div style={{ marginTop: '6px', color: 'var(--text3)', fontSize: '11px' }}>{fmtDate(row.created_at)}</div>
        </div>
      );
    });
  }, [loadingWarLog, warLogError, warLogRows]);

  const spyReportsContent = useMemo(() => {
    if (loadingSpyReports) {
      return <div style={{ color: 'var(--text3)', padding: '20px', textAlign: 'center' }}>Loading spy reports...</div>;
    }
    if (spyError) {
      return <div style={{ color: 'var(--red)', padding: '20px', textAlign: 'center' }}>{spyError}</div>;
    }
    if (!spyReports.length) {
      return <div style={{ color: 'var(--text3)', padding: '20px', textAlign: 'center' }}>No reports yet. Send spies to gather intel.</div>;
    }
    return spyReports.map((row) => (
      <div key={row.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', marginBottom: '10px', background: 'var(--bg2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{row.target_name || 'Unknown target'}</div>
          <div style={{ color: 'var(--text3)', fontSize: '11px' }}>{fmtDate(row.created_at)}</div>
        </div>
        <div style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '8px' }}>{row.outcome || 'Unknown outcome'}</div>
        {row.report ? (
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text3)', fontSize: '12px' }}>{renderDetail(row.report)}</pre>
        ) : null}
        <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: row.shared_to_alliance ? 'var(--green)' : 'var(--text3)', fontSize: '11px' }}>
            {row.shared_to_alliance ? 'Shared to alliance' : 'Private report'}
          </span>
          <button
            className="btn btn-accent"
            style={{ fontSize: '11px', padding: '4px 10px' }}
            onClick={async () => {
              const res = await apiCall(`/api/kingdom/spy-reports/${row.id}/share`, { method: 'POST' });
              if (res?.error) {
                toast(res.error, 'error');
                return;
              }
              toast(res.shared ? 'Report shared to alliance' : 'Report hidden from alliance', 'success');
              loadSpyReports();
              loadAllianceIntel();
            }}
          >
            {row.shared_to_alliance ? 'Unshare' : 'Share'}
          </button>
        </div>
      </div>
    ));
  }, [loadingSpyReports, spyError, spyReports, loadAllianceIntel, loadSpyReports]);

  const allianceIntelContent = useMemo(() => {
    if (loadingAllianceIntel) {
      return <div style={{ color: 'var(--text3)', padding: '20px', textAlign: 'center' }}>Loading alliance intel...</div>;
    }
    if (allianceError) {
      return <div style={{ color: 'var(--red)', padding: '20px', textAlign: 'center' }}>{allianceError}</div>;
    }
    if (!allianceIntel.length) {
      return <div style={{ color: 'var(--text3)', padding: '20px', textAlign: 'center' }}>No shared reports in your alliance.</div>;
    }
    return allianceIntel.map((row) => (
      <div key={row.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', marginBottom: '10px', background: 'var(--bg2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{row.target_name || 'Unknown target'}</div>
          <div style={{ color: 'var(--text3)', fontSize: '11px' }}>{fmtDate(row.created_at)}</div>
        </div>
        <div style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '8px' }}>
          Shared by {row.shared_by_name || 'an ally'} · {row.outcome || 'Unknown outcome'}
        </div>
        {row.report ? (
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text3)', fontSize: '12px' }}>{renderDetail(row.report)}</pre>
        ) : null}
      </div>
    ));
  }, [allianceError, allianceIntel, loadingAllianceIntel]);

  return (
    <div id="warfare" className="panel" style={{ display: 'none' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', borderBottom: '2px solid var(--border2)', marginBottom: '16px', paddingBottom: '4px' }}>
        <button className={`base-btn admin-tab ${activeTab === 'attack' ? 'active' : ''}`} onClick={() => handleTabClick('attack')} style={{ borderRadius: 0 }}>⚔️ Attack</button>
        <button className={`base-btn admin-tab ${activeTab === 'wspells' ? 'active' : ''}`} onClick={() => handleTabClick('wspells')} style={{ borderRadius: 0 }}>✨ Spells</button>
        <button className={`base-btn admin-tab ${activeTab === 'wcovert' ? 'active' : ''}`} onClick={() => handleTabClick('wcovert')} style={{ borderRadius: 0 }}>🕵️ Covert</button>
        <button className={`base-btn admin-tab ${activeTab === 'wintel' ? 'active' : ''}`} onClick={() => handleTabClick('wintel')} style={{ borderRadius: 0 }}>📊 Intel</button>
        <button className={`base-btn admin-tab ${activeTab === 'wreports' ? 'active' : ''}`} onClick={() => handleTabClick('wreports')} style={{ borderRadius: 0 }}>📝 Reports</button>
      </div>

      <WarfareReportsTab
        isActive={activeTab === 'wreports'}
        content={warLogContent}
        onRefresh={loadWarLog}
      />

      <WarfareIntelTab
        isActive={activeTab === 'wintel'}
        spyContent={spyReportsContent}
        allianceContent={allianceIntelContent}
        onRefreshSpyReports={loadSpyReports}
        onRefreshAllianceIntel={loadAllianceIntel}
      />

      {/* ── Attack tab ─────────────────────────────────────────────────────── */}
      <div style={{ display: activeTab === 'attack' ? 'block' : 'none' }}>
        <div className="card" style={{ marginBottom: '12px' }}>
          <div className="card-title" style={{ marginBottom: '8px' }}>Select Target</div>
          <TargetListSection
            targets={filteredAtkTargets}
            selected={selectedTarget}
            onSelect={setSelectedTarget}
            searchQ={atkSearchQ}
            onSearchChange={setAtkSearchQ}
            placeholder="Search kingdoms…"
          />
        </div>

        <div className="card" id="atk-panel-w">
          <div className="card-title" style={{ marginBottom: '12px' }}>Warfare: Army Selection</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
            <div className="trow">
              <span className="name" style={{ fontSize: '13px', fontWeight: 700 }}>
                ⚔️ Fighters <span id="atk-fighters-avail-w" style={{ color: 'var(--text3)', fontWeight: 400 }}></span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="number" className="input" id="atk-fighters-w" min="0" defaultValue="0" style={{ textAlign: 'right', width: '90px', padding: '6px' }} onChange={updateAtkEstimateW} placeholder="Qty" />
                <button className="base-btn" style={{ fontSize: '10px', padding: '6px 8px' }} onClick={() => setMaxValue('atk-fighters-w')}>MAX</button>
              </div>
            </div>
            <div className="trow">
              <span className="name" style={{ fontSize: '13px', fontWeight: 700 }}>
                🏹 Rangers <span id="atk-rangers-avail-w" style={{ color: 'var(--text3)', fontWeight: 400 }}></span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="number" className="input" id="atk-rangers-w" min="0" defaultValue="0" style={{ textAlign: 'right', width: '90px', padding: '6px' }} onChange={updateAtkEstimateW} placeholder="Qty" />
                <button className="base-btn" style={{ fontSize: '10px', padding: '6px 8px' }} onClick={() => setMaxValue('atk-rangers-w')}>MAX</button>
              </div>
            </div>
            <div className="trow">
              <span className="name" style={{ fontSize: '13px', fontWeight: 700 }}>
                ✨ Mages <span id="atk-mages-avail-w" style={{ color: 'var(--text3)', fontWeight: 400 }}></span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="number" className="input" id="atk-mages-w" min="0" defaultValue="0" style={{ textAlign: 'right', width: '90px', padding: '6px' }} onChange={updateAtkEstimateW} placeholder="Qty" />
                <button className="base-btn" style={{ fontSize: '10px', padding: '6px 8px' }} onClick={() => setMaxValue('atk-mages-w')}>MAX</button>
              </div>
            </div>
            <div className="trow">
              <span className="name" style={{ fontSize: '13px', fontWeight: 700 }}>
                ⛪ Clerics <span id="atk-clerics-avail-w" style={{ color: 'var(--text3)', fontWeight: 400 }}></span>
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="number" className="input" id="atk-clerics-w" min="0" defaultValue="0" style={{ textAlign: 'right', width: '90px', padding: '6px' }} onChange={updateAtkEstimateW} placeholder="Qty" />
                <button className="base-btn" style={{ fontSize: '10px', padding: '6px 8px' }} onClick={() => setMaxValue('atk-clerics-w')}>MAX</button>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
              <div className="trow">
                <span className="name" style={{ fontSize: '13px', fontWeight: 700 }}>
                  ⚙️ War Machines <span id="atk-wm-avail-w" style={{ color: 'var(--text3)', fontWeight: 400 }}></span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="number" className="input" id="atk-wm-w" min="0" defaultValue="0" style={{ textAlign: 'right', width: '90px', padding: '6px' }} onChange={updateAtkEstimateW} placeholder="Qty" />
                  <button className="base-btn" style={{ fontSize: '10px', padding: '6px 8px' }} onClick={() => setMaxValue('atk-wm-w')}>MAX</button>
                </div>
              </div>
              <div className="trow">
                <span className="name" style={{ fontSize: '13px', fontWeight: 700 }}>
                  🪜 Ladders <span id="atk-ladders-avail-w" style={{ color: 'var(--text3)', fontWeight: 400 }}></span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="number" className="input" id="atk-ladders-w" min="0" defaultValue="0" style={{ textAlign: 'right', width: '90px', padding: '6px' }} onChange={updateAtkEstimateW} placeholder="Qty" />
                  <button className="base-btn" style={{ fontSize: '10px', padding: '6px 8px' }} onClick={() => setMaxValue('atk-ladders-w')}>MAX</button>
                </div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
              <div className="trow">
                <span className="name" style={{ fontSize: '13px', fontWeight: 700 }}>
                  🕵️ Ninjas <span id="atk-ninjas-avail-w" style={{ color: 'var(--text3)', fontWeight: 400 }}></span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="number" className="input" id="atk-ninjas-w" min="0" defaultValue="0" style={{ textAlign: 'right', width: '90px', padding: '6px' }} onChange={updateAtkEstimateW} placeholder="Qty" />
                  <button className="base-btn" style={{ fontSize: '10px', padding: '6px 8px' }} onClick={() => setMaxValue('atk-ninjas-w')}>MAX</button>
                </div>
              </div>
            </div>
            <button className="btn btn-red" style={{ fontWeight: 700, marginTop: '8px' }} onClick={launchAttackW}>⚔️ Launch Attack</button>
          </div>
        </div>
      </div>

      {/* ── Spells tab ─────────────────────────────────────────────────────── */}
      <div style={{ display: activeTab === 'wspells' ? 'block' : 'none' }}>
        <div className="card" style={{ marginBottom: '12px' }}>
          <div className="card-title" style={{ marginBottom: '8px' }}>Select Target</div>
          <TargetListSection
            targets={filteredWspTargets}
            selected={selectedTarget}
            onSelect={setSelectedTarget}
            searchQ={wspSearchQ}
            onSearchChange={setWspSearchQ}
            placeholder="Search kingdoms…"
          />
        </div>
        <div className="card">
          <div className="card-title">Warfare Spells</div>
          <div style={{ marginTop: '12px' }}>
            <button className="base-btn" onClick={castWspell}>Prepare Spell Targeting</button>
            <button className="base-btn" style={{ marginLeft: '8px' }} onClick={updateWspellCalc}>Refresh Spell Estimates</button>
          </div>
        </div>
      </div>

      {/* ── Covert tab ─────────────────────────────────────────────────────── */}
      <div style={{ display: activeTab === 'wcovert' ? 'block' : 'none' }}>
        <div className="card" style={{ marginBottom: '12px' }}>
          <div className="card-title" style={{ marginBottom: '8px' }}>Select Target</div>
          <TargetListSection
            targets={filteredWcovTargets}
            selected={selectedTarget}
            onSelect={setSelectedTarget}
            searchQ={wcovSearchQ}
            onSearchChange={setWcovSearchQ}
            placeholder="Search kingdoms…"
          />
        </div>
        <div className="card">
          <div className="card-title">Warfare Covert Ops</div>
          <div style={{ marginTop: '12px' }}>
            <button className="base-btn" onClick={() => doWcovert('spy')}>Spy</button>
            <button className="base-btn" style={{ marginLeft: '8px' }} onClick={() => doWcovert('loot')}>Loot</button>
            <button className="base-btn" style={{ marginLeft: '8px' }} onClick={() => doWcovert('assassinate')}>Assassinate</button>
            <button className="base-btn" style={{ marginLeft: '8px' }} onClick={() => doWcovert('sabotage')}>Sabotage</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarfarePanel;
