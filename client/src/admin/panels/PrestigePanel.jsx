import React from 'react';
import {
  PRESTIGE_MODIFIERS,
  PRESTIGE_LEVEL_GATE,
  PRESTIGE_COOLDOWN_TURNS,
  formatMultDelta,
  landSeed,
  goldSeed,
} from '../../utils/prestigeBalance.js';
import {
  EVOLUTION_PRESTIGE_GATE,
  RITUAL_TURNS,
  DRAGON_FORM,
  RITUAL_CHANNEL_DEFENSE_MULT,
} from '../../utils/evolutionBalance.js';

/** Live mult table from client mirror of game/prestige/balance.js (EVOLUTION.md). */
const TIERS = [1, 2, 3, 4, 5].map((tier) => {
  const m = PRESTIGE_MODIFIERS[tier];
  return {
    tier,
    buildingCaps: formatMultDelta(m.bldCap),
    economy: formatMultDelta(m.econ),
    combat: formatMultDelta(m.combat),
    popCap: formatMultDelta(m.pop),
    land: landSeed(tier),
    gold: goldSeed(tier),
  };
});

export default function PrestigePanel() {
  return (
    <div>
      <div style={{ color: 'var(--text3)', fontSize: 13, lineHeight: 1.6, marginBottom: 20, maxWidth: 700 }}>
        Prestige rebirth (EVOLUTION.md Roadmap A): level {PRESTIGE_LEVEL_GATE} (max), full wipe contract (land seed,
        starter buildings, army/buildings/fragments wiped; top 3 heroes kept). Cooldown {PRESTIGE_COOLDOWN_TURNS} turns
        (~3.5 days). Mults hard-cap at Prestige 5. XP costs +20% per prestige rank. Combat mult applied once in combat
        resolver (max 1.05). Numbers mirror <code>game/prestige/balance.js</code>.
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
              <th style={TH}>Land seed</th>
              <th style={TH}>Gold seed</th>
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
                <td style={TD}>{row.land.toLocaleString()}</td>
                <td style={TD}>{row.gold.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 16 }}>
        Prestige 6+ keeps P5 mults (hard cap). Titles only beyond that.
      </div>

      <div style={{ color: 'var(--text3)', fontSize: 13, lineHeight: 1.6, margin: '28px 0 12px', maxWidth: 700 }}>
        <strong style={{ color: 'var(--gold)' }}>Dragon evolution (Roadmap B)</strong> — optional form, not free combat.
        Requires Prestige {EVOLUTION_PRESTIGE_GATE}+, <code>dragon_egg</code> (epic trek artifact), and a castle for{' '}
        {RITUAL_TURNS} turns of channeling (channel defense ×{RITUAL_CHANNEL_DEFENSE_MULT}). Egg is spent on start.
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={TABLE}>
          <thead>
            <tr>
              <th style={TH}>Form</th>
              <th style={TH}>Defense</th>
              <th style={TH}>Upkeep</th>
              <th style={TH}>Terror (vs lower P)</th>
              <th style={TH}>Hoard econ</th>
              <th style={TH}>Global combat %</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...TD, fontWeight: 600, color: 'var(--gold)' }}>Dragon</td>
              <td style={TD}>×{DRAGON_FORM.defenseMult}</td>
              <td style={TD}>×{DRAGON_FORM.upkeepMult}</td>
              <td style={TD}>×{DRAGON_FORM.terrorVsLowerPrestige}</td>
              <td style={TD}>×{DRAGON_FORM.hoardEconMult}</td>
              <td style={{ ...TD, color: 'var(--text3)' }}>none (prestige only, max 1.05)</td>
            </tr>
          </tbody>
        </table>
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
