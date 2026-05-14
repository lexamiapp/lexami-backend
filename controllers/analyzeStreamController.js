import fs from "fs";
import Analysis from "../models/Analysis.js";
import { findRelevantDocs } from "../services/searchService.js";
import { callAI } from "../services/aiService.js";

// ─── PDF helper (imported once at module level) ──────────────────────────────
// We lazy-import pdf-parse inside the exported handler (same pattern as analyzeController)
// BUT we pass the `pdf` function down so extractTextFromFiles can use it.

const extractTextFromFiles = async (files, pdf) => {
  let text = "";

  for (const file of files) {
    try {
      if (file.mimetype === "application/pdf") {
        const buffer = fs.readFileSync(file.path);
        const pdfData = await pdf(buffer);          // ✅ pdf is now in scope
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
    // ✅ Import pdf-parse once, pass it to the helper
    const pdfModule = await import("pdf-parse");
    const pdf = pdfModule.default || pdfModule;

    const caseType = req.body?.caseType || "";
    const summary  = req.body?.summary  || "";
    const files    = req.files || [];

    console.log("STREAM + FILE BACKEND HIT");

    const relevantDocs   = await findRelevantDocs(summary);
    const documentText   = await extractTextFromFiles(files, pdf);   // ✅ pass pdf

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

    // 3-tier AI cascade: Groq → Gemini 2.0 Flash → Gemini 2.5 Flash
    const { text: fullText, provider } = await callAI(prompt, [], apiKey);
    console.log(`Stream: provider = ${provider}`);

    // ─── Stream headers ──────────────────────────────────────────────────────
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("X-Content-Type-Options", "nosniff");

    // ─── Stream word-by-word ─────────────────────────────────────────────────
    const words = fullText.split(" ");
    for (let i = 0; i < words.length; i++) {
      res.write(words[i] + " ");
      await new Promise((r) => setTimeout(r, 15));
    }

    res.end();

    // ─── Persist to DB (non-blocking — don't crash the stream response) ─────────
    Analysis.create({ caseType, summary, result: fullText }).catch(e =>
      console.error("⚠️ Stream DB save failed:", e.message)
    );

    // ─── Cleanup uploaded files ───────────────────────────────────────────────
    for (const file of files) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }

  } catch (error) {
    console.error("STREAM ERROR:", error);
    if (!res.headersSent) {
      res.status(500).end("Error: " + error.message);
    }
  }
};