import { RACE_ICONS } from '../../utils/raceIcons.js';
import { getWorldMapData } from '../../utils/worldMapData.js';
import { REGION_META, REGION_BONUSES } from '../../utils/raceData.js';

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

if (typeof window !== 'undefined') {
  window.highlightRegion = highlightRegion;
}
