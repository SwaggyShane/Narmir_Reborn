/**
 * Combat System v2 - Individual Trooper HP & Injury States
 * Rework with individual troop tracking, injuries, walls, ladders
 *
 * TODO: Wire this into engine.js to replace the current percentage-based combat.
 * Integration points needed:
 *   - Add `injured_troops` JSON column to kingdoms table (DB migration required)
 *   - Replace processAttack/processRaid/processSiege calls in engine.js with
 *     combat-resolver.js executeCombat()
 *   - Handle injury healing each turn (processTurn loop)
 *   - Surface injury state to frontend (StatusPanel, WarfarePanel)
 * Status: Complete but unintegrated — never wired into the active game loop.
 */

// ── TROOP BASE STATS ──────────────────────────────────────────────────────

const TROOP_BASE_STATS = {
  fighters: { hp: 250, dmg: 25, hpLevelScale: 2.0, dmgLevelScale: 1.0 },
  rangers: { hp: 100, dmg: 15, hpLevelScale: 0.8, dmgLevelScale: 0.6 },
  mages: { hp: 25, dmg: 30, hpLevelScale: 0.2, dmgLevelScale: 1.2 },
  clerics: { hp: 150, dmg: 15, hpLevelScale: 1.2, dmgLevelScale: 0.6 },
  ninjas: { hp: 50, dmg: 10, hpLevelScale: 0.4, dmgLevelScale: 0.4 },
  thieves: { hp: 75, dmg: 15, hpLevelScale: 0.6, dmgLevelScale: 0.6 },
  engineers: { hp: 100, dmg: 0, hpLevelScale: 0.8, dmgLevelScale: 0 },
  war_machines: { hp: 500, dmg: 40, hpLevelScale: 4.0, dmgLevelScale: 1.6 },
};

// ── INJURY STATES ────────────────────────────────────────────────────────

const INJURY_STATES = {
  HEALTHY: { name: 'healthy', minHpPercent: 75, maxHpPercent: 100, healingSpeed: 1.0 },
  LIGHTLY_INJURED: { name: 'lightly_injured', minHpPercent: 50, maxHpPercent: 74, healingSpeed: 0.8 },
  MODERATELY_INJURED: { name: 'moderately_injured', minHpPercent: 25, maxHpPercent: 49, healingSpeed: 0.6 },
  HEAVILY_INJURED: { name: 'heavily_injured', minHpPercent: 1, maxHpPercent: 24, healingSpeed: 0.4 },
  DEAD: { name: 'dead', minHpPercent: 0, maxHpPercent: 0, healingSpeed: 0 },
};

function getInjuryState(currentHp, maxHp) {
  if (currentHp <= 0) return INJURY_STATES.DEAD;
  const hpPercent = (currentHp / maxHp) * 100;
  if (hpPercent >= 75) return INJURY_STATES.HEALTHY;
  if (hpPercent >= 50) return INJURY_STATES.LIGHTLY_INJURED;
  if (hpPercent >= 25) return INJURY_STATES.MODERATELY_INJURED;
  return INJURY_STATES.HEAVILY_INJURED;
}

// ── INDIVIDUAL TROOP HP & DMG CALCULATION ────────────────────────────────

/**
 * Calculate individual troop HP
 * HP = (Base HP × Racial Modifier) + (Armor Research × 1) + (Troop Level × HP Level Scaling)
 */
function calculateIndividualTroopHp(troopType, armorResearch, troopLevel, racialModifier = 1.0) {
  const base = TROOP_BASE_STATS[troopType];
  if (!base) throw new Error(`Unknown troop type: ${troopType}`);

  const baseHp = base.hp * racialModifier;
  const armorBonus = armorResearch * 1;
  const levelBonus = troopLevel * base.hpLevelScale;

  return baseHp + armorBonus + levelBonus;
}

/**
 * Calculate individual troop damage
 * DMG = (Base DMG × Racial Modifier) + (Weapon Research × 0.1) + (Troop Level × DMG Level Scaling)
 */
function calculateIndividualTroopDmg(troopType, weaponResearch, troopLevel, racialModifier = 1.0) {
  const base = TROOP_BASE_STATS[troopType];
  if (!base) throw new Error(`Unknown troop type: ${troopType}`);

  const baseDmg = base.dmg * racialModifier;
  const weaponBonus = weaponResearch * 0.1;
  const levelBonus = troopLevel * base.dmgLevelScale;

  return baseDmg + weaponBonus + levelBonus;
}

// ── WALL HP CALCULATION ──────────────────────────────────────────────────

const WALL_DEFENSE_RATINGS = {
  fortified: 100,    // HP per wall unit
  keep: 500,         // HP per wall unit
  citadel: 1000,     // HP per wall unit
};

/**
 * Calculate total wall HP based on wall count and defense type
 */
function calculateWallHp(wallCount, defenseType) {
  if (!WALL_DEFENSE_RATINGS[defenseType]) {
    return 0; // No walls if no defensive structure
  }
  return wallCount * WALL_DEFENSE_RATINGS[defenseType];
}

// ── DISTANCE PENALTIES ───────────────────────────────────────────────────

const COMBAT_LINES = {
  FRONT: 0,      // Fighters
  SECOND: 1,     // Clerics
  THIRD: 2,      // Rangers
  BACK: 3,       // Mages
  FAR_BACK: 4,   // War Machines
};

/**
 * Calculate distance penalty (0-4 lines)
 * Damage/Success Multiplier = 1 - (Distance × 0.2)
 * Distance 0: 100%, Distance 1: 80%, Distance 2: 60%, Distance 3: 40%, Distance 4: 20%
 */
function calculateDistancePenalty(distance) {
  const multiplier = 1 - (distance * 0.2);
  return Math.max(0.2, multiplier); // Min 20% (distance 4)
}

// ── ENGINEER ACCURACY (LADDER HITTING WALLS) ─────────────────────────────

/**
 * Calculate engineer hit chance on walls
 * Hit Chance = engineer_level × 0.5%
 * Level 0: 0%, Level 120: 60%
 */
function calculateEngineerHitChance(engineerLevel) {
  return (engineerLevel * 0.5) / 100; // Returns decimal (0.0 to 0.6 at max)
}

/**
 * Apply ladder damage to walls
 * Each successful hit: -2% of wall HP
 */
function applyLadderDamage(currentWallHp, maxWallHp) {
  const damagePercent = 0.02;
  const damage = Math.ceil(maxWallHp * damagePercent);
  return Math.max(0, currentWallHp - damage);
}

// ── NINJA ASSASSINATION ──────────────────────────────────────────────────

/**
 * Calculate ninja assassination success rate
 * Success = 50% + (Ninja_Level - Target_Level) × 3%
 */
function calculateNinjaAssassinationChance(ninjaLevel, targetLevel) {
  const baseChance = 0.5;
  const levelDiff = ninjaLevel - targetLevel;
  const modifier = levelDiff * 0.03;
  return Math.max(0, Math.min(1, baseChance + modifier)); // Clamp 0-100%
}

// ── THIEF SABOTAGE ───────────────────────────────────────────────────────

/**
 * Calculate war machine effectiveness reduction from thieves
 * Reduces effectiveness by 25-50%
 */
function calculateThiefSabotage() {
  const minReduction = 0.25;
  const maxReduction = 0.50;
  return minReduction + Math.random() * (maxReduction - minReduction);
}

// ── WAR MACHINE ALLOCATION ───────────────────────────────────────────────

/**
 * Calculate how many war machines go on walls vs back line
 * Ratio: 1 war machine per 2 walls
 */
function allocateWarMachines(wallCount, totalWarMachines) {
  const onWalls = Math.min(Math.floor(wallCount / 2), totalWarMachines);
  const backLine = totalWarMachines - onWalls;
  return { onWalls, backLine };
}

// ── INJURED TROOPS MANAGEMENT ───────────────────────────────────────────

/**
 * Parse injured troops JSON from database
 * Format: { "fighters": [{ hp: 200, max_hp: 320 }, ...], "rangers": [...] }
 */
function parseInjuredTroops(injuredTroopsJson) {
  try {
    return JSON.parse(injuredTroopsJson || '{}');
  } catch {
    return {};
  }
}

/**
 * Serialize injured troops to JSON for database storage
 */
function serializeInjuredTroops(injuredTroops) {
  return JSON.stringify(injuredTroops);
}

/**
 * Add or update an injured troop
 */
function recordInjuredTroop(injuredTroops, troopType, currentHp, maxHp) {
  if (!injuredTroops[troopType]) {
    injuredTroops[troopType] = [];
  }
  injuredTroops[troopType].push({ hp: Math.ceil(currentHp), max_hp: Math.ceil(maxHp) });
  return injuredTroops;
}

/**
 * Get total count of living troops (healthy + injured)
 */
function getLivingTroopCount(injuredTroops, troopType) {
  if (!injuredTroops[troopType]) return 0;
  return injuredTroops[troopType].filter(t => t.hp > 0).length;
}

/**
 * Get total dead troops count (hp <= 0)
 */
function getDeadTroopCount(injuredTroops, troopType) {
  if (!injuredTroops[troopType]) return 0;
  return injuredTroops[troopType].filter(t => t.hp <= 0).length;
}

/**
 * Remove dead troops from injured list
 */
function cleanupDeadTroops(injuredTroops) {
  const cleaned = {};
  for (const [troopType, troops] of Object.entries(injuredTroops)) {
    cleaned[troopType] = troops.filter(t => t.hp > 0);
  }
  return cleaned;
}

/**
 * Apply healing to injured troops in shrine
 * Cleric healing: 1 HP per cleric level per turn
 * Healing speed affected by injury state
 */
function applyShrineHealing(injuredTroops, clerics, clericLevel) {
  const baseHealing = clerics * clericLevel;
  const healed = JSON.parse(JSON.stringify(injuredTroops)); // Deep copy

  for (const troopType of Object.keys(healed)) {
    if (!healed[troopType]) continue;

    for (const troop of healed[troopType]) {
      if (troop.hp <= 0) continue; // Skip dead troops

      const injuryState = getInjuryState(troop.hp, troop.max_hp);
      const healingRate = injuryState.healingSpeed;
      const actualHealing = Math.ceil(baseHealing * healingRate);

      troop.hp = Math.min(troop.max_hp, troop.hp + actualHealing);
    }
  }

  return healed;
}

/**
 * Prevent lethality - Cleric saves a troop from death
 * Restores troop to moderately injured state (50% HP)
 */
function preventLethality(injuredTroops, troopType, troopIndex) {
  if (!injuredTroops[troopType] || !injuredTroops[troopType][troopIndex]) {
    return injuredTroops;
  }

  const troop = injuredTroops[troopType][troopIndex];
  const restoredHp = Math.ceil(troop.max_hp * 0.5); // Restore to 50% (moderately injured)
  troop.hp = Math.max(1, restoredHp); // Ensure at least 1 HP

  return injuredTroops;
}

// ── EXPORTS ──────────────────────────────────────────────────────────────

module.exports = {
  TROOP_BASE_STATS,
  INJURY_STATES,
  COMBAT_LINES,
  WALL_DEFENSE_RATINGS,

  getInjuryState,
  calculateIndividualTroopHp,
  calculateIndividualTroopDmg,
  calculateWallHp,
  calculateDistancePenalty,
  calculateEngineerHitChance,
  applyLadderDamage,
  calculateNinjaAssassinationChance,
  calculateThiefSabotage,
  allocateWarMachines,

  parseInjuredTroops,
  serializeInjuredTroops,
  recordInjuredTroop,
  getLivingTroopCount,
  getDeadTroopCount,
  cleanupDeadTroops,
  applyShrineHealing,
  preventLethality,
};
