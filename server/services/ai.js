const OpenAI = require("openai");

let client = null;
if (process.env.OPENAI_API_KEY) {
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function askAI({ message, language = "en", context = {} }) {
  if (!client) {
    return {
      reply: "AI is not configured yet. Add OPENAI_API_KEY to .env to enable the live concierge.",
      language
    };
  }

  const system = `
You are StayEase, a professional hotel AI concierge.
Answer naturally and concisely. Never invent room availability, prices, bookings,
hotel policies, or external facts. Use the supplied hotel context when available.
Reply in the requested language: ${language}.
If the guest asks to perform an action such as booking, cancellation, service request,
or spa reservation, explain the next step and use the application's available API
rather than claiming an action was completed.
Hotel context: ${JSON.stringify(context)}
`;

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-6-luna",
    instructions: system,
    input: message
  });

  return { reply: response.output_text, language };
}

async function analyzeReview(text) {
  if (!client) return { sentiment: "unavailable", themes: [] };

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-6-luna",
    instructions: "Analyze this hotel review. Return ONLY valid JSON with keys sentiment (positive|neutral|negative), themes (array of short strings), summary (short string).",
    input: text
  });

  try { return JSON.parse(response.output_text); }
  catch { return { sentiment: "neutral", themes: [], summary: response.output_text }; }
}

module.exports = { askAI, analyzeReview };
