import { apiCall } from "./panelNav.js";
import { loadKingdom } from "../components/react/AuthModal.jsx";
import { showToast } from "./toastShell.js";

function escapeHtml(text) {
  if (!text) return "";

  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };

  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

function renderFragmentBonusDetails(fragment) {
  let html = "";

  for (const building of fragment.buildings) {
    html += `<div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--border); font-size: 12px;">`;
    html += `<strong>${escapeHtml(building.buildingType)}:</strong><br>`;

    if (building.bonuses && Object.keys(building.bonuses).length > 0) {
      html += `<div style="margin-left: 8px; color: var(--text3);">`;
      for (const [key, value] of Object.entries(building.bonuses)) {
        const displayVal = value > 0 ? "+" + (value * 100).toFixed(0) + "%" : (value * 100).toFixed(0) + "%";
        html += `${escapeHtml(key)}: <span style="color: var(--green)">${displayVal}</span><br>`;
      }
      html += `</div>`;
    }

    if (building.special && building.special.name) {
      html += `<div style="margin-top: 4px; margin-left: 8px; color: var(--amber); font-size: 11px;">`;
      html += `<strong> ${escapeHtml(building.special.name)}:</strong> ${escapeHtml(building.special.desc)}`;
      html += `</div>`;
    }

    html += `</div>`;
  }

  return html;
}

function toggleFragmentDetails(index, { documentRef = document } = {}) {
  const el = documentRef.getElementById(`frag-details-${index}`);
  if (el) {
    el.style.display = el.style.display === "none" ? "block" : "none";
  }
}

function renderCurrentAttunements(attunements, { documentRef = document } = {}) {
  const container = documentRef.getElementById("attunement-current-list");
  if (!container) return;

  if (attunements.length === 0) {
    container.innerHTML = '<div style="color: var(--text3); font-size: 13px;">No active attunements yet. Select one below!</div>';
    return;
  }

  container.innerHTML = attunements
    .map((att) => `
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 12px;
        background: rgba(16, 185, 129, 0.08);
        border: 1px solid rgba(16, 185, 129, 0.2);
        border-radius: 6px;
      ">
        <div style="flex: 1;">
          <div style="font-weight: 600; color: var(--green); font-size: 13px;">
            ${escapeHtml(att.fragmentName)}  ${escapeHtml(att.buildingType)}
          </div>
          ${att.special && att.special.name ? `
            <div style="color: var(--text3); font-size: 11px; margin-top: 4px;">
              <strong>${escapeHtml(att.special.name)}:</strong> ${escapeHtml(att.special.desc)}
            </div>
          ` : ""}
          <div style="color: var(--text3); font-size: 11px; margin-top: 4px;">
            Applied Turn: ${att.appliedTurn || "?"}
          </div>
        </div>
        <button
          onclick="removeAttunement('${escapeHtml(att.buildingType)}')"
          style="
            padding: 6px 12px;
            background: rgba(180, 60, 0, 0.2);
            border: 1px solid rgba(180, 60, 0, 0.4);
            border-radius: 4px;
            color: var(--red);
            font-size: 11px;
            cursor: pointer;
            flex-shrink: 0;
            margin-left: 12px;
            font-family: Inter, sans-serif;
            font-weight: 600;
          "
        >
          Unattune
        </button>
      </div>
    `)
    .join("");
}

function renderAvailableAttunements(available, { documentRef = document } = {}) {
  const container = documentRef.getElementById("attunement-available-list");
  if (!container) return;

  if (available.length === 0) {
    container.innerHTML = '<div style="color: var(--text3); font-size: 13px;">No fragments available to attune. You may have all available fragments already attuned!</div>';
    return;
  }

  container.innerHTML = available
    .map((frag, idx) => `
      <div style="
        padding: 14px;
        background: rgba(240, 98, 2, 0.08);
        border: 1px solid rgba(240, 98, 2, 0.2);
        border-radius: 6px;
      ">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
          <div style="font-weight: 600; color: var(--gold); font-size: 14px;">
            ${escapeHtml(frag.fragmentName)}
          </div>
          <button
            onclick="toggleFragmentDetails(${idx})"
            style="
              padding: 4px 8px;
              background: none;
              border: 1px solid var(--border2);
              border-radius: 4px;
              color: var(--text3);
              font-size: 11px;
              cursor: pointer;
              font-family: Inter, sans-serif;
            "
          >
            Details
          </button>
        </div>
        <div id="frag-details-${idx}" style="display: none; margin-bottom: 10px; padding: 10px; background: rgba(0, 0, 0, 0.2); border-radius: 4px; font-size: 12px;">
          ${renderFragmentBonusDetails(frag)}
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${frag.buildings
            .map(
              (building) => `
                <button
                  onclick="showFragmentBuildingConfirm('${escapeHtml(frag.fragmentName)}', '${escapeHtml(building.buildingType)}')"
                  style="
                    padding: 8px 12px;
                    background: var(--gold);
                    color: #000;
                    border: none;
                    border-radius: 4px;
                    font-weight: 600;
                    font-size: 12px;
                    cursor: pointer;
                    text-align: left;
                    transition: all 0.2s;
                    font-family: Inter, sans-serif;
                  "
                  onmouseover="this.style.opacity='0.8'"
                  onmouseout="this.style.opacity='1'"
                >
                  Attune to ${escapeHtml(building.buildingType)} (${building.count} owned)
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
    `)
    .join("");
}

export async function openAttunementModal({ documentRef = document } = {}) {
  const modal = documentRef.getElementById("attunement-modal");
  if (modal) {
    modal.style.display = "flex";
    await loadAttunementData({ documentRef });
  }
}

export function closeAttunementModal({ documentRef = document } = {}) {
  const modal = documentRef.getElementById("attunement-modal");
  if (modal) {
    modal.style.display = "none";
  }
}

export async function loadAttunementData({ documentRef = document } = {}) {
  const loadingEl = documentRef.getElementById("attunement-loading");
  const errorEl = documentRef.getElementById("attunement-error");

  if (loadingEl) loadingEl.style.display = "block";
  if (errorEl) errorEl.style.display = "none";

  try {
    const statusRes = await apiCall("/api/kingdom/attunements");
    if (statusRes.error) throw new Error(statusRes.error);

    const availRes = await apiCall("/api/kingdom/available-attunements");
    if (availRes.error) throw new Error(availRes.error);

    renderCurrentAttunements(statusRes.attunements || [], { documentRef });
    renderAvailableAttunements(availRes.available || [], { documentRef });

    if (loadingEl) loadingEl.style.display = "none";
  } catch (err) {
    if (errorEl) {
      errorEl.style.display = "block";
      errorEl.textContent = "Error loading attunements: " + err.message;
    }
    if (loadingEl) loadingEl.style.display = "none";
  }
}

export function showFragmentBuildingConfirm(fragmentName, buildingType, { windowRef = window } = {}) {
  const confirmed = windowRef.confirm(
    `Attune "${fragmentName}" to ${buildingType}?\n\n` +
      `This will apply the fragment's bonuses to all ${buildingType} in your kingdom.`,
  );

  if (confirmed) {
    applyAttunement(fragmentName, buildingType, { windowRef });
  }
}

export async function applyAttunement(fragmentName, buildingType, { documentRef = document } = {}) {
  const loadingEl = documentRef.getElementById("attunement-loading");
  const errorEl = documentRef.getElementById("attunement-error");

  if (loadingEl) loadingEl.style.display = "block";
  if (errorEl) errorEl.style.display = "none";

  try {
    const res = await apiCall("/api/kingdom/attune-fragment", {
      method: "POST",
      body: {
        fragmentName,
        buildingType,
      },
    });

    if (res.error) throw new Error(res.error);

    showToast(` ${fragmentName} attuned to ${buildingType}!`, "success");
    await loadAttunementData({ documentRef });
    await loadKingdom();

    if (loadingEl) loadingEl.style.display = "none";
  } catch (err) {
    if (errorEl) {
      errorEl.style.display = "block";
      errorEl.textContent = "Error applying attunement: " + err.message;
    }
    if (loadingEl) loadingEl.style.display = "none";
  }
}

export async function removeAttunement(buildingType, { documentRef = document } = {}) {
  const confirmed = window.confirm(
    `Remove attunement from ${buildingType}?\n\nYou can reattune this building type to a different fragment later.`,
  );

  if (!confirmed) return;

  try {
    const res = await apiCall("/api/kingdom/remove-attunement", {
      method: "POST",
      body: { buildingType },
    });

    if (res.error) throw new Error(res.error);

    showToast(` Attunement removed from ${buildingType}!`, "success");
    await loadAttunementData({ documentRef });
    await loadKingdom();
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
}

export function toggleFragmentDetailsPublic(index, { documentRef = document } = {}) {
  toggleFragmentDetails(index, { documentRef });
}
