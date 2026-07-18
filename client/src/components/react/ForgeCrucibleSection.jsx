/**
 * Forge Crucible section
 * Lava stock, temper, tempered gear; shared lava-draw hex launch flow.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { apiCall } from '../../utils/api.mjs';
import { fmt } from '../../utils/fmt';
import { toast } from '../../utils/toast.js';
import HexSelectionModal from './HexSelectionModal.jsx';
import { clientLavaDrawGates, submitLavaDraw } from '../../utils/lavaDrawLaunch.js';
import {
  useGold,
  useSteel,
  useEconomyStore,
  useEngineerLevel,
  useEngineers,
  useMages,
  useTroopLevels,
  useRace,
} from '../../stores';

const TEMPER = { steel: 1, lava: 2 };
const TEMPERED_WEAPONS = { tempered_steel: 3, gold: 25000 };
const TEMPERED_ARMOR = { tempered_steel: 3, gold: 30000 };

// Mirrors game/config.js TEMPERED_STEEL_NAMES — server is canonical.
const TEMPERED_STEEL_NAMES = {
  high_elf: 'Runesteel',
  dwarf: 'Stonesteel',
  human: 'Crownsteel',
  dire_wolf: 'Rimesteel',
  vampire: 'Cruorsteel',
  ogre: 'Slagmetal',
  wood_elf: 'Briersteel',
  orc: 'Killsteel',
  dark_elf: 'Vipersteel',
};

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

function mageLevelFromTroops(troopLevels) {
  const entry = troopLevels?.mages;
  if (entry == null) return 1;
  if (typeof entry === 'number') return entry;
  return Number(entry.level) || 1;
}

const ForgeCrucibleSection = () => {
  const gold = useGold();
  const steel = useSteel();
  const lava = useEconomyStore((s) => Number(s.lava_stored || 0));
  const tempered = useEconomyStore((s) => Number(s.tempered_steel || 0));
  const temperedWeapons = useEconomyStore((s) => Number(s.tempered_weapons || 0));
  const temperedArmor = useEconomyStore((s) => Number(s.tempered_armor || 0));
  const forge = useEconomyStore((s) => !!s.forge);
  const fluxBarges = useEconomyStore((s) => s.flux_barges);

  const engineerLevel = Number(useEngineerLevel() || 1);
  const engineers = Number(useEngineers() || 0);
  const mages = Number(useMages() || 0);
  const troopLevels = useTroopLevels();
  const mageLevel = mageLevelFromTroops(troopLevels);
  const race = useRace();
  const temperedName = TEMPERED_STEEL_NAMES[race] || 'Tempered steel';

  const barges = useMemo(() => normalizeBarges(fluxBarges), [fluxBarges]);
  const idleBarges = useMemo(
    () => barges.filter((b) => b.status === 'idle' && (Number(b.integrity) || 0) > 0),
    [barges],
  );

  const [temperBatches, setTemperBatches] = useState('1');
  const [gearQty, setGearQty] = useState('1');
  const [bargeId, setBargeId] = useState(() => idleBarges[0]?.id ?? '');
  const [hexModalOpen, setHexModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const showTemperedGear = tempered > 0 || temperedWeapons > 0 || temperedArmor > 0;

  const applySnapshot = (partial) => {
    useEconomyStore.getState().receiveServerSnapshot(partial);
  };

  const doTemper = async () => {
    const n = Math.max(1, Math.floor(Number(temperBatches) || 0));
    setBusy(true);
    try {
      const result = await apiCall('/api/kingdom/forge/temper', {
        method: 'POST',
        body: { batches: n },
      });
      if (result?.error) {
        toast(result.error, 'error');
        return;
      }
      applySnapshot({
        steel:
          result.steel !== undefined
            ? result.steel
            : Math.max(0, steel - TEMPER.steel * n),
        lava_stored:
          result.lava_stored !== undefined
            ? result.lava_stored
            : Math.max(0, lava - TEMPER.lava * n),
        tempered_steel:
          result.tempered_steel !== undefined
            ? result.tempered_steel
            : tempered + (result.temperedOut || n),
      });
      const name = result.displayName || temperedName;
      toast(
        result.temperedOut != null
          ? `Tempered ${result.temperedOut} ${name}`
          : `Tempered ${name}`,
        'success',
      );
    } catch (e) {
      toast(e?.message || 'Temper failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const craftTempered = async (type) => {
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
      const cost = type === 'tempered_weapons' ? TEMPERED_WEAPONS : TEMPERED_ARMOR;
      applySnapshot({
        gold: result.gold !== undefined ? result.gold : Math.max(0, gold - cost.gold * q),
        tempered_steel:
          result.tempered_steel !== undefined
            ? result.tempered_steel
            : Math.max(0, tempered - cost.tempered_steel * q),
        [type]:
          result.stock !== undefined
            ? result.stock
            : (type === 'tempered_weapons' ? temperedWeapons : temperedArmor) + q,
      });
      toast(`Crafted ${q} ${type.replace(/_/g, ' ')}`, 'success');
    } catch (e) {
      toast(e?.message || 'Craft failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const openLavaDrawModal = () => {
    const gate = clientLavaDrawGates({
      forge,
      engineerLevel,
      mageLevel,
      engineersAvailable: engineers,
      magesAvailable: mages,
      barges,
      bargeId,
    });
    if (!gate.ok) {
      toast(gate.reason, 'error');
      return;
    }
    setHexModalOpen(true);
  };

  const handleHexSelected = useCallback(
    async (hex) => {
      setHexModalOpen(false);
      const gate = clientLavaDrawGates({
        forge,
        engineerLevel,
        mageLevel,
        engineersAvailable: engineers,
        magesAvailable: mages,
        barges,
        bargeId,
      });
      if (!gate.ok) {
        toast(gate.reason, 'error');
        return;
      }
      setBusy(true);
      try {
        const result = await submitLavaDraw({
          target_x: hex.x,
          target_y: hex.y,
          barge_id: bargeId,
        });
        if (result?.error) {
          toast(result.error, 'error');
          return;
        }
        if (result.flux_barges) {
          applySnapshot({ flux_barges: result.flux_barges });
        }
        toast(
          result.message ||
            `Lava draw launched toward (${hex.x}, ${hex.y})`,
          'success',
        );
      } catch (e) {
        toast(e?.message || 'Lava draw failed', 'error');
      } finally {
        setBusy(false);
      }
    },
    [forge, engineerLevel, mageLevel, engineers, mages, barges, bargeId],
  );

  return (
    <div
      className="rounded-xl border border-white/10 bg-bg3/80 p-4 space-y-4"
      data-testid="forge-crucible-section"
    >
      <div className="text-[13px] font-semibold text-text">🌋 Crucible — Lava & temper</div>
      <div className="flex flex-wrap gap-4 text-[12px]">
        <span>
          Lava: <strong className="text-orange-300">{fmt(lava)}</strong>
        </span>
        <span>
          Steel: <strong className="text-amber-200">{fmt(steel)}</strong>
        </span>
        <span>
          {temperedName}: <strong className="text-text">{fmt(tempered)}</strong>
        </span>
        {showTemperedGear && (
          <>
            <span>
              T. weapons: <strong className="text-text">{fmt(temperedWeapons)}</strong>
            </span>
            <span>
              T. armor: <strong className="text-text">{fmt(temperedArmor)}</strong>
            </span>
          </>
        )}
      </div>
      <div className="text-[11px] text-text3">
        Gates (client mirror): eng Lv{engineerLevel}/50 · mage Lv{mageLevel}/25 · eng{' '}
        {engineers}/25 · mages {mages}/5
      </div>

      {/* Temper */}
      <div className="space-y-2 border-t border-white/5 pt-3">
        <div className="text-[12px] text-text2 font-semibold">Temper</div>
        <div className="text-[11px] text-text3">
          {TEMPER.steel} steel + {TEMPER.lava} lava → tempered steel (eng level 50+)
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[12px] text-text3" htmlFor="temper-batches">
            Batches
          </label>
          <input
            id="temper-batches"
            type="number"
            min={1}
            className="input w-20 text-right"
            value={temperBatches}
            onChange={(e) => setTemperBatches(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || engineerLevel < 50}
            className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-[12px] font-semibold text-orange-200 disabled:opacity-40"
            onClick={doTemper}
          >
            {busy ? 'Working…' : 'Temper'}
          </button>
        </div>
      </div>

      {/* Tempered gear — hide until first tempered metal/gear attained */}
      {showTemperedGear && (
        <div className="space-y-2 border-t border-white/5 pt-3">
          <div className="text-[12px] text-text2 font-semibold">{temperedName} gear</div>
          <div className="text-[11px] text-text3">
            Weapons: {TEMPERED_WEAPONS.tempered_steel} tempered + {fmt(TEMPERED_WEAPONS.gold)} gold
            · Armor: {TEMPERED_ARMOR.tempered_steel} tempered + {fmt(TEMPERED_ARMOR.gold)} gold
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[12px] text-text3" htmlFor="tempered-gear-qty">
              Qty
            </label>
            <input
              id="tempered-gear-qty"
              type="number"
              min={1}
              className="input w-20 text-right"
              value={gearQty}
              onChange={(e) => setGearQty(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || engineerLevel < 50}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-[12px] font-semibold text-text disabled:opacity-40"
              onClick={() => craftTempered('tempered_weapons')}
            >
              Craft weapons
            </button>
            <button
              type="button"
              disabled={busy || engineerLevel < 50}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-[12px] font-semibold text-text disabled:opacity-40"
              onClick={() => craftTempered('tempered_armor')}
            >
              Craft armor
            </button>
          </div>
        </div>
      )}

      {/* Lava draw — shared map flow */}
      <div className="space-y-2 border-t border-white/5 pt-3">
        <div className="text-[12px] text-text2 font-semibold">Lava draw</div>
        <div className="text-[11px] text-text3">
          Pick an idle barge, then choose a volcanic hex on the map (same modal as Epic Trek).
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[12px] text-text3" htmlFor="lava-barge">
            Barge
          </label>
          <select
            id="lava-barge"
            className="input min-w-[10rem] text-[12px]"
            value={bargeId}
            onChange={(e) => setBargeId(e.target.value === '' ? '' : Number(e.target.value))}
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
            disabled={busy || idleBarges.length === 0}
            className="rounded-lg border border-orange-500/50 bg-orange-500/15 px-3 py-1.5 text-[12px] font-semibold text-orange-100 disabled:opacity-40"
            onClick={openLavaDrawModal}
          >
            {busy ? 'Launching…' : 'Choose vent on map'}
          </button>
        </div>
      </div>

      {hexModalOpen && (
        <HexSelectionModal
          isOpen={hexModalOpen}
          context={{ type: 'lava_draw' }}
          onHexSelected={handleHexSelected}
          onClose={() => setHexModalOpen(false)}
        />
      )}
    </div>
  );
};

export default ForgeCrucibleSection;

// Re-export shared launch for B6 volcanic hex card
export { submitLavaDraw, clientLavaDrawGates } from '../../utils/lavaDrawLaunch.js';
