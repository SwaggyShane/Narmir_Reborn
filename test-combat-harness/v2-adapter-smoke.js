const { spawnSync } = require('child_process');

const smokeProgram = `
const engine = require('./game/engine');
const levels = JSON.stringify({
  engineers: { level: 25 },
  fighters: { level: 10 },
  war_machines: { level: 5 },
  thieves: { level: 5 }
});
const base = {
  land: 1000,
  turn: 1,
  level: 1,
  xp: 0,
  xp_sources: '{}',
  troop_levels: levels,
  happiness: 70,
  happiness: 100,
  injured_troops: '{}',
  training_allocation: '{}',
  weapons_stockpile: 1000,
  armor_stockpile: 1000,
  ladders: 5,
  ballistae: 0,
  res_weapons: 100,
  res_armor: 100,
  res_war_machines: 100,
  res_military: 100,
  res_attack_magic: 100,
  res_defense_magic: 100,
  bld_walls: 10,
  wall_hp: 1000,
  wall_defense_type: 'fortified',
  discovered_kingdoms: '{}'
};
const attacker = {
  ...base,
  id: 1,
  name: 'Attacker',
  race: 'dwarf',
  fighters: 100,
  rangers: 0,
  mages: 0,
  clerics: 10,
  ninjas: 0,
  thieves: 10,
  engineers: 25,
  war_machines: 20
};
const defender = {
  ...base,
  id: 2,
  name: 'Defender',
  race: 'human',
  fighters: 120,
  rangers: 20,
  mages: 0,
  clerics: 5,
  ninjas: 0,
  thieves: 0,
  engineers: 30,
  war_machines: 15
};
const result = engine.resolveMilitaryAttack(attacker, defender, {
  fighters: 100,
  thieves: 10,
  clerics: 10,
  engineers: 25,
  warMachines: 20,
  ladders: 5
});
console.log(JSON.stringify({
  combatSystem: result.report.combatSystem || 'v1',
  hasContract: Boolean(
    typeof result.win === 'boolean' &&
    result.report &&
    result.attackerUpdates &&
    result.defenderUpdates &&
    result.atkEvent &&
    result.defEvent
  ),
  attackerCrew: result.report.diagnostics?.attacker?.warMachines || null,
  hasDiagnostics: Boolean(result.report.diagnostics?.attacker?.hpByType && result.report.diagnostics?.defender?.dmgByType),
  disabledWarMachines: result.report.disabledWarMachines || 0,
  hasV1ReportAliases: Boolean(
    typeof result.report.atkFightersLost === 'number' &&
    typeof result.report.defFightersLost === 'number' &&
    typeof result.report.atkPower === 'number' &&
    typeof result.report.defPower === 'number' &&
    typeof result.report.landTransferred === 'number' &&
    Array.isArray(result.report.steps)
  ),
  hasWallDiagnostics: Boolean(
    typeof result.report.wallHpBefore === 'number' &&
    typeof result.report.wallHpAfter === 'number'
  )
}));
`;

function runSmoke(env) {
  const result = spawnSync(process.execPath, ['-e', smokeProgram], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Smoke process failed');
  }

  return JSON.parse(result.stdout);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// V2 became the default combat path 2026-07-15 (elevation combat bonus only
// applies on this path) — USE_COMBAT_V2 is now opt-OUT ("0"), not opt-in.
const defaultResult = runSmoke({ USE_COMBAT_V2: '' });
assert(defaultResult.combatSystem === 'v2', 'V2 should be the default combat path as of 2026-07-15');
assert(defaultResult.hasContract, 'Default combat path must preserve the attack result contract');
assert(defaultResult.hasDiagnostics, 'Default (V2) combat path must include diagnostics');

const v1Result = runSmoke({ USE_COMBAT_V2: '0' });
assert(v1Result.combatSystem === 'v1', 'USE_COMBAT_V2=0 should force the legacy V1 path');
assert(v1Result.hasContract, 'V1 opt-out path must preserve the attack result contract');

const v2Result = runSmoke({ USE_COMBAT_V2: '1' });
assert(v2Result.combatSystem === 'v2', 'USE_COMBAT_V2=1 should activate the V2 adapter');
assert(v2Result.hasContract, 'V2 adapter must preserve the attack result contract');
assert(v2Result.hasDiagnostics, 'V2 adapter must include diagnostics');
assert(v2Result.hasV1ReportAliases, 'V2 adapter must expose V1-compatible report aliases');
assert(v2Result.hasWallDiagnostics, 'V2 adapter must expose wall HP diagnostics');
assert(v2Result.attackerCrew?.crewRequired === 1, 'Dwarf level-25 engineers should solo-crew war machines');
assert(v2Result.attackerCrew?.crewed === 20, 'Dwarf level-25 engineers should crew all 20 test machines');
assert(v2Result.disabledWarMachines > 0, 'V2 thief sabotage should disable defender war machines in the smoke setup');

console.log('Combat V2 adapter smoke passed');
