import fs from "fs";
import Analysis from "../models/Analysis.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
Case Type: {caseType}

Case Summary:
{summary}

Extracted Document Content:
{documentText}

Voice Input:
{voiceText}

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
Case Type: ${caseType}

User Summary:
${summary}

Analyze this case in structured legal format.
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

    // 🔹 Gemini setup
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
    });

    // 🔹 Send to Gemini
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            ...attachments,
          ],
        },
      ],
    });

    const aiResult = result.response.text();

    // 🔹 Save to MongoDB
    const saved = await Analysis.create({
      caseType,
      summary,
      result: aiResult,
    });

    // 🔹 Cleanup uploaded files (important)
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