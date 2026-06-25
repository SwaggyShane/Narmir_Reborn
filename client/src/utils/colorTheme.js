import { AppEvent, emitAppEvent } from './appEvents.js';

export const STORAGE_KEY = 'narmir_color_theme';
export const DEFAULT_THEME = 'ember';

export const COLOR_THEMES = [
  { id: 'ember', label: 'Ember (Default)', preview: '#f06202' },
  { id: 'green', label: 'Emerald', preview: '#10b981' },
  { id: 'purple', label: 'Arcane Purple', preview: '#8b5cf6' },
  { id: 'blue', label: 'Frost Blue', preview: '#3b82f6' },
  { id: 'crimson', label: 'Crimson', preview: '#ef4444' },
];

const VALID_THEME_IDS = new Set(COLOR_THEMES.map((theme) => theme.id));

export function normalizeColorTheme(themeId) {
  return VALID_THEME_IDS.has(themeId) ? themeId : DEFAULT_THEME;
}

export function readColorTheme() {
  try {
    return normalizeColorTheme(localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME);
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyColorTheme(themeId) {
  const theme = normalizeColorTheme(themeId);
  const root = document.documentElement;

  if (theme === DEFAULT_THEME) {
    root.removeAttribute('data-theme');
  } else {
    root.dataset.theme = theme;
  }
}

export function setColorTheme(themeId) {
  const theme = normalizeColorTheme(themeId);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore storage failures
  }
  applyColorTheme(theme);
  emitAppEvent(AppEvent.COLOR_THEME_CHANGE, theme);
}