require("dotenv").config();
const mongoose = require("mongoose");
const Room = require("./models/Room");
const User = require("./models/User");
const Review = require("./models/Review");
const ServiceRequest = require("./models/ServiceRequest");
const Booking = require("./models/Booking");
const Payment = require("./models/Payment");
const NearbyPlace = require("./models/NearbyPlace");
const locationService = require("./services/locationService");

const luxuryRooms = [
  {
    name: "Courtyard Standard",
    roomNumber: "101",
    floor: 1,
    category: "STANDARD",
    price: 4200,
    basePrice: 4200,
    capacity: 2,
    bedType: "Queen Bed",
    rating: 4.8,
    totalReviews: 24,
    amenities: ["High-Speed Wi-Fi", "Work Desk", "Artisan Coffee Maker", "En-suite Rain Shower", "Courtyard Garden View"],
    image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&q=80&w=1000",
    description: "A calm, well-lit guest room facing the inner courtyard, featuring restored timber details and an ergonomic executive desk.",
    active: true
  },
  {
    name: "Heritage Double",
    roomNumber: "204",
    floor: 2,
    category: "STANDARD",
    price: 6500,
    basePrice: 6500,
    capacity: 3,
    bedType: "King Bed + Daybed",
    rating: 4.9,
    totalReviews: 31,
    amenities: ["High-Speed Wi-Fi", "Private Balcony", "Botanical Bath Salts", "Smart TV 55\"", "Breakfast Included"],
    image: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&q=80&w=1000",
    description: "A characterful room with restored high ceilings, polished teak accents, a private balcony, and morning sun.",
    active: true
  },
  {
    name: "Garden Deluxe",
    roomNumber: "305",
    floor: 3,
    category: "DELUXE",
    price: 7280,
    basePrice: 7280,
    capacity: 3,
    bedType: "King Bed",
    rating: 4.9,
    totalReviews: 48,
    amenities: ["High-Speed Wi-Fi", "Garden Balcony", "Breakfast Buffet", "Smart Climate Controls", "Lotus Spa Pass"],
    image: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&q=80&w=1000",
    description: "Spacious and peaceful, opening onto a private garden balcony with lush tropical greenery and soft ambient lighting.",
    active: true
  },
  {
    name: "Oceanfront Luxury Deluxe",
    roomNumber: "402",
    floor: 4,
    category: "DELUXE",
    price: 9800,
    basePrice: 9800,
    capacity: 2,
    bedType: "California King",
    rating: 5.0,
    totalReviews: 39,
    amenities: ["Panoramic Ocean View", "Floor-to-Ceiling Windows", "Nespresso Bar", "Marble Soaking Tub", "Complimentary High Tea"],
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&q=80&w=1000",
    description: "Perched high above the coastline with sweeping sunrise vistas, freestanding Italian marble bathtub, and personalized butler concierge.",
    active: true
  },
  {
    name: "The Royal Presidential Suite",
    roomNumber: "501",
    floor: 5,
    category: "SUITE",
    price: 18500,
    basePrice: 18500,
    capacity: 4,
    bedType: "Master Suite + Guest Room",
    rating: 5.0,
    totalReviews: 19,
    amenities: ["Private Heated Plunge Pool", "Dedicated Butler", "Skyline Terrace", "Private Dining Room", "Chauffeured Airport Transfer"],
    image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&q=80&w=1000",
    description: "Our signature residence spanning 1,800 sq.ft., featuring a rooftop private plunge pool, dining room for 8, and dedicated 24-hour butler.",
    active: true
  },
  {
    name: "Executive Heritage Suite",
    roomNumber: "302",
    floor: 3,
    category: "SUITE",
    price: 13900,
    basePrice: 13900,
    capacity: 3,
    bedType: "Emperor Bed",
    rating: 4.9,
    totalReviews: 22,
    amenities: ["Separate Living Salon", "Complimentary Bar Cart", "Walk-in Wardrobe", "Spa Hydrotherapy Access", "Priority Rooftop Seating"],
    image: "https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&q=80&w=1000",
    description: "An elegant dual-room suite tailored for discerning travelers, featuring a private parlor for intimate meetings and relaxation.",
    active: true
  }
];

const sampleReviews = [
  {
    guestName: "Priya Nair",
    rating: 5,
    title: "Effortless check-in and an extraordinarily thoughtful team",
    text: "The AI concierge answered every question before we even arrived, and check-in took under two minutes. Housekeeping noticed we were celebrating our anniversary and left fresh orchids and artisan chocolates in the Garden Deluxe.",
    source: "Google Verified",
    sentiment: "positive",
    themes: ["Front Desk", "Housekeeping", "AI Concierge"],
    verifiedStay: true
  },
  {
    guestName: "Daniel Okafor",
    rating: 5,
    title: "The suite exceeded every expectation",
    text: "Private pool, spotless housekeeping twice daily, and the butler arranged dining on the terrace on short notice. The best hotel stay we have experienced as a family.",
    source: "TripAdvisor",
    sentiment: "positive",
    themes: ["Suites", "Housekeeping", "Rooftop Dining"],
    verifiedStay: true
  },
  {
    guestName: "Amara Diallo",
    rating: 5,
    title: "The AI concierge was genuinely intuitive",
    text: "It suggested a walking route along the heritage marina and booked our Lotus Spa hydrotherapy slot in the exact same conversation. It made the entire trip feel effortless.",
    source: "StayEase Verified",
    sentiment: "positive",
    themes: ["AI Concierge", "Spa & Wellness", "Local Itinerary"],
    verifiedStay: true
  },
  {
    guestName: "Vikram Malhotra",
    rating: 4,
    title: "Peaceful courtyard stay with fantastic breakfast",
    text: "Courtyard Standard room was whisper-quiet for work calls. The breakfast pavilion buffet had excellent south Indian and continental options. EV charger in the valet was very convenient.",
    source: "StayEase Verified",
    sentiment: "positive",
    themes: ["Dining", "Cleanliness", "Work Desk"],
    verifiedStay: true
  }
];

const sampleServiceRequests = [
  {
    guestName: "Priya Nair",
    roomNumber: "305",
    type: "fresh_towels",
    description: "Extra set of organic bath towels and slippers.",
    priority: "normal",
    status: "in_progress",
    assignedStaff: "Ramesh (Housekeeping Lead)",
    source: "guest"
  },
  {
    guestName: "Dr. Kabir Roy",
    roomNumber: "101",
    type: "drinking_water",
    description: "Two additional bottles of Himalayan mineral water.",
    priority: "high",
    status: "open",
    assignedStaff: "Ramesh (Housekeeping Lead)",
    source: "guest"
  },
  {
    guestName: "Daniel Okafor",
    roomNumber: "501",
    type: "maintenance",
    description: "Check poolside ambient temperature sensor.",
    priority: "high",
    status: "open",
    assignedStaff: "Vikram (Chief Engineer)",
    source: "staff"
  }
];

async function seedDatabase() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/stayease";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for database seeding...");

    // 1. Seed Rooms
    await Room.deleteMany({});
    const createdRooms = await Room.insertMany(luxuryRooms);
    console.log(`✓ Seeded ${createdRooms.length} luxury rooms across STANDARD, DELUXE, and SUITE.`);

    // 2. Seed Users
    await User.deleteMany({});
    const adminUser = await User.create({
      name: "StayEase General Manager",
      email: "admin@stayease.com",
      password: "admin123", // Will be hashed by pre-save hook
      phone: "+91 98200 11223",
      role: "admin",
      preferences: {
        budget: 20000,
        roomCategory: "SUITE",
        amenities: ["Dedicated Butler", "Skyline Terrace"],
        travelType: "Executive",
        language: "en"
      }
    });

    const guestUser = await User.create({
      name: "Priya Nair",
      email: "priya@example.com",
      password: "guest123", // Will be hashed by pre-save hook
      phone: "+91 98765 43210",
      role: "guest",
      preferences: {
        budget: 8500,
        roomCategory: "DELUXE",
        amenities: ["Breakfast Buffet", "Garden Balcony", "Lotus Spa Access"],
        travelType: "Leisure & Wellness",
        language: "en"
      }
    });

    console.log("✓ Seeded Admin User: admin@stayease.com / admin123");
    console.log("✓ Seeded Guest User: priya@example.com / guest123");

    // 3. Seed Sample Reviews
    await Review.deleteMany({});
    const reviewsWithRooms = sampleReviews.map((r, i) => ({
      ...r,
      room: createdRooms[i % createdRooms.length]._id,
      user: guestUser._id
    }));
    await Review.insertMany(reviewsWithRooms);
    console.log(`✓ Seeded ${reviewsWithRooms.length} verified guest reviews.`);

    // 4. Seed Sample Service Requests
    await ServiceRequest.deleteMany({});
    await ServiceRequest.insertMany(sampleServiceRequests);
    console.log(`✓ Seeded ${sampleServiceRequests.length} active service tickets.`);

    // 5. Seed a Sample Confirmed & Paid Booking for guest Priya
    await Booking.deleteMany({});
    await Payment.deleteMany({});

    const gardenRoom = createdRooms.find(r => r.category === "DELUXE") || createdRooms[0];
    const checkIn = new Date();
    const checkOut = new Date(Date.now() + 2 * 86400000);
    const nights = 2;
    const roomSubtotal = nights * gardenRoom.price;
    const taxes = Math.round(roomSubtotal * 0.12);
    const totalAmount = roomSubtotal + taxes;

    const sampleBooking = await Booking.create({
      user: guestUser._id,
      bookingReference: "SE-849201",
      guestName: guestUser.name,
      email: guestUser.email,
      phone: guestUser.phone,
      guests: 2,
      room: gardenRoom._id,
      roomName: gardenRoom.name,
      checkIn,
      checkOut,
      nights,
      basePrice: gardenRoom.price,
      totalAmount,
      status: "confirmed",
      paymentStatus: "paid",
      message: "Arriving for anniversary stay. High floor preferred."
    });

    await Payment.create({
      booking: sampleBooking._id,
      user: guestUser._id,
      bookingReference: sampleBooking.bookingReference,
      amount: totalAmount,
      currency: "INR",
      paymentMethod: "mock_card",
      status: "completed",
      transactionId: "TXN_MOCK_INIT_849201",
      gateway: "StayEase Sandbox Mock Payment Gateway",
      cardLast4: "8821",
      verified: true,
      verifiedAt: new Date()
    });

    console.log("✓ Seeded sample booking reference SE-849201 with verified payment.");

    // Seed curated nearby places for Google mapping and recommendations
    await NearbyPlace.deleteMany({});
    await locationService.ensurePlacesSeeded();
    console.log("✓ Seeded curated local shops, cafes, fine dining, and cultural landmarks.");

    console.log("====================================================");
    console.log("🎉 StayEase Database Seed Completed Successfully!");
    console.log("====================================================");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    process.exit(1);
  }
}

seedDatabase();
