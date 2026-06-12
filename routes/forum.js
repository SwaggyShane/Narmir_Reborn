const express = require("express");
const router = express.Router();
const { requireAuth } = require("./middleware");

module.exports = function (db) {
  // ──────────── PUBLIC ENDPOINTS (No auth required) ────────────

  // GET /api/forum/boards - Get all active forum boards
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

      let orderClause = "ft.created_at DESC";
      if (sort === "mostActive") {
        orderClause = "ft.last_post_at DESC";
      } else if (sort === "oldest") {
        orderClause = "ft.created_at ASC";
      }

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

      res.json({
        topic,
        posts: posts || [],
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

  // POST /api/forum/topics - Create a new topic
  router.post("/topics", requireAuth, async (req, res) => {
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


      // Create topic with first post
      const result = await db.run(
        `INSERT INTO forum_topics (board_id, player_id, title, content, post_count, last_post_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
        [boardId, playerId, title.trim(), content.trim(), Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
      );

      const topicId = result.lastID;

      // Create the first post
      await db.run(
        `INSERT INTO forum_posts (topic_id, player_id, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [topicId, playerId, content.trim(), Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
      );

      res.status(201).json({
        success: true,
        topicId,
        message: "Topic created successfully",
      });
    } catch (err) {
      console.error("[forum] POST /topics error:", err.message);
      res.status(500).json({ error: "Failed to create topic" });
    }
  });

  // POST /api/forum/topics/:topicId/posts - Create a reply to a topic
  router.post("/topics/:topicId/posts", requireAuth, async (req, res) => {
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

      // Create post
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

      res.status(201).json({
        success: true,
        postId,
        message: "Reply posted successfully",
      });
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
        const now = Math.floor(Date.now() / 1000);
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

  return router;
};
