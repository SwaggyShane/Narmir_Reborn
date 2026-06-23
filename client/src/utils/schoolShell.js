export function openSchoolModal({ documentRef = document, windowRef = window } = {}) {
  const modal = documentRef.getElementById("school-modal");

  if (!modal) return;

  const optionsDiv = documentRef.getElementById("school-options");
  if (optionsDiv) optionsDiv.replaceChildren();

  const magicSchools = windowRef.MAGIC_SCHOOLS || {};

  Object.keys(magicSchools).forEach((key) => {
    const school = magicSchools[key];
    const btn = documentRef.createElement("button");

    btn.className = "btn";
    btn.style.cssText = `
              padding: 12px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              border: 2px solid var(--border2);
              background: var(--bg3);
              color: var(--text1);
              border-radius: var(--radius);
              transition: all 0.2s ease;
            `;
    btn.innerHTML = `
              <div style="font-size: 24px; margin-bottom: 4px;">${school.icon}</div>
              <div style="font-size: 13px; font-weight: bold;">${school.name}</div>
              <div style="font-size: 11px; color: var(--text3); margin-top: 2px;">${school.desc}</div>
            `;
    btn.onmouseover = () => {
      btn.style.borderColor = "var(--gold)";
      btn.style.background = "var(--bg2)";
    };
    btn.onmouseout = () => {
      btn.style.borderColor = "var(--border2)";
      btn.style.background = "var(--bg3)";
    };
    btn.onclick = () => {
      if (typeof windowRef.selectSchool === "function") {
        windowRef.selectSchool(key);
      }
    };

    optionsDiv?.appendChild(btn);
  });

  modal.style.display = "flex";
  documentRef.body.style.overflow = "hidden";
}

export function closeSchoolModal({ documentRef = document } = {}) {
  const modal = documentRef.getElementById("school-modal");

  if (modal) {
    modal.style.display = "none";
    documentRef.body.style.overflow = "";
  }
}
