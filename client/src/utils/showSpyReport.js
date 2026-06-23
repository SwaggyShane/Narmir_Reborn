import { fmt } from './fmt.js';
import { openGenericModal } from './genericShell.js';
import { playGameSound } from './audio.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

export function showSpyReport(report, targetName) {
  playGameSound('spy_success');

  const name = targetName || report.name || 'Unknown';
  const rows = [
    ['Race', report.race || '?'],
    ['Rank', report.rank || '?'],
    ['Land', `${fmt(report.land || 0)} acres`],
    ['Population', fmt(report.population || 0)],
    ['Fighters', fmt(report.fighters || 0)],
    ['Mages', fmt(report.mages || 0)],
    ['War machines', fmt(report.war_machines || 0)],
    ['Ladders', fmt(report.ladders || 0)],
    ['Ninjas', fmt(report.ninjas || 0)],
    ['Thieves', fmt(report.thieves || 0)],
    ['Allies', Array.isArray(report.allies) ? report.allies.length : 0],
  ];

  let html = '<div class="br-title" style="color:var(--blue)"> Spy report  ' + escapeHtml(name) + '</div>';
  html += '<div style="font-size:12px;color:var(--text3);margin-bottom:12px">Gathered intelligence on the target kingdom.</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">';
  html += rows.map(([label, value]) => `
    <div style="background:var(--bg3);border-radius:8px;padding:8px 10px">
      <div style="font-size:11px;color:var(--text3);margin-bottom:2px">${escapeHtml(label)}</div>
      <div style="font-size:14px;font-weight:600;color:var(--text)">${escapeHtml(value)}</div>
    </div>
  `).join('');
  html += '</div>';
  html += '<button class="btn btn-primary" onclick="closeGenericModal()" style="width:100%;margin-top:12px">Close</button>';

  openGenericModal(html);
}
