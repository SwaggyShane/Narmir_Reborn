import React, { useState, useEffect, useCallback } from 'react';
import { apiCall } from '../../utils/api';

const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

const ExplorationPanel = () => {
  const [inventory, setInventory] = useState({});
  const [inventoryOpen, setInventoryOpen] = useState(false);

  const fetchInventory = useCallback(async () => {
    try {
      const data = await apiCall('/api/kingdom/inventory');
      if (data) {
        setInventory(data);
      }
    } catch (err) {
      console.error('Failed to load inventory:', err);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
    const refreshTimer = setInterval(fetchInventory, REFRESH_INTERVAL_MS);
    window.refreshExplorationPanel = fetchInventory;
    return () => {
      clearInterval(refreshTimer);
      delete window.refreshExplorationPanel;
    };
  }, [fetchInventory]);

  const setMaxValue = (inputId, type) => {
    if (window.setMaxValue) window.setMaxValue(inputId, type);
  };
  const searchAction = (type) => {
    if (window.searchAction) window.searchAction(type);
  };
  const launchExpedition = (type) => {
    if (window.launchExpedition) window.launchExpedition(type);
  };
  const clearExpeditionLog = () => {
    if (window.clearExpeditionLog) window.clearExpeditionLog();
  };

  const inventoryCount = Object.keys(inventory).length;

  return (
    <div id="exploration" className="panel" style={{ display: 'none' }}>
      {/* Active expeditions bar at the VERY TOP */}
      <div className="card" id="exp-counter-card" style={{ marginBottom: '12px', display: 'none' }}>
        <div id="active-expeditions"></div>
      </div>

      {/* Inventory Section */}
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
          <button className="base-btn" onClick={fetchInventory} style={{ fontSize: '11px', padding: '4px 10px' }}>↻ Refresh</button>
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
                      borderLeft: `3px solid ${item.rarity === 'junk' ? 'var(--text3)' : 'var(--accent1)'}`
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      {item.name} <span style={{ color: 'var(--gold)', fontWeight: 700 }}>×{item.count}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', lineHeight: 1.4 }}>
                      {item.desc}
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

      {/* Left col: instant search + three expedition launchers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Instant search */}
        <div className="card">
          <div className="card-title">
            Instant search —{' '}
            <span style={{ color: 'var(--green)', fontWeight: 400, fontSize: '12px' }}>
              costs 1 turn
            </span>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '12px' }}>
            Quick operations that return results immediately.
          </div>
          <div className="trow" style={{ marginBottom: '12px' }}>
            <span className="name">Rangers</span>
            <span style={{ fontSize: '12px', color: 'var(--text3)', marginRight: '8px' }}>
              Available: <span id="exp-rangers-avail">0</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="number"
                className="input"
                id="search-rangers"
                min="0"
                defaultValue="0"
                style={{ textAlign: 'right', width: '90px' }}
                placeholder="Qty"
              />
              <button
                className="base-btn"
                style={{ fontSize: '10px', padding: '3px 6px' }}
                onClick={() => setMaxValue('search-rangers', 'rangers')}
              >
                Max
              </button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button className="base-btn" style={{ padding: '10px', fontSize: '12px', textAlign: 'center', height: 'auto' }} onClick={() => searchAction('land')}>
              <div style={{ fontSize: '18px', marginBottom: '4px' }}>🗺️</div>
              Search for land
              <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '2px' }}>
                Diminishing returns
              </div>
            </button>
            <button className="base-btn" style={{ padding: '10px', fontSize: '12px', textAlign: 'center', height: 'auto' }} onClick={() => searchAction('gold')}>
              <div style={{ fontSize: '18px', marginBottom: '4px' }}>⛏️</div>
              Forage for gold
            </button>
            <button className="base-btn" style={{ padding: '10px', fontSize: '12px', textAlign: 'center', height: 'auto' }} onClick={() => searchAction('food')}>
              <div style={{ fontSize: '18px', marginBottom: '4px' }}>🌾</div>
              Search for food
            </button>
            <button className="base-btn" style={{ padding: '10px', fontSize: '12px', textAlign: 'center', height: 'auto' }} onClick={() => searchAction('targets')}>
              <div style={{ fontSize: '18px', marginBottom: '4px' }}>🔭</div>
              Scout targets
            </button>
          </div>
        </div>

        {/* Scout Expedition */}
        <div className="card" style={{ borderLeft: '3px solid var(--green)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div className="card-title" style={{ margin: 0 }}>🔭 Scout Expedition</div>
            <span
              style={{
                fontSize: '11px',
                background: 'rgba(76, 175, 130, 0.15)',
                color: 'var(--green)',
                padding: '3px 8px',
                borderRadius: '20px',
                fontWeight: 600,
              }}
            >
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
              avail: <span id="scout-rangers-avail">0</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="number" className="input" id="exp-scout-rangers" min="1" defaultValue="0" style={{ textAlign: 'right', width: '80px' }} placeholder="Qty" />
              <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setMaxValue('exp-scout-rangers')}>Max</button>
            </div>
          </div>
          <button className="base-btn variant-green w-full" id="btn-exp-scout" style={{ background: 'var(--green)', color: '#000', width: '100%' }} onClick={() => launchExpedition('scout')}>
            Launch expedition
          </button>
        </div>

        {/* Deep Expedition */}
        <div className="card" style={{ borderLeft: '3px solid var(--accent1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div className="card-title" style={{ margin: 0 }}>🌲 Deep Expedition</div>
            <span
              style={{
                fontSize: '11px',
                background: 'rgba(180, 60, 0, 0.15)',
                color: 'var(--accent1)',
                padding: '3px 8px',
                borderRadius: '20px',
                fontWeight: 600,
              }}
            >
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
              avail: <span id="deep-rangers-avail">0</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="number" className="input" id="exp-deep-rangers" min="1" defaultValue="0" style={{ textAlign: 'right', width: '80px' }} placeholder="Qty" />
              <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setMaxValue('exp-deep-rangers')}>Max</button>
            </div>
          </div>
          <button className="base-btn variant-accent w-full" id="btn-exp-deep" style={{ background: 'var(--accent1)', width: '100%' }} onClick={() => launchExpedition('deep')}>
            Launch expedition
          </button>
        </div>

        {/* Dungeon Raid */}
        <div className="card" style={{ borderLeft: '3px solid var(--red)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div className="card-title" style={{ margin: 0 }}>⚔️ Dungeon Raid</div>
            <span
              style={{
                fontSize: '11px',
                background: 'rgba(224, 92, 92, 0.15)',
                color: 'var(--red)',
                padding: '3px 8px',
                borderRadius: '20px',
                fontWeight: 600,
              }}
            >
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
              avail: <span id="dungeon-rangers-avail">0</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="number" className="input" id="exp-dungeon-rangers" min="1" defaultValue="0" style={{ textAlign: 'right', width: '80px' }} placeholder="Qty" />
              <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setMaxValue('exp-dungeon-rangers')}>Max</button>
            </div>
          </div>
          <div className="trow" style={{ marginBottom: '10px' }}>
            <span className="name" style={{ fontSize: '12px' }}>Fighters</span>
            <span style={{ fontSize: '11px', color: 'var(--text3)', marginRight: '6px' }}>
              avail: <span id="dungeon-fighters-avail">0</span>
            </span>
             <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="number" className="input" id="exp-dungeon-fighters" min="1" defaultValue="0" style={{ textAlign: 'right', width: '80px' }} placeholder="Qty" />
              <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setMaxValue('exp-dungeon-fighters')}>Max</button>
            </div>
          </div>
          <button className="base-btn variant-red w-full" id="btn-exp-dungeon" style={{ background: 'var(--red)', width: '100%' }} onClick={() => launchExpedition('dungeon')}>
            Launch raid
          </button>
        </div>

        {/* Mountain Expedition */}
        <div className="card" style={{ borderLeft: '3px solid #6b9bd1' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div className="card-title" style={{ margin: 0 }}>🏔️ Mountain's Heart</div>
            <span
              style={{
                fontSize: '11px',
                background: 'rgba(107, 155, 209, 0.15)',
                color: '#6b9bd1',
                padding: '3px 8px',
                borderRadius: '20px',
                fontWeight: 600,
              }}
            >
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
            color: 'var(--text2)'
          }}>
            ⚠️ <strong>EXTREME RISK:</strong> Rangers face 1-50% attrition per turn depending on level.
            Level 20+ rangers recommended. Food costs very high for 100-turn expedition.
          </div>
          <div className="trow" style={{ marginBottom: '10px' }}>
            <span className="name" style={{ fontSize: '12px' }}>Rangers</span>
            <span style={{ fontSize: '11px', color: 'var(--text3)', marginRight: '6px' }}>
              avail: <span id="mountain-rangers-avail">0</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input type="number" className="input" id="exp-mountain-rangers" min="1" defaultValue="0" style={{ textAlign: 'right', width: '80px' }} placeholder="Qty" />
              <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setMaxValue('exp-mountain-rangers')}>Max</button>
            </div>
          </div>
          <button className="base-btn variant-blue w-full" id="btn-exp-mountain" style={{ background: '#6b9bd1', width: '100%' }} onClick={() => launchExpedition('mountain')}>
            Accept the risk
          </button>
        </div>
      </div>

      {/* Right col: expedition log */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Expedition log</div>
          <button className="base-btn" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={clearExpeditionLog} title="Clear completed entries from the log">
            🗑️ Clear log
          </button>
        </div>
        <div id="exploration-log" style={{ flex: 1, overflowY: 'auto', maxHeight: '700px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div data-empty style={{ fontSize: '13px', color: 'var(--text3)', padding: '12px 0' }}>
            No expeditions sent yet.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExplorationPanel;
