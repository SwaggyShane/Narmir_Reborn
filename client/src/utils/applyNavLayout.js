export function applyNavLayout() {
  const layout = localStorage.getItem('narmir_nav_layout') || 'responsive';

  document.body.classList.remove('force-left-nav', 'force-bottom-nav');

  if (layout === 'left') {
    document.body.classList.add('force-left-nav');
  } else if (layout === 'bottom') {
    document.body.classList.add('force-bottom-nav');
  }

  window.dispatchEvent(new Event('resize'));
}
