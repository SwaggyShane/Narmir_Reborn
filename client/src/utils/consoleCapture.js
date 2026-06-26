const MAX_LINES = 40;
const MAX_LINE_LEN = 220;
const MAX_EXPORT_LEN = 6000;

const LEVEL_TAG = { log: 'LOG', warn: 'WRN', error: 'ERR' };

/** @type {string[]} */
const buffer = [];

function formatArg(value) {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || value == null) return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function redact(text) {
  return String(text)
    .replace(/bearer\s+[a-z0-9._-]+/gi, 'bearer [redacted]')
    .replace(/(password|token|secret|csrf)[=:]\s*\S+/gi, '$1=[redacted]')
    .slice(0, MAX_LINE_LEN);
}

function pushLine(level, args) {
  const ts = new Date().toTimeString().slice(0, 8);
  const body = redact(args.map(formatArg).join(' '));
  buffer.push(`${ts} ${LEVEL_TAG[level] || level.toUpperCase()} ${body}`);
  while (buffer.length > MAX_LINES) buffer.shift();
}

/**
 * Hook console + global errors for automatic bug report attachment.
 * Safe to call once at app boot.
 */
export function initConsoleCapture() {
  if (typeof window === 'undefined' || window.__narmirConsoleCapture) return;
  window.__narmirConsoleCapture = true;

  for (const level of ['log', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      pushLine(level, args);
      original(...args);
    };
  }

  window.addEventListener('error', (event) => {
    const loc = event.filename ? ` @ ${event.filename}:${event.lineno}` : '';
    pushLine('error', [`${event.message}${loc}`]);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error
      ? (event.reason.stack || event.reason.message)
      : formatArg(event.reason);
    pushLine('error', [`Unhandled rejection: ${reason}`]);
  });
}

/** Recent session log for bug reports (trimmed, redacted). */
export function getCapturedConsoleLog() {
  if (!buffer.length) return '';
  const text = buffer.join('\n');
  if (text.length <= MAX_EXPORT_LEN) return text;
  return `…\n${text.slice(-(MAX_EXPORT_LEN - 2))}`;
}

export function getCapturedConsoleLineCount() {
  return buffer.length;
}