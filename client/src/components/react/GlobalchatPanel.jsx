import React, { useEffect } from 'react';
import { repairMojibake } from '../../utils/repairMojibake.js';
import {
  getSocket,
  renderGlobalChatHistory,
  renderOnlineList,
  appendChatMessage,
  appendSystemMessage,
  appendWhisperMessage,
  sendGlobalChat as emitGlobalChat,
} from '../../socket-client';

const GlobalchatPanel = () => {
  useEffect(() => {
    let cancelled = false;
    let socket = null;
    const handlers = {};

    const boot = async () => {
      try {
        socket = await getSocket();
        if (!cancelled) await renderGlobalChatHistory();

        handlers.connect = () => {
          renderGlobalChatHistory().catch((error) => {
            console.warn('[chat] Failed to load history:', error);
          });
        };

        handlers.message = (data) => {
          if (data.room === 'global' || !data.room) {
            appendChatMessage('global-chat-messages', data);

            const panel = document.getElementById('globalchat');
            if (!panel || panel.style.display === 'none') {
              const b = document.getElementById('chat-badge');
              if (b) b.style.display = 'inline';

              const nc = document.getElementById('nav-chat-item');
              if (nc && !nc.classList.contains('nav-flash')) nc.classList.add('nav-flash');

              const bnc = document.getElementById('bnav-chat-item');
              if (bnc && !bnc.classList.contains('nav-flash')) bnc.classList.add('nav-flash');
            }
          } else if (data.room === 'alliance') {
            appendChatMessage('alliance-chat', data);
          }
        };

        handlers.system = (data) => {
          appendSystemMessage('global-chat-messages', data.message);
        };

        handlers.delete = (data) => {
          const el = document.getElementById(`cmsg-${data.id}`);
          if (el) el.remove();
        };

        handlers.whisper = (data) => {
          appendWhisperMessage('global-chat-messages', data.from, data.message, false);
          const b = document.getElementById('chat-badge');
          if (b) b.style.display = 'inline';
          const nc = document.getElementById('nav-chat-item');
          if (nc && !nc.classList.contains('nav-flash')) nc.classList.add('nav-flash');
          const bnc = document.getElementById('bnav-chat-item');
          if (bnc && !bnc.classList.contains('nav-flash')) bnc.classList.add('nav-flash');
          if (typeof window !== 'undefined' && typeof toast === 'function') toast(`PM from ${repairMojibake(data.from || '')}`, 'success');
        };

        handlers.whisperSent = (data) => {
          appendWhisperMessage('global-chat-messages', data.to, data.message, true);
        };

        handlers.kicked = (data) => {
          appendSystemMessage('global-chat-messages', `You were kicked. ${data.reason || ''}`);
          if (typeof window !== 'undefined' && typeof toast === 'function') toast(`Kicked: ${data.reason || ''}`, 'error');
        };

        handlers.banned = (data) => {
          appendSystemMessage('global-chat-messages', `You are banned from chat. ${data.reason || ''}`);
          if (typeof window !== 'undefined' && typeof toast === 'function') toast(`Chat banned: ${data.reason || ''}`, 'error');
        };

        handlers.online = (data) => {
          renderOnlineList(data.users || []);
        };

        handlers.chatClear = () => {
          const list = document.getElementById('global-chat-messages');
          if (list) list.innerHTML = '';
        };

        handlers.globalMessage = (data) => {
          appendSystemMessage('global-chat-messages', data.message || 'A global event occurred.');
        };

        socket.on('connect', handlers.connect);
        socket.on('chat:message', handlers.message);
        socket.on('chat:system', handlers.system);
        socket.on('chat:delete', handlers.delete);
        socket.on('chat:whisper', handlers.whisper);
        socket.on('chat:whisper_sent', handlers.whisperSent);
        socket.on('chat:kicked', handlers.kicked);
        socket.on('chat:banned', handlers.banned);
        socket.on('chat:online', handlers.online);
        socket.on('event:chat_clear', handlers.chatClear);
        socket.on('event:global_message', handlers.globalMessage);
      } catch (error) {
        console.warn('[chat] Failed to boot global chat panel:', error);
      }
    };

    boot();

    // Poll for new messages every 5s to catch Discord relay messages
    // that are inserted directly into DB without a socket broadcast
    const interval = setInterval(() => {
      const panel = document.getElementById('globalchat');
      if (panel && panel.style.display !== 'none') {
        renderGlobalChatHistory().catch((error) => {
          console.warn('[chat] Failed to refresh global chat history:', error);
        });
      }
    }, 5000);

    return () => {
      cancelled = true;
      if (socket) {
        if (handlers.connect) socket.off('connect', handlers.connect);
        if (handlers.message) socket.off('chat:message', handlers.message);
        if (handlers.system) socket.off('chat:system', handlers.system);
        if (handlers.delete) socket.off('chat:delete', handlers.delete);
        if (handlers.whisper) socket.off('chat:whisper', handlers.whisper);
        if (handlers.whisperSent) socket.off('chat:whisper_sent', handlers.whisperSent);
        if (handlers.kicked) socket.off('chat:kicked', handlers.kicked);
        if (handlers.banned) socket.off('chat:banned', handlers.banned);
        if (handlers.online) socket.off('chat:online', handlers.online);
        if (handlers.chatClear) socket.off('event:chat_clear', handlers.chatClear);
        if (handlers.globalMessage) socket.off('event:global_message', handlers.globalMessage);
      }
      clearInterval(interval);
    };
  }, []);

  const handleKeydown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendGlobalChat();
    }
  };

  const sendGlobalChat = async () => {
    const ack = await emitGlobalChat();
    if (ack && ack.error && toast) toast(ack.error, 'error');
  };

  return (
    <div id="globalchat" className="panel panel-immersive" style={{ display: 'none' }}>
      <div className="chat-container-card chat-layout">
        {/* Messages area */}
        <div className="chat-messages-area">
          <div
            id="global-chat-messages"
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              gap: '1px',
              padding: '14px 16px',
              wordBreak: 'break-word',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '13px', padding: '40px 0' }}>
              Connecting to chat...
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', background: 'var(--bg2)', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                className="input"
                id="global-chat-input"
                placeholder="Message the world... (/me action &middot; /msg user text)"
                style={{ flex: 1, width: 'auto' }}
                maxLength="300"
                onKeyDown={handleKeydown}
              />
              <button
                className="base-btn variant-accent"
                onClick={sendGlobalChat}
                style={{ whiteSpace: 'nowrap', padding: '9px 18px', background: 'var(--accent1)' }}
              >
                Send &crarr;
              </button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              /me action &nbsp;&middot;&nbsp; /msg &lt;user&gt; &lt;text&gt; &nbsp;&middot;&nbsp; max 300 chars
            </div>
          </div>
        </div>

        {/* Online users sidebar */}
        <div className="chat-online-sidebar">
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text3)' }}>
              Online
            </div>
            <span id="chat-online-count" className="badge badge-green">0</span>
          </div>
          <div id="chat-online-list" style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '8px 10px' }}>
              No one online
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalchatPanel;
