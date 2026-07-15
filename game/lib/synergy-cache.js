// Content-keyed cache for kingdom synergy lookups + helpers for reading
// passive bonuses off the active synergy.
//
// Caching detail: turn processing copies the kingdom object dozens of times
// per turn ({ ...k, ...updates }), so identity-based keying (WeakMap) misses
// on nearly every call. The active synergy is a pure function of the
// kingdom's fragment placements, so we key on the fragment_bonuses JSON
// string itself — different kingdom copies with the same placements hit the
// cache, and any attunement change produces a new key (so stale entries
// can't be served).
//
// Extracted from engine.js so economy, combat, magic, etc. can read synergy
// bonuses without pulling in engine.

const attunementManager = require("../attunement-manager");
const { getProfiler } = require("../profiling");

const activeSynergyCache = new Map();
const MAX_SYNERGY_CACHE = 2000;
const COMBAT_RELEVANT_SYNERGY_CAPS = {
  combat_power: 0.5,
  combat_damage: 0.5,
  unit_damage: 0.5,
  troop_damage: 0.5,
  troop_health: 0.5,
  defense: 0.5,
  damage: 0.5,
  health: 0.5,
};

function getActiveSynergyCached(kingdom) {
  if (!kingdom) return null;
  getProfiler().recordSynergyLookup();
  const key =
    typeof kingdom.fragment_bonuses === "string"
      ? kingdom.fragment_bonuses
      : JSON.stringify(kingdom.fragment_bonuses || {});
  if (!activeSynergyCache.has(key)) {
    if (activeSynergyCache.size >= MAX_SYNERGY_CACHE) {
      activeSynergyCache.delete(activeSynergyCache.keys().next().value);
    }
    activeSynergyCache.set(key, attunementManager.getActiveSynergy(kingdom) || null);
  }
  return activeSynergyCache.get(key);
}

function getSynergyPassiveBonusMultiplier(kingdom, effectKey) {
  if (!kingdom) return 1.0;

  const synergy = getActiveSynergyCached(kingdom);
  if (!synergy || !synergy.passive || !synergy.passive.effects) {
    return 1.0;
  }
  const effectValue = synergy.passive.effects[effectKey];
  if (effectValue === undefined || effectValue === null) {
    return 1.0;
  }
  const cap = COMBAT_RELEVANT_SYNERGY_CAPS[effectKey];
  const clampedDelta = typeof cap === "number"
    ? Math.max(-cap, Math.min(cap, effectValue))
    : effectValue;
  return 1.0 + clampedDelta;
}

function getSynergyPassiveBonusAbsolute(kingdom, effectKey) {
  if (!kingdom) return 0;
  const synergy = getActiveSynergyCached(kingdom);
  if (!synergy || !synergy.passive || !synergy.passive.effects) return 0;
  const effectValue = synergy.passive.effects[effectKey];
  if (effectValue === undefined || effectValue === null) return 0;
  return effectValue;
}

function clearSynergyCache(kingdom) {
  // Content-keyed: a changed attunement produces a new fragment_bonuses
  // string and therefore a new key, so stale entries can't be served.
  // Stringify-then-delete mirrors the key derivation in getActiveSynergyCached
  // so an object input clears only its own entry (not the whole 2K-entry cache).
  if (!kingdom) return;
  const key =
    typeof kingdom.fragment_bonuses === "string"
      ? kingdom.fragment_bonuses
      : JSON.stringify(kingdom.fragment_bonuses || {});
  activeSynergyCache.delete(key);
}

module.exports = {
  getActiveSynergyCached,
  getSynergyPassiveBonusMultiplier,
  getSynergyPassiveBonusAbsolute,
  clearSynergyCache,
};
