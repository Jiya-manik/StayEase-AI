const express = require("express");
const Room = require("../models/Room");
const Booking = require("../models/Booking");
const { RecommendationAgent } = require("../services/aiAgents");
const { protect, adminOnly } = require("../middleware/auth");
const router = express.Router();

// Get rooms with rich search, category filter, price filter & sorting
router.get("/", async (req, res) => {
  try {
    const { category, maxPrice, minCapacity, search, sort = "featured" } = req.query;
    const query = { active: true };

    if (category && category !== "ALL") {
      query.category = category.toUpperCase();
    }
    if (maxPrice) {
      query.price = { $lte: Number(maxPrice) };
    }
    if (minCapacity) {
      query.capacity = { $gte: Number(minCapacity) };
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { amenities: { $regex: search, $options: "i" } }
      ];
    }

    let sortOption = { createdAt: -1 };
    if (sort === "price_asc") sortOption = { price: 1 };
    else if (sort === "price_desc") sortOption = { price: -1 };
    else if (sort === "rating") sortOption = { rating: -1 };
    else if (sort === "capacity") sortOption = { capacity: -1 };

    const rooms = await Room.find(query).sort(sortOption).lean();
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get room by ID
router.get("/:id", async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Check availability with strict conflict checking
router.post("/availability", async (req, res) => {
  try {
    const { checkIn, checkOut, guests = 1, category } = req.body;
    if (!checkIn || !checkOut) {
      return res.status(400).json({ message: "checkIn and checkOut dates are required" });
    }

    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    if (outDate <= inDate) {
      return res.status(400).json({ message: "Check-out date must be after check-in date" });
    }

    // Find conflicting confirmed / pending / checked_in bookings
    const conflicting = await Booking.find({
      status: { $in: ["pending", "confirmed", "checked_in"] },
      checkIn: { $lt: outDate },
      checkOut: { $gt: inDate }
    }).select("room");

    const blockedRoomIds = new Set(conflicting.map(b => String(b.room)));

    const query = {
      active: true,
      capacity: { $gte: Number(guests || 1) }
    };
    if (category && category !== "ALL") {
      query.category = category.toUpperCase();
    }

    const rooms = await Room.find(query).lean();
    const availableRooms = rooms.filter(r => !blockedRoomIds.has(String(r._id)));

    res.json({
      availableRooms,
      totalAvailable: availableRooms.length,
      conflictedCount: blockedRoomIds.size,
      searchCriteria: { checkIn, checkOut, guests }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Recommendations API
router.get("/insights/recommendations", async (req, res) => {
  try {
    const { budget, category, amenities, travelType, guests } = req.query;
    const amenityList = amenities ? amenities.split(",") : [];
    const recommendations = await RecommendationAgent.getRankedRecommendations({
      budget,
      category,
      amenities: amenityList,
      travelType,
      guests: Number(guests || 2)
    });
    res.json(recommendations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Add new room
router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const { name, category, price, capacity, amenities, image, description, roomNumber, floor } = req.body;
    if (!name || !price) {
      return res.status(400).json({ message: "Room name and price are required" });
    }
    const newRoom = await Room.create({
      name,
      category: category || "STANDARD",
      price: Number(price),
      basePrice: Number(price),
      capacity: Number(capacity || 2),
      amenities: amenities || ["Wi-Fi", "Breakfast"],
      image: image || "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&q=80&w=800",
      description: description || "Refined, comfortable guest quarters.",
      roomNumber: roomNumber || `${Math.floor(100 + Math.random() * 400)}`,
      floor: floor || 1,
      active: true
    });
    res.status(201).json(newRoom);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Update room
router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Toggle active or delete room
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });
    room.active = !room.active;
    await room.save();
    res.json({ message: `Room status updated to ${room.active ? "Active" : "Archived"}`, room });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
