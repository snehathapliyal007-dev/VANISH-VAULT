import { PLAN_DEFINITIONS, PLAN_ORDER, getPlanDefinition, normalizePlanName } from "../models/planModel.js";
import { GB, formatBytes, toRoundedGb } from "../utils/bytes.js";

export function getAvailablePlans() {
  return PLAN_ORDER.map((planName) => {
    const plan = PLAN_DEFINITIONS[planName];
    return {
      ...plan,
      maxFileSizeLabel: plan.maxFileSizeBytes ? formatBytes(plan.maxFileSizeBytes) : "Unlimited",
      monthlyUsageLabel: plan.monthlyUsageBytes ? formatBytes(plan.monthlyUsageBytes) : "Custom",
    };
  });
}

export function getPlanForUser(user) {
  const planName = normalizePlanName(user?.plan);
  const plan = getPlanDefinition(planName);

  if (planName !== "ENTERPRISE") {
    return plan;
  }

  return {
    ...plan,
    monthlyUsageBytes:
      Number(user?.customMonthlyQuotaBytes) > 0
        ? Number(user.customMonthlyQuotaBytes)
        : plan.monthlyUsageBytes,
  };
}

function planSupportsFileSize(plan, fileSizeBytes) {
  return !plan.maxFileSizeBytes || fileSizeBytes <= plan.maxFileSizeBytes;
}

function planSupportsMonthlyUsage(plan, projectedBytes) {
  return !plan.monthlyUsageBytes || projectedBytes <= plan.monthlyUsageBytes;
}

export function suggestRequiredPlan(fileSizeBytes, projectedBytes) {
  return (
    PLAN_ORDER.find((planName) => {
      const plan = PLAN_DEFINITIONS[planName];
      return (
        planSupportsFileSize(plan, fileSizeBytes) &&
        planSupportsMonthlyUsage(plan, projectedBytes)
      );
    }) || "ENTERPRISE"
  );
}

export function evaluatePlanLimits(user, usageRecord, fileSizeBytes) {
  const plan = getPlanForUser(user);
  const projectedBytes = Number(usageRecord.totalUploadedBytes || 0) + Number(fileSizeBytes || 0);
  const exceedsFileSize = Boolean(plan.maxFileSizeBytes && fileSizeBytes > plan.maxFileSizeBytes);
  const exceedsUsage = Boolean(plan.monthlyUsageBytes && projectedBytes > plan.monthlyUsageBytes);

  if (!exceedsFileSize && !exceedsUsage) {
    return {
      allowed: true,
      plan: plan.name,
      projectedBytes,
      projectedUsageGB: toRoundedGb(projectedBytes),
    };
  }

  return {
    allowed: false,
    plan: plan.name,
    fileSizeBytes,
    projectedBytes,
    projectedUsageGB: toRoundedGb(projectedBytes),
    requiredPlan: suggestRequiredPlan(fileSizeBytes, projectedBytes),
    exceedsFileSize,
    exceedsUsage,
  };
}

export function summarizePlan(plan) {
  return {
    ...plan,
    maxFileSizeLabel: plan.maxFileSizeBytes ? formatBytes(plan.maxFileSizeBytes) : "Unlimited",
    monthlyUsageLabel: plan.monthlyUsageBytes ? formatBytes(plan.monthlyUsageBytes) : "Custom",
    monthlyUsageGB: plan.monthlyUsageBytes ? Number((plan.monthlyUsageBytes / GB).toFixed(2)) : null,
  };
}

