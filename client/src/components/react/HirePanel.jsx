import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiCall } from '../../utils/api';
import { useGameState } from '../../hooks/useGameState';

const UNIT_ROWS = [
  {
    key: 'fighters',
    icon: '⚔️',
    label: 'Fighters',
    desc: 'Combat · defense',
    price: 250,
  },
  {
    key: 'rangers',
    icon: '🏹',
    label: 'Rangers',
    desc: 'Scout · ranged · explore',
    price: 250,
  },
  {
    key: 'clerics',
    icon: '💚',
    label: 'Clerics',
    desc: 'Heal · happiness aura · shrine',
    price: 250,
    hideWhenRace: 'vampire',
  },
  {
    key: 'mages',
    icon: '✨',
    label: 'Mages',
    desc: 'Spells · tower · library',
    price: 250,
  },
  {
    key: 'thieves',
    icon: '🗝️',
    label: 'Thieves',
    desc: 'Covert ops · loot · spy',
    price: 250,
  },
  {
    key: 'ninjas',
    icon: '🥷',
    label: 'Ninjas',
    desc: 'Assassinate · sabotage',
    price: 250,
  },
  {
    key: 'researchers',
    icon: '📚',
    label: 'Researchers',
    desc: 'Advance disciplines · school',
    price: 250,
  },
  {
    key: 'scribes',
    icon: '📜',
    label: 'Scribes',
    desc: 'Maps · blueprints · library',
    price: 250,
  },
  {
    key: 'engineers',
    icon: '⚙️',
    label: 'Engineers',
    desc: 'Build · war machines · smithy',
    price: 250,
  },
];

const initialQuantities = UNIT_ROWS.reduce((acc, row) => {
  acc[row.key] = '';
  return acc;
}, {});

const HirePanel = () => {
  const { state, applyUpdates } = useGameState();
  const [quantities, setQuantities] = useState(initialQuantities);

  const isVampire = state?.race === 'vampire';
  const fmt = (value) => Number(value || 0).toLocaleString();
  const unitCount = (key) => fmt(state?.[key]);

  const hiredUnits = useMemo(
    () =>
      UNIT_ROWS.reduce((sum, row) => {
        if (row.key === 'clerics' && isVampire) return sum;
        return sum + (Number(state?.[row.key] || 0));
      }, 0),
    [isVampire, state],
  );

  const freePopulation = useMemo(() => {
    const totalPop = Number(state?.population ?? state?.pop ?? 0);
    return Math.max(
      0,
      totalPop - hiredUnits,
    );
  }, [hiredUnits, state?.population, state?.pop]);

  const setMaxValue = useCallback((row) => {
    const maxByGold = Math.floor(Number(state?.gold || 0) / Number(row.price || 1));
    const maxByPop = row.key === 'clerics' && isVampire ? 0 : freePopulation;
    const max = Math.max(0, Math.min(maxByGold, maxByPop));
    setQuantities((prev) => ({ ...prev, [row.key]: String(max) }));
  }, [freePopulation, isVampire, state?.gold]);

  const hire = useCallback(async (row) => {
    const amount = Math.max(0, parseInt(quantities[row.key], 10) || 0);
    if (amount <= 0) {
      if (window.toast) window.toast('Enter a valid quantity', 'error');
      return;
    }

    try {
      const res = await apiCall('/api/kingdom/hire', {
        method: 'POST',
        body: {
          unit: row.key,
          amount,
        },
      });

      if (res.error) {
        if (window.toast) window.toast(res.error, 'error');
        return;
      }

      if (res.updates && window.applyServerUpdates) {
        window.applyServerUpdates(res.updates);
      } else if (res.updates) {
        applyUpdates(res.updates, 'hire');
      }

      setQuantities((prev) => ({ ...prev, [row.key]: '' }));
      if (window.toast) window.toast(`Hired ${amount} ${row.label.toLowerCase()}`, 'success');
    } catch (err) {
      console.error('[hire] failed:', err);
      if (window.toast) window.toast('Hire failed', 'error');
    }
  }, [applyUpdates, quantities]);

  const fire = useCallback(async (row) => {
    const amount = Math.max(0, parseInt(quantities[row.key], 10) || 0);
    if (amount <= 0) {
      if (window.toast) window.toast('Enter a valid quantity', 'error');
      return;
    }

    try {
      const res = await apiCall('/api/kingdom/fire', {
        method: 'POST',
        body: {
          unit: row.key,
          amount,
        },
      });

      if (res.error) {
        if (window.toast) window.toast(res.error, 'error');
        return;
      }

      if (res.updates && window.applyServerUpdates) {
        window.applyServerUpdates(res.updates);
      } else if (res.updates) {
        applyUpdates(res.updates, 'fire');
      }

      setQuantities((prev) => ({ ...prev, [row.key]: '' }));
      if (window.toast) window.toast(`Fired ${amount} ${row.label.toLowerCase()}`, 'success');
    } catch (err) {
      console.error('[fire] failed:', err);
      if (window.toast) window.toast('Fire failed', 'error');
    }
  }, [applyUpdates, quantities]);

  useEffect(() => {
    setQuantities((prev) => {
      let changed = false;
      const next = { ...prev };
      UNIT_ROWS.forEach((row) => {
        if (row.key === 'clerics' && isVampire) {
          if (next[row.key] !== '') {
            next[row.key] = '';
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, [isVampire]);

  return (
    <div id="hire" className="panel" style={{ display: 'none' }}>
      <div className="card" style={{ marginTop: 0 }}>
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Hire units</span>
          <span style={{ color: 'var(--text2)', textTransform: 'none', display: 'flex', gap: '14px', alignItems: 'center' }}>
            <span>Gold: <strong id="hire-strip-gold" style={{ color: 'var(--gold)' }}>{fmt(state?.gold)}</strong></span>
            <span>Population: <strong id="hire-pop" style={{ color: 'var(--gold)' }}>{fmt(state?.population ?? state?.pop)}</strong></span>
          </span>
        </div>

        <div
          id="hire-caps-container"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '8px',
            marginBottom: '20px',
            background: 'rgba(0, 0, 0, 0.2)',
            padding: '10px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ padding: '4px 8px' }}>
            <div style={{ fontSize: '9px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Barracks</div>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>
              <span id="hire-barracks-used">0</span> <span style={{ color: 'var(--text3)', fontWeight: 400 }}>/</span> <span id="hire-barracks-cap" style={{ color: 'var(--gold)' }}>0</span>
            </div>
          </div>
          <div style={{ padding: '4px 8px' }}>
            <div style={{ fontSize: '9px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Schools</div>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>
              <span id="hire-school-used">0</span> <span style={{ color: 'var(--text3)', fontWeight: 400 }}>/</span> <span id="hire-school-cap" style={{ color: 'var(--gold)' }}>0</span>
            </div>
          </div>
          <div style={{ padding: '4px 8px' }}>
            <div style={{ fontSize: '9px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Smithies</div>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>
              <span id="hire-smithy-used">0</span> <span style={{ color: 'var(--text3)', fontWeight: 400 }}>/</span> <span id="hire-smithy-cap" style={{ color: 'var(--gold)' }}>0</span>
            </div>
          </div>
          <div style={{ padding: '4px 8px' }}>
            <div style={{ fontSize: '9px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Library</div>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>
              <span id="hire-library-used">0</span> <span style={{ color: 'var(--text3)', fontWeight: 400 }}>/</span> <span id="hire-library-cap" style={{ color: 'var(--gold)' }}>0</span>
            </div>
          </div>
        </div>

        <div className="hire-row hire-header" style={{ borderBottom: '2px solid var(--border2)', fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: '8px', marginBottom: '8px' }}>
          <span>Unit</span>
          <span>In service</span>
          <span>Price</span>
          <span>Action</span>
        </div>

        {UNIT_ROWS.map((row) => {
          if (row.hideWhenRace && row.hideWhenRace === state?.race) return null;
          return (
            <div className="hire-row" key={row.key}>
              <div>
                <div className="hname">{row.icon} {row.label}</div>
                <div className="hdesc">{row.desc}</div>
              </div>
              <div className="hcount" id={`h-${row.key}`}>{unitCount(row.key)}</div>
              <div className="hprice" id={`hp-${row.key}`}>{row.price} GC</div>
              <div className="hbtns" style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                <input
                  type="number"
                  className="input"
                  id={`hire-${row.key}`}
                  min="0"
                  value={quantities[row.key] || ''}
                  onChange={(e) => setQuantities((prev) => ({ ...prev, [row.key]: e.target.value }))}
                  style={{ textAlign: 'right', width: '60px' }}
                  placeholder="Qty"
                />
                <button className="base-btn" style={{ fontSize: '10px', padding: '3px 6px' }} onClick={() => setMaxValue(row)}>Max</button>
                <button className="base-btn variant-gold" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--gold)', color: '#000' }} onClick={() => hire(row)}>Hire</button>
                <button className="base-btn variant-red" style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--red)' }} onClick={() => fire(row)}>Fire</button>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text3)', padding: '0 4px' }}>
        Hired units are subtracted from the population pool. Population returns over time based on happiness and entertainment.
      </div>
    </div>
  );
};

export default HirePanel;
