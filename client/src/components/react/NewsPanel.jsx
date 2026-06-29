import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { apiCall } from '../../utils/api';
import { useTurn, useEconomyStore } from '../../stores';
import { AppEvent, emitAppEvent } from '../../utils/appEvents.js';
import { useAppEvent } from '../../hooks/useAppEvent.js';
import { replayWarReport, registerReplayModal } from '../../utils/replayWarReport';
import { repairMojibake } from '../../utils/repairMojibake';
import { formatNewsMessage, getNewsMeta } from '../../../../game/news-emoji.mjs';
import ReplayModal from './ReplayModal.jsx';

const NewsPanel = () => {
  const turn = useTurn();
  const [newsItems, setNewsItems] = useState([]);
  const [newsFilter, setNewsFilter] = useState('all');
  const [replayData, setReplayData] = useState(null);

  useEffect(() => {
    registerReplayModal((data) => setReplayData(data));
    return () => registerReplayModal(null);
  }, []);

  const formatText = useCallback((value) => {
    return formatNewsMessage(value, repairMojibake);
  }, []);

  const timeAgo = useCallback((unixTs) => {
    if (!unixTs) return 'Just now';
    const secs = Math.floor(Date.now() / 1000) - unixTs;
    if (secs < 60) return 'Just now';
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  }, []);

  const isAnnouncement = useCallback((item) => {
    if (!item) return false;
    if (item.type === 'announcement') return true;
    return formatText(item.message).text.includes('Server announcement:');
  }, [formatText]);

  const getNewsPriority = useCallback((item) => {
    if (!item) return 13;
    if (isAnnouncement(item)) return 0;
    const msg = formatText(item.message).text.toLowerCase();
    const type = item.type || 'system';
    if (msg.includes('season:') || msg.includes('seasonal')) return 1;
    if (type === 'attack' || type === 'spell' || type === 'covert') return 2;
    if (msg.includes('end of turn') || msg.includes('net gold') || msg.includes('final treasury')) return 12;
    if (msg.includes('research') || msg.includes('studying') || msg.includes('spellbook')) return 5;
    if (msg.includes('expedition') || msg.includes('scouts')) return 9;
    if (msg.includes('completed:') || msg.includes('completed ') || (msg.includes('building') && msg.includes('ready'))) return 4;
    if (msg.includes('mana')) return 6;
    if (msg.includes('gold earned') || msg.includes('trade route')) return 10;
    if (msg.includes('upkeep') || msg.includes('billable')) return 11;
    if (msg.includes('population') && !msg.includes('happiness')) return 7;
    if (msg.includes('happiness')) return 8;
    if (msg.includes('production:') || msg.includes('wood') || msg.includes('stone') || msg.includes('iron') || msg.includes('food') || msg.includes('forester')) return 3;
    return 13;
  }, [formatText, isAnnouncement]);

  const summarizeAttackNewsForAll = useCallback((item) => {
    const message = formatText(item?.message || '').text;
    if (message.indexOf('Defense report:') === 0) return 'You were attacked.';
    if (message.indexOf('Attack report:') === 0) return 'You launched an attack.';
    if (message.toLowerCase().includes('attacked your kingdom')) return 'You were attacked.';
    return 'Combat report available.';
  }, [formatText]);

  const clearBadges = useCallback(() => {
    emitAppEvent(AppEvent.CLEAR_NEWS_BADGES);
  }, []);

  const loadNews = useCallback(async () => {
    try {
      const items = await apiCall('/api/kingdom/news/list');
      if (!Array.isArray(items)) return;

      setNewsItems(items);
      clearBadges();
    } catch (err) {
      console.error('[NewsPanel] Error loading news:', err);
    }
  }, [clearBadges]);

  const clearNews = useCallback(async () => {
    const result = await apiCall('/api/kingdom/news/clear', { method: 'DELETE' });
    if (result?.error) {
      console.error('[NewsPanel] Error clearing news:', result.error);
      return;
    }
    setNewsItems([]);
  }, []);

  const visibleGroups = useMemo(() => {
    const filtered = newsFilter === 'all'
      ? newsItems
      : newsItems.filter((item) => {
          if (newsFilter === 'system') {
            return !item.type || item.type === 'system' || item.type === 'announcement';
          }
          return item.type === newsFilter;
        });

    if (!filtered.length) return [];

    const pinned = filtered
      .filter(isAnnouncement)
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    const regular = filtered.filter((item) => !isAnnouncement(item));

    const turnMap = {};
    const turnOrder = [];
    regular.forEach((item) => {
      const turn = item.turn_num || 0;
      if (!turnMap[turn]) {
        turnMap[turn] = [];
        turnOrder.push(turn);
      }
      turnMap[turn].push(item);
    });

    const turnGroups = [...new Set(turnOrder)]
      .sort((a, b) => b - a)
      .map((turn) => {
        const groupItems = [...turnMap[turn]].sort((a, b) => getNewsPriority(a) - getNewsPriority(b));
        return {
          turn,
          pinned: false,
          timeLabel: timeAgo(groupItems[0]?.created_at),
          items: groupItems,
        };
      });

    if (!pinned.length) return turnGroups;

    return [
      {
        turn: 'announcement',
        pinned: true,
        timeLabel: timeAgo(pinned[0]?.created_at),
        items: pinned,
      },
      ...turnGroups,
    ];
  }, [getNewsPriority, isAnnouncement, newsFilter, newsItems, timeAgo]);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  const handleNewsItems = useCallback((items) => {
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) return;
    setNewsItems((prev) => {
      const merged = [...rows, ...prev];
      const seen = new Set();
      return merged.filter((item) => {
        const key = `${item?.turn_num || 0}:${item?.type || 'system'}:${item?.message || ''}:${item?.created_at || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });
  }, []);

  useAppEvent(AppEvent.NEWS_ITEMS, handleNewsItems);

  // Subscribe to turn changes to reload news (triggers on server updates)
  useEffect(() => {
    const unsubscribe = useEconomyStore.subscribe(
      (state) => state.gold, // Subscribe to any economy changes
      () => loadNews()
    );
    return unsubscribe;
  }, []);

  useAppEvent(AppEvent.NEWS_REFRESH, loadNews);

  return (
    <div id="news" className="panel">
      <div className="card mt-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="card-title m-0">
            📰 Kingdom news — Turn <span id="news-turn-num">{turn}</span>
          </div>
          <div className="flex gap-2">
            <button className="base-btn" onClick={loadNews}>↻ Refresh</button>
            <button className="base-btn variant-red bg-[var(--red)]" onClick={clearNews}>Clear all</button>
          </div>
        </div>

        <div className="mb-3.5 flex flex-wrap gap-1.5">
          {[
            ['all', 'All'],
            ['attack', `${getNewsMeta('attack').icon} Combat`],
            ['spell', `${getNewsMeta('spell').icon} Spells`],
            ['covert', `${getNewsMeta('covert').icon} Covert`],
            ['system', `${getNewsMeta('system').icon} System`],
          ].map(([value, label]) => (
            <button
              key={value}
              className={clsx('base-btn news-filter text-[12px] px-2.5 py-1', newsFilter === value && 'active')}
              data-filter={value}
              onClick={() => setNewsFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div>
          {visibleGroups.length === 0 ? (
            <div className="py-4 text-center text-[13px] text-[var(--text3)]">
              {newsFilter === 'all' ? 'No news yet — take some turns!' : `No ${newsFilter} events yet.`}
            </div>
          ) : visibleGroups.map((group) => (
            <div className="news-turn-group" key={group.turn}>
              <div className="news-turn-header">
                <span className="turn-label">◆ {group.pinned ? 'Server announcement' : group.turn > 0 ? `Turn ${group.turn}` : 'Before game start'}</span>
                <span className="turn-time">{group.timeLabel}</span>
              </div>
              {group.items.map((item, idx) => {
                let type = item.type || 'system';
                const formatted = formatText(item.message || '');
                if (formatted.text && /^[\ud83d\udd2d\ud83c\udf32\u2694\ud83e\udded\u2022]/u.test(`${formatted.emoji} ${formatted.text}`)) {
                  type = 'expedition';
                }
                const meta = getNewsMeta(type);
                const isAttackSummary = newsFilter === 'all' && type === 'attack';
                const displayMessage = isAttackSummary ? summarizeAttackNewsForAll(item) : formatted.text;
                const displayIcon = isAttackSummary ? meta.icon : formatted.emoji;
                const isBorderType = type === 'attack' || type === 'spell' || type === 'covert';
                const borderStyle = isBorderType ? { borderLeft: `3px solid ${meta.color}`, paddingLeft: '10px' } : {};
                return (
                  <div className="news-item" style={borderStyle} key={`${group.turn}-${idx}-${item.combat_log_id || item.created_at || item.message?.slice(0, 32) || 'news'}`}>
                    <span className="news-icon">{displayIcon}</span>
                    <span className="news-body" style={{ color: isBorderType ? 'var(--text)' : 'var(--text2)' }}>
                      {displayMessage}
                      {item.combat_log_id ? (
                        <button
                          className="btn inline-flex items-center gap-1 text-[10px] px-2 py-0.5 mt-1 ml-2.5"
                          onClick={() => replayWarReport(item.combat_log_id)}
                        >
                          ▶ Replay
                        </button>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {replayData && (
        <ReplayModal
          title={replayData.title}
          steps={replayData.steps}
          onClose={() => setReplayData(null)}
        />
      )}
    </div>
  );
};

export default NewsPanel;
