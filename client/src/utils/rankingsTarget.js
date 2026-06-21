let targetFromRankingsImpl = null;

export function registerTargetFromRankings(fn) {
  targetFromRankingsImpl = typeof fn === 'function' ? fn : null;
  return () => {
    if (targetFromRankingsImpl === fn) targetFromRankingsImpl = null;
  };
}

export function targetFromRankings(id, tab) {
  if (!targetFromRankingsImpl) return null;
  return targetFromRankingsImpl(id, tab);
}
