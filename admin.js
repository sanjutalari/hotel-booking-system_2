/**
 * Admin console server — runs on its OWN port (3001) but shares the same
 * in-memory data (models/data.js) as the customer app on port 3000,
 * because it runs inside the same Node process.
 */
const express = require("express");
const cors = require("cors");
const path = require("path");

const adminAuthRoutes = require("./routes/admin-auth");
const adminRoutes = require("./routes/admin");
const { getLanIP } = require("./utils/network");

const PORT_ADMIN = process.env.PORT_ADMIN || 3001;

function startAdminServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Admin frontend lives in public-admin/
  app.use(express.static(path.join(__dirname, "public-admin")));

  // Root of the admin port serves the console
  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public-admin", "admin.html"));
  });

  // Admin login and controls share the same protected API as the deployed app.
  app.use("/api/admin/auth", adminAuthRoutes);
  app.use("/api/admin", adminRoutes);

  const server = app.listen(PORT_ADMIN, () => {
    const lan = getLanIP();
    console.log(`Admin console running at http://localhost:${PORT_ADMIN}`);
    if (lan) {
      console.log(`  Same Wi-Fi (open on your phone/laptop): http://${lan}:${PORT_ADMIN}`);
    }
  });
  return server;
}

module.exports = { startAdminServer, PORT_ADMIN };