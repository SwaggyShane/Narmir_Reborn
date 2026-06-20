import { toast } from "./toast.js";

export function bindGeneralSocketHandlers(socket) {
  if (!socket || socket._narmirGeneralHandlersBound) return socket;

  socket.on("connect_error", function (err) {
    console.warn("[socket]", err.message);
  });

  socket.on("event:attack_received", function (data) {
    toast("?????? " + (data.from || "Someone") + " attacked your kingdom!", "error");
    window.dispatchEvent(new CustomEvent("narmir:news-refresh"));
    if (typeof window.loadKingdom === "function") window.loadKingdom();
  });

  socket.on("event:spell_received", function () {
    window.dispatchEvent(new CustomEvent("narmir:news-refresh"));
    if (typeof window.loadKingdom === "function") window.loadKingdom();
  });

  socket.on("event:turn_update", function () {
    window.dispatchEvent(new CustomEvent("narmir:news-refresh"));
    if (typeof window.loadKingdom === "function") window.loadKingdom();
  });

  socket.on("event:forum_new", function () {
    if (typeof window.loadForum === "function") window.loadForum();
  });

  socket.on("event:forum_new_post", function () {
    if (typeof window.loadForum === "function") window.loadForum();
  });

  socket.on("event:alliance_updated", function () {
    if (typeof window.loadAlliances === "function") window.loadAlliances();
    if (typeof window.loadKingdom === "function") window.loadKingdom();
  });

  socket.on("event:world_updated", function () {
    if (typeof window.loadWorldMap === "function") window.loadWorldMap();
  });

  socket.on("event:active_counts", function () {
    if (typeof window.updateActiveCountDisplay === "function") window.updateActiveCountDisplay();
  });

  socket.on("event:chat_clear", function () {
    var list = document.getElementById("global-chat-messages");
    if (list) list.innerHTML = "";
  });

  socket.on("event:global_message", function (data) {
    console.log("[event:global_message]", data.message || "A global event occurred.");
  });

  socket._narmirGeneralHandlersBound = true;
  return socket;
}
