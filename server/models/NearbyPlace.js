const mongoose = require("mongoose");

const nearbyPlaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      enum: ["cafe", "shop", "restaurant", "culture", "wellness"],
      index: true
    },
    categoryLabel: {
      type: String,
      default: "Local Recommendation"
    },
    description: {
      type: String,
      required: true
    },
    address: {
      type: String,
      required: true
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    distanceFromHotelKm: {
      type: Number,
      required: true,
      default: 0.5
    },
    walkingTimeMins: {
      type: Number,
      default: 6
    },
    drivingTimeMins: {
      type: Number,
      default: 2
    },
    rating: {
      type: Number,
      default: 4.8,
      min: 1,
      max: 5
    },
    reviewsCount: {
      type: Number,
      default: 120
    },
    priceLevel: {
      type: String,
      enum: ["₹", "₹₹", "₹₹₹", "₹₹₹₹"],
      default: "₹₹"
    },
    priceRange: {
      type: String,
      default: "₹300 – ₹800"
    },
    openingHours: {
      type: String,
      default: "8:00 AM – 10:00 PM · Open Daily"
    },
    isOpenNow: {
      type: Boolean,
      default: true
    },
    highlights: {
      type: [String],
      default: []
    },
    image: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      default: "+91 (022) 2288-4000"
    },
    googleMapsUrl: {
      type: String,
      default: ""
    },
    featured: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

nearbyPlaceSchema.index({ "location.lat": 1, "location.lng": 1 });

module.exports = mongoose.model("NearbyPlace", nearbyPlaceSchema);

