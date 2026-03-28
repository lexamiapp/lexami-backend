import Document from "../models/Document.js";
import { getEmbedding } from "./embeddingService.js";

export const findRelevantDocs = async (query) => {
  const queryEmbedding = await getEmbedding(query);

  const docs = await Document.find();

  // 🔥 Calculate similarity
  const scored = docs.map(doc => {
    const score = cosineSimilarity(queryEmbedding, doc.embedding);
    return { ...doc._doc, score };
  });

  // 🔥 Sort by best match
  scored.sort((a, b) => b.score - a.score);

  // 🔥 Take top 3
  const topDocs = scored.slice(0, 3);
  content: doc.content.slice(0, 300);

  console.log("Top RAG Docs:", topDocs.length);

  // 🔥 Add source labels (IMPORTANT)
  return topDocs
    .map((doc, i) => `[Source ${i + 1}]: ${doc.content}`)
    .join("\n\n");
};

// cosine similarity
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}