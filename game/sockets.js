const jwt = require("jsonwebtoken");
const { setUnreadCount } = require("../cache.js");
const { devLog } = require("../utils/helpers");
const { safeEmit } = require("./safe-socket-emit");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_fallback_12345";
const onlinePlayers = new Map(); // playerId → { socketId, username, race, isMod, isAdmin, kingdomName }

module.exports = function (io, db) {
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.cookie?.match(/token=([^;]+)/)?.[1];
    if (!token) return next(new Error("Authentication required"));
    try {
      socket.player = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    // Declare variables in outer scope so they're accessible to event handlers
    let playerId, username, kingdom;

    try {
      ({ playerId, username } = socket.player);

      const player = await db.get(
        "SELECT id, username, is_admin, is_chat_mod, chat_banned, chat_color, chat_name FROM players WHERE id = $1",
        [playerId],
      );
      kingdom = await db.get(
        "SELECT id, name, race FROM kingdoms WHERE player_id = $1",
        [playerId],
      );
      if (!kingdom || !player) return socket.disconnect();

      if (player.chat_banned)
        safeEmit(socket, "chat:banned", { reason: "You are banned from chat." });

      const isMod = !!(player.is_chat_mod || player.is_admin);

      // Prevent stale connection state: disconnect previous socket if player reconnects
      const existingEntry = onlinePlayers.get(playerId);
      if (existingEntry && existingEntry.socketId !== socket.id) {
        const oldSocket = io.sockets.sockets.get(existingEntry.socketId);
        if (oldSocket) {
          oldSocket.disconnect(true);
          devLog(`[socket] Disconnected stale socket for ${username} (${existingEntry.socketId})`);
        }
      }

      onlinePlayers.set(playerId, {
        socketId: socket.id,
        username: player.username,
        chatName: player.chat_name || player.username,
        race: kingdom.race,
        isMod,
        isAdmin: !!player.is_admin,
        kingdomName: kingdom.name,
        chatColor: player.chat_color,
      });

      // Register disconnect listener immediately to prevent memory leak if later operations fail
      socket.on("disconnect", () => {
        // Only delete if this is still the current socket for this player (prevent delete after reconnect)
        if (onlinePlayers.get(playerId)?.socketId === socket.id) {
          onlinePlayers.delete(playerId);
          broadcastOnlineList(io);
        }
        devLog(`[socket] ${username} disconnected`);
      });

      socket.join(`player:${playerId}`);
      socket.join(`kingdom:${kingdom.id}`);
      socket.join("global");
      broadcastOnlineList(io);

      const membership = await db.get(
        "SELECT alliance_id FROM alliance_members WHERE kingdom_id = $1",
        [kingdom.id],
      );
      if (membership) socket.join(`alliance:${membership.alliance_id}`);

      // Initialize unread count from DB and cache it (only on first socket connection)
      const unreadRow = await db.get(
        "SELECT COUNT(*) as c FROM news WHERE kingdom_id = $1 AND is_read = 0",
        [kingdom.id],
      );
      const unreadCount = unreadRow?.c || 0;
      setUnreadCount(kingdom.id, unreadCount);
      safeEmit(socket, "unread_news", { count: unreadCount });
      devLog(`[socket] ${username} (${kingdom.name}) connected`);
    } catch (err) {
      console.error(`[socket] Connection handler error for ${socket.id}:`, err.message);
      safeEmit(socket, "error", { message: "Server error during connection setup" });
      socket.disconnect();
    }

    socket.on("chat:request_online", () => {
      safeEmit(socket, "chat:online", { users: buildOnlineList() });
    });

    // ── GLOBAL CHAT ──────────────────────────────────────────────────────────
    socket.on("chat:global", async (data, ack) => {
      const p = await db.get(
        "SELECT chat_banned, is_chat_mod, is_admin FROM players WHERE id = $1",
        [playerId],
      );
      if (p?.chat_banned) return ack?.({ error: "You are banned from chat." });

      const raw = (data.message || "").trim().slice(0, 300);
      if (!raw) return;

      const modPriv = !!(p?.is_chat_mod || p?.is_admin);

      // IRC commands
      if (raw.startsWith("/")) {
        const parts = raw.slice(1).split(" ");
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        if (cmd === "me") {
          const action = args.join(" ").trim();
          if (!action) return ack?.({ error: "Usage: /me <action>" });
          const info = onlinePlayers.get(playerId);
          const activeName = info?.chatName || username;
          await db.run(
            "INSERT INTO chat_messages (kingdom_id,player_id,username,room,message) VALUES ($1,$2,$3,$4,$5)",
            [kingdom.id, playerId, username, "global", `/me ${action}`],
          );
          safeEmit(io.to("global"), "chat:message", {
            room: "global",
            type: "me",
            from: activeName,
            race: kingdom.race,
            isMod: modPriv,
            chatColor: info?.chatColor,
            message: action,
            ts: Date.now(),
          });
          return ack?.({ ok: true });
        }

        if (cmd === "color") {
          const newColor = args[0];
          if (!newColor)
            return ack?.({ error: "Usage: /color <hex_code or css_color>" });
          // Basic validation (hex or simple names)
          if (
            !newColor.match(/^#[0-9a-fA-F]{3,6}$/) &&
            !newColor.match(/^[a-z]+$/i)
          ) {
            return ack?.({ error: "Invalid color format. Use #hex or name." });
          }
          await db.run("UPDATE players SET chat_color = $1 WHERE id = $2", [
            newColor,
            playerId,
          ]);
          const info = onlinePlayers.get(playerId);
          if (info) info.chatColor = newColor;
          broadcastOnlineList(io);
          return ack?.({
            ok: true,
            message: `Chat color updated to ${newColor}`,
          });
        }

        if (cmd === "nick" || cmd === "name") {
          const newName = args.join(" ").trim().slice(0, 20);
          if (!newName) return ack?.({ error: "Usage: /nick <name>" });
          await db.run("UPDATE players SET chat_name = $1 WHERE id = $2", [
            newName,
            playerId,
          ]);
          const info = onlinePlayers.get(playerId);
          if (info) info.chatName = newName;
          broadcastOnlineList(io);
          return ack?.({
            ok: true,
            message: `Chat name updated to ${newName}`,
          });
        }

        if (cmd === "msg" || cmd === "pm" || cmd === "whisper") {
          const targetName = args[0];
          const pmMsg = args.slice(1).join(" ").trim();
          if (!targetName || !pmMsg)
            return ack?.({ error: "Usage: /msg <username> <message>" });

          const tPlayer = await db.get(
            "SELECT id FROM players WHERE username = $1",
            [targetName],
          );
          if (!tPlayer)
            return ack?.({ error: `User "${targetName}" not found` });

          // Store in DB for persistent messages system
          await db.run(
            "INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3)",
            [playerId, tPlayer.id, pmMsg],
          );

          const tInfo = [...onlinePlayers.values()].find(
            (p) => p.username === targetName,
          );
          if (tInfo) {
            safeEmit(io.to(tInfo.socketId), "message:received", {
              sender_id: playerId,
              sender_name: username,
              content: pmMsg,
              ts: Date.now(),
            });
          }

          // Legacy whisper events for chat console
          if (tInfo)
            safeEmit(io.to(tInfo.socketId), "chat:whisper", {
              from: username,
              message: pmMsg,
              ts: Date.now(),
            });
          safeEmit(socket, "chat:whisper_sent", {
            to: targetName,
            message: pmMsg,
            ts: Date.now(),
          });
          return ack?.({ ok: true });
        }

        if (!modPriv)
          return ack?.({
            error: `Unknown command /${cmd}. Try /me or /msg <user> <text>`,
          });

        if (cmd === "kick") {
          const targetName = args[0];
          const reason = args.slice(1).join(" ") || "No reason given";
          const tInfo = [...onlinePlayers.values()].find(
            (p) => p.username === targetName,
          );
          if (!tInfo) return ack?.({ error: `${targetName} is not online` });
          safeEmit(io.to(tInfo.socketId), "chat:kicked", { reason });
          safeEmit(io.to("global"), "chat:system", {
            message: `🔨 ${targetName} was kicked. (${reason})`,
            ts: Date.now(),
          });
          return ack?.({ ok: true });
        }

        if (cmd === "ban") {
          const targetName = args[0];
          const reason = args.slice(1).join(" ") || "No reason given";
          const tp = await db.get(
            "SELECT id, is_admin FROM players WHERE username = $1",
            [targetName],
          );
          if (!tp) return ack?.({ error: `User "${targetName}" not found` });
          if (tp.is_admin) return ack?.({ error: "Cannot ban an admin." });
          await db.run(
            "UPDATE players SET chat_banned=1, chat_ban_reason=$1 WHERE id=$2",
            [reason, tp.id],
          );
          const tInfo = [...onlinePlayers.values()].find(
            (p) => p.username === targetName,
          );
          if (tInfo) safeEmit(io.to(tInfo.socketId), "chat:banned", { reason });
          safeEmit(io.to("global"), "chat:system", {
            message: `🔨 ${targetName} has been banned from chat. (${reason})`,
            ts: Date.now(),
          });
          return ack?.({ ok: true });
        }

        if (cmd === "unban") {
          const targetName = args[0];
          await db.run(
            "UPDATE players SET chat_banned=0, chat_ban_reason=NULL WHERE username=$1",
            [targetName],
          );
          safeEmit(io.to("global"), "chat:system", {
            message: `✅ ${targetName} has been unbanned from chat.`,
            ts: Date.now(),
          });
          return ack?.({ ok: true });
        }

        if (cmd === "delete") {
          const msgId = parseInt(args[0]);
          if (!msgId) return ack?.({ error: "Usage: /delete <message_id>" });
          await db.run("UPDATE chat_messages SET deleted=1 WHERE id=$1", [
            msgId,
          ]);
          safeEmit(io.to("global"), "chat:delete", { id: msgId });
          return ack?.({ ok: true });
        }

        return ack?.({ error: `Unknown mod command /${cmd}` });
      }

      // Normal message
      const info = onlinePlayers.get(playerId);
      const activeName = info?.chatName || username;
      const res = await db.run(
        "INSERT INTO chat_messages (kingdom_id,player_id,username,room,message) VALUES ($1,$2,$3,$4,$5)",
        [kingdom.id, playerId, username, "global", raw],
      );
      safeEmit(io.to("global"), "chat:message", {
        id: res.lastID,
        room: "global",
        type: "normal",
        from: activeName,
        race: kingdom.race,
        isMod: modPriv,
        chatColor: info?.chatColor,
        message: raw,
        ts: Date.now(),
      });
      ack?.({ ok: true });
    });

    // ── ALLIANCE CHAT ────────────────────────────────────────────────────────
    socket.on("chat:alliance", async (data, ack) => {
      const msg = (data.message || "").trim().slice(0, 300);
      if (!msg) return;
      const m = await db.get(
        "SELECT alliance_id FROM alliance_members WHERE kingdom_id=$1",
        [kingdom.id],
      );
      if (!m) return ack?.({ error: "Not in an alliance" });
      await db.run(
        "INSERT INTO chat_messages (kingdom_id,player_id,username,room,message) VALUES ($1,$2,$3,$4,$5)",
        [kingdom.id, playerId, username, String(m.alliance_id), msg],
      );
      safeEmit(io.to(`alliance:${m.alliance_id}`), "chat:message", {
        room: "alliance",
        from: username,
        race: kingdom.race,
        message: msg,
        ts: Date.now(),
      });
      ack?.({ ok: true });
    });
  });

  // REST endpoint helper
  io.onlinePlayersList = () =>
    [...onlinePlayers.values()].map((p) => ({
      username: p.username,
      race: p.race,
      isMod: p.isMod,
    }));
};

function buildOnlineList() {
  return [...onlinePlayers.values()].map((p) => ({
    username: p.chatName || p.username,
    rawUsername: p.username,
    race: p.race,
    isMod: p.isMod,
    chatColor: p.chatColor,
  }));
}

function broadcastOnlineList(io) {
  safeEmit(io.to("global"), "chat:online", { users: buildOnlineList() });
}
