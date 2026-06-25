import { io } from 'socket.io-client';
import { apiCall } from './utils/api.mjs';

let socket = null;
let socketPromise = null;

export async function getSocket() {
  if (socket) return socket;
  if (!socketPromise) {
    socketPromise = Promise.resolve().then(() => {
      if (typeof window === 'undefined') {
        throw new Error('Socket client requires a browser environment');
      }
      socket = io({
        auth: { token: localStorage.getItem('narmir_token') || '' },
        transports: ['websocket'],
      });
      return socket;
    });
  }
  return socketPromise;
}

export async function requestOnlineUsers() {
  const socketInstance = await getSocket();
  socketInstance.emit('chat:request_online');
}

export async function loadGlobalChatHistory(limit = 100) {
  const res = await apiCall(`/api/kingdom/chat/global?limit=${encodeURIComponent(limit)}`);
  if (res && !res.error && Array.isArray(res.messages)) {
    return res.messages;
  }
  if (Array.isArray(res)) return res;
  return [];
}

export async function sendGlobalChat(message) {
  const socketInstance = await getSocket();
  const payload = String(message || '').trim();
  if (!payload) return { error: 'Message required' };

  return new Promise((resolve) => {
    socketInstance.emit('chat:global', { message: payload }, (ack) => {
      resolve(ack || {});
    });
  });
}

export async function sendDirectMessage(recipient, message) {
  const socketInstance = await getSocket();
  const target = String(recipient || '').trim();
  const payload = String(message || '').trim();
  if (!target) return { error: 'Recipient required' };
  if (!payload) return { error: 'Message required' };

  return new Promise((resolve) => {
    socketInstance.emit('chat:global', { message: `/msg ${target} ${payload}` }, (ack) => {
      resolve(ack || {});
    });
  });
}

export async function loadAllianceChatHistory(allianceId, limit = 80) {
  const room = String(allianceId || '').trim();
  if (!room) return [];
  const res = await apiCall(`/api/chat/${encodeURIComponent(room)}?limit=${encodeURIComponent(limit)}`);
  if (Array.isArray(res)) return res;
  if (res && !res.error && Array.isArray(res.messages)) return res.messages;
  return [];
}

export async function sendAllianceChat(message) {
  const socketInstance = await getSocket();
  const payload = String(message || '').trim();
  if (!payload) return { error: 'Message required' };

  return new Promise((resolve) => {
    socketInstance.emit('chat:alliance', { message: payload }, (ack) => {
      resolve(ack || {});
    });
  });
}