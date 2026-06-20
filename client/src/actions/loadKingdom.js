import { apiCall, applyGameMutation } from "../utils/shellBridge.js";

export async function loadKingdom() {
  const kingdom = await apiCall("GET", "/api/kingdom/me");
  if (kingdom && !kingdom.error) {
    if (applyGameMutation) {
      applyGameMutation(kingdom, { reason: "kingdom-refresh" });
    }
  }
  return kingdom;
}
