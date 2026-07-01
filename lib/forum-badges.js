/**
 * Forum badges — roleplay-weighted, computed from posting activity.
 */

const BADGE_DEFS = {
  newcomer: { id: 'newcomer', label: 'Newcomer', emoji: '✨', tip: 'Just arrived in the realm' },
  in_character: { id: 'in_character', label: 'In Character', emoji: '🎭', tip: 'Posted in Roleplaying' },
  tavern_regular: { id: 'tavern_regular', label: 'Tavern Regular', emoji: '🍺', tip: '5+ in-character tavern posts' },
  chronicler: { id: 'chronicler', label: 'Chronicler', emoji: '📖', tip: 'Journals or chronicles activity' },
  questgiver: { id: 'questgiver', label: 'Questgiver', emoji: '🗺️', tip: 'Started a quest thread' },
  storyweaver: { id: 'storyweaver', label: 'Storyweaver', emoji: '🎪', tip: '20+ roleplaying posts' },
  scribe: { id: 'scribe', label: 'Scribe', emoji: '📜', tip: '10+ forum posts' },
  noble: { id: 'noble', label: 'Noble', emoji: '👑', tip: '25+ forum posts' },
  diplomat: { id: 'diplomat', label: 'Diplomat', emoji: '🤝', tip: 'Active in Alliances' },
  strategist: { id: 'strategist', label: 'Strategist', emoji: '⚔️', tip: 'Active in Warfare boards' },
  moderator: { id: 'moderator', label: 'Moderator', emoji: '🛡️', tip: 'Forum moderator' },
  admin: { id: 'admin', label: 'Crown', emoji: '⚜️', tip: 'Realm administrator' },
};

async function getPlayerForumStats(db, playerId) {
  const totals = await db.get(
    `SELECT
       COUNT(DISTINCT fp.id) FILTER (WHERE fp.is_deleted = 0) AS post_count,
       COUNT(DISTINCT ft.id) AS topic_count,
       COUNT(DISTINCT fp.id) FILTER (WHERE fp.is_deleted = 0 AND fb.category_key = 'roleplaying') AS rp_post_count,
       COUNT(DISTINCT fp.id) FILTER (WHERE fp.is_deleted = 0 AND fb.name = 'The Tavern (In-Character)') AS tavern_posts,
       COUNT(DISTINCT fp.id) FILTER (WHERE fp.is_deleted = 0 AND fb.name IN ('Character Journals', 'Kingdom Chronicles')) AS journal_posts,
       COUNT(DISTINCT ft.id) FILTER (WHERE fb.name = 'Quest & Adventure') AS quest_topics,
       COUNT(DISTINCT fp.id) FILTER (WHERE fp.is_deleted = 0 AND fb.category_key = 'alliances') AS alliance_posts,
       COUNT(DISTINCT fp.id) FILTER (WHERE fp.is_deleted = 0 AND fb.category_key = 'warfare') AS warfare_posts
     FROM players p
     LEFT JOIN forum_posts fp ON fp.player_id = p.id
     LEFT JOIN forum_topics ft ON ft.player_id = p.id
     LEFT JOIN forum_boards fb ON fb.id = COALESCE(
       (SELECT board_id FROM forum_topics WHERE id = fp.topic_id),
       ft.board_id
     )
     WHERE p.id = $1`,
    [playerId],
  );

  const isMod = await db.get(`SELECT 1 FROM forum_moderators WHERE player_id = $1 LIMIT 1`, [playerId]);
  const player = await db.get(`SELECT is_admin FROM players WHERE id = $1`, [playerId]);

  return {
    postCount: Number(totals?.post_count || 0),
    topicCount: Number(totals?.topic_count || 0),
    rpPostCount: Number(totals?.rp_post_count || 0),
    tavernPosts: Number(totals?.tavern_posts || 0),
    journalPosts: Number(totals?.journal_posts || 0),
    questTopics: Number(totals?.quest_topics || 0),
    alliancePosts: Number(totals?.alliance_posts || 0),
    warfarePosts: Number(totals?.warfare_posts || 0),
    isModerator: !!isMod,
    isAdmin: player?.is_admin === 1 || player?.is_admin === true,
  };
}

function computeBadges(stats) {
  const badges = [];
  const add = (id) => {
    if (BADGE_DEFS[id]) badges.push(BADGE_DEFS[id]);
  };

  if (stats.isAdmin) add('admin');
  if (stats.isModerator) add('moderator');
  if (stats.postCount < 3) add('newcomer');
  if (stats.rpPostCount >= 1) add('in_character');
  if (stats.tavernPosts >= 5) add('tavern_regular');
  if (stats.journalPosts >= 3) add('chronicler');
  if (stats.questTopics >= 1) add('questgiver');
  if (stats.rpPostCount >= 20) add('storyweaver');
  if (stats.postCount >= 10) add('scribe');
  if (stats.postCount >= 25) add('noble');
  if (stats.alliancePosts >= 5) add('diplomat');
  if (stats.warfarePosts >= 5) add('strategist');

  // De-dupe, cap at 5 displayed
  const seen = new Set();
  return badges.filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  }).slice(0, 5);
}

async function getBadgesForPlayer(db, playerId) {
  const stats = await getPlayerForumStats(db, playerId);
  return computeBadges(stats);
}

module.exports = { BADGE_DEFS, getPlayerForumStats, computeBadges, getBadgesForPlayer };