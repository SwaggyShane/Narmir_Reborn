export const EXPEDITION_LOG_EVENT = 'narmir:expedition-log-entry';

export function dispatchExpeditionLogEntry(icon, title, subtitle) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EXPEDITION_LOG_EVENT, {
    detail: { icon, title, subtitle },
  }));
}