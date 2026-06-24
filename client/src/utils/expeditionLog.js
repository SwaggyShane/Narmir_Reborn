import { AppEvent, emitAppEvent } from './appEvents.js';

export function dispatchExpeditionLogEntry(icon, title, subtitle) {
  emitAppEvent(AppEvent.EXPEDITION_LOG_ENTRY, { icon, title, subtitle });
}