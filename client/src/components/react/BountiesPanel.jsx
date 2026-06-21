import React, { useState, useEffect, useCallback } from 'react';
import { apiCall } from '../../utils/api';
import { fmt } from '../../utils/fmt';

const REFRESH_INTERVAL_MS = 60 * 1000;
const panelShell = 'panel panel-immersive min-h-0 w-full overflow-y-auto px-4 pb-5';
const insetCard =
  'rounded-2xl border border-[var(--border)] bg-[var(--bg3)] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset]';
const softCard = 'rounded-xl border border-[var(--border)] bg-[var(--bg2)] p-4';

const BountiesPanel = () => {
  const [bounties, setBounties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [targets, setTargets] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState('');
  const [amount, setAmount] = useState('');
  const [placing, setPlacing] = useState(false);

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
    setTargets(rankings.filter((r) => r.id !== myId).slice(0, 50));
  }, []);

  useEffect(() => {
    fetchBounties();
    loadTargets();

    window.refreshBountiesPanel = fetchBounties;
    // Exposed so legacy openBountyAction/selectBountyTarget can drive React state
    window.setBountyTarget = (id) => setSelectedTarget(id ? String(id) : '');

    const interval = setInterval(fetchBounties, REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      delete window.refreshBountiesPanel;
      delete window.setBountyTarget;
    };
  }, [fetchBounties, loadTargets]);

  const handlePlaceBounty = async () => {
    const parsedAmount = parseInt(amount, 10);
    if (!selectedTarget) return toast('Select a target kingdom first', 'error');
    if (!parsedAmount || parsedAmount < 1000) return toast('Minimum bounty is 1,000 GC', 'error');
    if (parsedAmount > (window.state?.gold || 0)) return toast('Not enough gold', 'error');

    setPlacing(true);
    try {
      const res = await apiCall('/api/world/bounties', {
        method: 'POST',
        body: { target_id: parseInt(selectedTarget, 10), amount: parsedAmount },
      });
      if (res.error) {
        toast(res.error, 'error');
        return;
      }
      toast(res.message, 'success');
      if (window.state) window.state.gold -= parsedAmount;
      if (window.updateTopStats) window.updateTopStats();
      setAmount('');
      setSelectedTarget('');
      await fetchBounties();
    } finally {
      setPlacing(false);
    }
  };

  return (
    <>
      <div id="bounties" className={panelShell} style={{ display: 'none' }}>
        <div className="card mx-auto mt-0 w-full max-w-6xl">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div className="card-title !mb-0">🏴‍☠️ Bounty Board</div>
            <button className="base-btn px-3 py-1 text-[11px]" onClick={fetchBounties}>
              ↻ Refresh
            </button>
          </div>

          <div className="mb-4 text-[13px] leading-6 text-[var(--text2)]">
            Reward those who strike down your enemies. Place a gold bounty on any kingdom, and
            the first warrior to defeat them in battle will claim the prize.
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
            <div className={insetCard}>
              <h3 className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[var(--text3)]">
                🎯 Active Bounties
              </h3>
              <div className="max-h-[400px] overflow-y-auto pr-1">
                {loading ? (
                  <div className="py-2 text-[13px] text-[var(--text3)]">Loading bounties...</div>
                ) : error ? (
                  <div className="py-2 text-[13px] text-[var(--red)]">{error}</div>
                ) : bounties.length === 0 ? (
                  <div className="px-4 py-5 text-center text-[13px] text-[var(--text3)]">
                    No active bounties.
                  </div>
                ) : (
                  bounties.map((b) => (
                    <div key={b.id} className={`${softCard} mb-2 last:mb-0`}>
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <span className="text-[15px] font-bold text-[var(--text)]">{b.target_name}</span>
                        <span className="text-[16px] font-extrabold text-[var(--gold)]">
                          {fmt(b.amount)} GC
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--text3)]">
                        Placed by <span className="text-[var(--accent1)]">{b.placer_name}</span> ·{' '}
                        {new Date(b.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className={insetCard}>
              <h3 className="mb-3 text-[11px] uppercase tracking-[0.18em] text-[var(--text3)]">
                ⚔️ Place a Bounty
              </h3>
              <div className="mb-3">
                <label className="mb-1 block text-[11px] text-[var(--text3)]">TARGET KINGDOM</label>
                <select
                  id="react-bounty-select"
                  className="input"
                  style={{ width: '100%' }}
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  onFocus={loadTargets}
                >
                  <option value="">— Select a target —</option>
                  {targets.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.username ? ` (${r.username})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-[11px] text-[var(--text3)]">REWARD (GOLD)</label>
                <input
                  type="number"
                  className="input"
                  id="bounty-amount"
                  min="1000"
                  step="1000"
                  style={{ textAlign: 'right', width: '100%' }}
                  placeholder="Qty"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <button
                className="base-btn variant-gold w-full"
                style={{ background: 'var(--gold)', color: '#000' }}
                onClick={handlePlaceBounty}
                disabled={placing}
              >
                {placing ? 'Placing...' : 'Place Bounty'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div id="messages" className={panelShell} style={{ display: 'none' }}>
        <div className="mx-auto grid w-full max-w-6xl min-h-[680px] grid-cols-1 overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--bg2)] xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-b border-[var(--border)] xl:border-b-0 xl:border-r xl:border-[var(--border)]">
            <div className="border-b border-[var(--border)] bg-[var(--bg3)] px-4 py-4">
              <div className="text-[13px] font-bold text-[var(--text2)]">Inbox</div>
            </div>
            <div id="conv-list" className="min-h-0 flex-1 overflow-y-auto">
              <div className="px-4 py-5 text-center text-[13px] text-[var(--text3)]">
                No messages yet.
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col">
            <div
              id="active-conv-header"
              className="border-b border-[var(--border2)] bg-[var(--bg3)] px-5 py-4"
            >
              <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--text3)]">
                Message
              </div>
              <div id="active-conv-name" className="text-[16px] font-bold text-[var(--text)]">
                Select a conversation
              </div>
            </div>

            <div
              id="active-conv-messages"
              className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-5"
            >
              <div className="mt-10 text-center text-[var(--text3)]">
                <div className="mb-2 text-[40px]">✉️</div>
                Select a kingdom member from the rankings to message them.
              </div>
            </div>

            <div
              id="msg-input-wrap"
              className="border-t border-[var(--border)] bg-[var(--bg2)] px-4 py-4"
              style={{ display: 'none' }}
            >
              <div className="flex gap-2.5">
                <input
                  type="text"
                  className="input"
                  id="msg-input"
                  placeholder="Type a message..."
                  style={{ flex: 1 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && window.sendDirectMessage) window.sendDirectMessage();
                  }}
                />
                <button
                  className="base-btn variant-accent"
                  style={{ background: 'var(--accent1)' }}
                  onClick={() => window.sendDirectMessage?.()}
                >
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
