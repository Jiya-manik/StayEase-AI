const agents = require("./aiAgents");
const AIActionLog = require("../models/AIActionLog");

class AIOrchestrator {
  constructor() {
    this.agents = agents;
  }

  async executeAgent(agentName, methodName, params, user = null) {
    const startTime = Date.now();
    const agent = this.agents[agentName];
    if (!agent) {
      throw new Error(`Agent '${agentName}' does not exist in registry.`);
    }

    if (typeof agent[methodName] !== "function") {
      throw new Error(`Method '${methodName}' not found on agent '${agentName}'.`);
    }

    try {
      // Execute the agent method
      const result = await agent[methodName](params);
      const executionTimeMs = Date.now() - startTime;

      // Log execution
      await AIActionLog.create({
        agentName,
        actionType: methodName,
        input: params,
        output: result,
        requiresApproval: !!result.requiresApproval,
        approvalStatus: result.requiresApproval ? "pending" : "none",
        triggeredBy: user ? (user.role || "user") : "guest",
        userId: user ? user._id : null,
        status: "success",
        executionTimeMs
      });

      return {
        success: true,
        data: result,
        meta: {
          agent: agentName,
          executionTimeMs,
          timestamp: new Date()
        }
      };
    } catch (err) {
      const executionTimeMs = Date.now() - startTime;
      await AIActionLog.create({
        agentName,
        actionType: methodName,
        input: params,
        error: err.message,
        triggeredBy: user ? (user.role || "user") : "guest",
        userId: user ? user._id : null,
        status: "failed",
        executionTimeMs
      });

      throw err;
    }
  }
}

module.exports = new AIOrchestrator();
