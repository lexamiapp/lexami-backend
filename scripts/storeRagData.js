import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Document from "../models/Document.js";
import { getEmbedding } from "../services/embeddingService.js";

//  Load .env from root (VERY IMPORTANT)
dotenv.config({
  path: path.resolve(process.cwd(), "uploads/.env"),
});

console.log("ENV PATH:", path.resolve(process.cwd(), "uploads/.env"));
//  Debug (remove later)
console.log("MONGO_URI:", process.env.MONGO_URI);

//  Stop execution if env missing
if (!process.env.MONGO_URI) {
  throw new Error(" MONGO_URI is not defined in .env");
}

//  Connect DB
await mongoose.connect(process.env.MONGO_URI);
console.log("MongoDB Connected");

//  Correct absolute path (prevents path issues)
const dataPath = path.resolve(process.cwd(), "data");

// ❌ Check if folder exists
if (!fs.existsSync(dataPath)) {
  throw new Error("❌ data folder not found");
}

// Read files
const files = fs.readdirSync(dataPath);

for (const file of files) {
  const filePath = path.join(dataPath, file);

  //  Skip non-text files
  if (!file.endsWith(".txt")) continue;

  const text = fs.readFileSync(filePath, "utf-8");

  console.log(` Processing: ${file}`);

  const embedding = await getEmbedding(text);

  await Document.create({
    content: text,
    embedding,
  });

  console.log(" Stored:", file);
}

console.log(" All data stored successfully");

// Close connection properly
await mongoose.connection.close();

process.exit();