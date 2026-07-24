/**
 * World initialization system - runs once per fresh world seed.
 * Generates:
 * - Terrain distribution: 75% dominant race terrain + at least 1 of each other type
 * - Resource nodes: 6 per region — 1 of each (wood/stone/iron) baseline,
 *   +3 extra for the dominant type (4 dominant + 1 + 1)
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

// Mixed biomes placed inside race regions (climate bands tundra/ocean/volcanic
// are still applied by latitude in world-hex-grid.js; volcanic is also allowed
// as a rare interior patch for resource-node terrain variety).
const ALL_BIOMES = ['plains', 'forest', 'mountains', 'hills', 'swamp', 'desert', 'volcanic'];

// What resource is most common in each terrain
const TERRAIN_RESOURCES = {
  mountains: 'iron',
  forest: 'wood',
  plains: 'stone',
  hills: 'stone',
  swamp: 'stone',
  desert: 'iron',
  volcanic: 'iron',
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
 * Check if the per-region resource node distribution has already run.
 *
 * Deliberately NOT "does resource_nodes have any rows" — game/
 * first-ring-node.js inserts one row (a random-type node, independent of
 * region) per kingdom at creation time, so that check tripped permanently
 * on the very first kingdom ever created and the real regional
 * distribution below never ran, for any region, ever. world_state.
 * regions_seeded is a dedicated flag set only by seedRegionResourceNodes.
 */
async function isWorldInitialized(db) {
  const row = await db.get('SELECT regions_seeded FROM world_state WHERE id = 1');
  return !!row?.regions_seeded;
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

  // 1 of each type as a baseline, +3 extra for the dominant type (4 total
  // dominant + 1 + 1 = 6 nodes per region).
  resourceTypes.forEach((type, idx) => {
    const count = type === dominantResource ? 4 : 1;

    for (let i = 0; i < count; i++) {
      // Deterministic distance (spread across 600-28800 range)
      const distRand = seededRandom(seed, race.charCodeAt(0), idx, i, 1);
      const distance = 600 + distRand * (28800 - 600);

      // Deterministic richness (25-100 range, not a flat value — so nodes
      // actually vary in how worthwhile they are to harvest)
      const richnessRand = seededRandom(seed, race.charCodeAt(0), idx, i, 5);
      const richness = Math.round(25 + richnessRand * (100 - 25));

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
        richness,
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
      return;
    }

    const worldSeed = getWorldSeed();

    const races = Object.keys(RACE_HOMES);

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
              nodeSpec.richness,
              coords.x,
              coords.y,
              nodeSpec.terrain,
            ]
          );
        } catch (err) {
          console.error(`[world-init] Failed to seed resource node for ${race}:`, err.message);
        }
      }
    }

    await db.run('UPDATE world_state SET regions_seeded = TRUE WHERE id = 1');
    console.log('[world-init] Regional resource node distribution seeded for all regions');

  } catch (err) {
    console.error('[world-init] World initialization failed:', err.message);
    throw err;
  }
}

module.exports = {
  initializeWorld,
};
