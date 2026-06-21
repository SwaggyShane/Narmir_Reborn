import React from 'react';

const LoreModal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
        zIndex: 9000, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '16px',
      }}
    >
      <div style={{
        background: 'var(--bg2)', border: '2px solid var(--purple)',
        borderRadius: '6px', width: '100%', maxWidth: '700px',
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{title}</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '18px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
          >✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '16px 18px' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default LoreModal;
