import express from "express";
import { analyzeCaseStream } from "../controllers/analyzeStreamController.js";

const router = express.Router();

router.post("/analyze-stream", analyzeCaseStream);

export default router;