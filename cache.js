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
const serverStateCache = new TTLCache();    // server configuration/state
const unreadNewsCache = new TTLCache();     // kingdomId -> unread count

// Server state helper - get or load from db
async function getServerState(db, key, ttlMs = 60 * 60 * 1000) {
  const cacheKey = `server_state:${key}`;
  if (serverStateCache.has(cacheKey)) {
    return serverStateCache.get(cacheKey);
  }

  const row = await db.get("SELECT value FROM server_state WHERE key = ?", [key]);
  const value = row?.value || null;
  if (value) {
    serverStateCache.set(cacheKey, value, ttlMs);
  }
  return value;
}

function setUnreadCount(kingdomId, count) {
  serverStateCache.set(`unread:${kingdomId}`, count, 60 * 60 * 1000);
}

function getUnreadCount(kingdomId) {
  return serverStateCache.get(`unread:${kingdomId}`) || 0;
}

function incrementUnread(kingdomId) {
  const current = getUnreadCount(kingdomId);
  setUnreadCount(kingdomId, current + 1);
}

function decrementUnread(kingdomId) {
  const current = getUnreadCount(kingdomId);
  setUnreadCount(kingdomId, Math.max(0, current - 1));
}

module.exports = {
  TTLCache,
  marketPriceCache,
  kingdomIdCache,
  rankingsCache,
  bountiesCache,
  serverStateCache,
  unreadNewsCache,
  getServerState,
  setUnreadCount,
  getUnreadCount,
  incrementUnread,
  decrementUnread,
};
