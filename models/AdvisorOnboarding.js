import mongoose from "mongoose";

const advisorOnboardingSchema = new mongoose.Schema({
  // User Info
  uid: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
  },

  // STEP 1: Personal Details
  fullName: {
    type: String,
    required: true,
  },
  fatherName: {
    type: String,
    required: true,
  },
  dateOfBirth: {
    type: Date,
    required: true,
  },
  gender: {
    type: String,
    enum: ["Male", "Female", "Other"],
    required: true,
  },
  nationality: {
    type: String,
    default: "Indian",
  },

  // STEP 2: Professional Details
  enrollmentNumber: {
    type: String,
    required: true,
  },
  dateOfEnrollment: {
    type: Date,
    required: true,
  },
  stateBarCouncil: {
    type: String,
    required: true,
  },
  barAssociationName: {
    type: String,
    required: true,
  },
  yearsOfPractice: {
    type: Number,
    required: true,
  },
  areaOfPractice: {
    type: String,
    required: true,
  },

  // STEP 3: Office Details
  chamberAddress: {
    type: String,
    required: true,
  },
  contactNumber: {
    type: String,
    required: true,
  },
  emailId: {
    type: String,
    required: true,
  },

  // STEP 4: Identification Details
  aadhaarNumber: {
    type: String,
  },
  panNumber: {
    type: String,
  },
  otherIdNumber: {
    type: String,
  },

  // STEP 5: Verification Documents (Base64 encoded from MongoDB)
  barCertificate: {
    type: String, // Base64 encoded PDF/Image
  },
  identityProof: {
    type: String, // Base64 encoded PDF/Image
  },
  photograph: {
    type: String, // Base64 encoded Image
  },
  chamberProof: {
    type: String, // Base64 encoded PDF/Image
  },

  // STEP 6: Declaration
  declarationAgreed: {
    type: Boolean,
    required: true,
    default: false,
  },
  declarationDate: {
    type: Date,
  },
  declarationPlace: {
    type: String,
  },

  // STEP 7: Authority Verification (Optional)
  authorityName: {
    type: String,
  },
  designation: {
    type: String,
  },
  authorityDate: {
    type: Date,
  },

  // Admin Fields
  verificationStatus: {
    type: String,
    enum: ["pending", "under_review", "verified", "rejected"],
    default: "pending",
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  rejectionReason: {
    type: String,
  },
  reviewedBy: {
    type: String, // Admin UID
  },
  reviewerName: {
    type: String, // Admin Name
  },
  reviewedAt: {
    type: Date,
  },
  appliedAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
advisorOnboardingSchema.pre("save", function() {
  this.updatedAt = Date.now();
});

export default mongoose.model("AdvisorOnboarding", advisorOnboardingSchema, "Advisor onboarding");
