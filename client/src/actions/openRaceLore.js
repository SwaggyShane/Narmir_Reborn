import { repairMojibake } from '../utils/repairMojibake.js';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const openRaceLore = (race) => {
  const loreMap = typeof window !== 'undefined' ? window.RACE_LORE || {} : {};
  const regionMeta = typeof window !== 'undefined' ? window.REGION_META || {} : {};
  const regionBonuses = typeof window !== 'undefined' ? window.REGION_BONUSES || {} : {};
  const getRacePortrait = typeof window !== 'undefined' ? window.getRacePortrait : null;
  const state = typeof window !== 'undefined' ? window.state || {} : {};

  const rKey = race || state.race;
  const lore = loreMap[rKey];
  if (!lore) return;

  const el = document.getElementById('race-lore-content');
  if (!el) return;

  const region = regionMeta[rKey] || {};
  const portraitUrl = typeof getRacePortrait === 'function' ? getRacePortrait(rKey, 'male') : '';
  const icon = repairMojibake(lore.icon || '¤');
  const strengths = Array.isArray(lore.strengths) ? lore.strengths : [];
  const weaknesses = Array.isArray(lore.weaknesses) ? lore.weaknesses : [];
  const heroes = Array.isArray(lore.heroes) ? lore.heroes : [];

  const portraitHtml = portraitUrl
    ? '<div style="width: 140px; height: 140px; border-radius: 16px; box-shadow: 0 6px 16px rgba(0,0,0,0.5); overflow: hidden; background: #15171e; display: flex; align-items: center; justify-content: center; position: relative;">' +
      '<img src="' +
      escapeHtml(portraitUrl) +
      '" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.outerHTML=\'<span style=\\\'font-size: 60px;\\\'>' +
      escapeHtml(icon) +
      '</span>\'" />' +
      '</div>'
    : '<div style="width: 140px; height: 140px; border-radius: 16px; background: var(--bg3); display: flex; align-items: center; justify-content: center; font-size: 60px;">' +
      escapeHtml(icon) +
      '</div>';

  el.innerHTML =
    '<div style="display: flex; gap: 20px; align-items: flex-start; text-align: left; margin-bottom: 20px;">' +
    '<div style="flex-shrink: 0;">' +
    portraitHtml +
    '</div>' +
    '<div style="flex: 1; padding-top: 4px;">' +
    '<h2 style="color:' +
    (lore.color || 'var(--gold)') +
    ';margin:0 0 6px;font-size:24px;letter-spacing:-0.5px;font-family:\'Cinzel\', serif;font-weight:700;">' +
    escapeHtml(repairMojibake(lore.title || 'Unknown')) +
    '</h2>' +
    '<div style="font-size:13px;color:var(--text2);margin-bottom:6px;font-weight:600;">' +
    escapeHtml(repairMojibake(region.name || '')) +
    ' Region</div>' +
    '<div style="font-size:12px;color:var(--text3);line-height:1.4;">' +
    escapeHtml(repairMojibake(regionBonuses[rKey] || '')) +
    '</div>' +
    '</div>' +
    '</div>' +
    '<p style="font-size:13px;color:var(--text2);line-height:1.8;font-style:italic;margin-bottom:18px">' +
    escapeHtml(repairMojibake(lore.lore || '')) +
    '</p>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">' +
    '<div style="background:rgba(76,175,130,.08);border:1px solid rgba(76,175,130,.2);border-radius:var(--radius);padding:12px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--green);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Strengths</div>' +
    strengths
      .map((s) => '<div style="font-size:12px;color:var(--text2);padding:2px 0">✓ ' + escapeHtml(repairMojibake(s)) + '</div>')
      .join('') +
    '</div>' +
    '<div style="background:rgba(224,92,92,.08);border:1px solid rgba(224,92,92,.2);border-radius:var(--radius);padding:12px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--red);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">Weaknesses</div>' +
    weaknesses
      .map((s) => '<div style="font-size:12px;color:var(--text2);padding:2px 0">✗ ' + escapeHtml(repairMojibake(s)) + '</div>')
      .join('') +
    '</div>' +
    '</div>' +
    '<div style="background:rgba(232,184,75,.08);border:1px solid rgba(232,184,75,.25);border-radius:var(--radius);padding:12px;margin-bottom:12px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">✨ Racial mastery — unlocks at unit level 25</div>' +
    '<div style="font-size:13px;color:var(--text)">' +
    escapeHtml(repairMojibake(lore.special || '')) +
    '</div>' +
    '</div>' +
    (heroes.length
      ? '<div style="background:rgba(143,184,74,.08);border:1px solid rgba(143,184,74,.25);border-radius:var(--radius);padding:12px;margin-bottom:12px">' +
        '<div style="font-size:11px;font-weight:700;color:var(--green);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">🦻 Notable Race Heroes</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
        heroes
          .map((h) => '<div style="cursor:pointer; font-size:11px;background:var(--bg4);padding:3px 8px;border-radius:12px;color:var(--text2);border:1px solid var(--border2)" onclick="showHeroLore(\'' + String(h).replace(/'/g, "\\'") + "')\">" + escapeHtml(repairMojibake(h)) + '</div>')
          .join('') +
        '</div>' +
        '</div>'
      : '') +
    '<div style="background:var(--bg3);border-radius:var(--radius);padding:12px">' +
    '<div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Recommended playstyle</div>' +
    '<div style="font-size:13px;color:var(--text2)">' +
    escapeHtml(repairMojibake(lore.playstyle || '')) +
    '</div>' +
    '</div>';

  const modal = document.getElementById('race-lore-modal');
  if (modal) modal.style.display = 'flex';
};
