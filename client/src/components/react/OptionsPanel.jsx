import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { apiCall } from '../../utils/api.mjs';
import { toast } from '../../utils/toast.js';
import { applyNavLayout } from '../../utils/applyNavLayout.js';
import { useGameState } from '../../hooks/useGameState';

const API = (path, opts = {}) => {
  const token = localStorage.getItem('narmir_token');
  return fetch(`/api/discord${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  }).then((r) => r.json());
};

const cardShell = 'rounded-2xl border border-[var(--border)] bg-[var(--bg3)] p-4';
const sectionTitle = 'card-title !mb-0';
const labelClass = 'mb-1 block text-[12px] text-[var(--text3)]';
const inputShell =
  'w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-[13px] text-[var(--text)] outline-none transition focus:border-[var(--accent1)]';

const DiscordSection = () => {
  const [linkStatus, setLinkStatus] = useState(null);
  const [manualUserId, setManualUserId] = useState('');
  const [manualUsername, setManualUsername] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    API('/link-status').then((data) => setLinkStatus(data)).catch(() => {});
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

  return (
    <section className={cardShell}>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[20px]">💬</span>
        <div className={sectionTitle}>Discord Integration</div>
      </div>

      <div
        className="mb-4 flex items-center justify-between gap-3 rounded-[var(--radius)] border px-4 py-3"
        style={{
          background: linkStatus?.linked ? 'rgba(88,166,255,0.12)' : 'var(--bg3)',
          borderColor: linkStatus?.linked ? '#58a6ff' : 'var(--border)',
        }}
      >
        <span className="text-[13px]" style={{ color: linkStatus?.linked ? '#58a6ff' : 'var(--text3)' }}>
          {linkStatus == null
            ? '⏳ Checking link status...'
            : linkStatus.linked
              ? `✅ Connected to Discord as @${linkStatus.discordUsername}`
              : '⚪ Discord account not linked'}
        </span>
        {linkStatus?.linked && (
          <button
            className="base-btn variant-red px-3 py-1 text-[12px]"
            style={{ background: 'var(--red)' }}
            onClick={handleUnlink}
            disabled={loading}
          >
            Unlink
          </button>
        )}
      </div>

      {msg && (
        <div
          className="mb-4 rounded-[var(--radius)] border px-3 py-2 text-[13px]"
          style={{
            background: msg.type === 'ok' ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)',
            color: msg.type === 'ok' ? 'var(--green)' : 'var(--red)',
            borderColor: msg.type === 'ok' ? 'var(--green)' : 'var(--red)',
          }}
        >
          {msg.text}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className={cardShell}>
          <div className="mb-3 text-[13px] font-bold">
            🔮 Method 1 - Verification Code <span className="text-[11px] font-normal text-[var(--accent1)]">RECOMMENDED</span>
          </div>
          <div className="mb-3 text-[12px] leading-6 text-[var(--text2)]">
            <strong className="text-[var(--text)]">Step 1.</strong> In the Narmir Reborn Discord server, type:
            <br />
            <code className="mt-1 inline-block rounded bg-[var(--bg2)] px-2 py-1 text-[var(--accent1)]">
              !link {(JSON.parse(localStorage.getItem('player') || '{}').username) || 'YourUsername'}
            </code>
            <br />
            <br />
            <strong className="text-[var(--text)]">Step 2.</strong> The bot will DM you a 6-character code. Enter it below.
          </div>
          <label className={labelClass}>Verification Code</label>
          <input
            className={`${inputShell} mb-3 tracking-[3px] font-bold uppercase`}
            placeholder="ABC123"
            maxLength={6}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.toUpperCase())}
          />
          <button
            className="base-btn variant-accent w-full bg-[var(--accent1)]"
            onClick={handleVerifyCode}
            disabled={loading || !verifyCode.trim()}
          >
            Verify Code
          </button>
        </div>

        <div className={cardShell}>
          <div className="mb-3 text-[13px] font-bold">🔧 Method 2 - Manual Entry</div>
          <div className="mb-3 text-[12px] leading-6 text-[var(--text2)]">
            In Discord: <strong className="text-[var(--text)]">Settings → Advanced → Enable Developer Mode</strong>, then right-click your username and select <strong className="text-[var(--text)]">Copy User ID</strong>.
          </div>
          <label className={labelClass}>Discord User ID</label>
          <input
            className={`${inputShell} mb-2`}
            placeholder="e.g. 123456789012345678"
            value={manualUserId}
            onChange={(e) => setManualUserId(e.target.value)}
          />
          <label className={labelClass}>Discord Username</label>
          <input
            className={`${inputShell} mb-3`}
            placeholder="e.g. swaggyshane"
            value={manualUsername}
            onChange={(e) => setManualUsername(e.target.value)}
          />
          <button
            className="base-btn w-full border border-[var(--border)] bg-[var(--bg2)]"
            onClick={handleManualLink}
            disabled={loading || !manualUserId.trim() || !manualUsername.trim()}
          >
            Link Account
          </button>
        </div>
      </div>
    </section>
  );
};

function PortraitUploadCard() {
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const { state, applyUpdates } = useGameState();
  const hasCustom = !!state?.customPortrait;

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);
    setMsg('');
    const form = new FormData();
    form.append('portrait', file);
    try {
      const res = await fetch('/api/kingdom/portrait', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const data = await res.json();
      if (data.ok) {
        applyUpdates({ customPortrait: data.portraitUrl }, { reason: 'portrait-upload' });
        setMsg('Portrait updated.');
      } else {
        URL.revokeObjectURL(objectUrl);
        setPreview(null);
        setMsg(data.error || 'Upload failed.');
      }
    } catch {
      URL.revokeObjectURL(objectUrl);
      setPreview(null);
      setMsg('Upload failed.');
    }
    setUploading(false);
  };

  const handleRemove = async () => {
    setUploading(true);
    setMsg('');
    try {
      const res = await fetch('/api/kingdom/portrait', { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        applyUpdates({ customPortrait: null }, { reason: 'portrait-remove' });
        setPreview(null);
        setMsg('Portrait removed.');
      } else {
        setMsg(data.error || 'Failed to remove.');
      }
    } catch {
      setMsg('Failed to remove.');
    }
    setUploading(false);
  };

  return (
    <section className={cardShell}>
      <div className="card-title">Custom portrait</div>
      <div className="mb-3 flex items-start gap-3">
        {(preview || hasCustom) && (
          <img
            src={preview || state?.customPortrait}
            alt="Custom portrait"
            className="h-16 w-16 rounded-md border border-[var(--border)] object-cover"
          />
        )}
        <div className="text-[13px] leading-6 text-[var(--text2)]">
          Upload a custom portrait that appears next to your kingdom name. Max 5MB - JPG, PNG, GIF or WebP.
          <br />
          <span className="text-[12px] text-[var(--text3)]">Recommended: 360x480px · 3:4 ratio (portrait orientation)</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="base-btn variant-accent cursor-pointer bg-[var(--accent1)] px-4 py-2 text-[12px]">
          {uploading ? 'Uploading…' : 'Upload portrait'}
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
        {hasCustom && (
          <button className="base-btn variant-red px-4 py-2 text-[12px]" onClick={handleRemove} disabled={uploading}>
            Remove
          </button>
        )}
      </div>
      {msg && <div className="mt-2 text-[12px] text-[var(--text2)]">{msg}</div>}
    </section>
  );
}

const OptionsPanel = () => {
  const { applyUpdates } = useGameState();
  const [navLayout, setNavLayout] = useState(
    localStorage.getItem('narmir_nav_layout') || 'responsive'
  );
  const [skipIntro, setSkipIntro] = useState(() => {
    try { return localStorage.getItem('narmir_skip_intro') === '1'; } catch { return false; }
  });
  const [skipGlitch, setSkipGlitch] = useState(() => {
    try { return localStorage.getItem('narmir_skip_glitch') === '1'; } catch { return false; }
  });
  const [description, setDescription] = useState('');

  const updateNavLayout = (e) => {
    const val = e.target.value;
    setNavLayout(val);
    localStorage.setItem('narmir_nav_layout', val);
    applyNavLayout();
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

  const updateSkipGlitch = (e) => {
    const val = e.target.checked;
    setSkipGlitch(val);
    try {
      if (val) {
        localStorage.setItem('narmir_skip_glitch', '1');
      } else {
        localStorage.removeItem('narmir_skip_glitch');
      }
    } catch (err) {
      console.warn('Storage access blocked:', err);
    }
  };

  const requestVacation = () => {
    toast('Vacation mode is currently disabled by admin', 'warn');
  };

  const initiateRebirth = async () => {
    const result = await apiCall('/api/kingdom/rebirth', { method: 'POST', body: {} });
    if (result.error) return toast(result.error, 'error');
    if (result.prestige_level !== undefined) {
      applyUpdates({ prestige_level: result.prestige_level }, { reason: 'rebirth' });
    }
    toast('The kingdom has transcended. Reloading...', 'success');
    window.location.reload();
  };

  const saveDescription = async () => {
    const result = await apiCall('/api/kingdom/description', {
      method: 'POST',
      body: { description },
    });
    if (result.error) return toast(result.error, 'error');
    applyUpdates({ description }, { reason: 'kingdom-description' });
    toast('Kingdom bio saved', 'success');
  };

  return (
    <div id="options" className="panel">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <section className={cardShell}>
            <div className="card-title">Kingdom bio</div>
            <textarea
              maxLength="1000"
              placeholder="Tell the world about your kingdom..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px] w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg3)] p-3 text-[13px] text-[var(--text2)] outline-none transition focus:border-[var(--accent1)]"
            />
            <div className="mt-3 flex justify-end">
              <button className="base-btn variant-accent bg-[var(--accent1)] px-4 py-2 text-[12px]" onClick={saveDescription}>
                Save Bio
              </button>
            </div>
          </section>

          <PortraitUploadCard />

          <section className={cardShell}>
            <div className="card-title">Vacation mode</div>
            <div className="mb-4 text-[13px] leading-7 text-[var(--text2)]">
              While on vacation your kingdom cannot be attacked or targeted by spells, but you cannot take turns or interact with others. Intended for planned real-world absences. This feature is currently restricted by the game admin.
            </div>
            <button className="base-btn variant-red bg-[var(--red)] px-4 py-2 text-[12px]" onClick={requestVacation}>
              Request vacation mode
            </button>
          </section>

          <section className={cardShell}>
            <div className="card-title">Interface Settings</div>
            <div className="mb-4 text-[13px] leading-6 text-[var(--text2)]">
              Customize your application layout and preferred navigation style. Choose between responsive defaults or force a specific nav bar.
            </div>
            <div className="mb-3">
              <label className={labelClass}>Navigation Layout Style</label>
              <select value={navLayout} onChange={updateNavLayout} className={inputShell}>
                <option value="responsive">Default (Responsive Sidebar / Bottom Nav)</option>
                <option value="left">Left Navigation Bar Only (Sidebar)</option>
                <option value="bottom">Bottom Navigation Bar Only</option>
              </select>
            </div>
            <label className="mb-3 flex items-center gap-3">
              <input type="checkbox" checked={skipIntro} onChange={updateSkipIntro} className="h-4 w-4 accent-[var(--accent1)]" />
              <span className="text-[13px] leading-6 text-[var(--text2)]">Skip intro animation when visiting the home page</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={skipGlitch} onChange={updateSkipGlitch} className="h-4 w-4 accent-[var(--accent1)]" />
              <span className="text-[13px] leading-6 text-[var(--text2)]">Skip glitch effect (jump to modern splash on click)</span>
            </label>
          </section>
        </div>

        <section className="rounded-2xl border-2 border-[var(--accent1)] bg-[var(--bg2)] p-5">
          <div className="card-title !mb-3 text-[18px] text-[var(--accent1)]">🌌 Empire Rebirth (Kingdom Prestige)</div>
          <div className="mb-4 text-[14px] leading-7 text-[var(--text2)]">
            When your kingdom reaches <strong className="text-[var(--gold)]">Level 50</strong>, you can choose to transcend. Your buildings, research, and army will be reset, but you will retain your <strong className="text-[var(--accent1)]">Prestige Level</strong> (currently: <span id="cur-prestige-lvl">0</span>).
            <br />
            <br />
            <strong className="text-[var(--gold)]">Permanent Bonuses:</strong>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>+10% starting Gold per prestige level</li>
              <li>+5% effectiveness for ALL units per prestige level</li>
              <li>
                Unlock <strong className="text-[var(--accent1)]">Legendary Unit Archetypes</strong> for your race
              </li>
              <li>Economic efficiency multiplier for trade routes</li>
            </ul>
          </div>
          <div id="rebirth-req-msg" className="mb-3 text-[12px] text-[var(--red)]">
            Require Kingdom Level 50 to Rebirth.
          </div>
          <button className="base-btn variant-accent bg-[var(--accent1)] px-6 py-3 font-bold" id="rebirth-btn" onClick={initiateRebirth} disabled>
            ASCEND EMPIRE
          </button>
        </section>

        <DiscordSection />

        <div id="vue-panel-news" className="contents" />
      </div>
    </div>
  );
};

export default OptionsPanel;
