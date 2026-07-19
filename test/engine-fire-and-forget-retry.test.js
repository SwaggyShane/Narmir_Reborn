'use strict';
// Unit tests for game/engine.js's fireAndForgetWithRetry (A3-5, 2026-07-19).
//
// processTurn is synchronous, so revealRingHexes/checkFogDiscoveries can't
// be awaited — they're fire-and-forget. checkFogDiscoveries self-heals by
// re-scanning every turn; revealRingHexes doesn't (it's gated on a one-time
// scout-progress threshold transition that never re-fires for the same
// ring), so a single transient failure permanently drops that ring's map
// reveal. fireAndForgetWithRetry covers the realistic failure mode (a
// transient error) with one retry before giving up.
//
// Run: node test/engine-fire-and-forget-retry.test.js

const assert = require('assert');
const { fireAndForgetWithRetry } = require('../game/engine');

async function main() {
  // 1. Succeeds on the first attempt — fn called exactly once.
  {
    let calls = 0;
    await fireAndForgetWithRetry(async () => {
      calls++;
    }, 'test-succeeds-first-try');
    assert.strictEqual(calls, 1, 'should call fn exactly once on success');
  }
  console.log('✓ succeeds on first attempt, calls fn exactly once');

  // 2. Fails once, then succeeds on retry — fn called exactly twice, no throw escapes.
  {
    let calls = 0;
    await fireAndForgetWithRetry(async () => {
      calls++;
      if (calls === 1) throw new Error('transient failure');
    }, 'test-fails-then-succeeds');
    assert.strictEqual(calls, 2, 'should retry exactly once after a failure');
  }
  console.log('✓ fails once, retries, succeeds on second attempt');

  // 3. Fails both attempts — fn called exactly twice, error swallowed (never escapes
  //    to the caller, since this is called fire-and-forget from a synchronous
  //    processTurn that has no way to handle a rejected promise).
  {
    let calls = 0;
    let threw = false;
    try {
      await fireAndForgetWithRetry(async () => {
        calls++;
        throw new Error('permanent failure');
      }, 'test-fails-both-times');
    } catch {
      threw = true;
    }
    assert.strictEqual(calls, 2, 'should attempt exactly twice (original + one retry)');
    assert.strictEqual(threw, false, 'must never throw — caller cannot await this from sync processTurn');
  }
  console.log('✓ fails both attempts, calls fn exactly twice, swallows the error (never throws)');

  console.log('\nAll fireAndForgetWithRetry tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
