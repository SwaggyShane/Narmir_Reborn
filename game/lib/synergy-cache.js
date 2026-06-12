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

const activeSynergyCache = new Map();
const MAX_SYNERGY_CACHE = 2000;

function getActiveSynergyCached(kingdom) {
  if (!kingdom) return null;
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
  return 1.0 + effectValue;
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
  // Clearing on demand just keeps the map small after attunement changes.
  if (!kingdom) return;
  if (typeof kingdom.fragment_bonuses === "string") {
    activeSynergyCache.delete(kingdom.fragment_bonuses);
  } else {
    activeSynergyCache.clear();
  }
}

module.exports = {
  getActiveSynergyCached,
  getSynergyPassiveBonusMultiplier,
  getSynergyPassiveBonusAbsolute,
  clearSynergyCache,
};
