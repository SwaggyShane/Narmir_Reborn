import { toast } from '../utils/toast.js';
import { repairMojibake } from '../utils/repairMojibake.js';
import { loadKingdom } from '../components/react/AuthModal.jsx';
import { loadWorldMap } from '../components/react/WorldmapPanel.jsx';

// Binds global socket event handlers once when the socket is ready.
// Must NOT be called inside a React component — these handlers are app-wide
// and must never be unbound based on component lifecycle.
export function initSocketHandlers(socket) {
  if (!socket || socket._narmirGeneralHandlersBound) return;

  socket.on('event:attack_received', (data) => {
    toast('⚔️ ' + repairMojibake(data?.from || 'Someone') + ' attacked your kingdom!', 'error');
    window.dispatchEvent(new CustomEvent('narmir:news-refresh'));
    loadKingdom().catch(() => {});
  });

  socket.on('event:spell_received', () => {
    window.dispatchEvent(new CustomEvent('narmir:news-refresh'));
    loadKingdom().catch(() => {});
  });

  socket.on('event:turn_update', () => {
    window.dispatchEvent(new CustomEvent('narmir:news-refresh'));
    loadKingdom().catch(() => {});
  });

  socket.on('event:forum_new', () => window.loadForum?.());
  socket.on('event:forum_new_post', () => window.loadForum?.());

  socket.on('event:alliance_updated', () => {
    window.dispatchEvent(new CustomEvent('narmir:alliance-refresh'));
    loadKingdom().catch(() => {});
  });

  socket.on('event:world_updated', () => loadWorldMap().catch(() => {}));
  socket.on('event:active_counts', () => window.updateActiveCountDisplay?.());

  socket.on('event:chat_clear', () => {
    const list = document.getElementById('global-chat-messages');
    if (list) list.innerHTML = '';
  });

  socket.on('event:global_message', (data) => {
    console.log('[event:global_message]', data?.message || 'A global event occurred.');
  });

  socket._narmirGeneralHandlersBound = true;
}
