import React, { useCallback, useEffect, useState } from 'react';
import { apiCall } from '../../utils/api';
import { renderWorldMap } from './WorldmapRenderer.jsx';
import { renderRegionLegend } from './WorldmapLegend.jsx';

export async function loadWorldMap({ setLoading, setError } = {}) {
  if (typeof setLoading === 'function') setLoading(true);
  if (typeof setError === 'function') setError('');
  try {
    const data = await apiCall('/api/kingdom/world-map');
    if (data?.error) throw new Error(data.error);

    const kingdoms = data.kingdoms || (Array.isArray(data) ? data : []);
    window.worldMapData = kingdoms;
    renderWorldMap(kingdoms, data.tradeRoutes || []);
    renderRegionLegend();
  } catch (err) {
    console.error('World map fail:', err);
    if (typeof setError === 'function') setError(err.message || 'Failed to load world map');
    throw err;
  } finally {
    if (typeof setLoading === 'function') setLoading(false);
  }
}

const WorldmapPanel = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshWorldMap = useCallback(() => loadWorldMap({ setLoading, setError }), []);

  useEffect(() => {
    refreshWorldMap();
  }, [refreshWorldMap]);

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
        <button className="base-btn" onClick={refreshWorldMap}>↻ Refresh</button>
      </div>
      <div className="r-grid-sidebar">
        {/* Map SVG */}
        <div className="card" style={{ padding: '8px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0', fontSize: '13px' }}>
              Loading map...
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--red)' }}>
              Failed to load world map.
              <button className="btn" onClick={refreshWorldMap} style={{ marginTop: '10px' }}>Retry</button>
            </div>
          ) : null}
          <div id="world-map-container" style={{ width: '100%', overflow: 'hidden' }}>
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
