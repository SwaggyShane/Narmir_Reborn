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
const defDisc = JSON.parse(result.defenderUpdates.discovered_kingdoms || '{}');
console.log(JSON.stringify({
  combatSystem: result.report.combatSystem,
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
  hasReportAliases: Boolean(
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
  ),
  defenderMappedAttacker: Boolean(defDisc[1] && defDisc[1].found && defDisc[1].mapped),
  disabledWarMachines: result.report.disabledWarMachines || 0
}));
`;

function runSmoke(env = {}) {
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

// Combat V2 is the only military path (USE_COMBAT_V2 ignored / removed).
const result = runSmoke();
assert(result.combatSystem === 'v2', 'Combat must resolve as V2');
assert(result.hasContract, 'Combat path must preserve the attack result contract');
assert(result.hasDiagnostics, 'Combat path must include diagnostics');
assert(result.hasReportAliases, 'Combat path must expose report aliases for routes/UI');
assert(result.hasWallDiagnostics, 'Combat path must expose wall HP diagnostics');
assert(result.defenderMappedAttacker, 'Defender must map attacker after combat (discovery)');
assert(result.attackerCrew?.crewRequired === 1, 'Dwarf level-25 engineers should solo-crew war machines');
assert(result.attackerCrew?.crewed === 20, 'Dwarf level-25 engineers should crew all 20 test machines');
assert(result.disabledWarMachines > 0, 'Thief sabotage should disable defender war machines in the smoke setup');

// Env opt-out must no longer switch systems
const forcedOff = runSmoke({ USE_COMBAT_V2: '0' });
assert(forcedOff.combatSystem === 'v2', 'USE_COMBAT_V2=0 must not re-enable legacy combat');

console.log('Combat V2 adapter smoke passed');
