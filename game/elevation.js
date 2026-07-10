/**
 * Elevation System - Phase 1
 * Generates deterministic elevation data for world hexes using seeded Simplex noise.
 * Biome-aware normalization ensures elevation bands match terrain types.
 */

const { buildPermutationTable, createNoise2D } = require('simplex-noise');

const ELEVATION_BANDS = {
  ocean: [0, 0],
  coast: [1, 30],
  plains: [31, 90],
  hills: [91, 149],
  mountains: [150, 255],
};

/**
 * Seeded PRNG: linear congruential generator for deterministic noise
 */
function seededRandom(seed) {
  const m = 2 ** 31 - 1;
  let s = (seed % m) || 1;
  return () => {
    s = (s * 16807) % m;
    return (s - 1) / (m - 1);
  };
}

/**
 * Map noise value (0-1) to elevation band based on terrain type
 */
function correlateTerrainElevation(terrain, noise01) {
  switch (terrain) {
    case 'ocean':
      return 0.0;
    case 'coast':
      return noise01 * 0.12;
    case 'plains':
      return 0.12 + (noise01 * 0.31);
    case 'hills':
      return 0.43 + (noise01 * 0.31);
    case 'mountains':
      return 0.58 + (noise01 * 0.42);
    default:
      return noise01;
  }
}

/**
 * Generate elevation grid using FBM (Fractional Brownian Motion) noise.
 * Seeded for deterministic reproducibility.
 */
function generateElevationGrid(worldSeed, hexGrid) {
  if (!hexGrid || hexGrid.cells.length === 0) {
    return {};
  }

  const permTable = buildPermutationTable(seededRandom(worldSeed));
  const noise = createNoise2D(seededRandom(worldSeed), permTable);

  const elevationMap = {};
  const OCTAVES = 4;
  const BASE_SCALE = 0.01;
  const AMPLITUDE_DECAY = 0.5;
  const LACUNARITY = 2.0;

  hexGrid.cells.forEach((hex) => {
    let elevation = 0;
    let amplitude = 1.0;
    let frequency = BASE_SCALE;
    let maxValue = 0;

    // Multi-octave FBM
    for (let i = 0; i < OCTAVES; i++) {
      const x = hex.col * frequency;
      const y = hex.row * frequency;
      const value = noise(x, y);

      elevation += value * amplitude;
      maxValue += amplitude;

      amplitude *= AMPLITUDE_DECAY;
      frequency *= LACUNARITY;
    }

    // Normalize to 0-1
    elevation = (elevation / maxValue + 1) / 2;

    // Biome-aware correlation
    const terrainBand = correlateTerrainElevation(hex.terrain, elevation);

    // Store as 0-255
    const hexId = `${hex.col},${hex.row}`;
    elevationMap[hexId] = Math.round(terrainBand * 255);
  });

  return elevationMap;
}

/**
 * Get elevation for a specific hex
 */
function getElevation(elevationMap, col, row) {
  if (!elevationMap) return 0;
  const hexId = `${col},${row}`;
  return elevationMap[hexId] || 0;
}

/**
 * Validate elevation band consistency with terrain
 */
function validateElevationBands(elevationMap, hexGrid) {
  const errors = [];
  const bandDistribution = {};

  hexGrid.cells.forEach((hex) => {
    const hexId = `${hex.col},${hex.row}`;
    const elev = elevationMap[hexId];

    if (elev === undefined || elev === null) {
      errors.push(`Hex ${hexId} missing elevation`);
      return;
    }

    if (elev < 0 || elev > 255) {
      errors.push(`Hex ${hexId} elevation ${elev} out of range [0,255]`);
      return;
    }

    // Check terrain correlation
    const band = Object.entries(ELEVATION_BANDS).find(
      ([_, range]) => elev >= range[0] && elev <= range[1]
    )?.[0];

    if (band && band !== hex.terrain && !(band === 'ocean' && hex.terrain === 'ocean')) {
      // Ocean is always 0, but other terrains should match
      if (hex.terrain !== 'ocean' && band !== 'ocean') {
        errors.push(`Hex ${hexId} terrain ${hex.terrain} doesn't match elevation band ${band}`);
      }
    }

    bandDistribution[band || 'unknown'] = (bandDistribution[band || 'unknown'] || 0) + 1;
  });

  return { valid: errors.length === 0, errors, distribution: bandDistribution };
}

module.exports = {
  generateElevationGrid,
  getElevation,
  validateElevationBands
};
