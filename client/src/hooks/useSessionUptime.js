import { useEffect, useState } from 'react';

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

export function useSessionUptime() {
  const [uptime, setUptime] = useState('00h 00m 00s');

  useEffect(() => {
    const startedAt = Date.now();
    const tick = () => setUptime(formatUptime(Date.now() - startedAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return uptime;
}