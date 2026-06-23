import React, { useEffect, useState } from 'react';
import { repairMojibake } from '../../utils/repairMojibake.js';
import {
  getSocket,
  loadGlobalChatHistory,
  createMessageData,
  buildOnlineListData,
  sendGlobalChat as emitGlobalChat,
} from '../../socket-client';

const MessageRow = ({ messageData }) => {
  if (!messageData) return null;

  const { from, message, isMod, type, sent, styles } = messageData;
  const isItalic = type === 'whisper' || message?.startsWith('/me ');

  return (
    <div className="chat-message-row" style={styles.row}>
      <div style={styles.header}>
        <span style={styles.name}>{from}</span>
        {isMod && <span className="badge badge-green" style={{ fontSize: '10px' }}>MOD</span>}
        {type === 'whisper' && (
          <span style={{ fontSize: '10px', color: 'var(--text3)' }}>
            {sent ? 'whisper sent' : 'whisper'}
          </span>
        )}
      </div>
      <div style={{ ...styles.body, fontStyle: isItalic ? 'italic' : 'normal' }}>
        {message}
      </div>
    </div>
  );
};

const OnlineUsersList = ({ users }) => {
  if (!users || users.length === 0) {
    return (
      <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '8px 10px' }}>
        No one online
      </div>
    );
  }

  return users.map((user, idx) => (
    <div key={idx} style={user.styles.item}>
      <span style={user.styles.name}>{user.username}</span>
      {user.isMod && <span className="badge badge-green" style={{ fontSize: '10px' }}>MOD</span>}
    </div>
  ));
};

const GlobalchatPanel = () => {
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    let cancelled = false;
    let socket = null;
    const handlers = {};

    const addMessage = (data, type = 'normal') => {
      const msgData = createMessageData(data, type);
      setMessages(prev => [...prev, msgData]);
    };

    const boot = async () => {
      try {
        socket = await getSocket();
        if (!cancelled) {
          const history = await loadGlobalChatHistory();
          if (!cancelled) {
            const msgList = history.map(msg => createMessageData(msg, msg.type));
            setMessages(msgList);
          }
        }

        handlers.connect = () => {
          loadGlobalChatHistory().then(history => {
            if (!cancelled) {
              const msgList = history.map(msg => createMessageData(msg, msg.type));
              setMessages(msgList);
            }
          }).catch((error) => {
            console.warn('[chat] Failed to load history:', error);
          });
        };

        handlers.message = (data) => {
          if (data.room === 'global' || !data.room) {
            addMessage(data, 'normal');

            const panel = document.getElementById('globalchat');
            if (!panel || panel.style.display === 'none') {
              window.dispatchEvent(new CustomEvent('narmir:chat-badge-alert'));
            }
          } else if (data.room === 'alliance') {
            // Alliance messages would go to a separate panel/list
            console.log('[chat] Alliance message:', data);
          }
        };

        handlers.system = (data) => {
          addMessage({ message: data.message }, 'system');
        };

        handlers.delete = (data) => {
          setMessages(prev => prev.filter(msg => msg.id !== data.id));
        };

        handlers.whisper = (data) => {
          addMessage({ from: data.from, message: data.message, sent: false }, 'whisper');
          window.dispatchEvent(new CustomEvent('narmir:chat-badge-alert'));
          if (typeof window !== 'undefined' && typeof toast === 'function') {
            toast(`PM from ${repairMojibake(data.from || '')}`, 'success');
          }
        };

        handlers.whisperSent = (data) => {
          addMessage({ from: data.to, message: data.message, sent: true }, 'whisper');
        };

        handlers.kicked = (data) => {
          addMessage({ message: `You were kicked. ${data.reason || ''}` }, 'system');
          if (typeof window !== 'undefined' && typeof toast === 'function') {
            toast(`Kicked: ${data.reason || ''}`, 'error');
          }
        };

        handlers.banned = (data) => {
          addMessage({ message: `You are banned from chat. ${data.reason || ''}` }, 'system');
          if (typeof window !== 'undefined' && typeof toast === 'function') {
            toast(`Chat banned: ${data.reason || ''}`, 'error');
          }
        };

        handlers.online = (data) => {
          const userList = buildOnlineListData(data.users || []);
          setOnlineUsers(userList);
        };

        handlers.chatClear = () => {
          setMessages([]);
        };

        handlers.globalMessage = (data) => {
          addMessage({ message: data.message || 'A global event occurred.' }, 'system');
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
    const interval = setInterval(() => {
      const panel = document.getElementById('globalchat');
      if (panel && panel.style.display !== 'none') {
        loadGlobalChatHistory().then(history => {
          if (!cancelled) {
            const msgList = history.map(msg => createMessageData(msg, msg.type));
            setMessages(msgList);
          }
        }).catch((error) => {
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
    if (ack && ack.error && typeof toast === 'function') {
      toast(ack.error, 'error');
    }
  };

  return (
    <div id="globalchat" className="panel panel-immersive h-full min-h-0 w-full">
      <div className="chat-container-card chat-layout grid h-full min-h-0 overflow-hidden rounded-2xl border border-white/5 bg-zinc-950/95 shadow-[0_18px_40px_rgba(0,0,0,0.35)] lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* Messages area */}
        <div className="chat-messages-area flex min-h-0 flex-col">
          <div
            className="flex min-h-0 flex-1 flex-col gap-px overflow-x-hidden overflow-y-auto px-4 py-3 break-words"
          >
            {messages.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-[var(--text3)]">
                Connecting to chat...
              </div>
            ) : (
              messages.map((msg, idx) => (
                <MessageRow key={msg.id || idx} messageData={msg} />
              ))
            )}
          </div>
          <div className="shrink-0 border-t border-white/5 bg-zinc-900/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                id="global-chat-input"
                placeholder="Message the world... (/me action &middot; /msg user text)"
                className="input w-full min-w-0 flex-1"
                maxLength="300"
                onKeyDown={handleKeydown}
              />
              <button
                className="base-btn variant-accent shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-[13px] font-semibold"
                onClick={sendGlobalChat}
              >
                Send &crarr;
              </button>
            </div>
            <div className="mt-1.5 truncate text-[11px] text-[var(--text3)]">
              /me action &nbsp;&middot;&nbsp; /msg &lt;user&gt; &lt;text&gt; &nbsp;&middot;&nbsp; max 300 chars
            </div>
          </div>
        </div>

        {/* Online users sidebar */}
        <div className="chat-online-sidebar flex min-h-0 flex-col border-t border-white/5 bg-zinc-950/90 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between border-b border-white/5 bg-zinc-900/80 px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.5px] text-[var(--text3)]">
              Online
            </div>
            <span className="badge badge-green">{onlineUsers.length}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            <OnlineUsersList users={onlineUsers} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalchatPanel;
