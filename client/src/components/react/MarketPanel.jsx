import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiCall } from '../../utils/api';
import { useGameMutationEvents, useGameState } from '../../hooks/useGameState';
import { fmt } from "../../utils/fmt";
import { applyGameMutation } from '../../utils/gameMutations.js';
import { syncUI } from '../../utils/shellBridge.js';
import { gameStateManager } from '../../GameStateManager.js';
import { toast } from '../../utils/toast.js';

const icons = {
  food: 'ðŸŒ¾',
  wood: 'ðŸªµ',
  stone: 'ðŸª¨',
  iron: 'â›“',
  coal: 'ðŸŒ‘',
  steel: 'ðŸ“',
  mana: 'âœ¨',
  hammers: 'ðŸ”¨',
  weapons: 'âš”ï¸',
  armor: 'ðŸ›¡ï¸',
  war_machines: 'ðŸ¹',
  ballistae: 'ðŸ¹',
  land: 'ðŸ—ºï¸',
};


function getState() {
  return window.state || gameStateManager.getState();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

export function populateTradeTargets() {
  const sel = document.getElementById('trade-target-select');
  const tradeTargets = Array.isArray(window.targets) ? window.targets : [];
  if (!sel || !tradeTargets.length) return;

  sel.innerHTML =
    '<option value="">- select kingdom -</option>' +
    tradeTargets
      .map((t) => (`<option value="${t.id}">${escapeHtml(t.name)} - ${fmt(t.land)} acres</option>`))
      .join('');
}

export async function loadTradeOffers() {
  const result = await apiCall('/api/kingdom/economy/trade/list');
  if (result.error) return;
  renderTradeOffers(result.received || [], result.sent || []);
}

export function renderTradeOffers(received, sent) {
  const recEl = document.getElementById('trade-received-list');
  const sntEl = document.getElementById('trade-sent-list');

  if (recEl) {
    recEl.innerHTML = received.length
      ? received
          .map((o) => {
            const offer = JSON.parse(o.offer || '{}');
            const request = JSON.parse(o.request || '{}');
            const offerStr = Object.entries(offer).map((e) => `${e[1]} ${e[0]}`).join(', ');
            const requestStr = Object.entries(request).map((e) => `${e[1]} ${e[0]}`).join(', ');
            return `
              <div style="background:var(--bg3);border-radius:var(--radius);padding:10px;margin-bottom:8px">
                <div style="font-size:13px;color:var(--text);margin-bottom:4px"><strong>${escapeHtml(o.sender_name)}</strong> offers <span style="color:var(--green)">${escapeHtml(offerStr)}</span> for <span style="color:var(--amber)">${escapeHtml(requestStr)}</span></div>
                <div style="display:flex;gap:6px;margin-top:6px">
                  <button class="btn btn-green" style="font-size:11px;padding:3px 10px" onclick="acceptTrade(${o.id})">âœ… Accept</button>
                  <button class="btn btn-red" style="font-size:11px;padding:3px 10px" onclick="declineTrade(${o.id})">âŒ Decline</button>
                </div>
              </div>`;
          })
          .join('')
      : '<div style="color:var(--text3);font-size:13px">No pending offers.</div>';
  }

  if (sntEl) {
    sntEl.innerHTML = sent.length
      ? sent
          .map((o) => {
            const offer = JSON.parse(o.offer || '{}');
            const request = JSON.parse(o.request || '{}');
            const offerStr = Object.entries(offer).map((e) => `${e[1]} ${e[0]}`).join(', ');
            const requestStr = Object.entries(request).map((e) => `${e[1]} ${e[0]}`).join(', ');
            const statusColor = o.status === 'accepted'
              ? 'var(--green)'
              : o.status === 'declined'
                ? 'var(--red)'
                : 'var(--amber)';
            return `
              <div style="font-size:12px;color:var(--text3);padding:4px 0;border-bottom:1px solid var(--border)">
                To <strong style="color:var(--text)">${escapeHtml(o.receiver_name)}</strong>: ${escapeHtml(offerStr)} for ${escapeHtml(requestStr)} <span style="color:${statusColor}">[${escapeHtml(o.status)}]</span>
              </div>`;
          })
          .join('')
      : '<div style="color:var(--text3);font-size:13px">No sent offers.</div>';
  }
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
  const targetId = document.getElementById('trade-target-select')?.value;
  if (!targetId) return toast('Select a target kingdom', 'error');

  const offerItem = document.getElementById('trade-offer-item')?.value;
  const offerQty = parseInt(document.getElementById('trade-offer-qty')?.value, 10) || 0;
  const requestItem = document.getElementById('trade-request-item')?.value;
  const requestQty = parseInt(document.getElementById('trade-request-qty')?.value, 10) || 0;
  if (offerQty <= 0 || requestQty <= 0) return toast('Enter quantities', 'error');

  const result = await apiCall('/api/kingdom/economy/trade/send', {
    method: 'POST',
    body: {
      targetId,
      offer: { [offerItem]: offerQty },
      request: { [requestItem]: requestQty },
    },
  });
  if (result.error) return toast(result.error, 'error');
  toast('Trade offer sent!', 'success');
  await loadTradeOffers();
}

export async function acceptTrade(offerId) {
  const result = await apiCall('/api/kingdom/economy/trade/accept', {
    method: 'POST',
    body: { offerId },
  });
  if (result.error) return toast(result.error, 'error');
  applyGameMutation(result, { reason: 'accept-trade' });
  syncUI();
  toast('Trade accepted!', 'success');
  await loadTradeOffers();
}

export async function declineTrade(offerId) {
  const result = await apiCall('/api/kingdom/economy/trade/decline', {
    method: 'POST',
    body: { offerId },
  });
  if (result.error) return toast(result.error, 'error');
  toast('Trade declined', 'success');
  await loadTradeOffers();
}

export function renderCommodityMarket(mktUpgrades) {
  const el = document.getElementById('commodity-list');
  if (!el) return;

  const state = getState();
  const race = state.race || 'human';
  const racDisc = window.COMMODITY_RACE_DISCOUNT?.[race] || {};
  const items = [
    'food',
    'weapons',
    'armor',
    'mana',
    'maps',
    'blueprints',
    'war_machines',
    'ballistae',
    'land',
  ];

  el.innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 60px 60px;gap:4px;padding:4px 0;border-bottom:1px solid var(--border2)">' +
    '<span style="font-size:10px;color:var(--text3);text-transform:uppercase">Item</span>' +
    '<span style="font-size:10px;color:var(--text3);text-transform:uppercase;text-align:right">Base</span>' +
    '<span style="font-size:10px;color:var(--text3);text-transform:uppercase;text-align:right">Your price</span>' +
    '</div>' +
    items
      .map((item) => {
        const base = window.COMMODITY_VALUES?.[item] || 1;
        const disc = racDisc[item] || racDisc._all || 1.0;
        const yours = Math.max(1, Math.round(base * disc));
        const diff =
          yours < base
            ? '<span style="color:var(--green)">-</span>'
            : yours > base
              ? '<span style="color:var(--red)">+</span>'
              : '';
        return (
          '<div style="display:grid;grid-template-columns:1fr 60px 60px;gap:4px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">' +
          '<span style="font-size:13px;color:var(--text)">' +
          item.charAt(0).toUpperCase() +
          item.slice(1) +
          '</span>' +
          '<span style="font-size:13px;text-align:right;color:var(--text3)">' +
          base +
          ' GC</span>' +
          '<span style="font-size:13px;text-align:right;color:var(--gold);font-weight:600">' +
          yours +
          ' GC ' +
          diff +
          '</span>' +
          '</div>'
        );
      })
      .join('');
}

export function renderActiveMercs(mercs) {
  const el = document.getElementById('active-mercs-list');
  if (!el) return;
  if (!mercs || !mercs.length) {
    el.innerHTML = '<div style="color:var(--text3);font-size:13px;text-align:center;padding:12px">No mercenaries under contract.</div>';
    return;
  }

  const state = getState();
  el.innerHTML = mercs
    .map((m) => {
      const served = (state.turn || 0) - (m.hired_at_turn || 0);
      const remaining = Math.max(0, m.duration_turns - served);
      return (
        '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">' +
        '<div style="flex:1"><div style="font-size:13px;color:var(--text);font-weight:600">' +
        m.count +
        ' ' +
        escapeHtml(m.tier) +
        ' ' +
        escapeHtml(m.unit_type) +
        '</div>' +
        '<div style="font-size:11px;color:var(--text3)">Remaining: ' +
        remaining +
        ' turns</div></div>' +
        '</div>'
      );
    })
    .join('');
}


const MarketPanel = () => {
  const { state } = useGameState();
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState([]);
  const [quantities, setQuantities] = useState({});


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
    if (state?.prestige_level && state.prestige_level > 0) {
      mult += Math.min(0.1, state.prestige_level * 0.02);
    }
    return mult;
  }, [state?.prestige_level]);

  const ownedAmount = useCallback((id) => {
    let key = id;
    if (id === 'weapons') key = 'weapons_stockpile';
    if (id === 'armor') key = 'armor_stockpile';

    if (state?.[key] !== undefined) return state[key];
    if (state?.resources && state.resources[key] !== undefined) return state.resources[key];
    return 0;
  }, [state]);

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

      if (applyGameMutation) applyGameMutation(res.updates);
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
      const val = state?.resources ? (state.resources.gold || 0) : (state?.gold || 0);
      q = priceObj > 0 ? Math.floor(val / priceObj) : 0;
    } else {
      q = ownedAmount(resource);
    }
    setQuantities((prev) => ({ ...prev, [resource]: (q > 0 ? q : 0).toString() }));
  };

  return (
    <div id="market" className="panel" style={{ display: 'none' }}>
      <div className="card" style={{ marginTop: 0, marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div className="card-title">âš–ï¸ Commodity Market</div>
          <button className="base-btn" onClick={refreshMarket}>â†» Refresh Prices</button>
        </div>
        <div style={{ background: 'rgba(244, 166, 35, 0.1)', border: '1px solid rgba(244, 166, 35, 0.2)', padding: '10px', borderRadius: '8px' }}>
          <div style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 700, marginBottom: '8px' }}>
            âš–ï¸ Marketplace Trading
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.5 }}>
            Buy and sell resources at global prices.
            <strong style={{ color: 'var(--gold)' }}> Price Volatility:</strong>
            {' '}Constant trading shift prices in real-time. <br />
            <strong style={{ color: 'var(--accent1)' }}>Prestige Bonus:</strong>
            {' '}Elite kingdoms get +10% sell value on all commodities.
          </div>
        </div>
      </div>

      <div id="market-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {loading && (
          <div style={{ color: 'var(--text3)', padding: '40px', textAlign: 'center', gridColumn: '1/-1' }}>
            Loading market data...
          </div>
        )}

        {!loading && prices.map((p) => (
          <div key={p.id} className="card" style={{ margin: 0, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '24px' }}>{icons[p.id] || 'ðŸ“¦'}</span>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
                    {formatLabel(p.id)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                    Owned: <span style={{ color: 'var(--text)' }}>{fmt(ownedAmount(p.id))}</span>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gold)' }}>
                  {fmtPrice(p.current_price)} <span style={{ fontSize: '10px' }}>GC</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text3)' }}>Current Price</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
              <div style={{ background: 'rgba(0, 255, 0, 0.05)', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--green)' }}>BUY</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{fmtPrice(p.current_price)}</div>
              </div>
              <div style={{ background: 'rgba(255, 165, 0, 0.05)', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: 'var(--gold)' }}>SELL</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{fmtPrice(p.current_price * sellMultiplier)}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="number"
                className="input"
                value={quantities[p.id] || ''}
                onChange={(e) => setQuantities((prev) => ({ ...prev, [p.id]: e.target.value }))}
                style={{ width: '70px', fontSize: '12px' }}
                placeholder="Qty"
                min="1"
              />
              <button
                className="base-btn variant-gold"
                style={{ flex: 1, background: 'var(--gold)', color: '#000' }}
                onClick={() => marketTrade(p.id, 'buy')}
              >
                BUY
              </button>
              <button
                className="base-btn"
                style={{ flex: 1 }}
                onClick={() => marketTrade(p.id, 'sell')}
              >
                SELL
              </button>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '5px' }}>
              <button
                className="base-btn"
                onClick={() => setMktMax(p.id, 'buy', p.current_price)}
                style={{ flex: 1, fontSize: '9px', padding: '3px', minHeight: 0 }}
              >
                Max Buy
              </button>
              <button
                className="base-btn"
                onClick={() => setMktMax(p.id, 'sell', 0)}
                style={{ flex: 1, fontSize: '9px', padding: '3px', minHeight: 0 }}
              >
                Max Sell
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MarketPanel;

