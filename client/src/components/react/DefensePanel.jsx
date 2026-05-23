import React, { useState } from 'react';

const DefensePanel = () => {
  const [activeTab, setActiveTab] = useState('walls');

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
  };

  const refreshDefense = () => {
    if (window.loadDefense) {
      window.loadDefense();
    }
  };

  return (
    <div id="defense" className="panel" style={{ display: 'none' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div>
          <div className="card-title" style={{ marginBottom: '2px' }}>
            🛡️ Defense
            <span
              id="citadel-badge-title"
              style={{
                display: 'none',
                marginLeft: '8px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--gold)',
              }}
            >
              🏰 Citadel
            </span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '2px' }}>
            Rating: <span id="def-rating" style={{ fontWeight: 700 }}>—</span>
          </div>
        </div>
        <button className="base-btn" onClick={refreshDefense}>↻ Refresh</button>
      </div>

      {/* Defense Tiers progress */}
      <div className="card" id="defense-tiers-card" style={{ marginBottom: '12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}
        >
          <div className="card-title" style={{ marginBottom: 0 }}>🛡️ Defense Tiers</div>
          <span id="tier-status" style={{ fontSize: '12px', color: 'var(--text3)' }}>
            Evaluating...
          </span>
        </div>
        <div
          id="tier-desc"
          style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '10px' }}
        >
          Build walls, guard towers, outposts, and castles to reach new tiers and
          gain permanent defense and mitigation bonuses.
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}
        >
          <div
            style={{
              textAlign: 'center',
              background: 'var(--bg3)',
              borderRadius: 'var(--radius)',
              padding: '8px',
            }}
          >
            <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '3px' }}>
              WALLS
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700 }} id="cit-walls">0</div>
            <div style={{ fontSize: '10px', color: 'var(--text3)' }} id="cit-walls-max">
              / 500
            </div>
          </div>
          <div
            style={{
              textAlign: 'center',
              background: 'var(--bg3)',
              borderRadius: 'var(--radius)',
              padding: '8px',
            }}
          >
            <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '3px' }}>
              TOWERS
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700 }} id="cit-towers">0</div>
            <div style={{ fontSize: '10px', color: 'var(--text3)' }} id="cit-towers-max">
              / 50
            </div>
          </div>
          <div
            style={{
              textAlign: 'center',
              background: 'var(--bg3)',
              borderRadius: 'var(--radius)',
              padding: '8px',
            }}
          >
            <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '3px' }}>
              OUTPOSTS
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700 }} id="cit-outposts">0</div>
            <div
              style={{ fontSize: '10px', color: 'var(--text3)' }}
              id="cit-outposts-max"
            >
              / 50
            </div>
          </div>
          <div
            style={{
              textAlign: 'center',
              background: 'var(--bg3)',
              borderRadius: 'var(--radius)',
              padding: '8px',
            }}
          >
            <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '3px' }}>
              CASTLE
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700 }} id="cit-castle">0</div>
            <div style={{ fontSize: '10px', color: 'var(--text3)' }} id="cit-castle-max">
              / 1
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: '12px',
            fontSize: '11px',
            color: 'var(--text3)',
            background: 'var(--bg1)',
            padding: '8px',
            borderRadius: 'var(--radius)',
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '4px',
          }}
        >
          <div
            id="tier-1"
            style={{ display: 'flex', justifyContent: 'space-between', padding: '4px' }}
          >
            <div style={{ color: 'var(--text2)', fontWeight: 600 }}>🛡️ Fortified</div>
            <div>100 Walls · 10 Towers · 10 Outposts</div>
          </div>
          <div
            id="tier-2"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '4px',
              borderTop: '1px solid var(--border)',
            }}
          >
            <div style={{ color: 'var(--text2)', fontWeight: 600 }}>🏰 Keep</div>
            <div>350 Walls · 30 Towers · 30 Outposts</div>
          </div>
          <div
            id="tier-3"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '4px',
              borderTop: '1px solid var(--border)',
            }}
          >
            <div style={{ color: 'var(--text2)', fontWeight: 600 }}>👑 Citadel</div>
            <div>500 Walls · 50 Towers · 50 Outposts · 1 Castle</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          marginBottom: '16px',
          borderBottom: '2px solid var(--border2)',
          paddingBottom: 0,
        }}
      >
        <button
          className={`base-btn admin-tab ${activeTab === 'walls' ? 'active' : ''}`}
          onClick={() => handleTabClick('walls')}
          style={{ borderRadius: '0' }}
        >
          🧱 Walls
        </button>
        <button
          className={`base-btn admin-tab ${activeTab === 'towers' ? 'active' : ''}`}
          onClick={() => handleTabClick('towers')}
          style={{ borderRadius: '0' }}
        >
          🗼 Guard Towers
        </button>
        <button
          className={`base-btn admin-tab ${activeTab === 'outposts' ? 'active' : ''}`}
          onClick={() => handleTabClick('outposts')}
          style={{ borderRadius: '0' }}
        >
          ⛺ Outposts
        </button>
      </div>

      {/* WALLS TAB */}
      <div style={{ display: activeTab === 'walls' ? 'block' : 'none' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '12px',
          }}
        >
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>
              Wall overview
            </div>
            <div className="trow">
              <span className="name">Walls built</span>
              <span className="count" id="def-walls">0</span>
            </div>
            <div className="trow">
              <span className="name">War machines mounted</span>
              <span className="count" id="def-wm-walls" style={{ color: 'var(--gold)' }}>
                0
              </span>
            </div>
            <div className="trow">
              <span className="name">Wall defense power</span>
              <span className="count" id="def-wall-power" style={{ color: 'var(--green)' }}>
                0
              </span>
            </div>
            <div className="trow">
              <span className="name">Race modifier</span>
              <span className="count" id="def-wall-race">×1.00</span>
            </div>
            <div
              className="trow"
              style={{
                borderTop: '1px solid var(--border2)',
                marginTop: '4px',
                paddingTop: '4px',
              }}
            >
              <span className="name" style={{ color: 'var(--amber)', fontSize: '11px' }}>
                No walls = buildings can be damaged by attackers
              </span>
            </div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>
              Wall upgrades
            </div>
            <div id="wall-upgrade-list"></div>
          </div>
        </div>
      </div>

      {/* GUARD TOWERS TAB */}
      <div style={{ display: activeTab === 'towers' ? 'block' : 'none' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '12px',
          }}
        >
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>
              Guard Tower overview
            </div>
            <div className="trow">
              <span className="name">Guard towers</span>
              <span className="count" id="def-gtowers">0</span>
            </div>
            <div className="trow">
              <span className="name">Thieves on watch</span>
              <span
                className="count"
                id="def-thieves-watch"
                style={{ color: 'var(--amber)' }}
              >
                0
              </span>
            </div>
            <div className="trow">
              <span className="name">Max capacity</span>
              <span className="count" id="def-tower-cap">0</span>
            </div>
            <div className="trow">
              <span className="name">Tower defense power</span>
              <span
                className="count"
                id="def-tower-power"
                style={{ color: 'var(--green)' }}
              >
                0
              </span>
            </div>
            <div className="trow">
              <span className="name">Detection modifier</span>
              <span className="count" id="def-tower-race">×1.00</span>
            </div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>
              Tower upgrades
            </div>
            <div id="tower-def-upgrade-list"></div>
          </div>
        </div>
      </div>

      {/* OUTPOSTS TAB */}
      <div style={{ display: activeTab === 'outposts' ? 'block' : 'none' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '12px',
          }}
        >
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>
              Outpost overview
            </div>
            <div className="trow">
              <span className="name">Outposts</span>
              <span className="count" id="def-outposts">0</span>
            </div>
            <div className="trow">
              <span className="name">Rangers on patrol</span>
              <span
                className="count"
                id="def-rangers-patrol"
                style={{ color: 'var(--blue)' }}
              >
                0
              </span>
            </div>
            <div className="trow">
              <span className="name">Max capacity</span>
              <span className="count" id="def-outpost-cap">0</span>
            </div>
            <div className="trow">
              <span className="name">Outpost defense power</span>
              <span
                className="count"
                id="def-outpost-power"
                style={{ color: 'var(--green)' }}
              >
                0
              </span>
            </div>
            <div className="trow">
              <span className="name">Patrol modifier</span>
              <span className="count" id="def-outpost-race">×1.00</span>
            </div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title" style={{ marginBottom: '10px' }}>
              Outpost upgrades
            </div>
            <div id="outpost-upgrade-list"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DefensePanel;
