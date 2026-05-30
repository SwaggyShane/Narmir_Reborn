const jwt = require("jsonwebtoken");
const crypto = require("crypto");

if (!process.env.JWT_SECRET) {
  throw new Error("CRITICAL: JWT_SECRET environment variable is required. Set it before starting the server.");
}
const JWT_SECRET = process.env.JWT_SECRET;

function generateCsrfToken() {
  return crypto.randomBytes(32).toString("hex");
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
    console.log('[requireAuth] Token verification failed:', err?.message || err);
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
  const headerToken = req.headers["x-csrf-token"];
  if (!headerToken) {
    return res.status(403).json({ error: "CSRF token required" });
  }

  const cookieToken = req.cookies?.csrf_token;
  if (!cookieToken) {
    return res.status(403).json({ error: "CSRF token missing from cookie" });
  }

  if (headerToken !== cookieToken) {
    return res.status(403).json({ error: "CSRF token mismatch" });
  }

  next();
}

function ensureCsrfToken(req, res, next) {
  // Set a fresh CSRF token on every authenticated response
  // Check if user is authenticated by verifying the token ourselves
  const token =
    req.cookies?.token ||
    req.headers.authorization?.replace("Bearer ", "") ||
    req.headers["x-auth-token"];

  if (token) {
    try {
      // Verify token is valid - if it is, user is authenticated
      jwt.verify(token, JWT_SECRET);
      // Token is valid, set a fresh CSRF token
      const csrfToken = generateCsrfToken();
      const csrfCookieOpts = {
        httpOnly: false,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: "none",
        secure: true,
      };
      res.cookie("csrf_token", csrfToken, csrfCookieOpts);
    } catch (e) {
      // Token is invalid, don't set CSRF token
    }
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireCsrfToken, ensureCsrfToken, generateCsrfToken };
