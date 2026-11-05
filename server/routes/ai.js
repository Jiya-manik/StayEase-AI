const express = require("express");
const aiOrchestrator = require("../services/aiOrchestrator");
const { optionalAuth } = require("../middleware/auth");
const router = express.Router();

// AI Concierge Chat (Agent 1)
router.post("/chat", optionalAuth, async (req, res) => {
  try {
    const { message, language = "en" } = req.body;
    if (!message) return res.status(400).json({ message: "Message is required" });

    const result = await aiOrchestrator.executeAgent(
      "CustomerConciergeAgent",
      "handleQuery",
      { message, language, preferences: req.user ? req.user.preferences : {} },
      req.user
    );

    res.json(result.data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Travel Planner (Agent 2)
router.post("/travel-plan", optionalAuth, async (req, res) => {
  try {
    const { checkIn, checkOut, days, guests, budget, travelType, preferences } = req.body;
    const result = await aiOrchestrator.executeAgent(
      "TravelPlannerAgent",
      "generateItinerary",
      {
        guestName: req.user ? req.user.name : "Valued Guest",
        email: req.user ? req.user.email : "guest@stayease.com",
        checkIn,
        checkOut,
        days,
        guests,
        budget,
        travelType,
        preferences
      },
      req.user
    );
    res.json(result.data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Smart Booking Assistant (Agent 3)
router.post("/booking-assistant", optionalAuth, async (req, res) => {
  try {
    const { roomId, checkIn, checkOut, guests, addOns } = req.body;
    const result = await aiOrchestrator.executeAgent(
      "BookingAssistantAgent",
      "inspectBookingRequest",
      { roomId, checkIn, checkOut, guests, addOns },
      req.user
    );
    res.json(result.data);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Recommendation Engine (Agent 4)
router.post("/recommendations", optionalAuth, async (req, res) => {
  try {
    const { budget, category, amenities, travelType, guests } = req.body;
    const result = await aiOrchestrator.executeAgent(
      "RecommendationAgent",
      "getRankedRecommendations",
      {
        budget,
        category,
        amenities: amenities || [],
        travelType,
        guests: Number(guests || 2),
        userId: req.user ? req.user._id : null
      },
      req.user
    );
    res.json(result.data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Review Sentiment & Themes Analysis (Agent 5)
router.post("/review-analysis", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: "Text is required" });

    const lower = text.toLowerCase();
    let sentiment = "positive";
    if (lower.includes("bad") || lower.includes("poor") || lower.includes("dirty") || lower.includes("slow") || lower.includes("noisy")) {
      sentiment = "negative";
    } else if (lower.includes("average") || lower.includes("okay")) {
      sentiment = "neutral";
    }

    const themes = [];
    if (lower.includes("clean") || lower.includes("room")) themes.push("Cleanliness");
    if (lower.includes("staff") || lower.includes("service")) themes.push("Staff Courtesy");
    if (lower.includes("food") || lower.includes("breakfast")) themes.push("Dining Quality");
    if (lower.includes("spa") || lower.includes("pool")) themes.push("Spa & Wellness");

    res.json({
      sentiment,
      themes: themes.length ? themes : ["General Ambience"],
      summary: text.slice(0, 100)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// AI System Status (Google Gemini & Orchestration Engine)
const geminiService = require("../services/geminiService");
router.get("/status", (_req, res) => {
  try {
    const status = geminiService.getStatus();
    res.json({
      success: true,
      data: {
        ...status,
        timestamp: new Date()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Direct Real-Time Gemini Assistant Chat with Grounding
router.post("/gemini-chat", optionalAuth, async (req, res) => {
  try {
    const { message, language = "en", context = {} } = req.body;
    if (!message) return res.status(400).json({ message: "Message is required" });

    const hotel = require("../services/locationService").getHotelInfo();
    const systemPrompt = `You are StayEase AI, an ultra-luxury hotel AI assistant powered by Google Gemini.
You have real-time reasoning abilities, warm hospitality empathy, and grounded knowledge of:
- StayEase Heritage Hotel: ${hotel.name}, located at ${hotel.address}.
- Check-in: 2:00 PM, Check-out: 11:00 AM, Free cancellation up to 48 hours.
- Dining: Skyline Rooftop Lounge & Courtyard Pavilion Breakfast (7:00 AM - 10:30 AM).
- Lotus Spa & Wellness: Open 7:00 AM - 9:00 PM with Swedish massage, hydrotherapy, botanical baths.
- Nearby Heritage Precinct: Gateway of India (150m), The Heritage Bakehouse (250m), The Table Fine Dining (220m), Café Leopold (400m), Silk & Pashmina Guild (280m), CSMVS Museum (720m).
Language requested: ${language}.
Always provide helpful, polite, structured advice. If a guest asks about bookings, cancellation, or room service, guide them cleanly to the booking or service tabs.`;

    let reply = await geminiService.generateContent({
      systemInstruction: systemPrompt,
      prompt: message,
      temperature: 0.35
    });

    let source = "gemini";
    let model = geminiService.getModelName();

    if (!reply) {
      source = "grounded-engine";
      model = "StayEase Luxury AI Fallback";
      reply = `Thank you for reaching out to StayEase Concierge. I am grounded in all hotel amenities, room inventories, and nearby neighborhood cafes and boutiques. How may I elevate your stay today?`;
    }

    res.json({
      success: true,
      reply,
      source,
      model,
      timestamp: new Date()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
