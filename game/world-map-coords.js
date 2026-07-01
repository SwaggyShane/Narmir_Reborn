/**
 * Shared world-map coordinate helpers.
 * Map space matches WorldmapRenderer viewBox: 900 x 650.
 */

const MAP_WIDTH = 900;
const MAP_HEIGHT = 650;

const REGION_SEEDS = {
  dwarf: [
    [220, 180], [280, 160], [330, 220], [300, 280], [240, 320], [180, 260], [260, 240], [200, 320],
  ],
  high_elf: [
    [500, 100], [580, 90], [640, 140], [660, 220], [600, 260], [480, 240], [540, 160], [580, 210],
  ],
  orc: [
    [630, 330], [700, 330], [750, 400], [720, 480], [620, 510], [560, 460], [660, 390], [600, 410],
  ],
  dark_elf: [
    [420, 330], [480, 350], [480, 440], [420, 500], [350, 460], [320, 380], [400, 410], [380, 450],
  ],
  human: [
    [200, 430], [240, 420], [280, 490], [240, 540], [150, 530], [140, 460], [210, 490], [180, 500],
  ],
  dire_wolf: [
    [80, 350], [140, 340], [140, 410], [100, 490], [60, 450], [80, 390], [110, 450], [50, 400],
  ],
  vampire: [
    [360, 420], [400, 440], [430, 500], [370, 540], [320, 480], [340, 390], [390, 460], [310, 430],
  ],
  wood_elf: [
    [460, 180], [520, 200], [560, 260], [500, 300], [440, 280], [480, 220], [530, 240], [420, 240],
  ],
  ogre: [
    [700, 200], [760, 220], [780, 280], [720, 320], [660, 300], [740, 260], [680, 250], [750, 300],
  ],
};

const DISTANCE_MIN = 600;
const DISTANCE_MAX = 28800;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function kingdomSlot(kingdomId, race) {
  const seeds = REGION_SEEDS[race] || [];
  if (!seeds.length) return 0;
  return Math.abs(Number(kingdomId) || 0) % seeds.length;
}

function kingdomJitter(kingdomId) {
  const id = Math.abs(Number(kingdomId) || 0);
  return {
    x: ((id * 17 + 3) % 30) - 15,
    y: ((id * 13 + 7) % 30) - 15,
  };
}

function getKingdomMapCoords(kingdom) {
  const race = kingdom?.race || 'human';
  const kingdomId = kingdom?.id ?? 0;
  const seeds = REGION_SEEDS[race] || [[MAP_WIDTH / 2, MAP_HEIGHT / 2]];
  const seed = seeds[kingdomSlot(kingdomId, race)];
  const jitter = kingdomJitter(kingdomId);
  return {
    map_x: Math.round(seed[0] + jitter.x),
    map_y: Math.round(seed[1] + jitter.y),
  };
}

function normalizeDistance(distance) {
  const span = DISTANCE_MAX - DISTANCE_MIN;
  if (span <= 0) return 0.5;
  return clamp((Number(distance) - DISTANCE_MIN) / span, 0, 1);
}

function placeResourceNodeCoords({ kingdomId, nodeId, race, distance, kingdomX, kingdomY }) {
  const originX = Number.isFinite(kingdomX)
    ? kingdomX
    : getKingdomMapCoords({ id: kingdomId, race }).map_x;
  const originY = Number.isFinite(kingdomY)
    ? kingdomY
    : getKingdomMapCoords({ id: kingdomId, race }).map_y;

  const t = normalizeDistance(distance);
  const radius = 28 + t * 110;
  const angleDeg = ((Number(nodeId) * 47 + Number(kingdomId) * 13) % 360);
  const angle = (angleDeg * Math.PI) / 180;

  return {
    map_x: Math.round(clamp(originX + Math.cos(angle) * radius, 24, MAP_WIDTH - 24)),
    map_y: Math.round(clamp(originY + Math.sin(angle) * radius, 24, MAP_HEIGHT - 24)),
  };
}

async function backfillResourceNodeMapCoords(db) {
  const rows = await db.all(`
    SELECT rn.id, rn.kingdom_id, rn.distance, rn.map_x, rn.map_y, k.race
    FROM resource_nodes rn
    JOIN kingdoms k ON k.id = rn.kingdom_id
    WHERE rn.map_x IS NULL OR rn.map_y IS NULL
  `);
  for (const row of rows) {
    const home = getKingdomMapCoords({ id: row.kingdom_id, race: row.race });
    const coords = placeResourceNodeCoords({
      kingdomId: row.kingdom_id,
      nodeId: row.id,
      race: row.race,
      distance: row.distance,
      kingdomX: home.map_x,
      kingdomY: home.map_y,
    });
    await db.run(
      'UPDATE resource_nodes SET map_x = $1, map_y = $2 WHERE id = $3',
      [coords.map_x, coords.map_y, row.id],
    );
  }
  return rows.length;
}

module.exports = {
  MAP_WIDTH,
  MAP_HEIGHT,
  REGION_SEEDS,
  getKingdomMapCoords,
  placeResourceNodeCoords,
  backfillResourceNodeMapCoords,
};