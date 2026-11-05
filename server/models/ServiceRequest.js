const mongoose = require("mongoose");

const serviceRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
  guestName: { type: String, required: true },
  roomNumber: { type: String, required: true },
  type: {
    type: String,
    enum: [
      "housekeeping",
      "fresh_towels",
      "drinking_water",
      "extra_bedding",
      "maintenance",
      "room_service",
      "concierge_request",
      "late_checkout",
      "luggage_assistance"
    ],
    required: true
  },
  description: { type: String, default: "" },
  priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" },
  status: { type: String, enum: ["open", "in_progress", "resolved", "cancelled"], default: "open" },
  source: { type: String, enum: ["guest", "ai", "staff"], default: "guest" },
  assignedStaff: { type: String, default: "Unassigned" },
  aiClassification: {
    suggestedPriority: String,
    category: String,
    estimatedResolutionMins: Number,
    recommendedStaffRole: String,
    analyzedAt: Date
  },
  notes: String,
  resolvedAt: Date
}, { timestamps: true });

module.exports = mongoose.model("ServiceRequest", serviceRequestSchema);
