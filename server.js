require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { initializeDatabase } = require("./db/initialize");

const hotelRoutes = require("./routes/hotels");
const bookingRoutes = require("./routes/bookings");
const authRoutes = require("./routes/auth");
const { startAdminServer } = require("./admin");
const { getLanIP } = require("./utils/network");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve the frontend (public/) as static files
app.use(express.static(path.join(__dirname, "public")));

// API routes
app.use("/api/auth", authRoutes);
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
  // Local/demo admin console. Deploy it as a separate service if it is needed on Render.
  startAdminServer();
}

startServers().catch((error) => {
  console.error("Could not start the application:", error.message);
  process.exitCode = 1;
});
