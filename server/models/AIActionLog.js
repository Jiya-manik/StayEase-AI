const mongoose = require("mongoose");

const aiActionLogSchema = new mongoose.Schema({
  agentName: { type: String, required: true },
  actionType: { type: String, required: true },
  input: mongoose.Schema.Types.Mixed,
  output: mongoose.Schema.Types.Mixed,
  requiresApproval: { type: Boolean, default: false },
  approvalStatus: { type: String, enum: ["none", "pending", "approved", "rejected"], default: "none" },
  triggeredBy: { type: String, default: "system" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  status: { type: String, enum: ["success", "failed", "pending"], default: "success" },
  executionTimeMs: { type: Number, default: 0 },
  error: String
}, { timestamps: true });

module.exports = mongoose.model("AIActionLog", aiActionLogSchema);
