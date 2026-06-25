import React from 'react';

export default function ConfirmDialog({ title, message, onConfirm, onCancel, danger = true, input }) {
  return (
    <div style={OVERLAY} onClick={onCancel}>
      <div style={BOX} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 10px', fontFamily: 'Cinzel, serif', fontSize: 16, color: danger ? 'var(--red)' : 'var(--gold)' }}>
          {title}
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text2)', lineHeight: 1.5 }}>
          {message}
        </p>
        {input && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
              {input.label}
            </label>
            <input
              type="text"
              onChange={e => input.onChange(e.target.value)}
              style={{
                width: '100%', padding: '6px 8px', background: 'var(--bg4)',
                border: '1px solid var(--border2)', borderRadius: 4,
                color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                fontFamily: 'Inter, sans-serif',
              }}
            />
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={BTN_CANCEL}>Cancel</button>
          <button onClick={onConfirm} style={danger ? BTN_DANGER : BTN_OK}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

const OVERLAY = {
  position: 'fixed', inset: 0, zIndex: 10001,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const BOX = {
  background: 'var(--bg2)', border: '1px solid var(--border2)',
  borderRadius: 8, padding: '24px 28px', maxWidth: 400, width: '90%',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
};

const BTN = {
  padding: '7px 16px', borderRadius: 4, fontSize: 13,
  fontFamily: 'Inter, sans-serif', cursor: 'pointer', border: '1px solid',
};

const BTN_CANCEL = { ...BTN, background: 'var(--bg4)', borderColor: 'var(--border2)', color: 'var(--text2)' };
const BTN_DANGER = { ...BTN, background: 'var(--red)', borderColor: 'var(--red)', color: '#fff' };
const BTN_OK    = { ...BTN, background: 'var(--gold)', borderColor: 'var(--gold)', color: '#09090b' };
