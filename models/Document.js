import mongoose from "mongoose";

const docSchema = new mongoose.Schema({
  content: String,
  embedding: [Number],
});

export default mongoose.model("Document", docSchema);