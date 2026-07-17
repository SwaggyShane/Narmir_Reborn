import React from 'react';

/** Mirrors game/prestige/balance.js PRESTIGE_MODIFIERS (EVOLUTION.md). */
const TIERS = [
  { tier: 1, buildingCaps: '+10%', economy: '+3%', combat: '—', popCap: '—' },
  { tier: 2, buildingCaps: '+20%', economy: '+6%', combat: '—', popCap: '—' },
  { tier: 3, buildingCaps: '+30%', economy: '+9%', combat: '+2%', popCap: '—' },
  { tier: 4, buildingCaps: '+40%', economy: '+12%', combat: '+3%', popCap: '+5%' },
  { tier: 5, buildingCaps: '+50%', economy: '+15%', combat: '+5%', popCap: '+10%' },
];

export default function PrestigePanel() {
  return (
    <div>
      <div style={{ color: 'var(--text3)', fontSize: 13, lineHeight: 1.6, marginBottom: 20, maxWidth: 700 }}>
        Prestige rebirth (EVOLUTION.md Roadmap A): level 500 (max), full wipe contract (land seed, starter buildings,
        army/buildings/fragments wiped; top 3 heroes kept). Cooldown 200 turns (~3.5 days). Mults hard-cap at
        Prestige 5. XP costs +20% per prestige rank. Combat mult applied once in combat resolver (max 1.05).
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={TABLE}>
          <thead>
            <tr>
              <th style={TH}>Tier</th>
              <th style={TH}>Building Caps</th>
              <th style={TH}>Economy</th>
              <th style={TH}>Combat</th>
              <th style={TH}>Population Cap</th>
            </tr>
          </thead>
          <tbody>
            {TIERS.map((row) => (
              <tr key={row.tier}>
                <td style={{ ...TD, fontWeight: 600, color: 'var(--gold)' }}>Tier {row.tier}</td>
                <td style={{ ...TD, color: 'var(--green, #6c6)' }}>{row.buildingCaps}</td>
                <td style={{ ...TD, color: 'var(--green, #6c6)' }}>{row.economy}</td>
                <td style={{ ...TD, color: row.combat !== '—' ? 'var(--gold)' : 'var(--text3)' }}>{row.combat}</td>
                <td style={{ ...TD, color: row.popCap !== '—' ? 'var(--gold)' : 'var(--text3)' }}>{row.popCap}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 16 }}>
        Prestige 6+ keeps P5 mults (hard cap). Titles only beyond that. Dragon evolution is Roadmap B (not shipped).
      </div>
    </div>
  );
}

const TABLE = { width: '100%', borderCollapse: 'collapse', fontSize: 13, color: 'var(--text2)' };
const TH = {
  padding: '8px 10px',
  textAlign: 'left',
  borderBottom: '1px solid var(--border2)',
  color: 'var(--text3)',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};
const TD = { padding: '8px 10px', borderBottom: '1px solid var(--border3, #2a2a2a)', whiteSpace: 'nowrap' };
