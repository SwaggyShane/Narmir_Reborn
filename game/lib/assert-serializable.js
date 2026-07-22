// game/lib/assert-serializable.js
// Leaf JSON-safety check shared by command-handler and safe-socket-emit.
// Lives here (not on command-handler) so engine → region/expedition → safe-socket-emit
// never circularly requires command-handler during module load.

'use strict';

/**
 * Ensure a value is Socket.io / HTTP-safe JSON (no Date, Function, BigInt, Map, Set, circular refs).
 * Walks the structure before stringify so silent drops (functions) and Date→string coercions fail loudly.
 * @param {*} data
 * @param {string} [label]
 * @param {WeakSet} [seen]
 */
function assertSerializable(data, label = 'value', seen = new WeakSet()) {
  const t = typeof data;
  if (data === null || t === 'string' || t === 'boolean') {
    return data;
  }
  if (t === 'number') {
    if (!Number.isFinite(data)) {
      throw new Error(`assertSerializable(${label}): non-finite number`);
    }
    return data;
  }
  if (t === 'bigint') {
    throw new Error(`assertSerializable(${label}): BigInt is not JSON-safe`);
  }
  if (t === 'function' || t === 'symbol' || t === 'undefined') {
    throw new Error(`assertSerializable(${label}): ${t} is not JSON-safe`);
  }
  if (data instanceof Date) {
    throw new Error(`assertSerializable(${label}): Date is not allowed (use unix timestamp number)`);
  }
  if (typeof Map !== 'undefined' && data instanceof Map) {
    throw new Error(`assertSerializable(${label}): Map is not JSON-safe`);
  }
  if (typeof Set !== 'undefined' && data instanceof Set) {
    throw new Error(`assertSerializable(${label}): Set is not JSON-safe`);
  }
  if (typeof data === 'object') {
    if (seen.has(data)) {
      throw new Error(`assertSerializable(${label}): circular reference`);
    }
    seen.add(data);
    if (Array.isArray(data)) {
      data.forEach((item, i) => assertSerializable(item, `${label}[${i}]`, seen));
    } else {
      // Reject class instances that are not plain objects (optional: allow only Object prototype)
      const proto = Object.getPrototypeOf(data);
      if (proto !== Object.prototype && proto !== null) {
        throw new Error(`assertSerializable(${label}): non-plain object (class instance?)`);
      }
      for (const key of Object.keys(data)) {
        assertSerializable(data[key], `${label}.${key}`, seen);
      }
    }
  }

  let serialized;
  try {
    serialized = JSON.stringify(data);
  } catch (err) {
    throw new Error(`assertSerializable(${label}): JSON.stringify failed: ${err.message}`, { cause: err });
  }
  if (serialized === undefined) {
    throw new Error(`assertSerializable(${label}): JSON.stringify returned undefined`);
  }
  return JSON.parse(serialized);
}

module.exports = {
  assertSerializable,
};
