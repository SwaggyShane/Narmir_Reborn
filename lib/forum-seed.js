/**
 * Forum category + sub-board definitions (4 sub-boards per category).
 */

const FORUM_CATEGORIES = [
  {
    key: 'community',
    label: 'Community',
    description: 'Welcome, chat, and feedback for the realm.',
    order: 0,
    boards: [
      { name: 'General', description: 'Open discussion about Narmir and the community.' },
      { name: 'Introduce Yourself', description: 'New rulers — tell us who you are and where you hail from.' },
      { name: 'Off-Topic', description: 'Everything else; keep it civil.' },
      { name: 'Ideas & Feedback', description: 'Suggestions, bugs, and quality-of-life ideas.' },
    ],
  },
  {
    key: 'warfare',
    label: 'Warfare & Strategy',
    description: 'Tactics, builds, and the business of conquest.',
    order: 1,
    boards: [
      { name: 'Battle Reports', description: 'Share victories, defeats, and lessons learned.' },
      { name: 'Kingdom Building', description: 'Economy, construction, and long-term planning.' },
      { name: 'War Council', description: 'Coordinated strikes, timers, and target discussion.' },
      { name: 'Meta & Balance', description: 'Mechanics, patches, and theorycraft.' },
    ],
  },
  {
    key: 'alliances',
    label: 'Alliances',
    description: 'Diplomacy, recruitment, and alliance business.',
    order: 2,
    boards: [
      { name: 'Recruitment Hall', description: 'Find a home or advertise open alliance slots.' },
      { name: 'Diplomacy Desk', description: 'Treaties, truces, and foreign relations.' },
      { name: 'Trade & Caravans', description: 'Resource deals and market coordination.' },
      { name: 'Alliance Events', description: 'Wars, tournaments, and scheduled events.' },
    ],
  },
  {
    key: 'roleplaying',
    label: 'Roleplaying',
    description: 'In-character stories, journals, and collaborative fiction.',
    order: 3,
    boards: [
      { name: 'The Tavern (In-Character)', description: 'Stay in character — the hearth of RP social life.' },
      { name: 'Character Journals', description: 'Personal logs and inner monologues for your heroes.' },
      { name: 'Kingdom Chronicles', description: 'Lore and history written from your throne room.' },
      { name: 'Quest & Adventure', description: 'RP quest hooks, party threads, and ongoing sagas.' },
    ],
  },
];

const LEGACY_BOARD_NAMES = ['General', 'Strategy', 'Alliance News'];

async function seedForumStructure(db) {
  const now = Math.floor(Date.now() / 1000);
  let order = 0;

  for (const category of FORUM_CATEGORIES) {
    for (const board of category.boards) {
      const existing = await db.get(`SELECT id, category_key FROM forum_boards WHERE name = $1`, [board.name]);
      if (existing) {
        await db.run(
          `UPDATE forum_boards
           SET description = $1, order_index = $2, category_key = $3, category_label = $4,
               category_order = $5, is_active = 1, updated_at = $6
           WHERE id = $7`,
          [board.description, order, category.key, category.label, category.order, now, existing.id],
        );
      } else {
        await db.run(
          `INSERT INTO forum_boards
             (name, description, order_index, category_key, category_label, category_order, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8)`,
          [board.name, board.description, order, category.key, category.label, category.order, now, now],
        );
      }
      order += 1;
    }
  }

  // Retire flat legacy top-level boards superseded by sub-boards (keep topics via old board ids intact).
  for (const legacyName of LEGACY_BOARD_NAMES) {
    if (legacyName === 'General') continue; // new Community "General" reuses name
    await db.run(
      `UPDATE forum_boards SET is_active = 0, updated_at = $1
       WHERE name = $2 AND (category_key IS NULL OR category_key = '')`,
      [now, legacyName],
    );
  }

  // Legacy "Strategy" / "Alliance News" without category — deactivate; "General" old row may conflict — handle duplicate
  const dupGeneral = await db.all(
    `SELECT id, category_key FROM forum_boards WHERE name = 'General' ORDER BY id ASC`,
  );
  if (dupGeneral.length > 1) {
    for (const row of dupGeneral.slice(0, -1)) {
      if (!row.category_key) {
        await db.run(`UPDATE forum_boards SET is_active = 0, name = $1, updated_at = $2 WHERE id = $3`, [
          `General (legacy #${row.id})`,
          now,
          row.id,
        ]);
      }
    }
  }
}

module.exports = { FORUM_CATEGORIES, LEGACY_BOARD_NAMES, seedForumStructure };