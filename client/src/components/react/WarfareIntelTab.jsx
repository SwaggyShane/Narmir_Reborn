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
    <div className="block">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="card-title flex items-center justify-between">
            <span>🕵️ Your Spy Reports</span>
            <button className="base-btn px-1.5 py-0.5 text-[10px]" onClick={onRefreshSpyReports}>↻</button>
          </div>
          <div id="spy-reports-list" className="max-h-[500px] overflow-y-auto text-[13px]">
            {spyContent}
          </div>
        </div>
        <div className="card">
          <div className="card-title flex items-center justify-between">
            <span>🤝 Alliance Intelligence</span>
            <button className="base-btn px-1.5 py-0.5 text-[10px]" onClick={onRefreshAllianceIntel}>↻</button>
          </div>
          <div id="alliance-intel-list" className="max-h-[500px] overflow-y-auto text-[13px]">
            {allianceContent}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarfareIntelTab;
