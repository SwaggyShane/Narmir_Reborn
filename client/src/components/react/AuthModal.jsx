import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiCall } from '../../utils/api.mjs';
import { getSocket } from '../../socket-client.js';
import { initSocketHandlers } from '../../hooks/useSocket.js';
import { useProfileStore, useEconomyStore, useMilitaryStore, useResearchStore, usePopulationStore } from '../../stores';

let authApi = null;

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
  useProfileStore.getState().receiveServerSnapshot({ username, isAdmin });
}

export async function loadKingdom() {
  const kingdom = await apiCall('/api/kingdom/me');
  if (kingdom && !kingdom.error) {
    // Fetch scouts in parallel with kingdom data (or already available from initial load)
    let scouts = null;
    try {
      scouts = await apiCall('/api/kingdom/scouts');
    } catch (err) {
      console.warn('[auth] Scouts fetch failed:', err);
    }

    // Combine kingdom and scouts data into single snapshot to avoid multiple re-renders
    const combinedData = { ...kingdom };
    if (scouts && !scouts.error) {
      combinedData.scout_allocation = scouts.scout_allocation;
      combinedData.scout_progress = scouts.scout_progress;
    }

    // Update all stores with combined data (single batch update)
    useProfileStore.getState().receiveServerSnapshot(combinedData);
    useEconomyStore.getState().receiveServerSnapshot(combinedData);
    useMilitaryStore.getState().receiveServerSnapshot(combinedData);
    useResearchStore.getState().receiveServerSnapshot(combinedData);
    usePopulationStore.getState().receiveServerSnapshot(combinedData);
  }
  return kingdom;
}

async function connectSocketAfterAuth() {
  try {
    const sock = await getSocket();
    initSocketHandlers(sock);
  } catch (err) {
    console.warn('[socket] Failed to initialize after auth:', err);
  }
}

async function bootstrapAuthenticatedSession(fallbackUsername) {
  try {
    const me = await apiCall('/api/auth/me');
    if (me && !me.error) {
      syncIdentity(me, fallbackUsername);
    } else if (fallbackUsername) {
      syncIdentity(null, fallbackUsername);
    } else {
      return false;
    }
  } catch {
    if (fallbackUsername) {
      syncIdentity(null, fallbackUsername);
    } else {
      return false;
    }
  }

  await loadKingdom();
  await connectSocketAfterAuth();
  return true;
}

let restorePromise = null;

export async function restoreAuthSession() {
  if (!restorePromise) {
    restorePromise = bootstrapAuthenticatedSession();
  }
  return restorePromise;
}

async function finishAuthSession(fallbackUsername) {
  if (typeof authApi?.hideLoginModal === 'function') {
    authApi.hideLoginModal();
  }
  await bootstrapAuthenticatedSession(fallbackUsername);
}

async function submitAuthRequest(endpoint, payload) {
  const res = await apiCall(endpoint, { method: 'POST', body: payload });
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
    await apiCall('/api/auth/logout', { method: 'POST' });
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
  const panelClass =
    'relative flex h-full w-full max-w-[520px] flex-col justify-center overflow-y-auto border-l border-[#363a52] bg-[rgba(19,20,29,0.95)] px-[60px] py-[40px] backdrop-blur-md box-border sm:w-[45vw]';
  const inputClass =
    'mb-2.5 box-border w-full rounded-lg border border-[#363a52] bg-[#1a1c27] px-3 py-2.5 text-[16px] text-[#e8e9f0]';
  const helpClass =
    'mb-2.5 rounded-[6px] border border-[rgba(224,92,92,0.3)] bg-[rgba(224,92,92,0.1)] p-2.5 text-[12px] leading-6 text-[var(--gold)]';
  const buttonRowClass = 'flex gap-2.5';
  const primaryButtonClass = 'btn btn-accent flex-1 px-3 py-3.5 font-bold';
  const secondaryButtonClass = 'btn border border-[#363a52] bg-[rgba(255,255,255,0.03)] px-3.5 py-3.5';

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex justify-end bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) hideLoginModal();
      }}
    >
    <div className={panelClass}>
      <div className="mb-6 text-center">
        <div className="mb-2 text-[24px] font-bold text-[var(--gold)]">
          {mode === 'register' ? 'Create Account' : 'Login'}
        </div>
        <button
          type="button"
          onClick={() => setMode((prev) => (prev === 'login' ? 'register' : 'login'))}
          className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-[#7880b0] underline"
        >
          {mode === 'register' ? 'Already have an account? Login' : 'Need an account? Register'}
        </button>
      </div>

      <div id="auth-error" className="mb-3 min-h-[18px] text-[13px] text-[#e05c5c]">
        {error}
      </div>

      <input
        ref={userRef}
        value={form.username}
        onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
        type="text"
        placeholder="Username"
        className={inputClass}
        autoComplete="username"
      />

      <input
        value={form.password}
        onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
        type="password"
        placeholder="Password"
        className={`${inputClass} mb-2`}
        autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
      />

      {mode === 'register' ? (
        <div id="password-requirements" className={helpClass}>
          <div className="mb-1.5 font-semibold">Password Requirements</div>
          {checks.map((item) => (
            <div key={item.id} className={item.ok ? 'text-[var(--green)]' : 'text-[#e05c5c]'}>
              {item.ok ? 'OK' : 'NO'} {item.label}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mb-3 text-right">
        <button
          type="button"
          onClick={() => setShowHelp((prev) => !prev)}
          className="cursor-pointer border-0 bg-transparent p-0 text-[12px] text-[#7880b0] underline"
        >
          {showHelp ? 'Hide password help' : 'Forgot password?'}
        </button>
      </div>

      {showHelp ? (
        <div className="mb-2.5 rounded-[6px] border border-[rgba(224,92,92,0.3)] bg-[rgba(96,96,96,0.14)] p-2.5 text-[12px] leading-6 text-[var(--gold)]">
          <div className="mb-1.5 font-bold">Password Requirements</div>
          <div>8 or more characters</div>
          <div>Uppercase letter (A-Z)</div>
          <div>Lowercase letter (a-z)</div>
          <div>Number (0-9)</div>
          <div>Special character: @$!%*?&</div>
          <div className="mt-2">
            If you have forgotten your password, contact an administrator for assistance.
          </div>
        </div>
      ) : null}

      {mode === 'register' ? (
        <div className="mb-3 grid gap-2.5">
          <input
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            type="email"
            placeholder="Email address"
            className={inputClass}
            autoComplete="email"
          />
          <input
            value={form.kingdomName}
            onChange={(e) => setForm((prev) => ({ ...prev, kingdomName: e.target.value }))}
            type="text"
            placeholder="Kingdom name"
            className={inputClass}
            autoComplete="off"
          />
          <select value={form.race} onChange={(e) => setForm((prev) => ({ ...prev, race: e.target.value }))} className={inputClass}>
            <option value="high_elf">High Elf</option>
            <option value="dwarf">Dwarf</option>
            <option value="dire_wolf">Dire Wolf</option>
            <option value="dark_elf">Dark Elf</option>
            <option value="human">Human</option>
            <option value="orc">Orc</option>
            <option value="vampire">Vampire</option>
          </select>
          {form.race === 'vampire' ? (
            <div className="rounded-[6px] border border-[rgba(200,50,50,0.3)] bg-[rgba(200,50,50,0.12)] px-2.5 py-2 text-[12px] leading-6 text-[#e87070]">
              Experienced players only. Vampires are nearly powerless during daylight hours and rely on Thralls for daytime support.
            </div>
          ) : null}
          <select value={form.gender} onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))} className={inputClass}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
      ) : null}

      <div className={buttonRowClass}>
        <button
          type="button"
          className={primaryButtonClass}
          onClick={mode === 'register' ? doRegister : doLogin}
          disabled={mode === 'register' && !isPasswordStrongEnough}
        >
          {mode === 'register' ? 'Create Kingdom' : 'Login'}
        </button>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => hideLoginModal()}
        >
          Close
        </button>
      </div>
    </div>
    </div>
  );
}
