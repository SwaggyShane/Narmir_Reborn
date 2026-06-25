import { useCallback, useState } from 'react';
import { AppEvent } from '../utils/appEvents.js';
import { readColorTheme, setColorTheme } from '../utils/colorTheme.js';
import { useAppEvent } from './useAppEvent.js';

export function useColorTheme() {
  const [theme, setTheme] = useState(readColorTheme);

  useAppEvent(AppEvent.COLOR_THEME_CHANGE, (nextTheme) => {
    setTheme(nextTheme || readColorTheme());
  });

  const updateTheme = useCallback((nextTheme) => {
    setColorTheme(nextTheme);
    setTheme(nextTheme);
  }, []);

  return { theme, setTheme: updateTheme };
}