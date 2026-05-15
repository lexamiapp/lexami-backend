import express from "express";
import {
  submitAdvisorOnboarding,
  getAdvisors,
  getUnverifiedAdvisors,
  verifyAdvisor,
} from "../controllers/advisorController.js";

const router = express.Router();

// --- PUBLIC ROUTES ---

// POST /api/advisors/onboarding/submit (Match Flutter app)
router.post("/advisors/onboarding/submit", submitAdvisorOnboarding);
router.post("/advisor/onboard", submitAdvisorOnboarding); // Alias for backward compat

// GET /api/advisors/verified
router.get("/advisors/verified", getAdvisors);
router.get("/advisors", getAdvisors); // Alias

// GET /api/advisors/all
router.get("/advisors/all", getUnverifiedAdvisors); // Note: This might need a new controller if "all" means verified + unverified

// --- ADMIN ROUTES ---

// GET /api/advisors/pending
router.get("/advisors/pending", getUnverifiedAdvisors);
router.get("/admin/advisors/unverified", getUnverifiedAdvisors); // Alias

// PUT /api/advisors/verify/:id
router.put("/advisors/verify/:id", verifyAdvisor);
router.put("/admin/advisors/verify/:id", verifyAdvisor); // Alias

export default router;

