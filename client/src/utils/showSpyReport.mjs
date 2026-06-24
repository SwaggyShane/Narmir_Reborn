import { playGameSound } from './audio.js';

let showSpyReportImpl = null;

export function registerShowSpyReport(fn) {
  showSpyReportImpl = typeof fn === 'function' ? fn : null;
  return () => {
    if (showSpyReportImpl === fn) showSpyReportImpl = null;
  };
}

export function showSpyReport(report, targetName) {
  playGameSound('spy_success');
  return showSpyReportImpl ? showSpyReportImpl(report, targetName) : null;
}