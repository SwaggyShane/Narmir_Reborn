import React from 'react';

const GlobalchatPanel = () => {
  const handleKeydown = (event) => {
    if (event.key === "Enter") sendGlobalChat();
  };

  const sendGlobalChat = () => {
    if (window.sendGlobalChat) window.sendGlobalChat();
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
