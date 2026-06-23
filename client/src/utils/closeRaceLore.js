export function closeRaceLore({ documentRef = document } = {}) {
  const modal = documentRef.getElementById("race-lore-modal");
  if (modal) modal.style.display = "none";
}
