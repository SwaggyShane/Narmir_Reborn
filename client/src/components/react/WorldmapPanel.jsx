import clsx from 'clsx';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiCall } from '../../utils/api';
import { setWorldMapData } from '../../utils/worldMapData.js';
import { renderWorldMap } from './WorldmapRenderer.jsx';
import { fmtShort } from '../../utils/numberFormat.js';
import { repairMojibake } from '../../utils/repairMojibake.js';
import { RACE_ICONS } from '../../utils/raceIcons.js';
import { REGION_META, REGION_BONUSES } from '../../utils/raceData.js';
import { openKingdomProfile } from './KingdomProfileModal.jsx';
import { targetFromRankings } from '../../utils/rankingsTarget.js';
import { toast } from '../../utils/toast.js';
import { showMapKingdomCard } from './MapKingdomCard.jsx';
import { AppEvent } from '../../utils/appEvents.js';
import { useAppEvent } from '../../hooks/useAppEvent.js';

const MAP_REGIONS = Object.keys(REGION_META);

export async function loadWorldMap({ setLoading, setError, setKingdoms, setTradeRoutes } = {}) {
  if (typeof setLoading === 'function') setLoading(true);
  if (typeof setError === 'function') setError('');
  try {
    const data = await apiCall('/api/kingdom/world-map');
    if (data?.error) throw new Error(data.error);

    const kingdoms = data.kingdoms || (Array.isArray(data) ? data : []);
    const tradeRoutes = data.tradeRoutes || [];
    if (typeof setKingdoms === 'function') setKingdoms(kingdoms);
    if (typeof setTradeRoutes === 'function') setTradeRoutes(tradeRoutes);
  } catch (err) {
    console.error('World map fail:', err);
    if (typeof setError === 'function') setError(err.message || 'Failed to load world map');
    throw err;
  } finally {
    if (typeof setLoading === 'function') setLoading(false);
  }
}

async function establishTradeRoute(targetId, onSuccess) {
  if (!targetId) return;
  try {
    const result = await apiCall('/api/kingdom/trade-routes/establish', {
      method: 'POST',
      body: { targetId },
    });
    if (result?.error) {
      toast(result.error, 'error');
      return;
    }
    toast(result?.message || 'Trade route established', 'success');
    if (typeof onSuccess === 'function') {
      onSuccess();
    }
  } catch (err) {
    console.error('[worldmap] establish trade route failed:', err);
    toast('Failed to establish trade route', 'error');
  }
}

function RegionLegend({ kingdoms, highlightedRace, onHighlight }) {
  return (
    <div className="flex flex-col">
      {MAP_REGIONS.map((race) => {
        const meta = REGION_META[race] || {};
        const icon = RACE_ICONS[race] || '?';
        const count = kingdoms.filter((k) => k.race === race).length;
        const bonus = REGION_BONUSES[race] || '';
        const active = highlightedRace === race;

        return (
          <button
            key={race}
            type="button"
            onClick={() => onHighlight(active ? null : race)}
            className={clsx(
              'flex w-full items-center gap-2 border-b border-[var(--border)] px-0 py-1.5 text-left transition',
              active ? 'opacity-100' : 'opacity-90 hover:opacity-100',
            )}
          >
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-sm border-[1.5px]"
              style={{ background: meta.color, borderColor: meta.stroke }}
            />
            <span className="text-sm">{icon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-[var(--text)]">{meta.name}</div>
              <div className="text-[10px] text-[var(--text3)]">
                {bonus} | {count} kingdoms
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

const WorldmapPanel = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kingdoms, setKingdoms] = useState([]);
  const [tradeRoutes, setTradeRoutes] = useState([]);
  const [highlightedRace, setHighlightedRace] = useState(null);
  const [mapCard, setMapCard] = useState(null);

  const mapSvg = useMemo(() => {
    if (!kingdoms.length) return '';
    return renderWorldMap(kingdoms, tradeRoutes, highlightedRace);
  }, [kingdoms, tradeRoutes, highlightedRace]);

  const refreshWorldMap = useCallback(
    () => loadWorldMap({ setLoading, setError, setKingdoms, setTradeRoutes }),
    [],
  );

  useEffect(() => {
    refreshWorldMap();
  }, [refreshWorldMap]);

  useEffect(() => {
    if (kingdoms.length) {
      setWorldMapData(kingdoms);
    }
  }, [kingdoms]);

  const onWorldMapRefresh = useCallback(() => {
    refreshWorldMap().catch(() => {});
  }, [refreshWorldMap]);

  useAppEvent(AppEvent.WORLDMAP_REFRESH, onWorldMapRefresh);
  useAppEvent(AppEvent.MAP_KINGDOM_CARD, setMapCard);

  const handleMapClick = useCallback((event) => {
    const dot = event.target.closest?.('.kd-dot');
    const kingdomId = dot?.getAttribute('data-kingdom-id');
    if (kingdomId) {
      showMapKingdomCard(kingdomId);
    }
  }, []);

  return (
    <div id="worldmap" className="panel">
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
              <div
                id="world-map-container"
                className="w-full overflow-hidden"
                onClick={handleMapClick}
                dangerouslySetInnerHTML={{ __html: mapSvg }}
              />
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="card" id="region-legend">
              <div className="card-title !mb-3">Regions</div>
              <RegionLegend
                kingdoms={kingdoms}
                highlightedRace={highlightedRace}
                onHighlight={setHighlightedRace}
              />
            </div>
            {mapCard && (
              <div className="card">
                <div className="card-title !mb-2">
                  {RACE_ICONS[mapCard.kingdom.race] || '🤴'} {repairMojibake(mapCard.kingdom.name || '')}
                  {mapCard.kingdom.is_ai && <span className="text-[10px] text-[var(--text3)]"> AI</span>}
                </div>
                <div className="text-[12px] text-[var(--text3)] mb-2">
                  <span style={{ color: mapCard.meta.stroke || '#fff' }}>
                    {mapCard.meta.name || mapCard.kingdom.region || '—'}
                  </span>{' '}
                  | Level {mapCard.kingdom.level || 1} | Turn {mapCard.kingdom.turn || 0}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[12px] mb-3">
                  <div className="bg-[var(--bg3)] rounded text-center p-2">
                    <div className="text-[10px] text-[var(--text3)]">LAND</div>
                    <div className="text-[var(--gold)] font-bold">{fmtShort(mapCard.kingdom.land)}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {!mapCard.isMe ? (
                    <>
                      <button className="btn text-[11px] px-2 py-1" onClick={() => openKingdomProfile(mapCard.kingdom.name)}>
                        🤴 Profile
                      </button>
                      <button className="btn btn-red text-[11px] px-2 py-1" onClick={() => targetFromRankings(mapCard.kingdom.id, 'attack')}>
                        ⚔️ Attack
                      </button>
                      <button className="btn btn-accent text-[11px] px-2 py-1" onClick={() => targetFromRankings(mapCard.kingdom.id, 'spells')}>
                        ✨ Spell
                      </button>
                      <div className="w-full text-center mt-2">
                        {mapCard.hasTradingPost ? (
                          <button className="btn btn-gold text-[11px] px-2 py-1 w-full" onClick={() => establishTradeRoute(mapCard.kingdom.id, refreshWorldMap)}>
                            🤝 Trade Route (10k GC)
                          </button>
                        ) : (
                          <div className="text-[10px] text-[var(--red)] border border-[var(--red)] p-1 rounded">
                            Trading Post required to establish routes
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="text-[12px] text-[var(--accent1)]">Your kingdom</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorldmapPanel;