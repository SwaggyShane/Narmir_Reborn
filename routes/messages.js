const express = require('express');
const { requireAuth } = require('./middleware');
const { safeEmit } = require('../game/safe-socket-emit');

module.exports = (db, io) => {
  const router = express.Router();

  router.get('/', requireAuth, async (req, res) => {
    try {
      // Get unique conversations
      const rows = await db.all(`
        SELECT 
          m.*, 
          p1.username as sender_name, 
          p2.username as recipient_name,
          CASE WHEN m.sender_id = $1 THEN m.recipient_id ELSE m.sender_id END as other_id,
          CASE WHEN m.sender_id = $2 THEN p2.username ELSE p1.username END as other_name
        FROM messages m
        JOIN players p1 ON m.sender_id = p1.id
        JOIN players p2 ON m.recipient_id = p2.id
        WHERE m.sender_id = $3 OR m.recipient_id = $4
        ORDER BY m.created_at DESC
      `, [req.player.playerId, req.player.playerId, req.player.playerId, req.player.playerId]);
    
      res.json(rows);
    } catch (e) {
      console.error('[messages-list] Database error:', e);
      res.status(500).json({ error: 'Failed to load messages' });
    }
  });

  router.post('/', requireAuth, async (req, res) => {
    try {
      const { recipient_id, content } = req.body;
      if (!recipient_id || !content) return res.status(400).json({ error: 'Missing recipient or content' });
      const myId = req.player.playerId;
      if (myId === recipient_id) return res.status(400).json({ error: 'Cannot message yourself' });

      const result = await db.run(
        'INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3)',
        [myId, recipient_id, content]
      );

      // Emit real-time notification
      const senderInfo = await db.get('SELECT username FROM players WHERE id = $1', [myId]);
      safeEmit(io.to(`player:${recipient_id}`), 'message:received', {
        id: result.lastID,
        sender_id: myId,
        sender_name: senderInfo?.username || 'System',
        content,
        created_at: Math.floor(Date.now()/1000)
      });

      res.json({ ok: true });
    } catch (e) {
      console.error('[messages-send] Database error:', e);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  return router;
};
