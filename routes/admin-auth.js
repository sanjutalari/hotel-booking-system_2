const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();
const failedLogins = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const passwordHash = process.env.ADMIN_PASSWORD_HASH || "";

function loginState(key, now = Date.now()) {
  let state = failedLogins.get(key);
  if (!state || now - state.startedAt > WINDOW_MS || (state.blockedUntil && state.blockedUntil <= now)) {
    state = { startedAt: now, count: 0, blockedUntil: 0 };
    failedLogins.set(key, state);
  }
  return state;
}

router.post("/login", async (req, res) => {
  const allowedEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const jwtSecret = process.env.JWT_SECRET;
  if (!allowedEmail || !passwordHash || !jwtSecret) {
    return res.status(503).json({ error: "Administrator sign-in is not configured." });
  }

  const clientKey = req.ip || req.socket.remoteAddress || "unknown";
  const state = loginState(clientKey);
  if (state.blockedUntil > Date.now()) {
    return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
  }

  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!email || !password || password.length > 100) {
    state.count += 1;
    if (state.count >= MAX_ATTEMPTS) state.blockedUntil = Date.now() + LOCK_MS;
    return res.status(401).json({ error: "Email or password is incorrect." });
  }

  try {
    const passwordMatches = await bcrypt.compare(password, passwordHash);
    if (email !== allowedEmail || !passwordMatches) {
      state.count += 1;
      if (state.count >= MAX_ATTEMPTS) state.blockedUntil = Date.now() + LOCK_MS;
      return res.status(401).json({ error: "Email or password is incorrect." });
    }

    failedLogins.delete(clientKey);
    const user = { id: "admin", name: "StayBook Administrator", email, role: "admin" };
    const token = jwt.sign(
      { name: user.name, email: user.email, role: user.role },
      jwtSecret,
      { subject: user.id, expiresIn: "2h" }
    );
    return res.json({ token, user });
  } catch (error) {
    console.error("Administrator sign-in failed:", error.message);
    return res.status(503).json({ error: "Administrator sign-in is not configured correctly." });
  }
});

router.get("/me", authenticate, requireAdmin, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;