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
      <div className="text-[12px] font-bold text-[var(--text2)] mb-1">
        {repairMojibake(step.icon || '⚔')} {repairMojibake(step.title || 'Battle Step')}
      </div>
      <div className="text-[13px] text-[var(--text)] whitespace-pre-wrap">
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
          background: 'var(--bg2)',
          border: '2px solid var(--accent1)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          maxWidth: '400px',
          width: '90%',
          position: 'relative',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="m-0 text-[18px] text-[var(--text)]">
            {repairMojibake(title)}
          </h2>
          <button
            className="btn px-2 py-1 text-[12px]"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div
          ref={contentRef}
          className="max-h-[400px] overflow-y-auto"
        >
          {steps.slice(0, visibleCount).map((step, i) => (
            <StepCard key={i} step={step} visible={true} />
          ))}
          {done && (
            <button
              className="btn btn-primary w-full mt-4"
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
