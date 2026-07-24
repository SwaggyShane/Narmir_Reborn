const config = require('./config');
const { LORE_SEED } = require('./lore-data');

async function refreshLore(db) {
  const loreRows = await db.all("SELECT id, key_id, title, content, category FROM lore_entries");
  const loadedLore = {};
  const defaultRaces = ['high_elf', 'dwarf', 'dire_wolf', 'human', 'dark_elf', 'orc', 'vampire', 'narmir', 'general'];
  defaultRaces.forEach(r => loadedLore[r] = []);
  loreRows.forEach(r => {
    const cat = r.category || 'general';
    if (!loadedLore[cat]) loadedLore[cat] = [];
    loadedLore[cat].push({ id: r.key_id || `lore_${r.id}`, title: r.title || 'Untitled', msg: r.content });
  });
  config.LORE_EVENTS = loadedLore;

  // JUNK_PRIZES is NOT reloaded from the `random_events` table here. That
  // table (db/init-data.js's initializeRandomEvents) holds the original 25
  // junk messages from before JUNK_PRIZES was rewritten into the 150-entry
  // string-id array literal in game/config.js — its auto-increment integer
  // `id` column has nothing to do with the string ids (`"damp_sock"`,
  // `"poverty_book"`, etc.) that game/lib/gameplay.js's junkPrize() and the
  // Field Collector achievement (needs 50 unique string ids) key off of.
  // This used to reassign `config.JUNK_PRIZES = randomEventRows` on every
  // boot, clobbering the real 150-entry array with those 25 legacy
  // {id: <int>, content: <string>} rows — every junk find after that used
  // an integer id, permanently stuck cycling the same 25 outcomes and never
  // able to reach 50 unique collected items for the achievement.

  const junkRows = await db.all("SELECT id, content FROM junk_events");
  config.JUNK_EVENTS = junkRows.map(r => r.content);

  const taxRows = await db.all("SELECT id, content FROM tax_events");
  config.TAX_EVENTS = taxRows.map(r => r.content);
}

module.exports = { refreshLore, LORE_SEED };
