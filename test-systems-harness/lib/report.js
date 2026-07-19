'use strict';

/**
 * Shared result collector for the systems viability harness.
 * Systems emit pass/fail/skip checks; the runner prints a matrix report.
 */

class SystemsReport {
  constructor() {
    /** @type {Array<{system: string, check: string, status: 'pass'|'fail'|'skip', detail?: string, ms?: number}>} */
    this.results = [];
    this.startedAt = Date.now();
  }

  pass(system, check, detail = '', ms) {
    this.results.push({ system, check, status: 'pass', detail, ms });
    const timing = ms != null ? ` (${ms}ms)` : '';
    console.log(`  ✓ [${system}] ${check}${detail ? ` — ${detail}` : ''}${timing}`);
  }

  fail(system, check, detail = '', ms) {
    this.results.push({ system, check, status: 'fail', detail: String(detail), ms });
    const timing = ms != null ? ` (${ms}ms)` : '';
    console.error(`  ✗ [${system}] ${check}${detail ? ` — ${detail}` : ''}${timing}`);
  }

  skip(system, check, detail = '') {
    this.results.push({ system, check, status: 'skip', detail });
    console.log(`  ○ [${system}] ${check}${detail ? ` — ${detail}` : ''} (skip)`);
  }

  async run(system, check, fn) {
    const t0 = Date.now();
    try {
      const detail = await fn();
      this.pass(system, check, detail == null ? '' : String(detail), Date.now() - t0);
    } catch (err) {
      if (err instanceof AcceptableOutcome) {
        this.skip(system, check, `ACCEPTABLE: ${err.message}`);
        return;
      }
      this.fail(system, check, err && err.message ? err.message : String(err), Date.now() - t0);
    }
  }

  summary() {
    const pass = this.results.filter((r) => r.status === 'pass').length;
    const fail = this.results.filter((r) => r.status === 'fail').length;
    const skip = this.results.filter((r) => r.status === 'skip').length;
    const bySystem = {};
    for (const r of this.results) {
      if (!bySystem[r.system]) bySystem[r.system] = { pass: 0, fail: 0, skip: 0, fails: [] };
      bySystem[r.system][r.status] += 1;
      if (r.status === 'fail') bySystem[r.system].fails.push(r);
    }
    return {
      pass,
      fail,
      skip,
      total: this.results.length,
      ms: Date.now() - this.startedAt,
      bySystem,
      ok: fail === 0,
    };
  }

  printMatrix() {
    const s = this.summary();
    console.log('\n════════════════════════════════════════════════════════════');
    console.log(' SYSTEMS VIABILITY MATRIX');
    console.log('════════════════════════════════════════════════════════════');
    const names = Object.keys(s.bySystem).sort();
    for (const name of names) {
      const row = s.bySystem[name];
      const mark = row.fail > 0 ? 'FAIL' : row.pass > 0 ? 'PASS' : 'SKIP';
      console.log(
        `  ${mark.padEnd(4)}  ${name.padEnd(22)}  ✓${row.pass}  ✗${row.fail}  ○${row.skip}`,
      );
      for (const f of row.fails) {
        console.log(`         └─ ${f.check}: ${f.detail}`);
      }
    }
    console.log('────────────────────────────────────────────────────────────');
    console.log(
      `  Total: ${s.pass} passed, ${s.fail} failed, ${s.skip} skipped  (${s.ms}ms)`,
    );
    console.log('════════════════════════════════════════════════════════════\n');
    return s;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'assertion failed');
}

function assertOk(result, label = 'result') {
  if (result && result.error) {
    throw new Error(`${label}: ${result.error}`);
  }
  return result;
}

/**
 * Throw this from inside a `report.run` check when the check hit a real,
 * known-legitimate outcome that isn't the thing under test succeeding or
 * failing — e.g. a random test-data seed happened to trigger a real game
 * rule (elevation LOS, newbie protection, etc.) that correctly rejected the
 * action. `report.run` reports it as a distinct SKIP (not PASS, not FAIL) so
 * it never gets silently re-labeled "flaky" — the message must say why the
 * outcome is acceptable, not just that it was accepted.
 */
class AcceptableOutcome extends Error {
  constructor(message) {
    super(message);
    this.name = 'AcceptableOutcome';
  }
}

module.exports = { SystemsReport, assert, assertOk, AcceptableOutcome };
