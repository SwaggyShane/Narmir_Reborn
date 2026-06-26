import React, { useEffect, useState } from 'react';
import ForumSection from '../forum/ForumSection';
import { fetchApi } from '../../utils/api';
import { useGameState } from '../../hooks/useGameState';

const ForumPanel = () => {
  const { state } = useGameState();
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchApi('/api/auth/me')
      .then((data) => {
        if (!cancelled && data?.username) setUser(data);
      })
      .catch((err) => console.error('[forum] auth/me failed:', err));
    return () => { cancelled = true; };
  }, [state?.username]);

  return (
    <div
      id="forum"
      className="panel panel-immersive flex h-full min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-2 sm:px-4 sm:pb-4"
    >
      <ForumSection user={user} gameShell />
    </div>
  );
};

export default ForumPanel;