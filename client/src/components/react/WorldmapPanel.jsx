import React from 'react';

const WorldmapPanel = () => {
  const loadWorldMap = () => {
    if (window.loadWorldMap) window.loadWorldMap();
  };

  return (
    <div id="worldmap" className="panel" style={{ display: 'none' }}>
      <div className="card" style={{ marginTop: 0 }}>
        <div>
          <div className="card-title" style={{ marginBottom: '2px' }}>
            🗺️ World of Narmir
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
            Six ancient regions, each shaped by the race that claims it.
          </div>
        </div>
        <button className="base-btn" onClick={loadWorldMap}>↻ Refresh</button>
      </div>
      <div className="r-grid-sidebar">
        {/* Map SVG */}
        <div className="card" style={{ padding: '8px' }}>
          <div id="world-map-container" style={{ width: '100%', overflow: 'hidden' }}>
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0', fontSize: '13px' }}>
              Loading map...
            </div>
          </div>
        </div>
        {/* Region legend + info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="card" id="region-legend">
            <div className="card-title" style={{ marginBottom: '10px' }}>Regions</div>
            <div id="region-legend-list"></div>
          </div>
          <div className="card" id="map-kingdom-card" style={{ display: 'none' }}>
            <div className="card-title" style={{ marginBottom: '8px' }} id="mkc-name">
              —
            </div>
            <div id="mkc-body"></div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }} id="mkc-actions">
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorldmapPanel;
