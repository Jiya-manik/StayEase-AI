const express = require("express");
const router = express.Router();
const locationService = require("../services/locationService");
const geminiService = require("../services/geminiService");
const NearbyPlace = require("../models/NearbyPlace");

// 1. Hotel information and coordinates
router.get("/hotel", (_req, res) => {
  try {
    const hotel = locationService.getHotelInfo();
    res.json({
      success: true,
      data: hotel
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Query nearby places (cafes, shops, restaurants, culture) with live distance calculation
router.get("/places", async (req, res) => {
  try {
    const { category, search, maxDistance, userLat, userLng } = req.query;
    const places = await locationService.getNearbyPlaces({
      category,
      search,
      maxDistance: maxDistance ? parseFloat(maxDistance) : undefined,
      userLat: userLat ? parseFloat(userLat) : undefined,
      userLng: userLng ? parseFloat(userLng) : undefined
    });

    res.json({
      success: true,
      count: places.length,
      hotel: locationService.getHotelInfo(),
      data: places
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Single place details
router.get("/places/:id", async (req, res) => {
  try {
    const place = await NearbyPlace.findById(req.params.id);
    if (!place) {
      return res.status(404).json({ success: false, message: "Place not found" });
    }
    res.json({ success: true, data: place });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Real-time distance and ETA calculation
router.post("/distance", (req, res) => {
  try {
    const { userLat, userLng, targetLat, targetLng } = req.body;
    if (userLat === undefined || userLng === undefined) {
      return res.status(400).json({ success: false, message: "userLat and userLng are required" });
    }

    const hotel = locationService.getHotelInfo();
    const destLat = targetLat !== undefined ? targetLat : hotel.lat;
    const destLng = targetLng !== undefined ? targetLng : hotel.lng;

    const distanceKm = locationService.calculateHaversineDistance(
      parseFloat(userLat),
      parseFloat(userLng),
      parseFloat(destLat),
      parseFloat(destLng)
    );

    const walkingTimeMins = locationService.estimateWalkingTimeMins(distanceKm);
    const drivingTimeMins = locationService.estimateDrivingTimeMins(distanceKm);

    res.json({
      success: true,
      distanceKm,
      walkingTimeMins,
      drivingTimeMins,
      origin: { lat: userLat, lng: userLng },
      destination: { lat: destLat, lng: destLng }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Gemini AI-Powered Personalized Nearby Recommendation
router.post("/gemini-recommend", async (req, res) => {
  try {
    const { query, category, userLat, userLng } = req.body;
    const hotel = locationService.getHotelInfo();

    const places = await locationService.getNearbyPlaces({
      category,
      userLat: userLat ? parseFloat(userLat) : undefined,
      userLng: userLng ? parseFloat(userLng) : undefined
    });

    let userLocation = null;
    if (userLat && userLng) {
      const dist = locationService.calculateHaversineDistance(
        parseFloat(userLat),
        parseFloat(userLng),
        hotel.lat,
        hotel.lng
      );
      userLocation = {
        lat: userLat,
        lng: userLng,
        distanceFromHotel: dist
      };
    }

    const recommendation = await geminiService.generateNearbyGuide({
      query,
      category,
      userLocation,
      places: places.slice(0, 10),
      hotelInfo: hotel
    });

    res.json({
      success: true,
      data: recommendation,
      placesCount: places.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

