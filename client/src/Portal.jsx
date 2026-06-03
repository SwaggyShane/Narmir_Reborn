import React, { useState, useEffect } from 'react';
import './Portal.css';

const RACE_EMOJI = {
  human: '⚔️', orc: '🪓', dwarf: '⛏️', dark_elf: '🌙',
  vampire: '🦇', dire_wolf: '🐺', high_elf: '✨', undead: '💀',
};

function RankingsTable() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/public/rankings', { signal: ctrl.signal })
      .then(r => {
        if (!r.ok) throw new Error('Network response was not ok');
        return r.json();
      })
      .then(d => {
        if (d.error) throw new Error(d.error);
        setRows(d.rankings || []);
        setLoading(false);
      })
      .catch(e => {
        if (e.name !== 'AbortError') { setError(true); setLoading(false); }
      });
    return () => ctrl.abort();
  }, []);

  return (
    <div className="portal-card">
      <h2 className="portal-section-title">⚔️ Top Kingdoms</h2>
      {loading && <div className="portal-loading">Loading rankings…</div>}
      {error && <div className="portal-loading">Could not load rankings.</div>}
      {!loading && !error && (
        <table className="portal-rankings-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Kingdom</th>
              <th>Race</th>
              <th>Land</th>
              <th>Lvl</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id ?? i} className={r.is_ai ? 'ai-row' : ''}>
                <td className={`rank-num${i < 3 ? ' rank-top3' : ''}`}>{i + 1}</td>
                <td>
                  <div className="kingdom-cell">
                    <span className="kingdom-name-text">{r.name}</span>
                    <span className="kingdom-username">{r.username}</span>
                  </div>
                </td>
                <td className="race-cell">
                  {RACE_EMOJI[r.race] || '🏰'} {r.race ? r.race.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Unknown'}
                </td>
                <td>{r.land?.toLocaleString()}</td>
                <td>{r.level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AuthCard() {
  const [authStatus, setAuthStatus] = useState('loading');
  const [tab, setTab] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/auth/me', { credentials: 'include', signal: ctrl.signal })
      .then(r => r.json())
      .then(d => setAuthStatus(d.username ? 'in' : 'out'))
      .catch(e => { if (e.name !== 'AbortError') setAuthStatus('out'); });
    return () => ctrl.abort();
  }, []);

  const doSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      const d = await r.json();
      if (d.error) { setError(d.error); setSubmitting(false); return; }
      if (d.token) localStorage.setItem('narmir_token', d.token);
      window.location.href = '/game';
    } catch {
      setError('Network error. Try again.');
      setSubmitting(false);
    }
  };

  if (authStatus === 'loading') {
    return (
      <div className="portal-card">
        <div className="portal-loading">Checking session…</div>
      </div>
    );
  }

  if (authStatus === 'in') {
    return (
      <div className="portal-card">
        <h2 className="portal-section-title">Welcome Back</h2>
        <p className="portal-auth-sub">Your kingdom awaits.</p>
        <a href="/game" className="portal-enter-btn">ENTER</a>
      </div>
    );
  }

  return (
    <div className="portal-card">
      <h2 className="portal-section-title">Enter the Realm</h2>
      <div className="portal-tabs">
        <button className={`portal-tab${tab === 'login' ? ' active' : ''}`} onClick={() => setTab('login')}>
          Login
        </button>
        <button className={`portal-tab${tab === 'register' ? ' active' : ''}`} onClick={() => setTab('register')}>
          Join Free
        </button>
      </div>
      <form onSubmit={doSubmit}>
        <input
          className="portal-input"
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
          autoComplete="username"
        />
        <input
          className="portal-input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
        />
        {error && <p className="portal-error">{error}</p>}
        <button type="submit" className="portal-enter-btn" disabled={submitting}>
          {submitting ? '…' : tab === 'login' ? 'ENTER' : 'BEGIN'}
        </button>
      </form>
    </div>
  );
}

function ForumsCard() {
  return (
    <div className="portal-card">
      <h2 className="portal-section-title">📜 Forums</h2>
      <p className="portal-coming-soon">
        Forums are coming soon. In the meantime, join the community on Discord for news, strategy, and war reports.
      </p>
      <a
        href="https://discord.gg/narmir"
        className="portal-discord-btn"
        target="_blank"
        rel="noopener noreferrer"
      >
        💬 Join Discord
      </a>
    </div>
  );
}

export default function Portal() {
  return (
    <div className="portal-root">
      <header className="portal-header">
        <a href="/" className="portal-back-link">← Home</a>
        <h1 className="portal-title">NARMIR REBORN</h1>
        <p className="portal-tagline">Rise From the Ashes. Forge Your Legacy.</p>
      </header>

      <main className="portal-main">
        <div className="portal-col-left">
          <RankingsTable />
        </div>
        <div className="portal-col-right">
          <AuthCard />
          <ForumsCard />
        </div>
      </main>

      <footer className="portal-footer">
        <span>© 2025 Narmir Reborn</span>
        <a href="/" className="portal-footer-link">← Back to Home</a>
      </footer>
    </div>
  );
}
