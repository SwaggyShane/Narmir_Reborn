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

  await report.run(system, 'prestige owns rebirth/evolution cluster', async () => {
    // Prestige & Dragon Evolution split out of kingdom-gameplay.js into its
    // own file (A2-5, 2026-07-19) — genuinely coupled, not just adjacent:
    // GET /evolution reads prestige_level as its unlock gate.
    const all = scanAllRoutes();
    const prestigeFile = all.filter((e) => e.file === 'kingdom-prestige.js');
    const paths = new Set(prestigeFile.map((e) => `${e.method} ${e.path}`));
    for (const need of [
      'POST /rebirth',
      'POST /evolution/start',
      'POST /evolution/abort',
      'GET /evolution',
    ]) {
      assert(paths.has(need), `kingdom-prestige.js missing ${need}`);
    }
    return `${prestigeFile.length} prestige/evolution routes`;
  });

  await report.run(system, 'attunements owns inventory/attunements/synergies cluster', async () => {
    // Inventory + World Fragment Attunements + Synergies split out of
    // kingdom-gameplay.js into its own file (A2-6, 2026-07-19) — attunements
    // and synergies share real state (fragment_bonuses), inventory is a
    // separate small read-only route kept in the same file rather than
    // split further.
    const all = scanAllRoutes();
    const attuneFile = all.filter((e) => e.file === 'kingdom-attunements.js');
    const paths = new Set(attuneFile.map((e) => `${e.method} ${e.path}`));
    for (const need of [
      'GET /inventory',
      'GET /attunements',
      'GET /available-attunements',
      'POST /attune-fragment',
      'POST /remove-attunement',
      'GET /contributing-synergies',
      'GET /synergy-status',
      'GET /synergy-cooldown',
      'POST /activate-synergy-ability',
    ]) {
      assert(paths.has(need), `kingdom-attunements.js missing ${need}`);
    }
    return `${attuneFile.length} inventory/attunements/synergies routes`;
  });

  await report.run(system, 'worldmap owns map/locations/rivers/scout-visibility-debug cluster', async () => {
    // World Map, Locations, Rivers, and Scout Visibility Debug split out of
    // kingdom-gameplay.js into its own file (A2-7, 2026-07-19) — layers of
    // the same world-exploration/visibility domain: /locations reads
    // discovered_kingdoms, /world-map renders it gated by seenCells,
    // /fix-visibility resets the seenCells/currentCells bitmaps, and
    // /debug/scouts exposes scout_progress that drives seenCells reveals.
    const all = scanAllRoutes();
    const wmFile = all.filter((e) => e.file === 'kingdom-worldmap.js');
    const paths = new Set(wmFile.map((e) => `${e.method} ${e.path}`));
    for (const need of [
      'GET /locations',
      'POST /locations/steal-map',
      'GET /world-map',
      'GET /world-river-flow',
      'POST /fix-visibility',
      'GET /debug/scouts',
    ]) {
      assert(paths.has(need), `kingdom-worldmap.js missing ${need}`);
    }
    return `${wmFile.length} world-map/locations/rivers/debug routes`;
  });

  await report.run(system, 'social owns news/chat/scouts/portrait/happiness cluster', async () => {
    // News, Chat, Scout Status, Portrait, and Happiness split out of
    // kingdom-gameplay.js into its own file (A2-8, 2026-07-19) — last of the
    // gameplay.js split series, the remainder that didn't cluster with
    // anything else.
    const all = scanAllRoutes();
    const socialFile = all.filter((e) => e.file === 'kingdom-social.js');
    const paths = new Set(socialFile.map((e) => `${e.method} ${e.path}`));
    for (const need of [
      'GET /scouts',
      'GET /chat/global',
      'GET /news/list',
      'DELETE /news/clear',
      'POST /portrait',
      'DELETE /portrait',
      'GET /happiness-status',
      'GET /happiness-events',
    ]) {
      assert(paths.has(need), `kingdom-social.js missing ${need}`);
    }
    return `${socialFile.length} news/chat/scouts/portrait/happiness routes`;
  });

  await report.run(system, 'admin split owns its 7 domains (A2-9)', async () => {
    // routes/admin.js (2363 lines, 68 direct + 16 dualRoute-registered
    // routes = 84 logical routes) split into 7 domain files (A2-9,
    // 2026-07-19); admin.js itself became a thin composer mirroring
    // kingdom.js's orderedRouters pattern. requireAdmin + CSRF are applied
    // once in the composer, not per sub-file — see routes/admin.js.
    const all = scanAllRoutes();
    const byFile = (f) => all.filter((e) => e.file === f);
    const has = (f, method, p) => byFile(f).some((e) => e.method === method && e.path === p);

    const EXPECTED_COUNTS = {
      'admin-kingdoms.js': 21,
      'admin-ai.js': 7,
      'admin-events.js': 21, // 9 plain + 6 dualRoute pairs (12 registrations)
      'admin-lore.js': 25, // 5 plain + 10 dualRoute pairs (20 registrations)
      'admin-goals.js': 4,
      'admin-config.js': 8,
      'admin-audit.js': 14,
    };
    for (const [file, count] of Object.entries(EXPECTED_COUNTS)) {
      assert(byFile(file).length === count, `${file}: expected ${count} routes, got ${byFile(file).length}`);
    }

    const CANARIES = [
      ['admin-kingdoms.js', 'POST', '/ban'],
      ['admin-kingdoms.js', 'POST', '/set-kingdom'],
      ['admin-kingdoms.js', 'GET', '/chat-mods'],
      ['admin-ai.js', 'POST', '/ai/seed'],
      ['admin-ai.js', 'GET', '/ai/synopsis'],
      ['admin-events.js', 'POST', '/wishlist'],
      ['admin-events.js', 'GET', '/bug_reports'], // legacy dualRoute alias
      ['admin-lore.js', 'GET', '/lore'],
      ['admin-lore.js', 'POST', '/random_events'], // legacy dualRoute alias
      ['admin-goals.js', 'POST', '/goals/edit'],
      ['admin-config.js', 'POST', '/announce'],
      ['admin-config.js', 'POST', '/sounds/upload'],
      ['admin-audit.js', 'POST', '/security-audit-full'],
      ['admin-audit.js', 'GET', '/audit-history'],
    ];
    for (const [file, method, p] of CANARIES) {
      assert(has(file, method, p), `${file} missing ${method} ${p}`);
    }

    return `7 files, ${Object.values(EXPECTED_COUNTS).reduce((a, b) => a + b, 0)} routes total`;
  });
}

module.exports = { run, name: '01-endpoint-inventory' };
