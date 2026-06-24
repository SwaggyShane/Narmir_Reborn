let openGenericModalImpl = null;
let closeGenericModalImpl = null;

export function registerOpenGenericModal(fn) {
  openGenericModalImpl = typeof fn === 'function' ? fn : null;
  return () => {
    if (openGenericModalImpl === fn) openGenericModalImpl = null;
  };
}

export function registerCloseGenericModal(fn) {
  closeGenericModalImpl = typeof fn === 'function' ? fn : null;
  return () => {
    if (closeGenericModalImpl === fn) closeGenericModalImpl = null;
  };
}

export function openGenericModal(htmlContent) {
  return openGenericModalImpl ? openGenericModalImpl(htmlContent) : null;
}

export function closeGenericModal() {
  return closeGenericModalImpl ? closeGenericModalImpl() : null;
}

if (typeof window !== 'undefined') {
  window.closeGenericModal = closeGenericModal;
}