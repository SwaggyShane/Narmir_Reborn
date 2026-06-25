import React, { useCallback, useEffect, useState } from 'react';
import { fmt } from '../../utils/fmt.js';
import { apiCall } from '../../utils/api.mjs';
import { toast } from '../../utils/toast.js';
import { playGameSound } from '../../utils/audio.js';
import { applyGameMutation } from '../../utils/gameMutations.js';
import { ownedFromUpdates, parseOwnedUpgrades } from '../../utils/upgradeUtils.js';

function UpgradeRow({ category, upgradeKey, def, owned, state, onPurchased }) {
  const isOwned = !!owned[upgradeKey];
  const hasReq = !def.requires || !!owned[def.requires];
  const raceOk = !def.raceOnly || state.race === def.raceOnly;
  const vaultsOk = !def.reqVaults || Number(state.bld_vaults || 0) >= def.reqVaults;
  const canBuy =
    !isOwned && hasReq && raceOk && vaultsOk &&
    (state.gold || 0) >= (def.cost || 0) &&
    (state.wood || 0) >= (def.costWood || 0) &&
    (state.stone || 0) >= (def.costStone || 0) &&
    (state.iron || 0) >= (def.costIron || 0);

  let statusBadge = null;
  if (isOwned) {
    statusBadge = <span style={{ color: 'var(--green)', fontSize: '11px' }}>Owned</span>;
  } else if (!hasReq) {
    statusBadge = <span style={{ color: 'var(--text3)', fontSize: '11px' }}>Need {String(def.requires || '').replace(/_/g, ' ')}</span>;
  } else if (!raceOk) {
    statusBadge = <span style={{ color: 'var(--text3)', fontSize: '11px' }}>Race locked</span>;
  } else if (!vaultsOk) {
    statusBadge = <span style={{ color: 'var(--text3)', fontSize: '11px' }}>Need {def.reqVaults} vaults</span>;
  }

  let costStr = fmt(def.cost) + ' GC';
  const extraCosts = [];
  if (def.costWood > 0) extraCosts.push(fmt(def.costWood) + ' wood');
  if (def.costStone > 0) extraCosts.push(fmt(def.costStone) + ' stone');
  if (def.costIron > 0) extraCosts.push(fmt(def.costIron) + ' iron');
  if (extraCosts.length > 0) costStr += ' + ' + extraCosts.join(', ');

  const handleBuy = async () => {
    if (category === 'mausoleum') {
      const result = await apiCall('/api/kingdom/buy-mausoleum-upgrade', {
        method: 'POST',
        body: { upgradeKey },
      });

      if (result.error) {
        toast(result.error, 'error');
        return;
      }

      playGameSound('upgrade_purchased');
      const nextOwned = { ...owned, [upgradeKey]: true };
      applyGameMutation({
        gold: Math.max(0, Number(state.gold || 0) - Number(def.cost || 0)),
        mausoleum_upgrades: nextOwned,
      }, { reason: 'economy-upgrade' });
      onPurchased?.(upgradeKey, nextOwned);
      toast(`${def.name} purchased!`, 'success');
      return;
    }

    const result = await apiCall('/api/kingdom/economy/upgrade', {
      method: 'POST',
      body: {
        category,
        upgradeKey,
      },
    });

    if (result.error) {
      toast(result.error, 'error');
      return;
    }

    playGameSound('upgrade_purchased');

    if (result.updates) {
      applyGameMutation(result, { reason: 'economy-upgrade' });
    }

    const nextOwned = ownedFromUpdates(result.updates, category)
      || { ...owned, [upgradeKey]: true };
    onPurchased?.(upgradeKey, nextOwned);
    toast(`${def.name} purchased!`, 'success');
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '7px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: '600' }}>
          {def.name}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
          {def.desc} | {costStr}
        </div>
      </div>
      {statusBadge}
      {!isOwned && hasReq && raceOk && vaultsOk && (
        <button
          className="btn btn-gold"
          onClick={handleBuy}
          disabled={!canBuy}
          style={{
            fontSize: '11px',
            padding: '3px 10px',
            opacity: canBuy ? 1 : 0.5,
          }}
        >
          Buy
        </button>
      )}
    </div>
  );
}

export default function UpgradesList({ category, defs, owned, state, onPurchased }) {
  const [ownedLocal, setOwnedLocal] = useState(() => parseOwnedUpgrades(owned));

  useEffect(() => {
    setOwnedLocal(parseOwnedUpgrades(owned));
  }, [owned]);

  const handlePurchased = useCallback((upgradeKey, nextOwned) => {
    setOwnedLocal(nextOwned);
    onPurchased?.(upgradeKey, nextOwned);
  }, [onPurchased]);

  if (!defs || typeof defs !== 'object') {
    return (
      <div style={{ color: 'var(--red)', fontSize: '12px' }}>
        Error loading upgrade data
      </div>
    );
  }

  const entries = Object.entries(defs);
  if (entries.length === 0) {
    return (
      <div style={{ color: 'var(--text3)', fontSize: '12px', padding: '8px 0' }}>
        No upgrades available in this category.
      </div>
    );
  }

  return (
    <>
      {entries.map(([key, def]) => (
        <UpgradeRow
          key={key}
          category={category}
          upgradeKey={key}
          def={def}
          owned={ownedLocal}
          state={state}
          onPurchased={handlePurchased}
        />
      ))}
    </>
  );
}