import { useEffect, useState } from 'react';
import { getSocket } from '../socket-client.js';

export function useCloudSync() {
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    let mounted = true;
    let socket = null;

    const update = () => {
      if (mounted) setSynced(!!socket?.connected);
    };

    getSocket()
      .then((s) => {
        socket = s;
        update();
        s.on('connect', update);
        s.on('disconnect', update);
        s.on('connect_error', update);
      })
      .catch(() => {
        if (mounted) setSynced(false);
      });

    return () => {
      mounted = false;
      if (socket) {
        socket.off('connect', update);
        socket.off('disconnect', update);
        socket.off('connect_error', update);
      }
    };
  }, []);

  return synced;
}