const express = require("express");
const Booking = require("../models/Booking");
const Room = require("../models/Room");
const { optionalAuth, protect, adminOnly } = require("../middleware/auth");
const MockPayment = require("../services/payment");
const router = express.Router();

// Create new booking with strict server-side validation & conflict check
router.post("/", optionalAuth, async (req, res) => {
  try {
    const { guestName, email, phone, guests = 2, roomId, checkIn, checkOut, message, addOns = [] } = req.body;

    if (!guestName || !email || !roomId || !checkIn || !checkOut) {
      return res.status(400).json({ message: "Missing required booking details (Name, Email, Room, Dates)" });
    }

    const inDate = new Date(checkIn);
    const outDate = new Date(checkOut);
    if (outDate <= inDate) {
      return res.status(400).json({ message: "Check-out date must be after check-in date" });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ message: "Selected room not found" });

    // Simultaneous / Overlapping booking conflict check
    const conflict = await Booking.findOne({
      room: roomId,
      status: { $in: ["pending", "confirmed", "checked_in"] },
      checkIn: { $lt: outDate },
      checkOut: { $gt: inDate }
    });

    if (conflict) {
      return res.status(409).json({
        message: "This room is no longer available for the chosen dates. Please pick alternative dates or another suite."
      });
    }

    // Server-side nights and total calculation
    const nights = Math.max(1, Math.ceil((outDate - inDate) / 86400000));
    const roomSubtotal = nights * room.price;
    const addOnTotal = (addOns || []).reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    const taxes = Math.round((roomSubtotal + addOnTotal) * 0.12);
    const totalAmount = roomSubtotal + addOnTotal + taxes;

    const booking = await Booking.create({
      user: req.user ? req.user._id : null,
      guestName,
      email: email.toLowerCase(),
      phone: phone || "",
      guests: Number(guests || 2),
      room: room._id,
      roomName: room.name,
      checkIn: inDate,
      checkOut: outDate,
      nights,
      basePrice: room.price,
      addOns: addOns || [],
      totalAmount,
      message: message || "",
      status: "confirmed",
      paymentStatus: "unpaid"
    });

    res.status(201).json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get bookings list
router.get("/", optionalAuth, async (req, res) => {
  try {
    const { email } = req.query;
    let filter = {};

    if (req.user) {
      if (req.user.role === "admin" || req.user.role === "staff") {
        // Admins can see all bookings
        filter = {};
      } else {
        // Logged-in guest sees their bookings
        filter = { $or: [{ user: req.user._id }, { email: req.user.email }] };
      }
    } else if (email) {
      filter = { email: email.toLowerCase() };
    }

    const bookings = await Booking.find(filter)
      .populate("room")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get booking details
router.get("/:id", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("room");
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Generate Invoice / Receipt
router.get("/:id/invoice", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("room");
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const roomSubtotal = (booking.nights || 1) * (booking.basePrice || (booking.room ? booking.room.price : 4200));
    const addOnTotal = (booking.addOns || []).reduce((s, a) => s + (a.price || 0), 0);
    const taxes = Math.round((roomSubtotal + addOnTotal) * 0.12);

    const invoice = {
      hotel: {
        name: "StayEase Luxury Resort & Spa Estate",
        address: "74 Heritage Ocean Promenade, Mumbai 400001",
        phone: "+91 (022) 8000-EASE",
        email: "concierge@stayease.com",
        gstin: "27AABCS1429B1Z8"
      },
      invoiceNumber: `INV-${booking.bookingReference || booking._id.toString().slice(-6).toUpperCase()}`,
      invoiceDate: new Date(),
      bookingReference: booking.bookingReference,
      guest: {
        name: booking.guestName,
        email: booking.email,
        phone: booking.phone || "Not provided"
      },
      stay: {
        roomName: booking.roomName,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights: booking.nights,
        guests: booking.guests
      },
      lineItems: [
        {
          description: `${booking.roomName} (${booking.nights} night${booking.nights > 1 ? "s" : ""} @ ₹${(booking.basePrice || (booking.room ? booking.room.price : 0)).toLocaleString("en-IN")})`,
          amount: roomSubtotal
        },
        ...(booking.addOns || []).map(a => ({
          description: `Add-on: ${a.name}`,
          amount: a.price
        })),
        {
          description: "Hospitality GST (12%)",
          amount: taxes
        }
      ],
      totalAmount: booking.totalAmount,
      paymentStatus: booking.paymentStatus,
      status: booking.status
    };

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Cancel booking according to policy
router.post("/:id/cancel", optionalAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.status === "cancelled") {
      return res.status(400).json({ message: "Booking is already cancelled" });
    }

    booking.status = "cancelled";
    booking.cancellationReason = reason || "Guest requested cancellation";
    booking.cancelledAt = new Date();

    // If paid, trigger mock refund
    let refundResult = null;
    if (booking.paymentStatus === "paid") {
      refundResult = await MockPayment.refundPayment(booking._id, booking.cancellationReason);
    } else {
      booking.paymentStatus = "refunded";
    }

    await booking.save();

    res.json({
      message: "Booking successfully cancelled",
      bookingReference: booking.bookingReference,
      status: booking.status,
      refund: refundResult
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin update booking status
router.patch("/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (status) booking.status = status;
    if (paymentStatus) booking.paymentStatus = paymentStatus;
    await booking.save();

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
