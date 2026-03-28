import Document from "../models/Document.js";
import { getEmbedding } from "./embeddingService.js";

//  cosine similarity function
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export const findRelevantDocs = async (query) => {
  try {
    console.log(" Query:", query);

    //  Get embedding of query
    const queryEmbedding = await getEmbedding(query);

    //  Fetch all documents
    const docs = await Document.find();

    if (!docs.length) {
      console.log(" No documents found in DB");
      return "";
    }

    // Calculate similarity scores
    const scored = docs.map(doc => {
      const score = cosineSimilarity(queryEmbedding, doc.embedding);
      return {
        content: doc.content,
        score,
      };
    });

    //  Sort by highest similarity
    scored.sort((a, b) => b.score - a.score);

    //  Take top 3 + limit size (IMPORTANT FIX)
    const topDocs = scored.slice(0, 3).map((d) => ({
      content: d.content.slice(0, 300), // limit length
      score: d.score,
    }));

    console.log(" Top RAG Docs:", topDocs);

    //  Format with sources
    const formatted = topDocs
      .map((doc, i) => `[Source ${i + 1}]: ${doc.content}`)
      .join("\n\n");

    return formatted;

  } catch (error) {
    console.error("❌ RAG SEARCH ERROR:", error);
    return "";
  }
};