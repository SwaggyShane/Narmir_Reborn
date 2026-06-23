let showBattleReportImpl = null;

export function registerShowBattleReport(fn) {
  showBattleReportImpl = typeof fn === 'function' ? fn : null;
  return () => {
    if (showBattleReportImpl === fn) showBattleReportImpl = null;
  };
}

export function showBattleReport(data) {
  return showBattleReportImpl ? showBattleReportImpl(data) : null;
}
