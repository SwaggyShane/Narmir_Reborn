import { toast } from '../utils/toast.js';
import { repairMojibake } from '../utils/repairMojibake.js';
import { loadKingdom } from '../components/react/AuthModal.jsx';
import { AppEvent, emitAppEvent } from '../utils/appEvents.js';

// Binds global socket event handlers once when the socket is ready.
// Must NOT be called inside a React component — these handlers are app-wide
// and must never be unbound based on component lifecycle.
export function initSocketHandlers(socket) {
  if (!socket || socket._narmirGeneralHandlersBound) return;

  socket.on('event:attack_received', (data) => {
    toast('⚔️ ' + repairMojibake(data?.from || 'Someone') + ' attacked your kingdom!', 'error');
    emitAppEvent(AppEvent.NEWS_REFRESH);
    loadKingdom().catch(() => {});
  });

  socket.on('event:spell_received', () => {
    emitAppEvent(AppEvent.NEWS_REFRESH);
    loadKingdom().catch(() => {});
  });

  socket.on('event:turn_update', () => {
    emitAppEvent(AppEvent.NEWS_REFRESH);
    loadKingdom().catch(() => {});
  });

  socket.on('event:forum_new', () => emitAppEvent(AppEvent.FORUM_REFRESH));
  socket.on('event:forum_new_post', () => emitAppEvent(AppEvent.FORUM_REFRESH));

  socket.on('event:alliance_updated', () => {
    emitAppEvent(AppEvent.ALLIANCE_REFRESH);
    loadKingdom().catch(() => {});
  });

  socket.on('event:world_updated', () => emitAppEvent(AppEvent.WORLDMAP_REFRESH));

  socket.on('event:chat_clear', () => {
    emitAppEvent(AppEvent.CHAT_CLEAR);
  });

  socket.on('event:global_message', (data) => {
    console.log('[event:global_message]', data?.message || 'A global event occurred.');
  });

  socket._narmirGeneralHandlersBound = true;
}