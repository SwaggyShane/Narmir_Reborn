import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiCall } from '../../utils/api.js';
import { applyGameMutation } from '../../utils/gameMutations.js';
import { gameStateManager } from '../../GameStateManager.js';

let authApi = null;

function setVisible(id, visible, display = 'flex') {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? display : 'none';
}

function syncShellChrome(visible) {
  setVisible('app', !visible, '');
  setVisible('bottom-nav', !visible, '');
  setVisible('password-reset-modal', false);
  if (!visible) setVisible('registration-modal', false);
}

function clearAuthToken() {
  try {
    localStorage.removeItem('narmir_token');
  } catch {}
  try {
    document.cookie = 'token=; Max-Age=0; path=/';
    document.cookie = 'csrf_token=; Max-Age=0; path=/';
  } catch {}
}

function syncIdentity(me, fallbackUsername) {
  const username = (me && me.username) || fallbackUsername || '';
  const isAdmin = !!(me && me.isAdmin);
  gameStateManager.setState({ username, isAdmin }, { reason: 'auth-session' });
}

export async function loadKingdom() {
  const kingdom = await apiCall('GET', '/api/kingdom/me');
  if (kingdom && !kingdom.error) {
    applyGameMutation(kingdom, { reason: 'kingdom-refresh' });
  }
  return kingdom;
}

async function finishAuthSession(fallbackUsername) {
  if (typeof authApi?.hideLoginModal === 'function') {
    authApi.hideLoginModal();
  }

  try {
    const me = await apiCall('GET', '/api/auth/me');
    if (me && !me.error) {
      syncIdentity(me, fallbackUsername);
    } else {
      syncIdentity(null, fallbackUsername);
    }
  } catch {
    syncIdentity(null, fallbackUsername);
  }

  await loadKingdom();

  if (typeof window !== 'undefined' && typeof window.initSocket === 'function') {
    window.initSocket().catch(function (err) {
      console.warn('[socket] Failed to initialize after auth:', err);
    });
  }
}

async function submitAuthRequest(endpoint, payload) {
  const res = await apiCall('POST', endpoint, payload);
  if (res && res.error) throw new Error(res.error);
  return res || {};
}

function passwordRules(value) {
  return [
    { id: 'req-length', ok: value.length >= 8, label: '8+ characters' },
    { id: 'req-upper', ok: /[A-Z]/.test(value), label: 'Uppercase letter' },
    { id: 'req-lower', ok: /[a-z]/.test(value), label: 'Lowercase letter' },
    { id: 'req-number', ok: /\d/.test(value), label: 'Number (0-9)' },
    { id: 'req-special', ok: /[@$!%*?&]/.test(value), label: 'Special char (@$!%*?&)' },
  ];
}

export function initLoginModal() {
  authApi?.initLoginModal?.();
}

export function showLoginModal() {
  authApi?.showLoginModal?.();
}

export function hideLoginModal() {
  authApi?.hideLoginModal?.();
}

export function showPasswordReset() {
  authApi?.showPasswordReset?.();
}

export function closeRegistrationModal() {
  authApi?.closeRegistrationModal?.();
}

export function backToRaceSelection() {
  authApi?.backToRaceSelection?.();
}

export function updatePasswordRequirements() {
  authApi?.updatePasswordRequirements?.();
}

export function clearToken() {
  clearAuthToken();
  authApi?.clearToken?.();
}

export async function doLogin() {
  return authApi?.doLogin?.() ?? null;
}

export async function doRegister() {
  return authApi?.doRegister?.() ?? null;
}

export async function logout() {
  try {
    await apiCall('POST', '/api/auth/logout');
  } catch {}
  clearAuthToken();
  if (typeof window !== 'undefined') window.location.href = '/portal';
}

export default function AuthModal() {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState('login');
  const [showHelp, setShowHelp] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    username: '',
    password: '',
    email: '',
    kingdomName: '',
    race: 'human',
    gender: 'male',
  });
  const formRef = useRef(form);
  const userRef = useRef(null);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    syncShellChrome(visible);
    if (typeof document !== 'undefined') {
      const overlay = document.getElementById('login-overlay');
      if (overlay) overlay.style.display = visible ? 'flex' : 'none';
    }
    if (visible) {
      setTimeout(() => userRef.current?.focus?.(), 0);
    }
  }, [visible]);

  useEffect(() => {
    authApi = {
      initLoginModal() {
        setVisible(false);
        setMode('login');
        setShowHelp(false);
        setError('');
      },
      showLoginModal() {
        setVisible(true);
        setMode('login');
        setShowHelp(false);
        setError('');
      },
      hideLoginModal() {
        setVisible(false);
        setShowHelp(false);
        setError('');
      },
      showPasswordReset() {
        setVisible(true);
        setShowHelp(true);
      },
      closeRegistrationModal() {
        setVisible(false);
        setShowHelp(false);
        setMode('login');
      },
      backToRaceSelection() {
        setMode('register');
        setShowHelp(false);
      },
      updatePasswordRequirements() {
        setForm((prev) => ({ ...prev }));
      },
      clearToken() {
        setForm((prev) => ({ ...prev, password: '' }));
      },
      async doLogin() {
        const current = formRef.current;
        const username = (current.username || '').trim();
        const password = current.password || '';
        if (!username || !password) {
          setError('Username and password are required.');
          return;
        }
        setError('');
        try {
          await submitAuthRequest('/api/auth/login', { username, password });
          await finishAuthSession(username);
        } catch (err) {
          setError(err?.message || 'Login failed.');
        }
      },
      async doRegister() {
        const current = formRef.current;
        const username = (current.username || '').trim();
        const password = current.password || '';
        const email = (current.email || '').trim();
        const kingdomName = (current.kingdomName || '').trim();
        const race = current.race || 'human';
        const gender = current.gender || 'male';
        if (!username || !password || !email || !kingdomName) {
          setError('Username, password, email, and kingdom name are required.');
          return;
        }
        setError('');
        try {
          await submitAuthRequest('/api/auth/register', {
            username,
            password,
            email,
            kingdomName,
            race,
            gender,
          });
          await finishAuthSession(username);
        } catch (err) {
          setError(err?.message || 'Registration failed.');
        }
      },
    };

    return () => {
      if (authApi) authApi = null;
    };
  }, []);

  const checks = useMemo(() => passwordRules(form.password || ''), [form.password]);
  const isPasswordStrongEnough = checks.every((item) => item.ok);

  const panelStyle = {
    background: 'rgba(19, 20, 29, 0.85)',
    backdropFilter: 'blur(8px)',
    borderLeft: '1px solid #363a52',
    padding: '40px 60px',
    width: '45%',
    zIndex: 1,
    position: 'relative',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minHeight: '100vh',
    boxSizing: 'border-box',
  };

  const inputStyle = {
    width: '100%',
    marginBottom: '10px',
    padding: '10px 12px',
    fontSize: '16px',
    background: '#1a1c27',
    border: '1px solid #363a52',
    borderRadius: '8px',
    color: '#e8e9f0',
    boxSizing: 'border-box',
  };

  const helpStyle = {
    fontSize: '12px',
    background: 'rgba(224, 92, 92, 0.1)',
    border: '1px solid rgba(224, 92, 92, 0.3)',
    borderRadius: '6px',
    padding: '10px',
    marginBottom: '10px',
    color: '#e8b84b',
    lineHeight: 1.6,
  };

  if (!visible) return null;

  return (
    <div style={panelStyle}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ fontSize: '24px', fontWeight: 700, color: '#e8b84b', marginBottom: '8px' }}>
          {mode === 'register' ? 'Create Account' : 'Login'}
        </div>
        <button
          type="button"
          onClick={() => setMode((prev) => (prev === 'login' ? 'register' : 'login'))}
          style={{ background: 'none', border: 'none', color: '#7880b0', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
        >
          {mode === 'register' ? 'Already have an account? Login' : 'Need an account? Register'}
        </button>
      </div>

      <div id="auth-error" style={{ fontSize: '13px', color: '#e05c5c', marginBottom: '12px', minHeight: '18px' }}>
        {error}
      </div>

      <input
        ref={userRef}
        value={form.username}
        onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
        type="text"
        placeholder="Username"
        style={inputStyle}
        autoComplete="username"
      />

      <input
        value={form.password}
        onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
        type="password"
        placeholder="Password"
        style={{ ...inputStyle, marginBottom: '8px' }}
        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
      />

      {mode === 'register' ? (
        <div id="password-requirements" style={helpStyle}>
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>Password Requirements</div>
          {checks.map((item) => (
            <div key={item.id} style={{ color: item.ok ? 'var(--green)' : '#e05c5c' }}>
              {item.ok ? 'OK' : 'NO'} {item.label}
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ textAlign: 'right', marginBottom: '12px' }}>
        <button
          type="button"
          onClick={() => setShowHelp((prev) => !prev)}
          style={{ background: 'none', border: 'none', color: '#7880b0', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
        >
          {showHelp ? 'Hide password help' : 'Forgot password?'}
        </button>
      </div>

      {showHelp ? (
        <div style={{ ...helpStyle, background: 'rgba(96, 96, 96, 0.14)' }}>
          <div style={{ fontWeight: 700, marginBottom: '6px' }}>Password Requirements</div>
          <div>8 or more characters</div>
          <div>Uppercase letter (A-Z)</div>
          <div>Lowercase letter (a-z)</div>
          <div>Number (0-9)</div>
          <div>Special character: @$!%*?&</div>
          <div style={{ marginTop: '8px' }}>
            If you have forgotten your password, contact an administrator for assistance.
          </div>
        </div>
      ) : null}

      {mode === 'register' ? (
        <div style={{ display: 'grid', gap: '10px', marginBottom: '12px' }}>
          <input
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            type="email"
            placeholder="Email address"
            style={inputStyle}
            autoComplete="email"
          />
          <input
            value={form.kingdomName}
            onChange={(e) => setForm((prev) => ({ ...prev, kingdomName: e.target.value }))}
            type="text"
            placeholder="Kingdom name"
            style={inputStyle}
            autoComplete="off"
          />
          <select value={form.race} onChange={(e) => setForm((prev) => ({ ...prev, race: e.target.value }))} style={inputStyle}>
            <option value="high_elf">High Elf</option>
            <option value="dwarf">Dwarf</option>
            <option value="dire_wolf">Dire Wolf</option>
            <option value="dark_elf">Dark Elf</option>
            <option value="human">Human</option>
            <option value="orc">Orc</option>
            <option value="vampire">Vampire</option>
          </select>
          {form.race === 'vampire' ? (
            <div style={{ fontSize: '12px', color: '#e87070', background: 'rgba(200, 50, 50, 0.12)', border: '1px solid rgba(200, 50, 50, 0.3)', borderRadius: '6px', padding: '8px 10px', lineHeight: 1.5 }}>
              Experienced players only. Vampires are nearly powerless during daylight hours and rely on Thralls for daytime support.
            </div>
          ) : null}
          <select value={form.gender} onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))} style={inputStyle}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          type="button"
          className="btn btn-accent"
          style={{ flex: 1, padding: '12px', fontWeight: 700 }}
          onClick={mode === 'register' ? doRegister : doLogin}
          disabled={mode === 'register' && !isPasswordStrongEnough}
        >
          {mode === 'register' ? 'Create Kingdom' : 'Login'}
        </button>
        <button
          type="button"
          className="btn"
          style={{ padding: '12px 14px', border: '1px solid #363a52', background: 'rgba(255,255,255,0.03)' }}
          onClick={() => hideLoginModal()}
        >
          Close
        </button>
      </div>
    </div>
  );
}
