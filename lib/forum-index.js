const { FORUM_CATEGORIES } = require('./forum-seed');

async function fetchBoardRows(db) {
  return db.all(
    `SELECT
       fb.id,
       fb.name,
       fb.description,
       fb.category_key,
       fb.category_label,
       fb.category_order,
       fb.order_index,
       COALESCE(tc.topic_count, 0) AS topic_count,
       COALESCE(pc.post_count, 0) AS post_count,
       lat.latest_topic_title,
       lat.latest_poster_username,
       lat.latest_posted_at
     FROM forum_boards fb
     LEFT JOIN (
       SELECT board_id, COUNT(*) AS topic_count FROM forum_topics GROUP BY board_id
     ) tc ON tc.board_id = fb.id
     LEFT JOIN (
       SELECT ft.board_id, COUNT(fp.id) AS post_count
       FROM forum_posts fp
       INNER JOIN forum_topics ft ON ft.id = fp.topic_id
       WHERE fp.is_deleted = 0
       GROUP BY ft.board_id
     ) pc ON pc.board_id = fb.id
     LEFT JOIN (
       SELECT DISTINCT ON (ft.board_id)
         ft.board_id,
         ft.title AS latest_topic_title,
         ft.last_post_at AS latest_posted_at,
         COALESCE(lp.username, op.username) AS latest_poster_username
       FROM forum_topics ft
       INNER JOIN players op ON op.id = ft.player_id
       LEFT JOIN LATERAL (
         SELECT fp.player_id, p.username
         FROM forum_posts fp
         INNER JOIN players p ON p.id = fp.player_id
         WHERE fp.topic_id = ft.id AND fp.is_deleted = 0
         ORDER BY fp.created_at DESC
         LIMIT 1
       ) lp ON true
       ORDER BY ft.board_id, ft.last_post_at DESC
     ) lat ON lat.board_id = fb.id
     WHERE fb.is_active = 1 AND fb.category_key IS NOT NULL AND fb.category_key != ''
     ORDER BY fb.category_order ASC, fb.order_index ASC`,
  );
}

function buildForumIndex(rows) {
  const byCategory = new Map();
  for (const cat of FORUM_CATEGORIES) {
    byCategory.set(cat.key, {
      key: cat.key,
      label: cat.label,
      description: cat.description,
      order: cat.order,
      boards: [],
    });
  }

  for (const row of rows || []) {
    const bucket = byCategory.get(row.category_key);
    if (!bucket) continue;
    bucket.boards.push({
      id: row.id,
      name: row.name,
      description: row.description,
      topicCount: Number(row.topic_count || 0),
      postCount: Number(row.post_count || 0),
      latest: row.latest_topic_title
        ? {
            topicTitle: row.latest_topic_title,
            posterUsername: row.latest_poster_username,
            postedAt: Number(row.latest_posted_at),
          }
        : null,
    });
  }

  return {
    title: 'Kingdom Forums',
    categories: [...byCategory.values()].sort((a, b) => a.order - b.order),
  };
}

async function getForumIndex(db) {
  const rows = await fetchBoardRows(db);
  return buildForumIndex(rows);
}

module.exports = { fetchBoardRows, buildForumIndex, getForumIndex };