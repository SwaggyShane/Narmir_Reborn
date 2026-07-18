'use strict';

/**
 * Initial data seeding and post-schema initialization.
 * Extracted from initDb in schema.js to reduce bloat.
 */

async function initializeRegions(db) {
  const REGION_DATA = [
    ['The Iron Holds',      'construction'],
    ['The Silverwood',      'magic'],
    ['The Bloodplains',     'military'],
    ['The Underspire',      'stealth'],
    ['The Heartlands',      'economy'],
    ['The Ashfang Wilds',   'military']
  ];
  for (const [name, bonus] of REGION_DATA) {
    await db.run(
      'INSERT INTO regions (name, bonus_type) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
      [name, bonus],
    );
  }
}

async function initializeAdditionalColumns(db, getTableColumns, addCol) {
  const pCols = await getTableColumns('players');
  if (!pCols.includes('is_admin'))   await addCol('players', 'is_admin',   'INTEGER NOT NULL DEFAULT 0');
  if (!pCols.includes('is_banned'))  await addCol('players', 'is_banned',  'INTEGER NOT NULL DEFAULT 0');
  if (!pCols.includes('ban_reason')) await addCol('players', 'ban_reason', 'TEXT');
  if (!pCols.includes('is_ai'))      await addCol('players', 'is_ai',      'INTEGER NOT NULL DEFAULT 0');

  const nCols = await getTableColumns('news');
  if (!nCols.includes('turn_num')) await addCol('news', 'turn_num', 'INTEGER NOT NULL DEFAULT 0');
  if (!nCols.includes('combat_log_id')) await addCol('news', 'combat_log_id', 'INTEGER');

  if (!pCols.includes('is_chat_mod'))  await addCol('players', 'is_chat_mod',  'INTEGER NOT NULL DEFAULT 0');
  if (!pCols.includes('chat_banned'))  await addCol('players', 'chat_banned',  'INTEGER NOT NULL DEFAULT 0');
  if (!pCols.includes('chat_ban_reason')) await addCol('players', 'chat_ban_reason', 'TEXT');
  if (!pCols.includes('chat_color'))  await addCol('players', 'chat_color',  "TEXT DEFAULT NULL");
  if (!pCols.includes('chat_name'))   await addCol('players', 'chat_name',   "TEXT DEFAULT NULL");

  // chat_messages: room + soft (used by GET /chat/global and sockets). Older DBs
  // only had id/kingdom_id/player_id/username/message/created_at from base DDL.
  const chatCols = await getTableColumns('chat_messages');
  if (!chatCols.includes('room')) await addCol('chat_messages', 'room', "TEXT NOT NULL DEFAULT 'global'", chatCols);
  if (!chatCols.includes('deleted')) await addCol('chat_messages', 'deleted', 'INTEGER NOT NULL DEFAULT 0', chatCols);

  // Additional evolved columns (moved from schema.js bloat for modularity)
  if (!pCols.includes('email')) await addCol('players', 'email', 'TEXT');

  const aCols = await getTableColumns('alliances');
  const allianceAdds = [
    ['vault_gold', 'INTEGER NOT NULL DEFAULT 0'],
    ['projects', "TEXT NOT NULL DEFAULT '{}'"],
    ['vault_log', "TEXT NOT NULL DEFAULT '[]'"],
  ];
  for (const [col, def] of allianceAdds) {
    if (!aCols.includes(col)) await addCol('alliances', col, def, aCols);
  }

  const eCols = await getTableColumns('expeditions');
  const expAdds = [
    ['seen', 'INTEGER NOT NULL DEFAULT 0'],
    ['food_taken', 'INTEGER NOT NULL DEFAULT 0'],
    ['rewards_claimed', 'INTEGER NOT NULL DEFAULT 0'],
    ['extra_data', 'TEXT'],
    ['engineers', 'INTEGER NOT NULL DEFAULT 0'],
    ['rangers', 'INTEGER NOT NULL DEFAULT 0'],
    ['fighters', 'INTEGER NOT NULL DEFAULT 0'],
  ];
  for (const [col, def] of expAdds) {
    if (!eCols.includes(col)) await addCol('expeditions', col, def, eCols);
  }

  const lCols = await getTableColumns('lore_entries');
  const loreAdds = [
    ['title', "TEXT NOT NULL DEFAULT ''"],
    ['category', "TEXT NOT NULL DEFAULT 'general'"],
    ['key_id', "TEXT NOT NULL DEFAULT ''"],
  ];
  for (const [col, def] of loreAdds) {
    if (!lCols.includes(col)) await addCol('lore_entries', col, def, lCols);
  }

  const rnCols = await getTableColumns('resource_nodes');
  const rnAdds = [
    ['map_x', 'INTEGER'],
    ['map_y', 'INTEGER'],
    ['terrain', 'TEXT'],
  ];
  for (const [col, def] of rnAdds) {
    if (!rnCols.includes(col)) await addCol('resource_nodes', col, def, rnCols);
  }

  // bounties columns (posted_by for placer, claimed_by_id for warfare claims)
  // were referenced in code but may be absent on legacy tables from before DDL carve.
  const bCols = await getTableColumns('bounties');
  if (!bCols.includes('posted_by')) {
    await addCol('bounties', 'posted_by', 'INTEGER');
    console.log('[db] Added missing posted_by column to bounties (for legacy tables)');
  }
  if (!bCols.includes('claimed_by_id')) {
    await addCol('bounties', 'claimed_by_id', 'INTEGER');
    console.log('[db] Added missing claimed_by_id column to bounties');
  }

  // news.is_read: read by game/sockets.js and routes/kingdom-gameplay.js for
  // unread-count queries, but was never added to the DDL.
  if (!nCols.includes('is_read')) await addCol('news', 'is_read', 'INTEGER NOT NULL DEFAULT 0', nCols);

  // forum_boards category columns: lib/forum-seed.js groups boards under
  // categories (community/warfare/alliances/roleplaying), but the DDL only
  // ever defined the flat pre-category shape.
  const fbCols = await getTableColumns('forum_boards');
  const fbAdds = [
    ['category_key', 'TEXT'],
    ['category_label', 'TEXT'],
    ['category_order', 'INTEGER'],
  ];
  for (const [col, def] of fbAdds) {
    if (!fbCols.includes(col)) await addCol('forum_boards', col, def, fbCols);
  }

  // admin_goal_definitions: routes/admin.js reads/writes label, min_target,
  // max_target, prize_type, prize_multiplier, but the DDL only ever defined
  // title/description (an earlier goal-definition shape). Since the app no
  // longer supplies title/description, they must stop being NOT NULL or
  // every insert from routes/admin.js would fail constraint checks.
  const agCols = await getTableColumns('admin_goal_definitions');
  const agAdds = [
    ['label', 'TEXT'],
    ['min_target', 'INTEGER'],
    ['max_target', 'INTEGER'],
    ['prize_type', 'TEXT'],
    ['prize_multiplier', 'NUMERIC'],
  ];
  for (const [col, def] of agAdds) {
    if (!agCols.includes(col)) await addCol('admin_goal_definitions', col, def, agCols);
  }
  try {
    await db.run('ALTER TABLE admin_goal_definitions ALTER COLUMN title DROP NOT NULL');
    await db.run('ALTER TABLE admin_goal_definitions ALTER COLUMN description DROP NOT NULL');
  } catch (e) {
    console.error('[db] Migration: failed to relax admin_goal_definitions NOT NULL constraints:', e.message);
  }

  // heroes.status/hp/max_hp: routes/hero.js inserts them and game/heroes.js's
  // recruitHero() default object includes them, but the DDL only ever
  // defined the base identity columns -- every turn's "idle heroes" query
  // (routes/kingdom-gameplay.js) and combat's "idle heroes" lookups
  // (routes/kingdom-warfare.js) were failing on every single turn.
  const hCols = await getTableColumns('heroes');
  if (!hCols.includes('status')) await addCol('heroes', 'status', "TEXT NOT NULL DEFAULT 'idle'", hCols);
  if (!hCols.includes('hp')) await addCol('heroes', 'hp', 'INTEGER NOT NULL DEFAULT 200', hCols);
  if (!hCols.includes('max_hp')) await addCol('heroes', 'max_hp', 'INTEGER NOT NULL DEFAULT 200', hCols);

  // news.message: bulkInsertNews() and the client's NewsPanel.jsx both read
  // and write a single "message" field, but the DDL only ever defined the
  // older title/content shape -- every turn's news insert (and its dedup
  // pre-check) was failing on every single turn.
  const newsCols = await getTableColumns('news');
  if (!newsCols.includes('message')) await addCol('news', 'message', 'TEXT', newsCols);
  try {
    await db.run('ALTER TABLE news ALTER COLUMN title DROP NOT NULL');
    await db.run('ALTER TABLE news ALTER COLUMN content DROP NOT NULL');
  } catch (e) {
    console.error('[db] Migration: failed to relax news NOT NULL constraints:', e.message);
  }

  // spy_reports.target_name/outcome: routes/kingdom-warfare.js inserts and
  // reads both (the covert-spy INSERT, the /spy-reports GET, and the
  // alliance intel GET), but the DDL only ever defined the base columns --
  // every spy report insert and every spy-reports/alliance-intel fetch was
  // failing outright.
  const srCols = await getTableColumns('spy_reports');
  if (!srCols.includes('target_name')) await addCol('spy_reports', 'target_name', 'TEXT', srCols);
  if (!srCols.includes('outcome')) await addCol('spy_reports', 'outcome', 'TEXT', srCols);

  // world_state.elevation_grid: precomputed elevation data (game/world-elevation.js's
  // ensureWorldElevation, called from schema.js after world seed load). Ported from
  // the never-run db/migrations/001-add-elevation-grid.js (that directory has no
  // runner anywhere in the codebase) to the addCol pattern that actually executes.
  const wsCols = await getTableColumns('world_state');
  if (!wsCols.includes('elevation_grid')) await addCol('world_state', 'elevation_grid', "JSONB NOT NULL DEFAULT '{}'", wsCols);

  // war_log: routes/kingdom-warfare.js and routes/kingdom-gameplay.js insert
  // and read action_type/outcome/detail/obscured (7+ INSERT sites, plus the
  // GET /war-log SELECT), but the DDL only ever defined result/gold_stolen/
  // land_gained (never referenced by any of those queries) -- every single
  // war_log INSERT in the game was failing outright, both on the missing
  // columns and on the orphaned `result` column's NOT NULL constraint with
  // no default and no value ever supplied for it. Found while verifying the
  // Combat V2 default-flip via the route-persistence smoke test.
  const wlCols = await getTableColumns('war_log');
  if (!wlCols.includes('action_type')) await addCol('war_log', 'action_type', 'TEXT', wlCols);
  if (!wlCols.includes('outcome')) await addCol('war_log', 'outcome', 'TEXT', wlCols);
  if (!wlCols.includes('detail')) await addCol('war_log', 'detail', 'TEXT', wlCols);
  if (!wlCols.includes('obscured')) await addCol('war_log', 'obscured', 'INTEGER NOT NULL DEFAULT 0', wlCols);
  if (wlCols.includes('result')) {
    try {
      await db.run('ALTER TABLE war_log ALTER COLUMN result DROP NOT NULL');
    } catch (e) {
      console.log('[db] Migration: war_log.result NOT NULL drop skipped:', e.message);
    }
  }
}

async function initializeMarketPrices(db) {
  const freshDefaultPrices = [
    ['food', 0.5, 0.5],
    ['wood', 1000.0, 1000.0],
    ['stone', 5000.0, 5000.0],
    ['iron', 10000.0, 10000.0],
    ['coal', 2000.0, 2000.0],
    ['steel', 20000.0, 20000.0],
    ['mana', 2.0, 2.0],
    ['weapons', 25.0, 25.0],
    ['armor', 25.0, 25.0],
    ['war_machines', 1000.0, 1000.0],
    ['ballistae', 1000.0, 1000.0],
    ['land', 5000.0, 5000.0]
  ];
  for (const [id, current, base] of freshDefaultPrices) {
    await db.run(
      'INSERT INTO market_prices (id, current_price, base_price) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
      [id, current, base]
    );
  }
}

async function initializeDefaultEvents(db) {
  const defaultEvents = [
    ['spring_bloom', 'Spring Bloom', 'Warm rains encourage growth.', 'spring', 'farm_yield', 0.10, 5, null, 1],
    ['spring_floods', 'Spring Floods', 'Rising rivers damage farmland.', 'spring', 'happiness', -5, 3, null, 0],
    ['pollination_boom', 'Pollination Boom', 'A great flowering swells the population.', 'spring', 'population', 500, 1, null, 1],
    ['warm_winds', 'Warm Winds', 'A pleasant breeze lifts spirits.', 'spring', 'happiness', 5, 1, null, 1],
    ['abundant_harvest', 'Abundant Harvest', 'Exceptional sun yields record crops.', 'summer', 'food', 0.15, 1, null, 1],
    ['heat_wave', 'Heat Wave', 'Scorching heat wilts crops and happiness.', 'summer', 'farm_yield', -0.10, 3, null, 0],
    ['travelling_merch', 'Travelling Merchants', 'Exotic goods boost market income.', 'summer', 'gold', 0.02, 3, null, 1],
    ['border_skirmish', 'Border Skirmish', 'Bandits raid your outlying farms.', 'summer', 'food', -0.05, 1, null, 0],
    ['harvest_festival', 'Harvest Festival', 'The kingdom celebrates a bountiful autumn.', 'fall', 'happiness', 10, 1, null, 1],
    ['early_frost', 'Early Frost', 'An unexpected frost kills late crops.', 'fall', 'farm_yield', -0.15, 2, null, 0],
    ['trade_boom', 'Trade Boom', 'Merchants flock to your markets.', 'fall', 'gold', 0.05, 3, null, 1],
    ['rat_infestation', 'Rat Infestation', 'Vermin consume stored food.', 'fall', 'food', -0.10, 1, null, 0],
    ['blizzard', 'Blizzard', 'A fierce storm cripples farms and happiness.', 'winter', 'farm_yield', -0.20, 2, null, 0],
    ['refugees', 'Refugees Arrive', 'Displaced families seek shelter.', 'winter', 'population', 1000, 1, null, 1],
    ['winter_plague', 'Winter Plague', 'Disease spreads through the cold months.', 'winter', 'population', -0.02, 1, null, 0],
    ['wolf_raids', 'Wolf Raids', 'Dire wolves raid border farms.', 'winter', 'food', -0.08, 1, null, 0],
    ['ice_trade', 'Ice Trade', 'Dwarven merchants profit from winter routes.', 'winter', 'gold', 0.05, 2, 'dwarf', 1],
    ['dire_wolf_hunt', 'Great Hunt', 'Dire Wolf hunters return laden with prey.', 'fall', 'food', 0.20, 1, 'dire_wolf', 1],
    ['elven_bloom', 'Elven Bloom', 'High Elf mages channel spring energy.', 'spring', 'mana', 0.15, 3, 'high_elf', 1],
    ['dark_elf_shadow', 'Shadow Markets', 'Dark Elf smugglers exploit the long nights.', 'winter', 'gold', 0.08, 2, 'dark_elf', 1],
    ['orc_rampage', 'Orc Rampage', 'Summer heat fuels Orcish aggression.', 'summer', 'military', 0.10, 2, 'orc', 1]
  ];
  for (const [key, name, description, season, effect_type, effect_value, effect_duration, race_only, is_positive] of defaultEvents) {
    await db.run(
      `INSERT INTO events (key,name,description,season,effect_type,effect_value,effect_duration,race_only,is_positive) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (key) DO NOTHING`,
      [key, name, description, season, effect_type, effect_value, effect_duration, race_only, is_positive]
    );
  }
}

async function initializeWishlist(db) {
  const hasWishlist = await db.get("SELECT 1 FROM wishlist LIMIT 1");
  if (hasWishlist) return;
  const defaultWishlist = [
    { category: 'Gameplay', desc: 'Spell casting target history — remember last target per spell' },
    { category: 'Gameplay', desc: 'Diplomacy — formal non-aggression pacts and tribute' },
    { category: 'Gameplay', desc: 'Resource loans — player-run debt and interest mechanics' },
    { category: 'Combat', desc: 'Alliance war — alliances can declare war on each other' },
    { category: 'Combat', desc: 'Artifact hunting — high-risk expeditions for unique items' },
    { category: 'Combat', desc: 'Naval combat — build ships to contest ocean territories' },
    { category: 'Economy', desc: 'Auction house — bid on unique gear and captured heroes' },
    { category: 'Economy', desc: 'Prestige economy — prestige kingdoms get permanent market bonuses' },
    { category: 'World', desc: 'More races — Gnome (inventor), Troll (regenerating), Halfling (stealth)' },
    { category: 'World', desc: 'Dungeons & Raids — PvE multi-kingdom boss battles' },
    { category: 'World', desc: 'Resource biomes — specific lands granting unique materials' },
    { category: 'Polish & Management', desc: 'Custom kingdom banner/sigil generator' },
    { category: 'Polish & Management', desc: 'Full iOS / Android PWA wrapping' },
    { category: 'Polish & Management', desc: 'Dark/light/high-contrast theme toggles' },
    { category: 'Polish & Management', desc: 'Email/Push notifications — optional alerts for attacks, expedition return' },
    { category: 'Polish & Management', desc: 'Step-by-step interactive new player tutorial' },
    { category: 'Economy', desc: 'Caravans — physical trade routes that can be ambushed' },
    { category: 'Combat', desc: 'Generals — train commanding officers that boost army happiness during battles' },
    { category: 'World', desc: 'Weather Systems — dynamic weather impacting crop yields and battle visibility' },
    { category: 'Gameplay', desc: 'Espionage Network — permanent passive intel gathering on nearby kingdoms' },
    { category: 'Combat', desc: 'Mercenary Guilds — hire specialized factions with unique unit types' },
    { category: 'Polish & Management', desc: 'Global Market History — graphs showing price fluctuations over time' },
    { category: 'World', desc: 'Dynamic World Events — comets, earthquakes, eclipses that provide global modifiers' },
    { category: 'Gameplay', desc: 'Religion/Pantheon — worship different gods for diverse domain bonuses' },
    { category: 'Combat', desc: 'Terrain Advantages — defending in mountains, forests, or plains affects combat stats' },
    { category: 'Gameplay', desc: 'Laws & Edicts — enact kingdom-wide policies with pros and cons' },
    { category: 'Economy', desc: 'Smuggling Rings — illegal market trades that bypass taxes' },
    { category: 'World', desc: 'Wandering Beasts — powerful monsters that attack random kingdoms until defeated' },
    { category: 'Polish & Management', desc: 'Customizable Palace UI — visually upgrade the player dashboard as level increases' },
    { category: 'Gameplay', desc: 'Prisoners of War — ransom captured enemy troops for gold or execute for happiness' },
    { category: 'Combat', desc: 'Naval Trade Routes — ocean routes for faster gold generation but higher risk' }
  ];
  for (const w of defaultWishlist) {
    await db.run("INSERT INTO wishlist (category, description) VALUES ($1, $2)", [w.category, w.desc]);
  }
}

async function initializeRandomEvents(db) {
  const hasEvents = await db.get("SELECT 1 FROM random_events LIMIT 1");
  if (hasEvents) return;
  const defaultRandomEvents = [
    'a suspiciously damp sock',
    'a map to a location that no longer exists',
    'a very confident fortune cookie with no fortune inside',
    'a half-eaten ration bar of unknown vintage',
    'a decorative rock (it does nothing)',
    'a pamphlet titled "10 Reasons Orcs Are Actually Quite Misunderstood"',
    'a jar of mysterious grey paste (do not eat)',
    'a slightly bent sword that the previous owner called "Destiny"',
    'a tiny flag from a kingdom that fell 300 years ago',
    'a love letter addressed to someone named Grimbold',
    'a collection of 47 different types of dirt',
    'a boot (just the one)',
    'a certificate of participation from the Third Annual Swamp Festival',
    'a wheel of cheese that has achieved sentience (probably)',
    'a bag of magic beans that are, on closer inspection, just beans',
    'a very thorough guide to knitting (no one in your kingdom knows how to read)',
    'a suspicious smell that follows rangers home',
    'a crystal ball showing only static',
    'an extremely detailed painting of a cloud',
    "a dwarf's shopping list (mostly cheese)",
    'a torch that only works in daylight',
    'a book called "How To Stop Being Poor" — all pages blank',
    'a rusty key to an unknown lock',
    'a proclamation declaring your kingdom "pretty good, probably"',
    'a coupon for 10% off at an inn that burned down decades ago',
  ];
  for (const e of defaultRandomEvents) {
    await db.run("INSERT INTO random_events (content) VALUES ($1)", [e]);
  }
}

async function initializeTaxEvents(db) {
  const hasTaxEvents = await db.get("SELECT 1 FROM tax_events LIMIT 1");
  if (hasTaxEvents) return;
  const defaultTaxEvents = [
    'Citizens held a spontaneous parade in your honor. +Happiness!',
    'A grateful merchant left a small chest of exotic spices at the keep.',
    'Happy farmers brought in an unexpected surplus harvest this turn.',
    'The local bard wrote a popular song praising your generosity.',
    'A wealthy citizen made a voluntary donation to the treasury.',
    'Children are playing in the streets, pretending to be you. It is adorable.',
    'A baker sent a massive, intricately decorated cake to the castle.',
    'Local craftsmen repaired the city gates for free out of gratitude.',
    'A passing trade caravan heard of your fairness and gave a discount on goods.',
    'A minor skirmish in the market was broken up peacefully by happy citizens.',
    'The militia actually showed up to training with a smile today.',
    'A rare flower bloomed in the plaza, which the locals view as a blessing on your reign.',
    'Citizens volunteered to clean the slums, improving public health.',
    'A traveling scholar decided to settle here, impressed by the high happiness.',
    'Toasted effigies of rival lords were burned in a joyful festival.',
    'Someone anonymously paid off the debts of several poor families.',
    'A mysterious benefactor repaired the old bell tower.',
    'A group of rangers brought back extra pelts as a gift for the crown.',
    'The town square is bustling with cheerful traders and artisans.',
    'The tavern is giving out free ale in your name tonight!',
    'You found a small bag of gold coins left on the throne as a tribute.',
    'A guild of artisans crafted a new banner for your kingdom.',
    'The local clergy reported unusually high attendance and high spirits.',
    'A flock of doves settled on the castle walls, seen as a good omen.',
    'The citizens built a small, slightly crooked statue of you in the park.'
  ];
  for (const e of defaultTaxEvents) {
    await db.run("INSERT INTO tax_events (content) VALUES ($1)", [e]);
  }
}

async function initializeKingdomColumns(db, getTableColumns, getColumnType, addCol) {
  const kingdomsCols = await getTableColumns('kingdoms');
  const kingdomGoldType = await getColumnType('kingdoms', 'gold');
  if (kingdomGoldType && kingdomGoldType.toLowerCase() !== 'bigint') {
    await db.run('ALTER TABLE kingdoms ALTER COLUMN gold TYPE BIGINT USING gold::bigint');
    console.log('[db] Migration: converted kingdoms.gold to BIGINT');
  }

  const kingdomColAdds = [
    ['turns_stored', 'INTEGER NOT NULL DEFAULT 400'],
    ['alliance_buffs', "TEXT NOT NULL DEFAULT '{}'"],
    ['goals', "TEXT NOT NULL DEFAULT '{}'"],
    ['research_allocation', "TEXT NOT NULL DEFAULT '{}'"],
    ['build_queue', "TEXT NOT NULL DEFAULT '{}'"],
    ['build_progress', "TEXT NOT NULL DEFAULT '{}'"],
    ['research_progress', "TEXT NOT NULL DEFAULT '{}'"],
    ['mage_research_progress', "TEXT NOT NULL DEFAULT '{}'"],
    ['build_allocation', "TEXT NOT NULL DEFAULT '{}'"],
    ['resource_build_allocation', "TEXT NOT NULL DEFAULT '{}'"],
    ['prestige_level', 'INTEGER NOT NULL DEFAULT 0'],
    ['last_prestige_turn', 'INTEGER NOT NULL DEFAULT 0'],
    // Dragon evolution — keep across prestige wipe
    ['evolution_form', "TEXT NOT NULL DEFAULT ''"],
    ['evolution_ritual', "TEXT NOT NULL DEFAULT '{}'"],
    ['trade_routes', 'INTEGER NOT NULL DEFAULT 0'],
    ['tools_hammers', 'INTEGER NOT NULL DEFAULT 0'],
    ['tools_scaffolding', 'INTEGER NOT NULL DEFAULT 0'],
    ['tools_blueprints', 'INTEGER NOT NULL DEFAULT 0'],
    ['scaffolding_stored', 'INTEGER NOT NULL DEFAULT 0'],
    ['hammers_stored', 'INTEGER NOT NULL DEFAULT 0'],
    ['xp', 'REAL NOT NULL DEFAULT 0'],
    ['xp_sources', 'TEXT NOT NULL DEFAULT \'{"turn":0,"gold":0,"combat_win":0,"combat_loss":0,"research":0,"construction":0,"exploration":0,"spell_cast":0,"covert_op":0}\''],
    ['level', 'INTEGER NOT NULL DEFAULT 1'],
    ['region', "TEXT NOT NULL DEFAULT ''"],
    ['troop_levels', "TEXT NOT NULL DEFAULT '{}'"],
    ['equipment_levels', "TEXT NOT NULL DEFAULT '{}'"],
    ['training_allocation', "TEXT NOT NULL DEFAULT '{}'"],
    ['ballistae', 'INTEGER NOT NULL DEFAULT 0'],
    ['weapons_stockpile', 'INTEGER NOT NULL DEFAULT 0'],
    ['armor_stockpile', 'INTEGER NOT NULL DEFAULT 0'],
    ['ladders', 'INTEGER NOT NULL DEFAULT 0'],
    ['description', 'TEXT'],
    ['collected_lore', "TEXT NOT NULL DEFAULT '[]'"],
    ['last_lore_id', 'TEXT'],
    ['collected_events', "TEXT NOT NULL DEFAULT '[]'"],
    ['last_event_id', 'TEXT'],
    ['achievements', "TEXT NOT NULL DEFAULT '[]'"],
    ['active_trade_routes', "TEXT NOT NULL DEFAULT '[]'"],
    ['milestones_claimed', "TEXT NOT NULL DEFAULT '{}'"],
    ['milestone_bonuses', "TEXT NOT NULL DEFAULT '{}'"],
    ['milestone_title', "TEXT NOT NULL DEFAULT ''"],
    ['injured_troops', "TEXT NOT NULL DEFAULT '{}'"],
    ['wall_hp', 'INTEGER NOT NULL DEFAULT 0'],
    ['wall_defense_type', "TEXT NOT NULL DEFAULT ''"],
    ['smithy_allocation', "TEXT NOT NULL DEFAULT '{}'"],
    ['hammer_turns_used', 'INTEGER NOT NULL DEFAULT 0'],
    ['racial_bonuses_unlocked', "TEXT NOT NULL DEFAULT '{}'"],
    ['bld_housing', 'INTEGER NOT NULL DEFAULT 100'],
    ['mage_tower_allocation', "TEXT NOT NULL DEFAULT '{}'"],
    ['shrine_allocation', "TEXT NOT NULL DEFAULT '{}'"],
    ['scribes', 'INTEGER NOT NULL DEFAULT 0'],
    ['bld_libraries', 'INTEGER NOT NULL DEFAULT 0'],
    ['wounded_troops', "TEXT NOT NULL DEFAULT '{}'"],
    ['bld_taverns', 'INTEGER NOT NULL DEFAULT 0'],
    ['bld_granaries', 'INTEGER NOT NULL DEFAULT 0'],
    ['granary_upgrades', "TEXT NOT NULL DEFAULT '{}'"],
    ['bld_mage_towers', 'INTEGER NOT NULL DEFAULT 0'],
    ['world_fragments', "TEXT NOT NULL DEFAULT '[]'"],
    ['hybrid_blueprints', "TEXT NOT NULL DEFAULT '{}'"],
    ['fragment_bonuses', "TEXT NOT NULL DEFAULT '{}'"],
    ['fortified_blueprints', 'INTEGER NOT NULL DEFAULT 0'],
    ['fortified_buildings', "TEXT NOT NULL DEFAULT '{}'"],
    ['library_allocation', "TEXT NOT NULL DEFAULT '{}'"],
    ['library_progress', "TEXT NOT NULL DEFAULT '{}'"],
    ['tower_progress', "TEXT NOT NULL DEFAULT '{}'"],
    ['scrolls', "TEXT NOT NULL DEFAULT '{}'"],
    ['maps', 'INTEGER NOT NULL DEFAULT 0'],
    ['blueprints_stored', 'INTEGER NOT NULL DEFAULT 0'],
    ['certified_blueprints_stored', 'INTEGER NOT NULL DEFAULT 0'],
    ['active_effects', "TEXT NOT NULL DEFAULT '{}'"],
    ['bld_walls', 'INTEGER NOT NULL DEFAULT 0'],
    ['wall_upgrades', "TEXT NOT NULL DEFAULT '{}'"],
    ['tower_def_upgrades', "TEXT NOT NULL DEFAULT '{}'"],
    ['outpost_upgrades', "TEXT NOT NULL DEFAULT '{}'"],
    ['defense_upgrades', "TEXT NOT NULL DEFAULT '{}'"],
    ['tower_upgrades', "TEXT NOT NULL DEFAULT '{}'"],
    ['school_upgrades', "TEXT NOT NULL DEFAULT '{}'"],
    ['shrine_upgrades', "TEXT NOT NULL DEFAULT '{}'"],
    ['library_upgrades', "TEXT NOT NULL DEFAULT '{}'"],
    ['research_focus', "TEXT NOT NULL DEFAULT '[]'"],
    ['divine_sanctuary_used', 'INTEGER NOT NULL DEFAULT 0'],
    ['farm_upgrades', "TEXT NOT NULL DEFAULT '{}'"],
    ['market_upgrades', "TEXT NOT NULL DEFAULT '{}'"],
    ['tavern_upgrades', "TEXT NOT NULL DEFAULT '{}'"],
    ['bank_upgrades', "TEXT NOT NULL DEFAULT '{}'"],
    ['bank_deposits', "TEXT NOT NULL DEFAULT '[]'"],
    ['ledger', "TEXT NOT NULL DEFAULT '[]'"],
    ['bld_mausoleums', 'INTEGER NOT NULL DEFAULT 0'],
    ['thralls', 'INTEGER NOT NULL DEFAULT 0'],
    ['mausoleum_upgrades', "TEXT NOT NULL DEFAULT '{}'"],
    ['mausoleum_allocation', "TEXT NOT NULL DEFAULT '{}'"],
    ['food_shortage_turns', 'INTEGER NOT NULL DEFAULT 0'],
    ['food_surplus_turns', 'INTEGER NOT NULL DEFAULT 0'],
    ['mercenaries', "TEXT NOT NULL DEFAULT '[]'"],
    ['last_event_at', 'INTEGER NOT NULL DEFAULT 0'],
    ['active_event', "TEXT NOT NULL DEFAULT '{}'"],
    ['discovered_kingdoms', "TEXT NOT NULL DEFAULT '{}'"],
    ['location_maps_wip', "TEXT NOT NULL DEFAULT '[]'"],
    ['first_dungeon_found_turn', 'INTEGER DEFAULT NULL'],
    ['first_mountain_found_turn', 'INTEGER DEFAULT NULL'],
    ['visibility', "TEXT NOT NULL DEFAULT '{\"seen_cells\":\"0\",\"current_cells\":\"0\",\"version\":1}'"],
    ['scout_allocation', 'INTEGER NOT NULL DEFAULT 0'],
    ['scout_progress', 'NUMERIC(10,2) NOT NULL DEFAULT 0'],
    ['wood', 'INTEGER NOT NULL DEFAULT 0'],
    ['stone', 'INTEGER NOT NULL DEFAULT 0'],
    ['iron', 'INTEGER NOT NULL DEFAULT 0'],
    ['coal', 'INTEGER NOT NULL DEFAULT 0'],
    ['steel', 'INTEGER NOT NULL DEFAULT 0'],
    // Forge system (A1)
    // Reuses pre-existing coal/steel columns above; no coal_stored/steel_stored dupes.
    ['toolwright_yard', 'INTEGER NOT NULL DEFAULT 0'],
    ['engineers_lodge', 'INTEGER NOT NULL DEFAULT 0'],
    ['forge', 'INTEGER NOT NULL DEFAULT 0'],
    ['tempered_steel', 'INTEGER NOT NULL DEFAULT 0'],
    ['lava_stored', 'INTEGER NOT NULL DEFAULT 0'],
    ['steel_weapons', 'INTEGER NOT NULL DEFAULT 0'],
    ['steel_armor', 'INTEGER NOT NULL DEFAULT 0'],
    ['tempered_weapons', 'INTEGER NOT NULL DEFAULT 0'],
    ['tempered_armor', 'INTEGER NOT NULL DEFAULT 0'],
    ['flux_barges', "TEXT NOT NULL DEFAULT '[]'"],
    ['charcoal_wood_allocation', 'INTEGER NOT NULL DEFAULT 0'],
    ['bld_woodyard', 'INTEGER NOT NULL DEFAULT 0'],
    ['bld_lumber_camp', 'INTEGER NOT NULL DEFAULT 0'],
    ['bld_sawmill', 'INTEGER NOT NULL DEFAULT 0'],
    ['bld_gravel_pit', 'INTEGER NOT NULL DEFAULT 0'],
    ['bld_blockfield', 'INTEGER NOT NULL DEFAULT 0'],
    ['bld_stone_quarry', 'INTEGER NOT NULL DEFAULT 0'],
    ['bld_open_pit', 'INTEGER NOT NULL DEFAULT 0'],
    ['bld_strip_mine', 'INTEGER NOT NULL DEFAULT 0'],
    ['bld_deep_mine', 'INTEGER NOT NULL DEFAULT 0'],
    ['items', "TEXT NOT NULL DEFAULT '[]'"],
    ['resource_sequence', "TEXT NOT NULL DEFAULT '{}'"],
    ['school_of_magic', "TEXT"],
    ['school_spellbook', "INTEGER NOT NULL DEFAULT 0"],
    ['custom_portrait', "TEXT"],
  ];
  for (const [col, def] of kingdomColAdds) {
    if (!kingdomsCols.includes(col)) await addCol('kingdoms', col, def, kingdomsCols);
  }
}

async function initializeResourceNodes(db) {
  // Skip if world_state exists (fresh seeded world - world-initialization.js handles it)
  const worldState = await db.get("SELECT seed FROM world_state WHERE id = 1");
  if (worldState) return; // Fresh seeded world, skip old random initialization

  const hasNodes = await db.get("SELECT COUNT(*) as cnt FROM resource_nodes");
  if (hasNodes && hasNodes.cnt > 0) return;

  const RACE_REGIONS = {
    dwarf: 'The Iron Holds',
    high_elf: 'The Silverwood',
    wood_elf: 'The Wildwood',
    vampire: 'The Crimson Vales',
    ogre: 'The Shattered Peaks',
    dark_elf: 'The Underspire',
    orc: 'The Bloodplains',
    human: 'The Heartlands',
    dire_wolf: 'The Ashfang Wilds',
  };

  const RESOURCE_ABUNDANCE = {
    'The Iron Holds': { abundant: 'iron', count: 3 }, // dwarf
    'The Silverwood': { abundant: 'wood', count: 3 }, // high elf - forest
    'The Wildwood': { abundant: 'wood', count: 3 }, // wood elf - forest
    'The Crimson Vales': { abundant: 'stone', count: 1 }, // vampire - swamp
    'The Shattered Peaks': { abundant: 'iron', count: 3 }, // ogre - mountains
    'The Underspire': { abundant: 'stone', count: 3 }, // dark elf - hills
    'The Bloodplains': { abundant: 'stone', count: 1 }, // orc - plains
    'The Heartlands': { abundant: 'stone', count: 1 }, // human - plains
    'The Ashfang Wilds': { abundant: 'stone', count: 3 }, // dire wolf - hills
  };

  for (const region of Object.values(RACE_REGIONS)) {
    // Base 3 nodes per region (wood, stone, iron)
    const baseResources = ['wood', 'stone', 'iron'];
    for (const resource of baseResources) {
      const x = Math.floor(Math.random() * 1999);
      const y = Math.floor(Math.random() * 1380);
      await db.run(
        'INSERT INTO resource_nodes (kingdom_id, name, type, distance, richness, map_x, map_y, terrain) VALUES (NULL, $1, $2, $3, $4, $5, $6, $7)',
        [`${region} ${resource}`, resource, 100, 1, x, y, 'plains']
      );
    }

    // Abundant resource nodes
    const abundance = RESOURCE_ABUNDANCE[region];
    if (abundance) {
      for (let i = 0; i < abundance.count; i++) {
        const x = Math.floor(Math.random() * 1999);
        const y = Math.floor(Math.random() * 1380);
        await db.run(
          'INSERT INTO resource_nodes (kingdom_id, name, type, distance, richness, map_x, map_y, terrain) VALUES (NULL, $1, $2, $3, $4, $5, $6, $7)',
          [`${region} ${abundance.abundant} +`, abundance.abundant, 100, 2, x, y, 'plains']
        );
      }
    }

    // 1 Dungeon per region
    const dungeonX = Math.floor(Math.random() * 1999);
    const dungeonY = Math.floor(Math.random() * 1380);
    await db.run(
      'INSERT INTO resource_nodes (kingdom_id, name, type, distance, richness, map_x, map_y, terrain) VALUES (NULL, $1, $2, $3, $4, $5, $6, $7)',
      [`${region} Dungeon`, 'dungeon', 150, 1, dungeonX, dungeonY, 'mountains']
    );

    // 1 Mountain Heart per region
    const mountainX = Math.floor(Math.random() * 1999);
    const mountainY = Math.floor(Math.random() * 1380);
    await db.run(
      'INSERT INTO resource_nodes (kingdom_id, name, type, distance, richness, map_x, map_y, terrain) VALUES (NULL, $1, $2, $3, $4, $5, $6, $7)',
      [`${region} Mountain Heart`, 'mountain_heart', 200, 1, mountainX, mountainY, 'mountains']
    );
  }
}

module.exports = {
  initializeRegions,
  initializeAdditionalColumns,
  initializeMarketPrices,
  initializeDefaultEvents,
  initializeWishlist,
  initializeRandomEvents,
  initializeTaxEvents,
  initializeKingdomColumns,
  initializeResourceNodes
};
