import * as THREE from 'three';
import { TERRAIN_COLORS } from './terrainUtils.js';

/**
 * The real, current 3D symbols placed on terrain hexes on the world map.
 * Single source of truth — WorldmapWebGL.jsx (the actual map) and the
 * Terrain Types legend preview both import from here, so the legend can
 * never silently drift out of sync with what the map really shows again.
 */

export function createForestSymbol() {
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
}

export function createMountainSymbol() {
  const group = new THREE.Group();
  const mountainGrey = new THREE.Color('#777777');

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
}

export function createHillsSymbol() {
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
}

export function createDesertSymbol() {
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
}

export function createPlainsSymbol() {
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
}

export function createSwampSymbol() {
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
}

export function createVolcanicSymbol() {
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
}

const SYMBOL_CREATORS = {
  forest: createForestSymbol,
  mountains: createMountainSymbol,
  hills: createHillsSymbol,
  desert: createDesertSymbol,
  plains: createPlainsSymbol,
  volcanic: createVolcanicSymbol,
  swamp: createSwampSymbol,
};

/** Terrain types with a real 3D symbol on the map. Coast/tundra are flat, undecorated hexes. */
export const SYMBOL_TERRAIN_TYPES = Object.keys(SYMBOL_CREATORS);

export function createSymbolForTerrain(terrainType) {
  const creator = SYMBOL_CREATORS[terrainType];
  return creator ? creator() : null;
}
