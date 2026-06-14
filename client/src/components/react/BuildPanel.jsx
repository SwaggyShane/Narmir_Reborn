import React, { useState } from 'react';
import { apiCall } from '../../utils/api.js';

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

const BuildPanel = () => {
  const [showBuildingRef, setShowBuildingRef] = useState(false);
  const [showAttunements, setShowAttunements] = useState(false);
  const [availableAttunements, setAvailableAttunements] = useState([]);
  const [currentAttunements, setCurrentAttunements] = useState({});
  const [synergyContributions, setSynergyContributions] = useState({});
  const [loading, setLoading] = useState(false);

  // Load attunements when panel opens
  React.useEffect(() => {
    if (showAttunements) {
      loadAttunements();
    }
  }, [showAttunements]);

  const loadAttunements = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/kingdom/available-attunements', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to load attunements');
      const data = await response.json();
      setAvailableAttunements(data.available || []);

      const statusResponse = await fetch('/api/kingdom/attunements', {
        credentials: 'include',
      });
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
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
              const contribResponse = await fetch(
                `/api/kingdom/contributing-synergies?building_type=${encodeURIComponent(building)}&fragment_name=${encodeURIComponent(att.fragmentName)}`,
                { credentials: 'include' }
              );
              if (contribResponse.ok) {
                const contribData = await contribResponse.json();
                if (contribData.contributes) {
                  contributions[`${building}:${att.fragmentName}`] = contribData.resonanceTier || 'faint';
                }
              }
            } catch (err) {
              console.error('[synergies] check failed:', err);
            }
          })
        );
        setSynergyContributions(contributions);
      }
    } catch (err) {
      console.error('[attunements] load failed:', err.message);
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
      // Re-sync building count display — React re-renders reset the spans to "0"
      window.updateBuildDisplay?.();
    } catch (err) {
      console.error('[attunements] remove failed:', err.message);
      alert('Failed to remove attunement');
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

  // Wrapper calls:
  const distributeBuildEvenly = () => { if (window.distributeBuildEvenly) window.distributeBuildEvenly(); };
  const releaseAllEngineers = () => { if (window.releaseAllEngineers) window.releaseAllEngineers(); };
  const saveBuildAllocation = () => { if (window.saveBuildAllocation) window.saveBuildAllocation(); };
  const updateBuildDisplay = () => { if (window.updateBuildDisplay) window.updateBuildDisplay(); };
  const setMaxValue = (id, type) => { if (window.setMaxValue) window.setMaxValue(id, type); };
  const setBuildMax = (id, type) => { if (window.setBuildMax) window.setBuildMax(id, type); };
  const demolishB = (type) => { if (window.demolishB) window.demolishB(type); };
  const buySmithyTool = (type) => { if (window.buySmithyTool) window.buySmithyTool(type); };
  const setSmithyMax = (type) => { if (window.setSmithyMax) window.setSmithyMax(type); };

  const renderBuildingRow = (b, icon, baId, demoAmountId) => {
    const isEng = !['wm', 'ballistae', 'weapons', 'armor'].includes(b.id);

    return (
      <div className="trow" title={getTooltip(b)} key={b.id}>
        <div className="bld-main">
          <span className="bld-icon" style={{ background: icon.color }}>{icon.emoji}</span>
          <span className="name">{b.name}</span>
        </div>
        <span className="count" id={`bld-${b.id}`}>0</span>
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
            onChange={updateBuildDisplay}
            style={{ textAlign: 'right' }}
            placeholder="Qty"
          />
          <button
            className="base-btn"
            style={{ padding: '4px 8px', fontSize: '10px' }}
            onClick={() => {
              if (isEng) setMaxValue(baId, 'avail_units');
              else if (b.id === 'wm') setBuildMax(baId, 'war_machine');
              else if (b.id === 'weapons') setBuildMax(baId, 'weapons');
              else if (b.id === 'armor') setBuildMax(baId, 'armor');
              else setMaxValue(baId, 'avail_units');
            }}
          >
            Max
          </button>
        </div>
      </div>
    );
  };

  return (
    <div id="build" className="panel" style={{ display: 'none' }}>
      <div className="build-sticky-header">
        <div className="card" style={{ margin: 0, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div className="card-title" style={{ marginBottom: '2px' }}>Construction</div>
              <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
                🏗️ Engineer Level: <span id="engineer-level" style={{ color: 'var(--gold)', fontWeight: 600 }}>1</span> ·
                XP: <span id="engineer-xp" style={{ color: 'var(--text)' }}>0</span>/<span id="engineer-xp-needed" style={{ color: 'var(--text3)' }}>1000</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>
                Engineers: <span id="b-engineers-available" style={{ color: 'var(--text)' }}>0</span> available ·
                <span id="b-total-assigned" style={{ color: 'var(--gold)', margin: '0 4px' }}>0</span> assigned ·
                <span id="b-total-unassigned" style={{ color: 'var(--green)', margin: '0 4px' }}>0</span> unassigned
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>
                Resources: 
                <span id="b-wood" style={{ color: 'var(--text)', margin: '0 2px' }}>0</span>🪵 · 
                <span id="b-stone" style={{ color: 'var(--text)', margin: '0 2px' }}>0</span>🪨 · 
                <span id="b-iron" style={{ color: 'var(--text)', margin: '0 2px' }}>0</span>🔗 · 
                <span id="b-steel" style={{ color: 'var(--text)', margin: '0 2px' }}>0</span>📏 · 
                <span id="b-coal" style={{ color: 'var(--text)', margin: '0 2px' }}>0</span>🌑
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>
                Land: <span id="b-land-available" style={{ color: 'var(--text)' }}>0</span> available
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="base-btn variant-accent" style={{ whiteSpace: 'nowrap', padding: '6px 12px', fontSize: '11px', background: 'var(--accent1)' }} onClick={distributeBuildEvenly}>
                Distribute Evenly
              </button>
              <button className="base-btn variant-red" style={{ whiteSpace: 'nowrap', padding: '6px 12px', fontSize: '11px', background: 'var(--red)' }} onClick={releaseAllEngineers}>
                Release All
              </button>
              <button className="base-btn variant-gold" style={{ whiteSpace: 'nowrap', padding: '6px 16px', fontSize: '12px', background: 'var(--gold)', color: '#000' }} onClick={saveBuildAllocation}>
                Save Allocation
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="build-content-scroll">

        <div className="card" style={{ marginTop: '14px' }}>
          <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)', marginBottom: '12px' }}>
            <button
              onClick={() => setShowBuildingRef(!showBuildingRef)}
              style={{ background: 'none', border: '2px solid var(--orange)', borderRadius: '4px', cursor: 'pointer', padding: '8px 12px', width: '100%', textAlign: 'left', boxSizing: 'border-box', marginBottom: showBuildingRef ? '8px' : '0' }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '10px' }}>{showBuildingRef ? '▼' : '▶'}</span>
                Building Requirements Reference
              </div>
            </button>
            {showBuildingRef && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px', fontSize: '11px' }}>
                {BUILDINGS_DISPLAY_ORDER.map(id => {
                  const b = BUILDINGS_MAP[id];
                  return b ? (
                    <div key={b.id} style={{ padding: '8px', background: 'var(--bg3)', borderRadius: '4px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--gold)', marginBottom: '4px' }}>{b.name}</div>
                      <div>{formatReq(b)}{b.land ? ` | 📍 ${b.land} Land` : ''}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '4px' }}>🪵 {b.wood} · 🪨 {b.stone} · 🔗 {b.iron}</div>
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
                    {Object.keys(currentAttunements).length > 0 && (
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gold)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Attunements</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                          {Object.entries(currentAttunements).map(([buildingType, att]) => {
                            if (!att || !att.fragmentName) return null;
                            const key = `${buildingType}:${att.fragmentName}`;
                            const tier = synergyContributions[key] || null;
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
                                  <div style={{ fontSize: '10px', color: RESONANCE_COLOR[tier] || 'var(--text3)', marginTop: '6px', fontStyle: 'italic', letterSpacing: '0.2px', opacity: 0.7 }}>
                                    <span style={{ marginRight: '4px' }}>{RESONANCE_GLYPH[tier] || '·'}</span>{hint}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

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
