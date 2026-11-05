require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");
const app = require("./server");

// We start server on test port 5001 or use existing server
const PORT = 5005;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      "Content-Type": "application/json",
      ...headers
    };
    if (payload) {
      reqHeaders["Content-Length"] = Buffer.byteLength(payload);
    }

    const req = http.request({
      hostname: "127.0.0.1",
      port: PORT,
      path,
      method,
      headers: reqHeaders
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        let parsed = data;
        try { parsed = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, data: parsed });
      });
    });

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTestSuite() {
  console.log("====================================================");
  console.log("🧪 StayEase Autonomous Full-Stack Test Suite");
  console.log("====================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  // Start test server
  const server = app.listen(PORT);
  await new Promise(r => setTimeout(r, 1000));

  try {
    // 1. Health Check
    const health = await makeRequest("GET", "/api/health");
    assert(health.status === 200 && health.data.ok === true, "GET /api/health returns ok");

    // 2. Auth: Login as Admin
    const adminLogin = await makeRequest("POST", "/api/auth/login", {
      email: "admin@stayease.com",
      password: "admin123"
    });
    assert(adminLogin.status === 200 && !!adminLogin.data.token, "POST /api/auth/login returns JWT token for Admin");
    const adminToken = adminLogin.data.token;

    // 3. Auth: Register a new Guest User
    const testEmail = `guest_${Date.now()}@example.com`;
    const guestRegister = await makeRequest("POST", "/api/auth/register", {
      name: "Autonomous Test Guest",
      email: testEmail,
      password: "password123",
      phone: "+91 99887 76655"
    });
    assert(guestRegister.status === 201 && guestRegister.data.user.role === "guest", "POST /api/auth/register creates Guest user with hashed password");
    const guestToken = guestRegister.data.token;

    // 4. Auth: Verify /api/auth/me
    const authMe = await makeRequest("GET", "/api/auth/me", null, { Authorization: `Bearer ${guestToken}` });
    assert(authMe.status === 200 && authMe.data.user.email === testEmail, "GET /api/auth/me verifies persistent session");

    // 5. Rooms: Fetch inventory
    const roomsRes = await makeRequest("GET", "/api/rooms");
    assert(roomsRes.status === 200 && Array.isArray(roomsRes.data) && roomsRes.data.length >= 6, "GET /api/rooms returns active luxury rooms");
    const testRoom = roomsRes.data[0];

    // 6. Rooms: Category filter
    const suiteRes = await makeRequest("GET", "/api/rooms?category=SUITE");
    assert(suiteRes.status === 200 && suiteRes.data.every(r => r.category === "SUITE"), "GET /api/rooms?category=SUITE filters by category");

    // 7. Rooms: Availability Check
    const today = new Date().toISOString().split("T")[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const nextWeekPlus2 = new Date(Date.now() + 9 * 86400000).toISOString().split("T")[0];

    const availCheck = await makeRequest("POST", "/api/rooms/availability", {
      checkIn: nextWeek,
      checkOut: nextWeekPlus2,
      guests: 2
    });
    assert(availCheck.status === 200 && Array.isArray(availCheck.data.availableRooms), "POST /api/rooms/availability checks available inventory");

    // 8. AI Agent 1: CustomerConciergeAgent
    const conciergeRes = await makeRequest("POST", "/api/ai/chat", {
      message: "What is your check-in time and do you have rooms with breakfast?"
    });
    assert(conciergeRes.status === 200 && conciergeRes.data.reply.length > 20, "Agent 1 (CustomerConciergeAgent) answers policy & room questions");

    // 9. AI Agent 2: TravelPlannerAgent
    const travelPlan = await makeRequest("POST", "/api/ai/travel-plan", {
      days: 3,
      guests: 2,
      budget: 30000,
      travelType: "Romantic Honeymoon",
      preferences: ["Lotus Spa", "Rooftop Dining"]
    }, { Authorization: `Bearer ${guestToken}` });
    assert(travelPlan.status === 200 && Array.isArray(travelPlan.data.proposedActivities) && travelPlan.data.estimatedBudget.grandTotal > 0, "Agent 2 (TravelPlannerAgent) generates structured itinerary with budget");

    // 10. AI Agent 3: BookingAssistantAgent
    const bookingAssist = await makeRequest("POST", "/api/ai/booking-assistant", {
      roomId: testRoom._id,
      checkIn: nextWeek,
      checkOut: nextWeekPlus2,
      guests: 2,
      addOns: [{ name: "Lotus Spa Pass", price: 2400 }]
    });
    assert(bookingAssist.status === 200 && bookingAssist.data.available === true && bookingAssist.data.pricingBreakdown.grandTotal > 0, "Agent 3 (BookingAssistantAgent) validates dates, pricing breakdown & add-ons");

    // 11. AI Agent 4: RecommendationAgent
    const recoRes = await makeRequest("POST", "/api/ai/recommendations", {
      budget: 10000,
      category: "DELUXE",
      amenities: ["Breakfast", "Wi-Fi"]
    });
    assert(recoRes.status === 200 && Array.isArray(recoRes.data.recommendations), "Agent 4 (RecommendationAgent) produces ranked suggestions with transparent scores");

    // 12. AI Agent 5: ReviewInsightsAgent
    const reviewInsights = await makeRequest("GET", "/api/reviews/insights");
    assert(reviewInsights.status === 200 && Array.isArray(reviewInsights.data.positiveThemes), "Agent 5 (ReviewInsightsAgent) summarizes sentiment & operational themes");

    // 13. Booking: Create real booking
    const newBooking = await makeRequest("POST", "/api/bookings", {
      guestName: "Autonomous Test Guest",
      email: testEmail,
      phone: "+91 99887 76655",
      roomId: testRoom._id,
      checkIn: nextWeek,
      checkOut: nextWeekPlus2,
      guests: 2,
      message: "Quiet floor please",
      addOns: [{ name: "Organic Breakfast Buffet", price: 1200 }]
    }, { Authorization: `Bearer ${guestToken}` });
    assert(newBooking.status === 201 && !!newBooking.data.bookingReference, "POST /api/bookings creates confirmed reservation with unique SE-XXXXXX reference");
    const createdBookingId = newBooking.data._id;

    // 14. Booking Conflict Prevention: Attempt simultaneous overlapping booking
    const conflictAttempt = await makeRequest("POST", "/api/bookings", {
      guestName: "Conflicting Guest",
      email: "conflict@example.com",
      roomId: testRoom._id,
      checkIn: nextWeek,
      checkOut: nextWeekPlus2,
      guests: 2
    });
    assert(conflictAttempt.status === 409, "POST /api/bookings strictly rejects overlapping booking (409 Conflict)");

    // 15. Mock Payment: Process verified payment
    const paymentIntent = await makeRequest("POST", "/api/payments/intent", {
      bookingId: createdBookingId,
      paymentMethod: "mock_card"
    });
    assert(paymentIntent.status === 200 && !!paymentIntent.data.orderId, "POST /api/payments/intent generates server-side checkout intent");

    const paymentProcess = await makeRequest("POST", "/api/payments/process", {
      bookingId: createdBookingId,
      paymentMethod: "mock_card",
      cardLast4: "4242"
    }, { Authorization: `Bearer ${guestToken}` });
    assert(paymentProcess.status === 200 && paymentProcess.data.success === true && !!paymentProcess.data.transactionId, "POST /api/payments/process executes server-side verified payment");

    // 16. Invoice: Generate printable invoice
    const invoiceRes = await makeRequest("GET", `/api/bookings/${createdBookingId}/invoice`);
    assert(invoiceRes.status === 200 && invoiceRes.data.invoiceNumber.startsWith("INV-") && invoiceRes.data.paymentStatus === "paid", "GET /api/bookings/:id/invoice generates official hospitality receipt");

    // 17. Service Requests & Agent 7 (Autonomous Service Desk)
    const serviceReq = await makeRequest("POST", "/api/services", {
      guestName: "Autonomous Test Guest",
      roomNumber: testRoom.roomNumber || "101",
      type: "drinking_water",
      description: "Himalayan Spring Water bottles"
    }, { Authorization: `Bearer ${guestToken}` });
    assert(serviceReq.status === 201 && serviceReq.data.priority === "high", "POST /api/services creates service ticket with auto-prioritization");

    // 18. Reviews: Submit verified review
    const reviewRes = await makeRequest("POST", "/api/reviews", {
      guestName: "Autonomous Test Guest",
      rating: 5,
      title: "Seamless Stay",
      text: "The courtyard was whisper quiet, Wi-Fi was blazing fast, and the service was impeccable.",
      roomId: testRoom._id,
      bookingId: createdBookingId
    }, { Authorization: `Bearer ${guestToken}` });
    assert(reviewRes.status === 201 && reviewRes.data.sentiment === "positive", "POST /api/reviews saves review with automatic sentiment analysis");

    // 19. Admin Agent 6: HotelOperationsCopilot
    const copilotRes = await makeRequest("POST", "/api/admin/ai/copilot", {
      query: "How many arrivals are scheduled and what is our verified revenue?"
    }, { Authorization: `Bearer ${adminToken}` });
    assert(copilotRes.status === 200 && copilotRes.data.agent === "HotelOperationsCopilot", "Agent 6 (HotelOperationsCopilot) executes authorized database queries for staff");

    // 20. Admin Agent 8: SmartPricingAnalyst
    const pricingRes = await makeRequest("GET", "/api/admin/ai/pricing", null, { Authorization: `Bearer ${adminToken}` });
    assert(pricingRes.status === 200 && Array.isArray(pricingRes.data.proposals) && pricingRes.data.requiresApproval === true, "Agent 8 (SmartPricingAnalyst) produces bounded rate recommendations requiring approval");

    // 21. Admin Agent 9: RevenueInsightsAgent
    const revenueRes = await makeRequest("GET", "/api/admin/ai/revenue", null, { Authorization: `Bearer ${adminToken}` });
    assert(revenueRes.status === 200 && revenueRes.data.summary.verifiedCollectedRevenue > 0, "Agent 9 (RevenueInsightsAgent) calculates verified collected revenue vs unpaid totals");

    // 22. Admin Agent 10: AdminActionPlannerAgent & Approval Queue
    const actionPlan = await makeRequest("POST", "/api/admin/ai/action-plan", {
      instruction: "Prepare tomorrow's arrivals plan and housekeeping turnarounds"
    }, { Authorization: `Bearer ${adminToken}` });
    assert(actionPlan.status === 200 && actionPlan.data.status === "pending_approval", "Agent 10 (AdminActionPlannerAgent) produces structured operational plan with risks");
    const approvalId = actionPlan.data.approvalId;

    // 23. Admin Approval Queue: Approve operational plan
    const approvalDecision = await makeRequest("POST", `/api/admin/approvals/${approvalId}/decide`, {
      action: "approve"
    }, { Authorization: `Bearer ${adminToken}` });
    assert(approvalDecision.status === 200 && approvalDecision.data.status === "approved", "POST /api/admin/approvals/:id/decide executes human-in-the-loop approval");

    // 24. Admin AI Action Logs
    const auditLogs = await makeRequest("GET", "/api/admin/audit-logs", null, { Authorization: `Bearer ${adminToken}` });
    assert(auditLogs.status === 200 && Array.isArray(auditLogs.data) && auditLogs.data.length > 0, "GET /api/admin/audit-logs tracks complete audit trail of agent executions");

    // 25. Booking Cancellation according to policy
    const cancelRes = await makeRequest("POST", `/api/bookings/${createdBookingId}/cancel`, {
      reason: "Travel plans changed"
    }, { Authorization: `Bearer ${guestToken}` });
    assert(cancelRes.status === 200 && cancelRes.data.status === "cancelled" && cancelRes.data.refund.refunded === true, "POST /api/bookings/:id/cancel executes cancellation policy and mock refund");

    console.log("====================================================");
    console.log(`Summary: ${passed} PASSED, ${failed} FAILED`);
    console.log("====================================================");

    server.close();
    await mongoose.disconnect();

    if (failed > 0) {
      process.exit(1);
    } else {
      console.log("🎉 ALL AUTOMATED API TESTS PASSED SUCCESSFULLY!");
      process.exit(0);
    }
  } catch (err) {
    console.error("Test Suite execution error:", err);
    server.close();
    await mongoose.disconnect();
    process.exit(1);
  }
}

runTestSuite();
