export function openGenericModal(htmlContent, { documentRef = document } = {}) {
  const content = documentRef.getElementById("generic-modal-content");
  if (content) content.innerHTML = htmlContent;

  const modal = documentRef.getElementById("generic-modal");
  if (modal) modal.style.display = "flex";
}

export function closeGenericModal({ documentRef = document } = {}) {
  const modal = documentRef.getElementById("generic-modal");
  if (modal) modal.style.display = "none";
}
