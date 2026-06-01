/**
 * AI Service — 3-tier cascade for zero-downtime AI calls
 *
 * Tier 1: Groq  (free 1000 req/day, 30 RPM — fastest, ~350ms avg)
 * Tier 2: Gemini 2.0 Flash paid (no rate limit, 25s timeout)
 * Tier 3: Gemini 2.5 Flash paid (best quality, last resort)
 *
 * Monthly cost for 100 active users (10 calls/day each):
 *   - Groq free tier covers the first 1000 calls/day → $0
 *   - Overflow to Gemini paid: $0.10/1M input + $0.40/1M output
 *   - Worst case (all paid Gemini): ~$15/month
 */

import Groq from "groq-sdk";

// ─── Groq client ─────────────────────────────────────────────────────────────
let _groqClient = null;
const getGroq = () => {
  if (!_groqClient && process.env.GROQ_API_KEY) {
    _groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groqClient;
};

// ─── Tier 1: Groq ─────────────────────────────────────────────────────────────
const callGroq = async (prompt) => {
  const groq = getGroq();
  if (!groq) throw new Error("GROQ_API_KEY not set");

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",   // Best Groq model for reasoning
    messages: [{ role: "user", content: prompt }],
    max_tokens: 8192,
    temperature: 0.5,
  });

  const text = completion.choices?.[0]?.message?.content;
  if (!text || text.trim().length < 30) throw new Error("Groq returned empty response");
  return text;
};

// ─── Tier 2 & 3: Gemini REST ──────────────────────────────────────────────────
const callGemini = async (model, prompt, attachments, apiKey, timeoutMs = 25000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }, ...attachments] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 8192, topP: 0.9 },
      }),
    }
  );
  clearTimeout(timer);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Gemini ${response.status}: ${err?.error?.message || "HTTP error"}`);
  }

  const data = await response.json();
  if (data?.error) throw new Error(`Gemini API error: ${data.error.message}`);

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || text.trim().length < 30) throw new Error("Gemini returned empty response");
  return text;
};

// ─── Main export: 3-tier cascade ─────────────────────────────────────────────
/**
 * Calls AI providers in order until one succeeds.
 * @param {string} prompt - The full prompt string
 * @param {Array}  attachments - Gemini inline image/PDF parts (can be empty)
 * @param {string} geminiKey - Gemini API key from env
 * @returns {Promise<{text: string, provider: string}>}
 */
export const callAI = async (prompt, attachments = [], geminiKey) => {
  const errors = [];

  // ── Tier 1: Groq (free, fastest) ─────────────────────────────────────────
  try {
    console.log("🚀 AI Tier 1: Groq llama-3.3-70b");
    const text = await callGroq(prompt);
    console.log("✅ Groq success");
    return { text, provider: "groq" };
  } catch (e) {
    const msg = e.message || String(e);
    console.log(`⚠️  Groq failed: ${msg.slice(0, 80)}`);
    errors.push(`Groq: ${msg}`);
    // Groq 429 = daily limit exhausted → fall through to Gemini
  }

  // ── Tier 2: Gemini 1.5 Flash (Most reliable fallback) ────────────────────
  if (geminiKey) {
    try {
      console.log("🚀 AI Tier 2: Gemini 1.5 Flash");
      const text = await callGemini("models/gemini-1.5-flash", prompt, attachments, geminiKey, 25000);
      console.log("✅ Gemini 1.5 Flash success");
      return { text, provider: "gemini-1.5-flash" };
    } catch (e) {
      const msg = e.message || String(e);
      console.log(`⚠️  Gemini 1.5 Flash failed: ${msg.slice(0, 80)}`);
      errors.push(`Gemini-1.5-Flash: ${msg}`);
    }

    // ── Tier 3: Gemini 1.5 Pro (High capability, last resort) ───────────────
    try {
      console.log("🚀 AI Tier 3: Gemini 1.5 Pro");
      const text = await callGemini("models/gemini-1.5-pro", prompt, attachments, geminiKey, 35000);
      console.log("✅ Gemini 1.5 Pro success");
      return { text, provider: "gemini-1.5-pro" };
    } catch (e) {
      const msg = e.message || String(e);
      console.log(`⚠️  Gemini 1.5 Pro failed: ${msg.slice(0, 80)}`);
      errors.push(`Gemini-1.5-Pro: ${msg}`);
    }

    // ── Tier 4: Gemini 2.0 Flash Exp (Experimental) ──────────────────────────
    try {
      console.log("🚀 AI Tier 4: Gemini 2.0 Flash Exp");
      const text = await callGemini("models/gemini-2.0-flash-exp", prompt, attachments, geminiKey, 25000);
      console.log("✅ Gemini 2.0 Flash success");
      return { text, provider: "gemini-2.0-flash" };
    } catch (e) {
      const msg = e.message || String(e);
      console.log(`⚠️  Gemini 2.0 Flash failed: ${msg.slice(0, 80)}`);
      errors.push(`Gemini-2.0-Flash: ${msg}`);
    }
  }

  // ── All tiers failed ──────────────────────────────────────────────────────
  console.error("❌ All AI tiers failed:", errors);
  return {
    text: "⚠️ AI is momentarily unavailable. Please try again in a minute.\n\nAll providers attempted:\n" + errors.map(e => `• ${e}`).join("\n"),
    provider: "none",
  };
};
