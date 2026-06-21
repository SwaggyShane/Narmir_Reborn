import { gameStateManager } from '../../GameStateManager.js';
import { fmtShort } from '../../utils/numberFormat.js';
import { repairMojibake } from '../../utils/repairMojibake.js';

const REGION_META = {
  dwarf: { name: 'The Iron Holds', stroke: '#c8962a' },
  high_elf: { name: 'The Silverwood', stroke: '#4caf82' },
  orc: { name: 'The Bloodplains', stroke: '#e05c5c' },
  dark_elf: { name: 'The Underspire', stroke: 'var(--accent1)' },
  human: { name: 'The Heartlands', stroke: '#8fb84a' },
  dire_wolf: { name: 'The Ashfang Wilds', stroke: '#4a8fb8' },
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

export function showMapKingdomCard(id) {
  const worldMapData = Array.isArray(window.worldMapData) ? window.worldMapData : [];
  const k = worldMapData.find((entry) => entry.id === id);
  if (!k) return;

  const card = document.getElementById('map-kingdom-card');
  const nameEl = document.getElementById('mkc-name');
  const bodyEl = document.getElementById('mkc-body');
  const actEl = document.getElementById('mkc-actions');
  if (!card) return;

  card.style.display = 'block';

  const state = getState();
  const meta = REGION_META[k.race] || {};
  nameEl.innerHTML =
    ((window.RACE_ICONS && window.RACE_ICONS[k.race]) || '🤴') +
    ' ' +
    escapeHtml(repairMojibake(k.name || '')) +
    (k.is_ai ? ' <span style="font-size:10px;color:var(--text3)">AI</span>' : '');

  bodyEl.innerHTML =
    '<div style="font-size:12px;color:var(--text3);margin-bottom:8px">' +
    '<span style="color:' +
    (meta.stroke || '#fff') +
    '">' +
    (meta.name || k.region || '—') +
    '</span> · Level ' +
    (k.level || 1) +
    ' · Turn ' +
    (k.turn || 0) +
    '</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">' +
    '<div style="background:var(--bg3);border-radius:6px;padding:8px;text-align:center"><div style="color:var(--text3);font-size:10px">LAND</div><div style="color:var(--gold);font-weight:700">' +
    fmtShort(k.land) +
    '</div></div>' +
    '</div>';

  const isMe = k.id === state.kingdomId;
  const hasTradingPost = (state.market_upgrades || {}).trading_post;

  actEl.innerHTML = !isMe
    ? '<button class="btn" style="font-size:11px;padding:4px 10px" onclick="openKingdomProfile(\'' +
      escapeHtml(repairMojibake(k.name || '')) +
      "')\">🤴 Profile</button>" +
      '<button class="btn btn-red" style="font-size:11px;padding:4px 10px" onclick="targetFromRankings(' +
      k.id +
      ",'attack')\">⚔️ Attack</button>" +
      '<button class="btn btn-accent" style="font-size:11px;padding:4px 10px" onclick="targetFromRankings(' +
      k.id +
      ",'spells')\">✨ Spell</button>" +
      '<div style="text-align:center; margin-top:8px">' +
      (hasTradingPost
        ? '<button class="btn btn-gold" style="font-size:11px;padding:4px 10px; width:100%" onclick="establishTradeRoute(' +
          k.id +
          ')">🤝 Trade Route (10k GC)</button>'
        : '<div style="font-size:10px; color:var(--red); border:1px solid var(--red); padding:4px; border-radius:4px">Trading Post required to establish routes</div>') +
      '</div>'
    : '<span style="font-size:12px;color:var(--accent1)">Your kingdom</span>';
}
