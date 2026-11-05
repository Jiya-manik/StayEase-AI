const mongoose = require("mongoose");

const approvalRequestSchema = new mongoose.Schema({
  agentName: { type: String, required: true },
  actionType: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  impactLevel: { type: String, enum: ["low", "medium", "high"], default: "medium" },
  payload: mongoose.Schema.Types.Mixed,
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  proposedByAgent: { type: String, default: "SystemAgent" },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  rejectionReason: String,
  executedAt: Date,
  executionResult: mongoose.Schema.Types.Mixed
}, { timestamps: true });

module.exports = mongoose.model("ApprovalRequest", approvalRequestSchema);
