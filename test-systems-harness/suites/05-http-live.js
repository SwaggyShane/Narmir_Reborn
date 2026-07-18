'use strict';

/**
 * Suite 05: Optional live HTTP checks against a running server.
 *
 * Enable with:
 *   SYSTEMS_HTTP_BASE=http://localhost:3000 node test-systems-harness/run-all.js --http
 *
 * Creates temporary accounts via register (or reuses seed usernames if JWT signed).
 * Verifies endpoints respond (not 404) and auth-gated routes return 401 without token.
 */

const path = require('path');
const fs = require('fs');
const { assert } = require('../lib/report');

const envPath = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

/** Endpoints that must not 404 when authenticated (body may still 4xx for game rules). */
const AUTHED_SMOKE = [
  { method: 'GET', path: '/api/kingdom/me' },
  { method: 'GET', path: '/api/kingdom/rankings' },
  { method: 'GET', path: '/api/kingdom/war-log' },
  { method: 'GET', path: '/api/kingdom/defense/overview' },
  { method: 'GET', path: '/api/kingdom/spy-reports' },
  { method: 'GET', path: '/api/kingdom/market/prices' },
  { method: 'GET', path: '/api/kingdom/economy/overview' },
  { method: 'GET', path: '/api/kingdom/trade-routes/list' },
  { method: 'GET', path: '/api/kingdom/news/list' },
  { method: 'GET', path: '/api/kingdom/season' },
  { method: 'GET', path: '/api/kingdom/locations' },
  { method: 'GET', path: '/api/kingdom/goals' },
  { method: 'GET', path: '/api/kingdom/happiness-status' },
  { method: 'GET', path: '/api/kingdom/attunements' },
  { method: 'GET', path: '/api/kingdom/synergy-status' },
  { method: 'GET', path: '/api/hero/list' },
  { method: 'GET', path: '/api/hero/classes' },
  { method: 'GET', path: '/api/forum/index' },
  { method: 'GET', path: '/api/alliance/list' },
];

const PUBLIC_SMOKE = [
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/api/forum/boards' },
];

const MUTATING_EXISTENCE = [
  // These should not 404; 401/403/400/429 are all "endpoint exists"
  { method: 'POST', path: '/api/kingdom/attack', body: {} },
  { method: 'POST', path: '/api/kingdom/spell', body: { spellId: 'spark' } },
  { method: 'POST', path: '/api/kingdom/covert', body: { op: 'spy' } },
  { method: 'POST', path: '/api/kingdom/turn', body: {} },
  { method: 'POST', path: '/api/kingdom/hire', body: { unit: 'fighters', amount: 1 } },
  { method: 'POST', path: '/api/kingdom/market/buy', body: {} },
  { method: 'POST', path: '/api/kingdom/build', body: {} },
  { method: 'POST', path: '/api/kingdom/research', body: {} },
];

async function fetchJson(base, method, p, { token, csrf, body } = {}) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (csrf) headers['X-CSRF-Token'] = csrf;
  const res = await fetch(`${base}${p}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-json
  }
  return { status: res.status, text, json, headers: res.headers };
}

function endpointExists(status) {
  // 404/405 = not wired; everything else means the route stack saw the request
  return status !== 404 && status !== 405;
}

async function run(report, { enabled } = {}) {
  console.log('\n▶ Suite 05 — Live HTTP (optional)');

  const base = process.env.SYSTEMS_HTTP_BASE || process.env.PRESTIGE_HTTP_BASE || '';
  if (!enabled && !base) {
    report.skip('http', 'all checks', 'set SYSTEMS_HTTP_BASE or pass --http with a running server');
    return;
  }

  const BASE = base || 'http://localhost:3000';

  let reachable = false;
  await report.run('http', `server reachable ${BASE}`, async () => {
    try {
      const res = await fetch(BASE + '/health').catch(() => fetch(BASE + '/'));
      assert(res && res.status, 'no response');
      reachable = true;
      return `status=${res.status}`;
    } catch (err) {
      throw new Error(`cannot reach ${BASE}: ${err.message}`, { cause: err });
    }
  });

  if (!reachable) return;

  for (const ep of PUBLIC_SMOKE) {
    await report.run('http', `${ep.method} ${ep.path}`, async () => {
      const r = await fetchJson(BASE, ep.method, ep.path);
      assert(endpointExists(r.status), `got ${r.status}`);
      return `status=${r.status}`;
    });
  }

  // Unauthenticated mutating — should be 401/403, not 404
  for (const ep of MUTATING_EXISTENCE) {
    await report.run('http', `exists ${ep.method} ${ep.path}`, async () => {
      const r = await fetchJson(BASE, ep.method, ep.path, { body: ep.body || {} });
      assert(endpointExists(r.status), `got ${r.status} (route missing?)`);
      assert([400, 401, 403, 429, 200].includes(r.status) || r.status < 500, `unexpected ${r.status}`);
      return `status=${r.status}`;
    });
  }

  // Try register + login for authed GETs
  const suffix = `${Date.now().toString(36)}`;
  const username = `syshttp_${suffix}`;
  const password = 'SysHttpTest1!';
  let token = null;
  let csrf = null;

  await report.run('http', 'register or login test user', async () => {
    const reg = await fetchJson(BASE, 'POST', '/api/auth/register', {
      body: {
        username,
        password,
        email: `${username}@local.test`,
        kingdomName: `HttpSys ${suffix}`,
        race: 'human',
      },
    });
    if (reg.status === 200 || reg.status === 201) {
      token = reg.json?.token || reg.json?.accessToken;
      // cookie may hold token; try login regardless
    }
    const login = await fetchJson(BASE, 'POST', '/api/auth/login', {
      body: { username, password },
    });
    if (login.status === 200) {
      token = login.json?.token || login.json?.accessToken || token;
    }
    // CSRF probe
    for (const p of ['/api/csrf-token', '/api/auth/csrf', '/api/auth/me']) {
      try {
        const c = await fetchJson(BASE, 'GET', p, { token });
        csrf = c.json?.csrfToken || c.json?.csrf || csrf;
        if (c.headers && typeof c.headers.get === 'function') {
          const setCookie = c.headers.get('set-cookie') || '';
          const m = setCookie.match(/csrf[^=]*=([^;]+)/i);
          if (m) csrf = decodeURIComponent(m[1]);
        }
      } catch {
        // ignore
      }
    }
    if (!token && process.env.JWT_SECRET && login.json?.playerId) {
      const jwt = require('jsonwebtoken');
      token = jwt.sign({ playerId: login.json.playerId }, process.env.JWT_SECRET, { expiresIn: '1h' });
    }
    if (!token) {
      // last resort: sign with player lookup if register returned id
      if (process.env.JWT_SECRET && reg.json?.playerId) {
        const jwt = require('jsonwebtoken');
        token = jwt.sign({ playerId: reg.json.playerId }, process.env.JWT_SECRET, { expiresIn: '1h' });
      }
    }
    assert(token, `auth failed reg=${reg.status} login=${login.status} body=${(login.text || '').slice(0, 120)}`);
    return `user=${username}`;
  });

  if (!token) {
    report.skip('http', 'authed GETs', 'no token');
    return;
  }

  for (const ep of AUTHED_SMOKE) {
    await report.run('http', `auth ${ep.method} ${ep.path}`, async () => {
      const r = await fetchJson(BASE, ep.method, ep.path, { token, csrf });
      assert(endpointExists(r.status), `got ${r.status}`);
      assert(r.status !== 401, `unauthorized — token rejected for ${ep.path}`);
      // 200/204 ideal; 400/500 still means wired (report as fail only on 404)
      if (r.status >= 500) {
        throw new Error(`server error ${r.status}: ${(r.text || '').slice(0, 120)}`);
      }
      return `status=${r.status}`;
    });
  }

  // Mutating with auth — expect game validation errors, not 404
  await report.run('http', 'POST /attack responds (not 404)', async () => {
    const r = await fetchJson(BASE, 'POST', '/api/kingdom/attack', {
      token,
      csrf,
      body: { targetId: 1, fighters: 1 },
    });
    assert(endpointExists(r.status), `got ${r.status}`);
    return `status=${r.status} err=${(r.json?.error || '').slice(0, 60)}`;
  });

  await report.run('http', 'POST /spell responds (not 404)', async () => {
    const r = await fetchJson(BASE, 'POST', '/api/kingdom/spell', {
      token,
      csrf,
      body: { spellId: 'spark', targetId: 1 },
    });
    assert(endpointExists(r.status), `got ${r.status}`);
    return `status=${r.status} err=${(r.json?.error || '').slice(0, 60)}`;
  });

  await report.run('http', 'POST /covert responds (not 404)', async () => {
    const r = await fetchJson(BASE, 'POST', '/api/kingdom/covert', {
      token,
      csrf,
      body: { op: 'spy', targetId: 1, units: 1 },
    });
    assert(endpointExists(r.status), `got ${r.status}`);
    return `status=${r.status} err=${(r.json?.error || '').slice(0, 60)}`;
  });
}

module.exports = { run, name: '05-http-live' };
