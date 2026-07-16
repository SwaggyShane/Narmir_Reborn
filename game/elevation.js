/**
 * Elevation System - Phase 1
 * Generates deterministic elevation data for world hexes using seeded Simplex noise.
 * Biome-aware normalization ensures elevation bands match terrain types.
 */

const { buildPermutationTable, createNoise2D } = require('simplex-noise');

// Original 5 bands (ocean/coast/plains/hills/mountains) only ever covered
// the 5 terrain types envisioned in the initial elevation plan. Once
// wired to the real terrain grid (game/world-hex-grid.js, 2026-07-15),
// hexes come back as one of 9 types (also tundra/desert/volcanic/forest/
// swamp/lake) — mapped here onto the closest existing band rather than
// inventing new numeric ranges: lake/swamp are low-lying water-adjacent
// terrain (grouped with ocean/coast), tundra/desert/forest are flat land
// (grouped with plains), volcanic is high ground (grouped with mountains).
const ELEVATION_BANDS = {
  ocean: [0, 0],
  lake: [0, 0],
  coast: [1, 30],
  swamp: [1, 30],
  plains: [31, 90],
  tundra: [31, 90],
  desert: [31, 90],
  forest: [31, 90],
  hills: [91, 149],
  mountains: [150, 255],
  volcanic: [150, 255],
};

/**
 * Seeded PRNG: linear congruential generator for deterministic noise
 */
function seededRandom(seed) {
  const m = 2 ** 31 - 1;
  // world_state.seed is a BIGINT column; node-pg returns it as a string, so
  // real callers (ensureWorldElevation -> generateElevationGrid(worldState.seed, ...))
  // are fine as-is, but normalize BigInt defensively too so a caller passing
  // game/world-seed.js's getWorldSeed() (a BigInt) directly doesn't throw
  // ("Cannot mix BigInt and other types") on the modulo below.
  const seedNum = typeof seed === 'bigint' ? Number(seed % 2147483647n) : seed;
  let s = (seedNum % m) || 1;
  return () => {
    s = (s * 16807) % m;
    return (s - 1) / (m - 1);
  };
}

/**
 * Map noise value (0-1) to a 0-255 elevation, scaled to land exactly inside
 * the hex's terrain's declared ELEVATION_BANDS range. Derived directly from
 * ELEVATION_BANDS (rather than separately-hardcoded fraction constants) so
 * the two can never drift apart again — the original hardcoded formula's
 * output range didn't actually match its own declared bands (e.g. hills'
 * old formula could reach 189, well past its declared [91,149] max), which
 * validateElevationBands had no way to catch until it was ever run against
 * real generated data.
 */
function correlateTerrainElevation(terrain, noise01) {
  const range = ELEVATION_BANDS[terrain];
  if (!range) return noise01; // unknown terrain: caller expects a 0-1 fraction
  const [min, max] = range;
  return (min + noise01 * (max - min)) / 255;
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

    // Check the hex's elevation against its OWN terrain's band directly —
    // several terrain types now intentionally share a numeric band (e.g.
    // plains/tundra/desert/forest all map to [31,90]), so reverse-searching
    // ELEVATION_BANDS for "the first range that contains this elevation"
    // and comparing that entry's name to hex.terrain would flag every hex
    // whose terrain isn't alphabetically/insertion-order first among its
    // band-mates as a false mismatch.
    const ownRange = ELEVATION_BANDS[hex.terrain];
    if (ownRange && (elev < ownRange[0] || elev > ownRange[1])) {
      errors.push(`Hex ${hexId} terrain ${hex.terrain} elevation ${elev} outside its band [${ownRange[0]},${ownRange[1]}]`);
    }

    bandDistribution[hex.terrain || 'unknown'] = (bandDistribution[hex.terrain || 'unknown'] || 0) + 1;
  });

  return { valid: errors.length === 0, errors, distribution: bandDistribution };
}

module.exports = {
  generateElevationGrid,
  getElevation,
  validateElevationBands
};
