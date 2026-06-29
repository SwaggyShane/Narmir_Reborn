function postError(message, source, line, col, stack) {
  fetch('/api/log-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: String(message),
      source: String(source),
      line,
      col,
      stack: String(stack),
    }),
  }).catch(() => {});
}

/**
 * Keep the app shell free of inline scripts while preserving global runtime error logging.
 */
export function initErrorLogging() {
  if (typeof window === 'undefined' || window.__narmirErrorLogging) return;
  window.__narmirErrorLogging = true;

  window.onerror = function onError(message, source, lineno, colno, error) {
    const msg = String(message || '');
    if (msg.indexOf('WebSocket') !== -1) return false;
    postError(msg, source, lineno, colno, error ? error.stack : 'No stacktrace');
    return false;
  };

  window.addEventListener('unhandledrejection', function onUnhandledRejection(event) {
    const error = event.reason;
    const msg = error ? (error.message || String(error)) : 'Unhandled rejection';
    if (msg.indexOf('WebSocket') !== -1) return;
    postError(msg, 'unhandledrejection', null, null, error ? error.stack : 'No stacktrace');
  });
}
