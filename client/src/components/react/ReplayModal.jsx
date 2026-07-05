import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import clsx from 'clsx';
import { repairMojibake } from '../../utils/repairMojibake.js';

function StepCard({ step, visible }) {
  return (
    <div
      className={clsx(
        'mb-3 rounded-[var(--radius)] border-l-[3px] bg-white/5 p-2.5 transition-all duration-300 ease-[ease]',
        String(step.icon || '').includes('⚔') ? 'border-l-[var(--red)]' : 'border-l-[var(--accent)]',
        visible ? 'translate-x-0 opacity-100' : 'translate-x-5 opacity-0',
      )}
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
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-[90%] max-w-[400px] rounded-[var(--radius-lg)] border-2 border-[var(--accent1)] bg-[var(--bg2)] p-5">
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
