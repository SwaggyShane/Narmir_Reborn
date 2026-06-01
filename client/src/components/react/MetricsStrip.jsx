import React, { useMemo } from 'react';
import { useGameState } from '../../hooks/useGameState.js';

const MetricsStrip = () => {
  const gs = useGameState();

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

  const RACE_MORALE_BONUSES = {
    human: 1.05, high_elf: 0.95, dwarf: 1.0, dire_wolf: 1.1,
    dark_elf: 0.9, orc: 1.05, vampire: 0.95,
  };

  const FARM_WORKERS_PER = {
    human: 10, dwarf: 8, high_elf: 12, orc: 15,
    dark_elf: 10, dire_wolf: 12, vampire: 2,
  };

  const FARM_YIELD_MULT = {
    human: 1.0, dwarf: 0.9, high_elf: 1.15, orc: 0.85,
    dark_elf: 0.95, dire_wolf: 0.8, vampire: 0.9,
  };

  const FOOD_CONS_MULT = {
    human: 1.0, dwarf: 0.85, high_elf: 0.8, orc: 1.35,
    dark_elf: 0.95, dire_wolf: 1.4, vampire: 0.7,
  };

  const trunc = (n) => {
    if (!n || n === 0) return '0';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(0) + 'k';
    return Math.round(n).toString();
  };

  const metrics = useMemo(() => {
    const race = gs.race || 'human';
    const population = gs.population || gs.pop || 0;
    const capPerBuilding = HOUSING_CAP_BY_RACE[race] || 500;
    const housingCap = (gs.bld_housing || 0) * capPerBuilding;
    const isPopOverCap = population > housingCap && housingCap > 0;

    // Land calculation
    const usedLand = Object.keys(LAND_COST).reduce((sum, k) =>
      sum + (gs[k] || 0) * LAND_COST[k], 0);
    const freeLand = Math.max(0, (gs.land || 0) - usedLand);

    // Morale calculation
    const baseMorale = gs.morale !== undefined ? gs.morale : 100;
    const entLevel = gs.res_entertainment || 100;
    const morale = Math.floor(
      (baseMorale / entLevel) * 100 * (RACE_MORALE_BONUSES[race] || 1.0)
    );

    // Thralls (vampire only)
    const thrallHousing = (gs.bld_mausoleums || 0) * 100;
    const isThrallOverCap = (gs.thralls || 0) > thrallHousing;

    // Food balance
    const freePop = race === 'vampire'
      ? gs.thralls || 0
      : Math.max(0, population -
          ((gs.fighters || 0) + (gs.rangers || 0) + (gs.clerics || 0) +
           (gs.mages || 0) + (gs.thieves || 0) + (gs.ninjas || 0) +
           (gs.researchers || 0) + (gs.engineers || 0) + (gs.scribes || 0)));

    const worked = Math.min(
      gs.bld_farms || 0,
      Math.floor(freePop / (FARM_WORKERS_PER[race] || 10))
    );

    let upgradeMult = 1.0;
    try {
      const upgrades = typeof gs.farm_upgrades === 'string'
        ? JSON.parse(gs.farm_upgrades) : (gs.farm_upgrades || {});
      if (upgrades.irrigation) upgradeMult *= 1.15;
      if (upgrades.crop_rotation) upgradeMult *= 1.25;
      if (upgrades.plantation) upgradeMult *= 1.6;
    } catch {}

    const prod = Math.floor(
      worked * 100 * (FARM_YIELD_MULT[race] || 1.0) * upgradeMult
    );

    const cons = Math.floor(
      ((gs.fighters || 0) + (gs.rangers || 0) + (gs.clerics || 0) +
       (gs.mages || 0) + (gs.thieves || 0) + (gs.ninjas || 0) +
       (gs.researchers || 0) + (gs.engineers || 0) + (gs.scribes || 0) +
       Math.floor((population) / 100)) *
      (FOOD_CONS_MULT[race] || 1.0)
    );

    const foodBalance = prod - cons;

    return {
      gold: gs.gold || 0,
      mana: gs.mana || 0,
      land: gs.land || 0,
      freeLand,
      population,
      housingCap,
      isPopOverCap,
      morale,
      food: gs.food || 0,
      foodBalance,
      thralls: gs.thralls || 0,
      thrallHousing,
      isThrallOverCap,
      defenseRating: gs.defense_rating || '—',
      walls: gs.bld_walls || 0,
    };
  }, [gs]);

  return (
    <div className="metrics">
      {/* Gold */}
      <div className="metric" id="metric-gold">
        <div className="lbl">Gold</div>
        <div className="val" style={{ color: metrics.gold < 1000 ? 'var(--red)' : '' }}>
          {trunc(metrics.gold)}
        </div>
        <div className="sub" id="m-gold-sub">+0/turn</div>
      </div>

      {/* Mana */}
      <div className="metric" id="metric-mana">
        <div className="lbl">Mana</div>
        <div className="val">{trunc(metrics.mana)}</div>
        <div className="sub" id="m-mana-sub">+40/turn</div>
      </div>

      {/* Land */}
      <div className="metric" id="metric-land">
        <div className="lbl">Land</div>
        <div className="val">{trunc(metrics.land)}</div>
        <div className="sub"><span>{trunc(metrics.freeLand)}</span> free</div>
      </div>

      {/* Population */}
      <div className="metric" id="metric-pop">
        <div className="lbl">Population</div>
        <div className="val">{trunc(metrics.population)}</div>
        <div className="sub">
          cap: <span style={{ color: metrics.isPopOverCap ? 'var(--red)' : '' }}>
            {trunc(metrics.housingCap)}
          </span>
        </div>
      </div>

      {/* Thralls (vampire only) */}
      {gs.race === 'vampire' && (
        <div className="metric" id="metric-thralls">
          <div className="lbl">Thralls</div>
          <div className="val">{trunc(metrics.thralls)}</div>
          <div className="sub">
            cap: <span style={{ color: metrics.isThrallOverCap ? 'var(--red)' : '' }}>
              {trunc(metrics.thrallHousing)}
            </span>
          </div>
        </div>
      )}

      {/* Morale */}
      <div className="metric" id="metric-morale">
        <div className="lbl">Morale</div>
        <div className="val">{metrics.morale}</div>
        <div className="sub">Tax: <span id="m-tax">42%</span></div>
      </div>

      {/* Food */}
      <div className="metric" id="metric-food">
        <div className="lbl">Food</div>
        <div className="val" style={{ color: metrics.food < 1000 ? 'var(--red)' : '' }}>
          {trunc(metrics.food)}
        </div>
        <div className="sub">
          <span style={{ fontWeight: 600, color: metrics.foodBalance >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {metrics.foodBalance >= 0 ? '+' : ''}{trunc(metrics.foodBalance)}
          </span>/turn
        </div>
      </div>

      {/* Defense */}
      <div className="metric" id="metric-defense">
        <div className="lbl">Defense</div>
        <div className="val" style={{ fontSize: '11px' }}>
          {metrics.defenseRating}
        </div>
        <div className="sub"><span>{trunc(metrics.walls)}</span> walls</div>
      </div>
    </div>
  );
};

export default MetricsStrip;
