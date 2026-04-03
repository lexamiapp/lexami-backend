import fs from "fs";
import Analysis from "../models/Analysis.js";
import { findRelevantDocs } from "../services/searchService.js";

//  extract text from PDF
const extractTextFromFiles = async (files) => {
  let text = "";

  for (const file of files) {
    try {
      if (file.mimetype === "application/pdf") {
        const buffer = fs.readFileSync(file.path);
        const pdfData = await pdf(buffer);

        text += "\n\n[DOCUMENT]\n" + pdfData.text.slice(0, 2000);
      }
    } catch (err) {
      console.error("File error:", err);
    }
  }

  return text;
};

export const analyzeCaseStream = async (req, res) => {
  try {
    const pdfModule = await import("pdf-parse");
    const pdf = pdfModule.default || pdfModule;
    const caseType = req.body?.caseType || "";
    const summary = req.body?.summary || "";
    const files = req.files || [];

    console.log(" STREAM + FILE BACKEND HIT");

    const relevantDocs = await findRelevantDocs(summary);
    const documentText = await extractTextFromFiles(files);

    const prompt = `
You are an expert Indian legal advisor.

Case Type: ${caseType}
Case Summary: ${summary}

Documents:
${documentText}

Context:
${relevantDocs}

Give structured legal analysis.
`;

    const apiKey = process.env.GEMINI_API_KEY;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();

    let fullText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response";

    // STREAM HEADERS
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");

    // STREAM BY WORD
    const words = fullText.split(" ");

    for (let i = 0; i < words.length; i++) {
      res.write(words[i] + " ");
      await new Promise((r) => setTimeout(r, 15));
    }

    res.end();

    // SAVE RESULT
    await Analysis.create({
      caseType,
      summary,
      result: fullText,
    });

    // CLEAN FILES
    for (const file of files) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }

  } catch (error) {
    console.error("STREAM ERROR:", error);
    res.status(500).end("Error: " + error.message);
  }
};