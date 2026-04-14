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
You are an expert Indian legal advisor.

Case Type: ${caseType || "Not provided"}
Summary: ${summary || "Not provided"}

Documents:
${documentText}

Context:
${relevantDocs}

Provide:
- Key issues
- Applicable laws
- Risks
- Next steps
- Success probability (%)

Keep response concise.
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