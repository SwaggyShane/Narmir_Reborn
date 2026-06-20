const escHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function openLoreModal(title, msg, isHtml) {
  const modal = document.getElementById("lore-entry-modal");
  const content = document.getElementById("lore-entry-content");
  if (modal) modal.style.display = "flex";
  const body = isHtml ? msg : escHtml(msg).replace(/\n/g, "<br>");
  if (content) {
    content.innerHTML =
      '<div style="text-align:center;margin-bottom:20px">' +
      '<h2 style="color:var(--gold);margin:0 0 4px;font-size:20px">' +
      escHtml(title) +
      "</h2>" +
      "</div>" +
      '<div style="font-size:14px;color:var(--text2);line-height:1.6;padding:12px;background:var(--bg3);border-radius:var(--radius);border:1px solid var(--border)">' +
      body +
      "</div>";
  }
}

export function closeLoreModal() {
  const modal = document.getElementById("lore-entry-modal");
  if (modal) modal.style.display = "none";
}
