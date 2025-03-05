import mongoose from "mongoose";

const logSchema = new mongoose.Schema({
  message: String,
  timestamp: { type: Date, default: Date.now },
});

export const LogModel = mongoose.model("Log", logSchema);