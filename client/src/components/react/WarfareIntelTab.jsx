import React from 'react';

const WarfareIntelTab = ({
  isActive,
  spyContent,
  allianceContent,
  onRefreshSpyReports,
  onRefreshAllianceIntel,
}) => {
  if (!isActive) return null;

  return (
    <div style={{ display: 'block' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🕵️ Your Spy Reports</span>
            <button className="base-btn" style={{ fontSize: '10px', padding: '2px 6px' }} onClick={onRefreshSpyReports}>↻</button>
          </div>
          <div id="spy-reports-list" style={{ maxHeight: '500px', overflowY: 'auto', fontSize: '13px' }}>
            {spyContent}
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🤝 Alliance Intelligence</span>
            <button className="base-btn" style={{ fontSize: '10px', padding: '2px 6px' }} onClick={onRefreshAllianceIntel}>↻</button>
          </div>
          <div id="alliance-intel-list" style={{ maxHeight: '500px', overflowY: 'auto', fontSize: '13px' }}>
            {allianceContent}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarfareIntelTab;
