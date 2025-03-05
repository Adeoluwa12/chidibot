import mongoose from "mongoose";

const memberSchema = new mongoose.Schema({
  memberName: String,
  memberID: String,
  detectedAt: { type: Date, default: Date.now },
});

export const MemberModel = mongoose.model("Member", memberSchema);