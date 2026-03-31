import Document from "../models/Document.js";
import { getEmbedding } from "./embeddingService.js";

//SIMPLE CACHE (VERY IMPORTANT)
const embeddingCache = {};

//cosine similarity
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dot = 0,
    normA = 0,
    normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

export const findRelevantDocs = async (query) => {
  try {
    console.log("Query:", query);

    // SKIP EMBEDDING FOR SMALL INPUT (COST SAVING)
    if (!query || query.trim().length < 10) {
      console.log("Query too small, skipping RAG");
      return "";
    }

    // CACHE CHECK (BIG COST SAVER)
    let queryEmbedding;

    if (embeddingCache[query]) {
      console.log("Using cached embedding");
      queryEmbedding = embeddingCache[query];
    } else {
      console.log("Generating embedding...");
      queryEmbedding = await getEmbedding(query);
      embeddingCache[query] = queryEmbedding;
    }

    //  LIMIT DOCUMENTS FETCH (PERFORMANCE)
    const docs = await Document.find().limit(50); // instead of all

    if (!docs.length) {
      console.log(" No documents found");
      return "";
    }

    //  SCORE DOCUMENTS
    const scored = [];

    for (const doc of docs) {
      if (!doc.embedding) continue;

      const score = cosineSimilarity(queryEmbedding, doc.embedding);

      scored.push({
        content: doc.content,
        score,
      });
    }

    //  SORT
    scored.sort((a, b) => b.score - a.score);

    //  TAKE TOP 3 (LIMIT SIZE)
    const topDocs = scored.slice(0, 3).map((d, i) => {
      return `[Source ${i + 1}]: ${d.content.slice(0, 300)}`;
    });

    console.log("Top Docs Selected");

    return topDocs.join("\n\n");

  } catch (error) {
    console.error("RAG SEARCH ERROR:", error);
    return "";
  }
};