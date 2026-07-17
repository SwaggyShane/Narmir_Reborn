'use strict';
/**
 * HTTP evolution start/status/abort against a running worktree server.
 * Run: PRESTIGE_HTTP_BASE=http://localhost:3010 node test/evolution-http.test.js
 * Requires DATABASE_URL, JWT_SECRET, and evolution_test_bot (created by evolution-live-db).
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const assert = require('assert');
const {
  DRAGON_EGG_ITEM_ID,
  DRAGON_EGG_ITEM_NAME,
  EVOLUTION_PRESTIGE_GATE,
  RITUAL_TURNS,
} = require('../game/evolution/balance');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const BASE = process.env.PRESTIGE_HTTP_BASE || process.env.EVOLUTION_HTTP_BASE || 'http://localhost:3010';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await pool.query(
    `SELECT p.id as pid, k.id as kid FROM players p
     JOIN kingdoms k ON k.player_id = p.id
     WHERE p.username = 'evolution_test_bot'`,
  );
  if (!r.rows[0]) {
    console.error('FAIL: run evolution-live-db.test.js first');
    process.exit(1);
  }
  const { pid, kid } = r.rows[0];

  // Ensure columns
  for (const col of ['evolution_form', 'evolution_ritual']) {
    const c = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='kingdoms' AND column_name=$1`,
      [col],
    );
    if (c.rowCount === 0) {
      await pool.query(
        `ALTER TABLE kingdoms ADD COLUMN ${col} ${
          col === 'evolution_form' ? "TEXT NOT NULL DEFAULT ''" : "TEXT NOT NULL DEFAULT '{}'"
        }`,
      );
    }
  }

  const eggJson = JSON.stringify([
    { id: DRAGON_EGG_ITEM_ID, name: DRAGON_EGG_ITEM_NAME, qty: 1 },
  ]);
  await pool.query(
    `UPDATE kingdoms SET prestige_level=$1, bld_castles=3, evolution_form='',
      evolution_ritual='{}', items=$2, turn=500 WHERE id=$3`,
    [EVOLUTION_PRESTIGE_GATE, eggJson, kid],
  );

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('FAIL: JWT_SECRET missing');
    process.exit(1);
  }
  const token = jwt.sign({ playerId: pid }, secret, { expiresIn: '1h' });
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  try {
    const health = await fetch(BASE + '/');
    console.log('server GET /', health.status);
  } catch (e) {
    console.error('FAIL: server not reachable at', BASE, e.message);
    console.error('Start worktree server: PORT=3010 node index.js');
    process.exit(1);
  }

  // GET status
  let res = await fetch(BASE + '/api/kingdom/evolution', { headers });
  let body = await res.json();
  console.log('GET /evolution', res.status, JSON.stringify(body).slice(0, 200));
  assert.strictEqual(res.status, 200);
  assert.strictEqual(body.canStart, true);
  assert.strictEqual(body.hasEgg, true);
  assert.strictEqual(body.prestigeGate, EVOLUTION_PRESTIGE_GATE);

  // Start
  res = await fetch(BASE + '/api/kingdom/evolution/start', {
    method: 'POST',
    headers,
    body: '{}',
  });
  let text = await res.text();
  console.log('POST start', res.status, text.slice(0, 300));
  if (res.status === 403 || /csrf/i.test(text)) {
    // CSRF may be required — retry after common csrf probes
    for (const p of ['/api/csrf-token', '/api/auth/csrf']) {
      try {
        const c = await fetch(BASE + p, { headers: { Authorization: headers.Authorization } });
        const cj = await c.json().catch(() => ({}));
        const tok = cj.csrfToken || cj.token || cj.csrf;
        if (tok) headers['X-CSRF-Token'] = tok;
      } catch {
        /* ignore */
      }
    }
    res = await fetch(BASE + '/api/kingdom/evolution/start', {
      method: 'POST',
      headers,
      body: '{}',
    });
    text = await res.text();
    console.log('POST start retry', res.status, text.slice(0, 300));
  }

  assert.strictEqual(res.status, 200, text);
  body = JSON.parse(text);
  assert.ok(body.ok);
  assert.strictEqual(body.ritual.state, 'CHANNELING');
  assert.strictEqual(body.ritual.turns_remaining, RITUAL_TURNS);

  const row = (
    await pool.query(
      `SELECT evolution_form, evolution_ritual, items FROM kingdoms WHERE id=$1`,
      [kid],
    )
  ).rows[0];
  assert.strictEqual(JSON.parse(row.evolution_ritual).state, 'CHANNELING');
  const items = JSON.parse(row.items || '[]');
  assert.ok(!items.some((i) => i.id === DRAGON_EGG_ITEM_ID && (i.qty || 0) > 0));

  // Second start fails
  res = await fetch(BASE + '/api/kingdom/evolution/start', {
    method: 'POST',
    headers,
    body: '{}',
  });
  body = await res.json();
  assert.ok(res.status >= 400);
  assert.ok(body.error);

  // Abort
  res = await fetch(BASE + '/api/kingdom/evolution/abort', {
    method: 'POST',
    headers,
    body: '{}',
  });
  body = await res.json();
  console.log('POST abort', res.status, body.ok || body.error);
  assert.strictEqual(res.status, 200);
  assert.ok(body.ok);

  const afterAbort = (
    await pool.query(`SELECT evolution_ritual FROM kingdoms WHERE id=$1`, [kid])
  ).rows[0];
  assert.strictEqual(JSON.parse(afterAbort.evolution_ritual).state, 'ABORTED');

  console.log('✓ HTTP evolution path verified');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
