# StayEase architecture

Browser
  -> public/index.html + app.js
  -> Express REST API
  -> MongoDB

AI:
  Browser -> /api/ai/chat -> OpenAI Responses API
  Review -> /api/ai/review-analysis -> sentiment/themes

Recommendations:
  Guest preferences + room inventory -> recommendation scoring -> ranked rooms

Booking:
  Availability check -> conflict check -> booking document -> total amount

Production:
  Add auth, payment webhooks, real-time events, external weather/maps,
  observability and deployment after the local MVP is stable.
