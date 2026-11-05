const NearbyPlace = require("../models/NearbyPlace");

// StayEase Hotel Anchor Location (Apollo Bunder, Colaba, Mumbai)
const HOTEL_LOCATION = {
  name: "StayEase Luxury Heritage Hotel & Spa",
  address: "Apollo Bunder, Waterfront Esplanade, Colaba, Mumbai, Maharashtra 400001",
  lat: 18.9220,
  lng: 72.8347,
  phone: "+91 (022) 8000-EASE",
  city: "Mumbai",
  state: "Maharashtra",
  country: "India",
  postalCode: "400001"
};

// Seed dataset of 14 curated luxury cafes, boutiques, fine dining, and cultural landmarks
const CURATED_PLACES = [
  {
    name: "The Heritage Bakehouse & Roastery",
    category: "cafe",
    categoryLabel: "Artisan Cafe & Bakery",
    description: "Charming sunlit bakery in a 1910 colonial mansion offering house-roasted single origin coffees, flaky pistachio croissants, and artisanal sourdough loaves.",
    address: "24 Ormiston Road, Apollo Bunder, Colaba",
    location: { lat: 18.9234, lng: 72.8336 },
    distanceFromHotelKm: 0.25,
    walkingTimeMins: 3,
    drivingTimeMins: 1,
    rating: 4.9,
    reviewsCount: 342,
    priceLevel: "₹₹",
    priceRange: "₹300 – ₹700",
    openingHours: "7:00 AM – 10:30 PM · Open Daily",
    isOpenNow: true,
    highlights: ["Single-Origin Pour-over", "Almond Brioche", "Garden Courtyard Seating", "High-speed Wi-Fi"],
    image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=800",
    phone: "+91 (022) 2288-1910",
    featured: true
  },
  {
    name: "Café Leopold & Vintage Salon",
    category: "cafe",
    categoryLabel: "Historic Bistro & Cafe",
    description: "Legendary 1871 heritage gathering spot brimming with vintage charm, serving chilled cold brews, freshly baked pastries, and cosmopolitan comfort delicacies.",
    address: "Colaba Causeway, Apollo Bunder, Colaba",
    location: { lat: 18.9228, lng: 72.8319 },
    distanceFromHotelKm: 0.4,
    walkingTimeMins: 5,
    drivingTimeMins: 2,
    rating: 4.7,
    reviewsCount: 1420,
    priceLevel: "₹₹",
    priceRange: "₹400 – ₹900",
    openingHours: "7:30 AM – Midnight · Open Daily",
    isOpenNow: true,
    highlights: ["Historic 1871 Ambiance", "Signature Cold Coffee", "Cheesecake", "Bustling Vibe"],
    image: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=800",
    phone: "+91 (022) 2287-3333",
    featured: true
  },
  {
    name: "Kala Ghoda Artisanal Espresso Lab",
    category: "cafe",
    categoryLabel: "Specialty Coffee Roastery",
    description: "Minimalist third-wave coffee studio known for aero-press micro-lots, nitro cold brews, matcha lattes, and gluten-free citrus cakes.",
    address: "Ropewalk Lane, Kala Ghoda Arts Precinct",
    location: { lat: 18.9282, lng: 72.8332 },
    distanceFromHotelKm: 0.75,
    walkingTimeMins: 9,
    drivingTimeMins: 3,
    rating: 4.9,
    reviewsCount: 288,
    priceLevel: "₹₹",
    priceRange: "₹350 – ₹800",
    openingHours: "8:00 AM – 9:00 PM · Open Daily",
    isOpenNow: true,
    highlights: ["Micro-Lot Coffee", "Matcha Latte", "Organic Vegan Bakes", "Art Gallery Wall"],
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=800",
    phone: "+91 (022) 2263-8822",
    featured: false
  },
  {
    name: "Sea Breeze Promenade Cafe",
    category: "cafe",
    categoryLabel: "Waterfront Ocean Cafe",
    description: "Breezy sea-facing terrace overlooking the Arabian Sea, serving artisan Italian gelato, espresso affogatos, and fresh Mediterranean mezze platters.",
    address: "Waterfront Esplanade, Pier 3, Colaba",
    location: { lat: 18.9205, lng: 72.8358 },
    distanceFromHotelKm: 0.3,
    walkingTimeMins: 4,
    drivingTimeMins: 1,
    rating: 4.8,
    reviewsCount: 415,
    priceLevel: "₹₹",
    priceRange: "₹450 – ₹950",
    openingHours: "8:00 AM – 11:00 PM · Open Daily",
    isOpenNow: true,
    highlights: ["Panoramic Ocean Sunset", "Artisanal Gelato", "Outdoor Sea Deck", "Evening Jazz"],
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=800",
    phone: "+91 (022) 2289-5400",
    featured: true
  },
  {
    name: "Silk & Heritage Pashmina Guild",
    category: "shop",
    categoryLabel: "Luxury Textiles & Pashmina",
    description: "Premier boutique showcasing hand-spun Kashmiri pashmina shawls, organic mulberry silks, hand-embroidered throws, and bespoke tailored jackets.",
    address: "12 Tullock Road, Near Gateway, Colaba",
    location: { lat: 18.9215, lng: 72.8335 },
    distanceFromHotelKm: 0.28,
    walkingTimeMins: 3,
    drivingTimeMins: 1,
    rating: 4.9,
    reviewsCount: 196,
    priceLevel: "₹₹₹",
    priceRange: "₹2,500 – ₹25,000",
    openingHours: "10:00 AM – 8:30 PM · Open Daily",
    isOpenNow: true,
    highlights: ["GI-Certified Pashmina", "Hand-Dyed Silks", "Custom Tailoring", "Worldwide Shipping"],
    image: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=800",
    phone: "+91 (022) 2282-9911",
    featured: true
  },
  {
    name: "Curio Cottage Artisanal Jewellers",
    category: "shop",
    categoryLabel: "Heritage Jewellery & Silver",
    description: "Celebrated boutique renowned for handcrafted sterling silver jewellery, semi-precious stone neckpieces, vintage filigree earrings, and royal kundan crafts.",
    address: "Mahakavi Bhushan Marg, Colaba",
    location: { lat: 18.9242, lng: 72.8327 },
    distanceFromHotelKm: 0.45,
    walkingTimeMins: 6,
    drivingTimeMins: 2,
    rating: 4.8,
    reviewsCount: 230,
    priceLevel: "₹₹₹",
    priceRange: "₹1,800 – ₹18,000",
    openingHours: "10:30 AM – 8:00 PM · Open Daily",
    isOpenNow: true,
    highlights: ["Handcrafted Sterling Silver", "Heirloom Pearls", "Filigree Necklaces", "Gift Boxing"],
    image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&q=80&w=800",
    phone: "+91 (022) 2202-2619",
    featured: false
  },
  {
    name: "Kala Ghoda Art & Craft Collective",
    category: "shop",
    categoryLabel: "Artisanal Crafts & Decor",
    description: "Design-forward collective store featuring contemporary Indian ceramic tableware, organic brass decor, block-printed linen, and local contemporary artwork.",
    address: "V.B. Gandhi Marg, Kala Ghoda",
    location: { lat: 18.9295, lng: 72.8329 },
    distanceFromHotelKm: 0.85,
    walkingTimeMins: 11,
    drivingTimeMins: 4,
    rating: 4.9,
    reviewsCount: 310,
    priceLevel: "₹₹",
    priceRange: "₹800 – ₹6,500",
    openingHours: "10:00 AM – 8:00 PM · Closed Mondays",
    isOpenNow: true,
    highlights: ["Studio Ceramics", "Handmade Brass Sculptures", "Sustainable Linens", "Local Artist Prints"],
    image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=800",
    phone: "+91 (022) 2284-5544",
    featured: true
  },
  {
    name: "The Royal Book & Antiquities Co.",
    category: "shop",
    categoryLabel: "Rare Books & Antiquities",
    description: "Atmospheric antiquarian boutique featuring first-edition vintage books, antique maps of the Indian Ocean, fountain pens, and handmade leather journals.",
    address: "18 Lansdowne Road, Colaba",
    location: { lat: 18.9238, lng: 72.8315 },
    distanceFromHotelKm: 0.52,
    walkingTimeMins: 7,
    drivingTimeMins: 2,
    rating: 4.9,
    reviewsCount: 165,
    priceLevel: "₹₹",
    priceRange: "₹500 – ₹8,000",
    openingHours: "11:00 AM – 7:30 PM · Open Daily",
    isOpenNow: true,
    highlights: ["Rare First Editions", "Historical Maps", "Handmade Paper Journals", "Leather Bookmarks"],
    image: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=800",
    phone: "+91 (022) 2285-1100",
    featured: false
  },
  {
    name: "The Table Waterfront Bistro",
    category: "restaurant",
    categoryLabel: "Fine Dining & Farm-to-Table",
    description: "Award-winning fine dining restaurant pioneering ingredient-driven global cuisine, small plates, truffle pasta, and an extensive sommelier wine list.",
    address: "Kalapesi Trust Building, Apollo Bunder",
    location: { lat: 18.9227, lng: 72.8338 },
    distanceFromHotelKm: 0.22,
    walkingTimeMins: 3,
    drivingTimeMins: 1,
    rating: 4.9,
    reviewsCount: 920,
    priceLevel: "₹₹₹₹",
    priceRange: "₹2,200 – ₹5,000",
    openingHours: "12:00 PM – 4:00 PM, 7:00 PM – 1:00 AM",
    isOpenNow: true,
    highlights: ["Truffle Taglierini", "Farm-Fresh Microgreens", "Curated Sommelier Wine Cellar", "Valet Service"],
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80&w=800",
    phone: "+91 (022) 2282-5000",
    featured: true
  },
  {
    name: "Trishna Coastal Heritage Spice",
    category: "restaurant",
    categoryLabel: "Coastal Seafood Speciality",
    description: "World-renowned institution celebrated for butter-pepper-garlic jumbo crab, coastal fish curries, appams, and authentic Mangalorean coastal recipes.",
    address: "7 Sai Baba Marg, Kala Ghoda",
    location: { lat: 18.9288, lng: 72.8318 },
    distanceFromHotelKm: 0.88,
    walkingTimeMins: 11,
    drivingTimeMins: 4,
    rating: 4.8,
    reviewsCount: 1680,
    priceLevel: "₹₹₹",
    priceRange: "₹1,500 – ₹3,500",
    openingHours: "12:00 PM – 3:30 PM, 6:30 PM – 11:45 PM",
    isOpenNow: true,
    highlights: ["Butter Garlic Jumbo Crab", "Koliwada Prawns", "Tender Coconut Kheer", "Heritage Ambience"],
    image: "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&q=80&w=800",
    phone: "+91 (022) 2270-3213",
    featured: true
  },
  {
    name: "Indigo Delicatessen & Wine Bar",
    category: "restaurant",
    categoryLabel: "Gourmet Deli & European Bistro",
    description: "Sophisticated European bistro famous for handmade thin-crust pizzas, artisanal charcuterie boards, gourmet burgers, and signature chocolate mud cake.",
    address: "5 Mandlik Road, Colaba",
    location: { lat: 18.9232, lng: 72.8331 },
    distanceFromHotelKm: 0.32,
    walkingTimeMins: 4,
    drivingTimeMins: 1,
    rating: 4.8,
    reviewsCount: 760,
    priceLevel: "₹₹₹",
    priceRange: "₹1,200 – ₹2,800",
    openingHours: "9:00 AM – Midnight · Open Daily",
    isOpenNow: true,
    highlights: ["Artisan Charcuterie", "Gourmet Woodfired Pizzas", "Molten Chocolate Cake", "Craft Beers"],
    image: "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&q=80&w=800",
    phone: "+91 (022) 6655-1010",
    featured: false
  },
  {
    name: "Gateway of India Waterfront Esplanade",
    category: "culture",
    categoryLabel: "Historic Landmark & Monument",
    description: "The iconic 1924 basalt ceremonial arch overlooking Mumbai Harbour. Majestic promenade for sunset strolls, ocean breezes, and heritage photography.",
    address: "Apollo Bunder Waterfront Esplanade",
    location: { lat: 18.9220, lng: 72.8346 },
    distanceFromHotelKm: 0.15,
    walkingTimeMins: 2,
    drivingTimeMins: 1,
    rating: 4.9,
    reviewsCount: 8420,
    priceLevel: "₹",
    priceRange: "Free Public Access",
    openingHours: "Open 24 Hours · Best at Sunrise & Sunset",
    isOpenNow: true,
    highlights: ["Iconic 1924 Basalt Arch", "Harbour Sea Breeze", "Historic Architecture", "Yacht Pier Launch"],
    image: "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&q=80&w=800",
    phone: "+91 (022) 2284-4000",
    featured: true
  },
  {
    name: "CSMVS Art & Heritage Museum",
    category: "culture",
    categoryLabel: "Art & Natural History Museum",
    description: "Stately Indo-Saracenic museum nestled in lush palm gardens, housing over 50,000 priceless artifacts, ancient sculptures, miniature paintings, and art galleries.",
    address: "159-161 Mahatma Gandhi Road, Fort",
    location: { lat: 18.9269, lng: 72.8326 },
    distanceFromHotelKm: 0.72,
    walkingTimeMins: 9,
    drivingTimeMins: 3,
    rating: 4.9,
    reviewsCount: 3200,
    priceLevel: "₹",
    priceRange: "₹150 – ₹500 (Entry Ticket)",
    openingHours: "10:15 AM – 6:00 PM · Open Daily",
    isOpenNow: true,
    highlights: ["50,000 Historical Artifacts", "Sculpture Garden", "Miniature Paintings", "Botanical Palm Gardens"],
    image: "https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?auto=format&fit=crop&q=80&w=800",
    phone: "+91 (022) 2284-4484",
    featured: true
  },
  {
    name: "Sassoon Dock Heritage Maritime Walk",
    category: "culture",
    categoryLabel: "Maritime Heritage & Street Art",
    description: "Built in 1875, this historic maritime clocktower dock features vibrant large-scale street art murals, active traditional fishing trawlers, and sunrise photography.",
    address: "Sassoon Dock Road, Colaba",
    location: { lat: 18.9135, lng: 72.8258 },
    distanceFromHotelKm: 1.25,
    walkingTimeMins: 16,
    drivingTimeMins: 5,
    rating: 4.7,
    reviewsCount: 540,
    priceLevel: "₹",
    priceRange: "Free Public Walk",
    openingHours: "6:00 AM – 7:00 PM · Best early morning",
    isOpenNow: true,
    highlights: ["Historic 1875 Clocktower", "Monumental Street Art Murals", "Sunrise Sea Photography", "Maritime Heritage"],
    image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=800",
    phone: "+91 (022) 2282-1200",
    featured: false
  }
];

class LocationService {
  constructor() {
    this.hotel = HOTEL_LOCATION;
  }

  getHotelInfo() {
    return this.hotel;
  }

  /**
   * Calculate distance between two coordinates using the Haversine formula (in km)
   */
  calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;
    return Math.round(distanceKm * 100) / 100;
  }

  /**
   * Estimate walking time (assumes 4.8 km/h pedestrian pace)
   */
  estimateWalkingTimeMins(distanceKm) {
    return Math.max(1, Math.round((distanceKm / 4.8) * 60));
  }

  /**
   * Estimate driving time (assumes 25 km/h urban pace + 1 min buffer)
   */
  estimateDrivingTimeMins(distanceKm) {
    return Math.max(1, Math.round((distanceKm / 25) * 60 + 1));
  }

  /**
   * Generate Google Maps navigation link
   */
  generateGoogleMapsUrl(place, originCoords = null) {
    const origin = originCoords
      ? `${originCoords.lat},${originCoords.lng}`
      : `${this.hotel.lat},${this.hotel.lng}`;
    const destination = place.location
      ? `${place.location.lat},${place.location.lng}`
      : encodeURIComponent(`${place.name}, ${place.address}`);
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`;
  }

  /**
   * Ensure curated places are loaded into MongoDB, or return in-memory dataset
   */
  async ensurePlacesSeeded() {
    try {
      const count = await NearbyPlace.countDocuments();
      if (count === 0) {
        console.log("Seeding initial curated nearby places into database...");
        const placesWithUrls = CURATED_PLACES.map((p) => ({
          ...p,
          googleMapsUrl: this.generateGoogleMapsUrl(p)
        }));
        await NearbyPlace.insertMany(placesWithUrls);
        console.log(`✓ Seeded ${placesWithUrls.length} nearby places.`);
      }
    } catch (err) {
      console.warn("Notice checking nearby places collection:", err.message);
    }
  }

  /**
   * Retrieve nearby places with optional filters and real-time distance from user
   */
  async getNearbyPlaces({ category, search, maxDistance, userLat, userLng }) {
    let places = [];
    try {
      await this.ensurePlacesSeeded();
      const filter = {};
      if (category && category !== "all") {
        filter.category = category;
      }
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          { highlights: { $regex: search, $options: "i" } }
        ];
      }
      places = await NearbyPlace.find(filter).lean();
    } catch (e) {
      // In-memory fallback if Mongo query has issues
      places = [...CURATED_PLACES];
      if (category && category !== "all") {
        places = places.filter((p) => p.category === category);
      }
      if (search) {
        const s = search.toLowerCase();
        places = places.filter(
          (p) =>
            p.name.toLowerCase().includes(s) ||
            p.description.toLowerCase().includes(s) ||
            p.highlights.some((h) => h.toLowerCase().includes(s))
        );
      }
    }

    const hasUserLocation =
      userLat !== undefined &&
      userLng !== undefined &&
      !isNaN(userLat) &&
      !isNaN(userLng);

    // Compute live distance if user coordinates provided
    const enriched = places.map((place) => {
      let distanceFromHotelKm = place.distanceFromHotelKm;
      let distanceFromUserKm = null;
      let walkingFromUserMins = null;

      if (hasUserLocation && place.location) {
        distanceFromUserKm = this.calculateHaversineDistance(
          userLat,
          userLng,
          place.location.lat,
          place.location.lng
        );
        walkingFromUserMins = this.estimateWalkingTimeMins(distanceFromUserKm);
      }

      return {
        ...place,
        distanceFromHotelKm,
        walkingTimeMins: place.walkingTimeMins || this.estimateWalkingTimeMins(distanceFromHotelKm),
        drivingTimeMins: place.drivingTimeMins || this.estimateDrivingTimeMins(distanceFromHotelKm),
        distanceFromUserKm,
        walkingFromUserMins,
        googleMapsUrl: this.generateGoogleMapsUrl(
          place,
          hasUserLocation ? { lat: userLat, lng: userLng } : null
        )
      };
    });

    // Apply max distance filter if specified
    let result = enriched;
    if (maxDistance && !isNaN(maxDistance)) {
      const max = Number(maxDistance);
      result = result.filter((p) => {
        const d = p.distanceFromUserKm !== null ? p.distanceFromUserKm : p.distanceFromHotelKm;
        return d <= max;
      });
    }

    // Sort by proximity
    result.sort((a, b) => {
      const distA = a.distanceFromUserKm !== null ? a.distanceFromUserKm : a.distanceFromHotelKm;
      const distB = b.distanceFromUserKm !== null ? b.distanceFromUserKm : b.distanceFromHotelKm;
      return distA - distB;
    });

    return result;
  }
}

module.exports = new LocationService();

