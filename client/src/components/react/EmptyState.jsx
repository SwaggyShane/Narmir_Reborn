import React from 'react';

export default function EmptyState({
  icon = '📭',
  title = 'Nothing here yet',
  description,
  actionLabel,
  onAction,
}) {
  return (
    <div className="empty-state flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-3 text-[32px] leading-none" aria-hidden="true">{icon}</div>
      <div className="mb-1 text-[15px] font-semibold text-text">{title}</div>
      {description ? (
        <p className="mb-4 max-w-md text-[13px] leading-relaxed text-text3">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <button type="button" className="base-btn variant-accent bg-accent1 px-4" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}