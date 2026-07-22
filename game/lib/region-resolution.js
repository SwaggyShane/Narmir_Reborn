// game/lib/region-resolution.js
// Alliance region capture / contest resolution (engine extract S12).
// Live path: game/regen.js → engine.resolveRegions (re-export of this module).

'use strict';

const { EPOCH_NOW } = require('../../lib/db-sql');
const { safeEmit } = require('../safe-socket-emit');

/**
 * Per-region dominance contest. Call once per regen/turn cycle with optional io.
 * @param {object} db
 * @param {object|null} io
 */
async function resolveRegions(db, io) {
  const regions = await db.all('SELECT name, owner_alliance_id, contest_alliance_id, contest_progress FROM regions');
  for (const region of regions) {
    // Calculate current influence in this region
    // Influence = Sum of Land for each alliance
    const tallies = await db.all(
      `
      SELECT am.alliance_id, SUM(k.land) as alliance_land
      FROM kingdoms k
      JOIN alliance_members am ON k.id = am.kingdom_id
      WHERE k.region = $1
      GROUP BY am.alliance_id
      ORDER BY alliance_land DESC
    `,
      [region.name],
    );

    if (!tallies.length) continue;

    const top = tallies[0];
    const topAllianceId = top.alliance_id;
    const topLand = top.alliance_land;

    // To capture, you need either the most land OR a minimum threshold
    // Let's say: if the top alliance has > 50% of the total LAND in the region, they start/continue capture
    const totalLandInRegion = tallies.reduce(
      (sum, t) => sum + t.alliance_land,
      0,
    );
    const hasDominance = topLand > totalLandInRegion * 0.51;

    if (hasDominance) {
      if (region.owner_alliance_id === topAllianceId) {
        // Owner still dominate, reset contest if any
        if (region.contest_alliance_id) {
          await db.run(
            'UPDATE regions SET contest_alliance_id = NULL, contest_progress = 0 WHERE name = $1',
            [region.name],
          );
        }
      } else {
        // Challenging or starting capture
        if (region.contest_alliance_id === topAllianceId) {
          const progress = Math.min(100, region.contest_progress + 10); // 10% per turn cycle?
          if (progress >= 100) {
            // CAPTURED!
            await db.run(
              `
              UPDATE regions 
              SET owner_alliance_id = $1, contest_alliance_id = NULL, contest_progress = 0, last_captured_at = ${EPOCH_NOW}
              WHERE name = $2
            `,
              [topAllianceId, region.name],
            );

            const alliance = await db.get(
              'SELECT name FROM alliances WHERE id = $1',
              [topAllianceId],
            );
            if (io) {
              safeEmit(io, 'chat', {
                room: 'global',
                username: 'System',
                message: `🚩 REGION CAPTURED: The alliance [${alliance.name}] has seized control of ${region.name}!`,
                is_system: true,
              });
              // A4-6: client/src/hooks/useSocket.js listens for this to
              // trigger a worldmap refresh — the chat message above is the
              // player-readable announcement, this is what actually updates
              // the map's region-ownership display.
              safeEmit(io, 'event:world_updated', {});
            }
          } else {
            await db.run(
              'UPDATE regions SET contest_progress = $1 WHERE name = $2',
              [progress, region.name],
            );
          }
        } else {
          // New challenger
          await db.run(
            'UPDATE regions SET contest_alliance_id = $1, contest_progress = 10 WHERE name = $2',
            [topAllianceId, region.name],
          );
        }
      }
    } else {
      // No dominance, decay contest
      if (region.contest_progress > 0) {
        const progress = Math.max(0, region.contest_progress - 5);
        await db.run('UPDATE regions SET contest_progress = $1 WHERE name = $2', [
          progress,
          region.name,
        ]);
      }
    }
  }
}

module.exports = {
  resolveRegions,
};
