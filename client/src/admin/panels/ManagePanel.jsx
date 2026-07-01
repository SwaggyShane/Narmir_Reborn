import React, { useState, useEffect, useCallback } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children, danger = false }) {
  return (
    <div style={{
      marginBottom: 28, padding: '16px 18px',
      background: danger ? 'rgba(220,50,50,0.06)' : 'var(--bg3, #1a1a1a)',
      border: `1px solid ${danger ? 'var(--red, #e55)' : 'var(--border2)'}`,
      borderRadius: 8,
    }}>
      <h3 style={{
        margin: '0 0 14px', fontSize: 13, textTransform: 'uppercase',
        letterSpacing: 1, fontFamily: 'Cinzel, serif',
        color: danger ? 'var(--red, #e55)' : 'var(--gold)',
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label className="block text-[11px] text-[var(--text3)] uppercase mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

const INPUT_STYLE = {
  width: '100%', padding: '7px 9px', background: 'var(--bg4)',
  border: '1px solid var(--border2)', borderRadius: 4,
  color: 'var(--text)', fontSize: 13, outline: 'none',
  fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
};

const BTN = {
  padding: '7px 14px', background: 'var(--bg4)',
  border: '1px solid var(--border2)', borderRadius: 4,
  color: 'var(--text2)', fontSize: 13, cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
};

const BTN_DANGER = {
  ...BTN,
  color: 'var(--red, #e55)',
  borderColor: 'var(--red, #e55)',
};

const BTN_PRIMARY = {
  ...BTN,
  color: 'var(--gold)',
  borderColor: 'var(--gold)',
};

// ── Main component ────────────────────────────────────────────────────────────

export default function ManagePanel({ adminFetch, onToast }) {
  // Chat mods / bans
  const [chatMods, setChatMods]   = useState([]);
  const [chatBans, setChatBans]   = useState([]);
  const [modLoading, setModLoading] = useState(true);

  // Hiatus
  const [hiatus, setHiatus]               = useState(false);
  const [hiatusLoading, setHiatusLoading] = useState(false);

  // Announce
  const [announceMsg, setAnnounceMsg]   = useState('');
  const [announcing, setAnnouncing]     = useState(false);

  // Chat mod promote input
  const [chatModInput, setChatModInput] = useState('');
  const [chatModBusy, setChatModBusy]   = useState(false);

  // Promote admin input
  const [promoteInput, setPromoteInput] = useState('');
  const [promoting, setPromoting]       = useState(false);

  // Test kingdoms form
  const [tkForm, setTkForm] = useState({
    usernamePrefix: 'test', kingdomPrefix: 'Test',
    password: '', resetExisting: true,
  });
  const [tkBusy, setTkBusy]       = useState(false);
  const [tkResults, setTkResults] = useState(null);

  // Confirm dialog
  const [confirm, setConfirm] = useState(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadMods = useCallback(async () => {
    setModLoading(true);
    try {
      const [mods, bans, hiatus] = await Promise.all([
        adminFetch('/api/admin/chat-mods'),
        adminFetch('/api/admin/chat-bans'),
        adminFetch('/api/admin/ai-hiatus'),
      ]);
      if (mods?.error) {
        onToast('Failed to load chat mods: ' + mods.error, 'error');
      } else if (Array.isArray(mods)) {
        setChatMods(mods);
      }
      if (bans?.error) {
        onToast('Failed to load chat bans: ' + bans.error, 'error');
      } else if (Array.isArray(bans)) {
        setChatBans(bans);
      }
      if (hiatus?.error) {
        onToast('Failed to load AI hiatus: ' + hiatus.error, 'error');
      } else if (hiatus) {
        setHiatus(!!hiatus.hiatus);
      }
    } catch (err) {
      onToast('Load error: ' + (err.message || 'Unknown'), 'error');
    } finally {
      setModLoading(false);
    }
  }, [adminFetch, onToast]);

  useEffect(() => { loadMods(); }, [loadMods]);

  // ── Announce ──────────────────────────────────────────────────────────────

  async function handleAnnounce() {
    if (!announceMsg.trim()) { onToast('Message cannot be empty', 'error'); return; }
    setAnnouncing(true);
    try {
      const data = await adminFetch('/api/admin/announce', { method: 'POST', body: { message: announceMsg.trim() } });
      if (data?.error) { onToast('Announce failed: ' + data.error, 'error'); return; }
      onToast('Announcement sent', 'success');
      setAnnounceMsg('');
    } catch (err) {
      onToast('Announce failed: ' + (err.message || 'Unknown'), 'error');
    } finally {
      setAnnouncing(false);
    }
  }

  // ── AI Hiatus ─────────────────────────────────────────────────────────────

  async function handleHiatusToggle() {
    setHiatusLoading(true);
    try {
      const data = await adminFetch('/api/admin/ai-hiatus', { method: 'POST', body: { hiatus: !hiatus } });
      if (data?.error) { onToast('Hiatus toggle failed: ' + data.error, 'error'); return; }
      setHiatus(!hiatus);
      onToast(`AI hiatus ${!hiatus ? 'enabled' : 'disabled'}`, 'success');
    } catch (err) {
      onToast('Hiatus toggle failed: ' + (err.message || 'Unknown'), 'error');
    } finally {
      setHiatusLoading(false);
    }
  }

  // ── Chat mod actions ──────────────────────────────────────────────────────

  async function handleChatMod(username, action) {
    setChatModBusy(true);
    try {
      const data = await adminFetch('/api/admin/chat-mod', { method: 'POST', body: { username, action } });
      if (data?.error) { onToast(`Chat mod ${action} failed: ` + data.error, 'error'); return; }
      onToast(`${action === 'promote' ? 'Promoted' : 'Demoted'} ${username} as chat mod`, 'success');
      setChatModInput('');
      loadMods();
    } catch (err) {
      onToast('Chat mod action failed: ' + (err.message || 'Unknown'), 'error');
    } finally {
      setChatModBusy(false);
    }
  }

  async function handleChatUnban(username) {
    try {
      const data = await adminFetch('/api/admin/chat-unban', { method: 'POST', body: { username } });
      if (data?.error) { onToast('Unban failed: ' + data.error, 'error'); return; }
      onToast(`Chat-unbanned ${username}`, 'success');
      setChatBans(prev => prev.filter(b => b.username !== username));
    } catch (err) {
      onToast('Unban failed: ' + (err.message || 'Unknown'), 'error');
    }
  }

  // ── Promote admin ─────────────────────────────────────────────────────────

  function handlePromoteAdmin() {
    if (!promoteInput.trim()) { onToast('Username required', 'error'); return; }
    setConfirm({
      title: 'Promote to Admin',
      message: `Give full admin access to "${promoteInput.trim()}"? This cannot be undone without direct DB access.`,
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        setPromoting(true);
        try {
          const data = await adminFetch('/api/admin/promote', { method: 'POST', body: { username: promoteInput.trim() } });
          if (data?.error) { onToast('Promote failed: ' + data.error, 'error'); return; }
          onToast(`"${promoteInput.trim()}" promoted to admin`, 'success');
          setPromoteInput('');
        } catch (err) {
          onToast('Promote failed: ' + (err.message || 'Unknown'), 'error');
        } finally {
          setPromoting(false);
        }
      },
    });
  }

  // ── Test kingdoms ─────────────────────────────────────────────────────────

  async function handleTestKingdoms() {
    if (!tkForm.usernamePrefix.trim()) { onToast('Username prefix is required', 'error'); return; }
    if (!tkForm.kingdomPrefix.trim()) { onToast('Kingdom prefix is required', 'error'); return; }
    if (tkForm.password.length < 8) { onToast('Password must be at least 8 characters', 'error'); return; }
    setTkBusy(true);
    setTkResults(null);
    try {
      const data = await adminFetch('/api/admin/test-kingdoms/setup', { method: 'POST', body: tkForm });
      if (data?.error) { onToast('Setup failed: ' + data.error, 'error'); return; }
      setTkResults(data.results);
      onToast(`Test kingdoms: ${data.count} set up`, 'success');
    } catch (err) {
      onToast('Setup failed: ' + (err.message || 'Unknown'), 'error');
    } finally {
      setTkBusy(false);
    }
  }

  // ── Bulk / destructive actions ────────────────────────────────────────────

  function confirmBulk(title, message, endpoint) {
    setConfirm({
      title, message, danger: true,
      onConfirm: async () => {
        setConfirm(null);
        try {
          const data = await adminFetch(endpoint, { method: 'POST' });
          if (data?.error) { onToast(title + ' failed: ' + data.error, 'error'); return; }
          onToast(title + ' complete', 'success');
        } catch (err) {
          onToast(title + ' failed: ' + (err.message || 'Unknown'), 'error');
        }
      },
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Announce */}
      <Section title="Global Announcement">
        <Field label="Message (global chat + News blurb for every kingdom)">
          <textarea
            value={announceMsg}
            onChange={e => setAnnounceMsg(e.target.value)}
            rows={3}
            style={{ ...INPUT_STYLE, resize: 'vertical' }}
            placeholder="Enter announcement..."
          />
        </Field>
        <button onClick={handleAnnounce} disabled={announcing || !announceMsg.trim()} style={BTN_PRIMARY}>
          {announcing ? 'Sending...' : 'Send Announcement'}
        </button>
      </Section>

      {/* AI Hiatus */}
      <Section title="AI Hiatus">
        <p className="m-0 mb-3 text-[13px] text-[var(--text3)]">
          Pauses AI turn processing globally. Does not affect hiatus state after server restart unless persisted.
        </p>
        <button
          onClick={handleHiatusToggle}
          disabled={hiatusLoading || modLoading}
          style={{ ...BTN, color: hiatus ? 'var(--amber, #f90)' : 'var(--text2)', borderColor: hiatus ? 'var(--amber, #f90)' : 'var(--border2)' }}
        >
          AI Hiatus: {hiatusLoading ? '...' : hiatus ? 'ON' : 'OFF'}
        </button>
      </Section>

      {/* Chat moderation */}
      <Section title="Chat Moderation">
        {/* Current mods */}
        <div className="mb-4">
          <div className="text-xs text-[var(--text3)] mb-1.5">Current chat mods ({chatMods.length})</div>
          {modLoading ? (
            <span className="text-xs text-[var(--text3)]">Loading...</span>
          ) : chatMods.length === 0 ? (
            <span className="text-xs text-[var(--text3)]">None</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {chatMods.map(m => (
                <div key={m.username} className="flex items-center gap-1.5 bg-[var(--bg4)] border border-[var(--border2)] rounded py-1 px-2">
                  <span className="text-[13px] text-[var(--text2)]">{m.username}</span>
                  <button
                    onClick={() => handleChatMod(m.username, 'demote')}
                    disabled={chatModBusy}
                    style={{ ...BTN_DANGER, padding: '2px 7px', fontSize: 11 }}
                  >
                    Demote
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Promote input */}
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <Field label="Promote username to chat mod">
              <input
                type="text"
                value={chatModInput}
                onChange={e => setChatModInput(e.target.value)}
                style={INPUT_STYLE}
                placeholder="username"
              />
            </Field>
          </div>
          <button
            onClick={() => handleChatMod(chatModInput.trim(), 'promote')}
            disabled={chatModBusy || !chatModInput.trim()}
            style={{ ...BTN_PRIMARY, marginBottom: 12 }}
          >
            Promote Mod
          </button>
        </div>

        {/* Chat bans */}
        <div className="mt-1">
          <div className="text-xs text-[var(--text3)] mb-1.5">Chat-banned players ({chatBans.length})</div>
          {modLoading ? (
            <span className="text-xs text-[var(--text3)]">Loading...</span>
          ) : chatBans.length === 0 ? (
            <span className="text-xs text-[var(--text3)]">None</span>
          ) : (
            <div className="flex flex-col gap-1">
              {chatBans.map(b => (
                <div key={b.username} className="flex items-center gap-2 bg-[var(--bg4)] border border-[var(--border2)] rounded py-[5px] px-2">
                  <span className="text-[13px] text-[var(--text2)] flex-1">{b.username}</span>
                  {b.chat_ban_reason && (
                    <span className="text-[11px] text-[var(--text3)] flex-[2]">{b.chat_ban_reason}</span>
                  )}
                  <button
                    onClick={() => handleChatUnban(b.username)}
                    style={{ ...BTN_PRIMARY, padding: '3px 9px', fontSize: 11 }}
                  >
                    Unban
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* Promote admin */}
      <Section title="Promote to Admin">
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <Field label="Grant full admin access to player">
              <input
                type="text"
                value={promoteInput}
                onChange={e => setPromoteInput(e.target.value)}
                style={INPUT_STYLE}
                placeholder="username"
              />
            </Field>
          </div>
          <button
            onClick={handlePromoteAdmin}
            disabled={promoting || !promoteInput.trim()}
            style={{ ...BTN_DANGER, marginBottom: 12 }}
          >
            {promoting ? 'Promoting...' : 'Promote to Admin'}
          </button>
        </div>
      </Section>

      {/* Test kingdoms */}
      <Section title="Test Kingdoms Setup">
        <p className="m-0 mb-3 text-[13px] text-[var(--text3)]">
          Provisions one kingdom per race with the given username/kingdom prefix. Safe to re-run — existing kingdoms are updated (or skipped if resetExisting is off).
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
          <Field label="Username prefix">
            <input
              type="text"
              value={tkForm.usernamePrefix}
              onChange={e => setTkForm(f => ({ ...f, usernamePrefix: e.target.value }))}
              style={INPUT_STYLE}
              placeholder="test"
            />
          </Field>
          <Field label="Kingdom name prefix">
            <input
              type="text"
              value={tkForm.kingdomPrefix}
              onChange={e => setTkForm(f => ({ ...f, kingdomPrefix: e.target.value }))}
              style={INPUT_STYLE}
              placeholder="Test"
            />
          </Field>
          <Field label="Password (min 8 chars)">
            <input
              type="password"
              value={tkForm.password}
              onChange={e => setTkForm(f => ({ ...f, password: e.target.value }))}
              style={INPUT_STYLE}
              placeholder="••••••••"
            />
          </Field>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-1.5 text-[13px] text-[var(--text2)] cursor-pointer">
            <input
              type="checkbox"
              checked={tkForm.resetExisting}
              onChange={e => setTkForm(f => ({ ...f, resetExisting: e.target.checked }))}
            />
            Reset existing kingdoms
          </label>
          <button onClick={handleTestKingdoms} disabled={tkBusy || !tkForm.usernamePrefix.trim() || !tkForm.kingdomPrefix.trim() || tkForm.password.length < 8} style={BTN_PRIMARY}>
            {tkBusy ? 'Setting up...' : 'Setup Test Kingdoms'}
          </button>
        </div>

        {/* Results */}
        {tkResults && (
          <div className="mt-3.5 overflow-x-auto">
            <table className="border-collapse text-xs text-[var(--text2)] w-full">
              <thead>
                <tr>
                  {['Race', 'Username', 'Kingdom', 'Status'].map(h => (
                    <th key={h} className="py-[5px] px-2 text-left border-b border-[var(--border2)] text-[var(--text3)] font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tkResults.map(r => (
                  <tr key={r.race}>
                    <td style={TD}>{r.race}</td>
                    <td style={TD}>{r.username}</td>
                    <td style={TD}>{r.kingdomName}</td>
                    <td style={{ ...TD, color: r.action === 'created' ? 'var(--green, #5c5)' : 'var(--text3)' }}>
                      {r.action}{r.reset ? ' + reset' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Danger zone */}
      <Section title="Danger Zone" danger>
        <p className="m-0 mb-3.5 text-[13px] text-[var(--text3)]">
          Bulk and irreversible operations. Every button requires confirmation.
        </p>
        <div className="flex gap-2.5 flex-wrap">
          <button
            onClick={() => confirmBulk(
              'Reset All Turns',
              'Give all kingdoms 400 turns? This applies to every kingdom on the server.',
              '/api/admin/reset-turns-all',
            )}
            style={BTN_DANGER}
          >
            Reset All Turns
          </button>
          <button
            onClick={() => confirmBulk(
              'Reset All Kingdoms',
              'Wipe ALL kingdoms back to starting stats? This clears troops, resources, buildings, heroes, and war history for every player.',
              '/api/admin/reset-all-kingdoms',
            )}
            style={BTN_DANGER}
          >
            Reset All Kingdoms
          </button>
          <button
            onClick={() => confirmBulk(
              'Flush Locations',
              'Clear all kingdom location data (discovered kingdoms, map WIP, world fragments, hybrid blueprints)? Players must rediscover everything.',
              '/api/admin/flush-locations',
            )}
            style={BTN_DANGER}
          >
            Flush Locations
          </button>
          <button
            onClick={() => confirmBulk(
              'Flush Support Troops',
              'Zero out researchers, engineers, and scribes for ALL kingdoms? This cannot be undone.',
              '/api/admin/flush-support-troops',
            )}
            style={BTN_DANGER}
          >
            Flush Support Troops
          </button>
        </div>
      </Section>

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          danger={confirm.danger}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

const TD = { padding: '5px 8px', borderBottom: '1px solid var(--border3, #2a2a2a)' };
