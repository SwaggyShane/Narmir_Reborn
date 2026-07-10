import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { apiCall } from '../../utils/api';
import { useGameMutationEvents } from '../../hooks/useGameState';
import { fmt } from "../../utils/fmt";
import { normalizeAndRouteResponse } from '../../utils/responseNormalizer.js';

import { toast } from '../../utils/toast.js';
import { escapeHtml } from '../../utils/escapeHtml.js';

import {
  usePrestige,
  useGold,
  useTurn,
  useTradeTargets,
  useWeaponsStockpile,
  useArmorStockpile,
  useEconomyStore,
  useFood,
  useWood,
  useStone,
  useIron,
  useCoal,
  useSteel,
  useEconomyMana,
} from '../../stores';

const icons = {
  food: '🌾',
  wood: '🪵',
  stone: '🪨',
  iron: '⛓️',
  coal: '🌑',
  steel: '📏',
  mana: '✨',
  hammers: '🔨',
  weapons: '⚔️',
  armor: '🛡️',
  war_machines: '🏹',
  ballistae: '🏹',
  land: '🗺️',
};

let marketPanelApi = null;

export function populateTradeTargets() {
  const tradeTargets = Array.isArray(useEconomyStore.getState().targets) ? useEconomyStore.getState().targets : [];
  if (!tradeTargets.length || !marketPanelApi?.setTradeTargets) return;
  marketPanelApi.setTradeTargets(tradeTargets);
}

export async function loadTradeOffers() {
  const result = await apiCall('/api/kingdom/economy/trade/list');
  if (result.error) return result;
  if (marketPanelApi?.setTradeOffers) {
    marketPanelApi.setTradeOffers({ received: result.received || [], sent: result.sent || [] });
  }
  return result;
}

export async function clearTradeLogs() {
  if (!confirm('Clear all completed/expired trade logs?')) return;
  try {
    const res = await apiCall('/api/kingdom/trade/clear-logs', { method: 'POST' });
    if (res.ok) {
      toast('Trade logs cleared', 'success');
      await loadTradeOffers();
    }
  } catch (err) {
    toast('Failed to clear logs', 'error');
  }
}

export async function sendTradeOffer() {
  if (!marketPanelApi?.handleSendTrade) return;
  await marketPanelApi.handleSendTrade();
}

export async function acceptTrade(offerId) {
  if (!marketPanelApi?.handleAcceptTrade) return;
  await marketPanelApi.handleAcceptTrade(offerId);
}

export async function declineTrade(offerId) {
  if (!marketPanelApi?.handleDeclineTrade) return;
  await marketPanelApi.handleDeclineTrade(offerId);
}

export function renderCommodityMarket(mktUpgrades) {
  if (marketPanelApi?.refreshMarketUI) {
    marketPanelApi.refreshMarketUI();
  }
}

export function renderActiveMercs(mercs) {
  if (marketPanelApi?.setActiveMercs) {
    marketPanelApi.setActiveMercs(mercs || []);
  }
}


const MarketPanel = () => {
  const prestigeLevel = usePrestige();
  const gold = useGold();
  const turn = useTurn();
  const tradeTargets = useTradeTargets();
  const weaponsStockpile = useWeaponsStockpile();
  const armorStockpile = useArmorStockpile();
  const food = useFood();
  const wood = useWood();
  const stone = useStone();
  const iron = useIron();
  const coal = useCoal();
  const steel = useSteel();
  const mana = useEconomyMana();

  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState([]);
  const [quantities, setQuantities] = useState({});

  // Trade state
  const [tradeOffers, setTradeOffers] = useState({ received: [], sent: [] });
  const [tradeTargetsState, setTradeTargetsState] = useState([]);
  const [tradeForm, setTradeForm] = useState({
    targetId: '', offerItem: '', offerQty: '', requestItem: '', requestQty: '',
  });
  const [activeMercs, setActiveMercs] = useState([]);

  const fmtPrice = (n) => {
    if (n === undefined || n === null || Number.isNaN(n)) return '0';
    if (n >= 0.01) {
      return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 });
    }
    return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 6 });
  };

  const formatLabel = (id) => id.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const sellMultiplier = useMemo(() => {
    let mult = 0.7;
    if (prestigeLevel && prestigeLevel > 0) {
      mult += Math.min(0.1, prestigeLevel * 0.02);
    }
    return mult;
  }, [prestigeLevel]);

  const ownedAmount = useCallback((id) => {
    if (id === 'weapons') return weaponsStockpile;
    if (id === 'armor') return armorStockpile;
    if (id === 'food') return food;
    if (id === 'wood') return wood;
    if (id === 'stone') return stone;
    if (id === 'iron') return iron;
    if (id === 'coal') return coal;
    if (id === 'steel') return steel;
    if (id === 'mana') return mana;
    return 0;
  }, [weaponsStockpile, armorStockpile, food, wood, stone, iron, coal, steel, mana]);

  const refreshMarket = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiCall('/api/kingdom/market/prices');
      if (Array.isArray(data)) {
        setPrices(data.filter((p) => p.id !== 'hammers'));
      }
    } catch (err) {
      console.error('[market] Failed to load market prices', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const onMutation = useCallback((event) => {
    if (!event?.reason) return;
    const reason = String(event.reason);
    if (
      reason === 'turn' ||
      reason === 'kingdom-refresh' ||
      reason === 'apply-server-updates' ||
      reason.startsWith('market/')
    ) {
      void refreshMarket();
    }
  }, [refreshMarket]);

  useEffect(() => {
    void refreshMarket();
  }, [refreshMarket]);

  // Phase 3A: Zustand-driven refetch (dual source - listener is safety net)
  useEffect(() => {
    void refreshMarket();
  }, [gold, food, wood, stone, iron, coal, steel, mana, turn, refreshMarket]);

  useGameMutationEvents(onMutation);

  const marketTrade = async (resource, op) => {
    const qtyStr = quantities[resource];
    const qty = parseInt(qtyStr, 10);
    if (!qty || qty <= 0) {
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Enter a valid quantity', 'error');
      return;
    }

    try {
      const res = await apiCall(`/api/kingdom/market/${op}`, {
        method: 'POST',
        body: {
          resource,
          amount: qty,
        },
      });

      if (res.error) {
        if (typeof window !== 'undefined' && typeof toast === 'function') toast(res.error, 'error');
        return;
      }

      normalizeAndRouteResponse(res, { reason: `market-${op}` });
      const successMsg = op === 'buy' ? `Bought ${qty} ${resource}` : `Sold ${qty} ${resource}`;
      if (typeof window !== 'undefined' && typeof toast === 'function') toast(res.message || successMsg, 'success');
      setQuantities((prev) => ({ ...prev, [resource]: '' }));
      await refreshMarket();
    } catch (err) {
      console.error('[market] trade failed:', err);
      if (typeof window !== 'undefined' && typeof toast === 'function') toast('Trade failed', 'error');
    }
  };

  const setMktMax = (resource, op, priceObj) => {
    let q = 0;
    if (op === 'buy') {
      q = priceObj > 0 ? Math.floor(gold / priceObj) : 0;
    } else {
      q = ownedAmount(resource);
    }
    setQuantities((prev) => ({ ...prev, [resource]: (q > 0 ? q : 0).toString() }));
  };

  const handleSendTrade = useCallback(async () => {
    const { targetId, offerItem, offerQty, requestItem, requestQty } = tradeForm;
    if (!targetId) return toast('Select a target kingdom', 'error');
    const oQty = parseInt(offerQty, 10) || 0;
    const rQty = parseInt(requestQty, 10) || 0;
    if (oQty <= 0 || rQty <= 0) return toast('Enter quantities', 'error');

    const result = await apiCall('/api/kingdom/economy/trade/send', {
      method: 'POST',
      body: { targetId, offer: { [offerItem]: oQty }, request: { [requestItem]: rQty } },
    });
    if (result.error) return toast(result.error, 'error');
    toast('Trade offer sent!', 'success');
    setTradeForm({ targetId: '', offerItem: '', offerQty: '', requestItem: '', requestQty: '' });
    await loadTradeOffers();
  }, [tradeForm]);

  const handleAcceptTrade = useCallback(async (offerId) => {
    const result = await apiCall('/api/kingdom/economy/trade/accept', {
      method: 'POST',
      body: { offerId },
    });
    if (result.error) return toast(result.error, 'error');
    normalizeAndRouteResponse(result, { reason: 'accept-trade' });
    toast('Trade accepted!', 'success');
    await loadTradeOffers();
  }, []);

  const handleDeclineTrade = useCallback(async (offerId) => {
    const result = await apiCall('/api/kingdom/economy/trade/decline', {
      method: 'POST',
      body: { offerId },
    });
    if (result.error) return toast(result.error, 'error');
    toast('Trade declined', 'success');
    await loadTradeOffers();
  }, []);

  useEffect(() => {
    marketPanelApi = {
      setTradeTargets: setTradeTargetsState,
      setTradeOffers,
      setActiveMercs,
      handleSendTrade,
      handleAcceptTrade,
      handleDeclineTrade,
      refreshMarketUI: () => {},
    };
  }, [handleSendTrade, handleAcceptTrade, handleDeclineTrade]);

  useEffect(() => {
    void loadTradeOffers();
  }, []);

  useEffect(() => {
    if (Array.isArray(tradeTargets)) {
      setTradeTargetsState(tradeTargets);
    }
  }, [tradeTargets]);

  return (
    <div id="market" className="panel">
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-950/80 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="card-title mb-1">⚖️ Commodity Market</div>
          <div className="text-[13px] text-[var(--text3)]">
            Buy and sell resources at live prices across the kingdom economy.
          </div>
        </div>
        <button className="base-btn rounded-full px-3 py-1.5 text-[11px] font-semibold" onClick={refreshMarket}>
          ↻ Refresh Prices
        </button>
      </div>

      <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
        <div className="mb-2 text-[14px] font-bold text-[var(--text)]">
          ⚖️ Marketplace Trading
        </div>
        <div className="text-[12px] leading-5 text-[var(--text2)]">
          Buy and sell resources at global prices.
          <strong className="text-[var(--gold)]"> Price Volatility:</strong>
          {' '}Constant trading shifts prices in real-time.
          <br />
          <strong className="text-[var(--accent1)]">Prestige Bonus:</strong>
          {' '}Elite kingdoms get +10% sell value on all commodities.
        </div>
      </div>

      <div id="market-list" className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
        {loading && (
          <div className="col-span-full rounded-2xl border border-white/10 bg-zinc-950/70 p-10 text-center text-[var(--text3)]">
            Loading market data...
          </div>
        )}

        {!loading && prices.map((p) => (
          <div key={p.id} className="card m-0 border border-white/10">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[24px]">{icons[p.id] || '📦'}</span>
                <div>
                  <div className="text-[16px] font-bold text-[var(--text)]">
                    {formatLabel(p.id)}
                  </div>
                  <div className="text-[11px] text-[var(--text3)]">
                    Owned: <span className="text-[var(--text)]">{fmt(ownedAmount(p.id))}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[18px] font-bold text-[var(--gold)]">
                  {fmtPrice(p.current_price)} <span className="text-[10px]">GC</span>
                </div>
                <div className="text-[11px] text-[var(--text3)]">Current Price</div>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-green-500/5 p-2 text-center">
                <div className="text-[10px] text-[var(--green)]">BUY</div>
                <div className="text-[14px] font-bold text-[var(--text)]">{fmtPrice(p.current_price)}</div>
              </div>
              <div className="rounded-lg bg-amber-500/5 p-2 text-center">
                <div className="text-[10px] text-[var(--gold)]">SELL</div>
                <div className="text-[14px] font-bold text-[var(--text)]">{fmtPrice(p.current_price * sellMultiplier)}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                className="input w-[70px] text-[12px]"
                value={quantities[p.id] || ''}
                onChange={(e) => setQuantities((prev) => ({ ...prev, [p.id]: e.target.value }))}
                placeholder="Qty"
                min="1"
              />
              <button
                className="base-btn variant-gold flex-1 bg-[var(--gold)] text-black"
                onClick={() => marketTrade(p.id, 'buy')}
              >
                BUY
              </button>
              <button
                className="base-btn flex-1"
                onClick={() => marketTrade(p.id, 'sell')}
              >
                SELL
              </button>
            </div>
            <div className="mt-1.5 flex gap-2">
              <button
                className="base-btn flex-1 !min-h-0 px-1.5 py-1 text-[9px]"
                onClick={() => setMktMax(p.id, 'buy', p.current_price)}
              >
                Max Buy
              </button>
              <button
                className="base-btn flex-1 !min-h-0 px-1.5 py-1 text-[9px]"
                onClick={() => setMktMax(p.id, 'sell', 0)}
              >
                Max Sell
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-6">
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/10 p-4">
          <div className="mb-4 text-[14px] font-bold text-[var(--text)]">💜 Kingdom Trade Offers</div>

          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg2)] p-3">
              <div className="mb-2 text-[11px] font-bold uppercase text-[var(--text3)]">Received Offers</div>
              <div className="max-h-[200px] space-y-2 overflow-y-auto">
                {tradeOffers.received.length ? (
                  tradeOffers.received.map((o) => {
                    const offer = JSON.parse(o.offer || '{}');
                    const request = JSON.parse(o.request || '{}');
                    const offerStr = Object.entries(offer).map((e) => `${e[1]} ${e[0]}`).join(', ');
                    const requestStr = Object.entries(request).map((e) => `${e[1]} ${e[0]}`).join(', ');
                    return (
                      <div key={o.id} className="rounded bg-[var(--bg3)] p-2">
                        <div className="mb-2 text-[12px] text-[var(--text)]">
                          <strong>{escapeHtml(o.sender_name)}</strong> offers <span className="text-[var(--green)]">{escapeHtml(offerStr)}</span> for <span className="text-[var(--amber)]">{escapeHtml(requestStr)}</span>
                        </div>
                        <div className="flex gap-2">
                          <button className="base-btn flex-1 bg-green-600 text-[10px]" onClick={() => handleAcceptTrade(o.id)}>Accept</button>
                          <button className="base-btn flex-1 bg-red-600 text-[10px]" onClick={() => handleDeclineTrade(o.id)}>Decline</button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-[11px] text-[var(--text3)]">No pending offers</div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg2)] p-3">
              <div className="mb-2 text-[11px] font-bold uppercase text-[var(--text3)]">Sent Offers</div>
              <div className="max-h-[200px] space-y-2 overflow-y-auto text-[11px]">
                {tradeOffers.sent.length ? (
                  tradeOffers.sent.map((o) => {
                    const offer = JSON.parse(o.offer || '{}');
                    const request = JSON.parse(o.request || '{}');
                    const offerStr = Object.entries(offer).map((e) => `${e[1]} ${e[0]}`).join(', ');
                    const requestStr = Object.entries(request).map((e) => `${e[1]} ${e[0]}`).join(', ');
                    const statusColorClass = o.status === 'accepted' ? 'text-[var(--green)]' : o.status === 'declined' ? 'text-[var(--red)]' : 'text-[var(--amber)]';
                    return (
                      <div key={o.id} className="border-b border-[var(--border)] pb-1 text-[var(--text3)]">
                        To <strong className="text-[var(--text)]">{escapeHtml(o.receiver_name)}</strong>: {escapeHtml(offerStr)} for {escapeHtml(requestStr)} <span className={statusColorClass}>({escapeHtml(o.status)})</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-[11px] text-[var(--text3)]">No sent offers</div>
                )}
              </div>
            </div>
          </div>

          <div className="mb-4 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg3)] p-3">
            <div className="text-[11px] font-bold uppercase text-[var(--text3)]">Create Trade Offer</div>
            <select
              className="input w-full text-[12px]"
              value={tradeForm.targetId}
              onChange={(e) => setTradeForm((prev) => ({ ...prev, targetId: e.target.value }))}
            >
              <option value="">- select kingdom -</option>
              {tradeTargetsState.map((t) => (
                <option key={t.id} value={t.id}>{escapeHtml(t.name)} - {fmt(t.land)} acres</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input className="input text-[12px]" placeholder="Offer item" value={tradeForm.offerItem} onChange={(e) => setTradeForm((prev) => ({ ...prev, offerItem: e.target.value }))} />
              <input className="input text-[12px]" type="number" placeholder="Qty" value={tradeForm.offerQty} onChange={(e) => setTradeForm((prev) => ({ ...prev, offerQty: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="input text-[12px]" placeholder="Request item" value={tradeForm.requestItem} onChange={(e) => setTradeForm((prev) => ({ ...prev, requestItem: e.target.value }))} />
              <input className="input text-[12px]" type="number" placeholder="Qty" value={tradeForm.requestQty} onChange={(e) => setTradeForm((prev) => ({ ...prev, requestQty: e.target.value }))} />
            </div>
            <button className="base-btn variant-gold w-full bg-purple-600" onClick={handleSendTrade}>Send Trade Offer</button>
          </div>

          <button className="base-btn w-full text-[11px]" onClick={clearTradeLogs}>Clear Trade Logs</button>
        </div>

        {activeMercs.length > 0 && (
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
            <div className="mb-3 text-[14px] font-bold text-[var(--text)]">💪 Mercenary Contracts</div>
            <div className="space-y-2">
              {activeMercs.map((m, idx) => {
                const served = (turn || 0) - (m.hired_at_turn || 0);
                const remaining = Math.max(0, m.duration_turns - served);
                return (
                  <div key={idx} className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold text-[var(--text)]">{m.count} {escapeHtml(m.tier)} {escapeHtml(m.unit_type)}</div>
                      <div className="text-[11px] text-[var(--text3)]">Remaining: {remaining} turns</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketPanel;
