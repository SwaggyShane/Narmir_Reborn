import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { repairMojibake } from '../../utils/repairMojibake.js';

function StepCard({ step, visible }) {
  return (
    <div
      style={{
        marginBottom: '12px',
        padding: '10px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 'var(--radius)',
        borderLeft: `3px solid ${String(step.icon || '').includes('⚔') ? 'var(--red)' : 'var(--accent)'}`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(20px)',
        transition: 'all 0.3s ease',
      }}
    >
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', marginBottom: '4px' }}>
        {repairMojibake(step.icon || '⚔')} {repairMojibake(step.title || 'Battle Step')}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
        {repairMojibake(step.msg || '')}
      </div>
    </div>
  );
}

export default function ReplayModal({ title, steps, onClose }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [done, setDone] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    if (visibleCount >= steps.length) {
      setDone(true);
      return;
    }
    const t = setTimeout(() => {
      setVisibleCount((n) => n + 1);
    }, visibleCount === 0 ? 100 : 1000);
    return () => clearTimeout(t);
  }, [visibleCount, steps.length]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [visibleCount]);

  const modal = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 'var(--z-modal)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#1a1a1a',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          maxWidth: '400px',
          width: '90%',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text)' }}>
            {repairMojibake(title)}
          </h2>
          <button
            className="btn"
            style={{ padding: '4px 8px', fontSize: '12px' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div
          ref={contentRef}
          style={{ maxHeight: '400px', overflowY: 'auto' }}
        >
          {steps.slice(0, visibleCount).map((step, i) => (
            <StepCard key={i} step={step} visible={true} />
          ))}
          {done && (
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '16px' }}
              onClick={onClose}
            >
              Finish Replay
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
}
