import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import analyzeRoutes from "./routes/analyze.js";
import translateRoutes from "./routes/translateRoutes.js";
import analyzeStreamRoute from "./routes/analyzeStreamRoute.js";
import advisorRoutes from "./routes/advisorRoutes.js";
import careerRoutes from "./routes/careerRoutes.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["*"]; // set ALLOWED_ORIGINS=https://lexani.app in Render env for prod

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed"));
    }
  },
}));

// ─── Rate Limiting ────────────────────────────────────────────────────────────

// Global limiter: prevents DDoS / scraping
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 200,                    // 200 requests per IP per 15 min (well above normal usage)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down.", retryAfter: "15 minutes" },
});

// AI endpoints limiter: Gemini free tier is ~15 RPM.
// Allow 10 AI calls per IP per 5 minutes — well within free tier for 100 beta users.
const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,   // 5 minutes
  max: 10,                    // 10 AI calls per IP per 5 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "AI rate limit reached. Please wait a few minutes before trying again.",
    retryAfterSeconds: 300,
  },
});

app.use(globalLimiter);

// ─── Body parsers ────────────────────────────────────────────────────────────
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ─── Waitlist Endpoint (Saves to CSV) ─────────────────────────────────────────
app.post("/api/waitlist", (req, res) => {
  const { email, phone, location, issue } = req.body;
  const timestamp = new Date().toISOString();
  const csvLine = `"${timestamp}","${email}","${phone}","${location}","${issue || ""}"\n`;
  const filePath = path.join(__dirname, "waitlist.csv");

  // Add header if file doesn't exist
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "Timestamp,Email,Phone,Location,Issue\n");
  }

  fs.appendFile(filePath, csvLine, (err) => {
    if (err) {
      console.error("❌ Failed to save waitlist entry:", err);
      return res.status(500).json({ error: "Failed to save entry" });
    }
    console.log(`✓ New waitlist entry: ${email}`);
    res.json({ status: "ok" });
  });
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/translate", aiLimiter, translateRoutes);
app.use("/api/analyze-stream", aiLimiter, analyzeStreamRoute);
app.use("/api/analyze", aiLimiter, analyzeRoutes);
app.use("/api", advisorRoutes);
app.use("/api", careerRoutes);

// ─── Health check ────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok" }));

// ─── MongoDB ─────────────────────────────────────────────────────────────────
if (!process.env.MONGO_URI || process.env.MONGO_URI === "your_mongodb_connection_string") {
  console.error("❌  MONGO_URI is not set. Please update your .env file.");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI, { dbName: "test" })
  .then(() => console.log("✓ MongoDB Connected to 'test' database"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  });

// ─── Start server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
});