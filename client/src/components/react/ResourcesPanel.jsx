import React, { useState, useEffect, useCallback } from 'react';
import { apiCall } from '../../utils/api';

const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

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
  woodyard:     { key: 'woodyard',     type: 'wood',  stage: 1, label: 'Woodyard',     workersPerBuilding: 10,  yield: 1, yieldEvery: 5 },
  lumber_camp:  { key: 'lumber_camp',  type: 'wood',  stage: 2, label: 'Lumber Camp',  workersPerBuilding: 25,  yield: 3, yieldEvery: 5 },
  sawmill:      { key: 'sawmill',      type: 'wood',  stage: 3, label: 'Sawmill',       workersPerBuilding: 75,  yield: 1, yieldEvery: 1 },
  gravel_pit:   { key: 'gravel_pit',   type: 'stone', stage: 1, label: 'Gravel Pit',   workersPerBuilding: 30,  yield: 1, yieldEvery: 5 },
  blockfield:   { key: 'blockfield',   type: 'stone', stage: 2, label: 'Blockfield',   workersPerBuilding: 75,  yield: 3, yieldEvery: 5 },
  stone_quarry: { key: 'stone_quarry', type: 'stone', stage: 3, label: 'Stone Quarry', workersPerBuilding: 225, yield: 1, yieldEvery: 1 },
  open_pit:     { key: 'open_pit',     type: 'iron',  stage: 1, label: 'Open Pit',     workersPerBuilding: 20,  yield: 1, yieldEvery: 5 },
  strip_mine:   { key: 'strip_mine',   type: 'iron',  stage: 2, label: 'Strip Mine',   workersPerBuilding: 50,  yield: 3, yieldEvery: 5 },
  deep_mine:    { key: 'deep_mine',    type: 'iron',  stage: 3, label: 'Deep Mine',    workersPerBuilding: 150, yield: 1, yieldEvery: 1 },
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
function getState() { return window.gameState || {}; }

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
  const [showGuide, setShowGuide] = useState(true);
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

  const syncFromState = useCallback(() => {
    const s = getState();
    setKingdom(s);
    setIsOrc(s.race === 'orc');

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
  }, []);

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

  useEffect(() => {
    syncFromState();
    loadNodes();
    loadExpeditions();
    const cdt = setInterval(() => setNow(Math.floor(Date.now()/1000)), 1000);
    const refreshTimer = setInterval(syncFromState, REFRESH_INTERVAL_MS);
    window.refreshResourcesPanel = () => { syncFromState(); loadExpeditions(); };
    return () => {
      clearInterval(cdt);
      clearInterval(refreshTimer);
      delete window.refreshResourcesPanel;
    };
  }, [syncFromState]);

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
        if (window.refreshKingdom) window.refreshKingdom();
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
        if (window.logExpeditionEntry) {
          const typeEmoji = { wood: '🪵', stone: '🪨', iron: '🔗' };
          const icon = typeEmoji[node.type] || '🧭';
          const foodStr = data.foodTaken > 0 ? ` · 🍖 ${data.foodTaken.toLocaleString()} food taken` : '';
          window.logExpeditionEntry(icon, `Resource expedition departed to ${node.name}`, `${pop.toLocaleString()} civilians · ${node.type}${foodStr}`);
        }
        if (window.refreshKingdom) window.refreshKingdom();
      } else { if(window.toast) window.toast('Failed: ' + (data.error || 'Unknown'), 'error'); }
    } catch(e) { if(window.toast) window.toast('Error: ' + e.message, 'error'); }
    setLaunching(p => ({...p, [node.id]: false}));
  };

  const interceptExpedition = async (expId) => {
    const fighters = interceptFighters[expId] || 0;
    if (fighters < 1) return window.toast && window.toast('Enter number of fighters.', 'error');
    setIntercepting(p => ({...p, [expId]: true}));
    try {
      const data = await apiCall('/api/kingdom/expedition/intercept', {
        method: 'POST',
        body: { expeditionId: expId, fighters }
      });
      if (data.ok) {
        if(window.toast) window.toast(data.success ? `Interception successful! Loot: ${JSON.stringify(data.loot)}` : 'Interception failed. Took casualties.', data.success ? 'success' : 'error');
        await loadVisibleExps();
        if (window.refreshKingdom) window.refreshKingdom();
      } else { if(window.toast) window.toast('Error: ' + (data.error || 'Unknown'), 'error'); }
    } catch(e) { if(window.toast) window.toast('Error: ' + e.message, 'error'); }
    setIntercepting(p => ({...p, [expId]: false}));
  };
  const startBuild = async (bld) => {
    const type = BUILDING_CONFIG[bld.key]?.type;
    if (buildingInProgress[type] || getActiveBuild(type)) return;
    const el = document.getElementById('bld-eng-' + bld.key);
    const engineers = parseInt(el?.value || '0') || 0;
    if (engineers < 1) return window.toast && window.toast('Assign at least 1 engineer to start this build.', 'error');
    const avail = getAvailableEngineers();
    if (engineers > avail) return window.toast && window.toast(`Only ${avail.toLocaleString()} engineers available.`, 'error');
    setBuildingInProgress(p => ({...p, [type]: true}));
    try {
      const d1 = await apiCall('/api/kingdom/build-queue', {
        method: 'POST',
        body: { orders: { [bld.key]: 1 } }
      });
      if (d1.error) { setBuildingInProgress(p => ({...p, [type]: false})); return window.toast && window.toast(d1.error, 'error'); }

      if (d1.engineers !== undefined && window.gameState) {
        window.gameState.engineers = d1.engineers;
      }

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
      if (!d2.ok && window.toast) window.toast('Build queued but engineer allocation failed: ' + (d2.error || 'Unknown'), 'error');
      if (d2.ok && s) s.resource_build_allocation = newAlloc;
      syncFromState();
      if (window.refreshKingdom) {
        await window.refreshKingdom();
        syncFromState();
      }
    } catch(e) {
      setBuildingInProgress(p => ({...p, [type]: false}));
      if(window.toast) window.toast('Error: ' + e.message, 'error');
    }
  };
  const purchaseUpgrade = async (type, stage) => {
    try {
      const data = await apiCall('/api/kingdom/resource-upgrade', {
        method: 'POST',
        body: { type, toStage: stage }
      });
      if (data.ok) {
        if (window.refreshKingdom) {
          await window.refreshKingdom();
          syncFromState();
        }
      } else { if(window.toast) window.toast('Error: ' + (data.error || 'Unknown'), 'error'); }
    } catch(e) { if(window.toast) window.toast('Error: ' + e.message, 'error'); }
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
    const el = document.getElementById('bld-eng-' + bld.key);
    if (el) el.value = getAvailableEngineers();
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
    <div id="resources" className="panel" style={{ display: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', borderBottom: '2px solid var(--border2)', paddingBottom: 0 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`admin-tab base-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ borderRadius: 0, paddingBottom: activeTab === tab.id ? '10px' : '8px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button className="base-btn" onClick={handleRefresh} style={{ fontSize: '11px', padding: '4px 10px' }}>↻ Refresh</button>
      </div>

      {activeTab === 'stockpiles' && (
        <div>
          <div className="card">
            <div className="card-title">Resource Stockpiles</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' }}>
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
                  <div key={res.key} style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '24px' }}>{res.icon}</span>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text3)' }}>{res.label}</div>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--green)' }} id={`res-stock-${res.key}`}>{fmt(kingdom[res.key] || 0)}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                      <div title={titleStr}>Yield: <span style={{ color: 'var(--text)' }} id={`res-yield-${res.key}`}>{strYield}</span></div>
                      <div>Workers needed: <span style={{ color: 'var(--text)' }} id={`res-workers-${res.key}`}>{fmt(totalWorkers)}</span></div>
                      <div>Status: <span id={`res-status-${res.key}`} style={{ color: freePop >= totalWorkers ? 'var(--green)' : 'var(--red)' }}>{totalWorkers === 0 ? '—' : freePop >= totalWorkers ? 'Operating' : 'Understaffed'}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card" style={{ marginTop: '12px' }}>
            <div className="card-title">Workforce</div>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>Total population: <span id="res-pop-total" style={{ color: 'var(--text)' }}>{fmt(pop)}</span></div>
              <div>Hired units: <span id="res-pop-hired" style={{ color: 'var(--text)' }}>{fmt(hired)}</span></div>
              <div>Free population: <span id="res-pop-free" style={{ color: freePop > 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(freePop)}</span></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'buildings' && (
        <div>
          <div id="buildings-guide-card" className="card" style={{ marginBottom: '12px', background: 'rgba(59, 130, 246, 0.03)', border: '1px solid rgba(59, 130, 246, 0.15)', padding: '12px 14px' }}>
            <div id="guide-header-toggle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={() => setShowGuide(!showGuide)}>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}>
                💡 <span>Guide: How to build buildings &amp; produce resources</span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text3)' }}>{showGuide ? 'Collapse [\u2212]' : 'Expand Guide [+]'}</span>
            </div>
            {showGuide && (
              <div style={{ marginTop: '10px', borderTop: '1px solid rgba(59, 130, 246, 0.1)', paddingTop: '10px' }}>
                <ol style={{ fontSize: '11.5px', color: 'var(--text3)', paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px', lineHeight: 1.45 }}>
                  <li><strong>Hire Engineers:</strong> First, go hire/train Engineers in the <strong>Train/Hire</strong> panel. They do the actual physical work of construction!</li>
                  <li><strong>Assign Workers:</strong> Type the number of engineers to allocate in the <code>Eng</code> box (or click <strong>Max</strong>) beside your desired building.</li>
                  <li><strong>Begin Construction:</strong> Click <span style={{ color: 'var(--green)', fontWeight: 600 }}>Build</span>. Note that you can only construct one active project per resource category (Wood / Stone / Iron) at a time.</li>
                  <li><strong>Advance Turns:</strong> Construction effort is applied as you play turns. Your assigned engineers will contribute work automatically on each turn until the building reaches 100% completion.</li>
                  <li><strong>Unlock Stage Upgrades:</strong> Higher tier buildings (Stage 2 &amp; 3) require purchasing Stage Upgrades with gold before they can be built. Look for purchase buttons under those panels!</li>
                </ol>
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 0, marginBottom: '12px' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '12px' }}>
              {resourceTypes.map(rtype => (
                <button
                  key={rtype.key}
                  onClick={() => setActiveBldTab(rtype.key)}
                  style={{
                    padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', borderBottom: '2px solid transparent',
                    ...(activeBldTab === rtype.key ? { color: 'var(--green)', borderBottomColor: 'var(--green)', fontWeight: 600 } : { color: 'var(--text3)' })
                  }}
                >
                  {rtype.icon} {rtype.label}
                </button>
              ))}
            </div>
          </div>

          {resourceTypes.map(rtype => activeBldTab === rtype.key && (
            <div key={rtype.key}>
              <div className="card" style={{ marginBottom: '10px', padding: '10px 14px', fontSize: '12px', color: 'var(--text3)' }}>
                🔧 Available engineers: <span style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(getAvailableEngineers())}</span>
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
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>
                          Stage {bld.stage}: {bld.label}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '3px' }}>
                          Built: <span id={`bld-count-${bld.key}`} style={{ color: atCap ? 'var(--red)' : 'var(--green)' }}>{fmt(kingdom['bld_' + bld.key] || 0)}</span>
                          {bCap !== Infinity && <span>&nbsp;&middot;&nbsp; Cap: <span style={atCap ? { color: 'var(--red)' } : {}}>{bCap}</span></span>}
                          &nbsp;&middot;&nbsp; Yield: {bld.yield} {rtype.label.toLowerCase()} / {bld.yieldEvery === 1 ? 'turn' : bld.yieldEvery + ' turns'}
                          &nbsp;&middot;&nbsp; {bld.workersPerBuilding} workers/building
                        </div>
                        {bld.stage === 2 && !s2Un && (
                          <div style={{ fontSize: '11px', marginTop: '4px' }}>
                            <span style={{ color: 'var(--text3)' }}>Req: stage-2 upgrade (200 {rtype.label.toLowerCase()} + 10,000 gold). </span>
                            <span id={`s2-status-${rtype.key}`} style={{ color: 'var(--red)' }}>Locked</span>
                          </div>
                        )}
                        {bld.stage === 3 && !s3Un && (
                          <div style={{ fontSize: '11px', marginTop: '4px' }}>
                            <span style={{ color: 'var(--text3)' }}>Req: stage-3 upgrade (1,000 {rtype.label.toLowerCase()} + 500 {rtype.key === 'iron' ? 'stone' : 'iron'} + 100,000 gold). </span>
                            <span id={`s3-status-${rtype.key}`} style={{ color: 'var(--red)' }}>Locked</span>
                          </div>
                        )}
                        <div id={`bracket-lock-${rtype.key}-${bld.stage}`} style={{ fontSize: '11px', color: 'var(--red)', marginTop: '3px', display: 'none' }}>
                          Bracket locked — advance a level bracket to build more.
                        </div>
                        <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text3)' }}>
                          Cost:
                          {GOLD_COST[bld.key] > 0 && <span> {fmt(GOLD_COST[bld.key])} gold</span>}
                          {WOOD_COST[bld.key] > 0 && <span> &middot; {fmt(WOOD_COST[bld.key])} wood</span>}
                          {STONE_COST[bld.key] > 0 && <span> &middot; {fmt(STONE_COST[bld.key])} stone</span>}
                          {IRON_COST[bld.key] > 0 && <span> &middot; {fmt(IRON_COST[bld.key])} iron</span>}
                          <span> &middot; {LAND_COST[bld.key]} land</span>
                          <span style={{ color: 'var(--text2)' }}> &middot; {fmt(BUILDING_COST[bld.key])} effort ({turnsToComplete(bld)} turns)</span>
                        </div>

                        {isAct && (
                          <React.Fragment>
                            <div style={{ marginTop: '10px', background: 'var(--bg)', borderRadius: '4px', height: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                              <div style={{ background: 'var(--green)', height: '100%', borderRadius: '4px', transition: 'width 0.3s', width: getBuildPct(bld.key) + '%' }}></div>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '3px' }}>
                              {fmt(getBuildProgress(bld.key))} / {fmt(BUILDING_COST[bld.key])} effort ({getBuildPct(bld.key)}%)
                              &nbsp;&middot;&nbsp; ~{getBuildRemaining(bld.key)} turns remaining
                            </div>
                          </React.Fragment>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', marginLeft: 'auto' }}>
                        {isAct ? (
                          <div style={{ fontSize: '11px', color: 'var(--text3)', textAlign: 'right' }}>{fmt(getBuildEngineers(bld.key))} engineers assigned</div>
                        ) : (
                          <React.Fragment>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <input type="number" min="0" id={`bld-eng-${bld.key}`} defaultValue="0" placeholder="Eng"
                                disabled={disab}
                                style={{ width: '70px', padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '12px', textAlign: 'center' }} />
                              <button onClick={() => setMax(bld)} disabled={disab}
                                style={{ padding: '4px 10px', borderRadius: '4px', border: '2px solid var(--green)', background: 'transparent', color: 'var(--green)', cursor: 'pointer', fontSize: '11px', fontWeight: 700, ...(disab ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}>
                                Max
                              </button>
                              <button onClick={() => startBuild(bld)} disabled={disab}
                                style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: 'var(--green)', color: '#000', ...(disab ? { opacity: 0.4, cursor: 'not-allowed' } : {}) }}>
                                Build
                              </button>
                            </div>
                            {atCap && (
                              <div style={{ fontSize: '11px', color: 'var(--red)', fontWeight: 600 }}>
                                Cap Reached
                              </div>
                            )}
                            {bld.stage === 2 && !s2Un && (
                              <button id={`unlock-s2-${rtype.key}`} onClick={() => purchaseUpgrade(rtype.key, 2)}
                                style={{ padding: '5px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, background: 'var(--gold)', color: '#000' }}>
                                Unlock Stage 2 (10,000 gold)
                              </button>
                            )}
                            {bld.stage === 3 && !s3Un && (
                              <button id={`unlock-s3-${rtype.key}`} onClick={() => purchaseUpgrade(rtype.key, 3)}
                                style={{ padding: '5px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, background: 'var(--gold)', color: '#000' }}>
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
          <div className="card" style={{ marginBottom: '12px' }}>
            <div className="card-title">Scout New Nodes</div>
            <div style={{ fontSize: '12px', color: 'var(--text3)', margin: '6px 0 10px' }}>Pay 500 gold to discover a new resource node.</div>
            <button onClick={scoutNode} disabled={scouting}
              style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600, background: 'var(--green)', color: '#000' }}>
              {scouting ? 'Scouting...' : '🔭 Scout Node (500 gold)'}
            </button>
            {scoutMsg && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: scoutMsg.startsWith('Error') ? 'var(--red)' : 'var(--green)' }}>{scoutMsg}</div>
            )}
          </div>

          <div className="card" style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title">Discovered Nodes ({nodes.length})</div>
              <button onClick={loadNodes} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text3)', cursor: 'pointer', fontSize: '11px' }}>Refresh</button>
            </div>
            {nodes.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '8px' }}>No nodes discovered yet. Scout to find resource nodes!</div>}
            {nodes.map(node => (
              <div key={node.id} style={{ marginTop: '10px', padding: '10px', borderRadius: '6px', background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{node.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                      {typeIcon(node.type)} {node.type} &nbsp;&middot;&nbsp; Richness: <span style={{ color: 'var(--gold)' }}>{'★'.repeat(node.richness)}</span>
                      &nbsp;&middot;&nbsp; Distance: {formatDuration(node.distance)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input type="number" min="10" placeholder="Pop (min 10)"
                      value={expPop[node.id] || ''} onChange={(e) => setExpPop(p => ({...p, [node.id]: parseInt(e.target.value)}))}
                      style={{ width: '100px', padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '12px', textAlign: 'center' }} />
                    <button onClick={() => launchExpedition(node)}
                      disabled={hasActiveExpedition(node.id) || (expPop[node.id] || 0) < 10 || launching[node.id]}
                      style={{ padding: '5px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, ...(hasActiveExpedition(node.id) ? { background: 'var(--text3)', color: '#fff', cursor: 'not-allowed' } : { background: '#3b82f6', color: '#fff' }) }}>
                      {hasActiveExpedition(node.id) ? 'Active' : launching[node.id] ? '...' : 'Dispatch'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title">Active Expeditions ({activeExpeditions.length})</div>
              <button onClick={loadExpeditions} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text3)', cursor: 'pointer', fontSize: '11px' }}>Refresh</button>
            </div>
            {activeExpeditions.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '8px' }}>No active expeditions.</div>}
            {activeExpeditions.map(exp => (
              <div key={exp.id} style={{ marginTop: '10px', padding: '10px', borderRadius: '6px', background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{exp.node_name} <span style={{ fontSize: '11px', color: 'var(--text3)' }}>({typeIcon(exp.node_type)} {exp.node_type})</span></div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                      Pop: {fmt(exp.population_sent)} &middot; Status: <span style={statusColor(exp.status)}>{exp.status}</span>
                      {exp.food_taken > 0 && <span> &middot; 🍖 {fmt(exp.food_taken)} food taken</span>}
                    </div>
                    {exp.loot && Object.keys(exp.loot).filter(k => !k.startsWith('_')).length > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--green)', marginTop: '2px' }}>
                        Loot: {formatLoot(exp.loot)}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {exp.status === 'outbound' && <div>Arrives: <span style={{ color: 'var(--text)' }}>{countdown(exp.arrive_at)}</span></div>}
                    {exp.status === 'harvesting' && <div>Done: <span style={{ color: 'var(--gold)' }}>{countdown(exp.harvest_ends_at)}</span></div>}
                    {exp.status === 'returning' && <div>Returns: <span style={{ color: 'var(--green)' }}>{countdown(exp.return_at)}</span></div>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {isOrc && (
            <div className="card" style={{ border: '1px solid var(--red)' }}>
              <div className="card-title" style={{ color: 'var(--red)' }}>Orc Interception</div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', margin: '6px 0 10px' }}>Intercept other kingdoms' expeditions. Need 3x combat power of the civilians.</div>
              <button onClick={loadVisibleExps} style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--red)', background: 'transparent', color: 'var(--red)', cursor: 'pointer', fontSize: '11px', marginBottom: '8px' }}>Scan Expeditions</button>
              {visibleExps.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text3)' }}>No visible expeditions.</div>}
              {visibleExps.map(vExp => (
                <div key={vExp.id} style={{ marginTop: '8px', padding: '8px', background: 'var(--bg2)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '12px' }}>
                    <span style={{ color: 'var(--text3)' }}>{vExp.kingdom_name}</span> — {typeIcon(vExp.node_type)} &middot; <span style={statusColor(vExp.status)}>{vExp.status}</span> &middot; Pop: {fmt(vExp.population_sent)}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input type="number" min="1" placeholder="Fighters" value={interceptFighters[vExp.id] || ''} onChange={(e) => setInterceptFighters(p => ({...p, [vExp.id]: parseInt(e.target.value)}))}
                      style={{ width: '80px', padding: '4px 6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '12px', textAlign: 'center' }} />
                    <button onClick={() => interceptExpedition(vExp.id)} disabled={intercepting[vExp.id]}
                      style={{ padding: '5px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: 'var(--red)', color: '#fff', ...(intercepting[vExp.id] ? { opacity: 0.5 } : {}) }}>
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
          {items.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '8px' }}>No items found.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px', marginTop: '12px' }}>
            {items.map(item => (
              <div key={item.id} style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg2)', textAlign: 'center', border: `1px solid ${(item.qty || 0) > 0 ? 'var(--green)' : 'var(--border)'}` }}>
                <div style={{ fontSize: '24px', marginBottom: '4px' }}>{itemIcon(item.id)}</div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px', color: (item.qty || 0) > 0 ? 'var(--green)' : 'var(--text3)' }}>{item.qty || 0}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourcesPanel;
