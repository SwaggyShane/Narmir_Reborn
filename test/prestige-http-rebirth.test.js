'use strict';
/**
 * HTTP-level rebirth test against a running server on :3000.
 * Run: node test/prestige-http-rebirth.test.js
 * Requires: server up, DATABASE_URL, JWT_SECRET. Creates its own prestige_test_bot
 * fixture if prestige-live-db.test.js hasn't already (test files run in alphabetical
 * order, which sorts this file before prestige-live-db.test.js).
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const assert = require('assert');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const BASE = process.env.PRESTIGE_HTTP_BASE || 'http://localhost:3000';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let r = await pool.query(
    `SELECT p.id as pid, k.id as kid FROM players p
     JOIN kingdoms k ON k.player_id = p.id
     WHERE p.username = 'prestige_test_bot'`,
  );
  if (!r.rows[0]) {
    let player = (
      await pool.query(`SELECT id FROM players WHERE username = $1`, ['prestige_test_bot'])
    ).rows[0];
    if (!player) {
      player = (
        await pool.query(
          `INSERT INTO players (username, password, is_admin) VALUES ($1, $2, 0) RETURNING id`,
          ['prestige_test_bot', 'test_hash_not_for_login'],
        )
      ).rows[0];
    }
    const k = (
      await pool.query(
        `INSERT INTO kingdoms (player_id, name, race, region, level, prestige_level, turn, land, gold, food, mana, population)
         VALUES ($1, $2, $3, $4, 500, 0, 1000, 9999, 1, 1, 1, 100)
         RETURNING id`,
        [player.id, 'PrestigeTestRealm', 'human', 'human'],
      )
    ).rows[0];
    r = { rows: [{ pid: player.id, kid: k.id }] };
  }
  const { pid, kid } = r.rows[0];
  await pool.query(
    `UPDATE kingdoms SET level=500, prestige_level=0, last_prestige_turn=0, turn=4000,
      fighters=77, bld_castles=9, bld_farms=100, land=8888 WHERE id=$1`,
    [kid],
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

  // Probe server
  try {
    const health = await fetch(BASE + '/');
    console.log('server GET /', health.status);
  } catch (e) {
    console.error('FAIL: server not reachable at', BASE, e.message);
    process.exit(1);
  }

  let res = await fetch(BASE + '/api/kingdom/rebirth', {
    method: 'POST',
    headers,
    body: '{}',
  });
  let text = await res.text();
  console.log('rebirth HTTP', res.status, text.slice(0, 500));

  if (res.status === 403 || /csrf/i.test(text)) {
    // Common patterns in this codebase
    for (const path of ['/api/csrf-token', '/api/auth/csrf', '/csrf']) {
      try {
        const c = await fetch(BASE + path, { headers: { Authorization: headers.Authorization } });
        const cj = await c.json().catch(() => ({}));
        console.log('csrf probe', path, c.status, JSON.stringify(cj).slice(0, 150));
        const tok = cj.csrfToken || cj.token || cj.csrf;
        if (tok) headers['X-CSRF-Token'] = tok;
      } catch {
        /* ignore */
      }
    }
    // Cookie jar: re-fetch with credentials
    res = await fetch(BASE + '/api/kingdom/rebirth', {
      method: 'POST',
      headers,
      body: '{}',
    });
    text = await res.text();
    console.log('rebirth HTTP retry', res.status, text.slice(0, 500));
  }

  const row = (
    await pool.query(
      `SELECT level, prestige_level, land, gold, fighters, bld_castles, bld_farms, last_prestige_turn
       FROM kingdoms WHERE id=$1`,
      [kid],
    )
  ).rows[0];
  console.log('DB after HTTP', row);

  if (res.status === 200) {
    const body = JSON.parse(text);
    assert.strictEqual(body.ok, true);
    assert.strictEqual(Number(row.prestige_level), Number(body.prestige_level));
    assert.strictEqual(Number(row.level), 1);
    assert.strictEqual(Number(row.fighters), 0);
    assert.strictEqual(Number(row.bld_castles), 0);
    assert.strictEqual(Number(row.bld_farms), 5);
    assert.strictEqual(Number(row.land), 550); // P1 seed
    console.log('✓ HTTP rebirth path verified end-to-end');
  } else if (res.status === 401 || res.status === 403) {
    console.error('FAIL: auth/csrf blocked HTTP path — body:', text.slice(0, 300));
    console.error('DB was NOT required to change if HTTP failed auth.');
    process.exit(1);
  } else {
    console.error('FAIL: unexpected status', res.status);
    process.exit(1);
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
