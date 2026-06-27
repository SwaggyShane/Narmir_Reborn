import React, { useState, useEffect, useCallback } from 'react';
import { apiCall } from '../../utils/api';
import { fmt } from "../../utils/fmt";
import { toast } from '../../utils/toast.js';
import { registerSetBountyTarget } from '../../utils/bountyTarget.js';
import { useRankingsCache, useKingdomId, useGold } from '../../stores';

const REFRESH_INTERVAL_MS = 60 * 1000;
const panelShell = 'panel';
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
  const rankingsCache = useRankingsCache();
  const kingdomId = useKingdomId();
  const gold = useGold();

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
    const rankings = Array.isArray(rankingsCache) ? rankingsCache : [];
    setTargets(rankings.filter(r => r.id !== kingdomId).slice(0, 50));
  }, [kingdomId, rankingsCache]);

  useEffect(() => {
    fetchBounties();
    loadTargets();

    const unregister = registerSetBountyTarget((id) => setSelectedTarget(id ? String(id) : ''));

    const interval = setInterval(fetchBounties, REFRESH_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      unregister?.();
    };
  }, [fetchBounties, loadTargets]);

  const handlePlaceBounty = async () => {
    const parsedAmount = parseInt(amount, 10);
    if (!selectedTarget) return toast('Select a target kingdom first', 'error');
    if (!parsedAmount || parsedAmount < 1000) return toast('Minimum bounty is 1,000 GC', 'error');
    if (parsedAmount > gold) return toast('Not enough gold', 'error');

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
      <div id="bounties" className={panelShell}>
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
                        Placed by <span className="text-[var(--accent1)]">{b.placer_name}</span> |{' '}
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
  );
};

export default BountiesPanel;
