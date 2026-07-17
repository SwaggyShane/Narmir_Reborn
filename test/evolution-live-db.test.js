'use strict';
/**
 * Roadmap B live DB: egg gates, ritual TX apply, castle fail, complete via processTurn.
 * Run: node test/evolution-live-db.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const evolution = require('../game/evolution');
const {
  DRAGON_EGG_ITEM_ID,
  DRAGON_EGG_ITEM_NAME,
  EVOLUTION_PRESTIGE_GATE,
  RITUAL_TURNS,
} = require('../game/evolution/balance');
const { applyKingdomUpdates, clearKingdomColsCache } = require('../db/kingdom-updates');
const engine = require('../game/engine');
const { applyPrestigeCombatMultiplier } = require('../game/prestige/combat');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

function makeTxDb(client) {
  return {
    async get(sql, params = []) {
      return (await client.query(sql, params)).rows[0];
    },
    async all(sql, params = []) {
      return (await client.query(sql, params)).rows;
    },
    async run(sql, params = []) {
      return client.query(sql, params);
    },
  };
}

async function ensureEvolutionCols(client) {
  for (const [col, def] of [
    ['evolution_form', "TEXT NOT NULL DEFAULT ''"],
    ['evolution_ritual', "TEXT NOT NULL DEFAULT '{}'"],
  ]) {
    const r = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='kingdoms' AND column_name=$1`,
      [col],
    );
    if (r.rowCount === 0) {
      await client.query(`ALTER TABLE kingdoms ADD COLUMN ${col} ${def}`);
    }
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('FAIL: DATABASE_URL required');
    process.exit(1);
  }

  console.log('=== Evolution live DB (Roadmap B) ===\n');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const failures = [];
  const pass = (m) => console.log(`  ✓ ${m}`);
  const fail = (m, e) => {
    console.error(`  ✗ ${m}`, e?.message || e);
    failures.push(m);
  };

  try {
    await ensureEvolutionCols(client);
    clearKingdomColsCache();

    let player = (
      await client.query(`SELECT id FROM players WHERE username=$1`, ['evolution_test_bot'])
    ).rows[0];
    if (!player) {
      player = (
        await client.query(
          `INSERT INTO players (username, password, is_admin) VALUES ($1,$2,0) RETURNING id`,
          ['evolution_test_bot', 'evo_not_for_login'],
        )
      ).rows[0];
    }
    let k = (await client.query(`SELECT id FROM kingdoms WHERE player_id=$1`, [player.id])).rows[0];
    if (!k) {
      k = (
        await client.query(
          `INSERT INTO kingdoms (player_id, name, race, region, level, prestige_level, turn, land, gold, food, mana, population)
           VALUES ($1,'EvoRealm','human','human',1,8,50,500,1000,1000,1000,1000) RETURNING id`,
          [player.id],
        )
      ).rows[0];
    }
    const kid = k.id;
    const eggJson = JSON.stringify([
      { id: DRAGON_EGG_ITEM_ID, name: DRAGON_EGG_ITEM_NAME, qty: 1 },
    ]);

    // ── 1. Start ritual (applyKingdomUpdates path) ─────────────────────────
    console.log('[1] Start ritual consumes egg');
    try {
      await client.query(
        `UPDATE kingdoms SET prestige_level=$1, bld_castles=2, evolution_form='',
          evolution_ritual='{}', items=$2, turn=100, level=1 WHERE id=$3`,
        [EVOLUTION_PRESTIGE_GATE, eggJson, kid],
      );
      const row = (await client.query(`SELECT * FROM kingdoms WHERE id=$1`, [kid])).rows[0];
      assert.ok(evolution.canStartDragonRitual(row).ok);
      const started = evolution.startDragonRitual(row);
      assert.ok(!started.error);
      const applied = await applyKingdomUpdates(kid, started.updates, makeTxDb(client));
      assert.ok(Array.isArray(applied) && applied.length >= 2, `applied ${applied}`);
      const after = (await client.query(`SELECT * FROM kingdoms WHERE id=$1`, [kid])).rows[0];
      assert.ok(evolution.isChanneling(after));
      assert.ok(!evolution.hasDragonEgg(after));
      assert.strictEqual(JSON.parse(after.evolution_ritual).turns_remaining, RITUAL_TURNS);
      pass('start + applyKingdomUpdates');
    } catch (e) {
      fail('start ritual', e);
    }

    // ── 2. No egg cannot start ─────────────────────────────────────────────
    console.log('[2] No egg blocked');
    try {
      await client.query(
        `UPDATE kingdoms SET prestige_level=$1, bld_castles=2, evolution_form='',
          evolution_ritual='{}', items='[]' WHERE id=$2`,
        [EVOLUTION_PRESTIGE_GATE, kid],
      );
      const row = (await client.query(`SELECT * FROM kingdoms WHERE id=$1`, [kid])).rows[0];
      assert.ok(!evolution.canStartDragonRitual(row).ok);
      pass('no egg');
    } catch (e) {
      fail('no egg', e);
    }

    // ── 3. Castle fail mid-channel ─────────────────────────────────────────
    console.log('[3] Castle fail on processTurn');
    try {
      const ritual = JSON.stringify({
        state: 'CHANNELING',
        form: 'dragon',
        turns_remaining: 20,
        turns_total: RITUAL_TURNS,
      });
      await client.query(
        `UPDATE kingdoms SET bld_castles=0, evolution_form='', evolution_ritual=$1, turn=200 WHERE id=$2`,
        [ritual, kid],
      );
      const row = (await client.query(`SELECT * FROM kingdoms WHERE id=$1`, [kid])).rows[0];
      const tr = engine.processTurn(row, null);
      assert.ok(tr.updates.evolution_ritual);
      assert.strictEqual(JSON.parse(tr.updates.evolution_ritual).state, 'FAILED');
      pass('castle fail via processTurn');
    } catch (e) {
      fail('castle fail', e);
    }

    // ── 4. Complete ritual (turns_remaining=1) ─────────────────────────────
    console.log('[4] Complete => evolution_form=dragon');
    try {
      const ritual = JSON.stringify({
        state: 'CHANNELING',
        form: 'dragon',
        turns_remaining: 1,
        turns_total: RITUAL_TURNS,
      });
      await client.query(
        `UPDATE kingdoms SET bld_castles=1, evolution_form='', evolution_ritual=$1, turn=300 WHERE id=$2`,
        [ritual, kid],
      );
      const row = (await client.query(`SELECT * FROM kingdoms WHERE id=$1`, [kid])).rows[0];
      const tr = engine.processTurn(row, null);
      assert.strictEqual(tr.updates.evolution_form, 'dragon');
      assert.strictEqual(JSON.parse(tr.updates.evolution_ritual).state, 'COMPLETE');
      await applyKingdomUpdates(kid, tr.updates, makeTxDb(client));
      const after = (await client.query(`SELECT evolution_form FROM kingdoms WHERE id=$1`, [kid])).rows[0];
      assert.strictEqual(after.evolution_form, 'dragon');
      pass('complete form=dragon persisted');
    } catch (e) {
      fail('complete', e);
    }

    // ── 5. Combat: no second global combat; terror only ────────────────────
    console.log('[5] Fixed-army combat stacking');
    try {
      const base = 10000;
      const p8 = applyPrestigeCombatMultiplier(base, 8);
      assert.strictEqual(p8, 10500);
      const terror = evolution.applyDragonTerror(
        p8,
        { evolution_form: 'dragon', prestige_level: 8 },
        { prestige_level: 5 },
      );
      assert.strictEqual(terror, Math.round(10500 * 1.08));
      const defM = evolution.getDragonDefenseMult({ evolution_form: 'dragon' });
      assert.strictEqual(defM, 0.92);
      pass('terror + defense mult; prestige combat capped');
    } catch (e) {
      fail('combat stack', e);
    }

    // ── 6. Prestige blocked while channeling ───────────────────────────────
    console.log('[6] Prestige blocked while channeling');
    try {
      const prestige = require('../game/prestige');
      const row = {
        level: 500,
        last_prestige_turn: 0,
        turn: 1,
        evolution_ritual: JSON.stringify({ state: 'CHANNELING', turns_remaining: 10 }),
      };
      assert.strictEqual(prestige.canPrestige(row), false);
      pass('canPrestige false while CHANNELING');
    } catch (e) {
      fail('prestige channel block', e);
    }

    console.log('\n=== Summary ===');
    if (failures.length) {
      console.error(`FAILED ${failures.length}: ${failures.join(', ')}`);
      process.exit(1);
    }
    console.log('✓ All evolution live DB checks passed');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
