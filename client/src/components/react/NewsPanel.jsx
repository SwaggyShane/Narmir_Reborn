import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { apiCall } from '../../utils/api';
import { useGameState, useGameMutationEvents } from '../../hooks/useGameState';
import { replayWarReport } from '../../utils/replayWarReport';
import { repairMojibake } from '../../utils/repairMojibake';

const NEWS_META = {
  attack: { icon: '⚔️', color: 'var(--red)', label: 'Combat' },
  spell: { icon: '✨', color: 'var(--accent1)', label: 'Spell' },
  covert: { icon: '🕵️', color: 'var(--amber)', label: 'Covert' },
  system: { icon: '📋', color: 'var(--text2)', label: 'System' },
  alliance: { icon: '🤝', color: 'var(--blue)', label: 'Alliance' },
  expedition: { icon: '🧭', color: 'var(--gold)', label: 'Expedition' },
};

const NewsPanel = () => {
  const { state } = useGameState();
  const [newsItems, setNewsItems] = useState([]);
  const [newsFilter, setNewsFilter] = useState('all');

  const repairText = useCallback((value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return repairMojibake(text);
  }, []);

  const timeAgo = useCallback((unixTs) => {
    if (!unixTs) return 'Just now';
    const secs = Math.floor(Date.now() / 1000) - unixTs;
    if (secs < 60) return 'Just now';
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    return `${Math.floor(secs / 86400)}d ago`;
  }, []);

  const getNewsPriority = useCallback((item) => {
    if (!item) return 13;
    const msg = repairText(item.message).toLowerCase();
    const type = item.type || 'system';
    if (msg.includes('season:') || msg.includes('seasonal')) return 1;
    if (type === 'attack' || type === 'spell' || type === 'covert') return 2;
    if (msg.includes('end of turn') || msg.includes('net gold') || msg.includes('final treasury')) return 12;
    if (msg.includes('research') || msg.includes('studying') || msg.includes('spellbook')) return 5;
    if (msg.includes('expedition') || msg.includes('🔭') || msg.includes('scouts')) return 9;
    if (msg.includes('completed:') || msg.includes('completed ') || (msg.includes('building') && msg.includes('ready'))) return 4;
    if (msg.includes('mana')) return 6;
    if (msg.includes('gold earned') || msg.includes('trade route')) return 10;
    if (msg.includes('upkeep') || msg.includes('billable')) return 11;
    if (msg.includes('population') && !msg.includes('happiness')) return 7;
    if (msg.includes('happiness')) return 8;
    if (msg.includes('production:') || msg.includes('wood') || msg.includes('stone') || msg.includes('iron') || msg.includes('food') || msg.includes('forester')) return 3;
    return 13;
  }, [repairText]);

  const summarizeAttackNewsForAll = useCallback((item) => {
    const message = repairText(item?.message || '');
    if (message.indexOf('Defense report:') === 0) return 'You were attacked.';
    if (message.indexOf('Attack report:') === 0) return 'You launched an attack.';
    if (message.toLowerCase().includes('attacked your kingdom')) return 'You were attacked.';
    return 'Combat report available.';
  }, [repairText]);

  const clearBadges = useCallback(() => {
    window.dispatchEvent(new CustomEvent('narmir:clear-news-badges'));
  }, []);

  const loadNews = useCallback(async () => {
    try {
      const items = await apiCall('GET', '/api/kingdom/news/list');
      if (!Array.isArray(items)) return;

      setNewsItems(items);
      window.newsCache = items;
      clearBadges();
    } catch (err) {
      console.error('[NewsPanel] Error loading news:', err);
    }
  }, [clearBadges]);

  const clearNews = useCallback(async () => {
    const result = await apiCall('DELETE', '/api/kingdom/news/clear');
    if (result?.error) {
      console.error('[NewsPanel] Error clearing news:', result.error);
      return;
    }
    setNewsItems([]);
    window.newsCache = [];
  }, []);

  const visibleGroups = useMemo(() => {
    const filtered = newsFilter === 'all'
      ? newsItems
      : newsItems.filter((item) => {
          if (newsFilter === 'system') return !item.type || item.type === 'system';
          return item.type === newsFilter;
        });

    if (!filtered.length) return [];

    const turnMap = {};
    const turnOrder = [];
    filtered.forEach((item) => {
      const turn = item.turn_num || 0;
      if (!turnMap[turn]) {
        turnMap[turn] = [];
        turnOrder.push(turn);
      }
      turnMap[turn].push(item);
    });

    return [...new Set(turnOrder)]
      .sort((a, b) => b - a)
      .map((turn) => {
        const groupItems = [...turnMap[turn]].sort((a, b) => getNewsPriority(a) - getNewsPriority(b));
        return {
          turn,
          timeLabel: timeAgo(groupItems[0]?.created_at),
          items: groupItems,
        };
      });
  }, [getNewsPriority, newsFilter, newsItems, timeAgo]);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  useEffect(() => {
    const handleItems = (event) => {
      const items = Array.isArray(event?.detail) ? event.detail : [];
      if (!items.length) return;
      setNewsItems((prev) => {
        const merged = [...items, ...prev];
        const seen = new Set();
        return merged.filter((item) => {
          const key = `${item?.turn_num || 0}:${item?.type || 'system'}:${item?.message || ''}:${item?.created_at || ''}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
      window.newsCache = Array.isArray(window.newsCache) ? [...items, ...window.newsCache] : items;
    };
    window.addEventListener('narmir:news-items', handleItems);
    return () => window.removeEventListener('narmir:news-items', handleItems);
  }, []);

  useGameMutationEvents((event) => {
    const reason = String(event?.reason || '');
    if ([
      'turn',
      'attack',
      'spell',
      'covert',
      'expedition-start',
      'expedition-complete',
      'expedition-cancel',
      'kingdom-refresh',
      'server-updates',
      'mutation',
    ].includes(reason)) {
      loadNews();
    }
  });

  useEffect(() => {
    const onRefresh = () => loadNews();
    window.addEventListener('narmir:news-refresh', onRefresh);
    return () => window.removeEventListener('narmir:news-refresh', onRefresh);
  }, [loadNews]);

  return (
    <div id="news" className="panel">
      <div className="card mt-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="card-title m-0">
            📰 Kingdom news — Turn <span id="news-turn-num">{state?.turn || 0}</span>
          </div>
          <div className="flex gap-2">
            <button className="base-btn" onClick={loadNews}>↻ Refresh</button>
            <button className="base-btn variant-red bg-[var(--red)]" onClick={clearNews}>Clear all</button>
          </div>
        </div>

        <div className="mb-3.5 flex flex-wrap gap-1.5">
          {[
            ['all', 'All'],
            ['attack', '⚔️ Combat'],
            ['spell', '✨ Spells'],
            ['covert', '🕵️ Covert'],
            ['system', '📋 System'],
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

        <div id="news-list">
          {visibleGroups.length === 0 ? (
            <div className="py-4 text-center text-[13px] text-[var(--text3)]">
              {newsFilter === 'all' ? 'No news yet — take some turns!' : `No ${newsFilter} events yet.`}
            </div>
          ) : visibleGroups.map((group) => (
            <div className="news-turn-group" key={group.turn}>
              <div className="news-turn-header">
                <span className="turn-label">◆ {group.turn > 0 ? `Turn ${group.turn}` : 'Before game start'}</span>
                <span className="turn-time">{group.timeLabel}</span>
              </div>
              {group.items.map((item, idx) => {
                let type = item.type || 'system';
                const rawMessage = repairText(item.message || '');
                if (rawMessage && /^[🔭🌲⚔🧭•]/u.test(rawMessage)) type = 'expedition';
                const meta = NEWS_META[type] || NEWS_META.system;
                const displayMessage = newsFilter === 'all' && type === 'attack'
                  ? summarizeAttackNewsForAll(item)
                  : rawMessage;
                const isBorderType = type === 'attack' || type === 'spell' || type === 'covert';
                const borderStyle = isBorderType ? { borderLeft: `3px solid ${meta.color}`, paddingLeft: '10px' } : {};
                return (
                  <div className="news-item" style={borderStyle} key={`${group.turn}-${idx}-${item.combat_log_id || item.created_at || item.message?.slice(0, 32) || 'news'}`}>
                    <span className="news-icon">{meta.icon}</span>
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

      <div id="vue-panel-races" className="contents" />
      <div id="vue-panel-bounties" className="contents" />
    </div>
  );
};

export default NewsPanel;
