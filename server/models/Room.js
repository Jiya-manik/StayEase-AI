const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  roomNumber: { type: String, default: "" },
  floor: { type: Number, default: 1 },
  category: { type: String, enum: ["STANDARD", "DELUXE", "SUITE"], default: "STANDARD" },
  price: { type: Number, required: true },
  basePrice: { type: Number, default: function() { return this.price; } },
  dynamicPriceMultiplier: { type: Number, default: 1.0 },
  capacity: { type: Number, default: 2 },
  bedType: { type: String, default: "King Bed" },
  rating: { type: Number, default: 4.8 },
  totalReviews: { type: Number, default: 16 },
  amenities: [String],
  image: String,
  description: String,
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("Room", roomSchema);
