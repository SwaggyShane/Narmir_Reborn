const config = require('./config');
const { safeJsonParse } = require('../utils/helpers');
const { EPOCH_NOW_TEXT } = require('../lib/db-sql');

// Fires at most one seasonal event per kingdom per day, drawn from the `events` table.
// Applies the effect and records it in event_log. Returns { updates, message } or null.
async function fireDailyEvent(db, k, season, allEvents = null) {
  const now = Math.floor(Date.now() / 1000);
  if ((now - (k.last_event_at || 0)) < 86400) return null;
  if (!allEvents) {
    allEvents = await db.all(
      `SELECT * FROM events WHERE is_active=1 AND (season=$1 OR season='all') ORDER BY RANDOM() LIMIT 10`,
      [season]
    );
  }
  if (!allEvents.length) return null;
  const eligible = allEvents.filter(e => !e.race_only || e.race_only === k.race);
  if (!eligible.length) return null;
  const ev = eligible[Math.floor(Math.random() * eligible.length)];
  const updates = { last_event_at: now };
  let message = `${config.SEASON_ICONS[season] || ''} ${ev.name}: ${ev.description}`;
  const val = Number(ev.effect_value), dur = Number(ev.effect_duration);
  switch (ev.effect_type) {
    case 'happiness':
      updates.happiness = Math.max(0, Math.min(120, (k.happiness ?? 50) + val));
      message += val > 0 ? ` (+${val} happiness)` : ` (${val} happiness)`; break;
    case 'gold': {
      const d = Math.abs(val) < 1 ? Math.floor((k.gold || 0) * Math.abs(val)) * (val > 0 ? 1 : -1) : Math.floor(val);
      updates.gold = Math.max(0, (k.gold || 0) + d);
      message += d > 0 ? ` (+${d.toLocaleString()} gold)` : ` (${d.toLocaleString()} gold)`; break; }
    case 'food': {
      const fd = Math.abs(val) < 1 ? Math.floor((k.food || 0) * Math.abs(val)) * (val > 0 ? 1 : -1) : Math.floor(val);
      updates.food = Math.max(0, (k.food || 0) + fd);
      message += fd > 0 ? ` (+${fd.toLocaleString()} food)` : ` (${fd.toLocaleString()} food)`; break; }
    case 'population': {
      const pd = Math.abs(val) < 1 ? Math.floor((k.population || 0) * Math.abs(val)) * (val > 0 ? 1 : -1) : Math.floor(val);
      updates.population = Math.max(1000, (k.population || 0) + pd);
      message += pd > 0 ? ` (+${pd.toLocaleString()} pop)` : ` (${pd.toLocaleString()} pop)`; break; }
    case 'farm_yield': case 'military': case 'mana': case 'market': {
      const active = safeJsonParse(k.active_event, {});
      active[ev.effect_type] = { mult: 1 + val, turns_remaining: dur };
      updates.active_event = JSON.stringify(active);
      message += val > 0 ? ` (+${Math.round(val * 100)}% for ${dur} turns)` : ` (${Math.round(val * 100)}% for ${dur} turns)`; break; }
  }
  return { updates, message, eventLogData: [k.id, k.name, ev.key, ev.name, season, now] };
}

async function runRegen(db, io) {
  // Update season first
  const season_row = await db.get("SELECT value FROM server_state WHERE key='current_season'");
  const started_row = await db.get("SELECT value FROM server_state WHERE key='season_started_at'");
  let season = season_row?.value || 'spring';
  const startedAt = parseInt(started_row?.value) || Math.floor(Date.now()/1000);
  const daysSince = (Math.floor(Date.now()/1000) - startedAt) / 86400;
  const SEASON_DUR = { spring:3, summer:5, fall:2, winter:3 };
  if (daysSince >= (SEASON_DUR[season]||3)) {
    const ORDER = ['spring','summer','fall','winter'];
    season = ORDER[(ORDER.indexOf(season)+1)%ORDER.length];
    await db.run("UPDATE server_state SET value=$1 WHERE key='current_season'", [season]);
    await db.run(`UPDATE server_state SET value=${EPOCH_NOW_TEXT} WHERE key='season_started_at'`);
    console.log('[season] Changed to', season);
  }

  // Fire daily events for all kingdoms
  const kingdoms = await db.all('SELECT id, name, race, happiness, gold, food, population, last_event_at, turn, active_event FROM kingdoms WHERE turn > 0');
  const newsInserts = [];
  const kingdomIds = [];
  const kingdomUpdates = [];
  const eventLogInserts = [];

  // Query events once to avoid N+1 per kingdom
  const allEvents = await db.all(
    `SELECT * FROM events WHERE is_active=1 AND (season=$1 OR season='all') ORDER BY RANDOM() LIMIT 10`,
    [season]
  );

  for (const k of kingdoms) {
    const result = await fireDailyEvent(db, k, season, allEvents);
    if (result) {
      kingdomIds.push(k.id);
      kingdomUpdates.push(result.updates);
      newsInserts.push([k.id, 'system', result.message, k.turn]);
      if (result.eventLogData) {
        eventLogInserts.push(result.eventLogData);
      }
    }
  }

  // Batch update all kingdoms in single query using CASE statements per column
  if (kingdomIds.length > 0) {
    const updatesByColumn = {};
    const allKingdomIds = new Set();
    const columns = ['last_event_at','active_event','gold','food','happiness','population'];

    for (let i = 0; i < kingdomIds.length; i++) {
      const k = kingdomIds[i];
      const updates = kingdomUpdates[i];
      allKingdomIds.add(k);

      for (const col of columns) {
        if (updates[col] !== undefined) {
          if (!updatesByColumn[col]) updatesByColumn[col] = { ids: [], values: [] };
          updatesByColumn[col].ids.push(k);
          updatesByColumn[col].values.push(updates[col]);
        }
      }
    }

    if (Object.keys(updatesByColumn).length > 0) {
      const setClauses = [];
      const allValues = [];
      let paramIndex = 1;

      for (const col of columns) {
        if (!updatesByColumn[col]) continue;
        const { ids, values } = updatesByColumn[col];
        const caseWhens = ids.map((_, i) => `WHEN $${paramIndex + i} THEN $${paramIndex + ids.length + i}`).join(' ');
        setClauses.push(`"${col}" = CASE id ${caseWhens} ELSE "${col}" END`);
        allValues.push(...ids, ...values);
        paramIndex += ids.length * 2;
      }

      const kingdomIdList = Array.from(allKingdomIds);
      const idPlaceholders = kingdomIdList.map((_, i) => `$${paramIndex + i}`).join(',');

      await db.run(
        `UPDATE "kingdoms" SET ${setClauses.join(', ')} WHERE id IN (${idPlaceholders})`,
        [...allValues, ...kingdomIdList]
      );
    }
  }

  // Batch insert all news in single query
  if (newsInserts.length > 0) {
    const placeholders = newsInserts.map((_, i) => `($${i*4+1},$${i*4+2},$${i*4+3},$${i*4+4})`).join(',');
    const values = newsInserts.flat();
    await db.run(
      `INSERT INTO news (kingdom_id, type, message, turn_num) VALUES ${placeholders}`,
      values
    );
  }

  // Batch insert all event logs in single query
  if (eventLogInserts.length > 0) {
    const placeholders = eventLogInserts.map((_, i) => `($${i*6+1},$${i*6+2},$${i*6+3},$${i*6+4},$${i*6+5},$${i*6+6})`).join(',');
    const values = eventLogInserts.flat();
    await db.run(
      `INSERT INTO event_log (kingdom_id, kingdom_name, event_key, event_name, season, fired_at) VALUES ${placeholders}`,
      values
    );
  }

  // Resolve regions
  try {
    await require('./engine').resolveRegions(db, io);
  } catch(e) {
    console.error('[regions] resolution error:', e.message);
  }

  const REGEN_AMOUNT = 7;
  const REGEN_MAX = 400;
  await db.run(`
    UPDATE kingdoms
    SET turns_stored = LEAST($1, turns_stored + $2)
    WHERE turns_stored < $3
  `, [REGEN_MAX, REGEN_AMOUNT, REGEN_MAX]);

  // Clean up old logs
  const now = Math.floor(Date.now() / 1000);
  const RETENTION = { EVENTS: 30, NEWS: 30, WAR: 60, SPY: 45 };

  try {
    let totalCleaned = 0;
    let result = await db.run('DELETE FROM event_log WHERE fired_at < $1', [now - RETENTION.EVENTS * 86400]);
    totalCleaned += (result.changes || result.rowCount || 0);
    result = await db.run('DELETE FROM news WHERE created_at < $1', [now - RETENTION.NEWS * 86400]);
    totalCleaned += (result.changes || result.rowCount || 0);
    result = await db.run('DELETE FROM war_log WHERE created_at < $1', [now - RETENTION.WAR * 86400]);
    totalCleaned += (result.changes || result.rowCount || 0);
    result = await db.run('DELETE FROM spy_reports WHERE created_at < $1', [now - RETENTION.SPY * 86400]);
    totalCleaned += (result.changes || result.rowCount || 0);

    if (totalCleaned > 0) {
      console.log(`[db] Cleaned up ${totalCleaned} old log entries`);
    }
  } catch (err) {
    console.error('[db] Log cleanup failed:', err.message);
  }

  await db.run(
    `UPDATE server_state SET value = ${EPOCH_NOW_TEXT} WHERE key = 'last_regen_at'`
  );
  console.log('[turns] Regen complete — +' + REGEN_AMOUNT + ' turns | season: ' + season);
}

async function updateMarketPrices(db) {
  try {
    const prices = await db.all('SELECT * FROM market_prices');
    if (prices.length === 0) return;

    const priceIds = [];
    const newPrices = [];

    for (const p of prices) {
      const drift = (p.base_price - p.current_price) / p.base_price * 0.22;
      const change = 1 + (Math.random() * 0.54 - 0.27) + drift;
      let newPrice = p.current_price * change;
      newPrice = Math.max(p.base_price * 0.15, Math.min(p.base_price * 6.0, newPrice));
      priceIds.push(p.id);
      newPrices.push(newPrice);
    }

    const placeholders = priceIds.map((_, i) => `$${i + 1}`).join(',');
    await db.run(
      `UPDATE market_prices SET current_price = CASE id ${priceIds.map((_, i) => `WHEN $${i + 1} THEN $${priceIds.length + i + 1}::REAL`).join(' ')} END,
       updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
      [...priceIds, ...newPrices]
    );
    require('../cache').marketPriceCache.delete("all_prices");
    require('../cache').marketPriceCache.delete("ai_prices");
    console.log('[market] Prices fluctuated');
  } catch (e) {
    console.error('[market] Fluctuation failed:', e.message);
  }
}

module.exports = {
  fireDailyEvent,
  runRegen,
  updateMarketPrices
};
