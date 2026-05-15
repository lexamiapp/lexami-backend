import mongoose from "mongoose";

const advisorOnboardingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    specialization: {
      type: String,
      enum: [
        "Family Law",
        "Criminal Law",
        "Civil Law",
        "Corporate Law",
        "Property Law",
        "Labour Law",
        "Other",
      ],
      default: "Other",
    },
    experience: { type: Number, min: 0 }, // years
    barCouncilNumber: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    bio: { type: String, maxlength: 1000 },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("AdvisorOnboarding", advisorOnboardingSchema);
