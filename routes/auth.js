const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db/pool");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
const tokenFor = (user) => jwt.sign(
  { name: user.name, email: user.email },
  process.env.JWT_SECRET,
  { subject: String(user.id), expiresIn: "2h" }
);

function ready(res) {
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    res.status(503).json({ error: "Authentication is not configured. Set DATABASE_URL and JWT_SECRET." });
    return false;
  }
  return true;
}

router.post("/register", async (req, res) => {
  if (!ready(res)) return;
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: "Enter a name between 2 and 80 characters." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 8 || password.length > 100) return res.status(400).json({ error: "Use a password between 8 and 100 characters." });

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, passwordHash]
    );
    const user = rows[0];
    return res.status(201).json({ token: tokenFor(user), user });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "An account with that email already exists." });
    console.error("Registration failed:", error.message);
    return res.status(500).json({ error: "Could not create your account." });
  }
});

router.post("/login", async (req, res) => {
  if (!ready(res)) return;
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  try {
    const { rows } = await db.query(
      "SELECT id, name, email, password_hash FROM users WHERE email = $1",
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    return res.json({ token: tokenFor(user), user: { id: String(user.id), name: user.name, email: user.email } });
  } catch (error) {
    console.error("Login failed:", error.message);
    return res.status(500).json({ error: "Could not sign in right now." });
  }
});

router.get("/me", authenticate, async (req, res) => {
  if (!ready(res)) return;
  try {
    const { rows } = await db.query("SELECT id, name, email FROM users WHERE id = $1", [req.user.id]);
    if (!rows[0]) return res.status(401).json({ error: "Account not found. Sign in again." });
    res.json(rows[0]);
  } catch (error) {
    console.error("Profile lookup failed:", error.message);
    res.status(500).json({ error: "Could not load your account." });
  }
});

module.exports = router;
