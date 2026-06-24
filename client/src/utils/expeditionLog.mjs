import { repairMojibake } from './repairMojibake.js';

export function logExpeditionEntry(icon, title, subtitle) {
  const log = document.getElementById('exploration-log');
  if (!log) return;

  const empty = log.querySelector('[data-empty]');
  if (empty) empty.remove();

  const entry = document.createElement('div');
  entry.className = 'exp-log-entry';
  entry.style.cssText =
    'display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px';
  entry.innerHTML =
    '<span style="font-size:18px;flex-shrink:0">' +
    repairMojibake(icon) +
    '</span>' +
    '<div><div style="color:var(--text)">' +
    repairMojibake(title) +
    '</div>' +
    '<div style="font-size:11px;color:var(--text3);margin-top:2px">' +
    repairMojibake(subtitle) +
    '</div></div>';

  log.insertBefore(entry, log.firstChild);
}
