import { gameStateManager } from '../../GameStateManager.js';
import { fmtShort } from '../../utils/numberFormat.js';
import { repairMojibake } from '../../utils/repairMojibake.js';
import { getWorldMapData } from '../../utils/worldMapData.js';
import { RACE_ICONS } from '../../utils/raceIcons.js';

const REGION_META = {
  dwarf: { name: 'The Iron Holds', stroke: '#c8962a' },
  high_elf: { name: 'The Silverwood', stroke: '#4caf82' },
  orc: { name: 'The Bloodplains', stroke: '#e05c5c' },
  dark_elf: { name: 'The Underspire', stroke: 'var(--accent1)' },
  human: { name: 'The Heartlands', stroke: '#8fb84a' },
  dire_wolf: { name: 'The Ashfang Wilds', stroke: '#4a8fb8' },
};

function getState() {
  return gameStateManager.getState();
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

// Escape a string for use inside a JS single-quoted string literal that is
// embedded in an HTML attribute (e.g. onclick="fn('...')"). The browser
// HTML-decodes the attribute before passing it to the JS engine, so &#39;
// becomes ' again and breaks the string. We must escape \ and ' at the JS
// level first, then HTML-escape the whole thing.
function escapeJsString(value) {
  return escapeHtml(String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}

export function showMapKingdomCard(id) {
  const worldMapData = getWorldMapData();
  const k = worldMapData.find((entry) => entry.id === id);
  if (!k) return;

  const state = getState();
  const meta = REGION_META[k.race] || {};
  const isMe = k.id === state.kingdomId;
  const hasTradingPost = (state.market_upgrades || {}).trading_post;

  const cardData = {
    visible: true,
    kingdom: k,
    meta,
    isMe,
    hasTradingPost,
    state,
  };

  window.dispatchEvent(new CustomEvent('narmir:map-kingdom-card', { detail: cardData }));
}
