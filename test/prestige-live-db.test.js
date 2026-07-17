'use strict';
/**
 * Live DB integration tests for prestige Roadmap A (EVOLUTION.md).
 * Requires DATABASE_URL and a reachable Postgres.
 * Run: node test/prestige-live-db.test.js
 * Or:  npm test (included via run-tests.js)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Load .env if present
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const { Pool } = require('pg');
const prestige = require('../game/prestige');
const { applyPrestigeCombatMultiplier } = require('../game/prestige/combat');
const { STARTER_BUILDINGS, ZERO_BUILDINGS } = require('../game/prestige/wipe');
const {
  applyKingdomUpdates,
  clearKingdomColsCache,
} = require('../db/kingdom-updates');
const {
  PRESTIGE_LEVEL_GATE,
  PRESTIGE_COOLDOWN_TURNS,
  landSeed,
  goldSeed,
} = require('../game/prestige/balance');
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('FAIL: DATABASE_URL not set');
  process.exit(1);
}

function makeTxDb(client) {
  return {
    async get(sql, params = []) {
      const r = await client.query(sql, params);
      return r.rows[0];
    },
    async all(sql, params = []) {
      const r = await client.query(sql, params);
      return r.rows;
    },
    async run(sql, params = []) {
      return client.query(sql, params);
    },
  };
}

/** Apply kingdom updates inside an open client TX (mirrors production column filter). */
async function applyUpdatesInTx(client, kingdomId, updates) {
  const colRows = await client.query(
    `SELECT column_name AS name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'kingdoms'`,
  );
  const valid = new Set(colRows.rows.map((r) => r.name));
  const entries = Object.entries(updates).filter(
    ([col, val]) => valid.has(col) && val !== undefined && val !== null,
  );
  if (!entries.length) {
    throw new Error('applyUpdatesInTx: no valid columns');
  }
  const sets = entries.map(([col], i) => `"${col}" = $${i + 1}`);
  const vals = entries.map(([, v]) => v);
  vals.push(kingdomId);
  await client.query(
    `UPDATE kingdoms SET ${sets.join(', ')} WHERE id = $${vals.length}`,
    vals,
  );
  return entries.map(([c]) => c);
}

async function ensureColumn(client, name, ddl) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = 'kingdoms' AND column_name = $1`,
    [name],
  );
  if (r.rowCount === 0) {
    await client.query(`ALTER TABLE kingdoms ADD COLUMN ${name} ${ddl}`);
    console.log(`  + added column kingdoms.${name}`);
  }
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  let client;
  const failures = [];
  const pass = (name) => console.log(`  ✓ ${name}`);
  const fail = (name, err) => {
    console.error(`  ✗ ${name}: ${err.message || err}`);
    failures.push(name);
  };

  console.log('=== Prestige live DB integration ===');
  console.log(`DB: ${DATABASE_URL.replace(/:[^:@/]+@/, ':***@')}`);

  try {
    client = await pool.connect();
  } catch (err) {
    console.error('FAIL: cannot connect to database:', err.message);
    process.exit(1);
  }

  try {
    await ensureColumn(client, 'last_prestige_turn', 'INTEGER NOT NULL DEFAULT 0');

    // Find or create a disposable test player/kingdom
    let player = (await client.query(`SELECT id FROM players WHERE username = $1`, ['prestige_test_bot'])).rows[0];
    if (!player) {
      const ins = await client.query(
        `INSERT INTO players (username, password, is_admin) VALUES ($1, $2, 0) RETURNING id`,
        ['prestige_test_bot', 'test_hash_not_for_login'],
      );
      player = ins.rows[0];
      console.log('  + created player prestige_test_bot id=', player.id);
    }

    let k = (await client.query(`SELECT * FROM kingdoms WHERE player_id = $1`, [player.id])).rows[0];
    if (!k) {
      const ins = await client.query(
        `INSERT INTO kingdoms (player_id, name, race, region, level, prestige_level, turn, land, gold, food, mana, population)
         VALUES ($1, $2, $3, $4, 500, 0, 1000, 9999, 1, 1, 1, 100)
         RETURNING *`,
        [player.id, 'PrestigeTestRealm', 'human', 'human'],
      );
      k = ins.rows[0];
      console.log('  + created kingdom id=', k.id);
    }

    const kid = k.id;

    // Seed pre-wipe state to prove wipe works
    await client.query(
      `UPDATE kingdoms SET
        level = 500,
        prestige_level = 0,
        last_prestige_turn = 0,
        turn = 1000,
        land = 9999,
        gold = 1,
        food = 1,
        mana = 1,
        population = 100,
        fighters = 5000,
        rangers = 1000,
        bld_castles = 12,
        bld_markets = 20,
        bld_walls = 15,
        bld_farms = 200,
        bld_barracks = 50,
        bld_schools = 10,
        bld_housing = 500,
        trade_routes = 3,
        world_fragments = $1,
        fragment_bonuses = $2,
        items = $3,
        active_trade_routes = $4,
        active_effects = $5
      WHERE id = $6`,
      [
        JSON.stringify([{ id: 'test_frag' }]),
        JSON.stringify({ vaults: 'volcanic_rock' }),
        JSON.stringify([{ id: 'junk_item', name: 'Junk' }]),
        JSON.stringify([{ partner_id: 99999 }]),
        JSON.stringify({ some_buff: 1 }),
        kid,
      ],
    );

    // Heroes: 5 so wipe keeps 3
    await client.query(`DELETE FROM heroes WHERE kingdom_id = $1`, [kid]);
    for (let i = 1; i <= 5; i++) {
      await client.query(
        `INSERT INTO heroes (kingdom_id, name, class, level, xp, status, hp, max_hp)
         VALUES ($1, $2, $3, $4, 0, 'idle', 200, 200)`,
        [kid, `Hero${i}`, 'warlord', i * 10, ],
      ).catch(async () => {
        // older schema may lack columns
        await client.query(
          `INSERT INTO heroes (kingdom_id, name, class, level) VALUES ($1, $2, $3, $4)`,
          [kid, `Hero${i}`, 'warlord', i * 10],
        );
      });
    }

    // Partner kingdom for trade route cascade
    let partner = (await client.query(`SELECT id FROM kingdoms WHERE name = $1`, ['PrestigePartnerBot'])).rows[0];
    if (!partner) {
      let p2 = (await client.query(`SELECT id FROM players WHERE username = $1`, ['prestige_partner_bot'])).rows[0];
      if (!p2) {
        p2 = (
          await client.query(
            `INSERT INTO players (username, password) VALUES ($1, $2) RETURNING id`,
            ['prestige_partner_bot', 'x'],
          )
        ).rows[0];
      }
      partner = (
        await client.query(
          `INSERT INTO kingdoms (player_id, name, race, region, level, turn, land, gold, food, mana, population, active_trade_routes)
           VALUES ($1, $2, 'orc', 'orc', 10, 1, 100, 100, 100, 100, 100, $3) RETURNING id`,
          [p2.id, 'PrestigePartnerBot', JSON.stringify([{ partner_id: kid }, { partner_id: 1 }])],
        )
      ).rows[0];
    } else {
      await client.query(
        `UPDATE kingdoms SET active_trade_routes = $1 WHERE id = $2`,
        [JSON.stringify([{ partner_id: kid }, { partner_id: 1 }]), partner.id],
      );
    }

    await client.query(`DELETE FROM trade_routes WHERE kingdom_id = $1 OR partner_id = $1`, [kid]);
    await client.query(
      `INSERT INTO trade_routes (kingdom_id, partner_id, distance, stability) VALUES ($1, $2, 10, 100)`,
      [kid, partner.id],
    );

    // Active expedition if table allows
    try {
      await client.query(`DELETE FROM expeditions WHERE kingdom_id = $1`, [kid]);
      await client.query(
        `INSERT INTO expeditions (kingdom_id, target_id, type, turns_left) VALUES ($1, $2, 'scout', 5)`,
        [kid, partner.id],
      );
    } catch (e) {
      console.log('  (expeditions seed skipped:', e.message, ')');
    }

    // --- Atomic rebirth path (mirrors route) ---
    console.log('\n[1] Atomic rebirth TX + wipe contract');
    await client.query('BEGIN');
    try {
      const locked = (
        await client.query(`SELECT * FROM kingdoms WHERE id = $1 FOR UPDATE`, [kid])
      ).rows[0];
      assert.ok(prestige.canPrestige(locked), 'canPrestige pre');
      const result = prestige.processPrestige(locked);
      assert.ok(!result.error, result.error);
      assert.strictEqual(result.newPrestigeLevel, 1);
      assert.strictEqual(result.seeds.land, landSeed(1));
      assert.strictEqual(result.seeds.gold, goldSeed(1));

      const txDb = makeTxDb(client);
      const applied = await applyUpdatesInTx(client, kid, result.updates);
      assert.ok(applied.length > 20, `expected many columns applied, got ${applied.length}`);
      await prestige.applyPrestigeSideEffects(txDb, kid);
      await client.query('COMMIT');
      pass(`transaction commit (${applied.length} cols)`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }

    const after = (await client.query(`SELECT * FROM kingdoms WHERE id = $1`, [kid])).rows[0];
    try {
      assert.strictEqual(Number(after.prestige_level), 1);
      assert.strictEqual(Number(after.level), 1);
      assert.strictEqual(Number(after.xp) || 0, 0);
      assert.strictEqual(Number(after.land), landSeed(1));
      assert.strictEqual(Number(after.gold), goldSeed(1));
      assert.strictEqual(Number(after.population), 5000);
      assert.strictEqual(Number(after.food), 25000);
      assert.strictEqual(Number(after.mana), 1000);
      assert.strictEqual(Number(after.fighters), 0);
      assert.strictEqual(Number(after.bld_castles), 0);
      assert.strictEqual(Number(after.bld_markets), 0);
      assert.strictEqual(Number(after.bld_walls), 0);
      assert.strictEqual(Number(after.bld_farms), STARTER_BUILDINGS.bld_farms);
      assert.strictEqual(Number(after.bld_barracks), STARTER_BUILDINGS.bld_barracks);
      assert.strictEqual(Number(after.bld_schools), STARTER_BUILDINGS.bld_schools);
      assert.strictEqual(Number(after.bld_housing), STARTER_BUILDINGS.bld_housing);
      assert.strictEqual(Number(after.trade_routes), 0);
      assert.strictEqual(Number(after.last_prestige_turn), 1000);
      assert.strictEqual(Number(after.turn), 1000);
      assert.strictEqual(after.race, 'human');
      for (const b of ZERO_BUILDINGS) {
        if (after[b] !== undefined && after[b] !== null) {
          assert.strictEqual(Number(after[b]), 0, b);
        }
      }
      const frags = after.world_fragments;
      assert.ok(frags === '[]' || frags === null || frags === 'null' || JSON.parse(frags || '[]').length === 0);
      const items = JSON.parse(after.items || '[]');
      assert.strictEqual(items.length, 0);
      pass('wipe contract on DB row');
    } catch (e) {
      fail('wipe contract on DB row', e);
    }

    // Heroes top 3
    console.log('\n[2] Heroes top-3 keep');
    try {
      const heroes = (
        await client.query(`SELECT id, level FROM heroes WHERE kingdom_id = $1 ORDER BY level DESC, id ASC`, [kid])
      ).rows;
      assert.ok(heroes.length <= 3, `expected <=3 heroes, got ${heroes.length}`);
      if (heroes.length === 3) {
        assert.ok(heroes[0].level >= heroes[1].level);
      }
      pass(`heroes remaining=${heroes.length}`);
    } catch (e) {
      fail('heroes cull', e);
    }

    // Trade routes gone + partner scrub
    console.log('\n[3] Trade route cascade');
    try {
      const tr = (
        await client.query(`SELECT COUNT(*)::int AS c FROM trade_routes WHERE kingdom_id = $1 OR partner_id = $1`, [
          kid,
        ])
      ).rows[0].c;
      assert.strictEqual(tr, 0);
      const partnerRow = (await client.query(`SELECT active_trade_routes FROM kingdoms WHERE id = $1`, [partner.id]))
        .rows[0];
      const parr = JSON.parse(partnerRow.active_trade_routes || '[]');
      const stillPoints = parr.some((e) => {
        if (typeof e === 'number') return e === kid;
        return e && (e.partner_id === kid || e.kingdom_id === kid);
      });
      assert.strictEqual(stillPoints, false, 'partner still references prestiging kingdom');
      pass('trade routes deleted + partner scrubbed');
    } catch (e) {
      fail('trade cascade', e);
    }

    // Expeditions
    console.log('\n[4] Expeditions cancelled');
    try {
      const ex = (
        await client.query(
          `SELECT COUNT(*)::int AS c FROM expeditions WHERE kingdom_id = $1 AND turns_left > 0`,
          [kid],
        )
      ).rows[0].c;
      assert.strictEqual(ex, 0);
      pass('no active expeditions');
    } catch (e) {
      fail('expeditions', e);
    }

    // Cooldown / second prestige
    console.log('\n[5] Cooldown blocks immediate second prestige');
    try {
      const locked2 = (await client.query(`SELECT * FROM kingdoms WHERE id = $1`, [kid])).rows[0];
      assert.strictEqual(prestige.canPrestige(locked2), false);
      const r2 = prestige.processPrestige(locked2);
      assert.ok(r2.error);
      pass('second prestige blocked by cooldown');
    } catch (e) {
      fail('cooldown', e);
    }

    // Concurrent FOR UPDATE simulation: two clients, second fails after first
    console.log('\n[6] Concurrent double-rebirth serialization');
    try {
      // Reset to prestigable state again
      await client.query(
        `UPDATE kingdoms SET level = 500, prestige_level = 0, last_prestige_turn = 0, turn = 2000 WHERE id = $1`,
        [kid],
      );
      const c1 = await pool.connect();
      const c2 = await pool.connect();
      try {
        await c1.query('BEGIN');
        await c1.query(`SELECT * FROM kingdoms WHERE id = $1 FOR UPDATE`, [kid]);
        const k1 = (await c1.query(`SELECT * FROM kingdoms WHERE id = $1`, [kid])).rows[0];
        const r1 = prestige.processPrestige(k1);
        assert.ok(!r1.error);
        const applied1 = await applyUpdatesInTx(c1, kid, r1.updates);
        assert.ok(applied1.length > 20, 'concurrent first apply wrote columns');

        // c2 blocks until c1 commits — use short statement timeout after we commit
        const p2 = (async () => {
          await c2.query('BEGIN');
          await c2.query(`SELECT * FROM kingdoms WHERE id = $1 FOR UPDATE`, [kid]);
          const k2 = (await c2.query(`SELECT * FROM kingdoms WHERE id = $1`, [kid])).rows[0];
          return prestige.canPrestige(k2);
        })();

        await c1.query('COMMIT');
        const can2 = await p2;
        await c2.query('ROLLBACK');
        assert.strictEqual(can2, false, 'second lock holder should see post-prestige state and fail canPrestige');
        pass('concurrent: second fails canPrestige after first commit');
      } finally {
        c1.release();
        c2.release();
      }
    } catch (e) {
      fail('concurrent double-rebirth', e);
    }

    // News best-effort: prestige already committed; insert news
    console.log('\n[7] News insert after commit');
    try {
      await client.query(
        `INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ($1, $2, $3, $4)`,
        [kid, 'system', 'test transcend news', 2000],
      );
      const n = (
        await client.query(
          `SELECT COUNT(*)::int AS c FROM news WHERE kingdom_id = $1 AND message LIKE $2`,
          [kid, '%transcend%'],
        )
      ).rows[0].c;
      assert.ok(n >= 1);
      pass('news insert works');
    } catch (e) {
      fail('news', e);
    }

    // processTurn sanity after prestige (fresh row)
    console.log('\n[8] processTurn after prestige (no throw)');
    try {
      // Reset to post-wipe-like state from last successful prestige in [6]
      const row = (await client.query(`SELECT * FROM kingdoms WHERE id = $1`, [kid])).rows[0];
      const engine = require('../game/engine');
      const turnResult = engine.processTurn(row, null);
      assert.ok(turnResult && turnResult.updates);
      assert.ok(Number(turnResult.updates.turn) >= Number(row.turn));
      // food/gold should be finite
      if (turnResult.updates.gold !== undefined) {
        assert.ok(Number.isFinite(Number(turnResult.updates.gold)));
      }
      pass('processTurn completes post-prestige');
    } catch (e) {
      fail('processTurn after prestige', e);
    }

    // Combat mult integration via combat-resolver calculateCombatPower if exported
    console.log('\n[9] Combat prestige mult integration');
    try {
      const resolver = require('../game/combat-resolver');
      const baseAtk = {
        race: 'human',
        prestige_level: 0,
        fighters: 1000,
        rangers: 0,
        mages: 0,
        clerics: 0,
        ninjas: 0,
        thieves: 0,
        engineers: 0,
        thralls: 0,
        war_machines: 0,
        bld_walls: 0,
        bld_guard_towers: 0,
        bld_outposts: 0,
        bld_castles: 0,
        happiness: 50,
        terrain: 'plains',
      };
      const def = { ...baseAtk, prestige_level: 0, fighters: 1000 };
      // Prefer public API
      let p0;
      let p5;
      if (typeof resolver.calculateCombatPower === 'function') {
        p0 = resolver.calculateCombatPower({ ...baseAtk, prestige_level: 0 }, def, 'military');
        p5 = resolver.calculateCombatPower({ ...baseAtk, prestige_level: 5 }, def, 'military');
        const r0 = p0.attackerPower;
        const r5 = p5.attackerPower;
        assert.ok(r5 > r0, `P5 power ${r5} should exceed P0 ${r0}`);
        // Isolated helper still exact
        assert.strictEqual(applyPrestigeCombatMultiplier(10000, 5), 10500);
        pass(`combat-resolver powers P0=${r0} P5=${r5} (P5>P0); helper 1.05 exact`);
      } else {
        assert.strictEqual(applyPrestigeCombatMultiplier(10000, 0), 10000);
        assert.strictEqual(applyPrestigeCombatMultiplier(10000, 5), 10500);
        pass('combat helper exact (calculateCombatPower not exported)');
      }
    } catch (e) {
      fail('combat integration', e);
    }

    // Gate 500
    console.log('\n[10] Level gate is 500');
    try {
      assert.strictEqual(PRESTIGE_LEVEL_GATE, 500);
      assert.strictEqual(PRESTIGE_COOLDOWN_TURNS, 200);
      assert.strictEqual(prestige.canPrestige({ level: 499, last_prestige_turn: 0, turn: 1 }), false);
      assert.strictEqual(prestige.canPrestige({ level: 500, last_prestige_turn: 0, turn: 1 }), true);
      pass('level gate 500');
    } catch (e) {
      fail('level gate', e);
    }

    // Production applyKingdomUpdates path (HTTP rebirth uses this — must not no-op)
    console.log('\n[11] applyKingdomUpdates applies full wipe (HTTP path)');
    try {
      clearKingdomColsCache();
      await client.query(
        `UPDATE kingdoms SET level=500, prestige_level=0, last_prestige_turn=0, turn=7777,
          fighters=12, bld_castles=4, land=9999, gold=3 WHERE id=$1`,
        [kid],
      );
      const locked = (await client.query(`SELECT * FROM kingdoms WHERE id=$1`, [kid])).rows[0];
      const result = prestige.processPrestige(locked);
      assert.ok(!result.error);
      const txDb = makeTxDb(client);
      const applied = await applyKingdomUpdates(kid, result.updates, txDb);
      assert.ok(applied.length > 50, `expected many cols applied, got ${applied.length}`);
      assert.ok(applied.includes('land'));
      assert.ok(applied.includes('bld_castles'));
      assert.ok(applied.includes('last_prestige_turn'));
      const after = (await client.query(
        `SELECT level, prestige_level, land, gold, fighters, bld_castles, last_prestige_turn FROM kingdoms WHERE id=$1`,
        [kid],
      )).rows[0];
      assert.strictEqual(Number(after.level), 1);
      assert.strictEqual(Number(after.prestige_level), 1);
      assert.strictEqual(Number(after.land), landSeed(1));
      assert.strictEqual(Number(after.gold), goldSeed(1));
      assert.strictEqual(Number(after.fighters), 0);
      assert.strictEqual(Number(after.bld_castles), 0);
      assert.strictEqual(Number(after.last_prestige_turn), 7777);
      pass(`applyKingdomUpdates applied ${applied.length} cols`);
    } catch (e) {
      fail('applyKingdomUpdates path', e);
    }

    console.log('\n=== Summary ===');
    if (failures.length) {
      console.error(`FAILED ${failures.length}: ${failures.join(', ')}`);
      process.exit(1);
    }
    console.log('✓ All prestige live DB integration checks passed');
    process.exit(0);
  } catch (err) {
    console.error('FATAL:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
