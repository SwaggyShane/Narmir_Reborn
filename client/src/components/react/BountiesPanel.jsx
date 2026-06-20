import React, { useState, useEffect, useCallback } from 'react';
import { apiCall } from '../../utils/api';

const REFRESH_INTERVAL_MS = 60 * 1000;

const BountiesPanel = () => {
  const [bounties, setBounties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [targets, setTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState('');
  const [amount, setAmount] = useState('');
  const [placing, setPlacing] = useState(false);

  const fmt = (n) => (n || 0).toLocaleString();

  const fetchBounties = useCallback(async () => {
    try {
      const data = await apiCall('/api/world/bounties');
      if (data.error) {
        setError(data.error);
        return;
      }
      setBounties(data);
      setError(null);
    } catch (e) {
      setError('Failed to load bounties');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTargets = useCallback(() => {
    const rankings = window.rankingsCache || [];
    const myId = window.state?.kingdomId;
    setTargets(rankings.filter(r => r.id !== myId).slice(0, 50));
  }, []);

  useEffect(() => {
    fetchBounties();
    loadTargets();

    window.refreshBountiesPanel = fetchBounties;

    const interval = setInterval(fetchBounties, REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      delete window.refreshBountiesPanel;
    };
  }, [fetchBounties, loadTargets]);

  const handlePlaceBounty = async () => {
    const parsedAmount = parseInt(amount);
    if (!selectedTarget) return window.toast?.('Select a target kingdom first', 'error');
    if (!parsedAmount || parsedAmount < 1000) return window.toast?.('Minimum bounty is 1,000 GC', 'error');
    if (parsedAmount > (window.state?.gold || 0)) return window.toast?.('Not enough gold', 'error');

    setPlacing(true);
    try {
      const res = await apiCall('/api/world/bounties', {
        method: 'POST',
        body: { target_id: parseInt(selectedTarget), amount: parsedAmount },
      });
      if (res.error) {
        window.toast?.(res.error, 'error');
        return;
      }
      window.toast?.(res.message, 'success');
      window.gameStateManager?.setState(
        { gold: Math.max(0, (window.gameState?.gold || 0) - parsedAmount) },
        { reason: 'bounty-place' },
      );
      window.syncUI?.();
      setAmount('');
      setSelectedTarget('');
      await fetchBounties();
    } finally {
      setPlacing(false);
    }
  };

  return (
    <>
      <div id="bounties" className="panel" style={{ display: 'none' }}>
        <div className="card" style={{ marginTop: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div className="card-title" style={{ marginBottom: 0 }}>🪙 Bounty Board</div>
            <button className="base-btn" onClick={fetchBounties} style={{ fontSize: '11px', padding: '4px 10px' }}>↻ Refresh</button>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6, marginBottom: '16px' }}>
            Reward those who strike down your enemies. Place a gold bounty on any
            kingdom, and the first warrior to defeat them in battle will claim the prize.
          </div>

          <div className="two-col" style={{ gap: '20px', alignItems: 'start' }}>
            {/* Active Bounties */}
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px' }}>
              <h3 style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                🎯 Active Bounties
              </h3>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {loading ? (
                  <div style={{ color: 'var(--text3)', fontSize: '13px', padding: '8px 0' }}>Loading bounties...</div>
                ) : error ? (
                  <div style={{ color: 'var(--red)', fontSize: '13px', padding: '8px 0' }}>{error}</div>
                ) : bounties.length === 0 ? (
                  <div style={{ color: 'var(--text3)', fontSize: '13px', padding: '16px', textAlign: 'center' }}>No active bounties.</div>
                ) : (
                  bounties.map(b => (
                    <div key={b.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{b.target_name}</span>
                        <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--gold)' }}>{fmt(b.amount)} GC</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                        Placed by <span style={{ color: 'var(--accent1)' }}>{b.placer_name}</span> · {new Date(b.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Place Bounty */}
            <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px' }}>
              <h3 style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                ⚔️ Place a Bounty
              </h3>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text3)', marginBottom: '4px' }}>TARGET KINGDOM</label>
                <select
                  id="react-bounty-select"
                  className="input"
                  style={{ width: '100%' }}
                  value={selectedTarget}
                  onChange={e => setSelectedTarget(e.target.value)}
                  onFocus={loadTargets}
                >
                  <option value="">— Select a target —</option>
                  {targets.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name}{r.username ? ` (${r.username})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text3)', marginBottom: '4px' }}>REWARD (GOLD)</label>
                <input
                  type="number"
                  className="input"
                  id="bounty-amount"
                  min="1000"
                  step="1000"
                  style={{ textAlign: 'right', width: '100%' }}
                  placeholder="Qty"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
              </div>
              <button
                className="base-btn variant-gold"
                style={{ background: 'var(--gold)', color: '#000', width: '100%' }}
                onClick={handlePlaceBounty}
                disabled={placing}
              >
                {placing ? 'Placing...' : 'Place Bounty'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MESSAGES */}
      <div id="messages" className="panel panel-immersive" style={{ display: 'none' }}>
        <div className="chat-container-card chat-layout">
          <div className="chat-online-sidebar" style={{ borderLeft: 'none', borderRight: '1px solid var(--border)' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text2)' }}>Inbox</div>
            </div>
            <div id="conv-list" style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ color: 'var(--text3)', fontSize: '13px', padding: '16px', textAlign: 'center' }}>
                No messages yet.
              </div>
            </div>
          </div>

          <div className="chat-messages-area">
            <div id="active-conv-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border2)', background: 'var(--bg3)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Message</div>
              <div id="active-conv-name" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>Select a conversation</div>
            </div>
            <div id="active-conv-messages" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ textAlign: 'center', color: 'var(--text3)', marginTop: '40px' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>✉️</div>
                Select a kingdom member from the rankings to message them.
              </div>
            </div>
            <div id="msg-input-wrap" style={{ padding: '16px', borderTop: '1px solid var(--border)', display: 'none', background: 'var(--bg2)' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="input"
                  id="msg-input"
                  placeholder="Type a message..."
                  style={{ flex: 1 }}
                  onKeyDown={e => { if (e.key === 'Enter' && window.sendDirectMessage) window.sendDirectMessage(); }}
                />
                <button className="base-btn variant-accent" style={{ background: 'var(--accent1)' }} onClick={() => window.sendDirectMessage?.()}>
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
