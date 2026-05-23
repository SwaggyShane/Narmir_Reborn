import React from 'react';

const BountiesPanel = () => {
  const handleBountyTargetChange = (event) => {
    const sel = event?.target || event;
    const id = parseInt(sel.value) || null;
    const name = sel.options?.[sel.selectedIndex]?.text || '';
    if (window.selectBountyTarget && id) {
      window.selectBountyTarget(id, name);
    } else if (window.selectBountyTarget) {
      window.selectBountyTarget(null, '');
    }
  };

  const placeBounty = () => {
    if (window.placeBounty) {
      window.placeBounty();
    }
  };

  const handleMessageKeydown = (event) => {
    if (event.key === 'Enter') {
      sendDirectMessage();
    }
  };

  const sendDirectMessage = () => {
    if (window.sendDirectMessage) {
      window.sendDirectMessage();
    }
  };

  return (
    <>
      <div id="bounties" className="panel" style={{ display: 'none' }}>
        <div className="card" style={{ marginTop: 0 }}>
          <div className="card-title">🪙 Bounty Board</div>
          <div
            style={{
              fontSize: '13px',
              color: 'var(--text2)',
              lineHeight: 1.6,
              marginBottom: '16px',
            }}
          >
            Reward those who strike down your enemies. Place a gold bounty on any
            kingdom, and the first warrior to defeat them in battle will claim the
            prize.
          </div>

          <div className="two-col" style={{ gap: '20px', alignItems: 'start' }}>
            {/* Active Bounties */}
            <div
              style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '16px',
              }}
            >
              <h3
                style={{
                  fontSize: '11px',
                  color: 'var(--text3)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginBottom: '12px',
                }}
              >
                🎯 Active Bounties
              </h3>
              <div
                id="active-bounties-list"
                style={{ maxHeight: '400px', overflowY: 'auto' }}
              >
                <div style={{ color: 'var(--text3)', fontSize: '13px', padding: '8px 0' }}>
                  Loading bounties...
                </div>
              </div>
            </div>

            {/* Place Bounty */}
            <div
              style={{
                background: 'var(--bg3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '16px',
              }}
            >
              <h3
                style={{
                  fontSize: '11px',
                  color: 'var(--text3)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  marginBottom: '12px',
                }}
              >
                ⚔️ Place a Bounty
              </h3>
              <div style={{ marginBottom: '12px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    color: 'var(--text3)',
                    marginBottom: '4px',
                  }}
                >
                  TARGET KINGDOM
                </label>
                <select
                  id="bounty-target-select"
                  className="input"
                  style={{ width: '100%' }}
                  onChange={handleBountyTargetChange}
                >
                  <option value="">— Select a target —</option>
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    color: 'var(--text3)',
                    marginBottom: '4px',
                  }}
                >
                  REWARD (GOLD)
                </label>
                <input
                  type="number"
                  className="input"
                  id="bounty-amount"
                  min="1000"
                  step="1000"
                  style={{ textAlign: 'right', width: '100%' }}
                  placeholder="Qty"
                />
              </div>
              <button className="base-btn variant-gold" style={{ background: 'var(--gold)', color: '#000', width: '100%' }} onClick={placeBounty}>
                Place Bounty
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MESSAGES */}
      <div id="messages" className="panel panel-immersive" style={{ display: 'none' }}>
        <div className="chat-container-card chat-layout">
          {/* Conversations List */}
          <div
            className="chat-online-sidebar"
            style={{ borderLeft: 'none', borderRight: '1px solid var(--border)' }}
          >
            <div
              style={{
                padding: '16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg3)',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text2)' }}>
                Inbox
              </div>
            </div>
            <div id="conv-list" style={{ flex: 1, overflowY: 'auto' }}>
              <div
                style={{
                  color: 'var(--text3)',
                  fontSize: '13px',
                  padding: '16px',
                  textAlign: 'center',
                }}
              >
                No messages yet.
              </div>
            </div>
          </div>

          {/* Active Conversation */}
          <div className="chat-messages-area">
            <div
              id="active-conv-header"
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border2)',
                background: 'var(--bg3)',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text3)',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
              >
                Message
              </div>
              <div
                id="active-conv-name"
                style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}
              >
                Select a conversation
              </div>
            </div>
            <div
              id="active-conv-messages"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{ textAlign: 'center', color: 'var(--text3)', marginTop: '40px' }}
              >
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>✉️</div>
                Select a kingdom member from the rankings to message them.
              </div>
            </div>
            <div
              id="msg-input-wrap"
              style={{
                padding: '16px',
                borderTop: '1px solid var(--border)',
                display: 'none',
                background: 'var(--bg2)',
              }}
            >
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="input"
                  id="msg-input"
                  placeholder="Type a message..."
                  style={{ flex: 1 }}
                  onKeyDown={handleMessageKeydown}
                />
                <button className="base-btn variant-accent" style={{ background: 'var(--accent1)' }} onClick={sendDirectMessage}>
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BountiesPanel;
