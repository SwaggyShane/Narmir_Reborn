import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { registerCloseGenericModal, registerOpenGenericModal } from '../../utils/openGenericModal.js';

export default function GenericModalController() {
  const [html, setHtml] = useState('');

  useEffect(() => {
    const unregisterOpen = registerOpenGenericModal((content) => {
      setHtml(String(content || ''));
    });
    const unregisterClose = registerCloseGenericModal(() => setHtml(''));
    return () => {
      unregisterOpen();
      unregisterClose();
    };
  }, []);

  if (!html || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/70 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) setHtml('');
      }}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-[520px] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border2)] bg-[var(--bg2)] p-7"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>,
    document.body,
  );
}