import express from "express";
import multer from "multer";
import { analyzeCase } from "../controllers/analyzeController.js";

const router = express.Router();

const upload = multer({ dest: "uploads/" });

router.post("/analyze", upload.array("files"), analyzeCase);

export default router;