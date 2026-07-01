import React from 'react';
import UpgradesList from '../UpgradesList.jsx';
import { TOWER_UPGRADES } from '../../../utils/studiesUpgrades.js';
import { parseOwnedUpgrades } from '../../../utils/upgradeUtils.js';

export const TowerTab = ({ studiesData, state, onUpgraded }) => {
  return (
    <div className="r-grid-2">
      <div className="flex flex-col gap-3">
        <div className="card m-0">
          <div className="card-title">Tower Operations</div>
          <div className="trow">
            <span className="name">Towers</span>
            <span className="count" id="st-towers">0</span>
          </div>
          <div className="trow">
            <span className="name">Mana/turn</span>
            <span className="count text-[var(--accent1)]" id="st-mana-turn">0</span>
          </div>
          <div className="trow">
            <span className="name">Mages (Current/Cap)</span>
            <span className="count"><span id="st-mages-tower">0</span> / <span id="st-tower-cap">0</span></span>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--border)]">
            <div id="st-tower-list"></div>
          </div>
        </div>

        <div className="card m-0">
          <div className="card-title">Scroll inventory</div>
          <div id="st-tower-scroll-inventory" className="flex flex-col gap-1.5">
            <div className="text-xs text-[var(--text3)]">No scrolls in your tower.</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="card m-0">
          <div className="card-title">Crafting progress</div>
          <div id="st-tower-craft-progress" className="flex flex-col gap-2">
            <div className="text-xs text-[var(--text3)]">No scrolls being crafted.</div>
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
