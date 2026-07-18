/**
 * Shared lava-draw launch
 * Single submit path for Forge tab and volcanic hex card (B6).
 * POST /api/kingdom/expedition/lava-draw
 * Body: { target_x, target_y, barge_id } — crew fixed server-side (25 eng + 5 mages).
 */
import { apiCall } from './api.mjs';

/**
 * @param {{ target_x: number, target_y: number, barge_id: number }} params
 * @returns {Promise<object>} API JSON (may include error)
 */
export async function submitLavaDraw({ target_x, target_y, barge_id }) {
  const x = Math.floor(Number(target_x));
  const y = Math.floor(Number(target_y));
  const id = Math.floor(Number(barge_id));
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { error: 'Invalid target hex' };
  }
  if (!Number.isFinite(id) || id < 1) {
    return { error: 'Select a Flux-Barge' };
  }
  return apiCall('/api/kingdom/expedition/lava-draw', {
    method: 'POST',
    body: { target_x: x, target_y: y, barge_id: id },
  });
}

/**
 * Open-friendly gate check (client mirror of §7 — server is source of truth).
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function clientLavaDrawGates({
  forge,
  engineerLevel,
  mageLevel,
  engineersAvailable,
  magesAvailable,
  barges,
  bargeId,
}) {
  if (!forge) return { ok: false, reason: 'Forge not installed' };
  if ((engineerLevel || 0) < 50) return { ok: false, reason: 'Engineer level 50+ required' };
  if ((mageLevel || 0) < 25) return { ok: false, reason: 'Mage level 25+ required' };
  if ((engineersAvailable || 0) < 25) return { ok: false, reason: 'Need 25 free engineers' };
  if ((magesAvailable || 0) < 5) return { ok: false, reason: 'Need 5 free mages' };
  const list = Array.isArray(barges) ? barges : [];
  const barge = list.find((b) => Number(b.id) === Number(bargeId));
  if (!barge) return { ok: false, reason: 'Select an idle Flux-Barge' };
  if (barge.status !== 'idle') return { ok: false, reason: 'Barge not idle' };
  if ((Number(barge.integrity) || 0) <= 0) return { ok: false, reason: 'Barge hull destroyed' };
  return { ok: true };
}
