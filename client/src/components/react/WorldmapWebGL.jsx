import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { REGION_META, REGION_BONUSES } from '../../utils/raceData.js';
import { RACE_ICONS } from '../../utils/raceIcons.js';
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

      const createSymbolForTerrain = (cell, elevation) => {
        const group = new THREE.Group();

        if (cell.terrain === 'forest') {
          const bodyGeo = new THREE.ConeGeometry(12, 8, 12);
          const terrainColor = new THREE.Color(TERRAIN_COLORS[cell.terrain] || '#ffffff');
          terrainColor.multiplyScalar(0.5);
          const bodyMat = new THREE.MeshPhongMaterial({
            color: terrainColor,
            shininess: 20
          });
          const body = new THREE.Mesh(bodyGeo, bodyMat);
          body.position.y = 4;
          group.add(body);

          const tipGeo = new THREE.ConeGeometry(4, 6, 8);
          const tipMat = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            shininess: 20
          });
          const tip = new THREE.Mesh(tipGeo, tipMat);
          tip.position.y = 8 + 3;
          group.add(tip);
        } else if (cell.terrain === 'mountains') {
          const coneGeo = new THREE.ConeGeometry(2, 5, 4);
          const coneMat = new THREE.MeshPhongMaterial({
            color: new THREE.Color(TERRAIN_COLORS[cell.terrain] || '#ffffff').multiplyScalar(0.6),
            shininess: 15
          });
          const cone = new THREE.Mesh(coneGeo, coneMat);
          group.add(cone);
        } else if (cell.terrain === 'hills') {
          const tetGeo = new THREE.TetrahedronGeometry(2);
          const tetMat = new THREE.MeshPhongMaterial({
            color: new THREE.Color(TERRAIN_COLORS[cell.terrain] || '#ffffff').multiplyScalar(0.6),
            shininess: 20
          });
          const tet = new THREE.Mesh(tetGeo, tetMat);
          group.add(tet);
        }

        return group;
      };

      hexGrid.cells.forEach((cell) => {
        if (cell.terrain === 'ocean' || cell.terrain === 'lake') return;
        if (cell.terrain !== 'forest' && cell.terrain !== 'plains' && cell.terrain !== 'desert' && cell.terrain !== 'volcanic' && cell.terrain !== 'mountains' && cell.terrain !== 'hills' && cell.terrain !== 'swamp') return;

        const elevation = getCellElevation(cell);
        const symbol = createSymbolForTerrain(cell, elevation);
        if (!symbol) return;

        symbol.position.set(cell.x, -cell.y, elevation + 1);
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

      // Add debug sphere at kingdom positions + kingdom labels with dynamic text measurement
      kingdoms.forEach((kingdom) => {
        if (!kingdom.map_x || !kingdom.map_y) return;

        // Red sphere at kingdom position
        const markerGeo = new THREE.SphereGeometry(11.25, 16, 16);
        const markerMat = new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: 0.6, transparent: true });
        const marker = new THREE.Mesh(markerGeo, markerMat);
        marker.position.set(kingdom.map_x, -kingdom.map_y, 25);
        scene.add(marker);

        // Kingdom label with dynamic text measurement
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.font = 'bold 64px Arial';
        const textMetrics = tempCtx.measureText(kingdom.name || 'Kingdom');
        const actualTextWidth = Math.ceil(textMetrics.width);

        // Background rounded rectangle
        const bgCanvas = document.createElement('canvas');
        bgCanvas.width = 512;
        bgCanvas.height = 160;
        const bgCtx = bgCanvas.getContext('2d');

        const padding = 5;
        const iconSize = 32;
        const bgWidth = iconSize + actualTextWidth + padding * 3;
        const bgHeight = Math.max(iconSize, 64) + padding * 2;
        const radius = 32;

        // Draw rounded rectangle
        bgCtx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        bgCtx.beginPath();
        bgCtx.moveTo(padding + radius, padding);
        bgCtx.lineTo(padding + bgWidth - radius, padding);
        bgCtx.quadraticCurveTo(padding + bgWidth, padding, padding + bgWidth, padding + radius);
        bgCtx.lineTo(padding + bgWidth, padding + bgHeight - radius);
        bgCtx.quadraticCurveTo(padding + bgWidth, padding + bgHeight, padding + bgWidth - radius, padding + bgHeight);
        bgCtx.lineTo(padding + radius, padding + bgHeight);
        bgCtx.quadraticCurveTo(padding, padding + bgHeight, padding, padding + bgHeight - radius);
        bgCtx.lineTo(padding, padding + radius);
        bgCtx.quadraticCurveTo(padding, padding, padding + radius, padding);
        bgCtx.fill();

        const bgTexture = new THREE.CanvasTexture(bgCanvas);
        const bgGeometry = new THREE.PlaneGeometry(bgWidth, bgHeight);
        const bgMaterial = new THREE.MeshBasicMaterial({ map: bgTexture, transparent: true });
        const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
        bgMesh.position.set(kingdom.map_x + 10 + bgWidth / 2, -kingdom.map_y, 23);
        scene.add(bgMesh);

        // Kingdom name text
        const nameCanvas = document.createElement('canvas');
        nameCanvas.width = actualTextWidth + 20;
        nameCanvas.height = 80;
        const nameCtx = nameCanvas.getContext('2d');
        nameCtx.font = 'bold 64px Arial';
        nameCtx.fillStyle = '#ffffff';
        nameCtx.textBaseline = 'middle';
        nameCtx.fillText(kingdom.name || 'Kingdom', 10, 40);

        const nameTexture = new THREE.CanvasTexture(nameCanvas);
        const nameGeometry = new THREE.PlaneGeometry(actualTextWidth, 64);
        const nameMaterial = new THREE.MeshBasicMaterial({ map: nameTexture, transparent: true });
        const nameMesh = new THREE.Mesh(nameGeometry, nameMaterial);
        nameMesh.position.set(kingdom.map_x + 10 + iconSize + padding + actualTextWidth / 2, -kingdom.map_y, 24);
        scene.add(nameMesh);
      });

      const mapWidth = hexGrid.W;
      const mapHeight = hexGrid.H;
      const frustumWidth = mapWidth + 100;
      const frustumHeight = mapHeight + 100;

      const orthoCamera = new THREE.OrthographicCamera(
        -frustumWidth / 2, frustumWidth / 2,
        frustumHeight / 2, -frustumHeight / 2,
        0.1, 10000
      );

      const centerX = mapWidth / 2;
      const centerY = -mapHeight / 2;

      orthoCamera.position.set(centerX, centerY, 500);
      orthoCamera.lookAt(centerX, centerY, 0);
      orthoCamera.updateProjectionMatrix();

      cameraRef.current = orthoCamera;

      let rotation = 0;
      let pitch = 0;
      const mapCenter = new THREE.Vector3(centerX, centerY, 0);
      const cameraDistance = 550;
      const maxPitch = (2 * Math.PI) / 3;
      const maxRotation = (2 * Math.PI) / 3;

      const updateCameraRotation = () => {
        const horizontalDist = cameraDistance * Math.cos(pitch);
        const x = mapCenter.x + Math.sin(rotation) * horizontalDist;
        const y = centerY + Math.sin(pitch) * cameraDistance;
        const z = mapCenter.z + Math.cos(rotation) * horizontalDist;
        orthoCamera.position.set(x, y, z);
        orthoCamera.lookAt(mapCenter);
      };

      const onKeyDown = (e) => {
        const pitchSpeed = 0.02;
        if (e.key === 'ArrowUp') {
          pitch = Math.min(pitch + pitchSpeed, maxPitch);
          updateCameraRotation();
          e.preventDefault();
        } else if (e.key === 'ArrowDown') {
          pitch = Math.max(pitch - pitchSpeed, -maxPitch);
          updateCameraRotation();
          e.preventDefault();
        }
      };

      window.addEventListener('keydown', onKeyDown);

      let frame = 0;
      const animate = () => {
        requestAnimationFrame(animate);
        frame++;
        renderer.render(scene, orthoCamera);
      };
      animate();

      const handleResize = () => {
        const newW = containerRef.current.clientWidth;
        const newH = containerRef.current.clientHeight;
        renderer.setSize(newW, newH);
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('keydown', onKeyDown);
        if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
          containerRef.current.removeChild(renderer.domElement);
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
