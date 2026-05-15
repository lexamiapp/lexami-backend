import mongoose from "mongoose";

const docSchema = new mongoose.Schema({
  content:   { type: String, required: true },
  embedding: { type: [Number], required: true },

  // Citation metadata — shown to users in the AI response
  metadata: {
    title:    { type: String, default: "" },   // "Sharma vs Sharma"
    court:    { type: String, default: "" },   // "Supreme Court", "Delhi HC"
    year:     { type: Number, default: null }, // 2023
    caseNo:   { type: String, default: "" },   // "Civil Appeal 1234/2023"
    sections: { type: [String], default: [] }, // ["IPC 498A", "DV Act S.3"]
    source:   { type: String, default: "" },   // "IndianKanoon", "SCC"
    url:      { type: String, default: "" },   // Original link
  },

  // BM25 keyword field (plain text, indexed)
  keywords: { type: String, default: "" },

}, { timestamps: true });

// Text index for BM25-style keyword search
docSchema.index({ keywords: "text", "metadata.sections": "text" });

export default mongoose.model("Document", docSchema);