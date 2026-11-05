require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { initializeDatabase } = require("./db/initialize");

const hotelRoutes = require("./routes/hotels");
const bookingRoutes = require("./routes/bookings");
const authRoutes = require("./routes/auth");
const adminAuthRoutes = require("./routes/admin-auth");
const adminRoutes = require("./routes/admin");
const { startAdminServer } = require("./admin");
const { getLanIP } = require("./utils/network");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
app.use(express.json());

// Serve the frontend (public/) as static files
app.get("/admin", (req, res) => res.redirect("/admin/"));
app.get("/admin/", (req, res) => {
  res.sendFile(path.join(__dirname, "public-admin", "admin.html"));
});
app.use("/admin", express.static(path.join(__dirname, "public-admin")));
app.use(express.static(path.join(__dirname, "public")));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/hotels", hotelRoutes);
app.use("/api/bookings", bookingRoutes);

async function startServers() {
  if (process.env.DATABASE_URL) await initializeDatabase();
  else console.warn("DATABASE_URL is missing; guest sign-in is unavailable until PostgreSQL is configured.");

  app.listen(PORT, () => {
    const lan = getLanIP();
    console.log(`Hotel Booking System running at http://localhost:${PORT}`);
    if (lan) console.log(`  Same Wi-Fi (open on your phone/laptop): http://${lan}:${PORT}`);
  });
  // Keep the second listener for local demos. Render serves the admin UI through /admin/.
  if (process.env.NODE_ENV !== "production") startAdminServer();
}

startServers().catch((error) => {
  console.error("Could not start the application:", error.message);
  process.exitCode = 1;
});
