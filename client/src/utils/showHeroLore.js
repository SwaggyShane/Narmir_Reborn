let showHeroLoreImpl = null;

export function registerShowHeroLore(fn) {
  showHeroLoreImpl = typeof fn === 'function' ? fn : null;
  return () => {
    if (showHeroLoreImpl === fn) showHeroLoreImpl = null;
  };
}

export function showHeroLore(heroName) {
  return showHeroLoreImpl ? showHeroLoreImpl(heroName) : null;
}
