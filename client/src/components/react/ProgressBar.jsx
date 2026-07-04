import React from 'react';

const ProgressBar = ({ percent = 0, variant = 'accent1' }) => (
  <div className="prog-wrap">
    <div className={`prog-bar ${variant}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
  </div>
);

export default ProgressBar;
