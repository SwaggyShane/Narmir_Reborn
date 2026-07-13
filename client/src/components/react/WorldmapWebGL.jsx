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
          const darkGreen = new THREE.Color(TERRAIN_COLORS[cell.terrain] || '#2d4a2d');

          // Main dark green cone body
          const bodyGeo = new THREE.ConeGeometry(12.5, 20, 12);
          const bodyMat = new THREE.MeshPhongMaterial({
            color: darkGreen,
            shininess: 20
          });
          const body = new THREE.Mesh(bodyGeo, bodyMat);
          body.position.z = 12.5; // Offset so base sits at group origin
          body.rotation.x = Math.PI / 2;
          group.add(body);

          // Small white tip cone
          const tipGeo = new THREE.ConeGeometry(2.5, 5, 8);
          const tipMat = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            shininess: 20
          });
          const tip = new THREE.Mesh(tipGeo, tipMat);
          tip.position.z = 12.5 + 10; // Position on top of body
          tip.rotation.x = Math.PI / 2;
          group.add(tip);
        } else if (cell.terrain === 'mountains') {
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

          // White sphere for central cap - center at top plane of cylinder
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

            // Truncated cone: flat top at radius 3.5, flat bottom at radius 9.38
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

            // White sphere - center aligned with cylinder top plane
            const capGeo = new THREE.SphereGeometry(topRadius, 16, 16);
            const capMat = new THREE.MeshPhongMaterial({
              color: 0xffffff,
              shininess: 25
            });
            const cap = new THREE.Mesh(capGeo, capMat);
            // Position sphere center at cylinder top plane (z = 50)
            cap.position.set(x, y, 25 + 25);
            cap.rotation.y = Math.PI / 4; // 45 degrees
            group.add(cap);
          });
        } else if (cell.terrain === 'hills') {
          const hillColor = new THREE.Color(TERRAIN_COLORS[cell.terrain] || '#6b5b3f');

          // Standard sphere sizes for all hills
          const smallRadius = 4.5;
          const mediumRadius = 6.5;
          const largeRadius = 8;

          // Large sphere midline at hex top plane
          const largeGeo = new THREE.SphereGeometry(largeRadius, 16, 16);
          const largeMat = new THREE.MeshPhongMaterial({
            color: hillColor,
            shininess: 15
          });
          const largeSphere = new THREE.Mesh(largeGeo, largeMat);
          largeSphere.position.set(0, 0, 0);
          group.add(largeSphere);

          // Medium sphere on positive y side, midline at large sphere's y-midline
          const mediumGeo = new THREE.SphereGeometry(mediumRadius, 16, 16);
          const mediumMat = new THREE.MeshPhongMaterial({
            color: new THREE.Color(hillColor).multiplyScalar(1.15),
            shininess: 15
          });
          const mediumSphere = new THREE.Mesh(mediumGeo, mediumMat);
          mediumSphere.position.set(0, largeRadius + mediumRadius - 19.25 - 0.75, 0);
          group.add(mediumSphere);

          // Small sphere positioned separately
          const smallGeo = new THREE.SphereGeometry(smallRadius, 16, 16);
          const smallMat = new THREE.MeshPhongMaterial({
            color: new THREE.Color(hillColor).multiplyScalar(1.3),
            shininess: 20
          });
          const smallSphere = new THREE.Mesh(smallGeo, smallMat);
          smallSphere.position.set(-7.5, -5, 0);
          group.add(smallSphere);
        }

        return group;
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
        const activeCamera = cameraState.inPerspective ? perspCamera : orthoCamera;
        renderer.render(scene, activeCamera);
      };
      animate();

      const handleResize = () => {
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
