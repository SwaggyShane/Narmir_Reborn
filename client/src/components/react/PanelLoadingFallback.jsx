import React from 'react';

const PanelLoadingFallback = () => (
  <div className="panel flex flex-1 items-center justify-center text-center text-text3" role="status" aria-live="polite">
    <span className="animate-pulse text-sm">Loading…</span>
  </div>
);

export default PanelLoadingFallback;
