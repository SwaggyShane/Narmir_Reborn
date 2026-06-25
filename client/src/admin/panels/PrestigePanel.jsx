import React from 'react';

const TIERS = [
  { tier: 1, buildingCaps: '+25%', economy: '+5%',  combat: null,  popCap: null },
  { tier: 2, buildingCaps: '+50%', economy: '+10%', combat: null,  popCap: null },
  { tier: 3, buildingCaps: '+75%', economy: '+15%', combat: '+5%', popCap: null },
  { tier: 4, buildingCaps: '+100%',economy: '+20%', combat: '+5%', popCap: null },
  { tier: 5, buildingCaps: '+150%',economy: '+30%', combat: '+10%',popCap: '+25%' },
];

export default function PrestigePanel() {
  return (
    <div>
      <div style={{ color: 'var(--text3)', fontSize: 13, lineHeight: 1.6, marginBottom: 20, maxWidth: 700 }}>
        Players can transcend their kingdom upon reaching Level 50. Doing so resets land, wealth, and population,
        but retains heroes, trade routes, and grants permanent scaling bonuses based on Prestige Level.
        Each tier also increases XP required per level by 20%.
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={TABLE}>
          <thead><tr>
            <th style={TH}>Tier</th>
            <th style={TH}>Building Caps</th>
            <th style={TH}>Economy (Markets / Trade)</th>
            <th style={TH}>Combat Power</th>
            <th style={TH}>Population Cap</th>
            <th style={TH}>Notes</th>
          </tr></thead>
          <tbody>
            {TIERS.map(row => (
              <tr key={row.tier}>
                <td style={{ ...TD, fontWeight: 600, color: 'var(--gold)' }}>Tier {row.tier}</td>
                <td style={{ ...TD, color: 'var(--green, #6c6)' }}>{row.buildingCaps}</td>
                <td style={{ ...TD, color: 'var(--green, #6c6)' }}>{row.economy}</td>
                <td style={{ ...TD, color: row.combat ? 'var(--gold)' : 'var(--text3)' }}>{row.combat || '-'}</td>
                <td style={{ ...TD, color: row.popCap ? 'var(--gold)' : 'var(--text3)' }}>{row.popCap || '-'}</td>
                <td style={{ ...TD, color: 'var(--text3)', fontSize: 11 }}>
                  {row.tier === 2 && 'Unlocks race-specific special buildings'}
                  {row.tier === 4 && 'Unlocks race-specific special troops (in design)'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 16, fontStyle: 'italic' }}>
        Tier 2 unlocks race-specific special buildings. Tier 4 unlocks special race-specific troops (currently in development).
      </div>
    </div>
  );
}

const TABLE = { width: '100%', borderCollapse: 'collapse', fontSize: 13, color: 'var(--text2)' };
const TH = { padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--border2)', color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' };
const TD = { padding: '8px 10px', borderBottom: '1px solid var(--border3, #2a2a2a)', whiteSpace: 'nowrap' };
