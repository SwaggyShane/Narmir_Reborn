import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { REGION_META, REGION_BONUSES } from '../../utils/raceData.js';
import { RACE_ICONS } from '../../utils/raceIcons.js';
import { getRaceSVGIcon } from '../../utils/raceIconsSVG.js';
import { hexCenter, hexCorners, HEX_SIZE, HEX_W, HEX_VERT } from '../../utils/hexMap/HexGeometry.ts';
import { RACE_HOMES } from '../../utils/worldMapBuilder.js';
import { showMapKingdomCard } from './MapKingdomCard.jsx';
import { NODE_TYPE_META, getNodeRadius } from '../../utils/worldMapNodeMeta.js';

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

function hexToColor(hex) {
  return new THREE.Color(hex);
}

export default function WorldmapWebGL({ hexGrid = null, kingdoms = [], elevationData = null, highlightedRace = null, currentKingdomId = null, nodes = [], tradeRoutes = [], expeditions = [], worldLocations = [], layers = {} }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const layerGroupsRef = useRef({});

  useEffect(() => {
    if (!containerRef.current || !hexGrid) {
      return;
    }

    let cancelled = false;
    let cleanup = null;

    const checkAndRender = () => {
      if (cancelled || !containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;

      if (w === 0 || h === 0) {
        requestAnimationFrame(checkAndRender);
        return;
      }

      cleanup = initializeWebGL(w, h);
    };

    const initializeWebGL = (w, h) => {
      // Defensive: a stale canvas from a prior mount (e.g. a StrictMode
      // double-invoke or an interrupted cleanup) must never linger — it
      // would sit in the DOM as a frozen duplicate, silently absorbing or
      // shadowing space while a live canvas renders elsewhere unseen.
      while (containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x040710);
      scene.fog = new THREE.Fog(0x040710, 5000, 10000);
      sceneRef.current = scene;

      // Toggleable layer groups: a separate, lightweight effect (below)
      // flips .visible on these based on the `layers` prop, instead of
      // that prop triggering a full scene rebuild — this scene is
      // expensive to construct (merged geometries, canvas textures for
      // every label/icon), so a mere visibility toggle must not rebuild it.
      const kingdomMarkersGroup = new THREE.Group();
      const terrainSymbolsGroup = new THREE.Group();
      const resourceNodesGroup = new THREE.Group();
      const tradeRoutesGroup = new THREE.Group();
      const expeditionsGroup = new THREE.Group();
      const worldLocationsGroup = new THREE.Group();
      scene.add(kingdomMarkersGroup, terrainSymbolsGroup, resourceNodesGroup, tradeRoutesGroup, expeditionsGroup, worldLocationsGroup);
      layerGroupsRef.current = {
        kingdoms: kingdomMarkersGroup,
        terrain: terrainSymbolsGroup,
        nodes: resourceNodesGroup,
        routes: tradeRoutesGroup,
        expeditions: expeditionsGroup,
        locations: worldLocationsGroup,
      };

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, logarithmicDepthBuffer: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8);
      directionalLight.position.set(0, 0, 1000);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 4096;
      directionalLight.shadow.mapSize.height = 4096;
      directionalLight.shadow.camera.far = 3000;
      scene.add(directionalLight);

      const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x000000, 0.8);
      scene.add(hemiLight);

      // Build hex prism geometry
      const hexPrismGeometry = (() => {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const indices = [];

        const hexVertices = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          hexVertices.push([
            Math.cos(angle) * HEX_SIZE,
            Math.sin(angle) * HEX_SIZE,
          ]);
        }

        for (let [x, y] of hexVertices) {
          vertices.push(x, y, 0.5);
        }

        for (let [x, y] of hexVertices) {
          vertices.push(x, y, -0.5);
        }

        for (let i = 1; i < 5; i++) {
          indices.push(0, i, i + 1);
        }

        for (let i = 1; i < 5; i++) {
          indices.push(6 + i + 1, 6 + i, 6);
        }

        for (let i = 0; i < 6; i++) {
          const next = (i + 1) % 6;
          const top_i = i;
          const top_next = next;
          const bot_i = 6 + i;
          const bot_next = 6 + next;

          indices.push(top_i, bot_i, bot_next);
          indices.push(top_i, bot_next, top_next);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
        geometry.computeVertexNormals();
        return geometry;
      })();

      const material = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        shininess: 10,
        flatShading: false,
        side: THREE.FrontSide,
      });

      const hexCount = hexGrid.cells.length;
      const instances = new THREE.InstancedMesh(hexPrismGeometry, material, hexCount);
      instances.castShadow = true;
      instances.receiveShadow = true;

      const color = new THREE.Color();
      const dummy = new THREE.Object3D();

      function elevationRandom(col, row, seed = 0) {
        const x = Math.sin(col * 12.9898 + row * 78.233 + seed * 94.67) * 43758.5453;
        return x - Math.floor(x);
      }

      function getCellElevation(cell) {
        if (cell.terrain === 'mountains') {
          const baseElevation = 12;
          const variation = elevationRandom(cell.col, cell.row, 41) * 12;
          return baseElevation + variation;
        } else if (cell.terrain === 'hills') {
          const baseElevation = 6;
          const variation = elevationRandom(cell.col, cell.row, 42) * 6;
          return baseElevation + variation;
        } else if (cell.terrain === 'plains') {
          const baseElevation = 0.5;
          const variation = elevationRandom(cell.col, cell.row, 43) * 1.5;
          return baseElevation + variation;
        } else if (cell.terrain === 'tundra' || cell.terrain === 'desert' || cell.terrain === 'swamp') {
          const baseElevation = 0.2;
          const variation = elevationRandom(cell.col, cell.row, 44) * 0.4;
          return baseElevation + variation;
        } else if (cell.terrain === 'forest') {
          const baseElevation = 0.8;
          const variation = elevationRandom(cell.col, cell.row, 45) * 1.8;
          return baseElevation + variation;
        } else if (cell.terrain === 'volcanic') {
          const baseElevation = 8;
          const variation = elevationRandom(cell.col, cell.row, 46) * 8;
          return baseElevation + variation;
        } else if (cell.terrain === 'coast') {
          const baseElevation = 0.3;
          const variation = elevationRandom(cell.col, cell.row, 47) * 0.7;
          return baseElevation + variation;
        } else if (cell.terrain === 'ocean') {
          const baseElevation = -0.5;
          const variation = elevationRandom(cell.col, cell.row, 48) * 0.3;
          return baseElevation + variation;
        }
        return 0.5;
      }

      // Nearest-cell elevation lookup, shared by river rendering below and
      // by resource-node/dungeon/mountain markers further down — anything
      // positioned at a flat world z can get visually swallowed by taller
      // neighboring terrain (mountains reach up to z≈24) from the map's
      // tilted camera angle, so markers need to clear the *local* terrain
      // height, not just a fixed constant.
      const cellElevations = hexGrid.cells.map((cell) => ({
        x: cell.x, y: cell.y, elev: getCellElevation(cell),
      }));
      const getElevation = (x, y) => {
        let best = 0.5;
        let bestDist = Infinity;
        for (const c of cellElevations) {
          const dx = c.x - x;
          const dy = c.y - y;
          const dist = dx * dx + dy * dy;
          if (dist < bestDist) {
            bestDist = dist;
            best = c.elev;
          }
        }
        return best;
      };

      hexGrid.cells.forEach((cell, index) => {
        const terrainColor = TERRAIN_COLORS[cell.terrain] || TERRAIN_COLORS.plains;
        const elevation = getCellElevation(cell);

        dummy.position.set(cell.x, -cell.y, elevation / 2);
        dummy.scale.set(1, 1, Math.max(0.1, elevation));
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();

        instances.setMatrixAt(index, dummy.matrix);
        instances.setColorAt(index, hexToColor(terrainColor));
      });

      instances.instanceMatrix.needsUpdate = true;
      instances.instanceColor.needsUpdate = true;
      scene.add(instances);

      // cellMap and cell.race are already built by buildHexGrid() (see
      // worldMapBuilder.js) — reuse them rather than recomputing, so this
      // view can never diverge from the canvas renderer's race assignment.
      const cellMap = hexGrid.cellMap || new Map(hexGrid.cells.map(c => [`${c.col},${c.row}`, c]));

      // ODDR neighbor offsets (pointy-top, odd-r). Direction order is fixed
      // (E, NE, NW, W, SW, SE) regardless of row parity — same table as
      // worldMapBuilder.js / WorldmapRenderer.jsx.
      const ODDR_DIRECTIONS = [
        [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]],  // even row
        [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]],    // odd row
      ];

      // hexCorners(cx, cy, size) with cy = -cell.y (below) mirrors the
      // *center* into this scene's Y-up space but leaves the per-corner
      // trig offsets unflipped — matching the plain hexagon tile geometry
      // built above (InstancedMesh also just translates that same local
      // shape to (cell.x, -cell.y), never reflecting it). Because that
      // reflection is only applied to the center, corner index N here sits
      // where corner N's mirror partner would be in canvas space, which
      // permutes the edge-to-direction mapping into simple sequential
      // pairs. Do NOT reuse the canvas renderer's [[0,1],[5,0],[4,5],...]
      // table here — it assumes unflipped corners and swaps NE/SE and
      // NW/SW onto the wrong side of every hex.
      const DIRECTION_EDGE_CORNERS = [
        [0, 1], // E
        [1, 2], // NE
        [2, 3], // NW
        [3, 4], // W
        [4, 5], // SW
        [5, 0], // SE
      ];

      // Region borders: each cell draws its OWN inset edge wherever that
      // edge faces a different race (or the map's outer boundary). At an
      // internal seam, both neighboring cells draw their own inset edge in
      // their own color — two parallel lines instead of one shared line
      // that would have to arbitrarily pick a color. Mirrors the canvas
      // renderer's approach (WorldmapRenderer.jsx) so both views read the
      // same way, just rendered as flat 3D ribbons instead of SVG strokes.
      const BORDER_INSET = 4;
      const OUTLINE_HALF_WIDTH = 2.25;
      const COLOR_HALF_WIDTH = 1.125;

      function ribbonGeometry(p1, p2, z, halfWidth) {
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.001) return null;
        const nx = (-dy / len) * halfWidth;
        const ny = (dx / len) * halfWidth;

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
          p1[0] + nx, p1[1] + ny, z,
          p1[0] - nx, p1[1] - ny, z,
          p2[0] - nx, p2[1] - ny, z,
          p2[0] + nx, p2[1] + ny, z,
        ]), 3));
        geo.setIndex([0, 1, 2, 0, 2, 3]);
        geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
          0, 0, 1, 0, 1, 1, 0, 1,
        ]), 2));
        geo.computeVertexNormals();
        return geo;
      }

      function capGeometry(p, z, radius) {
        const circle = new THREE.CircleGeometry(radius, 8);
        circle.translate(p[0], p[1], z);
        return circle;
      }

      function borderSegmentGeometry(p1, p2, z, halfWidth) {
        const ribbon = ribbonGeometry(p1, p2, z, halfWidth);
        if (!ribbon) return null;
        const cap1 = capGeometry(p1, z, halfWidth);
        const cap2 = capGeometry(p2, z, halfWidth);
        const merged = mergeGeometries([ribbon, cap1, cap2]);
        ribbon.dispose();
        cap1.dispose();
        cap2.dispose();
        return merged;
      }

      const outlineGeometries = [];
      const colorGeometriesByRace = new Map();

      hexGrid.cells.forEach((cell) => {
        const parity = cell.row & 1;
        const directions = ODDR_DIRECTIONS[parity];
        const corners = hexCorners(cell.x, -cell.y, HEX_SIZE - BORDER_INSET);
        const elev = getCellElevation(cell);

        directions.forEach((offset, dirIndex) => {
          const neighborKey = `${cell.col + offset[0]},${cell.row + offset[1]}`;
          const neighbor = cellMap.get(neighborKey);

          // Boundary edge: neighbor missing or different race
          if (neighbor && neighbor.race === cell.race) return;

          const edgeCorners = DIRECTION_EDGE_CORNERS[dirIndex];
          const c1 = corners[edgeCorners[0]];
          const c2 = corners[edgeCorners[1]];

          const borderZ = neighbor
            ? Math.max(elev, getCellElevation(neighbor)) + 1
            : elev + 1;

          const outlineGeo = borderSegmentGeometry(c1, c2, borderZ, OUTLINE_HALF_WIDTH);
          if (outlineGeo) outlineGeometries.push(outlineGeo);

          const colorGeo = borderSegmentGeometry(c1, c2, borderZ + 0.1, COLOR_HALF_WIDTH);
          if (colorGeo) {
            if (!colorGeometriesByRace.has(cell.race)) {
              colorGeometriesByRace.set(cell.race, []);
            }
            colorGeometriesByRace.get(cell.race).push(colorGeo);
          }
        });
      });

      // A failed merge (e.g. a future attribute mismatch) must never throw
      // here — this runs before camera/controls setup below, and an
      // uncaught exception mid-function would silently skip all of that,
      // leaving pan/zoom/pitch completely unresponsive with no error
      // visible anywhere except a merge warning far above.
      if (outlineGeometries.length > 0) {
        const mergedOutline = mergeGeometries(outlineGeometries);
        outlineGeometries.forEach(g => g.dispose());
        if (mergedOutline) {
          const outlineMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
          scene.add(new THREE.Mesh(mergedOutline, outlineMat));
        } else {
          console.warn('Border outline geometry merge failed; skipping outline layer.');
        }
      }

      let borderSegmentCount = 0;
      colorGeometriesByRace.forEach((geometries, race) => {
        borderSegmentCount += geometries.length;
        const merged = mergeGeometries(geometries);
        geometries.forEach(g => g.dispose());
        if (merged) {
          const raceRegion = REGION_META[race];
          const color = raceRegion ? new THREE.Color(raceRegion.stroke) : new THREE.Color(0xffffff);
          const mat = new THREE.MeshBasicMaterial({ color });
          scene.add(new THREE.Mesh(merged, mat));
        } else {
          console.warn(`Border color geometry merge failed for race "${race}"; skipping.`);
        }
      });

      console.log(`Total boundary edges: ${borderSegmentCount}`);

      const createForestSymbol = () => {
        const group = new THREE.Group();
        const darkGreen = new THREE.Color(TERRAIN_COLORS.forest || '#2d4a2d');

        // Main dark green cone body
        const bodyGeo = new THREE.ConeGeometry(12.5, 20, 12);
        const bodyMat = new THREE.MeshPhongMaterial({
          color: darkGreen,
          shininess: 20
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.z = 12.5;
        body.rotation.x = Math.PI / 2;
        group.add(body);

        // Small white tip cone
        const tipGeo = new THREE.ConeGeometry(2.5, 5, 8);
        const tipMat = new THREE.MeshPhongMaterial({
          color: 0xffffff,
          shininess: 20
        });
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.position.z = 12.5 + 10;
        tip.rotation.x = Math.PI / 2;
        group.add(tip);

        return group;
      };

      const createMountainSymbol = () => {
        const group = new THREE.Group();
        const mountainGrey = new THREE.Color('#777777');
        const white = new THREE.Color(0xffffff);

        // Central tall spire - truncated cylinder
        const centerTopRadius = 6.699;
        const centerBottomRadius = 6.699 * 1.5;
        const centerHeight = 64.31;

        const centerGeo = new THREE.CylinderGeometry(centerTopRadius, centerBottomRadius, centerHeight, 8);
        const centerPositions = centerGeo.getAttribute('position');
        const centerColors = [];

        for (let i = 0; i < centerPositions.count; i++) {
          centerColors.push(mountainGrey.r, mountainGrey.g, mountainGrey.b);
        }

        centerGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(centerColors), 3));
        const centerMat = new THREE.MeshPhongMaterial({
          vertexColors: true,
          shininess: 15
        });
        const centerSpire = new THREE.Mesh(centerGeo, centerMat);
        centerSpire.position.z = 32.16;
        centerSpire.rotation.x = Math.PI / 2;
        group.add(centerSpire);

        // White sphere for central cap
        const centerCapGeo = new THREE.SphereGeometry(centerTopRadius, 16, 16);
        const centerCapMat = new THREE.MeshPhongMaterial({
          color: 0xffffff,
          shininess: 25
        });
        const centerCap = new THREE.Mesh(centerCapGeo, centerCapMat);
        centerCap.position.z = 32.16 + centerHeight / 2;
        centerCap.rotation.y = Math.PI / 4;
        group.add(centerCap);

        // 4 surrounding shorter spires
        const offset = 8.88;
        const positions = [
          [offset, 0],
          [-offset, 0],
          [0, offset],
          [0, -offset]
        ];

        positions.forEach(([x, y]) => {
          const topRadius = 3.5;
          const bottomRadius = 9.38;
          const coneHeight = 50;

          const spireGeo = new THREE.CylinderGeometry(topRadius, bottomRadius, coneHeight, 8);
          const spirePositions = spireGeo.getAttribute('position');
          const spireColors = [];

          for (let i = 0; i < spirePositions.count; i++) {
            spireColors.push(mountainGrey.r, mountainGrey.g, mountainGrey.b);
          }

          spireGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(spireColors), 3));
          const spireMat = new THREE.MeshPhongMaterial({
            vertexColors: true,
            shininess: 15
          });
          const spire = new THREE.Mesh(spireGeo, spireMat);
          spire.position.set(x, y, 25);
          spire.rotation.x = Math.PI / 2;
          group.add(spire);

          const capGeo = new THREE.SphereGeometry(topRadius, 16, 16);
          const capMat = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            shininess: 25
          });
          const cap = new THREE.Mesh(capGeo, capMat);
          cap.position.set(x, y, 25 + 25);
          cap.rotation.y = Math.PI / 4;
          group.add(cap);
        });

        return group;
      };

      const createHillsSymbol = () => {
        const group = new THREE.Group();
        const hillColor = new THREE.Color(TERRAIN_COLORS.hills || '#6b5b3f');

        const smallRadius = 4.5;
        const mediumRadius = 6.5;
        const largeRadius = 8;

        const largeGeo = new THREE.SphereGeometry(largeRadius, 16, 16);
        const largeMat = new THREE.MeshPhongMaterial({
          color: hillColor,
          shininess: 15
        });
        const largeSphere = new THREE.Mesh(largeGeo, largeMat);
        largeSphere.position.set(0, 0, 0);
        group.add(largeSphere);

        const mediumGeo = new THREE.SphereGeometry(mediumRadius, 16, 16);
        const mediumMat = new THREE.MeshPhongMaterial({
          color: new THREE.Color(hillColor).multiplyScalar(1.15),
          shininess: 15
        });
        const mediumSphere = new THREE.Mesh(mediumGeo, mediumMat);
        mediumSphere.position.set(0, largeRadius + mediumRadius - 19.25 - 0.75, 0);
        group.add(mediumSphere);

        const smallGeo = new THREE.SphereGeometry(smallRadius, 16, 16);
        const smallMat = new THREE.MeshPhongMaterial({
          color: new THREE.Color(hillColor).multiplyScalar(1.3),
          shininess: 20
        });
        const smallSphere = new THREE.Mesh(smallGeo, smallMat);
        smallSphere.position.set(-7.5, -5, 0);
        group.add(smallSphere);

        return group;
      };

      const createDesertSymbol = () => {
        const group = new THREE.Group();
        const desertColor = new THREE.Color(TERRAIN_COLORS.desert || '#8b7355').multiplyScalar(1.25);

        const pyramidGeo = new THREE.ConeGeometry(10, 16, 4);
        const pyramidMat = new THREE.MeshPhongMaterial({
          color: desertColor,
          shininess: 80
        });
        const pyramid = new THREE.Mesh(pyramidGeo, pyramidMat);
        pyramid.position.z = 8;
        pyramid.rotation.x = Math.PI / 2;
        group.add(pyramid);

        return group;
      };

      const createPlainsSymbol = () => {
        const group = new THREE.Group();
        const plainsColor = new THREE.Color('#DAA520');

        const columnRadius = 1.25;
        const columnHeight = 15;
        const circleRadius = 12;
        const numColumns = 12;

        for (let i = 0; i < numColumns; i++) {
          const angle = (i / numColumns) * Math.PI * 2;
          const x = Math.cos(angle) * circleRadius;
          const y = Math.sin(angle) * circleRadius;

          const colGeo = new THREE.CylinderGeometry(columnRadius, columnRadius, columnHeight, 8);
          const colMat = new THREE.MeshPhongMaterial({
            color: plainsColor,
            shininess: 20
          });
          const column = new THREE.Mesh(colGeo, colMat);
          column.position.set(x, y, columnHeight / 2);
          column.rotation.x = Math.PI / 2;
          group.add(column);
        }

        return group;
      };

      const createSwampSymbol = () => {
        const group = new THREE.Group();

        // Water - blue circle
        const waterGeo = new THREE.CircleGeometry(15, 32);
        const waterMat = new THREE.MeshPhongMaterial({
          color: 0x2a5a7a,
          shininess: 20,
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.position.z = 0.1;
        group.add(water);

        // Simple muddy base
        const baseMat = new THREE.MeshPhongMaterial({
          color: 0x3d4a2d,
          shininess: 10,
        });

        const baseGeo = new THREE.SphereGeometry(6, 8, 8);
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.scale.set(1, 0.5, 1); // Flatten it
        base.position.z = 0.5;
        group.add(base);

        // 4 cattails - perpendicular from hex top
        const stemHeight = 12;
        const headHeight = 2;
        const positions = [
          [3, 3],
          [-3, 3],
          [-3, -3],
          [3, -3]
        ];

        positions.forEach(([x, y]) => {
          // Stem - perpendicular to hex face (straight up)
          const stemGeo = new THREE.CylinderGeometry(0.2, 0.2, stemHeight, 4);
          const stemMat = new THREE.MeshPhongMaterial({
            color: 0x4a5c2a,
            shininess: 10,
          });
          const stem = new THREE.Mesh(stemGeo, stemMat);
          stem.position.set(x, y, stemHeight / 2);
          stem.rotation.x = Math.PI / 2;
          group.add(stem);

          // Head
          const headGeo = new THREE.CylinderGeometry(0.6, 0.6, headHeight, 6);
          const headMat = new THREE.MeshPhongMaterial({
            color: 0x2d1a0f,
            shininess: 5,
          });
          const head = new THREE.Mesh(headGeo, headMat);
          head.position.set(x, y, stemHeight);
          head.rotation.x = Math.PI / 2;
          group.add(head);
        });

        return group;
      };

      const createVolcanicSymbol = () => {
        const group = new THREE.Group();
        const darkBrown = new THREE.Color('#4a2511');

        // Dark brown base cylinder
        const baseHeight = 36;
        const baseGeo = new THREE.CylinderGeometry(9, 12.6, baseHeight, 16);
        const baseMat = new THREE.MeshPhongMaterial({
          color: darkBrown,
          shininess: 15
        });
        const baseCyl = new THREE.Mesh(baseGeo, baseMat);
        baseCyl.position.z = baseHeight / 2;
        baseCyl.rotation.x = Math.PI / 2;
        group.add(baseCyl);

        // Red top cylinder with lava
        const topHeight = 28.8;
        const lavaOrange = new THREE.Color('#ff6b1a');
        const topGeo = new THREE.CylinderGeometry(5.4, 9, topHeight, 16);
        const topMat = new THREE.MeshPhongMaterial({
          color: lavaOrange,
          emissive: lavaOrange,
          emissiveIntensity: 0.6,
          shininess: 25
        });
        const topCyl = new THREE.Mesh(topGeo, topMat);
        topCyl.position.z = baseHeight + 0.25 - topHeight / 2;
        topCyl.rotation.x = Math.PI / 2;
        group.add(topCyl);

        // Lava drips
        const numDrips = 6;
        for (let i = 0; i < numDrips; i++) {
          const angle = (i / numDrips) * Math.PI * 2;
          const dripX = Math.cos(angle) * 8.5;
          const dripY = Math.sin(angle) * 8.5;

          const brownDripGeo = new THREE.ConeGeometry(1.2, 10, 8);
          const dripMat = new THREE.MeshPhongMaterial({
            color: new THREE.Color('#ff8c00'),
            emissive: new THREE.Color('#ff6b1a'),
            emissiveIntensity: 0.8,
            shininess: 30
          });
          const brownDrip = new THREE.Mesh(brownDripGeo, dripMat);
          brownDrip.position.set(dripX, dripY, baseHeight / 2 - 5);
          brownDrip.rotation.x = Math.PI / 2;
          group.add(brownDrip);

          const redDripGeo = new THREE.ConeGeometry(1.5, 8, 8);
          const redDrip = new THREE.Mesh(redDripGeo, dripMat);
          redDrip.position.set(dripX, dripY, baseHeight + 0.25 - 6);
          redDrip.rotation.x = Math.PI / 2;
          group.add(redDrip);
        }

        return group;
      };

      const createSymbolForTerrain = (cell, elevation) => {
        if (cell.terrain === 'forest') {
          return createForestSymbol();
        } else if (cell.terrain === 'mountains') {
          return createMountainSymbol();
        } else if (cell.terrain === 'hills') {
          return createHillsSymbol();
        } else if (cell.terrain === 'desert') {
          return createDesertSymbol();
        } else if (cell.terrain === 'plains') {
          return createPlainsSymbol();
        } else if (cell.terrain === 'volcanic') {
          return createVolcanicSymbol();
        } else if (cell.terrain === 'swamp') {
          return createSwampSymbol();
        }
        return null;
      };

      hexGrid.cells.forEach((cell) => {
        if (cell.terrain === 'ocean' || cell.terrain === 'lake') return;
        if (cell.terrain !== 'forest' && cell.terrain !== 'plains' && cell.terrain !== 'desert' && cell.terrain !== 'volcanic' && cell.terrain !== 'mountains' && cell.terrain !== 'hills' && cell.terrain !== 'swamp') return;

        const elevation = getCellElevation(cell);
        const symbol = createSymbolForTerrain(cell, elevation);
        if (!symbol) return;

        symbol.position.set(cell.x, -cell.y, elevation);
        terrainSymbolsGroup.add(symbol);
      });

      const backgroundGeometry = new THREE.BoxGeometry(hexGrid.W + 150, hexGrid.H + 150, 1);
      const backgroundMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 1, transparent: false, side: THREE.FrontSide });
      const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
      background.position.set(hexGrid.W / 2, -hexGrid.H / 2, -5);
      scene.add(background);

      // Add rivers if available
      if (hexGrid.riverSegments && hexGrid.riverSegments.length > 0) {
        const tributaryColor = new THREE.Color(0x4a9fd0);
        const trunkColor = new THREE.Color(0x5cc0e8);

        // Same noise-driven meander as the canvas renderer's
        // generateMeanderingPath (WorldmapRenderer.jsx): a few waypoints
        // offset perpendicular to the p1->p2 line by multi-octave
        // deterministic noise, then a quadratic-bezier chain through them.
        // WebGL has no native curve primitive here, so the bezier chain is
        // flattened into a dense straight-segment polyline instead of an
        // SVG path string.
        function smoothNoise(seed) {
          const x = Math.sin(seed) * 10000;
          return x - Math.floor(x);
        }

        function meanderPolyline(p1, p2) {
          const dx = p2[0] - p1[0];
          const dy = p2[1] - p1[1];
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 15) return [p1, p2];

          const perpX = -dy / dist;
          const perpY = dx / dist;
          const numWaypoints = Math.max(3, Math.ceil(dist / 50));
          const baseSeed = (p1[0] * 73856093) ^ (p1[1] * 19349663) ^ (p2[0] * 83492791);

          const waypoints = [p1];
          for (let i = 1; i < numWaypoints; i++) {
            const t = i / numWaypoints;
            const x = p1[0] + dx * t;
            const y = p1[1] + dy * t;

            let noise = 0;
            let amplitude = 1;
            let maxAmplitude = 0;
            for (let octave = 0; octave < 3; octave++) {
              const noiseVal = smoothNoise(baseSeed + i * 997 + octave * 1337) - 0.5;
              noise += noiseVal * amplitude;
              maxAmplitude += amplitude;
              amplitude *= 0.5;
            }
            noise /= maxAmplitude;
            const offset = noise * Math.min(dist / 4, 24);
            waypoints.push([x + perpX * offset, y + perpY * offset]);
          }
          waypoints.push(p2);

          const SAMPLES_PER_CURVE = 8;
          const polyline = [waypoints[0]];
          let curveStart = waypoints[0];
          for (let i = 1; i < waypoints.length - 1; i++) {
            const cp = waypoints[i];
            const ep = i === waypoints.length - 2
              ? waypoints[i + 1]
              : [(waypoints[i][0] + waypoints[i + 1][0]) / 2, (waypoints[i][1] + waypoints[i + 1][1]) / 2];

            for (let s = 1; s <= SAMPLES_PER_CURVE; s++) {
              const t = s / SAMPLES_PER_CURVE;
              const mt = 1 - t;
              polyline.push([
                mt * mt * curveStart[0] + 2 * mt * t * cp[0] + t * t * ep[0],
                mt * mt * curveStart[1] + 2 * mt * t * cp[1] + t * t * ep[1],
              ]);
            }
            curveStart = ep;
          }
          return polyline;
        }

        // Rendered as flat ribbon geometry (reusing the same technique as
        // region borders) rather than THREE.Line/LineSegments, since
        // LineBasicMaterial's linewidth is ignored by most WebGL
        // implementations — that's why rivers looked thin regardless of
        // the linewidth value here. A dark underline + colored top pass,
        // trunk rivers wider than tributaries, matches the canvas
        // renderer's water-edge stroke treatment.
        const riverOutlineGeometries = [];
        const tributaryGeometries = [];
        const trunkGeometries = [];

        // River mouth: widen toward whichever endpoint touches the ocean,
        // easing in over the last ~30% of the edge, so the river visibly
        // fans out into a delta rather than just stopping at a fixed width.
        const MOUTH_WIDTH_MULTIPLIER = 2.5;
        const isWaterTerrain = (t) => t === 'lake' || t === 'ocean' || t === 'swamp';

        hexGrid.riverSegments.forEach((seg) => {
          // Swamp is still passable land for pathfinding (unlike
          // lake/ocean, which are pure endpoints), so a path can cross
          // several consecutive swamp/lake cells — e.g. a lake sitting
          // inside a swamp region. The land-to-water edge is already
          // snapped to the shared border above; an inner hop between two
          // water-classified cells (swamp-swamp, swamp-lake, etc.) has
          // nothing to snap to on either side and would otherwise run
          // straight through both cell centers. Skip rendering any such
          // segment entirely instead — the river should visibly stop at
          // the first water edge it reaches, not cross it in a straight
          // line to the next water cell.
          if (isWaterTerrain(seg.fromTerrain) && isWaterTerrain(seg.toTerrain)) return;

          const isTrunk = seg.kind === 'trunk';
          const outlineHalfWidth = isTrunk ? 3 : 2.25;
          const colorHalfWidth = isTrunk ? 1.625 : 1.125;
          const colorList = isTrunk ? trunkGeometries : tributaryGeometries;
          const oceanAtStart = seg.fromTerrain === 'ocean';
          const oceanAtEnd = seg.toTerrain === 'ocean';

          const polyline = meanderPolyline(seg.p1, seg.p2);
          const points3d = polyline.map(([x, y]) => [x, -y, getElevation(x, y) + 1.5]);
          const lastIndex = points3d.length - 1;

          for (let i = 0; i < lastIndex; i++) {
            const a = points3d[i];
            const b = points3d[i + 1];
            const midZ = (a[2] + b[2]) / 2;

            let widthScale = 1;
            if (oceanAtEnd) {
              const t = (i + 1) / lastIndex;
              widthScale = 1 + Math.max(0, (t - 0.7) / 0.3) * (MOUTH_WIDTH_MULTIPLIER - 1);
            } else if (oceanAtStart) {
              const t = i / lastIndex;
              widthScale = 1 + Math.max(0, (0.3 - t) / 0.3) * (MOUTH_WIDTH_MULTIPLIER - 1);
            }

            const outline = ribbonGeometry([a[0], a[1]], [b[0], b[1]], midZ, outlineHalfWidth * widthScale);
            if (outline) riverOutlineGeometries.push(outline);

            const colorRibbon = ribbonGeometry([a[0], a[1]], [b[0], b[1]], midZ + 0.1, colorHalfWidth * widthScale);
            if (colorRibbon) colorList.push(colorRibbon);
          }

          // Cap only the true start/end of this river edge — the dense
          // interior joints already overlap enough not to need one each.
          // Whichever end touches the ocean gets a mouth-width cap to
          // match the taper above.
          const first = points3d[0];
          const last = points3d[lastIndex];
          const startScale = oceanAtStart ? MOUTH_WIDTH_MULTIPLIER : 1;
          const endScale = oceanAtEnd ? MOUTH_WIDTH_MULTIPLIER : 1;
          riverOutlineGeometries.push(capGeometry([first[0], first[1]], first[2], outlineHalfWidth * startScale));
          riverOutlineGeometries.push(capGeometry([last[0], last[1]], last[2], outlineHalfWidth * endScale));
          colorList.push(capGeometry([first[0], first[1]], first[2] + 0.1, colorHalfWidth * startScale));
          colorList.push(capGeometry([last[0], last[1]], last[2] + 0.1, colorHalfWidth * endScale));
        });

        if (riverOutlineGeometries.length > 0) {
          const merged = mergeGeometries(riverOutlineGeometries);
          riverOutlineGeometries.forEach((g) => g.dispose());
          if (merged) {
            const mat = new THREE.MeshBasicMaterial({ color: 0x0d2a3a, transparent: true, opacity: 0.6 });
            scene.add(new THREE.Mesh(merged, mat));
          }
        }
        if (tributaryGeometries.length > 0) {
          const merged = mergeGeometries(tributaryGeometries);
          tributaryGeometries.forEach((g) => g.dispose());
          if (merged) {
            scene.add(new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ color: tributaryColor })));
          }
        }
        if (trunkGeometries.length > 0) {
          const merged = mergeGeometries(trunkGeometries);
          trunkGeometries.forEach((g) => g.dispose());
          if (merged) {
            scene.add(new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ color: trunkColor })));
          }
        }
      }

      // Kingdom markers with race icons
      const kingdomHitMeshes = [];
      kingdoms.forEach((kingdom) => {
        if (!kingdom.map_x || !kingdom.map_y) return;

        const symbolSize = 12;
        const padding = 2;

        // Measure kingdom name
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.font = 'bold 12px Arial';
        const textMetrics = tempCtx.measureText(kingdom.name || 'Kingdom');
        const textWidth = Math.ceil(textMetrics.width);
        const textHeight = 12;

        // Background oval dimensions
        const bgWidth = symbolSize + padding + textWidth + padding * 2;
        const bgHeight = Math.max(symbolSize, textHeight) + padding * 2;

        // Draw background rounded rectangle
        const bgCanvas = document.createElement('canvas');
        bgCanvas.width = bgWidth;
        bgCanvas.height = bgHeight;
        const bgCtx = bgCanvas.getContext('2d');
        bgCtx.fillStyle = 'rgba(0, 0, 0, 0.72)';

        const radius = 5;
        bgCtx.beginPath();
        bgCtx.moveTo(radius, 0);
        bgCtx.lineTo(bgWidth - radius, 0);
        bgCtx.quadraticCurveTo(bgWidth, 0, bgWidth, radius);
        bgCtx.lineTo(bgWidth, bgHeight - radius);
        bgCtx.quadraticCurveTo(bgWidth, bgHeight, bgWidth - radius, bgHeight);
        bgCtx.lineTo(radius, bgHeight);
        bgCtx.quadraticCurveTo(0, bgHeight, 0, bgHeight - radius);
        bgCtx.lineTo(0, radius);
        bgCtx.quadraticCurveTo(0, 0, radius, 0);
        bgCtx.fill();

        const bgTexture = new THREE.CanvasTexture(bgCanvas);
        const bgGeometry = new THREE.PlaneGeometry(bgWidth, bgHeight);
        const bgMaterial = new THREE.MeshBasicMaterial({ map: bgTexture, transparent: true });
        const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
        bgMesh.position.set(kingdom.map_x, -kingdom.map_y, 25);
        bgMesh.userData.kingdomId = kingdom.id;
        kingdomMarkersGroup.add(bgMesh);
        kingdomHitMeshes.push(bgMesh);

        // Draw symbol (race icon from SVG with stroke)
        const symbolCanvas = document.createElement('canvas');
        symbolCanvas.width = symbolSize * 3;
        symbolCanvas.height = symbolSize * 3;
        const symbolCtx = symbolCanvas.getContext('2d');

        const symbolTexture = new THREE.CanvasTexture(symbolCanvas);
        const symbolGeometry = new THREE.PlaneGeometry(symbolSize, symbolSize);
        const symbolMaterial = new THREE.MeshBasicMaterial({ map: symbolTexture, transparent: true });
        const symbolMesh = new THREE.Mesh(symbolGeometry, symbolMaterial);
        const symbolX = -bgWidth / 2 + padding + symbolSize / 2;
        symbolMesh.position.set(kingdom.map_x + symbolX, -kingdom.map_y, 26);
        symbolMesh.userData.kingdomId = kingdom.id;
        kingdomMarkersGroup.add(symbolMesh);
        kingdomHitMeshes.push(symbolMesh);

        const svgString = getRaceSVGIcon(kingdom.race);
        if (svgString) {
          const raceRegion = REGION_META[kingdom.race];
          const raceColor = raceRegion ? raceRegion.color : '#ffffff';

          // Add stroke and color to SVG
          const svgWithStyle = svgString
            .replace('<svg', `<svg stroke="white" stroke-width="0.5" color="${raceColor}"`)
            .replace(/fill="currentColor"/g, `fill="${raceColor}"`);

          const svg = new Image();
          const svgBlob = new Blob([svgWithStyle], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(svgBlob);
          svg.onload = () => {
            symbolCtx.clearRect(0, 0, symbolCanvas.width, symbolCanvas.height);
            symbolCtx.drawImage(svg, 0, 0, symbolCanvas.width, symbolCanvas.height);
            symbolTexture.needsUpdate = true;
            URL.revokeObjectURL(url);
          };
          svg.src = url;
        }

        // Draw kingdom name
        const nameCanvas = document.createElement('canvas');
        nameCanvas.width = textWidth + 2;
        nameCanvas.height = textHeight + 2;
        const nameCtx = nameCanvas.getContext('2d');
        nameCtx.font = 'bold 12px Arial';
        nameCtx.fillStyle = '#ffffff';
        nameCtx.textBaseline = 'middle';
        nameCtx.fillText(kingdom.name || 'Kingdom', 1, textHeight / 2 + 1);

        const nameTexture = new THREE.CanvasTexture(nameCanvas);
        const nameGeometry = new THREE.PlaneGeometry(textWidth, textHeight);
        const nameMaterial = new THREE.MeshBasicMaterial({ map: nameTexture, transparent: true });
        const nameMesh = new THREE.Mesh(nameGeometry, nameMaterial);
        const nameX = -bgWidth / 2 + padding + symbolSize + textWidth / 2;
        nameMesh.position.set(kingdom.map_x + nameX, -kingdom.map_y, 26);
        nameMesh.userData.kingdomId = kingdom.id;
        kingdomMarkersGroup.add(nameMesh);
        kingdomHitMeshes.push(nameMesh);
      });

      // Kingdom id -> map position, shared by trade routes (kingdom to
      // kingdom) and expeditions (the player's own kingdom to the
      // expedition's target) below.
      const kingdomCoordsById = new Map(
        kingdoms
          .filter((k) => Number.isFinite(Number(k.map_x)) && Number.isFinite(Number(k.map_y)))
          .map((k) => [String(k.id), { x: Number(k.map_x), y: -Number(k.map_y) }])
      );

      function dashedLine(x1, y1, x2, y2, z, color, opacity) {
        const geometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x1, y1, z),
          new THREE.Vector3(x2, y2, z),
        ]);
        const material = new THREE.LineDashedMaterial({
          color, transparent: true, opacity, dashSize: 6, gapSize: 4,
        });
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances(); // required for dashes to render at all
        return line;
      }

      // Trade routes: dashed gold line between the two partner kingdoms.
      tradeRoutes.forEach((route) => {
        const p1 = kingdomCoordsById.get(String(route.kingdom_id));
        const p2 = kingdomCoordsById.get(String(route.partner_id));
        if (!p1 || !p2) return;
        tradeRoutesGroup.add(dashedLine(p1.x, p1.y, p2.x, p2.y, 40, 0xe8b84b, 0.4));
      });

      // Expeditions: dashed blue line from the player's own kingdom to the
      // expedition's target coordinates.
      const homeCoords = kingdomCoordsById.get(String(currentKingdomId));
      if (homeCoords) {
        expeditions.forEach((exp) => {
          const ex = Number(exp.map_x);
          const ey = Number(exp.map_y);
          if (!Number.isFinite(ex) || !Number.isFinite(ey)) return;
          expeditionsGroup.add(dashedLine(homeCoords.x, homeCoords.y, ex, -ey, 41, 0x7ec8ff, 0.55));
        });
      }

      // Resource nodes: halo + colored disc (by terrain, falling back to
      // the node type's own color) + an icon rendered the same
      // canvas-texture way as the kingdom markers above. A separate,
      // larger invisible disc is the actual click target — the visible
      // parts (especially the icon plane) are too small to reliably hit.
      const nodeHitMeshes = [];
      nodes.forEach((node) => {
        const nx = Number(node.map_x);
        const ny = Number(node.map_y);
        if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;

        const meta = NODE_TYPE_META[node.type] || NODE_TYPE_META.wood;
        const nr = getNodeRadius(node.richness);
        const fillColor = node.terrain ? (TERRAIN_COLORS[node.terrain] || TERRAIN_COLORS.plains) : meta.fill;
        const posX = nx;
        const posY = -ny;
        // Interactive layer clears the local terrain height (mountains reach
        // z≈24) as well as the requested z26 floor, so markers on elevated
        // ground don't sink behind a neighboring ridge from the tilted camera.
        const hitZ = Math.max(26, getElevation(nx, ny) + 10);

        const haloGeometry = new THREE.CircleGeometry(nr + 3, 16);
        const haloMaterial = new THREE.MeshBasicMaterial({ color: meta.fill, transparent: true, opacity: 0.18 });
        const haloMesh = new THREE.Mesh(haloGeometry, haloMaterial);
        haloMesh.position.set(posX, posY, hitZ - 3);
        resourceNodesGroup.add(haloMesh);

        const nodeGeometry = new THREE.CircleGeometry(nr, 16);
        const nodeMaterial = new THREE.MeshBasicMaterial({ color: fillColor });
        const nodeMesh = new THREE.Mesh(nodeGeometry, nodeMaterial);
        nodeMesh.position.set(posX, posY, hitZ - 2);
        resourceNodesGroup.add(nodeMesh);

        const iconCanvas = document.createElement('canvas');
        iconCanvas.width = 24;
        iconCanvas.height = 24;
        const iconCtx = iconCanvas.getContext('2d');
        iconCtx.font = '16px Arial';
        iconCtx.textAlign = 'center';
        iconCtx.textBaseline = 'middle';
        iconCtx.fillText(meta.icon || '', 12, 13);

        const iconTexture = new THREE.CanvasTexture(iconCanvas);
        const iconGeometry = new THREE.PlaneGeometry(nr * 1.6, nr * 1.6);
        const iconMaterial = new THREE.MeshBasicMaterial({ map: iconTexture, transparent: true });
        const iconMesh = new THREE.Mesh(iconGeometry, iconMaterial);
        iconMesh.position.set(posX, posY, hitZ - 1);
        resourceNodesGroup.add(iconMesh);

        const hitGeometry = new THREE.CircleGeometry(nr + 8, 16);
        const hitMaterial = new THREE.MeshBasicMaterial();
        const hitMesh = new THREE.Mesh(hitGeometry, hitMaterial);
        hitMesh.position.set(posX, posY, hitZ);
        hitMesh.visible = false; // raycasting ignores .visible, so this stays clickable while invisible
        hitMesh.userData.node = node;
        resourceNodesGroup.add(hitMesh);
        nodeHitMeshes.push(hitMesh);
      });

      // Dungeon / Mountain's Heart: only ones the player's kingdom has
      // already discovered (via scouting) are ever sent down by the server,
      // so anything here is safe to render unconditionally. Same
      // icon+halo+hit-circle pattern as resource nodes above.
      const locationHitMeshes = [];
      worldLocations.forEach((loc) => {
        const lx = Number(loc.x);
        const ly = Number(loc.y);
        if (!Number.isFinite(lx) || !Number.isFinite(ly)) return;

        const isDungeon = loc.type === 'dungeon';
        const icon = isDungeon ? '⚔️' : '🏔️';
        const color = isDungeon ? 0xc0392b : 0x8899aa;
        const lr = 14;
        const posX = lx;
        const posY = -ly;
        // Dungeons/mountains are seeded near each region's dominant terrain
        // (mountains for the mountain heart especially), so the interactive
        // layer must clear the *local* elevation, not just a flat z26 --
        // otherwise a taller neighboring ridge can visually swallow the
        // marker from the map's tilted camera angle.
        const hitZ = Math.max(26, getElevation(lx, ly) + 10);

        const haloGeometry = new THREE.CircleGeometry(lr + 4, 16);
        const haloMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22 });
        const haloMesh = new THREE.Mesh(haloGeometry, haloMaterial);
        haloMesh.position.set(posX, posY, hitZ - 3);
        worldLocationsGroup.add(haloMesh);

        const discGeometry = new THREE.CircleGeometry(lr, 16);
        const discMaterial = new THREE.MeshBasicMaterial({ color });
        const discMesh = new THREE.Mesh(discGeometry, discMaterial);
        discMesh.position.set(posX, posY, hitZ - 2);
        worldLocationsGroup.add(discMesh);

        const iconCanvas = document.createElement('canvas');
        iconCanvas.width = 28;
        iconCanvas.height = 28;
        const iconCtx = iconCanvas.getContext('2d');
        iconCtx.font = '20px Arial';
        iconCtx.textAlign = 'center';
        iconCtx.textBaseline = 'middle';
        iconCtx.fillText(icon, 14, 15);

        const iconTexture = new THREE.CanvasTexture(iconCanvas);
        const iconGeometry = new THREE.PlaneGeometry(lr * 1.8, lr * 1.8);
        const iconMaterial = new THREE.MeshBasicMaterial({ map: iconTexture, transparent: true });
        const iconMesh = new THREE.Mesh(iconGeometry, iconMaterial);
        iconMesh.position.set(posX, posY, hitZ - 1);
        worldLocationsGroup.add(iconMesh);

        const hitGeometry = new THREE.CircleGeometry(lr + 8, 16);
        const hitMaterial = new THREE.MeshBasicMaterial();
        const hitMesh = new THREE.Mesh(hitGeometry, hitMaterial);
        hitMesh.position.set(posX, posY, hitZ);
        hitMesh.visible = false;
        hitMesh.userData.location = loc;
        worldLocationsGroup.add(hitMesh);
        locationHitMeshes.push(hitMesh);
      });

      // Region name labels: wrapped title (matches the canvas renderer's
      // wrapRegionName — splits long names near their midpoint space) plus
      // a bonus subtitle, centered on each race's home point. Drawn well
      // above everything else with depth testing off so they always read,
      // same intent as the canvas renderer drawing these in the topmost layer.
      function wrapRegionName(name) {
        if (!name || name.length <= 14) return [name || ''];
        const spaceIndices = [];
        for (let i = 0; i < name.length; i++) {
          if (name[i] === ' ') spaceIndices.push(i);
        }
        if (!spaceIndices.length) return [name];
        const mid = name.length / 2;
        let best = spaceIndices[0];
        spaceIndices.forEach((idx) => {
          if (Math.abs(idx - mid) < Math.abs(best - mid)) best = idx;
        });
        return [name.slice(0, best), name.slice(best + 1)];
      }

      // The Iron Holds label sits over dark mountain terrain at its literal
      // home point and is hard to read there; move just this one label
      // north into the ocean band (rows 4-5, y ~204-306 — see
      // oceanBandForColumn in worldMapBuilder.js) instead of its home x/y.
      const REGION_LABEL_OVERRIDES = {
        dwarf: { x: 400, y: 260 },
      };

      Object.entries(REGION_META).forEach(([race, meta]) => {
        const home = REGION_LABEL_OVERRIDES[race] || RACE_HOMES[race];
        if (!home) return;

        const titleLines = wrapRegionName(meta.name).map((l) => l.toUpperCase());
        const subtitle = REGION_BONUSES[race] || '';
        const titleFontPx = 32;
        const subtitleFontPx = 20;
        const lineGap = 6;

        const measureCanvas = document.createElement('canvas');
        const measureCtx = measureCanvas.getContext('2d');
        measureCtx.font = `bold ${titleFontPx}px Georgia, serif`;
        let maxWidth = 0;
        titleLines.forEach((line) => {
          maxWidth = Math.max(maxWidth, measureCtx.measureText(line).width);
        });
        if (subtitle) {
          measureCtx.font = `600 ${subtitleFontPx}px sans-serif`;
          maxWidth = Math.max(maxWidth, measureCtx.measureText(subtitle).width);
        }

        const padding = 12;
        const canvasWidth = Math.ceil(maxWidth + padding * 2);
        const titleBlockHeight = titleLines.length * (titleFontPx + lineGap);
        const subtitleBlockHeight = subtitle ? subtitleFontPx + lineGap : 0;
        const canvasHeight = Math.ceil(titleBlockHeight + subtitleBlockHeight + padding);

        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = canvasWidth;
        labelCanvas.height = canvasHeight;
        const ctx = labelCanvas.getContext('2d');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 1;

        ctx.font = `bold ${titleFontPx}px Georgia, serif`;
        ctx.fillStyle = meta.stroke || '#ffffff';
        titleLines.forEach((line, i) => {
          ctx.fillText(line, canvasWidth / 2, (titleFontPx + lineGap) * (i + 0.5) + padding / 2);
        });

        if (subtitle) {
          ctx.font = `600 ${subtitleFontPx}px sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(subtitle, canvasWidth / 2, titleBlockHeight + subtitleFontPx / 2 + padding / 2);
        }

        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelGeometry = new THREE.PlaneGeometry(canvasWidth, canvasHeight);
        const labelMaterial = new THREE.MeshBasicMaterial({
          map: labelTexture,
          transparent: true,
          depthWrite: false,
          depthTest: false,
        });
        const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
        labelMesh.position.set(home.x, -home.y, 80);
        labelMesh.renderOrder = 999;
        scene.add(labelMesh);
      });

      const mapWidth = hexGrid.W;
      const mapHeight = hexGrid.H;
      const centerX = mapWidth / 2;
      const centerY = -mapHeight / 2;
      const mapCenter = new THREE.Vector3(centerX, centerY, 0);

      // Default view focuses the player's own kingdom (falls back to the
      // map's geometric center if it isn't in the kingdoms list yet).
      const playerKingdom = kingdoms.find((k) => String(k.id) === String(currentKingdomId));
      const initialFocusX = playerKingdom ? Number(playerKingdom.map_x) : centerX;
      const initialFocusY = playerKingdom ? -Number(playerKingdom.map_y) : centerY;

      // Start with orthographic camera showing entire map
      const initialFrustumWidth = mapWidth + 100;
      const initialFrustumHeight = mapHeight + 100;

      const orthoCamera = new THREE.OrthographicCamera(
        -initialFrustumWidth / 2, initialFrustumWidth / 2,
        initialFrustumHeight / 2, -initialFrustumHeight / 2,
        0.1, 10000
      );

      // Perspective camera for pitch controls
      const perspCamera = new THREE.PerspectiveCamera(60, w / h, 0.1, 10000);

      let camera = orthoCamera;
      cameraRef.current = camera;

      // Camera controls state
      const cameraState = {
        pitch: 30, // degrees, elevation angle
        yaw: 0, // degrees, rotation around the vertical axis
        distance: 450,
        minPitch: -120,
        maxPitch: 120,
        minYaw: -120,
        maxYaw: 120,
        inPerspective: false,
        camX: initialFocusX,
        camY: initialFocusY,
        zoomLevel: 2.0,
      };

      const updateOrthoCamera = () => {
        const frustumWidth = initialFrustumWidth / cameraState.zoomLevel;
        const frustumHeight = initialFrustumHeight / cameraState.zoomLevel;

        orthoCamera.left = -frustumWidth / 2;
        orthoCamera.right = frustumWidth / 2;
        orthoCamera.top = frustumHeight / 2;
        orthoCamera.bottom = -frustumHeight / 2;

        orthoCamera.position.set(cameraState.camX, cameraState.camY, 500);
        orthoCamera.lookAt(cameraState.camX, cameraState.camY, 0);
        orthoCamera.updateProjectionMatrix();
      };
      // Apply the real starting state (2x zoom, focused on the player's
      // kingdom) immediately — orthoCamera's constructor above only sets
      // up a full-map frustum with no regard for cameraState.zoomLevel,
      // which would otherwise only take effect the first time the user
      // zooms/pans/resets, producing a jarring jump on first interaction.
      updateOrthoCamera();

      const updatePerspCamera = () => {
        cameraState.inPerspective = true;
        camera = perspCamera;
        cameraRef.current = camera;

        const pitchRad = (cameraState.pitch * Math.PI) / 180;
        const yawRad = (cameraState.yaw * Math.PI) / 180;
        const horizontalDist = cameraState.distance * Math.cos(pitchRad);
        const verticalDist = cameraState.distance * Math.sin(pitchRad);

        perspCamera.position.set(
          cameraState.camX - horizontalDist * Math.sin(yawRad) * 0.3,
          cameraState.camY - horizontalDist * Math.cos(yawRad) * 0.3,
          verticalDist
        );
        perspCamera.lookAt(cameraState.camX, cameraState.camY, 0);
      };

      // Middle-mouse click reverts to the full-map top-down orthographic
      // view — the only way back once tilted into perspective mode, since
      // nothing else ever flips inPerspective back to false. zoomLevel 1.0
      // is the true full-map frustum (initialFrustumWidth/Height, computed
      // as mapWidth/Height + 100 padding) — 2.0 is just the app's default
      // startup zoom, already 2x zoomed in from the whole map.
      const resetToOrthoView = () => {
        cameraState.pitch = 30;
        cameraState.yaw = 0;
        cameraState.zoomLevel = 1.0;
        cameraState.camX = centerX;
        cameraState.camY = centerY;
        cameraState.inPerspective = false;
        camera = orthoCamera;
        cameraRef.current = camera;
        updateOrthoCamera();
      };

      let isRightMouseDown = false;
      let lastMouseX = 0;
      let lastMouseY = 0;

      const onKeyDown = (e) => {
        const pitchStep = 3; // degrees
        const yawStep = 3; // degrees
        if (e.key === 'ArrowUp') {
          cameraState.pitch = Math.min(
            cameraState.pitch + pitchStep,
            cameraState.maxPitch
          );
          updatePerspCamera();
          e.preventDefault();
        } else if (e.key === 'ArrowDown') {
          cameraState.pitch = Math.max(
            cameraState.pitch - pitchStep,
            cameraState.minPitch
          );
          updatePerspCamera();
          e.preventDefault();
        } else if (e.key === 'ArrowLeft') {
          cameraState.yaw = Math.max(
            cameraState.yaw - yawStep,
            cameraState.minYaw
          );
          updatePerspCamera();
          e.preventDefault();
        } else if (e.key === 'ArrowRight') {
          cameraState.yaw = Math.min(
            cameraState.yaw + yawStep,
            cameraState.maxYaw
          );
          updatePerspCamera();
          e.preventDefault();
        }
      };

      const onMouseWheel = (e) => {
        e.preventDefault();
        // Scale by actual scroll magnitude (not a fixed per-event step) so
        // a deliberate scroll produces an obviously large change. A fixed
        // step mostly cancels out under trackpads/high-polling-rate mice,
        // which fire many small alternating-sign events per gesture.
        const scaleFactor = Math.exp(-e.deltaY * 0.0015);

        if (cameraState.inPerspective) {
          cameraState.distance = Math.min(Math.max(cameraState.distance * scaleFactor, 50), 2000);
          updatePerspCamera();
        } else {
          cameraState.zoomLevel = Math.min(Math.max(cameraState.zoomLevel * scaleFactor, 0.5), 5.0);
          updateOrthoCamera();
        }
      };

      const onMouseDown = (e) => {
        if (e.button === 2) { // Right mouse button
          isRightMouseDown = true;
          lastMouseX = e.clientX;
          lastMouseY = e.clientY;
          e.preventDefault();
        } else if (e.button === 1) { // Middle mouse button
          e.preventDefault(); // Suppress the browser's native autoscroll cursor
          resetToOrthoView();
        }
      };

      const onMouseMove = (e) => {
        if (!isRightMouseDown) return;

        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        // Pan the camera
        const panScale = 0.5 / cameraState.zoomLevel;
        cameraState.camX -= deltaX * panScale;
        cameraState.camY += deltaY * panScale;

        if (!cameraState.inPerspective) {
          updateOrthoCamera();
        } else {
          updatePerspCamera();
        }
      };

      const onMouseUp = () => {
        isRightMouseDown = false;
      };

      const onContextMenu = (e) => {
        e.preventDefault();
      };

      // Left-click a kingdom marker to open the same interactive card the
      // canvas renderer uses (attack/spell/trade/profile buttons) — 'click'
      // only ever fires for the primary button, so this never conflicts
      // with the right-click-drag pan or middle-click ortho reset above.
      const raycaster = new THREE.Raycaster();
      const mouseNDC = new THREE.Vector2();
      const onContainerClick = (e) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const activeCamera = cameraState.inPerspective ? perspCamera : orthoCamera;
        raycaster.setFromCamera(mouseNDC, activeCamera);

        // Raycasting ignores .visible entirely (that flag only affects
        // rendering), so each list is only included when its layer is
        // actually shown — otherwise clicking where a hidden
        // marker/node used to be would still open its card. Both lists
        // go into one intersectObjects call so whichever is actually
        // closer to the camera wins (results come back sorted by
        // distance), rather than always favoring kingdoms.
        const targets = [];
        if (kingdomMarkersGroup.visible) targets.push(...kingdomHitMeshes);
        if (resourceNodesGroup.visible) targets.push(...nodeHitMeshes);
        if (worldLocationsGroup.visible) targets.push(...locationHitMeshes);
        if (targets.length === 0) return;

        const intersects = raycaster.intersectObjects(targets);
        if (intersects.length === 0) return;

        const hit = intersects[0].object;
        if (hit.userData.kingdomId != null) {
          showMapKingdomCard(hit.userData.kingdomId);
        } else if (hit.userData.node) {
          window.dispatchEvent(new CustomEvent('nodeClicked', { detail: hit.userData.node }));
        } else if (hit.userData.location) {
          window.dispatchEvent(new CustomEvent('locationClicked', { detail: hit.userData.location }));
        }
      };

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('contextmenu', onContextMenu);
      containerRef.current.addEventListener('wheel', onMouseWheel, {
        passive: false,
      });
      containerRef.current.addEventListener('click', onContainerClick);

      let frame = 0;
      let animationFrameId = null;
      let disposed = false;
      const animate = () => {
        if (disposed) return;
        animationFrameId = requestAnimationFrame(animate);
        frame++;

        const activeCamera = cameraState.inPerspective ? perspCamera : orthoCamera;
        renderer.render(scene, activeCamera);
      };
      animate();

      const handleResize = () => {
        if (!containerRef.current) return;
        const newW = containerRef.current.clientWidth;
        const newH = containerRef.current.clientHeight;
        renderer.setSize(newW, newH);
        perspCamera.aspect = newW / newH;
        perspCamera.updateProjectionMatrix();
      };
      window.addEventListener('resize', handleResize);

      return () => {
        disposed = true;
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId);
        }
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('contextmenu', onContextMenu);
        if (containerRef.current) {
          containerRef.current.removeEventListener('wheel', onMouseWheel);
          containerRef.current.removeEventListener('click', onContainerClick);
          if (renderer.domElement.parentNode === containerRef.current) {
            containerRef.current.removeChild(renderer.domElement);
          }
        }
        renderer.dispose();
      };
    };

    checkAndRender();

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [hexGrid, elevationData, kingdoms, currentKingdomId, nodes, tradeRoutes, expeditions, worldLocations]);

  // Layer visibility toggles: intentionally a separate, lightweight effect
  // from the one above — flips .visible on the pre-built groups instead of
  // rebuilding the whole scene, so clicking a toggle button is instant
  // rather than re-running every terrain/border/river computation.
  useEffect(() => {
    const groups = layerGroupsRef.current;
    if (groups.kingdoms) groups.kingdoms.visible = layers.kingdoms !== false;
    if (groups.terrain) groups.terrain.visible = layers.terrain !== false;
    if (groups.nodes) groups.nodes.visible = layers.nodes !== false;
    if (groups.routes) groups.routes.visible = layers.routes !== false;
    if (groups.expeditions) groups.expeditions.visible = layers.expeditions !== false;
    if (groups.locations) groups.locations.visible = layers.locations !== false;
  }, [layers]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    />
  );
}
