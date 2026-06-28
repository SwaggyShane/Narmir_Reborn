const express = require("express");
const router = express.Router();
const { requireAuth, requireAdmin } = require("./middleware");
const { getForumIndex } = require("../lib/forum-index");
const {
  resolveForumAvatar,
  getForumProfile,
  upsertForumProfile,
  normalizeAvatarMode,
} = require("../lib/forum-profiles");
const { getBadgesForPlayer } = require("../lib/forum-badges");

module.exports = function (db) {
  // ──────────── HELPER FUNCTIONS ────────────────────────────────────────

  async function enrichPosts(dbConn, posts) {
    if (!posts?.length) return posts || [];

    const playerIds = [...new Set(posts.map((p) => p.player_id).filter(Boolean))];
    if (!playerIds.length) return posts;

    const placeholders = playerIds.map(() => "?").join(",");
    const players = await dbConn.all(
      `SELECT id, username, email FROM players WHERE id IN (${placeholders})`,
      playerIds,
    );
    const playerMap = new Map(players.map((p) => [p.id, p]));

    const profiles = await dbConn.all(
      `SELECT player_id, avatar_mode, avatar_url FROM forum_profiles WHERE player_id IN (${placeholders})`,
      playerIds,
    );
    const profileMap = new Map(profiles.map((p) => [p.player_id, p]));

    const badgeEntries = await Promise.all(
      playerIds.map(async (id) => [id, await getBadgesForPlayer(dbConn, id)]),
    );
    const badgeMap = new Map(badgeEntries);

    return posts.map((post) => {
      const player = playerMap.get(post.player_id);
      const profile = profileMap.get(post.player_id);
      return {
        ...post,
        avatarUrl: resolveForumAvatar({
          profile,
          email: player?.email,
          username: post.username,
        }),
        badges: badgeMap.get(post.player_id) || [],
      };
    });
  }

  // Check if user is banned from posting
  const isUserBanned = async (playerId, boardId = null) => {
    const now = Math.floor(Date.now() / 1000);
    const ban = await db.get(
      `SELECT id FROM forum_bans
       WHERE player_id = ? AND (board_id = ? OR board_id IS NULL)
       AND (expires_at IS NULL OR expires_at > ?)`,
      [playerId, boardId, now]
    );
    return !!ban;
  };

  // Middleware to check ban before posting
  const checkBanBeforePost = async (req, res, next) => {
    if (!req.player?.playerId) {
      return next();
    }

    try {
      // Determine board context
      let boardId = null;

      if (req.body?.boardId) {
        // Creating a topic - boardId is in body
        boardId = req.body.boardId;
      } else if (req.params?.topicId) {
        // Replying to topic - get boardId from topic
        const topic = await db.get(
          `SELECT board_id FROM forum_topics WHERE id = ?`,
          [req.params.topicId]
        );
        boardId = topic?.board_id || null;
      }

      const banned = await isUserBanned(req.player.playerId, boardId);
      if (banned) {
        return res.status(403).json({ error: "You are banned from this forum or board" });
      }
      next();
    } catch (err) {
      console.error("[forum] Ban check error:", err.message);
      next(); // Continue on error rather than blocking
    }
  };

  // ──────────── PUBLIC ENDPOINTS (No auth required) ────────────────────────

  // GET /api/forum/index - Categorized forum index with stats + latest activity
  router.get("/index", async (req, res) => {
    try {
      const index = await getForumIndex(db);
      res.json(index);
    } catch (err) {
      console.error("[forum] GET /index error:", err.message);
      res.status(500).json({ error: "Failed to fetch forum index" });
    }
  });

  // GET /api/forum/boards - Get all active forum boards (legacy flat list)
  router.get("/boards", async (req, res) => {
    try {
      const boards = await db.all(
        `SELECT fb.id, fb.name, fb.description, fb.order_index,
                COALESCE(t.topic_count, 0) as topicCount,
                COALESCE(p.post_count, 0) as postCount
         FROM forum_boards fb
         LEFT JOIN (
           SELECT board_id, COUNT(*) as topic_count
           FROM forum_topics
           GROUP BY board_id
         ) t ON fb.id = t.board_id
         LEFT JOIN (
           SELECT ft.board_id, COUNT(*) as post_count
           FROM forum_posts fp
           INNER JOIN forum_topics ft ON fp.topic_id = ft.id
           WHERE fp.is_deleted = 0
           GROUP BY ft.board_id
         ) p ON fb.id = p.board_id
         WHERE fb.is_active = 1
         ORDER BY fb.order_index ASC, fb.created_at ASC`
      );

      res.json(boards || []);
    } catch (err) {
      console.error("[forum] GET /boards error:", err.message);
      res.status(500).json({ error: "Failed to fetch boards" });
    }
  });

  // GET /api/forum/boards/:boardId/topics - Get topics in a board (paginated)
  router.get("/boards/:boardId/topics", async (req, res) => {
    try {
      const { boardId } = req.params;
      const page = Math.max(1, parseInt(req.query.page || "1", 10));
      const pageSize = 20;
      const offset = (page - 1) * pageSize;
      const sort = req.query.sort || "newest";

      // Validate board exists
      const board = await db.get(
        `SELECT id FROM forum_boards WHERE id = ? AND is_active = 1`,
        [boardId]
      );
      if (!board) {
        return res.status(404).json({ error: "Board not found" });
      }

      // Whitelist of allowed sort orders (prevents SQL injection via ORDER BY)
      const VALID_SORTS = {
        "newest": "ft.created_at DESC",
        "mostActive": "ft.last_post_at DESC",
        "oldest": "ft.created_at ASC"
      };

      const activeSort = sort || "newest";
      if (!VALID_SORTS[activeSort]) {
        return res.status(400).json({ error: "Invalid sort parameter" });
      }

      const orderClause = VALID_SORTS[activeSort];

      const topics = await db.all(
        `SELECT ft.id, ft.title, ft.board_id, ft.post_count, ft.last_post_at,
                ft.is_pinned, ft.created_at, p.username
         FROM forum_topics ft
         INNER JOIN players p ON ft.player_id = p.id
         WHERE ft.board_id = ?
         ORDER BY ft.is_pinned DESC, ${orderClause}
         LIMIT ? OFFSET ?`,
        [boardId, pageSize, offset]
      );

      const totalResult = await db.get(
        `SELECT COUNT(*) as total FROM forum_topics WHERE board_id = ?`,
        [boardId]
      );
      const total = totalResult?.total || 0;

      res.json({
        topics: topics || [],
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (err) {
      console.error("[forum] GET /boards/:boardId/topics error:", err.message);
      res.status(500).json({ error: "Failed to fetch topics" });
    }
  });

  // GET /api/forum/topics/:topicId/posts - Get posts in a topic (paginated)
  router.get("/topics/:topicId/posts", async (req, res) => {
    try {
      const { topicId } = req.params;
      const page = Math.max(1, parseInt(req.query.page || "1", 10));
      const pageSize = 20;
      const offset = (page - 1) * pageSize;

      // Get topic info
      const topic = await db.get(
        `SELECT ft.id, ft.title, ft.board_id, ft.created_at, p.username as author_username
         FROM forum_topics ft
         INNER JOIN players p ON ft.player_id = p.id
         WHERE ft.id = ?`,
        [topicId]
      );
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }

      // Get posts (include is_deleted flag so client can render deleted posts)
      const posts = await db.all(
        `SELECT fp.id, fp.topic_id, fp.content, fp.is_deleted, fp.created_at,
                fp.updated_at, p.username, p.id as player_id
         FROM forum_posts fp
         INNER JOIN players p ON fp.player_id = p.id
         WHERE fp.topic_id = ?
         ORDER BY fp.created_at ASC
         LIMIT ? OFFSET ?`,
        [topicId, pageSize, offset]
      );

      const totalResult = await db.get(
        `SELECT COUNT(*) as total FROM forum_posts WHERE topic_id = ?`,
        [topicId]
      );
      const total = totalResult?.total || 0;
      const enrichedPosts = await enrichPosts(db, posts || []);

      res.json({
        topic,
        posts: enrichedPosts,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (err) {
      console.error("[forum] GET /topics/:topicId/posts error:", err.message);
      res.status(500).json({ error: "Failed to fetch posts" });
    }
  });

  // ──────────── PROTECTED ENDPOINTS (Auth required) ────────────

  // GET /api/forum/profile - Current user's forum avatar settings
  router.get("/profile", requireAuth, async (req, res) => {
    try {
      const playerId = req.player.playerId;
      const player = await db.get(`SELECT id, username, email FROM players WHERE id = ?`, [playerId]);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }

      const profile = await getForumProfile(db, playerId);
      const avatarMode = normalizeAvatarMode(profile?.avatar_mode);
      const avatarUrl = resolveForumAvatar({
        profile: profile || { avatar_mode: avatarMode },
        email: player.email,
        username: player.username,
      });

      res.json({
        avatarMode,
        customAvatarUrl: profile?.avatar_url || null,
        previewUrl: avatarUrl,
        hasEmail: !!player.email,
      });
    } catch (err) {
      console.error("[forum] GET /profile error:", err.message);
      res.status(500).json({ error: "Failed to fetch forum profile" });
    }
  });

  // PATCH /api/forum/profile - Update forum avatar settings
  router.patch("/profile", requireAuth, async (req, res) => {
    try {
      const playerId = req.player.playerId;
      const { avatarMode, avatarUrl } = req.body || {};

      const result = await upsertForumProfile(db, playerId, { avatarMode, avatarUrl });
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }

      const player = await db.get(`SELECT username, email FROM players WHERE id = ?`, [playerId]);
      const previewUrl = resolveForumAvatar({
        profile: { avatar_mode: result.avatarMode, avatar_url: result.avatarUrl },
        email: player?.email,
        username: player?.username,
      });

      res.json({
        success: true,
        avatarMode: result.avatarMode,
        customAvatarUrl: result.avatarUrl,
        previewUrl,
      });
    } catch (err) {
      console.error("[forum] PATCH /profile error:", err.message);
      res.status(500).json({ error: "Failed to update forum profile" });
    }
  });

  // POST /api/forum/topics - Create a new topic
  router.post("/topics", requireAuth, checkBanBeforePost, async (req, res) => {
    try {
      const { boardId, title, content } = req.body;
      const playerId = req.player.playerId;

      if (!playerId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      if (!boardId || !title || !content) {
        return res.status(400).json({ error: "boardId, title, and content are required" });
      }

      if (title.trim().length < 3 || title.trim().length > 200) {
        return res.status(400).json({ error: "Title must be 3-200 characters" });
      }

      if (content.trim().length < 10 || content.trim().length > 5000) {
        return res.status(400).json({ error: "Content must be 10-5000 characters" });
      }

      // Validate board exists
      const board = await db.get(
        `SELECT id FROM forum_boards WHERE id = ? AND is_active = 1`,
        [boardId]
      );
      if (!board) {
        return res.status(404).json({ error: "Board not found" });
      }


      // Create topic with first post in transaction
      await db.run('BEGIN TRANSACTION');
      try {
        const now = Math.floor(Date.now() / 1000);
        const result = await db.run(
          `INSERT INTO forum_topics (board_id, player_id, title, content, post_count, last_post_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
          [boardId, playerId, title.trim(), content.trim(), now, now, now]
        );

        const topicId = result.lastID;

        // Create the first post
        await db.run(
          `INSERT INTO forum_posts (topic_id, player_id, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [topicId, playerId, content.trim(), now, now]
        );

        await db.run('COMMIT');

        res.status(201).json({
          success: true,
          topicId,
          message: "Topic created successfully",
        });
      } catch (txErr) {
        await db.run('ROLLBACK').catch(() => {});
        throw txErr;
      }
    } catch (err) {
      console.error("[forum] POST /topics error:", err.message);
      res.status(500).json({ error: "Failed to create topic" });
    }
  });

  // POST /api/forum/topics/:topicId/posts - Create a reply to a topic
  router.post("/topics/:topicId/posts", requireAuth, checkBanBeforePost, async (req, res) => {
    try {
      const { topicId } = req.params;
      const { content } = req.body;
      const playerId = req.player.playerId;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "Content is required" });
      }

      if (content.trim().length < 10 || content.trim().length > 5000) {
        return res.status(400).json({ error: "Content must be 10-5000 characters" });
      }

      // Validate topic exists
      const topic = await db.get(
        `SELECT id, is_locked FROM forum_topics WHERE id = ?`,
        [topicId]
      );
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }

      if (topic.is_locked) {
        return res.status(403).json({ error: "Topic is locked" });
      }


      const now = Math.floor(Date.now() / 1000);

      // Create post and update topic in transaction
      await db.run('BEGIN TRANSACTION');
      try {
        const result = await db.run(
          `INSERT INTO forum_posts (topic_id, player_id, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [topicId, playerId, content.trim(), now, now]
        );

        const postId = result.lastID;

        // Update topic post_count and last_post_at
        await db.run(
          `UPDATE forum_topics
           SET post_count = post_count + 1, last_post_at = ?, updated_at = ?
           WHERE id = ?`,
          [now, now, topicId]
        );

        await db.run('COMMIT');

        res.status(201).json({
          success: true,
          postId,
          message: "Reply posted successfully",
        });
      } catch (txErr) {
        await db.run('ROLLBACK').catch(() => {});
        throw txErr;
      }
    } catch (err) {
      console.error("[forum] POST /topics/:topicId/posts error:", err.message);
      res.status(500).json({ error: "Failed to create post" });
    }
  });

  // PATCH /api/forum/posts/:postId - Edit own post
  router.patch("/posts/:postId", requireAuth, async (req, res) => {
    try {
      const { postId } = req.params;
      const { content } = req.body;
      const playerId = req.player.playerId;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: "Content is required" });
      }

      if (content.trim().length < 10 || content.trim().length > 5000) {
        return res.status(400).json({ error: "Content must be 10-5000 characters" });
      }

      // Get post
      const post = await db.get(
        `SELECT id, player_id, is_deleted FROM forum_posts WHERE id = ?`,
        [postId]
      );
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      if (post.is_deleted) {
        return res.status(403).json({ error: "Cannot edit deleted post" });
      }

      if (post.player_id !== playerId) {
        return res.status(403).json({ error: "You can only edit your own posts" });
      }

      const now = Math.floor(Date.now() / 1000);

      // Update post
      await db.run(
        `UPDATE forum_posts SET content = ?, updated_at = ? WHERE id = ?`,
        [content.trim(), now, postId]
      );

      res.json({
        success: true,
        message: "Post updated successfully",
      });
    } catch (err) {
      console.error("[forum] PATCH /posts/:postId error:", err.message);
      res.status(500).json({ error: "Failed to update post" });
    }
  });

  // DELETE /api/forum/posts/:postId - Delete own post (soft delete)
  router.delete("/posts/:postId", requireAuth, async (req, res) => {
    try {
      const { postId } = req.params;
      const playerId = req.player.playerId;

      // Get post
      const post = await db.get(
        `SELECT id, player_id, topic_id, is_deleted FROM forum_posts WHERE id = ?`,
        [postId]
      );
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      if (post.is_deleted) {
        return res.status(403).json({ error: "Post is already deleted" });
      }

      if (post.player_id !== playerId) {
        return res.status(403).json({ error: "You can only delete your own posts" });
      }

      const now = Math.floor(Date.now() / 1000);

      // Soft delete post
      await db.run(
        `UPDATE forum_posts SET is_deleted = 1, deleted_at = ?, updated_at = ? WHERE id = ?`,
        [now, now, postId]
      );

      // Update topic post count (if not the first post)
      const firstPost = await db.get(
        `SELECT id FROM forum_posts WHERE topic_id = ? ORDER BY created_at ASC LIMIT 1`,
        [post.topic_id]
      );

      if (firstPost.id !== postId) {
        await db.run(
          `UPDATE forum_topics SET post_count = post_count - 1, updated_at = ? WHERE id = ?`,
          [now, post.topic_id]
        );
      }

      res.json({
        success: true,
        message: "Post deleted successfully",
      });
    } catch (err) {
      console.error("[forum] DELETE /posts/:postId error:", err.message);
      res.status(500).json({ error: "Failed to delete post" });
    }
  });

  // DELETE /api/forum/topics/:topicId - Delete own topic
  router.delete("/topics/:topicId", requireAuth, async (req, res) => {
    try {
      const { topicId } = req.params;
      const playerId = req.player.playerId;

      // Get topic
      const topic = await db.get(
        `SELECT id, player_id FROM forum_topics WHERE id = ?`,
        [topicId]
      );
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }

      if (topic.player_id !== playerId) {
        return res.status(403).json({ error: "You can only delete your own topics" });
      }

      // Use transaction to delete all posts first (to satisfy foreign key constraints), then delete topic
      await db.run('BEGIN TRANSACTION');
      try {
        // Hard delete all posts in the topic first to satisfy foreign key constraints
        await db.run(`DELETE FROM forum_posts WHERE topic_id = ?`, [topicId]);
        // Delete the topic
        await db.run(`DELETE FROM forum_topics WHERE id = ?`, [topicId]);
        await db.run('COMMIT');
      } catch (err) {
        await db.run('ROLLBACK').catch(() => {});
        throw err;
      }

      res.json({
        success: true,
        message: "Topic deleted successfully",
      });
    } catch (err) {
      console.error("[forum] DELETE /topics/:topicId error:", err.message);
      res.status(500).json({ error: "Failed to delete topic" });
    }
  });

  // ──────────── MODERATION ENDPOINTS ────────────────────────────────────────

  // Helper: Check if user is moderator for board
  const isBoardModerator = async (playerId, boardId) => {
    const result = await db.get(
      `SELECT id FROM forum_moderators WHERE player_id = ? AND board_id = ?`,
      [playerId, boardId]
    );
    return !!result;
  };

  // GET /api/forum/admin/moderators - List all moderators (admin only)
  router.get("/admin/moderators", requireAdmin, async (req, res) => {
    try {
      const moderators = await db.all(
        `SELECT fm.id, fm.player_id, fm.board_id, fm.assigned_by, fm.created_at,
                fb.name as board_name
         FROM forum_moderators fm
         LEFT JOIN forum_boards fb ON fm.board_id = fb.id
         ORDER BY fm.created_at DESC`
      );
      res.json(moderators || []);
    } catch (err) {
      console.error("[forum] GET /admin/moderators error:", err.message);
      res.status(500).json({ error: "Failed to fetch moderators" });
    }
  });

  // GET /api/forum/admin/bans - List all active bans (admin only)
  router.get("/admin/bans", requireAdmin, async (req, res) => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const bans = await db.all(
        `SELECT fb.id, fb.player_id, fb.board_id, fb.ban_type, fb.reason,
                fb.expires_at, fb.banned_by, fb.created_at,
                fbo.name as board_name
         FROM forum_bans fb
         LEFT JOIN forum_boards fbo ON fb.board_id = fbo.id
         WHERE fb.expires_at IS NULL OR fb.expires_at > ?
         ORDER BY fb.created_at DESC`,
        [now]
      );
      res.json(bans || []);
    } catch (err) {
      console.error("[forum] GET /admin/bans error:", err.message);
      res.status(500).json({ error: "Failed to fetch bans" });
    }
  });

  // GET /api/forum/admin/logs - Get moderation audit log (admin only)
  router.get("/admin/logs", requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit || "100", 10);
      const logs = await db.all(
        `SELECT id, moderator_id, action, target_type, target_id, reason, created_at
         FROM forum_moderation_log
         ORDER BY created_at DESC
         LIMIT ?`,
        [limit]
      );
      res.json(logs || []);
    } catch (err) {
      console.error("[forum] GET /admin/logs error:", err.message);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  // POST /api/forum/admin/moderators - Assign moderator (admin only)
  router.post("/admin/moderators", requireAdmin, async (req, res) => {
    try {
      const { playerId, boardId } = req.body;
      const adminId = req.player.playerId;

      if (!playerId || !boardId) {
        return res.status(400).json({ error: "playerId and boardId are required" });
      }

      // Verify board exists
      const board = await db.get(`SELECT id FROM forum_boards WHERE id = ?`, [boardId]);
      if (!board) {
        return res.status(404).json({ error: "Board not found" });
      }

      // Verify player exists
      const player = await db.get(`SELECT id FROM players WHERE id = ?`, [playerId]);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }

      // Assign moderator
      await db.run(
        `INSERT INTO forum_moderators (player_id, board_id, assigned_by, created_at)
         VALUES (?, ?, ?, ?)`,
        [playerId, boardId, adminId, Math.floor(Date.now() / 1000)]
      );

      // Log action
      await db.run(
        `INSERT INTO forum_moderation_log (moderator_id, action, target_type, target_id, created_at)
         VALUES (?, 'assign_moderator', 'player', ?, ?)`,
        [adminId, playerId, Math.floor(Date.now() / 1000)]
      );

      res.status(201).json({ success: true, message: "Moderator assigned" });
    } catch (err) {
      if (err.message && err.message.includes("duplicate")) {
        return res.status(400).json({ error: "User is already a moderator for this board" });
      }
      console.error("[forum] POST /admin/moderators error:", err.message);
      res.status(500).json({ error: "Failed to assign moderator" });
    }
  });

  // DELETE /api/forum/admin/moderators/:modId - Remove moderator (admin only)
  router.delete("/admin/moderators/:modId", requireAdmin, async (req, res) => {
    try {
      const { modId } = req.params;
      const adminId = req.player.playerId;

      const mod = await db.get(`SELECT player_id FROM forum_moderators WHERE id = ?`, [modId]);
      if (!mod) {
        return res.status(404).json({ error: "Moderator assignment not found" });
      }

      await db.run(`DELETE FROM forum_moderators WHERE id = ?`, [modId]);

      // Log action
      await db.run(
        `INSERT INTO forum_moderation_log (moderator_id, action, target_type, target_id, created_at)
         VALUES (?, 'remove_moderator', 'player', ?, ?)`,
        [adminId, mod.player_id, Math.floor(Date.now() / 1000)]
      );

      res.json({ success: true, message: "Moderator removed" });
    } catch (err) {
      console.error("[forum] DELETE /admin/moderators/:modId error:", err.message);
      res.status(500).json({ error: "Failed to remove moderator" });
    }
  });

  // POST /api/forum/moderation/ban-user - Ban user from forum (mod only)
  router.post("/moderation/ban-user", requireAuth, async (req, res) => {
    try {
      const { playerId, boardId, expiresIn, reason } = req.body;
      const modId = req.player.playerId;

      if (!playerId) {
        return res.status(400).json({ error: "playerId is required" });
      }

      // Verify moderator status
      if (boardId) {
        const isMod = await isBoardModerator(modId, boardId);
        if (!isMod && !req.player.isAdmin) {
          return res.status(403).json({ error: "Not a moderator for this board" });
        }
      } else if (!req.player.isAdmin) {
        return res.status(403).json({ error: "Only admins can ban from entire forum" });
      }

      const now = Math.floor(Date.now() / 1000);
      const expiresAt = expiresIn ? now + expiresIn : null;
      const banType = boardId ? "board_silence" : "forum_ban";

      await db.run(
        `INSERT INTO forum_bans (player_id, board_id, ban_type, reason, expires_at, banned_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [playerId, boardId || null, banType, reason || null, expiresAt, modId, now]
      );

      // Log action
      await db.run(
        `INSERT INTO forum_moderation_log (moderator_id, action, target_type, target_id, reason, created_at)
         VALUES (?, ?, 'player', ?, ?, ?)`,
        [modId, banType === "forum_ban" ? "ban_user" : "silence_user", playerId, reason || null, now]
      );

      res.status(201).json({ success: true, message: "User banned" });
    } catch (err) {
      console.error("[forum] POST /moderation/ban-user error:", err.message);
      res.status(500).json({ error: "Failed to ban user" });
    }
  });

  // DELETE /api/forum/moderation/bans/:banId - Unban user (mod only)
  router.delete("/moderation/bans/:banId", requireAuth, async (req, res) => {
    try {
      const { banId } = req.params;
      const modId = req.player.playerId;

      const ban = await db.get(`SELECT player_id, board_id FROM forum_bans WHERE id = ?`, [banId]);
      if (!ban) {
        return res.status(404).json({ error: "Ban not found" });
      }

      // Verify moderator or admin
      if (ban.board_id && !req.player.isAdmin) {
        const isMod = await isBoardModerator(modId, ban.board_id);
        if (!isMod) {
          return res.status(403).json({ error: "Not a moderator for this board" });
        }
      } else if (!ban.board_id && !req.player.isAdmin) {
        return res.status(403).json({ error: "Only admins can unban from forum" });
      }

      await db.run(`DELETE FROM forum_bans WHERE id = ?`, [banId]);

      // Log action
      await db.run(
        `INSERT INTO forum_moderation_log (moderator_id, action, target_type, target_id, created_at)
         VALUES (?, 'unban_user', 'player', ?, ?)`,
        [modId, ban.player_id, Math.floor(Date.now() / 1000)]
      );

      res.json({ success: true, message: "Ban removed" });
    } catch (err) {
      console.error("[forum] DELETE /moderation/bans/:banId error:", err.message);
      res.status(500).json({ error: "Failed to remove ban" });
    }
  });

  // POST /api/forum/moderation/hide-post - Hide post from view (mod only)
  router.post("/moderation/hide-post", requireAuth, async (req, res) => {
    try {
      const { postId, reason } = req.body;
      const modId = req.player.playerId;

      if (!postId) {
        return res.status(400).json({ error: "postId is required" });
      }

      const post = await db.get(
        `SELECT fp.id, ft.board_id FROM forum_posts fp
         INNER JOIN forum_topics ft ON fp.topic_id = ft.id
         WHERE fp.id = ?`,
        [postId]
      );
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      // Verify moderator for board
      const isMod = await isBoardModerator(modId, post.board_id);
      if (!isMod && !req.player.isAdmin) {
        return res.status(403).json({ error: "Not a moderator for this board" });
      }

      const now = Math.floor(Date.now() / 1000);

      // Soft delete (similar to user delete)
      await db.run(
        `UPDATE forum_posts SET is_deleted = 1, deleted_at = ? WHERE id = ?`,
        [now, postId]
      );

      // Log action
      await db.run(
        `INSERT INTO forum_moderation_log (moderator_id, action, target_type, target_id, reason, created_at)
         VALUES (?, 'hide_post', 'post', ?, ?, ?)`,
        [modId, postId, reason || null, now]
      );

      res.json({ success: true, message: "Post hidden" });
    } catch (err) {
      console.error("[forum] POST /moderation/hide-post error:", err.message);
      res.status(500).json({ error: "Failed to hide post" });
    }
  });

  // POST /api/forum/reports - Report a post (authenticated users)
  router.post("/reports", requireAuth, async (req, res) => {
    try {
      const { postId } = req.body;
      const reporterId = req.player.playerId;

      if (!postId) {
        return res.status(400).json({ error: "postId is required" });
      }

      const post = await db.get(`SELECT id FROM forum_posts WHERE id = ?`, [postId]);
      if (!post) {
        return res.status(404).json({ error: "Post not found" });
      }

      const now = Math.floor(Date.now() / 1000);

      await db.run(
        `INSERT INTO forum_reports (post_id, reporter_id, status, created_at)
         VALUES (?, ?, 'open', ?)`,
        [postId, reporterId, now]
      );

      res.status(201).json({ success: true, message: "Post reported" });
    } catch (err) {
      console.error("[forum] POST /reports error:", err.message);
      res.status(500).json({ error: "Failed to report post" });
    }
  });

  // GET /api/forum/moderation/queue - Get moderation queue (mod only)
  router.get("/moderation/queue", requireAuth, async (req, res) => {
    try {
      const modId = req.player.playerId;

      // Get moderator boards (or all if admin)
      let boardIds = [];
      if (req.player.isAdmin) {
        const boards = await db.all(`SELECT id FROM forum_boards WHERE is_active = 1`);
        boardIds = boards.map(b => b.id);
      } else {
        const modBoards = await db.all(
          `SELECT board_id FROM forum_moderators WHERE player_id = ?`,
          [modId]
        );
        boardIds = modBoards.map(b => b.board_id);
      }

      if (boardIds.length === 0) {
        return res.json({ reports: [], stats: { open: 0, total: 0 } });
      }

      const placeholders = boardIds.map(() => "?").join(",");
      const reports = await db.all(
        `SELECT fr.id, fr.post_id, fr.status, fr.created_at,
                fp.content, fp.id as post_author_id,
                ft.board_id, ft.title as topic_title
         FROM forum_reports fr
         INNER JOIN forum_posts fp ON fr.post_id = fp.id
         INNER JOIN forum_topics ft ON fp.topic_id = ft.id
         WHERE ft.board_id IN (${placeholders}) AND fr.status = 'open'
         ORDER BY fr.created_at DESC`,
        boardIds
      );

      const stats = await db.get(
        `SELECT COUNT(*) as total FROM forum_reports fr
         INNER JOIN forum_posts fp ON fr.post_id = fp.id
         INNER JOIN forum_topics ft ON fp.topic_id = ft.id
         WHERE ft.board_id IN (${placeholders})`,
        boardIds
      );

      res.json({ reports, stats: { open: reports.length, total: stats.total } });
    } catch (err) {
      console.error("[forum] GET /moderation/queue error:", err.message);
      res.status(500).json({ error: "Failed to fetch moderation queue" });
    }
  });

  // PATCH /api/forum/moderation/reports/:reportId - Review report (mod only)
  router.patch("/moderation/reports/:reportId", requireAuth, async (req, res) => {
    try {
      const { reportId } = req.params;
      const { status, actionTaken } = req.body;
      const modId = req.player.playerId;

      if (!status || !["approved", "dismissed"].includes(status)) {
        return res.status(400).json({ error: "status must be 'approved' or 'dismissed'" });
      }

      const report = await db.get(
        `SELECT fr.id, ft.board_id FROM forum_reports fr
         INNER JOIN forum_posts fp ON fr.post_id = fp.id
         INNER JOIN forum_topics ft ON fp.topic_id = ft.id
         WHERE fr.id = ?`,
        [reportId]
      );
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }

      // Verify moderator
      const isMod = await isBoardModerator(modId, report.board_id);
      if (!isMod && !req.player.isAdmin) {
        return res.status(403).json({ error: "Not a moderator for this board" });
      }

      const now = Math.floor(Date.now() / 1000);

      await db.run(
        `UPDATE forum_reports SET status = ?, action_taken = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?`,
        [status, actionTaken || null, modId, now, reportId]
      );

      res.json({ success: true, message: "Report reviewed" });
    } catch (err) {
      console.error("[forum] PATCH /moderation/reports/:reportId error:", err.message);
      res.status(500).json({ error: "Failed to review report" });
    }
  });

  return router;
};
