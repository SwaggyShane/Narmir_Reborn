import { io } from "socket.io-client";
import { apiCall } from "./utils/api";

let socket = null;
let socketPromise = null;

function getListElement(listId) {
  return document.getElementById(listId);
}

function scrollListToBottom(el) {
  if (!el) return;
  try {
    el.scrollTop = el.scrollHeight;
  } catch {
    // Ignore scroll failures on detached nodes.
  }
}

function createMessageRow(data, mode) {
  const row = document.createElement("div");
  row.className = "chat-message-row";
  row.style.width = "100%";
  row.style.display = "flex";
  row.style.flexDirection = "column";
  row.style.gap = "2px";
  row.style.padding = "6px 0";
  row.style.wordBreak = "break-word";

  if (data?.id !== undefined && data?.id !== null) {
    row.id = `cmsg-${data.id}`;
  }

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.gap = "6px";
  header.style.fontSize = "12px";
  header.style.fontWeight = "600";
  header.style.lineHeight = "1.3";

  const name = document.createElement("span");
  name.textContent = data?.from || data?.username || "Unknown";
  name.style.color = data?.chatColor || "var(--text)";
  header.appendChild(name);

  if (data?.isMod) {
    const mod = document.createElement("span");
    mod.textContent = "MOD";
    mod.className = "badge badge-green";
    mod.style.fontSize = "10px";
    header.appendChild(mod);
  }

  if (mode === "whisper") {
    const whisper = document.createElement("span");
    whisper.textContent = data?.sent ? "whisper sent" : "whisper";
    whisper.style.fontSize = "10px";
    whisper.style.color = "var(--text3)";
    header.appendChild(whisper);
  }

  const body = document.createElement("div");
  body.style.fontSize = "13px";
  body.style.lineHeight = "1.45";
  body.style.color = "var(--text2)";
  body.textContent = data?.message || "";

  if (mode === "system") {
    header.style.fontWeight = "700";
    header.style.color = "var(--gold)";
    body.style.color = "var(--text3)";
  } else if (mode === "whisper") {
    body.style.color = "var(--accent1)";
  } else if (data?.type === "me" || String(data?.message || "").startsWith("/me ")) {
    header.style.fontStyle = "italic";
    body.style.fontStyle = "italic";
  }

  row.appendChild(header);
  row.appendChild(body);
  return row;
}

export async function getSocket() {
  if (socket) return socket;
  if (!socketPromise) {
    socketPromise = Promise.resolve().then(() => {
      socket = io({
        auth: { token: localStorage.getItem("narmir_token") || "" },
        transports: ["websocket"],
      });
      return socket;
    });
  }
  return socketPromise;
}

export async function loadGlobalChatHistory(limit = 100) {
  const res = await apiCall("GET", `/api/kingdom/chat/global?limit=${encodeURIComponent(limit)}`);
  if (res && !res.error && Array.isArray(res.messages)) {
    return res.messages;
  }
  if (Array.isArray(res)) return res;
  return [];
}

export async function renderGlobalChatHistory() {
  const messages = await loadGlobalChatHistory();
  const list = getListElement("global-chat-messages");
  if (!list) return messages;

  list.innerHTML = "";
  if (!messages.length) {
    const empty = document.createElement("div");
    empty.style.textAlign = "center";
    empty.style.color = "var(--text3)";
    empty.style.fontSize = "13px";
    empty.style.padding = "40px 0";
    empty.textContent = "No chat history yet.";
    list.appendChild(empty);
    return messages;
  }

  for (const message of messages) {
    appendChatMessage("global-chat-messages", message);
  }
  scrollListToBottom(list);
  return messages;
}

export function appendChatMessage(listId, data) {
  const list = getListElement(listId);
  if (!list) return null;
  const row = createMessageRow(data, data?.type);
  list.appendChild(row);
  scrollListToBottom(list);
  return row;
}

export function appendSystemMessage(listId, message) {
  const list = getListElement(listId);
  if (!list) return null;
  const row = createMessageRow({ message }, "system");
  list.appendChild(row);
  scrollListToBottom(list);
  return row;
}

export function appendWhisperMessage(listId, from, message, sent) {
  const list = getListElement(listId);
  if (!list) return null;
  const row = createMessageRow({ from, message, sent }, "whisper");
  list.appendChild(row);
  scrollListToBottom(list);
  return row;
}

export function renderOnlineList(users = []) {
  const list = document.getElementById("chat-online-list");
  const count = document.getElementById("chat-online-count");
  if (count) count.textContent = String(users.length);
  if (!list) return users;

  list.innerHTML = "";
  if (!users.length) {
    const empty = document.createElement("div");
    empty.style.fontSize = "12px";
    empty.style.color = "var(--text3)";
    empty.style.padding = "8px 10px";
    empty.textContent = "No one online";
    list.appendChild(empty);
    return users;
  }

  users.forEach((user) => {
    const item = document.createElement("div");
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.justifyContent = "space-between";
    item.style.gap = "8px";
    item.style.padding = "6px 10px";
    item.style.fontSize = "12px";
    item.style.color = "var(--text)";

    const name = document.createElement("span");
    name.textContent = user?.username || "Unknown";
    name.style.color = user?.chatColor || "var(--text)";
    item.appendChild(name);

    if (user?.isMod) {
      const mod = document.createElement("span");
      mod.textContent = "MOD";
      mod.className = "badge badge-green";
      mod.style.fontSize = "10px";
      item.appendChild(mod);
    }

    list.appendChild(item);
  });

  return users;
}

export async function sendGlobalChat(message) {
  const socketInstance = await getSocket();
  const payload = (typeof message === "string" ? message : document.getElementById("global-chat-input")?.value || "").trim();
  if (!payload) return { error: "Message required" };

  return new Promise((resolve) => {
    socketInstance.emit("chat:global", { message: payload }, (ack) => {
      if (!ack?.error) {
        const input = document.getElementById("global-chat-input");
        if (input) input.value = "";
      }
      resolve(ack || {});
    });
  });
}

