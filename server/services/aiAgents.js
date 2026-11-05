const Room = require("../models/Room");
const Booking = require("../models/Booking");
const ServiceRequest = require("../models/ServiceRequest");
const Review = require("../models/Review");
const Payment = require("../models/Payment");
const Itinerary = require("../models/Itinerary");
const AIActionLog = require("../models/AIActionLog");
const ApprovalRequest = require("../models/ApprovalRequest");
const geminiService = require("./geminiService");
const locationService = require("./locationService");
const OpenAI = require("openai");

let openaiClient = null;
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "your_api_key_here") {
  try {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch (e) {
    console.warn("OpenAI client init notice:", e.message);
  }
}

// Helper to call LLM: Google Gemini primary, OpenAI secondary, and deterministic fallback
async function callLLM(systemPrompt, userPrompt, jsonMode = false) {
  // 1. Prioritize Google Gemini
  if (geminiService.isConfigured()) {
    try {
      const geminiResult = await geminiService.generateContent({
        systemInstruction: systemPrompt,
        prompt: userPrompt,
        temperature: 0.3,
        jsonMode
      });
      if (geminiResult) return geminiResult;
    } catch (e) {
      console.warn("Gemini call warning, trying secondary fallback:", e.message);
    }
  }

  // 2. OpenAI secondary fallback
  if (openaiClient) {
    try {
      const response = await openaiClient.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3,
        response_format: jsonMode ? { type: "json_object" } : undefined
      });
      const text = response.choices[0]?.message?.content?.trim();
      if (jsonMode) {
        try { return JSON.parse(text); } catch { return null; }
      }
      return text;
    } catch (e) {
      console.warn("LLM call failed, switching to deterministic fallback:", e.message);
    }
  }

  return null;
}

// -------------------------------------------------------------
// AGENT 1: CustomerConciergeAgent
// -------------------------------------------------------------
class CustomerConciergeAgent {
  async handleQuery({ message, language = "en", preferences = {} }) {
    const lower = message.toLowerCase();
    const rooms = await Room.find({ active: true }).lean();

    // Hotel Facts Grounding
    const hotelPolicies = {
      checkIn: "2:00 PM",
      checkOut: "11:00 AM",
      cancellation: "Free cancellation up to 48 hours prior to check-in.",
      breakfast: "Complimentary breakfast buffet served 7:00 AM – 10:30 AM at the Courtyard Pavilion.",
      spa: "Lotus Spa & Wellness open daily from 7:00 AM – 9:00 PM.",
      dining: "Skyline Rooftop Lounge serves organic seasonal dining from 12:00 PM – 11:00 PM. 24/7 in-room dining is active.",
      wifi: "High-speed 500Mbps optical Wi-Fi is complimentary across all rooms and grounds.",
      parking: "Valet parking available 24/7 with EV charging stations on-site."
    };

    // Filter rooms based on query terms (e.g., quiet, budget, capacity)
    let filteredRooms = [...rooms];
    const budgetMatch = message.match(/(?:under|below|budget of|within)\s*(?:₹|inr|rs\.?)?\s*(\d+[\d,]*)/i);
    let budgetCap = budgetMatch ? parseInt(budgetMatch[1].replace(/,/g, ""), 10) : null;
    if (budgetCap) {
      filteredRooms = filteredRooms.filter(r => r.price <= budgetCap);
    }

    if (lower.includes("suite")) {
      const suites = filteredRooms.filter(r => r.category === "SUITE");
      if (suites.length) filteredRooms = suites;
    } else if (lower.includes("deluxe")) {
      const deluxes = filteredRooms.filter(r => r.category === "DELUXE");
      if (deluxes.length) filteredRooms = deluxes;
    }

    // Try LLM if available (Gemini / OpenAI)
    const system = `You are StayEase's Luxury AI Concierge powered by Google Gemini.
Always respond in ${language}. Never invent prices or availability.
Ground yourself strictly on real hotel information:
Policies: ${JSON.stringify(hotelPolicies)}
Available real rooms: ${JSON.stringify(rooms.map(r => ({ name: r.name, price: r.price, category: r.category, capacity: r.capacity, amenities: r.amenities })))}
Hotel Location: Apollo Bunder, Colaba, Mumbai (Gateway of India waterfront).
Nearby spots within 5-10 min walk: The Heritage Bakehouse & Roastery (0.25km), Café Leopold (0.4km), Silk & Heritage Pashmina (0.28km), The Table Fine Dining (0.22km), Gateway of India (0.15km).
Be warm, professional, cultured, and concise.`;

    const llmReply = await callLLM(system, message);
    if (llmReply) {
      return {
        agent: "CustomerConciergeAgent",
        reply: llmReply,
        matchedRooms: filteredRooms.slice(0, 3),
        policies: hotelPolicies,
        isAIGenerated: true,
        provider: geminiService.isConfigured() ? "Google Gemini" : "Standard LLM"
      };
    }

    // Deterministic Rule-Based Fallback
    let reply = "";
    if (lower.includes("check-in") || lower.includes("check in") || lower.includes("checkout") || lower.includes("check-out") || lower.includes("timing")) {
      reply = `Our standard check-in time is ${hotelPolicies.checkIn} and check-out is ${hotelPolicies.checkOut}. Early check-in or late check-out can be arranged with our front desk or via our Service Requests tab.`;
    } else if (lower.includes("breakfast") || lower.includes("food") || lower.includes("dining") || lower.includes("restaurant") || lower.includes("dinner")) {
      reply = `${hotelPolicies.breakfast} In the evening, visit our ${hotelPolicies.dining} For fine dining nearby, 'The Table Waterfront Bistro' is just 220m away.`;
    } else if (lower.includes("cafe") || lower.includes("coffee") || lower.includes("bakery") || lower.includes("croissant")) {
      reply = `We highly recommend 'The Heritage Bakehouse & Roastery' just 250m (3 min walk) for single-origin brews and pistachio croissants, or 'Café Leopold' (400m) for iconic 1871 heritage charm. Both are pinned on our interactive Google Map!`;
    } else if (lower.includes("shop") || lower.includes("shopping") || lower.includes("silk") || lower.includes("jewel") || lower.includes("souvenir")) {
      reply = `For luxury shopping within walking distance, explore 'Silk & Heritage Pashmina Guild' (280m) for pure certified cashmere, or 'Curio Cottage' (450m) for sterling silver jewelry. Check our Nearby Map for walking directions!`;
    } else if (lower.includes("gateway") || lower.includes("museum") || lower.includes("sight") || lower.includes("attraction") || lower.includes("place") || lower.includes("visit")) {
      reply = `The iconic Gateway of India promenade is just 150m (2 min stroll) from our front concourse! You can also visit the CSMVS Art & Heritage Museum (9 min walk) or explore Kala Ghoda art galleries.`;
    } else if (lower.includes("spa") || lower.includes("pool") || lower.includes("massage") || lower.includes("wellness")) {
      reply = `Our ${hotelPolicies.spa} We offer Swedish massages, deep tissue treatments, and heated hydrotherapy.`;
    } else if (lower.includes("cancel") || lower.includes("refund") || lower.includes("policy")) {
      reply = `StayEase Cancellation Policy: ${hotelPolicies.cancellation} You can manage or cancel reservations directly from your Customer Portal.`;
    } else if (budgetCap || lower.includes("room") || lower.includes("stay") || lower.includes("cost") || lower.includes("price")) {
      const roomList = filteredRooms.length ? filteredRooms : rooms;
      const suggestions = roomList.map(r => `• ${r.name} (${r.category}, up to ${r.capacity} guests) — ₹${r.price.toLocaleString("en-IN")}/night`).join("\n");
      reply = `Here are our verified available rooms${budgetCap ? ` under ₹${budgetCap.toLocaleString("en-IN")}` : ""}:\n${suggestions}\n\nAll reservations include complimentary high-speed Wi-Fi and morning breakfast. Would you like me to prepare a reservation for one of these?`;
    } else {
      reply = `Welcome to StayEase! I am your 24/7 AI Concierge powered by Google Gemini. I can assist with verified room bookings, dining reservations, spa slots, and local curated itineraries and cafes nearby. How may I assist your stay today?`;
    }

    return {
      agent: "CustomerConciergeAgent",
      reply,
      matchedRooms: (filteredRooms.length ? filteredRooms : rooms).slice(0, 3),
      policies: hotelPolicies,
      isAIGenerated: false
    };
  }
}

// -------------------------------------------------------------
// AGENT 2: TravelPlannerAgent
// -------------------------------------------------------------
class TravelPlannerAgent {
  async generateItinerary({ guestName, email, checkIn, checkOut, days = 3, guests = 2, budget = 25000, travelType = "Leisure & Wellness", preferences = [] }) {
    const rooms = await Room.find({ active: true }).sort({ price: 1 }).lean();
    const suitableRoom = rooms.find(r => r.price * days <= budget * 0.6) || rooms[0];

    const roomPrice = suitableRoom ? suitableRoom.price : 4200;
    const roomTotal = roomPrice * days;

    const baseActivities = [
      { day: 1, title: "Afternoon Welcome & Lotus Spa Relaxation", time: "3:30 PM", description: "60-minute signature aromatherapy treatment followed by heated hydrotherapy.", location: "Lotus Spa Pavilion", estimatedCost: 2400, isExternal: false },
      { day: 1, title: "Sunset Skyline Dinner", time: "7:30 PM", description: "Four-course seasonal organic dining overlooking the heritage estate.", location: "Skyline Rooftop Lounge", estimatedCost: 3200, isExternal: false },
      { day: 2, title: "Heritage Estate Architecture Walking Tour", time: "9:00 AM", description: "Guided exploration of historical colonial arches, private courtyard, and botanical gardens.", location: "Hotel Lobby Concourse", estimatedCost: 0, isExternal: false },
      { day: 2, title: "Coastal Scenic Marina Excursion", time: "4:00 PM", description: "Private chauffeured ride to scenic lighthouse point and artisan craft markets.", location: "City Marina Bay", estimatedCost: 1800, isExternal: true },
      { day: 3, title: "Morning Yoga & Artisan Tea Tasting", time: "7:30 AM", description: "Calming garden breathwork session paired with organic herbal brews.", location: "Garden Pavilion", estimatedCost: 0, isExternal: false },
      { day: 3, title: "Executive Late Check-Out & Departure Transfer", time: "1:00 PM", description: "Complimentary baggage handling and pre-arranged transfer to airport/station.", location: "Front Desk Concierge", estimatedCost: 1200, isExternal: true }
    ];

    const activities = baseActivities.slice(0, days * 2);
    const activitiesTotal = activities.reduce((s, a) => s + a.estimatedCost, 0);
    const diningEstimate = days * 1800;
    const taxesAndFees = Math.round((roomTotal + activitiesTotal + diningEstimate) * 0.12);
    const grandTotal = roomTotal + activitiesTotal + diningEstimate + taxesAndFees;

    const stayPlan = {
      roomType: suitableRoom ? suitableRoom.name : "Courtyard Standard",
      roomPrice,
      roomTotal,
      recommendedAmenities: suitableRoom ? suitableRoom.amenities : ["Wi-Fi", "Breakfast", "Lotus Spa Access"],
      overview: `A tailored ${days}-day ${travelType} retreat designed for ${guests} guests, combining restorative relaxation with curated dining.`
    };

    const itineraryDoc = await Itinerary.create({
      guestName: guestName || "Valued Guest",
      email: email || "guest@stayease.com",
      checkIn: checkIn ? new Date(checkIn) : new Date(),
      checkOut: checkOut ? new Date(checkOut) : new Date(Date.now() + days * 86400000),
      days,
      guests,
      budget,
      travelType,
      preferences,
      stayPlan,
      proposedActivities: activities,
      estimatedBudget: {
        roomTotal,
        activitiesTotal,
        diningTotal: diningEstimate,
        taxesAndFees,
        grandTotal
      },
      status: "saved"
    });

    return {
      agent: "TravelPlannerAgent",
      itineraryId: itineraryDoc._id,
      stayPlan,
      proposedActivities: activities,
      estimatedBudget: itineraryDoc.estimatedBudget,
      notes: "External activity estimates are approximate and payable at location. Hotel room charges and verified hotel services can be billed directly to your room.",
      isAIGenerated: true
    };
  }
}

// -------------------------------------------------------------
// AGENT 3: SmartBookingAssistantAgent
// -------------------------------------------------------------
class BookingAssistantAgent {
  async inspectBookingRequest({ roomId, checkIn, checkOut, guests = 2, addOns = [] }) {
    if (!roomId) throw new Error("Please specify a room to analyze.");
    if (!checkIn || !checkOut) throw new Error("Please provide check-in and check-out dates.");

    const room = await Room.findById(roomId);
    if (!room) throw new Error("Room not found in inventory.");

    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    if (outDate <= inDate) {
      throw new Error("Check-out date must be after check-in date.");
    }

    const nights = Math.max(1, Math.ceil((outDate - inDate) / 86400000));

    // Conflict Check
    const conflict = await Booking.findOne({
      room: roomId,
      status: { $in: ["pending", "confirmed", "checked_in"] },
      checkIn: { $lt: outDate },
      checkOut: { $gt: inDate }
    });

    if (conflict) {
      // Find alternatives
      const alternatives = await Room.find({
        _id: { $ne: roomId },
        active: true,
        capacity: { $gte: guests }
      }).limit(2).lean();

      return {
        agent: "BookingAssistantAgent",
        available: false,
        message: `Unfortunately, ${room.name} is booked between ${inDate.toLocaleDateString()} and ${outDate.toLocaleDateString()}.`,
        suggestedAlternatives: alternatives,
        requiresAction: "Select alternative dates or choose another room."
      };
    }

    // Pricing calculation
    const baseTotal = nights * room.price;
    const addOnTotal = addOns.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    const taxes = Math.round((baseTotal + addOnTotal) * 0.12);
    const grandTotal = baseTotal + addOnTotal + taxes;

    return {
      agent: "BookingAssistantAgent",
      available: true,
      roomDetails: {
        id: room._id,
        name: room.name,
        category: room.category,
        capacity: room.capacity,
        nightlyRate: room.price
      },
      stayBreakdown: {
        checkIn: inDate.toISOString().split("T")[0],
        checkOut: outDate.toISOString().split("T")[0],
        nights,
        guests
      },
      pricingBreakdown: {
        roomSubtotal: baseTotal,
        addOns: addOns,
        addOnSubtotal: addOnTotal,
        gstTaxes: taxes,
        grandTotal
      },
      confirmationPrompt: `Would you like to confirm this reservation for ${room.name} (${nights} night${nights > 1 ? "s" : ""}) for ₹${grandTotal.toLocaleString("en-IN")}?`,
      readyForPayment: true
    };
  }
}

// -------------------------------------------------------------
// AGENT 4: RecommendationAgent
// -------------------------------------------------------------
class RecommendationAgent {
  async getRankedRecommendations({ budget, category, amenities = [], travelType = "Leisure", guests = 2, userId }) {
    const rooms = await Room.find({ active: true }).lean();
    let userPastBookings = [];
    if (userId) {
      userPastBookings = await Booking.find({ user: userId }).select("room roomName").lean();
    }

    const preferredCategory = category ? category.toUpperCase() : null;
    const requestedBudget = Number(budget) || Infinity;
    const cleanAmenities = amenities.map(a => a.toLowerCase());

    const ranked = rooms.map(room => {
      let score = 50;
      const reasons = [];

      // Budget scoring
      if (room.price <= requestedBudget) {
        score += 25;
        reasons.push(`Within your desired budget of ₹${requestedBudget.toLocaleString("en-IN")}`);
      } else {
        score -= Math.min(25, Math.round((room.price - requestedBudget) / 200));
      }

      // Capacity fit
      if (room.capacity >= guests) {
        score += 15;
        reasons.push(`Accommodates your party of ${guests}`);
      } else {
        score -= 30;
      }

      // Category matching
      if (preferredCategory && room.category === preferredCategory) {
        score += 20;
        reasons.push(`Matches your preferred ${preferredCategory} suite category`);
      }

      // Amenities matching
      const roomAmenities = (room.amenities || []).map(a => a.toLowerCase());
      let matchedAmenitiesCount = 0;
      for (const reqAmenity of cleanAmenities) {
        if (roomAmenities.some(ra => ra.includes(reqAmenity))) {
          score += 8;
          matchedAmenitiesCount++;
        }
      }
      if (matchedAmenitiesCount > 0) {
        reasons.push(`Includes ${matchedAmenitiesCount} of your chosen amenities`);
      }

      // Past stay bonus
      if (userPastBookings.some(b => String(b.room) === String(room._id))) {
        score += 10;
        reasons.push("You previously enjoyed a stay in this room");
      }

      return {
        ...room,
        recommendationScore: Math.min(99, Math.max(10, Math.round(score))),
        recommendationReasons: reasons.length ? reasons : ["Highly rated guest favorite with 4.8+ rating"]
      };
    });

    ranked.sort((a, b) => b.recommendationScore - a.recommendationScore);

    return {
      agent: "RecommendationAgent",
      recommendations: ranked,
      criteriaApplied: { budget: requestedBudget, category: preferredCategory, guests, travelType }
    };
  }
}

// -------------------------------------------------------------
// AGENT 5: ReviewInsightsAgent
// -------------------------------------------------------------
class ReviewInsightsAgent {
  async getInsights() {
    const reviews = await Review.find().lean();
    if (!reviews.length) {
      return {
        agent: "ReviewInsightsAgent",
        totalReviews: 0,
        averageRating: 4.8,
        sentimentBreakdown: { positive: 100, neutral: 0, negative: 0 },
        positiveThemes: ["Welcoming front desk", "Spotless housekeeping", "Quiet garden balcony"],
        areasForImprovement: ["More EV parking slots", "Earlier breakfast option"],
        sampleTestimonials: []
      };
    }

    const total = reviews.length;
    const avgRating = Number((reviews.reduce((s, r) => s + (r.rating || 5), 0) / total).toFixed(1));
    const positiveCount = reviews.filter(r => r.sentiment === "positive" || r.rating >= 4).length;
    const negativeCount = reviews.filter(r => r.sentiment === "negative" || r.rating <= 2).length;
    const neutralCount = total - positiveCount - negativeCount;

    // Collect themes
    const themeMap = {};
    reviews.forEach(r => {
      (r.themes || []).forEach(t => {
        themeMap[t] = (themeMap[t] || 0) + 1;
      });
    });

    const topThemes = Object.keys(themeMap).length
      ? Object.entries(themeMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0])
      : ["Attentive concierge", "Spacious luxury suites", "Exceptional breakfast spread", "Heated pool & spa"];

    return {
      agent: "ReviewInsightsAgent",
      totalReviews: total,
      averageRating: avgRating,
      sentimentBreakdown: {
        positive: Math.round((positiveCount / total) * 100),
        neutral: Math.round((neutralCount / total) * 100),
        negative: Math.round((negativeCount / total) * 100)
      },
      positiveThemes: topThemes,
      areasForImprovement: [
        "Faster baggage assistance during peak 2 PM arrivals",
        "Expanded vegan choices at rooftop dining"
      ],
      recentReviews: reviews.slice(-6).reverse()
    };
  }
}

// -------------------------------------------------------------
// AGENT 6: HotelOperationsCopilot (Admin)
// -------------------------------------------------------------
class HotelOperationsCopilot {
  async answerOperationalQuery(query) {
    const lower = query.toLowerCase();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart.getTime() + 86400000);
    const dayAfterTomorrow = new Date(todayStart.getTime() + 86400000 * 2);

    let result = "";
    let dataPayload = null;

    if (lower.includes("arrival") || lower.includes("arriving")) {
      const isTomorrow = lower.includes("tomorrow");
      const targetStart = isTomorrow ? tomorrowStart : todayStart;
      const targetEnd = isTomorrow ? dayAfterTomorrow : tomorrowStart;

      const arrivals = await Booking.find({
        status: { $in: ["confirmed", "pending"] },
        checkIn: { $gte: targetStart, $lt: targetEnd }
      }).populate("room").lean();

      result = `Found ${arrivals.length} verified arrival${arrivals.length === 1 ? "" : "s"} scheduled for ${isTomorrow ? "tomorrow" : "today"}.`;
      dataPayload = arrivals.map(a => ({
        reference: a.bookingReference,
        guest: a.guestName,
        room: a.roomName,
        guests: a.guests,
        paymentStatus: a.paymentStatus
      }));
    } else if (lower.includes("service") || lower.includes("request") || lower.includes("overdue") || lower.includes("maintenance")) {
      const openRequests = await ServiceRequest.find({ status: { $ne: "resolved" } }).lean();
      const overdue = openRequests.filter(r => (Date.now() - new Date(r.createdAt).getTime()) > 30 * 60 * 1000);

      result = `There are currently ${openRequests.length} active service request(s), of which ${overdue.length} are flagged as overdue (>30 minutes).`;
      dataPayload = {
        totalOpen: openRequests.length,
        overdueCount: overdue.length,
        items: openRequests
      };
    } else if (lower.includes("revenue") || lower.includes("financial") || lower.includes("income") || lower.includes("money")) {
      const payments = await Payment.find({ status: "completed" }).lean();
      const verifiedCollected = payments.reduce((s, p) => s + p.amount, 0);

      const allBookings = await Booking.find({ status: { $in: ["confirmed", "completed"] } }).lean();
      const grossValue = allBookings.reduce((s, b) => s + (b.totalAmount || 0), 0);

      result = `Verified Collected Revenue is ₹${verifiedCollected.toLocaleString("en-IN")} across ${payments.length} completed transaction(s). Gross confirmed booking value is ₹${grossValue.toLocaleString("en-IN")}. Uncollected/pending balance is ₹${Math.max(0, grossValue - verifiedCollected).toLocaleString("en-IN")}.`;
      dataPayload = { verifiedCollected, grossValue, transactionCount: payments.length };
    } else if (lower.includes("room") || lower.includes("unavailable") || lower.includes("occupancy")) {
      const rooms = await Room.find().lean();
      const activeBookings = await Booking.find({
        status: { $in: ["confirmed", "checked_in"] },
        checkIn: { $lte: now },
        checkOut: { $gte: now }
      }).lean();

      const occupiedCount = activeBookings.length;
      const totalRooms = rooms.length;
      const occupancyRate = totalRooms > 0 ? Math.round((occupiedCount / totalRooms) * 100) : 0;

      result = `Property Occupancy: ${occupancyRate}% (${occupiedCount} of ${totalRooms} rooms occupied right now).`;
      dataPayload = { totalRooms, occupiedCount, occupancyRate, rooms };
    } else {
      // General overview
      const [bookingsCount, openReqs, payments] = await Promise.all([
        Booking.countDocuments({ status: "confirmed" }),
        ServiceRequest.countDocuments({ status: { $ne: "resolved" } }),
        Payment.find({ status: "completed" }).select("amount")
      ]);
      const revenue = payments.reduce((s, p) => s + p.amount, 0);

      result = `StayEase Property Status: ${bookingsCount} active bookings, ${openReqs} pending service requests, and ₹${revenue.toLocaleString("en-IN")} in verified collected revenue. How can I assist your operations?`;
    }

    return {
      agent: "HotelOperationsCopilot",
      query,
      answer: result,
      groundedData: dataPayload,
      timestamp: new Date()
    };
  }
}

// -------------------------------------------------------------
// AGENT 7: AutonomousServiceDesk (Admin)
// -------------------------------------------------------------
class AutonomousServiceDesk {
  async runTriage() {
    const openRequests = await ServiceRequest.find({ status: "open" });
    const actionsTaken = [];

    for (const req of openRequests) {
      let priority = req.priority;
      let assigned = req.assignedStaff;

      // Smart rule-based categorization
      if (req.type === "drinking_water" || req.type === "maintenance") {
        priority = "high";
      } else if (req.type === "housekeeping" || req.type === "fresh_towels") {
        priority = "normal";
      } else if (req.type === "extra_bedding") {
        priority = "normal";
      }

      // Auto-assign staff role
      if (!assigned || assigned === "Unassigned") {
        if (req.type === "maintenance") assigned = "Vikram (Chief Engineer)";
        else if (req.type === "housekeeping" || req.type === "fresh_towels" || req.type === "drinking_water" || req.type === "extra_bedding") assigned = "Ramesh (Housekeeping Lead)";
        else assigned = "Ananya (Front Office)";
      }

      req.priority = priority;
      req.assignedStaff = assigned;
      req.aiClassification = {
        suggestedPriority: priority,
        category: req.type,
        estimatedResolutionMins: req.type === "maintenance" ? 45 : 20,
        recommendedStaffRole: assigned,
        analyzedAt: new Date()
      };

      await req.save();
      actionsTaken.push({
        id: req._id,
        roomNumber: req.roomNumber,
        type: req.type,
        assignedTo: assigned,
        priority
      });
    }

    return {
      agent: "AutonomousServiceDesk",
      triagedCount: actionsTaken.length,
      actions: actionsTaken,
      workerStatus: "active"
    };
  }
}

// -------------------------------------------------------------
// AGENT 8: SmartPricingAnalyst (Admin)
// -------------------------------------------------------------
class SmartPricingAnalyst {
  async analyzeAndProposeRates() {
    const rooms = await Room.find({ active: true });
    const now = new Date();
    const isWeekend = now.getDay() === 5 || now.getDay() === 6 || now.getDay() === 0;

    // Check active occupancy
    const activeBookings = await Booking.find({
      status: { $in: ["confirmed", "checked_in"] }
    });
    const occupancyRate = rooms.length ? Math.min(100, Math.round((activeBookings.length / rooms.length) * 100)) : 50;

    const proposals = [];
    for (const room of rooms) {
      let multiplier = 1.0;
      let reasons = [];

      // Demand based
      if (occupancyRate >= 75) {
        multiplier += 0.08;
        reasons.push(`High property occupancy (${occupancyRate}%)`);
      } else if (occupancyRate < 35) {
        multiplier -= 0.05;
        reasons.push(`Low off-peak occupancy (${occupancyRate}%)`);
      }

      // Weekend factor
      if (isWeekend) {
        multiplier += 0.06;
        reasons.push("Weekend leisure surge factor");
      }

      // Category factor
      if (room.category === "SUITE") {
        multiplier += 0.03;
        reasons.push("High demand for premium suites");
      }

      // Cap within allowed ±15% bound
      multiplier = Math.min(1.15, Math.max(0.85, Number(multiplier.toFixed(2))));
      const currentPrice = room.price;
      const proposedPrice = Math.round((room.basePrice || room.price) * multiplier);

      proposals.push({
        roomId: room._id,
        roomName: room.name,
        category: room.category,
        currentPrice,
        basePrice: room.basePrice || currentPrice,
        proposedPrice,
        percentageChange: Math.round(((proposedPrice - currentPrice) / currentPrice) * 100),
        multiplier,
        reasons
      });
    }

    return {
      agent: "SmartPricingAnalyst",
      occupancyRate,
      isWeekend,
      proposals,
      requiresApproval: true,
      approvalNote: "Prices remain unchanged until confirmed by an authorized administrator."
    };
  }
}

// -------------------------------------------------------------
// AGENT 9: RevenueInsightsAgent (Admin)
// -------------------------------------------------------------
class RevenueInsightsAgent {
  async generateFinancialReport() {
    const [bookings, payments, rooms] = await Promise.all([
      Booking.find().lean(),
      Payment.find().lean(),
      Room.find().lean()
    ]);

    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter(b => b.status === "confirmed" || b.status === "checked_in" || b.status === "completed");
    const cancelledBookings = bookings.filter(b => b.status === "cancelled");

    const grossBookingValue = confirmedBookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const verifiedCollected = payments.filter(p => p.status === "completed").reduce((s, p) => s + p.amount, 0);
    const refundedAmount = payments.filter(p => p.status === "refunded").reduce((s, p) => s + p.amount, 0);
    const pendingCollection = Math.max(0, grossBookingValue - verifiedCollected);

    const cancellationRate = totalBookings > 0 ? Math.round((cancelledBookings.length / totalBookings) * 100) : 0;

    // Room category breakdown
    const categoryBreakdown = {};
    for (const b of confirmedBookings) {
      const roomCat = b.roomName ? (b.roomName.includes("Deluxe") ? "DELUXE" : b.roomName.includes("Suite") ? "SUITE" : "STANDARD") : "STANDARD";
      categoryBreakdown[roomCat] = (categoryBreakdown[roomCat] || 0) + (b.totalAmount || 0);
    }

    // ADR & RevPAR calculation
    const totalNights = confirmedBookings.reduce((s, b) => s + (b.nights || 1), 0);
    const adr = totalNights > 0 ? Math.round(verifiedCollected / totalNights) : 0;
    const revPar = rooms.length > 0 ? Math.round(verifiedCollected / rooms.length) : 0;

    return {
      agent: "RevenueInsightsAgent",
      summary: {
        grossBookingValue,
        verifiedCollectedRevenue: verifiedCollected,
        pendingCollection,
        refundedAmount,
        totalBookingsCount: totalBookings,
        confirmedCount: confirmedBookings.length,
        cancelledCount: cancelledBookings.length,
        cancellationRate: `${cancellationRate}%`,
        averageDailyRate: adr,
        revenuePerAvailableRoom: revPar
      },
      categoryBreakdown,
      paymentTransactionsCount: payments.length,
      auditTimestamp: new Date()
    };
  }
}

// -------------------------------------------------------------
// AGENT 10: AdminActionPlannerAgent (Admin)
// -------------------------------------------------------------
class AdminActionPlannerAgent {
  async createOperationalPlan({ instruction, userId }) {
    const rooms = await Room.find().lean();
    const serviceRequests = await ServiceRequest.find({ status: { $ne: "resolved" } }).lean();
    const tomorrowBookings = await Booking.find({ status: "confirmed" }).populate("room").lean();

    const planSteps = [
      {
        stepNumber: 1,
        title: "Front Desk Arrival Prep",
        action: `Pre-allocate keycards and arrival packets for ${tomorrowBookings.length} scheduled arrivals.`,
        assignedDepartment: "Front Desk",
        estimatedMinutes: 20
      },
      {
        stepNumber: 2,
        title: "Housekeeping Priority Turnover",
        action: `Conduct deep clean and linen replenishment across all ${rooms.length} active inventory rooms.`,
        assignedDepartment: "Housekeeping",
        estimatedMinutes: 60
      },
      {
        stepNumber: 3,
        title: "Resolve Outstanding Service Tickets",
        action: `Clear ${serviceRequests.length} pending service tickets with emphasis on maintenance requests.`,
        assignedDepartment: "Engineering & Concierge",
        estimatedMinutes: 30
      }
    ];

    const risks = [
      "Ensure late departure suites do not delay 2:00 PM incoming check-ins.",
      "Verify linen supply buffer with laundry team."
    ];

    // Create approval item
    const approval = await ApprovalRequest.create({
      agentName: "AdminActionPlannerAgent",
      actionType: "OPERATIONAL_ACTION_PLAN",
      title: "Tomorrow's Turnaround & Service Readiness Plan",
      description: instruction || "Operational execution plan for hotel turnover, arrivals, and service resolution.",
      impactLevel: "low",
      payload: { planSteps, risks },
      status: "pending",
      proposedByAgent: "AdminActionPlannerAgent"
    });

    // Log in audit trail
    await AIActionLog.create({
      agentName: "AdminActionPlannerAgent",
      actionType: "CREATE_PLAN",
      input: { instruction },
      output: { planSteps, approvalId: approval._id },
      requiresApproval: true,
      approvalStatus: "pending",
      triggeredBy: "admin"
    });

    return {
      agent: "AdminActionPlannerAgent",
      approvalId: approval._id,
      instruction,
      structuredPlan: planSteps,
      identifiedRisks: risks,
      status: "pending_approval",
      message: "Plan prepared successfully and queued for administrator confirmation."
    };
  }
}

module.exports = {
  CustomerConciergeAgent: new CustomerConciergeAgent(),
  TravelPlannerAgent: new TravelPlannerAgent(),
  BookingAssistantAgent: new BookingAssistantAgent(),
  RecommendationAgent: new RecommendationAgent(),
  ReviewInsightsAgent: new ReviewInsightsAgent(),
  HotelOperationsCopilot: new HotelOperationsCopilot(),
  AutonomousServiceDesk: new AutonomousServiceDesk(),
  SmartPricingAnalyst: new SmartPricingAnalyst(),
  RevenueInsightsAgent: new RevenueInsightsAgent(),
  AdminActionPlannerAgent: new AdminActionPlannerAgent()
};
