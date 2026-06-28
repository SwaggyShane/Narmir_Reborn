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
          className="input"
          min="0"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          style={{ textAlign: 'right', flex: 1 }}
          placeholder="Qty"
        />
        <button className="base-btn" onClick={onMax} style={{ padding: '4px 8px', fontSize: '10px' }}>
          Max
        </button>
      </div>
    </div>
  );
};
