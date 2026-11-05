const express = require("express");
const Room = require("../models/Room");
const Booking = require("../models/Booking");
const ServiceRequest = require("../models/ServiceRequest");
const Payment = require("../models/Payment");
const User = require("../models/User");
const AIActionLog = require("../models/AIActionLog");
const ApprovalRequest = require("../models/ApprovalRequest");
const { protect, adminOnly } = require("../middleware/auth");
const {
  HotelOperationsCopilot,
  AutonomousServiceDesk,
  SmartPricingAnalyst,
  RevenueInsightsAgent,
  AdminActionPlannerAgent
} = require("../services/aiAgents");
const backgroundWorker = require("../services/backgroundWorker");

const router = express.Router();

// Apply auth to all admin routes
router.use(protect);
router.use(adminOnly);

// 1. Dashboard Overview KPIs
router.get("/dashboard", async (_req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart.getTime() + 86400000);

    const [
      totalRooms,
      allBookings,
      todayArrivals,
      todayDepartures,
      openRequests,
      completedPayments
    ] = await Promise.all([
      Room.countDocuments({ active: true }),
      Booking.find().lean(),
      Booking.countDocuments({
        status: { $in: ["confirmed", "pending"] },
        checkIn: { $gte: todayStart, $lt: tomorrowStart }
      }),
      Booking.countDocuments({
        status: { $in: ["confirmed", "checked_in"] },
        checkOut: { $gte: todayStart, $lt: tomorrowStart }
      }),
      ServiceRequest.countDocuments({ status: { $ne: "resolved" } }),
      Payment.find({ status: "completed" }).lean()
    ]);

    const activeBookings = allBookings.filter(b => b.status === "confirmed" || b.status === "checked_in");
    const grossBookingValue = activeBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const verifiedRevenue = completedPayments.reduce((sum, p) => sum + p.amount, 0);
    const pendingBalance = Math.max(0, grossBookingValue - verifiedRevenue);

    const occupancyRate = totalRooms > 0 ? Math.min(100, Math.round((activeBookings.length / totalRooms) * 100)) : 0;
    const adr = activeBookings.length > 0 ? Math.round(verifiedRevenue / activeBookings.length) : 0;

    res.json({
      property: "StayEase Luxury Resort",
      metrics: {
        totalRooms,
        activeBookings: activeBookings.length,
        todayArrivals,
        todayDepartures,
        openRequests,
        occupancyRate,
        verifiedRevenue,
        grossBookingValue,
        pendingBalance,
        liveADR: adr
      },
      lastUpdated: new Date()
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. Hotel Operations Copilot (Agent 6)
router.post("/ai/copilot", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ message: "Query is required" });
    const response = await HotelOperationsCopilot.answerOperationalQuery(query);
    res.json(response);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. Autonomous Service Desk (Agent 7)
router.get("/ai/service-desk", async (_req, res) => {
  try {
    const triage = await AutonomousServiceDesk.runTriage();
    const allRequests = await ServiceRequest.find().sort({ createdAt: -1 }).limit(50);
    res.json({
      triageSummary: triage,
      requests: allRequests,
      workerStatus: backgroundWorker.getStatus()
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4. Smart Pricing Analyst (Agent 8)
router.get("/ai/pricing", async (_req, res) => {
  try {
    const report = await SmartPricingAnalyst.analyzeAndProposeRates();
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Apply pricing proposal to a room after admin approval
router.post("/ai/pricing/apply", async (req, res) => {
  try {
    const { roomId, proposedPrice } = req.body;
    if (!roomId || !proposedPrice) {
      return res.status(400).json({ message: "roomId and proposedPrice are required" });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ message: "Room not found" });

    const oldPrice = room.price;
    room.price = Number(proposedPrice);
    room.dynamicPriceMultiplier = Number((proposedPrice / (room.basePrice || proposedPrice)).toFixed(2));
    await room.save();

    await AIActionLog.create({
      agentName: "SmartPricingAnalyst",
      actionType: "APPLY_PRICE_UPDATE",
      input: { roomId, oldPrice, newPrice: proposedPrice },
      output: { room: room.name, updatedPrice: room.price },
      triggeredBy: req.user.role,
      userId: req.user._id,
      status: "success"
    });

    res.json({ message: `Price updated for ${room.name} to ₹${room.price}`, room });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 5. Revenue Insights Agent (Agent 9)
router.get("/ai/revenue", async (_req, res) => {
  try {
    const report = await RevenueInsightsAgent.generateFinancialReport();
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 6. Admin Action Planner (Agent 10)
router.post("/ai/action-plan", async (req, res) => {
  try {
    const { instruction } = req.body;
    const plan = await AdminActionPlannerAgent.createOperationalPlan({
      instruction: instruction || "Prepare for tomorrow's arrivals and schedule housekeeping",
      userId: req.user._id
    });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 7. Approval Queue Management
router.get("/approvals", async (_req, res) => {
  try {
    const requests = await ApprovalRequest.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/approvals/:id/decide", async (req, res) => {
  try {
    const { action, reason } = req.body; // action: "approve" or "reject"
    const approval = await ApprovalRequest.findById(req.params.id);
    if (!approval) return res.status(404).json({ message: "Approval request not found" });

    if (action === "approve") {
      approval.status = "approved";
      approval.approvedBy = req.user._id;
      approval.executedAt = new Date();
      approval.executionResult = { message: "Approved and executed by administrator.", executor: req.user.name };
    } else {
      approval.status = "rejected";
      approval.rejectionReason = reason || "Declined by administrator.";
    }

    await approval.save();

    await AIActionLog.create({
      agentName: approval.proposedByAgent,
      actionType: "APPROVAL_DECISION",
      input: { approvalId: approval._id, action, reason },
      output: approval.executionResult,
      triggeredBy: req.user.role,
      userId: req.user._id,
      status: "success"
    });

    res.json(approval);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 8. AI Execution Audit Logs
router.get("/audit-logs", async (_req, res) => {
  try {
    const logs = await AIActionLog.find().sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 9. Customers Directory
router.get("/customers", async (_req, res) => {
  try {
    const users = await User.find({ role: "guest" }).select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 10. Worker Status & Manual Trigger Pass
router.get("/worker/status", async (_req, res) => {
  res.json(backgroundWorker.getStatus());
});

router.post("/worker/trigger", async (_req, res) => {
  try {
    const result = await backgroundWorker.executePass();
    res.json({ message: "Triage pass executed manually", result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
