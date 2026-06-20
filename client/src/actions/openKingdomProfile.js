import { apiCall } from '../utils/api.js';
import { fmt } from '../utils/fmt.js';
import { fmtShort } from '../utils/numberFormat.js';
import { repairMojibake } from '../utils/repairMojibake.js';
import { toast } from '../utils/toast.js';

const escHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function mkStatBox(label, val, color) {
  return (
    '<div style="background:var(--bg3);border-radius:6px;padding:10px;text-align:center">' +
    '<div style="font-size:10px;color:var(--text3);margin-bottom:4px;text-transform:uppercase">' +
    escHtml(label) +
    '</div>' +
    '<div style="font-size:16px;font-weight:700;color:' +
    color +
    '">' +
    escHtml(val) +
    '</div>' +
    '</div>'
  );
}

export async function openKingdomProfile(name) {
  const modal = document.getElementById('kingdom-profile-modal');
  const content = document.getElementById('kingdom-profile-content');
  if (modal) modal.style.display = 'flex';
  if (content) {
    content.innerHTML = '<div style="text-align:center;color:var(--text3);padding:40px">Loading...</div>';
  }

  const data = await apiCall('GET', '/api/kingdom/profile/' + encodeURIComponent(name));
  if (data.error) {
    if (content) {
      content.innerHTML = '<div style="color:var(--red);text-align:center;padding:30px">' + escHtml(data.error) + '</div>';
    }
    return;
  }

  const state = typeof window !== 'undefined' ? (window.state || {}) : {};
  const raceIcons = typeof window !== 'undefined' ? window.RACE_ICONS || {} : {};
  const getRacePortrait = typeof window !== 'undefined' ? window.getRacePortrait : null;
  const regionMeta = typeof window !== 'undefined' ? window.REGION_META || {} : {};
  const raceIcon = raceIcons[data.race] || '👤';
  const racePortrait = typeof getRacePortrait === 'function' ? getRacePortrait(data.race, data.gender || 'male') : '';
  const isMe = data.id === state.kingdomId;

  const resFields = [
    { key: 'res_military', label: 'Military' },
    { key: 'res_economy', label: 'Economy' },
    { key: 'res_construction', label: 'Construction' },
    { key: 'res_spellbook', label: 'Spellbook' },
    { key: 'res_attack_magic', label: 'Attack Magic' },
    { key: 'res_entertainment', label: 'Entertainment' },
  ];

  const topRes = resFields
    .filter((f) => (data[f.key] || 0) > 0)
    .sort((a, b) => (data[b.key] || 0) - (data[a.key] || 0))
    .slice(0, 3);

  const effM = data.happiness !== undefined && data.happiness !== null ? data.happiness : 50;

  let disc = state.discovered_kingdoms || {};
  if (typeof disc === 'string') {
    try {
      disc = JSON.parse(disc);
    } catch {}
  }
  const isMapped = disc[data.id] && disc[data.id].mapped;

  if (content) {
    content.innerHTML =
      '<div style="display: flex; gap: 20px; margin-bottom: 24px; align-items: flex-start; text-align: left;">' +
      '<div style="flex-shrink: 0; width: 120px;">' +
      '<div style="width: 120px; height: 120px; background: var(--bg3); border: 2px solid var(--gold); border-radius: 16px; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); position: relative;">' +
      (racePortrait
        ? '<img src="' + escHtml(racePortrait) + '" style="width:100%; height:100%; object-fit:cover; position:absolute; top:0; left:0; z-index:1;" onerror="this.style.display=\'none\'" />'
        : '') +
      '<span style="font-size: 60px; position: relative; z-index: 0;">' +
      escHtml(raceIcon) +
      '</span>' +
      '</div>' +
      '<div style="font-size: 10px; color: var(--gold); text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Kingdom Sigil</div>' +
      '</div>' +
      '<div style="flex: 1; padding-top: 4px;">' +
      '<h2 style="color:var(--gold);margin:0 0 4px;font-size:24px; letter-spacing: -0.5px;">' +
      escHtml(repairMojibake(data.name)) +
      '</h2>' +
      '<div style="font-size:14px;color:var(--text2); margin-bottom: 4px; font-weight: 500;">' +
      escHtml(repairMojibake(data.username || '?')) +
      (data.is_ai ? ' 🤖' : '') +
      '</div>' +
      '<div style="font-size:12px;color:var(--text3); background: var(--bg2); display: inline-block; padding: 2px 8px; border-radius: 4px; border: 1px solid var(--border);">' +
      escHtml(data.region || regionMeta.name || 'Unknown Lands') +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:20px; position: relative; overflow: hidden;">' +
      '<div style="font-size:10px; color:var(--text3); text-transform:uppercase; margin-bottom:8px; font-weight:700; letter-spacing:0.5px; display: flex; align-items: center; gap: 6px;"><span style="color: var(--gold)">📖</span> Kingdom Biography</div>' +
      '<div style="font-size:14px; color:var(--text); line-height:1.6; font-style:italic; position: relative; z-index: 1;">' +
      (data.description ? '“' + escHtml(repairMojibake(data.description)).replace(/\n/g, '<br>') + '”' : 'No official chronicles found for this realm.') +
      '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px">' +
      mkStatBox('Global Rank', '#' + (data.rank || '???'), '#ffd700') +
      mkStatBox('Level', data.level || 1, 'var(--accent1)') +
      mkStatBox('Turns Used', fmt(data.turn || 0), 'var(--text2)') +
      mkStatBox('Total Score', fmt(data.score || 0), '#ffd700') +
      mkStatBox('Domain Size', fmtShort(data.land || 0) + ' ac', 'var(--text2)') +
      mkStatBox('Population', fmtShort(data.population || 0), 'var(--text2)') +
      mkStatBox('Happiness', effM + '%', effM >= 100 ? 'var(--green)' : 'var(--amber)') +
      mkStatBox('Recent Combat', data.news && data.news.length ? 'ACTIVE' : 'NONE', data.news && data.news.length ? 'var(--red)' : 'var(--text3)') +
      '</div>' +
      '<div style="background:var(--bg3); border-radius:10px; padding:12px; margin-bottom:20px; border: 1px solid var(--border);">' +
      '<div style="font-size:10px; color:var(--text3); text-transform:uppercase; margin-bottom:10px; font-weight:700; letter-spacing:0.5px; display: flex; align-items: center; gap: 6px;"><span style="color: var(--red)">⚔</span> Military Intelligence (Recent News)</div>' +
      '<div style="font-size:12px; color:var(--text3); max-height: 100px; overflow-y: auto; padding-right: 4px;">' +
      (data.news && data.news.length
        ? data.news
            .slice(0, 5)
            .map((n) => {
              return (
                "<div style='margin-bottom:6px; border-bottom:1px solid var(--border); padding-bottom:4px; line-height:1.4;'><span style='color:var(--text2); font-weight:600;'>T-" +
                n.turn_num +
                ':</span> ' +
                escHtml(repairMojibake(n.message || '')) +
                '</div>'
              );
            })
            .join('')
        : 'No recent field reports available for this kingdom.') +
      '</div>' +
      '</div>' +
      '<div style="display:flex; flex-direction:column; gap:10px;">' +
      '<button class="btn btn-accent" style="width:100%; padding: 12px; font-weight: 700;" onclick="openDirectMessage(\'' +
      data.player_id +
      "','" +
      String(data.name || '').replace(/'/g, "\\'") +
      "');closeKingdomProfile()\">✉ Send Message to Ruler</button>" +
      (isMapped && !isMe
        ? '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">' +
          '<button class="btn btn-gold" style="padding: 10px;" onclick="switchTab(\'bounties\');selectBountyTarget(' +
          data.id +
          ",'" +
          String(data.name || '').replace(/'/g, "\\'") +
          "');closeKingdomProfile()\">🎚 Place Bounty</button>" +
          '<button class="btn btn-gold" style="padding: 10px;" onclick="establishTradeRoute(' +
          data.id +
          ');closeKingdomProfile()">🤝 Trade Route</button>' +
          '<button class="btn btn-red" style="padding: 10px;" onclick="targetFromRankings(' +
          data.id +
          ",'attack');closeKingdomProfile()\">⚔ Attack</button>" +
          '<button class="btn btn-accent" style="padding: 10px;" onclick="targetFromRankings(' +
          data.id +
          ",'spells');closeKingdomProfile()\">✨ Cast Spell</button>" +
          '<button class="btn" style="grid-column: span 2; padding: 10px;" onclick="targetFromRankings(' +
          data.id +
          ",'covert');closeKingdomProfile()\">🕵 Covert Operation</button>" +
          '</div>'
        : isMe
          ? ''
          : '<div style="font-size:11px; color:var(--text3); text-align:center; padding:16px; border:1px dashed var(--border); border-radius:12px; background:var(--bg2); line-height: 1.5;">📍 <strong>Exact coordinates unknown.</strong><br>Establish a map of this realm through exploration or intelligence to enable warfare operations.</div>') +
      '</div>';
  }
}
