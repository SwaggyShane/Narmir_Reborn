/**
 * Shared world-map coordinate helpers.
 * Map space matches WorldmapRenderer viewBox: 1999 x 1380.
 *
 * Phase 1.5 (Fog of War): kingdom/node placement used to come from fixed
 * REGION_SEEDS arrays — fully deterministic forever, which Phase 1's
 * validation script confirmed let 53% of kingdoms land outside their own
 * race's hex region (human vs. dire_wolf overlap) and 6/5,000 spawn in
 * water. Placement is now seeded by the current world's generation seed
 * (game/world-seed.js, db.world_state) plus kingdomId/race/nodeId, with
 * rejection sampling against game/world-regions.js's region/water rules —
 * stable within a world (same seed -> same position every call), different
 * across resets (new seed after a wipe -> different layout).
 */

'use strict';

const { getWorldSeed } = require('./world-seed');
const { RACE_HOMES, nearestRaceHome, isWaterPoint } = require('./world-regions');
const { pixelToHex, hexCenter } = require('./hex-utils');

const MAP_WIDTH = 1999;
const MAP_HEIGHT = 1380;

const DISTANCE_MIN = 600;
const DISTANCE_MAX = 28800;

// How far from a race's home point a kingdom can be seeded-placed. Roughly
// matches the old REGION_SEEDS arrays' spread (they ranged ~100-150px from
// each race's home in most cases).
const KINGDOM_PLACEMENT_RADIUS = 130;
// Some races (e.g. human, whose RACE_HOMES point sits closer to dire_wolf/
// vampire's than KINGDOM_PLACEMENT_RADIUS) have a region boundary well
// inside the placement radius, so a meaningful fraction of random candidates
// land outside the home race's Voronoi cell. 60 attempts drives the residual
// failure rate to effectively zero across the full RACE_HOMES geometry
// (measured: 0/5,000 in the local dev DB, vs. 5/5,000 at 30 attempts).
const MAX_PLACEMENT_ATTEMPTS = 60;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Simple string -> 32-bit int hash (FNV-1a), used to fold a race name into
// the same integer-mixing seededRandom() takes below.
function stringHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Same class of integer-mixing hash as WorldmapRenderer.jsx's
// hexSeededRandom, generalized to combine an arbitrary number of integer
// inputs into a stable [0, 1) value.
function seededRandom(...intInputs) {
  let t = 0;
  for (const v of intInputs) {
    t = (Math.imul(t ^ v, 2654435761) + v) | 0;
  }
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// The world seed is a BigInt (world_state.seed is BIGINT, can exceed
// Number.MAX_SAFE_INTEGER's useful mixing range) — fold it into a 32-bit
// safe integer once per call rather than on every seededRandom() invocation.
function seedAsInt32(worldSeed) {
  return Number(BigInt(worldSeed) % 2147483647n);
}

// True if pixel (x, y) renders inside a hex cell whose CENTER resolves to
// `race` — not just whether (x, y) itself is nearest to that race's home.
// A kingdom marker's own coordinate can be nearest to its own race while
// still sitting inside a hex cell whose center rounds to a neighboring
// race, right at a region boundary; WorldmapRenderer.jsx colors hexes by
// their cell center, so alignment has to be checked the same way or the
// two disagree exactly at the boundary this whole check exists to guard.
function isInOwnRaceHex(x, y, race) {
  const hex = pixelToHex(x, y);
  const center = hexCenter(hex.col, hex.row);
  return nearestRaceHome(center.x, center.y) === race;
}

function getKingdomMapCoords(kingdom) {
  const race = kingdom?.race || 'human';
  const kingdomId = Number(kingdom?.id) || 0;
  const home = RACE_HOMES[race] || { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
  const seed = seedAsInt32(getWorldSeed());
  const raceHash = stringHash(race);

  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
    const rAngle = seededRandom(seed, kingdomId, raceHash, attempt, 1);
    const rDist = seededRandom(seed, kingdomId, raceHash, attempt, 2);
    const angle = rAngle * Math.PI * 2;
    const dist = rDist * KINGDOM_PLACEMENT_RADIUS;
    // Round BEFORE validating, not after — validating the float and then
    // rounding can shift the point across a hex boundary by up to half a
    // pixel, silently invalidating the very check that just passed.
    const x = Math.round(clamp(home.x + Math.cos(angle) * dist, 20, MAP_WIDTH - 20));
    const y = Math.round(clamp(home.y + Math.sin(angle) * dist, 20, MAP_HEIGHT - 20));

    if (isInOwnRaceHex(x, y, race) && !isWaterPoint(x, y)) {
      return { map_x: x, map_y: y };
    }
  }

  // Fallback after exhausting attempts: the home point's own hex cell
  // resolves to its own race by construction (RACE_HOMES is the input
  // nearestRaceHome measures against), so region alignment is guaranteed.
  // Water is not guaranteed in principle, but RACE_HOMES are hand-placed
  // well clear of the ocean/tundra band, so this fallback is not expected
  // to be hit in practice — the loop above finds a valid point almost
  // immediately for every race's actual RACE_HOMES geometry.
  return { map_x: Math.round(home.x), map_y: Math.round(home.y) };
}

function normalizeDistance(distance) {
  const span = DISTANCE_MAX - DISTANCE_MIN;
  if (span <= 0) return 0.5;
  return clamp((Number(distance) - DISTANCE_MIN) / span, 0, 1);
}

function placeResourceNodeCoords({ kingdomId, nodeId, race, distance, kingdomX, kingdomY }) {
  const originX = Number.isFinite(kingdomX)
    ? kingdomX
    : getKingdomMapCoords({ id: kingdomId, race }).map_x;
  const originY = Number.isFinite(kingdomY)
    ? kingdomY
    : getKingdomMapCoords({ id: kingdomId, race }).map_y;

  const seed = seedAsInt32(getWorldSeed());
  const t = normalizeDistance(distance);
  const radius = 28 + t * 110;
  const kId = Number(kingdomId) || 0;
  const nId = Number(nodeId) || 0;

  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
    const rAngle = seededRandom(seed, kId, nId, attempt, 3);
    const angle = rAngle * Math.PI * 2;
    // Round before validating — see the matching comment in
    // getKingdomMapCoords for why post-round re-validation is required.
    const x = Math.round(clamp(originX + Math.cos(angle) * radius, 24, MAP_WIDTH - 24));
    const y = Math.round(clamp(originY + Math.sin(angle) * radius, 24, MAP_HEIGHT - 24));

    if (!isWaterPoint(x, y)) {
      return { map_x: x, map_y: y };
    }
  }

  // Fallback: the owning kingdom's own position is guaranteed non-water
  // (getKingdomMapCoords already enforces that), so anchor the node there
  // rather than risk a badly-placed node after repeated water hits.
  return { map_x: Math.round(originX), map_y: Math.round(originY) };
}

async function backfillResourceNodeMapCoords(db) {
  const rows = await db.all(`
    SELECT rn.id, rn.kingdom_id, rn.distance, rn.map_x, rn.map_y, k.race
    FROM resource_nodes rn
    JOIN kingdoms k ON k.id = rn.kingdom_id
    WHERE rn.map_x IS NULL OR rn.map_y IS NULL
  `);
  for (const row of rows) {
    const home = getKingdomMapCoords({ id: row.kingdom_id, race: row.race });
    const coords = placeResourceNodeCoords({
      kingdomId: row.kingdom_id,
      nodeId: row.id,
      race: row.race,
      distance: row.distance,
      kingdomX: home.map_x,
      kingdomY: home.map_y,
    });
    await db.run(
      'UPDATE resource_nodes SET map_x = $1, map_y = $2 WHERE id = $3',
      [coords.map_x, coords.map_y, row.id],
    );
  }
  return rows.length;
}

module.exports = {
  MAP_WIDTH,
  MAP_HEIGHT,
  getKingdomMapCoords,
  placeResourceNodeCoords,
  backfillResourceNodeMapCoords,
};
