const Payment = require("../models/Payment");
const Booking = require("../models/Booking");
const crypto = require("crypto");

class MockPaymentAdapter {
  constructor() {
    this.name = "StayEase Sandbox Mock Payment Gateway (Development Only)";
  }

  // Generate server-side checkout intent
  async createPaymentIntent(bookingId, paymentMethod = "mock_card") {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new Error("Booking not found");

    const orderId = "order_mock_" + crypto.randomBytes(8).toString("hex");
    return {
      gateway: this.name,
      orderId,
      bookingId: booking._id,
      bookingReference: booking.bookingReference,
      amount: booking.totalAmount,
      currency: "INR",
      paymentMethod,
      mode: "SANDBOX_MOCK_VERIFIED"
    };
  }

  // Server-side verification and execution
  async processPayment({ bookingId, paymentMethod, cardLast4, upiId, userId }) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new Error("Booking not found");

    if (booking.paymentStatus === "paid") {
      throw new Error("This booking has already been paid for.");
    }

    const transactionId = "TXN_MOCK_" + Date.now() + "_" + Math.floor(1000 + Math.random() * 9000);

    const payment = await Payment.create({
      booking: booking._id,
      user: userId || booking.user,
      bookingReference: booking.bookingReference,
      amount: booking.totalAmount,
      currency: "INR",
      paymentMethod: paymentMethod || "mock_card",
      status: "completed",
      transactionId,
      gateway: this.name,
      cardLast4: cardLast4 || "4242",
      upiId: upiId || null,
      verified: true,
      verifiedAt: new Date(),
      notes: "Mock payment processed in Sandbox mode with server-side validation."
    });

    booking.paymentStatus = "paid";
    booking.status = "confirmed";
    await booking.save();

    return {
      success: true,
      transactionId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      bookingReference: booking.bookingReference,
      verifiedAt: payment.verifiedAt
    };
  }

  async refundPayment(bookingId, reason = "Customer requested cancellation") {
    const payment = await Payment.findOne({ booking: bookingId, status: "completed" });
    if (!payment) {
      return { refunded: false, message: "No completed payment record found to refund" };
    }

    payment.status = "refunded";
    payment.notes = (payment.notes || "") + ` | Refunded: ${reason}`;
    await payment.save();

    const booking = await Booking.findById(bookingId);
    if (booking) {
      booking.paymentStatus = "refunded";
      await booking.save();
    }

    return {
      refunded: true,
      refundTransactionId: "REF_MOCK_" + Date.now(),
      amount: payment.amount,
      bookingReference: payment.bookingReference
    };
  }
}

module.exports = new MockPaymentAdapter();
