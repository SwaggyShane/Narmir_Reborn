import { useEffect } from 'react';
import { toast } from '../utils/toast.js';

export function useSocket(socket) {
  useEffect(() => {
    if (!socket || socket._narmirGeneralHandlersBound) return;

    const onAttack = (data) => {
      toast('⚔️ ' + (data.from || 'Someone') + ' attacked your kingdom!', 'error');
      window.dispatchEvent(new CustomEvent('narmir:news-refresh'));
      window.loadKingdom?.();
    };

    const onSpell = () => {
      window.dispatchEvent(new CustomEvent('narmir:news-refresh'));
      window.loadKingdom?.();
    };

    const onTurnUpdate = () => {
      window.dispatchEvent(new CustomEvent('narmir:news-refresh'));
      window.loadKingdom?.();
    };

    const onForumNew = () => window.loadForum?.();
    const onForumNewPost = () => window.loadForum?.();

    const onAllianceUpdated = () => {
      window.loadAlliances?.();
      window.loadKingdom?.();
    };

    const onWorldUpdated = () => window.loadWorldMap?.();
    const onActiveCounts = () => window.updateActiveCountDisplay?.();

    const onChatClear = () => {
      const list = document.getElementById('global-chat-messages');
      if (list) list.innerHTML = '';
    };

    const onGlobalMessage = (data) => {
      console.log('[event:global_message]', data.message || 'A global event occurred.');
    };

    socket.on('event:attack_received', onAttack);
    socket.on('event:spell_received', onSpell);
    socket.on('event:turn_update', onTurnUpdate);
    socket.on('event:forum_new', onForumNew);
    socket.on('event:forum_new_post', onForumNewPost);
    socket.on('event:alliance_updated', onAllianceUpdated);
    socket.on('event:world_updated', onWorldUpdated);
    socket.on('event:active_counts', onActiveCounts);
    socket.on('event:chat_clear', onChatClear);
    socket.on('event:global_message', onGlobalMessage);

    socket._narmirGeneralHandlersBound = true;

    return () => {
      socket.off('event:attack_received', onAttack);
      socket.off('event:spell_received', onSpell);
      socket.off('event:turn_update', onTurnUpdate);
      socket.off('event:forum_new', onForumNew);
      socket.off('event:forum_new_post', onForumNewPost);
      socket.off('event:alliance_updated', onAllianceUpdated);
      socket.off('event:world_updated', onWorldUpdated);
      socket.off('event:active_counts', onActiveCounts);
      socket.off('event:chat_clear', onChatClear);
      socket.off('event:global_message', onGlobalMessage);
      socket._narmirGeneralHandlersBound = false;
    };
  }, [socket]);
}
