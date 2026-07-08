// Phase 3a Profiling Utility
// Measures CPU-bound operations in processTurn to identify optimization opportunities

// Budgets for dev profiling (M2-3) — used for always-on warnings in dev
const BUDGETS = {
  jsonHighCostMs: 100,
  slowAttunementMs: 10,
  highSynergyLookups: 100
};

const { AsyncLocalStorage } = require('async_hooks');

class TurnProfiler {
  constructor() {
    this.reset();
  }

  reset() {
    this.startTime = null;
    this.metrics = {
      jsonParseCount: 0,
      jsonParseTime: 0,
      jsonStringifyCount: 0,
      jsonStringifyTime: 0,
      synergyLookups: 0,
      attunementCalls: {},
      totalTime: 0
    };
  }

  start() {
    this.startTime = performance.now();
  }

  recordJsonParse(duration) {
    this.metrics.jsonParseCount++;
    this.metrics.jsonParseTime += duration;
  }

  recordJsonStringify(duration) {
    this.metrics.jsonStringifyCount++;
    this.metrics.jsonStringifyTime += duration;
  }

  recordSynergyLookup() {
    this.metrics.synergyLookups++;
  }

  recordAttunementCall(name, duration) {
    if (!this.metrics.attunementCalls[name]) {
      this.metrics.attunementCalls[name] = { count: 0, totalTime: 0, maxTime: 0 };
    }
    this.metrics.attunementCalls[name].count++;
    this.metrics.attunementCalls[name].totalTime += duration;
    this.metrics.attunementCalls[name].maxTime = Math.max(
      this.metrics.attunementCalls[name].maxTime,
      duration
    );
  }

  end() {
    if (this.startTime) {
      this.metrics.totalTime = performance.now() - this.startTime;
    }
    return this.getReport();
  }

  getReport() {
    const report = {
      totalTime: this.formatMs(this.metrics.totalTime),
      jsonOperations: {
        parseCount: this.metrics.jsonParseCount,
        parseTime: this.formatMs(this.metrics.jsonParseTime),
        stringifyCount: this.metrics.jsonStringifyCount,
        stringifyTime: this.formatMs(this.metrics.jsonStringifyTime),
        totalTime: this.formatMs(this.metrics.jsonParseTime + this.metrics.jsonStringifyTime)
      },
      synergyLookups: this.metrics.synergyLookups,
      attunements: this.formatAttunements(this.metrics.attunementCalls),
      summary: this.generateSummary()
    };
    return report;
  }

  formatMs(ms) {
    return parseFloat(ms.toFixed(2));
  }

  formatAttunements(calls) {
    const formatted = {};
    for (const [name, data] of Object.entries(calls)) {
      formatted[name] = {
        count: data.count,
        totalTime: this.formatMs(data.totalTime),
        maxTime: this.formatMs(data.maxTime)
      };
    }
    return formatted;
  }

  generateSummary() {
    const json = this.metrics.jsonParseTime + this.metrics.jsonStringifyTime;
    const jsonPercent = this.metrics.totalTime > 0
      ? ((json / this.metrics.totalTime) * 100).toFixed(1)
      : 0;

    const slowAttunements = Object.entries(this.metrics.attunementCalls)
      .filter(([, data]) => data.maxTime > 10)
      .sort((a, b) => b[1].maxTime - a[1].maxTime);

    return {
      jsonPercentOfTotal: parseFloat(jsonPercent),
      slowAttunements: slowAttunements.length > 0 ? slowAttunements : null,
      profileNeeded: {
        jsonHighCost: json > BUDGETS.jsonHighCostMs,
        slowAttunementExists: slowAttunements.length > 0,
        highSynergyLookups: this.metrics.synergyLookups > BUDGETS.highSynergyLookups
      }
    };
  }
}

// Null Object pattern for no-op profiler
class NullProfiler {
  reset() {}
  start() {}
  recordJsonParse() {}
  recordJsonStringify() {}
  recordSynergyLookup() {}
  recordAttunementCall() {}
  end() { return {}; }
  getReport() { return {}; }
}

// AsyncLocalStorage for thread-safe per-request profiling
const profilerStorage = new AsyncLocalStorage();

// Dev always-on profiler (M2-3): in non-production, automatically use real TurnProfiler
// so every processTurn gets a _profileReport and budget checks can fire.
let devActiveProfiler = null;

function getProfiler() {
  const stored = profilerStorage.getStore();
  if (stored) return stored;

  if (process.env.NODE_ENV === 'production') {
    return new NullProfiler();
  }

  // Dev: return the active one (set by processTurn) or a fresh one
  if (!devActiveProfiler) {
    devActiveProfiler = new TurnProfiler();
  }
  return devActiveProfiler;
}

function initProfiler() {
  const profiler = new TurnProfiler();
  profiler.start();
  return profiler;
}

function runWithProfiler(profiler, fn) {
  return profilerStorage.run(profiler, fn);
}

// Called by engine after a dev turn to reset the auto-profiler
function resetDevProfiler() {
  devActiveProfiler = null;
}

module.exports = {
  TurnProfiler,
  NullProfiler,
  getProfiler,
  initProfiler,
  runWithProfiler,
  resetDevProfiler,
  BUDGETS
};
