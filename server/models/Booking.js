const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  bookingReference: {
    type: String,
    unique: true,
    index: true,
    default: () => "SE-" + Math.floor(100000 + Math.random() * 900000)
  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  guestName: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: String,
  guests: { type: Number, default: 2 },
  room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
  roomName: String,
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  nights: { type: Number, default: 1 },
  basePrice: Number,
  addOns: [{
    name: String,
    price: Number
  }],
  totalAmount: { type: Number, required: true },
  message: String,
  status: {
    type: String,
    enum: ["pending", "confirmed", "checked_in", "completed", "cancelled"],
    default: "confirmed"
  },
  paymentStatus: {
    type: String,
    enum: ["unpaid", "paid", "refunded", "failed"],
    default: "unpaid"
  },
  cancellationReason: String,
  cancelledAt: Date
}, { timestamps: true });

module.exports = mongoose.model("Booking", bookingSchema);
