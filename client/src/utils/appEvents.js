const listeners = new Map();

export const AppEvent = {
  FORUM_REFRESH: 'forum-refresh',
  NEWS_REFRESH: 'news-refresh',
  NEWS_ITEMS: 'news-items',
  CLEAR_NEWS_BADGES: 'clear-news-badges',
  ALLIANCE_REFRESH: 'alliance-refresh',
  ALLIANCE_CHAT_MESSAGE: 'alliance-chat-message',
  CHAT_CLEAR: 'chat-clear',
  CHAT_BADGE_ALERT: 'chat-badge-alert',
  MESSAGES_BADGE: 'messages-badge',
  WORLDMAP_REFRESH: 'worldmap-refresh',
  MAP_KINGDOM_CARD: 'map-kingdom-card',
  EXPEDITION_LOG_ENTRY: 'expedition-log-entry',
  NAV_LAYOUT_CHANGE: 'nav-layout-change',
};

export function subscribeAppEvent(event, handler) {
  if (!event || typeof handler !== 'function') {
    return () => {};
  }
  if (!listeners.has(event)) listeners.set(event, new Set());
  const bucket = listeners.get(event);
  bucket.add(handler);
  return () => {
    bucket.delete(handler);
    if (bucket.size === 0) listeners.delete(event);
  };
}

export function emitAppEvent(event, detail) {
  const bucket = listeners.get(event);
  if (!bucket) return;
  for (const handler of [...bucket]) {
    try {
      handler(detail);
    } catch (err) {
      console.error(`[appEvents] handler failed for ${event}:`, err);
    }
  }
}