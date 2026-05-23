import React, { useState, useEffect } from 'react';

const OptionsPanel = () => {
  const [navLayout, setNavLayout] = useState(
    localStorage.getItem('narmir_nav_layout') || 'responsive'
  );

  const updateNavLayout = (e) => {
    const val = e.target.value;
    setNavLayout(val);
    localStorage.setItem('narmir_nav_layout', val);
    if (window.applyNavLayout) {
      window.applyNavLayout();
    }
  };

  const requestVacation = () => {
    if (window.toast) {
      window.toast("Vacation mode is currently disabled by admin", "warn");
    }
  };

  const initiateRebirth = () => {
    if (window.initiateRebirth) {
      window.initiateRebirth();
    }
  };

  const saveDescription = () => {
    if (window.saveDescription) window.saveDescription();
  };

  return (
    <div id="options" className="panel" style={{ display: 'none' }}>
      <div className="two-col">
        <div className="card">
          <div className="card-title">Kingdom bio</div>
          <textarea
            id="kingdom-description-input"
            maxLength="1000"
            placeholder="Tell the world about your kingdom..."
            style={{
              width: '100%',
              height: '80px',
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              color: 'var(--text2)',
              padding: '12px',
              fontSize: '13px',
              outline: 'none',
              transition: 'border-color 0.2s',
              resize: 'vertical',
            }}
          ></textarea>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button className="base-btn variant-accent" style={{ fontSize: '12px', padding: '6px 16px', background: 'var(--accent1)' }} onClick={saveDescription}>
              Save Bio
            </button>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Vacation mode</div>
          <div
            style={{
              fontSize: '13px',
              color: 'var(--text2)',
              marginBottom: '12px',
              lineHeight: 1.7,
            }}
          >
            While on vacation your kingdom cannot be attacked or targeted by
            spells, but you cannot take turns or interact with others. Intended
            for planned real-world absences. This feature is currently restricted
            by the game admin.
          </div>
          <button className="base-btn variant-red" style={{ background: 'var(--red)' }} onClick={requestVacation}>
            Request vacation mode
          </button>
        </div>

        <div className="card">
          <div className="card-title">Interface Settings</div>
          <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '12px', lineHeight: 1.6 }}>
            Customize your application layout and preferred navigation style. Choose between responsive defaults or force a specific nav bar.
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text3)', display: 'block', marginBottom: '6px' }}>
              Navigation Layout Style
            </label>
            <select 
              value={navLayout} 
              onChange={updateNavLayout}
              className="input"
              style={{
                width: '100%',
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text)',
                padding: '8px 10px',
                fontSize: '13px',
                fontWeight: 500,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="responsive">Default (Responsive Sidebar / Bottom Nav)</option>
              <option value="left">Left Navigation Bar Only (Sidebar)</option>
              <option value="bottom">Bottom Navigation Bar Only</option>
            </select>
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{ border: '2px solid var(--accent1)', marginTop: '20px' }}
      >
        <div className="card-title" style={{ color: 'var(--accent1)', fontSize: '18px' }}>
          🌌 Empire Rebirth (Kingdom Prestige)
        </div>
        <div
          style={{
            fontSize: '14px',
            color: 'var(--text2)',
            marginBottom: '16px',
            lineHeight: 1.6,
          }}
        >
          When your kingdom reaches
          <strong style={{ color: 'var(--gold)' }}> Level 50</strong>, you can choose to
          transcend. Your buildings, research, and army will be reset, but you
          will retain your
          <strong style={{ color: 'var(--accent1)' }}> Prestige Level </strong>
          (currently: <span id="cur-prestige-lvl">0</span>). <br /><br />
          <strong style={{ color: 'var(--gold)' }}>Permanent Bonuses:</strong>
          <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
            <li>+10% starting Gold per prestige level</li>
            <li>+5% effectiveness for ALL units per prestige level</li>
            <li>
              Unlock
              <strong style={{ color: 'var(--accent1)' }}>
                {' '}Legendary Unit Archetypes{' '}
              </strong>
              for your race
            </li>
            <li>Economic efficiency multiplier for trade routes</li>
          </ul>
        </div>
        <div
          id="rebirth-req-msg"
          style={{ color: 'var(--red)', fontSize: '12px', marginBottom: '12px' }}
        >
          Require Kingdom Level 50 to Rebirth.
        </div>
        <button
          className="base-btn variant-accent"
          style={{ background: 'var(--accent1)', padding: '12px 24px', fontWeight: 700 }}
          id="rebirth-btn"
          onClick={initiateRebirth}
          disabled
        >
          ASCEND EMPIRE
        </button>
      </div>

      {/* NEWS */}
      <div id="vue-panel-news" style={{ display: 'contents' }}></div>
    </div>
  );
};

export default OptionsPanel;
