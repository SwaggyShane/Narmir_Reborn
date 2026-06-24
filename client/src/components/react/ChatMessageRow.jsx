import React from 'react';
import clsx from 'clsx';

const ChatMessageRow = ({ message }) => {
  if (!message) return null;

  const isSystem = message.kind === 'system';
  const isWhisper = message.kind === 'whisper';
  const isMe = message.kind === 'me';

  return (
    <div
      id={message.id != null ? `cmsg-${message.id}` : undefined}
      className="flex w-full flex-col gap-0.5 break-words py-1.5"
    >
      {!isSystem ? (
        <div className="flex items-center gap-1.5 text-xs font-semibold leading-snug">
          <span style={{ color: message.chatColor || 'var(--text)' }}>
            {message.from || 'Unknown'}
          </span>
          {message.isMod ? (
            <span className="badge badge-green text-[10px]">MOD</span>
          ) : null}
          {isWhisper ? (
            <span className="text-[10px] text-text3">
              {message.sent ? 'whisper sent' : 'whisper'}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="text-xs font-bold text-gold">System</div>
      )}
      <div
        className={clsx(
          'text-[13px] leading-snug',
          isSystem && 'text-text3',
          isWhisper && 'text-accent1',
          !isSystem && !isWhisper && 'text-text2',
          (isMe || isWhisper) && 'italic',
        )}
      >
        {message.message}
      </div>
    </div>
  );
};

export default ChatMessageRow;