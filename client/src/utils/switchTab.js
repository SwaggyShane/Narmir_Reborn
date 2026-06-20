export function switchTab(tabName, targetEl) {
  if (typeof window !== 'undefined' && typeof window.switchTab === 'function') {
    return window.switchTab(tabName, targetEl);
  }
  return null;
}
