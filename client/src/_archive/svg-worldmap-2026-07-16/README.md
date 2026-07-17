# Archived SVG world map (2026-07-16)

WebGL (`WorldmapWebGL.jsx`) became the only world map renderer; this is the
SVG renderer it replaced, kept as-is in case anything here is worth
recovering later. Not imported by anything — safe to delete once confirmed
unneeded.

- `WorldmapRenderer.jsx` — generated the SVG map markup (`renderWorldMap`).
- `useWorldMapViewport.js` — pan/zoom drag handling for the SVG viewport.
- `HexSVGHelpers.ts` / `HexRendererUtils.tsx` — were already unused before
  this archive; nothing under `client/src` imported them.
- `worldMapGsap.js.snapshot` — full original of `client/src/utils/worldMapGsap.js`
  before it was trimmed down to the two functions (`prefersReducedMotion`,
  `animateMapPanelCard`) that are still used for the sidebar detail cards,
  independent of which map renderer is active.
