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

export function useGameActions() {
  const { activePanel } = useActivePanel();

  const takeTurn = async () => {
    try {
      const result = await apiCall('POST', '/api/kingdom/turn');

      if (result.error) return { error: result.error };

      if (result.updates) {
        window.applyGameMutation?.(result, { reason: 'turn', panelId: activePanel });
      }

      return {
        success: true,
        activePanel,
        panelData: result,
      };
    } catch (err) {
      return { error: err.message };
    }
  };

  const quickSearch = async (type) => {
    try {
      const result = await apiCall('POST', `/api/kingdom/quick-search/${type}`);

      if (result.error) return { error: result.error };

      if (result.updates) {
        window.applyGameMutation?.(result, { reason: `quick-search:${type}`, panelId: activePanel });
      }

      return {
        success: true,
        activePanel,
        panelData: result,
      };
    } catch (err) {
      return { error: err.message };
    }
  };

  const castSpell = async (spellId, targetId) => {
    try {
      const result = await apiCall('POST', '/api/kingdom/spell', {
        spell: spellId,
        target: targetId,
      });

      if (result.error) return { error: result.error };

      if (result.updates) {
        window.applyGameMutation?.(result, { reason: 'spell', panelId: activePanel });
      }

      return {
        success: true,
        activePanel,
        panelData: result,
      };
    } catch (err) {
      return { error: err.message };
    }
  };

  const attack = async (targetId, units) => {
    try {
      const result = await apiCall('POST', '/api/kingdom/attack', {
        targetId,
        ...units,
      });

      if (result.error) return { error: result.error };

      if (result.updates) {
        window.applyGameMutation?.(result, { reason: 'attack', panelId: activePanel });
      }

      return {
        success: true,
        activePanel,
        panelData: result,
      };
    } catch (err) {
      return { error: err.message };
    }
  };

  return { takeTurn, quickSearch, castSpell, attack };
}
