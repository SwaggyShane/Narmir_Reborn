import clsx from 'clsx';
import React, { useCallback, useEffect, useState } from 'react';
import { apiCall } from '../../utils/api';
import { setWorldMapData } from '../../utils/worldMapData.js';
import { renderWorldMap } from './WorldmapRenderer.jsx';
import { renderRegionLegend } from './WorldmapLegend.jsx';

export async function loadWorldMap({ setLoading, setError, setMapSvg } = {}) {
  if (typeof setLoading === 'function') setLoading(true);
  if (typeof setError === 'function') setError('');
  try {
    const data = await apiCall('/api/kingdom/world-map');
    if (data?.error) throw new Error(data.error);

    const kingdoms = data.kingdoms || (Array.isArray(data) ? data : []);
    setWorldMapData(kingdoms);
    const svg = renderWorldMap(kingdoms, data.tradeRoutes || []);
    if (typeof setMapSvg === 'function') setMapSvg(svg || '');
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
  const [mapSvg, setMapSvg] = useState('');

  const refreshWorldMap = useCallback(() => loadWorldMap({ setLoading, setError, setMapSvg }), []);

  useEffect(() => {
    refreshWorldMap();
  }, [refreshWorldMap]);

  return (
    <div id="worldmap" className={clsx('panel min-h-0 w-full overflow-y-auto px-4 pb-5', 'hidden')}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <div className="card flex items-center justify-between gap-3">
          <div>
            <div className="card-title !mb-1">🗺️ World of Narmir</div>
          <div className="text-xs text-[var(--text3)]">
            Six ancient regions, each shaped by the race that claims it.
          </div>
          </div>
          <button className="base-btn px-3 py-1 text-[11px]" onClick={refreshWorldMap}>
            ↻ Refresh
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="card xl:min-h-[620px] p-2">
            {loading ? (
              <div className="grid place-items-center py-12 text-[13px] text-[var(--text3)]">
                Loading map...
              </div>
            ) : error ? (
              <div className="grid place-items-center gap-3 py-12 text-center text-[var(--red)]">
                <div>Failed to load world map.</div>
                <button className="btn" onClick={refreshWorldMap}>
                  Retry
                </button>
              </div>
            ) : null}
            {!loading && !error && mapSvg && (
              <div className="w-full overflow-hidden" dangerouslySetInnerHTML={{ __html: mapSvg }} />
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="card" id="region-legend">
              <div className="card-title !mb-3">Regions</div>
              <div id="region-legend-list" />
            </div>
            <div className="card" id="map-kingdom-card" style={{ display: 'none' }}>
              <div className="card-title !mb-2" id="mkc-name">
                —
              </div>
              <div id="mkc-body" />
              <div id="mkc-actions" className="mt-3 flex flex-wrap gap-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorldmapPanel;
