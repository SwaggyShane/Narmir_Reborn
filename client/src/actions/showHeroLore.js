import { apiCall } from '../utils/api.js';
import { fmt } from '../utils/fmt.js';
import { toast } from '../utils/toast.js';
import { repairMojibake } from '../utils/repairMojibake.js';

let cachedHeroClasses = null;

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export async function showHeroLore(heroName) {
  if (!cachedHeroClasses) {
    try {
      cachedHeroClasses = await apiCall('GET', '/api/hero/all-classes');
    } catch (error) {
      console.error('Hero classes fetch failed:', error);
      return;
    }
  }

  const heroClasses = cachedHeroClasses || {};
  let hero = null;
  let heroClassKey = null;
  for (const key in heroClasses) {
    if (heroClasses[key].name === heroName) {
      hero = heroClasses[key];
      heroClassKey = key;
      break;
    }
  }

  if (!hero) return toast('Hero details not found.', 'error');

  const portraitFn = typeof window !== 'undefined' ? window.heroPortrait : null;
  const modalFn = typeof window !== 'undefined' ? window.openLoreModal : null;
  if (typeof modalFn !== 'function') return;

  const html =
    '<div style="margin-bottom:20px; text-align:center;">' +
    '<img src="' +
    escapeHtml(typeof portraitFn === 'function' ? portraitFn(heroClassKey) : '') +
    '" width="240" height="240" style="max-width:100%;height:auto;object-fit:cover;display:block;margin:0 auto 12px auto;" onerror="this.style.display=\'none\'" alt="' +
    escapeHtml(hero.name || '') +
    '"/>' +
    '<div style="font-size:20px; font-weight:700; color:var(--text);">' +
    escapeHtml(repairMojibake(hero.name || '')) +
    '</div>' +
    '<div style="font-size:12px; color:var(--text3); text-transform:uppercase; letter-spacing:1px;">Legendary Hero Class</div>' +
    '</div>' +
    '<div style="margin-bottom:20px;">' +
    '<div style="font-size:11px; font-weight:700; color:var(--gold); margin-bottom:10px; text-transform:uppercase; letter-spacing:1px;">Signature Abilities</div>' +
    '<div style="display:flex; flex-direction:column; gap:10px;">' +
    (Array.isArray(hero.abilities) ? hero.abilities : [])
      .map((a) =>
        '<div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:8px; padding:10px;">' +
        '<div style="font-size:13px; font-weight:600; color:var(--text); margin-bottom:2px;">' +
        escapeHtml(repairMojibake(a.name || '')) +
        '</div>' +
        '<div style="font-size:12px; color:var(--text3);">' +
        escapeHtml(repairMojibake(a.description || '')) +
        '</div>' +
        '</div>',
      )
      .join('') +
    '</div></div>' +
    '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">' +
    '<div style="background:var(--bg4); border-radius:8px; padding:10px; text-align:center;">' +
    '<div style="font-size:10px; color:var(--text3); text-transform:uppercase;">Recruit Cost</div>' +
    '<div style="font-size:14px; font-weight:700; color:var(--gold);">' +
    fmt(hero.recruitCost) +
    ' GC</div>' +
    '</div>' +
    '<div style="background:var(--bg4); border-radius:8px; padding:10px; text-align:center;">' +
    '<div style="font-size:10px; color:var(--text3); text-transform:uppercase;">Mana Cost</div>' +
    '<div style="font-size:14px; font-weight:700; color:var(--blue);">' +
    fmt(hero.recruitMana) +
    ' ✨</div>' +
    '</div>' +
    '</div>';

  modalFn(hero.name + ' Class Lore', html, true);
}
