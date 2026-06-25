import { useCallback, useEffect, useState } from 'react';
import { useActivePanel } from './useActivePanel.js';
import { useAppEvent } from './useAppEvent.js';
import { AppEvent } from '../utils/appEvents.js';

const INITIAL = { chat: false, news: false, messages: false };

export function useShellBadges() {
  const { activePanel } = useActivePanel();
  const [badges, setBadges] = useState(INITIAL);

  useAppEvent(AppEvent.CHAT_BADGE_ALERT, useCallback(() => {
    setBadges((prev) => ({ ...prev, chat: true }));
  }, []));

  useAppEvent(AppEvent.MESSAGES_BADGE, useCallback(() => {
    setBadges((prev) => ({ ...prev, messages: true }));
  }, []));

  useAppEvent(AppEvent.CLEAR_NEWS_BADGES, useCallback(() => {
    setBadges((prev) => ({ ...prev, news: false }));
  }, []));

  useAppEvent(AppEvent.NEWS_ITEMS, useCallback(() => {
    setBadges((prev) => ({ ...prev, news: true }));
  }, []));

  useAppEvent(AppEvent.NEWS_REFRESH, useCallback(() => {
    setBadges((prev) => ({ ...prev, news: true }));
  }, []));

  useEffect(() => {
    if (activePanel === 'globalchat') {
      setBadges((prev) => (prev.chat ? { ...prev, chat: false } : prev));
    }
    if (activePanel === 'news') {
      setBadges((prev) => (prev.news ? { ...prev, news: false } : prev));
    }
    if (activePanel === 'messages') {
      setBadges((prev) => (prev.messages ? { ...prev, messages: false } : prev));
    }
  }, [activePanel]);

  const hasBadge = useCallback((badgeKey) => {
    if (!badgeKey) return false;
    return !!badges[badgeKey];
  }, [badges]);

  return { badges, hasBadge };
}