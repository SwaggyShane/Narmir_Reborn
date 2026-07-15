import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { cleanMessageText, toast } from '../../utils/toast.js';
import { apiCall } from '../../utils/api';
import { repairMojibake } from '../../utils/repairMojibake';
import { normalizeAndRouteResponse } from '../../utils/responseNormalizer.js';
import { AppEvent } from '../../utils/appEvents.js';
import { useAppEvent } from '../../hooks/useAppEvent.js';
import { useGameMutationEvents } from '../../hooks/useGameState';
import { useEconomyStore, useProfileStore, useMilitaryStore, useResearchStore, usePopulationStore, useBuildAllocation, useTrainingAllocation, useResourceBuildAllocation } from '../../stores';
import EmptyState from './EmptyState.jsx';
import HexSelectionModal from './HexSelectionModal.jsx';

const REFRESH_INTERVAL_MS = 2 * 60 * 1000;
const EXPEDITION_TURNS = {
  dungeon: 50,
  mountain: 100,
};

const TYPE_META = {
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

// Scout ring calculator (matches game/scout-rings.js)
const MAX_SCOUT_RING = 25; // Must match game/config.js SCOUT_CONSTANTS.MAX_RING (stride 48: 1.5× old stride 32)
const SCOUT_BASE_TURNS = 10; // Ring 1 costs 10 turns
const SCOUT_RING_INCREMENT = 5; // Each subsequent ring costs 5 more turns
const getCompletedRing = (scoutProgress) => {
  const progress = Math.max(0, Math.floor(Number(scoutProgress) || 0));
  let ring = 0;
  for (let i = 1; i <= MAX_SCOUT_RING; i++) {
    const turnsRequired = SCOUT_BASE_TURNS + (i - 1) * SCOUT_RING_INCREMENT; // cost for this ring
    let totalTurns = 0;
    for (let j = 1; j <= i; j++) {
      totalTurns += SCOUT_BASE_TURNS + (j - 1) * SCOUT_RING_INCREMENT;
    }
    if (progress >= totalTurns) {
      ring = i;
    } else {
      break;
    }
  }
  return ring;
};

const getTotalTurnsForRing = (ring) => {
  let total = 0;
  for (let i = 1; i <= ring; i++) {
    total += SCOUT_BASE_TURNS + (i - 1) * SCOUT_RING_INCREMENT;
  }
  return total;
};

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

const ExplorationPanel = ({ selectedHex = null, onClearSelectedHex = null } = {}) => {
  const rangers = useMilitaryStore((state) => state.troops.rangers);
  const fighters = useMilitaryStore((state) => state.troops.fighters);
  const engineers = useMilitaryStore((state) => state.troops.engineers);
  const food = useEconomyStore((state) => state.food);
  const turns_stored = useProfileStore((state) => state.turns_stored);
  const scout_allocation = useProfileStore((state) => state.scout_allocation);
  const scout_progress = useProfileStore((state) => state.scout_progress);
  const first_dungeon_found_turn = useProfileStore((state) => state.first_dungeon_found_turn);
  const first_mountain_found_turn = useProfileStore((state) => state.first_mountain_found_turn);
  const fog_of_war_disabled = useProfileStore((state) => state.fog_of_war_disabled);
  const population = usePopulationStore((state) => state.population);
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
  const [dungeonRangers, setDungeonRangers] = useState(0);
  const [dungeonFighters, setDungeonFighters] = useState(0);
  const [mountainRangers, setMountainRangers] = useState(0);
  // Fog of War Phase 3: area hex scout (separate from old expedition scout types)
  const [activeExpeditions, setActiveExpeditions] = useState([]);
  const [completedExpeditions, setCompletedExpeditions] = useState([]);
  const [instantEntries, setInstantEntries] = useState([]);
  // Phase 1: Turn-based resource gathering with durations
  const [huntingRangers, setHuntingRangers] = useState(0);
  const [huntingTerrain, setHuntingTerrain] = useState('forest');
  const [huntingDuration, setHuntingDuration] = useState(null); // 'instant', '5', '25', or null
  const [huntingTargetHex, setHuntingTargetHex] = useState(null);
  const [prospectingEngineers, setProspectingEngineers] = useState(0);
  const [prospectingTerrain, setProspectingTerrain] = useState('mountain');
  const [prospectingDuration, setProspectingDuration] = useState(null);
  const [prospectingTargetHex, setProspectingTargetHex] = useState(null);
  const [landExpansionRangers, setLandExpansionRangers] = useState(0);
  // Hex selection modal state
  const [hexModalOpen, setHexModalOpen] = useState(false);
  const [hexModalContext, setHexModalContext] = useState(null); // { type: 'hunting'|'prospecting'|'land_expansion'|'epic_trek', duration: ... }
  // Phase 2E: Scout allocation UI
  const [scoutAllocationInput, setScoutAllocationInput] = useState(0);
  // Phase 3: Epic Trek point-and-go
  const [epicTrekTargetX, setEpicTrekTargetX] = useState('');
  const [epicTrekTargetY, setEpicTrekTargetY] = useState('');

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

  const refreshProfile = useCallback(async () => {
    try {
      const data = await apiCall('/api/kingdom/me');
      if (data) {
        syncKingdomData(data);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshInventory(), refreshExpeditions(), refreshProfile()]);
  }, [refreshExpeditions, refreshInventory, refreshProfile]);

  useEffect(() => {
    void refreshAll();
    const refreshTimer = setInterval(() => {
      void refreshAll();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(refreshTimer);
  }, [refreshAll]);

  // Phase 3A: Zustand-driven refetch (dual source - listener is safety net)
  useEffect(() => {
    void refreshAll();
  }, [rangers, fighters, engineers, food, turns_stored, scout_allocation, scout_progress, population, refreshAll]);

  useGameMutationEvents(
    useCallback((event) => {
      if (!event?.reason) return;
      const reason = String(event.reason);
      if (
        reason === 'turn' ||
        reason === 'search' ||
        reason === 'hunting' ||
        reason === 'prospecting' ||
        reason === 'land-expansion' ||
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

  const buildAllocation = useBuildAllocation();
  const trainingAllocation = useTrainingAllocation();
  const resourceBuildAllocation = useResourceBuildAllocation();

  const inventoryCount = Object.keys(inventory).length;
  const availableRangers = Math.max(0, Number(rangers || 0) - Number(scout_allocation || 0));
  const availableFighters = Number(fighters || 0);

  // Calculate available engineers: total - training allocation - build allocations
  const trainAllocEngineers = Math.max(0, parseInt(trainingAllocation?.engineers || 0, 10) || 0);
  const buildAllocEngineers = Object.values(buildAllocation || {}).reduce((sum, n) => sum + (Number(n) || 0), 0);
  const resourceAllocEngineers = Object.values(resourceBuildAllocation || {}).reduce((sum, n) => sum + (Number(n) || 0), 0);
  const availableEngineers = Math.max(0, Number(engineers || 0) - trainAllocEngineers - buildAllocEngineers - resourceAllocEngineers);

  const availableFood = Number(food || 0);
  const availablePopulation = Number(population || 0);
  const expeditionTurns = useMemo(() => EXPEDITION_TURNS, []);
  const mountainFoodCost = Math.ceil(mountainRangers * 0.5 * 100 * 0.75);

  const applyResult = useCallback((result, reason) => {
    if (result?.updates) {
      normalizeAndRouteResponse(result, { reason });
    }
  }, []);

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

  const handleExpeditionLogEntry = useCallback((detail) => {
    const { icon, title, subtitle } = detail || {};
    if (!title) return;
    logInstantEntry(icon, title, subtitle);
  }, [logInstantEntry]);

  useAppEvent(AppEvent.EXPEDITION_LOG_ENTRY, handleExpeditionLogEntry);

  const handleLaunchExpedition = useCallback(async (type) => {
    const rangers = Number(
      type === 'dungeon'
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
  }, [applyResult, availableFighters, availableFood, availableRangers, dungeonFighters, dungeonRangers, expeditionTurns, logInstantEntry, mountainRangers, refreshAll]);

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

  // Handler for opening hex selection modal for resource gathering
  const openHexModal = useCallback((type, duration) => {
    setHexModalContext({ type, duration });
    setHexModalOpen(true);
  }, []);

  // Handler for hex selection modal result — immediately trigger the action
  const handleHexSelected = useCallback((hex) => {
    if (!hexModalContext) return;

    const { type, duration } = hexModalContext;
    setHexModalOpen(false);
    setHexModalContext(null);

    // Record selected hex and duration, then trigger the appropriate handler
    if (type === 'hunting') {
      setHuntingTargetHex(hex);
      setHuntingDuration(duration);
    } else if (type === 'prospecting') {
      setProspectingTargetHex(hex);
      setProspectingDuration(duration);
    } else if (type === 'epic_trek') {
      // Epic trek still executes immediately
      (async () => {
        try {
          const result = await apiCall('/api/kingdom/expedition/epic-trek', {
            method: 'POST',
            body: { target_x: hex.x, target_y: hex.y },
          });

          if (result.error) {
            if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.error, 'error');
            return;
          }

          applyResult(result, 'epic-trek-start');
          if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.message || 'Epic Trek launched!', 'success');
          logInstantEntry('🛤️', 'Epic Trek', `Heading to (${hex.x}, ${hex.y}) — ${result.path_hexes} hexes, ${result.turns_left} turns`);
          await refreshAll();
        } catch (err) {
          console.error('[expedition/epic-trek] failed:', err);
          if (typeof window !== 'undefined' && typeof toast === 'function') toast('Epic Trek failed — please try again', 'error');
        }
      })();
    }
  }, [hexModalContext, applyResult, logInstantEntry, refreshAll]);

  // Phase 1: Turn-based resource gathering handlers
  const handleHunting = useCallback(async () => {
    const r = Number(huntingRangers || 0);
    const duration = huntingDuration || 'instant';

    if (r < 1) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Send at least 1 ranger', 'error');
      return;
    }
    if (r > availableRangers) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Not enough available rangers', 'error');
      return;
    }

    try {
      const body = { rangers: r, terrain: huntingTerrain, duration };
      if (huntingTargetHex && duration !== 'instant') {
        body.target_x = huntingTargetHex.x;
        body.target_y = huntingTargetHex.y;
      }

      const result = await apiCall('/api/kingdom/expedition/hunting', {
        method: 'POST',
        body,
      });

      if (result.error) {
        if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.error, 'error');
        return;
      }

      applyResult(result, 'hunting');
      if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.message || 'Hunting expedition started!', 'success');
      const foodGained = result.reward?.foodReward || 0;
      const logMsg = huntingDuration === 'instant'
        ? `${formatNum(r)} rangers found ${formatNum(foodGained)} food`
        : `${formatNum(r)} rangers sent on expedition, will return with ${formatNum(foodGained)} food`;
      logInstantEntry('🥩', 'Hunting expedition', logMsg);
      setHuntingRangers(0);
      setHuntingTargetHex(null);
      setHuntingDuration(null);
      setHexModalOpen(false);
      await refreshAll();
    } catch (err) {
      console.error('[expedition/hunting] failed:', err);
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Hunting failed — please try again', 'error');
    }
  }, [huntingRangers, huntingTerrain, huntingDuration, huntingTargetHex, availableRangers, applyResult, logInstantEntry, refreshAll]);

  const handleProspecting = useCallback(async () => {
    const e = Number(prospectingEngineers || 0);
    const duration = prospectingDuration || 'instant';

    if (e < 1) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Send at least 1 engineer', 'error');
      return;
    }
    if (e > availableEngineers) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Not enough available engineers', 'error');
      return;
    }

    try {
      const body = { engineers: e, terrain: prospectingTerrain, duration };
      if (prospectingTargetHex && duration !== 'instant') {
        body.target_x = prospectingTargetHex.x;
        body.target_y = prospectingTargetHex.y;
      }

      const result = await apiCall('/api/kingdom/expedition/prospecting', {
        method: 'POST',
        body,
      });

      if (result.error) {
        if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.error, 'error');
        return;
      }

      applyResult(result, 'prospecting');
      if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.message || 'Prospecting expedition started!', 'success');
      const goldGained = result.reward?.goldReward || 0;
      const logMsg = prospectingDuration === 'instant'
        ? `${formatNum(e)} engineers found ${formatNum(goldGained)} gold`
        : `${formatNum(e)} engineers sent on expedition, will return with ${formatNum(goldGained)} gold`;
      logInstantEntry('⛏️', 'Prospecting expedition', logMsg);
      setProspectingEngineers(0);
      setProspectingTargetHex(null);
      setProspectingDuration(null);
      setHexModalOpen(false);
      await refreshAll();
    } catch (err) {
      console.error('[expedition/prospecting] failed:', err);
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Prospecting failed — please try again', 'error');
    }
  }, [prospectingEngineers, prospectingTerrain, prospectingDuration, prospectingTargetHex, availableEngineers, applyResult, logInstantEntry, refreshAll]);

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
        body: { rangers: r },
      });

      if (result.error) {
        if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.error, 'error');
        return;
      }

      applyResult(result, 'land-expansion');
      if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.message || 'Land expanded!', 'success');
      const popCost = result.reward?.populationCost || 0;
      const landsFound = result.reward?.landsDiscovered || 0;
      logInstantEntry('🗺️', 'Land expansion', `Discovered ${formatNum(landsFound)} new lands (used ${formatNum(popCost)} population)`);
      setLandExpansionRangers(0);
      await refreshAll();
    } catch (err) {
      console.error('[expedition/land-expansion] failed:', err);
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Land expansion failed — please try again', 'error');
    }
  }, [landExpansionRangers, applyResult, logInstantEntry, refreshAll]);

  // Phase 2E: Scout allocation handlers
  const handleScoutAllocate = useCallback(async () => {
    const r = Number(scoutAllocationInput || 0);
    if (r <= 0) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Enter a valid ranger count greater than 0', 'error');
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
        toast(`${formatNum(result.allocated || r)} rangers allocated to scouting`, 'success');
      }
      setScoutAllocationInput(0);
      await refreshAll();
    } catch (err) {
      console.error('[scout/allocate] failed:', err);
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Allocation failed — please try again', 'error');
    }
  }, [scoutAllocationInput, applyResult, refreshAll]);

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

  const handleEpicTrek = useCallback(async () => {
    const x = Number(epicTrekTargetX);
    const y = Number(epicTrekTargetY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Enter valid target coordinates (click on map or type X,Y)', 'error');
      return;
    }

    if ((turns_stored || 0) < 1) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Epic Trek requires turns', 'warn');
      return;
    }

    try {
      const result = await apiCall('/api/kingdom/expedition/epic-trek', {
        method: 'POST',
        body: { target_x: x, target_y: y },
      });

      if (result.error) {
        if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.error, 'error');
        return;
      }

      applyResult(result, 'epic-trek-start');
      if (typeof window !== 'undefined' && typeof toast === 'function') toast(result.message || 'Epic Trek launched!', 'success');
      logInstantEntry('🗺️', 'Epic Trek', `Heading to (${x}, ${y}) — ${result.path_hexes} hexes, ${result.turns_left} turns`);
      setEpicTrekTargetX('');
      setEpicTrekTargetY('');
      await refreshAll();
    } catch (err) {
      console.error('[expedition/epic-trek] failed:', err);
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Epic Trek failed — please try again', 'error');
    }
  }, [epicTrekTargetX, epicTrekTargetY, turns_stored, applyResult, logInstantEntry, refreshAll]);

  // Auto-populate target coordinates when hex is selected from worldmap
  useEffect(() => {
    if (selectedHex) {
      setEpicTrekTargetX(selectedHex.x);
      setEpicTrekTargetY(selectedHex.y);
      if (typeof window !== 'undefined' && typeof toast === 'function') {
        toast(`Target set to (${selectedHex.x}, ${selectedHex.y})`, 'info');
      }
      if (onClearSelectedHex) {
        onClearSelectedHex();
      }
    }
  }, [selectedHex, onClearSelectedHex]);

  const renderRow = (entry, isCompleted = false) => {
    const rewards = isCompleted ? normalizeRewards(entry.rewards) : [];

    // Show appropriate units based on expedition type
    let troops;
    if (entry.type === 'prospecting') {
      troops = `${formatNum(entry.engineers)} engineers`;
    } else if (entry.type === 'land_expansion') {
      troops = `${formatNum(entry.rangers)} rangers`;
    } else {
      troops = `${formatNum(entry.rangers)} rangers${entry.fighters > 0 ? `, ${formatNum(entry.fighters)} fighters` : ''}`;
    }

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
            {!isCompleted && entry.type !== 'land_expansion' && ` departed — ${entry.turns_left} turn${entry.turns_left === 1 ? '' : 's'} left`}
            {isCompleted && ' — Returned'}
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

    // Show appropriate units based on expedition type
    let troops;
    if (entry.type === 'prospecting') {
      troops = `${formatNum(entry.engineers)} engineers`;
    } else if (entry.type === 'land_expansion') {
      troops = `${formatNum(entry.rangers)} rangers`;
    } else {
      troops = `${formatNum(entry.rangers)} rangers${entry.fighters > 0 ? `, ${formatNum(entry.fighters)} fighters` : ''}`;
    }

    const countdownLabel = turnsLeft > 0
      ? `${formatNum(turnsLeft)} turn${turnsLeft === 1 ? '' : 's'} left`
      : 'Wrapping up…';

    return (
      <div
        key={`active-summary-${entry.id}`}
        className="rounded-xl border border-l-[3px] border-[var(--border)] bg-[rgba(255,255,255,0.04)] p-3"
        style={{ borderLeftColor: meta.border || 'var(--border)' }}
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
                      className={clsx(
                        'rounded-2xl border border-l-[3px] border-[var(--border)] bg-[rgba(255,255,255,0.05)] p-3',
                        item.rarity === 'junk' ? 'border-l-[color:var(--text3)]' : 'border-l-[color:var(--accent1)]',
                      )}
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
              <div className="card-title !mb-3">Available Units</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[11px] text-[var(--text3)] uppercase font-semibold mb-1">Rangers</div>
                  <div className="text-[24px] font-extrabold text-[var(--green)]">
                    {availableRangers.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[var(--text3)] uppercase font-semibold mb-1">Engineers</div>
                  <div className="text-[24px] font-extrabold text-[var(--accent1)]">
                    {availableEngineers.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[var(--text3)] uppercase font-semibold mb-1">Population</div>
                  <div className="text-[24px] font-extrabold text-[var(--gold)]">
                    {availablePopulation.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Resource Gathering</div>
              <div className="mb-4 text-[12px] text-[var(--text3)]">
                Send specialists on expeditions to gather resources. Terrain affects returns. Durations scale from instant scouts to extended expeditions.
              </div>
              <div className="grid gap-4 md:grid-cols-3 items-stretch">
                {/* Hunting Card */}
                <div className="rounded-lg border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-3 flex flex-col justify-between">
                  <div className="mb-2 font-semibold text-[var(--text)]">🥩 Hunting</div>
                  <div className="mb-3 text-[11px] text-[var(--text3)]">Rangers hunt for food. Forest terrain is ideal.</div>
                  <div className="mb-2 text-[12px]">
                    <label className="block text-[var(--text3)] mb-1">Rangers</label>
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
                  {huntingTargetHex && huntingDuration ? (
                    <div className="mb-2 rounded bg-[var(--accent2)]/10 px-2 py-1 text-[11px] text-[var(--accent2)]">
                      Target: ({huntingTargetHex.x}, {huntingTargetHex.y}) — {huntingDuration} turns
                    </div>
                  ) : null}
                  <div className="flex gap-1">
                    <button className="base-btn flex-1 bg-[rgba(76,175,130,0.3)] text-[11px] font-semibold" onClick={() => { setHuntingDuration('instant'); setHuntingTargetHex(null); setTimeout(() => handleHunting(), 0); }}>
                      Instant
                    </button>
                    <button className="base-btn flex-1 bg-[rgba(76,175,130,0.2)] text-[11px]" onClick={() => openHexModal('hunting', '5')}>
                      5
                    </button>
                    <button className="base-btn flex-1 bg-[rgba(76,175,130,0.2)] text-[11px]" onClick={() => openHexModal('hunting', '25')}>
                      25
                    </button>
                  </div>
                  {huntingTargetHex && huntingDuration && (huntingDuration === '5' || huntingDuration === '25') ? (
                    <button className="base-btn w-full mt-2 bg-[rgba(76,175,130,0.3)] text-[11px] font-semibold" onClick={handleHunting}>
                      Launch Expedition
                    </button>
                  ) : null}
                </div>

                {/* Prospecting Card */}
                <div className="rounded-lg border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-3 flex flex-col justify-between">
                  <div className="mb-2 font-semibold text-[var(--text)]">⛏️ Prospecting</div>
                  <div className="mb-3 text-[11px] text-[var(--text3)]">Engineers prospect for gold. Mountains are ideal.</div>
                  <div className="mb-2 text-[12px]">
                    <label className="block text-[var(--text3)] mb-1">Engineers</label>
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
                  {prospectingTargetHex && prospectingDuration ? (
                    <div className="mb-2 rounded bg-[var(--accent1)]/10 px-2 py-1 text-[11px] text-[var(--accent1)]">
                      Target: ({prospectingTargetHex.x}, {prospectingTargetHex.y}) — {prospectingDuration} turns
                    </div>
                  ) : null}
                  <div className="flex gap-1">
                    <button className="base-btn flex-1 bg-[rgba(180,60,0,0.3)] text-[11px] font-semibold" onClick={() => { setProspectingDuration('instant'); setProspectingTargetHex(null); setTimeout(() => handleProspecting(), 0); }}>
                      Instant
                    </button>
                    <button className="base-btn flex-1 bg-[rgba(180,60,0,0.2)] text-[11px]" onClick={() => openHexModal('prospecting', '5')}>
                      5
                    </button>
                    <button className="base-btn flex-1 bg-[rgba(180,60,0,0.2)] text-[11px]" onClick={() => openHexModal('prospecting', '25')}>
                      25
                    </button>
                  </div>
                  {prospectingTargetHex && prospectingDuration && (prospectingDuration === '5' || prospectingDuration === '25') ? (
                    <button className="base-btn w-full mt-2 bg-[rgba(180,60,0,0.3)] text-[11px] font-semibold" onClick={handleProspecting}>
                      Launch Expedition
                    </button>
                  ) : null}
                </div>

                {/* Land Expansion Card */}
                <div className="rounded-lg border border-[var(--border)] bg-[rgba(255,255,255,0.03)] p-3 flex flex-col justify-between">
                  <div className="mb-2 font-semibold text-[var(--text)]">🗺️ Land Expansion</div>
                  <div className="mb-3 text-[11px] text-[var(--text3)]">Rangers discover new land from home hex. Costs population. Diminishing returns apply.</div>
                  <div className="mb-2 text-[12px]">
                    <label className="block text-[var(--text3)] mb-1">Rangers</label>
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
                  <button className="base-btn w-full bg-[rgba(218,165,32,0.2)] text-[11px]" onClick={handleLandExpansion}>
                    Send Rangers
                  </button>
                </div>
              </div>
            </div>

            <div className="card border-l-[3px] border-l-[var(--accent2)]">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="card-title !mb-0">🔍 Scouting</div>
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
                    {(() => {
                      const currentRing = getCompletedRing(scout_progress);
                      if (currentRing >= MAX_SCOUT_RING) {
                        return `${formatNum(scout_allocation)} rangers • Ring ${MAX_SCOUT_RING} (Complete)`;
                      }
                      const nextRing = currentRing + 1;
                      const turnsForNext = SCOUT_BASE_TURNS + (nextRing - 1) * SCOUT_RING_INCREMENT;
                      const turnsPreviousDone = getTotalTurnsForRing(currentRing);
                      const turnsIntoNext = scout_progress - turnsPreviousDone;
                      return `${formatNum(scout_allocation)} rangers • Ring ${currentRing} (${formatNum(turnsIntoNext)} / ${formatNum(turnsForNext)} toward Ring ${nextRing})`;
                    })()}
                  </div>
                </div>
              )}

              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="name text-[12px]">Rangers to add</span>
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
                  disabled={scoutAllocationInput === 0}
                >
                  Allocate
                </button>
                <button
                  className="base-btn flex-1 text-[12px] text-[var(--text3)]"
                  onClick={handleScoutReleaseAll}
                  disabled={scout_allocation === 0}
                  title="Release all scouts and stop ring progression"
                >
                  Release
                </button>
              </div>
            </div>

            {/* Epic Trek unlocks once passive scouting has completed Ring 2 -- or unconditionally when fog of war is disabled (test/debug mode). */}
            {(fog_of_war_disabled || getCompletedRing(scout_progress) >= 2) && (
              <div className="card">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="card-title !mb-0">🛤️ Epic Trek</div>
                  <span className="rounded-full bg-[rgba(200,120,120,0.15)] px-2 py-1 text-[11px] font-semibold text-[var(--accent2)]">
                    Phase 3
                  </span>
                </div>
                <div className="mb-3 text-[12px] leading-6 text-[var(--text3)]">
                  Send rangers on a long expedition to a chosen location. Reveals fog along the path and discovers kingdoms & locations en route.
                </div>
                <div className="mb-2 grid grid-cols-2 gap-2 text-[12px]">
                  <div>
                    <div className="name mb-0.5">Target X</div>
                    <input
                      type="number"
                      className="input w-full"
                      value={epicTrekTargetX}
                      onChange={(e) => setEpicTrekTargetX(e.target.value)}
                      placeholder="e.g. 500"
                      min="0"
                      max="1999"
                    />
                  </div>
                  <div>
                    <div className="name mb-0.5">Target Y</div>
                    <input
                      type="number"
                      className="input w-full"
                      value={epicTrekTargetY}
                      onChange={(e) => setEpicTrekTargetY(e.target.value)}
                      placeholder="e.g. 300"
                      min="0"
                      max="1379"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="base-btn variant-accent flex-1" onClick={handleEpicTrek}>
                    Launch Epic Trek
                  </button>
                  <button className="base-btn flex-1" onClick={() => openHexModal('epic_trek', null)}>
                    Select on Map
                  </button>
                </div>
                <div className="mt-2 text-[10px] text-[var(--text3)]">Click "Select on Map" to choose coordinates visually, or enter them manually.</div>
              </div>
            )}

            {/* Dungeon/Mountain expeditions - visible once discovered, or unconditionally when fog of war is disabled (test/debug mode). */}
            {fog_of_war_disabled || (first_dungeon_found_turn !== null && first_dungeon_found_turn !== undefined) || (first_mountain_found_turn !== null && first_mountain_found_turn !== undefined) ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
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
            </div>
            ) : null}

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
              {completedExpeditions.filter((exp) => exp.type !== 'land_expansion').map((exp) => renderRow(exp, true))}
            </div>
          </div>
        </div>
      </div>

      {/* Hex Selection Modal for resource gathering and epic trek */}
      {hexModalOpen && (
        <HexSelectionModal
          isOpen={hexModalOpen}
          context={hexModalContext}
          onHexSelected={handleHexSelected}
          onClose={() => {
            setHexModalOpen(false);
            setHexModalContext(null);
          }}
        />
      )}
    </div>
  );
};

export default ExplorationPanel;
