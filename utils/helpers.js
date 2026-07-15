// Shared utility functions

const { getProfiler } = require('../game/profiling');

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
  if (typeof str === "object") return shallowCopy(str);
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

  const start = performance.now();
  try {
    const val = JSON.parse(str);
    getProfiler().recordJsonParse(performance.now() - start);
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

// Timed counterpart to safeJsonParse, for the write side (turn processing
// serializes ~15 JSON columns per turn). Feeds the same profiler so
// TODO.md's "JSON cost >100ms" budget check reflects real parse+stringify
// cost instead of only counting attunement time.
function safeJsonStringify(value) {
  const start = performance.now();
  const result = JSON.stringify(value);
  getProfiler().recordJsonStringify(performance.now() - start);
  return result;
}

function roll(chance) {
  return Math.random() < chance;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Dev-only log: silenced in production to keep real errors from being
// drowned in per-turn noise.  Use console.error/warn directly for
// problems you always want to see.
const _IS_DEV_LOG_PROD = process.env.NODE_ENV === 'production';
function devLog(...args) {
  if (!_IS_DEV_LOG_PROD) console.log(...args);
}

module.exports = {
  safeJsonParse,
  safeJsonStringify,
  roll,
  rand,
  clearParseCache,
  devLog,
};
