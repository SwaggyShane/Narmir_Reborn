import React from 'react';

const LoreModal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-[700px] flex-col rounded-lg border-2 border-[var(--purple)] bg-[var(--bg2)] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3.5">
          <span className="text-[14px] font-bold text-[var(--text)]">{title}</span>
          <button
            onClick={onClose}
            className="rounded px-1 text-[18px] leading-none text-[var(--text3)]"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
};

export default LoreModal;
