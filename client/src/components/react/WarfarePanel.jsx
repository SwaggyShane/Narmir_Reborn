import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { toast } from '../../utils/toast.js';
import { apiCall } from '../../utils/api';
import { fmt } from "../../utils/fmt";
import {
  useKingdomId,
  useKingdomName,
  useRace,
  useLevel,
  useRank,
  useLand,
  useFighters,
  useRangers,
  useMages,
  useClerics,
  useNinjas,
  useThieves,
  useMilitaryEngineers,
  useWarMachines,
  useLadders,
  useThralls,
  useWeaponsStockpile,
  useTroopLevels,
  useResWeapons,
  useResMilitary,
  useResAttackMagic,
  useResWarMachines,
  useDiscoveredKingdoms,
  useHappiness,
  useMillitaryStore,
  useProfileStore,
  useEconomyStore,
  useResearchStore,
  usePopulationStore,
} from '../../stores';
import WarfareIntelTab from './WarfareIntelTab';
import WarfareReportsTab from './WarfareReportsTab';
import { registerTargetFromRankings } from '../../utils/rankingsTarget.js';
import { switchTab } from '../../utils/panelNav.js';
import { registerWarfareTab } from '../../utils/warfareTabs.js';
import { RACE_ICONS } from '../../utils/raceIcons.js';
import { playGameSound } from '../../utils/audio.js';
import { registerShowBattleReport } from '../../utils/showBattleReport.js';
import BattleReportModal from './BattleReportModal.jsx';

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

  if (
    prependSelf &&
    state?.kingdomId != null &&
    !mapped.some((r) => String(r.id) === String(state.kingdomId))
  ) {
    mapped.unshift({
      id: state.kingdomId,
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

function targetKey(target, index) {
  const id = target?.id;
  if (id !== undefined && id !== null && id !== '') {
    return target.is_location ? `loc-${id}` : `kd-${id}`;
  }
  const slug = String(target?.name || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `target-${slug || 'row'}-${index}`;
}

// ─── sub-component: target card ───────────────────────────────────────────────

function KingdomTargetCard({ target, isSelected, onSelect }) {
  const raceIcon = RACE_ICONS[target.race] || '👤';
  return (
    <div
      className={clsx('target-row cursor-pointer mb-1', isSelected && 'selected')}
      onClick={() => onSelect(target)}
    >
      <span className="text-[18px] mr-2.5">
        {target.is_location ? '📍' : raceIcon}
      </span>
      <div className="flex-1">
        <div className="font-semibold text-[var(--text)]">
          {target.name}{target.is_ai ? ' (AI)' : ''}
        </div>
        <div className="text-[10px] text-[var(--text3)]">
          {target.is_location
            ? 'Discovered Site'
            : `Lv ${target.level} - ${(target.race || '').replace(/_/g, ' ')}`}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[12px] text-[var(--gold)] font-semibold">
          {target.is_location ? '???' : fmt(target.land)} ac
        </div>
        <div className="text-[10px] text-[var(--text3)]">#{target.rank || '?'}</div>
      </div>
    </div>
  );
}

// ─── target list section ──────────────────────────────────────────────────────

function TargetListSection({ targets, selected, onSelect, searchQ, onSearchChange, placeholder }) {
  return (
    <div className="mb-4">
      <input
        type="text"
        className="input w-full mb-2 px-2.5 py-1.5 text-[13px]"
        placeholder={placeholder || 'Search kingdoms…'}
        value={searchQ}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      {selected && (
        <div className="px-2.5 py-2 mb-2 rounded-[var(--radius)] bg-[var(--bg2)] border border-[var(--accent)] text-[13px]">
          <span className="text-[var(--text3)] mr-1.5">Target:</span>
          <span className="font-bold text-[var(--text)]">{selected.name}</span>
          <span className="text-[var(--text3)] ml-2 text-[11px]">
            {selected.is_location ? 'Site' : `${fmt(selected.land)} ac - #${selected.rank || '?'}`}
          </span>
          <button
            className="base-btn float-right text-[10px] px-1.5 py-0.5"
            onClick={() => onSelect(null)}
          >✕</button>
        </div>
      )}
      <div className="max-h-[260px] overflow-y-auto">
        {targets.length === 0
          ? (
            <div className="text-[var(--text3)] text-[13px] px-4 py-4 text-center">
              No mapped targets found.{' '}
              <button className="btn text-[11px]" onClick={() => switchTab('exploration')}>
                Go Explore
              </button>
            </div>
          )
          : targets.map((t, index) => (
            <KingdomTargetCard
              key={targetKey(t, index)}
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
  // Zustand selectors - called at top level
  const kingdomId = useKingdomId();
  const kingdomName = useKingdomName();
  const race = useRace();
  const level = useLevel();
  const rank = useRank();
  const myLand = useLand();
  const fighters = useFighters();
  const rangers = useRangers();
  const mages = useMages();
  const clerics = useClerics();
  const ninjas = useNinjas();
  const thieves = useThieves();
  const engineers = useMilitaryEngineers();
  const warMachines = useWarMachines();
  const ladders = useLadders();
  const thralls = useThralls();
  const weaponsStockpile = useWeaponsStockpile();
  const troopLevels = useTroopLevels();
  const resWeapons = useResWeapons();
  const resMilitary = useResMilitary();
  const resAttackMagic = useResAttackMagic();
  const resWarMachines = useResWarMachines();
  const discoveredKingdoms = useDiscoveredKingdoms();
  const happiness = useHappiness();

  const [activeTab, setActiveTab] = useState('attack');
  const [battleReport, setBattleReport] = useState(null);

  // target data
  const [targets, setTargets] = useState([]);
  const [attackTarget, setAttackTarget] = useState(null);
  const [spellTarget, setSpellTarget] = useState(null);
  const [covertTarget, setCovertTarget] = useState(null);
  const [atkSearchQ, setAtkSearchQ] = useState('');
  const [wspSearchQ, setWspSearchQ] = useState('');
  const [wcovSearchQ, setWcovSearchQ] = useState('');
  const [wcovTargetRace, setWcovTargetRace] = useState(null);

  // attack troop quantities (controlled inputs)
  const [atkQty, setAtkQty] = useState({ fighters: '0', rangers: '0', mages: '0', wm: '0', ladders: '0', clerics: '0', engineers: '0', ninjas: '0', thieves: '0' });
  const handleQtyChange = useCallback((key, value) => {
    if (value === '' || parseInt(value, 10) >= 0) {
      setAtkQty((q) => ({ ...q, [key]: value }));
    }
  }, []);

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

  // Build state-like object for compatibility with helper functions (only includes properties used by buildTargetList)
  const stateData = useMemo(() => ({
    kingdomId,
    kingdomName,
    race,
    level,
    rank,
    fighters,
    land: myLand,
  }), [kingdomId, kingdomName, race, level, rank, fighters, myLand]);

  // Derived: disc kingdoms parsed from discovered_kingdoms
  const disc = useMemo(() => parseDisc(discoveredKingdoms), [discoveredKingdoms]);

  // Filtered target lists per tab
  const filteredAtkTargets = useMemo(
    () => filterByQuery(buildTargetList(targets, disc, stateData), atkSearchQ),
    [targets, disc, stateData, atkSearchQ],
  );
  const filteredWspTargets = useMemo(
    () => filterByQuery(buildTargetList(targets, disc, stateData, { prependSelf: true }), wspSearchQ),
    [targets, disc, stateData, wspSearchQ],
  );
  const filteredWcovTargets = useMemo(() => {
    const list = buildTargetList(targets, disc, stateData);
    const byRace = wcovTargetRace ? list.filter((t) => t.race === wcovTargetRace) : list;
    return filterByQuery(byRace, wcovSearchQ);
  }, [targets, disc, stateData, wcovTargetRace, wcovSearchQ]);

  const refreshAttackTargets = useCallback(async () => {
    try {
      const result = await apiCall('/api/kingdom/rankings');
      if (result?.error) throw new Error(result.error);

      const kingdoms = Array.isArray(result?.rankings) ? result.rankings : [];
      const mappedTargets = kingdoms
        .filter((row) => String(row.id) !== String(kingdomId))
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

      setTargets(mappedTargets);
    } catch (err) {
      console.error('[WarfarePanel] Failed to refresh attack targets:', err);
    }
  }, [kingdomId]);

  const loadWarLog = useCallback(async () => {
    setLoadingWarLog(true);
    setWarLogError('');
    try {
      const result = await apiCall('/api/kingdom/war-log');
      if (result?.error) throw new Error(result.error);
      const rows = Array.isArray(result) ? result : Array.isArray(result?.rows) ? result.rows : [];
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
      const spyData = Array.isArray(result) ? result : [];
      setSpyReports(spyData);
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
      const intelData = Array.isArray(result) ? result : [];
      setAllianceIntel(intelData);
    } catch (err) {
      console.error('[WarfarePanel] Failed to load alliance intel:', err);
      setAllianceError(err.message || 'Failed to load alliance intel');
    } finally {
      setLoadingAllianceIntel(false);
    }
  }, []);

  useEffect(() => {
    setWcovTargetRace(covertTarget?.race ?? null);
  }, [covertTarget?.race]);

  useEffect(() => {
    const unregister = registerWarfareTab(setActiveTab);
    const unregisterBattle = registerShowBattleReport(setBattleReport);
    return () => {
      unregister();
      unregisterBattle();
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
  };

  const atkEstimate = useMemo(() => {
    const f = parseInt(atkQty.fighters, 10) || 0;
    const rn = parseInt(atkQty.rangers, 10) || 0;
    const m = parseInt(atkQty.mages, 10) || 0;
    const wm = parseInt(atkQty.wm, 10) || 0;
    const ld = parseInt(atkQty.ladders, 10) || 0;
    const cle = parseInt(atkQty.clerics, 10) || 0;
    const eng = parseInt(atkQty.engineers, 10) || 0;
    if (f + rn + m + wm + ld + cle + eng === 0) return null;

    const engLvlArray = troopLevels?.engineers?.level || 1;
    const baseCrew = race === 'human' ? 10 : race === 'dwarf' ? 8 : 12;
    const crewReq = Math.max(1, Math.round(baseCrew * (1 - Math.min(0.5, (engLvlArray - 1) / 100))));
    const totalEng = engineers + eng;
    const wmCrewable = Math.min(wm, Math.floor(totalEng / crewReq));
    const weaponBonus = 1 + Math.min(1, weaponsStockpile / Math.max(f, 1)) * 0.25;
    const atkF = f * (resWeapons / 100) * weaponBonus * (resMilitary / 100);
    const atkRn = rn * 0.7 * (resMilitary / 100);
    const atkM = m * 2.5 * (resAttackMagic / 100);
    const atkWm = wmCrewable * 500 * (resWarMachines / 100);
    const happinessVal = happiness !== undefined && happiness !== null ? happiness : 50;
    const mMult = Math.max(0.5, Math.min(1.5, 0.5 + happinessVal / 120));
    const target = attackTarget;
    let bullyRatio = target
      ? Math.max(
          (myLand || 1) / Math.max(1, target.land || 1),
          (fighters / Math.max(1, target.fighters || 1)) * 0.5,
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
    return { atkPower, defPower, winPct, winColor, land, bullyMsg };
  }, [atkQty, troopLevels, race, engineers, weaponsStockpile, resWeapons, resMilitary, resAttackMagic, resWarMachines, happiness, fighters, myLand, attackTarget]);

  const setAtkMax = useCallback((key) => {
    const troopMap = {
      fighters,
      rangers,
      mages,
      ladders,
      ninjas,
      thieves,
      engineers,
    };
    const val = key === 'wm'
      ? String(warMachines || 0)
      : key === 'clerics'
        ? String((clerics || 0) + (thralls || 0))
        : String(troopMap[key] || 0);
    setAtkQty((q) => ({ ...q, [key]: val }));
  }, [fighters, rangers, mages, ladders, ninjas, thieves, engineers, warMachines, clerics, thralls]);

  const launchAttackW = useCallback(async () => {
    if (!attackTarget) {
      toast('Select a target kingdom first', 'error');
      return;
    }

    const f = parseInt(atkQty.fighters, 10) || 0;
    const rn = parseInt(atkQty.rangers, 10) || 0;
    const m = parseInt(atkQty.mages, 10) || 0;
    const wm = parseInt(atkQty.wm, 10) || 0;
    const ld = parseInt(atkQty.ladders, 10) || 0;
    const nj = parseInt(atkQty.ninjas, 10) || 0;
    const th = parseInt(atkQty.thieves, 10) || 0;
    const cle = parseInt(atkQty.clerics, 10) || 0;
    const eng = parseInt(atkQty.engineers, 10) || 0;

    if (f + rn + m <= 0) return toast('Send at least some troops', 'error');
    if (f > (fighters || 0)) return toast('Not enough fighters', 'error');
    if (rn > (rangers || 0)) return toast('Not enough rangers', 'error');
    if (m > (mages || 0)) return toast('Not enough mages', 'error');
    if (wm > (warMachines || 0)) return toast('Not enough war machines', 'error');
    if (ld > (ladders || 0)) return toast('Not enough 🪜 ladders', 'error');
    if (nj > (ninjas || 0)) return toast('Not enough ninjas', 'error');
    if (th > (thieves || 0)) return toast('Not enough thieves', 'error');
    if (cle > (clerics || 0) + (thralls || 0)) return toast('Not enough clerics/thralls', 'error');
    if (eng > (engineers || 0)) return toast('Not enough engineers', 'error');

    const result = await apiCall('/api/kingdom/attack', {
      method: 'POST',
      body: {
        targetId: attackTarget.id,
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
      ['Land Seized', `+${fmt(r.landTransferred || 0)} acres`],
      ['Your Power', fmt(r.atkPower)],
      ['Enemy Power', fmt(r.defPower)],
    ];

    if (r.ninjaKills > 0) rows.push(['Assassinations (Ninjas)', fmt(r.ninjaKills)]);
    if (r.flankKills > 0) rows.push(['Flank Action', fmt(r.flankKills)]);
    if (r.rangerKills > 0) rows.push(['Opening Volley', fmt(r.rangerKills)]);
    if (r.thiefSabotage > 0) rows.push(['Enemy WM Disabled', fmt(r.thiefSabotage)]);

    rows.push(['---', 'YOUR LOSSES']);
    if (r.atkFightersLost > 0) rows.push(['Fighters Lost', fmt(r.atkFightersLost)]);
    if (r.atkRangersLost > 0) rows.push(['Rangers Lost', fmt(r.atkRangersLost)]);
    if (r.atkMagesLost > 0) rows.push(['Mages Lost', fmt(r.atkMagesLost)]);
    if (r.atkNinjasLost > 0) rows.push(['Ninjas Lost', fmt(r.atkNinjasLost)]);
    if (r.atkClericsLost > 0) rows.push(['Clerics Lost', fmt(r.atkClericsLost)]);
    if (r.atkThievesLost > 0) rows.push(['Thieves Lost', fmt(r.atkThievesLost)]);
    if (r.atkEngineersLost > 0) rows.push(['Engineers Lost', fmt(r.atkEngineersLost)]);
    if (r.atkWmLost > 0) rows.push(['War Machines Lost', fmt(r.atkWmLost)]);

    rows.push(['---', 'ENEMY LOSSES']);
    if (r.defFightersLost > 0) rows.push(['Fighters Slain', fmt(r.defFightersLost)]);
    if (r.defRangersLost > 0) rows.push(['Rangers Slain', fmt(r.defRangersLost)]);
    if (r.defMagesLost > 0) rows.push(['Mages Slain', fmt(r.defMagesLost)]);
    if (r.defNinjasLost > 0) rows.push(['Ninjas Slain', fmt(r.defNinjasLost)]);
    if (r.defClericsLost > 0) rows.push(['Clerics Slain', fmt(r.defClericsLost)]);
    if (r.defThievesLost > 0) rows.push(['Thieves Slain', fmt(r.defThievesLost)]);
    if (r.defEngineersLost > 0) rows.push(['Engineers Slain', fmt(r.defEngineersLost)]);
    if (r.defWmLost > 0) rows.push(['War Machines Slain', fmt(r.defWmLost)]);
    if (r.wallsDestroyed > 0) rows.push(['Walls Destroyed', fmt(r.wallsDestroyed)]);
    if (r.bullyMsg) rows.push(['⚠️ Penalty', r.bullyMsg]);

    if (result && Object.keys(result).length > 0) {
      useMillitaryStore.setState((state) => ({
        troops: result.troops ? { ...state.troops, ...result.troops } : state.troops,
        wall_hp: result.wall_hp !== undefined ? result.wall_hp : state.wall_hp,
        troop_levels: result.troop_levels ? { ...state.troop_levels, ...result.troop_levels } : state.troop_levels,
      }));
      useEconomyStore.setState((state) => ({
        food: result.food !== undefined ? result.food : state.food,
        gold: result.gold !== undefined ? result.gold : state.gold,
      }));
      if (result.morale !== undefined) {
        usePopulationStore.setState({ happiness: result.morale });
      }
      if (result.turns_stored !== undefined) {
        useProfileStore.setState({ turns_stored: result.turns_stored });
      }
    }

    setBattleReport({
      type: 'Military attack',
      target: attackTarget.name,
      win: r.win,
      rows,
    });
    refreshAttackTargets();
  }, [refreshAttackTargets, fighters, rangers, mages, warMachines, ladders, ninjas, thieves, clerics, engineers, attackTarget, atkQty]);

  // wspells/wcovert action stubs — not yet implemented; buttons present for future use
  const castWspell = () => {};
  const doWcovert = () => {};
  const updateWspellCalc = () => {};

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
      return <div className="text-[var(--text3)] text-[13px] text-center py-6">Loading...</div>;
    }
    if (warLogError) {
      return <div className="text-[var(--red)] text-center p-5">{warLogError}</div>;
    }
    if (!warLogRows.length) {
      return (
        <div className="text-center px-4 py-8">
          <div className="text-[32px] mb-2.5">🕊️</div>
          <div className="text-[15px] font-semibold text-[var(--text2)] mb-1.5">It&apos;s been a quiet day.</div>
          <div className="text-[18px] font-bold text-[var(--red)]">BREAK SOME $#@&amp;!</div>
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
        <div key={row.id} className="border-b border-[var(--border)] px-1 py-3">
          <div className="flex justify-between gap-3 items-baseline flex-wrap">
            <div className="text-[var(--text)] font-bold">
              <span className="mr-2">{icon}</span>
              {row.action_type || 'event'} — {row.attacker_name || 'Unknown'} vs {row.defender_name || 'Unknown'}
            </div>
            <div style={{ color: outcomeColor }} className="font-bold">{outcome}</div>
          </div>
          {row.detail ? (
            <pre className="mt-2 whitespace-pre-wrap text-[var(--text2)] text-[12px]">{renderDetail(row.detail)}</pre>
          ) : null}
          <div className="mt-1.5 text-[var(--text3)] text-[11px]">{fmtDate(row.created_at)}</div>
        </div>
      );
    });
  }, [loadingWarLog, warLogError, warLogRows]);

  const spyReportsContent = useMemo(() => {
    if (loadingSpyReports) {
      return <div className="text-[var(--text3)] p-5 text-center">Loading spy reports...</div>;
    }
    if (spyError) {
      return <div className="text-[var(--red)] p-5 text-center">{spyError}</div>;
    }
    if (!spyReports.length) {
      return <div className="text-[var(--text3)] p-5 text-center">No reports yet. Send spies to gather intel.</div>;
    }
    return spyReports.map((row) => (
      <div key={row.id} className="border border-[var(--border)] rounded-[12px] p-3 mb-2.5 bg-[var(--bg2)]">
        <div className="flex justify-between gap-2 flex-wrap mb-1.5">
          <div className="font-bold text-[var(--text)]">{row.target_name || 'Unknown target'}</div>
          <div className="text-[var(--text3)] text-[11px]">{fmtDate(row.created_at)}</div>
        </div>
        <div className="text-[var(--text2)] text-[13px] mb-2">{row.outcome || 'Unknown outcome'}</div>
        {row.report ? (
          <pre className="whitespace-pre-wrap text-[var(--text3)] text-[12px]">{renderDetail(row.report)}</pre>
        ) : null}
        <div className="mt-2 flex justify-between gap-2 items-center flex-wrap">
          <span style={{ color: row.shared_to_alliance ? 'var(--green)' : 'var(--text3)' }} className="text-[11px]">
            {row.shared_to_alliance ? 'Shared to alliance' : 'Private report'}
          </span>
          <button
            className="btn btn-accent text-[11px] px-2.5 py-1"
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
      return <div className="text-[var(--text3)] p-5 text-center">Loading alliance intel...</div>;
    }
    if (allianceError) {
      return <div className="text-[var(--red)] p-5 text-center">{allianceError}</div>;
    }
    if (!allianceIntel.length) {
      return <div className="text-[var(--text3)] p-5 text-center">No shared reports in your alliance.</div>;
    }
    return allianceIntel.map((row) => (
      <div key={row.id} className="border border-[var(--border)] rounded-[12px] p-3 mb-2.5 bg-[var(--bg2)]">
        <div className="flex justify-between gap-2 flex-wrap mb-1.5">
          <div className="font-bold text-[var(--text)]">{row.target_name || 'Unknown target'}</div>
          <div className="text-[var(--text3)] text-[11px]">{fmtDate(row.created_at)}</div>
        </div>
        <div className="text-[var(--text2)] text-[13px] mb-2">
          Shared by {row.shared_by_name || 'an ally'} - {row.outcome || 'Unknown outcome'}
        </div>
        {row.report ? (
          <pre className="whitespace-pre-wrap text-[var(--text3)] text-[12px]">{renderDetail(row.report)}</pre>
        ) : null}
      </div>
    ));
  }, [allianceError, allianceIntel, loadingAllianceIntel]);

  return (
    <>
    <div id="warfare" className="panel">
      <div className="flex flex-wrap gap-1 border-b-2 border-[var(--border2)] mb-4 pb-1">
        <button className={clsx('base-btn admin-tab rounded-none', activeTab === 'attack' && 'active')} onClick={() => handleTabClick('attack')}>⚔️ Attack</button>
        <button className={clsx('base-btn admin-tab rounded-none', activeTab === 'wspells' && 'active')} onClick={() => handleTabClick('wspells')}>✨ Spells</button>
        <button className={clsx('base-btn admin-tab rounded-none', activeTab === 'wcovert' && 'active')} onClick={() => handleTabClick('wcovert')}>🕵️ Covert</button>
        <button className={clsx('base-btn admin-tab rounded-none', activeTab === 'wintel' && 'active')} onClick={() => handleTabClick('wintel')}>📊 Intel</button>
        <button className={clsx('base-btn admin-tab rounded-none', activeTab === 'wreports' && 'active')} onClick={() => handleTabClick('wreports')}>📝 Reports</button>
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
      <div className={clsx(activeTab === 'attack' ? 'block' : 'hidden')}>
        <div className="card mb-3">
          <div className="card-title mb-2">Select Target</div>
          <TargetListSection
            targets={filteredAtkTargets}
            selected={attackTarget}
            onSelect={setAttackTarget}
            searchQ={atkSearchQ}
            onSearchChange={setAtkSearchQ}
            placeholder="Search kingdoms…"
          />
        </div>

        <div className="card" id="atk-panel-w">
          <div className="card-title mb-3">Warfare: Army Selection</div>
          <div className="flex flex-col gap-1.5 mb-5">
            <div className="trow">
              <span className="name text-[13px] font-bold">
                ⚔️ Fighters <span className="text-[var(--text3)] font-normal">({fighters})</span>
              </span>
              <div className="flex items-center gap-1">
                <input type="number" className="input text-right w-[90px] px-1.5 py-1.5" min="0" value={atkQty.fighters} onChange={(e) => handleQtyChange('fighters', e.target.value)} placeholder="Qty" />
                <button className="base-btn text-[10px] px-2 py-1.5" onClick={() => setAtkMax('fighters')}>MAX</button>
              </div>
            </div>
            <div className="trow">
              <span className="name text-[13px] font-bold">
                🏹 Rangers <span className="text-[var(--text3)] font-normal">({rangers})</span>
              </span>
              <div className="flex items-center gap-1">
                <input type="number" className="input text-right w-[90px] px-1.5 py-1.5" min="0" value={atkQty.rangers} onChange={(e) => handleQtyChange('rangers', e.target.value)} placeholder="Qty" />
                <button className="base-btn text-[10px] px-2 py-1.5" onClick={() => setAtkMax('rangers')}>MAX</button>
              </div>
            </div>
            <div className="trow">
              <span className="name text-[13px] font-bold">
                ✨ Mages <span className="text-[var(--text3)] font-normal">({mages})</span>
              </span>
              <div className="flex items-center gap-1">
                <input type="number" className="input text-right w-[90px] px-1.5 py-1.5" min="0" value={atkQty.mages} onChange={(e) => handleQtyChange('mages', e.target.value)} placeholder="Qty" />
                <button className="base-btn text-[10px] px-2 py-1.5" onClick={() => setAtkMax('mages')}>MAX</button>
              </div>
            </div>
            <div className="trow">
              <span className="name text-[13px] font-bold">
                ⛪ Clerics <span className="text-[var(--text3)] font-normal">({clerics + thralls})</span>
              </span>
              <div className="flex items-center gap-1">
                <input type="number" className="input text-right w-[90px] px-1.5 py-1.5" min="0" value={atkQty.clerics} onChange={(e) => handleQtyChange('clerics', e.target.value)} placeholder="Qty" />
                <button className="base-btn text-[10px] px-2 py-1.5" onClick={() => setAtkMax('clerics')}>MAX</button>
              </div>
            </div>
            <div className="border-t border-[var(--border)] pt-2 mt-1">
              <div className="trow">
                <span className="name text-[13px] font-bold">
                  ⚙️ War Machines <span className="text-[var(--text3)] font-normal">({warMachines})</span>
                </span>
                <div className="flex items-center gap-1">
                  <input type="number" className="input text-right w-[90px] px-1.5 py-1.5" min="0" value={atkQty.wm} onChange={(e) => handleQtyChange('wm', e.target.value)} placeholder="Qty" />
                  <button className="base-btn text-[10px] px-2 py-1.5" onClick={() => setAtkMax('wm')}>MAX</button>
                </div>
              </div>
              <div className="trow">
                <span className="name text-[13px] font-bold">
                  🪜 Ladders <span className="text-[var(--text3)] font-normal">({ladders})</span>
                </span>
                <div className="flex items-center gap-1">
                  <input type="number" className="input text-right w-[90px] px-1.5 py-1.5" min="0" value={atkQty.ladders} onChange={(e) => handleQtyChange('ladders', e.target.value)} placeholder="Qty" />
                  <button className="base-btn text-[10px] px-2 py-1.5" onClick={() => setAtkMax('ladders')}>MAX</button>
                </div>
              </div>
            </div>
            <div className="border-t border-[var(--border)] pt-2 mt-1">
              <div className="trow">
                <span className="name text-[13px] font-bold">
                  🕵️ Ninjas <span className="text-[var(--text3)] font-normal">({ninjas})</span>
                </span>
                <div className="flex items-center gap-1">
                  <input type="number" className="input text-right w-[90px] px-1.5 py-1.5" min="0" value={atkQty.ninjas} onChange={(e) => handleQtyChange('ninjas', e.target.value)} placeholder="Qty" />
                  <button className="base-btn text-[10px] px-2 py-1.5" onClick={() => setAtkMax('ninjas')}>MAX</button>
                </div>
              </div>
            </div>
            {atkEstimate && (
              <div className="mt-3 pt-3 border-t border-[var(--border)] text-[13px]">
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--text3)]">Est. Attack Power</span>
                  <span style={{ color: atkEstimate.winPct >= 50 ? 'var(--green)' : 'var(--amber)' }}>{fmt(atkEstimate.atkPower)}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--text3)]">Est. Enemy Defense</span>
                  <span className="text-[var(--text)]">{atkEstimate.defPower > 0 ? `~${fmt(atkEstimate.defPower)} (est.)` : '—'}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--text3)]">Win Chance</span>
                  <span style={{ color: atkEstimate.winColor }}>{atkEstimate.winPct}%</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-[var(--text3)]">Est. Land Gain</span>
                  <span className="text-[var(--green)]">{atkEstimate.land > 0 ? `+${fmt(atkEstimate.land)} ac` : '—'}</span>
                </div>
                {atkEstimate.bullyMsg && (
                  <div className="mt-1 text-[var(--red)] text-[12px]">{atkEstimate.bullyMsg}</div>
                )}
              </div>
            )}
            <button className="btn btn-red font-bold mt-2" onClick={launchAttackW}>⚔️ Launch Attack</button>
          </div>
        </div>
      </div>

      {/* ── Spells tab ─────────────────────────────────────────────────────── */}
      <div className={clsx(activeTab === 'wspells' ? 'block' : 'hidden')}>
        <div className="card mb-3">
          <div className="card-title mb-2">Select Target</div>
          <TargetListSection
            targets={filteredWspTargets}
            selected={spellTarget}
            onSelect={setSpellTarget}
            searchQ={wspSearchQ}
            onSearchChange={setWspSearchQ}
            placeholder="Search kingdoms…"
          />
        </div>
        <div className="card">
          <div className="card-title">Warfare Spells</div>
          <div className="mt-3">
            <button className="base-btn" onClick={castWspell}>Prepare Spell Targeting</button>
            <button className="base-btn ml-2" onClick={updateWspellCalc}>Refresh Spell Estimates</button>
          </div>
        </div>
      </div>

      {/* ── Covert tab ─────────────────────────────────────────────────────── */}
      <div className={clsx(activeTab === 'wcovert' ? 'block' : 'hidden')}>
        <div className="card mb-3">
          <div className="card-title mb-2">Select Target</div>
          <TargetListSection
            targets={filteredWcovTargets}
            selected={covertTarget}
            onSelect={setCovertTarget}
            searchQ={wcovSearchQ}
            onSearchChange={setWcovSearchQ}
            placeholder="Search kingdoms…"
          />
        </div>
        <div className="card">
          <div className="card-title">Warfare Covert Ops</div>
          <div className="mt-3">
            <button className="base-btn" onClick={() => doWcovert('spy')}>Spy</button>
            <button className="base-btn ml-2" onClick={() => doWcovert('loot')}>Loot</button>
            <button className="base-btn ml-2" onClick={() => doWcovert('assassinate')}>Assassinate</button>
            <button className="base-btn ml-2" onClick={() => doWcovert('sabotage')}>Sabotage</button>
          </div>
        </div>
      </div>
    </div>
    <BattleReportModal data={battleReport} onClose={() => setBattleReport(null)} />
    </>
  );
};

export default WarfarePanel;
