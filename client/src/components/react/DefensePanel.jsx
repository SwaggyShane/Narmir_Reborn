import React, { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { apiCall } from '../../utils/api';
import { fmt } from "../../utils/fmt";
import { applyGameMutation } from '../../utils/gameMutations.js';
import { toast } from '../../utils/toast.js';
import { useGameMutationEvents } from '../../hooks/useGameState';
import {
  useRace,
  useGold,
  useKingdomId,
  useWood,
  useStone,
  useIron,
  useBuildCount,
} from '../../stores';
import UpgradesList from './UpgradesList.jsx';
import { parseOwnedUpgrades } from '../../utils/upgradeUtils.js';
import {
  WALL_UPGRADES_JS,
  TOWER_DEF_UPGRADES_JS,
  OUTPOST_UPGRADES_JS,
  WALL_RACE_MULT,
  TOWER_RACE_MULT,
  OUTPOST_RACE_MULT,
} from '../../utils/defenseData.js';

const DefensePanel = () => {
  const race = useRace();
  const kingdomId = useKingdomId();
  const gold = useGold();
  const wood = useWood();
  const stone = useStone();
  const iron = useIron();
  const vaults = useBuildCount('vaults');
  useGameMutationEvents();
  const [upgradeOwned, setUpgradeOwned] = useState({
    wall: {},
    tower_def: {},
    outpost: {},
  });
  const [activeTab, setActiveTab] = useState('walls');
  const [defenseData, setDefenseData] = useState({
    defense_rating: '—',
    tierStatus: { text: 'Not fortified', color: 'var(--text3)' },
    walls: 0, towers: 0, outposts: 0, castles: 0,
    targetWalls: 100, targetTowers: 10, targetOutposts: 10, targetCastles: 0,
    bld_walls: 0, wm_on_walls: 0, wall_power: 0, wall_race: 1,
    bld_guard_towers: 0, thieves_on_watch: 0, tower_cap: 0, tower_power: 0, tower_race: 1,
    bld_outposts: 0, rangers_on_patrol: 0, outpost_cap: 0, outpost_power: 0, outpost_race: 1,
  });

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
  };

  const getStatColor = (val, max) => {
    if (val >= max) return 'var(--gold)';
    if (val >= Math.floor(max * 0.5)) return 'var(--green)';
    return 'var(--text2)';
  };

  const refreshDefense = useCallback(async () => {
    const data = await apiCall('/api/kingdom/defense/overview');
    if (data?.error) {
      if (typeof toast !== 'undefined') toast(data.error, 'error');
      return;
    }

    const raceValue = race || 'human';
    const du = data.defense_upgrades || {};

    let statusText = 'Not fortified';
    let statusColor = 'var(--text3)';
    let targetWalls = 100;
    let targetTowers = 10;
    let targetOutposts = 10;
    let targetCastles = 0;

    if (du.citadel) {
      statusText = '👑 CITADEL ACHIEVED';
      statusColor = 'var(--gold)';
      targetWalls = 1000;
      targetTowers = 500;
      targetOutposts = 500;
      targetCastles = 1;
    } else if (du.keep) {
      statusText = '🏰 KEEP ACHIEVED';
      statusColor = 'var(--gold)';
      targetWalls = 1000;
      targetTowers = 500;
      targetOutposts = 500;
      targetCastles = 1;
    } else if (du.fortified) {
      statusText = '🛡️ FORTIFIED ACHIEVED';
      statusColor = 'var(--gold)';
      targetWalls = 500;
      targetTowers = 50;
      targetOutposts = 50;
      targetCastles = 0;
    }

    setDefenseData({
      defense_rating: data.defense_rating || '—',
      tierStatus: { text: statusText, color: statusColor },
      walls: data.bld_walls || 0,
      towers: data.bld_guard_towers || 0,
      outposts: data.bld_outposts || 0,
      castles: data.bld_castles || 0,
      targetWalls,
      targetTowers,
      targetOutposts,
      targetCastles,
      bld_walls: data.bld_walls || 0,
      wm_on_walls: data.wm_on_walls || 0,
      wall_power: data.wall_power || 0,
      wall_race: WALL_RACE_MULT[raceValue] || 1.0,
      bld_guard_towers: data.bld_guard_towers || 0,
      thieves_on_watch: data.thieves_on_watch || 0,
      tower_cap: (data.bld_guard_towers || 0) * 10,
      tower_power: data.tower_power || 0,
      tower_race: TOWER_RACE_MULT[raceValue] || 1.0,
      bld_outposts: data.bld_outposts || 0,
      rangers_on_patrol: data.rangers_on_patrol || 0,
      outpost_cap: (data.bld_outposts || 0) * 20,
      outpost_power: data.outpost_power || 0,
      outpost_race: OUTPOST_RACE_MULT[raceValue] || 1.0,
    });

    setUpgradeOwned({
      wall: parseOwnedUpgrades(data.wall_upgrades),
      tower_def: parseOwnedUpgrades(data.tower_def_upgrades),
      outpost: parseOwnedUpgrades(data.outpost_upgrades),
    });
  }, [race]);

  useEffect(() => {
    refreshDefense();
  }, [refreshDefense]);

  const syncDefenseUpgrades = useCallback((bucket, nextOwned) => {
    setUpgradeOwned((prev) => ({ ...prev, [bucket]: nextOwned }));
  }, []);

  const upgradeState = {
    id: kingdomId,
    kingdomId,
    race,
    gold,
    wood,
    stone,
    iron,
    bld_vaults: vaults,
  };

  useGameMutationEvents(useCallback((event) => {
    if (String(event?.reason || '') === 'economy-upgrade') {
      refreshDefense();
    }
  }, [refreshDefense]));

  return (
    <div id="defense" className="panel">
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-950/80 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="card-title mb-1 flex items-center gap-2">
            <span>??? Defense</span>
            <span
              id="citadel-badge-title"
              className="hidden rounded-full bg-[var(--gold)]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--gold)]"
            >
              ?? Citadel
            </span>
          </div>
          <div className="text-[13px] text-[var(--text3)]">
            Rating: <span className="font-bold">{defenseData.defense_rating}</span>
          </div>
        </div>
        <button className="base-btn rounded-full px-3 py-1.5 text-[11px] font-semibold" onClick={refreshDefense}>🔄 Refresh</button>
      </div>

      <div className="card mb-3 rounded-2xl border border-white/10 bg-zinc-950/80" id="defense-tiers-card">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="card-title m-0">🛡️ Defense Tiers</div>
          <span className="text-[12px]" style={{ color: defenseData.tierStatus.color }}>{defenseData.tierStatus.text}</span>
        </div>
        <div id="tier-desc" className="mb-3 text-[12px] text-[var(--text3)]">
          Build walls, guard towers, outposts, and castles to reach new tiers and
          gain permanent defense and mitigation bonuses.
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-[var(--bg3)] p-2 text-center">
            <div className="mb-1 text-[10px] text-[var(--text3)]">WALLS</div>
            <div className="text-[16px] font-bold" style={{ color: getStatColor(defenseData.walls, defenseData.targetWalls) }}>{fmt(defenseData.walls)}</div>
            <div className="text-[10px] text-[var(--text3)]">/ {fmt(defenseData.targetWalls)}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-[var(--bg3)] p-2 text-center">
            <div className="mb-1 text-[10px] text-[var(--text3)]">TOWERS</div>
            <div className="text-[16px] font-bold" style={{ color: getStatColor(defenseData.towers, defenseData.targetTowers) }}>{fmt(defenseData.towers)}</div>
            <div className="text-[10px] text-[var(--text3)]">/ {fmt(defenseData.targetTowers)}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-[var(--bg3)] p-2 text-center">
            <div className="mb-1 text-[10px] text-[var(--text3)]">OUTPOSTS</div>
            <div className="text-[16px] font-bold" style={{ color: getStatColor(defenseData.outposts, defenseData.targetOutposts) }}>{fmt(defenseData.outposts)}</div>
            <div className="text-[10px] text-[var(--text3)]">/ {fmt(defenseData.targetOutposts)}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-[var(--bg3)] p-2 text-center">
            <div className="mb-1 text-[10px] text-[var(--text3)]">CASTLE</div>
            <div className="text-[16px] font-bold" style={{ color: getStatColor(defenseData.castles, defenseData.targetCastles) }}>{fmt(defenseData.castles)}</div>
            <div className="text-[10px] text-[var(--text3)]">/ {fmt(defenseData.targetCastles)}</div>
          </div>
        </div>

        <div className="mt-3 grid gap-1.5 rounded-lg border border-white/10 bg-[var(--bg1)] p-2 text-[11px] text-[var(--text3)]">
          <div id="tier-1" className="flex justify-between p-1">
            <div className="font-semibold text-[var(--text2)]">??? Fortified</div>
            <div>100 Walls ? 10 Towers ? 10 Outposts</div>
          </div>
          <div id="tier-2" className="flex justify-between border-t border-[var(--border)] p-1">
            <div className="font-semibold text-[var(--text2)]">?? Keep</div>
            <div>350 Walls ? 30 Towers ? 30 Outposts</div>
          </div>
          <div id="tier-3" className="flex justify-between border-t border-[var(--border)] p-1">
            <div className="font-semibold text-[var(--text2)]">?? Citadel</div>
            <div>500 Walls ? 50 Towers ? 50 Outposts ? 1 Castle</div>
          </div>
        </div>
      </div>
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-4 border-b-2 border-[var(--border2)]">
        <button
          className={clsx('base-btn admin-tab rounded-none', activeTab === 'walls' && 'active')}
          onClick={() => handleTabClick('walls')}
        >
          🧱 Walls
        </button>
        <button
          className={clsx('base-btn admin-tab rounded-none', activeTab === 'towers' && 'active')}
          onClick={() => handleTabClick('towers')}
        >
          🗼 Guard Towers
        </button>
        <button
          className={clsx('base-btn admin-tab rounded-none', activeTab === 'outposts' && 'active')}
          onClick={() => handleTabClick('outposts')}
        >
          ⛺ Outposts
        </button>
      </div>

      {/* WALLS TAB */}
      <div className={clsx(activeTab === 'walls' ? 'block' : 'hidden')}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="card m-0">
            <div className="card-title mb-2.5">
              Wall overview
            </div>
            <div className="trow">
              <span className="name">Walls built</span>
              <span className="count">{fmt(defenseData.bld_walls)}</span>
            </div>
            <div className="trow">
              <span className="name">War machines mounted</span>
              <span className="count text-[var(--gold)]">
                {fmt(defenseData.wm_on_walls)}
              </span>
            </div>
            <div className="trow">
              <span className="name">Wall defense power</span>
              <span className="count text-[var(--green)]">
                {fmt(defenseData.wall_power)}
              </span>
            </div>
            <div className="trow">
              <span className="name">Race modifier</span>
              <span className="count">×{defenseData.wall_race.toFixed(2)}</span>
            </div>
            <div className="trow border-t border-[var(--border2)] mt-1 pt-1">
              <span className="name text-[var(--amber)] text-[11px]">
                No walls = buildings can be damaged by attackers
              </span>
            </div>
          </div>
          <div className="card m-0">
            <div className="card-title mb-2.5">
              Wall upgrades
            </div>
            <UpgradesList
              category="wall"
              defs={WALL_UPGRADES_JS}
              owned={upgradeOwned.wall}
              state={upgradeState}
              onPurchased={(_, nextOwned) => syncDefenseUpgrades('wall', nextOwned)}
            />
          </div>
        </div>
      </div>

      {/* GUARD TOWERS TAB */}
      <div className={clsx(activeTab === 'towers' ? 'block' : 'hidden')}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="card m-0">
            <div className="card-title mb-2.5">
              Guard Tower overview
            </div>
            <div className="trow">
              <span className="name">Guard towers</span>
              <span className="count">{fmt(defenseData.bld_guard_towers)}</span>
            </div>
            <div className="trow">
              <span className="name">Thieves on watch</span>
              <span
                className="count text-[var(--amber)]"
              >
                {fmt(defenseData.thieves_on_watch)}
              </span>
            </div>
            <div className="trow">
              <span className="name">Max capacity</span>
              <span className="count">{fmt(defenseData.tower_cap)}</span>
            </div>
            <div className="trow">
              <span className="name">Tower defense power</span>
              <span
                className="count text-[var(--green)]"
              >
                {fmt(defenseData.tower_power)}
              </span>
            </div>
            <div className="trow">
              <span className="name">Detection modifier</span>
              <span className="count">×{defenseData.tower_race.toFixed(2)}</span>
            </div>
          </div>
          <div className="card m-0">
            <div className="card-title mb-2.5">
              Tower upgrades
            </div>
            <UpgradesList
              category="tower_def"
              defs={TOWER_DEF_UPGRADES_JS}
              owned={upgradeOwned.tower_def}
              state={upgradeState}
              onPurchased={(_, nextOwned) => syncDefenseUpgrades('tower_def', nextOwned)}
            />
          </div>
        </div>
      </div>

      {/* OUTPOSTS TAB */}
      <div className={clsx(activeTab === 'outposts' ? 'block' : 'hidden')}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="card m-0">
            <div className="card-title mb-2.5">
              Outpost overview
            </div>
            <div className="trow">
              <span className="name">Outposts</span>
              <span className="count">{fmt(defenseData.bld_outposts)}</span>
            </div>
            <div className="trow">
              <span className="name">Rangers on patrol</span>
              <span
                className="count text-[var(--blue)]"
              >
                {fmt(defenseData.rangers_on_patrol)}
              </span>
            </div>
            <div className="trow">
              <span className="name">Max capacity</span>
              <span className="count">{fmt(defenseData.outpost_cap)}</span>
            </div>
            <div className="trow">
              <span className="name">Outpost defense power</span>
              <span
                className="count text-[var(--green)]"
              >
                {fmt(defenseData.outpost_power)}
              </span>
            </div>
            <div className="trow">
              <span className="name">Patrol modifier</span>
              <span className="count">×{defenseData.outpost_race.toFixed(2)}</span>
            </div>
          </div>
          <div className="card m-0">
            <div className="card-title mb-2.5">
              Outpost upgrades
            </div>
            <UpgradesList
              category="outpost"
              defs={OUTPOST_UPGRADES_JS}
              owned={upgradeOwned.outpost}
              state={upgradeState}
              onPurchased={(_, nextOwned) => syncDefenseUpgrades('outpost', nextOwned)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DefensePanel;
