let toastEmitter = null;

export function registerToastEmitter(fn) {
  toastEmitter = typeof fn === 'function' ? fn : null;
  return () => {
    if (toastEmitter === fn) toastEmitter = null;
  };
}

export function toast(message, type = 'info') {
  const text = String(message ?? '');
  const kind = type || 'info';
  if (toastEmitter) {
    toastEmitter(text, kind);
    return;
  }
  const level = kind === 'error' ? 'error' : (kind === 'warn' || kind === 'warning') ? 'warn' : 'log';
  console[level](`[toast:${kind}]`, text);
}