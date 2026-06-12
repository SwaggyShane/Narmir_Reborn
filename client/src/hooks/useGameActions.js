import { useActivePanel } from './useActivePanel';

async function apiCall(method, endpoint, body = null) {
  const getCsrfToken = () => {
    try {
      const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
      if (m) return decodeURIComponent(m[1]);
    } catch {
      // Cookie parsing failed, return null
    }
    return null;
  };

  const headers = { 'Content-Type': 'application/json' };
  const csrfToken = getCsrfToken();
  if (csrfToken) headers['x-csrf-token'] = csrfToken;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(endpoint, options);
  return response.json();
}

// Every action funnels its server response through window.applyGameMutation,
// the single mutation entry point. It handles updates, events, window.gameState
// mirror, syncUI, and side effects in one place.
async function runAction(endpoint, body, reason) {
  try {
    const result = await apiCall('POST', endpoint, body);
    if (result.error) return { error: result.error };
    window.applyGameMutation(result, { reason });
    return { success: true, panelData: result };
  } catch (err) {
    return { error: err.message };
  }
}

export function useGameActions() {
  const { activePanel } = useActivePanel();

  const takeTurn   = async ()                  => ({ ...(await runAction('/api/kingdom/turn', null, 'turn_taken')),                   activePanel });
  const quickSearch = async (type)             => ({ ...(await runAction(`/api/kingdom/quick-search/${type}`, null, 'quick_search')), activePanel });
  const castSpell   = async (spellId, target)  => ({ ...(await runAction('/api/kingdom/spell',  { spell: spellId, target }, 'spell_cast')), activePanel });
  const attack      = async (targetId, units)  => ({ ...(await runAction('/api/kingdom/attack', { targetId, ...units },     'attack')),     activePanel });

  return { takeTurn, quickSearch, castSpell, attack };
}
