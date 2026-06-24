import { repairMojibake } from './repairMojibake.js';

export function repairChatText(value) {
  return repairMojibake(value === null || value === undefined ? '' : String(value));
}

export function normalizeHistoryMessage(row) {
  if (!row) return null;
  const raw = String(row.message || '');
  const isMe = row.type === 'me' || raw.startsWith('/me ');
  return {
    key: row.id != null ? `msg-${row.id}` : `msg-${row.ts || Date.now()}`,
    id: row.id,
    kind: isMe ? 'me' : 'normal',
    from: repairChatText(row.from || row.username || 'Unknown'),
    message: repairChatText(isMe ? raw.replace(/^\/me\s+/, '') : raw),
    chatColor: row.chatColor,
    isMod: !!row.isMod,
    ts: row.ts,
  };
}

export function normalizeSocketMessage(data) {
  if (!data) return null;
  const kind = data.type === 'me' ? 'me' : 'normal';
  return {
    key: data.id != null
      ? `msg-${data.id}`
      : `msg-${data.ts || Date.now()}-${data.from || 'user'}`,
    id: data.id,
    kind,
    from: repairChatText(data.from || data.username || 'Unknown'),
    message: repairChatText(data.message || ''),
    chatColor: data.chatColor,
    isMod: !!data.isMod,
    ts: data.ts || Date.now(),
  };
}

export function createSystemMessage(message) {
  const text = repairChatText(message);
  return {
    key: `sys-${Date.now()}-${text.slice(0, 24)}`,
    kind: 'system',
    message: text,
    ts: Date.now(),
  };
}

export function createWhisperMessage(from, message, sent = false) {
  const text = repairChatText(message);
  const name = repairChatText(from || 'Unknown');
  return {
    key: `whisper-${Date.now()}-${name}-${text.slice(0, 16)}`,
    kind: 'whisper',
    from: name,
    message: text,
    sent: !!sent,
    ts: Date.now(),
  };
}

export function upsertChatMessage(list, message) {
  if (!message) return list;
  if (message.id != null && list.some((item) => item.id === message.id)) {
    return list;
  }
  if (list.some((item) => item.key === message.key)) {
    return list;
  }
  return [...list, message];
}

export function mapHistoryMessages(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizeHistoryMessage).filter(Boolean);
}