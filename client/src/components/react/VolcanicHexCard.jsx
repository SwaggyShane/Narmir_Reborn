/**
 * Volcanic hex card
 * Teasers by stage; ACTIVE/DORMANT + Free/Occupied; Draw only when gates pass.
 * Launch via B5 lavaDrawLaunch.js only (no duplicate submit path).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiCall } from '../../utils/api.mjs';
import { toast } from '../../utils/toast.js';
import { clientLavaDrawGates, submitLavaDraw } from '../../utils/lavaDrawLaunch.js';
import { normalizeAndRouteResponse } from '../../utils/responseNormalizer.js';
import {
  useEconomyStore,
  useEngineerLevel,
  useEngineers,
  useMages,
  useTroopLevels,
} from '../../stores';

function mageLevelFromTroops(troopLevels) {
  const entry = troopLevels?.mages;
  if (entry == null) return 1;
  if (typeof entry === 'number') return entry;
  return Number(entry.level) || 1;
}

function normalizeBarges(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function formatCountdown(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.floor((ms % 60000) / 1000);
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * @param {{ col: number, row: number, x?: number, y?: number, terrain?: string, onClose?: () => void }} props
 */
const VolcanicHexCard = ({ col, row, x, y, onClose }) => {
  const forge = useEconomyStore((s) => !!s.forge);
  const fluxBarges = useEconomyStore((s) => s.flux_barges);
  const engineerLevel = Number(useEngineerLevel() || 1);
  const engineers = Number(useEngineers() || 0);
  const mages = Number(useMages() || 0);
  const mageLevel = mageLevelFromTroops(useTroopLevels());

  const barges = useMemo(() => normalizeBarges(fluxBarges), [fluxBarges]);
  const idleBarges = useMemo(
    () => barges.filter((b) => b.status === 'idle' && (Number(b.integrity) || 0) > 0),
    [barges],
  );

  const [vent, setVent] = useState({
    active: true,
    occupying_kingdom_id: null,
    occupying_kingdom_name: null,
    dormant_until: null,
  });
  const [bargeId, setBargeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  // Real-time countdown refresh
  useEffect(() => {
    if (!vent.dormant_until || vent.active) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [vent.dormant_until, vent.active]);

  const loadVent = useCallback(async () => {
    // Prefer A5-shaped vent payload when server exposes it (contract shape §15.4).
    const result = await apiCall(
      `/api/kingdom/lava-vent?hex_col=${encodeURIComponent(col)}&hex_row=${encodeURIComponent(row)}`,
    );
    if (result?.error) {
      // No row / no route yet: empty vent = ACTIVE and free (matches A5 getVentState default).
      setVent({
        active: true,
        occupying_kingdom_id: null,
        occupying_kingdom_name: null,
        dormant_until: null,
      });
      return;
    }
    setVent({
      active: result.active !== false,
      occupying_kingdom_id: result.occupying_kingdom_id ?? null,
      occupying_kingdom_name: result.occupying_kingdom_name ?? null,
      dormant_until: result.dormant_until ?? null,
    });
  }, [col, row]);

  useEffect(() => {
    loadVent();
  }, [loadVent]);

  useEffect(() => {
    if (idleBarges.length && bargeId === '') {
      setBargeId(idleBarges[0].id);
    }
  }, [idleBarges, bargeId]);

  const countdown = useMemo(
    () => formatCountdown(vent.dormant_until),
    // tick forces recompute for live countdown
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vent.dormant_until, tick],
  );

  const ventActive = vent.active && !countdown;
  const free =
    ventActive &&
    (vent.occupying_kingdom_id == null || vent.occupying_kingdom_id === '');

  const gate = clientLavaDrawGates({
    forge,
    engineerLevel,
    mageLevel,
    engineersAvailable: engineers,
    magesAvailable: mages,
    barges,
    bargeId,
  });

  const drawEligible = gate.ok && ventActive && free;

  /** §7 primary control */
  let primary = null;
  if (!forge) {
    primary = {
      type: 'teaser',
      text: 'This could lead to something good.',
    };
  } else if (!drawEligible) {
    primary = {
      type: 'teaser',
      text: 'Heat sleeps here. A deeper craft might wake it.',
    };
  } else {
    primary = { type: 'draw' };
  }

  const onDraw = async () => {
    if (!drawEligible) return;
    setBusy(true);
    try {
      const result = await submitLavaDraw({
        target_x: col,
        target_y: row,
        barge_id: bargeId,
      });
      if (result?.error) {
        toast(result.error, 'error');
        return;
      }
      normalizeAndRouteResponse(result, { reason: 'lava-draw', targetX: col, targetY: row });
      toast(result.message || `Lava draw launched toward (${col}, ${row})`, 'success');
      await loadVent();
    } catch (e) {
      toast(e?.message || 'Lava draw failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card flex-1 min-h-0 overflow-y-auto" data-testid="volcanic-hex-card">
      <div className="card-title !mb-2">🌋 Volcanic vent</div>
      <div className="text-[12px] text-[var(--text3)] mb-2 space-y-0.5">
        <div>
          <strong>Coordinates:</strong> ({col}, {row})
        </div>
        {x != null && y != null && (
          <div>
            <strong>World Position:</strong> ({Math.round(x)}, {Math.round(y)})
          </div>
        )}
        <div>
          <strong>Terrain:</strong> Volcanic
        </div>
        <div>
          <strong>Vent:</strong>{' '}
          {ventActive ? (
            <span className="text-emerald-300">ACTIVE (Flowing)</span>
          ) : (
            <span className="text-amber-300">
              DORMANT
              {countdown ? ` — ready in ${countdown}` : ''}
            </span>
          )}
        </div>
        <div>
          <strong>Access:</strong>{' '}
          {free ? (
            <span className="text-emerald-300">Free</span>
          ) : (
            <span className="text-sky-300">
              Occupied
              {vent.occupying_kingdom_name
                ? ` — ${vent.occupying_kingdom_name}`
                : ''}
            </span>
          )}
        </div>
      </div>

      {primary.type === 'teaser' && (
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-[12px] text-orange-100/90 mb-3">
          {primary.text}
        </div>
      )}

      {primary.type === 'draw' && (
        <div className="space-y-2 mb-3">
          <label className="text-[11px] text-[var(--text3)]" htmlFor="volc-barge">
            Flux-Barge
          </label>
          <select
            id="volc-barge"
            className="input w-full text-[12px]"
            value={bargeId}
            onChange={(e) =>
              setBargeId(e.target.value === '' ? '' : Number(e.target.value))
            }
          >
            <option value="">Select…</option>
            {idleBarges.map((b) => (
              <option key={b.id} value={b.id}>
                #{b.id} · hull {b.integrity}/100
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn text-[11px] px-2 py-1 w-full"
            disabled={busy || !bargeId}
            onClick={onDraw}
          >
            {busy ? 'Launching…' : 'Draw lava'}
          </button>
        </div>
      )}

      {forge && !drawEligible && gate.reason && (
        <div className="text-[11px] text-[var(--text3)] mb-2">{gate.reason}</div>
      )}

      <button
        type="button"
        className="base-btn text-[11px] px-2 py-1 w-full"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
};

export default VolcanicHexCard;
