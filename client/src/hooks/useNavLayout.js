import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'narmir_nav_layout';
const EVENT_NAME = 'narmir:nav-layout-change';

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
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: layout }));
}

export function useNavLayout() {
  const [layout, setLayout] = useState(readNavLayout);

  useEffect(() => {
    const onChange = (event) => {
      setLayout(event.detail || readNavLayout());
    };
    window.addEventListener(EVENT_NAME, onChange);
    return () => window.removeEventListener(EVENT_NAME, onChange);
  }, []);

  const updateLayout = useCallback((nextLayout) => {
    setNavLayout(nextLayout);
    setLayout(nextLayout);
  }, []);

  return { layout, setLayout: updateLayout };
}