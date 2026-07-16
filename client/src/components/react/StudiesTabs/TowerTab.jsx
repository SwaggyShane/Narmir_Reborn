import React from 'react';
import UpgradesList from '../UpgradesList.jsx';
import { TowerCraftList } from './TowerCraftList.jsx';
import { TOWER_UPGRADES } from '../../../utils/studiesUpgrades.js';
import { parseOwnedUpgrades } from '../../../utils/upgradeUtils.js';

function scrollLabel(key) {
  return String(key || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const TowerTab = ({ studiesData, state, onUpgraded, fetchStudiesData }) => {
  const scrolls = parseOwnedUpgrades(studiesData?.scrolls);
  const allocation = parseOwnedUpgrades(studiesData?.mage_tower_allocation);
  const progress = parseOwnedUpgrades(studiesData?.tower_progress);
  const scrollEntries = Object.entries(scrolls).filter(([, qty]) => (Number(qty) || 0) > 0);
  const activeTasks = Object.entries(allocation).filter(([, mages]) => (Number(mages) || 0) > 0);

  return (
    <div className="r-grid-2">
      <div className="flex flex-col gap-3">
        <div className="card m-0">
          <div className="card-title">Tower Operations</div>
          <div className="trow">
            <span className="name">Towers</span>
            <span className="count" id="st-towers">{studiesData?.bld_mage_towers ?? 0}</span>
          </div>
          <div className="trow">
            <span className="name">Mana/turn</span>
            <span className="count text-[var(--accent1)]" id="st-mana-turn">{studiesData?.mana_per_turn ?? 0}</span>
          </div>
          <div className="trow">
            <span className="name">Mages (Current/Cap)</span>
            <span className="count">
              <span id="st-mages-tower">{studiesData?.mages ?? 0}</span> / <span id="st-tower-cap">{(studiesData?.bld_mage_towers || 0) * 20}</span>
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--border)]">
            <TowerCraftList
              allocation={studiesData?.mage_tower_allocation}
              progress={studiesData?.tower_progress}
              scrolls={studiesData?.scrolls}
              bldMageTowers={studiesData?.bld_mage_towers}
              mages={studiesData?.mages}
              onAllocated={fetchStudiesData}
            />
          </div>
        </div>

        <div className="card m-0">
          <div className="card-title">Scroll inventory</div>
          <div id="st-tower-scroll-inventory" className="flex flex-col gap-1.5">
            {scrollEntries.length === 0 ? (
              <div className="text-xs text-[var(--text3)]">No scrolls in your tower.</div>
            ) : (
              scrollEntries.map(([key, qty]) => (
                <div key={key} className="flex items-center justify-between text-[12px]">
                  <span className="text-[var(--text)]">📜 {scrollLabel(key)}</span>
                  <span className="text-[var(--gold)]">{qty}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="card m-0">
          <div className="card-title">Crafting progress</div>
          <div id="st-tower-craft-progress" className="flex flex-col gap-2">
            {activeTasks.length === 0 ? (
              <div className="text-xs text-[var(--text3)]">No scrolls being crafted.</div>
            ) : (
              activeTasks.map(([key, mages]) => {
                const done = Number(progress?.[`scroll_${key}`]) || 0;
                return (
                  <div key={key} className="flex items-center justify-between text-xs py-1 border-b border-[var(--border)]">
                    <span className="text-[var(--text)]">{scrollLabel(key)}</span>
                    <span className="text-[var(--text3)]">{mages} mages — {done.toFixed(1)} turns done</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card m-0">
          <div className="card-title">Tower upgrades</div>
          <UpgradesList
            category="tower"
            defs={TOWER_UPGRADES}
            owned={parseOwnedUpgrades(studiesData?.tower_upgrades)}
            state={state || {}}
            onPurchased={(_, nextOwned) => onUpgraded('tower', nextOwned)}
          />
        </div>
      </div>
    </div>
  );
};
