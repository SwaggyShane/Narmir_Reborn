/**
 * Flux-Barge logistics
 * Entity: { id, integrity, status: 'idle'|'building'|'deployed', turns_left? }
 */

'use strict';

const config = require('./config');
const { safeJsonParse } = require('../utils/helpers');
const { flagOn } = require('./forge-upgrades');

function bargeCfg() {
  return (
    config.FORGE_BARGE || {
      max: 3,
      extra: { steel: 100, gold: 150000, stone: 1000, turns: 20 },
      hull_max: 100,
      wear_success: 20,
      wear_empty: 5,
    }
  );
}

function parseBarges(raw) {
  if (Array.isArray(raw)) return raw.map((b) => ({ ...b }));
  return safeJsonParse(raw, [], 'flux-barge:parse').map((b) => ({ ...b }));
}

function serializeBarges(list) {
  return JSON.stringify(list);
}

function nextBargeId(list) {
  return list.reduce((m, b) => Math.max(m, Number(b.id) || 0), 0) + 1;
}

function countOwned(list) {
  return list.length;
}

/** Free barge on Forge install (integrity 100, idle). */
function grantFreeBarge(fluxBargesRaw) {
  const cfg = bargeCfg();
  const list = parseBarges(fluxBargesRaw);
  if (list.length >= cfg.max) return list;
  list.push({
    id: nextBargeId(list),
    integrity: cfg.hull_max || 100,
    status: 'idle',
  });
  return list;
}

/**
 * Queue one extra barge — eng level ≥ 50, forge, costs, max 3.
 * status building + turns_left until complete.
 */
function queueExtraBarge(k, engineerLevel) {
  if (!flagOn(k, 'forge')) return { error: 'Install the Forge upgrade first' };
  const engMin = (config.FORGE_LAVA && config.FORGE_LAVA.eng_level_min) || 50;
  const engLvl = Math.floor(
    Number(engineerLevel) || Number(k.engineer_level) || 1,
  );
  if (engLvl < engMin) {
    return { error: `Engineer level ${engMin}+ required to build Flux-Barges` };
  }

  const cfg = bargeCfg();
  const list = parseBarges(k.flux_barges);
  if (list.length >= cfg.max) {
    return { error: `Maximum ${cfg.max} Flux-Barges` };
  }

  const cost = cfg.extra || {};
  const steelNeed = cost.steel || 100;
  const goldNeed = cost.gold || 150000;
  const stoneNeed = cost.stone || 1000;
  const turns = cost.turns || 20;

  const steel = Math.floor(Number(k.steel) || 0);
  const gold = Math.floor(Number(k.gold) || 0);
  const stone = Math.floor(Number(k.stone) || 0);
  if (steel < steelNeed) {
    return { error: `Need ${steelNeed.toLocaleString()} steel` };
  }
  if (gold < goldNeed) {
    return { error: `Need ${goldNeed.toLocaleString()} gold` };
  }
  if (stone < stoneNeed) {
    return { error: `Need ${stoneNeed.toLocaleString()} stone` };
  }

  list.push({
    id: nextBargeId(list),
    integrity: cfg.hull_max || 100,
    status: 'building',
    turns_left: turns,
  });

  return {
    updates: {
      steel: steel - steelNeed,
      gold: gold - goldNeed,
      stone: stone - stoneNeed,
      flux_barges: serializeBarges(list),
      updated_at: Math.floor(Date.now() / 1000),
    },
    bargeId: list[list.length - 1].id,
    turns,
  };
}

/** Turn tick: decrement building barges; at 0 → idle. */
function processBargeBuildTick(k) {
  const list = parseBarges(k.flux_barges);
  let changed = false;
  const completed = [];
  for (const b of list) {
    if (b.status !== 'building') continue;
    const left = Math.max(0, Math.floor(Number(b.turns_left) || 0) - 1);
    b.turns_left = left;
    changed = true;
    if (left <= 0) {
      b.status = 'idle';
      delete b.turns_left;
      completed.push(b.id);
    }
  }
  if (!changed) return { updates: {} };
  return {
    updates: { flux_barges: serializeBarges(list) },
    completed,
  };
}

/**
 * Apply hull wear. kind: 'success' | 'empty'
 * Removes barge at integrity ≤ 0.
 */
function applyHullWear(fluxBargesRaw, bargeId, kind) {
  const cfg = bargeCfg();
  const wear =
    kind === 'success'
      ? Number(cfg.wear_success) || 20
      : Number(cfg.wear_empty) || 5;
  const list = parseBarges(fluxBargesRaw);
  const idx = list.findIndex((b) => Number(b.id) === Number(bargeId));
  if (idx < 0) return { error: 'Barge not found', list };
  const b = list[idx];
  b.integrity = Math.max(0, Math.floor(Number(b.integrity) || 0) - wear);
  if (b.integrity <= 0) {
    list.splice(idx, 1);
    return { list, destroyed: true, integrity: 0 };
  }
  return { list, destroyed: false, integrity: b.integrity };
}

function setBargeStatus(fluxBargesRaw, bargeId, status) {
  const list = parseBarges(fluxBargesRaw);
  const b = list.find((x) => Number(x.id) === Number(bargeId));
  if (!b) return { error: 'Barge not found' };
  if (status === 'deployed' && b.status === 'deployed') {
    return { error: 'Barge already deployed' };
  }
  if (status === 'deployed' && b.status === 'building') {
    return { error: 'Barge still under construction' };
  }
  if (status === 'deployed' && (Number(b.integrity) || 0) <= 0) {
    return { error: 'Barge hull destroyed' };
  }
  b.status = status;
  if (status === 'idle') delete b.deployed_job;
  return { list, barge: b };
}

/** Idle barge with hull > 0 available to launch. */
function findDeployableBarge(fluxBargesRaw, bargeId) {
  const list = parseBarges(fluxBargesRaw);
  const b = list.find((x) => Number(x.id) === Number(bargeId));
  if (!b) return { error: 'Barge not found' };
  if (b.status !== 'idle') return { error: 'Barge not available (not idle)' };
  if ((Number(b.integrity) || 0) <= 0) return { error: 'Barge hull destroyed' };
  return { barge: b, list };
}

module.exports = {
  parseBarges,
  serializeBarges,
  grantFreeBarge,
  queueExtraBarge,
  processBargeBuildTick,
  applyHullWear,
  setBargeStatus,
  findDeployableBarge,
  countOwned,
  bargeCfg,
};
