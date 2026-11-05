// StayEase Autonomous Hotel Platform — Client Application Logic
const API = "/api";

let currentUser = null;
let currentToken = localStorage.getItem("stayease_token") || null;
let cachedRooms = [];
let selectedRoomForBooking = null;

// Generic API helper
async function api(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (currentToken) {
    headers["Authorization"] = `Bearer ${currentToken}`;
  }

  const res = await fetch(API + url, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

// -------------------------------------------------------------
// INITIALIZATION & AUTH STATE
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  setupDefaultDates();
  initScrollObserver();
  animateCounters();
  initLiveToastRotator();
  initButtonRipples();
  await checkAuthSession();
  await loadRooms();
  await loadReviews();
  await loadReviewInsights();
  await checkGeminiStatus();
  initStayEaseMap();
  await loadNearbyPlaces();
});

function setupDefaultDates() {
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 86400000);
  const nextWeekPlus2 = new Date(today.getTime() + 9 * 86400000);

  const formatDate = (d) => d.toISOString().split("T")[0];

  const inFields = ["heroCheckIn", "bookCheckIn", "calcCheckIn", "assistCheckIn"];
  const outFields = ["heroCheckOut", "bookCheckOut", "calcCheckOut", "assistCheckOut"];

  inFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = formatDate(nextWeek);
  });
  outFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = formatDate(nextWeekPlus2);
  });
}

async function checkAuthSession() {
  if (!currentToken) {
    updateNavAuthUI(null);
    return;
  }
  try {
    const res = await api("/auth/me");
    currentUser = res.user;
    updateNavAuthUI(currentUser);
  } catch (e) {
    console.warn("Session expired or invalid:", e.message);
    handleLogout();
  }
}

function updateNavAuthUI(user) {
  const authContainer = document.getElementById("navAuthContainer");
  const userContainer = document.getElementById("navUserContainer");
  const adminBtn = document.getElementById("navAdminBtn");

  if (user) {
    if (authContainer) authContainer.classList.add("hidden");
    if (userContainer) {
      userContainer.classList.remove("hidden");
      userContainer.classList.add("flex");
      document.getElementById("navUserName").innerText = user.name;
      document.getElementById("navUserInitial").innerText = user.name.charAt(0).toUpperCase();
      const roleBadge = document.getElementById("navUserRoleBadge");
      roleBadge.innerText = user.role;
      if (user.role === "admin") {
        roleBadge.className = "bg-amber-100 text-amber-900 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase";
      } else {
        roleBadge.className = "bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase";
      }
    }
  } else {
    if (authContainer) authContainer.classList.remove("hidden");
    if (userContainer) {
      userContainer.classList.add("hidden");
      userContainer.classList.remove("flex");
    }
  }
}

function handleLogout() {
  localStorage.removeItem("stayease_token");
  currentToken = null;
  currentUser = null;
  updateNavAuthUI(null);
  closeCustomerPortal();
  closeAdminConsole();
}

// Quick Demo Login Shortcuts
async function quickLoginGuest() {
  try {
    const res = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "priya@example.com", password: "guest123" })
    });
    currentToken = res.token;
    localStorage.setItem("stayease_token", currentToken);
    currentUser = res.user;
    updateNavAuthUI(currentUser);
    alert(`Signed in as Guest: ${currentUser.name}`);
    openCustomerPortal("bookings");
  } catch (err) {
    alert("Guest demo login: " + err.message);
  }
}

async function quickLoginAdmin() {
  try {
    const res = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@stayease.com", password: "admin123" })
    });
    currentToken = res.token;
    localStorage.setItem("stayease_token", currentToken);
    currentUser = res.user;
    updateNavAuthUI(currentUser);
    alert(`Signed in as Administrator: ${currentUser.name}`);
    openAdminConsole();
  } catch (err) {
    alert("Admin demo login: " + err.message);
  }
}

// -------------------------------------------------------------
// ROOMS DISCOVERY & SEARCH
// -------------------------------------------------------------
let activeCategoryFilter = "ALL";
let activeSortOption = "featured";
let activeSearchQuery = "";

async function loadRooms() {
  try {
    const params = new URLSearchParams();
    if (activeCategoryFilter !== "ALL") params.append("category", activeCategoryFilter);
    if (activeSortOption !== "featured") params.append("sort", activeSortOption);
    if (activeSearchQuery) params.append("search", activeSearchQuery);

    const rooms = await api(`/rooms?${params.toString()}`);
    cachedRooms = rooms;
    renderRoomsGrid(rooms);
    populateAssistRoomDropdown(rooms);
  } catch (err) {
    console.error("Failed to load rooms:", err);
    document.getElementById("roomsGrid").innerHTML = `
      <div class="col-span-full py-8 text-center text-rose-700 bg-rose-50 rounded-2xl border border-rose-200 text-xs">
        Failed to load rooms: ${escapeHTML(err.message)}
      </div>`;
  }
}

function renderRoomsGrid(rooms) {
  const grid = document.getElementById("roomsGrid");
  if (!grid) return;

  if (!rooms.length) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-brand-muted bg-white rounded-3xl border border-brand-border">
        <i class="fa-solid fa-bed text-2xl text-brand-tag mb-2"></i>
        <p class="text-sm font-semibold">No suites matched your criteria.</p>
        <p class="text-xs text-brand-lightMuted mt-1">Try resetting the category filter or search keywords.</p>
      </div>`;
    return;
  }

  grid.innerHTML = rooms.map(room => {
    const amenitiesBadges = (room.amenities || []).slice(0, 3).map(a =>
      `<span class="bg-brand-bg text-[10px] text-brand-muted px-2 py-0.5 rounded-md border border-brand-border">${escapeHTML(a)}</span>`
    ).join(" ");

    return `
      <div class="bg-white border border-brand-border rounded-3xl overflow-hidden shadow-sm luxury-card-motion reveal-on-scroll flex flex-col group transition-all duration-500">
        <div class="h-60 overflow-hidden relative cursor-pointer" onclick='openRoomDetailModal(${JSON.stringify(room._id)})'>
          <img 
            src="${escapeHTML(room.image)}" 
            alt="${escapeHTML(room.name)}" 
            class="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
          />
          <div class="absolute top-3.5 left-3.5 glass-badge px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase text-brand-tag border border-brand-border shadow-sm">
            ${escapeHTML(room.category)}
          </div>
          <div class="absolute top-3.5 right-3.5 glass-badge px-2.5 py-1 rounded-full text-xs font-semibold text-brand-dark flex items-center gap-1 border border-brand-border shadow-sm">
            <i class="fa-solid fa-star text-amber-500 text-[10px]"></i>
            <span>${room.rating || 4.9}</span>
          </div>
        </div>

        <div class="p-6 flex-1 flex flex-col justify-between space-y-4">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs text-brand-lightMuted font-medium">
                <i class="fa-solid fa-user-group text-[10px] mr-1"></i> Up to ${room.capacity} Guests
              </span>
              <span class="font-serif text-lg font-semibold text-brand-dark">
                ₹${Number(room.price).toLocaleString("en-IN")}
                <span class="text-xs font-normal text-brand-muted">/ night</span>
              </span>
            </div>

            <h3 class="font-serif text-xl text-brand-heading font-medium mb-1.5 cursor-pointer hover:text-black transition" onclick='openRoomDetailModal(${JSON.stringify(room._id)})'>
              ${escapeHTML(room.name)}
            </h3>

            <p class="text-xs text-brand-muted leading-relaxed line-clamp-2">
              ${escapeHTML(room.description)}
            </p>

            <div class="flex flex-wrap gap-1.5 mt-3">
              ${amenitiesBadges}
            </div>
          </div>

          <div class="pt-2 grid grid-cols-2 gap-2 border-t border-brand-border/60">
            <button onclick='openRoomDetailModal(${JSON.stringify(room._id)})' class="w-full py-2 rounded-full border border-brand-border text-xs font-semibold text-brand-dark hover:bg-brand-bg transition transform hover:-translate-y-0.5">
              View Details
            </button>
            <button onclick='startBookingRoom(${JSON.stringify(room._id)})' class="shimmer-hover w-full py-2 rounded-full bg-brand-btnPrimary hover:bg-brand-btnPrimaryHover text-brand-dark text-xs font-semibold transition shadow-sm transform hover:-translate-y-0.5">
              Reserve Room
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  initScrollObserver();
  initCardTiltEffect();
}

function filterRoomsByCategory(cat) {
  activeCategoryFilter = cat;
  document.querySelectorAll(".room-cat-tab").forEach(tab => {
    tab.className = "room-cat-tab bg-brand-bg hover:bg-brand-border text-brand-muted px-4 py-1.5 rounded-full text-xs font-medium transition";
  });
  const activeId = cat === "ALL" ? "tabCatAll" : `tabCat${cat.charAt(0) + cat.slice(1).toLowerCase()}`;
  const el = document.getElementById(activeId);
  if (el) el.className = "room-cat-tab bg-brand-dark text-white px-4 py-1.5 rounded-full text-xs font-semibold transition";
  loadRooms();
}

function handleRoomSort(val) {
  activeSortOption = val;
  loadRooms();
}

let searchDebounce = null;
function handleRoomSearch(val) {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    activeSearchQuery = val.trim();
    loadRooms();
  }, 300);
}

// Hero Search Widget Handler
async function handleHeroSearch(e) {
  e.preventDefault();
  const checkIn = document.getElementById("heroCheckIn").value;
  const checkOut = document.getElementById("heroCheckOut").value;
  const guests = document.getElementById("heroGuests").value;
  const category = document.getElementById("heroCategory").value;

  try {
    const res = await api("/rooms/availability", {
      method: "POST",
      body: JSON.stringify({ checkIn, checkOut, guests, category })
    });

    renderRoomsGrid(res.availableRooms);
    document.getElementById("rooms").scrollIntoView({ behavior: "smooth" });
  } catch (err) {
    alert("Availability check error: " + err.message);
  }
}

// -------------------------------------------------------------
// ROOM DETAILS MODAL
// -------------------------------------------------------------
let detailRoomObj = null;

function openRoomDetailModal(roomId) {
  const room = cachedRooms.find(r => r._id === roomId);
  if (!room) return;
  detailRoomObj = room;

  document.getElementById("detailRoomImage").src = room.image;
  document.getElementById("detailRoomCategory").innerText = room.category;
  document.getElementById("detailRoomName").innerText = room.name;
  document.getElementById("detailRoomPrice").innerText = `₹${room.price.toLocaleString("en-IN")}`;
  document.getElementById("detailRoomDescription").innerText = room.description;
  document.getElementById("detailRoomSpecs").innerText = `Room ${room.roomNumber || "305"} • Floor ${room.floor || 2} • ${room.bedType || "King Bed"} • Max ${room.capacity} Guests`;

  const amenitiesContainer = document.getElementById("detailRoomAmenities");
  amenitiesContainer.innerHTML = (room.amenities || []).map(a => `
    <span class="bg-brand-bg text-xs font-medium text-brand-dark px-3 py-1 rounded-full border border-brand-border">
      ✓ ${escapeHTML(a)}
    </span>
  `).join("");

  document.getElementById("detailBookBtn").onclick = () => {
    closeRoomDetailModal();
    startBookingRoom(room._id);
  };

  recalculateRoomDetailEstimate();
  document.getElementById("roomDetailModal").classList.remove("hidden");
}

function closeRoomDetailModal() {
  document.getElementById("roomDetailModal").classList.add("hidden");
}

function recalculateRoomDetailEstimate() {
  if (!detailRoomObj) return;
  const inVal = document.getElementById("calcCheckIn").value;
  const outVal = document.getElementById("calcCheckOut").value;
  if (!inVal || !outVal) return;

  const inDate = new Date(inVal);
  const outDate = new Date(outVal);
  const nights = Math.max(1, Math.ceil((outDate - inDate) / 86400000));
  const subtotal = nights * detailRoomObj.price;
  const totalWithTax = Math.round(subtotal * 1.12);

  document.getElementById("calcNightsLabel").innerText = nights;
  document.getElementById("calcTotalLabel").innerText = `₹${totalWithTax.toLocaleString("en-IN")}`;
}

// -------------------------------------------------------------
// BOOKING MODAL & MOCK PAYMENT
// -------------------------------------------------------------
function startBookingRoom(roomId) {
  const room = cachedRooms.find(r => r._id === roomId);
  if (!room) return;
  selectedRoomForBooking = room;

  document.getElementById("bookRoomId").value = room._id;
  document.getElementById("bookingModalRoomName").innerText = `${room.name} (₹${room.price.toLocaleString("en-IN")}/night)`;

  // Autofill if logged in
  if (currentUser) {
    document.getElementById("bookGuestName").value = currentUser.name || "";
    document.getElementById("bookGuestEmail").value = currentUser.email || "";
    document.getElementById("bookGuestPhone").value = currentUser.phone || "";
  }

  calculateBookingTotal();
  document.getElementById("bookingModal").classList.remove("hidden");
}

function closeBookingModal() {
  document.getElementById("bookingModal").classList.add("hidden");
  document.getElementById("bookingErrorAlert").classList.add("hidden");
}

function calculateBookingTotal() {
  if (!selectedRoomForBooking) return;
  const inVal = document.getElementById("bookCheckIn").value;
  const outVal = document.getElementById("bookCheckOut").value;
  if (!inVal || !outVal) return;

  const nights = Math.max(1, Math.ceil((new Date(outVal) - new Date(inVal)) / 86400000));
  const roomSubtotal = nights * selectedRoomForBooking.price;

  let addonSubtotal = 0;
  if (document.getElementById("addonSpa").checked) addonSubtotal += 2400;
  if (document.getElementById("addonTransfer").checked) addonSubtotal += 1800;
  if (document.getElementById("addonBreakfast").checked) addonSubtotal += 1200;

  const gst = Math.round((roomSubtotal + addonSubtotal) * 0.12);
  const grandTotal = roomSubtotal + addonSubtotal + gst;

  document.getElementById("pricingBreakdownRoomLabel").innerText = `Room Subtotal (${nights} night${nights > 1 ? "s" : ""}):`;
  document.getElementById("pricingBreakdownRoomVal").innerText = `₹${roomSubtotal.toLocaleString("en-IN")}`;
  document.getElementById("pricingBreakdownAddonVal").innerText = `₹${addonSubtotal.toLocaleString("en-IN")}`;
  document.getElementById("pricingBreakdownGstVal").innerText = `₹${gst.toLocaleString("en-IN")}`;
  document.getElementById("pricingBreakdownGrandTotal").innerText = `₹${grandTotal.toLocaleString("en-IN")}`;
}

async function handleBookingSubmit(e) {
  e.preventDefault();
  const alertEl = document.getElementById("bookingErrorAlert");
  alertEl.classList.add("hidden");

  const roomId = document.getElementById("bookRoomId").value;
  const guestName = document.getElementById("bookGuestName").value;
  const email = document.getElementById("bookGuestEmail").value;
  const phone = document.getElementById("bookGuestPhone").value;
  const checkIn = document.getElementById("bookCheckIn").value;
  const checkOut = document.getElementById("bookCheckOut").value;
  const guests = Number(document.getElementById("bookGuests").value);

  const addOns = [];
  if (document.getElementById("addonSpa").checked) addOns.push({ name: "Lotus Spa Pass", price: 2400 });
  if (document.getElementById("addonTransfer").checked) addOns.push({ name: "Airport Transfer", price: 1800 });
  if (document.getElementById("addonBreakfast").checked) addOns.push({ name: "Champagne Breakfast", price: 1200 });

  const selectedPayMethod = document.querySelector('input[name="payMethod"]:checked').value;

  try {
    // 1. Create real booking record in MongoDB
    const booking = await api("/bookings", {
      method: "POST",
      body: JSON.stringify({ roomId, guestName, email, phone, checkIn, checkOut, guests, addOns })
    });

    // 2. Generate Payment Intent
    await api("/payments/intent", {
      method: "POST",
      body: JSON.stringify({ bookingId: booking._id, paymentMethod: selectedPayMethod })
    });

    // 3. Process verified mock payment adapter
    await api("/payments/process", {
      method: "POST",
      body: JSON.stringify({
        bookingId: booking._id,
        paymentMethod: selectedPayMethod,
        cardLast4: "4242"
      })
    });

    closeBookingModal();
    alert(`🎉 Reservation Confirmed! Reference: ${booking.bookingReference}`);

    // Open Official Hospitality Receipt
    openInvoiceModal(booking._id);
  } catch (err) {
    alertEl.innerText = err.message;
    alertEl.classList.remove("hidden");
  }
}

// -------------------------------------------------------------
// INVOICE / RECEIPT MODAL
// -------------------------------------------------------------
async function openInvoiceModal(bookingId) {
  try {
    const inv = await api(`/bookings/${bookingId}/invoice`);
    document.getElementById("invoiceNumberText").innerText = inv.invoiceNumber;
    document.getElementById("invoiceDateText").innerText = `Date: ${new Date(inv.invoiceDate).toLocaleDateString()}`;
    document.getElementById("invoiceStatusBadge").innerText = `${inv.status.toUpperCase()} & ${inv.paymentStatus.toUpperCase()}`;

    document.getElementById("invGuestName").innerText = inv.guest.name;
    document.getElementById("invGuestEmail").innerText = inv.guest.email;
    document.getElementById("invGuestPhone").innerText = inv.guest.phone || "Not provided";

    document.getElementById("invRoomName").innerText = inv.stay.roomName;
    document.getElementById("invStayDates").innerText = `Check-In: ${new Date(inv.stay.checkIn).toLocaleDateString()} • Check-Out: ${new Date(inv.stay.checkOut).toLocaleDateString()}`;
    document.getElementById("invNightsGuests").innerText = `${inv.stay.nights} Nights • ${inv.stay.guests} Guests`;

    const tbody = document.getElementById("invoiceLineItemsBody");
    tbody.innerHTML = inv.lineItems.map(item => `
      <tr>
        <td class="p-3 text-brand-dark">${escapeHTML(item.description)}</td>
        <td class="p-3 text-right font-medium text-brand-dark">₹${item.amount.toLocaleString("en-IN")}</td>
      </tr>
    `).join("");

    document.getElementById("invoiceGrandTotalText").innerText = `₹${inv.totalAmount.toLocaleString("en-IN")}`;
    document.getElementById("invoiceModal").classList.remove("hidden");
  } catch (err) {
    alert("Could not load invoice: " + err.message);
  }
}

function closeInvoiceModal() {
  document.getElementById("invoiceModal").classList.add("hidden");
}

// -------------------------------------------------------------
// AUTONOMOUS AI CONCIERGE DRAWER (AGENTS 1 - 4)
// -------------------------------------------------------------
function openAIModal(initialMode = "concierge") {
  document.getElementById("aiModal").classList.remove("hidden");
  switchAIMode(initialMode);
}

function closeAIModal() {
  document.getElementById("aiModal").classList.add("hidden");
}

function switchAIMode(mode) {
  const tabs = ["concierge", "planner", "booking", "recommendations"];
  const tabIds = {
    concierge: "aiTabConcierge",
    planner: "aiTabPlanner",
    booking: "aiTabBooking",
    recommendations: "aiTabReco"
  };
  const panelIds = {
    concierge: "aiModeConcierge",
    planner: "aiModePlanner",
    booking: "aiModeBooking",
    recommendations: "aiModeReco"
  };
  const agentLabels = {
    concierge: "Agent 01: CustomerConciergeAgent (Natural Language & Real Inventory)",
    planner: "Agent 02: TravelPlannerAgent (Multi-Day Stay & Activity Planner)",
    booking: "Agent 03: BookingAssistantAgent (Conflict & Pricing Breakdown)",
    recommendations: "Agent 04: RecommendationAgent (Preference Scoring Engine)"
  };

  tabs.forEach(t => {
    const tabEl = document.getElementById(tabIds[t]);
    const panelEl = document.getElementById(panelIds[t]);
    if (t === mode) {
      if (tabEl) tabEl.className = "ai-mode-pill bg-brand-dark text-white px-3 py-1 rounded-full transition";
      if (panelEl) panelEl.classList.remove("hidden");
    } else {
      if (tabEl) tabEl.className = "ai-mode-pill text-brand-muted hover:text-brand-dark px-3 py-1 rounded-full transition";
      if (panelEl) panelEl.classList.add("hidden");
    }
  });

  document.getElementById("aiActiveAgentLabel").innerText = agentLabels[mode] || "Autonomous Agent Active";
}

// Concierge Chat Logic
async function handleConciergeSend() {
  const input = document.getElementById("conciergeInput");
  const text = input.value.trim();
  if (!text) return;

  appendConciergeChatMessage(text, "user");
  input.value = "";

  const typingId = "conciergeTypingIndicator";
  appendTypingIndicator(typingId);
  document.getElementById("aiStatusState").innerHTML = `<span class="text-amber-600 animate-pulse">● Processing query with backend tools...</span>`;

  try {
    const res = await api("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message: text })
    });
    removeTypingIndicator(typingId);
    document.getElementById("aiStatusState").innerHTML = `<span class="text-emerald-800">● Grounded response ready</span>`;
    appendConciergeChatMessage(res.reply, "bot");
  } catch (err) {
    removeTypingIndicator(typingId);
    document.getElementById("aiStatusState").innerHTML = `<span class="text-rose-700">● Fallback engaged</span>`;
    appendConciergeChatMessage("Our concierge is immediately available at the front desk: +91 (022) 8000-EASE.", "bot");
  }
}

function sendConciergeQuickQuery(text) {
  document.getElementById("conciergeInput").value = text;
  handleConciergeSend();
}

function appendConciergeChatMessage(msg, sender) {
  const container = document.getElementById("conciergeChatMessages");
  const div = document.createElement("div");
  if (sender === "user") {
    div.className = "bg-brand-accent/60 p-3 rounded-2xl rounded-tr-none text-brand-dark ml-auto max-w-[85%]";
  } else {
    div.className = "bg-brand-bg p-3.5 rounded-2xl rounded-tl-none border border-brand-border text-brand-dark max-w-[85%] leading-relaxed whitespace-pre-line";
  }
  div.innerText = msg;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function appendTypingIndicator(id) {
  const container = document.getElementById("conciergeChatMessages");
  const div = document.createElement("div");
  div.id = id;
  div.className = "bg-brand-bg p-3 rounded-2xl rounded-tl-none border border-brand-border text-brand-dark text-xs flex items-center gap-2.5 max-w-[240px] shadow-sm";
  div.innerHTML = `
    <div class="flex items-center gap-1">
      <span class="wave-bar"></span>
      <span class="wave-bar"></span>
      <span class="wave-bar"></span>
      <span class="wave-bar"></span>
      <span class="wave-bar"></span>
    </div>
    <span class="font-medium text-brand-muted">Consulting live records…</span>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// Mode 2: Travel Planner
async function generateAIItinerary() {
  const days = document.getElementById("planDays").value;
  const budget = document.getElementById("planBudget").value;
  const travelType = document.getElementById("planType").value;

  const outContainer = document.getElementById("aiPlanOutput");
  outContainer.classList.remove("hidden");
  outContainer.innerHTML = `<div class="p-4 text-center text-xs text-brand-muted"><i class="fa-solid fa-compass fa-spin text-lg mr-2"></i> Assembling customized itinerary...</div>`;

  try {
    const plan = await api("/ai/travel-plan", {
      method: "POST",
      body: JSON.stringify({ days, budget, travelType })
    });

    const actList = plan.proposedActivities.map(a => `
      <div class="p-3 bg-white border border-brand-border rounded-xl flex items-start justify-between gap-3 text-xs">
        <div>
          <span class="text-[10px] font-bold text-brand-tag uppercase">Day ${a.day} • ${escapeHTML(a.time)}</span>
          <div class="font-semibold text-brand-dark">${escapeHTML(a.title)}</div>
          <p class="text-brand-muted mt-0.5">${escapeHTML(a.description)}</p>
        </div>
        <span class="font-semibold text-brand-dark shrink-0">₹${a.estimatedCost.toLocaleString("en-IN")}</span>
      </div>
    `).join("");

    outContainer.innerHTML = `
      <div class="bg-brand-bg p-4 rounded-2xl border border-brand-border space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-brand-dark uppercase">Proposed Stay: ${escapeHTML(plan.stayPlan.roomType)}</span>
          <span class="font-bold text-brand-dark text-xs">Total Est: ₹${plan.estimatedBudget.grandTotal.toLocaleString("en-IN")}</span>
        </div>
        <p class="text-xs text-brand-muted">${escapeHTML(plan.stayPlan.overview)}</p>
        <div class="space-y-2 pt-1">
          ${actList}
        </div>
        <div class="pt-2 text-right">
          <button onclick="alert('Itinerary saved to your account!'); openCustomerPortal('itineraries');" class="bg-brand-btnPrimary hover:bg-brand-btnPrimaryHover text-brand-dark px-4 py-1.5 rounded-full text-xs font-semibold">
            View in My Portal
          </button>
        </div>
      </div>
    `;
  } catch (err) {
    outContainer.innerHTML = `<div class="p-3 text-xs text-rose-800 bg-rose-50 rounded-xl">Error: ${escapeHTML(err.message)}</div>`;
  }
}

// Mode 3: Booking Assistant
function populateAssistRoomDropdown(rooms) {
  const sel = document.getElementById("assistRoomSelect");
  if (!sel) return;
  sel.innerHTML = rooms.map(r => `
    <option value="${r._id}">${escapeHTML(r.name)} (₹${r.price.toLocaleString("en-IN")}/night)</option>
  `).join("");
}

async function runBookingAssistantCheck() {
  const roomId = document.getElementById("assistRoomSelect").value;
  const checkIn = document.getElementById("assistCheckIn").value;
  const checkOut = document.getElementById("assistCheckOut").value;
  const guests = document.getElementById("assistGuests").value;

  const out = document.getElementById("aiAssistOutput");
  out.classList.remove("hidden");
  out.innerHTML = `<div class="p-3 text-center text-xs text-brand-muted"><i class="fa-solid fa-circle-notch fa-spin"></i> Checking availability & pricing...</div>`;

  try {
    const res = await api("/ai/booking-assistant", {
      method: "POST",
      body: JSON.stringify({ roomId, checkIn, checkOut, guests })
    });

    if (!res.available) {
      out.innerHTML = `
        <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-2 text-amber-900">
          <div class="font-bold">${escapeHTML(res.message)}</div>
          <p>Alternative suggested rooms:</p>
          <div class="space-y-1">
            ${(res.suggestedAlternatives || []).map(alt => `
              <div class="p-2 bg-white rounded-lg flex justify-between">
                <span>${escapeHTML(alt.name)}</span>
                <span class="font-semibold">₹${alt.price.toLocaleString("en-IN")}/night</span>
              </div>
            `).join("")}
          </div>
        </div>
      `;
      return;
    }

    out.innerHTML = `
      <div class="p-4 bg-brand-bg border border-brand-border rounded-2xl text-xs space-y-3">
        <div class="flex justify-between items-center">
          <span class="font-semibold text-brand-dark">${escapeHTML(res.roomDetails.name)}</span>
          <span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold text-[10px]">VERIFIED AVAILABLE</span>
        </div>
        <div class="space-y-1 text-brand-muted">
          <div class="flex justify-between"><span>Stay:</span><span>${res.stayBreakdown.nights} Nights (${res.stayBreakdown.checkIn} to ${res.stayBreakdown.checkOut})</span></div>
          <div class="flex justify-between"><span>Subtotal:</span><span>₹${res.pricingBreakdown.roomSubtotal.toLocaleString("en-IN")}</span></div>
          <div class="flex justify-between"><span>Hospitality GST (12%):</span><span>₹${res.pricingBreakdown.gstTaxes.toLocaleString("en-IN")}</span></div>
          <div class="flex justify-between font-bold text-brand-dark text-sm pt-1 border-t border-brand-border">
            <span>Total Amount:</span><span>₹${res.pricingBreakdown.grandTotal.toLocaleString("en-IN")}</span>
          </div>
        </div>
        <button onclick="closeAIModal(); startBookingRoom('${res.roomDetails.id}')" class="w-full bg-brand-btnPrimary hover:bg-brand-btnPrimaryHover text-brand-dark py-2 rounded-xl font-semibold text-xs">
          Proceed to Confirm Reservation
        </button>
      </div>
    `;
  } catch (err) {
    out.innerHTML = `<div class="p-3 text-xs text-rose-800 bg-rose-50 rounded-xl">Error: ${escapeHTML(err.message)}</div>`;
  }
}

// Mode 4: Recommendation Engine
async function runAIRecommendations() {
  const budget = document.getElementById("recoBudget").value;
  const category = document.getElementById("recoCategory").value;

  const out = document.getElementById("aiRecoOutput");
  out.innerHTML = `<div class="p-4 text-center text-xs text-brand-muted"><i class="fa-solid fa-sliders fa-spin"></i> Scoring rooms against preferences...</div>`;

  try {
    const res = await api("/ai/recommendations", {
      method: "POST",
      body: JSON.stringify({ budget, category, guests: 2 })
    });

    out.innerHTML = res.recommendations.map(r => `
      <div class="p-3.5 bg-white border border-brand-border rounded-2xl shadow-sm flex items-center justify-between gap-3 text-xs">
        <div>
          <div class="flex items-center gap-2">
            <span class="font-serif font-semibold text-brand-dark text-sm">${escapeHTML(r.name)}</span>
            <span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Match ${r.recommendationScore}%
            </span>
          </div>
          <p class="text-brand-muted text-[11px] mt-0.5">${escapeHTML((r.recommendationReasons || []).join(" • "))}</p>
        </div>
        <div class="text-right shrink-0">
          <span class="font-bold text-brand-dark block">₹${r.price.toLocaleString("en-IN")}</span>
          <button onclick="closeAIModal(); startBookingRoom('${r._id}')" class="mt-1 bg-brand-bg hover:bg-brand-accent/50 text-brand-dark px-3 py-1 rounded-full text-[10px] font-semibold border border-brand-border">
            Book
          </button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    out.innerHTML = `<div class="p-3 text-xs text-rose-800 bg-rose-50 rounded-xl">Error: ${escapeHTML(err.message)}</div>`;
  }
}

// -------------------------------------------------------------
// CUSTOMER PORTAL (BOOKINGS, SERVICES, ITINERARIES, REVIEWS)
// -------------------------------------------------------------
function openCustomerPortal(initialTab = "bookings") {
  if (!currentUser) {
    openAuthModal("login");
    return;
  }

  document.getElementById("portalUserNameTitle").innerText = `${currentUser.name}'s Portal`;
  document.getElementById("portalUserEmailSubtitle").innerText = currentUser.email;
  document.getElementById("portalUserAvatar").innerText = currentUser.name.charAt(0).toUpperCase();

  document.getElementById("customerPortalModal").classList.remove("hidden");
  switchPortalTab(initialTab);
}

function closeCustomerPortal() {
  document.getElementById("customerPortalModal").classList.add("hidden");
}

function switchPortalTab(tab) {
  const tabs = ["bookings", "services", "itineraries", "review"];
  const tabIds = {
    bookings: "pTabBookings",
    services: "pTabServices",
    itineraries: "pTabItineraries",
    review: "pTabReview"
  };
  const panelIds = {
    bookings: "portalBookingsPanel",
    services: "portalServicesPanel",
    itineraries: "portalItinerariesPanel",
    review: "portalReviewPanel"
  };

  tabs.forEach(t => {
    const tabEl = document.getElementById(tabIds[t]);
    const panelEl = document.getElementById(panelIds[t]);
    if (t === tab) {
      if (tabEl) tabEl.className = "portal-tab bg-brand-dark text-white px-3 py-1 rounded-full transition";
      if (panelEl) panelEl.classList.remove("hidden");
    } else {
      if (tabEl) tabEl.className = "portal-tab text-brand-muted hover:text-brand-dark px-3 py-1 rounded-full transition";
      if (panelEl) panelEl.classList.add("hidden");
    }
  });

  if (tab === "bookings") loadPortalBookings();
  else if (tab === "services") loadPortalServices();
  else if (tab === "itineraries") loadPortalItineraries();
}

async function loadPortalBookings() {
  const list = document.getElementById("portalBookingsList");
  list.innerHTML = `<div class="p-4 text-center text-xs text-brand-muted"><i class="fa-solid fa-circle-notch fa-spin"></i> Fetching your stays...</div>`;

  try {
    const bookings = await api("/bookings");
    document.getElementById("portalBookingCount").innerText = `${bookings.length} reservations found`;

    if (!bookings.length) {
      list.innerHTML = `
        <div class="p-8 text-center bg-brand-bg rounded-2xl border border-brand-border text-xs text-brand-muted">
          No bookings found yet. Explore our rooms to create your first reservation!
        </div>`;
      return;
    }

    list.innerHTML = bookings.map(b => {
      const isCancelled = b.status === "cancelled";
      return `
        <div class="bg-brand-bg p-4 rounded-2xl border border-brand-border text-xs space-y-2">
          <div class="flex items-center justify-between">
            <div>
              <span class="font-serif font-semibold text-brand-dark text-sm">${escapeHTML(b.roomName)}</span>
              <span class="text-[11px] text-brand-lightMuted ml-2">Ref: <strong>${escapeHTML(b.bookingReference || b._id.slice(-6).toUpperCase())}</strong></span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${isCancelled ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}">
                ${escapeHTML(b.status)}
              </span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-stone-200 text-stone-700">
                ${escapeHTML(b.paymentStatus)}
              </span>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-between text-brand-muted gap-2">
            <div>
              <i class="fa-regular fa-calendar mr-1"></i> ${new Date(b.checkIn).toLocaleDateString()} to ${new Date(b.checkOut).toLocaleDateString()}
              (${b.nights || 1} nights • ${b.guests || 2} guests)
            </div>
            <div class="font-bold text-brand-dark">
              ₹${Number(b.totalAmount).toLocaleString("en-IN")}
            </div>
          </div>

          <div class="pt-2 flex items-center justify-end gap-2 border-t border-brand-border/60">
            <button onclick="openInvoiceModal('${b._id}')" class="bg-white border border-brand-border hover:bg-brand-border/40 text-brand-dark px-3 py-1 rounded-full text-[11px] font-semibold transition">
              <i class="fa-solid fa-receipt mr-1"></i> View Receipt
            </button>
            ${!isCancelled ? `
              <button onclick="handleCancelBooking('${b._id}')" class="bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-800 px-3 py-1 rounded-full text-[11px] font-semibold transition">
                Cancel Reservation
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    list.innerHTML = `<div class="p-3 text-xs text-rose-800 bg-rose-50 rounded-xl">Error: ${escapeHTML(err.message)}</div>`;
  }
}

async function handleCancelBooking(bookingId) {
  if (!confirm("Are you sure you want to cancel this reservation according to our 48-hour cancellation policy?")) {
    return;
  }
  try {
    const res = await api(`/bookings/${bookingId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Guest portal requested cancellation" })
    });
    alert(res.message);
    loadPortalBookings();
  } catch (err) {
    alert("Cancellation error: " + err.message);
  }
}

async function loadPortalServices() {
  const list = document.getElementById("portalServicesList");
  list.innerHTML = `<div class="p-3 text-center text-xs text-brand-muted"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading service tickets...</div>`;

  try {
    const requests = await api("/services");
    if (!requests.length) {
      list.innerHTML = `<div class="p-4 text-center bg-brand-bg rounded-xl border border-brand-border text-xs text-brand-muted">No active service tickets.</div>`;
      return;
    }

    list.innerHTML = requests.map(r => `
      <div class="p-3 bg-brand-bg border border-brand-border rounded-xl text-xs flex items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <span class="font-semibold text-brand-dark">Room ${escapeHTML(r.roomNumber)}: ${escapeHTML(r.type.replace(/_/g, " "))}</span>
            <span class="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${r.priority === 'high' ? 'bg-rose-100 text-rose-800' : 'bg-stone-200 text-stone-700'}">
              ${escapeHTML(r.priority)}
            </span>
          </div>
          <p class="text-brand-muted text-[11px] mt-0.5">${escapeHTML(r.description || "Standard room amenity delivery")}</p>
          <span class="text-[10px] text-brand-lightMuted">Assigned: ${escapeHTML(r.assignedStaff || "Unassigned")}</span>
        </div>
        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${r.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
          ${escapeHTML(r.status.replace(/_/g, " "))}
        </span>
      </div>
    `).join("");
  } catch (err) {
    list.innerHTML = `<div class="p-3 text-xs text-rose-800 bg-rose-50 rounded-xl">Error: ${escapeHTML(err.message)}</div>`;
  }
}

async function handlePortalServiceSubmit(e) {
  e.preventDefault();
  const roomNumber = document.getElementById("svcRoomNumber").value;
  const type = document.getElementById("svcType").value;
  const description = document.getElementById("svcNotes").value;

  try {
    await api("/services", {
      method: "POST",
      body: JSON.stringify({
        guestName: currentUser ? currentUser.name : "Valued Guest",
        roomNumber,
        type,
        description
      })
    });
    alert("Service ticket dispatched to front desk & housekeeping team!");
    document.getElementById("svcNotes").value = "";
    loadPortalServices();
  } catch (err) {
    alert("Service request error: " + err.message);
  }
}

async function loadPortalItineraries() {
  const list = document.getElementById("portalItinerariesList");
  list.innerHTML = `<div class="p-3 text-center text-xs text-brand-muted"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading saved travel itineraries...</div>`;

  try {
    const itineraries = await api("/itineraries");
    if (!itineraries.length) {
      list.innerHTML = `<div class="p-4 text-center bg-brand-bg rounded-xl border border-brand-border text-xs text-brand-muted">No saved itineraries. Generate one from the AI Concierge!</div>`;
      return;
    }

    list.innerHTML = itineraries.map(it => `
      <div class="bg-brand-bg p-4 rounded-2xl border border-brand-border text-xs space-y-2">
        <div class="flex justify-between items-center">
          <span class="font-serif font-semibold text-brand-dark text-sm">${escapeHTML(it.travelType)} (${it.days} Days)</span>
          <span class="font-bold text-brand-dark">Est: ₹${it.estimatedBudget.grandTotal.toLocaleString("en-IN")}</span>
        </div>
        <p class="text-brand-muted">${escapeHTML(it.stayPlan.overview)}</p>
        <div class="space-y-1">
          ${(it.proposedActivities || []).slice(0, 3).map(a => `
            <div class="p-2 bg-white rounded-lg flex justify-between">
              <span>Day ${a.day}: ${escapeHTML(a.title)}</span>
              <span class="font-medium text-brand-muted">₹${a.estimatedCost.toLocaleString("en-IN")}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `).join("");
  } catch (err) {
    list.innerHTML = `<div class="p-3 text-xs text-rose-800 bg-rose-50 rounded-xl">Error: ${escapeHTML(err.message)}</div>`;
  }
}

async function handlePortalReviewSubmit(e) {
  e.preventDefault();
  const alertEl = document.getElementById("portalReviewAlert");
  alertEl.classList.add("hidden");

  const rating = document.getElementById("reviewRatingSelect").value;
  const title = document.getElementById("reviewTitleInput").value;
  const text = document.getElementById("reviewTextInput").value;

  try {
    const res = await api("/reviews", {
      method: "POST",
      body: JSON.stringify({
        guestName: currentUser ? currentUser.name : "Valued Guest",
        rating,
        title,
        text
      })
    });
    alertEl.innerText = `🎉 Thank you! Your review has been tagged '${res.sentiment}' and published to our community.`;
    alertEl.classList.remove("hidden");
    document.getElementById("portalReviewForm").reset();
    loadReviews();
  } catch (err) {
    alert("Review submission error: " + err.message);
  }
}

// -------------------------------------------------------------
// VERIFIED GUEST REVIEWS
// -------------------------------------------------------------
async function loadReviews() {
  try {
    const reviews = await api("/reviews");
    const container = document.getElementById("reviewsGrid");
    if (!container) return;

    container.innerHTML = reviews.slice(0, 6).map(r => `
      <div class="bg-white border border-brand-border p-6 rounded-3xl shadow-sm hover:border-brand-borderDark transition flex flex-col justify-between">
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="text-amber-500 text-xs flex gap-1">
              ${"★".repeat(r.rating || 5)}${"☆".repeat(5 - (r.rating || 5))}
            </div>
            <span class="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold uppercase">
              ${escapeHTML(r.sentiment || 'positive')}
            </span>
          </div>
          <h3 class="font-serif text-base font-semibold text-brand-heading">${escapeHTML(r.title || 'Exceptional Stay')}</h3>
          <p class="text-xs text-brand-muted leading-relaxed">${escapeHTML(r.text)}</p>
        </div>
        <div class="mt-5 pt-3 border-t border-brand-border/60 flex items-center justify-between text-xs">
          <span class="font-semibold text-brand-dark">${escapeHTML(r.guestName)}</span>
          <span class="text-[10px] font-bold text-brand-lightMuted uppercase">${escapeHTML(r.source || 'StayEase Verified')}</span>
        </div>
      </div>
    `).join("");
  } catch (err) {
    console.error("Reviews load error:", err);
  }
}

async function loadReviewInsights() {
  try {
    const insights = await api("/reviews/insights");
    const summaryEl = document.getElementById("reviewThemesSummary");
    if (summaryEl && insights.positiveThemes) {
      summaryEl.innerText = `Top guest themes: ${insights.positiveThemes.join(", ")}`;
    }
  } catch (err) {
    console.warn("Review insights load:", err);
  }
}

// Contact Inquiry Handler
function handleInquirySubmit(e) {
  e.preventDefault();
  const alertEl = document.getElementById("inquiryAlert");
  alertEl.classList.remove("hidden");
  setTimeout(() => {
    alertEl.classList.add("hidden");
    document.getElementById("contactInquiryForm").reset();
  }, 4000);
}

// -------------------------------------------------------------
// ADMIN OPERATIONS CENTER (AGENTS 6 - 10)
// -------------------------------------------------------------
function openAdminConsole() {
  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "staff")) {
    alert("Please sign in with an Administrator or Staff account to open the AI Operations Center.");
    openAuthModal("login");
    quickFillAuth("admin@stayease.com", "admin123");
    return;
  }
  document.getElementById("adminModal").classList.remove("hidden");
  switchAdminTab("overview");
}

function closeAdminConsole() {
  document.getElementById("adminModal").classList.add("hidden");
}

function switchAdminTab(tab) {
  const tabs = ["overview", "copilot", "serviceDesk", "pricing", "revenue", "planner", "approvals", "audit", "rooms"];
  const tabIds = {
    overview: "admTabOverview",
    copilot: "admTabCopilot",
    serviceDesk: "admTabServiceDesk",
    pricing: "admTabPricing",
    revenue: "admTabRevenue",
    planner: "admTabPlanner",
    approvals: "admTabApprovals",
    audit: "admTabAudit",
    rooms: "admTabRooms"
  };
  const panelIds = {
    overview: "admPanelOverview",
    copilot: "admPanelCopilot",
    serviceDesk: "admPanelServiceDesk",
    pricing: "admPanelPricing",
    revenue: "admPanelRevenue",
    planner: "admPanelPlanner",
    approvals: "admPanelApprovals",
    audit: "admPanelAudit",
    rooms: "admPanelRooms"
  };

  tabs.forEach(t => {
    const tabEl = document.getElementById(tabIds[t]);
    const panelEl = document.getElementById(panelIds[t]);
    if (t === tab) {
      if (tabEl) tabEl.className = "admin-tab bg-brand-btnPrimary text-brand-dark px-2.5 py-1 rounded-full transition font-semibold";
      if (panelEl) panelEl.classList.remove("hidden");
    } else {
      if (tabEl) tabEl.className = "admin-tab text-stone-300 hover:text-white px-2.5 py-1 rounded-full transition font-normal";
      if (panelEl) panelEl.classList.add("hidden");
    }
  });

  if (tab === "overview") loadAdminOverview();
  else if (tab === "serviceDesk") loadAdminServiceDesk();
  else if (tab === "pricing") loadAdminPricingReport();
  else if (tab === "revenue") loadAdminRevenueReport();
  else if (tab === "approvals") loadAdminApprovals();
  else if (tab === "audit") loadAdminAuditLogs();
  else if (tab === "rooms") loadAdminRoomsManagement();
}

// Admin Tab 1: Overview
async function loadAdminOverview() {
  try {
    const data = await api("/admin/dashboard");
    const m = data.metrics;
    document.getElementById("kpiOccupancy").innerText = `${m.occupancyRate}%`;
    document.getElementById("kpiRevenue").innerText = `₹${m.verifiedRevenue.toLocaleString("en-IN")}`;
    document.getElementById("kpiArrivals").innerText = m.todayArrivals;
    document.getElementById("kpiOpenRequests").innerText = m.openRequests;

    document.getElementById("kpiGrossValue").innerText = `₹${m.grossBookingValue.toLocaleString("en-IN")}`;
    document.getElementById("kpiPendingBalance").innerText = `₹${m.pendingBalance.toLocaleString("en-IN")}`;
    document.getElementById("kpiADR").innerText = `₹${m.liveADR.toLocaleString("en-IN")}`;
  } catch (err) {
    console.error("Admin dashboard error:", err);
  }
}

async function triggerManualWorkerPass() {
  try {
    const res = await api("/admin/worker/trigger", { method: "POST" });
    alert(`⚡ Background Worker Pass Executed: ${res.result ? res.result.triagedCount : 0} tickets triaged.`);
    loadAdminOverview();
    loadAdminServiceDesk();
  } catch (err) {
    alert("Worker trigger failed: " + err.message);
  }
}

// Admin Tab 2: Operations Copilot (Agent 6)
async function handleCopilotSend() {
  const input = document.getElementById("copilotInput");
  const query = input.value.trim();
  if (!query) return;

  appendCopilotMessage(query, "user");
  input.value = "";

  try {
    const res = await api("/admin/ai/copilot", {
      method: "POST",
      body: JSON.stringify({ query })
    });
    appendCopilotMessage(res.answer, "bot");
  } catch (err) {
    appendCopilotMessage("Error querying operational database: " + err.message, "bot");
  }
}

function sendCopilotQuery(text) {
  document.getElementById("copilotInput").value = text;
  handleCopilotSend();
}

function appendCopilotMessage(msg, sender) {
  const container = document.getElementById("copilotChatMessages");
  const div = document.createElement("div");
  if (sender === "user") {
    div.className = "bg-stone-800 text-white p-3 rounded-2xl rounded-tr-none ml-auto max-w-[85%] text-xs";
  } else {
    div.className = "bg-brand-bg p-3.5 rounded-2xl rounded-tl-none border border-brand-border text-brand-dark max-w-[85%] text-xs leading-relaxed whitespace-pre-line";
  }
  div.innerText = msg;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// Admin Tab 3: Autonomous Service Desk (Agent 7)
async function loadAdminServiceDesk() {
  const container = document.getElementById("adminServiceTicketsList");
  container.innerHTML = `<div class="p-4 text-center text-xs text-brand-muted"><i class="fa-solid fa-circle-notch fa-spin"></i> Fetching active tickets...</div>`;

  try {
    const data = await api("/admin/ai/service-desk");
    container.innerHTML = data.requests.map(r => `
      <div class="bg-brand-bg p-3.5 rounded-2xl border border-brand-border flex items-center justify-between gap-3 text-xs">
        <div>
          <div class="flex items-center gap-2">
            <span class="font-bold text-brand-dark">Room ${escapeHTML(r.roomNumber)}: ${escapeHTML(r.type.replace(/_/g, " "))}</span>
            <span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${r.priority === 'high' ? 'bg-rose-100 text-rose-800' : 'bg-stone-200 text-stone-700'}">
              ${escapeHTML(r.priority)}
            </span>
          </div>
          <p class="text-brand-muted text-[11px] mt-0.5">Guest: ${escapeHTML(r.guestName)} • ${escapeHTML(r.description || 'Standard request')}</p>
          <span class="text-[10px] text-brand-lightMuted">Assigned Staff: <strong>${escapeHTML(r.assignedStaff || 'Unassigned')}</strong></span>
        </div>
        <div class="flex items-center gap-2">
          ${r.status !== 'resolved' ? `
            <button onclick="markServiceResolved('${r._id}')" class="bg-white border border-brand-border hover:bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full text-[10px] font-semibold transition">
              Mark Resolved
            </button>
          ` : `
            <span class="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">Resolved</span>
          `}
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<div class="p-3 text-xs text-rose-800 bg-rose-50 rounded-xl">Error: ${escapeHTML(err.message)}</div>`;
  }
}

async function markServiceResolved(id) {
  try {
    await api(`/services/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "resolved" })
    });
    loadAdminServiceDesk();
    loadAdminOverview();
  } catch (err) {
    alert("Update error: " + err.message);
  }
}

// Admin Tab 4: Smart Pricing Analyst (Agent 8)
async function loadAdminPricingReport() {
  const container = document.getElementById("adminPricingProposalsList");
  container.innerHTML = `<div class="p-4 text-center text-xs text-brand-muted"><i class="fa-solid fa-chart-line fa-spin"></i> Analyzing live occupancy and demand...</div>`;

  try {
    const data = await api("/admin/ai/pricing");
    container.innerHTML = `
      <div class="p-3 bg-brand-bg rounded-xl border border-brand-border text-xs mb-3 flex items-center justify-between">
        <span>Current Property Occupancy: <strong>${data.occupancyRate}%</strong></span>
        <span>Weekend Surcharge Active: <strong>${data.isWeekend ? "Yes" : "No"}</strong></span>
      </div>
      <div class="space-y-3">
        ${data.proposals.map(p => `
          <div class="p-3.5 bg-white border border-brand-border rounded-2xl flex items-center justify-between gap-4 text-xs shadow-sm">
            <div>
              <div class="font-serif font-semibold text-brand-dark text-sm">${escapeHTML(p.roomName)} (${escapeHTML(p.category)})</div>
              <p class="text-[11px] text-brand-muted mt-0.5">${escapeHTML(p.reasons.join(" • "))}</p>
              <div class="mt-1 flex items-center gap-2">
                <span class="text-brand-muted">Current: ₹${p.currentPrice.toLocaleString("en-IN")}</span>
                <i class="fa-solid fa-arrow-right text-[10px] text-brand-lightMuted"></i>
                <span class="font-bold text-emerald-800">Proposed: ₹${p.proposedPrice.toLocaleString("en-IN")} (${p.percentageChange >= 0 ? '+' : ''}${p.percentageChange}%)</span>
              </div>
            </div>
            <button onclick="applyAdminPricing('${p.roomId}', ${p.proposedPrice})" class="bg-brand-btnPrimary hover:bg-brand-btnPrimaryHover text-brand-dark px-4 py-1.5 rounded-full text-xs font-semibold transition shrink-0">
              Apply Rate
            </button>
          </div>
        `).join("")}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="p-3 text-xs text-rose-800 bg-rose-50 rounded-xl">Error: ${escapeHTML(err.message)}</div>`;
  }
}

async function applyAdminPricing(roomId, proposedPrice) {
  try {
    const res = await api("/admin/ai/pricing/apply", {
      method: "POST",
      body: JSON.stringify({ roomId, proposedPrice })
    });
    alert(res.message);
    loadRooms();
    loadAdminPricingReport();
  } catch (err) {
    alert("Pricing update failed: " + err.message);
  }
}

// Admin Tab 5: Revenue Insights Agent (Agent 9)
async function loadAdminRevenueReport() {
  const container = document.getElementById("adminRevenueReportContainer");
  container.innerHTML = `<div class="p-4 text-center text-xs text-brand-muted"><i class="fa-solid fa-calculator fa-spin"></i> Generating verified audit...</div>`;

  try {
    const data = await api("/admin/ai/revenue");
    const s = data.summary;
    container.innerHTML = `
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div class="bg-brand-bg p-3.5 rounded-2xl border border-brand-border text-center">
          <span class="text-[10px] font-bold text-brand-lightMuted uppercase">GROSS BOOKING VALUE</span>
          <div class="font-bold text-brand-dark text-base mt-1">₹${s.grossBookingValue.toLocaleString("en-IN")}</div>
        </div>
        <div class="bg-brand-bg p-3.5 rounded-2xl border border-brand-border text-center">
          <span class="text-[10px] font-bold text-brand-lightMuted uppercase">VERIFIED COLLECTED</span>
          <div class="font-bold text-emerald-800 text-base mt-1">₹${s.verifiedCollectedRevenue.toLocaleString("en-IN")}</div>
        </div>
        <div class="bg-brand-bg p-3.5 rounded-2xl border border-brand-border text-center">
          <span class="text-[10px] font-bold text-brand-lightMuted uppercase">UNCOLLECTED BALANCE</span>
          <div class="font-bold text-amber-700 text-base mt-1">₹${s.pendingCollection.toLocaleString("en-IN")}</div>
        </div>
        <div class="bg-brand-bg p-3.5 rounded-2xl border border-brand-border text-center">
          <span class="text-[10px] font-bold text-brand-lightMuted uppercase">CANCELLATION RATE</span>
          <div class="font-bold text-brand-dark text-base mt-1">${s.cancellationRate}</div>
        </div>
      </div>

      <div class="bg-white border border-brand-border p-4 rounded-2xl shadow-sm text-xs space-y-2">
        <span class="font-bold text-brand-dark uppercase tracking-wider block">Room Category Performance Breakdown</span>
        <div class="space-y-1.5">
          ${Object.entries(data.categoryBreakdown || {}).map(([cat, amount]) => `
            <div class="flex items-center justify-between p-2 rounded-lg bg-brand-bg">
              <span class="font-semibold text-brand-dark">${escapeHTML(cat)}</span>
              <span class="font-bold text-brand-dark">₹${amount.toLocaleString("en-IN")}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="p-3 text-xs text-rose-800 bg-rose-50 rounded-xl">Error: ${escapeHTML(err.message)}</div>`;
  }
}

// Admin Tab 6: Admin Action Planner (Agent 10)
async function generateAdminActionPlan() {
  const instruction = document.getElementById("adminPlanInstructionInput").value;
  const container = document.getElementById("adminPlanResultContainer");
  container.classList.remove("hidden");
  container.innerHTML = `<div class="p-4 text-center text-xs text-brand-muted"><i class="fa-solid fa-gears fa-spin"></i> Assembling operational workflow and risk matrix...</div>`;

  try {
    const plan = await api("/admin/ai/action-plan", {
      method: "POST",
      body: JSON.stringify({ instruction })
    });

    container.innerHTML = `
      <div class="bg-brand-bg p-4 rounded-2xl border border-brand-border text-xs space-y-3">
        <div class="flex items-center justify-between">
          <span class="font-bold text-brand-dark uppercase">Structured Action Plan</span>
          <span class="bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full font-bold text-[10px]">AWAITING APPROVAL</span>
        </div>
        <div class="space-y-2">
          ${plan.structuredPlan.map(s => `
            <div class="p-2.5 bg-white rounded-xl border border-brand-border flex items-start gap-2.5">
              <span class="w-5 h-5 rounded-full bg-brand-dark text-white flex items-center justify-center font-bold text-[10px] shrink-0">${s.stepNumber}</span>
              <div>
                <span class="font-semibold text-brand-dark">${escapeHTML(s.title)} (${escapeHTML(s.assignedDepartment)})</span>
                <p class="text-brand-muted text-[11px] mt-0.5">${escapeHTML(s.action)}</p>
              </div>
            </div>
          `).join("")}
        </div>
        <div class="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px]">
          <strong>Identified Operational Risks:</strong> ${escapeHTML((plan.identifiedRisks || []).join(" • "))}
        </div>
        <button onclick="alert('Plan queued in Approvals Queue!'); switchAdminTab('approvals');" class="w-full bg-brand-btnPrimary hover:bg-brand-btnPrimaryHover text-brand-dark py-2 rounded-xl font-semibold text-xs transition">
          View in Approvals Queue
        </button>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="p-3 text-xs text-rose-800 bg-rose-50 rounded-xl">Error: ${escapeHTML(err.message)}</div>`;
  }
}

// Admin Tab 7: Approval Queue
async function loadAdminApprovals() {
  const container = document.getElementById("adminApprovalsList");
  container.innerHTML = `<div class="p-4 text-center text-xs text-brand-muted"><i class="fa-solid fa-circle-notch fa-spin"></i> Fetching approvals queue...</div>`;

  try {
    const list = await api("/admin/approvals");
    if (!list.length) {
      container.innerHTML = `<div class="p-6 text-center bg-brand-bg rounded-2xl border border-brand-border text-xs text-brand-muted">No pending approvals currently in queue.</div>`;
      return;
    }

    container.innerHTML = list.map(item => `
      <div class="p-4 bg-brand-bg border border-brand-border rounded-2xl text-xs space-y-2">
        <div class="flex items-center justify-between">
          <div>
            <span class="font-semibold text-brand-dark text-sm">${escapeHTML(item.title)}</span>
            <span class="text-[10px] text-brand-lightMuted ml-2">Proposed by: ${escapeHTML(item.proposedByAgent)}</span>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${item.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : item.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}">
            ${escapeHTML(item.status)}
          </span>
        </div>
        <p class="text-brand-muted text-xs">${escapeHTML(item.description)}</p>
        ${item.status === 'pending' ? `
          <div class="pt-2 flex items-center justify-end gap-2 border-t border-brand-border/60">
            <button onclick="decideApproval('${item._id}', 'reject')" class="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 px-3 py-1 rounded-full text-xs font-semibold transition">
              Reject
            </button>
            <button onclick="decideApproval('${item._id}', 'approve')" class="bg-brand-btnPrimary hover:bg-brand-btnPrimaryHover text-brand-dark px-4 py-1 rounded-full text-xs font-semibold transition">
              Approve &amp; Execute
            </button>
          </div>
        ` : ''}
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<div class="p-3 text-xs text-rose-800 bg-rose-50 rounded-xl">Error: ${escapeHTML(err.message)}</div>`;
  }
}

async function decideApproval(id, action) {
  try {
    await api(`/admin/approvals/${id}/decide`, {
      method: "POST",
      body: JSON.stringify({ action })
    });
    alert(`Action ${action}d successfully.`);
    loadAdminApprovals();
  } catch (err) {
    alert("Approval decision failed: " + err.message);
  }
}

// Admin Tab 8: Audit Logs
async function loadAdminAuditLogs() {
  const tbody = document.getElementById("adminAuditLogsTableBody");
  tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-brand-muted">Loading audit log entries...</td></tr>`;

  try {
    const logs = await api("/admin/audit-logs");
    tbody.innerHTML = logs.map(l => `
      <tr class="hover:bg-brand-bg/50">
        <td class="p-2.5 font-semibold text-brand-dark">${escapeHTML(l.agentName)}</td>
        <td class="p-2.5">${escapeHTML(l.actionType)}</td>
        <td class="p-2.5">${escapeHTML(l.triggeredBy)}</td>
        <td class="p-2.5">
          <span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${l.status === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
            ${escapeHTML(l.status)}
          </span>
        </td>
        <td class="p-2.5 text-brand-lightMuted">${new Date(l.createdAt).toLocaleTimeString()}</td>
      </tr>
    `).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-rose-800">Error loading audit logs: ${escapeHTML(err.message)}</td></tr>`;
  }
}

// Admin Tab 9: Room Management
async function loadAdminRoomsManagement() {
  const container = document.getElementById("adminRoomsTableContainer");
  container.innerHTML = `<div class="p-4 text-center text-xs text-brand-muted"><i class="fa-solid fa-circle-notch fa-spin"></i> Fetching rooms...</div>`;

  try {
    const rooms = await api("/rooms");
    container.innerHTML = `
      <div class="border border-brand-border rounded-2xl overflow-hidden text-xs">
        <table class="w-full text-left">
          <thead class="bg-brand-bg border-b border-brand-border text-[10px] font-bold text-brand-tag uppercase">
            <tr>
              <th class="p-3">Room</th>
              <th class="p-3">Category</th>
              <th class="p-3">Rate</th>
              <th class="p-3">Status</th>
              <th class="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-brand-border/60">
            ${rooms.map(r => `
              <tr class="hover:bg-brand-bg/40">
                <td class="p-3 font-semibold text-brand-dark">${escapeHTML(r.name)} (${escapeHTML(r.roomNumber || '101')})</td>
                <td class="p-3">${escapeHTML(r.category)}</td>
                <td class="p-3 font-bold text-brand-dark">₹${r.price.toLocaleString("en-IN")}</td>
                <td class="p-3">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${r.active ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'}">
                    ${r.active ? 'Active' : 'Archived'}
                  </span>
                </td>
                <td class="p-3 text-right">
                  <button onclick="toggleRoomActive('${r._id}')" class="bg-brand-bg hover:bg-brand-accent/50 text-brand-dark px-3 py-1 rounded-full text-[10px] font-semibold border border-brand-border">
                    ${r.active ? 'Archive' : 'Activate'}
                  </button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="p-3 text-xs text-rose-800 bg-rose-50 rounded-xl">Error: ${escapeHTML(err.message)}</div>`;
  }
}

async function toggleRoomActive(id) {
  try {
    await api(`/rooms/${id}`, { method: "DELETE" });
    loadAdminRoomsManagement();
    loadRooms();
  } catch (err) {
    alert("Status update failed: " + err.message);
  }
}

// -------------------------------------------------------------
// AUTH MODAL & LOGIC
// -------------------------------------------------------------
let authMode = "login";

function openAuthModal(mode = "login") {
  authMode = mode;
  updateAuthModalUI();
  document.getElementById("authModal").classList.remove("hidden");
}

function closeAuthModal() {
  document.getElementById("authModal").classList.add("hidden");
  document.getElementById("authErrorMsg").classList.add("hidden");
}

function toggleAuthMode() {
  authMode = authMode === "login" ? "register" : "login";
  updateAuthModalUI();
}

function updateAuthModalUI() {
  const isReg = authMode === "register";
  document.getElementById("authModalTitle").innerText = isReg ? "Create a Guest Account" : "Welcome Back to StayEase";
  document.getElementById("authModalSubtitle").innerText = isReg ? "Sign up to track bookings, request hotel services, and save travel plans" : "Sign in to manage your stays and service requests";
  document.getElementById("authNameField").classList.toggle("hidden", !isReg);
  document.getElementById("authSubmitBtn").innerText = isReg ? "Create Account" : "Sign In";
  document.getElementById("authToggleModeBtn").innerText = isReg ? "Already have an account? Sign in" : "Don't have an account? Register here";
}

function quickFillAuth(email, pass) {
  document.getElementById("authEmailInput").value = email;
  document.getElementById("authPasswordInput").value = pass;
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const errorEl = document.getElementById("authErrorMsg");
  errorEl.classList.add("hidden");

  const email = document.getElementById("authEmailInput").value.trim();
  const password = document.getElementById("authPasswordInput").value;
  const name = document.getElementById("authNameInput").value.trim();

  try {
    let res;
    if (authMode === "register") {
      res = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password })
      });
    } else {
      res = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
    }

    currentToken = res.token;
    localStorage.setItem("stayease_token", currentToken);
    currentUser = res.user;
    updateNavAuthUI(currentUser);
    closeAuthModal();

    alert(`Welcome, ${currentUser.name}! You are signed in.`);
  } catch (err) {
    errorEl.innerText = err.message;
    errorEl.classList.remove("hidden");
  }
}

function toggleMobileMenu() {
  document.getElementById("mobileMenu").classList.toggle("hidden");
}

// ==============================================================
// DYNAMIC ANIMATIONS & INTERACTIVE MOTION ENGINE
// ==============================================================

// 1. Scroll-Triggered Reveal with Staggered Delays
let scrollObserver = null;
function initScrollObserver() {
  if ("IntersectionObserver" in window) {
    if (!scrollObserver) {
      scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    }

    document.querySelectorAll(".reveal-on-scroll:not(.is-observed)").forEach((el, index) => {
      el.classList.add("is-observed");
      el.style.transitionDelay = `${(index % 4) * 0.09}s`;
      scrollObserver.observe(el);
    });
  } else {
    document.querySelectorAll(".reveal-on-scroll").forEach(el => el.classList.add("is-visible"));
  }
}

// 2. Smooth Animated Number Counters (Cubic Ease-Out)
function animateCounters() {
  const counters = document.querySelectorAll(".counter-stat");
  counters.forEach(counter => {
    const target = parseFloat(counter.getAttribute("data-target")) || 0;
    const suffix = counter.getAttribute("data-suffix") || "";
    const decimals = parseInt(counter.getAttribute("data-decimals"), 10) || 0;
    const duration = 1800;
    const startTime = performance.now();

    function updateCounter(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out: 1 - pow(1 - progress, 3)
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = (ease * target).toFixed(decimals);

      counter.innerText = current + suffix;

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        counter.innerText = (decimals ? target.toFixed(decimals) : target) + suffix;
      }
    }
    requestAnimationFrame(updateCounter);
  });
}

// 3. Live Floating Autonomous Activity Toast Rotator
const autonomousEvents = [
  "🤖 Autonomous Service Desk auto-triaged ticket for Room 305 • Ramesh (Housekeeping) dispatched.",
  "✨ Smart Pricing Analyst analyzed live occupancy (67%) • Dynamic rate suggestions synchronized.",
  "🍃 AI Concierge verified Lotus Spa reservation timings for guest Priya.",
  "💎 Presidential Suite availability verified for upcoming weekend.",
  "💰 Revenue Insights Agent verified ₹34,700 in collected card and UPI payments.",
  "🌿 Travel Planner generated customized 3-day wellness retreat itinerary.",
  "🛎️ Front Desk Copilot synchronized 4 scheduled guest arrivals for tomorrow."
];

let currentToastIndex = 0;
function initLiveToastRotator() {
  const toastEl = document.getElementById("liveActivityToast");
  const msgEl = document.getElementById("liveToastMessage");
  if (!toastEl || !msgEl) return;

  function cycleToast() {
    // Fade & slide down
    toastEl.classList.remove("translate-y-0", "opacity-100");
    toastEl.classList.add("translate-y-10", "opacity-0");

    setTimeout(() => {
      currentToastIndex = (currentToastIndex + 1) % autonomousEvents.length;
      msgEl.innerText = autonomousEvents[currentToastIndex];

      // Fade & slide up
      toastEl.classList.remove("translate-y-10", "opacity-0");
      toastEl.classList.add("translate-y-0", "opacity-100");
    }, 600);
  }

  // Cycle every 8 seconds
  setInterval(cycleToast, 8500);
}

// 4. Subtle 3D Card Perspective Tilt
function initCardTiltEffect() {
  document.querySelectorAll(".luxury-card-motion").forEach(card => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -4;
      const rotateY = ((x - centerX) / centerX) * 4;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px) scale(1.012)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px) scale(1)";
    });
  });
}

// 5. Interactive Ripple Feedback on Click
function initButtonRipples() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button, .btn-ripple");
    if (!btn) return;

    btn.style.transform = "scale(0.97)";
    setTimeout(() => {
      btn.style.transform = "";
    }, 150);
  });
}

// =============================================================
// REAL-TIME LOCATION, GOOGLE MAPPING SYSTEM & GEMINI LOCAL GUIDE
// =============================================================
let stayEaseMap = null;
let mapTileLayer = null;
let currentTileStyle = "streets";
let hotelMarker = null;
let userMarker = null;
let placeMarkers = {};
let allNearbyPlaces = [];
let currentCategoryFilter = "all";
let currentSearchKeyword = "";
let currentMaxDistance = "";
let userRealtimeLocation = null;
let hotelCoordinates = { lat: 18.9220, lng: 72.8347, name: "StayEase Luxury Heritage Hotel & Spa" };

// Check Gemini AI Status
async function checkGeminiStatus() {
  try {
    const res = await api("/ai/status");
    const statusText = document.getElementById("geminiStatusText");
    const statusDot = document.getElementById("geminiStatusDot");
    if (res && res.data) {
      if (res.data.configured) {
        if (statusText) statusText.innerText = `Active · ${res.data.model}`;
        if (statusDot) statusDot.className = "w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse";
      } else {
        if (statusText) statusText.innerText = `Standby · Smart Grounded Engine Active`;
        if (statusDot) statusDot.className = "w-1.5 h-1.5 rounded-full bg-amber-500";
      }
    }
  } catch (err) {
    console.warn("Gemini status check notice:", err.message);
  }
}

// Initialize Leaflet Google Maps styled system
function initStayEaseMap() {
  const mapContainer = document.getElementById("stayEaseMap");
  if (!mapContainer || typeof L === "undefined") return;

  if (stayEaseMap) {
    stayEaseMap.remove();
  }

  // Centered on StayEase Hotel in Colaba, Mumbai
  stayEaseMap = L.map("stayEaseMap", {
    center: [hotelCoordinates.lat, hotelCoordinates.lng],
    zoom: 16,
    zoomControl: true,
    scrollWheelZoom: false
  });

  // CARTO Voyager Tiles (Warm Luxury / Google-esque clarity)
  mapTileLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19
  }).addTo(stayEaseMap);

  // Custom Hotel Anchor Pin
  const hotelIcon = L.divIcon({
    className: "custom-map-icon",
    html: `
      <div class="stayease-pin-hotel w-10 h-10">
        <i class="fa-solid fa-hotel text-sm text-emerald-300"></i>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22]
  });

  hotelMarker = L.marker([hotelCoordinates.lat, hotelCoordinates.lng], { icon: hotelIcon })
    .addTo(stayEaseMap)
    .bindPopup(`
      <div class="p-3 w-64 text-brand-dark">
        <div class="flex items-center gap-2 mb-1">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Your Luxury Residence</span>
        </div>
        <h4 class="font-serif font-semibold text-sm leading-tight text-brand-heading">StayEase Heritage Hotel & Spa</h4>
        <p class="text-[11px] text-brand-muted mt-1">Apollo Bunder, Waterfront Esplanade, Colaba, Mumbai</p>
        <div class="mt-2.5 pt-2 border-t border-brand-border flex items-center justify-between text-[11px]">
          <span class="font-medium text-emerald-800"><i class="fa-solid fa-circle-check text-xs mr-1"></i>Anchor Point</span>
          <a href="https://www.google.com/maps/search/?api=1&query=18.9220,72.8347" target="_blank" class="text-brand-dark font-bold hover:underline flex items-center gap-1">
            <span>Google Maps</span> <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
          </a>
        </div>
      </div>
    `);
}

// Switch Map Tile Style (Street vs High Contrast)
function setMapTileStyle(style) {
  if (!stayEaseMap) return;
  currentTileStyle = style;
  const btnStreets = document.getElementById("mapBtnStreets");
  const btnSat = document.getElementById("mapBtnSatellite");

  if (style === "satellite") {
    mapTileLayer.setUrl("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png");
    if (btnSat) btnSat.className = "bg-brand-dark text-white px-3 py-1 rounded-full transition";
    if (btnStreets) btnStreets.className = "text-brand-muted hover:text-brand-dark px-3 py-1 rounded-full transition";
  } else {
    mapTileLayer.setUrl("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png");
    if (btnStreets) btnStreets.className = "bg-brand-dark text-white px-3 py-1 rounded-full transition";
    if (btnSat) btnSat.className = "text-brand-muted hover:text-brand-dark px-3 py-1 rounded-full transition";
  }
}

// Center Map on Hotel
function centerMapOnHotel() {
  if (!stayEaseMap) return;
  stayEaseMap.flyTo([hotelCoordinates.lat, hotelCoordinates.lng], 16, { duration: 1.2 });
  if (hotelMarker) hotelMarker.openPopup();
}

// Center Map on User Location
function centerMapOnUser() {
  if (!stayEaseMap || !userRealtimeLocation) {
    detectUserLocation();
    return;
  }
  stayEaseMap.flyTo([userRealtimeLocation.lat, userRealtimeLocation.lng], 16, { duration: 1.2 });
  if (userMarker) userMarker.openPopup();
}

// Real-Time Browser Geolocation
async function detectUserLocation() {
  const btnText = document.getElementById("locateMeBtnText");
  const display = document.getElementById("userDistanceDisplay");
  const legendUser = document.getElementById("legendUserLocation");

  if (!navigator.geolocation) {
    showToast("⚠️ Geolocation is not supported by your browser.", "error");
    return;
  }

  if (btnText) btnText.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Detecting GPS...`;

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      userRealtimeLocation = { lat, lng };

      if (btnText) btnText.innerHTML = `<span>✓ GPS Live Active</span>`;
      if (legendUser) {
        legendUser.classList.remove("hidden");
        legendUser.classList.add("flex");
      }

      // Place / Update User GPS Marker on Map
      if (stayEaseMap) {
        if (userMarker) {
          userMarker.setLatLng([lat, lng]);
        } else {
          const userIcon = L.divIcon({
            className: "custom-map-icon",
            html: `
              <div class="stayease-pin-user w-8 h-8">
                <i class="fa-solid fa-user text-xs"></i>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -18]
          });

          userMarker = L.marker([lat, lng], { icon: userIcon })
            .addTo(stayEaseMap)
            .bindPopup(`
              <div class="p-3 w-60 text-brand-dark">
                <div class="flex items-center gap-1.5 text-blue-600 text-[10px] font-bold uppercase mb-1">
                  <span class="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span> Your Live GPS Position
                </div>
                <p class="text-xs font-semibold">Current Device Location</p>
                <p class="text-[10px] text-brand-muted mt-1">${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E</p>
              </div>
            `);
        }

        // Add visual route line connecting user and hotel
        if (window.userRouteLine) stayEaseMap.removeLayer(window.userRouteLine);
        window.userRouteLine = L.polyline(
          [[lat, lng], [hotelCoordinates.lat, hotelCoordinates.lng]],
          { color: "#2563eb", weight: 3, dashArray: "6, 8", opacity: 0.8 }
        ).addTo(stayEaseMap);

        // Fit bounds to show both user and hotel
        const bounds = L.latLngBounds([[lat, lng], [hotelCoordinates.lat, hotelCoordinates.lng]]);
        stayEaseMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }

      // Calculate real-time distance and ETA via API
      try {
        const distRes = await api("/location/distance", {
          method: "POST",
          body: JSON.stringify({ userLat: lat, userLng: lng })
        });

        if (distRes && distRes.distanceKm !== undefined) {
          if (display) {
            display.innerHTML = `
              <span class="text-emerald-900 font-bold">📍 Real-time Live GPS Detected:</span>
              You are <strong>${distRes.distanceKm} km</strong> from StayEase Hotel — approx. <strong>${distRes.walkingTimeMins} min walk</strong> / <strong>${distRes.drivingTimeMins} min drive</strong>.
            `;
          }
          showToast(`📍 Live Location Active: ${distRes.distanceKm} km from StayEase`, "info");
        }
      } catch (e) {
        if (display) display.innerText = `📍 Live location detected (${lat.toFixed(4)}, ${lng.toFixed(4)}). Calculating distances...`;
      }

      // Reload nearby places with live distance
      await loadNearbyPlaces();
    },
    (err) => {
      if (btnText) btnText.innerText = "Detect My Live GPS Location";
      let msg = "Could not retrieve live location. Defaulting to hotel grounds.";
      if (err.code === 1) msg = "Location permission was denied. Defaulting to hotel grounds.";
      showToast(`⚠️ ${msg}`, "info");
      if (display) display.innerText = msg;
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// Load Curated Nearby Places from Server
async function loadNearbyPlaces() {
  const grid = document.getElementById("nearbyPlacesGrid");
  if (!grid) return;

  try {
    let url = `/location/places?category=${currentCategoryFilter}`;
    if (currentSearchKeyword) url += `&search=${encodeURIComponent(currentSearchKeyword)}`;
    if (currentMaxDistance) url += `&maxDistance=${currentMaxDistance}`;
    if (userRealtimeLocation) {
      url += `&userLat=${userRealtimeLocation.lat}&userLng=${userRealtimeLocation.lng}`;
    }

    const res = await api(url);
    if (!res || !res.data) throw new Error("Invalid places response");

    allNearbyPlaces = res.data;
    if (res.hotel) {
      hotelCoordinates = res.hotel;
    }

    updateCategoryCounts(allNearbyPlaces);
    renderNearbyPlaces(allNearbyPlaces);
    renderMapMarkers(allNearbyPlaces);
  } catch (err) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-rose-700 bg-rose-50/50 rounded-2xl border border-rose-200 p-6">
        <i class="fa-solid fa-triangle-exclamation text-2xl mb-2"></i>
        <p class="font-semibold text-sm">Failed to load nearby recommendations.</p>
        <p class="text-xs text-brand-muted mt-1">${err.message}</p>
        <button onclick="loadNearbyPlaces()" class="mt-3 bg-brand-dark text-white px-4 py-1.5 rounded-full text-xs font-semibold">Try Again</button>
      </div>
    `;
  }
}

// Update category count numbers
function updateCategoryCounts(places) {
  const counts = { all: places.length, cafe: 0, shop: 0, restaurant: 0, culture: 0 };
  places.forEach(p => {
    if (counts[p.category] !== undefined) counts[p.category]++;
  });
  const elAll = document.getElementById("countAll");
  const elCafe = document.getElementById("countCafe");
  const elShop = document.getElementById("countShop");
  const elRest = document.getElementById("countRestaurant");
  const elCult = document.getElementById("countCulture");

  if (elAll) elAll.innerText = counts.all;
  if (elCafe) elCafe.innerText = counts.cafe;
  if (elShop) elShop.innerText = counts.shop;
  if (elRest) elRest.innerText = counts.restaurant;
  if (elCult) elCult.innerText = counts.culture;
}

// Render Leaflet Pins for each place
function renderMapMarkers(places) {
  if (!stayEaseMap || typeof L === "undefined") return;

  // Clear existing place markers
  Object.values(placeMarkers).forEach(m => stayEaseMap.removeLayer(m));
  placeMarkers = {};

  const categoryStyles = {
    cafe: { color: "#d97706", bg: "#fef3c7", icon: "fa-mug-hot" },
    shop: { color: "#059669", bg: "#d1fae5", icon: "fa-bag-shopping" },
    restaurant: { color: "#e11d48", bg: "#ffe4e6", icon: "fa-utensils" },
    culture: { color: "#4f46e5", bg: "#e0e7ff", icon: "fa-landmark" }
  };

  places.forEach(p => {
    if (!p.location || !p.location.lat) return;
    const style = categoryStyles[p.category] || { color: "#1d2821", bg: "#f7f9f6", icon: "fa-location-dot" };

    const placeIcon = L.divIcon({
      className: "custom-map-icon",
      html: `
        <div class="stayease-pin-place w-8 h-8" style="background: ${style.bg}; border-color: ${style.color};">
          <i class="fa-solid ${style.icon} text-xs" style="color: ${style.color};"></i>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18]
    });

    const distLabel = p.distanceFromUserKm !== null && p.distanceFromUserKm !== undefined
      ? `${p.distanceFromUserKm} km from you (${p.walkingFromUserMins} min walk)`
      : `${p.distanceFromHotelKm} km from StayEase (${p.walkingTimeMins} min walk)`;

    const marker = L.marker([p.location.lat, p.location.lng], { icon: placeIcon })
      .addTo(stayEaseMap)
      .bindPopup(`
        <div class="w-64 overflow-hidden rounded-xl bg-white text-brand-dark">
          <img src="${p.image}" class="w-full h-28 object-cover" alt="${p.name}" />
          <div class="p-3">
            <div class="flex items-center justify-between text-[10px] text-brand-tag font-bold uppercase mb-1">
              <span>${p.categoryLabel || p.category}</span>
              <span class="text-amber-600 font-bold"><i class="fa-solid fa-star text-[9px] mr-0.5"></i>${p.rating}</span>
            </div>
            <h4 class="font-serif font-semibold text-sm leading-tight text-brand-heading">${p.name}</h4>
            <p class="text-[11px] text-brand-muted mt-1 line-clamp-2">${p.description}</p>
            <div class="mt-2 text-[10px] text-emerald-800 font-semibold flex items-center gap-1">
              <i class="fa-solid fa-person-walking"></i>
              <span>${distLabel}</span>
            </div>
            <div class="mt-3 pt-2 border-t border-brand-border flex items-center justify-between">
              <span class="text-[11px] font-bold text-brand-dark">${p.priceRange || p.priceLevel}</span>
              <a href="${p.googleMapsUrl}" target="_blank"
                class="bg-brand-dark text-white hover:bg-black px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1 transition">
                <span>Directions</span>
                <i class="fa-solid fa-diamond-turn-right text-[9px] text-emerald-300"></i>
              </a>
            </div>
          </div>
        </div>
      `);

    placeMarkers[p._id || p.name] = marker;
  });
}

// Render Places into HTML Grid
function renderNearbyPlaces(places) {
  const grid = document.getElementById("nearbyPlacesGrid");
  if (!grid) return;

  if (!places.length) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-brand-muted bg-white border border-brand-border rounded-3xl p-8">
        <i class="fa-solid fa-compass text-3xl text-brand-lightMuted mb-2"></i>
        <h4 class="font-serif text-lg font-medium text-brand-heading">No matching places found</h4>
        <p class="text-xs text-brand-muted mt-1">Try relaxing your distance filter or selecting a different category.</p>
        <button onclick="filterNearbyPlaces('all'); document.getElementById('nearbySearchInput').value='';"
          class="mt-4 bg-brand-btnPrimary hover:bg-brand-btnPrimaryHover text-brand-dark px-4 py-2 rounded-full text-xs font-semibold transition">
          View All Recommendations
        </button>
      </div>
    `;
    return;
  }

  const categoryIcons = {
    cafe: { icon: "fa-mug-hot", badge: "bg-amber-100 text-amber-800 border-amber-200" },
    shop: { icon: "fa-bag-shopping", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    restaurant: { icon: "fa-utensils", badge: "bg-rose-100 text-rose-800 border-rose-200" },
    culture: { icon: "fa-landmark", badge: "bg-indigo-100 text-indigo-800 border-indigo-200" }
  };

  grid.innerHTML = places.map(p => {
    const badgeStyle = categoryIcons[p.category] || { icon: "fa-tag", badge: "bg-stone-100 text-stone-800 border-stone-200" };
    const distText = p.distanceFromUserKm !== null && p.distanceFromUserKm !== undefined
      ? `${p.distanceFromUserKm} km from you · ${p.walkingFromUserMins} min walk`
      : `${p.distanceFromHotelKm} km · ${p.walkingTimeMins} min walk from StayEase`;

    const highlightPills = (p.highlights || []).slice(0, 3).map(h => `
      <span class="bg-brand-bg text-brand-muted text-[10px] px-2 py-0.5 rounded-md border border-brand-border/80 font-medium">
        ${h}
      </span>
    `).join("");

    return `
      <div class="bg-white border border-brand-border rounded-3xl overflow-hidden shadow-sm hover:border-brand-borderDark hover:shadow-md transition flex flex-col group">
        <!-- Photo and Floating Badges -->
        <div class="relative h-48 sm:h-52 overflow-hidden bg-stone-100">
          <img src="${p.image}" alt="${p.name}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500" loading="lazy" />
          <div class="absolute top-3 left-3 flex items-center gap-1.5">
            <span class="text-[10px] font-bold px-2.5 py-1 rounded-full border shadow-sm flex items-center gap-1 ${badgeStyle.badge}">
              <i class="fa-solid ${badgeStyle.icon} text-[9px]"></i>
              <span>${p.categoryLabel || p.category}</span>
            </span>
            ${p.featured ? `<span class="bg-brand-dark/90 text-amber-300 text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-sm"><i class="fa-solid fa-crown text-[9px] mr-1"></i>Curated Pick</span>` : ""}
          </div>
          <div class="absolute bottom-3 right-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full text-[11px] font-bold text-brand-heading shadow flex items-center gap-1">
            <i class="fa-solid fa-star text-amber-500 text-[10px]"></i>
            <span>${p.rating}</span>
            <span class="text-brand-lightMuted font-normal text-[10px]">(${p.reviewsCount})</span>
          </div>
        </div>

        <!-- Body Details -->
        <div class="p-5 flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between text-xs text-brand-tag font-semibold mb-1">
              <span class="flex items-center gap-1 text-emerald-800">
                <i class="fa-solid fa-person-walking text-xs"></i>
                <span>${distText}</span>
              </span>
              <span class="font-bold text-brand-heading">${p.priceRange || p.priceLevel}</span>
            </div>

            <h3 class="font-serif text-lg font-medium text-brand-heading group-hover:text-black transition">
              ${p.name}
            </h3>
            <p class="text-xs text-brand-muted mt-1.5 leading-relaxed line-clamp-2">
              ${p.description}
            </p>

            <div class="text-[11px] text-stone-500 mt-2 flex items-center gap-1.5">
              <i class="fa-regular fa-clock text-[10px] text-emerald-700"></i>
              <span>${p.openingHours}</span>
            </div>

            <!-- Highlight Chips -->
            <div class="flex flex-wrap gap-1.5 mt-3">
              ${highlightPills}
            </div>
          </div>

          <!-- Bottom Actions -->
          <div class="mt-5 pt-3 border-t border-brand-border/80 flex items-center justify-between gap-2">
            <button onclick="focusPlaceOnMap('${p._id || p.name}')"
              class="text-xs font-semibold text-brand-dark hover:text-black py-1.5 px-3 rounded-full hover:bg-brand-bg transition flex items-center gap-1.5">
              <i class="fa-solid fa-location-dot text-amber-700 text-xs"></i>
              <span>Show on Map</span>
            </button>
            <div class="flex items-center gap-1.5">
              <button onclick="askGeminiAboutPlace('${p.name.replace(/'/g, "\\'")}', '${p.category}')" title="Ask Gemini AI for insider recommendations"
                class="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs transition">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
              </button>
              <a href="${p.googleMapsUrl}" target="_blank"
                class="bg-brand-dark hover:bg-black text-white px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition shadow-sm">
                <span>Directions</span>
                <i class="fa-solid fa-diamond-turn-right text-emerald-300 text-[10px]"></i>
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// Pan and zoom map to selected place
function focusPlaceOnMap(placeId) {
  const marker = placeMarkers[placeId];
  if (!marker || !stayEaseMap) {
    const el = document.getElementById("stayEaseMap");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  const pos = marker.getLatLng();
  stayEaseMap.flyTo(pos, 17, { duration: 1.2 });
  marker.openPopup();
  const el = document.getElementById("stayEaseMap");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

// Filter Nearby Places by Category
function filterNearbyPlaces(category) {
  currentCategoryFilter = category;
  document.querySelectorAll(".place-cat-pill").forEach(pill => {
    if (pill.getAttribute("data-category") === category) {
      pill.className = "place-cat-pill active bg-brand-dark text-white px-4 py-2 rounded-full text-xs font-semibold transition whitespace-nowrap shadow-sm";
    } else {
      pill.className = "place-cat-pill bg-white border border-brand-border hover:border-brand-borderDark text-brand-dark px-4 py-2 rounded-full text-xs font-semibold transition whitespace-nowrap";
    }
  });
  loadNearbyPlaces();
}

// Search and Distance Filter Handlers
let searchDebounceTimer = null;
function handleNearbySearch(val) {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    currentSearchKeyword = val.trim();
    loadNearbyPlaces();
  }, 350);
}

function handleNearbyDistanceChange(val) {
  currentMaxDistance = val;
  loadNearbyPlaces();
}

// Quick Chip setter for Gemini input
function setGeminiPrompt(text) {
  const input = document.getElementById("geminiGuideInput");
  if (input) {
    input.value = text;
    input.focus();
  }
}

// Ask Gemini about a specific place from card
function askGeminiAboutPlace(placeName, category) {
  const input = document.getElementById("geminiGuideInput");
  if (input) {
    input.value = `Tell me what makes ${placeName} unique, the top specialty to order/try, and insider tips for visiting!`;
    const el = document.getElementById("geminiGuideInput");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    triggerGeminiLocalGuide();
  }
}

// Trigger Google Gemini AI Local Guide
async function triggerGeminiLocalGuide() {
  const input = document.getElementById("geminiGuideInput");
  const outputContainer = document.getElementById("geminiGuideOutput");
  const outputContent = document.getElementById("geminiOutputContent");
  const submitBtn = document.getElementById("geminiGuideSubmitBtn");
  const modelBadge = document.getElementById("geminiOutputModelBadge");

  if (!input || !outputContainer || !outputContent || !submitBtn) return;

  const query = input.value.trim();
  if (!query) {
    input.focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin text-stone-900"></i><span>Consulting Gemini...</span>`;

  outputContainer.classList.remove("hidden");
  outputContent.innerHTML = `<div class="py-4 text-center text-stone-400"><i class="fa-solid fa-wand-magic-sparkles text-lg animate-pulse text-indigo-400 mb-2"></i><p>Google Gemini 2.5 Flash is analyzing neighborhood places, distances, and local specialties...</p></div>`;

  try {
    const payload = {
      query,
      category: currentCategoryFilter,
      userLat: userRealtimeLocation ? userRealtimeLocation.lat : undefined,
      userLng: userRealtimeLocation ? userRealtimeLocation.lng : undefined
    };

    const res = await api("/location/gemini-recommend", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles text-stone-900"></i><span>Ask Gemini Guide</span>`;

    if (res && res.data && res.data.reply) {
      if (modelBadge) {
        modelBadge.innerText = res.data.source === "gemini"
          ? `Google Gemini 2.5 Flash (${res.data.model || "gemini-2.5-flash"})`
          : `StayEase Local Grounded Intelligence Engine`;
      }

      // Convert markdown bold to strong and bullet points nicely
      let formatted = res.data.reply
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em class="text-stone-300">$1</em>');

      outputContent.innerHTML = `<div class="leading-relaxed space-y-2 whitespace-pre-line">${formatted}</div>`;
    } else {
      throw new Error("No recommendation received");
    }
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles text-stone-900"></i><span>Ask Gemini Guide</span>`;
    outputContent.innerHTML = `
      <div class="text-rose-300">
        <i class="fa-solid fa-circle-exclamation mr-1"></i>
        Could not connect to Gemini local recommender: ${err.message}. Please verify server connection.
      </div>
    `;
  }
}

