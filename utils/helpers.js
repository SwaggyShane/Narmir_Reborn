// Shared utility functions

const _parseCache = new Map();
const MAX_CACHE_SIZE = 5000;

function clearParseCache() {
  _parseCache.clear();
}

function safeJsonParse(str, fallback = {}, context = "unknown") {
  if (!str) return fallback;
  if (typeof str === "object") return str;
  const cacheKey = `${context}:${str}`;
  if (_parseCache.has(cacheKey)) {
    const val = _parseCache.get(cacheKey);
    _parseCache.delete(cacheKey);
    _parseCache.set(cacheKey, val);
    return val;
  }

  try {
    const val = JSON.parse(str);
    if (_parseCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = _parseCache.keys().next().value;
      _parseCache.delete(oldestKey);
    }
    _parseCache.set(cacheKey, val);
    return val;
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
