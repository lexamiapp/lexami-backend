import mongoose from "mongoose";

const analysisSchema = new mongoose.Schema({
  caseType: String,
  summary: String,
  result: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Analysis", analysisSchema);