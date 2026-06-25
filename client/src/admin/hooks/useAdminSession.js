import { useCallback, useRef, useEffect } from 'react';
import { apiCall } from '../../utils/api.mjs';

const UNAUTH_ERRORS = new Set(['Not authenticated', 'Invalid or expired token']);

/**
 * Wraps apiCall with automatic 401 detection.
 * Returns null and calls onUnauthorized when any request comes back unauthenticated.
 * adminFetch is a stable reference — safe to use as a useEffect dependency.
 */
export function useAdminSession({ onUnauthorized }) {
  const cbRef = useRef(onUnauthorized);
  useEffect(() => { cbRef.current = onUnauthorized; }, [onUnauthorized]);

  const adminFetch = useCallback(async (url, options = {}) => {
    const data = await apiCall(url, options);
    if (data && UNAUTH_ERRORS.has(data.error)) {
      cbRef.current?.();
      return null;
    }
    return data;
  }, []);

  return { adminFetch };
}
