'use strict';

/**
 * Suite 01: Every critical game system has HTTP endpoint coverage in routes/.
 */

const { scanAllRoutes, checkSystemCoverage, SYSTEM_ENDPOINTS } = require('../lib/inventory');
const { assert } = require('../lib/report');

async function run(report) {
  const system = 'endpoints';
  console.log('\n▶ Suite 01 — Endpoint inventory');

  await report.run(system, 'scan routes/*.js', async () => {
    const all = scanAllRoutes();
    assert(all.length > 50, `expected many routes, got ${all.length}`);
    return `${all.length} handlers`;
  });

  await report.run(system, 'system coverage matrix', async () => {
    const all = scanAllRoutes();
    const coverage = checkSystemCoverage(all);
    const missingAll = [];
    for (const [name, row] of Object.entries(coverage)) {
      if (row.missing.length) {
        missingAll.push(
          `${name}: ${row.missing.map((m) => `${m.method} ${m.path}`).join(', ')}`,
        );
      }
    }
    assert(missingAll.length === 0, `missing endpoints — ${missingAll.join('; ')}`);
    return `${Object.keys(SYSTEM_ENDPOINTS).length} systems fully mapped`;
  });

  await report.run(system, 'warfare owns combat/spell/covert', async () => {
    const all = scanAllRoutes();
    const warfare = all.filter((e) => e.file === 'kingdom-warfare.js');
    const paths = new Set(warfare.map((e) => `${e.method} ${e.path}`));
    for (const need of ['POST /attack', 'POST /spell', 'POST /covert']) {
      assert(paths.has(need), `kingdom-warfare.js missing ${need}`);
    }
    return `${warfare.length} warfare routes`;
  });

  await report.run(system, 'economy owns market/bank/mercs', async () => {
    const all = scanAllRoutes();
    const econ = all.filter((e) => e.file === 'kingdom-economy.js');
    const paths = new Set(econ.map((e) => `${e.method} ${e.path}`));
    for (const need of ['POST /market/buy', 'POST /market/sell', 'GET /economy/overview']) {
      assert(paths.has(need), `kingdom-economy.js missing ${need}`);
    }
    return `${econ.length} economy routes`;
  });

  await report.run(system, 'gameplay owns hire/expedition', async () => {
    const all = scanAllRoutes();
    const gp = all.filter((e) => e.file === 'kingdom-gameplay.js');
    const paths = new Set(gp.map((e) => `${e.method} ${e.path}`));
    for (const need of ['POST /hire']) {
      assert(paths.has(need), `kingdom-gameplay.js missing ${need}`);
    }
    return `${gp.length} gameplay routes`;
  });

  await report.run(system, 'turn owns POST /turn', async () => {
    // POST /turn split out of kingdom-gameplay.js into its own file (A2-3,
    // 2026-07-19) — kingdom-gameplay.js had grown to 53 handlers covering
    // everything from forge production to happiness to epic trek.
    const all = scanAllRoutes();
    const turnFile = all.filter((e) => e.file === 'kingdom-turn.js');
    const paths = new Set(turnFile.map((e) => `${e.method} ${e.path}`));
    assert(paths.has('POST /turn'), 'kingdom-turn.js missing POST /turn');
    return `${turnFile.length} turn routes`;
  });

  await report.run(system, 'forge owns forge/lava cluster', async () => {
    // Forge & Lava Industry split out of kingdom-gameplay.js into its own
    // file (A2-4, 2026-07-18) — the Toolwright Yard/Engineers Lodge/Forge
    // upgrade chain, steel production, Flux-Barge fleet, and lava-draw
    // expeditions/vents that feed the same barge fleet + lava_stored economy.
    // Distinct from /smithy/forge-tools (legacy smithy, stays in gameplay).
    const all = scanAllRoutes();
    const forgeFile = all.filter((e) => e.file === 'kingdom-forge.js');
    const paths = new Set(forgeFile.map((e) => `${e.method} ${e.path}`));
    for (const need of [
      'POST /forge/install-upgrade',
      'POST /forge/charcoal-allocate',
      'POST /forge/smelt',
      'POST /forge/temper',
      'POST /forge/craft-gear',
      'POST /forge/build-barge',
      'POST /expedition/lava-draw',
      'GET /lava-vent',
    ]) {
      assert(paths.has(need), `kingdom-forge.js missing ${need}`);
    }
    const gp = all.filter((e) => e.file === 'kingdom-gameplay.js');
    const gpPaths = new Set(gp.map((e) => `${e.method} ${e.path}`));
    assert(
      gpPaths.has('POST /smithy/forge-tools'),
      'kingdom-gameplay.js should still own legacy /smithy/forge-tools',
    );
    return `${forgeFile.length} forge/lava routes`;
  });
}

module.exports = { run, name: '01-endpoint-inventory' };
