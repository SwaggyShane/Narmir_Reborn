import React from 'react';
import ReactDOM from 'react-dom';
import { fmt } from '../../utils/fmt.js';

export default function BattleReportModal({ data, onClose }) {
  if (!data) return null;

  const { win, type, target, atkPower = 0, defPower = 0, rows = [], spellOutcome } = data;

  const titleColor = win ? 'var(--green)' : 'var(--red)';
  const outcomeClass = win ? 'br-win' : 'br-lose';
  const outcomeText = win ? ' Victory! Land captured and enemies routed.' : ' Attack repelled. Regroup and try again.';

  const total = atkPower + defPower || 1;
  const atkPct = Math.round((atkPower / total) * 100);
  const defPct = 100 - atkPct;

  const modal = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 'var(--z-backdrop)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 32px',
          maxWidth: 480,
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        <div
          style={{ position: 'absolute', top: 12, right: 12, cursor: 'pointer', color: 'var(--text3)', fontSize: 18, lineHeight: 1, padding: 4 }}
          onClick={onClose}
          title="Close"
        >
          ✕
        </div>

        <div style={{ fontSize: 16, fontWeight: 700, color: titleColor, marginBottom: 4 }}>
          {win ? ' Victory' : ' Repelled'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
          {type}&nbsp;&nbsp;<strong style={{ color: 'var(--text)' }}>{target}</strong>
        </div>

        {!spellOutcome && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
              <span>Your power: <strong style={{ color: 'var(--green)' }}>{fmt(atkPower)}</strong></span>
              <span>Enemy power: <strong style={{ color: 'var(--red)' }}>{fmt(defPower)}</strong></span>
            </div>
            <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--bg4)', display: 'flex' }}>
              <div style={{ width: `${atkPct}%`, background: 'var(--green)', transition: 'width .5s' }} />
              <div style={{ width: `${defPct}%`, background: 'var(--red)' }} />
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {rows.map(([label, value], i) => {
            const sval = String(value);
            let valColor = 'var(--text)';
            if (sval.startsWith('+')) valColor = 'var(--green)';
            else if (sval.startsWith('-') || (label.toLowerCase().includes('lost') && parseInt(value) > 0)) valColor = 'var(--red)';
            return (
              <div key={i} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: valColor }}>{value}</div>
              </div>
            );
          })}
        </div>

        <div className={outcomeClass} style={{ borderRadius: 8, padding: 10, textAlign: 'center', fontWeight: 600 }}>
          {outcomeText}
        </div>

        <button className="btn" onClick={onClose} style={{ marginTop: 18, width: '100%' }}>
          Dismiss report
        </button>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
}
