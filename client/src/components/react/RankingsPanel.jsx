import React from 'react';

const RankingsPanel = () => {
  const setRankType = (type) => {
    if (window.setRankType) window.setRankType(type);
  };
  
  const filterRankings = (query) => {
    if (window.filterRankings) window.filterRankings(query);
  };
  
  const refreshRankings = () => {
    if (window.refreshRankings) window.refreshRankings();
  };

  return (
    <div id="rankings" className="panel" style={{ display: 'none' }}>
      <div className="card" style={{ marginTop: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div id="rankings-title" className="card-title" style={{ margin: 0 }}>
              Rankings
            </div>
            <div
              style={{
                display: 'flex',
                gap: '4px',
                background: 'var(--bg3)',
                padding: '4px',
                borderRadius: '8px',
              }}
            >
              <button
                id="rank-tab-kingdoms"
                className="base-btn active"
                style={{ padding: '4px 12px', fontSize: '11px', height: 'auto' }}
                onClick={() => setRankType('kingdoms')}
              >
                Kingdoms
              </button>
              <button
                id="rank-tab-alliances"
                className="base-btn"
                style={{ padding: '4px 12px', fontSize: '11px', height: 'auto' }}
                onClick={() => setRankType('alliances')}
              >
                Alliance
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              id="rank-search"
              className="input"
              placeholder="Search..."
              style={{ width: '180px' }}
              onChange={(e) => filterRankings(e.target.value)}
            />
            <button className="base-btn" onClick={refreshRankings}>
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* KINGDOMS */}
        <div id="rank-view-kingdoms" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr
                style={{
                  color: 'var(--text3)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '2px solid var(--border2)',
                }}
              >
                <th style={{ padding: '8px 6px', textAlign: 'left', width: '32px' }}>#</th>
                <th style={{ padding: '8px 6px', textAlign: 'left' }}>Player</th>
                <th style={{ padding: '8px 6px', textAlign: 'left' }}>Kingdom</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Score</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Level</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Turns Taken</th>
                <th style={{ padding: '8px 6px', textAlign: 'center' }}>Combat</th>
                <th style={{ padding: '8px 6px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody id="rankings-list">
              <tr>
                <td
                  colSpan="8"
                  style={{
                    color: 'var(--text3)',
                    fontSize: '13px',
                    textAlign: 'center',
                    padding: '24px 0',
                  }}
                >
                  Loading rankings...
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ALLIANCES */}
        <div id="rank-view-alliances" style={{ overflowX: 'auto', display: 'none' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr
                style={{
                  color: 'var(--text3)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: '2px solid var(--border2)',
                }}
              >
                <th style={{ padding: '8px 6px', textAlign: 'left', width: '32px' }}>#</th>
                <th style={{ padding: '8px 6px', textAlign: 'left' }}>Alliance</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Members</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Total Score</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Avg Score</th>
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Total Pop</th>
              </tr>
            </thead>
            <tbody id="alliance-rankings-list">
              <tr>
                <td
                  colSpan="6"
                  style={{
                    color: 'var(--text3)',
                    fontSize: '13px',
                    textAlign: 'center',
                    padding: '24px 0',
                  }}
                >
                  Loading...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RankingsPanel;
