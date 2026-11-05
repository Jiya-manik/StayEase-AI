const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
  guestName: { type: String, required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  title: { type: String, default: "" },
  text: { type: String, required: true },
  source: { type: String, default: "StayEase Verified" },
  sentiment: { type: String, enum: ["positive", "neutral", "negative"], default: "positive" },
  themes: [String],
  verifiedStay: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Review", reviewSchema);
