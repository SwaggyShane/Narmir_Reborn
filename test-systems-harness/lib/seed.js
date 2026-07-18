'use strict';

/**
 * Seed / cleanup helpers for systems DB integration tests.
 * Creates two well-stocked kingdoms (attacker + defender) safe to mutate.
 */

const { pgInList } = require('../../lib/pg-placeholders');

const PREFIX = 'sys_viability_';

function troopLevels(overrides = {}) {
  return JSON.stringify({
    fighters: { level: 20, xp: 0 },
    rangers: { level: 20, xp: 0 },
    mages: { level: 20, xp: 0 },
    clerics: { level: 20, xp: 0 },
    thieves: { level: 50, xp: 0 },
    ninjas: { level: 20, xp: 0 },
    engineers: { level: 50, xp: 0 },
    war_machines: { level: 20, xp: 0 },
    ...overrides,
  });
}

async function insertPlayer(db, username) {
  await db.run(
    'INSERT INTO players (username, password, email) VALUES ($1, $2, $3)',
    [username, 'sys-viability-hash', `${username}@local.test`],
  );
  return db.get('SELECT id FROM players WHERE username = $1', [username]);
}

/**
 * Insert a kingdom stocked for multi-system exercise.
 * @param {object} db
 * @param {number} playerId
 * @param {object} opts
 */
async function insertStockedKingdom(db, playerId, opts = {}) {
  const {
    name = 'Sys Test',
    race = 'human',
    role = 'attacker',
  } = opts;

  const isAttacker = role === 'attacker';

  await db.run(
    `INSERT INTO kingdoms (
      player_id, name, race, turn, turns_stored, gold, food, population, land, happiness, mana,
      fighters, rangers, mages, thieves, ninjas, clerics, engineers, researchers, scribes,
      war_machines, ballistae, ladders,
      bld_walls, bld_guard_towers, bld_mage_towers, bld_outposts, bld_castles, bld_farms,
      bld_markets, bld_housing, bld_barracks, bld_armories, bld_schools, bld_libraries,
      bld_shrines, bld_smithies, bld_vaults, bld_training, bld_mausoleums, bld_granaries, bld_taverns,
      res_military, res_weapons, res_armor, res_war_machines, res_attack_magic, res_defense_magic,
      res_economy, res_entertainment, res_spellbook, school_spellbook, school_of_magic,
      troop_levels, equipment_levels, injured_troops, wall_hp, wall_defense_type,
      weapons_stockpile, armor_stockpile, discovered_kingdoms, scrolls, maps,
      hammers_stored, blueprints_stored, tax
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
      $12,$13,$14,$15,$16,$17,$18,$19,$20,
      $21,$22,$23,
      $24,$25,$26,$27,$28,$29,
      $30,$31,$32,$33,$34,$35,
      $36,$37,$38,$39,$40,$41,$42,
      $43,$44,$45,$46,$47,$48,
      $49,$50,$51,$52,$53,
      $54,$55,$56,$57,$58,
      $59,$60,$61,$62,$63,
      $64,$65,$66
    )`,
    [
      playerId,
      name,
      race,
      500, // past newbie protection
      200, // turns stored
      5_000_000,
      100_000,
      50_000,
      2000,
      80,
      50_000, // mana
      isAttacker ? 800 : 200,
      isAttacker ? 200 : 50,
      isAttacker ? 100 : 20,
      isAttacker ? 300 : 20,
      isAttacker ? 50 : 10,
      isAttacker ? 50 : 20,
      isAttacker ? 80 : 10,
      200,
      50,
      isAttacker ? 30 : 5,
      isAttacker ? 0 : 12,
      isAttacker ? 20 : 0,
      isAttacker ? 5 : 15,
      isAttacker ? 5 : 10,
      10,
      5,
      3,
      20,
      10,
      15,
      10,
      10,
      10,
      5,
      5,
      5,
      5,
      5,
      3,
      10,
      5,
      100,
      100,
      100,
      100,
      100,
      100,
      100,
      100,
      500, // res_spellbook high enough for tier 1-2
      500,
      null,
      troopLevels(),
      JSON.stringify({ weapons: { level: 1, count: 1000 }, armor: { level: 1, count: 1000 } }),
      '{}',
      isAttacker ? 0 : 1000,
      'fortified',
      1000,
      1000,
      '{}',
      JSON.stringify({ spark: 5, mend: 5, fog_of_war: 3, lightning: 2, bless: 2 }),
      10,
      50,
      20,
      42,
    ],
  );

  return db.get('SELECT * FROM kingdoms WHERE player_id = $1', [playerId]);
}

/**
 * Create attacker + defender pair. Returns handles for cleanup.
 */
async function seedPair(db, suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`) {
  const atkUser = `${PREFIX}atk_${suffix}`;
  const defUser = `${PREFIX}def_${suffix}`;

  const atkPlayer = await insertPlayer(db, atkUser);
  const defPlayer = await insertPlayer(db, defUser);

  const attacker = await insertStockedKingdom(db, atkPlayer.id, {
    name: `SysAtk ${suffix}`,
    race: 'dwarf',
    role: 'attacker',
  });
  const defender = await insertStockedKingdom(db, defPlayer.id, {
    name: `SysDef ${suffix}`,
    race: 'human',
    role: 'defender',
  });

  // Discover / map each other (legacy field still used in some paths)
  await db.run('UPDATE kingdoms SET discovered_kingdoms = $1 WHERE id = $2', [
    JSON.stringify({ [defender.id]: { found: true, mapped: true } }),
    attacker.id,
  ]);
  await db.run('UPDATE kingdoms SET discovered_kingdoms = $1 WHERE id = $2', [
    JSON.stringify({ [attacker.id]: { found: true, mapped: true } }),
    defender.id,
  ]);

  return {
    suffix,
    attackerPlayerId: atkPlayer.id,
    defenderPlayerId: defPlayer.id,
    attackerId: attacker.id,
    defenderId: defender.id,
    attackerUsername: atkUser,
    defenderUsername: defUser,
    usernames: [atkUser, defUser],
    kingdomIds: [attacker.id, defender.id],
  };
}

async function reloadKingdom(db, id) {
  return db.get('SELECT * FROM kingdoms WHERE id = $1', [id]);
}

async function cleanupPair(db, pair) {
  if (!pair) return;
  const ids = (pair.kingdomIds || []).filter(Boolean);
  try {
    if (ids.length) {
      const inList = pgInList(ids.length);
      const inList2 = pgInList(ids.length, ids.length + 1);
      await db.run(`DELETE FROM news WHERE kingdom_id IN (${inList})`, ids).catch(() => {});
      await db.run(
        `DELETE FROM war_log WHERE attacker_id IN (${inList}) OR defender_id IN (${inList2})`,
        [...ids, ...ids],
      ).catch(() => {});
      await db.run(`DELETE FROM heroes WHERE kingdom_id IN (${inList})`, ids).catch(() => {});
      await db.run(`DELETE FROM expeditions WHERE kingdom_id IN (${inList})`, ids).catch(() => {});
      await db.run(`DELETE FROM spy_reports WHERE kingdom_id IN (${inList})`, ids).catch(() => {});
      await db.run(`DELETE FROM happiness_history WHERE kingdom_id IN (${inList})`, ids).catch(() => {});
      await db.run(`DELETE FROM kingdoms WHERE id IN (${inList})`, ids);
    }
    if (pair.usernames && pair.usernames.length) {
      for (const u of pair.usernames) {
        await db.run('DELETE FROM players WHERE username = $1', [u]).catch(() => {});
      }
    } else {
      await db.run(`DELETE FROM players WHERE username LIKE $1`, [`${PREFIX}%`]).catch(() => {});
    }
  } catch (err) {
    console.warn('[seed] cleanup warning:', err.message);
  }
}

/** Best-effort wipe of leftover harness rows from crashed runs. */
async function cleanupOrphans(db) {
  try {
    const rows = await db.all(
      `SELECT k.id FROM kingdoms k JOIN players p ON p.id = k.player_id WHERE p.username LIKE $1`,
      [`${PREFIX}%`],
    );
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      const inList = pgInList(ids.length);
      const inList2 = pgInList(ids.length, ids.length + 1);
      await db.run(`DELETE FROM news WHERE kingdom_id IN (${inList})`, ids).catch(() => {});
      await db.run(
        `DELETE FROM war_log WHERE attacker_id IN (${inList}) OR defender_id IN (${inList2})`,
        [...ids, ...ids],
      ).catch(() => {});
      await db.run(`DELETE FROM happiness_history WHERE kingdom_id IN (${inList})`, ids).catch(() => {});
      await db.run(`DELETE FROM kingdoms WHERE id IN (${inList})`, ids);
    }
    await db.run(`DELETE FROM players WHERE username LIKE $1`, [`${PREFIX}%`]);
  } catch {
    // ignore
  }
}

module.exports = {
  PREFIX,
  seedPair,
  cleanupPair,
  cleanupOrphans,
  reloadKingdom,
  insertStockedKingdom,
  troopLevels,
};
