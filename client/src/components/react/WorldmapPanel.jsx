import clsx from 'clsx';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { apiCall } from '../../utils/api';
import { setWorldMapData } from '../../utils/worldMapData.js';
import { renderWorldMap } from './WorldmapRenderer.jsx';
import { fmtShort } from '../../utils/numberFormat.js';
import { repairMojibake } from '../../utils/repairMojibake.js';
import { RACE_ICONS } from '../../utils/raceIcons.js';
import { REGION_META, REGION_BONUSES } from '../../utils/raceData.js';
import { NODE_TYPE_META, formatNodeDistance } from '../../utils/worldMapNodeMeta.js';
import { openKingdomProfile } from './KingdomProfileModal.jsx';
import { targetFromRankings } from '../../utils/rankingsTarget.js';
import { toast } from '../../utils/toast.js';
import { showMapKingdomCard } from './MapKingdomCard.jsx';
import { AppEvent } from '../../utils/appEvents.js';
import { useAppEvent } from '../../hooks/useAppEvent.js';
import { useKingdomId, useMarketUpgrades } from '../../stores';
import { switchTab } from '../../utils/panelNav.js';
import {
  animateMapPanelCard,
  animateWorldMap,
} from '../../utils/worldMapGsap.js';
import { useWorldMapViewport } from '../../hooks/useWorldMapViewport.js';

const MAP_REGIONS = Object.keys(REGION_META);

const RACE_COLORS = {
  dwarf: { bg: '#8B6914', text: '#c8962a' },
  high_elf: { bg: '#1a4a2e', text: '#4caf82' },
  orc: { bg: '#4a1010', text: '#e05c5c' },
  dark_elf: { bg: '#1a1030', text: 'var(--accent1)' },
  human: { bg: '#1a2a10', text: '#8fb84a' },
  dire_wolf: { bg: '#0d1a20', text: '#4a8fb8' },
  vampire: { bg: '#2a0a1a', text: '#8b1a4a' },
  ogre: { bg: '#3a2410', text: '#b8752a' },
  wood_elf: { bg: '#0f3018', text: '#3fae5c' },
};

const DEFAULT_LAYERS = {
  kingdoms: true,
  nodes: true,
  routes: true,
  expeditions: true,
  terrain: false,
};

export async function loadWorldMap({ setLoading, setError, setKingdoms, setTradeRoutes, setNodes, setExpeditions, setWorldSeed, setVisibility } = {}) {
  if (typeof setLoading === 'function') setLoading(true);
  if (typeof setError === 'function') setError('');
  try {
    const data = await apiCall('/api/kingdom/world-map');
    if (data?.error) throw new Error(data.error);

    const kingdoms = data.kingdoms || (Array.isArray(data) ? data : []);
    const tradeRoutes = data.tradeRoutes || [];
    const nodes = data.nodes || [];
    const expeditions = data.expeditions || [];
    if (typeof setKingdoms === 'function') setKingdoms(kingdoms);
    if (typeof setTradeRoutes === 'function') setTradeRoutes(tradeRoutes);
    if (typeof setNodes === 'function') setNodes(nodes);
    if (typeof setExpeditions === 'function') setExpeditions(expeditions);
    // Fog of War Phase 1.5: worldSeed arrives as a string (BigInt can't be
    // JSON-serialized) — passed through as-is, WorldmapRenderer.jsx parses
    // it back to BigInt itself so terrain biome patterns change per world.
    if (typeof setWorldSeed === 'function') setWorldSeed(data.worldSeed || null);
    // Phase 4: visibility bitmaps (decimal strings) for fog overlay.
    if (typeof setVisibility === 'function') setVisibility(data.visibility || null);
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
        const colors = RACE_COLORS[race] || { bg: '#333', text: '#999' };
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
              style={{ background: colors.bg, borderColor: colors.text }}
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

function MapLayerToggles({ layers, onToggle }) {
  const items = [
    { key: 'kingdoms', label: 'Kingdoms', icon: '🏰' },
    { key: 'nodes', label: 'Resource Nodes', icon: '⛏️' },
    { key: 'routes', label: 'Trade Routes', icon: '🤝' },
    { key: 'expeditions', label: 'Expeditions', icon: '🧭' },
    { key: 'terrain', label: 'Terrain', icon: '🌄' },
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => {
        const active = layers[item.key];
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onToggle(item.key)}
            className={clsx(
              'base-btn px-2 py-1 text-[10px]',
              active ? 'opacity-100' : 'opacity-50',
            )}
          >
            {item.icon} {item.label}
          </button>
        );
      })}
    </div>
  );
}

const WorldmapPanel = ({ onHexClick = null } = {}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kingdoms, setKingdoms] = useState([]);
  const [tradeRoutes, setTradeRoutes] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [expeditions, setExpeditions] = useState([]);
  const [worldSeed, setWorldSeed] = useState(null);
  const [visibility, setVisibility] = useState(null);
  const [highlightedRace, setHighlightedRace] = useState(null);
  const [mapCard, setMapCard] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const currentKingdomId = useKingdomId();
  const marketUpgrades = useMarketUpgrades();
  const mapContainerRef = useRef(null);
  const mapAnimatedKeyRef = useRef('');
  const nodeCardRef = useRef(null);
  const kingdomCardRef = useRef(null);

  const mapSvg = useMemo(() => {
    if (!kingdoms.length && !nodes.length) return '';
    return renderWorldMap(kingdoms, tradeRoutes, highlightedRace, currentKingdomId, {
      nodes,
      expeditions,
      layers,
      worldSeed,
      visibility,
    });
  }, [kingdoms, tradeRoutes, highlightedRace, currentKingdomId, nodes, expeditions, layers, worldSeed, visibility]);

  const mapDataKey = useMemo(
    () => `${kingdoms.length}:${nodes.length}:${expeditions.length}:${highlightedRace}:${currentKingdomId}`,
    [kingdoms.length, nodes.length, expeditions.length, highlightedRace, currentKingdomId],
  );

  const {
    viewportRef,
    stageRef,
    zoomLabel,
    resetViewport,
    zoomIn,
    zoomOut,
    shouldSuppressClick,
  } = useWorldMapViewport({ resetKey: mapDataKey, enabled: Boolean(mapSvg && !loading && !error) });

  useLayoutEffect(() => {
    if (!mapContainerRef.current || !mapSvg) return undefined;
    const entrance = mapAnimatedKeyRef.current !== mapDataKey;
    mapAnimatedKeyRef.current = mapDataKey;
    return animateWorldMap(mapContainerRef.current, {
      layers,
      selectedNodeId: selectedNode?.id ?? null,
      entrance,
    });
  }, [mapSvg, mapDataKey, layers, selectedNode?.id]);

  useLayoutEffect(() => {
    const cleanup = animateMapPanelCard(nodeCardRef.current, { visible: Boolean(selectedNode) });
    if (selectedNode && nodeCardRef.current) {
      nodeCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return cleanup;
  }, [selectedNode]);

  useLayoutEffect(() => {
    const cleanup = animateMapPanelCard(kingdomCardRef.current, { visible: Boolean(mapCard) });
    if (mapCard && kingdomCardRef.current) {
      kingdomCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return cleanup;
  }, [mapCard]);

  const refreshWorldMap = useCallback(
    () => loadWorldMap({
      setLoading,
      setError,
      setKingdoms,
      setTradeRoutes,
      setNodes,
      setExpeditions,
      setWorldSeed,
      setVisibility,
    }),
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

  const toggleLayer = useCallback((key) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleMapClick = useCallback((event) => {
    if (shouldSuppressClick()) return;

    let element = event.target;
    let nodeId = null;
    let targetKingdomId = null;
    let hexX = null;
    let hexY = null;

    // Walk up the DOM tree to find node, kingdom, or hex element
    while (element && element !== event.currentTarget) {
      if (!nodeId) {
        nodeId = element.getAttribute?.('data-node-id');
        if (nodeId) break;
      }
      if (!targetKingdomId) {
        targetKingdomId = element.getAttribute?.('data-kingdom-id');
        if (targetKingdomId) break;
      }
      if (!hexX) {
        hexX = element.getAttribute?.('data-hex-x');
        hexY = element.getAttribute?.('data-hex-y');
        if (hexX) break;
      }
      element = element.parentElement;
    }

    if (hexX && hexY && typeof onHexClick === 'function') {
      onHexClick(Number(hexX), Number(hexY));
      return;
    }

    if (nodeId) {
      const node = nodes.find((entry) => String(entry.id) === String(nodeId));
      if (node) {
        setSelectedNode(node);
        setMapCard(null);
      }
      return;
    }

    if (targetKingdomId) {
      setSelectedNode(null);
      showMapKingdomCard(targetKingdomId, currentKingdomId, marketUpgrades);
    }
  }, [currentKingdomId, marketUpgrades, nodes, shouldSuppressClick, onHexClick]);

  const activeExpedition = selectedNode
    ? expeditions.find((exp) => String(exp.node_id) === String(selectedNode.id))
    : null;

  const nodeMeta = selectedNode ? (NODE_TYPE_META[selectedNode.type] || NODE_TYPE_META.wood) : null;

  return (
    <div id="worldmap" className="panel">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <div className="card flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="card-title !mb-1">🗺️ World of Narmir</div>
            <div className="text-xs text-[var(--text3)]">
              Six ancient regions — drag to pan, scroll to zoom, click sites for details.
            </div>
          </div>
          <button className="base-btn px-3 py-1 text-[11px]" onClick={refreshWorldMap}>
            ↻ Refresh
          </button>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="card xl:min-h-[620px] p-2">
            <div className="mb-2 px-1">
              <MapLayerToggles layers={layers} onToggle={toggleLayer} />
            </div>
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
                ref={viewportRef}
                id="world-map-viewport"
                className="relative min-h-[520px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[#040710] touch-none cursor-grab"
                onClick={handleMapClick}
              >
                <div
                  ref={stageRef}
                  id="world-map-stage"
                  className="wm-map-stage w-full will-change-transform"
                >
                  <div
                    ref={mapContainerRef}
                    id="world-map-container"
                    className="w-full"
                    dangerouslySetInnerHTML={{ __html: mapSvg }}
                  />
                </div>
                <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/45 px-2 py-1 text-[10px] text-[var(--text3)]">
                  Drag to pan | Scroll to zoom
                </div>
                {layers.nodes && nodes.length === 0 && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center px-4">
                    <div className="max-w-md rounded-lg border border-[var(--border)] bg-black/70 px-4 py-3 text-center text-[11px] text-[var(--text3)] backdrop-blur-sm">
                      No resource nodes on the map yet. Scout sites in{' '}
                      <button
                        type="button"
                        className="pointer-events-auto text-[var(--gold)] underline hover:opacity-90"
                        onClick={(e) => { e.stopPropagation(); switchTab('resources'); }}
                      >
                        Resources
                      </button>
                      {' '}(Scout Node, 500 gold) to plot them here.
                    </div>
                  </div>
                )}
                <div className="absolute bottom-2 right-2 flex items-center gap-1">
                  <span className="rounded bg-black/45 px-2 py-1 text-[10px] text-[var(--text3)]">{zoomLabel}</span>
                  <button type="button" className="base-btn px-2 py-1 text-[11px]" onClick={(e) => { e.stopPropagation(); zoomOut(); }} aria-label="Zoom out">−</button>
                  <button type="button" className="base-btn px-2 py-1 text-[11px]" onClick={(e) => { e.stopPropagation(); zoomIn(); }} aria-label="Zoom in">+</button>
                  <button type="button" className="base-btn px-2 py-1 text-[11px]" onClick={(e) => { e.stopPropagation(); resetViewport(true); }} aria-label="Reset map view">⌂</button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {selectedNode && nodeMeta && (
              <div ref={nodeCardRef} className="card">
                <div className="card-title !mb-2">
                  {nodeMeta.icon} {repairMojibake(selectedNode.name || 'Resource Node')}
                </div>
                <div className="text-[12px] text-[var(--text3)] mb-2">
                  {nodeMeta.label} node | Richness {selectedNode.richness || 1} | {formatNodeDistance(selectedNode.distance)}
                </div>
                {activeExpedition ? (
                  <div className="text-[11px] text-[var(--accent1)] mb-3">
                    Active expedition: {activeExpedition.status} ({Number(activeExpedition.population_sent || 0).toLocaleString()} civilians)
                  </div>
                ) : (
                  <div className="text-[11px] text-[var(--text3)] mb-3">No active expedition to this site.</div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button className="btn text-[11px] px-2 py-1" onClick={() => switchTab('resources')}>
                    ⛏️ Manage in Resources
                  </button>
                  <button className="base-btn text-[11px] px-2 py-1" onClick={() => setSelectedNode(null)}>
                    Close
                  </button>
                </div>
              </div>
            )}

            {mapCard && (
              <div ref={kingdomCardRef} className="card">
                <div className="card-title !mb-2">
                  {RACE_ICONS[mapCard.kingdom.race] || '🤴'} {repairMojibake(mapCard.kingdom.name || '')}
                  {mapCard.kingdom.is_ai && <span className="text-[10px] text-[var(--text3)]"> AI</span>}
                </div>
                <div className="text-[12px] text-[var(--text3)] mb-2">
                  <span style={{ color: RACE_COLORS[mapCard.kingdom.region]?.text || '#fff' }}>
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

            <div className="card" id="region-legend">
              <div className="card-title !mb-3">Regions</div>
              <RegionLegend
                kingdoms={kingdoms}
                highlightedRace={highlightedRace}
                onHighlight={setHighlightedRace}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorldmapPanel;