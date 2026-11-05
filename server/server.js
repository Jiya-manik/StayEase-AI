require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const authRoutes = require("./routes/auth");
const roomsRoutes = require("./routes/rooms");
const bookingsRoutes = require("./routes/bookings");
const paymentsRoutes = require("./routes/payments");
const servicesRoutes = require("./routes/services");
const reviewsRoutes = require("./routes/reviews");
const itinerariesRoutes = require("./routes/itineraries");
const aiRoutes = require("./routes/ai");
const adminRoutes = require("./routes/admin");
const hotelRoutes = require("./routes/hotel");
const locationRoutes = require("./routes/location");
const locationService = require("./services/locationService");
const backgroundWorker = require("./services/backgroundWorker");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

// Health endpoint
app.get("/api/health", (_req, res) => res.json({
  ok: true,
  service: "StayEase AI Hotel Platform",
  uptime: process.uptime(),
  timestamp: new Date()
}));

// Route mounts
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomsRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/itineraries", itinerariesRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/hotel", hotelRoutes);
app.use("/api/location", locationRoutes);

// Fallback for single-page routing
app.get("/*splat", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

async function start() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/stayease";
    await mongoose.connect(mongoUri);
    console.log("✓ MongoDB connected successfully:", mongoUri);

    // Ensure curated nearby places are seeded
    await locationService.ensurePlacesSeeded();

    // Start Autonomous Service Desk Background Worker
    backgroundWorker.start(60000);

    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🌿 StayEase AI Hotel Platform is LIVE`);
      console.log(`👉 http://localhost:${PORT}`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error("Startup error:", err.message);
    process.exit(1);
  }
}

start();

module.exports = app;
