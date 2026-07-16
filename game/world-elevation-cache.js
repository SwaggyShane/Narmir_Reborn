/**
 * In-memory cache for the current world's elevation grid (db.world_state.elevation_grid).
 *
 * Mirrors game/world-seed.js's pattern exactly: combat/movement resolution
 * (game/lib/combat-wrappers.js, game/epic-trek-paths.js) needs synchronous,
 * per-call access to elevation data on hot paths, so it's loaded once at
 * boot (db/schema.js, right after ensureWorldElevation) and cached here
 * rather than re-fetched from the DB on every combat/trek call.
 */

'use strict';

let cachedGrid = null;
let cachedFlow = null; // { dag, flow } from buildDownhillDAG/computeFlowAccumulation

/**
 * Set the cached elevation grid. Call once at boot with ensureWorldElevation's
 * return value (or in tests, with any {"col,row": elevation} object).
 */
function setElevationGrid(grid) {
  cachedGrid = grid || {};
}

/**
 * Synchronous accessor for the cached elevation grid. Throws if called
 * before setElevationGrid() has run, so callers can't silently treat a
 * missing grid as "elevation is just flat everywhere."
 */
function getElevationGrid() {
  if (cachedGrid === null) {
    throw new Error('[world-elevation-cache] getElevationGrid() called before setElevationGrid() — call it once at boot after ensureWorldElevation(), or use hasElevationGrid() to check first.');
  }
  return cachedGrid;
}

/**
 * Non-throwing check for callers that need to gracefully no-op (e.g. routes
 * that run before boot's elevation step has completed, or in tests that
 * don't set up a grid at all).
 */
function hasElevationGrid() {
  return cachedGrid !== null;
}

/**
 * Set the cached downhill-DAG + flow-accumulation data (Phase 2 river flow —
 * game/world-elevation.js's buildDownhillDAG/computeFlowAccumulation). These
 * had zero callers anywhere until wired here at boot.
 */
function setFlowData(dag, flow) {
  cachedFlow = { dag: dag || {}, flow: flow || {} };
}

function getFlowData() {
  if (cachedFlow === null) {
    throw new Error('[world-elevation-cache] getFlowData() called before setFlowData() — call it once at boot, or use hasFlowData() to check first.');
  }
  return cachedFlow;
}

function hasFlowData() {
  return cachedFlow !== null;
}

module.exports = {
  setElevationGrid,
  getElevationGrid,
  hasElevationGrid,
  setFlowData,
  getFlowData,
  hasFlowData,
};
