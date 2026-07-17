import gsap from 'gsap';

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Fade a world map sidebar detail card (node/kingdom/location) in or out.
 * Used by both the SVG and WebGL map renderers — this only touches the
 * generic DOM card element, not the map surface itself.
 */
export function animateMapPanelCard(element, { visible = true } = {}) {
  if (!element) return () => {};
  gsap.killTweensOf(element);

  if (prefersReducedMotion()) {
    gsap.set(element, { autoAlpha: visible ? 1 : 0, y: 0 });
    return () => {};
  }

  if (!visible) {
    const tween = gsap.to(element, { autoAlpha: 0, y: 8, duration: 0.2, ease: 'power2.in' });
    return () => tween.kill();
  }

  gsap.set(element, { autoAlpha: 0, y: 10 });
  const tween = gsap.to(element, { autoAlpha: 1, y: 0, duration: 0.34, ease: 'power2.out' });
  return () => tween.kill();
}
