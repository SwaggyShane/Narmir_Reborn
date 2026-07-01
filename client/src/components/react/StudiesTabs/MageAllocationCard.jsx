import React from 'react';

export const MageAllocationCard = ({
  title,
  description,
  value,
  onChange,
  onMax,
  inputRef,
}) => {
  return (
    <div className="p-3 bg-[var(--bg2)] rounded-2 border border-[var(--border)]">
      <div className="text-xs font-semibold mb-2.5 text-[var(--text)]">{title}</div>
      <div className="text-2xs text-[var(--text3)] mb-2">{ description}</div>
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="number"
          className="input flex-1 text-right"
          min="0"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          placeholder="Qty"
        />
        <button className="base-btn px-2 py-1 text-[10px]" onClick={onMax}>
          Max
        </button>
      </div>
    </div>
  );
};
