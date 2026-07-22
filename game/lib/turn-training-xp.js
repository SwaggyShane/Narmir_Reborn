// game/lib/turn-training-xp.js
// processTurn section 9: training fields, racial passives, XP awards, milestones, racial unlock.
// Engine extract plan S08. Mutates ctx (incl. xpSourcesAccum) in place.

'use strict';

const fragmentBonusManager = require('../fragment-bonus-manager');
const { getCap } = require('./data-transformations');
const { ensureObject } = require('./healing');
const {
  troopXpForLevel,
  racialUnitBonus,
  getAvailableUnits,
} = require('./troops');
const { naturalHappinessCap } = require('./happiness-cap');
const { awardXp, checkMilestones } = require('../xp');
const { goldPerTurn } = require('../economy');
const { safeJsonStringify } = require('../../utils/helpers');
const config = require('../config');

const { TROOP_RACE_BONUS, RACIAL_UNITS } = config;

/**
 * @param {import('./turn-context').TurnContext} ctx
 * @returns {void}
 */
function runTrainingAndXpPhase(ctx) {
  const { k, updates, events } = ctx;
  let xpSourcesAccum = ctx.xpSourcesAccum;

  // ── 9. Training fields — passive troop XP each turn ──────────────────────────
  if (k.bld_training > 0) {
    // troop_levels is now kept as object throughout processTurn, not stringified until save
    // Use centralized ensureObject + prior healing (M1-3)
    let troopLevels = ensureObject(
      updates.troop_levels || k.troop_levels,
      {}
    );
    const allocation = ensureObject(
      k.training_allocation,
      {}
    );

    const TROOP_TYPES = [
      'fighters',
      'rangers',
      'clerics',
      'mages',
      'thieves',
      'ninjas',
    ];
    const trainingFields = k.bld_training;
    const trainingCapacity = trainingFields * 100;
    let advancedTroops = [];

    TROOP_TYPES.forEach(function (unit) {
      const assigned = Number(allocation[unit]) || 0;
      if (assigned <= 0) return;
      const currentData = troopLevels[unit] || { level: 1, xp: 0, count: 0 };
      if (currentData.level >= 100) return;
      const weaponsEquipped = Math.min(assigned, k.weapons_stockpile);
      const armorEquipped = Math.min(assigned, k.armor_stockpile);
      const equipBonus =
        1 +
        (weaponsEquipped / Math.max(assigned, 1)) * 0.5 +
        (armorEquipped / Math.max(assigned, 1)) * 0.5;
      const raceTrainBonus = TROOP_RACE_BONUS[k.race]?.[unit] || 1.0;
      const trainingSpeedMult = fragmentBonusManager.getBonusMultiplier(k, 'training', 'speed');
      const trainingOutputMult = fragmentBonusManager.getBonusMultiplier(k, 'training', 'output');
      const trainingPowerMult = fragmentBonusManager.getBonusMultiplier(k, 'training', 'power');
      const trainingEffMult = fragmentBonusManager.getBonusMultiplier(k, 'training', 'effectiveness');
      const effectiveTrainingMult = trainingSpeedMult * trainingOutputMult * trainingPowerMult * trainingEffMult;
      const xpGain = Math.floor(
        (trainingCapacity * equipBonus * raceTrainBonus * effectiveTrainingMult) / TROOP_TYPES.length,
      );
      const newXp = currentData.xp + xpGain;
      const xpNeeded = troopXpForLevel(currentData.level + 1);
      if (newXp >= xpNeeded) {
        troopLevels[unit] = {
          level: currentData.level + 1,
          xp: newXp - xpNeeded,
          count: assigned,
        };
        advancedTroops.push(`${unit} → Level ${currentData.level + 1}`);
      } else {
        troopLevels[unit] = { ...currentData, xp: newXp, count: assigned };
      }
    });

    // Keep as object, not stringified — stringify only at save time
    updates.troop_levels = troopLevels;
    if (advancedTroops.length > 0) {
      events.push({
        type: 'system',
        message: `⚔️ Troop training advanced: ${advancedTroops.join(', ')}.`,
      });
    } else if (trainingFields > 0 && Object.keys(allocation).length > 0) {
      events.push({
        type: 'system',
        message: `⚔️ ${trainingFields} training field(s) active — troops gaining experience.`,
      });
    }
  }

  // ── 9b. Racial passive bonuses ────────────────────────────────────────────────
  // Orc: every 10 fighters (level 5+) trains 1 free fighter per turn
  const orcBonus = racialUnitBonus(
    { ...k, troop_levels: updates.troop_levels || k.troop_levels },
    'fighters',
  );
  if (orcBonus.freeTrainees > 0) {
    const BARRACKS_TROOPS = [
      'fighters',
      'rangers',
      'clerics',
      'thieves',
      'ninjas',
    ];
    const barracksCapacityMult = fragmentBonusManager.getBonusMultiplier(k, 'barracks', 'capacity');
    const barracksCap = Math.floor(k.bld_barracks * 500 * barracksCapacityMult);
    const currentBarracksTroops = BARRACKS_TROOPS.reduce(
      (s, u) => s + (updates[u] !== undefined ? updates[u] : k[u] || 0),
      0,
    );
    const levelCapVal = getCap('fighters', k.level || 1);
    const currentFighters =
      updates.fighters !== undefined ? updates.fighters : k.fighters;

    const barracksSpace = Math.max(0, barracksCap - currentBarracksTroops);
    const levelSpace = Math.max(0, levelCapVal - currentFighters);
    const added = Math.min(orcBonus.freeTrainees, barracksSpace, levelSpace);

    if (added > 0) {
      updates.fighters = currentFighters + added;
      events.push({
        type: 'system',
        message: `🪓 Orcish war culture: ${added.toLocaleString()} free fighters trained this turn.`,
      });
    }
  }
  // Human: level 5+ clerics restore 1 happiness per turn
  const humanBonus = racialUnitBonus(
    { ...k, troop_levels: updates.troop_levels || k.troop_levels },
    'clerics',
  );
  if (humanBonus.auraHeal && getAvailableUnits(k, 'clerics') > 0) {
    const natCap = naturalHappinessCap(k);
    const cur =
      updates.happiness !== undefined
        ? updates.happiness
        : k.happiness !== undefined && k.happiness !== null
          ? k.happiness
          : 100;
    updates.happiness = Math.min(natCap, cur + 1);
  }

  // ── XP awards this turn ───────────────────────────────────────────────────────
  let totalXp = k.xp;
  let currentLevel = k.level || 1;
  const prevLevel = currentLevel;

  // Turn XP
  const turnXp = awardXp({ ...k, xp: totalXp, level: currentLevel, xp_sources: xpSourcesAccum }, 'turn', 1);
  totalXp = turnXp.xp;
  currentLevel = turnXp.level;
  if (turnXp.levelled) events.push(...turnXp.events);
  Object.assign(xpSourcesAccum, turnXp.xp_sources);

  // Gold income XP (rate set to 0 — gold no longer drives XP)
  // Amount is goldPerTurn(k) only (not trade) — same as pre-S02 local `income`.
  const goldXp = awardXp(
    { ...k, xp: totalXp, level: currentLevel, xp_sources: xpSourcesAccum },
    'gold_earned',
    goldPerTurn(k),
  );
  totalXp = goldXp.xp;
  currentLevel = goldXp.level;
  if (goldXp.levelled) events.push(...goldXp.events);
  Object.assign(xpSourcesAccum, goldXp.xp_sources);

  // Research XP (awarded after research section runs)
  // (handled below after DISCIPLINES loop)

  updates.xp = totalXp;
  updates.level = currentLevel;
  updates.xp_sources = safeJsonStringify(xpSourcesAccum);

  // ── Milestone check ───────────────────────────────────────────────────────────
  if (currentLevel > prevLevel) {
    const ms = checkMilestones(k, prevLevel, currentLevel);
    if (ms.events.length > 0) {
      events.push(...ms.events);
      const mu = ms.updates;
      if (mu.goldGrant)        updates.gold        = (updates.gold        ?? k.gold        ?? 0) + mu.goldGrant;
      if (mu.landGrant)        updates.land        = (updates.land        ?? k.land        ?? 0) + mu.landGrant;
      if (mu.fightersGrant)    updates.fighters    = (updates.fighters    ?? k.fighters    ?? 0) + mu.fightersGrant;
      if (mu.researchersGrant) updates.researchers = (updates.researchers ?? k.researchers ?? 0) + mu.researchersGrant;
      if (mu.thievesGrant)     updates.thieves     = (updates.thieves     ?? k.thieves     ?? 0) + mu.thievesGrant;
      if (mu.ninjasGrant)      updates.ninjas      = (updates.ninjas      ?? k.ninjas      ?? 0) + mu.ninjasGrant;
      if (mu.milestone_bonuses)  updates.milestone_bonuses  = mu.milestone_bonuses;
      if (mu.milestones_claimed) updates.milestones_claimed = mu.milestones_claimed;
      if (mu.milestone_title)    updates.milestone_title    = mu.milestone_title;
    }
  }

  // ── Racial bonus unlock check — triggers when signature unit hits level 25 ──
  const keyUnit = RACIAL_UNITS[k.race];
  if (keyUnit) {
    // Use already-set updates value if present, else fall back to k
    // pre-healed (M1-3)
    const racialData = ensureObject(
      updates.racial_bonuses_unlocked || k.racial_bonuses_unlocked,
      {}
    );
    if (!racialData[keyUnit]) {
      const tls = ensureObject(
        updates.troop_levels || k.troop_levels,
        {}
      );
      const unitLevel = tls[keyUnit]?.level || 1;
      if (unitLevel >= 25) {
        racialData[keyUnit] = true;
        updates.racial_bonuses_unlocked = safeJsonStringify(racialData);
        const RACIAL_MSGS = {
          dwarf:
            '⚒️ Your engineers have reached mastery — Dwarven war machines now need only 1 engineer to crew.',
          high_elf:
            '✨ Your mages have reached mastery — High Elf scrolls now produce 2 per craft.',
          orc: '⚔️ Your fighters have reached mastery — Orcish war culture now trains 1 free fighter per 10 each turn.',
          dark_elf:
            '🕵️ Your ninjas have reached mastery — Dark Elf assassinations now leave no trace.',
          dire_wolf:
            '🐺 Your rangers have reached mastery — Dire Wolf expeditions now return 1 turn early.',
          human:
            '💚 Your clerics have reached mastery — Human healing aura now restores +1 happiness per turn.',
        };
        if (RACIAL_MSGS[k.race])
          events.push({ type: 'system', message: RACIAL_MSGS[k.race] });
      }
    }
  }

  ctx.xpSourcesAccum = xpSourcesAccum;
}

module.exports = {
  runTrainingAndXpPhase,
};
