const { GoogleGenAI } = require("@google/genai");

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
    this.modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    this.client = null;

    if (this.apiKey && this.apiKey !== "your_gemini_api_key_here" && this.apiKey !== "your_api_key_here") {
      try {
        this.client = new GoogleGenAI({ apiKey: this.apiKey });
        console.log(`✓ Google Gemini API initialized with model: ${this.modelName}`);
      } catch (err) {
        console.warn("Notice initializing Google Gemini client:", err.message);
      }
    }
  }

  isConfigured() {
    return Boolean(this.client);
  }

  getModelName() {
    return this.modelName;
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      model: this.modelName,
      provider: "Google Gemini",
      features: [
        "Real-Time Multimodal Reasoning",
        "Grounded Hotel Concierge",
        "Local Places & Cafe Recommendations",
        "Live Distance & Navigation Advice"
      ]
    };
  }

  /**
   * Core text generation with Google Gemini
   */
  async generateContent({ systemInstruction, prompt, temperature = 0.3, jsonMode = false }) {
    if (!this.client) {
      return null;
    }

    try {
      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction || undefined,
          temperature,
          responseMimeType: jsonMode ? "application/json" : undefined
        }
      });

      const text = response.text ? response.text.trim() : "";
      if (jsonMode) {
        try {
          return JSON.parse(text);
        } catch {
          const cleaned = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
          return JSON.parse(cleaned);
        }
      }

      return text;
    } catch (err) {
      console.warn("Google Gemini API call failed:", err.message);
      return null;
    }
  }

  /**
   * Specialized Gemini Local Guide Recommender
   */
  async generateNearbyGuide({ query, category, userLocation, places = [], hotelInfo = {} }) {
    const placesSummary = places.map((p) => ({
      name: p.name,
      category: p.categoryLabel || p.category,
      distanceFromHotel: `${p.distanceFromHotelKm} km (${p.walkingTimeMins} min walk)`,
      rating: p.rating,
      price: p.priceRange || p.priceLevel,
      hours: p.openingHours,
      highlights: p.highlights,
      description: p.description
    }));

    const systemInstruction = `You are StayEase Luxury Hotel's Local Heritage & Neighborhood Guide, powered by Google Gemini.
You provide sophisticated, authentic, and highly practical local recommendations for guests seeking nearby cafes, boutiques, fine dining, and cultural gems in the immediate historic waterfront district.
Hotel Location: ${hotelInfo.name || "StayEase Luxury Heritage Hotel"}, ${hotelInfo.address || "Apollo Bunder, Colaba, Mumbai"}.
Always maintain an inviting, cultured, and knowledgeable luxury hospitality tone.
Provide specific walking times, what to order or look out for, best visiting hours, and insider local tips.`;

    const prompt = `Guest inquiry: "${query || "What are the best cafes and shops nearby for an afternoon stroll?"}"
Category Filter: ${category || "all"}
Guest Live Distance from Hotel: ${userLocation && userLocation.distanceFromHotel ? userLocation.distanceFromHotel + " km" : "At Hotel Grounds"}
Curated Local Places Inventory:
${JSON.stringify(placesSummary, null, 2)}

Please deliver:
1. A warm, bespoke recommendation highlighting 2 to 4 of the most suitable spots from the inventory matching their request.
2. Insider tips (e.g. signature items to order, photography spots, peak timings).
3. Clear walking directions and approximate time from StayEase Hotel.`;

    const geminiReply = await this.generateContent({
      systemInstruction,
      prompt,
      temperature: 0.4
    });

    if (geminiReply) {
      return {
        reply: geminiReply,
        source: "gemini",
        model: this.modelName
      };
    }

    // Grounded fallback if Gemini key is not configured or offline
    return this.generateGroundedFallbackGuide({ query, category, places });
  }

  /**
   * Grounded fallback response engine for local guide
   */
  generateGroundedFallbackGuide({ query = "", category = "all", places = [] }) {
    const lower = query.toLowerCase();
    let selected = places;

    if (category && category !== "all") {
      selected = places.filter((p) => p.category === category);
    } else if (lower.includes("coffee") || lower.includes("cafe") || lower.includes("croissant") || lower.includes("breakfast")) {
      selected = places.filter((p) => p.category === "cafe");
    } else if (lower.includes("shop") || lower.includes("silk") || lower.includes("jewelry") || lower.includes("curio") || lower.includes("gift")) {
      selected = places.filter((p) => p.category === "shop");
    } else if (lower.includes("dinner") || lower.includes("lunch") || lower.includes("food") || lower.includes("seafood") || lower.includes("eat")) {
      selected = places.filter((p) => p.category === "restaurant");
    } else if (lower.includes("culture") || lower.includes("museum") || lower.includes("gateway") || lower.includes("art") || lower.includes("historic")) {
      selected = places.filter((p) => p.category === "culture");
    }

    if (!selected.length) selected = places.slice(0, 3);

    const topSpots = selected.slice(0, 3);
    const recommendations = topSpots
      .map(
        (p) =>
          `• **${p.name}** (${p.categoryLabel || p.category}) — ${p.distanceFromHotelKm} km away (~${p.walkingTimeMins} min walk)\n  *Highlights*: ${p.highlights.join(", ")}\n  *Timing*: ${p.openingHours}\n  *Insider Note*: ${p.description}`
      )
      .join("\n\n");

    const reply = `Delighted to share our curated neighborhood recommendations around StayEase:\n\n${recommendations}\n\nAll of these verified destinations are within comfortable walking distance. You can view each spot's pin on our interactive map or click 'Directions' for live turn-by-turn navigation via Google Maps.`;

    return {
      reply,
      source: "grounded-engine",
      model: "StayEase Local Intelligence Engine"
    };
  }
}

module.exports = new GeminiService();

