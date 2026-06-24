import React from 'react';
import { fmt } from '../../utils/fmt.js';
import { useGameState } from '../../hooks/useGameState.js';
import { apiCall } from '../../utils/api.mjs';
import { toast } from '../../utils/toast.js';
import { playGameSound } from '../../utils/audio.js';
import { applyGameMutation } from '../../utils/gameMutations.js';
import { syncUI } from '../../utils/shellBridge.js';

function UpgradeRow({ category, upgradeKey, def, owned, state }) {
  const isOwned = !!owned[upgradeKey];
  const hasReq = !def.requires || !!owned[def.requires];
  const raceOk = !def.raceOnly || state.race === def.raceOnly;
  const canBuy =
    !isOwned && hasReq && raceOk &&
    (state.gold || 0) >= (def.cost || 0) &&
    (state.wood || 0) >= (def.costWood || 0) &&
    (state.stone || 0) >= (def.costStone || 0) &&
    (state.iron || 0) >= (def.costIron || 0);

  let statusBadge = null;
  if (isOwned) {
    statusBadge = <span style={{ color: 'var(--green)', fontSize: '11px' }}>✅ Owned</span>;
  } else if (!hasReq) {
    statusBadge = <span style={{ color: 'var(--text3)', fontSize: '11px' }}>🔒 Need {String(def.requires || '').replace(/_/g, ' ')}</span>;
  } else if (!raceOk) {
    statusBadge = <span style={{ color: 'var(--text3)', fontSize: '11px' }}>🔒 Race locked</span>;
  }

  let costStr = fmt(def.cost) + ' GC';
  const extraCosts = [];
  if (def.costWood > 0) extraCosts.push(fmt(def.costWood) + ' wood');
  if (def.costStone > 0) extraCosts.push(fmt(def.costStone) + ' stone');
  if (def.costIron > 0) extraCosts.push(fmt(def.costIron) + ' iron');
  if (extraCosts.length > 0) costStr += ' + ' + extraCosts.join(', ');

  const handleBuy = async () => {
    const endpoint = category === 'mausoleum'
      ? '/api/kingdom/buy-mausoleum-upgrade'
      : '/api/kingdom/economy/upgrade';

    const result = await apiCall(endpoint, {
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

    syncUI();
    toast('Upgrade purchased! Refresh the panel to see the next upgrade.', 'success');
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
          {def.desc} · {costStr}
        </div>
      </div>
      {statusBadge}
      {!isOwned && hasReq && raceOk && (
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

export default function UpgradesList({ category, defs, owned, state }) {
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
          owned={owned}
          state={state}
        />
      ))}
    </>
  );
}
