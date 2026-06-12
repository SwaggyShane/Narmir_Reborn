import React from 'react';
import { useGameMetrics } from '../../hooks/useGameState';

const HOUSING_CAP_BY_RACE = {
  dwarf: 975,
  orc: 900,
  human: 750,
  dark_elf: 675,
  high_elf: 525,
  dire_wolf: 1050,
  vampire: 600,
};

function trunc(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(Math.floor(n));
}

function fmt(n) {
  return Math.floor(n).toLocaleString();
}

const MetricsStrip = () => {
  const { metrics } = useGameMetrics();

  const {
    gold = 0,
    gold_income = 0,
    mana = 0,
    mana_regen = 0,
    land = 0,
    population = 0,
    happiness = 50,
    food = 0,
    food_balance = 0,
    defense_rating = 0,
    bld_walls = 0,
    thralls = 0,
    race = '',
  } = metrics;

  const isVampire = race === 'vampire';
  const capPerBuilding = HOUSING_CAP_BY_RACE[race] || 500;
  const popCap = (metrics.bld_housing || 0) * capPerBuilding;
  const thrallCap = (metrics.bld_mausoleums || 0) * 100;

  // Compute land used from all building columns
  const LAND_COST = {
    bld_farms: 1, bld_granaries: 2, bld_barracks: 3, bld_outposts: 5,
    bld_guard_towers: 5, bld_armories: 5, bld_vaults: 10, bld_schools: 10,
    bld_smithies: 20, bld_markets: 25, bld_shrines: 10, bld_libraries: 20,
    bld_housing: 2, bld_mausoleums: 25, bld_mage_towers: 75, bld_training: 250,
    bld_castles: 1000, bld_taverns: 5, bld_walls: 3,
  };
  const landUsed = Object.entries(LAND_COST).reduce((sum, [k, cost]) => {
    return sum + (metrics[k] || 0) * cost;
  }, 0);
  const freeLand = Math.max(0, land - landUsed);

  const happinessPercent = Math.max(0, Math.min(100, (happiness / 120) * 100));
  const happinessLabel =
    happiness > 80 ? '🎉 Thriving' :
    happiness > 50 ? '😊 Happy' :
    happiness > 30 ? '😐 Content' : '😞 Unhappy';

  return (
    <div className="metrics">
      <div className="metric" id="metric-gold">
        <div className="lbl">Gold</div>
        <div className="val" style={{ color: gold < 1000 ? 'var(--red)' : '' }}>{trunc(gold)}</div>
        <div className="sub" style={{ color: gold_income >= 0 ? 'var(--green)' : 'var(--red)' }}>
          {gold_income >= 0 ? '+' : ''}{fmt(gold_income)}/turn
        </div>
      </div>
      <div className="metric" id="metric-mana">
        <div className="lbl">Mana</div>
        <div className="val">{trunc(mana)}</div>
        <div className="sub">+{fmt(mana_regen)}/turn</div>
      </div>
      <div className="metric" id="metric-land">
        <div className="lbl">Land</div>
        <div className="val">{trunc(land)}</div>
        <div className="sub">{trunc(freeLand)} free</div>
      </div>
      <div className="metric" id="metric-pop">
        <div className="lbl">Population</div>
        <div className="val">{trunc(population)}</div>
        <div className="sub">
          cap: <span style={{ color: population > popCap && popCap > 0 ? 'var(--red)' : '' }}>{trunc(popCap)}</span>
        </div>
      </div>
      {isVampire && (
        <div className="metric" id="metric-thralls">
          <div className="lbl">Thralls</div>
          <div className="val">{trunc(thralls)}</div>
          <div className="sub">
            cap: <span style={{ color: thralls > thrallCap ? 'var(--red)' : '' }}>{trunc(thrallCap)}</span>
          </div>
        </div>
      )}
      <div className="metric" id="metric-happiness">
        <div className="lbl">Happiness</div>
        <div style={{ position: 'relative', width: '100%', height: '18px', margin: '6px 0', background: 'var(--bg2)', borderRadius: '4px', overflow: 'hidden' }} title="Population happiness">
          <div style={{
            height: '100%',
            width: happinessPercent + '%',
            background: 'linear-gradient(90deg, #ef4444 0%, #fbbf24 41.67%, #4ade80 66.67%, #22c55e 100%)',
            backgroundSize: (120 / Math.min(120, Math.max(1, happiness))) * 100 + '% 100%',
            backgroundRepeat: 'no-repeat',
            transition: 'width 0.3s ease',
            borderRadius: '4px',
          }} />
        </div>
        <div className="sub" style={{ fontSize: '11px', color: 'var(--text2)', display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <span>{happinessLabel}</span>
        </div>
      </div>
      <div className="metric" id="metric-food">
        <div className="lbl">Food</div>
        <div className="val" style={{ color: food < 1000 ? 'var(--red)' : '' }}>{trunc(food)}</div>
        <div className="sub">
          <span style={{ fontWeight: 600, color: food_balance >= 0 ? '' : 'var(--red)' }}>
            {food_balance >= 0 ? '+' : ''}{fmt(food_balance)}
          </span>/turn
        </div>
      </div>
      <div className="metric" id="metric-defense">
        <div className="lbl">Defense</div>
        <div className="val" style={{ fontSize: '11px' }}>{defense_rating || '—'}</div>
        <div className="sub">{fmt(bld_walls)} walls</div>
      </div>
    </div>
  );
};

export default MetricsStrip;
