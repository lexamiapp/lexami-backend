import fs from "fs";
import Analysis from "../models/Analysis.js";
import { findRelevantDocs } from "../services/searchService.js";
import { callAI } from "../services/aiService.js";

// Legacy stub — kept so the file still compiles; real calls go through aiService
const callGeminiWithFallback = async (prompt, attachments, apiKey) => {
  // Current valid models in priority order (fastest → most capable)
  const models = [
    "models/gemini-2.0-flash",
    "models/gemini-1.5-flash",
    "models/gemini-2.0-flash-lite",
    "models/gemini-1.5-flash-latest",
  ];

  const MAX_RETRIES = 2;

  for (const model of models) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Trying ${model} (Attempt ${attempt})`);

        const controller = new AbortController();
        // 25s timeout — free-tier Gemini can take up to 20s for complex prompts
        const timeout = setTimeout(() => controller.abort(), 25000);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: prompt },
                    ...attachments,
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.5,
                maxOutputTokens: 8192,
                topP: 0.9,
              },
            }),
          }
        );

        clearTimeout(timeout);

        // Handle HTTP-level errors before parsing body
        if (!response.ok) {
          let errBody = {};
          try { errBody = await response.json(); } catch (_) { /* ignore */ }
          const errMsg = errBody?.error?.message || `HTTP ${response.status}`;
          console.log(`❌ ${model} HTTP error: ${errMsg}`);
          // 429 = quota/rate-limit, 503 = overloaded → try next model
          // 400 with "quota" in message → also skip
          if ([429, 503].includes(response.status) || errMsg.toLowerCase().includes('quota')) {
            break; // break inner retry loop, try next model
          }
          // 404 = model not found → skip to next model immediately
          if (response.status === 404) break;
          // 400 bad request with non-quota error → retry once then skip
          continue;
        }

        const data = await response.json();

        // Check for API-level error in successful HTTP response
        if (data?.error) {
          console.log(`❌ ${model} API error: ${data.error.message}`);
          break;
        }

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 30) {
          console.log(`✅ Success with ${model}`);
          return text;
        }

        console.log(`⚠️ ${model} returned empty/short response`);

      } catch (error) {
        const isTimeout = error.name === 'AbortError';
        console.log(`❌ ${model} failed (Attempt ${attempt}): ${isTimeout ? 'TIMEOUT' : error.message}`);
        if (!isTimeout) await new Promise(r => setTimeout(r, 800));
      }
    }
  }

  // 🔥 FINAL FALLBACK (NEVER FAIL)
  return `⚠️ AI is currently busy. Please try again in a few moments.\n\nBasic steps while waiting:\n- Gather all relevant documents\n- Note key dates and facts\n- Consult a qualified lawyer for urgent matters`;
};

// 🔥 FILE PROCESSING (PDF + IMAGE)
const extractTextFromFiles = async (files, pdf) => {
  let documentText = "";
  const attachments = [];

  for (const file of files) {
    try {
      const data = fs.readFileSync(file.path);

      // 📄 PDF → extract text
      if (file.mimetype === "application/pdf") {
        const pdfData = await pdf(data);
        documentText += "\n\n[PDF]\n" + pdfData.text.slice(0, 1000);
      }

      // 🖼️ IMAGE → send to Gemini
      else if (
        file.mimetype === "image/jpeg" ||
        file.mimetype === "image/png" ||
        file.mimetype === "image/webp"
      ) {
        attachments.push({
          inlineData: {
            data: data.toString("base64"),
            mimeType: file.mimetype,
          },
        });
      }

    } catch (err) {
      console.error("File processing error:", err);
    }
  }

  return { documentText, attachments };
};

// 🔥 MAIN CONTROLLER
export const analyzeCase = async (req, res) => {
  try {
    const { caseType, summary } = req.body;
    const files = req.files || [];

    const apiKey = process.env.GEMINI_API_KEY;

    // 🔥 IMPORT PDF PARSER (FIXED)
    const pdfModule = await import("pdf-parse");
    const pdf = pdfModule.default || pdfModule;

    // 🔥 FILE PROCESSING
    const { documentText, attachments } =
      await extractTextFromFiles(files, pdf);

    // 🔥 RAG (optional)
    const relevantDocs = await findRelevantDocs(summary);

    // 🔥 PROMPT (OPTIMIZED)
    const prompt = `

You are a highly experienced Indian legal advisor AI.

Your job is to analyze a legal case with:
- Accurate legal reasoning
- Relevant Indian law references
- Clear risks and actionable advice

-----------------------------------
📌 USER INPUT
-----------------------------------
Case Type: ${caseType}

Case Summary:
${summary}

Documents:
${documentText}

Context:
${relevantDocs}

-----------------------------------
📌 INSTRUCTIONS (STRICT)
-----------------------------------

1. Use Indian legal framework (IPC, CrPC, Evidence Act, Family Law, etc.)
2. Cite relevant laws/sections wherever possible
3. If unsure, say "Possible applicable laws include..."
4. Do NOT hallucinate fake sections or cases
5. Highlight both strengths and weaknesses
6. Clearly state assumptions if info is incomplete
7. Provide practical next steps
8. Estimate confidence level of your analysis (0–100%)

-----------------------------------
📌 OUTPUT FORMAT (MANDATORY)
-----------------------------------

## 🧾 Case Summary
- Brief restatement

## ⚖️ Legal Issues Identified
- Key legal concerns

## 📚 Applicable Laws & Citations
- Mention specific Indian laws/sections
- Example:
  - IPC Section 498A (Cruelty)
  - Domestic Violence Act, 2005
- If uncertain:
  - "Possible applicable laws include..."

## 🔍 Legal Analysis
- Logical explanation of situation
- Mention both sides if applicable

## ⚠️ Risks & Challenges
- Weak evidence
- Legal risks
- Opponent's arguments

## ✅ Recommended Next Steps
- Step-by-step actions

## 💰 Cost & Time Estimate (India)
- Rough realistic range

## 👨‍⚖️ When to Consult a Lawyer
- Clear urgency guidance

## 📊 Confidence Score
- Provide a score from 0 to 100%
- Explain briefly why (data completeness, clarity, etc.)

-----------------------------------
📌 STYLE
-----------------------------------
- Clear, structured, and professional
- Simple language (non-lawyers)
- No unnecessary verbosity
If the response is long, continue writing until fully complete. Do NOT stop midway.
`;

    // 🔥 AI CALL — 3-tier cascade: Groq → Gemini 2.0 Flash → Gemini 2.5 Flash
    const { text: aiResult, provider } = await callAI(prompt, attachments, apiKey);
    console.log(`✅ Response from provider: ${provider}`);

    // 🔥 CLEANUP FILES (before DB save so files are freed even if DB fails)
    for (const file of files) {
      try { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {}
    }

    // 🔥 SAVE TO DB (non-blocking — don't let a DB error kill the response)
    let savedId = null;
    try {
      const saved = await Analysis.create({ caseType, summary, result: aiResult });
      savedId = saved._id;
    } catch (dbErr) {
      console.error("⚠️ DB save failed (response still sent):", dbErr.message);
    }

    res.json({
      success: true,
      analysisId: savedId,
      result: aiResult,
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);

    res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
    });
  }
};