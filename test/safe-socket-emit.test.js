'use strict';

const assert = require('assert');
const {
  jsonSafeClone,
  prepareSocketPayload,
  safeEmit,
} = require('../game/safe-socket-emit');

// ── jsonSafeClone ───────────────────────────────────────────────────────────
{
  assert.deepStrictEqual(jsonSafeClone({ a: 1, b: 'x' }), { a: 1, b: 'x' });
  assert.deepStrictEqual(jsonSafeClone({ n: 1n }), { n: '1' });
  const d = new Date('2020-01-01T00:00:00.000Z');
  assert.strictEqual(jsonSafeClone({ d }).d, d.getTime());
  assert.deepStrictEqual(jsonSafeClone({ f: () => 1, u: undefined }), {});
}
console.log('jsonSafeClone: plain, BigInt, Date, drops function');

// ── prepareSocketPayload: clean ─────────────────────────────────────────────
{
  const r = prepareSocketPayload({ ok: true, n: 3 }, 'test');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.sanitized, false);
  assert.deepStrictEqual(r.payload, { ok: true, n: 3 });
}
console.log('prepareSocketPayload: accepts plain JSON');

// ── prepareSocketPayload: Date → sanitize ───────────────────────────────────
{
  const prev = process.env.STRICT_SOCKET_SERIALIZE;
  delete process.env.STRICT_SOCKET_SERIALIZE;
  const r = prepareSocketPayload({ t: new Date(0) }, 'date-event');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.sanitized, true);
  assert.strictEqual(r.payload.t, 0);
  if (prev !== undefined) process.env.STRICT_SOCKET_SERIALIZE = prev;
}
console.log('prepareSocketPayload: Date sanitized to timestamp');

// ── STRICT mode throws ──────────────────────────────────────────────────────
{
  process.env.STRICT_SOCKET_SERIALIZE = '1';
  assert.throws(
    () => prepareSocketPayload({ t: new Date() }, 'strict'),
    /Date is not allowed/,
  );
  delete process.env.STRICT_SOCKET_SERIALIZE;
}
console.log('prepareSocketPayload: STRICT_SOCKET_SERIALIZE throws');

// ── safeEmit ────────────────────────────────────────────────────────────────
{
  const emitted = [];
  const emitter = {
    emit(event, payload) {
      emitted.push({ event, payload });
    },
  };
  assert.strictEqual(safeEmit(emitter, 'ping', { x: 1 }), true);
  assert.strictEqual(emitted.length, 1);
  assert.strictEqual(emitted[0].event, 'ping');
  assert.deepStrictEqual(emitted[0].payload, { x: 1 });

  assert.strictEqual(safeEmit(null, 'x', {}), false);
  assert.strictEqual(safeEmit({}, 'x', {}), false);
}
console.log('safeEmit: emits valid payload; rejects bad emitter');

// ── safeEmit sanitizes then emits ───────────────────────────────────────────
{
  delete process.env.STRICT_SOCKET_SERIALIZE;
  const emitted = [];
  const emitter = { emit: (e, p) => emitted.push(p) };
  assert.strictEqual(safeEmit(emitter, 'evt', { d: new Date(1000) }), true);
  assert.strictEqual(emitted[0].d, 1000);
}
console.log('safeEmit: sanitizes Date and still emits');

console.log('\n✅ All safe-socket-emit tests passed!');
