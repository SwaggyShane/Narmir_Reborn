import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fmt } from '../../utils/fmt.js';
import { apiCall } from '../../utils/api.mjs';
import { toast } from '../../utils/toast.js';
import { playGameSound } from '../../utils/audio.js';
import { normalizeAndRouteResponse } from '../../utils/responseNormalizer.js';
import { ownedFromUpdates, parseOwnedUpgrades } from '../../utils/upgradeUtils.js';

function isUpgradeOwned(owned, upgradeKey) {
  return owned[upgradeKey] === true;
}

function UpgradeRow({ category, upgradeKey, def, owned, state, onPurchased, purchasing, setPurchasing }) {
  const isOwned = isUpgradeOwned(owned, upgradeKey);
  const hasReq = !def.requires || isUpgradeOwned(owned, def.requires);
  const raceOk = !def.raceOnly || state?.race === def.raceOnly;
  const vaultsOk = !def.reqVaults || Number(state?.bld_vaults || 0) >= def.reqVaults;
  const canBuy =
    !isOwned && hasReq && raceOk && vaultsOk &&
    (state?.gold || 0) >= (def.cost || 0) &&
    (state?.wood || 0) >= (def.costWood || 0) &&
    (state?.stone || 0) >= (def.costStone || 0) &&
    (state?.iron || 0) >= (def.costIron || 0);

  let statusBadge = null;
  if (isOwned) {
    statusBadge = <span className="text-[11px] text-[var(--green)]">Owned</span>;
  } else if (!hasReq) {
    statusBadge = <span className="text-[11px] text-[var(--text3)]">Need {String(def.requires || '').replace(/_/g, ' ')}</span>;
  } else if (!raceOk) {
    statusBadge = <span className="text-[11px] text-[var(--text3)]">Race locked</span>;
  } else if (!vaultsOk) {
    statusBadge = <span className="text-[11px] text-[var(--text3)]">Need {def.reqVaults} vaults</span>;
  }

  let costStr = fmt(def.cost) + ' GC';
  const extraCosts = [];
  if (def.costWood > 0) extraCosts.push(fmt(def.costWood) + ' wood');
  if (def.costStone > 0) extraCosts.push(fmt(def.costStone) + ' stone');
  if (def.costIron > 0) extraCosts.push(fmt(def.costIron) + ' iron');
  if (extraCosts.length > 0) costStr += ' + ' + extraCosts.join(', ');

  const handleBuy = async () => {
    if (purchasing) return;
    setPurchasing(true);

    try {
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
        normalizeAndRouteResponse(result, { reason: 'upgrade-purchased', type: 'mausoleum' });
        const nextOwned = { ...owned, [upgradeKey]: true };
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
        if (String(result.error).toLowerCase().includes('already purchased')) {
          onPurchased?.(upgradeKey, { ...owned, [upgradeKey]: true });
        }
        return;
      }

      playGameSound('upgrade_purchased');

      if (result.updates) {
        normalizeAndRouteResponse(result, { reason: 'upgrade-purchased', type: category });
      }

      const nextOwned = ownedFromUpdates(result.updates, category)
        || { ...owned, [upgradeKey]: true };
      onPurchased?.(upgradeKey, nextOwned);
      toast(`${def.name} purchased!`, 'success');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-[var(--border)]">
      <div className="flex-1">
        <div className="text-[13px] text-[var(--text)] font-semibold">
          {def.name}
        </div>
        <div className="text-[11px] text-[var(--text3)]">
          {def.desc} | {costStr}
        </div>
      </div>
      {statusBadge}
      {!isOwned && hasReq && raceOk && vaultsOk && (
        <button
          className="btn btn-gold text-[11px] px-2.5 py-0.5 disabled:opacity-50"
          onClick={handleBuy}
          disabled={!canBuy || purchasing}
        >
          {purchasing ? 'Buying...' : 'Buy'}
        </button>
      )}
    </div>
  );
}

export default function UpgradesList({ category, defs, owned, state, onPurchased }) {
  const kingdomId = state?.id ?? state?.kingdomId ?? null;
  const ownedSig = JSON.stringify(parseOwnedUpgrades(owned));
  const ownedParsed = useMemo(() => parseOwnedUpgrades(owned), [ownedSig]);
  const [ownedLocal, setOwnedLocal] = useState(ownedParsed);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    const parsed = parseOwnedUpgrades(owned);
    setOwnedLocal((prev) => {
      const parsedHasOwned = Object.keys(parsed).some((key) => parsed[key] === true);
      const prevHasOwned = Object.keys(prev).some((key) => prev[key] === true);
      if (!parsedHasOwned && prevHasOwned) return prev;
      return parsed;
    });
  }, [kingdomId, ownedSig]);

  const handlePurchased = useCallback((upgradeKey, nextOwned) => {
    setOwnedLocal(parseOwnedUpgrades(nextOwned));
    onPurchased?.(upgradeKey, nextOwned);
  }, [onPurchased]);

  if (!defs || typeof defs !== 'object') {
    return (
      <div className="text-[12px] text-[var(--red)]">
        Error loading upgrade data
      </div>
    );
  }

  const entries = Object.entries(defs);
  if (entries.length === 0) {
    return (
      <div className="text-[12px] text-[var(--text3)] py-2">
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
          purchasing={purchasing}
          setPurchasing={setPurchasing}
        />
      ))}
    </>
  );
}