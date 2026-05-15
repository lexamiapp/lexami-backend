import AdvisorOnboarding from "../models/AdvisorOnboarding.js";

// POST /api/advisor/onboard
export const submitAdvisorOnboarding = async (req, res) => {
  try {
    const { name, email, phone, specialization, experience, barCouncilNumber, city, state, bio } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required." });
    }

    // Check for duplicate email
    const existing = await AdvisorOnboarding.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: "An advisor with this email already exists." });
    }

    const advisor = await AdvisorOnboarding.create({
      name,
      email,
      phone,
      specialization,
      experience,
      barCouncilNumber,
      city,
      state,
      bio,
    });

    res.status(201).json({ success: true, data: advisor });
  } catch (error) {
    console.error("ADVISOR ONBOARD ERROR:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
};

// GET /api/advisors
export const getAdvisors = async (req, res) => {
  try {
    const { specialization, city, state } = req.query;
    const filter = { isActive: true, isVerified: true };

    if (specialization) filter.specialization = specialization;
    if (city) filter.city = new RegExp(city, "i");
    if (state) filter.state = new RegExp(state, "i");

    const advisors = await AdvisorOnboarding.find(filter)
      .select("-__v")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, count: advisors.length, data: advisors });
  } catch (error) {
    console.error("GET ADVISORS ERROR:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
};

// --- ADMIN CONTROLLERS ---

// GET /api/admin/advisors/unverified
export const getUnverifiedAdvisors = async (req, res) => {
  try {
    const advisors = await AdvisorOnboarding.find({ isVerified: false })
      .select("-__v")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: advisors.length, data: advisors });
  } catch (error) {
    console.error("GET UNVERIFIED ADVISORS ERROR:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
};

// PUT /api/admin/advisors/verify/:id
export const verifyAdvisor = async (req, res) => {
  try {
    const { id } = req.params;
    const advisor = await AdvisorOnboarding.findByIdAndUpdate(
      id,
      { isVerified: true },
      { new: true }
    );

    if (!advisor) {
      return res.status(404).json({ error: "Advisor not found." });
    }

    res.json({ success: true, data: advisor });
  } catch (error) {
    console.error("VERIFY ADVISOR ERROR:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
};

