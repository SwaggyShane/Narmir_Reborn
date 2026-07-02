const STORAGE_KEY = 'narmir_spell_target_history';

function readHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeHistory(history) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // ignore storage failures
  }
}

export function getLastSpellTarget(spellId = 'default') {
  const history = readHistory();
  const entry = history?.[String(spellId || 'default')];
  return entry?.targetId ?? null;
}

export function setLastSpellTarget(spellId = 'default', targetId) {
  const key = String(spellId || 'default');
  const history = readHistory();

  if (targetId === null || targetId === undefined || targetId === '') {
    delete history[key];
  } else {
    history[key] = {
      targetId: String(targetId),
      savedAt: Date.now(),
    };
  }

  writeHistory(history);
}

export function clearSpellTargetHistory(spellId = 'default') {
  setLastSpellTarget(spellId, null);
}
