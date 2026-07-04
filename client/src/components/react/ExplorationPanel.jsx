import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { cleanMessageText, toast } from '../../utils/toast.js';
import { apiCall } from '../../utils/api';
import { repairMojibake } from '../../utils/repairMojibake';
import { applyGameMutation } from '../../utils/gameMutations.js';
import { AppEvent } from '../../utils/appEvents.js';
import { useAppEvent } from '../../hooks/useAppEvent.js';
import { useGameMutationEvents } from '../../hooks/useGameState';
import { useEconomyStore, useProfileStore, useMilitaryStore, useResearchStore, usePopulationStore } from '../../stores';
import EmptyState from './EmptyState.jsx';

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
const repairText = (value) => cleanMessageText(repairMojibake(String(value ?? '')));

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
  const rangers = useMilitaryStore((state) => state.troops.rangers);
  const fighters = useMilitaryStore((state) => state.troops.fighters);
  const engineers = useMilitaryStore((state) => state.troops.engineers);
  const food = useEconomyStore((state) => state.food);
  const turns_stored = useProfileStore((state) => state.turns_stored);
  const scout_allocation = useProfileStore((state) => state.scout_allocation);
  const scout_progress = useProfileStore((state) => state.scout_progress);
  const kingdom_level = useProfileStore((state) => state.level);
  const race = useProfileStore((state) => state.race);
  useGameMutationEvents();

  const syncKingdomData = useCallback((kingdomData) => {
    if (!kingdomData || Object.keys(kingdomData).length === 0) return;
    useProfileStore.getState().receiveServerSnapshot(kingdomData);
    useEconomyStore.getState().receiveServerSnapshot(kingdomData);
    useMilitaryStore.getState().receiveServerSnapshot(kingdomData);
    useResearchStore.getState().receiveServerSnapshot(kingdomData);
    usePopulationStore.getState().receiveServerSnapshot(kingdomData);
  }, []);
  const [inventory, setInventory] = useState({});
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [searchRangers, setSearchRangers] = useState(0);
  const [scoutRangers, setScoutRangers] = useState(0);
  const [deepRangers, setDeepRangers] = useState(0);
  const [dungeonRangers, setDungeonRangers] = useState(0);
  const [dungeonFighters, setDungeonFighters] = useState(0);
  const [mountainRangers, setMountainRangers] = useState(0);
  // Fog of War Phase 3: area hex scout (separate from old expedition scout types)
  const [areaCol, setAreaCol] = useState('');
  const [areaRow, setAreaRow] = useState('');
  const [areaRangers, setAreaRangers] = useState(0);
  const [activeExpeditions, setActiveExpeditions] = useState([]);
  const [completedExpeditions, setCompletedExpeditions] = useState([]);
  const [instantEntries, setInstantEntries] = useState([]);
  // Phase 1: Turn-based resource gathering
  const [huntingRangers, setHuntingRangers] = useState(0);
  const [huntingTerrain, setHuntingTerrain] = useState('forest');
  const [prospectingEngineers, setProspectingEngineers] = useState(0);
  const [prospectingTerrain, setProspectingTerrain] = useState('mountain');
  const [landExpansionRangers, setLandExpansionRangers] = useState(0);
  const [landExpansionTerrain, setLandExpansionTerrain] = useState('grassland');
  // Phase 2E: Scout allocation UI
  const [scoutAllocationInput, setScoutAllocationInput] = useState(0);

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
  const availableRangers = Number(rangers || 0);
  const availableFighters = Number(fighters || 0);
  const availableEngineers = Number(engineers || 0);
  const availableFood = Number(food || 0);
  const expeditionTurns = useMemo(() => EXPEDITION_TURNS, []);
  const mountainFoodCost = Math.ceil(mountainRangers * 0.5 * 100 * 0.75);

  const applyResult = useCallback((result, reason) => {
    if (applyGameMutation) {
      applyGameMutation(result, { reason });
      return;
    }
    if (result?.updates) {
      syncKingdomData(result.updates);
    }
  }, [syncKingdomData]);

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

  useAppEvent(AppEvent.EXPEDITION_LOG_ENTRY, (detail) => {
    const { icon, title, subtitle } = detail || {};
    if (!title) return;
    logInstantEntry(icon, title, subtitle);
  });

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
    if ((turns_stored || 0) < 1) {
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
      if (typeof window !== 'undefined' && typeof toast === 'function') {
        const landNote = type === 'land' ? ' (diminishing returns apply)' : '';
        toast(repairText(result.message || 'Search complete') + landNote, 'success');
      }

      const icons = { land: '🗺️', gold: '⛏️', food: '🌾', targets: '🔭' };
      logInstantEntry(
        icons[type] || '🧭',
        repairText(result.message || 'Search complete'),
        `Sent ${formatNum(r)} rangers | 1 turn used`,
      );
      await refreshAll();
    } catch (err) {
      console.error('Search API error:', err);
      if (typeof window !== 'undefined' && typeof toast === 'function') toast(`Search action failed: ${err.message}`, 'error');
    }
  }, [applyResult, availableRangers, logInstantEntry, refreshAll, searchRangers, turns_stored]);

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
        `Sent ${formatNum(rangers)} rangers${fighters > 0 ? ` | ${formatNum(fighters)} fighters` : ''} | ${formatNum(foodNeeded)} food`,
      );
      await refreshAll();
    } catch (err) {
      console.error('[expedition/start] failed:', err);
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Expedition failed — please try again', 'error');
    }
  }, [applyResult, availableFighters, availableFood, availableRangers, deepRangers, dungeonFighters, dungeonRangers, expeditionTurns, logInstantEntry, mountainRangers, refreshAll, scoutRangers]);

  // Fog of War Phase 3 client support: call /scout-area for hex reveal (frontier only, costs rangers/food)
  const handleScoutArea = useCallback(async () => {
    const col = parseInt(areaCol, 10);
    const row = parseInt(areaRow, 10);
    let rangersSent = Number(areaRangers) || 0;
    if (!Number.isFinite(col) || !Number.isFinite(row) || col < 0 || row < 0) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Enter valid non-negative col and row for the target hex', 'error');
      return;
    }
    if (rangersSent < 1) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Send at least 1 ranger for area scout', 'error');
      return;
    }
    if (rangersSent > 1000) rangersSent = 1000;
    if (rangersSent > availableRangers) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Not enough rangers', 'error');
      return;
    }

    try {
      const result = await apiCall('/api/kingdom/scout-area', {
        method: 'POST',
        body: { col, row, rangers: rangersSent },
      });
      if (result?.error) {
        if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.error, 'error');
        return;
      }
      if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.message || 'Hex area scouted — fog lifted!', 'success');
      applyResult(result, 'scout-area');
      // Refresh map data if the caller provided a way (parent usually reloads on turn/mutation events)
      await refreshAll();
    } catch (err) {
      console.error('[scout-area] client failed:', err);
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Area scout failed — please try again', 'error');
    }
  }, [areaCol, areaRow, areaRangers, availableRangers, applyResult, refreshAll]);

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

  // Phase 1: Turn-based resource gathering handlers
  const handleHunting = useCallback(async () => {
    const r = Number(huntingRangers || 0);
    if (r < 1) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Send at least 1 ranger', 'error');
      return;
    }
    if (r > availableRangers) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Not enough available rangers', 'error');
      return;
    }
    if ((turns_stored || 0) < 5) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Hunting requires 5 turns', 'warn');
      return;
    }

    try {
      const result = await apiCall('/api/kingdom/expedition/hunting', {
        method: 'POST',
        body: { rangers: r, terrain: huntingTerrain },
      });

      if (result.error) {
        if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.error, 'error');
        return;
      }

      applyResult(result, 'hunting');
      if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.message || 'Hunting expedition complete!', 'success');
      logInstantEntry('🦌', 'Hunting expedition', `${formatNum(r)} rangers returned with ${formatNum(result.reward?.foodReward || 0)} food`);
      setHuntingRangers(0);
      await refreshAll();
    } catch (err) {
      console.error('[expedition/hunting] failed:', err);
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Hunting failed — please try again', 'error');
    }
  }, [huntingRangers, huntingTerrain, availableRangers, turns_stored, applyResult, logInstantEntry, refreshAll]);

  const handleProspecting = useCallback(async () => {
    const e = Number(prospectingEngineers || 0);
    if (e < 1) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Send at least 1 engineer', 'error');
      return;
    }
    if (e > availableEngineers) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Not enough available engineers', 'error');
      return;
    }
    if ((turns_stored || 0) < 5) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Prospecting requires 5 turns', 'warn');
      return;
    }

    try {
      const result = await apiCall('/api/kingdom/expedition/prospecting', {
        method: 'POST',
        body: { engineers: e, terrain: prospectingTerrain },
      });

      if (result.error) {
        if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.error, 'error');
        return;
      }

      applyResult(result, 'prospecting');
      if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.message || 'Prospecting expedition complete!', 'success');
      logInstantEntry('⛏️', 'Prospecting expedition', `${formatNum(e)} engineers returned with ${formatNum(result.reward?.goldReward || 0)} gold`);
      setProspectingEngineers(0);
      await refreshAll();
    } catch (err) {
      console.error('[expedition/prospecting] failed:', err);
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Prospecting failed — please try again', 'error');
    }
  }, [prospectingEngineers, prospectingTerrain, availableEngineers, turns_stored, applyResult, logInstantEntry, refreshAll]);

  const handleLandExpansion = useCallback(async () => {
    const r = Number(landExpansionRangers || 0);
    if (r < 1) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Send at least 1 ranger', 'error');
      return;
    }
    if (r > availableRangers) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Not enough available rangers', 'error');
      return;
    }

    try {
      const result = await apiCall('/api/kingdom/expedition/land-expansion', {
        method: 'POST',
        body: { rangers: r, terrain: landExpansionTerrain },
      });

      if (result.error) {
        if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.error, 'error');
        return;
      }

      applyResult(result, 'land-expansion');
      if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.message || 'Land expanded!', 'success');
      logInstantEntry('🗺️', 'Land expansion', `Discovered ${formatNum(result.reward?.landsDiscovered || 0)} new lands`);
      setLandExpansionRangers(0);
      await refreshAll();
    } catch (err) {
      console.error('[expedition/land-expansion] failed:', err);
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Land expansion failed — please try again', 'error');
    }
  }, [landExpansionRangers, landExpansionTerrain, availableRangers, applyResult, logInstantEntry, refreshAll]);

  // Phase 2E: Scout allocation handlers
  const handleScoutAllocate = useCallback(async () => {
    const r = Number(scoutAllocationInput || 0);
    if (r < 0) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Enter a valid ranger count', 'error');
      return;
    }
    if (r === 0 && scout_allocation === 0) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Enter rangers to allocate (or 0 to release all)', 'warn');
      return;
    }

    try {
      const result = await apiCall('/api/kingdom/scout/allocate', {
        method: 'POST',
        body: { rangers: r },
      });

      if (result.error) {
        if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.error, 'error');
        return;
      }

      applyResult(result, 'scout-allocate');
      if (typeof window !== 'undefined' && typeof toast === 'function') {
        if (r > 0) {
          toast(`${formatNum(result.allocated || r)} rangers allocated to scouting`, 'success');
        } else {
          toast(`All rangers released from scouting`, 'success');
        }
      }
      setScoutAllocationInput(0);
      await refreshAll();
    } catch (err) {
      console.error('[scout/allocate] failed:', err);
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Allocation failed — please try again', 'error');
    }
  }, [scoutAllocationInput, scout_allocation, applyResult, refreshAll]);

  const handleScoutReleaseAll = useCallback(async () => {
    if (scout_allocation === 0) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('No scouts allocated', 'warn');
      return;
    }

    try {
      const result = await apiCall('/api/kingdom/scout/release-all', {
        method: 'POST',
      });

      if (result.error) {
        if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.error, 'error');
        return;
      }

      applyResult(result, 'scout-release-all');
      if (typeof window !== 'undefined' && typeof toast === 'function') {
        toast(`${formatNum(result.released || scout_allocation)} rangers released from scouting`, 'success');
      }
      setScoutAllocationInput(0);
      await refreshAll();
    } catch (err) {
      console.error('[scout/release-all] failed:', err);
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Release failed — please try again', 'error');
    }
  }, [scout_allocation, applyResult, refreshAll]);

  const renderRow = (entry, isCompleted = false) => {
    const rewards = isCompleted ? normalizeRewards(entry.rewards) : [];
    const troops = `${formatNum(entry.rangers)} rangers${entry.fighters > 0 ? `, ${formatNum(entry.fighters)} fighters` : ''}`;
    const label = TYPE_META[entry.type]?.label || entry.type;
    const icon = TYPE_META[entry.type]?.icon || '🧭';
    const subtitle = isCompleted
      ? [
          `${rewards.length > 0 ? `${rewards.length} reward${rewards.length === 1 ? '' : 's'}` : 'Returned'}`,
          troops,
        ].join(' | ')
      : `${troops}${entry.food_taken > 0 ? ` | 🍖 ${formatNum(entry.food_taken)} food taken` : ''}`;

    return (
      <div
        key={`${entry.id}-${isCompleted ? 'done' : 'active'}`}
        className="exp-log-entry flex items-start gap-3 border-b border-[var(--border)] py-2 text-[13px]"
      >
        <span className="flex-shrink-0 text-[18px]">{repairText(icon)}</span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[var(--text)]">
            {repairText(label)}
            {!isCompleted ? ` departed — ${entry.turns_left} turn${entry.turns_left === 1 ? '' : 's'} left` : ' — Returned'}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--text3)]">{repairText(subtitle)}</div>
          {isCompleted && rewards.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-[12px] leading-6 text-[var(--text2)]">
              {rewards.map((reward, idx) => <li key={`${entry.id}-reward-${idx}`}>{repairText(reward)}</li>)}
            </ul>
          )}
        </div>
      </div>
    );
  };

  const renderActiveSummary = (entry) => {
    const meta = TYPE_META[entry.type] || {};
    const label = meta.label || entry.type;
    const icon = meta.icon || '🧭';
    const totalTurns = expeditionTurns[entry.type] || Number(entry.turns_left) || 1;
    const turnsLeft = Math.max(0, Number(entry.turns_left ?? 0));
    const progressPct = totalTurns > 0
      ? Math.min(100, Math.round(((totalTurns - turnsLeft) / totalTurns) * 100))
      : 0;
    const troops = `${formatNum(entry.rangers)} rangers${entry.fighters > 0 ? `, ${formatNum(entry.fighters)} fighters` : ''}`;
    const countdownLabel = turnsLeft > 0
      ? `${formatNum(turnsLeft)} turn${turnsLeft === 1 ? '' : 's'} left`
      : 'Wrapping up…';

    return (
      <div
        key={`active-summary-${entry.id}`}
        className="rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.04)] p-3"
        style={{ borderLeftColor: meta.border || 'var(--border)', borderLeftWidth: '3px' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-[var(--text)]">
              <span className="text-[18px] leading-none">{icon}</span>
              <span>{repairText(label)}</span>
            </div>
            <div className="mt-1 text-[11px] text-[var(--text3)]">{repairText(troops)}</div>
          </div>
          <div className="shrink-0 text-right">
            <div
              className="text-[26px] font-extrabold leading-none tabular-nums"
              style={{ color: meta.color || 'var(--gold)' }}
            >
              {turnsLeft > 0 ? formatNum(turnsLeft) : '…'}
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)]">
              {countdownLabel}
            </div>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progressPct}%`,
              background: meta.color || 'var(--gold)',
              boxShadow: `0 0 10px ${meta.color || 'var(--gold)'}`,
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div id="exploration" className="panel">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <div id="exp-counter-card" className="card">
          <div className="card-title !mb-3">Active expeditions</div>
          {activeExpeditions.length === 0 ? (
            <div className="text-[13px] text-[var(--text3)]">No expeditions are currently underway.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {activeExpeditions.map(renderActiveSummary)}
            </div>
          )}
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div
              className="card-title !mb-0 flex cursor-pointer items-center gap-2"
              onClick={() => setInventoryOpen(!inventoryOpen)}
            >
              <span>🎒 Expedition Finds {inventoryCount > 0 ? `(${inventoryCount} items)` : '(empty)'}</span>
              <span className="text-[12px]">{inventoryOpen ? '▼' : '▶'}</span>
            </div>
            <button className="base-btn px-3 py-1 text-[11px]" onClick={refreshInventory}>
              ↻ Refresh
            </button>
          </div>
          {inventoryOpen && (
            <>
              {inventoryCount > 0 ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Object.entries(inventory).map(([itemId, item]) => (
                    <div
                      key={itemId}
                      className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.05)] p-3"
                      style={{ borderLeftColor: item.rarity === 'junk' ? 'var(--text3)' : 'var(--accent1)', borderLeftWidth: '3px' }}
                    >
                      <div className="mb-1 text-[12px] font-semibold">
                        {repairText(item.name)} <span className="font-bold text-[var(--gold)]">×{item.count}</span>
                      </div>
                      <div className="text-[11px] leading-5 text-[var(--text3)]">{repairText(item.desc)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center text-[12px] text-[var(--text3)]">
                  No items collected yet. Send expeditions to find treasures and curiosities!
                </div>
              )}
            </>
          )}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="flex flex-col gap-4">
            <div className="card p-4">
              <div className="card-title !mb-1">Available Rangers</div>
              <div className="text-[28px] font-extrabold leading-none text-[var(--green)]">
                {availableRangers.toLocaleString()}
              </div>
              <div className="mt-1 text-[12px] text-[var(--text3)]">
                Ready to launch expeditions or scout targets.
              </div>
            </div>

            <div className="card">
              <div className="card-title">
                Instant search <span className="text-[12px] font-normal text-[var(--green)]">costs 1 turn</span>
              </div>
              <div className="mb-3 text-[12px] text-[var(--text3)]">
                Quick operations that return results immediately.
              </div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="name">Rangers</span>
                <span className="text-[12px] text-[var(--text3)]">
                  Available: <span>{availableRangers}</span>
                </span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    className="input w-[90px] text-right"
                    value={searchRangers}
                    onChange={(e) => setSearchRangers(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    min="0"
                    placeholder="Qty"
                  />
                  <button className="base-btn px-2 py-1 text-[10px]" onClick={() => setSearchRangers(availableRangers)}>
                    Max
                  </button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button className="base-btn h-auto px-3 py-3 text-center text-[12px]" onClick={() => handleSearch('land')}>
                  <div className="mb-1 text-[18px]">🗺️</div>
                  Search for land
                </button>
                <button className="base-btn h-auto px-3 py-3 text-center text-[12px]" onClick={() => handleSearch('gold')}>
                  <div className="mb-1 text-[18px]">⛏️</div>
                  Forage for gold
                </button>
                <button className="base-btn h-auto px-3 py-3 text-center text-[12px]" onClick={() => handleSearch('food')}>
                  <div className="mb-1 text-[18px]">🌾</div>
                  Search for food
                </button>
                <button className="base-btn h-auto px-3 py-3 text-center text-[12px]" onClick={() => handleSearch('targets')}>
                  <div className="mb-1 text-[18px]">🔭</div>
                  Scout targets
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-title">
                Turn-based resource gathering <span className="text-[12px] font-normal text-[var(--accent1)]">5 turns each</span>
              </div>
              <div className="mb-3 text-[12px] text-[var(--text3)]">
                Specialized operations that take 5 turns each. Rangers or engineers complete the task and return with resources.
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-semibold text-[var(--text)]">🦌 Hunting</div>
                    <span className="text-[10px] text-[var(--green)]">5 turns</span>
                  </div>
                  <div className="mb-3 text-[11px] text-[var(--text3)]">Rangers hunt for food. Forest terrain is ideal.</div>
                  <div className="mb-2 text-[12px]">
                    <label className="block text-[var(--text3)]">Rangers</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        className="input flex-1 text-right"
                        value={huntingRangers}
                        onChange={(e) => setHuntingRangers(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        min="1"
                        placeholder="Qty"
                      />
                      <button className="base-btn px-2 py-1 text-[10px]" onClick={() => setHuntingRangers(availableRangers)}>
                        Max
                      </button>
                    </div>
                  </div>
                  <button className="base-btn w-full bg-[rgba(76,175,130,0.2)] text-[12px]" onClick={handleHunting}>
                    Hunt
                  </button>
                </div>

                <div className="rounded-lg border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-semibold text-[var(--text)]">⛏️ Prospecting</div>
                    <span className="text-[10px] text-[var(--accent1)]">5 turns</span>
                  </div>
                  <div className="mb-3 text-[11px] text-[var(--text3)]">Engineers prospect for gold. Mountains are ideal.</div>
                  <div className="mb-2 text-[12px]">
                    <label className="block text-[var(--text3)]">Engineers</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        className="input flex-1 text-right"
                        value={prospectingEngineers}
                        onChange={(e) => setProspectingEngineers(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        min="1"
                        placeholder="Qty"
                      />
                      <button className="base-btn px-2 py-1 text-[10px]" onClick={() => setProspectingEngineers(availableEngineers)}>
                        Max
                      </button>
                    </div>
                  </div>
                  <button className="base-btn w-full bg-[rgba(180,60,0,0.2)] text-[12px]" onClick={handleProspecting}>
                    Prospect
                  </button>
                </div>

                <div className="rounded-lg border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-semibold text-[var(--text)]">🗺️ Land Expansion</div>
                    <span className="text-[10px] text-[var(--gold)]">Instant</span>
                  </div>
                  <div className="mb-3 text-[11px] text-[var(--text3)]">Rangers discover new land. Costs population.</div>
                  <div className="mb-2 text-[12px]">
                    <label className="block text-[var(--text3)]">Rangers</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        className="input flex-1 text-right"
                        value={landExpansionRangers}
                        onChange={(e) => setLandExpansionRangers(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        min="1"
                        placeholder="Qty"
                      />
                      <button className="base-btn px-2 py-1 text-[10px]" onClick={() => setLandExpansionRangers(availableRangers)}>
                        Max
                      </button>
                    </div>
                  </div>
                  <button className="base-btn w-full bg-[rgba(218,165,32,0.2)] text-[12px]" onClick={handleLandExpansion}>
                    Expand
                  </button>
                </div>
              </div>
            </div>

            <div className="card border-l-[3px] border-l-[var(--accent2)]">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="card-title !mb-0">🔍 Scout Allocation</div>
                <span className="rounded-full bg-[rgba(120,120,200,0.15)] px-2 py-1 text-[11px] font-semibold text-[var(--accent2)]">
                  Passive Rings
                </span>
              </div>
              <div className="mb-3 text-[12px] leading-6 text-[var(--text3)]">
                Assign rangers to permanently scout the map. They'll automatically advance through rings, revealing new territory and discoveries over time.
              </div>

              {scout_allocation > 0 && (
                <div className="mb-3 rounded-md border-l-[3px] border-l-[var(--accent2)] bg-[rgba(120,120,200,0.1)] p-2 text-[11px] text-[var(--text2)]">
                  <div className="font-semibold">Ring Progress</div>
                  <div className="mt-1">
                    {scout_allocation > 0 && `${formatNum(scout_allocation)} rangers allocated • Ring progress: ${formatNum(scout_progress)} turns`}
                  </div>
                </div>
              )}

              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="name text-[12px]">Rangers to allocate</span>
                <span className="text-[11px] text-[var(--text3)]">
                  avail: <span>{availableRangers}</span>
                </span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    className="input w-[80px] text-right"
                    value={scoutAllocationInput}
                    onChange={(e) => setScoutAllocationInput(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    min="0"
                    placeholder="Qty"
                  />
                  <button className="base-btn px-2 py-1 text-[10px]" onClick={() => setScoutAllocationInput(availableRangers)}>
                    Max
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  className="base-btn variant-accent flex-1 bg-[var(--accent2)]"
                  onClick={handleScoutAllocate}
                  disabled={scoutAllocationInput === 0 && scout_allocation === 0}
                >
                  {scout_allocation === 0 ? 'Start Allocation' : 'Update Allocation'}
                </button>
                {scout_allocation > 0 && (
                  <button
                    className="base-btn px-3 text-[12px] text-[var(--text3)]"
                    onClick={handleScoutReleaseAll}
                    title="Release all scouts and stop ring progression"
                  >
                    Release All
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <div className="card border-l-[3px] border-l-[var(--green)]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="card-title !mb-0">🔭 Scout Expedition</div>
                  <span className="rounded-full bg-[rgba(76,175,130,0.15)] px-2 py-1 text-[11px] font-semibold text-[var(--green)]">
                    10 turns
                  </span>
                </div>
                <div className="mb-3 text-[12px] leading-6 text-[var(--text3)]">
                  Rangers explore nearby territory. Rewards range from common to rare - gold, land, mana,
                  wandering troops, and occasionally an ancient map.
                </div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="name text-[12px]">Rangers</span>
                  <span className="text-[11px] text-[var(--text3)]">
                    avail: <span>{availableRangers}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      className="input w-[80px] text-right"
                      value={scoutRangers}
                      onChange={(e) => setScoutRangers(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      min="1"
                      placeholder="Qty"
                    />
                    <button className="base-btn px-2 py-1 text-[10px]" onClick={() => setScoutRangers(availableRangers)}>
                      Max
                    </button>
                  </div>
                </div>
                <button className="base-btn variant-green w-full bg-[var(--green)] text-black" id="btn-exp-scout" onClick={() => handleLaunchExpedition('scout')}>
                  {TYPE_META.scout.button}
                </button>
              </div>

              <div className="card border-l-[3px] border-l-[var(--accent1)]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="card-title !mb-0">🌲 Deep Expedition</div>
                  <span className="rounded-full bg-[rgba(180,60,0,0.15)] px-2 py-1 text-[11px] font-semibold text-[var(--accent1)]">
                    25 turns
                  </span>
                </div>
                <div className="mb-3 text-[12px] leading-6 text-[var(--text3)]">
                  Rangers venture deep into uncharted wilderness. Substantially better rewards including
                  research scrolls, mercenary companies, ruins, and rare legendary artifacts.
                </div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="name text-[12px]">Rangers</span>
                  <span className="text-[11px] text-[var(--text3)]">
                    avail: <span>{availableRangers}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      className="input w-[80px] text-right"
                      value={deepRangers}
                      onChange={(e) => setDeepRangers(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      min="1"
                      placeholder="Qty"
                    />
                    <button className="base-btn px-2 py-1 text-[10px]" onClick={() => setDeepRangers(availableRangers)}>
                      Max
                    </button>
                  </div>
                </div>
                <button className="base-btn variant-accent w-full bg-[var(--accent1)]" id="btn-exp-deep" onClick={() => handleLaunchExpedition('deep')}>
                  {TYPE_META.deep.button}
                </button>
              </div>

              <div className="card border-l-[3px] border-l-[var(--red)]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="card-title !mb-0">⚔️ Dungeon Raid</div>
                  <span className="rounded-full bg-[rgba(224,92,92,0.15)] px-2 py-1 text-[11px] font-semibold text-[var(--red)]">
                    50 turns
                  </span>
                </div>
                <div className="mb-3 text-[12px] leading-6 text-[var(--text3)]">
                  Fighters and rangers assault an ancient dungeon. High risk - failure costs fighters.
                  Success yields legendary artifacts, war machines, permanent research boosts, and massive gold hoards.
                </div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="name text-[12px]">Rangers</span>
                  <span className="text-[11px] text-[var(--text3)]">
                    avail: <span>{availableRangers}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      className="input w-[80px] text-right"
                      value={dungeonRangers}
                      onChange={(e) => setDungeonRangers(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      min="1"
                      placeholder="Qty"
                    />
                    <button className="base-btn px-2 py-1 text-[10px]" onClick={() => setDungeonRangers(availableRangers)}>
                      Max
                    </button>
                  </div>
                </div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="name text-[12px]">Fighters</span>
                  <span className="text-[11px] text-[var(--text3)]">
                    avail: <span>{availableFighters}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      className="input w-[80px] text-right"
                      value={dungeonFighters}
                      onChange={(e) => setDungeonFighters(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      min="1"
                      placeholder="Qty"
                    />
                    <button className="base-btn px-2 py-1 text-[10px]" onClick={() => setDungeonFighters(availableFighters)}>
                      Max
                    </button>
                  </div>
                </div>
                <button className="base-btn variant-red w-full bg-[var(--red)]" id="btn-exp-dungeon" onClick={() => handleLaunchExpedition('dungeon')}>
                  {TYPE_META.dungeon.button}
                </button>
              </div>

              <div className="card border-l-[3px] border-l-[#6b9bd1]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="card-title !mb-0">🏔️ Mountain's Heart</div>
                  <span className="rounded-full bg-[rgba(107,155,209,0.15)] px-2 py-1 text-[11px] font-semibold text-[#6b9bd1]">
                    100 turns
                  </span>
                </div>
                <div className="mb-2 text-[12px] leading-6 text-[var(--text3)]">
                  Rangers navigate treacherous mountain peaks facing avalanches and extreme attrition.
                  Exclusive source of collectible artifacts and elemental fragments.
                </div>
                <div className="mb-3 rounded-md border-l-[3px] border-l-[#ffb852] bg-[rgba(255,184,82,0.1)] p-2 text-[11px] text-[var(--text2)]">
                  ⚠️ <strong>EXTREME RISK:</strong> Rangers face up to 4-8% attrition per turn depending on level.
                  Level 20+ rangers recommended. Food costs very high for 100-turn expedition.
                </div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="name text-[12px]">Rangers</span>
                  <span className="text-[11px] text-[var(--text3)]">
                    avail: <span>{availableRangers}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      className="input w-[80px] text-right"
                      value={mountainRangers}
                      onChange={(e) => setMountainRangers(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      min="1"
                      placeholder="Qty"
                    />
                    <button className="base-btn px-2 py-1 text-[10px]" onClick={() => setMountainRangers(availableRangers)}>
                      Max
                    </button>
                  </div>
                </div>
                {mountainFoodCost > 0 && (
                  <div className="mb-3 rounded-md border-l-[3px] border-l-[#8b5cf6] bg-[rgba(139,92,246,0.1)] p-2 text-[11px] text-[var(--text2)]">
                    🍖 <strong>Food required:</strong> {formatNum(mountainFoodCost)} (100 turns at {Math.round(mountainRangers * 0.5)}/turn)
                  </div>
                )}
                <button className="base-btn variant-blue w-full bg-[#6b9bd1]" id="btn-exp-mountain" onClick={() => handleLaunchExpedition('mountain')}>
                  {TYPE_META.mountain.button}
                </button>
              </div>

              {/* Fog of War Phase 3: Hex area scout UI (separate from expedition types; reveals frontier hexes) */}
              <div className="card border-l-[3px] border-l-[var(--accent2)]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="card-title !mb-0">🗺️ Area Hex Scout</div>
                  <span className="rounded-full bg-[rgba(120,120,200,0.15)] px-2 py-1 text-[11px] font-semibold text-[var(--accent2)]">
                    Fog of War
                  </span>
                </div>
                <div className="mb-3 text-[12px] leading-6 text-[var(--text3)]">
                  Send rangers to reveal a frontier hex area (and any kingdoms/nodes inside). Must be adjacent to seen cells. Costs rangers + food.
                </div>
                <div className="mb-2 grid grid-cols-3 gap-2 text-[12px]">
                  <div>
                    <div className="name mb-0.5">Col</div>
                    <input type="number" className="input w-full" value={areaCol} onChange={(e) => setAreaCol(Math.max(0, parseInt(e.target.value, 10) || 0))} placeholder="e.g. 12" min="0" />
                  </div>
                  <div>
                    <div className="name mb-0.5">Row</div>
                    <input type="number" className="input w-full" value={areaRow} onChange={(e) => setAreaRow(Math.max(0, parseInt(e.target.value, 10) || 0))} placeholder="e.g. 7" min="0" />
                  </div>
                  <div>
                    <div className="name mb-0.5">Rangers</div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        className="input w-full text-right"
                        value={areaRangers}
                        onChange={(e) => setAreaRangers(Math.max(0, Math.min(1000, parseInt(e.target.value, 10) || 0)))}
                        min="0"
                        max="1000"
                        placeholder="Qty"
                      />
                      <button className="base-btn px-2 py-1 text-[10px]" onClick={() => setAreaRangers(Math.min(1000, availableRangers))}>Max</button>
                    </div>
                  </div>
                </div>
                <button className="base-btn variant-accent w-full" onClick={handleScoutArea}>
                  Scout Area
                </button>
                <div className="mt-2 text-[10px] text-[var(--text3)]">Frontier only. Already-seen hexes are free (no cost) but do nothing.</div>
              </div>
            </div>
          </div>

          <div className="card flex min-h-[780px] flex-col">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="card-title !mb-0">Expedition log</div>
              <button className="base-btn px-3 py-1 text-[11px]" onClick={clearExpeditionLog} title="Clear completed entries from the log">
                🗑️ Clear log
              </button>
            </div>
            <div id="exploration-log" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {instantEntries.length === 0 && activeExpeditions.length === 0 && completedExpeditions.length === 0 && (
                <EmptyState
                  icon="🧭"
                  title="No expeditions yet"
                  description="Send rangers on a scout, deep, dungeon, or mountain expedition to fill this log."
                />
              )}
              {instantEntries.map((entry) => (
                <div key={entry.id} className="exp-log-entry flex items-start gap-3 border-b border-[var(--border)] py-2 text-[13px]">
                  <span className="flex-shrink-0 text-[18px]">{entry.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[var(--text)]">{entry.title}</div>
                    <div className="mt-0.5 text-[11px] text-[var(--text3)]">{entry.subtitle}</div>
                  </div>
                </div>
              ))}
              {activeExpeditions.map((exp) => renderRow(exp, false))}
              {completedExpeditions.map((exp) => renderRow(exp, true))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExplorationPanel;
