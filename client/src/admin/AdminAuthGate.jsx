import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api.mjs';
import AdminShell from './AdminShell.jsx';

const STYLES = {
  page: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0a0b' },
  checking: { color: '#71717a', fontFamily: 'Inter, sans-serif', fontSize: 14 },
  card: { width: 320, padding: 32, background: '#18181b', borderRadius: 8, border: '1px solid #27272a', fontFamily: 'Inter, sans-serif' },
  title: { color: '#d4af37', fontFamily: 'Cinzel, serif', margin: '0 0 4px', fontSize: 22, letterSpacing: 2 },
  subtitle: { color: '#71717a', fontSize: 13, marginBottom: 20 },
  error: { color: '#ef4444', fontSize: 13, marginBottom: 10, minHeight: 18 },
  input: { width: '100%', marginBottom: 10, padding: '8px 10px', background: '#09090b', border: '1px solid #27272a', borderRadius: 4, color: '#e4e4e7', fontSize: 14, boxSizing: 'border-box', outline: 'none' },
  btn: { width: '100%', padding: 9, background: '#d4af37', border: 'none', borderRadius: 4, color: '#09090b', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
};

export default function AdminAuthGate() {
  const [status, setStatus] = useState('checking'); // 'checking' | 'login' | 'authed'
  const [adminUser, setAdminUser] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/auth/me', { credentials: 'include', signal: ctrl.signal })
      .then(r => r.json())
      .then(data => {
        if (data.isAdmin) {
          setAdminUser(data.username);
          setStatus('authed');
        } else {
          setStatus('login');
        }
      })
      .catch(e => {
        if (e.name !== 'AbortError') setStatus('login');
      });
    return () => ctrl.abort();
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await apiCall('/api/auth/login', { method: 'POST', body: { username, password } });
      if (data.error) {
        setError(data.error);
        return;
      }
      if (!data.isAdmin) {
        setError('Not an admin account');
        return;
      }
      setAdminUser(data.username);
      setStatus('authed');
    } catch (err) {
      setError(err.message || 'Connection error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await apiCall('/api/auth/logout', { method: 'POST' });
    setStatus('login');
    setAdminUser('');
    setUsername('');
    setPassword('');
    setError('');
  }

  if (status === 'checking') {
    return (
      <div style={STYLES.page}>
        <span style={STYLES.checking}>Loading…</span>
      </div>
    );
  }

  if (status === 'login') {
    return (
      <div style={STYLES.page}>
        <div style={STYLES.card}>
          <h1 style={STYLES.title}>NARMIR</h1>
          <div style={STYLES.subtitle}>Admin panel</div>
          <div style={STYLES.error}>{error}</div>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              disabled={submitting}
              style={STYLES.input}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={submitting}
              style={{ ...STYLES.input, marginBottom: 14 }}
            />
            <button type="submit" disabled={submitting} style={STYLES.btn}>
              {submitting ? 'Logging in…' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <AdminShell adminUser={adminUser} onLogout={handleLogout} />;
}
