import fs from "fs";
import Analysis from "../models/Analysis.js";
import { findRelevantDocs } from "../services/searchService.js";

// 🔥 FAIL-PROOF GEMINI CALL
const callGeminiWithFallback = async (prompt, attachments, apiKey) => {
  const models = [
    "models/gemini-2.5-flash",
    "models/gemini-2.0-flash",
    "models/gemini-2.5-flash-lite"
  ];

  const MAX_RETRIES = 2;

  for (const model of models) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Trying ${model} (Attempt ${attempt})`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: prompt },
                    ...attachments // 🔥 images support
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.5,
                maxOutputTokens: 10000,
                topP: 0.9,
              },
            }),
          }
        );

        clearTimeout(timeout);

        const data = await response.json();

        if (data?.candidates?.length > 0) {
          const text = data.candidates[0]?.content?.parts?.[0]?.text;

          if (text && text.trim().length > 50) {
            console.log(`✅ Success with ${model}`);
            return text;
          }
        }

      } catch (error) {
        console.log(`❌ ${model} failed (Attempt ${attempt}):`, error.message);
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  // 🔥 FINAL FALLBACK (NEVER FAIL)
  return `
⚠️ AI is currently busy.

Basic Advice:
- Check your case details carefully
- Gather proper evidence
- Consult a legal professional

Try again in a few seconds.
`;
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

    // 🔥 AI CALL (FAIL-PROOF)
    const aiResult = await callGeminiWithFallback(
      prompt,
      attachments,
      apiKey
    );

    // 🔥 SAVE TO DB
    const saved = await Analysis.create({
      caseType,
      summary,
      result: aiResult,
    });

    // 🔥 CLEANUP FILES
    for (const file of files) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }

    res.json({
      success: true,
      data: saved,
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);

    res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
    });
  }
};