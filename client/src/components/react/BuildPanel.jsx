import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiCall } from '../../utils/api.mjs';
import { fmt } from "../../utils/fmt";
import { toast } from '../../utils/toast.js';
import ProgressBar from './ProgressBar';
import HybridBlueprintModal from './HybridBlueprintModal';
import {
  useEconomyStore,
  useRace,
  useEngineers,
  useEngineerLevel,
  useEngineerXp,
  useEngineerXpNeeded,
  useBuildAllocation,
  useBuildProgress,
  useLand,
  useBuiltLand,
  useHammersStored,
  useHammerTurnsUsed,
  useLandAvailable,
  useGold,
  useWood,
  useStone,
  useIron,
  useSteel,
  useCoal,
  useBlueprintsStored,
  useScaffoldingStored,
  useBuildCount,
  useBuildingCounts,
} from '../../stores';

const RESONANCE_HINTS = {
  faint: [
    'A faint resonance hums within these walls.',
    'Something stirs, distant and patient.',
    'The fragment whispers of kin still unseen.',
    'A subtle pull, as if toward something further away.',
  ],
  alignment: [
    'The fragments are listening to one another.',
    'An ancient pattern begins to take shape.',
    'The air thrums with hidden alignment.',
    'A geometry only the old gods remember.',
  ],
  convergence: [
    'The veil thins. Something old draws near.',
    'Powers long-sundered remember each other.',
    'The world holds its breath here.',
    'Sympathy of stone and star and bone.',
  ],
};

const RESONANCE_GLYPH = { faint: '.', alignment: '✦', convergence: '✶' };
const RESONANCE_COLOR = {
  faint: 'var(--text3)',
  alignment: 'var(--amber, #fbbf24)',
  convergence: 'var(--gold)',
};

function pickResonanceHint(key, tier) {
  const pool = RESONANCE_HINTS[tier] || RESONANCE_HINTS.faint;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return pool[Math.abs(h) % pool.length];
}

function resonanceOpacity(count) {
  if (count >= 4) return 1.0;
  if (count === 3) return 0.85;
  if (count === 2) return 0.65;
  return 0.45;
}

const BUILDINGS = [
  { id: 'farms', name: 'Farm', tier: 1, wood: 0, stone: 0, iron: 0, time: 10, land: 10 },
  { id: 'housing', name: 'Housing', tier: 2, wood: 200, stone: 100, iron: 50, time: 100, land: 25 },
  { id: 'granaries', name: 'Granary', tier: 2, wood: 200, stone: 100, iron: 50, time: 100, land: 15 },
  { id: 'taverns', name: 'Tavern', tier: 2, wood: 200, stone: 100, iron: 50, time: 100, land: 40 },
  { id: 'markets', name: 'Market', tier: 3, wood: 800, stone: 500, iron: 200, time: 500, land: 100 },
  { id: 'barracks', name: 'Barracks', tier: 3, wood: 800, stone: 500, iron: 200, time: 500, land: 100 },
  { id: 'libraries', name: 'Library', tier: 3, wood: 200, stone: 250, iron: 50, time: 500, land: 25 },
  { id: 'schools', name: 'School', tier: 3, wood: 800, stone: 500, iron: 200, time: 500, land: 125 },
  { id: 'shrines', name: 'Shrine', tier: 3, wood: 800, stone: 500, iron: 200, time: 500, land: 150 },
  { id: 'mausoleums', name: 'Mausoleum', tier: 3, wood: 800, stone: 500, iron: 200, time: 500, land: 150 },
  { id: 'guard_towers', name: 'Guard Tower', tier: 4, wood: 2000, stone: 1500, iron: 500, time: 2500, land: 50 },
  { id: 'walls', name: 'Wall', tier: 5, wood: 5000, stone: 5000, iron: 1500, time: 10000, land: 50 },
  { id: 'outposts', name: 'Outpost', tier: 5, wood: 5000, stone: 5000, iron: 1500, time: 10000, land: 25 },
  { id: 'smithies', name: 'Smithy', tier: 5, wood: 5000, stone: 5000, iron: 1500, time: 10000, land: 200 },
  { id: 'armories', name: 'Armory', tier: 6, wood: 7500, stone: 12500, iron: 3000, time: 25000, land: 300 },
  { id: 'vaults', name: 'Vault', tier: 6, wood: 7500, stone: 12500, iron: 3000, time: 25000, land: 300 },
  { id: 'mage_towers', name: 'Mage Tower', tier: 6, wood: 7500, stone: 12500, iron: 3000, time: 25000, land: 250 },
  { id: 'training', name: 'Training Field', tier: 7, wood: 8500, stone: 17500, iron: 4000, time: 35000, land: 850 },
  { id: 'castles', name: 'Castle', tier: 8, wood: 10000, stone: 25000, iron: 5000, time: 50000, land: 1000 },
  { id: 'wm', name: 'War Machine', wood: 200, stone: 0, iron: 50, time: 100, land: 0 },
  { id: 'ballistae', name: 'Ballistae', wood: 200, stone: 0, iron: 50, time: 100, land: 0 },
  { id: 'ladders', name: 'Ladder', wood: 20, stone: 0, iron: 2, time: 8, land: 0 },
  { id: 'weapons', name: 'Weapons', wood: 30, stone: 0, iron: 80, time: 20, land: 0 },
  { id: 'armor', name: 'Armor', wood: 10, stone: 0, iron: 110, time: 25, land: 0 },
];

const BUILDINGS_MAP = BUILDINGS.reduce((acc, b) => {
  acc[b.id] = b;
  return acc;
}, {});

const BUILDINGS_DISPLAY_ORDER = [
  'farms', 'granaries', 'housing', 'schools', 'libraries', 'mage_towers',
  'shrines', 'mausoleums', 'markets', 'taverns', 'smithies', 'vaults',
  'armories', 'barracks', 'walls', 'guard_towers', 'outposts', 'training',
  'castles', 'wm', 'ballistae', 'ladders', 'weapons', 'armor'
];

const BUILD_ALLOCATION_KEYS = {
  'ba-farm': 'farms',
  'ba-granary': 'granaries',
  'ba-housing': 'housing',
  'ba-school': 'schools',
  'ba-library': 'libraries',
  'ba-mage_tower': 'mage_towers',
  'ba-shrine': 'shrines',
  'ba-mausoleum': 'mausoleums',
  'ba-market': 'markets',
  'ba-tavern': 'taverns',
  'ba-smithy': 'smithies',
  'ba-vault': 'vaults',
  'ba-armory': 'armories',
  'ba-barracks': 'barracks',
  'ba-walls': 'walls',
  'ba-tower': 'guard_towers',
  'ba-outpost': 'outposts',
  'ba-training': 'training',
  'ba-castle': 'castles',
  'ba-wm': 'war_machines',
  'ba-ballistae': 'ballistae',
  'ba-ladders': 'ladders',
  'ba-weapons': 'weapons',
  'ba-armor': 'armor',
};

const SERVER_KEY_TO_DISPLAY_ID = { war_machines: 'wm' };

const BUILDING_TO_BA_ID = Object.fromEntries(
  Object.entries(BUILD_ALLOCATION_KEYS).map(([baId, serverKey]) => [
    SERVER_KEY_TO_DISPLAY_ID[serverKey] || serverKey,
    baId,
  ])
);

const BUILDING_EFFORT = {
  farms: 25, granaries: 350, housing: 350, taverns: 350,
  barracks: 1500, markets: 1500, libraries: 1500, schools: 1500, shrines: 1500, mausoleums: 1500,
  guard_towers: 3500, outposts: 7000, smithies: 7000, walls: 7000,
  armories: 13000, vaults: 13000, mage_towers: 13000,
  training: 18000, castles: 40000,
  war_machines: 1000, ballistae: 1000, weapons: 10, armor: 10, ladders: 100,
};

const BUILDING_ICONS = {
  farms: '🌾', granaries: '🛖', housing: '🏘️', schools: '🏫', libraries: '📖',
  mage_towers: '⛪', shrines: '⛩️', mausoleums: '⚰️', markets: '🏪', taverns: '🍺',
  smithies: '⚒️', vaults: '💰', armories: '🛡️', barracks: '🏠', walls: '🧱',
  guard_towers: '🗼', outposts: '🏴', training: '⚔️', castles: '🏰',
  war_machines: '🪖', ballistae: '🏹', ladders: '🪜', weapons: '🗡️', armor: '🔰',
};

const isBuildingRowVisible = (buildingId, vampire) => {
  if (buildingId === 'shrines') return !vampire;
  if (buildingId === 'mausoleums') return vampire;
  return true;
};

const BuildPanel = () => {
  const [showBuildingRef, setShowBuildingRef] = useState(false);
  const [showAttunements, setShowAttunements] = useState(false);
  const [availableAttunements, setAvailableAttunements] = useState([]);
  const [currentAttunements, setCurrentAttunements] = useState({});
  const [synergyContributions, setSynergyContributions] = useState({});
  const [synergyStatus, setSynergyStatus] = useState(null);
  const [showBlueprintModal, setShowBlueprintModal] = useState(false);
  const [selectedBlueprint, setSelectedBlueprint] = useState(null);
  const [synergyCooldown, setSynergyCooldown] = useState(null);
  const [activatingAbility, setActivatingAbility] = useState(false);
  const [loading, setLoading] = useState(false);
  const [buildUiTick, setBuildUiTick] = useState(0);
  const [engineerAllocations, setEngineerAllocations] = useState({});
  const [smithyDisplay, setSmithyDisplay] = useState({
    hammersStored: 0, hammersCap: 0, hammersAfford: 0,
    scaffoldingStored: 0, scaffoldingCap: 0, scaffoldingAfford: 0,
    smithyNote: null,
  });
  const [smithyInputs, setSmithyInputs] = useState({ hammers: 0, scaffolding: 0 });
  const [demolishAmounts, setDemolishAmounts] = useState({});

  // Zustand selectors - called at top level to follow Rules of Hooks
  const isVampire = useRace() === 'vampire';
  const totalEngineers = Number(useEngineers() || 0);
  const engineerLevel = Number(useEngineerLevel() || 1);
  const engineerXp = Number(useEngineerXp() || 0);
  const engineerXpNeeded = Number(useEngineerXpNeeded() || 1000);
  const land = useLand();
  const builtLand = useBuiltLand();
  const landAvailable = useLandAvailable();
  const buildAllocationRaw = useBuildAllocation();
  const gold = useGold();
  const wood = useWood();
  const stone = useStone();
  const iron = useIron();
  const steel = useSteel();
  const coal = useCoal();
  const blueprintsStored = useBlueprintsStored();
  const scaffoldingStored = useScaffoldingStored();
  const hammersStored = useHammersStored();
  const hammerTurnsUsed = useHammerTurnsUsed();
  const bldLibraries = useBuildCount('libraries');
  const buildingCounts = useBuildingCounts();
  const buildAllocation = useMemo(() => {
    if (typeof buildAllocationRaw === 'string') {
      try {
        return JSON.parse(buildAllocationRaw || '{}');
      } catch {
        return {};
      }
    }
    return buildAllocationRaw || {};
  }, [buildAllocationRaw]);
  const allocatedEngineers = useMemo(
    () => Object.values(engineerAllocations).reduce((sum, val) => sum + Number(val || 0), 0),
    [engineerAllocations]
  );
  const buildProgressRaw = useBuildProgress();
  const buildProgress = useMemo(() => {
    if (typeof buildProgressRaw === 'string') {
      try {
        return JSON.parse(buildProgressRaw || '{}');
      } catch {
        return {};
      }
    }
    return buildProgressRaw || {};
  }, [buildProgressRaw]);
  const hammerDurability = useMemo(() => {
    if (hammersStored <= 0) return null;
    return Math.max(
      0,
      Math.round(100 - ((hammerTurnsUsed / Math.max(1, hammersStored)) * 2.5))
    );
  }, [hammersStored, hammerTurnsUsed]);
  const remainingEngineers = Math.max(0, totalEngineers - allocatedEngineers);
  const refreshBuildUi = useCallback(() => {
    setBuildUiTick((tick) => tick + 1);
  }, []);

  const loadAttunements = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiCall('/api/kingdom/available-attunements');
      if (data.error) throw new Error(data.error);
      setAvailableAttunements(data.available || []);

      const statusData = await apiCall('/api/kingdom/attunements');
      if (statusData.error) throw new Error(statusData.error);

      const attunementArray = statusData.attunements || [];
      const attunements = {};
      for (const att of attunementArray) {
        if (att.buildingType) attunements[att.buildingType] = att;
      }
      setCurrentAttunements(attunements);

      const contributions = {};
      const attunementEntries = Object.entries(attunements).filter(([_, att]) => att && att.fragmentName);
      await Promise.all(
        attunementEntries.map(async ([building, att]) => {
          try {
            const contribData = await apiCall(
              `/api/kingdom/contributing-synergies?building_type=${encodeURIComponent(building)}&fragment_name=${encodeURIComponent(att.fragmentName)}`
            );
            if (contribData.error) return;
            if (contribData.contributes) {
              contributions[`${building}:${att.fragmentName}`] = {
                tier: contribData.resonanceTier || 'faint',
                count: contribData.contributingCount || 1,
              };
            }
          } catch (err) {
            console.error('[synergies] check failed:', err);
          }
        })
      );
      setSynergyContributions(contributions);

      const synergyData = await apiCall('/api/kingdom/synergy-status');
      if (synergyData.error) {
        setSynergyStatus(null);
        setSynergyCooldown(null);
      } else {
        setSynergyStatus(synergyData);

        if (synergyData.activeSynergy) {
          const cdData = await apiCall(
            `/api/kingdom/synergy-cooldown?synergy_id=${encodeURIComponent(synergyData.activeSynergy.id)}`
          );
          if (!cdData.error) setSynergyCooldown(cdData);
        } else {
          setSynergyCooldown(null);
        }
      }
    } catch (err) {
      console.error('[attunements] load failed:', err.message);
      toast(`Failed to load attunements: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showAttunements) {
      loadAttunements();
    }
  }, [showAttunements, loadAttunements]);

  // Use a stable stringified version for detecting meaningful changes (not just reference changes)
  const buildAllocationStr = useMemo(() => JSON.stringify(buildAllocation), [buildAllocation]);

  useEffect(() => {
    const newAllocations = {};
    Object.entries(BUILD_ALLOCATION_KEYS).forEach(([inputId, key]) => {
      newAllocations[inputId] = buildAllocation[key] || 0;
    });
    setEngineerAllocations(newAllocations);
    refreshBuildUi();
  }, [buildAllocationStr, refreshBuildUi]);

  const applyAttunement = useCallback(async (fragmentName, buildingType) => {
    try {
      const data = await apiCall('/api/kingdom/attune-fragment', {
        method: 'POST',
        body: { fragmentName, buildingType },
      });
      if (data.error) {
        alert(`Error: ${data.error}`);
        return;
      }
      await loadAttunements();
    } catch (err) {
      console.error('[attunements] apply failed:', err.message);
      alert('Failed to apply attunement');
    }
  }, [loadAttunements]);

  const removeAttunement = useCallback(async (buildingType) => {
    try {
      const data = await apiCall('/api/kingdom/remove-attunement', {
        method: 'POST',
        body: { buildingType },
      });
      if (data.error) {
        alert(`Error: ${data.error}`);
        return;
      }
      await loadAttunements();
    } catch (err) {
      console.error('[attunements] remove failed:', err.message);
      alert('Failed to remove attunement');
    }
  }, [loadAttunements]);

  const activateSynergyAbility = async () => {
    if (activatingAbility || !synergyStatus?.activeSynergy) return;
    setActivatingAbility(true);
    try {
      const data = await apiCall('/api/kingdom/activate-synergy-ability', {
        method: 'POST',
        body: { synergy_id: synergyStatus.activeSynergy.id },
      });
      if (data.error) {
        alert(`Error: ${data.error}`);
      } else {
        await loadAttunements();
      }
    } catch (err) {
      console.error('[synergy] activate failed:', err.message);
      alert('Failed to activate ability');
    } finally {
      setActivatingAbility(false);
    }
  };

  const formatBonusTooltip = (bonuses, special) => {
    const parts = [];
    if (bonuses && typeof bonuses === 'object') {
      for (const [k, v] of Object.entries(bonuses)) {
        if (v) parts.push(`${k.replace(/_/g, ' ')}: +${v}`);
      }
    }
    if (special?.name) parts.push(`✦ ${special.name}${special.desc ? ': ' + special.desc : ''}`);
    return parts.length ? parts.join('\n') : 'No bonus data';
  };

  const formatReq = (bld) => {
    return `${bld.time} turns`;
  };

  const getTooltip = (b) => {
    const tier = b.tier ? `\n[Tier ${b.tier}]` : '';
    return `${b.name}${tier}\nBase: ${b.time} turns | ${b.land ? b.land + " land" : ""}\n🪵 ${b.wood} 🪨 ${b.stone} 🔗 ${b.iron}`;
  };

  const getBuildCount = (id) => buildingCounts[id] || 0;

  const BUILD_FIELD_MAP = {
    farm: 'farms',
    barracks: 'barracks',
    outpost: 'outposts',
    tower: 'guard_towers',
    school: 'schools',
    armory: 'armories',
    vault: 'vaults',
    smithy: 'smithies',
    market: 'markets',
    mage_tower: 'mage_towers',
    training: 'training',
    shrine: 'shrines',
    castle: 'castles',
    library: 'libraries',
    housing: 'housing',
    war_machine: 'war_machines',
    ballista: 'ballistae',
    ballistae: 'ballistae',
    weapons: 'weapons',
    armor: 'armor',
  };
  const getBaId = (buildingId) => BUILDING_TO_BA_ID[buildingId];
  const getServerKey = (buildingId) => BUILD_FIELD_MAP[buildingId] || buildingId;
  const getBuildFieldValue = (buildingId) => {
    const baId = getBaId(buildingId);
    return parseInt(engineerAllocations[baId] || '0', 10) || 0;
  };
  const setBuildFieldValue = (buildingId, value) => {
    const baId = getBaId(buildingId);
    if (!baId) return;
    setEngineerAllocations((prev) => ({ ...prev, [baId]: Math.max(0, Number(value) || 0) }));
  };
  const getAllocatedEngineers = () =>
    BUILDINGS_DISPLAY_ORDER.reduce((sum, key) => sum + getBuildFieldValue(key), 0);
  const getVisibleBuildFields = () =>
    BUILDINGS_DISPLAY_ORDER.filter((key) => isBuildingRowVisible(key, isVampire));
  const buildDisplay = useMemo(() => {
    const BLUEPRINT_REQUIRED = new Set(['vaults', 'smithies', 'markets', 'mage_towers', 'training', 'castles']);
    const SCAFFOLDING_REQUIRED = new Set(['mage_towers', 'training', 'castles', 'libraries']);
    const bp = blueprintsStored || 0;
    const sc = scaffoldingStored || 0;

    const warnings = {};
    const estimates = {};

    BUILDINGS_DISPLAY_ORDER.forEach((key) => {
      if (!isBuildingRowVisible(key, isVampire)) return;
      const engVal = getBuildFieldValue(key);
      let msg = '';
      if (engVal > 0) {
        if (BLUEPRINT_REQUIRED.has(key) && bp === 0) msg += 'Blueprint needed ';
        if (SCAFFOLDING_REQUIRED.has(key) && sc === 0) msg += 'Scaffolding needed';
      }
      if (msg.trim()) warnings[key] = msg.trim();

      const serverKey = getServerKey(key);
      const cost = BUILDING_EFFORT[serverKey] || BUILDINGS_MAP[key]?.time || 100;
      if (engVal > 0) {
        const turns = Math.ceil(cost / engVal);
        estimates[key] = `~${turns.toLocaleString()} turn${turns === 1 ? '' : 's'}/unit`;
      }
    });

    return { warnings, estimates };
  }, [blueprintsStored, scaffoldingStored, engineerAllocations, isVampire]);
  const buildQueueItems = useMemo(() => {
    const items = [];
    BUILDINGS_DISPLAY_ORDER.forEach((buildingId) => {
      if (!isBuildingRowVisible(buildingId, isVampire)) return;
      const serverKey = getServerKey(buildingId);
      const eng = getBuildFieldValue(buildingId);
      if (eng <= 0) return;
      const cost = BUILDING_EFFORT[serverKey] || BUILDINGS_MAP[buildingId]?.time || 100;
      const prog = Number(buildProgress[serverKey] || 0);
      const progressPct = Math.min(100, Math.floor(((prog % cost) / cost) * 100));
      const turnsRemaining = eng > 0 ? Math.ceil((cost - (prog % cost)) / eng) : '∞';
      items.push({
        key: serverKey,
        buildingId,
        label: BUILDINGS_MAP[buildingId]?.name || serverKey,
        icon: BUILDING_ICONS[serverKey] || '🏗️',
        eng,
        turnsRemaining,
        progressPct,
      });
    });
    return items;
  }, [buildProgress, engineerAllocations, isVampire]);

  useEffect(() => {
    updateSmithyDisplay();
  }, [buildUiTick, hammersStored, scaffoldingStored, blueprintsStored, gold, buildingCounts]);
  const setMaxValue = (buildingId) => {
    const allocated = getAllocatedEngineers();
    const current = getBuildFieldValue(buildingId);
    const available = totalEngineers - allocated + current;
    setBuildFieldValue(buildingId, Math.max(0, available));
    refreshBuildUi();
  };
  const setBuildMax = (buildingId) => {
    setMaxValue(buildingId);
  };
  const distributeBuildEvenly = () => {
    const visibleFields = getVisibleBuildFields();
    const count = visibleFields.length;
    if (count === 0) return;
    const each = Math.floor(totalEngineers / count);
    const rem = totalEngineers - each * count;
    visibleFields.forEach((key, i) => {
      setBuildFieldValue(key, each + (i < rem ? 1 : 0));
    });
    BUILDINGS_DISPLAY_ORDER.filter((key) => !visibleFields.includes(key)).forEach((key) => {
      setBuildFieldValue(key, 0);
    });
    refreshBuildUi();
  };
  const releaseAllEngineers = async () => {
    BUILDINGS_DISPLAY_ORDER.forEach((key) => setBuildFieldValue(key, 0));
    const result = await apiCall('/api/kingdom/build-allocation', { method: 'POST', body: { allocation: {} } });
    if (result.error) return toast(result.error, 'error');
    useEconomyStore.getState().receiveServerSnapshot({
      build_allocation: {},
    });
    refreshBuildUi();
    toast('All engineers released', 'success');
  };
  const saveBuildAllocation = async () => {
    const allocation = {};
    let total = 0;
    BUILDINGS_DISPLAY_ORDER.forEach((key) => {
      const val = getBuildFieldValue(key);
      allocation[getServerKey(key)] = val;
      total += val;
    });
    if (total > totalEngineers) {
      return toast(`Allocated ${fmt(total)} but only have ${fmt(totalEngineers)} engineers`, 'error');
    }
    const result = await apiCall('/api/kingdom/build-allocation', { method: 'POST', body: { allocation } });
    if (result.error) return toast(result.error, 'error');
    useEconomyStore.getState().receiveServerSnapshot({
      build_allocation: allocation,
    });
    refreshBuildUi();
    toast('Engineer allocation saved | builds each turn automatically', 'success');
  };
  const updateSmithyDisplay = () => {
    const bldSmithies = buildingCounts.smithies || 0;
    const hammerCap = bldSmithies * 25;
    const scaffCap = Math.max(10, bldSmithies * 10);
    const scaffPrice = bldSmithies > 0 ? 2500 : 3125;

    const maxH = Math.max(0, Math.min(hammerCap - hammersStored, Math.floor(gold / 25)));
    const maxS = Math.max(0, Math.min(scaffCap - scaffoldingStored, Math.floor(gold / scaffPrice)));

    const note = bldSmithies === 0 ? 'need-smithy' : null;

    setSmithyDisplay({
      hammersStored: hammersStored,
      hammersCap: hammerCap,
      hammersAfford: maxH,
      scaffoldingStored: scaffoldingStored,
      scaffoldingCap: scaffCap,
      scaffoldingAfford: maxS,
      smithyNote: note,
    });
  };
  const setSmithyMax = (type) => {
    const bldSmithies = buildingCounts.smithies || 0;
    if (type === 'hammers') {
      const max = Math.max(0, Math.min(bldSmithies * 25 - hammersStored, Math.floor(gold / 25)));
      setSmithyInputs(prev => ({ ...prev, hammers: max }));
      return;
    }
    const scaffCap = Math.max(10, bldSmithies * 10);
    const scaffPrice = bldSmithies > 0 ? 2500 : 3125;
    const max2 = Math.max(0, Math.min(scaffCap - scaffoldingStored, Math.floor(gold / scaffPrice)));
    setSmithyInputs(prev => ({ ...prev, scaffolding: max2 }));
  };
  const buySmithyTool = async (type) => {
    const amount = type === 'hammers' ? smithyInputs.hammers : smithyInputs.scaffolding;
    if (amount <= 0) return toast('Enter a quantity', 'error');
    const ep = type === 'hammers' ? '/api/kingdom/smithy/buy-hammers' : '/api/kingdom/smithy/buy-scaffolding';
    const result = await apiCall(ep, { method: 'POST', body: { amount } });
    if (result.error) return toast(result.error, 'error');
    useEconomyStore.getState().receiveServerSnapshot({
      hammers_stored: result.hammers_stored,
      scaffolding_stored: result.scaffolding_stored,
      gold: result.gold,
    });
    setSmithyInputs({ hammers: 0, scaffolding: 0 });
    refreshBuildUi();
    toast(`Purchased ${result.bought} ${type} for ${fmt(result.cost)} GC`, 'success');
  };
  const demolishB = async (type) => {
    const key = type === 'wm' ? 'ballistae' : type;
    const amount = demolishAmounts[key] || 1;
    if (amount <= 0) return toast('Enter a quantity', 'error');
    const result = await apiCall('/api/kingdom/demolish', { method: 'POST', body: { building: type, amount } });
    if (result.error) return toast(result.error, 'error');
    if (result.updates && Object.keys(result.updates).length > 0) {
      useEconomyStore.getState().receiveServerSnapshot(result.updates);
    }
    setDemolishAmounts(prev => ({ ...prev, [key]: 1 }));
    refreshBuildUi();
    toast(result.message || `Demolished ${amount} ${type.replace(/_/g, ' ')}`, 'success');
  };

  const renderBuildingRow = (b, icon) => {
    const baId = BUILDING_TO_BA_ID[b.id];
    const isEng = !['wm', 'ballistae', 'weapons', 'armor'].includes(b.id);
    const showDemolish = b.id !== 'wm' && b.id !== 'ballistae' && b.id !== 'ladders' && b.id !== 'weapons' && b.id !== 'armor';
    return (
      <div className="trow" title={getTooltip(b)} key={b.id}>
        <div className="bld-left">
          <div className="bld-main">
            <span className="bld-icon" style={{ background: icon.color }}>{icon.emoji}</span>
            <span className="name">{b.name}</span>
          </div>
          {(buildDisplay.warnings[b.id] || buildDisplay.estimates[b.id]) && (
            <span className="bld-est">
              {buildDisplay.warnings[b.id] && <span className="text-amber">{buildDisplay.warnings[b.id]}</span>}
              {buildDisplay.warnings[b.id] && buildDisplay.estimates[b.id] && ' | '}
              {buildDisplay.estimates[b.id] && <span>{buildDisplay.estimates[b.id]}</span>}
            </span>
          )}
        </div>
        <span className="bld-qty" id={`bld-${b.id}`}>{fmt(getBuildCount(b.id))}</span>
        <div className="bld-controls">
          <div className="bld-eng">
            <span className="bld-control-label">Hire</span>
            <input
              type="number"
              className="input text-right"
              id={baId}
              min="0"
              value={getBuildFieldValue(b.id)}
              onChange={(e) => {
                setBuildFieldValue(b.id, e.target.value);
                refreshBuildUi();
              }}
              placeholder="Qty"
            />
            <button
              className="base-btn px-2 py-1 text-[10px]"
              onClick={() => {
                if (isEng) setMaxValue(b.id);
                else setBuildMax(b.id);
              }}
            >
              Max
            </button>
          </div>
          {showDemolish && (
            <div className="bld-demolish">
              <span className="bld-control-label">Destroy</span>
              <input
                type="number"
                className="input text-right"
                value={demolishAmounts[b.id] ?? ''}
                onChange={(e) => setDemolishAmounts(prev => ({ ...prev, [b.id]: e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                min="1"
                placeholder="1"
              />
              <button className="base-btn px-1.5 py-1 text-[10px] bg-[var(--red)] text-white" onClick={() => demolishB(b.id)}>🗑️</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div id="build" className="panel" data-ui-tick={buildUiTick}>
      <div className="build-sticky-header px-4 pt-4">
        <div className="card rounded-2xl border border-white/10 bg-zinc-950/80 shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <div className="card-title mb-0.5">Construction</div>
              <div className="text-[12px] text-text3">
                🏗️ Engineer Level: <span id="engineer-level" className="text-gold font-semibold">{engineerLevel}</span> |
                XP: <span id="engineer-xp" className="text-text">{fmt(engineerXp)}</span>/<span id="engineer-xp-needed" className="text-text3">{fmt(engineerXpNeeded)}</span>
              </div>
              <div className="text-[12px] text-text3">
                Engineers: <span id="b-engineers-available" className="text-text">{fmt(totalEngineers)}</span> available |
                <span id="b-total-assigned" className="text-gold mx-1">{fmt(allocatedEngineers)}</span> assigned |
                <span id="b-total-unassigned" className={`mx-1 ${remainingEngineers > 0 ? 'text-green' : 'text-red'}`}>{fmt(remainingEngineers)}</span> unassigned
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-text3">
                Resources:
                <span id="b-wood" className="text-text mx-0.5">{fmt(wood)}</span>🪵 |
                <span id="b-stone" className="text-text mx-0.5">{fmt(stone)}</span>🪨 |
                <span id="b-iron" className="text-text mx-0.5">{fmt(iron)}</span>🔗 |
                <span id="b-steel" className="text-text mx-0.5">{fmt(steel)}</span>📏 |
                <span id="b-coal" className="text-text mx-0.5">{fmt(coal)}</span>🌑
              </div>
              <div className="text-[12px] text-text3">
                Land: <span id="b-land-available" className="text-text">{fmt(landAvailable)} / {fmt(land)}</span> available
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <div className="flex gap-1.5">
                <button className="base-btn variant-accent flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-sm bg-[var(--accent1)]" onClick={distributeBuildEvenly}>
                  Distribute
                </button>
                <button className="base-btn variant-red flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-sm bg-[var(--red)]" onClick={releaseAllEngineers}>
                  Release All
                </button>
                <button className="base-btn variant-gold flex-1 rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-sm bg-[var(--gold)] text-black" onClick={saveBuildAllocation}>
                  Allocate
                </button>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setShowAttunements(true)}
                  className="flex-1 rounded-full border border-blue-400 px-4 py-1.5 text-[11px] font-semibold text-blue-400 cursor-pointer hover:bg-blue-400/10 transition-colors"
                >
                  🌌 Attunements
                </button>
                <button
                  onClick={() => setShowBlueprintModal(true)}
                  className="flex-1 rounded-full border border-purple-400 px-4 py-1.5 text-[11px] font-semibold text-purple-400 cursor-pointer hover:bg-purple-400/10 transition-colors"
                >
                  ✨ Fragments
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="build-content-scroll space-y-4 px-4 pb-5">

        <div className="card mt-4 rounded-2xl border border-white/10 bg-zinc-950/80">
          <div className="mb-3 border-b border-white/10 pb-3 pt-3">
            <button
              onClick={() => setShowBuildingRef(!showBuildingRef)}
              className={'w-full rounded-lg border-2 border-[var(--orange)] px-3 py-2 text-left transition-colors hover:bg-white/5' + (showBuildingRef ? ' mb-2' : '')}
            >
              <div className="flex items-center gap-2 text-[13px] font-semibold text-text">
                <span className="text-[10px]">{showBuildingRef ? '▼' : '▶'}</span>
                Building Requirements Reference
              </div>
            </button>
            {showBuildingRef && (
              <div className="grid gap-2 text-[11px] md:grid-cols-2 xl:grid-cols-3">
                {BUILDINGS_DISPLAY_ORDER.map(id => {
                  const b = BUILDINGS_MAP[id];
                  return b ? (
                    <div key={b.id} className="rounded-lg border border-white/10 bg-bg3 p-2.5">
                      <div className="mb-1 font-semibold text-gold">{b.name}</div>
                      <div>{formatReq(b)}{b.land ? ` | 📍 ${b.land} Land` : ''}</div>
                      <div className="mt-1 text-[10px] text-text3">🪵 {b.wood} | 🪨 {b.stone} | 🔗 {b.iron}</div>
                    </div>
                  ) : null;
                })}
              </div>
            )}
          </div>
        </div>

        {showAttunements && (
          <div
            onClick={(e) => { if (e.target === e.currentTarget) setShowAttunements(false); }}
            className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/72 p-4"
          >
            <div className="flex w-full max-h-[80vh] max-w-[680px] flex-col rounded-sm border-2 border-[var(--accent1)] bg-bg2 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between border-b border-white/5 px-4.5 py-3.5">
                <span className="text-[14px] font-bold text-text">🌌 Building Attunements</span>
                <button
                  onClick={() => setShowAttunements(false)}
                  className="p-1 text-[18px] text-text3 cursor-pointer leading-none"
                >✕</button>
              </div>

              <div className="flex-1 overflow-y-auto px-4.5 py-4">
                {loading ? (
                  <div className="p-6 text-center text-text3">Loading attunements...</div>
                ) : (
                  <>
                    {synergyStatus?.activeSynergy && (
                      <div className="mb-5 rounded-sm border border-purple bg-gradient-to-r from-purple/15 to-amber/8 p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[18px]">{synergyStatus.activeSynergy.emoji}</span>
                          <span className="text-[13px] font-bold text-gold">{synergyStatus.activeSynergy.name}</span>
                          <span className="ml-auto rounded-full bg-purple/20 px-1.5 py-0.5 text-[10px] font-semibold text-purple">ACTIVE</span>
                        </div>
                      </div>
                    )}

                    {Object.keys(currentAttunements).length > 0 && (
                      <div className="mb-5">
                        <div className="mb-2 text-[12px] font-semibold text-gold uppercase tracking-wider">Current Attunements</div>
                        <div className="grid gap-2 auto-fill [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
                          {Object.entries(currentAttunements).map(([buildingType, att]) => {
                            if (!att || !att.fragmentName) return null;
                            const key = `${buildingType}:${att.fragmentName}`;
                            const contrib = synergyContributions[key] || null;
                            const tier = contrib?.tier || null;
                            const hint = tier ? pickResonanceHint(key, tier) : null;
                            return (
                              <div key={buildingType} className="rounded-sm border border-white/5 bg-bg3 p-2.5 text-[11px] text-text">
                                <div className="mb-1 flex items-start justify-between gap-1.5">
                                  <div>
                                    <div className="font-semibold text-gold">{BUILDINGS_MAP[buildingType]?.name || buildingType}</div>
                                    <div className="mt-0.5 text-text">{att.fragmentName}</div>
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); removeAttunement(buildingType); }}
                                    title="Remove attunement — fragment can then be applied elsewhere"
                                    className="flex-shrink-0 rounded-sm border border-red px-1.5 py-0.5 text-[9px] text-red cursor-pointer leading-none"
                                  >Remove</button>
                                </div>
                                {att.passive && Object.keys(att.passive).length > 0 && (
                                  <div className="mt-1 text-[10px] text-text3">
                                    {Object.entries(att.passive).map(([k, v]) => v ? (
                                      <div key={k}>{k.replace(/_/g, ' ')}: <span className="text-text">+{v}</span></div>
                                    ) : null)}
                                  </div>
                                )}
                                {att.special?.name && (
                                  <div className="mt-0.5 text-[10px] text-purple">
                                    ✦ {att.special.name}{att.special.desc ? ': ' + att.special.desc : ''}
                                  </div>
                                )}
                                {hint && (
                                  <div className={`mt-1.5 text-[10px] italic ${tier === 'convergence' ? 'text-[var(--gold)]' : tier === 'alignment' ? 'text-[var(--amber)]' : 'text-[var(--text3)]'}`} style={{ opacity: resonanceOpacity(contrib?.count || 1), letterSpacing: '0.2px' }}>
                                    <span className="mr-1">{RESONANCE_GLYPH[tier] || '.'}</span>{hint}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {synergyStatus?.activeSynergy ? (
                      <div>
                        <div className="mb-2.5 text-[12px] font-semibold text-text uppercase tracking-wider">Synergy Details</div>

                        <div className="mb-3 rounded-sm border border-white/5 bg-bg3 p-3">
                          <div className="mb-1 text-[11px] font-bold text-gold">✦ {synergyStatus.activeSynergy.passive?.name}</div>
                          <div className="mb-1.5 text-[11px] text-text3">{synergyStatus.activeSynergy.passive?.desc}</div>
                          {synergyStatus.activeSynergy.passive?.effects && (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(synergyStatus.activeSynergy.passive.effects).map(([k, v]) => (
                                <span key={k} className={`rounded-full px-1.5 py-0.5 text-[10px] ${v >= 0 ? 'bg-green/15 text-green' : 'bg-red/15 text-red'}`}>
                                  {k.replace(/_/g, ' ')}: {v >= 0 ? '+' : ''}{typeof v === 'number' && Math.abs(v) < 2 && k !== 'happiness' ? `${Math.round(v * 100)}%` : v}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mb-3 rounded-sm border border-white/5 bg-bg3 p-3">
                          <div className="mb-1 text-[11px] font-bold text-text2">⚡ {synergyStatus.activeSynergy.active?.name}</div>
                          <div className="mb-1.5 text-[11px] text-text3">{synergyStatus.activeSynergy.active?.desc}</div>
                          {synergyStatus.activeSynergy.active?.cooldown_days && (
                            <div className="text-[10px] text-text3">Cooldown: {synergyStatus.activeSynergy.active.cooldown_days} day{synergyStatus.activeSynergy.active.cooldown_days !== 1 ? 's' : ''}</div>
                          )}
                        </div>

                        {synergyCooldown?.on_cooldown ? (
                          <div className="rounded-sm border border-white/5 bg-bg3 p-3 text-center text-[11px] text-text3">
                            Ability on cooldown — ready in {synergyCooldown.cooldown_remaining_seconds < 3600
                              ? `${Math.ceil(synergyCooldown.cooldown_remaining_seconds / 60)}m`
                              : `${Math.ceil(synergyCooldown.cooldown_remaining_seconds / 3600)}h`}
                          </div>
                        ) : (
                          <button
                            onClick={activateSynergyAbility}
                            disabled={activatingAbility}
                            className={`w-full rounded-sm border-0 p-2.5 text-[12px] font-bold text-text cursor-pointer ${activatingAbility ? 'bg-bg3' : 'bg-purple'}`}
                          >
                            {activatingAbility ? 'Activating...' : `⚡ Activate ${synergyStatus.activeSynergy.active?.name}`}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="mb-2 text-[12px] font-semibold text-text uppercase tracking-wider">Available Fragments</div>
                        {availableAttunements.length > 0 ? (
                          <div className="grid gap-2 auto-fill [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
                            {availableAttunements.map((frag) => (
                              <div key={frag.fragmentName} className="rounded-sm border border-white/5 bg-bg3 p-2.5">
                                <div className="mb-2 text-[12px] font-semibold text-text">{frag.fragmentName}</div>
                                <div className="flex flex-col gap-1">
                                  {frag.buildings.map((bld) => (
                                    <button
                                      key={bld.buildingType}
                                      onClick={(e) => { e.stopPropagation(); applyAttunement(frag.fragmentName, bld.buildingType); }}
                                      title={formatBonusTooltip(bld.bonuses, bld.special)}
                                      className="rounded-sm border border-white/5 bg-accent1 px-2 py-1.5 text-[11px] text-text cursor-pointer text-left"
                                    >
                                      ✨ {BUILDINGS_MAP[bld.buildingType]?.name || bld.buildingType} ({bld.count})
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-sm bg-bg3 p-6 text-center text-[12px] text-text3">
                            No available fragments to attune. Find and study world fragments first!
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="card mt-4">
          <div id="build-rows">
            <div id="build-header">
              <span className="bld-header-name">Building</span>
              <span className="bld-header-qty">Qty</span>
              <span className="bld-controls-spacer" aria-hidden="true" />
            </div>

            {BUILDINGS_MAP['farms'] && renderBuildingRow(BUILDINGS_MAP['farms'], { emoji: '🌾', color: '#4a7c3f' })}
            {BUILDINGS_MAP['granaries'] && renderBuildingRow(BUILDINGS_MAP['granaries'], { emoji: '🛖', color: '#a08453' })}
            {BUILDINGS_MAP['housing'] && renderBuildingRow(BUILDINGS_MAP['housing'], { emoji: '🏘️', color: '#4a5a3a' })}
            {BUILDINGS_MAP['schools'] && renderBuildingRow(BUILDINGS_MAP['schools'], { emoji: '🏫', color: '#3a5a7a' })}
            {BUILDINGS_MAP['libraries'] && renderBuildingRow(BUILDINGS_MAP['libraries'], { emoji: '📖', color: '#2a3a6a' })}
            {BUILDINGS_MAP['mage_towers'] && renderBuildingRow(BUILDINGS_MAP['mage_towers'], { emoji: '⛪', color: '#4a2a7a' })}
            {!isVampire && BUILDINGS_MAP['shrines'] && renderBuildingRow(BUILDINGS_MAP['shrines'], { emoji: '⛩️', color: '#3a6a4a' })}
            {isVampire && BUILDINGS_MAP['mausoleums'] && renderBuildingRow(BUILDINGS_MAP['mausoleums'], { emoji: '⚰️', color: '#333' })}
            {BUILDINGS_MAP['markets'] && renderBuildingRow(BUILDINGS_MAP['markets'], { emoji: '🏪', color: '#1a5a5a' })}
            {BUILDINGS_MAP['taverns'] && renderBuildingRow(BUILDINGS_MAP['taverns'], { emoji: '🍺', color: '#3a2a1a' })}
            {BUILDINGS_MAP['smithies'] && renderBuildingRow(BUILDINGS_MAP['smithies'], { emoji: '⚒️', color: '#7a4a1a' })}
            {BUILDINGS_MAP['vaults'] && renderBuildingRow(BUILDINGS_MAP['vaults'], { emoji: '💰', color: '#3a6a3a' })}
            {BUILDINGS_MAP['armories'] && renderBuildingRow(BUILDINGS_MAP['armories'], { emoji: '🛡️', color: '#6a3a1e' })}
            {BUILDINGS_MAP['barracks'] && renderBuildingRow(BUILDINGS_MAP['barracks'], { emoji: '🏠', color: '#7b3030' })}
            {BUILDINGS_MAP['walls'] && renderBuildingRow(BUILDINGS_MAP['walls'], { emoji: '🧱', color: '#3a3a3a' })}
            {BUILDINGS_MAP['guard_towers'] && renderBuildingRow(BUILDINGS_MAP['guard_towers'], { emoji: '🗼', color: '#2a4a6e' })}
            {BUILDINGS_MAP['outposts'] && renderBuildingRow(BUILDINGS_MAP['outposts'], { emoji: '🏴', color: '#5a4a1e' })}
            {BUILDINGS_MAP['training'] && renderBuildingRow(BUILDINGS_MAP['training'], { emoji: '⚔️', color: '#1a4a2a' })}
            {BUILDINGS_MAP['castles'] && renderBuildingRow(BUILDINGS_MAP['castles'], { emoji: '🏰', color: '#5a1a1a' })}

            <div className="text-[11px] text-text3 uppercase tracking-wider py-3.5 px-0">
              Equipment & War Machines
            </div>

            {BUILDINGS_MAP['wm'] && renderBuildingRow(BUILDINGS_MAP['wm'], { emoji: '🪖', color: '#5a3a1a' })}
            {BUILDINGS_MAP['ballistae'] && renderBuildingRow(BUILDINGS_MAP['ballistae'], { emoji: '🏹', color: '#5a3a1a' })}
            {BUILDINGS_MAP['ladders'] && renderBuildingRow(BUILDINGS_MAP['ladders'], { emoji: '🪜', color: '#3a2a1a' })}
            {BUILDINGS_MAP['weapons'] && renderBuildingRow(BUILDINGS_MAP['weapons'], { emoji: '🗡️', color: '#6a1a1a' })}
            <div className="border-t border-white/5">
              {BUILDINGS_MAP['armor'] && renderBuildingRow(BUILDINGS_MAP['armor'], { emoji: '🔰', color: '#1a3a6a' })}
            </div>

          </div>
        </div>

        <div className="card mt-0">
          <div className="card-title">
            Build queue — engineers work each turn automatically
          </div>
          <div id="build-queue-display">
            {buildQueueItems.length === 0 ? (
              <div className="text-text3 text-[13px] py-2">
                No engineers allocated | assign engineers above and save to start building.
              </div>
            ) : (
              buildQueueItems.map((item) => {
                const turnsStr = typeof item.turnsRemaining === 'number'
                  ? `${item.turnsRemaining.toLocaleString()} turn${item.turnsRemaining === 1 ? '' : 's'}`
                  : '∞';
                return (
                  <div
                    key={item.key}
                    className="flex items-center gap-2.5 border-b border-white/5 py-2 text-[13px] last:border-b-0"
                  >
                    <span className="text-[18px]">{item.icon}</span>
                    <div className="flex-1">
                      <div className="mb-1 flex justify-between">
                        <span className="font-medium text-text">{item.label}</span>
                        <span className="text-[12px] text-text3">
                          {fmt(item.eng)} engineers | ~{turnsStr} per unit
                        </span>
                      </div>
                      <ProgressBar
                        percent={item.progressPct}
                        wrapperClassName="h-[5px] rounded-sm bg-bg4"
                        barClassName="h-[5px] rounded-sm bg-amber transition-[width] duration-300"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card mt-0">
          <div className="card-title mb-1">⚒️ Smithy</div>
          <div className="text-[12px] text-text3 mb-3.5">
            Hammers and scaffolding can be purchased here. Blueprints are crafted in the Library by scribes.
          </div>
          {smithyDisplay.smithyNote === 'need-smithy' && (
            <div className="text-[11px] mb-2.5">
              <div className="text-text3 text-xs mb-2">You need a smithy to buy hammers.</div>
              <div className="text-gold text-xs">Scaffolding is available without a smithy (25% markup).</div>
            </div>
          )}

          <div className="grid auto-fit gap-2.5 mb-4 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
            <div className="rounded-lg border border-white/5 bg-bg3 px-3 py-3 text-center">
              <div className="text-[20px] mb-1">🔨</div>
              <div className="text-[12px] font-semibold text-text">Hammers</div>
              <div className="text-[11px] text-text3 mb-1.5">+5% speed each | degrade</div>
              <div className="text-[18px] font-bold text-gold">{fmt(smithyDisplay.hammersStored)}</div>
              <div className="text-[11px] text-text3">/ {fmt(smithyDisplay.hammersCap)} cap</div>
              {hammerDurability !== null && (
                <div className={'text-[11px] mt-0.5 ' + (hammerDurability > 50 ? 'text-[var(--green)]' : hammerDurability > 20 ? 'text-[var(--amber)]' : 'text-[var(--red)]')}>
                  {hammerDurability}% durability
                </div>
              )}
            </div>
            <div className="rounded-lg border border-white/5 bg-bg3 px-3 py-3 text-center">
              <div className="text-[20px] mb-1">🏗️</div>
              <div className="text-[12px] font-semibold text-text">Scaffolding</div>
              <div className="text-[11px] text-text3 mb-1.5">req &gt;100t | bonus &lt;100t</div>
              <div className="text-[18px] font-bold text-gold">{fmt(smithyDisplay.scaffoldingStored)}</div>
              <div className="text-[11px] text-text3">/ {fmt(smithyDisplay.scaffoldingCap)} cap</div>
            </div>
            <div className="rounded-lg border border-white/5 bg-bg3 px-3 py-3 text-center">
              <div className="text-[20px] mb-1">📐</div>
              <div className="text-[12px] font-semibold text-text">Blueprints</div>
              <div className="text-[11px] text-text3 mb-1.5">req for 100t+ buildings</div>
              <div className="text-[18px] font-bold text-gold">{fmt(blueprintsStored)}</div>
              <div className="text-[11px] text-text3">/ {fmt(bldLibraries * 100)} cap</div>
            </div>
          </div>

          <div className="rounded-lg bg-bg4 px-3 py-3 mb-3">
            <div className="text-[12px] text-text2 font-semibold mb-3.5 text-center">
              Purchase tools <span className="text-text3 font-normal">— instant gold purchase | requires at least 1 smithy</span>
            </div>
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <div className="text-[12px] text-text3 mb-1.5">
                  🔨 Hammers — <strong className="text-gold">25 GC each</strong>
                </div>
                <div className="text-[11px] text-text3 mb-2">
                  Stored: <span className="text-text">{fmt(smithyDisplay.hammersStored)}</span> / {fmt(smithyDisplay.hammersCap)} | Max afford: <span className="text-gold">{fmt(smithyDisplay.hammersAfford)}</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <input type="number" className="input w-40" id="smith-buy-hammers" min="1" value={smithyInputs.hammers} onChange={(e) => setSmithyInputs(prev => ({ ...prev, hammers: parseInt(e.target.value, 10) || 0 }))} placeholder="Qty" />
                  <div className="flex gap-2 w-40">
                    <button className="base-btn variant-gold flex-1 text-[12px] px-3 py-1.5 bg-[var(--gold)] text-black" onClick={() => buySmithyTool('hammers')}>Buy</button>
                    <button className="base-btn flex-1 text-[11px] px-2 py-1.5" onClick={() => setSmithyMax('hammers')}>Max</button>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-[12px] text-text3 mb-1.5">
                  🏗️ Scaffolding — <strong className="text-gold">2,500 GC each</strong>
                </div>
                <div className="text-[11px] text-text3 mb-2">
                  Stored: <span className="text-text">{fmt(smithyDisplay.scaffoldingStored)}</span> / {fmt(smithyDisplay.scaffoldingCap)} | Max afford: <span className="text-gold">{fmt(smithyDisplay.scaffoldingAfford)}</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <input type="number" className="input w-40" id="smith-buy-scaffolding" min="1" value={smithyInputs.scaffolding} onChange={(e) => setSmithyInputs(prev => ({ ...prev, scaffolding: parseInt(e.target.value, 10) || 0 }))} placeholder="Qty" />
                  <div className="flex gap-2 w-40">
                    <button className="base-btn variant-gold flex-1 text-[12px] px-3 py-1.5 bg-[var(--gold)] text-black" onClick={() => buySmithyTool('scaffolding')}>Buy</button>
                    <button className="base-btn flex-1 text-[11px] px-2 py-1.5" onClick={() => setSmithyMax('scaffolding')}>Max</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {showBlueprintModal && (
          <HybridBlueprintModal
            blueprintId={selectedBlueprint}
            fragmentName="Fragment"
            onClose={() => setShowBlueprintModal(false)}
            onSuccess={() => {
              setShowBlueprintModal(false);
              loadAttunements();
            }}
          />
        )}
      </div>
    </div>
  );
};

export default BuildPanel;
