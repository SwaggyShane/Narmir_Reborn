const jwt = require("jsonwebtoken");
const crypto = require("crypto");

if (!process.env.JWT_SECRET) {
  throw new Error("CRITICAL: JWT_SECRET environment variable is required. Set it before starting the server.");
}
const JWT_SECRET = process.env.JWT_SECRET;

const csrfTokens = new Map();
const CSRF_TOKEN_TTL_MS = 15 * 60 * 1000;

function generateCsrfToken(playerId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + CSRF_TOKEN_TTL_MS;
  csrfTokens.set(token, { playerId, expiresAt });
  return token;
}

function requireAuth(req, res, next) {
  const token =
    req.cookies?.token ||
    req.headers.authorization?.replace("Bearer ", "") ||
    req.headers["x-auth-token"];
  if (!token) {
    console.log('[requireAuth] No token found. Cookies:', Object.keys(req.cookies || {}), 'Headers:', { auth: req.headers.authorization ? 'present' : 'missing', custom: req.headers["x-auth-token"] ? 'present' : 'missing' });
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    req.player = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    console.log('[requireAuth] Token verification failed:', err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireAdmin(req, res, next) {
  const token =
    req.cookies?.token ||
    req.headers.authorization?.replace("Bearer ", "") ||
    req.headers["x-auth-token"];
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    req.player = jwt.verify(token, JWT_SECRET);
    if (!req.player.isAdmin)
      return res.status(403).json({ error: "Admin access required" });
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireCsrfToken(req, res, next) {
  const token = req.headers["x-csrf-token"] || req.body?.csrf_token;
  if (!token) {
    return res.status(403).json({ error: "CSRF token required" });
  }

  const tokenData = csrfTokens.get(token);
  if (!tokenData) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  if (Date.now() > tokenData.expiresAt) {
    csrfTokens.delete(token);
    return res.status(403).json({ error: "CSRF token expired" });
  }

  if (tokenData.playerId !== req.player.playerId) {
    return res.status(403).json({ error: "CSRF token does not match user session" });
  }

  csrfTokens.delete(token);
  next();
}

module.exports = { requireAuth, requireAdmin, requireCsrfToken, generateCsrfToken, csrfTokens };
