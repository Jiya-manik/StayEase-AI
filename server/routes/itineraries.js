const express = require("express");
const Itinerary = require("../models/Itinerary");
const { TravelPlannerAgent } = require("../services/aiAgents");
const { optionalAuth } = require("../middleware/auth");
const router = express.Router();

// Generate new travel plan
router.post("/plan", optionalAuth, async (req, res) => {
  try {
    const { checkIn, checkOut, days = 3, guests = 2, budget = 25000, travelType, preferences = [] } = req.body;
    const plan = await TravelPlannerAgent.generateItinerary({
      guestName: req.user ? req.user.name : (req.body.guestName || "Valued Guest"),
      email: req.user ? req.user.email : (req.body.email || "guest@stayease.com"),
      checkIn,
      checkOut,
      days: Number(days || 3),
      guests: Number(guests || 2),
      budget: Number(budget || 25000),
      travelType: travelType || "Leisure & Wellness",
      preferences
    });

    if (req.user) {
      await Itinerary.findByIdAndUpdate(plan.itineraryId, { user: req.user._id });
    }

    res.status(201).json(plan);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get itineraries
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { email } = req.query;
    let filter = {};
    if (req.user) {
      filter = { $or: [{ user: req.user._id }, { email: req.user.email }] };
    } else if (email) {
      filter = { email };
    }

    const itineraries = await Itinerary.find(filter).sort({ createdAt: -1 });
    res.json(itineraries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete itinerary
router.delete("/:id", optionalAuth, async (req, res) => {
  try {
    await Itinerary.findByIdAndDelete(req.params.id);
    res.json({ message: "Itinerary removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
