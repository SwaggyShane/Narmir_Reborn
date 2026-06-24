import { useEffect } from 'react';
import { subscribeAppEvent } from '../utils/appEvents.js';

export function useAppEvent(event, handler) {
  useEffect(() => {
    if (!event || !handler) return undefined;
    return subscribeAppEvent(event, handler);
  }, [event, handler]);
}