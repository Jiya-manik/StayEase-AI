const express = require("express");
const ServiceRequest = require("../models/ServiceRequest");
const Booking = require("../models/Booking");
const router = express.Router();

router.post("/service-requests", async (req, res) => {
  try { res.status(201).json(await ServiceRequest.create(req.body)); }
  catch (e) { res.status(500).json({ message: e.message }); }
});

router.get("/dashboard", async (_req, res) => {
  const [bookings, openRequests] = await Promise.all([
    Booking.find({ status: { $in: ["pending", "confirmed"] } }),
    ServiceRequest.countDocuments({ status: { $ne: "resolved" } })
  ]);
  const revenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  res.json({
    activeBookings: bookings.length,
    openRequests,
    revenue,
    liveADR: bookings.length ? Math.round(revenue / bookings.length) : 0
  });
});

module.exports = router;
