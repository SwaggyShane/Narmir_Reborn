import { apiCall } from "../utils/api.js";

function clearAuthError(message) {
  const error = document.getElementById("auth-error");
  if (error) error.textContent = message || "";
}

function setAuthModalVisibility(show) {
  const overlay = document.getElementById("login-overlay");
  if (overlay) overlay.style.display = show ? "flex" : "none";
}

export function updatePasswordRequirements() {
  const input = document.getElementById("auth-pass");
  const panel = document.getElementById("password-requirements");
  if (!input || !panel) return;

  const value = input.value || "";
  const checks = [
    { id: "req-length", ok: value.length >= 8, label: "8+ characters" },
    { id: "req-upper", ok: /[A-Z]/.test(value), label: "Uppercase letter" },
    { id: "req-lower", ok: /[a-z]/.test(value), label: "Lowercase letter" },
    { id: "req-number", ok: /\d/.test(value), label: "Number (0-9)" },
    { id: "req-special", ok: /[@$!%*?&]/.test(value), label: "Special char (@$!%*?&)" },
  ];

  let allOk = true;
  for (const c of checks) {
    const el = document.getElementById(c.id);
    if (el) {
      el.textContent = (c.ok ? "✓ " : "✗ ") + c.label;
      el.style.color = c.ok ? "var(--green)" : "var(--red)";
    }
    if (!c.ok) allOk = false;
  }

  if (panel) {
    panel.style.display = "block";
    panel.dataset.ready = allOk ? "true" : "false";
  }
}

export function initLoginModal() {
  const registerFields = document.getElementById("register-fields");
  if (registerFields) registerFields.style.display = "block";
  clearAuthError("");
  const passwordReset = document.getElementById("password-reset-modal");
  if (passwordReset) passwordReset.style.display = "none";
  const overlay = document.getElementById("login-overlay");
  if (overlay && overlay.style.display !== "none") overlay.style.display = "flex";
  updatePasswordRequirements();
}

export function showLoginModal() {
  const app = document.getElementById("app");
  if (app) app.style.display = "none";
  const bn = document.getElementById("bottom-nav");
  if (bn) bn.style.display = "none";
  initLoginModal();
  setAuthModalVisibility(true);
  const user = document.getElementById("auth-user");
  if (user) {
    setTimeout(function () {
      try {
        user.focus();
      } catch {}
    }, 0);
  }
}

export function hideLoginModal() {
  setAuthModalVisibility(false);
  clearAuthError("");
  const passwordReset = document.getElementById("password-reset-modal");
  if (passwordReset) passwordReset.style.display = "none";
  const app = document.getElementById("app");
  if (app) app.style.display = "";
  const bn = document.getElementById("bottom-nav");
  if (bn) bn.style.display = "";
  closeRegistrationModal();
}

export function showPasswordReset() {
  const modal = document.getElementById("password-reset-modal");
  if (modal) modal.style.display = "flex";
}

export function closeRegistrationModal() {
  const modal = document.getElementById("registration-modal");
  if (modal) modal.style.display = "none";
}

export function backToRaceSelection() {
  const details = document.getElementById("race-details-section");
  if (details) details.style.display = "none";
  const content = document.getElementById("registration-content");
  if (content) content.scrollTop = 0;
}

export function clearToken() {
  try {
    localStorage.removeItem("narmir_token");
  } catch {}
  try {
    document.cookie = "token=; Max-Age=0; path=/";
    document.cookie = "csrf_token=; Max-Age=0; path=/";
  } catch {}
}

async function submitAuthRequest(endpoint, payload) {
  clearAuthError("");
  const res = await apiCall("POST", endpoint, payload);
  if (res && res.error) throw new Error(res.error);
  return res || {};
}

async function finishAuthSession(res, fallbackUsername) {
  hideLoginModal();
  try {
    const me = await apiCall("GET", "/api/auth/me");
    const state = typeof window !== "undefined" ? window.state || {} : {};
    if (me && !me.error) {
      state.username = me.username || fallbackUsername || state.username;
      state.isAdmin = !!me.isAdmin;
    } else {
      state.username = fallbackUsername || state.username;
    }
  } catch {
    const state = typeof window !== "undefined" ? window.state || {} : {};
    state.username = fallbackUsername || state.username;
  }

  if (typeof window !== "undefined" && typeof window.loadKingdom === "function") {
    await window.loadKingdom();
  }
  if (typeof window !== "undefined" && typeof window.initSocket === "function") {
    window.initSocket().catch(function (err) {
      console.warn("[socket] Failed to initialize after auth:", err);
    });
  }
  return res;
}

export async function doLogin() {
  try {
    const username = (document.getElementById("auth-user")?.value || "").trim();
    const password = document.getElementById("auth-pass")?.value || "";
    if (!username || !password) {
      clearAuthError("Username and password are required.");
      return;
    }
    const res = await submitAuthRequest("/api/auth/login", { username, password });
    await finishAuthSession(res, username);
  } catch (err) {
    clearAuthError(err.message || "Login failed.");
  }
}

export async function doRegister() {
  try {
    const username = (document.getElementById("auth-user")?.value || "").trim();
    const password = document.getElementById("auth-pass")?.value || "";
    const email = (document.getElementById("auth-email")?.value || "").trim();
    const kingdomName = (document.getElementById("auth-kingdom")?.value || "").trim();
    const race = document.getElementById("auth-race")?.value || "human";
    const gender = document.getElementById("auth-gender")?.value || "male";
    if (!username || !password || !email || !kingdomName) {
      clearAuthError("Username, password, email, and kingdom name are required.");
      return;
    }
    const res = await submitAuthRequest("/api/auth/register", {
      username,
      password,
      email,
      kingdomName,
      race,
      gender,
    });
    await finishAuthSession(res, username);
  } catch (err) {
    clearAuthError(err.message || "Registration failed.");
  }
}
