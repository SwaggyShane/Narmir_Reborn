import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { REGION_META, REGION_BONUSES } from '../../utils/raceData.js';
import { RACE_ICONS } from '../../utils/raceIcons.js';
import { getRaceSVGIcon } from '../../utils/raceIconsSVG.js';
import { hexCenter, hexCorners, HEX_SIZE, HEX_W, HEX_VERT } from '../../utils/hexMap/HexGeometry.ts';

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

export default function WorldmapWebGL({ hexGrid = null, kingdoms = [], elevationData = null, highlightedRace = null }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !hexGrid) {
      return;
    }

    const checkAndRender = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;

      if (w === 0 || h === 0) {
        requestAnimationFrame(checkAndRender);
        return;
      }

      initializeWebGL(w, h);
    };

    const initializeWebGL = (w, h) => {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x040710);
      scene.fog = new THREE.Fog(0x040710, 5000, 10000);
      sceneRef.current = scene;

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

      // Build cellMap and compute races using Voronoi (nearest RACE_HOME)
      const RACE_HOMES = {
        dwarf: { x: 400, y: 488 },
        high_elf: { x: 1155, y: 340 },
        wood_elf: { x: 1599, y: 467 },
        vampire: { x: 933, y: 701 },
        ogre: { x: 1777, y: 828 },
        dark_elf: { x: 1243, y: 913 },
        orc: { x: 1555, y: 1040 },
        human: { x: 666, y: 913 },
        dire_wolf: { x: 289, y: 849 },
      };

      function nearestRaceHome(x, y) {
        let best = null;
        let bestDist = Infinity;
        for (const [race, home] of Object.entries(RACE_HOMES)) {
          const dx = x - home.x;
          const dy = y - home.y;
          const dist = dx * dx + dy * dy;
          if (dist < bestDist) {
            bestDist = dist;
            best = race;
          }
        }
        return best || 'human';
      }

      const cellMap = new Map();
      hexGrid.cells.forEach((cell) => {
        const key = `${cell.col},${cell.row}`;
        cell.race = nearestRaceHome(cell.x * 2, -cell.y * 2);
        cellMap.set(key, cell);
      });

      // ODDR neighbor offsets (pointy-top, odd-r)
      const ODDR_DIRECTIONS = [
        [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]],  // even row
        [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]],    // odd row
      ];

      const DIRECTION_EDGE_CORNERS = [
        [0, 1], // E
        [5, 0], // NE
        [4, 5], // NW
        [3, 4], // W
        [2, 3], // SW
        [1, 2], // SE
      ];

      // Draw region borders
      const borderLines = [];
      const drawnEdges = new Set();
      const BORDER_INSET = 4;

      hexGrid.cells.forEach((cell) => {
        const key = `${cell.col},${cell.row}`;
        const parity = cell.row & 1;
        const directions = ODDR_DIRECTIONS[parity];
        const corners = hexCorners(cell.x, cell.y, HEX_SIZE - BORDER_INSET);
        const elev = getCellElevation(cell);

        directions.forEach((offset, dirIndex) => {
          const neighborCol = cell.col + offset[0];
          const neighborRow = cell.row + offset[1];
          const neighborKey = `${neighborCol},${neighborRow}`;
          const neighbor = cellMap.get(neighborKey);

          if (neighbor && neighbor.race !== cell.race) {
            const edgeKey = [key, neighborKey].sort().join('|');
            if (!drawnEdges.has(edgeKey)) {
              drawnEdges.add(edgeKey);

              const edgeCorners = DIRECTION_EDGE_CORNERS[dirIndex];
              const c1 = corners[edgeCorners[0]];
              const c2 = corners[edgeCorners[1]];

              const neighborElev = getCellElevation(neighbor);
              const borderZ = Math.max(elev, neighborElev) + 1;

              borderLines.push({
                p1: new THREE.Vector3(c1[0], c1[1], borderZ),
                p2: new THREE.Vector3(c2[0], c2[1], borderZ),
                race: cell.race,
              });
            }
          }
        });
      });

      // Render border lines as thin colored planes
      borderLines.forEach(({ p1, p2, race }) => {
        const raceRegion = REGION_META[race];
        const color = raceRegion ? new THREE.Color(raceRegion.stroke) : new THREE.Color(0xffffff);

        // Create a thin plane between the two points
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const thickness = 1.5;

        const planeGeo = new THREE.PlaneGeometry(length, thickness);
        const planeMat = new THREE.MeshPhongMaterial({ color, side: THREE.DoubleSide });
        const plane = new THREE.Mesh(planeGeo, planeMat);

        // Position at midpoint
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const midZ = (p1.z + p2.z) / 2;
        plane.position.set(midX, midY, midZ);

        // Rotate to align with the edge
        const angle = Math.atan2(dy, dx);
        plane.rotation.z = angle;

        scene.add(plane);
      });

      if (borderLines.length > 0) {
        console.log(`Created ${borderLines.length} border segments`);
        const first = borderLines[0];
        const dist = Math.sqrt(
          (first.p2.x - first.p1.x) ** 2 +
          (first.p2.y - first.p1.y) ** 2 +
          (first.p2.z - first.p1.z) ** 2
        );
        console.log(`First border: p1=(${first.p1.x.toFixed(2)}, ${first.p1.y.toFixed(2)}, ${first.p1.z.toFixed(2)}), p2=(${first.p2.x.toFixed(2)}, ${first.p2.y.toFixed(2)}, ${first.p2.z.toFixed(2)}), len=${dist.toFixed(2)}`);
      }

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

      const mountainSnowParticles = []; // Track snow for animation

      const createMountainSymbol = () => {
        const group = new THREE.Group();
        const mountainGrey = new THREE.Color('#777777');
        const white = new THREE.Color(0xffffff);

        // Falling snow on mountain
        const snowCount = 200;
        const snowGeo = new THREE.BufferGeometry();
        const snowPos = new Float32Array(snowCount * 3);
        const snowVel = new Float32Array(snowCount * 3);

        for (let i = 0; i < snowCount; i++) {
          snowPos[i * 3] = (Math.random() - 0.5) * 30;
          snowPos[i * 3 + 1] = (Math.random() - 0.5) * 30;
          snowPos[i * 3 + 2] = Math.random() * 80;

          snowVel[i * 3] = (Math.random() - 0.5) * 0.15;
          snowVel[i * 3 + 1] = (Math.random() - 0.5) * 0.15;
          snowVel[i * 3 + 2] = -0.4 - Math.random() * 0.2;
        }

        snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
        const snowMat = new THREE.PointsMaterial({
          color: 0xffffff,
          size: 1.5,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.7,
        });
        const snowMesh = new THREE.Points(snowGeo, snowMat);
        group.add(snowMesh);

        mountainSnowParticles.push({ geo: snowGeo, pos: snowPos, vel: snowVel, count: snowCount });

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
        scene.add(symbol);
      });

      const backgroundGeometry = new THREE.BoxGeometry(hexGrid.W + 150, hexGrid.H + 150, 1);
      const backgroundMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 1, transparent: false, side: THREE.FrontSide });
      const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
      background.position.set(hexGrid.W / 2, -hexGrid.H / 2, -5);
      scene.add(background);

      // Add rivers if available
      if (hexGrid.riverSegments && hexGrid.riverSegments.length > 0) {
        const riverPositions = [];
        const riverColors = [];
        const tributaryColor = new THREE.Color(0x4a9fd0);
        const trunkColor = new THREE.Color(0x5cc0e8);

        const elevations = new Map();
        if (hexGrid.cells) {
          hexGrid.cells.forEach(cell => {
            const key = Math.round(cell.x) + ',' + Math.round(cell.y);
            elevations.set(key, getCellElevation(cell));
          });
        }

        const getElevation = (x, y) => {
          const key = Math.round(x) + ',' + Math.round(y);
          return elevations.get(key) || 0.5;
        };

        hexGrid.riverSegments.forEach((seg) => {
          const p1 = seg.p1;
          const p2 = seg.p2;
          const z1 = getElevation(p1[0], p1[1]);
          const z2 = getElevation(p2[0], p2[1]);
          const color = seg.kind === 'trunk' ? trunkColor : tributaryColor;

          for (let i = 0; i <= 5; i++) {
            const t = i / 5;
            const x = p1[0] + (p2[0] - p1[0]) * t;
            const y = p1[1] + (p2[1] - p1[1]) * t;
            const z = z1 + (z2 - z1) * t + 0.5;
            riverPositions.push(x, -y, z);
            riverColors.push(color.r, color.g, color.b);
          }
        });

        const riverGeometry = new THREE.BufferGeometry();
        riverGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(riverPositions), 3));
        riverGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(riverColors), 3));

        const riverMaterial = new THREE.LineBasicMaterial({
          vertexColors: true,
          linewidth: 3,
          fog: false
        });

        const riverLines = new THREE.Line(riverGeometry, riverMaterial);
        scene.add(riverLines);
      }

      // Kingdom markers with race icons
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
        scene.add(bgMesh);

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
        scene.add(symbolMesh);

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
        scene.add(nameMesh);
      });

      const mapWidth = hexGrid.W;
      const mapHeight = hexGrid.H;
      const centerX = mapWidth / 2;
      const centerY = -mapHeight / 2;
      const mapCenter = new THREE.Vector3(centerX, centerY, 0);

      // Start with orthographic camera showing entire map
      const initialFrustumWidth = mapWidth + 100;
      const initialFrustumHeight = mapHeight + 100;

      const orthoCamera = new THREE.OrthographicCamera(
        -initialFrustumWidth / 2, initialFrustumWidth / 2,
        initialFrustumHeight / 2, -initialFrustumHeight / 2,
        0.1, 10000
      );
      orthoCamera.position.set(centerX, centerY, 500);
      orthoCamera.lookAt(centerX, centerY, 0);
      orthoCamera.updateProjectionMatrix();

      // Perspective camera for pitch controls
      const perspCamera = new THREE.PerspectiveCamera(60, w / h, 0.1, 10000);

      let camera = orthoCamera;
      cameraRef.current = camera;

      // Camera controls state
      const cameraState = {
        pitch: 30, // degrees
        distance: 450,
        minPitch: 5,
        maxPitch: 120,
        inPerspective: false,
        camX: centerX,
        camY: centerY,
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

      const updatePerspCamera = () => {
        cameraState.inPerspective = true;
        camera = perspCamera;
        cameraRef.current = camera;

        const pitchRad = (cameraState.pitch * Math.PI) / 180;
        const horizontalDist = cameraState.distance * Math.cos(pitchRad);
        const verticalDist = cameraState.distance * Math.sin(pitchRad);

        perspCamera.position.set(
          cameraState.camX,
          cameraState.camY - horizontalDist * 0.3,
          verticalDist
        );
        perspCamera.lookAt(cameraState.camX, cameraState.camY, 0);
      };

      let isRightMouseDown = false;
      let lastMouseX = 0;
      let lastMouseY = 0;

      const onKeyDown = (e) => {
        const pitchStep = 3; // degrees
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
        }
      };

      const onMouseWheel = (e) => {
        const zoomStep = 0.1;
        if (e.deltaY < 0) {
          cameraState.zoomLevel = Math.min(cameraState.zoomLevel + zoomStep, 5.0);
        } else {
          cameraState.zoomLevel = Math.max(cameraState.zoomLevel - zoomStep, 0.5);
        }
        if (!cameraState.inPerspective) {
          updateOrthoCamera();
        }
        e.preventDefault();
      };

      const onMouseDown = (e) => {
        if (e.button === 2) { // Right mouse button
          isRightMouseDown = true;
          lastMouseX = e.clientX;
          lastMouseY = e.clientY;
          e.preventDefault();
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

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('contextmenu', onContextMenu);
      containerRef.current.addEventListener('wheel', onMouseWheel, {
        passive: false,
      });

      let frame = 0;
      const animate = () => {
        requestAnimationFrame(animate);
        frame++;

        // Update mountain snow
        mountainSnowParticles.forEach(snow => {
          const pos = snow.pos;
          for (let i = 0; i < snow.count; i++) {
            pos[i * 3] += snow.vel[i * 3];
            pos[i * 3 + 1] += snow.vel[i * 3 + 1];
            pos[i * 3 + 2] += snow.vel[i * 3 + 2];

            // Loop snow back to top
            if (pos[i * 3 + 2] < -10) {
              pos[i * 3 + 2] = 80;
              pos[i * 3] = (Math.random() - 0.5) * 30;
              pos[i * 3 + 1] = (Math.random() - 0.5) * 30;
            }
          }
          snow.geo.attributes.position.needsUpdate = true;
        });

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
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('contextmenu', onContextMenu);
        if (containerRef.current) {
          containerRef.current.removeEventListener('wheel', onMouseWheel);
          if (renderer.domElement.parentNode === containerRef.current) {
            containerRef.current.removeChild(renderer.domElement);
          }
        }
        renderer.dispose();
      };
    };

    checkAndRender();

    return () => {};
  }, [hexGrid, elevationData, kingdoms]);

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
