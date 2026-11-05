const express = require("express");
const Review = require("../models/Review");
const { optionalAuth } = require("../middleware/auth");
const { ReviewInsightsAgent } = require("../services/aiAgents");
const router = express.Router();

// Get reviews
router.get("/", async (_req, res) => {
  try {
    const reviews = await Review.find().sort({ createdAt: -1 }).limit(50);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Submit review with automatic sentiment & theme tagging
router.post("/", optionalAuth, async (req, res) => {
  try {
    const { guestName, rating, title, text, roomId, bookingId } = req.body;
    if (!guestName || !rating || !text) {
      return res.status(400).json({ message: "Guest name, rating (1-5), and review text are required" });
    }

    const lower = text.toLowerCase();
    let sentiment = "positive";
    if (rating <= 2 || lower.includes("poor") || lower.includes("terrible") || lower.includes("bad") || lower.includes("dirty") || lower.includes("slow")) {
      sentiment = "negative";
    } else if (rating === 3 || lower.includes("average") || lower.includes("okay")) {
      sentiment = "neutral";
    }

    const detectedThemes = [];
    if (lower.includes("clean") || lower.includes("spotless") || lower.includes("housekeeping")) detectedThemes.push("Housekeeping");
    if (lower.includes("food") || lower.includes("breakfast") || lower.includes("dining") || lower.includes("restaurant")) detectedThemes.push("Dining");
    if (lower.includes("staff") || lower.includes("service") || lower.includes("concierge") || lower.includes("front desk")) detectedThemes.push("Service");
    if (lower.includes("spa") || lower.includes("pool") || lower.includes("massage")) detectedThemes.push("Spa & Wellness");
    if (lower.includes("room") || lower.includes("bed") || lower.includes("balcony") || lower.includes("view")) detectedThemes.push("Room Comfort");
    if (lower.includes("wifi") || lower.includes("internet")) detectedThemes.push("High-Speed Wi-Fi");

    const review = await Review.create({
      user: req.user ? req.user._id : null,
      room: roomId || null,
      booking: bookingId || null,
      guestName,
      rating: Number(rating),
      title: title || "Memorable Experience",
      text,
      sentiment,
      themes: detectedThemes.length ? detectedThemes : ["Hospitality"],
      verifiedStay: true
    });

    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Review Insights
router.get("/insights", async (_req, res) => {
  try {
    const insights = await ReviewInsightsAgent.getInsights();
    res.json(insights);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
