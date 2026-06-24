import { useCallback, useState } from 'react';
import { AppEvent, emitAppEvent } from '../utils/appEvents.js';
import { useAppEvent } from './useAppEvent.js';

const STORAGE_KEY = 'narmir_nav_layout';

export function readNavLayout() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'responsive';
  } catch {
    return 'responsive';
  }
}

export function setNavLayout(layout) {
  try {
    localStorage.setItem(STORAGE_KEY, layout);
  } catch {
    // ignore storage failures
  }
  emitAppEvent(AppEvent.NAV_LAYOUT_CHANGE, layout);
}

export function useNavLayout() {
  const [layout, setLayout] = useState(readNavLayout);

  useAppEvent(AppEvent.NAV_LAYOUT_CHANGE, (nextLayout) => {
    setLayout(nextLayout || readNavLayout());
  });

  const updateLayout = useCallback((nextLayout) => {
    setNavLayout(nextLayout);
    setLayout(nextLayout);
  }, []);

  return { layout, setLayout: updateLayout };
}