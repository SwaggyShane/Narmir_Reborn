/**
 * Apply server updates to Zustand stores.
 * Syncs kingdom state across all stores.
 */
import { useEconomyStore } from '../stores/index.js';
import { useMilitaryStore } from '../stores/index.js';
import { useProfileStore } from '../stores/index.js';
import { useResearchStore } from '../stores/index.js';
import { usePopulationStore } from '../stores/index.js';
import { normalizeMutationUpdates } from './upgradeUtils.js';

export function applyServerUpdates(updates, context = {}) {
  if (!updates) return null;

  const normalized = normalizeMutationUpdates(updates);

  // Sync to all relevant stores
  if (useEconomyStore.getState()) useEconomyStore.getState().receiveServerSnapshot(normalized);
  if (useMilitaryStore.getState()) useMilitaryStore.getState().receiveServerSnapshot(normalized);
  if (useProfileStore.getState()) useProfileStore.getState().receiveServerSnapshot(normalized);
  if (useResearchStore.getState()) useResearchStore.getState().receiveServerSnapshot(normalized);
  if (usePopulationStore.getState()) usePopulationStore.getState().receiveServerSnapshot(normalized);

  return normalized;
}

export function applyGameMutation(resultOrUpdates, context = {}) {
  if (!resultOrUpdates) return null;
  const updates = resultOrUpdates.updates || resultOrUpdates;
  if (!updates) return null;
  return applyServerUpdates(updates, context);
}
