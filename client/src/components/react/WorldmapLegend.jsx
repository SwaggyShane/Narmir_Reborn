import { RACE_ICONS } from '../../utils/raceIcons.js';
import { getWorldMapData } from '../../utils/worldMapData.js';

const REGION_META = {
  dwarf: {
    name: 'The Iron Holds',
    color: '#8B6914',
    stroke: '#c8962a',
    icon: '🏔️',
  },
  high_elf: {
    name: 'The Silverwood',
    color: '#1a4a2e',
    stroke: '#4caf82',
    icon: '🌿',
  },
  orc: {
    name: 'The Bloodplains',
    color: '#4a1010',
    stroke: '#e05c5c',
    icon: '⚔️',
  },
  dark_elf: {
    name: 'The Underspire',
    color: '#1a1030',
    stroke: 'var(--accent1)',
    icon: '🕵️',
  },
  human: {
    name: 'The Heartlands',
    color: '#1a2a10',
    stroke: '#8fb84a',
    icon: '🌾',
  },
  dire_wolf: {
    name: 'The Ashfang Wilds',
    color: '#0d1a20',
    stroke: '#4a8fb8',
    icon: '🐺',
  },
};

const REGION_BONUSES = {
  dwarf: 'Improved construction speed',
  high_elf: 'Increased mana production',
  orc: 'Superior military strength',
  dark_elf: 'Enhanced stealth and covert ops',
  human: 'Better economy',
  dire_wolf: 'Superior military strength',
  vampire: 'Night combat specialization',
};

export function renderRegionLegend() {
  const el = document.getElementById('region-legend-list');
  if (!el) return;

  const worldMapData = getWorldMapData();
  el.innerHTML = Object.entries(REGION_META)
    .map(([race, meta]) => {
      const icon = RACE_ICONS[race] || meta.icon || '?';
      const count = worldMapData.filter((k) => k.race === race).length;
      const bonus = REGION_BONUSES[race] || '';
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="highlightRegion('${race}')">
          <span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:${meta.color};border:1.5px solid ${meta.stroke};flex-shrink:0"></span>
          <span style="font-size:14px">${icon}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;color:var(--text);font-weight:600">${meta.name}</div>
            <div style="font-size:10px;color:var(--text3)">${bonus} | ${count} kingdoms</div>
          </div>
        </div>`;
    })
    .join('');
}

export function highlightRegion(race) {
  const svgEl = document.querySelector('#world-map-container svg');
  if (!svgEl) return;

  svgEl.querySelectorAll('.region-shape').forEach((s) => {
    s.style.opacity = s.dataset.race === race ? '1' : '0.3';
  });

  svgEl.querySelectorAll('.kd-dot').forEach((d) => {
    d.style.opacity = d.dataset.race === race ? '1' : '0.2';
  });
}
