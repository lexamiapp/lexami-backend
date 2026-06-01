import mongoose from "mongoose";

const advisorOnboardingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    category: { type: String, default: "Advocate" }, // 'Advocate', 'Counselor', 'Retired Judge'
    specialization: { type: String, default: "Other" },
    experience: { type: Number, min: 0 }, // years
    successRate: { type: Number, default: 0 },
    pricePerMin: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    barCouncilNumber: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    bio: { type: String, maxlength: 1000 },
    verificationStatus: { type: String, default: "pending" }, // 'pending', 'under_review', 'verified', 'rejected'
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("AdvisorOnboarding", advisorOnboardingSchema);
