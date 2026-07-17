'use strict';
/**
 * Prestige ladder: rebirthing through every mult tier and title band.
 * P0ΓåÆP1ΓÇªΓåÆP5 (last mult change) then P6ΓÇªΓåÆP10 (cap holds, titles continue).
 *
 * Run: node test/prestige-ladder-live-db.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const prestige = require('../game/prestige');
const { applyPrestigeCombatMultiplier } = require('../game/prestige/combat');
const {
  landSeed,
  goldSeed,
  getPrestigeModifiers,
  getPrestigeTitle,
  PRESTIGE_LEVEL_GATE,
  PRESTIGE_COOLDOWN_TURNS,
  STARTER_BUILDINGS,
} = require('../game/prestige/balance');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const MAX_PRESTIGE = Number(process.env.PRESTIGE_LADDER_MAX || 10);

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

async function applyUpdatesInTx(client, kingdomId, updates) {
  const colRows = await client.query(
    `SELECT column_name AS name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'kingdoms'`,
  );
  const valid = new Set(colRows.rows.map((r) => r.name));
  const entries = Object.entries(updates).filter(
    ([col, val]) => valid.has(col) && val !== undefined && val !== null,
  );
  if (!entries.length) throw new Error('no valid columns');
  const sets = entries.map(([col], i) => `"${col}" = $${i + 1}`);
  const vals = entries.map(([, v]) => v);
  vals.push(kingdomId);
  await client.query(`UPDATE kingdoms SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
  return entries.length;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('FAIL: DATABASE_URL required');
    process.exit(1);
  }

  console.log('=== Prestige ladder live DB ===');
  console.log(`Climbing prestige 0 ΓåÆ ${MAX_PRESTIGE} (mults hard-cap at 5)`);
  console.log(`Level gate=${PRESTIGE_LEVEL_GATE}, cooldown=${PRESTIGE_COOLDOWN_TURNS} turns\n`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // Ensure column
    const col = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='kingdoms' AND column_name='last_prestige_turn'`,
    );
    if (col.rowCount === 0) {
      await client.query(`ALTER TABLE kingdoms ADD COLUMN last_prestige_turn INTEGER NOT NULL DEFAULT 0`);
    }

    let player = (await client.query(`SELECT id FROM players WHERE username=$1`, ['prestige_ladder_bot'])).rows[0];
    if (!player) {
      player = (
        await client.query(
          `INSERT INTO players (username, password, is_admin) VALUES ($1,$2,0) RETURNING id`,
          ['prestige_ladder_bot', 'ladder_not_for_login'],
        )
      ).rows[0];
    }
    let k = (await client.query(`SELECT id FROM kingdoms WHERE player_id=$1`, [player.id])).rows[0];
    if (!k) {
      k = (
        await client.query(
          `INSERT INTO kingdoms (player_id, name, race, region, level, prestige_level, turn, land, gold, food, mana, population)
           VALUES ($1,'LadderRealm','human','human',500,0,100,500,1000,1000,1000,1000) RETURNING id`,
          [player.id],
        )
      ).rows[0];
    }
    const kid = k.id;

    // Start at P0, L500
    await client.query(
      `UPDATE kingdoms SET level=$1, prestige_level=0, last_prestige_turn=0, turn=100,
        fighters=999, bld_castles=10, bld_farms=100, land=9999, gold=1 WHERE id=$2`,
      [PRESTIGE_LEVEL_GATE, kid],
    );

    let turnCounter = 100;
    const expectedTitles = {
      0: 'Mortal',
      1: 'Awakened',
      2: 'Awakened',
      3: 'Bloodmarked',
      4: 'Bloodmarked',
      5: 'Ascendant',
      6: 'Ascendant',
      7: 'Primordial',
      8: 'Primordial',
      9: 'Worldscarred',
      10: 'Worldscarred',
    };

    for (let fromP = 0; fromP < MAX_PRESTIGE; fromP++) {
      const toP = fromP + 1;
      console.log(`--- Rebirth P${fromP} ΓåÆ P${toP} ---`);

      // Eligible: L500, cooldown cleared
      turnCounter += PRESTIGE_COOLDOWN_TURNS + 1;
      await client.query(
        `UPDATE kingdoms SET level=$1, prestige_level=$2, last_prestige_turn=0, turn=$3,
          fighters=500, bld_castles=7, bld_markets=9, bld_farms=80, land=8000, gold=42 WHERE id=$4`,
        [PRESTIGE_LEVEL_GATE, fromP, turnCounter, kid],
      );

      await client.query('BEGIN');
      try {
        const locked = (await client.query(`SELECT * FROM kingdoms WHERE id=$1 FOR UPDATE`, [kid])).rows[0];
        assert.strictEqual(Number(locked.prestige_level), fromP, `pre prestige_level`);
        assert.strictEqual(Number(locked.level), PRESTIGE_LEVEL_GATE, `pre level`);
        assert.ok(prestige.canPrestige(locked), `canPrestige at P${fromP}`);

        const result = prestige.processPrestige(locked);
        assert.ok(!result.error, result.error);
        assert.strictEqual(result.newPrestigeLevel, toP);
        assert.strictEqual(result.seeds.land, landSeed(toP), `land seed P${toP}`);
        assert.strictEqual(result.seeds.gold, goldSeed(toP), `gold seed P${toP}`);

        const n = await applyUpdatesInTx(client, kid, result.updates);
        assert.ok(n > 20, `applied cols ${n}`);
        await prestige.applyPrestigeSideEffects(makeTxDb(client), kid);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }

      const after = (await client.query(`SELECT * FROM kingdoms WHERE id=$1`, [kid])).rows[0];
      assert.strictEqual(Number(after.prestige_level), toP, `post prestige_level`);
      assert.strictEqual(Number(after.level), 1, `post level 1`);
      assert.strictEqual(Number(after.xp) || 0, 0, `post xp 0`);
      assert.strictEqual(Number(after.land), landSeed(toP));
      assert.strictEqual(Number(after.gold), goldSeed(toP));
      assert.strictEqual(Number(after.fighters), 0);
      assert.strictEqual(Number(after.bld_castles), 0);
      assert.strictEqual(Number(after.bld_farms), STARTER_BUILDINGS.bld_farms);
      assert.strictEqual(Number(after.last_prestige_turn), turnCounter);

      // Immediate re-prestige blocked
      assert.strictEqual(prestige.canPrestige(after), false, `cooldown after P${toP}`);

      // Mults: clamp to 5
      const mods = getPrestigeModifiers(toP);
      const modsCapped = getPrestigeModifiers(Math.min(toP, 5));
      assert.deepStrictEqual(mods, modsCapped, `mults clamp at 5 for P${toP}`);
      if (toP >= 5) {
        const m5 = getPrestigeModifiers(5);
        assert.strictEqual(mods.combat, m5.combat);
        assert.strictEqual(mods.econ, m5.econ);
        assert.strictEqual(mods.bldCap, m5.bldCap);
        assert.strictEqual(mods.pop, m5.pop);
      }

      // Combat helper vs P0 baseline
      const base = 10000;
      const p0Pow = applyPrestigeCombatMultiplier(base, 0);
      const pPow = applyPrestigeCombatMultiplier(base, toP);
      assert.strictEqual(p0Pow, 10000);
      assert.strictEqual(pPow, Math.round(10000 * mods.combat));

      const title = getPrestigeTitle(toP);
      if (expectedTitles[toP] !== undefined) {
        assert.strictEqual(title, expectedTitles[toP], `title P${toP}`);
      }

      console.log(
        `  Γ£ô P${fromP}ΓåÆP${toP}: land=${after.land} gold=${after.gold} ` +
          `combat├ù${mods.combat} econ├ù${mods.econ} bldCap├ù${mods.bldCap} title=${title}`,
      );
    }

    // Final state
    const final = (await client.query(`SELECT prestige_level, level, land, gold FROM kingdoms WHERE id=$1`, [kid]))
      .rows[0];
    assert.strictEqual(Number(final.prestige_level), MAX_PRESTIGE);
    assert.strictEqual(Number(final.level), 1);

    // Mult stability P5 vs P10
    assert.deepStrictEqual(getPrestigeModifiers(5), getPrestigeModifiers(10));
    assert.strictEqual(applyPrestigeCombatMultiplier(10000, 5), applyPrestigeCombatMultiplier(10000, 10));
    assert.strictEqual(applyPrestigeCombatMultiplier(10000, 5), 10500);

    console.log(`\nΓ£ô Ladder complete: prestige 0 ΓåÆ ${MAX_PRESTIGE} (${MAX_PRESTIGE} rebirths)`);
    console.log(`  Final: prestige=${final.prestige_level} level=${final.level} land=${final.land} gold=${final.gold}`);
    console.log(`  Mult hard-cap verified: P5 combat = P10 combat = 1.05`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
