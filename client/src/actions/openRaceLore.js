export const openRaceLore = (race) => {
  if (typeof window !== 'undefined' && typeof window.openRaceLore === 'function') {
    window.openRaceLore(race);
  }
};
