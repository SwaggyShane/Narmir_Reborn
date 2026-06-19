import React from 'react';

const WarfareReportsTab = ({ isActive, content, onRefresh }) => {
  if (!isActive) return null;

  return (
    <div style={{ display: 'block' }}>
      <div className="card" style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>📝 War &amp; Covert Reports</span>
          <button className="base-btn" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={onRefresh}>↻ Refresh</button>
        </div>
        <div id="war-log-list-warfare" style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {content}
        </div>
      </div>
    </div>
  );
};

export default WarfareReportsTab;
