process.env.USE_COMBAT_V2 = '1';

require('dotenv').config();
const { initDb, applyKingdomUpdates } = require('../db/schema');
const { pgInList } = require('../lib/pg-placeholders');
const engine = require('../game/engine');

const KINGDOM_ATTACK_SELECT = `id, player_id, name, race, turn, turns_stored, gold, food, population, land, happiness,
  fighters, rangers, mages, thieves, ninjas, clerics, engineers, war_machines, ballistae,
  bld_walls, bld_guard_towers, bld_mage_towers, bld_outposts, bld_castles,
  res_military, res_weapons, res_armor, res_war_machines, res_attack_magic, res_defense_magic,
  troop_levels, equipment_levels, injured_troops, wall_hp, wall_defense_type, ladders, weapons_stockpile, armor_stockpile,
  level, mausoleum_upgrades, shrine_upgrades, wall_upgrades, tower_def_upgrades, outpost_upgrades,
  defense_upgrades, milestone_bonuses, prestige_level, xp, xp_sources, discovered_kingdoms`;

function levels(overrides = {}) {
  return JSON.stringify({
    fighters: { level: 10 },
    engineers: { level: 200 },
    war_machines: { level: 10 },
    thieves: { level: 10 },
    ...overrides,
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function insertPlayer(db, username) {
  await db.run(
    'INSERT INTO players (username, password, email) VALUES ($1, $2, $3)',
    [username, 'codex-local-smoke', `${username}@local.test`],
  );
  return db.get('SELECT id FROM players WHERE username = $1', [username]);
}

async function insertKingdom(db, playerId, data) {
  await db.run(
    `INSERT INTO kingdoms (
      player_id, name, race, turn, land, fighters, rangers, mages, clerics, thieves, ninjas,
      engineers, war_machines, ballistae, ladders, bld_walls, wall_hp, wall_defense_type,
      res_weapons, res_armor, res_military, res_war_machines, res_attack_magic, res_defense_magic,
      troop_levels, equipment_levels, injured_troops, discovered_kingdoms, weapons_stockpile, armor_stockpile
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)`,
    [
      playerId,
      data.name,
      data.race,
      500,
      data.land,
      data.fighters,
      data.rangers,
      data.mages,
      data.clerics,
      data.thieves,
      data.ninjas,
      data.engineers,
      data.war_machines,
      data.ballistae || 0,
      data.ladders,
      data.bld_walls,
      data.wall_hp,
      data.wall_defense_type,
      100,
      100,
      100,
      100,
      100,
      100,
      levels(data.levels),
      data.equipment_levels || '{}',
      data.injured_troops || '{}',
      data.discovered_kingdoms || '{}',
      1000,
      1000,
    ],
  );
  return db.get('SELECT id FROM kingdoms WHERE player_id = $1', [playerId]);
}

async function cleanup(db, ids) {
  const validIds = ids.filter(Boolean);
  if (validIds.length === 0) return;
  const inList = pgInList(validIds.length);
  const inList2 = pgInList(validIds.length, validIds.length + 1);
  await db.run(`DELETE FROM news WHERE kingdom_id IN (${inList})`, validIds);
  await db.run(`DELETE FROM war_log WHERE attacker_id IN (${inList}) OR defender_id IN (${inList2})`, [...validIds, ...validIds]);
  await db.run(`DELETE FROM kingdoms WHERE id IN (${inList})`, validIds);
  await db.run(`DELETE FROM players WHERE username LIKE $1`, ['codex_v2_route_%']);
}

async function main() {
  const db = await initDb();
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const playerNames = [`codex_v2_route_atk_${suffix}`, `codex_v2_route_def_${suffix}`];
  const createdKingdomIds = [];

  try {
    const attackerPlayer = await insertPlayer(db, playerNames[0]);
    const defenderPlayer = await insertPlayer(db, playerNames[1]);

    const attackerRow = await insertKingdom(db, attackerPlayer.id, {
      name: `Codex V2 Attacker ${suffix}`,
      race: 'dwarf',
      land: 1000,
      fighters: 500,
      rangers: 0,
      mages: 25,
      clerics: 25,
      thieves: 10,
      ninjas: 0,
      engineers: 50,
      war_machines: 20,
      ballistae: 0,
      ladders: 10,
      bld_walls: 0,
      wall_hp: 0,
      wall_defense_type: 'fortified',
      levels: { engineers: { level: 200 } },
    });
    const defenderRow = await insertKingdom(db, defenderPlayer.id, {
      name: `Codex V2 Defender ${suffix}`,
      race: 'human',
      land: 1000,
      fighters: 1,
      rangers: 0,
      mages: 0,
      clerics: 0,
      thieves: 0,
      ninjas: 0,
      engineers: 0,
      war_machines: 0,
      ballistae: 12,
      ladders: 0,
      bld_walls: 10,
      wall_hp: 1000,
      wall_defense_type: 'fortified',
    });

    createdKingdomIds.push(attackerRow.id, defenderRow.id);

    await db.run(
      'UPDATE kingdoms SET discovered_kingdoms = $1 WHERE id = $2',
      [JSON.stringify({ [defenderRow.id]: { found: true, mapped: true } }), attackerRow.id],
    );

    const attacker = await db.get(`SELECT ${KINGDOM_ATTACK_SELECT} FROM kingdoms WHERE id = $1`, [attackerRow.id]);
    const defender = await db.get(`SELECT ${KINGDOM_ATTACK_SELECT} FROM kingdoms WHERE id = $1`, [defenderRow.id]);

    for (const field of ['ballistae', 'res_war_machines', 'res_attack_magic', 'res_defense_magic', 'injured_troops', 'wall_hp', 'wall_defense_type', 'discovered_kingdoms', 'weapons_stockpile', 'armor_stockpile', 'equipment_levels']) {
      assert(attacker[field] !== undefined, `Route attack SELECT missing attacker.${field}`);
      assert(defender[field] !== undefined, `Route attack SELECT missing defender.${field}`);
    }

    const result = engine.resolveMilitaryAttack(
      attacker,
      defender,
      { fighters: 500, mages: 25, clerics: 25, thieves: 10, engineers: 50, warMachines: 20, ladders: 10 },
      [],
      [],
    );

    assert(!result.error, result.error || 'V2 route-equivalent attack returned an error');
    assert(result.report.combatSystem === 'v2', 'Route-equivalent attack did not use Combat V2');
    assert(result.report.wallDamage > 0, 'V2 route-equivalent attack should damage wall HP');
    assert(result.report.diagnostics?.attacker?.warMachines?.crewed === 20, 'V2 route-equivalent diagnostics should show crewed war machines');
    assert(result.report.diagnostics?.defender?.structureDefense?.ballistae === 5, 'V2 route-equivalent diagnostics should mount ballistae on walls');
    assert(typeof result.report.atkFightersLost === 'number', 'V2 report should expose V1-compatible loss aliases');

    await applyKingdomUpdates(attacker.id, result.attackerUpdates);
    await applyKingdomUpdates(defender.id, result.defenderUpdates);

    const detail = JSON.stringify({
      sent: result.report.sent,
      landTaken: result.report.landTransferred,
      atkLost: result.report.atkFightersLost,
      defLost: result.report.defFightersLost,
      steps: result.report.steps || [],
      ...result.report,
    });
    await db.run(
      `INSERT INTO war_log (action_type, attacker_id, attacker_name, defender_id, defender_name, outcome, detail, obscured)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0)`,
      ['attack', attacker.id, attacker.name, defender.id, defender.name, result.win ? 'victory' : 'repelled', detail],
    );

    const persistedAttacker = await db.get('SELECT injured_troops FROM kingdoms WHERE id = $1', [attacker.id]);
    const persistedDefender = await db.get('SELECT wall_hp, injured_troops, weapons_stockpile, armor_stockpile, equipment_levels FROM kingdoms WHERE id = $1', [defender.id]);
    const log = await db.get('SELECT detail FROM war_log WHERE attacker_id = $1 AND defender_id = $2 ORDER BY id DESC LIMIT 1', [attacker.id, defender.id]);
    const parsedDetail = JSON.parse(log.detail);

    assert(JSON.parse(persistedAttacker.injured_troops), 'Persisted attacker injured_troops should be JSON');
    assert(JSON.parse(persistedDefender.injured_troops), 'Persisted defender injured_troops should be JSON');
    assert(persistedDefender.wall_hp < 1000, 'Persisted defender wall_hp should decrease');
    assert(persistedDefender.weapons_stockpile === 1000, 'Persisted defender weapon stockpile should recover dead equipped defender weapon');
    assert(persistedDefender.armor_stockpile === 1000, 'Persisted defender armor stockpile should recover dead equipped defender armor');
    const persistedEquipment = JSON.parse(persistedDefender.equipment_levels);
    assert(persistedEquipment.weapons?.count === 1000, 'Persisted defender weapon quality count should match recovered stockpile');
    assert(persistedEquipment.armor?.count === 1000, 'Persisted defender armor quality count should match recovered stockpile');
    assert(parsedDetail.combatSystem === 'v2', 'War log detail should preserve combatSystem');
    assert(parsedDetail.diagnostics?.attacker?.hpByType, 'War log detail should preserve diagnostics');
    assert(Array.isArray(parsedDetail.steps), 'War log detail should preserve report steps');

    console.log(JSON.stringify({
      ok: true,
      combatSystem: result.report.combatSystem,
      wallHpBefore: result.report.wallHpBefore,
      wallHpAfter: persistedDefender.wall_hp,
      attackerInjuredTroops: persistedAttacker.injured_troops,
      defenderInjuredTroops: persistedDefender.injured_troops,
      defenderWeaponsStockpile: persistedDefender.weapons_stockpile,
      defenderArmorStockpile: persistedDefender.armor_stockpile,
      defenderEquipmentLevels: persistedDefender.equipment_levels,
      warLogHasDiagnostics: Boolean(parsedDetail.diagnostics),
    }, null, 2));
  } finally {
    await cleanup(db, createdKingdomIds);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
