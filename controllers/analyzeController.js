import fs from "fs";
import Analysis from "../models/Analysis.js";

export const analyzeCase = async (req, res) => {
  try {
    const { caseType, summary } = req.body;
    const files = req.files || [];

    // 🔹 Build prompt
    const prompt = `You are an expert Indian legal advisor AI.

Your task is to analyze a user's legal case based on:
- Case type
- User-provided summary
- Uploaded documents (if any)
- Voice input transcript (if any)

You must provide a professional, accurate, and practical legal analysis.

-----------------------------------
📌 USER INPUT
-----------------------------------
Case Type: ${caseType}

Case Summary:
${summary}

-----------------------------------
📌 INSTRUCTIONS
-----------------------------------

1. Use simple language (non-lawyers should understand)
2. Follow Indian law context (IPC, CrPC, Family Law, etc.)
3. DO NOT give guarantees (like "you will win")
4. Clearly mention risks and uncertainties
5. Suggest actionable next steps
6. If data is incomplete, make reasonable assumptions and mention them

-----------------------------------
📌 OUTPUT FORMAT (STRICT)
-----------------------------------

## 🧾 Case Summary
Briefly restate the case in simple terms

## ⚖️ Legal Issues Identified
- List key legal issues

## 📚 Applicable Laws
- Mention relevant Indian laws / sections

## 🔍 Legal Analysis
Explain the situation logically and legally

## ⚠️ Risks & Challenges
Highlight possible problems or weak points

## ✅ Recommended Next Steps
Provide practical actions (e.g., file FIR, consult lawyer)

## 💰 Cost & Time Estimate (India)
Give rough estimate if possible

## 👨‍⚖️ When to Consult a Lawyer
Clearly state when professional legal help is required

-----------------------------------
📌 TONE
-----------------------------------
- Professional
- Helpful
- Clear
- Not overly verbose
`;

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

    // 🔥 🔥 LATEST GEMINI API (NO SDK)
    const apiKey = process.env.GEMINI_API_KEY;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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

    const aiResult =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response from AI";

    // 🔹 Save to MongoDB
    const saved = await Analysis.create({
      caseType,
      summary,
      result: aiResult,
    });

    // 🔹 Cleanup uploaded files
    for (const file of files) {
      fs.unlinkSync(file.path);
    }

    res.json({
      success: true,
      data: saved,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};