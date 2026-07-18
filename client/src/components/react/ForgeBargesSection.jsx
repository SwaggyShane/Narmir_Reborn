/**
 * Forge Barges section — FORGE_SYSTEM.md §15.3 B4
 * List + hull bars; queue extra barge (POST /forge/build-barge, no body).
 * Costs: 100 steel + 150k gold + 1k stone, 20 turns; max 3.
 */
import React, { useMemo, useState } from 'react';
import { apiCall } from '../../utils/api.mjs';
import { fmt } from '../../utils/fmt';
import { toast } from '../../utils/toast.js';
import {
  useGold,
  useStone,
  useSteel,
  useEconomyStore,
} from '../../stores';

const MAX_BARGES = 3;
const HULL_MAX = 100;
const EXTRA_COST = { steel: 100, gold: 150000, stone: 1000, turns: 20 };

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

function statusLabel(status) {
  switch (status) {
    case 'building':
      return 'Building';
    case 'deployed':
      return 'Deployed';
    case 'idle':
    default:
      return 'Idle';
  }
}

function statusClass(status) {
  switch (status) {
    case 'building':
      return 'text-amber-300';
    case 'deployed':
      return 'text-sky-300';
    default:
      return 'text-emerald-300/90';
  }
}

const ForgeBargesSection = () => {
  const gold = useGold();
  const stone = useStone();
  const steel = useSteel();
  const fluxBarges = useEconomyStore((s) => s.flux_barges);
  const barges = useMemo(() => normalizeBarges(fluxBarges), [fluxBarges]);
  const [busy, setBusy] = useState(false);

  const canQueue =
    barges.length < MAX_BARGES &&
    steel >= EXTRA_COST.steel &&
    gold >= EXTRA_COST.gold &&
    stone >= EXTRA_COST.stone;

  const queueBarge = async () => {
    setBusy(true);
    try {
      const result = await apiCall('/api/kingdom/forge/build-barge', {
        method: 'POST',
        body: {},
      });
      if (result?.error) {
        toast(result.error, 'error');
        return;
      }
      const nextBarges = normalizeBarges(result.flux_barges);
      useEconomyStore.getState().receiveServerSnapshot({
        flux_barges: nextBarges.length ? nextBarges : barges,
        steel:
          result.steel !== undefined
            ? result.steel
            : Math.max(0, steel - EXTRA_COST.steel),
        gold: result.gold !== undefined ? result.gold : Math.max(0, gold - EXTRA_COST.gold),
        stone: result.stone !== undefined ? result.stone : Math.max(0, stone - EXTRA_COST.stone),
      });
      toast(
        result.turns != null
          ? `Flux-Barge queued (${result.turns} turns)`
          : 'Flux-Barge queued',
        'success',
      );
    } catch (e) {
      toast(e?.message || 'Failed to queue barge', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-xl border border-white/10 bg-bg3/80 p-4 space-y-4"
      data-testid="forge-barges-section"
    >
      <div className="text-[13px] font-semibold text-text">🚤 Barges — Flux fleet</div>
      <div className="text-[12px] text-text3">
        Max {MAX_BARGES}. Extra barge: {EXTRA_COST.steel} steel · {fmt(EXTRA_COST.gold)} gold ·{' '}
        {fmt(EXTRA_COST.stone)} stone · {EXTRA_COST.turns} turns. First barge is free with Forge.
      </div>

      <div className="flex flex-wrap gap-4 text-[12px]">
        <span>
          Steel: <strong className="text-amber-200">{fmt(steel)}</strong>
        </span>
        <span>
          Gold: <strong className="text-gold">{fmt(gold)}</strong>
        </span>
        <span>
          Stone: <strong className="text-text">{fmt(stone)}</strong>
        </span>
        <span>
          Fleet: <strong className="text-text">{barges.length}/{MAX_BARGES}</strong>
        </span>
      </div>

      {barges.length === 0 ? (
        <div className="text-[12px] text-text3 rounded-lg border border-white/5 bg-bg4/50 px-3 py-3">
          No Flux-Barges yet. Install the Forge upgrade for one free barge, or queue an extra when
          ready (eng level 50+ on server).
        </div>
      ) : (
        <ul className="space-y-2">
          {barges.map((b) => {
            const integrity = Math.max(0, Math.min(HULL_MAX, Number(b.integrity) || 0));
            const pct = Math.round((integrity / HULL_MAX) * 100);
            const turnsLeft = b.status === 'building' ? Number(b.turns_left) || 0 : null;
            return (
              <li
                key={b.id}
                className="rounded-lg border border-white/10 bg-bg4/60 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <span className="text-[12px] font-semibold text-text">
                    Flux-Barge #{b.id}
                  </span>
                  <span className={`text-[11px] font-medium ${statusClass(b.status)}`}>
                    {statusLabel(b.status)}
                    {turnsLeft != null ? ` · ${turnsLeft} turns left` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-bg2 overflow-hidden">
                    <div
                      className={
                        'h-full rounded-full transition-[width] ' +
                        (pct > 50
                          ? 'bg-emerald-500/80'
                          : pct > 20
                            ? 'bg-amber-500/80'
                            : 'bg-red-500/80')
                      }
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-text3 w-16 text-right">
                    Hull {integrity}/{HULL_MAX}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-white/5 pt-3">
        <button
          type="button"
          disabled={busy || !canQueue}
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[12px] font-semibold text-amber-200 disabled:opacity-40 hover:bg-amber-500/20"
          onClick={queueBarge}
          title={
            barges.length >= MAX_BARGES
              ? 'Fleet at max'
              : !canQueue
                ? 'Need steel, gold, and stone'
                : 'Queue extra Flux-Barge'
          }
        >
          {busy
            ? 'Queuing…'
            : barges.length >= MAX_BARGES
              ? 'Fleet full'
              : 'Queue extra barge'}
        </button>
        {!canQueue && barges.length < MAX_BARGES && (
          <div className="text-[11px] text-text3 mt-1.5">
            Need {EXTRA_COST.steel} steel, {fmt(EXTRA_COST.gold)} gold, {fmt(EXTRA_COST.stone)}{' '}
            stone
            {steel < EXTRA_COST.steel ? ' · short steel' : ''}
            {gold < EXTRA_COST.gold ? ' · short gold' : ''}
            {stone < EXTRA_COST.stone ? ' · short stone' : ''}
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgeBargesSection;
