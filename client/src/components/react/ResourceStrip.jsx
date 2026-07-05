import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { switchTab } from '../../utils/switchTab.js';
import { FARM_WORKERS_PER } from '../../utils/economyConstants.js';
import {
  useRace,
  usePopulation,
  useGold,
  useMana,
  useLand,
  useFood,
  useGoldIncome,
  useManaRegen,
  useFoodBalance,
  useDefenseRating,
  useThralls,
  useHappiness,
  useBuildingCounts,
  useFighters,
  useRangers,
  useClerics,
  useMages,
  useThieves,
  useNinjas,
  useResearchers,
  useEngineers,
  useScribes,
} from '../../stores';

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
  if (abs >= 1000000000000) return `${sign}${(abs / 1000000000000).toFixed(1)}t`;
  if (abs >= 1000000000) return `${sign}${(abs / 1000000000).toFixed(1)}b`;
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
      className={clsx('metric-delta', colorClass)}
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
  if (abs >= 1000000000000) return `${(n / 1000000000000).toFixed(abs >= 10000000000000 ? 0 : 1)}t`;
  if (abs >= 1000000000) return `${(n / 1000000000).toFixed(abs >= 10000000000 ? 0 : 1)}b`;
  if (abs >= 1000000) return `${(n / 1000000).toFixed(abs >= 10000000 ? 0 : 1)}m`;
  if (abs >= 1000) return `${(n / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return Math.floor(n).toLocaleString();
}

const METRIC_TARGETS = {
  gold: 'economy',
  mana: 'studies',
  land: 'build',
  population: 'status',
  thralls: 'status',
  happiness: 'happiness',
  food: 'economy',
  defense: 'defense',
};

function MetricBox({ metricKey, className, title, children }) {
  const target = METRIC_TARGETS[metricKey];
  return (
    <button
      type="button"
      className={clsx('metric relative metric-clickable', className)}
      onClick={() => target && switchTab(target)}
      title={title || (target ? `Open ${target}` : undefined)}
      disabled={!target}
    >
      {children}
    </button>
  );
}

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
  const race = useRace();
  const pop = usePopulation();
  const buildingCounts = useBuildingCounts();
  const popCap = housingCap({
    race,
    bld_housing: buildingCounts.housing,
  });
  const isVampire = race === 'vampire';
  const thralls = useThralls();
  const maxThralls = thrallCap({
    bld_mausoleums: buildingCounts.mausoleums,
  });
  const happiness = useHappiness();
  const happinessPercent = Math.min(100, Math.max(0, (happiness / 120) * 100));
  const gold = useGold();
  const mana = useMana();
  const land = useLand();
  const food = useFood();
  const foodDelta = useFoodBalance();
  const defenseRating = useDefenseRating();
  const defenseColorClass = String(defenseRating).toLowerCase().includes('undefended') ? '!text-[var(--red)]' : '!text-[var(--gold)]';

  const goldIncome = useGoldIncome();
  const manaRegen = useManaRegen();
  const goldFlash = useDeltaFlash(gold);
  const manaFlash = useDeltaFlash(mana);
  const landFlash = useDeltaFlash(land);
  const popFlash = useDeltaFlash(pop);
  const thrallFlash = useDeltaFlash(thralls);
  const foodFlash = useDeltaFlash(food, { minStep: 10 });

  const goldLow = numberValue(gold) < 1000;
  const foodLow = numberValue(food) < 1000;
  const state = {
    race,
    population: pop,
    pop,
    thralls,
    happiness,
    gold,
    mana,
    land,
    food,
    gold_income: goldIncome,
    mana_regen: manaRegen,
    food_balance: foodDelta,
    defense_rating: defenseRating,
    bld_housing: buildingCounts.housing,
    bld_mausoleums: buildingCounts.mausoleums,
    bld_farms: buildingCounts.farms,
    bld_granaries: buildingCounts.granaries,
    bld_barracks: buildingCounts.barracks,
    bld_outposts: buildingCounts.outposts,
    bld_guard_towers: buildingCounts.guard_towers,
    bld_armories: buildingCounts.armories,
    bld_vaults: buildingCounts.vaults,
    bld_schools: buildingCounts.schools,
    bld_smithies: buildingCounts.smithies,
    bld_markets: buildingCounts.markets,
    bld_shrines: buildingCounts.shrines,
    bld_libraries: buildingCounts.libraries,
    bld_mage_towers: buildingCounts.mage_towers,
    bld_training: buildingCounts.training,
    bld_castles: buildingCounts.castles,
    bld_taverns: buildingCounts.taverns,
    bld_walls: buildingCounts.walls,
    fighters: useFighters(),
    rangers: useRangers(),
    clerics: useClerics(),
    mages: useMages(),
    thieves: useThieves(),
    ninjas: useNinjas(),
    researchers: useResearchers(),
    engineers: useEngineers(),
    scribes: useScribes(),
  };

  return (
    <>
      <MetricBox metricKey="gold" className={goldLow ? 'alert' : ''} title="Open Economy">
        <DeltaBadge flash={goldFlash} />
        <div className="lbl">Gold</div>
        <div className={`val ${goldLow ? 'text-[var(--red)]' : ''}`}>{trunc(gold)}</div>
        <div className="sub">
          {numberValue(goldIncome) >= 0 ? '+' : ''}{trunc(goldIncome || 0)}/turn
        </div>
      </MetricBox>
      <MetricBox metricKey="mana" title="Open Studies">
        <DeltaBadge flash={manaFlash} />
        <div className="lbl">Mana</div>
        <div className="val">{trunc(mana)}</div>
        <div className="sub">
          {numberValue(manaRegen) >= 0 ? '+' : ''}{trunc(manaRegen || 0)}/turn
        </div>
      </MetricBox>
      <MetricBox metricKey="land" title="Open Build">
        <DeltaBadge flash={landFlash} />
        <div className="lbl">Land</div>
        <div className="val">{trunc(land)}</div>
        <div className="sub"><span>{trunc(freeLand(state))}</span> free</div>
      </MetricBox>
      <MetricBox metricKey="population" title="Open Status">
        <DeltaBadge flash={popFlash} />
        <div className="lbl">Population</div>
        <div className="val">{trunc(pop)}</div>
        <div className="sub">
          cap: <span className={pop > popCap && popCap > 0 ? 'text-[var(--red)]' : ''}>{trunc(popCap)}</span>
        </div>
      </MetricBox>
      {isVampire && (
        <MetricBox metricKey="thralls" title="Open Status">
          <DeltaBadge flash={thrallFlash} />
          <div className="lbl">Thralls</div>
          <div className="val">{trunc(thralls)}</div>
          <div className="sub">
            cap: <span className={thralls > maxThralls ? 'text-[var(--red)]' : ''}>{trunc(maxThralls)}</span>
          </div>
        </MetricBox>
      )}
      <MetricBox metricKey="happiness" className="metric-happiness overflow-hidden" title="Open Happiness">
        <div className="lbl">Happiness</div>
        <div className="metric-happiness-center">
          <div className="metric-happiness-track" title="Population happiness">
            <div
              className="metric-happiness-mask"
              style={{ width: `${100 - happinessPercent}%` }}
              aria-hidden="true"
            />
          </div>
          <div className="sub">
            <span>{happinessLabel(happiness)}</span>
          </div>
        </div>
      </MetricBox>
      <MetricBox metricKey="food" className={foodLow ? 'alert' : ''} title="Open Economy">
        <DeltaBadge flash={foodFlash} />
        <div className="lbl">Food</div>
        <div className={`val ${foodLow ? 'text-[var(--red)]' : ''}`}>{trunc(food)}</div>
        <div className="sub">
          <span className={`font-semibold ${foodDelta >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
            {foodDelta >= 0 ? '+' : ''}{trunc(foodDelta)}
          </span>/turn
        </div>
      </MetricBox>
      <MetricBox metricKey="defense" title="Open Defense">
        <div className="lbl">Defense</div>
        <div className={clsx('val', defenseColorClass)}>{defenseRating}</div>
        <div className="sub"><span>{numberValue(buildingCounts.walls).toLocaleString()}</span> walls</div>
      </MetricBox>
    </>
  );
};

export default ResourceStrip;
