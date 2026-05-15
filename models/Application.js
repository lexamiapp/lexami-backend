import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  role: { type: String, required: true },
  experience: { type: String },
  portfolio: { type: String },
  resume: { type: String }, // Link to resume
  message: { type: String },
  appliedAt: { type: Date, default: Date.now }
});

export default mongoose.model("Application", applicationSchema);
