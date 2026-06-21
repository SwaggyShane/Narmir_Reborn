import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGameState } from '../../hooks/useGameState';
import { apiCall } from '../../utils/api.js';
import { fmt } from "../../utils/fmt";
import { applyGameMutation } from '../../utils/gameMutations.js';

// Atmospheric synergy hint text. Tiers map to how close a contributing
// synergy is to completion (without revealing counts or formulas).
// Players discover combinations by experimentation; the only signal we
// give is "the fragments are noticing each other more than before."
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

const RESONANCE_GLYPH = { faint: '·', alignment: '✦', convergence: '✶' };
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

// Display order for buildings (matches the order in the building rows below)
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

const BuildPanel = () => {
  const { state } = useGameState();
  const [showBuildingRef, setShowBuildingRef] = useState(false);
  const [showAttunements, setShowAttunements] = useState(false);
  const [availableAttunements, setAvailableAttunements] = useState([]);
  const [currentAttunements, setCurrentAttunements] = useState({});
  const [synergyContributions, setSynergyContributions] = useState({});
  const [synergyStatus, setSynergyStatus] = useState(null);
  const [synergyCooldown, setSynergyCooldown] = useState(null);
  const [activatingAbility, setActivatingAbility] = useState(false);
  const [loading, setLoading] = useState(false);
  const [buildUiTick, setBuildUiTick] = useState(0);
  const isVampire = state?.race === 'vampire';
  const totalEngineers = Number(state?.engineers || 0);
  const engineerLevel = Number(state?.engineer_level || 1);
  const engineerXp = Number(state?.engineer_xp || 0);
  const engineerXpNeeded = Number(state?.engineer_xp_needed || 1000);
  const landAvailable = Math.max(0, Number(state?.land || 0) - Number(state?.built_land || 0));
  const buildAllocation = useMemo(() => {
    if (typeof state?.build_allocation === 'string') {
      try {
        return JSON.parse(state.build_allocation || '{}');
      } catch {
        return {};
      }
    }
    return state?.build_allocation || {};
  }, [state?.build_allocation]);
  const allocatedEngineers = useMemo(
    () => Object.values(BUILD_ALLOCATION_KEYS).reduce((sum, key) => sum + Number(buildAllocation[key] || 0), 0),
    [buildAllocation]
  );
  const remainingEngineers = Math.max(0, totalEngineers - allocatedEngineers);
  const refreshBuildUi = useCallback(() => {
    setBuildUiTick((tick) => tick + 1);
  }, []);

  // Load attunements when panel opens
  React.useEffect(() => {
    if (showAttunements) {
      loadAttunements();
    }
  }, [showAttunements]);

  useEffect(() => {
    Object.entries(BUILD_ALLOCATION_KEYS).forEach(([inputId, key]) => {
      const el = document.getElementById(inputId);
      if (el) el.value = buildAllocation[key] || 0;
    });
    refreshBuildUi();
  }, [buildAllocation, refreshBuildUi]);

  const loadAttunements = async () => {
    try {
      setLoading(true);
      const data = await apiCall('/api/kingdom/available-attunements');
      if (data.error) throw new Error(data.error);
      setAvailableAttunements(data.available || []);

      const statusData = await apiCall('/api/kingdom/attunements');
      if (statusData.error) throw new Error(statusData.error);

      // API returns an array; convert to object keyed by buildingType for O(1) lookup
      const attunementArray = statusData.attunements || [];
      const attunements = {};
      for (const att of attunementArray) {
        if (att.buildingType) attunements[att.buildingType] = att;
      }
      setCurrentAttunements(attunements);

      // Check synergy contributions for each attunement in parallel.
      // Server returns an opaque resonance tier (faint/alignment/convergence)
      // so the synergy formula is never exposed to the client.
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
      if (typeof window !== 'undefined' && typeof toast === 'function') toast(`Failed to load attunements: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const applyAttunement = async (fragmentName, buildingType) => {
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
  };

  const removeAttunement = async (buildingType) => {
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
  };

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

  // Build a human-readable tooltip string from passive bonuses + special
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

  const getBuildCount = (id) => Number(state?.[`bld_${id}`] || 0);

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
  const getBuildFieldValue = (fieldId) => parseInt(document.getElementById(fieldId)?.value || '0', 10) || 0;
  const setBuildFieldValue = (fieldId, value) => {
    const el = document.getElementById(fieldId);
    if (el) el.value = Math.max(0, Number(value) || 0);
  };
  const getAllocatedEngineers = () =>
    BUILDINGS_DISPLAY_ORDER.reduce((sum, key) => sum + getBuildFieldValue(`bld-eng-${key}`), 0);
  const getVisibleBuildFields = () =>
    BUILDINGS_DISPLAY_ORDER.filter((key) => {
      const inputEl = document.getElementById(`bld-eng-${key}`);
      if (!inputEl) return false;
      const trowEl = inputEl.closest('.trow');
      return trowEl && trowEl.style.display !== 'none';
    });
  const loadBuildAllocationInputs = () => {
    const alloc = typeof state?.build_allocation === 'string'
      ? (() => {
        try { return JSON.parse(state.build_allocation || '{}'); } catch { return {}; }
      })()
      : (state?.build_allocation || {});
    BUILDINGS_DISPLAY_ORDER.forEach((key) => {
      const sourceKey = BUILD_FIELD_MAP[key] || key;
      setBuildFieldValue(`bld-eng-${key}`, alloc[sourceKey] || 0);
    });
  };
  const updateBuildDisplay = () => {
    const total = Number(state?.engineers || 0);
    const allocated = getAllocatedEngineers();
    const remaining = Math.max(0, total - allocated);

    const tea = document.getElementById('b-engineers-available');
    if (tea) tea.textContent = fmt(total);

    const ta = document.getElementById('b-total-assigned');
    const tu = document.getElementById('b-total-unassigned');
    if (ta) ta.textContent = fmt(allocated);
    if (tu) {
      tu.textContent = fmt(remaining);
      tu.style.color = allocated > total ? 'var(--red)' : 'var(--green)';
    }

    const bWood = document.getElementById('b-wood');
    if (bWood) bWood.textContent = fmt(state?.wood || 0);
    const bStone = document.getElementById('b-stone');
    if (bStone) bStone.textContent = fmt(state?.stone || 0);
    const bIron = document.getElementById('b-iron');
    if (bIron) bIron.textContent = fmt(state?.iron || 0);
    const bSteel = document.getElementById('b-steel');
    if (bSteel) bSteel.textContent = fmt(state?.steel || 0);
    const bCoal = document.getElementById('b-coal');
    if (bCoal) bCoal.textContent = fmt(state?.coal || 0);

    const bLand = document.getElementById('b-land-available');
    if (bLand) {
      const availLand = (state?.land || 0) - (state?.built_land || 0);
      bLand.textContent = `${fmt(availLand)} / ${fmt(state?.land || 0)}`;
    }

    const shrineRow = document.getElementById('ba-shrine')?.closest('.trow');
    const mausoleumRow = document.getElementById('ba-mausoleum')?.closest('.trow');
    if (shrineRow) shrineRow.style.display = isVampire ? 'none' : '';
    if (mausoleumRow) mausoleumRow.style.display = isVampire ? '' : 'none';

    const BLUEPRINT_REQUIRED = new Set(['vaults', 'smithies', 'markets', 'mage_towers', 'training', 'castles']);
    const SCAFFOLDING_REQUIRED = new Set(['mage_towers', 'training', 'castles', 'libraries']);
    const bp = state?.blueprints_stored || 0;
    const sc = state?.scaffolding_stored || 0;

    BUILDINGS_DISPLAY_ORDER.forEach((key) => {
      const input = document.getElementById(`bld-eng-${key}`);
      if (!input) return;
      const noticeId = `tool-notice-${key}`;
      const existing = document.getElementById(noticeId);
      const engVal = parseInt(input.value || '0', 10) || 0;
      let msg = '';
      if (engVal > 0) {
        if (BLUEPRINT_REQUIRED.has(key) && bp === 0) msg += '?? Blueprint needed ';
        if (SCAFFOLDING_REQUIRED.has(key) && sc === 0) msg += '?? Scaffolding needed';
      }
      if (msg && !existing) {
        const row = input.closest('.trow');
        if (row) {
          const notice = document.createElement('span');
          notice.id = noticeId;
          notice.style.cssText = 'font-size:10px;color:var(--amber);white-space:nowrap;margin-left:4px';
          notice.textContent = msg.trim();
          row.appendChild(notice);
        }
      } else if (existing) {
        if (msg && engVal > 0) {
          existing.textContent = msg.trim();
          existing.style.display = 'inline';
        } else {
          existing.style.display = 'none';
        }
      }
    });

    BUILDINGS_DISPLAY_ORDER.forEach((key) => {
      const input = document.getElementById(`bld-eng-${key}`);
      if (!input) return;
      const estId = `turns-est-${key}`;
      const existing = document.getElementById(estId);
      const engVal = parseInt(input.value || '0', 10) || 0;
      const cost = BUILDINGS_MAP[key]?.time || 100;
      if (engVal > 0) {
        const turns = Math.ceil(cost / engVal);
        let el = existing;
        if (!el) {
          const row = input.closest('.trow');
          if (row) {
            el = document.createElement('span');
            el.id = estId;
            el.style.cssText = 'font-size:10px;color:var(--text3);white-space:nowrap;margin-left:4px';
            row.appendChild(el);
          }
        }
        if (el) {
          el.textContent = `~${turns.toLocaleString()} turn${turns === 1 ? '' : 's'}/unit`;
          el.style.display = 'inline';
        }
      } else if (existing) {
        existing.style.display = 'none';
      }
    });

    return { total, allocated, remaining };
  };
  useEffect(() => {
    loadBuildAllocationInputs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(state?.build_allocation || {})]);

  useEffect(() => {
    updateBuildDisplay();
    updateSmithyDisplay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, buildUiTick]);
  const setMaxValue = (fieldId) => {
    const total = Number(state?.engineers || 0);
    const allocated = getAllocatedEngineers();
    const current = getBuildFieldValue(fieldId);
    const available = total - allocated + current;
    setBuildFieldValue(fieldId, Math.max(0, available));
    refreshBuildUi();
  };
  const setBuildMax = (fieldId, key) => {
    if (key === 'war_machine' || key === 'weapons' || key === 'armor') {
      setMaxValue(fieldId);
      return;
    }
    setMaxValue(fieldId);
  };
  const distributeBuildEvenly = () => {
    const visibleFields = getVisibleBuildFields();
    const count = visibleFields.length;
    if (count === 0) return;
    const total = Number(state?.engineers || 0);
    const each = Math.floor(total / count);
    const rem = total - each * count;
    visibleFields.forEach((key, i) => {
      setBuildFieldValue(`bld-eng-${key}`, each + (i < rem ? 1 : 0));
    });
    BUILDINGS_DISPLAY_ORDER.filter((key) => !visibleFields.includes(key)).forEach((key) => {
      setBuildFieldValue(`bld-eng-${key}`, 0);
    });
    refreshBuildUi();
  };
  const releaseAllEngineers = async () => {
    BUILDINGS_DISPLAY_ORDER.forEach((key) => setBuildFieldValue(`bld-eng-${key}`, 0));
    const result = await apiCall('/api/kingdom/build-allocation', { method: 'POST', body: { allocation: {} } });
    if (result.error) return toast(result.error, 'error');
    applyGameMutation({ build_allocation: {} }, { reason: 'build-allocation' });
    refreshBuildUi();
    if (typeof window !== 'undefined' && typeof toast === 'function') toast('All engineers released', 'success');
  };
  const saveBuildAllocation = async () => {
    const allocation = {};
    let total = 0;
    BUILDINGS_DISPLAY_ORDER.forEach((key) => {
      const val = getBuildFieldValue(`bld-eng-${key}`);
      allocation[BUILD_FIELD_MAP[key] || key] = val;
      total += val;
    });
    if (total > (state?.engineers || 0)) {
      return toast(`Allocated ${fmt(total)} but only have ${fmt(state?.engineers || 0)} engineers`, 'error');
    }
    const result = await apiCall('/api/kingdom/build-allocation', { method: 'POST', body: { allocation } });
    if (result.error) return toast(result.error, 'error');
    applyGameMutation({ build_allocation: allocation }, { reason: 'build-allocation' });
    refreshBuildUi();
    if (typeof window !== 'undefined' && typeof toast === 'function') toast('Engineer allocation saved ? builds each turn automatically', 'success');
  };
  const updateSmithyDisplay = () => {
    const smithies = Number(state?.bld_smithies || 0);
    const hammerCap = smithies * 25;
    const scaffCap = Math.max(10, smithies * 10);
    const hammers = Number(state?.hammers_stored || 0);
    const scaff = Number(state?.scaffolding_stored || 0);
    const gold = Number(state?.gold || 0);
    const scaffPrice = smithies > 0 ? 2500 : 3125;

    const maxH = Math.max(0, Math.min(hammerCap - hammers, Math.floor(gold / 25)));
    const maxS = Math.max(0, Math.min(scaffCap - scaff, Math.floor(gold / scaffPrice)));
    const g = (id) => document.getElementById(id);

    if (g('smith-hammers-stored')) g('smith-hammers-stored').textContent = fmt(hammers);
    if (g('smith-hammers-cap')) g('smith-hammers-cap').textContent = fmt(hammerCap);
    if (g('smith-hammers-afford')) g('smith-hammers-afford').textContent = fmt(maxH);
    if (g('smith-scaffolding-stored')) g('smith-scaffolding-stored').textContent = fmt(scaff);
    if (g('smith-scaffolding-cap')) g('smith-scaffolding-cap').textContent = fmt(scaffCap);
    if (g('smith-scaffolding-afford')) g('smith-scaffolding-afford').textContent = fmt(maxS);

    const note = g('smithy-alloc-note');
    if (note) {
      if (smithies === 0) {
        note.innerHTML = "You need a smithy to buy hammers.<br><span style='color:var(--gold)'>Scaffolding is available without a smithy (25% markup).</span>";
      } else {
        note.textContent = '';
      }
    }
  };
  const setSmithyMax = (type) => {
    const smithies = Number(state?.bld_smithies || 0);
    const gold = Number(state?.gold || 0);
    if (type === 'hammers') {
      const max = Math.max(0, Math.min(smithies * 25 - Number(state?.hammers_stored || 0), Math.floor(gold / 25)));
      const el = document.getElementById('smith-buy-hammers');
      if (el) el.value = max;
      return;
    }
    const scaffCap = Math.max(10, smithies * 10);
    const scaffPrice = smithies > 0 ? 2500 : 3125;
    const max2 = Math.max(0, Math.min(scaffCap - Number(state?.scaffolding_stored || 0), Math.floor(gold / scaffPrice)));
    const el2 = document.getElementById('smith-buy-scaffolding');
    if (el2) el2.value = max2;
  };
  const buySmithyTool = async (type) => {
    const id = type === 'hammers' ? 'smith-buy-hammers' : 'smith-buy-scaffolding';
    const amount = parseInt(document.getElementById(id)?.value, 10) || 0;
    if (amount <= 0) return toast('Enter a quantity', 'error');
    const ep = type === 'hammers' ? '/api/kingdom/smithy/buy-hammers' : '/api/kingdom/smithy/buy-scaffolding';
    const result = await apiCall(ep, { method: 'POST', body: { amount } });
    if (result.error) return toast(result.error, 'error');
    if (result.hammers_stored !== undefined) state.hammers_stored = result.hammers_stored;
    if (result.scaffolding_stored !== undefined) state.scaffolding_stored = result.scaffolding_stored;
    if (result.gold !== undefined) state.gold = result.gold;
    applyGameMutation({
      hammers_stored: result.hammers_stored,
      scaffolding_stored: result.scaffolding_stored,
      gold: result.gold,
    }, { reason: 'smithy-buy' });
    refreshBuildUi();
    updateSmithyDisplay();
    if (typeof window !== 'undefined' && typeof toast === 'function') toast(`Purchased ${result.bought} ${type} for ${fmt(result.cost)} GC`, 'success');
  };
  const demolishB = (type) => { if (window.demolishB) window.demolishB(type); };

  const renderBuildingRow = (b, icon, baId, demoAmountId) => {
    const isEng = !['wm', 'ballistae', 'weapons', 'armor'].includes(b.id);

    return (
      <div className="trow" title={getTooltip(b)} key={b.id}>
        <div className="bld-main">
          <span className="bld-icon" style={{ background: icon.color }}>{icon.emoji}</span>
          <span className="name">{b.name}</span>
        </div>
        <span className="count" id={`bld-${b.id}`}>{fmt(getBuildCount(b.id))}</span>
        {b.id !== 'wm' && b.id !== 'ballistae' && b.id !== 'ladders' && b.id !== 'weapons' && b.id !== 'armor' ? (
          <div className="bld-demolish">
            <input type="number" className="input" id={demoAmountId} defaultValue="1" min="1" style={{ textAlign: 'center' }} />
            <button className="base-btn variant-red" style={{ padding: '4px 6px', fontSize: '10px' }} onClick={() => demolishB(b.id)}>🗑️</button>
          </div>
        ) : <span></span>}

        <div className="bld-eng">
          <input
            type="number"
            className="input"
            id={baId}
            min="0"
            defaultValue="0"
            onChange={refreshBuildUi}
            style={{ textAlign: 'right' }}
            placeholder="Qty"
          />
          <button
            className="base-btn"
            style={{ padding: '4px 8px', fontSize: '10px' }}
            onClick={() => {
              if (isEng) setMaxValue(baId);
              else if (b.id === 'wm') setBuildMax(baId);
              else if (b.id === 'weapons') setBuildMax(baId);
              else if (b.id === 'armor') setBuildMax(baId);
              else setMaxValue(baId);
            }}
          >
            Max
          </button>
        </div>
      </div>
    );
  };

  return (
    <div id="build" className="panel min-h-0 w-full overflow-y-auto" data-ui-tick={buildUiTick}>
      <div className="build-sticky-header px-4 pt-4">
        <div className="card rounded-2xl border border-white/10 bg-zinc-950/80 shadow-[0_12px_32px_rgba(0,0,0,0.35)]" style={{ margin: 0 }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <div className="card-title" style={{ marginBottom: '2px' }}>Construction</div>
              <div className="text-[12px] text-[var(--text3)]">
                🏗️ Engineer Level: <span id="engineer-level" style={{ color: 'var(--gold)', fontWeight: 600 }}>{engineerLevel}</span> ·
                XP: <span id="engineer-xp" style={{ color: 'var(--text)' }}>{fmt(engineerXp)}</span>/<span id="engineer-xp-needed" style={{ color: 'var(--text3)' }}>{fmt(engineerXpNeeded)}</span>
              </div>
              <div className="text-[12px] text-[var(--text3)]">
                Engineers: <span id="b-engineers-available" style={{ color: 'var(--text)' }}>{fmt(totalEngineers)}</span> available ·
                <span id="b-total-assigned" style={{ color: 'var(--gold)', margin: '0 4px' }}>{fmt(allocatedEngineers)}</span> assigned ·
                <span id="b-total-unassigned" style={{ color: allocatedEngineers > totalEngineers ? 'var(--red)' : 'var(--green)', margin: '0 4px' }}>{fmt(remainingEngineers)}</span> unassigned
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--text3)]">
                Resources:
                <span id="b-wood" style={{ color: 'var(--text)', margin: '0 2px' }}>{fmt(state?.wood || 0)}</span>🪵 ·
                <span id="b-stone" style={{ color: 'var(--text)', margin: '0 2px' }}>{fmt(state?.stone || 0)}</span>🪨 ·
                <span id="b-iron" style={{ color: 'var(--text)', margin: '0 2px' }}>{fmt(state?.iron || 0)}</span>🔗 ·
                <span id="b-steel" style={{ color: 'var(--text)', margin: '0 2px' }}>{fmt(state?.steel || 0)}</span>📏 ·
                <span id="b-coal" style={{ color: 'var(--text)', margin: '0 2px' }}>{fmt(state?.coal || 0)}</span>🌑
              </div>
              <div className="text-[12px] text-[var(--text3)]">
                Land: <span id="b-land-available" style={{ color: 'var(--text)' }}>{fmt(landAvailable)} / {fmt(state?.land || 0)}</span> available
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="base-btn variant-accent rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-sm" style={{ background: 'var(--accent1)' }} onClick={distributeBuildEvenly}>
                Distribute Evenly
              </button>
              <button className="base-btn variant-red rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-sm" style={{ background: 'var(--red)' }} onClick={releaseAllEngineers}>
                Release All
              </button>
              <button className="base-btn variant-gold rounded-full px-4 py-1.5 text-[12px] font-semibold shadow-sm" style={{ background: 'var(--gold)', color: '#000' }} onClick={saveBuildAllocation}>
                Save Allocation
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="build-content-scroll space-y-4 px-4 pb-5">

        <div className="card mt-4 rounded-2xl border border-white/10 bg-zinc-950/80">
          <div className="mb-3 border-b border-white/10 pb-3 pt-3">
            <button
              onClick={() => setShowBuildingRef(!showBuildingRef)}
              className={`w-full rounded-lg border-2 border-[var(--orange)] bg-transparent px-3 py-2 text-left transition-colors hover:bg-white/5 ${showBuildingRef ? 'mb-2' : 'mb-0'}`}
            >
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text)]">
                <span style={{ fontSize: '10px' }}>{showBuildingRef ? '▼' : '▶'}</span>
                Building Requirements Reference
              </div>
            </button>
            {showBuildingRef && (
              <div className="grid gap-2 text-[11px] md:grid-cols-2 xl:grid-cols-3">
                {BUILDINGS_DISPLAY_ORDER.map(id => {
                  const b = BUILDINGS_MAP[id];
                  return b ? (
                    <div key={b.id} className="rounded-lg border border-white/10 bg-[var(--bg3)] p-2.5">
                      <div className="mb-1 font-semibold text-[var(--gold)]">{b.name}</div>
                      <div>{formatReq(b)}{b.land ? ` | 📍 ${b.land} Land` : ''}</div>
                      <div className="mt-1 text-[10px] text-[var(--text3)]">🪵 {b.wood} · 🪨 {b.stone} · 🔗 {b.iron}</div>
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
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          >
            <div style={{ background: 'var(--bg2)', border: '2px solid var(--purple)', borderRadius: '6px', width: '100%', maxWidth: '680px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
              {/* Modal header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>🌌 Building Attunements</span>
                <button
                  onClick={() => setShowAttunements(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '18px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
                >✕</button>
              </div>

              {/* Modal body */}
              <div style={{ overflowY: 'auto', padding: '16px 18px', flex: 1 }}>
                {loading ? (
                  <div style={{ padding: '24px', color: 'var(--text3)', textAlign: 'center' }}>Loading attunements...</div>
                ) : (
                  <>
                    {synergyStatus?.activeSynergy && (
                      <div style={{ marginBottom: '20px', padding: '12px 14px', background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(251,191,36,0.08) 100%)', border: '1px solid var(--purple, #a78bfa)', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '18px' }}>{synergyStatus.activeSynergy.emoji}</span>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gold)' }}>{synergyStatus.activeSynergy.name}</span>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--purple, #a78bfa)', background: 'rgba(124,58,237,0.2)', padding: '1px 6px', borderRadius: '10px', marginLeft: 'auto' }}>ACTIVE</span>
                        </div>
                      </div>
                    )}

                    {Object.keys(currentAttunements).length > 0 && (
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gold)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Attunements</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                          {Object.entries(currentAttunements).map(([buildingType, att]) => {
                            if (!att || !att.fragmentName) return null;
                            const key = `${buildingType}:${att.fragmentName}`;
                            const contrib = synergyContributions[key] || null;
                            const tier = contrib?.tier || null;
                            const hint = tier ? pickResonanceHint(key, tier) : null;
                            return (
                              <div key={buildingType} style={{ fontSize: '11px', color: 'var(--text)', padding: '8px 10px', background: 'var(--bg3)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px', marginBottom: '4px' }}>
                                  <div>
                                    <div style={{ color: 'var(--gold)', fontWeight: 600 }}>{BUILDINGS_MAP[buildingType]?.name || buildingType}</div>
                                    <div style={{ color: 'var(--text)', marginTop: '1px' }}>{att.fragmentName}</div>
                                  </div>
                                  <button
                                    onClick={() => removeAttunement(buildingType)}
                                    title="Remove attunement — fragment can then be applied elsewhere"
                                    style={{ flexShrink: 0, padding: '2px 6px', fontSize: '9px', background: 'transparent', border: '1px solid var(--red,#c0392b)', borderRadius: '3px', color: 'var(--red,#c0392b)', cursor: 'pointer', lineHeight: '1.4' }}
                                  >Remove</button>
                                </div>
                                {att.passive && Object.keys(att.passive).length > 0 && (
                                  <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '4px' }}>
                                    {Object.entries(att.passive).map(([k, v]) => v ? (
                                      <div key={k}>{k.replace(/_/g, ' ')}: <span style={{ color: 'var(--text)' }}>+{v}</span></div>
                                    ) : null)}
                                  </div>
                                )}
                                {att.special?.name && (
                                  <div style={{ fontSize: '10px', color: 'var(--purple,#a78bfa)', marginTop: '3px' }}>
                                    ✦ {att.special.name}{att.special.desc ? ': ' + att.special.desc : ''}
                                  </div>
                                )}
                                {hint && (
                                  <div style={{ fontSize: '10px', color: RESONANCE_COLOR[tier] || 'var(--text3)', marginTop: '6px', fontStyle: 'italic', letterSpacing: '0.2px', opacity: resonanceOpacity(contrib?.count || 1) }}>
                                    <span style={{ marginRight: '4px' }}>{RESONANCE_GLYPH[tier] || '·'}</span>{hint}
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
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Synergy Details</div>

                        <div style={{ marginBottom: '12px', padding: '10px 12px', background: 'var(--bg3)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold)', marginBottom: '4px' }}>✦ {synergyStatus.activeSynergy.passive?.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px' }}>{synergyStatus.activeSynergy.passive?.desc}</div>
                          {synergyStatus.activeSynergy.passive?.effects && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {Object.entries(synergyStatus.activeSynergy.passive.effects).map(([k, v]) => (
                                <span key={k} style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '10px', background: v >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: v >= 0 ? 'var(--green,#4ade80)' : 'var(--red,#f87171)' }}>
                                  {k.replace(/_/g, ' ')}: {v >= 0 ? '+' : ''}{typeof v === 'number' && Math.abs(v) < 2 && k !== 'happiness' ? `${Math.round(v * 100)}%` : v}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div style={{ marginBottom: '12px', padding: '10px 12px', background: 'var(--bg3)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text2)', marginBottom: '4px' }}>⚡ {synergyStatus.activeSynergy.active?.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px' }}>{synergyStatus.activeSynergy.active?.desc}</div>
                          {synergyStatus.activeSynergy.active?.cooldown_days && (
                            <div style={{ fontSize: '10px', color: 'var(--text3)' }}>Cooldown: {synergyStatus.activeSynergy.active.cooldown_days} day{synergyStatus.activeSynergy.active.cooldown_days !== 1 ? 's' : ''}</div>
                          )}
                        </div>

                        {synergyCooldown?.on_cooldown ? (
                          <div style={{ padding: '10px 12px', background: 'var(--bg3)', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '11px', color: 'var(--text3)', textAlign: 'center' }}>
                            Ability on cooldown — ready in {synergyCooldown.cooldown_remaining_seconds < 3600
                              ? `${Math.ceil(synergyCooldown.cooldown_remaining_seconds / 60)}m`
                              : `${Math.ceil(synergyCooldown.cooldown_remaining_seconds / 3600)}h`}
                          </div>
                        ) : (
                          <button
                            onClick={activateSynergyAbility}
                            disabled={activatingAbility}
                            style={{ width: '100%', padding: '10px', fontSize: '12px', fontWeight: 700, background: activatingAbility ? 'var(--bg3)' : 'var(--purple)', color: 'var(--text)', border: 'none', borderRadius: '4px', cursor: activatingAbility ? 'default' : 'pointer' }}
                          >
                            {activatingAbility ? 'Activating...' : `⚡ Activate ${synergyStatus.activeSynergy.active?.name}`}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Available Fragments</div>
                        {availableAttunements.length > 0 ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                            {availableAttunements.map((frag) => (
                              <div key={frag.fragmentName} style={{ padding: '10px', background: 'var(--bg3)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>{frag.fragmentName}</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {frag.buildings.map((bld) => (
                                    <button
                                      key={bld.buildingType}
                                      onClick={() => applyAttunement(frag.fragmentName, bld.buildingType)}
                                      title={formatBonusTooltip(bld.bonuses, bld.special)}
                                      style={{ padding: '6px 8px', fontSize: '11px', background: 'var(--accent1)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer', textAlign: 'left' }}
                                    >
                                      ✨ {BUILDINGS_MAP[bld.buildingType]?.name || bld.buildingType} ({bld.count})
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ padding: '24px', color: 'var(--text3)', textAlign: 'center', fontSize: '12px' }}>
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

        <div className="card" style={{ marginTop: '14px' }}>
          <div id="build-rows">
            <div id="build-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Building
                <button
                  onClick={() => setShowAttunements(true)}
                  style={{ padding: '2px 8px', fontSize: '9px', fontWeight: 600, color: '#60a5fa', background: 'transparent', border: '1px solid #60a5fa', borderRadius: '999px', cursor: 'pointer', lineHeight: '1.4', whiteSpace: 'nowrap' }}
                >Attunement</button>
              </span>
              <span style={{ textAlign: 'right' }}>Built</span>
              <span style={{ textAlign: 'center' }}>Demolish</span>
              <span style={{ textAlign: 'center' }}>Engineers</span>
            </div>

            {BUILDINGS_MAP['farms'] && renderBuildingRow(BUILDINGS_MAP['farms'], { emoji: '🌾', color: '#4a7c3f' }, 'ba-farm', 'demolish-amount-farms')}
            {BUILDINGS_MAP['granaries'] && renderBuildingRow(BUILDINGS_MAP['granaries'], { emoji: '🛖', color: '#a08453' }, 'ba-granary', 'demolish-amount-granaries')}
            {BUILDINGS_MAP['housing'] && renderBuildingRow(BUILDINGS_MAP['housing'], { emoji: '🏘️', color: '#4a5a3a' }, 'ba-housing', 'demolish-amount-housing')}
            {BUILDINGS_MAP['schools'] && renderBuildingRow(BUILDINGS_MAP['schools'], { emoji: '🏫', color: '#3a5a7a' }, 'ba-school', 'demolish-amount-schools')}
            {BUILDINGS_MAP['libraries'] && renderBuildingRow(BUILDINGS_MAP['libraries'], { emoji: '📖', color: '#2a3a6a' }, 'ba-library', 'demolish-amount-libraries')}
            {BUILDINGS_MAP['mage_towers'] && renderBuildingRow(BUILDINGS_MAP['mage_towers'], { emoji: '⛪', color: '#4a2a7a' }, 'ba-mage_tower', 'demolish-amount-mage_towers')}
            {BUILDINGS_MAP['shrines'] && renderBuildingRow(BUILDINGS_MAP['shrines'], { emoji: '⛩️', color: '#3a6a4a' }, 'ba-shrine', 'demolish-amount-shrines')}
            {BUILDINGS_MAP['mausoleums'] && renderBuildingRow(BUILDINGS_MAP['mausoleums'], { emoji: '⚰️', color: '#333' }, 'ba-mausoleum', 'demolish-amount-mausoleums')}
            {BUILDINGS_MAP['markets'] && renderBuildingRow(BUILDINGS_MAP['markets'], { emoji: '🏪', color: '#1a5a5a' }, 'ba-market', 'demolish-amount-markets')}
            {BUILDINGS_MAP['taverns'] && renderBuildingRow(BUILDINGS_MAP['taverns'], { emoji: '🍺', color: '#3a2a1a' }, 'ba-tavern', 'demolish-amount-taverns')}
            {BUILDINGS_MAP['smithies'] && renderBuildingRow(BUILDINGS_MAP['smithies'], { emoji: '⚒️', color: '#7a4a1a' }, 'ba-smithy', 'demolish-amount-smithies')}
            {BUILDINGS_MAP['vaults'] && renderBuildingRow(BUILDINGS_MAP['vaults'], { emoji: '💰', color: '#3a6a3a' }, 'ba-vault', 'demolish-amount-vaults')}
            {BUILDINGS_MAP['armories'] && renderBuildingRow(BUILDINGS_MAP['armories'], { emoji: '🛡️', color: '#6a3a1e' }, 'ba-armory', 'demolish-amount-armories')}
            {BUILDINGS_MAP['barracks'] && renderBuildingRow(BUILDINGS_MAP['barracks'], { emoji: '🏠', color: '#7b3030' }, 'ba-barracks', 'demolish-amount-barracks')}
            {BUILDINGS_MAP['walls'] && renderBuildingRow(BUILDINGS_MAP['walls'], { emoji: '🧱', color: '#3a3a3a' }, 'ba-walls', 'demolish-amount-walls')}
            {BUILDINGS_MAP['guard_towers'] && renderBuildingRow(BUILDINGS_MAP['guard_towers'], { emoji: '🗼', color: '#2a4a6e' }, 'ba-tower', 'demolish-amount-guard_towers')}
            {BUILDINGS_MAP['outposts'] && renderBuildingRow(BUILDINGS_MAP['outposts'], { emoji: '🏴', color: '#5a4a1e' }, 'ba-outpost', 'demolish-amount-outposts')}
            {BUILDINGS_MAP['training'] && renderBuildingRow(BUILDINGS_MAP['training'], { emoji: '⚔️', color: '#1a4a2a' }, 'ba-training', 'demolish-amount-training')}
            {BUILDINGS_MAP['castles'] && renderBuildingRow(BUILDINGS_MAP['castles'], { emoji: '🏰', color: '#5a1a1a' }, 'ba-castle', 'demolish-amount-castles')}

            <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '14px 0 6px' }}>
              Equipment & War Machines
            </div>

            {BUILDINGS_MAP['wm'] && renderBuildingRow(BUILDINGS_MAP['wm'], { emoji: '🪖', color: '#5a3a1a' }, 'ba-wm', '')}
            {BUILDINGS_MAP['ballistae'] && renderBuildingRow(BUILDINGS_MAP['ballistae'], { emoji: '🏹', color: '#5a3a1a' }, 'ba-ballistae', '')}
            {BUILDINGS_MAP['ladders'] && renderBuildingRow(BUILDINGS_MAP['ladders'], { emoji: '🪜', color: '#3a2a1a' }, 'ba-ladders', '')}
            {BUILDINGS_MAP['weapons'] && renderBuildingRow(BUILDINGS_MAP['weapons'], { emoji: '🗡️', color: '#6a1a1a' }, 'ba-weapons', '')}
            <div style={{ borderWidth: '1px 1px 0', borderStyle: 'solid', borderColor: 'var(--border)' }}>
              {BUILDINGS_MAP['armor'] && renderBuildingRow(BUILDINGS_MAP['armor'], { emoji: '🔰', color: '#1a3a6a' }, 'ba-armor', '')}
            </div>

          </div>
        </div>

        {/* Build queue */}
        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-title">
            Build queue — engineers work each turn automatically
          </div>
          <div id="build-queue-display">
            <div style={{ color: 'var(--text3)', fontSize: '13px', padding: '8px 0' }}>
              No buildings queued.
            </div>
          </div>
        </div>

        {/* Tools */}
        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-title" style={{ marginBottom: '4px' }}>⚒️ Smithy</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '14px' }}>
            Hammers and scaffolding can be purchased here. Blueprints are crafted in the Library by scribes.
          </div>
          <div id="smithy-alloc-note" style={{ fontSize: '11px', color: 'var(--gold)', marginBottom: '10px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>🔨</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>Hammers</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px' }}>+5% speed each · degrade</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gold)' }} id="tools-hammers">0</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)' }}>/ <span id="hammers-cap">0</span> cap</div>
              <div style={{ fontSize: '11px', color: 'var(--amber)', marginTop: '3px' }} id="hammers-durability"></div>
            </div>
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>🏗️</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>Scaffolding</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px' }}>req &gt;100t · bonus &lt;100t</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gold)' }} id="tools-scaffolding">0</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)' }}>/ <span id="scaffolding-cap">0</span> cap</div>
            </div>
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>📐</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>Blueprints</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '6px' }}>req for 100t+ buildings</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gold)' }} id="tools-blueprints">0</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)' }}>/ <span id="blueprints-cap">0</span> cap</div>
            </div>
          </div>

          <div style={{ background: 'var(--bg4)', borderRadius: 'var(--radius)', padding: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text2)', fontWeight: 600, marginBottom: '14px', textAlign: 'center' }}>
              Purchase tools <span style={{ color: 'var(--text3)', fontWeight: 400 }}>— instant gold purchase · requires at least 1 smithy</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '6px' }}>
                  🔨 Hammers — <strong style={{ color: 'var(--gold)' }}>25 GC each</strong>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '8px' }}>
                  Stored: <span id="smith-hammers-stored" style={{ color: 'var(--text)' }}>0</span> / <span id="smith-hammers-cap">0</span> · Max afford: <span id="smith-hammers-afford" style={{ color: 'var(--gold)' }}>0</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <input type="number" className="input" id="smith-buy-hammers" min="1" defaultValue="0" style={{ width: '160px', textAlign: 'right' }} placeholder="Qty" />
                  <div style={{ display: 'flex', gap: '8px', width: '160px' }}>
                    <button className="base-btn variant-gold" style={{ flex: 1, fontSize: '12px', padding: '6px 12px', background: 'var(--gold)', color: '#000' }} onClick={() => buySmithyTool('hammers')}>Buy</button>
                    <button className="base-btn" style={{ flex: 1, fontSize: '11px', padding: '6px 8px' }} onClick={() => setSmithyMax('hammers')}>Max</button>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '6px' }}>
                  🏗️ Scaffolding — <strong style={{ color: 'var(--gold)' }}>2,500 GC each</strong>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '8px' }}>
                  Stored: <span id="smith-scaffolding-stored" style={{ color: 'var(--text)' }}>0</span> / <span id="smith-scaffolding-cap">0</span> · Max afford: <span id="smith-scaffolding-afford" style={{ color: 'var(--gold)' }}>0</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <input type="number" className="input" id="smith-buy-scaffolding" min="1" defaultValue="0" style={{ width: '160px', textAlign: 'right' }} placeholder="Qty" />
                  <div style={{ display: 'flex', gap: '8px', width: '160px' }}>
                    <button className="base-btn variant-gold" style={{ flex: 1, fontSize: '12px', padding: '6px 12px', background: 'var(--gold)', color: '#000' }} onClick={() => buySmithyTool('scaffolding')}>Buy</button>
                    <button className="base-btn" style={{ flex: 1, fontSize: '11px', padding: '6px 8px' }} onClick={() => setSmithyMax('scaffolding')}>Max</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default BuildPanel;
