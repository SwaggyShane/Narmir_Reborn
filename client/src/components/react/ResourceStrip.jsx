import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useGameState } from '../../hooks/useGameState.js';

// Tracks the previous numeric value for a key and returns a short-lived delta
// (e.g. "+150", "-50") that fades after a few seconds. Used to flash
// "changed this turn" indicators next to resource metrics so the player can
// see what just moved without reading the news log.
//
// Returns { delta, flashId } — flashId is a monotonic counter bumped on every
// new flash so callers can pass it as a React key to force the badge to
// re-mount and replay its CSS animation even when two consecutive deltas
// happen to be equal.
function useDeltaFlash(value, { duration = 2400, minStep = 1 } = {}) {
  const [flash, setFlash] = useState({ delta: null, flashId: 0 });
  const prev = useRef(value);
  const ready = useRef(false);
  const timer = useRef(null);
  const flashId = useRef(0);
  useEffect(() => {
    // Skip the first real-state transition: the store initializes with zeros
    // and the server's initial /me response can push every metric up by
    // thousands. Flashing "+5000 gold" the moment the player logs in is
    // noise, not feedback.
    if (!ready.current) {
      prev.current = value;
      ready.current = true;
      return undefined;
    }
    if (value == null || prev.current == null) {
      prev.current = value;
      return undefined;
    }
    const next = Number(value) || 0;
    const before = Number(prev.current) || 0;
    const diff = next - before;
    prev.current = next;
    if (Math.abs(diff) < minStep) return undefined;
    flashId.current += 1;
    setFlash({ delta: diff, flashId: flashId.current });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash({ delta: null, flashId: flashId.current }), duration);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, duration, minStep]);
  return flash;
}

function formatDelta(delta) {
  if (delta == null) return null;
  const sign = delta >= 0 ? '+' : '−';
  const abs = Math.abs(delta);
  if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1)}m`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`;
  return `${sign}${Math.round(abs).toLocaleString()}`;
}

function DeltaBadge({ flash }) {
  const value = flash?.delta;
  if (value == null) return null;
  const label = formatDelta(value);
  const isPositive = value >= 0;
  const colorClass = isPositive ? 'text-green' : 'text-red';
  // key={flash.flashId} forces React to remount on every new flash so the
  // `forwards`-pinned CSS animation replays even when two consecutive deltas
  // are equal.
  return (
    <span
      key={flash.flashId}
      className={clsx('pointer-events-none absolute -right-0.5 -top-1 rounded-lg bg-bg2 px-1.5 py-px text-[10px] font-bold shadow-[0_0_4px_rgba(0,0,0,0.4)] animate-delta-fade', colorClass)}
    >
      {label}
    </span>
  );
}

const HOUSING_CAP_BY_RACE = {
  dwarf: 975,
  orc: 900,
  human: 750,
  dark_elf: 675,
  high_elf: 525,
  dire_wolf: 1050,
  vampire: 600,
};

const LAND_COST = {
  bld_farms: 1,
  bld_granaries: 2,
  bld_barracks: 3,
  bld_outposts: 5,
  bld_guard_towers: 5,
  bld_armories: 5,
  bld_vaults: 10,
  bld_schools: 10,
  bld_smithies: 20,
  bld_markets: 25,
  bld_shrines: 10,
  bld_libraries: 20,
  bld_housing: 2,
  bld_mausoleums: 25,
  bld_mage_towers: 75,
  bld_training: 250,
  bld_castles: 1000,
  bld_taverns: 5,
  bld_walls: 3,
};

const FARM_WORKERS_PER = {
  human: 10,
  dwarf: 8,
  high_elf: 12,
  orc: 15,
  dark_elf: 10,
  dire_wolf: 12,
  vampire: 2,
};

const FARM_YIELD_MULT = {
  human: 1,
  dwarf: 0.9,
  high_elf: 1.15,
  orc: 0.85,
  dark_elf: 0.95,
  dire_wolf: 0.8,
  vampire: 0.9,
};

const FOOD_CONS_MULT = {
  human: 1,
  dwarf: 0.85,
  high_elf: 0.8,
  orc: 1.35,
  dark_elf: 0.95,
  dire_wolf: 1.4,
  vampire: 0.7,
};

function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseObject(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function trunc(value) {
  const n = numberValue(value);
  const abs = Math.abs(n);
  if (abs >= 1000000) return `${(n / 1000000).toFixed(abs >= 10000000 ? 0 : 1)}m`;
  if (abs >= 1000) return `${(n / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return Math.floor(n).toLocaleString();
}

function metricClass(extra = '') {
  return 'metric relative min-w-[110px] rounded-xl border border-white/5 bg-zinc-950/90 px-3 py-2 shadow-[0_12px_24px_rgba(0,0,0,0.25)] transition-transform duration-200 md:min-w-0 md:px-4 md:py-3' + (extra ? ' ' + extra : '');
}

const happinessBarOuterClass =
  'relative my-1.5 h-[18px] w-full overflow-hidden rounded bg-[var(--bg2)]';
const happinessBarInnerClass =
  'h-full rounded bg-gradient-to-r from-red-500 via-yellow-400 via-67% to-green-500 to-green-600 transition-[width] duration-300 ease-in-out';
const metricSubClass = 'flex w-full justify-between text-[11px] text-[var(--text2)]';

function population(state) {
  return numberValue(state.population ?? state.pop);
}

function housingCap(state) {
  const race = state.race || 'human';
  return numberValue(state.bld_housing) * (HOUSING_CAP_BY_RACE[race] || 500);
}

function thrallCap(state) {
  return numberValue(state.bld_mausoleums) * 100;
}

function freeLand(state) {
  const used = Object.entries(LAND_COST).reduce((sum, [key, cost]) => {
    return sum + numberValue(state[key]) * cost;
  }, 0);
  return Math.max(0, numberValue(state.land) - used);
}

function freeFarmWorkers(state) {
  if (state.race === 'vampire') return numberValue(state.thralls);
  const trained = [
    'fighters',
    'rangers',
    'clerics',
    'mages',
    'thieves',
    'ninjas',
    'researchers',
    'engineers',
    'scribes',
  ].reduce((sum, key) => sum + numberValue(state[key]), 0);
  return Math.max(0, population(state) - trained);
}

function foodBalance(state) {
  if (state.food_balance !== undefined) return numberValue(state.food_balance);
  const race = state.race || 'human';
  const workers = freeFarmWorkers(state);
  const workedFarms = Math.min(
    numberValue(state.bld_farms),
    Math.floor(workers / (FARM_WORKERS_PER[race] || 10))
  );
  const upgrades = parseObject(state.farm_upgrades);
  let upgradeMult = 1;
  if (upgrades.irrigation) upgradeMult *= 1.15;
  if (upgrades.crop_rotation) upgradeMult *= 1.25;
  if (upgrades.plantation) upgradeMult *= 1.6;
  const production = Math.floor(workedFarms * 100 * (FARM_YIELD_MULT[race] || 1) * upgradeMult);
  const consumers = [
    'fighters',
    'rangers',
    'clerics',
    'mages',
    'thieves',
    'ninjas',
    'researchers',
    'engineers',
    'scribes',
  ].reduce((sum, key) => sum + numberValue(state[key]), 0) + Math.floor(population(state) / 100);
  return production - Math.floor(consumers * (FOOD_CONS_MULT[race] || 1));
}

function happinessLabel(value) {
  if (value > 80) return 'Thriving';
  if (value > 50) return 'Happy';
  if (value > 30) return 'Content';
  return 'Unhappy';
}

const ResourceStrip = () => {
  const { state } = useGameState();
  const pop = population(state);
  const popCap = housingCap(state);
  const isVampire = state.race === 'vampire';
  const thralls = numberValue(state.thralls);
  const maxThralls = thrallCap(state);
  const happiness = numberValue(state.happiness, 50);
  const happinessPercent = Math.min(100, Math.max(0, (happiness / 120) * 100));
  const foodDelta = foodBalance(state);
  const defenseRating = state.defense_rating || 'Undefended';
  const defenseColor = String(defenseRating).toLowerCase().includes('undefended') ? 'var(--red)' : 'var(--gold)';

  const goldFlash = useDeltaFlash(state.gold);
  const manaFlash = useDeltaFlash(state.mana);
  const landFlash = useDeltaFlash(state.land);
  const popFlash = useDeltaFlash(pop);
  const thrallFlash = useDeltaFlash(thralls);
  const foodFlash = useDeltaFlash(state.food, { minStep: 10 });

  return (
    <>
      <div className={metricClass()} id="metric-gold">
        <DeltaBadge flash={goldFlash} />
        <div className="lbl">Gold</div>
        <div className={`val ${numberValue(state.gold) < 1000 ? 'text-[var(--red)]' : ''}`} id="m-gold">
          {trunc(state.gold)}
        </div>
        <div className="sub" id="m-gold-sub">
          {numberValue(state.gold_income) >= 0 ? '+' : ''}{trunc(state.gold_income || 0)}/turn
        </div>
      </div>
      <div className={metricClass()} id="metric-mana">
        <DeltaBadge flash={manaFlash} />
        <div className="lbl">Mana</div>
        <div className="val" id="m-mana">{trunc(state.mana)}</div>
        <div className="sub" id="m-mana-sub">
          {numberValue(state.mana_regen) >= 0 ? '+' : ''}{trunc(state.mana_regen || 0)}/turn
        </div>
      </div>
      <div className={metricClass()} id="metric-land">
        <DeltaBadge flash={landFlash} />
        <div className="lbl">Land</div>
        <div className="val" id="m-land">{trunc(state.land)}</div>
        <div className="sub"><span id="m-land-free">{trunc(freeLand(state))}</span> free</div>
      </div>
      <div className={metricClass()} id="metric-pop">
        <DeltaBadge flash={popFlash} />
        <div className="lbl">Population</div>
        <div className="val" id="m-pop">{trunc(pop)}</div>
        <div className="sub">
          cap: <span id="m-pop-cap" className={pop > popCap && popCap > 0 ? 'text-[var(--red)]' : ''}>{trunc(popCap)}</span>
        </div>
      </div>
      {isVampire && (
        <div className={metricClass()} id="metric-thralls">
          <DeltaBadge flash={thrallFlash} />
          <div className="lbl">Thralls</div>
          <div className="val" id="m-thralls">{trunc(thralls)}</div>
          <div className="sub">
            cap: <span id="m-thralls-cap" className={thralls > maxThralls ? 'text-[var(--red)]' : ''}>{trunc(maxThralls)}</span>
          </div>
        </div>
      )}
      <div className={metricClass('overflow-hidden')} id="metric-happiness">
        <div className="lbl">Happiness</div>
        <div className={happinessBarOuterClass} title="Population happiness">
          <div
            id="m-happiness-bar"
            className={happinessBarInnerClass}
            style={{ width: `${happinessPercent}%` }}
          />
        </div>
        <div className={metricSubClass}>
          <span id="m-happiness-breakdown">{happinessLabel(happiness)}</span>
        </div>
      </div>
      <div className={metricClass()} id="metric-food">
        <DeltaBadge flash={foodFlash} />
        <div className="lbl">Food</div>
        <div className={`val ${numberValue(state.food) < 1000 ? 'text-[var(--red)]' : ''}`} id="m-food">
          {trunc(state.food)}
        </div>
        <div className="sub">
          <span id="m-food-balance" className={`font-semibold ${foodDelta >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
            {foodDelta >= 0 ? '+' : ''}{trunc(foodDelta)}
          </span>/turn
        </div>
      </div>
      <div className={metricClass()} id="metric-defense">
        <div className="lbl">Defense</div>
        <div className="val text-[11px]" id="m-defense-rating" style={{ color: defenseColor }}>
          {defenseRating}
        </div>
        <div className="sub"><span id="m-walls">{numberValue(state.bld_walls).toLocaleString()}</span> walls</div>
      </div>
    </>
  );
};

export default ResourceStrip;
