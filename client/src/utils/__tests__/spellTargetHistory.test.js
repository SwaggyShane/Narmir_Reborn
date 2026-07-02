import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSpellTargetHistory,
  getLastSpellTarget,
  setLastSpellTarget,
} from '../spellTargetHistory.js';

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(String(key), String(value));
    },
    removeItem: (key) => {
      store.delete(String(key));
    },
    clear: () => {
      store.clear();
    },
  };
}

describe('spellTargetHistory', () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
  });

  it('stores and retrieves the last target per spell key', () => {
    expect(getLastSpellTarget('whisper')).toBeNull();

    setLastSpellTarget('whisper', 42);
    setLastSpellTarget('oracle', 99);

    expect(getLastSpellTarget('whisper')).toBe('42');
    expect(getLastSpellTarget('oracle')).toBe('99');
    expect(getLastSpellTarget()).toBe('99');
    expect(getLastSpellTarget('missing-spell')).toBeNull();
  });

  it('clears an individual spell target history entry', () => {
    setLastSpellTarget('whisper', 42);
    clearSpellTargetHistory('whisper');

    expect(getLastSpellTarget('whisper')).toBeNull();
  });
});
