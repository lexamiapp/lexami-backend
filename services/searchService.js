/**
 * RAG Search Service — Production Grade
 *
 * Strategy:
 *   1. Parallel hybrid search: Atlas Vector Search + MongoDB full-text (BM25)
 *   2. Merge + deduplicate results
 *   3. Rerank with Cohere (free 10K calls/month) — falls back to vector score
 *   4. Return top-5 chunks with citation metadata
 */

import Document from "../models/Document.js";
import { getEmbedding } from "./embeddingService.js";

// ─── In-process embedding cache (survives restarts via Map, cheap to rebuild) ─
const embeddingCache = new Map();
const CACHE_MAX = 500;

const getCachedEmbedding = async (query) => {
  if (embeddingCache.has(query)) return embeddingCache.get(query);
  const vec = await getEmbedding(query);
  if (embeddingCache.size >= CACHE_MAX) {
    // evict oldest entry
    embeddingCache.delete(embeddingCache.keys().next().value);
  }
  embeddingCache.set(query, vec);
  return vec;
};

// ─── Atlas Vector Search ───────────────────────────────────────────────────────
const vectorSearch = async (embedding, limit = 15) => {
  try {
    const results = await Document.aggregate([
      {
        $vectorSearch: {
          index: "vector_index",           // name you gave in Atlas UI
          path: "embedding",
          queryVector: embedding,
          numCandidates: limit * 10,       // oversample for quality
          limit,
        },
      },
      {
        $project: {
          _id: 1,
          content: 1,
          metadata: 1,
          vectorScore: { $meta: "vectorSearchScore" },
        },
      },
    ]);
    return results;
  } catch (err) {
    // Atlas Vector Search not yet configured → fall back to in-memory cosine
    console.warn("⚠️  Atlas Vector Search unavailable, using fallback cosine");
    return vectorSearchFallback(embedding, limit);
  }
};

// ─── Fallback: in-memory cosine (when Atlas Vector Search not set up) ─────────
const vectorSearchFallback = async (embedding, limit = 15) => {
  const docs = await Document.find({}, "content metadata embedding").limit(200).lean();
  return docs
    .filter(d => d.embedding?.length)
    .map(d => ({ ...d, vectorScore: cosineSimilarity(embedding, d.embedding) }))
    .sort((a, b) => b.vectorScore - a.vectorScore)
    .slice(0, limit);
};

// ─── BM25-style keyword search via MongoDB text index ─────────────────────────
const keywordSearch = async (query, limit = 10) => {
  try {
    return await Document.find(
      { $text: { $search: query } },
      { content: 1, metadata: 1, keywordScore: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(limit)
      .lean();
  } catch {
    return [];
  }
};

// ─── Cohere reranker ──────────────────────────────────────────────────────────
const rerankWithCohere = async (query, docs) => {
  const cohereKey = process.env.COHERE_API_KEY;
  if (!cohereKey || docs.length === 0) return docs;

  try {
    const res = await fetch("https://api.cohere.com/v1/rerank", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cohereKey}`,
      },
      body: JSON.stringify({
        model: "rerank-english-v3.0",
        query,
        documents: docs.map(d => d.content.slice(0, 1000)),
        top_n: 5,
        return_documents: false,
      }),
    });

    if (!res.ok) throw new Error(`Cohere ${res.status}`);
    const data = await res.json();

    return data.results.map(r => ({
      ...docs[r.index],
      rerankScore: r.relevance_score,
    }));
  } catch (err) {
    console.warn(`⚠️  Cohere rerank failed: ${err.message} — using vector scores`);
    return docs.slice(0, 5);
  }
};

// ─── Merge & deduplicate results from both searches ───────────────────────────
const mergeResults = (vectorDocs, keywordDocs) => {
  const seen = new Set();
  const merged = [];

  for (const doc of [...vectorDocs, ...keywordDocs]) {
    const id = String(doc._id);
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(doc);
    }
  }
  return merged;
};

// ─── Format a chunk with citation for the AI prompt ───────────────────────────
const formatChunkWithCitation = (doc, index) => {
  const m = doc.metadata || {};
  const citation = [
    m.court,
    m.caseNo,
    m.year,
    m.sections?.length ? `[${m.sections.join(", ")}]` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const header = citation
    ? `[Source ${index + 1} — ${citation}]`
    : `[Source ${index + 1}]`;

  return `${header}\n${doc.content.slice(0, 1500)}`;
};

// ─── Main export ──────────────────────────────────────────────────────────────
export const findRelevantDocs = async (query) => {
  try {
    if (!query || query.trim().length < 10) return "";

    // 1. Parallel: vector search + keyword search
    const embedding = await getCachedEmbedding(query.trim());
    const [vectorDocs, keywordDocs] = await Promise.all([
      vectorSearch(embedding, 15),
      keywordSearch(query, 10),
    ]);

    if (vectorDocs.length === 0 && keywordDocs.length === 0) {
      console.log("RAG: no documents in DB yet");
      return "";
    }

    // 2. Merge + deduplicate
    const merged = mergeResults(vectorDocs, keywordDocs);

    // 3. Rerank (top-5 out of merged)
    const reranked = await rerankWithCohere(query, merged);

    // 4. Format with citations
    const formatted = reranked
      .slice(0, 5)
      .map((doc, i) => formatChunkWithCitation(doc, i));

    console.log(`RAG: returning ${formatted.length} chunks (vector:${vectorDocs.length} keyword:${keywordDocs.length})`);
    return formatted.join("\n\n---\n\n");

  } catch (err) {
    console.error("RAG SEARCH ERROR:", err);
    return "";
  }
};

// ─── Cosine similarity (fallback only) ───────────────────────────────────────
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}
