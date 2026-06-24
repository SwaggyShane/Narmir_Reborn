let socket = null;
let socketPromise = null;
let ioLoaderPromise = null;

function apiCall(method, url, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const csrf = typeof document !== 'undefined' ? document.cookie.match(/(?:^|; )csrf_token=([^;]+)/) : null;
  if (csrf?.[1] && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method).toUpperCase())) {
    headers['x-csrf-token'] = decodeURIComponent(csrf[1]);
  }

  return fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => {
    try {
      const data = await res.json();
      return data;
    } catch {
      return { error: `Server error ${res.status}` };
    }
  }).catch((error) => ({ error: error.message }));
}

function loadSocketIoClient() {
  if (typeof window.io === 'function') return Promise.resolve(window.io);
  if (!ioLoaderPromise) {
    ioLoaderPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-narmir-socketio="true"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.io));
        existing.addEventListener('error', () => reject(new Error('Failed to load Socket.IO client')));
        return;
      }

      const script = document.createElement('script');
      script.src = '/socket.io/socket.io.js';
      script.async = true;
      script.dataset.narmirSocketio = 'true';
      script.onload = () => resolve(window.io);
      script.onerror = () => reject(new Error('Failed to load Socket.IO client'));
      document.head.appendChild(script);
    });
  }
  return ioLoaderPromise;
}

export async function getSocket() {
  if (typeof window !== 'undefined' && window.__narmirSocket && typeof window.__narmirSocket.emit === 'function') {
    socket = window.__narmirSocket;
    return socket;
  }
  if (socket) return socket;
  if (!socketPromise) {
    socketPromise = Promise.resolve()
      .then(() => loadSocketIoClient())
      .then((io) => {
        if (typeof io !== 'function') {
          throw new Error('Socket.IO client script not loaded');
        }
        socket = io({
          auth: { token: localStorage.getItem('narmir_token') || '' },
          transports: ['websocket'],
        });
        if (typeof window !== 'undefined') {
          window.__narmirSocket = socket;
        }
        return socket;
      });
  }
  return socketPromise;
}

export async function loadGlobalChatHistory(limit = 100) {
  const res = await apiCall('GET', `/api/kingdom/chat/global?limit=${encodeURIComponent(limit)}`);
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
  const res = await apiCall('GET', `/api/chat/${encodeURIComponent(room)}?limit=${encodeURIComponent(limit)}`);
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

if (typeof window !== 'undefined') {
  window.__narmirGetSocket = getSocket;
  window.__narmirSocketClient = {
    getSocket,
    loadGlobalChatHistory,
    sendGlobalChat,
    sendDirectMessage,
  };
}