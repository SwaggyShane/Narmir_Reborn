/**
 * Utility for making authenticated API calls with CSRF token protection
 * Provides a consistent pattern across all React components
 */

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
    console.log('[apiCall] Method:', method, 'URL:', url, 'CSRF Token:', csrfToken ? '✓ present' : '✗ missing');
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

    let data;
    try {
      data = await response.json();
    } catch {
      // Response is not valid JSON
      const text = await response.text();
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

export { apiCall, getCsrfToken };

// Alias for convenience
export const fetchApi = apiCall;
