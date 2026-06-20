import { apiCall } from "../utils/api.js";

export async function loadWorldMap() {
  const container = document.getElementById("world-map-container");
  if (container) {
    container.innerHTML =
      '<div style="padding:40px;text-align:center;color:var(--text3)">Scanning the horizon...</div>';
  }

  try {
    const data = await apiCall("GET", "/api/kingdom/world-map");
    if (data.error) throw new Error(data.error);

    const kingdoms = data.kingdoms || (Array.isArray(data) ? data : []);
    window.worldMapData = kingdoms;
    window.renderWorldMap?.(kingdoms, data.tradeRoutes || []);
    window.renderRegionLegend?.();
  } catch (err) {
    console.error("World map fail:", err);
    if (container) {
      container.innerHTML =
        '<div style="padding:40px;text-align:center;color:var(--red)">Failed to load world map. <button class="btn" onclick="loadWorldMap()" style="margin-top:10px">Retry</button></div>';
    }
    throw err;
  }
}
