import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { registerToastEmitter } from '../../utils/toast.js';

const TOAST_THEME = {
  success: { border: '#00ff2b', text: '#7dff86', glow: 'rgba(0, 255, 43, 0.22)' },
  error: { border: '#ff5f5f', text: '#ffb4b4', glow: 'rgba(255, 95, 95, 0.18)' },
  warning: { border: '#f4c95d', text: '#ffe7a4', glow: 'rgba(244, 201, 93, 0.18)' },
  warn: { border: '#f4c95d', text: '#ffe7a4', glow: 'rgba(244, 201, 93, 0.18)' },
  info: { border: '#67b7ff', text: '#cbe5ff', glow: 'rgba(103, 183, 255, 0.18)' },
  system: { border: '#8b93a7', text: '#e4e7ef', glow: 'rgba(139, 147, 167, 0.12)' },
};

export default function ToastProvider() {
  const [current, setCurrent] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return registerToastEmitter((message, type) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setCurrent({ message, type: type || 'info', id: Date.now() });
      timerRef.current = setTimeout(() => setCurrent(null), 4500);
    });
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  if (!current || typeof document === 'undefined') return null;

  const theme = TOAST_THEME[current.type] || TOAST_THEME.system;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[99999] flex justify-center px-4 max-lg:bottom-[calc(88px+env(safe-area-inset-bottom,0px))]"
    >
      <div
        className="pointer-events-auto w-full max-w-[420px] rounded-lg px-3 py-2.5 text-center text-[13px] leading-snug"
        style={{
          border: `1px solid ${theme.border}`,
          color: theme.text,
          background: 'radial-gradient(ellipse 85% 100% at center, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.08) 100%)',
          boxShadow: `0 10px 26px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(0,0,0,0.25), inset 0 0 18px rgba(0,0,0,0.25), 0 0 18px ${theme.glow}`,
        }}
      >
        {current.message}
      </div>
    </div>,
    document.body,
  );
}