import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { repairMojibake } from '../../utils/repairMojibake.js';
import { toast } from '../../utils/toast.js';
import { AppEvent, emitAppEvent } from '../../utils/appEvents.js';
import { useAppEvent } from '../../hooks/useAppEvent.js';
import { useActivePanel } from '../../hooks/useActivePanel.js';
import {
  createSystemMessage,
  createWhisperMessage,
  mapHistoryMessages,
  normalizeSocketMessage,
  repairChatText,
  upsertChatMessage,
} from '../../utils/chatMessages.js';
import {
  getSocket,
  loadGlobalChatHistory,
  requestOnlineUsers,
  sendGlobalChat as emitGlobalChat,
} from '../../socket-client';
import ChatMessageRow from './ChatMessageRow.jsx';

const GlobalchatPanel = () => {
  const { activePanel } = useActivePanel();
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesRef = useRef(null);
  const chatVisibleRef = useRef(activePanel === 'globalchat');
  const chatVisible = activePanel === 'globalchat';

  useEffect(() => {
    chatVisibleRef.current = chatVisible;
  }, [chatVisible]);

  const scrollToBottom = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const scrollToBottomAfterPaint = useCallback(() => {
    requestAnimationFrame(() => {
      scrollToBottom();
      requestAnimationFrame(scrollToBottom);
    });
  }, [scrollToBottom]);

  const alertChatBadge = useCallback(() => {
    emitAppEvent(AppEvent.CHAT_BADGE_ALERT);
  }, []);

  const refreshHistory = useCallback(async () => {
    const rows = await loadGlobalChatHistory();
    setMessages(mapHistoryMessages(rows));
    setLoading(false);
    return rows;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let socket = null;
    const handlers = {};

    const boot = async () => {
      try {
        socket = await getSocket();
        if (cancelled) return;

        await refreshHistory();

        handlers.connect = () => {
          requestOnlineUsers().catch((error) => {
            console.warn('[chat] Failed to refresh online users:', error);
          });
          refreshHistory().catch((error) => {
            console.warn('[chat] Failed to load history:', error);
          });
        };

        handlers.message = (data) => {
          if (data?.room === 'alliance') {
            emitAppEvent(AppEvent.ALLIANCE_CHAT_MESSAGE, data);
            return;
          }
          if (data?.room && data.room !== 'global') return;

          const normalized = normalizeSocketMessage(data);
          if (!normalized) return;

          setMessages((prev) => upsertChatMessage(prev, normalized));
          scrollToBottomAfterPaint();

          if (!chatVisibleRef.current) {
            alertChatBadge();
          }
        };

        handlers.system = (data) => {
          setMessages((prev) => [...prev, createSystemMessage(data?.message || '')]);
          scrollToBottomAfterPaint();
        };

        handlers.delete = (data) => {
          if (data?.id == null) return;
          setMessages((prev) => prev.filter((item) => item.id !== data.id));
        };

        handlers.whisper = (data) => {
          setMessages((prev) => [
            ...prev,
            createWhisperMessage(data?.from, data?.message, false),
          ]);
          scrollToBottomAfterPaint();
          alertChatBadge();
          toast(`PM from ${repairMojibake(data?.from || '')}`, 'success');
        };

        handlers.whisperSent = (data) => {
          setMessages((prev) => [
            ...prev,
            createWhisperMessage(data?.to, data?.message, true),
          ]);
          scrollToBottomAfterPaint();
        };

        handlers.kicked = (data) => {
          setMessages((prev) => [
            ...prev,
            createSystemMessage(`You were kicked. ${data?.reason || ''}`),
          ]);
          toast(`Kicked: ${data?.reason || ''}`, 'error');
        };

        handlers.banned = (data) => {
          setMessages((prev) => [
            ...prev,
            createSystemMessage(`You are banned from chat. ${data?.reason || ''}`),
          ]);
          toast(`Chat banned: ${data?.reason || ''}`, 'error');
        };

        handlers.online = (data) => {
          setOnlineUsers(Array.isArray(data?.users) ? data.users : []);
        };

        handlers.chatClear = () => {
          setMessages([]);
        };

        handlers.globalMessage = (data) => {
          setMessages((prev) => [
            ...prev,
            createSystemMessage(data?.message || 'A global event occurred.'),
          ]);
          scrollToBottomAfterPaint();
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

        if (socket.connected) {
          await requestOnlineUsers();
        }
      } catch (error) {
        console.warn('[chat] Failed to boot global chat panel:', error);
        if (!cancelled) setLoading(false);
      }
    };

    boot();

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
    };
  }, [alertChatBadge, refreshHistory, scrollToBottomAfterPaint]);

  useAppEvent(AppEvent.CHAT_CLEAR, useCallback(() => setMessages([]), []));

  useEffect(() => {
    if (!chatVisible) return undefined;

    const interval = setInterval(() => {
      refreshHistory().catch((error) => {
        console.warn('[chat] Failed to refresh global chat history:', error);
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [chatVisible, refreshHistory]);

  useLayoutEffect(() => {
    if (!chatVisible || loading) return;
    scrollToBottomAfterPaint();
  }, [chatVisible, loading, scrollToBottomAfterPaint]);

  const sendGlobalChat = async () => {
    const payload = inputValue.trim();
    if (!payload || sending) return;

    setSending(true);
    try {
      const ack = await emitGlobalChat(payload);
      if (ack?.error) {
        toast(ack.error, 'error');
        return;
      }
      setInputValue('');
    } finally {
      setSending(false);
    }
  };

  const handleKeydown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      sendGlobalChat();
    }
  };

  return (
    <div id="globalchat" className="panel panel-immersive flex h-full min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-2">
      <div className="chat-layout grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/5 bg-zinc-950/95 shadow-[0_18px_40px_rgba(0,0,0,0.35)] max-lg:grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_280px] lg:grid-rows-none">
        <div className="chat-messages-area flex min-h-0 flex-col overflow-hidden">
          <div
            ref={messagesRef}
            className="flex min-h-0 flex-1 flex-col gap-px overflow-x-hidden overflow-y-auto px-4 py-3 break-words"
          >
            {loading ? (
              <div className="py-10 text-center text-[13px] text-text3">
                Connecting to chat...
              </div>
            ) : messages.length === 0 ? (
              <div className="py-10 text-center text-[13px] text-text3">
                No chat history yet.
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessageRow key={message.key} message={message} />
              ))
            )}
          </div>
          <div className="shrink-0 border-t border-white/5 bg-zinc-900/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Message the world... (/me action | /msg user text)"
                className="input w-full min-w-0 flex-1"
                maxLength={300}
                onKeyDown={handleKeydown}
              />
              <button
                className="base-btn variant-accent shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-[13px] font-semibold disabled:opacity-60"
                onClick={sendGlobalChat}
                disabled={sending || !inputValue.trim()}
              >
                Send ↵
              </button>
            </div>
            <div className="mt-1.5 truncate text-[11px] text-text3">
              /me action | /msg &lt;user&gt; &lt;text&gt; | max 300 chars
            </div>
          </div>
        </div>

        <div className="chat-online-sidebar flex min-h-0 max-lg:max-h-36 max-lg:shrink-0 flex-col overflow-hidden border-t border-white/5 bg-zinc-950/90 lg:max-h-none lg:border-l lg:border-t-0">
          <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-zinc-900/80 px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.5px] text-text3">
              Online
            </div>
            <span className="badge badge-green">{onlineUsers.length}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {onlineUsers.length === 0 ? (
              <div className="px-2 py-2 text-[12px] text-text3">
                No one online
              </div>
            ) : (
              onlineUsers.map((user) => {
                const name = repairChatText(user?.username || 'Unknown');
                const key = `${user?.rawUsername || name}-${user?.race || 'unknown'}`;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs text-text"
                  >
                    <span style={{ color: user?.chatColor || 'var(--text)' }}>{name}</span>
                    {user?.isMod ? (
                      <span className="badge badge-green text-[10px]">MOD</span>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalchatPanel;