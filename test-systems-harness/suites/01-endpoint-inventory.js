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

  await report.run(system, 'gameplay owns turn/hire/expedition', async () => {
    const all = scanAllRoutes();
    const gp = all.filter((e) => e.file === 'kingdom-gameplay.js');
    const paths = new Set(gp.map((e) => `${e.method} ${e.path}`));
    for (const need of ['POST /turn', 'POST /hire']) {
      assert(paths.has(need), `kingdom-gameplay.js missing ${need}`);
    }
    return `${gp.length} gameplay routes`;
  });
}

module.exports = { run, name: '01-endpoint-inventory' };
