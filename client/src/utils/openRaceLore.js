let openRaceLoreImpl = null;

export function registerOpenRaceLore(fn) {
  openRaceLoreImpl = typeof fn === 'function' ? fn : null;
  return () => {
    if (openRaceLoreImpl === fn) openRaceLoreImpl = null;
  };
}

export function openRaceLore(race) {
  return openRaceLoreImpl ? openRaceLoreImpl(race) : null;
}
