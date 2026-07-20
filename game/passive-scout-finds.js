/**
 * Passive Scouting Continuous Finds (P0 §3a)
 *
 * When scout_allocation > 0 and ring progress is gained this turn, roll for
 * a small find. Chance scales with allocation size (not a flat 5%).
 *
 * Design locked for first shippable slice:
 * - Pure table + roll helpers (testable without DB)
 * - Resource/junk/maps/mana/small troop finds persist via kingdom updates
 * - kingdom_signal sets updates._find_kingdom so existing turn discovery
 *   pipeline can resolve a real kingdom (same flag as expedition scout)
 * - Full "spawn new resource node on map" is deferred: needs world-node
 *   placement API; until then node_cache is a gold+wood supply find
 *
 * Does NOT touch elevation or FoW bitmaps.
 */

'use strict';

const PASSIVE_SCOUT_FINDS = Object.freeze({
  /** Allocation used as the reference for "normal" find chance */
  REF_ALLOCATION: 1000,
  /** Find chance at REF_ALLOCATION (before clamp) */
  BASE_FIND_CHANCE: 0.05,
  /** Hard cap so huge armies do not guarantee a find every turn */
  MAX_FIND_CHANCE: 0.22,
  /** Floor scale so small allocations still get a thin chance */
  MIN_SCALE: 0.2,

  /**
   * Flat per-turn chance of a junk (flavor-only, no economic weight) find,
   * whenever scout progress was gained this turn. Deliberately independent
   * of allocation size and of the rare-outcomes roll below — junk is meant
   * to be a frequent, noticeable drip, not folded into the same low-odds
   * table as gold/resources/troops (that made it effectively as rare as
   * everything else, ~1% of turns instead of "high rate").
   */
  JUNK_FIND_CHANCE: 0.5,

  /**
   * Weighted outcomes when a *rare* find triggers (junk excluded — see
   * JUNK_FIND_CHANCE / rollJunkFind above).
   * weight: relative weight among outcomes
   * resource fields: min/max inclusive integer amounts (rand)
   */
  OUTCOMES: Object.freeze([
    { type: 'gold', weight: 18, min: 15, max: 60 },
    { type: 'wood', weight: 12, min: 8, max: 25 },
    { type: 'stone', weight: 12, min: 8, max: 25 },
    { type: 'mana', weight: 10, min: 5, max: 22 },
    { type: 'land', weight: 5, min: 1, max: 2 },
    { type: 'maps', weight: 5, amount: 1 },
    { type: 'troops', weight: 4, unit: 'rangers', min: 1, max: 3 },
    { type: 'resource_node', weight: 1 }, // flag → real INSERT resource_nodes on turn commit
    { type: 'kingdom_signal', weight: 1 },
  ]),
});

/**
 * @param {number} allocation - scout_allocation
 * @returns {number} probability in [0, MAX_FIND_CHANCE]
 */
function getPassiveFindChance(allocation) {
  const a = Math.max(0, Math.floor(Number(allocation) || 0));
  if (a <= 0) return 0;
  const rawScale = Math.sqrt(a / PASSIVE_SCOUT_FINDS.REF_ALLOCATION);
  const scale = Math.max(PASSIVE_SCOUT_FINDS.MIN_SCALE, rawScale);
  return Math.min(
    PASSIVE_SCOUT_FINDS.MAX_FIND_CHANCE,
    PASSIVE_SCOUT_FINDS.BASE_FIND_CHANCE * scale,
  );
}

function totalWeight(outcomes = PASSIVE_SCOUT_FINDS.OUTCOMES) {
  return outcomes.reduce((s, o) => s + (o.weight || 0), 0);
}

/**
 * Pick a weighted outcome. random() → [0, 1).
 * @param {function(): number} [random]
 * @param {Array} [outcomes]
 */
function pickWeightedOutcome(random = Math.random, outcomes = PASSIVE_SCOUT_FINDS.OUTCOMES) {
  const total = totalWeight(outcomes);
  if (total <= 0) return null;
  let r = random() * total;
  for (const o of outcomes) {
    r -= o.weight || 0;
    if (r < 0) return o;
  }
  return outcomes[outcomes.length - 1];
}

function intBetween(min, max, random) {
  const lo = Math.floor(Number(min) || 0);
  const hi = Math.floor(Number(max) || lo);
  if (hi <= lo) return lo;
  return lo + Math.floor(random() * (hi - lo + 1));
}

/**
 * Roll a passive scout find for this turn.
 * @param {object} kingdom - must include scout_allocation when progress was gained
 * @param {object} [opts]
 * @param {function(): number} [opts.random]
 * @returns {object|null} find descriptor or null if no find
 */
function rollPassiveScoutFind(kingdom, opts = {}) {
  const random = typeof opts.random === 'function' ? opts.random : Math.random;
  const allocation = Math.max(0, Math.floor(Number(kingdom?.scout_allocation) || 0));
  const chance = getPassiveFindChance(allocation);
  if (chance <= 0) return null;
  if (random() >= chance) return null;

  const outcome = pickWeightedOutcome(random, PASSIVE_SCOUT_FINDS.OUTCOMES);
  if (!outcome) return null;

  switch (outcome.type) {
    case 'maps':
      return { type: 'maps', amount: outcome.amount || 1 };
    case 'troops':
      return {
        type: 'troops',
        unit: outcome.unit || 'rangers',
        amount: intBetween(outcome.min, outcome.max, random),
      };
    case 'resource_node': {
      const types = ['wood', 'stone', 'iron', 'gold'];
      const nodeType = types[Math.floor(random() * types.length)];
      return { type: 'resource_node', nodeType };
    }
    case 'kingdom_signal':
      return { type: 'kingdom_signal' };
    case 'gold':
    case 'wood':
    case 'stone':
    case 'mana':
    case 'land':
      return {
        type: outcome.type,
        amount: intBetween(outcome.min, outcome.max, random),
      };
    default:
      return null;
  }
}

/**
 * Independent flat-chance roll for a junk (flavor-only) find. Separate from
 * rollPassiveScoutFind's rare-outcomes table on purpose — both can hit on
 * the same turn.
 * @param {object} [opts]
 * @param {function(): number} [opts.random]
 * @returns {boolean}
 */
function rollJunkFind(opts = {}) {
  const random = typeof opts.random === 'function' ? opts.random : Math.random;
  return random() < PASSIVE_SCOUT_FINDS.JUNK_FIND_CHANCE;
}

/**
 * Apply a rolled find onto updates + events.
 * @param {object} kingdom
 * @param {object} updates - mutated in place
 * @param {Array} events - mutated in place
 * @param {object} find - from rollPassiveScoutFind
 * @param {object} [opts]
 * @param {function(object, object): string} [opts.junkPrize] - junkPrize(k, updates) → flavor string
 */
function applyPassiveScoutFind(kingdom, updates, events, find, opts = {}) {
  if (!find || !updates || !events) return;

  const pushFind = (message, subtitle) => {
    events.push({
      type: 'system',
      message: `🔍 ${message}`,
      skipNews: true,
      expeditionLogEntry: {
        icon: '🔍',
        title: 'Scouting find',
        subtitle: subtitle || message,
      },
    });
  };

  const addResource = (key, amount) => {
    const base = updates[key] !== undefined ? updates[key] : (kingdom[key] || 0);
    updates[key] = base + amount;
  };

  switch (find.type) {
    case 'junk': {
      const junkPrize = opts.junkPrize;
      if (typeof junkPrize === 'function') {
        const found = junkPrize(kingdom, updates);
        pushFind(`Your scouts also found ${found}`, found);
      } else {
        pushFind('Your scouts also found a curious trinket', 'trinket');
      }
      break;
    }
    case 'gold':
    case 'wood':
    case 'stone':
    case 'mana': {
      addResource(find.type, find.amount);
      pushFind(
        `Your scouts also found +${find.amount} ${find.type}`,
        `+${find.amount} ${find.type}`,
      );
      break;
    }
    case 'land': {
      addResource('land', find.amount);
      const acres = `${find.amount} acre${find.amount !== 1 ? 's' : ''} of land`;
      pushFind(`Your scouts also found +${acres}`, `+${acres}`);
      break;
    }
    case 'maps': {
      addResource('maps', find.amount);
      pushFind(
        `Your scouts found ${find.amount} map${find.amount !== 1 ? 's' : ''} — usable for diplomacy and warfare`,
        `+${find.amount} map${find.amount !== 1 ? 's' : ''}`,
      );
      break;
    }
    case 'troops': {
      const unit = find.unit || 'rangers';
      addResource(unit, find.amount);
      pushFind(
        `Your scouts returned with ${find.amount} ${unit}`,
        `+${find.amount} ${unit}`,
      );
      break;
    }
    case 'resource_node': {
      // Async INSERT happens in commitTurnResults via this flag
      updates._spawn_resource_node = find.nodeType || 'wood';
      pushFind(
        `Your scouts report a ${find.nodeType || 'resource'} deposit nearby`,
        `node: ${find.nodeType || 'wood'}`,
      );
      break;
    }
    case 'kingdom_signal': {
      // Consumed later in processTurn / expedition discovery path
      updates._find_kingdom = true;
      pushFind(
        'Your scouts report signs of another kingdom nearby',
        'kingdom signal',
      );
      break;
    }
    default:
      break;
  }
}

/**
 * Convenience: roll + apply in one call (engine turn path). Junk and the
 * rare-outcomes table are rolled independently, so both (or neither) can
 * land on the same turn.
 * @returns {Array<object>} finds actually applied this turn (may be empty)
 */
function processPassiveScoutFinds(kingdom, updates, events, opts = {}) {
  const applied = [];

  if (rollJunkFind(opts)) {
    const junkFind = { type: 'junk' };
    applyPassiveScoutFind(kingdom, updates, events, junkFind, opts);
    applied.push(junkFind);
  }

  const rareFind = rollPassiveScoutFind(kingdom, opts);
  if (rareFind) {
    applyPassiveScoutFind(kingdom, updates, events, rareFind, opts);
    applied.push(rareFind);
  }

  return applied;
}

module.exports = {
  PASSIVE_SCOUT_FINDS,
  getPassiveFindChance,
  pickWeightedOutcome,
  rollPassiveScoutFind,
  rollJunkFind,
  applyPassiveScoutFind,
  processPassiveScoutFinds,
  totalWeight,
};
