import express from "express";
import axios from "axios";
import Application from "../models/Application.js";

const router = express.Router();

// @route   POST /api/careers/apply
// @desc    Submit an internship application
router.post("/careers/apply", async (req, res) => {
  try {
    const { name, email, phone, role, experience, portfolio, resume, message } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newApplication = new Application({
      name,
      email,
      phone,
      role,
      experience,
      portfolio,
      resume,
      message
    });

    await newApplication.save();

    // ─── Google Sheets Integration ───
    const SHEETS_WEBHOOK_URL = process.env.GOOGLE_SHEETS_WEBHOOK;
    if (SHEETS_WEBHOOK_URL) {
      try {
        await axios.post(SHEETS_WEBHOOK_URL, {
          timestamp: new Date().toLocaleString(),
          name,
          email,
          phone,
          role,
          resume,
          message
        });
        console.log("✓ Data synced to Google Sheets");
      } catch (sheetErr) {
        console.error("⚠️ Google Sheets sync failed:", sheetErr.message);
      }
    }

    console.log(`✓ New application received from ${name} for ${role}`);
    res.status(201).json({ message: "Application submitted successfully!" });
  } catch (err) {
    console.error("❌ Application submission error:", err.message);
    res.status(500).json({ error: "Server error, please try again later." });
  }
});

// @route   GET /api/careers/applications
// @desc    Get all applications (for admin use)
router.get("/careers/applications", async (req, res) => {
  try {
    const applications = await Application.find().sort({ appliedAt: -1 });
    res.json(applications);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
