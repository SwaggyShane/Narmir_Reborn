import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from '../../utils/toast.js';
import { apiCall } from '../../utils/api';
import { useGameMutationEvents, useGameState } from '../../hooks/useGameState';
import { repairMojibake } from '../../utils/repairMojibake';
import { applyGameMutation } from '../../utils/gameMutations.js';

const REFRESH_INTERVAL_MS = 2 * 60 * 1000;
const EXPEDITION_TURNS = {
  scout: 10,
  deep: 25,
  dungeon: 50,
  mountain: 100,
};

const TYPE_META = {
  scout: {
    icon: '🔭',
    label: 'Scout expedition',
    badge: '10 turns',
    button: 'Launch expedition',
    color: 'var(--green)',
    border: 'var(--green)',
  },
  deep: {
    icon: '🌲',
    label: 'Deep expedition',
    badge: '25 turns',
    button: 'Launch expedition',
    color: 'var(--accent1)',
    border: 'var(--accent1)',
  },
  dungeon: {
    icon: '⚔️',
    label: 'Dungeon raid',
    badge: '50 turns',
    button: 'Launch raid',
    color: 'var(--red)',
    border: 'var(--red)',
  },
  mountain: {
    icon: '🏔️',
    label: "Mountain's Heart",
    badge: '100 turns',
    button: 'Accept the risk',
    color: '#6b9bd1',
    border: '#6b9bd1',
  },
};

const formatNum = (value) => Number(value || 0).toLocaleString();
const repairText = (value) => repairMojibake(String(value ?? ''));

const normalizeRewards = (rewards) => {
  if (Array.isArray(rewards)) return rewards.map((msg) => repairText(msg));
  if (typeof rewards === 'string') {
    try {
      const parsed = JSON.parse(rewards);
      if (Array.isArray(parsed)) return parsed.map((msg) => repairText(msg));
    } catch {}
  }
  return [];
};

const ExplorationPanel = () => {
  const { state, applyUpdates } = useGameState();
  const [inventory, setInventory] = useState({});
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [searchRangers, setSearchRangers] = useState(0);
  const [scoutRangers, setScoutRangers] = useState(0);
  const [deepRangers, setDeepRangers] = useState(0);
  const [dungeonRangers, setDungeonRangers] = useState(0);
  const [dungeonFighters, setDungeonFighters] = useState(0);
  const [mountainRangers, setMountainRangers] = useState(0);
  const [activeExpeditions, setActiveExpeditions] = useState([]);
  const [completedExpeditions, setCompletedExpeditions] = useState([]);
  const [instantEntries, setInstantEntries] = useState([]);

  const refreshInventory = useCallback(async () => {
    try {
      const data = await apiCall('/api/kingdom/inventory');
      if (data) setInventory(data);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    }
  }, []);

  const refreshExpeditions = useCallback(async () => {
    try {
      const data = await apiCall('/api/kingdom/expedition/list');
      const active = Array.isArray(data?.active) ? data.active : [];
      const completed = Array.isArray(data?.completed) ? data.completed : [];
      setActiveExpeditions(active);
      setCompletedExpeditions(completed);
    } catch (err) {
      console.error('Failed to load expedition log:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshInventory(), refreshExpeditions()]);
  }, [refreshExpeditions, refreshInventory]);

  useEffect(() => {
    void refreshAll();
    const refreshTimer = setInterval(() => {
      void refreshAll();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(refreshTimer);
  }, [refreshAll]);

  useGameMutationEvents(
    useCallback((event) => {
      if (!event?.reason) return;
      const reason = String(event.reason);
      if (
        reason === 'turn' ||
        reason === 'search' ||
        reason === 'expedition-start' ||
        reason === 'expedition-complete' ||
        reason === 'expedition-cancel' ||
        reason === 'kingdom-refresh' ||
        reason === 'apply-server-updates' ||
        reason.startsWith('expedition')
      ) {
        void refreshAll();
      }
    }, [refreshAll]),
  );

  const inventoryCount = Object.keys(inventory).length;
  const availableRangers = Number(state?.rangers || 0);
  const availableFighters = Number(state?.fighters || 0);
  const availableFood = Number(state?.food || 0);
  const searchFoodCost = Math.ceil(searchRangers * 0.5 * 100 * 0.75);
  const expeditionTurns = useMemo(() => EXPEDITION_TURNS, []);
  const mountainFoodCost = Math.ceil(mountainRangers * 0.5 * 100 * 0.75);

  const applyResult = useCallback((result, reason) => {
    if (applyGameMutation) {
      applyGameMutation(result, { reason });
      return;
    }
    if (result?.updates && applyUpdates) {
      applyUpdates(result.updates, reason);
    }
  }, [applyUpdates]);

  const logInstantEntry = useCallback((icon, title, subtitle) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      icon,
      title,
      subtitle,
      kind: 'instant',
    };
    setInstantEntries((prev) => [entry, ...prev].slice(0, 50));
  }, []);

  const handleSearch = useCallback(async (type) => {
    const r = Number(searchRangers || 0);
    if (r <= 0) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Assign some rangers first', 'error');
      return;
    }
    if (r > availableRangers) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Not enough rangers', 'error');
      return;
    }
    if ((state?.turns_stored || 0) < 1) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('No turns available', 'warn');
      return;
    }

    try {
      const result = await apiCall('/api/kingdom/search', {
        method: 'POST',
        body: { type, rangers: r },
      });

      if (result.error) {
        if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.error, 'error');
        return;
      }

      applyResult(result, 'search');
      if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.message || 'Search complete', 'success');

      const icons = { land: '🗺️', gold: '💰', food: '🌾', targets: '🔭' };
      logInstantEntry(
        icons[type] || '🧭',
        repairText(result.message || 'Search complete'),
        `Sent ${formatNum(r)} rangers · 1 turn used`,
      );
      await refreshAll();
    } catch (err) {
      console.error('Search API error:', err);
      if (typeof window !== 'undefined' && typeof toast === 'function') toast(`Search action failed: ${err.message}`, 'error');
    }
  }, [applyResult, availableRangers, logInstantEntry, refreshAll, searchRangers, state?.turns_stored]);

  const handleLaunchExpedition = useCallback(async (type) => {
    const rangers = Number(
      type === 'scout'
        ? scoutRangers
        : type === 'deep'
          ? deepRangers
          : type === 'dungeon'
            ? dungeonRangers
            : mountainRangers,
    ) || 0;
    const fighters = type === 'dungeon' ? Number(dungeonFighters || 0) : 0;

    if (rangers < 1) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Send at least 1 ranger', 'error');
      return;
    }
    if (rangers > availableRangers) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Not enough rangers', 'error');
      return;
    }
    if (type === 'dungeon' && fighters < 1) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Dungeon raids require fighters', 'error');
      return;
    }
    if (type === 'dungeon' && fighters > availableFighters) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Not enough fighters', 'error');
      return;
    }

    const turns = expeditionTurns[type] || 0;
    const foodNeeded = Math.ceil(turns * ((rangers * 0.5 + fighters) * 0.75));
    if (availableFood < foodNeeded) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast(`You need ${formatNum(foodNeeded - availableFood)} more food to start the expedition`, 'error');
      return;
    }

    try {
      const result = await apiCall('/api/kingdom/expedition/start', {
        method: 'POST',
        body: { type, rangers, fighters },
      });

      if (result.error) {
        if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.error, 'error');
        return;
      }

      applyResult(result, 'expedition-start');
      if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.message || `${TYPE_META[type].label} launched!`, 'success');
      logInstantEntry(
        TYPE_META[type].icon,
        repairText(result.message || `${TYPE_META[type].label} launched!`),
        `Sent ${formatNum(rangers)} rangers${fighters > 0 ? ` · ${formatNum(fighters)} fighters` : ''} · ${formatNum(foodNeeded)} food`,
      );
      await refreshAll();
    } catch (err) {
      console.error('[expedition/start] failed:', err);
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Expedition failed — please try again', 'error');
    }
  }, [
    applyResult,
    availableFighters,
    availableFood,
    availableRangers,
    deepRangers,
    dungeonFighters,
    dungeonRangers,
    expeditionTurns,
    logInstantEntry,
    mountainRangers,
    refreshAll,
    scoutRangers,
  ]);

  const clearExpeditionLog = useCallback(async () => {
    try {
      const result = await apiCall('/api/kingdom/expedition/clear-all', { method: 'DELETE' });
      if (result.error) {
        if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.error, 'error');
        return;
      }

      const refreshed = await apiCall('/api/kingdom/me');
      if (refreshed) {
        applyResult(refreshed, 'expedition-cancel');
      }
      setInstantEntries([]);
      await refreshAll();
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Expedition log cleared', 'success');
    } catch (err) {
      console.error('[expedition/clear-all] failed:', err);
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Failed to clear expedition log', 'error');
    }
  }, [applyResult, refreshAll]);

  const renderRow = (entry, isCompleted = false) => {
    const rewards = isCompleted ? normalizeRewards(entry.rewards) : [];
    const troops = `${formatNum(entry.rangers)} rangers${entry.fighters > 0 ? `, ${formatNum(entry.fighters)} fighters` : ''}`;
    const label = TYPE_META[entry.type]?.label || entry.type;
    const icon = TYPE_META[entry.type]?.icon || '🧭';
    const subtitle = isCompleted
      ? [
          `${rewards.length > 0 ? `${rewards.length} reward${rewards.length === 1 ? '' : 's'}` : 'Returned'}`,
          troops,
        ].join(' · ')
      : `${troops}${entry.food_taken > 0 ? ` · 🍖 ${formatNum(entry.food_taken)} food taken` : ''}`;

    return (
      <div
        key={`${entry.id}-${isCompleted ? 'done' : 'active'}`}
        className="exp-log-entry"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          padding: '9px 0',
          borderBottom: '1px solid var(--border)',
          fontSize: '13px',
        }}
      >
        <span style={{ fontSize: '18px', flexShrink: 0 }}>{repairText(icon)}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: 'var(--text)', fontWeight: 600 }}>
            {repairText(label)}
            {!isCompleted ? ` departed — ${entry.turns_left} turn${entry.turns_left === 1 ? '' : 's'} left` : ' — Returned'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
            {repairText(subtitle)}
          </div>
          {isCompleted && rewards.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: '18px', color: 'var(--text2)', fontSize: '12px', lineHeight: 1.5 }}>
              {rewards.map((reward, idx) => <li key={`${entry.id}-reward-${idx}`}>{repairText(reward)}</li>)}
            </ul>
          )}
        </div>
      </div>
    );
  };

  const activeSummary = activeExpeditions.length
    ? `${activeExpeditions.length} active expedition${activeExpeditions.length === 1 ? '' : 's'}`
    : 'No expeditions are currently underway.';

  return (
    <div id="exploration" className="panel" style={{ display: 'none' }}>
      <div className="card" id="exp-counter-card" style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <div className="card-title" style={{ marginBottom: '4px' }}>Active expeditions</div>
            <div style={{ fontSize: '13px', color: 'var(--text3)' }}>{activeSummary}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div
            className="card-title"
            onClick={() => setInventoryOpen(!inventoryOpen)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}
          >
            <span>🎒 Expedition Finds {inventoryCount > 0 ? `(${inventoryCount} items)` : '(empty)'}</span>
            <span style={{ fontSize: '12px' }}>{inventoryOpen ? '▼' : '▶'}</span>
          </div>
          <button className="base-btn" onClick={refreshInventory} style={{ fontSize: '11px', padding: '4px 10px' }}>↻ Refresh</button>
        </div>
        {inventoryOpen && (
          <>
            {inventoryCount > 0 ? (
              <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                {Object.entries(inventory).map(([itemId, item]) => (
                  <div
                    key={itemId}
                    style={{
                      padding: '10px',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.05)',
                      borderLeft: `3px solid ${item.rarity === 'junk' ? 'var(--text3)' : 'var(--accent1)'}`,
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      {repairText(item.name)} <span style={{ color: 'var(--gold)', fontWeight: 700 }}>×{item.count}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', lineHeight: 1.4 }}>
                      {repairText(item.desc)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '16px 0', textAlign: 'center' }}>
                No items collected yet. Send expeditions to find treasures and curiosities!
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="card" style={{ padding: '12px 14px' }}>
          <div className="card-title" style={{ marginBottom: '4px' }}>Available Rangers</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--green)', lineHeight: 1 }}>
            {availableRangers.toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px' }}>Ready to launch expeditions or scout targets.</div>
        </div>

        <div className="card">
          <div className="card-title">Instant search — <span style={{ color: 'var(--green)', fontWeight: 400, fontSize: '12px' }}>costs 1 turn</span></div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px' }}>Quick operations that return results immediately.</div>
          <div className="trow" style={{ marginBottom: '12px' }}>
            <span className="name">Rangers</span>
            <span style={{ fontSize: '12px', color: 'var(--text3)', marginRight: '8px' }}>
              Available: <span>{availableRangers}</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="number"
                className="input"
                value={searchRangers}
                onChange={(e) => setSearchRangers(Math.max(0, parseInt(e.target.value, 10) || 0))}
                min="0"
                style={{ textAlign: 'right', width: '90px' }}
                placeholder="Qty"
              />
              <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setSearchRangers(availableRangers)}>Max</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button className="base-btn" style={{ padding: '10px', fontSize: '12px', textAlign: 'center', height: 'auto' }} onClick={() => handleSearch('land')}>
              <div style={{ fontSize: '18px', marginBottom: '4px' }}>🗺️</div>
              Search for land
              <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>Diminishing returns</div>
            </button>
            <button className="base-btn" style={{ padding: '10px', fontSize: '12px', textAlign: 'center', height: 'auto' }} onClick={() => handleSearch('gold')}>
              <div style={{ fontSize: '18px', marginBottom: '4px' }}>⛏️</div>
              Forage for gold
            </button>
            <button className="base-btn" style={{ padding: '10px', fontSize: '12px', textAlign: 'center', height: 'auto' }} onClick={() => handleSearch('food')}>
              <div style={{ fontSize: '18px', marginBottom: '4px' }}>🌾</div>
              Search for food
            </button>
            <button className="base-btn" style={{ padding: '10px', fontSize: '12px', textAlign: 'center', height: 'auto' }} onClick={() => handleSearch('targets')}>
              <div style={{ fontSize: '18px', marginBottom: '4px' }}>🔭</div>
              Scout targets
            </button>
          </div>
        </div>

        <div className="card" style={{ borderLeft: '3px solid var(--green)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div className="card-title" style={{ margin: 0 }}>🔭 Scout Expedition</div>
            <span style={{ fontSize: '11px', background: 'rgba(76, 175, 130, 0.15)', color: 'var(--green)', padding: '3px 8px', borderRadius: '20px', fontWeight: 600 }}>
              10 turns
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px', lineHeight: 1.6 }}>
            Rangers explore nearby territory. Rewards range from common to rare —
            gold, land, mana, wandering troops, and occasionally an ancient map.
          </div>
          <div className="trow" style={{ marginBottom: '10px' }}>
            <span className="name" style={{ fontSize: '12px' }}>Rangers</span>
            <span style={{ fontSize: '11px', color: 'var(--text3)', marginRight: '6px' }}>
              avail: <span>{availableRangers}</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="number"
                className="input"
                value={scoutRangers}
                onChange={(e) => setScoutRangers(Math.max(0, parseInt(e.target.value, 10) || 0))}
                min="1"
                style={{ textAlign: 'right', width: '80px' }}
                placeholder="Qty"
              />
              <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setScoutRangers(availableRangers)}>Max</button>
            </div>
          </div>
          <button className="base-btn variant-green w-full" id="btn-exp-scout" style={{ background: 'var(--green)', color: '#000', width: '100%' }} onClick={() => handleLaunchExpedition('scout')}>
            {TYPE_META.scout.button}
          </button>
        </div>

        <div className="card" style={{ borderLeft: '3px solid var(--accent1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div className="card-title" style={{ margin: 0 }}>🌲 Deep Expedition</div>
            <span style={{ fontSize: '11px', background: 'rgba(180, 60, 0, 0.15)', color: 'var(--accent1)', padding: '3px 8px', borderRadius: '20px', fontWeight: 600 }}>
              25 turns
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px', lineHeight: 1.6 }}>
            Rangers venture deep into uncharted wilderness. Substantially better
            rewards including research scrolls, mercenary companies, ruins, and
            rare legendary artifacts.
          </div>
          <div className="trow" style={{ marginBottom: '10px' }}>
            <span className="name" style={{ fontSize: '12px' }}>Rangers</span>
            <span style={{ fontSize: '11px', color: 'var(--text3)', marginRight: '6px' }}>
              avail: <span>{availableRangers}</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="number"
                className="input"
                value={deepRangers}
                onChange={(e) => setDeepRangers(Math.max(0, parseInt(e.target.value, 10) || 0))}
                min="1"
                style={{ textAlign: 'right', width: '80px' }}
                placeholder="Qty"
              />
              <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setDeepRangers(availableRangers)}>Max</button>
            </div>
          </div>
          <button className="base-btn variant-accent w-full" id="btn-exp-deep" style={{ background: 'var(--accent1)', width: '100%' }} onClick={() => handleLaunchExpedition('deep')}>
            {TYPE_META.deep.button}
          </button>
        </div>

        <div className="card" style={{ borderLeft: '3px solid var(--red)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div className="card-title" style={{ margin: 0 }}>⚔️ Dungeon Raid</div>
            <span style={{ fontSize: '11px', background: 'rgba(224, 92, 92, 0.15)', color: 'var(--red)', padding: '3px 8px', borderRadius: '20px', fontWeight: 600 }}>
              50 turns
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px', lineHeight: 1.6 }}>
            Fighters and rangers assault an ancient dungeon. High risk — failure
            costs fighters. Success yields legendary artifacts, war machines,
            permanent research boosts, and massive gold hoards.
          </div>
          <div className="trow" style={{ marginBottom: '8px' }}>
            <span className="name" style={{ fontSize: '12px' }}>Rangers</span>
            <span style={{ fontSize: '11px', color: 'var(--text3)', marginRight: '6px' }}>
              avail: <span>{availableRangers}</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="number"
                className="input"
                value={dungeonRangers}
                onChange={(e) => setDungeonRangers(Math.max(0, parseInt(e.target.value, 10) || 0))}
                min="1"
                style={{ textAlign: 'right', width: '80px' }}
                placeholder="Qty"
              />
              <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setDungeonRangers(availableRangers)}>Max</button>
            </div>
          </div>
          <div className="trow" style={{ marginBottom: '10px' }}>
            <span className="name" style={{ fontSize: '12px' }}>Fighters</span>
            <span style={{ fontSize: '11px', color: 'var(--text3)', marginRight: '6px' }}>
              avail: <span>{availableFighters}</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="number"
                className="input"
                value={dungeonFighters}
                onChange={(e) => setDungeonFighters(Math.max(0, parseInt(e.target.value, 10) || 0))}
                min="1"
                style={{ textAlign: 'right', width: '80px' }}
                placeholder="Qty"
              />
              <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setDungeonFighters(availableFighters)}>Max</button>
            </div>
          </div>
          <button className="base-btn variant-red w-full" id="btn-exp-dungeon" style={{ background: 'var(--red)', width: '100%' }} onClick={() => handleLaunchExpedition('dungeon')}>
            {TYPE_META.dungeon.button}
          </button>
        </div>

        <div className="card" style={{ borderLeft: '3px solid #6b9bd1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div className="card-title" style={{ margin: 0 }}>🏔️ Mountain's Heart</div>
            <span style={{ fontSize: '11px', background: 'rgba(107, 155, 209, 0.15)', color: '#6b9bd1', padding: '3px 8px', borderRadius: '20px', fontWeight: 600 }}>
              100 turns
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '8px', lineHeight: 1.6 }}>
            Rangers navigate treacherous mountain peaks facing avalanches and extreme attrition.
            Exclusive source of collectible artifacts and elemental fragments.
          </div>
          <div style={{
            padding: '8px',
            marginBottom: '10px',
            background: 'rgba(255, 184, 82, 0.1)',
            borderLeft: '3px solid #ffb852',
            borderRadius: '2px',
            fontSize: '11px',
            color: 'var(--text2)',
          }}>
            ⚠️ <strong>EXTREME RISK:</strong> Rangers face up to 4-8% attrition per turn depending on level.
            Level 20+ rangers recommended. Food costs very high for 100-turn expedition.
          </div>
          <div className="trow" style={{ marginBottom: '10px' }}>
            <span className="name" style={{ fontSize: '12px' }}>Rangers</span>
            <span style={{ fontSize: '11px', color: 'var(--text3)', marginRight: '6px' }}>
              avail: <span>{availableRangers}</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="number"
                className="input"
                value={mountainRangers}
                onChange={(e) => setMountainRangers(Math.max(0, parseInt(e.target.value, 10) || 0))}
                min="1"
                style={{ textAlign: 'right', width: '80px' }}
                placeholder="Qty"
              />
              <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setMountainRangers(availableRangers)}>Max</button>
            </div>
          </div>
          {mountainFoodCost > 0 && (
            <div style={{
              padding: '8px',
              marginBottom: '10px',
              background: 'rgba(139, 92, 246, 0.1)',
              borderLeft: '3px solid #8b5cf6',
              borderRadius: '2px',
              fontSize: '11px',
              color: 'var(--text2)',
            }}>
              🍖 <strong>Food required:</strong> {formatNum(mountainFoodCost)} (100 turns at {Math.round(mountainRangers * 0.5)}/turn)
            </div>
          )}
          <button className="base-btn variant-blue w-full" id="btn-exp-mountain" style={{ background: '#6b9bd1' }} onClick={() => handleLaunchExpedition('mountain')}>
            {TYPE_META.mountain.button}
          </button>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Expedition log</div>
          <button className="base-btn" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={clearExpeditionLog} title="Clear completed entries from the log">
            🗑️ Clear log
          </button>
        </div>
        <div id="exploration-log" style={{ flex: 1, overflowY: 'auto', maxHeight: '700px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {instantEntries.length === 0 && activeExpeditions.length === 0 && completedExpeditions.length === 0 && (
            <div data-empty style={{ fontSize: '13px', color: 'var(--text3)', padding: '12px 0' }}>
              No expeditions sent yet.
            </div>
          )}
          {instantEntries.map((entry) => (
            <div
              key={entry.id}
              className="exp-log-entry"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '9px 0',
                borderBottom: '1px solid var(--border)',
                fontSize: '13px',
              }}
            >
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{entry.icon}</span>
              <div>
                <div style={{ color: 'var(--text)' }}>{entry.title}</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>{entry.subtitle}</div>
              </div>
            </div>
          ))}
          {activeExpeditions.map((exp) => renderRow(exp, false))}
          {completedExpeditions.map((exp) => renderRow(exp, true))}
        </div>
      </div>
    </div>
  );
};

export default ExplorationPanel;
