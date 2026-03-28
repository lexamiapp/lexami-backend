import fs from "fs";
import Analysis from "../models/Analysis.js";

export const analyzeCase = async (req, res) => {
  try {
    const { caseType, summary } = req.body;
    const files = req.files || [];

    // 🔥 Build prompt safely
    const prompt = `You are an expert Indian legal advisor AI.

Analyze the following case:

Case Type: ${caseType || "Not provided"}

Case Summary:
${summary || "Not provided"}

Give structured legal analysis in simple language with:
- Legal issues
- Applicable laws
- Risks
- Next steps
`;

    console.log("PROMPT:", prompt);

    // 🔹 Convert files to Gemini format
    const attachments = [];

    for (const file of files) {
      const data = fs.readFileSync(file.path);

      attachments.push({
        inlineData: {
          data: data.toString("base64"),
          mimeType: file.mimetype,
        },
      });
    }

    // USE v1beta (IMPORTANT FIX)
    const apiKey = process.env.GEMINI_API_KEY;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    const data = await response.json();

    console.log("GEMINI RESPONSE:", JSON.stringify(data, null, 2));

    //  BETTER RESPONSE HANDLING
    let aiResult = "No response from AI";

    if (data?.candidates?.length > 0) {
      aiResult = data.candidates[0]?.content?.parts?.[0]?.text || aiResult;
    }

    //  HANDLE API ERRORS
    if (data.error) {
      console.error("Gemini API Error:", data.error);
      aiResult = "AI failed: " + data.error.message;
    }

    //  Save to MongoDB
    const saved = await Analysis.create({
      caseType,
      summary,
      result: aiResult,
    });

    //  Cleanup uploaded files
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