let openHeroLoreImpl = null;

export function registerOpenHeroLore(fn) {
  openHeroLoreImpl = typeof fn === 'function' ? fn : null;
  return () => {
    if (openHeroLoreImpl === fn) openHeroLoreImpl = null;
  };
}

export function openHeroLore(heroKey) {
  return openHeroLoreImpl ? openHeroLoreImpl(heroKey) : null;
}