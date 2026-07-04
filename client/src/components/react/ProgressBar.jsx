import React from 'react';

const ProgressBar = ({ percent = 0, variant = 'accent1', className = '', id, wrapperClassName, barClassName }) => {
  const value = typeof percent === 'string' ? parseFloat(percent) : percent;
  const clamped = Math.min(100, Math.max(0, Number(value) || 0));
  const wrap = wrapperClassName || `prog-wrap ${className}`;
  const bar = barClassName || `prog-bar ${variant}`;
  return (
    <div className={wrap}>
      <div id={id} className={bar} style={{ width: `${clamped}%` }} />
    </div>
  );
};

export default ProgressBar;
