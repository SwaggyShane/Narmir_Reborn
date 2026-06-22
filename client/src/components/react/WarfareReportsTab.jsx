import React from 'react';

const WarfareReportsTab = ({ isActive, content, onRefresh }) => {
  if (!isActive) return null;

  return (
    <div className="block">
      <div className="card mb-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="text-[13px] font-bold text-[var(--text)]">📝 War &amp; Covert Reports</span>
          <button className="base-btn px-2.5 py-1 text-[11px]" onClick={onRefresh}>↻ Refresh</button>
        </div>
        <div id="war-log-list-warfare" className="max-h-[500px] overflow-y-auto">
          {content}
        </div>
      </div>
    </div>
  );
};

export default WarfareReportsTab;
