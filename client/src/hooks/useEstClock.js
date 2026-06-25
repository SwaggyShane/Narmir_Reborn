import { useEffect, useState } from 'react';

const EST_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

function formatEstClock(date = new Date()) {
  return `${EST_FORMATTER.format(date)} EST`;
}

export function useEstClock() {
  const [clock, setClock] = useState(() => formatEstClock());

  useEffect(() => {
    const tick = () => setClock(formatEstClock());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return clock;
}