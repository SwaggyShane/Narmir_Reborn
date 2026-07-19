'use strict';
// Unit tests for routes/response-structurer.js (A3-7, 2026-07-19).
//
// Two real bugs found via live audit motivated this file:
// 1. war_machines reached structureUpdates but matched no Set at all, so it
//    silently vanished from every response instead of landing in
//    military.troops (where militaryStore.receiveServerSnapshot reads it
//    from) — found by cross-referencing client/src/stores/militaryStore.js.
// 2. achievements/racial_bonuses_unlocked are real kingdoms columns that can
//    legitimately appear in a postfetch-refreshed updates object, but have
//    no Zustand-store consumer at all, so they logged as "unmapped" noise
//    even though nothing was actually broken.
//
// Run: node test/response-structurer.test.js

const assert = require('assert');
const { structureUpdates } = require('../routes/response-structurer');

function main() {
  // 1. war_machines routes into military.troops, not dropped.
  {
    const structured = structureUpdates({ war_machines: 42 });
    assert.strictEqual(structured.military?.troops?.war_machines, 42,
      'war_machines must land in military.troops');
  }
  console.log('✓ war_machines routes into military.troops');

  // 2. achievements/racial_bonuses_unlocked are dropped without warning —
  //    verify via warnUnmapped never firing console.warn for them.
  {
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    structureUpdates(
      { achievements: '["ach_founder"]', racial_bonuses_unlocked: '{"dwarf":true}' },
      { warnUnmapped: true },
    );
    console.warn = origWarn;
    assert.strictEqual(warnings.length, 0,
      'achievements/racial_bonuses_unlocked must not trigger the unmapped-key warning');
  }
  console.log('✓ achievements/racial_bonuses_unlocked dropped silently (known server-internal fields)');

  // 3. A genuinely new/unknown key still warns — the warning mechanism
  //    itself must still work for real gaps (this is the whole point of
  //    A4-10's loud-on-purpose design).
  {
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    structureUpdates({ totally_unknown_future_column: 1 }, { warnUnmapped: true });
    console.warn = origWarn;
    assert.strictEqual(warnings.length, 1, 'a genuinely unmapped key must still warn exactly once');
    assert.ok(warnings[0].includes('totally_unknown_future_column'), 'warning must name the key');
  }
  console.log('✓ a genuinely unmapped key still triggers the dev warning');

  // 4. Multi-domain fan-out still works (engineers: profile + military.troops).
  {
    const structured = structureUpdates({ engineers: 7 });
    assert.strictEqual(structured.military?.troops?.engineers, 7, 'engineers must land in military.troops');
    assert.strictEqual(structured.profile?.engineers, 7, 'engineers must also land in profile');
  }
  console.log('✓ engineers fans out to both military.troops and profile');

  console.log('\nAll response-structurer tests passed.');
}

main();
