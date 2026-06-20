import { apiCall, applyGameMutation, syncUI } from '../utils/shellBridge.js';
import { fmt } from '../utils/fmt.js';
import { toast } from '../utils/toast.js';

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
      .map((t) => (
        `<option value="${t.id}">${escapeHtml(t.name)} · ${fmt(t.land)} acres</option>`
      ))
      .join('');
}

export async function loadTradeOffers() {
  const result = await apiCall('GET', '/api/kingdom/economy/trade/list');
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
                  <button class="btn btn-green" style="font-size:11px;padding:3px 10px" onclick="acceptTrade(${o.id})">✅ Accept</button>
                  <button class="btn btn-red" style="font-size:11px;padding:3px 10px" onclick="declineTrade(${o.id})">❌ Decline</button>
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
    const res = await apiCall('POST', '/api/kingdom/trade/clear-logs');
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

  const result = await apiCall('POST', '/api/kingdom/economy/trade/send', {
    targetId,
    offer: { [offerItem]: offerQty },
    request: { [requestItem]: requestQty },
  });
  if (result.error) return toast(result.error, 'error');
  toast('Trade offer sent!', 'success');
  await loadTradeOffers();
}

export async function acceptTrade(offerId) {
  const result = await apiCall('POST', '/api/kingdom/economy/trade/accept', { offerId });
  if (result.error) return toast(result.error, 'error');
  applyGameMutation(result, { reason: 'accept-trade' });
  syncUI();
  toast('Trade accepted!', 'success');
  await loadTradeOffers();
}

export async function declineTrade(offerId) {
  const result = await apiCall('POST', '/api/kingdom/economy/trade/decline', { offerId });
  if (result.error) return toast(result.error, 'error');
  toast('Trade declined', 'success');
  await loadTradeOffers();
}
