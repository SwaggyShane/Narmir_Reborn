'use strict';
// Dragon evolution API — EVOLUTION.md Roadmap B.
// Pure transforms; routes/engine apply updates inside TX.

const {
  EVOLUTION_PRESTIGE_GATE,
  RITUAL_TURNS,
  RITUAL_CHANNEL_DEFENSE_MULT,
  DRAGON_EGG_ITEM_ID,
  DRAGON_EGG_ITEM_NAME,
  DRAGON_FORM,
} = require('./balance');
const { safeJsonParse } = require('../../utils/helpers');

function parseRitual(raw) {
  if (raw == null || raw === '' || raw === '{}') return null;
  try {
    const r = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!r || typeof r !== 'object') return null;
    return r;
  } catch {
    return null;
  }
}

function parseItems(raw) {
  const arr = safeJsonParse(raw, [], 'evolution:items');
  return Array.isArray(arr) ? arr : [];
}

function hasDragonEgg(k) {
  const items = parseItems(k?.items);
  const egg = items.find((i) => i && i.id === DRAGON_EGG_ITEM_ID);
  return !!(egg && (Number(egg.qty) || 0) > 0);
}

function isDragon(k) {
  return String(k?.evolution_form || '') === DRAGON_FORM.id;
}

function isChanneling(k) {
  const r = parseRitual(k?.evolution_ritual);
  return !!(r && r.state === 'CHANNELING');
}

/**
 * Gates to start ritual (pure).
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
function canStartDragonRitual(k) {
  if (!k) return { ok: false, error: 'Kingdom required' };
  if (isDragon(k)) return { ok: false, error: 'Already evolved into dragon form' };
  if (isChanneling(k)) return { ok: false, error: 'Ritual already channeling' };
  if ((Number(k.prestige_level) || 0) < EVOLUTION_PRESTIGE_GATE) {
    return {
      ok: false,
      error: `Require Prestige ${EVOLUTION_PRESTIGE_GATE}+ to begin dragon evolution`,
    };
  }
  if ((Number(k.bld_castles) || 0) < 1) {
    return { ok: false, error: 'Require at least 1 castle to begin the ritual' };
  }
  if (!hasDragonEgg(k)) {
    return { ok: false, error: 'Require a Dragon Egg (epic trek rare find)' };
  }
  return { ok: true };
}

/**
 * Consume egg, start CHANNELING. Pure updates object.
 * @returns {{ error: string } | { updates: object, ritual: object }}
 */
function startDragonRitual(k) {
  const gate = canStartDragonRitual(k);
  if (!gate.ok) return { error: gate.error };

  const items = parseItems(k.items);
  const egg = items.find((i) => i && i.id === DRAGON_EGG_ITEM_ID);
  if (!egg || (Number(egg.qty) || 0) < 1) {
    return { error: 'Require a Dragon Egg (epic trek rare find)' };
  }
  // Consume one egg (drop entry at qty 0)
  const cleaned = items
    .map((i) => {
      if (i && i.id === DRAGON_EGG_ITEM_ID) {
        const q = (Number(i.qty) || 0) - 1;
        return q > 0 ? { ...i, qty: q } : null;
      }
      return i;
    })
    .filter(Boolean);

  const ritual = {
    state: 'CHANNELING',
    form: DRAGON_FORM.id,
    turns_remaining: RITUAL_TURNS,
    turns_total: RITUAL_TURNS,
    started_turn: Number(k.turn) || 0,
    channel_defense_mult: RITUAL_CHANNEL_DEFENSE_MULT,
  };

  return {
    updates: {
      evolution_ritual: JSON.stringify(ritual),
      items: JSON.stringify(cleaned),
    },
    ritual,
    eggConsumed: true,
  };
}

/**
 * Abort channeling — form not granted; egg already consumed (locked cost).
 */
function abortDragonRitual(k) {
  if (!isChanneling(k)) return { error: 'No ritual in progress' };
  return {
    updates: {
      evolution_ritual: JSON.stringify({
        state: 'ABORTED',
        form: DRAGON_FORM.id,
        aborted_turn: Number(k.turn) || 0,
      }),
    },
  };
}

/**
 * Per-turn ritual progress (call from processTurn merge path).
 * Fail if castles < 1 at start of tick while CHANNELING.
 * @returns {{ updates: object, events: array } | null} null if no ritual work
 */
function processEvolutionTurn(k) {
  const ritual = parseRitual(k?.evolution_ritual);
  if (!ritual || ritual.state !== 'CHANNELING') return null;

  const events = [];
  const updates = {};

  if ((Number(k.bld_castles) || 0) < 1) {
    updates.evolution_ritual = JSON.stringify({
      state: 'FAILED',
      form: DRAGON_FORM.id,
      reason: 'castles',
      failed_turn: Number(k.turn) || 0,
    });
    events.push({
      type: 'system',
      message:
        '🐉 The dragon ritual collapses — your last castle fell before the transformation could complete. The egg is lost.',
    });
    return { updates, events };
  }

  const remaining = Math.max(0, (Number(ritual.turns_remaining) || 0) - 1);
  if (remaining <= 0) {
    updates.evolution_form = DRAGON_FORM.id;
    updates.evolution_ritual = JSON.stringify({
      state: 'COMPLETE',
      form: DRAGON_FORM.id,
      completed_turn: Number(k.turn) || 0,
    });
    events.push({
      type: 'system',
      message:
        '🐉 EVOLUTION COMPLETE. Your kingdom takes dragon form — tougher prey, heavier upkeep, terror against weaker realms. No free combat crown.',
    });
    return { updates, events };
  }

  updates.evolution_ritual = JSON.stringify({
    ...ritual,
    state: 'CHANNELING',
    turns_remaining: remaining,
  });
  return { updates, events };
}

/**
 * Combat/defense stacking helpers — never a second global combat % for power baseline.
 */
function getDragonDefenseMult(k) {
  if (isChanneling(k)) return RITUAL_CHANNEL_DEFENSE_MULT;
  if (isDragon(k)) return DRAGON_FORM.defenseMult;
  return 1.0;
}

function getDragonUpkeepMult(k) {
  if (isDragon(k)) return DRAGON_FORM.upkeepMult;
  return 1.0;
}

function getDragonHoardEconMult(k) {
  if (isDragon(k)) return DRAGON_FORM.hoardEconMult;
  return 1.0;
}

/**
 * Terror: attacker-only mult when attacker is dragon and defender prestige is lower.
 * Does not apply to defender power. Not a global combat % for both sides.
 */
function applyDragonTerror(attackerPower, attacker, defender) {
  if (!isDragon(attacker)) return Math.round(attackerPower);
  const ap = Number(attacker.prestige_level) || 0;
  const dp = Number(defender?.prestige_level) || 0;
  if (ap <= dp) return Math.round(attackerPower);
  return Math.round(attackerPower * (DRAGON_FORM.terrorVsLowerPrestige || 1));
}

module.exports = {
  parseRitual,
  hasDragonEgg,
  isDragon,
  isChanneling,
  canStartDragonRitual,
  startDragonRitual,
  abortDragonRitual,
  processEvolutionTurn,
  getDragonDefenseMult,
  getDragonUpkeepMult,
  getDragonHoardEconMult,
  applyDragonTerror,
  DRAGON_EGG_ITEM_ID,
  DRAGON_EGG_ITEM_NAME,
  EVOLUTION_PRESTIGE_GATE,
  RITUAL_TURNS,
  DRAGON_FORM,
};
