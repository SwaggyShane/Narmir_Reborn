import React from 'react';

// Single shared source of truth for every "distribute / release / allocate"
// button group in the game (Training, Build, passive Scouting, School,
// Library, ...). Uniform size (base-btn's own default px-3 py-1.5 text-sm —
// no per-caller overrides), uniform color (accent for Distribute, red for
// Release, gold for Allocate), uniform order (Distribute, then Release,
// then Allocate, left to right), right-justified within its container.
export const DISTRIBUTE_BUTTON_CLASS = 'base-btn variant-accent whitespace-nowrap bg-[var(--accent1)] disabled:opacity-60';
export const RELEASE_BUTTON_CLASS = 'base-btn variant-red whitespace-nowrap bg-[var(--red)] disabled:opacity-60';
export const ALLOCATE_BUTTON_CLASS = 'base-btn variant-gold whitespace-nowrap bg-[var(--gold)] text-black disabled:opacity-60';

export const AllocationButtons = ({
  onDistribute,
  onRelease,
  onAllocate,
  distributeLabel = 'Distribute',
  releaseLabel = 'Release',
  allocateLabel = 'Allocate',
  distributeTitle,
  releaseTitle,
  allocateTitle,
  disabled = false,
  distributeDisabled = false,
  releaseDisabled = false,
  allocateDisabled = false,
  className = '',
}) => (
  <div className={`flex justify-end gap-2 ${className}`}>
    {onDistribute && (
      <button
        className={DISTRIBUTE_BUTTON_CLASS}
        onClick={onDistribute}
        disabled={disabled || distributeDisabled}
        title={distributeTitle}
      >
        {distributeLabel}
      </button>
    )}
    <button
      className={RELEASE_BUTTON_CLASS}
      onClick={onRelease}
      disabled={disabled || releaseDisabled}
      title={releaseTitle}
    >
      {releaseLabel}
    </button>
    <button
      className={ALLOCATE_BUTTON_CLASS}
      onClick={onAllocate}
      disabled={disabled || allocateDisabled}
      title={allocateTitle}
    >
      {allocateLabel}
    </button>
  </div>
);
