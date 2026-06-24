import React from 'react';
import { createPortal } from 'react-dom';
import { fmt } from '../../utils/fmt.js';
import { repairMojibake } from '../../utils/repairMojibake.js';

function clean(value) {
  return repairMojibake(value === null || value === undefined ? '' : String(value));
}

export default function SpyReportModal({ data, onClose }) {
  if (!data || typeof document === 'undefined') return null;

  const { report, targetName } = data;
  const name = clean(targetName || report?.name || 'Unknown');
  const rows = [
    ['Race', clean(report?.race || '?')],
    ['Rank', clean(report?.rank || '?')],
    ['Land', `${fmt(report?.land || 0)} acres`],
    ['Population', fmt(report?.population || 0)],
    ['Fighters', fmt(report?.fighters || 0)],
    ['Mages', fmt(report?.mages || 0)],
    ['War machines', fmt(report?.war_machines || 0)],
    ['Ladders', fmt(report?.ladders || 0)],
    ['Ninjas', fmt(report?.ninjas || 0)],
    ['Thieves', fmt(report?.thieves || 0)],
    ['Allies', Array.isArray(report?.allies) ? report.allies.length : 0],
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/70 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative max-h-[85vh] w-full max-w-[520px] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border2)] bg-[var(--bg2)] p-7">
        <button
          type="button"
          className="absolute right-3 top-3 cursor-pointer border-none bg-transparent text-[18px] text-[var(--text3)]"
          onClick={onClose}
        >
          ✕
        </button>
        <div className="mb-1 text-base font-bold text-[var(--blue)]">🕵️ Spy report — {name}</div>
        <div className="mb-3 text-xs text-[var(--text3)]">Gathered intelligence on the target kingdom.</div>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-[var(--bg3)] px-2.5 py-2">
              <div className="mb-0.5 text-[11px] text-[var(--text3)]">{label}</div>
              <div className="text-sm font-semibold text-[var(--text)]">{value}</div>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-primary mt-3 w-full" onClick={onClose}>
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}