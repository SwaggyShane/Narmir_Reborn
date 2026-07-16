/**
 * Socket.io emission guard (P0 architecture §1 residual).
 *
 * Ensures event payloads are JSON-safe before emit (no Date/BigInt/function/circular).
 * On failure: log, optionally STRICT throw, else best-effort sanitize + emit.
 *
 * Uses assertSerializable from command-handler (shared contract).
 */

'use strict';

const { assertSerializable } = require('./command-handler');

/**
 * Deep-walk to replace Date/BigInt before JSON (Date.toJSON otherwise becomes ISO strings).
 * @param {*} value
 * @param {WeakSet} [seen]
 * @returns {*}
 */
function toJsonSafe(value, seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === 'function' || typeof value === 'undefined' || typeof value === 'symbol') {
    return undefined;
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return null;
    seen.add(value);
    if (Array.isArray(value)) {
      return value.map((item) => toJsonSafe(item, seen)).filter((item) => item !== undefined);
    }
    const out = {};
    for (const key of Object.keys(value)) {
      const v = toJsonSafe(value[key], seen);
      if (v !== undefined) out[key] = v;
    }
    return out;
  }
  return null;
}

/**
 * Clone value to something assertSerializable accepts.
 * @param {*} value
 * @returns {*}
 */
function jsonSafeClone(value) {
  return toJsonSafe(value);
}

/**
 * Validate or sanitize a payload for Socket.io.
 * @param {*} payload
 * @param {string} [label]
 * @returns {{ ok: boolean, payload: *, sanitized: boolean, error?: Error }}
 */
function prepareSocketPayload(payload, label = 'socket-payload') {
  try {
    assertSerializable(payload, label);
    return { ok: true, payload, sanitized: false };
  } catch (err) {
    console.error(`[safeEmit] ${label}: ${err.message}`);
    if (process.env.STRICT_SOCKET_SERIALIZE === '1') {
      throw err;
    }
    try {
      const cleaned = jsonSafeClone(payload);
      // After clone, re-check (plain objects only)
      assertSerializable(cleaned, `${label}:sanitized`);
      console.warn(`[safeEmit] ${label}: emitted sanitized payload`);
      return { ok: true, payload: cleaned, sanitized: true };
    } catch (err2) {
      console.error(`[safeEmit] ${label}: sanitize failed: ${err2.message}`);
      return { ok: false, payload: null, sanitized: false, error: err2 };
    }
  }
}

/**
 * Emit only if payload is (or can be made) serializable.
 * @param {{ emit: function }} emitter - socket or io.to(...) broadcast
 * @param {string} event
 * @param {*} payload
 * @returns {boolean} true if emit was called
 */
function safeEmit(emitter, event, payload) {
  if (!emitter || typeof emitter.emit !== 'function') {
    console.error(`[safeEmit] ${event}: invalid emitter`);
    return false;
  }
  const prepared = prepareSocketPayload(payload, event);
  if (!prepared.ok) return false;
  emitter.emit(event, prepared.payload);
  return true;
}

module.exports = {
  toJsonSafe,
  jsonSafeClone,
  prepareSocketPayload,
  safeEmit,
};
