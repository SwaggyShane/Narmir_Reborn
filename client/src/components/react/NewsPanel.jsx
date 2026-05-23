import React from 'react';

const NewsPanel = () => {
  const loadNews = () => {
    if (window.loadNews) window.loadNews();
  };

  const clearNews = () => {
    if (window.clearNews) window.clearNews();
  };

  const setNewsFilter = (filter, e) => {
    if (window.setNewsFilter) window.setNewsFilter(filter, e.currentTarget);
  };

  return (
    <div id="news" className="panel" style={{ display: 'none' }}>
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
