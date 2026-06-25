import React from 'react';
import { repairMojibake } from '../../utils/repairMojibake.js';
import { fmt } from '../../utils/fmt.js';
import HeroLorePortrait from './HeroLorePortrait.jsx';

export default function HeroLoreContent({ heroKey, hero }) {
  const repair = (v) => repairMojibake(String(v ?? ''));
  const abilities = Array.isArray(hero.abilities) ? hero.abilities : [];

  return (
    <>
      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <HeroLorePortrait heroKey={heroKey} alt={repair(hero.name || '')} />
        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>
          {repair(hero.name || '')}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Legendary Hero Class
        </div>
      </div>

      {abilities.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Signature Abilities
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {abilities.map((a, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>
                  {repair(a.name || '')}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
                  {repair(a.description || '')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{ background: 'var(--bg4)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase' }}>Recruit Cost</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gold)' }}>{fmt(hero.recruitCost)} GC</div>
        </div>
        <div style={{ background: 'var(--bg4)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase' }}>Mana Cost</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--blue)' }}>{fmt(hero.recruitMana)} ✨</div>
        </div>
      </div>
    </>
  );
}