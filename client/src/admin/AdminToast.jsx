import React, { useEffect } from 'react';

const BG = { error: 'var(--red)', success: 'var(--green)', info: 'var(--bg4)' };

export default function AdminToast({ message, type = 'info', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        padding: '10px 16px', borderRadius: 6, maxWidth: 340,
        background: BG[type] ?? BG.info, color: '#fff',
        fontSize: 13, fontFamily: 'Inter, sans-serif',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)', cursor: 'pointer',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {message}
    </div>
  );
}
