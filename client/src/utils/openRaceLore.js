export function openRaceLore(race) {
  if (typeof window !== 'undefined' && typeof window.__openRaceLoreImpl === 'function') {
    return window.__openRaceLoreImpl(race);
  }
  return null;
}
