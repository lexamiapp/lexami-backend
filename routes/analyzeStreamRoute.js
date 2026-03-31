import express from "express";
import { analyzeCaseStream } from "../controllers/analyzeStreamController.js";

const router = express.Router();

router.post("/analyze-stream",upload.array("files", 2), analyzeCaseStream);


export default router;