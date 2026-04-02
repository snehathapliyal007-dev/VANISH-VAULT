import { getUsageRecordForUser } from "../services/billingService.js";
import { evaluatePlanLimits } from "../services/planService.js";

function resolvePlannedFileSize(req) {
  if (Number(req.body?.totalSize) > 0) {
    return Number(req.body.totalSize);
  }

  if (Number(req.file?.size) > 0) {
    return Number(req.file.size);
  }

  if (Number(req.uploadSession?.totalSize) > 0) {
    return Number(req.uploadSession.totalSize);
  }

  if (Number(req.planCheck?.fileSizeBytes) > 0) {
    return Number(req.planCheck.fileSizeBytes);
  }

  return 0;
}

export async function checkPlanLimits(req, res, next) {
  const fileSizeBytes = resolvePlannedFileSize(req);

  if (!fileSizeBytes) {
    return res.status(400).json({ message: "File size metadata is required." });
  }

  const usageRecord = await getUsageRecordForUser(req.user);
  // Plan enforcement happens here before direct upload finalization or chunk session creation.
  const evaluation = evaluatePlanLimits(req.user, usageRecord, fileSizeBytes);

  if (!evaluation.allowed) {
    return res.status(403).json({
      error: "LIMIT_EXCEEDED",
      message: "Your current plan does not cover this upload.",
      requiredPlan: evaluation.requiredPlan,
      details: evaluation,
    });
  }

  req.usageRecord = usageRecord;
  req.planEvaluation = evaluation;
  return next();
}
