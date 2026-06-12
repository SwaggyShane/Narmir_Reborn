import React from 'react';
import { useGameSelector, shallowEqual } from '../../hooks/useGameState';

const HOUSING_CAP_BY_RACE = {
  dwarf: 975, orc: 900, human: 750, dark_elf: 675,
  high_elf: 525, dire_wolf: 1050, vampire: 600,
};

const LAND_COST = {
  bld_farms: 1, bld_granaries: 2, bld_barracks: 3, bld_outposts: 5,
  bld_guard_towers: 5, bld_armories: 5, bld_vaults: 10, bld_schools: 10,
  bld_smithies: 20, bld_markets: 25, bld_shrines: 10, bld_libraries: 20,
  bld_housing: 2, bld_mausoleums: 25, bld_mage_towers: 75, bld_training: 250,
  bld_castles: 1000, bld_taverns: 5, bld_walls: 3,
};

function trunc(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(Math.floor(n));
}

function fmt(n) {
  return Math.floor(n).toLocaleString();
}

// Selector pulls only the slice the strip needs. With shallowEqual, the
// component re-renders only when one of these fields changes — not on
// unrelated mutations like `bld_libraries`, `mage_tower_allocation`, etc.
function selectStrip(s) {
  return {
    gold: s.gold || 0,
    gold_income: s.gold_income || 0,
    mana: s.mana || 0,
    mana_regen: s.mana_regen || 0,
    land: s.land || 0,
    population: s.population || 0,
    happiness: s.happiness ?? 50,
    food: s.food || 0,
    food_balance: s.food_balance || 0,
    defense_rating: s.defense_rating || 0,
    bld_walls: s.bld_walls || 0,
    thralls: s.thralls || 0,
    race: s.race || '',
    bld_housing: s.bld_housing || 0,
    bld_mausoleums: s.bld_mausoleums || 0,
    // building counts for free-land derivation
    bld_farms: s.bld_farms || 0,
    bld_granaries: s.bld_granaries || 0,
    bld_barracks: s.bld_barracks || 0,
    bld_outposts: s.bld_outposts || 0,
    bld_guard_towers: s.bld_guard_towers || 0,
    bld_armories: s.bld_armories || 0,
    bld_vaults: s.bld_vaults || 0,
    bld_schools: s.bld_schools || 0,
    bld_smithies: s.bld_smithies || 0,
    bld_markets: s.bld_markets || 0,
    bld_shrines: s.bld_shrines || 0,
    bld_libraries: s.bld_libraries || 0,
    bld_mage_towers: s.bld_mage_towers || 0,
    bld_training: s.bld_training || 0,
    bld_castles: s.bld_castles || 0,
    bld_taverns: s.bld_taverns || 0,
  };
}

const ResourceStrip = () => {
  const s = useGameSelector(selectStrip, shallowEqual);

  const isVampire = s.race === 'vampire';
  const capPerBuilding = HOUSING_CAP_BY_RACE[s.race] || 500;
  const popCap = s.bld_housing * capPerBuilding;
  const thrallCap = s.bld_mausoleums * 100;

  const landUsed = Object.entries(LAND_COST).reduce((sum, [k, cost]) => {
    return sum + (s[k] || 0) * cost;
  }, 0);
  const freeLand = Math.max(0, s.land - landUsed);

  const happinessPercent = Math.max(0, Math.min(100, (s.happiness / 120) * 100));
  const happinessLabel =
    s.happiness > 80 ? '🎉 Thriving' :
    s.happiness > 50 ? '😊 Happy' :
    s.happiness > 30 ? '😐 Content' : '😞 Unhappy';

  return (
    <div className="metrics">
      <div className="metric" id="metric-gold">
        <div className="lbl">Gold</div>
        <div className="val" style={{ color: s.gold < 1000 ? 'var(--red)' : '' }}>{trunc(s.gold)}</div>
        <div className="sub" style={{ color: s.gold_income >= 0 ? 'var(--green)' : 'var(--red)' }}>
          {s.gold_income >= 0 ? '+' : ''}{fmt(s.gold_income)}/turn
        </div>
      </div>
      <div className="metric" id="metric-mana">
        <div className="lbl">Mana</div>
        <div className="val">{trunc(s.mana)}</div>
        <div className="sub">+{fmt(s.mana_regen)}/turn</div>
      </div>
      <div className="metric" id="metric-land">
        <div className="lbl">Land</div>
        <div className="val">{trunc(s.land)}</div>
        <div className="sub">{trunc(freeLand)} free</div>
      </div>
      <div className="metric" id="metric-pop">
        <div className="lbl">Population</div>
        <div className="val">{trunc(s.population)}</div>
        <div className="sub">
          cap: <span style={{ color: s.population > popCap && popCap > 0 ? 'var(--red)' : '' }}>{trunc(popCap)}</span>
        </div>
      </div>
      {isVampire && (
        <div className="metric" id="metric-thralls">
          <div className="lbl">Thralls</div>
          <div className="val">{trunc(s.thralls)}</div>
          <div className="sub">
            cap: <span style={{ color: s.thralls > thrallCap ? 'var(--red)' : '' }}>{trunc(thrallCap)}</span>
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
            backgroundSize: (120 / Math.min(120, Math.max(1, s.happiness))) * 100 + '% 100%',
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
        <div className="val" style={{ color: s.food < 1000 ? 'var(--red)' : '' }}>{trunc(s.food)}</div>
        <div className="sub">
          <span style={{ fontWeight: 600, color: s.food_balance >= 0 ? '' : 'var(--red)' }}>
            {s.food_balance >= 0 ? '+' : ''}{fmt(s.food_balance)}
          </span>/turn
        </div>
      </div>
      <div className="metric" id="metric-defense">
        <div className="lbl">Defense</div>
        <div className="val" style={{ fontSize: '11px' }}>{s.defense_rating || '—'}</div>
        <div className="sub">{fmt(s.bld_walls)} walls</div>
      </div>
    </div>
  );
};

export default ResourceStrip;
