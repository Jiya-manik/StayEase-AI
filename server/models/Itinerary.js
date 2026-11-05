const mongoose = require("mongoose");

const itinerarySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  guestName: String,
  email: String,
  destination: { type: String, default: "StayEase Luxury Resort & Heritage Estate" },
  checkIn: Date,
  checkOut: Date,
  days: { type: Number, default: 3 },
  guests: { type: Number, default: 2 },
  budget: Number,
  travelType: { type: String, default: "Leisure & Wellness" },
  preferences: [String],
  stayPlan: {
    roomType: String,
    roomPrice: Number,
    roomTotal: Number,
    recommendedAmenities: [String],
    overview: String
  },
  proposedActivities: [{
    day: Number,
    title: String,
    time: String,
    description: String,
    location: String,
    estimatedCost: Number,
    isExternal: Boolean
  }],
  estimatedBudget: {
    roomTotal: Number,
    activitiesTotal: Number,
    diningTotal: Number,
    taxesAndFees: Number,
    grandTotal: Number
  },
  status: { type: String, enum: ["draft", "saved", "confirmed"], default: "saved" },
  notes: String
}, { timestamps: true });

module.exports = mongoose.model("Itinerary", itinerarySchema);
