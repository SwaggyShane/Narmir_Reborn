import React from 'react';

const ProgressBar = ({ percent = 0, variant = 'accent1', className = '', id }) => {
  const value = typeof percent === 'string' ? parseFloat(percent) : percent;
  const clamped = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className={`prog-wrap ${className}`}>
      <div id={id} className={`prog-bar ${variant}`} style={{ width: `${clamped}%` }} />
    </div>
  );
};

export default ProgressBar;
