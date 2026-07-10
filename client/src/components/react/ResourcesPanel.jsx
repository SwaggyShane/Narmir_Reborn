import clsx from 'clsx';
import React, { useState, useEffect, useCallback } from 'react';
import { apiCall } from '../../utils/api';
import { toast } from '../../utils/toast.js';
import { useActivePanel } from '../../hooks/useActivePanel';
import { applyGameMutation } from '../../utils/gameMutations.js';
import { dispatchExpeditionLogEntry } from '../../utils/expeditionLog.js';
import { AppEvent, emitAppEvent } from '../../utils/appEvents.js';
import { useRace } from '../../stores';

const REFRESH_INTERVAL_MS = 10 * 1000;

const tabs = [
  { id: 'stockpiles', label: '📦 Stockpiles' },
  { id: 'buildings', label: '🏭 Buildings' },
  { id: 'expeditions', label: '🧭 Expeditions' },
  { id: 'inventory', label: '🎒 Inventory' },
];

const resourceTypes = [
  { key: 'wood',  label: 'Wood',  icon: '🪵' },
  { key: 'stone', label: 'Stone', icon: '🪨' },
  { key: 'iron',  label: 'Iron',  icon: '🔗' },
];

const BUILDING_CONFIG = {
  woodyard:     { key: 'woodyard',     type: 'wood',  stage: 1, label: 'Woodyard',     workersPerBuilding: 10,  yield: 5, yieldEvery: 1 },
  lumber_camp:  { key: 'lumber_camp',  type: 'wood',  stage: 2, label: 'Lumber Camp',  workersPerBuilding: 25,  yield: 15, yieldEvery: 1 },
  sawmill:      { key: 'sawmill',      type: 'wood',  stage: 3, label: 'Sawmill',       workersPerBuilding: 75,  yield: 60, yieldEvery: 1 },
  gravel_pit:   { key: 'gravel_pit',   type: 'stone', stage: 1, label: 'Gravel Pit',   workersPerBuilding: 20,  yield: 5, yieldEvery: 1 },
  blockfield:   { key: 'blockfield',   type: 'stone', stage: 2, label: 'Blockfield',   workersPerBuilding: 50,  yield: 15, yieldEvery: 1 },
  stone_quarry: { key: 'stone_quarry', type: 'stone', stage: 3, label: 'Stone Quarry', workersPerBuilding: 150, yield: 60, yieldEvery: 1 },
  open_pit:     { key: 'open_pit',     type: 'iron',  stage: 1, label: 'Open Pit',     workersPerBuilding: 30,  yield: 5, yieldEvery: 1 },
  strip_mine:   { key: 'strip_mine',   type: 'iron',  stage: 2, label: 'Strip Mine',   workersPerBuilding: 75,  yield: 15, yieldEvery: 1 },
  deep_mine:    { key: 'deep_mine',    type: 'iron',  stage: 3, label: 'Deep Mine',    workersPerBuilding: 225, yield: 60, yieldEvery: 1 },
};

const RACE_YIELD_BONUS = {
  high_elf:  { wood: 1.1,  stone: 0.85, iron: 0.8  },
  dwarf:     { wood: 0.85, stone: 1.35, iron: 1.3  },
  dire_wolf: { wood: 1.0,  stone: 0.8,  iron: 0.85 },
  dark_elf:  { wood: 0.9,  stone: 1.1,  iron: 0.95 },
  human:     { wood: 1.15, stone: 1.0,  iron: 1.0  },
  orc:       { wood: 1.0,  stone: 1.1,  iron: 1.2  },
  vampire:   { wood: 0.8,  stone: 0.9,  iron: 1.1  },
  wood_elf:  { wood: 1.5,  stone: 0.8,  iron: 0.75 },
};

const WOOD_COST     = { woodyard: 0, lumber_camp: 100, sawmill: 500, gravel_pit: 50, blockfield: 100, stone_quarry: 500, open_pit: 50, strip_mine: 100, deep_mine: 500 };
const STONE_COST    = { woodyard: 0, lumber_camp: 0, sawmill: 0, gravel_pit: 0, blockfield: 100, stone_quarry: 500, open_pit: 0, strip_mine: 50, deep_mine: 200 };
const IRON_COST     = { woodyard: 0, lumber_camp: 0, sawmill: 100, gravel_pit: 0, blockfield: 0, stone_quarry: 100, open_pit: 0, strip_mine: 0, deep_mine: 100 };
const GOLD_COST     = { woodyard: 0, lumber_camp: 0, sawmill: 0, gravel_pit: 0, blockfield: 0, stone_quarry: 0, open_pit: 0, strip_mine: 0, deep_mine: 0 };
const LAND_COST     = { woodyard: 1, lumber_camp: 3, sawmill: 5, gravel_pit: 1, blockfield: 3, stone_quarry: 5, open_pit: 1, strip_mine: 3, deep_mine: 5 };
const BUILDING_COST = { woodyard: 1000, lumber_camp: 10000, sawmill: 100000, gravel_pit: 9000, blockfield: 90000, stone_quarry: 900000, open_pit: 4000, strip_mine: 40000, deep_mine: 400000 };

function buildingsByType(type) {
  return Object.values(BUILDING_CONFIG).filter(b => b.type === type).sort((a, b) => a.stage - b.stage);
}
let currentResourcesState = {};
function getState() { return currentResourcesState || {}; }

function getParsedStateProp(propName, fallback = {}) {
  const s = getState();
  if (!s) return fallback;
  const prop = s[propName];
  if (typeof prop === 'string') {
    try { return JSON.parse(prop || JSON.stringify(fallback)); } catch { return fallback; }
  }
  return prop || fallback;
}
function fmt(n) { return (n || 0).toLocaleString(); }
function formatDuration(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
function typeIcon(type) { return { wood: '🪵', stone: '🪨', iron: '🔗', gold: '💰' }[type] || '❓'; }
function formatLoot(loot) {
  if (!loot || typeof loot !== 'object') return '';
  return Object.entries(loot).filter(([k]) => !k.startsWith('_')).map(([r, q]) => `${q} ${r}`).join(', ');
}
function statusColor(status) {
  return { outbound: { color: 'var(--text3)' }, harvesting: { color: 'var(--gold)' }, returning: { color: 'var(--green)' }, completed: { color: 'var(--text3)' }, intercepted: { color: 'var(--red)' } }[status] || { color: 'var(--text3)' };
}
function itemIcon(id) {
  const icons = {
    earth_fragment: '🌍', water_fragment: '💧', fire_fragment: '🔥', air_fragment: '💨',
    ancient_oak_shard: '🌳', petrified_heartwood: '🪵', ironbark_splinter: '🌲',
    crystalline_core: '💎', primordial_geode: '🪨', fossil_remnant: '🦕',
    meteoric_shard: '☄️', deep_vein_ore: '⛏️', lodestone_fragment: '🧲',
  };
  return icons[id] || '📦';
}

const ResourcesPanel = () => {
  const [activeTab, setActiveTab] = useState('stockpiles');
  const [activeBldTab, setActiveBldTab] = useState('wood');
  const [showGuide, setShowGuide] = useState(false);
  const [kingdom, setKingdom] = useState({});
  const [items, setItems] = useState([]);
  const [isOrc, setIsOrc] = useState(false);
  const [buildingInProgress, setBuildingInProgress] = useState({});

  const [nodes, setNodes] = useState([]);
  const [activeExpeditions, setActiveExpeditions] = useState([]);
  const [visibleExps, setVisibleExps] = useState([]);
  const [expPop, setExpPop] = useState({});
  const [launching, setLaunching] = useState({});
  const [interceptFighters, setInterceptFighters] = useState({});
  const [intercepting, setIntercepting] = useState({});
  const [scouting, setScouting] = useState(false);
  const [scoutMsg, setScoutMsg] = useState('');
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [engineerAllocations, setEngineerAllocations] = useState({});
  const { activePanel } = useActivePanel();
  const race = useRace();
  currentResourcesState = {};

  const syncFromState = useCallback(() => {
    const s = getState();
    setKingdom(s);
    setIsOrc(race === 'orc');

    const bq = getParsedStateProp('build_queue');
    setBuildingInProgress(prev => {
      const next = { ...prev };
      for (const type of ['wood', 'stone', 'iron']) {
        if (next[type]) {
          const hasActive = Object.values(BUILDING_CONFIG).some(b => b.type === type && (bq[b.key] || 0) > 0);
          if (hasActive) next[type] = false;
        }
      }
      return next;
    });

    let rawItems = s.items || [];
    if (typeof rawItems === 'string') {
      try { rawItems = JSON.parse(rawItems); } catch { rawItems = []; }
    }
    const fragIds = ['earth_fragment','water_fragment','fire_fragment','air_fragment'];
    const fragDefs = {
      earth_fragment: 'Earth Fragment', water_fragment: 'Water Fragment',
      fire_fragment: 'Fire Fragment', air_fragment: 'Air Fragment',
    };
    const frags = fragIds.map(id => rawItems.find(i => i.id === id) || { id, name: fragDefs[id], qty: 0 });
    const rest = rawItems.filter(i => !fragIds.includes(i.id));
    setItems([...frags, ...rest]);

    let seq = s.resource_sequence || {};
    if (typeof seq === 'string') { try { seq = JSON.parse(seq); } catch { seq = {}; } }
    setKingdom(prev => ({...prev, _seq: seq}));
  }, [race]);

  const loadNodes = async () => {
    try {
      const r = await fetch('/api/kingdom/resource-nodes', { credentials: 'include' });
      if (r.ok) setNodes(await r.json());
    } catch(e) { console.error(e); }
  };
  const loadExpeditions = async () => {
    try {
      const r = await fetch('/api/kingdom/resource-expeditions', { credentials: 'include' });
      if (r.ok) setActiveExpeditions(await r.json());
    } catch(e) { console.error(e); }
  };
  const loadVisibleExps = async () => {
    try {
      const r = await fetch('/api/kingdom/expeditions/visible', { credentials: 'include' });
      if (r.ok) setVisibleExps(await r.json());
    } catch (e) { console.error(e); }
  };

  const refreshKingdom = async () => {
    try {
      const refreshed = await apiCall('/api/kingdom/me');
      if (refreshed && !refreshed.error) {
        // Parse resource_sequence if present
        let seq = refreshed.resource_sequence || {};
        if (typeof seq === 'string') {
          try { seq = JSON.parse(seq); } catch { seq = {}; }
        }
        // Set kingdom data directly from API response
        setKingdom({ ...refreshed, _seq: seq });

        if (applyGameMutation) {
          applyGameMutation(refreshed, { reason: 'resources-refresh' });
        }
        syncFromState();
        return refreshed;
      }
      return refreshed;
    } catch (e) {
      console.error(e);
      return { error: e.message };
    }
  };

  useEffect(() => {
    syncFromState();
    loadNodes();
    loadExpeditions();
    const cdt = setInterval(() => setNow(Math.floor(Date.now()/1000)), 1000);
    const refreshTimer = setInterval(syncFromState, REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(cdt);
      clearInterval(refreshTimer);
    };
  }, [syncFromState]);

  useEffect(() => {
    if (activePanel !== 'resources') return;
    syncFromState();
    loadNodes();
    loadExpeditions();
  }, [activePanel, syncFromState]);

  useEffect(() => {
    if (activeTab === 'stockpiles' || activeTab === 'buildings') syncFromState();
    if (activeTab === 'expeditions') { loadNodes(); loadExpeditions(); }
    if (activeTab === 'inventory') syncFromState();
  }, [activeTab, syncFromState]);

  const getBldCap = (bld) => {
    if (bld.stage === 1) return 3;
    if (bld.stage === 2) return 5;
    if (bld.stage === 3) {
      const level = kingdom.level || 1;
      return Math.floor((level - 1) / 10) + 1;
    }
    return Infinity;
  };

  const isAtCap = (bld) => {
    if (!kingdom.level) return false;
    const type = bld.type;
    const s2Col = { wood: 'bld_lumber_camp', stone: 'bld_blockfield', iron: 'bld_strip_mine' }[type];
    const s3Col = { wood: 'bld_sawmill', stone: 'bld_stone_quarry', iron: 'bld_deep_mine' }[type];

    const bq = getParsedStateProp('build_queue') || {};
    const s2Current = (kingdom[s2Col] || 0) + (bq[s2Col.replace('bld_', '')] || 0);
    const s3Current = kingdom[s3Col] || 0;
    const s3Cap = Math.floor(((kingdom.level || 1) - 1) / 10) + 1;

    if (s3Current >= s3Cap) return true;
    if (bld.stage === 1) {
      const built = (kingdom['bld_' + bld.key] || 0) + (bq[bld.key] || 0);
      if (built >= 3) return true;
      if (s2Current > 0) return true;
    }
    if (bld.stage === 2) {
      const built = (kingdom['bld_' + bld.key] || 0) + (bq[bld.key] || 0);
      if (built >= 5) return true;
    }
    const cap = getBldCap(bld);
    if (cap === Infinity) return false;
    const built = kingdom['bld_' + bld.key] || 0;
    const queued = bq[bld.key] || 0;
    return (built + queued) >= cap;
  };

  const isUpgradeUnlocked = (type, stage) => {
    const seq = kingdom._seq || {};
    const typeSeq = seq[type] || {};
    if (stage === 2) return typeSeq.s2_paid_at_bracket > -1;
    if (stage === 3) return typeSeq.s3_paid_at_bracket > -1;
    return false;
  };

  const getAvailableEngineers = () => {
    if (!kingdom) return 0;
    const buildAlloc = getParsedStateProp('build_allocation');
    const resourceAlloc = getParsedStateProp('resource_build_allocation');
    const buildEngaged = Object.values(buildAlloc).reduce((sum, n) => sum + (Number(n) || 0), 0);
    const resourceEngaged = Object.values(resourceAlloc).reduce((sum, n) => sum + (Number(n) || 0), 0);
    return Math.max(0, (kingdom.engineers || 0) - buildEngaged - resourceEngaged);
  };

  const getActiveBuild = (type) => {
    if (!kingdom.level) return null;
    const bq = getParsedStateProp('build_queue');
    const bp = getParsedStateProp('build_progress');
    const alloc = getParsedStateProp('resource_build_allocation');
    for (const bld of Object.values(BUILDING_CONFIG)) {
      if (bld.type !== type) continue;
      if ((bq[bld.key] || 0) <= 0) continue;
      const progress = bp[bld.key] || 0;
      const cost = BUILDING_COST[bld.key];
      const engineers = alloc[bld.key] || 0;
      const pct = Math.min(100, Math.round(progress / cost * 100));
      const remaining = engineers > 0 ? Math.ceil((cost - progress) / engineers) : '∞';
      return { key: bld.key, label: bld.label, stage: bld.stage, progress, cost, engineers, pct, remaining };
    }
    return null;
  };

  const getCardStyle = (bld, rtypeKey) => {
    const base = { marginBottom: '10px', transition: 'all 0.3s' };
    const active = getActiveBuild(rtypeKey);
    if (active && active.stage !== bld.stage) {
      return { ...base, opacity: 0.4, filter: 'grayscale(100%)', pointerEvents: 'none' };
    }
    if (!active && buildingInProgress[rtypeKey]) {
      const bq = getParsedStateProp('build_queue');
      if ((bq && bq[bld.key] || 0) <= 0) {
        return { ...base, opacity: 0.4, filter: 'grayscale(100%)', pointerEvents: 'none' };
      }
    }
    if (!active && !buildingInProgress[rtypeKey]) {
      const blds = buildingsByType(rtypeKey);
      const s1 = blds.find(b => b.stage === 1);
      const s2 = blds.find(b => b.stage === 2);
      let activeStage = 1;
      if (s1 && isAtCap(s1)) activeStage = 2;
      if (s2 && isAtCap(s2) && isAtCap(s1)) activeStage = 3;
      if (bld.stage !== activeStage) {
        return { ...base, opacity: 0.4, filter: 'grayscale(100%)' };
      }
    }
    return base;
  };

  const turnsToComplete = (bld) => {
    const eng = getAvailableEngineers();
    if (eng <= 0) return '∞';
    return Math.ceil(BUILDING_COST[bld.key] / eng);
  };
  const isBuildingActive = (key) => (getParsedStateProp('build_queue')[key] || 0) > 0;
  const getBuildProgress = (key) => getParsedStateProp('build_progress')[key] || 0;
  const getBuildEngineers = (key) => getParsedStateProp('resource_build_allocation')[key] || 0;
  const getBuildPct = (key) => {
    const cost = BUILDING_COST[key];
    return Math.min(100, Math.round(getBuildProgress(key) / cost * 100));
  };
  const getBuildRemaining = (key) => {
    const progress = getBuildProgress(key);
    const cost = BUILDING_COST[key] || 0;
    const remaining = cost - progress;
    if (remaining <= 0) return 0;
    const eng = getBuildEngineers(key);
    if (!eng || eng <= 0) return '∞';
    const result = Math.ceil(remaining / eng);
    return isFinite(result) && result > 0 ? result : '∞';
  };

  const scoutNode = async () => {
    setScouting(true); setScoutMsg('');
    try {
      const data = await apiCall('/api/kingdom/scout-node', { method: 'POST' });
      if (data.ok) {
        setScoutMsg(`Discovered: ${data.node.name} (${data.node.type}, richness ${data.node.richness})`);
        await loadNodes();
        await refreshKingdom();
        emitAppEvent(AppEvent.WORLDMAP_REFRESH);
      } else {
        setScoutMsg('Error: ' + (data.error || 'Unknown'));
      }
    } catch(e) { setScoutMsg('Error: ' + e.message); }
    setScouting(false);
  };
  const launchExpedition = async (node) => {
    const pop = expPop[node.id] || 0;
    if (pop < 10) return;
    setLaunching(p => ({...p, [node.id]: true}));
    try {
      const data = await apiCall('/api/kingdom/expedition/launch', {
        method: 'POST',
        body: { nodeId: node.id, populationSent: pop }
      });
      if (data.ok) {
        await loadExpeditions();
        const typeEmoji = { wood: '🪵', stone: '🪨', iron: '🔗' };
        const icon = typeEmoji[node.type] || '🧭';
        const foodStr = data.foodTaken > 0 ? ` - food ${data.foodTaken.toLocaleString()} taken` : '';
        dispatchExpeditionLogEntry(icon, `Resource expedition departed to ${node.name}`, `${pop.toLocaleString()} civilians - ${node.type}${foodStr}`);
        await refreshKingdom();
        emitAppEvent(AppEvent.WORLDMAP_REFRESH);
      } else { if(toast) toast('Failed: ' + (data.error || 'Unknown'), 'error'); }
    } catch(e) { if(toast) toast('Error: ' + e.message, 'error'); }
    setLaunching(p => ({...p, [node.id]: false}));
  };

  const interceptExpedition = async (expId) => {
    const fighters = interceptFighters[expId] || 0;
    if (fighters < 1) return toast('Enter number of fighters.', 'error');
    setIntercepting(p => ({...p, [expId]: true}));
    try {
      const data = await apiCall('/api/kingdom/expedition/intercept', {
        method: 'POST',
        body: { expeditionId: expId, fighters }
      });
      if (data.ok) {
        if(toast) toast(data.success ? `Interception successful! Loot: ${JSON.stringify(data.loot)}` : 'Interception failed. Took casualties.', data.success ? 'success' : 'error');
        await loadVisibleExps();
        await refreshKingdom();
      } else { if(toast) toast('Error: ' + (data.error || 'Unknown'), 'error'); }
    } catch(e) { if(toast) toast('Error: ' + e.message, 'error'); }
    setIntercepting(p => ({...p, [expId]: false}));
  };
  const startBuild = async (bld) => {
    const type = BUILDING_CONFIG[bld.key]?.type;
    if (buildingInProgress[type] || getActiveBuild(type)) return;
    const engineers = parseInt(engineerAllocations[bld.key] || '0', 10) || 0;
    if (engineers < 1) return toast('Assign at least 1 engineer to start this build.', 'error');
    const avail = getAvailableEngineers();
    if (engineers > avail) return toast(`Only ${avail.toLocaleString()} engineers available.`, 'error');
    setBuildingInProgress(p => ({...p, [type]: true}));
    try {
      const d1 = await apiCall('/api/kingdom/build-queue', {
        method: 'POST',
        body: { orders: { [bld.key]: 1 } }
      });
      if (d1.error) { setBuildingInProgress(p => ({...p, [type]: false})); return toast(d1.error, 'error'); }

      const s = getState();
      if (s) {
        const curQ = getParsedStateProp('build_queue');
        s.build_queue = { ...curQ, [bld.key]: (curQ[bld.key] || 0) + 1 };
        if (d1.engineers !== undefined) s.engineers = d1.engineers;
      }

      const newAlloc = { ...getParsedStateProp('resource_build_allocation'), [bld.key]: engineers };
      const d2 = await apiCall('/api/kingdom/resource-build-allocation', {
        method: 'POST',
        body: { allocation: newAlloc }
      });
      if (!d2.ok && toast) toast('Build queued but engineer allocation failed: ' + (d2.error || 'Unknown'), 'error');
      if (d2.ok && s) s.resource_build_allocation = newAlloc;
      syncFromState();
      await refreshKingdom();
    } catch(e) {
      setBuildingInProgress(p => ({...p, [type]: false}));
      if(toast) toast('Error: ' + e.message, 'error');
    }
  };
  const purchaseUpgrade = async (type, stage) => {
    try {
      const data = await apiCall('/api/kingdom/resource-upgrade', {
        method: 'POST',
        body: { type, toStage: stage }
      });
      if (data.ok) {
        toast('Upgrade purchased!', 'success');
        await refreshKingdom();
      } else {
        toast('Error: ' + (data.error || 'Unknown'), 'error');
      }
    } catch(e) {
      toast('Error: ' + e.message, 'error');
    }
  };

  const hasActiveExpedition = (nodeId) => activeExpeditions.some(e => e.node_id === nodeId);
  const countdown = (ts) => {
    if (!ts) return 'N/A';
    const diff = ts - now;
    if (diff <= 0) return 'Done';
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const setMax = (bld) => {
    setEngineerAllocations((prev) => ({ ...prev, [bld.key]: getAvailableEngineers() }));
  };

  const getPopData = () => {
    const s = kingdom || {};
    const hiredUnits = (s.fighters||0)+(s.rangers||0)+(s.clerics||0)+(s.mages||0)+(s.thieves||0)+(s.ninjas||0)+(s.researchers||0)+(s.engineers||0)+(s.thralls||0);
    const freePop = Math.max(0, (s.population||0) - hiredUnits);
    return { pop: s.population || 0, hired: hiredUnits, freePop };
  };
  const { pop, hired, freePop } = getPopData();

  const handleRefresh = useCallback(() => {
    syncFromState();
    loadNodes();
    loadExpeditions();
  }, [syncFromState]);

  return (
    <div id="resources" className="panel">
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-950/80 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="card-title mb-1">Resources</div>
          <div className="text-[13px] text-[var(--text3)]">
            Manage stockpiles, buildings, expeditions, and inventory in one place.
          </div>
        </div>
        <button className="base-btn rounded-full px-3 py-1.5 text-[11px] font-semibold" onClick={handleRefresh}>↻ Refresh</button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-white/10 pb-1.5">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={clsx('admin-tab base-btn rounded-none border border-white/10 px-3 py-2 text-[12px]', activeTab === tab.id ? 'active pb-2.5' : 'pb-2')}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'stockpiles' && (
        <div>
          <div className="card">
            <div className="card-title">Resource Stockpiles</div>
            <div className='grid auto-fit gap-3 mt-3 w-full'>
              {resourceTypes.map(res => {
                const raceMult = RACE_YIELD_BONUS[kingdom.race]?.[res.key] ?? 1.0;
                let totalWorkers = 0;
                let totalPer5 = 0;
                for (const bld of Object.values(BUILDING_CONFIG)) {
                  if (bld.type !== res.key) continue;
                  const count = kingdom['bld_' + bld.key] || 0;
                  if (count <= 0) continue;
                  totalWorkers += count * bld.workersPerBuilding;
                  if (freePop >= totalWorkers) {
                    totalPer5 += count * bld.yield * (5 / bld.yieldEvery) * raceMult;
                  }
                }
                const perTurn = totalPer5 / 5;
                const strYield = totalPer5 <= 0 ? '0' : perTurn >= 1 ? `+${fmt(perTurn)}/turn` : `+${fmt(totalPer5)} every 5 turns`;
                const titleStr = raceMult !== 1.0 ? `${raceMult >= 1 ? '+' : ''}${Math.round((raceMult - 1) * 100)}% racial modifier` : '';

                return (
                  <div key={res.key} className='p-3.5 rounded-lg bg-[var(--bg2)] border border-[var(--border)]'>
                    <div className="flex items-center gap-2 mb-2">
                      <span className='text-2xl'>{res.icon}</span>
                      <div>
                        <div className="text-[12px] font-semibold text-[var(--text3)]">{res.label}</div>
                        <div className="text-[22px] font-bold text-[var(--green)]" id={`res-stock-${res.key}`}>{fmt(kingdom[res.key] || 0)}</div>
                      </div>
                    </div>
                    <div className="text-[11px] text-[var(--text3)]">
                      <div title={titleStr}>Yield: <span className='text-[var(--text)]' id={`res-yield-${res.key}`}>{strYield}</span></div>
                      <div>Workers needed: <span className='text-[var(--text)]' id={`res-workers-${res.key}`}>{fmt(totalWorkers)}</span></div>
                      <div>Status: <span id={`res-status-${res.key}`} className={clsx(freePop >= totalWorkers ? 'text-[var(--green)]' : 'text-[var(--red)]')}>{totalWorkers === 0 ? '-' : freePop >= totalWorkers ? 'Operating' : 'Understaffed'}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card mt-3">
            <div className="card-title">Workforce</div>
            <div className="text-[13px] text-[var(--text3)] mt-2 flex flex-col gap-1">
              <div>Total population: <span id="res-pop-total" className='text-[var(--text)]'>{fmt(pop)}</span></div>
              <div>Hired units: <span id="res-pop-hired" className='text-[var(--text)]'>{fmt(hired)}</span></div>
              <div>Free population: <span id="res-pop-free" className={clsx(freePop > 0 ? 'text-[var(--green)]' : 'text-[var(--red)]')}>{fmt(freePop)}</span></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'buildings' && (
        <div>
          <div id="buildings-guide-card" className="card" className='mb-3 bg-blue-950/5 border border-blue-500/15 p-3.5'>
            <div id="guide-header-toggle" className="flex justify-between items-center cursor-pointer select-none" onClick={() => setShowGuide(!showGuide)}>
              <div className="font-semibold text-[13px] text-[#60a5fa] flex items-center gap-1.5">
                💡 <span>Guide: How to build buildings &amp; produce resources</span>
              </div>
              <span className="text-[11px] text-[var(--text3)]">{showGuide ? 'Collapse [\u2212]' : 'Expand Guide [+]'}</span>
            </div>
            {showGuide && (
              <div className="mt-2.5 border-t border-t-blue-500/10 pt-2.5">
                <ol className="text-[11.5px] text-[var(--text3)] pl-[18px] m-0 flex flex-col gap-1.5 leading-[1.45]">
                  <li><strong>Hire Engineers:</strong> First, go hire/train Engineers in the <strong>Train/Hire</strong> panel. They do the actual physical work of construction!</li>
                  <li><strong>Assign Workers:</strong> Type the number of engineers to allocate in the <code>Eng</code> box (or click <strong>Max</strong>) beside your desired building.</li>
                  <li><strong>Begin Construction:</strong> Click <span className='font-semibold text-[var(--green)]'>Build</span>. Note that you can only construct one active project per resource category (Wood / Stone / Iron) at a time.</li>
                  <li><strong>Advance Turns:</strong> Construction effort is applied as you play turns. Your assigned engineers will contribute work automatically on each turn until the building reaches 100% completion.</li>
                  <li><strong>Unlock Stage Upgrades:</strong> Higher tier buildings (Stage 2 &amp; 3) require purchasing Stage Upgrades with gold before they can be built. Look for purchase buttons under those panels!</li>
                </ol>
              </div>
            )}
          </div>

          <div className="card" className='mb-3'>
            <div className='flex border-b border-[var(--border)] mb-3'>
              {resourceTypes.map(rtype => (
                <button
                  key={rtype.key}
                  onClick={() => setActiveBldTab(rtype.key)}
                  className={clsx('px-3.5 py-2 bg-transparent border-none cursor-pointer text-[12px] border-b-2 border-b-transparent', activeBldTab === rtype.key ? 'text-[var(--green)] border-b-[var(--green)] font-semibold' : 'text-[var(--text3)]')}
                >
                  {rtype.icon} {rtype.label}
                </button>
              ))}
            </div>
          </div>

          {resourceTypes.map(rtype => activeBldTab === rtype.key && (
            <div key={rtype.key}>
              <div className="card" className='mb-2.5 p-3.5 text-xs text-[var(--text3)]'>
                🔧 Available engineers: <span className='font-semibold text-[var(--green)]'>{fmt(getAvailableEngineers())}</span>
                &nbsp;&middot;&nbsp; Total: {fmt(kingdom.engineers || 0)}
                &nbsp;&middot;&nbsp; Engaged: {fmt((kingdom.engineers || 0) - getAvailableEngineers())}
              </div>

              {buildingsByType(rtype.key).map(bld => {
                const bCap = getBldCap(bld);
                const atCap = isAtCap(bld);
                const isAct = isBuildingActive(bld.key);
                const s2Un = isUpgradeUnlocked(rtype.key, 2);
                const s3Un = isUpgradeUnlocked(rtype.key, 3);
                const actType = getActiveBuild(rtype.key);
                const disab = !!actType || !!buildingInProgress[rtype.key] || atCap;

                return (
                  <div key={bld.key} className="card" style={getCardStyle(bld, rtype.key)}>
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div className="flex-1 min-w-[200px]">
                        <div className="font-semibold text-[14px] text-[var(--text)]">
                          Stage {bld.stage}: {bld.label}
                        </div>
                        <div className="text-[12px] text-[var(--text3)] mt-[3px]">
                          Built: <span id={`bld-count-${bld.key}`} className={clsx(atCap ? 'text-[var(--red)]' : 'text-[var(--green)]')}>{fmt(kingdom['bld_' + bld.key] || 0)}</span>
                          {bCap !== Infinity && <span>&nbsp;&middot;&nbsp; Cap: <span className={clsx(atCap && 'text-[var(--red)]')}>{bCap}</span></span>}
                          &nbsp;&middot;&nbsp; Yield: {bld.yield} {rtype.label.toLowerCase()} / {bld.yieldEvery === 1 ? 'turn' : bld.yieldEvery + ' turns'}
                          &nbsp;&middot;&nbsp; {bld.workersPerBuilding} workers/building
                        </div>
                        {bld.stage === 2 && !s2Un && (
                          <div className='text-[11px] mt-1'>
                            <span className='text-[var(--text3)]'>Req: stage-2 upgrade (200 {rtype.label.toLowerCase()} + 10,000 gold). </span>
                            <span id={`s2-status-${rtype.key}`} className='text-[var(--red)]'>Locked</span>
                          </div>
                        )}
                        {bld.stage === 3 && !s3Un && (
                          <div className='text-[11px] mt-1'>
                            <span className='text-[var(--text3)]'>Req: stage-3 upgrade (1,000 {rtype.label.toLowerCase()} + 500 {rtype.key === 'iron' ? 'stone' : 'iron'} + 100,000 gold). </span>
                            <span id={`s3-status-${rtype.key}`} className='text-[var(--red)]'>Locked</span>
                          </div>
                        )}
                        <div id={`bracket-lock-${rtype.key}-${bld.stage}`} className="text-[11px] text-[var(--red)] mt-[3px] hidden">
                          Bracket locked - advance a level bracket to build more.
                        </div>
                        <div className="mt-1.5 text-[11px] text-[var(--text3)]">
                          Cost:
                          {GOLD_COST[bld.key] > 0 && <span> {fmt(GOLD_COST[bld.key])} gold</span>}
                          {WOOD_COST[bld.key] > 0 && <span> &middot; {fmt(WOOD_COST[bld.key])} wood</span>}
                          {STONE_COST[bld.key] > 0 && <span> &middot; {fmt(STONE_COST[bld.key])} stone</span>}
                          {IRON_COST[bld.key] > 0 && <span> &middot; {fmt(IRON_COST[bld.key])} iron</span>}
                          <span> &middot; {LAND_COST[bld.key]} land</span>
                          <span className='text-[var(--text2)]'> &middot; {fmt(BUILDING_COST[bld.key])} effort ({turnsToComplete(bld)} turns)</span>
                        </div>

                        {isAct && (
                          <React.Fragment>
                            <div className="mt-2.5 bg-[var(--bg)] rounded border border-[var(--border)] h-2.5 overflow-hidden">
                              <div className="h-full rounded bg-[var(--green)] transition-[width] duration-300" style={{ width: getBuildPct(bld.key) + '%' }}></div>
                            </div>
                            <div className="text-[11px] text-[var(--text3)] mt-[3px]">
                              {fmt(getBuildProgress(bld.key))} / {fmt(BUILDING_COST[bld.key])} effort ({getBuildPct(bld.key)}%)
                              &nbsp;&middot;&nbsp; ~{getBuildRemaining(bld.key)} turns remaining
                            </div>
                          </React.Fragment>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5 items-end ml-auto">
                        {isAct ? (
                          <div className="text-[11px] text-[var(--text3)] text-right">{fmt(getBuildEngineers(bld.key))} engineers assigned</div>
                        ) : (
                          <React.Fragment>
                            <div className='flex items-center gap-1.5'>
                              <input type="number" min="0" value={engineerAllocations[bld.key] || ''} onChange={(e) => setEngineerAllocations((prev) => ({ ...prev, [bld.key]: e.target.value }))} placeholder="Eng"
                                disabled={disab}
                                className="w-[70px] px-1.5 py-1 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-[12px] text-center" />
                              <button onClick={() => setMax(bld)} disabled={disab}
                                className={clsx('px-2.5 py-1 rounded border-2 border-[var(--green)] bg-transparent text-[var(--green)] cursor-pointer text-[11px] font-bold', disab && 'opacity-40 cursor-not-allowed')}>
                                Max
                              </button>
                              <button onClick={() => startBuild(bld)} disabled={disab}
                                className={clsx('px-3 py-1.5 rounded border-none cursor-pointer text-[12px] font-semibold bg-[var(--green)] text-black', disab && 'opacity-40 cursor-not-allowed')}>
                                Build
                              </button>
                            </div>
                            {atCap && (
                              <div className="text-[11px] text-[var(--red)] font-semibold">
                                Cap Reached
                              </div>
                            )}
                            {bld.stage === 2 && !s2Un && (
                              <button id={`unlock-s2-${rtype.key}`} onClick={() => purchaseUpgrade(rtype.key, 2)}
                                className="px-2.5 py-[5px] rounded border-none cursor-pointer text-[11px] font-semibold bg-[var(--gold)] text-black">
                                Unlock Stage 2 (10,000 gold)
                              </button>
                            )}
                            {bld.stage === 3 && !s3Un && (
                              <button id={`unlock-s3-${rtype.key}`} onClick={() => purchaseUpgrade(rtype.key, 3)}
                                className="px-2.5 py-[5px] rounded border-none cursor-pointer text-[11px] font-semibold bg-[var(--gold)] text-black">
                                Unlock Stage 3 (100,000 gold)
                              </button>
                            )}
                          </React.Fragment>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'expeditions' && (
        <div>
          <div className="card mb-3">
            <div className="card-title">Scout New Nodes</div>
            <div className='text-xs text-[var(--text3)] my-1.5 mb-2.5'>Pay 500 gold to discover a new resource node.</div>
            <button onClick={scoutNode} disabled={scouting}
              className="px-4 py-2 rounded-lg border-none cursor-pointer font-semibold bg-[var(--green)] text-black">
              {scouting ? 'Scouting...' : '🔭 Scout Node (500 gold)'}
            </button>
            {scoutMsg && (
              <div className={clsx('mt-2 text-[12px]', scoutMsg.startsWith('Error') ? 'text-[var(--red)]' : 'text-[var(--green)]')}>{scoutMsg}</div>
            )}
          </div>

          <div className="card mb-3">
            <div className='flex justify-between items-center'>
              <div className="card-title">Discovered Nodes ({nodes.length})</div>
              <button onClick={loadNodes} className="px-2.5 py-1 rounded border border-[var(--border)] bg-[var(--bg2)] text-[var(--text3)] cursor-pointer text-[11px]">Refresh</button>
            </div>
            {nodes.length === 0 && <div className="text-[12px] text-[var(--text3)] mt-2">No nodes discovered yet. Scout to find resource nodes!</div>}
            {nodes.map(node => (
              <div key={node.id} className="mt-2.5 p-2.5 rounded-lg bg-[var(--bg2)] border border-[var(--border)]">
                <div className='flex justify-between items-start flex-wrap gap-2'>
                  <div>
                    <div className='font-semibold text-sm'>{node.name}</div>
                    <div className='text-[11px] text-[var(--text3)] mt-0.5'>
                      {typeIcon(node.type)} {node.type} &nbsp;&middot;&nbsp; Richness: <span className='text-[var(--gold)]'>{'★'.repeat(node.richness)}</span>
                      &nbsp;&middot;&nbsp; Distance: {formatDuration(node.distance)}
                    </div>
                  </div>
                  <div className='flex items-center gap-1.5'>
                    <input type="number" min="10" placeholder="Pop (min 10)"
                      value={expPop[node.id] || ''} onChange={(e) => setExpPop(p => ({...p, [node.id]: parseInt(e.target.value)}))}
                      className="w-[100px] px-1.5 py-1 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-[12px] text-center" />
                    <button onClick={() => launchExpedition(node)}
                      disabled={hasActiveExpedition(node.id) || (expPop[node.id] || 0) < 10 || launching[node.id]}
                      className={clsx('px-2.5 py-[5px] rounded border-none cursor-pointer text-[12px] font-semibold text-white', hasActiveExpedition(node.id) ? 'bg-[var(--text3)] cursor-not-allowed' : 'bg-[#3b82f6]')}>
                      {hasActiveExpedition(node.id) ? 'Active' : launching[node.id] ? '...' : 'Dispatch'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card mb-3">
            <div className='flex justify-between items-center'>
              <div className="card-title">Active Expeditions ({activeExpeditions.length})</div>
              <button onClick={loadExpeditions} className="px-2.5 py-1 rounded border border-[var(--border)] bg-[var(--bg2)] text-[var(--text3)] cursor-pointer text-[11px]">Refresh</button>
            </div>
            {activeExpeditions.length === 0 && <div className="text-[12px] text-[var(--text3)] mt-2">No active expeditions.</div>}
            {activeExpeditions.map(exp => (
              <div key={exp.id} className="mt-2.5 p-2.5 rounded-lg bg-[var(--bg2)] border border-[var(--border)]">
                <div className='flex justify-between items-start flex-wrap gap-2'>
                  <div>
                    <div className='font-semibold text-sm'>{exp.node_name} <span className="text-[11px] text-[var(--text3)]">({typeIcon(exp.node_type)} {exp.node_type})</span></div>
                    <div className='text-[11px] text-[var(--text3)] mt-0.5'>
                      Pop: {fmt(exp.population_sent)} &middot; Status: <span style={statusColor(exp.status)}>{exp.status}</span>
                      {exp.food_taken > 0 && <span> &middot; 🍖 {fmt(exp.food_taken)} food taken</span>}
                    </div>
                    {exp.loot && Object.keys(exp.loot).filter(k => !k.startsWith('_')).length > 0 && (
                      <div className="text-[11px] text-[var(--green)] mt-0.5">
                        Loot: {formatLoot(exp.loot)}
                      </div>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text3)] text-right whitespace-nowrap">
                    {exp.status === 'outbound' && <div>Arrives: <span className='text-[var(--text)]'>{countdown(exp.arrive_at)}</span></div>}
                    {exp.status === 'harvesting' && <div>Done: <span className='text-[var(--gold)]'>{countdown(exp.harvest_ends_at)}</span></div>}
                    {exp.status === 'returning' && <div>Returns: <span className='text-[var(--green)]'>{countdown(exp.return_at)}</span></div>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {isOrc && (
            <div className="card border border-[var(--red)]">
              <div className="card-title" className='text-[var(--red)]'>Orc Interception</div>
              <div className='text-xs text-[var(--text3)] my-1.5 mb-2.5'>Intercept other kingdoms' expeditions. Need 3x combat power of the civilians.</div>
              <button onClick={loadVisibleExps} className="px-2.5 py-1 rounded border border-[var(--red)] bg-transparent text-[var(--red)] cursor-pointer text-[11px] mb-2">Scan Expeditions</button>
              {visibleExps.length === 0 && <div className="text-[12px] text-[var(--text3)]">No visible expeditions.</div>}
              {visibleExps.map(vExp => (
                <div key={vExp.id} className="mt-2 p-2 bg-[var(--bg2)] rounded flex justify-between items-center flex-wrap gap-2">
                  <div className='text-xs'>
                    <span className='text-[var(--text3)]'>{vExp.kingdom_name}</span> - {typeIcon(vExp.node_type)} &middot; <span style={statusColor(vExp.status)}>{vExp.status}</span> &middot; Pop: {fmt(vExp.population_sent)}
                  </div>
                  <div className='flex items-center gap-1.5'>
                    <input type="number" min="1" placeholder="Fighters" value={interceptFighters[vExp.id] || ''} onChange={(e) => setInterceptFighters(p => ({...p, [vExp.id]: parseInt(e.target.value)}))}
                      className="w-[80px] px-1.5 py-1 rounded border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-[12px] text-center" />
                    <button onClick={() => interceptExpedition(vExp.id)} disabled={intercepting[vExp.id]}
                      className={clsx('px-2.5 py-[5px] rounded border-none cursor-pointer text-[12px] font-semibold bg-[var(--red)] text-white', intercepting[vExp.id] && 'opacity-50')}>
                      {intercepting[vExp.id] ? '...' : 'Intercept'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="card">
          <div className="card-title">Item Inventory</div>
          {items.length === 0 && <div className="text-[12px] text-[var(--text3)] mt-2">No items found.</div>}
          <div className="grid gap-2.5 mt-3 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
            {items.map(item => (
              <div key={item.id} className={clsx('p-3 rounded-lg bg-[var(--bg2)] text-center border', (item.qty || 0) > 0 ? 'border-[var(--green)]' : 'border-[var(--border)]')}>
                <div className="text-2xl mb-1">{itemIcon(item.id)}</div>
                <div className="text-[11px] font-semibold text-[var(--text)]">{item.name}</div>
                <div className={clsx('text-[20px] font-bold mt-1', (item.qty || 0) > 0 ? 'text-[var(--green)]' : 'text-[var(--text3)]')}>{item.qty || 0}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourcesPanel;
