import { GB, MB } from "../utils/bytes.js";

export const PLAN_DEFINITIONS = {
  FREE: {
    name: "FREE",
    label: "Free",
    maxFileSizeBytes: 100 * MB,
    monthlyUsageBytes: 1 * GB,
    baseMonthlyPriceInr: 0,
    extraPerGbInr: 0,
    storageMode: "local",
  },
  PRO: {
    name: "PRO",
    label: "Pro",
    maxFileSizeBytes: 5 * GB,
    monthlyUsageBytes: 100 * GB,
    baseMonthlyPriceInr: 999,
    extraPerGbInr: 30,
    storageMode: "local",
  },
  ENTERPRISE: {
    name: "ENTERPRISE",
    label: "Enterprise",
    maxFileSizeBytes: null,
    monthlyUsageBytes: 500 * GB,
    baseMonthlyPriceInr: 4999,
    extraPerGbInr: 20,
    storageMode: "pluggable",
    customQuotaSupported: true,
  },
};

export const PLAN_ORDER = ["FREE", "PRO", "ENTERPRISE"];

export function normalizePlanName(value) {
  if (!value) {
    return "FREE";
  }

  const normalized = String(value).trim().toUpperCase();
  return PLAN_DEFINITIONS[normalized] ? normalized : "FREE";
}

export function getPlanDefinition(name) {
  return PLAN_DEFINITIONS[normalizePlanName(name)];
}

export function createUsageRecord(user) {
  return {
    userId: user.id,
    totalUploadedBytes: 0,
    currentPlan: normalizePlanName(user.plan),
    lastResetDate: new Date().toISOString(),
    monthlyUsageGB: 0,
    extraUsageGB: 0,
    estimatedBill: 0,
  };
}

