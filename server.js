import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import analyzeRoutes from "./routes/analyze.js";
import translateRoutes from "./routes/translateRoutes.js";
import analyzeStreamRoute from "./routes/analyzeStreamRoute.js";
import advisorRoutes from "./routes/advisorRoutes.js";


dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for base64-encoded documents
app.use(express.urlencoded({ limit: '50mb' }));
app.use("/api", translateRoutes);
app.use("/api", analyzeStreamRoute);
app.use("/api", advisorRoutes);
app.use("/api", analyzeRoutes);

mongoose.connect(process.env.MONGO_URI, {
  dbName: 'test',
})
  .then(() => console.log("✓ MongoDB Connected to 'test' database"))
  .catch(err => console.log("❌ MongoDB Connection Error:", err));

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});