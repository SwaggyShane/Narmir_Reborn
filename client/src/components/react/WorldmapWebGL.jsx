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
    if (!containerRef.current || !hexGrid) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040710);
    sceneRef.current = scene;

    // Camera setup
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 10000);
    camera.position.set(1000, 700, 1500);
    camera.lookAt(1000, 700, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(500, 700, 1000);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Build hex meshes from hexGrid
    hexGrid.cells.forEach((cell) => {
      const color = TERRAIN_COLORS[cell.terrain] || TERRAIN_COLORS.plains;
      const elevation = elevationData && elevationData[`${cell.col},${cell.row}`] || 50;

      const material = new THREE.MeshStandardMaterial({
        color: hexToColor(color),
        roughness: 0.7,
        metalness: 0.1,
      });

      const geometry = new THREE.ConeGeometry(HEX_SIZE * 0.9, Math.max(0.5, elevation / 80), 6);
      const mesh = new THREE.Mesh(geometry, material);

      mesh.position.set(cell.x, cell.y, elevation / 80);
      mesh.rotation.z = Math.PI / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      mesh.userData = { ...cell };
      scene.add(mesh);
    });

    // Add region borders as wireframe lines
    if (hexGrid.borderSegments) {
      hexGrid.borderSegments.forEach((seg) => {
        const points = [
          new THREE.Vector3(seg.p1[0], seg.p1[1], 5),
          new THREE.Vector3(seg.p2[0], seg.p2[1], 5),
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const meta = REGION_META[seg.race] || {};
        const material = new THREE.LineBasicMaterial({
          color: hexToColor(meta.stroke || '#fff'),
          linewidth: 2,
          transparent: true,
          opacity: 0.8,
        });
        const line = new THREE.Line(geometry, material);
        scene.add(line);
      });
    }

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
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
