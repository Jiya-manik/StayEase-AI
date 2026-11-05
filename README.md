# StayEase AI — Autonomous Luxury Hotel Booking & Operations Platform

StayEase AI is an autonomous, full-stack, AI-powered hotel booking and management platform designed with luxury hospitality aesthetics, grounded data retrieval, multi-agent AI operations, and robust persistence.

---

## 🌟 Highlights

- **Luxury Hospitality UI**: Warm ivory (`#f7f9f6`), charcoal (`#1d2821`), subtle gold, and sage green accents paired with Playfair Display and Plus Jakarta Sans typography.
- **10 Autonomous AI Agents**:
  - **Agent 01: Customer Concierge** — Grounded natural-language guest assistant for room availability, hotel policies, spa reservations, and rooftop dining.
  - **Agent 02: Travel Planner** — Autonomous multi-day stay and local excursion planner with transparent budget calculations and account saving.
  - **Agent 03: Smart Booking Assistant** — Proactive date conflict checker, capacity validator, and pricing breakdown explainer.
  - **Agent 04: Recommendation Engine** — Multi-variable scoring matching guest budget, previous stays, amenities, and real-time inventory.
  - **Agent 05: Review Insights Assistant** — Autonomous sentiment and theme tagging on customer feedback.
  - **Agent 06: Hotel Operations Copilot** — Conversational natural-language query engine for authorized staff querying live MongoDB records (arrivals, revenue, tickets, occupancy).
  - **Agent 07: Autonomous Service Desk** — Background worker daemon running automated ticket triage, auto-prioritization, and staff role assignment.
  - **Agent 08: Smart Dynamic Pricing Analyst** — Dynamic pricing engine proposing demand- and occupancy-based rates within administrator bounds (±15%).
  - **Agent 09: Revenue & Business Insights** — Verified financial analysis strictly separating collected payments from unpaid reservations.
  - **Agent 10: Admin Action Planner** — Multi-department operational plan generator with risk assessments and approval queue integration.
- **Human-in-the-Loop Approval Queue**: High-impact actions (price updates, operational changes) require explicit administrator approval before execution.
- **Cryptographic Audit Trail**: Full execution history logged in `AIActionLog` collection.
- **Sandbox Mock Payment Adapter**: Server-side checkout intent generation, cryptographically verifiable transaction processing, and refund tracking.
- **Official Tax Invoices**: Printable official hospitality receipts with GSTIN breakdown and unique references (`SE-XXXXXX`).

---

## 🚀 Quick Start Guide

### 1. Requirements
- Node.js (v18+)
- MongoDB Community Server running on `mongodb://127.0.0.1:27017`
- Web Browser

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Verify or adjust `.env`:
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/stayease
JWT_SECRET=stayease_secure_jwt_dev_key_2026

# Google Gemini Real-Time AI
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# OpenAI Fallback
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini

# Google Maps & Location Integrations
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```
> **Note**: Even if `GEMINI_API_KEY` or `OPENAI_API_KEY` is not provided, the platform operates seamlessly using its built-in grounded intelligence engine and verified local databases!

---

### 🗺️ New: Real-Time Location, Nearby Recommendations & Google Mapping System
- **Real-Time GPS Detection**: Live distance calculations (walking and driving ETA) using the Haversine formula from guest's live position to StayEase Hotel (`18.9220° N, 72.8347° E`) and surrounding venues.
- **Interactive Google Mapping System**: Color-coded pins for StayEase Hotel (Gold), Artisan Cafes (Amber), Boutiques & Shops (Emerald), Fine Dining (Ruby), and Cultural Landmarks (Indigo) with one-click Google Maps walking navigation routes.
- **14 Curated Heritage Spots**: High-reputation spots around Apollo Bunder, Colaba, and Kala Ghoda with live opening hours, reviews, photos, and highlight tags.
- **Google Gemini 2.5 Flash Local Concierge**: Bespoke personalized recommendations, walking tours, and secret dishes generated dynamically based on guest vibe, proximity, and schedule.

### 4. Seed the Database
Populates luxury rooms across STANDARD, DELUXE, and SUITE categories, initial reviews, active service tickets, and demo accounts:
```bash
npm run seed
```

#### Demo Credentials:
| Role | Email | Password | Access |
|---|---|---|---|
| **Guest** | `priya@example.com` | `guest123` | Bookings, Invoices, Service Requests, Reviews |
| **Admin** | `admin@stayease.com` | `admin123` | Full AI Operations Center, Approvals, Dynamic Pricing, Audit Logs |

### 5. Start the Application Server
```bash
npm start
```
The server will start at:
👉 **`http://localhost:5000`**

---

## 🧪 Automated Testing

StayEase includes an automated end-to-end integration test suite verifying all 26 core API flows and autonomous agents:

```bash
node server/test-suite.js
```

### Verified Test Suite Results (26/26 Passed):
- `GET /api/health` — API health check
- `POST /api/auth/login` — JWT generation for Admin
- `POST /api/auth/register` — Guest registration with bcrypt hashing
- `GET /api/auth/me` — Persistent session verification
- `GET /api/rooms` — Active luxury inventory retrieval
- `GET /api/rooms?category=SUITE` — Category filtering
- `POST /api/rooms/availability` — Date conflict and capacity check
- `Agent 01 (CustomerConciergeAgent)` — Policy and room queries
- `Agent 02 (TravelPlannerAgent)` — Multi-day itinerary with budget
- `Agent 03 (BookingAssistantAgent)` — Pricing breakdown and add-ons
- `Agent 04 (RecommendationAgent)` — Ranked match scores
- `Agent 05 (ReviewInsightsAgent)` — Sentiment and operational theme analysis
- `POST /api/bookings` — Confirmed booking creation (`SE-XXXXXX`)
- `POST /api/bookings` — Simultaneous overlapping booking prevention (`409 Conflict`)
- `POST /api/payments/intent` — Server-side checkout intent
- `POST /api/payments/process` — Verified sandbox mock payment
- `GET /api/bookings/:id/invoice` — Official hospitality receipt
- `POST /api/services` — Service ticket creation and auto-triage
- `POST /api/reviews` — Verified review submission with sentiment tagging
- `Agent 06 (HotelOperationsCopilot)` — Operational database queries
- `Agent 08 (SmartPricingAnalyst)` — Bounded pricing recommendations
- `Agent 09 (RevenueInsightsAgent)` — Verified collected revenue calculations
- `Agent 10 (AdminActionPlannerAgent)` — Structured operational plan with risks
- `POST /api/admin/approvals/:id/decide` — Human-in-the-loop approval execution
- `GET /api/admin/audit-logs` — Audit trail tracking
- `POST /api/bookings/:id/cancel` — Cancellation policy and refund execution

---

## 📁 Repository Architecture

```
StayEase/
├── public/
│   ├── index.html         # Luxury responsive SPA with 7 dedicated modals
│   └── app.js             # Client application logic, agent interfaces & state
├── server/
│   ├── middleware/
│   │   └── auth.js        # JWT verification, role authorization (guest/staff/admin)
│   ├── models/
│   │   ├── User.js        # User model with bcrypt pre-save hook
│   │   ├── Room.js        # Room model with dynamic multipliers and amenities
│   │   ├── Booking.js     # Booking model with unique references and status
│   │   ├── Payment.js     # Payment transactions model with server verification
│   │   ├── ServiceRequest.js # In-room service tickets with AI classification
│   │   ├── Review.js      # Customer reviews with sentiment tags
│   │   ├── Itinerary.js   # Travel planner saved itineraries
│   │   ├── AIActionLog.js # Audit trail of all agent actions
│   │   └── ApprovalRequest.js # Human-in-the-loop approval queue
│   ├── routes/
│   │   ├── auth.js        # Register, login, me, profile
│   │   ├── rooms.js       # Search, filter, availability, recommendations, CRUD
│   │   ├── bookings.js    # Reservations, invoices, cancellations, refunds
│   │   ├── payments.js    # Mock checkout intent and verified processing
│   │   ├── services.js    # In-room request dispatch and triage
│   │   ├── reviews.js     # Reviews and sentiment analysis
│   │   ├── itineraries.js # Travel plan generation and retrieval
│   │   ├── ai.js          # Customer AI agents (1-5)
│   │   ├── admin.js       # Admin Operations Center & agents (6-10)
│   │   └── hotel.js       # Legacy backward compatibility routes
│   ├── services/
│   │   ├── aiAgents.js    # 10 Autonomous AI Agents implementations
│   │   ├── aiOrchestrator.js # Central agent router, validation & audit logging
│   │   ├── backgroundWorker.js # Autonomous Service Desk triage worker daemon
│   │   └── payment.js     # Sandbox mock payment adapter
│   ├── seed.js            # Safe database seeder
│   ├── test-suite.js      # Automated end-to-end integration test suite
│   └── server.js          # Express application initialization & background worker
├── .env                   # Environment variables
├── ARCHITECTURE.md        # Architecture specification
└── README.md              # Project documentation
```

---

## 🛡️ Security & Reliability Policies

1. **Server-Side Pricing**: Nights, rates, add-ons, and taxes are strictly calculated and validated on the backend. Frontend-computed totals are never trusted blindly.
2. **Conflict Prevention**: Overlapping bookings for the same room are strictly prevented via MongoDB queries checking date range intersections.
3. **Verified Payments**: Mock payments require explicit server-side intent creation, status tracking, and unique transaction IDs.
4. **Human-in-the-Loop**: Autonomous agents cannot directly alter room pricing or trigger mass cancellations without queueing an `ApprovalRequest` for administrator sign-off.
5. **Data Grounding**: AI Concierge and Operations Copilot only draw information from real MongoDB records and verified hotel policies.
