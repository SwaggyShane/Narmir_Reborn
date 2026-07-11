import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { REGION_META, REGION_BONUSES } from '../../utils/raceData.js';
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

// Convert hex color to THREE.Color
function hexToColor(hex) {
  return new THREE.Color(hex);
}

// Create a hex prism geometry with elevation
function createHexPrism(x, y, elevation = 0) {
  const geometry = new THREE.ConeGeometry(HEX_SIZE, Math.max(0.5, elevation / 100), 6);

  // Position at x, y with height based on elevation
  const mesh = new THREE.Mesh(geometry);
  mesh.position.set(x, y, elevation / 100);
  mesh.rotation.z = Math.PI / 2;

  return mesh;
}

export default function WorldmapWebGL({ hexGrid = null, elevationData = null, highlightedRace = null }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !hexGrid) {
      console.log('[WebGL] Missing container or hexGrid', { container: !!containerRef.current, hexGrid: !!hexGrid });
      return;
    }

    console.log('[WebGL] Starting render with hexGrid:', { cells: hexGrid.cells?.length, W: hexGrid.W, H: hexGrid.H });

    // Wait for container to have dimensions
    const checkAndRender = () => {
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      console.log('[WebGL] Container size:', { w, h });

      if (w === 0 || h === 0) {
        console.log('[WebGL] Waiting for layout...');
        requestAnimationFrame(checkAndRender);
        return;
      }

      // NOW we can initialize
      initializeWebGL(w, h);
    };

    const initializeWebGL = (w, h) => {
      // Scene setup
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x040710);
      scene.fog = new THREE.Fog(0x040710, 5000, 10000);
      sceneRef.current = scene;

      const centerX = hexGrid.W / 2;
      const centerY = hexGrid.H / 2;
      const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 20000);
      camera.position.set(centerX, centerY - 400, 1200);
      camera.lookAt(centerX, centerY, 0);
      console.log('[WebGL] Camera position:', { x: camera.position.x, y: camera.position.y, z: camera.position.z, centerX, centerY });
      cameraRef.current = camera;

      // Renderer setup
      console.log('[WebGL] Creating renderer...');
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, logarithmicDepthBuffer: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      console.log('[WebGL] Renderer created, adding to DOM...');
      containerRef.current.appendChild(renderer.domElement);
      console.log('[WebGL] Renderer added to DOM');
      rendererRef.current = renderer;

      // Lighting - key for visibility
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
      directionalLight.position.set(centerX + 500, centerY + 500, 1500);
      directionalLight.target.position.set(centerX, centerY, 0);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 4096;
      directionalLight.shadow.mapSize.height = 4096;
      directionalLight.shadow.camera.far = 3000;
      scene.add(directionalLight);
      scene.add(directionalLight.target);

      // Add hemisphere light for better ambient
      const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x000000, 0.6);
      scene.add(hemiLight);

      // Build hex meshes from hexGrid - use BoxGeometry for visibility
      let meshCount = 0;
      hexGrid.cells.forEach((cell) => {
        const color = TERRAIN_COLORS[cell.terrain] || TERRAIN_COLORS.plains;
        const elevation = elevationData && elevationData[`${cell.col},${cell.row}`] || 50;

        const material = new THREE.MeshPhongMaterial({
          color: hexToColor(color),
          shininess: 30,
          side: THREE.DoubleSide,
        });

        // Use simple box geometry for now (easier to see)
        const geometry = new THREE.BoxGeometry(HEX_SIZE * 0.8, HEX_SIZE * 0.8, Math.max(1, elevation / 150));
        const mesh = new THREE.Mesh(geometry, material);

        mesh.position.set(cell.x, cell.y, Math.max(1, elevation / 150) / 2);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        mesh.userData = { ...cell };
        scene.add(mesh);
        meshCount++;
      });
      console.log('[WebGL] Created', meshCount, 'meshes');

      // Add a test sphere to verify rendering works
      const testGeom = new THREE.SphereGeometry(100, 32, 32);
      const testMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const testSphere = new THREE.Mesh(testGeom, testMat);
      testSphere.position.set(centerX, centerY, 500);
      scene.add(testSphere);
      console.log('[WebGL] Added test sphere at', { x: centerX, y: centerY, z: 500 });

      // Animation loop with slight camera rotation for 3D effect
      let frame = 0;
      console.log('[WebGL] Starting animation loop');
      const animate = () => {
        requestAnimationFrame(animate);

        // Subtle camera rotation for depth perception
        const angle = (frame * 0.0002) % (Math.PI * 2);
        camera.position.x = centerX + Math.cos(angle) * 800;
        camera.position.z = 1200 + Math.sin(angle) * 300;
        camera.lookAt(centerX, centerY, 200);

        if (frame === 0) {
          console.log('[WebGL] First render frame - camera at', { x: camera.position.x, y: camera.position.y, z: camera.position.z });
        }
        frame++;
        renderer.render(scene, camera);
      };
      animate();

      // Handle resize
      const handleResize = () => {
        const newW = containerRef.current.clientWidth;
        const newH = containerRef.current.clientHeight;
        camera.aspect = newW / newH;
        camera.updateProjectionMatrix();
        renderer.setSize(newW, newH);
      };
      window.addEventListener('resize', handleResize);

      // Cleanup
      return () => {
        window.removeEventListener('resize', handleResize);
        if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
          containerRef.current.removeChild(renderer.domElement);
        }
        renderer.dispose();
      };
    };

    // Start the rendering process
    checkAndRender();

    // Return cleanup (though we're async now)
    return () => {};
  }, [hexGrid, elevationData]);

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
