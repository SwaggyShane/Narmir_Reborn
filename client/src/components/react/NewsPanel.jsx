import React, { useState, useEffect, useCallback } from 'react';

const NewsPanel = () => {
  const [newsLoaded, setNewsLoaded] = useState(false);

  // Direct API call for loading news
  const loadNews = useCallback(async () => {
    try {
      if (!window.apiCall) return;

      const items = await window.apiCall("GET", "/api/kingdom/news/list");
      const titleTurn = document.getElementById("news-turn-num");
      if (titleTurn) titleTurn.textContent = window.state?.turn || 0;
      if (!Array.isArray(items)) return;

      if (window.newsCache) window.newsCache = items;
      if (window.renderNewsList) window.renderNewsList(items);

      // Clear badges
      ["news-badge", "bnav-news-badge"].forEach(function (id) {
        var b = document.getElementById(id);
        if (b) {
          b.style.display = "none";
          b.textContent = "";
        }
      });

      setNewsLoaded(true);
    } catch (err) {
      console.error("[NewsPanel] Error loading news:", err);
    }
  }, []);

  const clearNews = useCallback(() => {
    if (window.clearNews) window.clearNews();
  }, []);

  const setNewsFilter = useCallback((filter, e) => {
    if (window.setNewsFilter) window.setNewsFilter(filter, e.currentTarget);
  }, []);

  // Expose functions globally
  useEffect(() => {
    window.newsRefresh = loadNews;
    window.newsClear = clearNews;
    window.newsFilterSet = setNewsFilter;

    return () => {
      delete window.newsRefresh;
      delete window.newsClear;
      delete window.newsFilterSet;
    };
  }, [loadNews, clearNews, setNewsFilter]);

  return (
    <div id="news" className="panel">
      <div className="card" style={{ marginTop: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div className="card-title" style={{ marginBottom: 0 }}>
            📰 Kingdom news — Turn <span id="news-turn-num">0</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="base-btn" onClick={loadNews}>↻ Refresh</button>
            <button className="base-btn variant-red" style={{ background: 'var(--red)' }} onClick={clearNews}>Clear all</button>
          </div>
        </div>
        <div
          style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}
        >
          <button
            className="base-btn news-filter active"
            data-filter="all"
            onClick={(e) => setNewsFilter('all', e)}
            style={{ fontSize: '12px', padding: '4px 10px' }}
          >
            All
          </button>
          <button
            className="base-btn news-filter"
            data-filter="attack"
            onClick={(e) => setNewsFilter('attack', e)}
            style={{ fontSize: '12px', padding: '4px 10px' }}
          >
            ⚔️ Combat
          </button>
          <button
            className="base-btn news-filter"
            data-filter="spell"
            onClick={(e) => setNewsFilter('spell', e)}
            style={{ fontSize: '12px', padding: '4px 10px' }}
          >
            ✨ Spells
          </button>
          <button
            className="base-btn news-filter"
            data-filter="covert"
            onClick={(e) => setNewsFilter('covert', e)}
            style={{ fontSize: '12px', padding: '4px 10px' }}
          >
            🕵️ Covert
          </button>
          <button
            className="base-btn news-filter"
            data-filter="system"
            onClick={(e) => setNewsFilter('system', e)}
            style={{ fontSize: '12px', padding: '4px 10px' }}
          >
            📋 System
          </button>
        </div>
        <div id="news-list">
          <div style={{ color: 'var(--text3)', fontSize: '13px', padding: '8px 0' }}>
            Loading news...
          </div>
        </div>
      </div>
      
      {/* RACES */}
      <div id="vue-panel-races" style={{ display: 'contents' }}></div>
      {/* BOUNTIES */}
      <div id="vue-panel-bounties" style={{ display: 'contents' }}></div>
    </div>
  );
};

export default NewsPanel;
