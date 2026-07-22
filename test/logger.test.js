'use strict';
// Unit test for lib/logger.js's file-write formatting.
//
// Found live 2026-07-22: server.log entries for console.time/timeEnd (used
// by routes/kingdom-turn.js's turn-timing instrumentation) were written as
// literal "%s: %s [turn-1] init-queries 154.354ms" instead of substituting
// the format string. console.timeEnd internally calls the patched
// console.log('%s: %sms', label, ms) -- the original per-arg
// String()/JSON.stringify() join didn't apply printf-style substitution,
// only Node's native (pre-patch) console.log did, so the real terminal
// output was fine but the persisted log file was garbled.
//
// Run: node test/logger.test.js

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

function withPatchedLogger(fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
  const origCwd = process.cwd();
  // setupFileLogging writes to <module-dir>/../logs/server.log; run it against
  // a throwaway lib/ dir under a temp cwd so this test never touches the
  // real logs/server.log.
  const fakeLibDir = path.join(tmpDir, 'lib');
  fs.mkdirSync(fakeLibDir, { recursive: true });
  fs.copyFileSync(path.join(__dirname, '..', 'lib', 'logger.js'), path.join(fakeLibDir, 'logger.js'));

  const origLog = console.log;
  const origWarn = console.warn;
  try {
    process.chdir(tmpDir);
    delete require.cache[path.join(fakeLibDir, 'logger.js')];
    const { setupFileLogging } = require(path.join(fakeLibDir, 'logger.js'));
    const { logFilePath } = setupFileLogging();
    fn(logFilePath);
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function main() {
  // 1. console.timeEnd's internal printf call substitutes correctly in the file.
  withPatchedLogger((logFilePath) => {
    console.time('turn-1] init-queries');
    console.timeEnd('turn-1] init-queries');
    const contents = fs.readFileSync(logFilePath, 'utf8');
    assert.ok(!contents.includes('%s: %s'), 'log file must not contain literal unformatted %s: %s');
    assert.ok(/turn-1\] init-queries: [\d.]+ms/.test(contents),
      'log file must contain the substituted "label: Xms" line');
  });
  console.log('✓ console.timeEnd writes substituted output, not literal %s: %s');

  // 2. Plain string logging is unaffected.
  withPatchedLogger((logFilePath) => {
    console.log('plain string test');
    const contents = fs.readFileSync(logFilePath, 'utf8');
    assert.ok(contents.includes('plain string test'));
  });
  console.log('✓ plain string console.log unaffected');

  // 3. Object logging still JSON-stringifies (unchanged from prior behavior).
  withPatchedLogger((logFilePath) => {
    console.log('object test', { a: 1, b: 'x' });
    const contents = fs.readFileSync(logFilePath, 'utf8');
    assert.ok(contents.includes('object test {"a":1,"b":"x"}'));
  });
  console.log('✓ object console.log still JSON-stringifies');

  console.log('\nAll logger tests passed.');
}

main();
