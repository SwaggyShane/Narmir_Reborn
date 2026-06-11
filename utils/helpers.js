// Shared utility functions

const _parseCache = new Map();
const MAX_CACHE_SIZE = 5000;

function clearParseCache() {
  _parseCache.clear();
}

// Callers may mutate the returned value (e.g. active_effects processing), so
// cached entries are never handed out directly — each return is a shallow
// copy. This keeps top-level mutations from leaking between callers that
// parsed the same JSON string.
function shallowCopy(val) {
  if (Array.isArray(val)) return [...val];
  if (val && typeof val === "object") return { ...val };
  return val;
}

function safeJsonParse(str, fallback = {}, context = "unknown") {
  if (!str) return fallback;
  if (typeof str === "object") return str;
  // Key on content only — the same JSON parsed from different call sites
  // (different context strings) should share one cache entry. The context
  // is kept solely for error logging.
  const cacheKey = str;
  if (_parseCache.has(cacheKey)) {
    const val = _parseCache.get(cacheKey);
    _parseCache.delete(cacheKey);
    _parseCache.set(cacheKey, val);
    return shallowCopy(val);
  }

  try {
    const val = JSON.parse(str);
    if (_parseCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = _parseCache.keys().next().value;
      _parseCache.delete(oldestKey);
    }
    _parseCache.set(cacheKey, val);
    return shallowCopy(val);
  } catch (e) {
    console.error(
      `[JSON Parse Error] Context: ${context}. Error: ${e.message}. Data: ${str}`,
    );
    return fallback;
  }
}

function roll(chance) {
  return Math.random() < chance;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  safeJsonParse,
  roll,
  rand,
  clearParseCache,
};
