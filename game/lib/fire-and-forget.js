// game/lib/fire-and-forget.js
// Async side-effect helper for sync processTurn (engine extract S13 / A3-5).

'use strict';

/**
 * processTurn is synchronous (cannot await), so revealRingHexes /
 * checkFogDiscoveries are necessarily fire-and-forget (A3-5 audit,
 * 2026-07-19). checkFogDiscoveries is self-healing by design — it re-scans
 * every turn scouts are allocated and skips already-discovered kingdoms, so
 * one failed call is caught by the next. revealRingHexes is NOT: it's gated
 * on scout-progress crossing a NEW ring threshold, a one-time transition
 * derived from the already-persisted scout_progress total — if the write
 * fails on the exact turn a ring completes, that ring's hexes are never
 * revealed again, since the transition never re-fires. A single retry
 * covers the realistic failure mode (a transient connection blip) without
 * changing the trigger frequency or touching the hot per-turn path.
 *
 * @param {() => Promise<any>} fn
 * @param {string} label
 */
async function fireAndForgetWithRetry(fn, label) {
  try {
    await fn();
  } catch (err) {
    console.error(`[engine] ${label} failed, retrying once: ${err.message}`);
    try {
      await fn();
    } catch (retryErr) {
      console.error(`[engine] ${label} failed on retry, giving up: ${retryErr.message}`);
    }
  }
}

module.exports = {
  fireAndForgetWithRetry,
};
