const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  bookingReference: String,
  amount: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  paymentMethod: { type: String, enum: ["mock_card", "mock_upi", "mock_netbanking"], default: "mock_card" },
  status: { type: String, enum: ["pending", "completed", "failed", "refunded"], default: "completed" },
  transactionId: { type: String, required: true, unique: true },
  gateway: { type: String, default: "MockPaymentAdapter_Sandbox" },
  cardLast4: { type: String, default: "4242" },
  upiId: String,
  verified: { type: Boolean, default: true },
  verifiedAt: { type: Date, default: Date.now },
  notes: String
}, { timestamps: true });

module.exports = mongoose.model("Payment", paymentSchema);
