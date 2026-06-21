let setBountyTargetImpl = null;

export function registerSetBountyTarget(fn) {
  setBountyTargetImpl = typeof fn === 'function' ? fn : null;
  return () => {
    if (setBountyTargetImpl === fn) setBountyTargetImpl = null;
  };
}

export function selectBountyTarget(id) {
  if (!setBountyTargetImpl) return null;
  return setBountyTargetImpl(id);
}
