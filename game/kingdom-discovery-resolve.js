/**
 * Resolve `_find_kingdom` / surveyor-style kingdom discovery signals.
 *
 * Passive scout finds and expedition rewards set a flag on turn updates;
 * actual kingdom selection needs async DB. This module owns the pure merge
 * of discovered_kingdoms + honest event text so flags never write to the DB
 * as columns and players only see discoveries that persist.
 */

'use strict';

const { safeJsonParse } = require('../utils/helpers');

/**
 * @param {object} kingdom - current kingdom row (or merge of k + updates)
 * @param {object} updates - turn updates that may already include discovered_kingdoms
 * @param {{ id: number|string, name?: string }|null} other - discovered kingdom
 * @param {object} [opts]
 * @param {string} [opts.source] - 'scout' | 'surveyor' | 'expedition' for message flavor
 * @returns {{ applied: boolean, discovered_kingdoms?: string, message?: string, alreadyKnown?: boolean }}
 */
function mergeKingdomDiscovery(kingdom, updates, other, opts = {}) {
  if (!other || other.id == null) {
    return { applied: false };
  }

  const source = opts.source || 'scout';
  const discRaw =
    (updates && updates.discovered_kingdoms !== undefined)
      ? updates.discovered_kingdoms
      : kingdom?.discovered_kingdoms;
  let disc = {};
  try {
    disc = safeJsonParse(discRaw, {}, 'kingdom-discovery-resolve');
  } catch {
    disc = {};
  }
  if (!disc || typeof disc !== 'object') disc = {};

  const id = other.id;
  if (disc[id] || disc[String(id)]) {
    return { applied: false, alreadyKnown: true };
  }

  const name = other.name || `Kingdom #${id}`;
  disc[id] = { found: true, name };

  let message;
  if (source === 'surveyor') {
    message = `🔭 Your Surveyors discovered the kingdom of ${name}!`;
  } else if (source === 'expedition') {
    message = `Your rangers discovered the kingdom of ${name}!`;
  } else {
    message = `🔍 Your scouts discovered the kingdom of ${name}!`;
  }

  return {
    applied: true,
    discovered_kingdoms: JSON.stringify(disc),
    message,
    otherId: id,
    otherName: name,
  };
}

/**
 * Strip discovery flags so they never hit applyKingdomUpdates as columns.
 * @param {object} updates
 * @returns {object} same object
 */
function stripDiscoveryFlags(updates) {
  if (!updates || typeof updates !== 'object') return updates;
  delete updates._find_kingdom;
  delete updates._find_kingdom_surveyor;
  delete updates._spawn_resource_node;
  return updates;
}

module.exports = {
  mergeKingdomDiscovery,
  stripDiscoveryFlags,
};
