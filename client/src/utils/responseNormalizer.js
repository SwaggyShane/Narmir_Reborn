/**
 * Centralized Response Normalizer & Router
 *
 * SINGLE SOURCE OF TRUTH for all API → Zustand routing.
 * All server responses flow through here before reaching stores.
 *
 * This prevents:
 * - Partial-sync bugs (response hits one store but not others)
 * - Inconsistent routing (different handlers routing differently)
 * - Silent failures (bad responses silently ignored)
 *
 * Contract validation is aggressive in dev (throws errors), tree-shakes in prod.
 */

import { useEconomyStore } from '../stores';
import { useMilitaryStore } from '../stores';
import { useResearchStore } from '../stores';
import { usePopulationStore } from '../stores';
import { useProfileStore } from '../stores';
import { AppEvent, emitAppEvent } from './appEvents.js';

/**
 * Validates that response follows standardized contract.
 * THROWS in development if contract is violated (catches errors immediately).
 * Tree-shakes away in production build (zero overhead).
 */
export function validateContract(updates, context = {}) {
  const isDev = process.env.NODE_ENV === 'development';

  if (!updates) {
    if (isDev) {
      throw new Error(
        `[Contract] Response missing updates object: ${JSON.stringify(context)}`
      );
    }
    return false;
  }

  // Whitelist of allowed top-level keys in updates
  const allowedKeys = new Set([
    'economy', 'military', 'research', 'population', 'profile',
    'error', 'events', 'message', 'success', 'ok'
  ]);

  // Check for unexpected keys (catches routing mistakes)
  const foundKeys = Object.keys(updates);
  const unexpectedKeys = foundKeys.filter(key => !allowedKeys.has(key));

  if (unexpectedKeys.length > 0 && isDev) {
    throw new Error(
      `[Contract] Unexpected response keys: ${unexpectedKeys.join(', ')}. Context: ${JSON.stringify(context)}`
    );
  }

  // Each domain that IS present should be an object (not null/string/etc)
  ['economy', 'military', 'research', 'population', 'profile'].forEach(domain => {
    if (updates[domain] !== undefined && typeof updates[domain] !== 'object') {
      if (isDev) {
        throw new Error(
          `[Contract] ${domain} is not an object: ${typeof updates[domain]}. Context: ${JSON.stringify(context)}`
        );
      }
    }
  });

  return true;
}

/**
 * Main routing function.
 *
 * Accepts any response, validates contract (throws in dev), routes to stores.
 * Works in any context: components (via hooks), utilities (.getState()), socket handlers.
 *
 * Usage in components:
 *   const result = await fetch(url);
 *   normalizeAndRouteResponse(result, { reason: 'upgrade-purchased', type: 'farm' });
 *
 * Usage in utilities/socket:
 *   normalizeAndRouteResponse(socketData, { reason: 'socket-event', source: 'turn-update' });
 */
export function normalizeAndRouteResponse(response, context = {}) {
  if (!response?.updates) return null;

  const { updates } = response;

  // Validate response contract (THROWS in dev on violation)
  validateContract(updates, context);

  // Ensure every domain is an object (empty {} if not present)
  const normalized = {
    economy: updates.economy || {},
    military: updates.military || {},
    research: updates.research || {},
    population: updates.population || {},
    profile: updates.profile || {},
  };

  // Route each domain to its store (only if domain has actual updates)
  if (Object.keys(normalized.economy).length > 0) {
    try {
      useEconomyStore.getState().receiveServerSnapshot(normalized.economy);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[Router] Failed to update economyStore:', e);
        throw e;
      }
    }
  }

  if (Object.keys(normalized.military).length > 0) {
    try {
      useMilitaryStore.getState().receiveServerSnapshot(normalized.military);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[Router] Failed to update militaryStore:', e);
        throw e;
      }
    }
  }

  if (Object.keys(normalized.research).length > 0) {
    try {
      useResearchStore.getState().receiveServerSnapshot(normalized.research);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[Router] Failed to update researchStore:', e);
        throw e;
      }
    }
  }

  if (Object.keys(normalized.population).length > 0) {
    try {
      usePopulationStore.getState().receiveServerSnapshot(normalized.population);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[Router] Failed to update populationStore:', e);
        throw e;
      }
    }
  }

  if (Object.keys(normalized.profile).length > 0) {
    try {
      useProfileStore.getState().receiveServerSnapshot(normalized.profile);
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[Router] Failed to update profileStore:', e);
        throw e;
      }
    }
  }

  const updatedDomains = Object.keys(normalized)
    .filter(k => Object.keys(normalized[k]).length > 0);

  // Notify any listeners (e.g. useGameMutationEvents) that a server-driven
  // state change just happened, so they can react without polling. This is
  // the successor to the old GameStateManager mutation-event pipeline --
  // every response that reaches this router passes through here, so it's
  // the single point that can stand in for "something changed".
  if (updatedDomains.length > 0) {
    emitAppEvent(AppEvent.GAME_MUTATION, { ...context, updatedDomains });
  }

  return normalized;
}

/**
 * Helper: Check if a store was updated by looking at normalized result
 *
 * Usage: if (wasStoreUpdated(result, 'economy')) { ... do something ... }
 */
export function wasStoreUpdated(normalized, storeName) {
  if (!normalized) return false;
  return Object.keys(normalized[storeName] || {}).length > 0;
}

/**
 * Apply a FLAT full-kingdom snapshot (e.g. GET /api/kingdom/me's response —
 * the whole kingdom row at the top level, not wrapped in `updates`) to all 5
 * stores at once. Every store's own `receiveServerSnapshot` is written
 * defensively (`if (data?.X !== undefined) state.X = data.X`), so handing
 * the same flat object to all 5 is safe — each just picks out what it needs.
 *
 * A4-7, 2026-07-19: this exact 5-line block was independently duplicated in
 * AuthModal.jsx (loadKingdom), ExplorationPanel.jsx and HeroesPanel.jsx
 * (both as a local `syncKingdomData`), and ResourcesPanel.jsx had its own
 * *broken* copy that called `normalizeAndRouteResponse` instead — which
 * expects a domain-structured `{updates: {...}}` shape and silently no-ops
 * on a flat `/kingdom/me` response (no `.updates` key). Consolidating here
 * removes the duplication and fixes that dead call at the source.
 *
 * Do NOT use this for action-result responses (attack, hire, etc.) — those
 * are domain-structured (`{updates: {economy: {...}, ...}}`) and belong in
 * normalizeAndRouteResponse instead. This is specifically for the flat,
 * full-row shape `/kingdom/me`-style endpoints return.
 */
export function applyFlatKingdomSnapshot(kingdomData) {
  if (!kingdomData || Object.keys(kingdomData).length === 0) return;
  useProfileStore.getState().receiveServerSnapshot(kingdomData);
  useEconomyStore.getState().receiveServerSnapshot(kingdomData);
  useMilitaryStore.getState().receiveServerSnapshot(kingdomData);
  useResearchStore.getState().receiveServerSnapshot(kingdomData);
  usePopulationStore.getState().receiveServerSnapshot(kingdomData);
}
