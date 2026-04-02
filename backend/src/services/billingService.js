import { createUsageRecord } from "../models/planModel.js";
import { findUsageRecordByUserId, upsertUsageRecord } from "./db.js";
import { getPlanForUser } from "./planService.js";
import { GB, toRoundedGb } from "../utils/bytes.js";
import { config } from "../config.js";

function needsReset(lastResetDate) {
  return Date.now() - new Date(lastResetDate).getTime() >= config.usageResetDays * 24 * 60 * 60 * 1000;
}

export function calculateExtraUsageCost(user, totalUploadedBytes) {
  const plan = getPlanForUser(user);
  const includedBytes = plan.monthlyUsageBytes || 0;

  // Monetization is calculated here using included quota plus plan-specific overage pricing.
  if (!includedBytes || !plan.extraPerGbInr) {
    return {
      extraUsageBytes: 0,
      extraUsageGB: 0,
      estimatedBill: plan.baseMonthlyPriceInr,
    };
  }

  const extraUsageBytes = Math.max(0, totalUploadedBytes - includedBytes);
  const extraUsageGB = Number((extraUsageBytes / GB).toFixed(2));
  const estimatedBill = Number(
    (plan.baseMonthlyPriceInr + extraUsageGB * plan.extraPerGbInr).toFixed(2),
  );

  return {
    extraUsageBytes,
    extraUsageGB,
    estimatedBill,
  };
}

export async function getUsageRecordForUser(user) {
  let usage = await findUsageRecordByUserId(user.id);

  if (!usage) {
    usage = createUsageRecord(user);
    await upsertUsageRecord(usage);
  }

  if (needsReset(usage.lastResetDate)) {
    // Compliance-friendly rolling reset: usage windows are reset every configured billing cycle.
    usage = {
      ...usage,
      totalUploadedBytes: 0,
      lastResetDate: new Date().toISOString(),
      monthlyUsageGB: 0,
      extraUsageGB: 0,
      estimatedBill: getPlanForUser(user).baseMonthlyPriceInr,
      currentPlan: user.plan,
    };
    await upsertUsageRecord(usage);
  }

  return usage;
}

export async function resetAllUsageRecords(users) {
  for (const user of users) {
    await getUsageRecordForUser(user);
  }
}

export async function recordUploadUsage(user, uploadedBytes) {
  const current = await getUsageRecordForUser(user);
  const totalUploadedBytes = Number(current.totalUploadedBytes || 0) + Number(uploadedBytes || 0);
  const costs = calculateExtraUsageCost(user, totalUploadedBytes);

  const next = {
    ...current,
    currentPlan: user.plan,
    totalUploadedBytes,
    monthlyUsageGB: toRoundedGb(totalUploadedBytes),
    extraUsageGB: costs.extraUsageGB,
    estimatedBill: costs.estimatedBill,
    lastResetDate: current.lastResetDate || new Date().toISOString(),
  };

  await upsertUsageRecord(next);
  return next;
}
