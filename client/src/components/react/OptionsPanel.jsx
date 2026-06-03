import React, { useState, useEffect } from 'react';

const API = (path, opts = {}) => {
  const token = localStorage.getItem('narmir_token');
  return fetch(`/api/discord${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  }).then(r => r.json());
};

const DiscordSection = () => {
  const [linkStatus, setLinkStatus] = useState(null);
  const [manualUserId, setManualUserId] = useState('');
  const [manualUsername, setManualUsername] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    API('/link-status').then(data => setLinkStatus(data)).catch(() => {});
  }, []);

  const flash = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 5000);
  };

  const handleManualLink = async () => {
    if (!manualUserId.trim() || !manualUsername.trim()) return flash('Both fields are required.', 'err');
    setLoading(true);
    try {
      const data = await API('/link-discord', {
        method: 'POST',
        body: JSON.stringify({ discordUserId: manualUserId.trim(), discordUsername: manualUsername.trim() }),
      });
      if (data.ok) {
        flash(`Linked to @${manualUsername.trim()}!`);
        setLinkStatus({ linked: true, discordUsername: manualUsername.trim() });
        setManualUserId('');
        setManualUsername('');
      } else {
        flash(data.error || 'Failed to link.', 'err');
      }
    } catch (e) {
      flash('Network error.', 'err');
    }
    setLoading(false);
  };

  const handleVerifyCode = async () => {
    if (!verifyCode.trim()) return flash('Enter your verification code.', 'err');
    setLoading(true);
    try {
      const data = await API('/verify-token', {
        method: 'POST',
        body: JSON.stringify({ token: verifyCode.trim().toUpperCase() }),
      });
      if (data.ok) {
        flash(`Linked to @${data.discordUsername}!`);
        setLinkStatus({ linked: true, discordUsername: data.discordUsername });
        setVerifyCode('');
      } else {
        flash(data.error || 'Invalid or expired code.', 'err');
      }
    } catch (e) {
      flash('Network error.', 'err');
    }
    setLoading(false);
  };

  const handleUnlink = async () => {
    setLoading(true);
    try {
      const data = await API('/unlink-discord', { method: 'POST' });
      if (data.ok) {
        flash('Discord account unlinked.');
        setLinkStatus({ linked: false });
      } else {
        flash(data.error || 'Failed to unlink.', 'err');
      }
    } catch (e) {
      flash('Network error.', 'err');
    }
    setLoading(false);
  };

  const inputStyle = {
    width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', color: 'var(--text)', padding: '8px 10px',
    fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { fontSize: '12px', color: 'var(--text3)', display: 'block', marginBottom: '5px' };

  return (
    <div className="card" style={{ marginTop: '20px' }}>
      <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '20px' }}>💬</span> Discord Integration
      </div>

      {/* Status Banner */}
      <div style={{
        padding: '10px 14px', borderRadius: 'var(--radius)', marginBottom: '18px',
        background: linkStatus?.linked ? 'rgba(88,166,255,0.12)' : 'var(--bg3)',
        border: `1px solid ${linkStatus?.linked ? '#58a6ff' : 'var(--border)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
      }}>
        <span style={{ fontSize: '13px', color: linkStatus?.linked ? '#58a6ff' : 'var(--text3)' }}>
          {linkStatus == null
            ? '⏳ Checking link status...'
            : linkStatus.linked
              ? `✅ Connected to Discord as @${linkStatus.discordUsername}`
              : '⚪ Discord account not linked'}
        </span>
        {linkStatus?.linked && (
          <button className="base-btn variant-red" style={{ fontSize: '12px', padding: '5px 12px', background: 'var(--red)' }}
            onClick={handleUnlink} disabled={loading}>
            Unlink
          </button>
        )}
      </div>

      {msg && (
        <div style={{
          padding: '8px 12px', borderRadius: 'var(--radius)', marginBottom: '14px', fontSize: '13px',
          background: msg.type === 'ok' ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)',
          color: msg.type === 'ok' ? 'var(--green)' : 'var(--red)',
          border: `1px solid ${msg.type === 'ok' ? 'var(--green)' : 'var(--red)'}`,
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Method 1 — Verification Code (recommended) */}
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px' }}>
          <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px', color: 'var(--text)' }}>
            🔮 Method 1 — Verification Code <span style={{ fontWeight: 400, color: 'var(--accent1)', fontSize: '11px' }}>RECOMMENDED</span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '12px', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text)' }}>Step 1.</strong> In the Narmir Reborn Discord server, type:<br />
            <code style={{ background: 'var(--bg2)', padding: '2px 6px', borderRadius: '4px', color: 'var(--accent1)' }}>
              !link {(JSON.parse(localStorage.getItem('player') || '{}').username) || 'YourUsername'}
            </code><br /><br />
            <strong style={{ color: 'var(--text)' }}>Step 2.</strong> The bot will DM you a 6-character code. Enter it below.
          </div>
          <label style={labelStyle}>Verification Code</label>
          <input
            style={{ ...inputStyle, letterSpacing: '3px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '10px' }}
            placeholder="ABC123"
            maxLength={6}
            value={verifyCode}
            onChange={e => setVerifyCode(e.target.value.toUpperCase())}
          />
          <button className="base-btn variant-accent" style={{ width: '100%', background: 'var(--accent1)' }}
            onClick={handleVerifyCode} disabled={loading || !verifyCode.trim()}>
            Verify Code
          </button>
        </div>

        {/* Method 2 — Manual */}
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px' }}>
          <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '10px', color: 'var(--text)' }}>
            🔧 Method 2 — Manual Entry
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '12px', lineHeight: 1.6 }}>
            In Discord: <strong style={{ color: 'var(--text)' }}>Settings → Advanced → Enable Developer Mode</strong>, then right-click your username and select <strong style={{ color: 'var(--text)' }}>Copy User ID</strong>.
          </div>
          <label style={labelStyle}>Discord User ID</label>
          <input style={{ ...inputStyle, marginBottom: '8px' }} placeholder="e.g. 123456789012345678"
            value={manualUserId} onChange={e => setManualUserId(e.target.value)} />
          <label style={labelStyle}>Discord Username</label>
          <input style={{ ...inputStyle, marginBottom: '10px' }} placeholder="e.g. swaggyshane"
            value={manualUsername} onChange={e => setManualUsername(e.target.value)} />
          <button className="base-btn" style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)' }}
            onClick={handleManualLink} disabled={loading || !manualUserId.trim() || !manualUsername.trim()}>
            Link Account
          </button>
        </div>
      </div>
    </div>
  );
};

const OptionsPanel = () => {
  const [navLayout, setNavLayout] = useState(
    localStorage.getItem('narmir_nav_layout') || 'responsive'
  );
  const [skipIntro, setSkipIntro] = useState(() => {
    try { return localStorage.getItem('narmir_skip_intro') === '1'; } catch { return false; }
  });

  const updateNavLayout = (e) => {
    const val = e.target.value;
    setNavLayout(val);
    localStorage.setItem('narmir_nav_layout', val);
    if (window.applyNavLayout) {
      window.applyNavLayout();
    }
  };

  const updateSkipIntro = (e) => {
    const val = e.target.checked;
    setSkipIntro(val);
    try {
      if (val) {
        localStorage.setItem('narmir_skip_intro', '1');
      } else {
        localStorage.removeItem('narmir_skip_intro');
        sessionStorage.removeItem('narmir_intro_seen');
      }
    } catch (err) {
      console.warn('Storage access blocked:', err);
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
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={skipIntro}
              onChange={updateSkipIntro}
              style={{ width: '16px', height: '16px', accentColor: 'var(--accent1)', cursor: 'pointer', flexShrink: 0 }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.4 }}>
              Skip intro animation when visiting the home page
            </span>
          </label>
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

      <DiscordSection />

      {/* NEWS */}
      <div id="vue-panel-news" style={{ display: 'contents' }}></div>
    </div>
  );
};

export default OptionsPanel;
