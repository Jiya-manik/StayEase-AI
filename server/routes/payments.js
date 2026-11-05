const express = require("express");
const MockPayment = require("../services/payment");
const Payment = require("../models/Payment");
const { optionalAuth } = require("../middleware/auth");
const router = express.Router();

// Generate checkout intent
router.post("/intent", async (req, res) => {
  try {
    const { bookingId, paymentMethod } = req.body;
    if (!bookingId) return res.status(400).json({ message: "Booking ID is required" });

    const intent = await MockPayment.createPaymentIntent(bookingId, paymentMethod);
    res.json(intent);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Process verified mock payment
router.post("/process", optionalAuth, async (req, res) => {
  try {
    const { bookingId, paymentMethod, cardLast4, upiId } = req.body;
    if (!bookingId) return res.status(400).json({ message: "Booking ID is required" });

    const result = await MockPayment.processPayment({
      bookingId,
      paymentMethod,
      cardLast4,
      upiId,
      userId: req.user ? req.user._id : null
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get payment record for booking
router.get("/booking/:bookingId", async (req, res) => {
  try {
    const payment = await Payment.findOne({ booking: req.params.bookingId });
    if (!payment) return res.status(404).json({ message: "No payment record found" });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
