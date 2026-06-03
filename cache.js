// Simple in-memory cache with TTL support
class TTLCache {
  constructor() {
    this.data = new Map();
    this.timers = new Map();
  }

  set(key, value, ttlMs) {
    // Clear old timer if exists
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    this.data.set(key, value);

    if (ttlMs) {
      const timer = setTimeout(() => {
        this.data.delete(key);
        this.timers.delete(key);
      }, ttlMs);
      this.timers.set(key, timer);
    }
  }

  get(key) {
    return this.data.get(key);
  }

  has(key) {
    return this.data.has(key);
  }

  delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    this.data.delete(key);
  }

  clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.data.clear();
    this.timers.clear();
  }

  size() {
    return this.data.size;
  }
}

// Global cache instances
const marketPriceCache = new TTLCache();
const kingdomIdCache = new TTLCache();      // playerId -> kingdomId
const rankingsCache = new TTLCache();
const bountiesCache = new TTLCache();

module.exports = {
  TTLCache,
  marketPriceCache,
  kingdomIdCache,
  rankingsCache,
  bountiesCache,
};
