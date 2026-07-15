import clsx from 'clsx';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { apiCall } from '../../utils/api';
import { setWorldMapData } from '../../utils/worldMapData.js';
import { renderWorldMap } from './WorldmapRenderer.jsx';
import WorldmapWebGL from './WorldmapWebGL.jsx';
import { buildHexGrid } from '../../utils/worldMapBuilder.js';
import { fmtShort } from '../../utils/numberFormat.js';
import { repairMojibake } from '../../utils/repairMojibake.js';
import { RACE_ICONS } from '../../utils/raceIcons.js';
import { getRaceSVGIcon } from '../../utils/raceIconsSVG.js';
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
  applyWorldMapLayers,
} from '../../utils/worldMapGsap.js';
import { useWorldMapViewport } from '../../hooks/useWorldMapViewport.js';

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
};

export async function loadWorldMap({ setLoading, setError, setKingdoms, setTradeRoutes, setNodes, setExpeditions, setWorldSeed, setVisibility, setPlayerKingdomId } = {}) {
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
    if (terrain.type === 'plains' || terrain.type === 'forest' || terrain.type === 'mountains' || terrain.type === 'hills' || terrain.type === 'swamp' || terrain.type === 'desert' || terrain.type === 'volcanic') {
      // Plains/Forest: Three.js hex + symbol
      if (!containerRef.current) return;

      const container = containerRef.current;
      container.innerHTML = '';

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x040710);

      const camera = new THREE.OrthographicCamera(-35, 35, 35, -35, 0.1, 1000);
      camera.position.set(0, 0, 50);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setSize(90, 90);
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8);
      directionalLight.position.set(0, 0, 100);
      scene.add(directionalLight);

      // Hex
      const hexGeo = new THREE.CylinderGeometry(22, 22, 7, 6);
      const hexMat = new THREE.MeshPhongMaterial({ color: terrainColor, shininess: 10, flatShading: false });
      const hex = new THREE.Mesh(hexGeo, hexMat);
      hex.rotation.x = Math.PI / 2;
      hex.position.z = 3.5;
      scene.add(hex);

      if (terrain.type === 'plains') {
        // Plains symbol - wheat columns in circle
        const wheatColor = new THREE.Color(0xDAA520).multiplyScalar(0.5);
        const wheatMat = new THREE.MeshBasicMaterial({ color: wheatColor });
        const scale = 0.9;

        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          const x = Math.cos(angle) * 10 * scale;
          const y = Math.sin(angle) * 10 * scale;
          const colGeo = new THREE.CylinderGeometry(1.5 * scale, 1.5 * scale, 11 * scale, 6);
          const col = new THREE.Mesh(colGeo, wheatMat);
          col.rotation.x = Math.PI / 2;
          col.position.set(x, y, 7);
          scene.add(col);
        }
      } else if (terrain.type === 'forest') {
        // Forest symbol - dark green base + white tip
        const scale = 0.9;

        // Dark green base cone
        const darkGreen = 0x0a1a0a;
        const forestMat = new THREE.MeshPhongMaterial({ color: darkGreen, shininess: 30 });
        const coneGeo = new THREE.ConeGeometry(22 * scale, 18 * scale, 8);
        const cone = new THREE.Mesh(coneGeo, forestMat);
        cone.rotation.x = Math.PI / 2;
        cone.position.z = 7;
        scene.add(cone);

        // White tip
        const whiteMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 30 });
        const tipGeo = new THREE.ConeGeometry(4 * scale, 6 * scale, 8);
        const tip = new THREE.Mesh(tipGeo, whiteMat);
        tip.rotation.x = Math.PI / 2;
        tip.position.z = 7 + 8 * scale;
        scene.add(tip);
      } else if (terrain.type === 'mountains') {
        // Mountains symbol - central tall cone + 4 surrounding peaks
        const scale = 0.9;
        const brown = 0x5c4033;
        const mountainMat = new THREE.MeshPhongMaterial({ color: brown, shininess: 30 });

        // Central peak
        const coneGeo = new THREE.ConeGeometry(18 * scale, 24 * scale, 8);
        const cone = new THREE.Mesh(coneGeo, mountainMat);
        cone.rotation.x = Math.PI / 2;
        cone.position.z = 7;
        scene.add(cone);

        // White tip on central peak
        const whiteMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 30 });
        const tipGeo = new THREE.ConeGeometry(5 * scale, 8 * scale, 8);
        const tip = new THREE.Mesh(tipGeo, whiteMat);
        tip.rotation.x = Math.PI / 2;
        tip.position.z = 7 + 10 * scale;
        scene.add(tip);

        // 4 surrounding peaks
        const peakPositions = [
          { x: 12 * scale, y: 0 },
          { x: -12 * scale, y: 0 },
          { x: 0, y: 12 * scale },
          { x: 0, y: -12 * scale },
        ];

        peakPositions.forEach((pos) => {
          const peakGeo = new THREE.ConeGeometry(8 * scale, 13 * scale, 8);
          const peak = new THREE.Mesh(peakGeo, mountainMat);
          peak.rotation.x = Math.PI / 2;
          peak.position.set(pos.x, pos.y, 7);
          scene.add(peak);

          // Small white tip
          const smallTipGeo = new THREE.ConeGeometry(2.5 * scale, 4 * scale, 8);
          const smallTip = new THREE.Mesh(smallTipGeo, whiteMat);
          smallTip.rotation.x = Math.PI / 2;
          smallTip.position.set(pos.x, pos.y, 7 + 5 * scale);
          scene.add(smallTip);
        });
      } else if (terrain.type === 'hills') {
        // Hills symbol - overlapping spheres
        const scale = 0.9;
        const hillColor = 0x6b5b3f;
        const hillMat = new THREE.MeshPhongMaterial({ color: hillColor, shininess: 30 });

        const hillPositions = [
          { x: -8 * scale, y: -6 * scale },
          { x: 8 * scale, y: -6 * scale },
          { x: 0, y: 8 * scale },
          { x: -5 * scale, y: 2 * scale },
          { x: 5 * scale, y: 2 * scale },
        ];

        hillPositions.forEach((pos) => {
          const sphereGeo = new THREE.SphereGeometry(8 * scale, 8, 8);
          const sphere = new THREE.Mesh(sphereGeo, hillMat);
          sphere.position.set(pos.x, pos.y, 7);
          scene.add(sphere);
        });
      } else if (terrain.type === 'swamp') {
        // Swamp symbol - 4 twisted cones
        const scale = 0.9;
        const swampColor = 0x3a3f2a;
        const swampMat = new THREE.MeshPhongMaterial({ color: swampColor, shininess: 30 });

        const conePositions = [
          { x: -8 * scale, y: -8 * scale, rot: 0.3 },
          { x: 8 * scale, y: -8 * scale, rot: -0.3 },
          { x: -8 * scale, y: 8 * scale, rot: -0.2 },
          { x: 8 * scale, y: 8 * scale, rot: 0.2 },
        ];

        conePositions.forEach((pos) => {
          const coneGeo = new THREE.ConeGeometry(6 * scale, 14 * scale, 6);
          const cone = new THREE.Mesh(coneGeo, swampMat);
          cone.rotation.x = Math.PI / 2;
          cone.rotation.z = pos.rot;
          cone.position.set(pos.x, pos.y, 7);
          scene.add(cone);
        });
      } else if (terrain.type === 'desert') {
        // Desert symbol - pyramid (4-sided)
        const scale = 0.9;
        const desertColor = 0x8b7355;
        const desertMat = new THREE.MeshPhongMaterial({ color: desertColor, shininess: 30 });

        // Create pyramid using custom geometry
        const pyramidGeo = new THREE.BufferGeometry();
        const size = 18 * scale;
        const height = 22 * scale;

        const vertices = new Float32Array([
          // Base
          -size / 2, -size / 2, 0,
          size / 2, -size / 2, 0,
          size / 2, size / 2, 0,
          -size / 2, size / 2, 0,
          // Apex
          0, 0, height,
        ]);

        const indices = new Uint32Array([
          // Base
          0, 2, 1,
          0, 3, 2,
          // Sides
          0, 1, 4,
          1, 2, 4,
          2, 3, 4,
          3, 0, 4,
        ]);

        pyramidGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        pyramidGeo.setIndex(new THREE.BufferAttribute(indices, 1));
        pyramidGeo.computeVertexNormals();

        const pyramid = new THREE.Mesh(pyramidGeo, desertMat);
        pyramid.rotation.z = Math.PI / 4;
        pyramid.position.z = 7;
        scene.add(pyramid);
      } else if (terrain.type === 'volcanic') {
        // Volcanic symbol - dark base cone + red tip
        const scale = 1.1;

        // Dark base cone
        const darkRed = 0x4a1a1a;
        const volcanicMat = new THREE.MeshPhongMaterial({ color: darkRed, shininess: 30 });
        const coneGeo = new THREE.ConeGeometry(20 * scale, 18 * scale, 8);
        const cone = new THREE.Mesh(coneGeo, volcanicMat);
        cone.rotation.x = Math.PI / 2;
        cone.position.z = 7;
        scene.add(cone);

        // Red tip
        const redMat = new THREE.MeshPhongMaterial({ color: 0xff4444, shininess: 30 });
        const tipGeo = new THREE.ConeGeometry(3.8 * scale, 6 * scale, 8);
        const tip = new THREE.Mesh(tipGeo, redMat);
        tip.rotation.x = Math.PI / 2;
        tip.position.z = 7 + 8 * scale;
        scene.add(tip);
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

      // Draw hexagon
      const centerX = w / 2;
      const centerY = h / 2;
      const radius = 35;

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
    <div className="flex flex-col items-center gap-2">
      {terrain.type === 'plains' || terrain.type === 'forest' || terrain.type === 'mountains' || terrain.type === 'hills' || terrain.type === 'swamp' || terrain.type === 'desert' || terrain.type === 'volcanic' ? (
        <div ref={containerRef} className="w-24 h-24 rounded bg-[#040710]" />
      ) : (
        <canvas
          ref={canvasRef}
          width={90}
          height={90}
          className="rounded"
        />
      )}
      <span className="text-xs font-semibold text-[var(--text)]">{terrain.name}</span>
    </div>
  );
}

function TerrainLegend() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {TERRAIN_LEGEND.map((terrain) => (
        <HexLegendPreview key={terrain.type} terrain={terrain} />
      ))}
    </div>
  );
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
  const [useWebGL, setUseWebGL] = useState(false);
  const [hexGrid, setHexGrid] = useState(null);
  const [showAllKingdoms, setShowAllKingdoms] = useState(false);
  const [clickedKingdom, setClickedKingdom] = useState(null);
  const [clickedHex, setClickedHex] = useState(null);
  const [playerKingdomId, setPlayerKingdomId] = useState(null);
  const currentKingdomId = useKingdomId();
  const marketUpgrades = useMarketUpgrades();
  const mapContainerRef = useRef(null);
  const mapAnimatedKeyRef = useRef('');
  const nodeCardRef = useRef(null);
  const kingdomCardRef = useRef(null);

  // Build hexGrid when worldSeed changes (for WebGL rendering)
  useEffect(() => {
    if (worldSeed) {
      const grid = buildHexGrid(1999, 1380, worldSeed);
      setHexGrid(grid);
    }
  }, [worldSeed]);

  // Listen for kingdom and hex clicks from WebGL
  useEffect(() => {
    const handleKingdomClick = (e) => {
      setClickedKingdom(e.detail);
      setClickedHex(null);
    };

    const handleHexClick = (e) => {
      setClickedHex(e.detail);
      setClickedKingdom(null);
    };

    window.addEventListener('kingdomClicked', handleKingdomClick);
    window.addEventListener('hexClicked', handleHexClick);

    return () => {
      window.removeEventListener('kingdomClicked', handleKingdomClick);
      window.removeEventListener('hexClicked', handleHexClick);
    };
  }, []);

  const mapSvg = useMemo(() => {
    if (!kingdoms.length && !nodes.length) return '';
    // Only `terrain` in layers affects the *content* of the SVG (biome vs race-colored fills).
    // All other layer toggles are purely visibility and are handled by applyWorldMapLayers/GSAP
    // after the fact. Including the full `layers` object here caused full SVG re-generation
    // (via dangerouslySetInnerHTML) on every layer toggle, contributing to excessive re-renders
    // and the "Maximum update depth exceeded" errors seen in console_log.log.
    const contentLayers = { ...DEFAULT_LAYERS, terrain: !!layers.terrain };
    return renderWorldMap(kingdoms, tradeRoutes, highlightedRace, currentKingdomId, {
      nodes,
      expeditions,
      layers: contentLayers,
      worldSeed,
      visibility,
    });
  }, [kingdoms, tradeRoutes, highlightedRace, currentKingdomId, nodes, expeditions, layers.terrain, worldSeed, visibility]);

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

  useEffect(() => {
    if (!mapContainerRef.current || !mapSvg) return undefined;
    if (mapAnimatedKeyRef.current === mapDataKey) {
      // already animated for this data key; layers changes are handled in separate effect
      return undefined;
    }
    const entrance = mapAnimatedKeyRef.current !== mapDataKey;
    mapAnimatedKeyRef.current = mapDataKey;
    return animateWorldMap(mapContainerRef.current, {
      layers,
      selectedNodeId: selectedNode?.id ?? null,
      entrance,
    });
  }, [mapDataKey, selectedNode?.id]);  // removed layers; added key guard to prevent repeated calls for same data



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

  // Separate effect for layer visibility toggles (doesn't require full re-entrance animation).
  // We deliberately avoid putting the full `layers` object into the mapSvg useMemo deps
  // (only .terrain affects SVG *content*). Toggling other layers only runs this effect
  // (which does cheap GSAP visibility) without blowing away the entire SVG via innerHTML.
  // This eliminates the "Maximum update depth exceeded" render loops previously logged.
  //
  // NOTE: We only depend on `layers` here (not `mapSvg`). The initial apply is handled
  // inside animateWorldMap when mapDataKey changes. Including mapSvg could cause
  // unnecessary re-applies or contribute to effect ordering issues.
  useEffect(() => {
    if (mapContainerRef.current) {
      applyWorldMapLayers(mapContainerRef.current, layers, { animate: true });
    }
  }, [layers]);

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
              <>
                <div className="flex gap-2 items-center justify-between mb-2">
                  <button
                    className="base-btn px-2 py-1 text-[10px] bg-[var(--red)]"
                    onClick={() => setShowAllKingdoms(!showAllKingdoms)}
                    title="Debug: Show all kingdoms on map"
                  >
                    🔍 {showAllKingdoms ? 'Hide' : 'Show'} All Kingdoms
                  </button>
                  <div className="text-xs text-[var(--text3)]">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useWebGL}
                        onChange={(e) => setUseWebGL(e.target.checked)}
                        className="cursor-pointer"
                      />
                      WebGL (Experimental)
                    </label>
                  </div>
                </div>
                {useWebGL && hexGrid ? (
                  <div
                    id="world-map-webgl"
                    className="relative w-full h-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[#040710]"
                    style={{ minHeight: '520px', height: '600px' }}
                  >
                    <WorldmapWebGL hexGrid={hexGrid} kingdoms={kingdoms} highlightedRace={highlightedRace} currentKingdomId={playerKingdomId} />
                  </div>
                ) : (
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
              </>
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

            {clickedKingdom && (
              <div className="card">
                <div className="card-title !mb-2">
                  {RACE_ICONS[clickedKingdom.race] || '🏰'} {repairMojibake(clickedKingdom.name || 'Kingdom')}
                </div>
                <div className="text-[12px] text-[var(--text3)] mb-2">
                  <div>Coordinates: ({clickedKingdom.map_x}, {clickedKingdom.map_y})</div>
                  <div>Race: {clickedKingdom.race}</div>
                  {clickedKingdom.turn !== undefined && <div>Turn: {clickedKingdom.turn}</div>}
                </div>
                <button
                  className="base-btn text-[11px] px-2 py-1 w-full"
                  onClick={() => setClickedKingdom(null)}
                >
                  Close
                </button>
              </div>
            )}

            {clickedHex && (
              <div className="card">
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

            {mapCard && (
              <div ref={kingdomCardRef} className="card">
                <div className="card-title !mb-2">
                  {RACE_ICONS[mapCard.kingdom.race] || '🤴'} {repairMojibake(mapCard.kingdom.name || '')}
                  {mapCard.kingdom.is_ai && <span className="text-[10px] text-[var(--text3)]"> AI</span>}
                </div>
                <div className="text-[12px] text-[var(--text3)] mb-2">
                  <span style={{ color: REGION_META[mapCard.kingdom.region]?.stroke || '#fff' }}>
                    {mapCard.meta.name || mapCard.kingdom.region || '—'}
                  </span>{' '}
                  | Level {mapCard.kingdom.level || 1} | Turn {mapCard.kingdom.turn || 0}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[12px] mb-3">
                  <div className="bg-[var(--bg3)] rounded text-center p-2">
                    <div className="text-[10px] text-[var(--text3)]">LAND</div>
                    <div className="text-[var(--gold)] font-bold">{fmtShort(mapCard.kingdom.land)}</div>
                  </div>
                  <div className="bg-[var(--bg3)] rounded text-center p-2">
                    <div className="text-[10px] text-[var(--text3)]">COORDINATES</div>
                    <div className="font-bold">({Math.round(mapCard.kingdom.map_x)}, {Math.round(mapCard.kingdom.map_y)})</div>
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

            <div className="card" id="terrain-legend">
              <div className="card-title !mb-3">Terrain Types</div>
              <TerrainLegend />
            </div>

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