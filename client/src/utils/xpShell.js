export function closeXpModal({ documentRef = document, windowRef = window } = {}) {
  const xpmEl = documentRef.getElementById("xp-modal");

  if (xpmEl) xpmEl.style.display = "none";

  if (windowRef && windowRef.document && windowRef.document.body) {
    windowRef.document.body.style.overflow = "";
  }
}
