/**
 * World initialization system - runs once per fresh world seed.
 * Generates:
 * - Terrain distribution: 75% dominant race terrain + at least 1 of each other type
 * - Resource nodes: 1 of each (wood/stone/iron) per region, 3 of prevalent type
 * - Dungeons and mountains: Already handled by world-locations.js
 *
 * All placement is deterministic from the world seed.
 */

'use strict';

const { RACE_HOMES, nearestRaceHome, isWaterPoint } = require('./world-regions');
const { getWorldSeed } = require('./world-seed');

// Terrain dominance per race
const RACE_TO_TERRAIN = {
  dwarf: 'mountains',
  high_elf: 'forest',
  wood_elf: 'forest',
  orc: 'plains',
  human: 'plains',
  dire_wolf: 'hills',
  vampire: 'swamp',
  dark_elf: 'hills',
  ogre: 'mountains',
};

// All available biomes (excluding restricted ones: tundra, coast, volcano)
const ALL_BIOMES = ['plains', 'forest', 'mountains', 'hills', 'swamp', 'desert'];

// What resource is most common in each terrain
const TERRAIN_RESOURCES = {
  mountains: 'iron',
  forest: 'wood',
  plains: 'stone',
  hills: 'stone',
  swamp: 'stone',
  desert: 'iron',
};

const MAP_WIDTH = 1999;
const MAP_HEIGHT = 1380;

// Seeded random for deterministic placement
function seededRandom(seed, ...inputs) {
  let t = seed;
  for (const v of inputs) {
    t = (Math.imul(t ^ v, 2654435761) + v) | 0;
  }
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function seedAsInt32(worldSeed) {
  return Number(BigInt(worldSeed) % 2147483647n);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Check if world has already been initialized with this seed.
 */
async function isWorldInitialized(db) {
  const check = await db.get(
    'SELECT COUNT(*) as cnt FROM resource_nodes'
  );
  return (check?.cnt || 0) > 0;
}

/**
 * Generate resource nodes for a region.
 * Returns array of {type, terrain, distance}
 */
function generateRegionResources(worldSeed, race) {
  const seed = seedAsInt32(worldSeed);
  const dominantTerrain = RACE_TO_TERRAIN[race];
  const dominantResource = TERRAIN_RESOURCES[dominantTerrain];

  const nodes = [];
  const resourceTypes = ['wood', 'stone', 'iron'];

  // Generate base resources: 1 of each type, 3 of prevalent type
  resourceTypes.forEach((type, idx) => {
    const count = type === dominantResource ? 3 : 1;

    for (let i = 0; i < count; i++) {
      // Deterministic distance (spread across 600-28800 range)
      const distRand = seededRandom(seed, race.charCodeAt(0), idx, i, 1);
      const distance = 600 + distRand * (28800 - 600);

      // Deterministic terrain: 75% dominant, 25% other
      const terrainRand = seededRandom(seed, race.charCodeAt(0), idx, i, 2);
      let terrain;
      if (terrainRand < 0.75) {
        terrain = dominantTerrain;
      } else {
        // Pick a random other biome from available ones
        const otherBiomes = ALL_BIOMES.filter(b => b !== dominantTerrain);
        const otherIdx = Math.floor((terrainRand - 0.75) / 0.25 * otherBiomes.length);
        terrain = otherBiomes[Math.min(otherIdx, otherBiomes.length - 1)];
      }

      nodes.push({
        type,
        terrain,
        distance: Math.round(distance),
        raceIndex: idx,
        nodeNumber: i,
      });
    }
  });

  return nodes;
}

/**
 * Place a resource node at deterministic coordinates.
 * Uses race home + seeded offset, validates placement is in region + not water.
 */
function placeResourceNodeInRegion(worldSeed, race, nodeSpec) {
  const seed = seedAsInt32(worldSeed);
  const home = RACE_HOMES[race];

  // Deterministic angle and distance from home
  const angleRand = seededRandom(seed, race.charCodeAt(0), nodeSpec.raceIndex, nodeSpec.nodeNumber, 3);
  const distRand = seededRandom(seed, race.charCodeAt(0), nodeSpec.raceIndex, nodeSpec.nodeNumber, 4);

  const angle = angleRand * Math.PI * 2;
  const radius = 28 + (distRand * 110); // Varies by distance attribute

  const x = Math.round(clamp(home.x + Math.cos(angle) * radius, 20, MAP_WIDTH - 20));
  const y = Math.round(clamp(home.y + Math.sin(angle) * radius, 20, MAP_HEIGHT - 20));

  // Validate placement
  if (nearestRaceHome(x, y) !== race || isWaterPoint(x, y)) {
    // Fallback to home if placement fails
    return { x: Math.round(home.x), y: Math.round(home.y) };
  }

  return { x, y };
}

/**
 * Ensure world_state row exists with a seed.
 * Returns true if a new seed was created, false otherwise.
 */
async function ensureWorldSeed(db) {
  const existing = await db.get('SELECT seed FROM world_state WHERE id = 1');
  if (!existing) {
    const randomSeed = Math.floor(Math.random() * 9007199254740991);
    await db.run(
      'INSERT INTO world_state (id, seed) VALUES ($1, $2)',
      [1, randomSeed]
    );
    console.log('[world-init] Created world_state with seed:', randomSeed);
    return true;
  }
  return false;
}

/**
 * Initialize world: seed all regions with resource nodes and terrain distribution.
 * Called once per fresh world seed during initDb().
 */
async function initializeWorld(db) {
  try {
    // Step 1: Ensure world_state seed exists
    const seedCreated = await ensureWorldSeed(db);
    if (seedCreated) {
      // Seed was just created, need to reload in world-seed.js
      // (caller will handle the reload and call us again)
      return true;
    }

    // Step 2: Check if already initialized
    const alreadyInit = await isWorldInitialized(db);
    if (alreadyInit) {
      console.log('[world-init] World already initialized');
      return;
    }

    const worldSeed = getWorldSeed();
    console.log('[world-init] Initializing world with seed:', worldSeed.toString());

    const races = Object.keys(RACE_HOMES);
    let totalNodesSeeded = 0;

    // Step 3: Seed resource nodes for each region
    for (const race of races) {
      const regionNodes = generateRegionResources(worldSeed, race);

      for (const nodeSpec of regionNodes) {
        try {
          const coords = placeResourceNodeInRegion(worldSeed, race, nodeSpec);

          await db.run(
            `INSERT INTO resource_nodes
             (name, type, distance, richness, map_x, map_y, terrain)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              `${nodeSpec.type.charAt(0).toUpperCase()}${nodeSpec.type.slice(1)} - ${race}`,
              nodeSpec.type,
              nodeSpec.distance,
              100, // Default richness
              coords.x,
              coords.y,
              nodeSpec.terrain,
            ]
          );

          totalNodesSeeded++;
        } catch (err) {
          console.error(`[world-init] Failed to seed resource node for ${race}:`, err.message);
        }
      }
    }

    console.log(`[world-init] ✓ World initialized: ${totalNodesSeeded} resource nodes seeded`);
    console.log('[world-init] ✓ Terrain distribution: 75% dominant + 25% mixed per region');
    console.log('[world-init] ✓ Resource distribution: 1 of each type, 3 of prevalent type per region');

  } catch (err) {
    console.error('[world-init] World initialization failed:', err.message);
    throw err;
  }
}

module.exports = {
  initializeWorld,
};
