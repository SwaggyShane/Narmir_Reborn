import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { apiCall } from '../../utils/api.mjs';
import { repairMojibake } from '../../utils/repairMojibake.js';
import { toast } from '../../utils/toast.js';
import { registerOpenDirectMessage } from '../../utils/directMessage.js';
import { getSocket } from '../../socket-client.js';
import { useActivePanel } from '../../hooks/useActivePanel.js';
import { AppEvent, emitAppEvent } from '../../utils/appEvents.js';
import { switchTab } from '../../utils/switchTab.js';
import EmptyState from './EmptyState.jsx';

function formatTimestamp(unixTs) {
  if (!unixTs) return '';
  const date = new Date(Number(unixTs) * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function buildConversations(rows, myPlayerId) {
  const map = new Map();

  for (const row of rows) {
    const otherId = Number(row.other_id);
    if (!otherId) continue;

    if (!map.has(otherId)) {
      map.set(otherId, {
        otherId,
        otherName: repairMojibake(row.other_name || 'Unknown'),
        messages: [],
        lastAt: 0,
      });
    }

    const conv = map.get(otherId);
    const createdAt = Number(row.created_at || 0);
    conv.messages.push({
      id: row.id,
      content: repairMojibake(row.content || ''),
      created_at: createdAt,
      sender_id: Number(row.sender_id),
      isMine: Number(row.sender_id) === Number(myPlayerId),
      sender_name: repairMojibake(row.sender_name || ''),
    });
    conv.lastAt = Math.max(conv.lastAt, createdAt);
  }

  const conversations = [...map.values()];
  conversations.forEach((conv) => {
    conv.messages.sort((a, b) => a.created_at - b.created_at);
  });
  conversations.sort((a, b) => b.lastAt - a.lastAt);
  return conversations;
}

const MessagesPanel = () => {
  const { activePanel } = useActivePanel();
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeOtherId, setActiveOtherId] = useState(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const threadRef = useRef(null);
  const activePanelRef = useRef(activePanel);
  activePanelRef.current = activePanel;

  const activeConversation = useMemo(
    () => conversations.find((conv) => conv.otherId === activeOtherId) || null,
    [conversations, activeOtherId],
  );

  const scrollToBottom = useCallback(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const loadMessages = useCallback(async () => {
    setError('');
    const [me, rows] = await Promise.all([
      apiCall('/api/auth/me'),
      apiCall('/api/messages'),
    ]);

    if (me?.error) throw new Error(me.error);
    if (rows?.error) throw new Error(rows.error);

    const playerId = Number(me.playerId);
    setMyPlayerId(playerId);
    const nextConversations = buildConversations(Array.isArray(rows) ? rows : [], playerId);
    setConversations(nextConversations);
    return nextConversations;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await loadMessages();
    } catch (err) {
      setError(err?.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [loadMessages]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    const unregister = registerOpenDirectMessage(({ playerId, name }) => {
      const otherId = Number(playerId);
      if (!otherId) return;
      const label = repairMojibake(String(name || '').trim() || 'Unknown');

      setActiveOtherId(otherId);
      setDraft('');
      setConversations((prev) => {
        if (prev.some((conv) => conv.otherId === otherId)) return prev;
        return [
          {
            otherId,
            otherName: label,
            messages: [],
            lastAt: 0,
          },
          ...prev,
        ];
      });
    });

    return unregister;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let socket = null;

    const onReceived = (data) => {
      const senderId = Number(data?.sender_id);
      if (!senderId || (myPlayerId && senderId === myPlayerId)) return;

      setConversations((prev) => {
        const otherId = senderId;
        const content = repairMojibake(data?.content || '');
        const createdAt = Number(data?.created_at || Math.floor(Date.now() / 1000));
        const existing = prev.find((conv) => conv.otherId === otherId);

        if (existing) {
          return prev
            .map((conv) => {
              if (conv.otherId !== otherId) return conv;
              return {
                ...conv,
                messages: [
                  ...conv.messages,
                  {
                    id: data.id || `live-${createdAt}`,
                    content,
                    created_at: createdAt,
                    sender_id: senderId,
                    isMine: false,
                    sender_name: repairMojibake(data.sender_name || ''),
                  },
                ],
                lastAt: Math.max(conv.lastAt, createdAt),
              };
            })
            .sort((a, b) => b.lastAt - a.lastAt);
        }

        return [
          {
            otherId,
            otherName: repairMojibake(data.sender_name || 'Unknown'),
            messages: [{
              id: data.id || `live-${createdAt}`,
              content,
              created_at: createdAt,
              sender_id: senderId,
              isMine: false,
              sender_name: repairMojibake(data.sender_name || ''),
            }],
            lastAt: createdAt,
          },
          ...prev,
        ];
      });

      setActiveOtherId((current) => current || senderId);
      requestAnimationFrame(scrollToBottom);
      if (activePanelRef.current !== 'messages') {
        emitAppEvent(AppEvent.MESSAGES_BADGE);
      }
    };

    const boot = async () => {
      try {
        socket = await getSocket();
        if (cancelled) return;
        socket.on('message:received', onReceived);
      } catch (err) {
        console.warn('[messages] Socket hookup failed:', err);
      }
    };

    boot();

    return () => {
      cancelled = true;
      if (socket) socket.off('message:received', onReceived);
    };
  }, [scrollToBottom, myPlayerId]);

  useEffect(() => {
    requestAnimationFrame(scrollToBottom);
  }, [activeConversation?.messages.length, scrollToBottom]);

  const handleSend = async () => {
    const recipientId = activeOtherId;
    const content = draft.trim();
    if (!recipientId) {
      toast('Select a conversation first', 'error');
      return;
    }
    if (!content) return;

    setSending(true);
    try {
      const res = await apiCall('/api/messages', {
        method: 'POST',
        body: { recipient_id: recipientId, content },
      });
      if (res?.error) throw new Error(res.error);

      const createdAt = Math.floor(Date.now() / 1000);
      setDraft('');
      setConversations((prev) => prev
        .map((conv) => {
          if (conv.otherId !== recipientId) return conv;
          return {
            ...conv,
            messages: [
              ...conv.messages,
              {
                id: res.id || `local-${createdAt}`,
                content,
                created_at: createdAt,
                sender_id: myPlayerId,
                isMine: true,
                sender_name: 'You',
              },
            ],
            lastAt: createdAt,
          };
        })
        .sort((a, b) => b.lastAt - a.lastAt));

      toast('Message sent', 'success');
      requestAnimationFrame(scrollToBottom);
    } catch (err) {
      toast(err?.message || 'Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="panel min-h-0 w-full overflow-hidden px-4 pb-5">
      <div className="mx-auto grid h-full min-h-[680px] w-full max-w-6xl grid-cols-1 overflow-hidden rounded-[20px] border border-white/10 bg-void-900/80 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col border-b border-white/10 xl:border-b-0 xl:border-r xl:border-white/10">
          <div className="flex items-center justify-between border-b border-white/10 bg-void-950/80 px-4 py-4">
            <div className="text-[13px] font-bold text-text2">Inbox</div>
            <button type="button" className="base-btn px-2 py-1 text-[11px]" onClick={() => refresh()} disabled={loading}>
              Refresh
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-5 text-center text-[13px] text-text3">Loading messages...</div>
            ) : conversations.length ? (
              conversations.map((conv) => (
                <button
                  key={conv.otherId}
                  type="button"
                  className={clsx(
                    'w-full border-b border-white/5 px-4 py-3 text-left transition-colors',
                    activeOtherId === conv.otherId ? 'bg-void-950/90' : 'hover:bg-void-950/50',
                  )}
                  onClick={() => {
                    setActiveOtherId(conv.otherId);
                    setDraft('');
                  }}
                >
                  <div className="font-semibold text-text">{conv.otherName}</div>
                  <div className="truncate text-[12px] text-text3">
                    {conv.messages[conv.messages.length - 1]?.content || 'No messages yet'}
                  </div>
                </button>
              ))
            ) : (
              <EmptyState
                icon="✉️"
                title="Inbox is empty"
                description="Message a player from Rankings or a kingdom profile to start a conversation."
                actionLabel="Open Rankings"
                onAction={() => switchTab('rankings')}
              />
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          <div className="border-b border-white/10 bg-void-950/80 px-5 py-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-text3">Message</div>
            <div className="text-[16px] font-bold text-text">
              {activeConversation?.otherName || 'Select a conversation'}
            </div>
          </div>

          <div
            ref={threadRef}
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-5"
          >
            {error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            {activeConversation ? (
              activeConversation.messages.length ? (
                activeConversation.messages.map((message) => (
                  <div
                    key={message.id}
                    className={clsx(
                      'max-w-[85%] rounded-2xl px-3 py-2 text-[13px]',
                      message.isMine
                        ? 'ml-auto bg-accent1/20 text-text'
                        : 'mr-auto bg-void-950/80 text-text2',
                    )}
                  >
                    <div className="mb-1 text-[11px] font-semibold text-text3">
                      {message.isMine ? 'You' : message.sender_name || activeConversation.otherName}
                      {message.created_at ? ` | ${formatTimestamp(message.created_at)}` : ''}
                    </div>
                    <div>{message.content}</div>
                  </div>
                ))
              ) : (
                <EmptyState
                  icon="✉️"
                  title="New conversation"
                  description={`Send the first message to ${activeConversation.otherName}.`}
                />
              )
            ) : (
              <EmptyState
                icon="✉️"
                title="Select a conversation"
                description="Pick someone from your inbox, or message a player from Rankings."
                actionLabel="Open Rankings"
                onAction={() => switchTab('rankings')}
              />
            )}
          </div>

          <div className="border-t border-white/10 bg-void-900/80 px-4 py-4">
            <div className="flex gap-2.5">
              <input
                type="text"
                className="input min-w-0 flex-1"
                placeholder={
                  activeConversation
                    ? `Message ${activeConversation.otherName}...`
                    : 'Select a conversation first...'
                }
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={!activeConversation || sending}
              />
              <button
                type="button"
                className="base-btn variant-accent bg-accent1"
                onClick={handleSend}
                disabled={!activeConversation || sending}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagesPanel;