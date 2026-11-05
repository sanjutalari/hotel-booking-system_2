const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Sign in to continue" });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: String(payload.sub), name: payload.name, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: "Your session expired. Sign in again." });
  }
}

module.exports = { authenticate };
