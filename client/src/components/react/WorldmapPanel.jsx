import clsx from 'clsx';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { apiCall } from '../../utils/api';
import { setWorldMapData } from '../../utils/worldMapData.js';
import WorldmapWebGL from './WorldmapWebGL.jsx';
import { buildHexGrid } from '../../utils/worldMapBuilder.js';
import { createSymbolForTerrain, SYMBOL_TERRAIN_TYPES } from '../../utils/terrainSymbols.js';
import { repairMojibake } from '../../utils/repairMojibake.js';
import { RACE_ICONS } from '../../utils/raceIcons.js';
import { getRaceSVGIcon } from '../../utils/raceIconsSVG.js';
import { REGION_META } from '../../utils/raceData.js';
import { NODE_TYPE_META, formatNodeDistance } from '../../utils/worldMapNodeMeta.js';
import { openKingdomProfile } from './KingdomProfileModal.jsx';
import { targetFromRankings } from '../../utils/rankingsTarget.js';
import { toast } from '../../utils/toast.js';
import { AppEvent } from '../../utils/appEvents.js';
import { useAppEvent } from '../../hooks/useAppEvent.js';
import { useKingdomId, useMarketUpgrades, useDiscoveredKingdoms } from '../../stores';
import { switchTab } from '../../utils/panelNav.js';
import { animateMapPanelCard } from '../../utils/worldMapGsap.js';
import VolcanicHexCard from './VolcanicHexCard.jsx';

const TERRAIN_COLORS = {
  plains: '#556b2f',
  forest: '#2d4a2d',
  mountains: '#5c4033',
  hills: '#6b5b3f',
  swamp: '#3a3f2a',
  desert: '#8b7355',
  coast: '#3a5f7a',
  tundra: '#7a8a94',
  volcanic: '#7a2e1a',
  lake: '#2a5f8a',
  ocean: '#0d3a5c',
};

const TERRAIN_LEGEND = [
  { type: 'plains', name: 'Plains', symbol: '◯' },
  { type: 'forest', name: 'Forest', symbol: '△' },
  { type: 'mountains', name: 'Mountains', symbol: '▲' },
  { type: 'hills', name: 'Hills', symbol: '▲' },
  { type: 'swamp', name: 'Swamp', symbol: '◯' },
  { type: 'desert', name: 'Desert', symbol: '▭' },
  { type: 'coast', name: 'Coast', symbol: '◯' },
  { type: 'tundra', name: 'Tundra', symbol: '◈' },
  { type: 'volcanic', name: 'Volcanic', symbol: '▲' },
];

const MAP_REGIONS = Object.keys(REGION_META);

const DEFAULT_LAYERS = {
  kingdoms: true,
  nodes: true,
  routes: true,
  expeditions: true,
  terrain: false,
  regionLabels: true,
};

export async function loadWorldMap({ setLoading, setError, setKingdoms, setTradeRoutes, setNodes, setExpeditions, setWorldLocations, setWorldSeed, setVisibility, setPlayerKingdomId } = {}) {
  if (typeof setLoading === 'function') setLoading(true);
  if (typeof setError === 'function') setError('');
  try {
    const data = await apiCall('/api/kingdom/world-map');
    if (data?.error) throw new Error(data.error);

    const kingdoms = data.kingdoms || (Array.isArray(data) ? data : []);
    const tradeRoutes = data.tradeRoutes || [];
    const nodes = data.nodes || [];
    const expeditions = data.expeditions || [];
    const worldLocations = data.worldLocations || [];
    if (typeof setKingdoms === 'function') setKingdoms(kingdoms);
    if (typeof setTradeRoutes === 'function') setTradeRoutes(tradeRoutes);
    if (typeof setNodes === 'function') setNodes(nodes);
    if (typeof setExpeditions === 'function') setExpeditions(expeditions);
    if (typeof setWorldLocations === 'function') setWorldLocations(worldLocations);
    // Arrives in the same response as kingdoms, unlike the profile store's
    // kingdom_id (useKingdomId()), which is populated by a separate,
    // independent fetch and can still be null the first time the WebGL
    // view mounts and needs to know which kingdom to focus on.
    if (typeof setPlayerKingdomId === 'function') setPlayerKingdomId(data.playerKingdomId ?? null);
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

function HexLegendPreview({ terrain }) {
  const canvasRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const terrainColor = TERRAIN_COLORS[terrain.type] || '#ffffff';

  React.useEffect(() => {
    if (SYMBOL_TERRAIN_TYPES.includes(terrain.type)) {
      // Terrain types with a real 3D symbol: Three.js hex + symbol
      if (!containerRef.current) return;

      const container = containerRef.current;
      container.innerHTML = '';

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x040710);

      // Pitched, not straight-down: the real map's symbols (terrainSymbols.js)
      // are built as vertical spires/cones with small white tips/caps up top
      // (mountains especially -- 5 cylindrical spires topped with white
      // spheres). Viewed from directly overhead those bodies foreshorten to
      // nearly nothing and only the caps remain, which at this icon's small
      // size blurs into an indistinct smudge instead of reading as a
      // mountain -- even though it's the exact same geometry the full-size
      // map renders as a crisp white "+" of peaks. A pitched angle (roughly
      // matching the map's own default 30 degree tilt once a player rotates
      // into 3D view) actually shows the spire bodies, so the thumbnail
      // reads as what it's meant to be a preview of.
      const camera = new THREE.OrthographicCamera(-35, 35, 35, -35, 0.1, 1000);
      camera.position.set(0, -38, 42);
      camera.lookAt(0, 0, 10);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setSize(64, 64);
      renderer.setPixelRatio(window.devicePixelRatio);
      // Draw buffer stays fixed at 64x64; CSS size flexes with the grid
      // cell (shrinks cleanly, this is just a small legend icon).
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      container.appendChild(renderer.domElement);

      // Lighting -- angled to match the pitched camera so spire bodies pick
      // up real shading contrast instead of being lit flat from directly
      // above (which, combined with a top-down camera, is what made every
      // symbol read as a flat blob regardless of its actual 3D shape).
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.6);
      directionalLight.position.set(30, -20, 80);
      scene.add(directionalLight);

      // Hex
      const hexGeo = new THREE.CylinderGeometry(22, 22, 7, 6);
      const hexMat = new THREE.MeshPhongMaterial({ color: terrainColor, shininess: 10, flatShading: false });
      const hex = new THREE.Mesh(hexGeo, hexMat);
      hex.rotation.x = Math.PI / 2;
      hex.position.z = 3.5;
      scene.add(hex);

      // Real symbol, shared with the actual map (terrainSymbols.js) — sits
      // on top of the hex's top face (z=7), same reference the map uses
      // for a cell's elevation.
      const symbol = createSymbolForTerrain(terrain.type);
      if (symbol) {
        // This fixed ortho camera (-35..35) comfortably fits every symbol
        // except mountains, whose central spire+cap runs to local z≈71 —
        // roughly double volcanic's z≈36 — and pokes past the frame. Rather
        // than shrink the shared geometry (also used by the full-size map,
        // where it's proportioned fine against real elevation), clamp only
        // the legend preview's copy to a height that's known to fit.
        const box = new THREE.Box3().setFromObject(symbol);
        const symbolHeight = box.max.z - box.min.z;
        const maxLegendHeight = 40;
        if (symbolHeight > maxLegendHeight) {
          symbol.scale.setScalar(maxLegendHeight / symbolHeight);
        }
        symbol.position.z = 7;
        scene.add(symbol);
      }

      renderer.render(scene, camera);

      return () => {
        renderer.dispose();
      };
    } else {
      // Other terrains: canvas hexagon only
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      // Clear
      ctx.fillStyle = '#040710';
      ctx.fillRect(0, 0, w, h);

      // Draw hexagon (radius proportional to canvas size, not a fixed pixel value,
      // so it still fits after the icon size changes)
      const centerX = w / 2;
      const centerY = h / 2;
      const radius = Math.min(w, h) * 0.39;

      ctx.fillStyle = terrainColor;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      // Add edge highlight for depth
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [terrainColor, terrain.type]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-0.5 overflow-hidden rounded bg-[#040710] p-1">
      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        {SYMBOL_TERRAIN_TYPES.includes(terrain.type) ? (
          <div ref={containerRef} className="aspect-square h-full max-w-full" />
        ) : (
          <canvas
            ref={canvasRef}
            width={64}
            height={64}
            className="aspect-square h-full max-w-full"
          />
        )}
      </div>
      <span className="shrink-0 text-[10px] font-semibold leading-tight text-[var(--text)]">{terrain.name}</span>
    </div>
  );
}

function TerrainLegend() {
  return (
    <div className="grid h-full min-h-0 flex-1 grid-cols-3 grid-rows-3 gap-1.5">
      {TERRAIN_LEGEND.map((terrain) => (
        <HexLegendPreview key={terrain.type} terrain={terrain} />
      ))}
    </div>
  );
}

function RegionLegend({ kingdoms, highlightedRace, onHighlight }) {
  return (
    <div className="grid h-full min-h-0 flex-1 grid-cols-2 content-start gap-x-2 gap-y-1 overflow-y-auto">
      {MAP_REGIONS.map((race) => {
        const meta = REGION_META[race] || {};
        const icon = RACE_ICONS[race] || '?';
        const count = kingdoms.filter((k) => k.race === race).length;
        const active = highlightedRace === race;

        return (
          <button
            key={race}
            type="button"
            onClick={() => onHighlight(active ? null : race)}
            className={clsx(
              'flex w-full items-center gap-1.5 rounded border-b border-[var(--border)] px-1 py-1 text-left transition',
              active ? 'opacity-100' : 'opacity-90 hover:opacity-100',
            )}
          >
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-sm border-[1.5px]"
              style={{ background: meta.color, borderColor: meta.stroke }}
            />
            <span className="inline-block w-4 h-4 shrink-0 text-[var(--gold)]">
              {getRaceSVGIcon(race) ? (
                <svg
                  viewBox="0 0 24 24"
                  className="w-full h-full"
                  dangerouslySetInnerHTML={{ __html: getRaceSVGIcon(race) }}
                />
              ) : (
                icon
              )}
            </span>
            <div className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text)]">{meta.name}</div>
            <span className="shrink-0 text-[10px] text-[var(--text3)]">{count}</span>
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
    { key: 'regionLabels', label: 'Region Names', icon: '🏷️' },
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
  const [worldLocations, setWorldLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [hexGrid, setHexGrid] = useState(null);
  const [showAllKingdoms, setShowAllKingdoms] = useState(false);
  const [clickedHex, setClickedHex] = useState(null);
  const [playerKingdomId, setPlayerKingdomId] = useState(null);
  const currentKingdomId = useKingdomId();
  const marketUpgrades = useMarketUpgrades();
  const discoveredKingdoms = useDiscoveredKingdoms();
  const nodeCardRef = useRef(null);
  const kingdomCardRef = useRef(null);
  const locationCardRef = useRef(null);

  // Build hexGrid when worldSeed changes (for WebGL rendering)
  useEffect(() => {
    if (worldSeed) {
      const grid = buildHexGrid(1999, 1380, worldSeed);
      setHexGrid(grid);
    }
  }, [worldSeed]);

  // Listen for node, location, and hex clicks from WebGL (kingdom clicks go
  // straight through showMapKingdomCard -> AppEvent.MAP_KINGDOM_CARD instead
  // of a window event — see the useAppEvent(MAP_KINGDOM_CARD) below). Only
  // one detail card is shown at a time, so each handler clears the others.
  useEffect(() => {
    const handleNodeClick = (e) => {
      setSelectedNode(e.detail);
      setSelectedLocation(null);
      setClickedHex(null);
      setMapCard(null);
    };

    const handleLocationClick = (e) => {
      setSelectedLocation(e.detail);
      setSelectedNode(null);
      setClickedHex(null);
      setMapCard(null);
    };

    const handleHexClick = (e) => {
      setClickedHex(e.detail);
      setSelectedNode(null);
      setSelectedLocation(null);
      setMapCard(null);
    };

    window.addEventListener('nodeClicked', handleNodeClick);
    window.addEventListener('locationClicked', handleLocationClick);
    window.addEventListener('hexClicked', handleHexClick);

    return () => {
      window.removeEventListener('nodeClicked', handleNodeClick);
      window.removeEventListener('locationClicked', handleLocationClick);
      window.removeEventListener('hexClicked', handleHexClick);
    };
  }, []);

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

  useLayoutEffect(() => {
    const cleanup = animateMapPanelCard(locationCardRef.current, { visible: Boolean(selectedLocation) });
    if (selectedLocation && locationCardRef.current) {
      locationCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    return cleanup;
  }, [selectedLocation]);

  const refreshWorldMap = useCallback(
    () => loadWorldMap({
      setLoading,
      setError,
      setKingdoms,
      setTradeRoutes,
      setNodes,
      setExpeditions,
      setWorldLocations,
      setWorldSeed,
      setVisibility,
      setPlayerKingdomId,
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
  useAppEvent(AppEvent.MAP_KINGDOM_CARD, useCallback((card) => {
    setMapCard(card);
    setSelectedNode(null);
    setSelectedLocation(null);
    setClickedHex(null);
  }, []));

  const toggleLayer = useCallback((key) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const activeExpedition = selectedNode
    ? expeditions.find((exp) => String(exp.node_id) === String(selectedNode.id))
    : null;

  const nodeMeta = selectedNode ? (NODE_TYPE_META[selectedNode.type] || NODE_TYPE_META.wood) : null;

  return (
    <div id="worldmap" className="panel !overflow-hidden">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-4">
        <div className="card flex shrink-0 items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="card-title !mb-1">🗺️ World of Narmir</div>
            <div className="text-xs text-[var(--text3)]">
              Nine ancient regions — drag to pan, scroll to zoom, click sites for details.
            </div>
          </div>
          <button className="base-btn px-3 py-1 text-[11px]" onClick={refreshWorldMap}>
            ↻ Refresh
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="card flex min-h-0 flex-col p-2">
            <div className="mb-2 px-1 shrink-0 hidden sm:block">
              <MapLayerToggles layers={layers} onToggle={toggleLayer} />
            </div>
            {loading ? (
              <div className="grid flex-1 place-items-center py-12 text-[13px] text-[var(--text3)]">
                Loading map...
              </div>
            ) : error ? (
              <div className="grid flex-1 place-items-center gap-3 py-12 text-center text-[var(--red)]">
                <div>Failed to load world map.</div>
                <button className="btn" onClick={refreshWorldMap}>
                  Retry
                </button>
              </div>
            ) : null}
            {!loading && !error && (kingdoms.length > 0 || nodes.length > 0) && hexGrid && (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex gap-2 items-center justify-between mb-2 shrink-0 hidden sm:flex">
                  <button
                    className="base-btn px-2 py-1 text-[10px] bg-[var(--red)]"
                    onClick={() => setShowAllKingdoms(!showAllKingdoms)}
                    title="Debug: Show all kingdoms on map"
                  >
                    🔍 {showAllKingdoms ? 'Hide' : 'Show'} All Kingdoms
                  </button>
                </div>
                <div
                  id="world-map-webgl"
                  className="relative w-full min-h-[300px] flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[#040710]"
                >
                  <WorldmapWebGL hexGrid={hexGrid} kingdoms={kingdoms} highlightedRace={highlightedRace} currentKingdomId={playerKingdomId} nodes={nodes} tradeRoutes={tradeRoutes} expeditions={expeditions} worldLocations={worldLocations} layers={layers} visibility={visibility} />
                  {layers.nodes && nodes.length === 0 && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center px-4">
                      <div className="max-w-md rounded-lg border border-[var(--border)] bg-black/70 px-4 py-3 text-center text-[11px] text-[var(--text3)] backdrop-blur-sm">
                        No resource nodes revealed yet. Assign rangers to scout in{' '}
                        <button
                          type="button"
                          className="pointer-events-auto text-[var(--gold)] underline hover:opacity-90"
                          onClick={(e) => { e.stopPropagation(); switchTab('exploration'); }}
                        >
                          Exploration
                        </button>
                        {' '}to reveal nodes as your scouting rings expand.
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-2 hidden sm:flex flex-wrap gap-x-4 gap-y-1 px-1 text-[10px] text-[var(--text3)] shrink-0">
                  <span><strong className="text-[var(--text2)]">Left-click</strong> — select kingdoms, nodes, dungeons & mountain hearts</span>
                  <span><strong className="text-[var(--text2)]">Right-click drag</strong> — pan</span>
                  <span><strong className="text-[var(--text2)]">Scroll</strong> — zoom</span>
                  <span><strong className="text-[var(--text2)]">↑ / ↓</strong> — pitch camera</span>
                  <span><strong className="text-[var(--text2)]">← / →</strong> — rotate camera</span>
                  <span><strong className="text-[var(--text2)]">Middle-click</strong> — reset to full map view</span>
                </div>
              </div>
            )}
          </div>

          <div className={clsx(
            "min-h-0 flex-col gap-4",
            (selectedNode || selectedLocation || clickedHex || mapCard) ? "flex" : "hidden xl:flex"
          )}>
            {selectedNode && nodeMeta && (
              <div ref={nodeCardRef} className="card flex-1 min-h-0 overflow-y-auto">
                <div className="card-title !mb-2">
                  {nodeMeta.icon} {repairMojibake(selectedNode.name || 'Resource Node')}
                </div>
                <div className="text-[12px] text-[var(--text3)] mb-2">
                  {nodeMeta.label} node | Richness {selectedNode.richness || 1} | {formatNodeDistance(selectedNode.distance)}
                </div>
                <div className="text-[12px] text-[var(--text3)] mb-2">
                  Coordinates: ({Math.round(selectedNode.map_x)}, {Math.round(selectedNode.map_y)})
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

            {selectedLocation && (
              <div ref={locationCardRef} className="card flex-1 min-h-0 overflow-y-auto">
                <div className="card-title !mb-2">
                  {selectedLocation.type === 'dungeon' ? '⚔️ Dungeon' : "🏔️ Mountain's Heart"}
                </div>
                <div className="text-[12px] text-[var(--text3)] mb-3">
                  Coordinates: ({Math.round(selectedLocation.x)}, {Math.round(selectedLocation.y)})
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn text-[11px] px-2 py-1" onClick={() => switchTab('exploration')}>
                    {selectedLocation.type === 'dungeon' ? '⚔️ Launch Dungeon Raid' : "🏔️ Explore Mountain's Heart"}
                  </button>
                  <button className="base-btn text-[11px] px-2 py-1" onClick={() => setSelectedLocation(null)}>
                    Close
                  </button>
                </div>
              </div>
            )}

            {clickedHex && clickedHex.terrain === 'volcanic' && (
              <VolcanicHexCard
                col={clickedHex.col}
                row={clickedHex.row}
                x={clickedHex.x}
                y={clickedHex.y}
                onClose={() => setClickedHex(null)}
              />
            )}

            {clickedHex && clickedHex.terrain !== 'volcanic' && (
              <div className="card flex-1 min-h-0 overflow-y-auto">
                <div className="card-title !mb-2">📍 Hex Info</div>
                <div className="text-[12px] text-[var(--text3)] mb-2">
                  <div><strong>Coordinates:</strong> ({clickedHex.col}, {clickedHex.row})</div>
                  <div><strong>World Position:</strong> ({Math.round(clickedHex.x)}, {Math.round(clickedHex.y)})</div>
                  <div><strong>Terrain:</strong> {clickedHex.terrain}</div>
                  <div><strong>Region:</strong> {clickedHex.race || 'Unknown'}</div>
                </div>
                <button
                  className="base-btn text-[11px] px-2 py-1 w-full"
                  onClick={() => setClickedHex(null)}
                >
                  Close
                </button>
              </div>
            )}

            {mapCard && (() => {
              const disc = discoveredKingdoms || {};
              const isMapped = !!(disc[mapCard.kingdom.id] && disc[mapCard.kingdom.id].mapped);
              return (
                <div ref={kingdomCardRef} className="card flex-1 min-h-0 overflow-y-auto">
                  <div className="card-title !mb-2">
                    {RACE_ICONS[mapCard.kingdom.race] || '🤴'} {repairMojibake(mapCard.kingdom.name || '')}
                    {mapCard.kingdom.is_ai && <span className="text-[10px] text-[var(--text3)]"> AI</span>}
                  </div>
                  <div className="text-[12px] text-[var(--text3)] mb-2">
                    <span style={{ color: REGION_META[mapCard.kingdom.region]?.stroke || '#fff' }}>
                      {mapCard.meta.name || mapCard.kingdom.region || '—'}
                    </span>
                  </div>
                  <div className="text-[12px] text-[var(--text3)] mb-3">
                    Coordinates: ({Math.round(mapCard.kingdom.map_x)}, {Math.round(mapCard.kingdom.map_y)})
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {!mapCard.isMe ? (
                      <>
                        <button className="btn text-[11px] px-2 py-1" onClick={() => openKingdomProfile(mapCard.kingdom.name)}>
                          🤴 Profile
                        </button>
                        {isMapped ? (
                          <>
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
                          <div className="w-full text-[10px] text-[var(--text3)] mt-1">
                            Scribe a Location Map for this kingdom to attack, cast spells, or trade with them.
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-[12px] text-[var(--accent1)]">Your kingdom</span>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className={clsx(
              "card flex flex-1 min-h-0 flex-col overflow-hidden",
              (selectedNode || selectedLocation || clickedHex || mapCard) && "hidden xl:flex"
            )} id="terrain-legend">
              <div className="card-title !mb-2 shrink-0">Terrain Types</div>
              <TerrainLegend />
            </div>

            <div className={clsx(
              "card flex flex-1 min-h-0 flex-col overflow-hidden",
              (selectedNode || selectedLocation || clickedHex || mapCard) && "hidden xl:flex"
            )} id="region-legend">
              <div className="card-title !mb-2 shrink-0">Regions</div>
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