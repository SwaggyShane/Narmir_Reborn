import { apiCall } from "../utils/api.js";

export async function loadWarfarePanel() {
  const el = document.getElementById("war-log-list-warfare");
  if (el) {
    el.innerHTML =
      '<div style="color:var(--text3);font-size:13px;text-align:center;padding:24px 0">Loading reports...</div>';
    const result = await apiCall("GET", "/api/kingdom/war-log");
    const rows = Array.isArray(result)
      ? result
      : result && result.rows
        ? result.rows
        : [];
    if (typeof window.renderWarLog === "function") {
      window.renderWarLog(rows);
    }
  }

  if (typeof targets !== "undefined" && targets.length && typeof window.renderTargets === "function") {
    window.renderTargets(targets, "target-list-w", "selectTargetW");
  }
}
