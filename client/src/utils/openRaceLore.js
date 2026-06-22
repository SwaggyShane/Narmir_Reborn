let openRaceLoreImpl = null;

export function registerOpenRaceLore(fn) {
  openRaceLoreImpl = typeof fn === 'function' ? fn : null;
  console.log('[openRaceLore] Registered handler:', !!openRaceLoreImpl);
  return () => {
    if (openRaceLoreImpl === fn) openRaceLoreImpl = null;
  };
}

export function openRaceLore(race) {
  console.log('[openRaceLore] Called with race:', race, 'handler exists:', !!openRaceLoreImpl);
  return openRaceLoreImpl ? openRaceLoreImpl(race) : null;
}
