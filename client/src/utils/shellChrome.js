function setDisplay(el, value) {
  if (el) el.style.display = value;
}

function setPointerEvents(el, value) {
  if (el) el.style.pointerEvents = value;
}

function incrementBadge(id, displayValue) {
  const badge = document.getElementById(id);
  if (!badge) return;
  badge.style.display = displayValue;
  badge.textContent = (parseInt(badge.textContent) || 0) + 1;
}

function clearBadge(id) {
  const badge = document.getElementById(id);
  if (!badge) return;
  badge.style.display = "none";
  badge.textContent = "";
}

function clearNewsBadges() {
  clearBadge("news-badge");
  clearBadge("bnav-news-badge");
}

function syncAuthModalVisibility(event) {
  const visible = event?.detail?.visible ?? false;
  setDisplay(document.getElementById("app"), visible ? "none" : "");
  setDisplay(document.getElementById("bottom-nav"), visible ? "none" : "");
  setDisplay(document.getElementById("login-overlay"), visible ? "flex" : "none");

  if (!visible) {
    setDisplay(document.getElementById("password-reset-modal"), "none");
    setDisplay(document.getElementById("registration-modal"), "none");
  }
}

function showChatBadgeAlert() {
  const chatBadge = document.getElementById("chat-badge");
  if (chatBadge) chatBadge.style.display = "inline";

  const navChat = document.getElementById("nav-chat-item");
  if (navChat && !navChat.classList.contains("nav-flash")) navChat.classList.add("nav-flash");

  const bnavChat = document.getElementById("bnav-chat-item");
  if (bnavChat && !bnavChat.classList.contains("nav-flash")) bnavChat.classList.add("nav-flash");
}

function syncKingdomProfileModal(event) {
  const visible = event?.detail?.visible ?? false;
  setDisplay(document.getElementById("kingdom-profile-modal"), visible ? "flex" : "none");
  setPointerEvents(document.getElementById("app"), visible ? "none" : "");
  setPointerEvents(document.getElementById("bottom-nav"), visible ? "none" : "");
}

export function bindShellChromeEvents() {
  if (window.__shellChromeBound) return;
  window.__shellChromeBound = true;
  window.addEventListener("narmir:clear-news-badges", clearNewsBadges);
  window.addEventListener("narmir:auth-modal-visibility", syncAuthModalVisibility);
  window.addEventListener("narmir:chat-badge-alert", showChatBadgeAlert);
  window.addEventListener("narmir:kingdom-profile-modal", syncKingdomProfileModal);
}

