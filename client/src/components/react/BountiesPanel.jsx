import React, { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { apiCall } from '../../utils/api';
import { useGameState } from '../../hooks/useGameState';
import { fmt } from "../../utils/fmt";
import { toast } from '../../utils/toast.js';
import { registerSetBountyTarget } from '../../utils/bountyTarget.js';
import { registerOpenDirectMessage } from '../../utils/directMessage.js';
import { sendDirectMessage } from '../../socket-client.js';
import { switchTab } from '../../utils/panelNav.js';

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
  const [dmTarget, setDmTarget] = useState(null);
  const [dmMessage, setDmMessage] = useState('');

  const { state } = useGameState();

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
    const rankings = Array.isArray(state?.rankingsCache) ? state.rankingsCache : (window.rankingsCache || []);
    const myId = state?.kingdomId;
    setTargets(rankings.filter(r => r.id !== myId).slice(0, 50));
  }, [state?.kingdomId, state?.rankingsCache]);

  useEffect(() => {
    fetchBounties();
    loadTargets();

    const unregister = registerSetBountyTarget((id) => setSelectedTarget(id ? String(id) : ''));
    const unregisterDm = registerOpenDirectMessage(({ playerId, name }) => {
      setDmTarget({
        playerId,
        name: String(name || '').trim(),
      });
      setDmMessage('');
      switchTab('messages');
    });

    const interval = setInterval(fetchBounties, REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      unregister?.();
      unregisterDm?.();
    };
  }, [fetchBounties, loadTargets]);

  const handlePlaceBounty = async () => {
    const parsedAmount = parseInt(amount, 10);
    if (!selectedTarget) return toast('Select a target kingdom first', 'error');
    if (!parsedAmount || parsedAmount < 1000) return toast('Minimum bounty is 1,000 GC', 'error');
    if (parsedAmount > (state?.gold || 0)) return toast('Not enough gold', 'error');

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
      setAmount('');
      setSelectedTarget('');
      await fetchBounties();
    } finally {
      setPlacing(false);
    }
  };

  return (
    <>
      <div id="bounties" className={clsx(panelShell, 'hidden')}>
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
                  className="input w-full"
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
                  className="input text-right w-full"
                  id="bounty-amount"
                  min="1000"
                  step="1000"
                  placeholder="Qty"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>

              <button
                className="base-btn variant-gold w-full bg-[var(--gold)] text-black"
                onClick={handlePlaceBounty}
                disabled={placing}
              >
                {placing ? 'Placing...' : 'Place Bounty'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div id="messages" className={clsx(panelShell, 'hidden')}>
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
              className="hidden border-t border-[var(--border)] bg-[var(--bg2)] px-4 py-4"
            >
              <div className="flex gap-2.5">
                <input
                  type="text"
                  className="input flex-1"
                  id="msg-input"
                  placeholder={dmTarget?.name ? `Message ${dmTarget.name}...` : 'Pick a kingdom from Rankings to message them...'}
                  value={dmMessage}
                  onChange={e => setDmMessage(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    if (!dmTarget?.name) return toast('Pick a kingdom to message first', 'error');
                    const ack = await sendDirectMessage(dmTarget.name, dmMessage);
                    if (ack?.error) return toast(ack.error, 'error');
                    setDmMessage('');
                    toast(ack?.message || `Message sent to ${dmTarget.name}`, 'success');
                  }}
                />
                <button
                  className="base-btn variant-accent bg-[var(--accent1)]"
                  onClick={async () => {
                    if (!dmTarget?.name) return toast('Pick a kingdom to message first', 'error');
                    const ack = await sendDirectMessage(dmTarget.name, dmMessage);
                    if (ack?.error) return toast(ack.error, 'error');
                    setDmMessage('');
                    toast(ack?.message || `Message sent to ${dmTarget.name}`, 'success');
                  }}
                >
                  Send
                </button>
              </div>
              <div className="mt-2 text-[11px] text-[var(--text3)]">
                {dmTarget?.name ? `Recipient: ${dmTarget.name}` : 'Open a kingdom profile or Rankings message action to set a recipient.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BountiesPanel;
