const express = require("express");
const ServiceRequest = require("../models/ServiceRequest");
const { optionalAuth, protect, adminOnly } = require("../middleware/auth");
const { AutonomousServiceDesk } = require("../services/aiAgents");
const router = express.Router();

// Create new service request
router.post("/", optionalAuth, async (req, res) => {
  try {
    const { guestName, roomNumber, type, description, priority = "normal" } = req.body;
    if (!guestName || !roomNumber || !type) {
      return res.status(400).json({ message: "Guest name, room number, and request type are required" });
    }

    // Determine initial priority
    let initialPriority = priority;
    if (type === "drinking_water" || type === "maintenance") {
      initialPriority = "high";
    }

    const request = await ServiceRequest.create({
      user: req.user ? req.user._id : null,
      guestName,
      roomNumber,
      type,
      description: description || "",
      priority: initialPriority,
      status: "open",
      source: req.user ? "guest" : "guest"
    });

    // Run triage pass so priority and suggested staff role get assigned
    await AutonomousServiceDesk.runTriage();

    const refreshed = await ServiceRequest.findById(request._id);
    res.status(201).json(refreshed || request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get service requests
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { roomNumber } = req.query;
    let filter = {};

    if (req.user && (req.user.role === "admin" || req.user.role === "staff")) {
      filter = {};
    } else if (req.user) {
      filter = { $or: [{ user: req.user._id }, { guestName: req.user.name }] };
    } else if (roomNumber) {
      filter = { roomNumber };
    }

    const requests = await ServiceRequest.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update request status or assign staff (staff/admin)
router.patch("/:id", protect, adminOnly, async (req, res) => {
  try {
    const { status, assignedStaff, notes, priority } = req.body;
    const request = await ServiceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: "Service request not found" });

    if (status) {
      request.status = status;
      if (status === "resolved") request.resolvedAt = new Date();
    }
    if (assignedStaff) request.assignedStaff = assignedStaff;
    if (notes) request.notes = notes;
    if (priority) request.priority = priority;

    await request.save();
    res.json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
