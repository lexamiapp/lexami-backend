import express from "express";
import {
  submitAdvisorOnboarding,
  getPendingAdvisors,
  getAdvisorApplication,
  approveAdvisor,
  rejectAdvisor,
  reviewAdvisor,
  getVerifiedAdvisors,
  getAllAdvisors,
  getAdvisorsByRole,
  getAdvisorStats,
} from "../controllers/advisorController.js";

const router = express.Router();

// Public Routes
router.post("/advisors/onboarding/submit", submitAdvisorOnboarding);
router.post("/advisors/register", submitAdvisorOnboarding);
router.get("/advisors", getAllAdvisors);
router.get("/advisors/role/:role", getAdvisorsByRole);
router.get("/advisors/verified", getVerifiedAdvisors);
router.get("/advisors/all", getAllAdvisors);
router.get("/advisors/application/:uid", getAdvisorApplication);

// Admin Routes
router.get("/advisors/pending", getPendingAdvisors);
router.post("/advisors/approve/:uid", approveAdvisor);
router.post("/advisors/reject/:uid", rejectAdvisor);
router.post("/advisors/review/:uid", reviewAdvisor);
router.get("/advisors/stats", getAdvisorStats);

export default router;
