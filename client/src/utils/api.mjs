/**
 * Utility for making authenticated API calls with CSRF token protection
 * Provides a consistent pattern across all React components
 */
import { normalizeAndRouteResponse } from './responseNormalizer.js';

/**
 * Extract CSRF token from browser cookies
 * @returns {string|null} The CSRF token or null if not found
 */
function getCsrfToken() {
  try {
    const match = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Make an authenticated API call with automatic CSRF token handling
 * @param {string} url - The API endpoint URL
 * @param {object} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<object>} Parsed JSON response
 */
async function apiCall(url, options = {}) {
  const { method = 'GET', body, headers = {}, ...rest } = options;

  // Add CSRF token for state-changing requests
  const requestHeaders = { 'Content-Type': 'application/json', ...headers };
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      requestHeaders['x-csrf-token'] = csrfToken;
    } else {
      console.warn('[apiCall] No CSRF token found. Available cookie keys:', document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(Boolean));
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
      ...rest,
    });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text || `Server error ${response.status}` };
    }

    // If response was not OK but data doesn't have error property, synthesize one
    if (!response.ok && !data.error) {
      data.error = data.error || `Server error ${response.status}`;
    }

    return data;
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * apiCall, then automatically route the response through
 * normalizeAndRouteResponse if it carries an `updates` object.
 *
 * A4-5, 2026-07-19: added after A4-3 found the same bug repeatedly across
 * unrelated components — a route correctly returns a domain-structured
 * `updates` object, but the calling component either forgets to route it to
 * the stores at all, or hand-rolls the routing and gets the shape wrong
 * (hire, attack, spell, demolish, options, lava-draw all had this exact bug,
 * independently, before being fixed one at a time). Using this wrapper for
 * any new call site makes that whole class of bug structurally impossible
 * to reintroduce, since routing isn't something the caller can forget.
 *
 * Existing call sites are not bulk-migrated to this — see A4-3's own
 * "per-route, not in bulk" lesson. Callers that already need the response's
 * *other* fields (error, message, report, etc.) still get the full parsed
 * body back, unchanged; this only adds the routing as a side effect.
 *
 * @param {string} url
 * @param {object} [options] - same as apiCall's options
 * @param {object} [context] - passed through to normalizeAndRouteResponse (reason, etc.)
 * @returns {Promise<object>} the same parsed JSON response apiCall would return
 */
async function apiCallAndSync(url, options = {}, context = {}) {
  const result = await apiCall(url, options);
  if (result && !result.error && result.updates) {
    normalizeAndRouteResponse(result, context);
  }
  return result;
}

export { apiCall, apiCallAndSync, getCsrfToken };

// Alias for convenience
export const fetchApi = apiCall;
