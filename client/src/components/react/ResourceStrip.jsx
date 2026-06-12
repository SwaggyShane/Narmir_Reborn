import React, { useEffect, useRef, useState } from 'react';
import { useGameState } from '../../hooks/useGameState.js';

// Tracks the previous numeric value for a key and returns a short-lived delta
// string (e.g. "+150", "-50") that fades after a few seconds. Used to flash
// "changed this turn" indicators next to resource metrics so the player can
// see what just moved without reading the news log.
function useDeltaFlash(value, { duration = 2400, minStep = 1 } = {}) {
  const [delta, setDelta] = useState(null);
  const prev = useRef(value);
  const timer = useRef(null);
  useEffect(() => {
    const next = Number(value) || 0;
    const before = Number(prev.current) || 0;
    const diff = next - before;
    prev.current = next;
    if (Math.abs(diff) < minStep) return undefined;
    setDelta(diff);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDelta(null), duration);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, duration, minStep]);
  return delta;
}

function formatDelta(delta) {
  if (delta == null) return null;
  const sign = delta >= 0 ? '+' : '−';
  const abs = Math.abs(delta);
  if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1)}m`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`;
  return `${sign}${Math.round(abs).toLocaleString()}`;
}

function DeltaBadge({ value, color }) {
  if (value == null) return null;
  const label = formatDelta(value);
  const tone = color || (value >= 0 ? 'var(--green)' : 'var(--red)');
  return (
    <span
      style={{
        position: 'absolute',
        top: '-4px',
        right: '-2px',
        fontSize: '10px',
        fontWeight: 700,
        color: tone,
        background: 'var(--bg2)',
        padding: '1px 5px',
        borderRadius: '8px',
        boxShadow: '0 0 4px rgba(0,0,0,0.4)',
        pointerEvents: 'none',
        animation: 'rs-delta-fade 2.4s ease-out forwards',
      }}
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
  return `metric${extra ? ` ${extra}` : ''}`;
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

  const goldDelta = useDeltaFlash(state.gold);
  const manaDelta = useDeltaFlash(state.mana);
  const landDelta = useDeltaFlash(state.land);
  const popDelta = useDeltaFlash(pop);
  const thrallDelta = useDeltaFlash(thralls);
  const foodStoredDelta = useDeltaFlash(state.food, { minStep: 10 });

  return (
    <>
      <div className="metric" id="metric-gold" style={{ position: 'relative' }}>
        <DeltaBadge value={goldDelta} />
        <div className="lbl">Gold</div>
        <div className="val" id="m-gold" style={{ color: numberValue(state.gold) < 1000 ? 'var(--red)' : undefined }}>
          {trunc(state.gold)}
        </div>
        <div className="sub" id="m-gold-sub">
          {numberValue(state.gold_income) >= 0 ? '+' : ''}{trunc(state.gold_income || 0)}/turn
        </div>
      </div>
      <div className="metric" id="metric-mana" style={{ position: 'relative' }}>
        <DeltaBadge value={manaDelta} />
        <div className="lbl">Mana</div>
        <div className="val" id="m-mana">{trunc(state.mana)}</div>
        <div className="sub" id="m-mana-sub">
          {numberValue(state.mana_regen) >= 0 ? '+' : ''}{trunc(state.mana_regen || 0)}/turn
        </div>
      </div>
      <div className="metric" id="metric-land" style={{ position: 'relative' }}>
        <DeltaBadge value={landDelta} />
        <div className="lbl">Land</div>
        <div className="val" id="m-land">{trunc(state.land)}</div>
        <div className="sub"><span id="m-land-free">{trunc(freeLand(state))}</span> free</div>
      </div>
      <div className="metric" id="metric-pop" style={{ position: 'relative' }}>
        <DeltaBadge value={popDelta} />
        <div className="lbl">Population</div>
        <div className="val" id="m-pop">{trunc(pop)}</div>
        <div className="sub">
          cap: <span id="m-pop-cap" style={{ color: pop > popCap && popCap > 0 ? 'var(--red)' : undefined }}>{trunc(popCap)}</span>
        </div>
      </div>
      {isVampire && (
        <div className="metric" id="metric-thralls" style={{ position: 'relative' }}>
          <DeltaBadge value={thrallDelta} />
          <div className="lbl">Thralls</div>
          <div className="val" id="m-thralls">{trunc(thralls)}</div>
          <div className="sub">
            cap: <span id="m-thralls-cap" style={{ color: thralls > maxThralls ? 'var(--red)' : undefined }}>{trunc(maxThralls)}</span>
          </div>
        </div>
      )}
      <div className={metricClass()} id="metric-happiness">
        <div className="lbl">Happiness</div>
        <div style={{ position: 'relative', width: '100%', height: '18px', margin: '6px 0', background: 'var(--bg2)', borderRadius: '4px', overflow: 'hidden' }} title="Population happiness">
          <div
            id="m-happiness-bar"
            style={{
              height: '100%',
              width: `${happinessPercent}%`,
              background: 'linear-gradient(90deg, #ef4444 0%, #fbbf24 41.67%, #4ade80 66.67%, #22c55e 100%)',
              transition: 'width 0.3s ease',
              borderRadius: '4px',
            }}
          />
        </div>
        <div className="sub" style={{ fontSize: '11px', color: 'var(--text2)', display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <span id="m-happiness-breakdown">{happinessLabel(happiness)}</span>
        </div>
      </div>
      <div className="metric" id="metric-food" style={{ position: 'relative' }}>
        <DeltaBadge value={foodStoredDelta} />
        <div className="lbl">Food</div>
        <div className="val" id="m-food" style={{ color: numberValue(state.food) < 1000 ? 'var(--red)' : undefined }}>
          {trunc(state.food)}
        </div>
        <div className="sub">
          <span id="m-food-balance" style={{ fontWeight: 600, color: foodDelta >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {foodDelta >= 0 ? '+' : ''}{trunc(foodDelta)}
          </span>/turn
        </div>
      </div>
      <div className="metric" id="metric-defense">
        <div className="lbl">Defense</div>
        <div className="val" id="m-defense-rating" style={{ fontSize: '11px', color: defenseColor }}>
          {defenseRating}
        </div>
        <div className="sub"><span id="m-walls">{numberValue(state.bld_walls).toLocaleString()}</span> walls</div>
      </div>
    </>
  );
};

export default ResourceStrip;
