import { gameStateManager } from '../GameStateManager.js';
import { fmt } from '../utils/fmt.js';

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
            ? '<span style="color:var(--green)">−</span>'
            : yours > base
              ? '<span style="color:var(--red)">↑</span>'
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
