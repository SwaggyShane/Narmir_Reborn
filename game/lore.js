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

  const randomEventRows = await db.all("SELECT id, content FROM random_events");
  config.JUNK_PRIZES = randomEventRows;

  const junkRows = await db.all("SELECT id, content FROM junk_events");
  config.JUNK_EVENTS = junkRows.map(r => r.content);

  const taxRows = await db.all("SELECT id, content FROM tax_events");
  config.TAX_EVENTS = taxRows.map(r => r.content);
}

module.exports = { refreshLore, LORE_SEED };
