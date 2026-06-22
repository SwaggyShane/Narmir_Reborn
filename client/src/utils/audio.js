let soundLibrary = {};

export function registerSoundLibrary(library) {
  soundLibrary = library && typeof library === 'object' ? { ...library } : {};
}

export function playGameSound(soundKey) {
  const src = soundLibrary[soundKey];
  if (!src) return false;

  try {
    const audio = new Audio(src);
    audio.volume = 0.6;
    audio.play().catch(() => {});
    return true;
  } catch (err) {
    console.debug('[audio] Failed to play sound', soundKey, err?.message || err);
    return false;
  }
}
