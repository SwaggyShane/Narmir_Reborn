/**
 * World locations (dungeons, mountains) seeding and discovery tracking.
 * Locations are seeded deterministically per region at server boot.
 * One dungeon and one mountain per region (9 regions total = 18 locations).
 */

'use strict';

const { isWaterPoint, RACE_HOMES } = require('./world-regions');

// In-memory cache of all world locations
let locationCache = {};

/**
 * Deterministic seeded random for location placement.
 * Uses world seed + region name to generate reproducible coordinates.
 * @param {string} worldSeed - Server world seed
 * @param {string} regionName - Region/race name
 * @param {string} locationType - 'dungeon' or 'mountain'
 * @param {number} retryIteration - Retry count (0-10) for collision avoidance
 * @returns {number} Pseudo-random value [0, 1)
 */
function seededRandom(worldSeed, regionName, locationType, retryIteration = 0) {
  const combined = `${worldSeed}-${regionName}-${locationType}-${retryIteration}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const pseudo = Math.sin(hash) * 10000;
  return pseudo - Math.floor(pseudo);
}

/**
 * Generate reproducible coordinates for a location within a region.
 * Ensures coordinates are within region bounds and not in water.
 * @param {string} worldSeed - Server world seed
 * @param {string} regionName - Region/race name
 * @param {string} locationType - 'dungeon' or 'mountain'
 * @param {number} maxRetries - Max attempts to find valid location (default 10)
 * @returns {object|null} {x, y} or null if unable to generate valid location
 */
// Full width of the offsetX/offsetY random range below (i.e. each axis
// lands in [-LOCATION_OFFSET_RANGE/2, LOCATION_OFFSET_RANGE/2)). Kept as a
// named constant, rather than inlined, so MAX_LOCATION_OFFSET_FROM_HOME
// (used by seedRegionLocations' staleness check) can never drift out of
// sync with the actual formula it's validating against.
const LOCATION_OFFSET_RANGE = 500;
// Furthest a correctly-seeded location can ever land from its region's
// home (diagonal of the offset square) — anything farther means it was
// seeded against a RACE_HOMES value that has since changed underneath it.
const MAX_LOCATION_OFFSET_FROM_HOME = (LOCATION_OFFSET_RANGE / 2) * Math.SQRT2;

function getRegionLocationCoords(worldSeed, regionName, locationType, maxRetries = 10) {
  const home = RACE_HOMES[regionName];
  if (!home) return null;

  // Generate coordinates around region home with seeded randomness
  // Each retry uses a different seed iteration
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const rand1 = seededRandom(worldSeed, regionName, locationType, attempt * 2);
    const rand2 = seededRandom(worldSeed, regionName, locationType, attempt * 2 + 1);

    const offsetX = (rand1 - 0.5) * LOCATION_OFFSET_RANGE;
    const offsetY = (rand2 - 0.5) * LOCATION_OFFSET_RANGE;
    const x = Math.max(0, Math.min(1999, home.x + offsetX));
    const y = Math.max(0, Math.min(1379, home.y + offsetY));

    // Validate: not in water, within bounds
    if (!isWaterPoint(x, y) && x >= 0 && x <= 1999 && y >= 0 && y <= 1379) {
      return { x, y };
    }
  }

  // Fallback: couldn't find valid spot, return home hex center
  return home;
}

/**
 * Load all world locations from database into memory cache.
 * Called at server boot after database initialization.
 * @param {object} db - Database connection
 * @returns {Promise<object>} Cache of locations by region: {regionName: {dungeon: {...}, mountain: {...}}}
 */
async function loadLocationCache(db) {
  try {
    const locations = await db.all('SELECT * FROM world_locations ORDER BY region_name, type');
    locationCache = {};

    for (const loc of locations) {
      if (!locationCache[loc.region_name]) {
        locationCache[loc.region_name] = {};
      }
      locationCache[loc.region_name][loc.type] = loc;
    }

    return locationCache;
  } catch (err) {
    console.error('[world-locations] Failed to load location cache:', err.message);
    return {};
  }
}

/**
 * Ensure all region locations are seeded at server boot.
 * For each region and location type, creates entry if missing.
 * Uses deterministic seeding so same world_seed produces same locations.
 * @param {object} db - Database connection
 * @param {string} worldSeed - Server world seed (from server_state)
 * @returns {Promise<void>}
 */
async function seedRegionLocations(db, worldSeed) {
  if (!worldSeed) {
    console.error('[world-locations] No world seed available, skipping location seeding');
    return;
  }

  const regionNames = Object.keys(RACE_HOMES);
  const locationTypes = ['dungeon', 'mountain'];

  for (const region of regionNames) {
    for (const type of locationTypes) {
      try {
        let existing = await db.get(
          'SELECT id, x, y FROM world_locations WHERE region_name = $1 AND type = $2',
          [region, type],
        );

        // Self-heal: a location can only be this far from its OWN region's
        // home if it was seeded against a RACE_HOMES value that has since
        // changed (this exact drift happened once already — 2026-07-20,
        // 14 of 18 locations ended up stranded near stale home positions
        // after a world-map rework moved RACE_HOMES). Wipe and re-seed
        // rather than leaving it silently wrong.
        if (existing) {
          const home = RACE_HOMES[region];
          const dx = Number(existing.x) - home.x;
          const dy = Number(existing.y) - home.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > MAX_LOCATION_OFFSET_FROM_HOME) {
            console.warn(
              `[world-locations] ${type} for ${region} is ${dist.toFixed(0)}px from its home ` +
              `(max possible ${MAX_LOCATION_OFFSET_FROM_HOME.toFixed(0)}px) — RACE_HOMES changed ` +
              `since this was seeded; re-seeding.`,
            );
            await db.run('DELETE FROM world_locations WHERE id = $1', [existing.id]);
            existing = null;
          }
        }

        if (!existing) {
          // Generate deterministic coordinates
          const coords = getRegionLocationCoords(worldSeed, region, type);
          if (coords) {
            await db.run(
              'INSERT INTO world_locations (type, region_name, x, y) VALUES ($1, $2, $3, $4)',
              [type, region, coords.x, coords.y],
            );
          }
        }
      } catch (err) {
        console.error(`[world-locations] Failed to seed ${type} for ${region}:`, err.message);
      }
    }
  }

  // Reload cache
  await loadLocationCache(db);
}

/**
 * Get all locations for a region from cache.
 * @param {string} regionName - Region/race name
 * @returns {object|null} {dungeon: {...}, mountain: {...}} or null if region not found
 */
function getRegionLocations(regionName) {
  return locationCache[regionName] || null;
}

/**
 * Get a specific location by type and region.
 * @param {string} regionName - Region/race name
 * @param {string} type - 'dungeon' or 'mountain'
 * @returns {object|null} Location object or null
 */
function getLocationByRegionAndType(regionName, type) {
  const region = locationCache[regionName];
  return region ? region[type] : null;
}

/**
 * Get every seeded location across every region (18 total: one dungeon +
 * one mountain per region). Used for cross-region discovery checks and the
 * world-map/exploration picker — locations are public domain for the whole
 * game once discovered, not scoped to a single race.
 * @returns {object[]} Flat array of location rows from the cache.
 */
function getAllLocations() {
  const all = [];
  for (const region of Object.values(locationCache)) {
    for (const loc of Object.values(region)) {
      all.push(loc);
    }
  }
  return all;
}

/**
 * Look up a single location by its DB id, regardless of region.
 * @param {number} id - Location id
 * @returns {object|null} Location object or null
 */
function getLocationById(id) {
  const numericId = Number(id);
  return getAllLocations().find((loc) => loc.id === numericId) || null;
}

/**
 * Mark a location as discovered by a kingdom.
 * Atomically adds kingdom_id to discovered_by_kingdom_ids array.
 * @param {object} db - Database connection
 * @param {number} locationId - Location ID
 * @param {number} kingdomId - Kingdom ID
 * @returns {Promise<void>}
 */
async function markLocationDiscovered(db, locationId, kingdomId) {
  try {
    await db.run(
      `UPDATE world_locations
       SET discovered_by_kingdom_ids = array_append(COALESCE(discovered_by_kingdom_ids, '{}'), $2::integer)
       WHERE id = $1 AND NOT (COALESCE(discovered_by_kingdom_ids, '{}') @> ARRAY[$2]::integer[])`,
      [locationId, kingdomId],
    );

    // getAllLocations()/isPubliclyDiscovered() read from the in-memory
    // locationCache, which loadLocationCache() only populates once at boot
    // — without this, a location discovered mid-game stays invisible to
    // /world-map (isPubliclyDiscovered sees the stale pre-discovery object)
    // until the server happens to restart.
    await loadLocationCache(db);
  } catch (err) {
    console.error('[world-locations] Failed to mark location discovered:', err.message);
  }
}

/**
 * Check if a kingdom has discovered a location.
 * @param {object} location - Location object from DB
 * @param {number} kingdomId - Kingdom ID to check
 * @returns {boolean} True if kingdom has discovered this location
 */
function hasDiscovered(location, kingdomId) {
  if (!location || !location.discovered_by_kingdom_ids) return false;
  return location.discovered_by_kingdom_ids.includes(kingdomId);
}

/**
 * Check if a location has been discovered at all, by anyone.
 * Locations aren't owned by whichever kingdom finds them first — once any
 * kingdom scouts one into view it's public knowledge for every kingdom of
 * that region, not a private fact tied to the discovering kingdom's id.
 * @param {object} location - Location object from DB
 * @returns {boolean} True if any kingdom has discovered this location
 */
function isPubliclyDiscovered(location) {
  return !!(location && location.discovered_by_kingdom_ids && location.discovered_by_kingdom_ids.length > 0);
}

module.exports = {
  loadLocationCache,
  seedRegionLocations,
  getRegionLocations,
  getLocationByRegionAndType,
  getAllLocations,
  getLocationById,
  markLocationDiscovered,
  hasDiscovered,
  isPubliclyDiscovered,
  getRegionLocationCoords,
};
