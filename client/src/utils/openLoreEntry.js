let openLoreEntryImpl = null;

export function registerOpenLoreEntry(fn) {
  openLoreEntryImpl = typeof fn === 'function' ? fn : null;
  return () => {
    if (openLoreEntryImpl === fn) openLoreEntryImpl = null;
  };
}

export function openLoreEntry(title, message, isHtml = false) {
  return openLoreEntryImpl ? openLoreEntryImpl(title, message, isHtml) : null;
}