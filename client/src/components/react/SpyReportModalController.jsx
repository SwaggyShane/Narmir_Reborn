import React, { useEffect, useState } from 'react';
import SpyReportModal from './SpyReportModal.jsx';
import { registerShowSpyReport } from '../../utils/showSpyReport.mjs';

export default function SpyReportModalController() {
  const [data, setData] = useState(null);

  useEffect(() => registerShowSpyReport((report, targetName) => {
    setData({ report, targetName });
  }), []);

  return (
    <SpyReportModal
      data={data}
      onClose={() => setData(null)}
    />
  );
}