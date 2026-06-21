let showHeroXpModalImpl = null;

export function registerShowHeroXpModal(fn) {
  showHeroXpModalImpl = typeof fn === 'function' ? fn : null;
  return () => {
    if (showHeroXpModalImpl === fn) showHeroXpModalImpl = null;
  };
}

export function showHeroXpModal() {
  return showHeroXpModalImpl ? showHeroXpModalImpl() : null;
}
