function positionToastContainer(node, windowRef) {
  if (!node) return;

  const isMobile = windowRef.innerWidth <= 768;

  node.style.position = "fixed";
  node.style.zIndex = "99999";
  node.style.display = "flex";
  node.style.flexDirection = "column";
  node.style.gap = "8px";
  node.style.pointerEvents = "none";
  node.style.left = "50%";
  node.style.right = "auto";
  node.style.top = "auto";
  node.style.bottom = isMobile ? "88px" : "24px";
  node.style.alignItems = "center";
  node.style.transform = "translateX(-50%)";
  node.style.width = "min(92vw, 420px)";
}

export function showToast(message, type = "info", { documentRef = document, windowRef = window } = {}) {
  const kind = type || "info";
  const toastTheme =
    {
      success: {
        border: "#00ff2b",
        text: "#7dff86",
        glow: "rgba(0, 255, 43, 0.22)",
      },
      error: {
        border: "#ff5f5f",
        text: "#ffb4b4",
        glow: "rgba(255, 95, 95, 0.18)",
      },
      warning: {
        border: "#f4c95d",
        text: "#ffe7a4",
        glow: "rgba(244, 201, 93, 0.18)",
      },
      warn: {
        border: "#f4c95d",
        text: "#ffe7a4",
        glow: "rgba(244, 201, 93, 0.18)",
      },
      info: {
        border: "#67b7ff",
        text: "#cbe5ff",
        glow: "rgba(103, 183, 255, 0.18)",
      },
      system: {
        border: "#8b93a7",
        text: "#e4e7ef",
        glow: "rgba(139, 147, 167, 0.12)",
      },
    }[kind] || {
      border: "#8b93a7",
      text: "#e4e7ef",
      glow: "rgba(139, 147, 167, 0.12)",
    };

  let container = documentRef.getElementById("toast-container");

  if (!container) {
    container = documentRef.createElement("div");
    container.id = "toast-container";
    positionToastContainer(container, windowRef);
    documentRef.body.appendChild(container);

    if (!windowRef._toastResizeBound) {
      windowRef.addEventListener("resize", function () {
        positionToastContainer(documentRef.getElementById("toast-container"), windowRef);
      });
      windowRef._toastResizeBound = true;
    }
  } else {
    positionToastContainer(container, windowRef);
  }

  if (container) {
    container.replaceChildren();
  }

  const toastEl = documentRef.createElement("div");
  toastEl.style.minWidth = "240px";
  toastEl.style.maxWidth = "100%";
  toastEl.style.padding = "10px 12px";
  toastEl.style.borderRadius = "8px";
  toastEl.style.fontSize = "13px";
  toastEl.style.lineHeight = "1.4";
  toastEl.style.background = "rgba(0,0,0,0.04)";
  toastEl.style.border = "1px solid " + toastTheme.border;
  toastEl.style.color = toastTheme.text;
  toastEl.style.boxShadow =
    "0 10px 26px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(0,0,0,0.25), inset 0 0 18px rgba(0,0,0,0.25), 0 0 18px " +
    toastTheme.glow;
  toastEl.style.pointerEvents = "auto";
  toastEl.style.textAlign = "center";
  toastEl.textContent = String(message || "");

  container.appendChild(toastEl);

  windowRef.setTimeout(function () {
    if (toastEl && toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
  }, 4500);

  return toastEl;
}
