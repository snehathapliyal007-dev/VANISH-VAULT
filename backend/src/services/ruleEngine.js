import { config } from "../config.js";
import { listUsers } from "./db.js";
import { resetAllUsageRecords } from "./billingService.js";
import { cleanupExpiredUploadSessions } from "./uploadService.js";
import { runRetentionSweep } from "./vaultService.js";

let intervalRef = null;

export async function runRuleSweep() {
  await runRetentionSweep();
  await cleanupExpiredUploadSessions();
  await resetAllUsageRecords(await listUsers());
}

export function startRuleEngine() {
  if (intervalRef) {
    return;
  }

  intervalRef = setInterval(() => {
    runRuleSweep().catch((error) => {
      console.error("Rule engine sweep failed:", error);
    });
  }, config.ruleSweepMs);
}
