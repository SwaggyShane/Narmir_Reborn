const STORAGE_KEY = 'narmir_spell_target_history';
const DEFAULT_KEY = '__default__';

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

export function getLastSpellTarget(spellId = DEFAULT_KEY) {
  const history = readHistory();
  const key = String(spellId || DEFAULT_KEY);
  const entry = history?.[key];
  if (entry?.targetId !== undefined && entry?.targetId !== null) {
    return entry.targetId;
  }
  if (arguments.length === 0 || key === DEFAULT_KEY) {
    const fallback = history?.[DEFAULT_KEY];
    return fallback?.targetId ?? null;
  }
  return null;
}

export function setLastSpellTarget(spellId = DEFAULT_KEY, targetId) {
  const key = String(spellId || DEFAULT_KEY);
  const history = readHistory();

  if (targetId === null || targetId === undefined || targetId === '') {
    delete history[key];
  } else {
    history[key] = {
      targetId: String(targetId),
      savedAt: Date.now(),
    };
    history[DEFAULT_KEY] = history[key];
  }

  writeHistory(history);
}

export function clearSpellTargetHistory(spellId = DEFAULT_KEY) {
  setLastSpellTarget(spellId, null);
}
