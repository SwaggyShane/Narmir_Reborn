/**
 * Forge Fuel section — FORGE_SYSTEM.md §15.3 B3
 * Charcoal wood allocation + coal stock.
 */
import React, { useState } from 'react';
import { apiCall } from '../../utils/api.mjs';
import { fmt } from '../../utils/fmt';
import { toast } from '../../utils/toast.js';
import {
  useWood,
  useCoal,
  useEconomyStore,
} from '../../stores';

const ForgeFuelSection = () => {
  const wood = useWood();
  const coal = useCoal();
  const allocation = useEconomyStore((s) => Number(s.charcoal_wood_allocation || 0));
  const [woodInput, setWoodInput] = useState(String(allocation || 0));
  const [busy, setBusy] = useState(false);

  const saveAllocation = async () => {
    const w = Math.max(0, Math.floor(Number(woodInput) || 0));
    setBusy(true);
    try {
      const result = await apiCall('/api/kingdom/forge/charcoal-allocate', {
        method: 'POST',
        body: { wood: w },
      });
      if (result?.error) {
        toast(result.error, 'error');
        return;
      }
      useEconomyStore.getState().receiveServerSnapshot({
        charcoal_wood_allocation:
          result.charcoal_wood_allocation !== undefined
            ? result.charcoal_wood_allocation
            : w,
      });
      setWoodInput(String(result.charcoal_wood_allocation ?? w));
      toast('Charcoal allocation saved', 'success');
    } catch (e) {
      toast(e?.message || 'Failed to save allocation', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-bg3/80 p-4 space-y-3" data-testid="forge-fuel-section">
      <div className="text-[13px] font-semibold text-text">🔥 Fuel — Charcoal pit</div>
      <div className="text-[12px] text-text3">
        Each turn: burn allocated wood → coal (25% × race). Cap 5,000 coal.
      </div>
      <div className="flex flex-wrap gap-4 text-[12px]">
        <div>
          Wood on hand:{' '}
          <span className="text-text font-semibold">{fmt(wood)}</span>
        </div>
        <div>
          Coal:{' '}
          <span className="text-amber-200 font-semibold">{fmt(coal)}</span>
        </div>
        <div>
          Current alloc:{' '}
          <span className="text-text font-semibold">{fmt(allocation)}</span> wood/turn
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[12px] text-text3" htmlFor="charcoal-wood">
          Wood per turn
        </label>
        <input
          id="charcoal-wood"
          type="number"
          min={0}
          className="input w-28 text-right"
          value={woodInput}
          onChange={(e) => setWoodInput(e.target.value)}
        />
        <button
          type="button"
          disabled={busy}
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[12px] font-semibold text-amber-200 disabled:opacity-40"
          onClick={saveAllocation}
        >
          {busy ? 'Saving…' : 'Save allocation'}
        </button>
      </div>
    </div>
  );
};

export default ForgeFuelSection;
