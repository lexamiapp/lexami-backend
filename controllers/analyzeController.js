import fs from "fs";
import Analysis from "../models/Analysis.js";
import { findRelevantDocs } from "../services/searchService.js";

//  Extract text from files (CHEAP + EFFICIENT)
const extractTextFromFiles = async (files) => {
  let text = "";

  for (const file of files) {
    try {
      if (file.mimetype === "application/pdf") {
        const dataBuffer = fs.readFileSync(file.path);
        const pdfData = await pdf(dataBuffer);

        text += "\n\n[DOCUMENT]\n" + pdfData.text.slice(0, 3000); // 🔥 limit size
      }
    } catch (err) {
      console.error("File processing error:", err);
    }
  }

  return text;
};

export const analyzeCase = async (req, res) => {
  try {
    const pdf = (await import("pdf-parse")).default;
    const { caseType, summary } = req.body;
    const files = req.files || [];

    if (!files || files.length === 0) {
    console.log("No files uploaded");
}

    console.log(" ANALYZE API HIT");

    //  Avoid empty embedding calls
    let relevantDocs = "";
    if (summary && summary.trim().length > 10) {
      relevantDocs = await findRelevantDocs(summary);
    }

    //  Extract file text instead of sending files
    const documentText = await extractTextFromFiles(files);

    //  LIMIT CONTEXT SIZE (VERY IMPORTANT)
    const trimmedDocs = relevantDocs.slice(0, 2000);

    //  OPTIMIZED PROMPT (LOW TOKENS + HIGH QUALITY)
    const prompt = `You are an expert Indian legal advisor.

Analyze the case using the given details.

-----------------------------------
CASE TYPE:
${caseType || "Not provided"}

CASE SUMMARY:
${summary || "Not provided"}

DOCUMENT CONTENT:
${documentText || "None"}

REFERENCE CONTEXT:
${trimmedDocs || "None"}
-----------------------------------

Provide structured response:

1. Case Summary  
2. Legal Issues  
3. Applicable Laws (India)  
4. Risks  
5. Recommended Actions  

Use simple language. Do not guarantee outcomes.
`;

    const apiKey = process.env.GEMINI_API_KEY;

    console.log(" CALLING GEMINI");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }], //  NO FILE ATTACHMENTS
            },
          ],
          generationConfig: {
            temperature: 0.6, 
            maxOutputTokens: 2048, 
          },
        }),
      }
    );

    const data = await response.json();

    console.log("GEMINI RESPONSE RECEIVED");

    let aiResult = "No response from AI";

    if (data?.candidates?.length > 0) {
      aiResult =
        data.candidates[0]?.content?.parts?.[0]?.text || aiResult;
    }

    if (data.error) {
      console.error("Gemini API Error:", data.error);
      aiResult = "AI failed: " + data.error.message;
    }

    //  SAVE RESULT
    const saved = await Analysis.create({
      caseType,
      summary,
      result: aiResult,
    });

    //  CLEANUP FILES
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