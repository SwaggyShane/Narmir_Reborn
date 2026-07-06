require('dotenv').config();
const { initDb } = require('../db/schema');
const { pixelToHex } = require('./hex-utils');
const { getKingdomMapCoords } = require('./world-map-coords');

(async () => {
  await initDb({ maxPool: 2, minPool: 1 });
  
  const k = { id: 1, race: 'dwarf' };
  const coords = getKingdomMapCoords(k);
  const hex = pixelToHex(coords.map_x, coords.map_y);
  
  console.log(`pixelToHex(${coords.map_x}, ${coords.map_y}) = col=${hex.col}, row=${hex.row}`);
  
  // Also check nearby pixels to see the range
  console.log(`\nNearby pixel conversions:`);
  for (let dx = -50; dx <= 50; dx += 25) {
    for (let dy = -50; dy <= 50; dy += 25) {
      const h = pixelToHex(coords.map_x + dx, coords.map_y + dy);
      console.log(`  (${coords.map_x + dx}, ${coords.map_y + dy}) -> col=${h.col}, row=${h.row}`);
    }
  }
  
  process.exit(0);
})();
