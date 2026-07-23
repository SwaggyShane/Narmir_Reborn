// Per-turn injured troop recovery (Combat V2 half-wire closeout).
// Healthy troop columns only hold deployable units; injured live in injured_troops
// JSON until fully healed, then return to the column. Dead entries are purged.

'use strict';

const combatCalc = require('../combat-new');
const { parseTroopLevel } = require('./troops');

const INJURY_UNIT_TYPES = [
  'thralls',
  'fighters',
  'rangers',
  'mages',
  'clerics',
  'ninjas',
  'thieves',
  'engineers',
  'war_machines',
];

/**
 * Count living injured troops per unit type from injured_troops JSON/object.
 * @param {string|object|null} injuredRaw
 * @returns {Record<string, number>}
 */
function countInjuredByType(injuredRaw) {
  const injured = combatCalc.parseInjuredTroops(
    typeof injuredRaw === 'string' || injuredRaw == null
      ? injuredRaw
      : JSON.stringify(injuredRaw),
  );
  const counts = {};
  for (const type of INJURY_UNIT_TYPES) {
    const n = combatCalc.getLivingTroopCount(injured, type);
    if (n > 0) counts[type] = n;
  }
  return counts;
}

/**
 * Natural + cleric healing for one turn. Fully healed troops return to
 * kingdom unit columns. Dead entries are dropped.
 *
 * Mutates updates/events. Safe no-op when no injured pool exists.
 *
 * @param {object} k - kingdom snapshot
 * @param {object} updates - turn updates (mutated)
 * @param {object[]} events - turn events (mutated)
 * @returns {{ recovered: Record<string, number>, stillInjured: Record<string, number>, deadPurged: number }}
 */
function processInjuredTroopsTurn(k, updates, events) {
  const raw =
    updates.injured_troops !== undefined ? updates.injured_troops : k.injured_troops;
  const empty = { recovered: {}, stillInjured: {}, deadPurged: 0 };
  if (raw == null || raw === '' || raw === '{}') return empty;

  let injured = combatCalc.parseInjuredTroops(
    typeof raw === 'string' ? raw : JSON.stringify(raw),
  );
  const hadAny = Object.values(injured).some((arr) => Array.isArray(arr) && arr.length > 0);
  if (!hadAny) return empty;

  const deadBefore = Object.values(injured).reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.filter((t) => t.hp <= 0).length : 0),
    0,
  );

  const clerics =
    updates.clerics !== undefined ? updates.clerics : k.clerics || 0;
  const thralls =
    updates.thralls !== undefined ? updates.thralls : k.thralls || 0;
  // Vampires staff healing via thralls when clerics column is unused.
  const healers = k.race === 'vampire' ? thralls : clerics;
  const healerLevel = parseTroopLevel(
    updates.troop_levels || k.troop_levels,
    k.race === 'vampire' ? 'thralls' : 'clerics',
  );
  const shrineBonus = Math.max(0, Number(k.bld_shrines) || 0) * 2;

  // Cleric/shrine contribution (existing combat helper) then natural regen
  // so zero-cleric kingdoms still recover slowly.
  if (healers > 0 || shrineBonus > 0) {
    injured = combatCalc.applyShrineHealing(
      injured,
      Math.max(0, healers) + shrineBonus,
      Math.max(1, healerLevel),
    );
  }

  const recovered = {};
  const remaining = {};
  let deadPurged = deadBefore;

  for (const [troopType, troops] of Object.entries(injured)) {
    if (!Array.isArray(troops)) continue;
    for (const troop of troops) {
      if (!troop || troop.hp <= 0) {
        // already counted in deadBefore / cleaned below
        continue;
      }

      const maxHp = Math.max(1, Number(troop.max_hp) || 1);
      let hp = Number(troop.hp) || 0;
      const injuryState = combatCalc.getInjuryState(hp, maxHp);
      const natural = Math.max(
        1,
        Math.ceil(maxHp * 0.08 * (injuryState.healingSpeed || 1)),
      );
      hp = Math.min(maxHp, hp + natural);
      troop.hp = hp;

      if (hp >= maxHp) {
        recovered[troopType] = (recovered[troopType] || 0) + 1;
      } else {
        if (!remaining[troopType]) remaining[troopType] = [];
        remaining[troopType].push({ hp, max_hp: maxHp });
      }
    }
  }

  // Purge dead that were still sitting in the pool (combat may leave them).
  injured = combatCalc.cleanupDeadTroops(remaining);
  deadPurged = deadBefore; // living dead already excluded from remaining

  for (const [troopType, count] of Object.entries(recovered)) {
    if (count <= 0) continue;
    const current =
      updates[troopType] !== undefined ? updates[troopType] : k[troopType] || 0;
    updates[troopType] = Math.max(0, current + count);
  }

  updates.injured_troops = combatCalc.serializeInjuredTroops(injured);

  const recoveredTotal = Object.values(recovered).reduce((s, n) => s + n, 0);
  const stillInjured = countInjuredByType(injured);
  const stillTotal = Object.values(stillInjured).reduce((s, n) => s + n, 0);

  if (recoveredTotal > 0) {
    const parts = Object.entries(recovered)
      .filter(([, n]) => n > 0)
      .map(([t, n]) => `${n.toLocaleString()} ${t}`);
    events.push({
      type: 'system',
      message: `🩹 ${recoveredTotal.toLocaleString()} wounded troop(s) recovered and returned to duty (${parts.join(', ')}).`,
    });
  } else if (stillTotal > 0) {
    events.push({
      type: 'system',
      message: `🩹 ${stillTotal.toLocaleString()} wounded troop(s) are recovering in the infirmary.`,
    });
  }

  return { recovered, stillInjured, deadPurged };
}

module.exports = {
  INJURY_UNIT_TYPES,
  countInjuredByType,
  processInjuredTroopsTurn,
};
