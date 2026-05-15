/**
 * Legal Document Ingestion Pipeline
 *
 * Sources supported:
 *   1. IndianKanoon API (paid) — set INDIANKANOON_API_KEY
 *   2. Local PDF files        — place in scripts/legal_pdfs/
 *   3. Manual JSON array      — see MANUAL_DOCS below
 *
 * Usage:
 *   node scripts/ingestLegalDocs.js
 *
 * Run once to seed the DB. Re-run anytime to add more documents.
 */

import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Document from "../models/Document.js";
import { getEmbedding } from "../services/embeddingService.js";
import dotenv from "dotenv";
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Chunking ─────────────────────────────────────────────────────────────────
const CHUNK_SIZE = 512;   // tokens ≈ characters / 4
const CHUNK_OVERLAP = 64;

const chunkText = (text, metadata) => {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let i = 0;

  while (i < words.length) {
    const chunk = words.slice(i, i + CHUNK_SIZE).join(" ");
    if (chunk.length > 100) {  // skip tiny chunks
      chunks.push({ content: chunk, metadata });
    }
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
};

// ─── Extract sections cited in text ─────────────────────────────────────────
const extractSections = (text) => {
  const patterns = [
    /Section\s+\d+[A-Z]?\s+(?:of\s+)?(?:IPC|CrPC|HMA|DV Act|Hindu Marriage Act|Evidence Act)/gi,
    /(?:IPC|CrPC|HMA)\s+(?:Section\s+|S\.?\s*)?\d+[A-Z]?/gi,
    /Article\s+\d+/gi,
  ];
  const found = new Set();
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      found.add(match[0].replace(/\s+/g, " ").trim());
    }
  }
  return [...found].slice(0, 10);
};

// ─── Ingest a single document (text + metadata) ──────────────────────────────
const ingestDocument = async (text, metadata) => {
  const chunks = chunkText(text, {
    ...metadata,
    sections: extractSections(text),
  });

  let inserted = 0;
  for (const chunk of chunks) {
    try {
      // Check if already ingested (by content hash)
      const exists = await Document.exists({ content: chunk.content });
      if (exists) continue;

      const embedding = await getEmbedding(chunk.content);

      await Document.create({
        content: chunk.content,
        embedding,
        metadata: chunk.metadata,
        keywords: chunk.content,  // for text index / BM25
      });

      inserted++;
      process.stdout.write(`\r  Chunks inserted: ${inserted}`);

      // Rate limit: Gemini embedding allows 1500 RPM on paid tier
      await new Promise(r => setTimeout(r, 50));
    } catch (err) {
      console.error(`\nChunk insert error: ${err.message}`);
    }
  }
  return inserted;
};

// ─── Source 1: IndianKanoon API ───────────────────────────────────────────────
const fetchFromIndianKanoon = async (query, maxDocs = 20) => {
  const apiKey = process.env.INDIANKANOON_API_KEY;
  if (!apiKey) {
    console.log("  Skipping IndianKanoon — INDIANKANOON_API_KEY not set");
    return [];
  }

  const docs = [];
  try {
    const res = await fetch(
      `https://api.indiankanoon.org/search/?formInput=${encodeURIComponent(query)}&pagenum=0`,
      { headers: { Authorization: `Token ${apiKey}` } }
    );
    const data = await res.json();
    for (const hit of (data.docs || []).slice(0, maxDocs)) {
      docs.push({
        text: hit.headline + "\n\n" + (hit.doc || ""),
        metadata: {
          title:  hit.title || "",
          court:  hit.docsource || "",
          year:   parseInt(hit.publishdate?.split("-")[0]) || null,
          caseNo: hit.citation || "",
          source: "IndianKanoon",
          url:    `https://indiankanoon.org/doc/${hit.tid}/`,
        },
      });
    }
  } catch (err) {
    console.error("  IndianKanoon fetch error:", err.message);
  }
  return docs;
};

// ─── Source 2: Local PDF files ────────────────────────────────────────────────
const ingestLocalPdfs = async () => {
  const pdfDir = path.join(__dirname, "legal_pdfs");
  if (!fs.existsSync(pdfDir)) {
    fs.mkdirSync(pdfDir, { recursive: true });
    console.log(`  Created ${pdfDir} — add PDFs here and re-run`);
    return 0;
  }

  const files = fs.readdirSync(pdfDir).filter(f => f.endsWith(".pdf"));
  if (files.length === 0) {
    console.log("  No PDFs found in scripts/legal_pdfs/");
    return 0;
  }

  const { default: pdfParse } = await import("pdf-parse");
  let total = 0;
  for (const file of files) {
    console.log(`\n  PDF: ${file}`);
    const buffer = fs.readFileSync(path.join(pdfDir, file));
    const { text } = await pdfParse(buffer);
    const inserted = await ingestDocument(text, {
      title: file.replace(".pdf", ""),
      source: "LocalPDF",
    });
    console.log(`\n  → ${inserted} chunks`);
    total += inserted;
  }
  return total;
};

// ─── Source 3: Starter corpus (manual — key statutes + landmark judgments) ───
// Add your own important cases here as you find them
const STARTER_CORPUS = [
  {
    text: `
Hindu Marriage Act, 1955 — Section 13: Divorce
(1) Any marriage solemnized, whether before or after the commencement of this Act, may, on a petition presented by either the husband or the wife, be dissolved by a decree of divorce on the ground that the other party—
(i) has, after the solemnization of the marriage, had voluntary sexual intercourse with any person other than his or her spouse; or
(ii) has, after the solemnization of the marriage, treated the petitioner with cruelty; or
(iii) has deserted the petitioner for a continuous period of not less than two years immediately preceding the presentation of the petition; or
(iv) has ceased to be a Hindu by conversion to another religion; or
(v) has been incurably of unsound mind, or has been suffering continuously or intermittently from mental disorder of such a kind and to such an extent that the petitioner cannot reasonably be expected to live with the respondent.

Section 13B: Divorce by mutual consent
(1) Subject to the provisions of this Act a petition for dissolution of marriage by a decree of divorce may be presented to the district court by both the parties to a marriage together on the ground that they have been living separately for a period of one year or more, that they have not been able to live together and that they have mutually agreed that the marriage should be dissolved.
(2) On the motion of both the parties made not earlier than six months after the date of the presentation of the petition referred to in sub-section (1) and not later than eighteen months after the said date, if the petition is not withdrawn in the meantime, the court shall, on being satisfied, after hearing the parties and after making such inquiry as it thinks fit, that a marriage has been solemnized and that the averments in the petition are true, pass a decree of divorce declaring the marriage to be dissolved with effect from the date of the decree.
    `,
    metadata: { title: "Hindu Marriage Act 1955 — S.13 Divorce", court: "Statute", source: "IndiaCode", sections: ["HMA S.13", "HMA S.13B"] },
  },
  {
    text: `
Protection of Women from Domestic Violence Act, 2005 — Key Sections

Section 3 — Definition of domestic violence:
For the purposes of this Act, any act, omission or commission or conduct of the respondent shall constitute domestic violence in case it—
(a) harms or injures or endangers the health, safety, life, limb or well-being, whether mental or physical, of the aggrieved person or tends to do so and includes causing physical abuse, sexual abuse, verbal and emotional abuse and economic abuse; or
(b) harasses, harms, injures or endangers the aggrieved person with a view to coerce her or any other person related to her to meet any unlawful demand for any dowry or other property or valuable security; or
(c) has the effect of threatening the aggrieved person or any person related to her by any conduct mentioned in clause (a) or clause (b); or
(d) otherwise injures or causes harm, whether physical or mental, to the aggrieved person.

Section 12 — Application to Magistrate:
An aggrieved person or a Protection Officer or any other person on behalf of the aggrieved person may present an application to the Magistrate seeking one or more reliefs under this Act.

Section 17 — Right to reside in shared household:
Every woman in a domestic relationship shall have the right to reside in the shared household, whether or not she has any right, title or beneficial interest in the same.

Section 20 — Monetary reliefs:
The Magistrate may direct the respondent to pay monetary relief to meet the expenses incurred and losses suffered by the aggrieved person and any child of the aggrieved person as a result of the domestic violence.
    `,
    metadata: { title: "Domestic Violence Act 2005 — Key Sections", court: "Statute", source: "IndiaCode", sections: ["DV Act S.3", "DV Act S.12", "DV Act S.17", "DV Act S.20"] },
  },
  {
    text: `
Code of Criminal Procedure, 1973 — Section 125: Order for maintenance of wives, children and parents

(1) If any person having sufficient means neglects or refuses to maintain—
(a) his wife, unable to maintain herself, or
(b) his legitimate or illegitimate minor child, whether married or not, unable to maintain itself, or
(c) his legitimate or illegitimate child (not being a married daughter) who has attained majority, where such child is, by reason of any physical or mental abnormality or injury unable to maintain itself, or
(d) his father or mother, unable to maintain himself or herself,
a Magistrate of the first class may, upon proof of such neglect or refusal, order such person to make a monthly allowance for the maintenance of his wife or such child, father or mother, at such monthly rate as such magistrate thinks fit.

The Supreme Court in Rajnesh v. Neha (2021) 2 SCC 324 held that overlapping maintenance claims under different statutes should be consolidated to avoid multiple proceedings. The Court issued comprehensive guidelines on payment of interim maintenance.

Key principle: The husband cannot take advantage of his own wrong. Where the wife is forced to leave the matrimonial home due to cruelty, she is entitled to maintenance even if she has left the shared household.
    `,
    metadata: { title: "CrPC Section 125 — Maintenance", court: "Supreme Court", year: 2021, caseNo: "Rajnesh v. Neha, 2021 2 SCC 324", source: "SCC", sections: ["CrPC S.125"] },
  },
  {
    text: `
Hindu Minority and Guardianship Act, 1956 — Child Custody Principles

Section 13: Welfare of minor to be paramount consideration
In the appointment or declaration of any person as guardian of a Hindu minor by a court, the welfare of the minor shall be the paramount consideration.

Supreme Court in Gaurav Nagpal v. Sumedha Nagpal (2009) 1 SCC 42:
The court held that while deciding custody of minor children, the paramount consideration is the welfare and interest of the child and not the rights of the parents. The financial position of the parent, the character and capacity of the proposed guardian, the preference of the child, and all relevant circumstances must be considered.

Key factors courts consider:
1. Age of the child (children of tender years generally with mother)
2. Educational facilities available
3. Emotional bond between child and parent
4. Stability of home environment
5. Income and ability to provide for child
6. Any history of abuse or neglect
7. Wishes of the child (if old enough to form a view)

Visitation rights: Even the non-custodial parent has a right to meet the child. Courts routinely grant liberal visitation to ensure the child maintains relationship with both parents.
    `,
    metadata: { title: "Child Custody — Hindu Minority Act + Supreme Court", court: "Supreme Court", year: 2009, caseNo: "Gaurav Nagpal v. Sumedha Nagpal, 2009 1 SCC 42", source: "SCC", sections: ["HG Act S.13"] },
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
const main = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB\n");

  let total = 0;

  // 1. Starter corpus (always)
  console.log("📚 Ingesting starter legal corpus...");
  for (const doc of STARTER_CORPUS) {
    const n = await ingestDocument(doc.text, doc.metadata);
    console.log(`\n  → ${n} new chunks from: ${doc.metadata.title}`);
    total += n;
  }

  // 2. IndianKanoon (if API key set)
  console.log("\n🔍 Fetching from IndianKanoon...");
  const queries = [
    "divorce Hindu Marriage Act cruelty",
    "domestic violence Section 498A IPC",
    "child custody welfare paramount",
    "maintenance wife Section 125 CrPC",
    "alimony permanent interim",
  ];
  for (const q of queries) {
    console.log(`  Query: "${q}"`);
    const docs = await fetchFromIndianKanoon(q, 5);
    for (const doc of docs) {
      const n = await ingestDocument(doc.text, doc.metadata);
      total += n;
    }
  }

  // 3. Local PDFs
  console.log("\n📄 Ingesting local PDFs...");
  total += await ingestLocalPdfs();

  console.log(`\n✅ Done. Total new chunks inserted: ${total}`);
  await mongoose.disconnect();
};

main().catch(e => { console.error(e); process.exit(1); });
