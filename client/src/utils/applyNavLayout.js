export function applyNavLayout() {
  const layout = localStorage.getItem('narmir_nav_layout') || 'responsive';

  document.body.classList.remove('nav-layout-left', 'nav-layout-bottom');

  if (layout === 'left') {
    document.body.classList.add('nav-layout-left');
  } else if (layout === 'bottom') {
    document.body.classList.add('nav-layout-bottom');
  }

  window.dispatchEvent(new Event('resize'));
}
