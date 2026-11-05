const { AutonomousServiceDesk } = require("./aiAgents");

class BackgroundServiceDeskWorker {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.lastRun = null;
    this.runCount = 0;
  }

  start(intervalMs = 60000) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("⚡ Autonomous Service Desk Background Worker started (Interval:", intervalMs, "ms)");

    // Run initial pass
    this.executePass();

    this.intervalId = setInterval(() => {
      this.executePass();
    }, intervalMs);
  }

  async executePass() {
    try {
      this.runCount++;
      this.lastRun = new Date();
      const triageResult = await AutonomousServiceDesk.runTriage();
      if (triageResult.triagedCount > 0) {
        console.log(`[Worker] Pass #${this.runCount} completed: Triaged ${triageResult.triagedCount} service request(s).`);
      }
      return triageResult;
    } catch (e) {
      console.error("[Worker Error]:", e.message);
      return null;
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("Autonomous Service Desk Background Worker stopped.");
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      runCount: this.runCount,
      lastRun: this.lastRun
    };
  }
}

module.exports = new BackgroundServiceDeskWorker();
