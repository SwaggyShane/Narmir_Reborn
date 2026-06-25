import { useEffect, useState } from 'react';

const DEFAULT_STATUS = {
  uptime: '—',
  version: '',
  nodeId: '',
};

export function useServerStatus() {
  const [status, setStatus] = useState(DEFAULT_STATUS);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted || !data) return;
        setStatus({
          uptime: data.uptime || '—',
          version: data.version || '',
          nodeId: data.nodeId || '',
        });
      } catch {
        // Keep the last known values when the poll fails.
      }
    };

    refresh();
    const id = setInterval(refresh, 60_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  return status;
}