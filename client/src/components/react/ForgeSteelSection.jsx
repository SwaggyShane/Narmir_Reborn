/**
 * Forge Steel section — FORGE_SYSTEM.md §15.3 B3
 * Smelt (iron+coal→steel) and steel gear craft. Uses coal/steel columns.
 */
import React, { useState } from 'react';
import { apiCall } from '../../utils/api.mjs';
import { fmt } from '../../utils/fmt';
import { toast } from '../../utils/toast.js';
import {
  useGold,
  useIron,
  useCoal,
  useSteel,
  useEconomyStore,
} from '../../stores';

const SMELT = { iron: 20, coal: 10 };
const STEEL_WEAPONS = { steel: 5, gold: 10000 };
const STEEL_ARMOR = { steel: 5, gold: 12000 };

const ForgeSteelSection = () => {
  const gold = useGold();
  const iron = useIron();
  const coal = useCoal();
  const steel = useSteel();
  const steelWeapons = useEconomyStore((s) => Number(s.steel_weapons || 0));
  const steelArmor = useEconomyStore((s) => Number(s.steel_armor || 0));

  const [batches, setBatches] = useState('1');
  const [gearQty, setGearQty] = useState('1');
  const [busy, setBusy] = useState(false);

  const applySnapshot = (partial) => {
    useEconomyStore.getState().receiveServerSnapshot(partial);
  };

  const doSmelt = async () => {
    const n = Math.max(1, Math.floor(Number(batches) || 0));
    setBusy(true);
    try {
      const result = await apiCall('/api/kingdom/forge/smelt', {
        method: 'POST',
        body: { batches: n },
      });
      if (result?.error) {
        toast(result.error, 'error');
        return;
      }
      applySnapshot({
        iron: result.iron !== undefined ? result.iron : iron - SMELT.iron * n,
        coal: result.coal !== undefined ? result.coal : coal,
        steel: result.steel !== undefined ? result.steel : steel,
      });
      toast(
        result.steelOut != null
          ? `Smelted ${result.steelOut} steel`
          : 'Smelt complete',
        'success',
      );
    } catch (e) {
      toast(e?.message || 'Smelt failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const craftGear = async (type) => {
    const q = Math.max(1, Math.floor(Number(gearQty) || 0));
    setBusy(true);
    try {
      const result = await apiCall('/api/kingdom/forge/craft-gear', {
        method: 'POST',
        body: { type, qty: q },
      });
      if (result?.error) {
        toast(result.error, 'error');
        return;
      }
      const cost = type === 'steel_weapons' ? STEEL_WEAPONS : STEEL_ARMOR;
      applySnapshot({
        gold: result.gold !== undefined ? result.gold : Math.max(0, gold - cost.gold * q),
        steel:
          result.steel !== undefined
            ? result.steel
            : Math.max(0, steel - cost.steel * q),
        [type]:
          result.stock !== undefined
            ? result.stock
            : (type === 'steel_weapons' ? steelWeapons : steelArmor) + q,
      });
      toast(`Crafted ${q} ${type.replace(/_/g, ' ')}`, 'success');
    } catch (e) {
      toast(e?.message || 'Craft failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-bg3/80 p-4 space-y-4" data-testid="forge-steel-section">
      <div className="text-[13px] font-semibold text-text">⚙️ Steel — Smelt & gear</div>
      <div className="flex flex-wrap gap-4 text-[12px]">
        <span>
          Iron: <strong className="text-text">{fmt(iron)}</strong>
        </span>
        <span>
          Coal: <strong className="text-text">{fmt(coal)}</strong>
        </span>
        <span>
          Steel: <strong className="text-amber-200">{fmt(steel)}</strong>
        </span>
        <span>
          Steel weapons: <strong className="text-text">{fmt(steelWeapons)}</strong>
        </span>
        <span>
          Steel armor: <strong className="text-text">{fmt(steelArmor)}</strong>
        </span>
      </div>

      <div className="space-y-2 border-t border-white/5 pt-3">
        <div className="text-[12px] text-text2 font-semibold">Smelt</div>
        <div className="text-[11px] text-text3">
          {SMELT.iron} iron + {SMELT.coal} coal → 1 steel per batch (race mult on output)
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[12px] text-text3" htmlFor="smelt-batches">
            Batches
          </label>
          <input
            id="smelt-batches"
            type="number"
            min={1}
            className="input w-20 text-right"
            value={batches}
            onChange={(e) => setBatches(e.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[12px] font-semibold text-amber-200 disabled:opacity-40"
            onClick={doSmelt}
          >
            {busy ? 'Working…' : 'Smelt'}
          </button>
        </div>
      </div>

      <div className="space-y-2 border-t border-white/5 pt-3">
        <div className="text-[12px] text-text2 font-semibold">Steel gear</div>
        <div className="text-[11px] text-text3">
          Weapons: {STEEL_WEAPONS.steel} steel + {fmt(STEEL_WEAPONS.gold)} gold · Armor:{' '}
          {STEEL_ARMOR.steel} steel + {fmt(STEEL_ARMOR.gold)} gold
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[12px] text-text3" htmlFor="gear-qty">
            Qty
          </label>
          <input
            id="gear-qty"
            type="number"
            min={1}
            className="input w-20 text-right"
            value={gearQty}
            onChange={(e) => setGearQty(e.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-[12px] font-semibold text-text disabled:opacity-40"
            onClick={() => craftGear('steel_weapons')}
          >
            Craft weapons
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-[12px] font-semibold text-text disabled:opacity-40"
            onClick={() => craftGear('steel_armor')}
          >
            Craft armor
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgeSteelSection;
