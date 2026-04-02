import fs from "node:fs/promises";
import { nanoid } from "nanoid";
import {
  addAccessLog,
  countAuditLogsForUser,
  findFileById,
  findFileByShareToken,
  insertFileRecord,
  listAllFiles,
  listFilesByOwner,
  listLogsByFileId,
  updateFileRecord,
} from "./db.js";
import { appendAuditLog, listAuditLogsForUser } from "./auditService.js";
import { getUsageRecordForUser, recordUploadUsage } from "./billingService.js";
import {
  encryptFileFromPath,
  encryptFromChunkPaths,
  streamDecryptedFileToWritable,
  verifyEncryptedSignature,
} from "./encryptionService.js";
import {
  destroyWrappedKey,
  getKeyMaterial,
  getKmsStatus,
  storeWrappedKey,
} from "./kms.js";
import { getPlanForUser, getAvailablePlans, summarizePlan } from "./planService.js";
import {
  getEncryptedObjectPath,
  getEncryptedObjectPreview,
} from "./storage.js";
import { config } from "../config.js";
import { signFileAccessToken, verifyFileAccessToken } from "../utils/tokens.js";
import { formatBytes, toRoundedGb } from "../utils/bytes.js";

function parseRuleNumber(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function resolveExpiry({ expiresAt, expiresInMinutes }) {
  if (expiresAt) {
    return new Date(expiresAt).toISOString();
  }

  const minutes = parseRuleNumber(expiresInMinutes);
  return minutes ? new Date(Date.now() + minutes * 60 * 1000).toISOString() : null;
}

function normalizeStatus(file) {
  if (file.status === "deleted") {
    return "deleted";
  }

  if (file.destroyedAt) {
    return "destroyed";
  }

  return "active";
}

function decorateFile(file) {
  if (!file) {
    return null;
  }

  const expiresAt = file.rules?.expiresAt || null;
  const maxViews = file.rules?.maxViews || null;
  const expired = Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
  const viewsRemaining = maxViews ? Math.max(maxViews - Number(file.views || 0), 0) : null;

  return {
    id: file.id,
    ownerId: file.ownerId,
    ownerName: file.ownerName,
    uploaderEmail: file.uploaderEmail,
    title: file.title,
    description: file.description,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    sizeLabel: formatBytes(file.size),
    encryptedSize: file.encryptedSize,
    encryptedSizeLabel: formatBytes(file.encryptedSize),
    status: normalizeStatus(file),
    views: Number(file.views || 0),
    createdAt: file.createdAt,
    destroyedAt: file.destroyedAt,
    deletionRequestedAt: file.deletionRequestedAt || null,
    destructionReason: file.destructionReason,
    lastAccessedAt: file.lastAccessedAt,
    retentionStatus: expired ? "expired" : "active",
    rules: file.rules,
    integrity: "signed",
    hybridEncryption: "AES-256 + RSA-2048",
    expired,
    viewsRemaining,
    shareUrl: `${config.frontendUrl}/share/${file.shareToken}`,
    accessHistoryCount: Number(file.views || 0),
  };
}

async function appendFileActivity({
  fileId,
  user,
  actor,
  action,
  message,
  source,
  ipAddress,
  metadata = {},
}) {
  await addAccessLog({
    id: nanoid(),
    fileId,
    actor,
    event: action,
    message,
    source,
    createdAt: new Date().toISOString(),
  });

  await appendAuditLog({
    userId: user?.id || null,
    fileId,
    action,
    ipAddress,
    details: message,
    metadata,
  });
}

export async function destroyFileAccess(fileId, reason, actor = "system", context = {}) {
  const file = await findFileById(fileId);

  if (!file || file.status === "destroyed" || file.status === "deleted") {
    return file;
  }

  // Key lifecycle management happens here: deleting the wrapped AES key makes the ciphertext useless.
  await destroyWrappedKey(fileId, reason);
  const nextStatus = reason === "user_deleted" ? "deleted" : "destroyed";
  const updated = await updateFileRecord(fileId, {
    status: nextStatus,
    destroyedAt: new Date().toISOString(),
    deletionRequestedAt: reason === "user_deleted" ? new Date().toISOString() : file.deletionRequestedAt || null,
    destructionReason: reason,
  });

  await appendFileActivity({
    fileId,
    user: context.user || null,
    actor,
    action: "key_destroyed",
    message: `Encryption key destroyed due to ${reason}.`,
    source: context.source || "rule-engine",
    ipAddress: context.ipAddress,
    metadata: { reason },
  });

  return updated;
}

async function enforceLifecycle(file, context = {}) {
  if (!file) {
    return { file: null, blockedReason: "not_found" };
  }

  if (file.status === "destroyed" || file.status === "deleted") {
    return { file, blockedReason: file.destructionReason || file.status };
  }

  const expiresAt = file.rules?.expiresAt;
  const maxViews = file.rules?.maxViews;
  const views = Number(file.views || 0);

  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    const destroyed = await destroyFileAccess(file.id, "time_expired", "system", {
      user: context.user || null,
      ipAddress: context.ipAddress,
      source: "retention-policy",
    });
    return { file: destroyed, blockedReason: "time_expired" };
  }

  if (maxViews && views >= maxViews) {
    const destroyed = await destroyFileAccess(file.id, "max_views_reached", "system", {
      user: context.user || null,
      ipAddress: context.ipAddress,
      source: "rule-engine",
    });
    return { file: destroyed, blockedReason: "max_views_reached" };
  }

  return { file, blockedReason: null };
}

async function finalizeEncryptedRecord({
  sourcePath,
  chunkPaths,
  originalName,
  mimeType,
  title,
  description,
  expiresInMinutes,
  maxViews,
  owner,
  ipAddress,
  uploadMode,
}) {
  const fileId = nanoid(12);
  const storagePath = getEncryptedObjectPath(fileId);
  const expiresAt = resolveExpiry({ expiresInMinutes });
  const sourceSize = sourcePath
    ? (await fs.stat(sourcePath)).size
    : (
        await Promise.all(
          chunkPaths.map(async (chunkPath) => {
            const stats = await fs.stat(chunkPath);
            return stats.size;
          }),
        )
      ).reduce((sum, size) => sum + size, 0);

  const encryptionResult = sourcePath
    ? await encryptFileFromPath({ sourcePath, targetPath: storagePath })
    : await encryptFromChunkPaths({ sourcePaths: chunkPaths, targetPath: storagePath });

  // Hybrid encryption lifecycle: AES secures the file, RSA secures the AES key in KMS.
  await storeWrappedKey({
    fileId,
    aesKey: encryptionResult.aesKey,
    iv: encryptionResult.iv,
    authTag: encryptionResult.authTag,
    expiryTime: expiresAt,
  });

  const record = await insertFileRecord({
    id: fileId,
    ownerId: owner.id,
    ownerName: owner.name,
    uploaderEmail: owner.email,
    title: title?.trim() || originalName,
    description: description?.trim() || "",
    originalName,
    mimeType,
    size: sourceSize,
    encryptedSize: encryptionResult.encryptedSize,
    storagePath,
    digest: encryptionResult.digest,
    signature: encryptionResult.signature,
    status: "active",
    uploadMode,
    views: 0,
    shareToken: nanoid(24),
    createdAt: new Date().toISOString(),
    destroyedAt: null,
    deletionRequestedAt: null,
    destructionReason: null,
    lastAccessedAt: null,
    rules: {
      expiresAt,
      maxViews: parseRuleNumber(maxViews),
    },
    dataFlow: {
      uploaderId: owner.id,
      uploaderEmail: owner.email,
      lastAccessor: null,
      accessHistory: [],
    },
  });

  await recordUploadUsage(owner, record.size);

  await appendFileActivity({
    fileId,
    user: owner,
    actor: owner.email,
    action: "upload",
    message: `File uploaded through ${uploadMode} mode and sealed with hybrid encryption.`,
    source: uploadMode,
    ipAddress,
    metadata: {
      hybridEncryption: true,
      encryptedSize: encryptionResult.encryptedSize,
    },
  });

  return decorateFile(record);
}

export async function createVaultFileFromTempPath({
  tempPath,
  originalName,
  mimeType,
  title,
  description,
  expiresInMinutes,
  maxViews,
  owner,
  ipAddress,
}) {
  try {
    return await finalizeEncryptedRecord({
      sourcePath: tempPath,
      originalName,
      mimeType,
      title,
      description,
      expiresInMinutes,
      maxViews,
      owner,
      ipAddress,
      uploadMode: "direct-upload",
    });
  } finally {
    await fs.rm(tempPath, { force: true });
  }
}

export async function createVaultFileFromUploadSession({
  session,
  chunkPaths,
  owner,
  ipAddress,
}) {
  const file = await finalizeEncryptedRecord({
    chunkPaths,
    originalName: session.fileName,
    mimeType: session.mimeType,
    title: session.title,
    description: session.description,
    expiresInMinutes: session.expiresInMinutes,
    maxViews: session.maxViews,
    owner,
    ipAddress,
    uploadMode: "chunked-upload",
  });

  return file;
}

export async function getUserFiles(ownerId) {
  const files = await listFilesByOwner(ownerId);
  return Promise.all(files.map(async (file) => decorateFile((await enforceLifecycle(file)).file)));
}

export async function getDashboard(user) {
  const files = await getUserFiles(user.id);
  const usage = await getUsageRecordForUser(user);
  const plan = getPlanForUser(user);
  const auditLogs = await listAuditLogsForUser(user.id);
  const recentLogs = [];

  for (const file of files.slice(0, 4)) {
    const fileLogs = await listLogsByFileId(file.id);
    recentLogs.push(...fileLogs.slice(0, 3));
  }

  recentLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const compliance = {
    totalFiles: files.length,
    activeFiles: files.filter((file) => file.status === "active").length,
    destroyedFiles: files.filter((file) => file.status === "destroyed").length,
    deletedFiles: files.filter((file) => file.status === "deleted").length,
    expiredFiles: files.filter((file) => file.expired).length,
    auditLogsCount: await countAuditLogsForUser(user.id),
    badge: "GDPR Ready",
  };

  return {
    stats: {
      totalFiles: files.length,
      activeFiles: compliance.activeFiles,
      destroyedFiles: compliance.destroyedFiles,
      totalViews: files.reduce((sum, file) => sum + Number(file.views || 0), 0),
    },
    recentLogs: recentLogs.slice(0, 8),
    recentAuditLogs: auditLogs.slice(0, 8),
    usage: {
      ...usage,
      quotaBytes: plan.monthlyUsageBytes,
      quotaGb: plan.monthlyUsageBytes ? toRoundedGb(plan.monthlyUsageBytes) : null,
      remainingBytes: plan.monthlyUsageBytes
        ? Math.max(plan.monthlyUsageBytes - usage.totalUploadedBytes, 0)
        : null,
      remainingGb: plan.monthlyUsageBytes
        ? toRoundedGb(Math.max(plan.monthlyUsageBytes - usage.totalUploadedBytes, 0))
        : null,
    },
    plan: summarizePlan(plan),
    billing: {
      monthlyUsageGB: usage.monthlyUsageGB,
      extraUsageGB: usage.extraUsageGB,
      estimatedBill: usage.estimatedBill,
      currency: "INR",
    },
    compliance,
    planCatalog: getAvailablePlans(),
  };
}

export async function getLogsForOwner(fileId, ownerId) {
  const file = await findFileById(fileId);

  if (!file || file.ownerId !== ownerId) {
    return null;
  }

  return listLogsByFileId(fileId);
}

export async function issueOwnerAccess(fileId, owner, ipAddress) {
  const file = await findFileById(fileId);

  if (!file || (file.ownerId !== owner.id && owner.role !== "admin")) {
    return { error: "not_found" };
  }

  const lifecycle = await enforceLifecycle(file, { user: owner, ipAddress });

  if (lifecycle.blockedReason) {
    return { error: lifecycle.blockedReason, file: decorateFile(lifecycle.file) };
  }

  const token = signFileAccessToken({
    fileId,
    actor: owner.email,
    actorName: owner.name,
    userId: owner.id,
    mode: "owner",
  });

  await appendFileActivity({
    fileId,
    user: owner,
    actor: owner.email,
    action: "access_granted",
    message: "Temporary secure viewer token issued.",
    source: "owner",
    ipAddress,
  });

  return {
    token,
    file: decorateFile(lifecycle.file),
  };
}

export async function issueSharedAccess(shareToken, visitorName, ipAddress) {
  const file = await findFileByShareToken(shareToken);

  if (!file) {
    return { error: "not_found" };
  }

  const lifecycle = await enforceLifecycle(file, { ipAddress });

  if (lifecycle.blockedReason) {
    return { error: lifecycle.blockedReason, file: decorateFile(lifecycle.file) };
  }

  const actorName = visitorName?.trim() || "Anonymous viewer";
  const token = signFileAccessToken({
    fileId: file.id,
    actor: actorName,
    actorName,
    mode: "shared",
    shareToken,
  });

  await appendFileActivity({
    fileId: file.id,
    user: null,
    actor: actorName,
    action: "shared_access_granted",
    message: "Temporary shared viewer token issued.",
    source: "shared-link",
    ipAddress,
  });

  return {
    token,
    file: decorateFile(lifecycle.file),
  };
}

export async function getSharedFileMetadata(shareToken) {
  const file = await findFileByShareToken(shareToken);

  if (!file) {
    return null;
  }

  const lifecycle = await enforceLifecycle(file);
  return decorateFile(lifecycle.file);
}

export async function streamFileContentToResponse(accessToken, res, ipAddress) {
  const payload = verifyFileAccessToken(accessToken);
  const file = await findFileById(payload.fileId);
  const lifecycle = await enforceLifecycle(file, { ipAddress });

  if (!lifecycle.file || lifecycle.blockedReason) {
    throw new Error("File can no longer be accessed because its key has been destroyed.");
  }

  const signatureValid = await verifyEncryptedSignature({
    storagePath: lifecycle.file.storagePath,
    digest: lifecycle.file.digest,
    signature: lifecycle.file.signature,
  });

  if (!signatureValid) {
    await appendFileActivity({
      fileId: lifecycle.file.id,
      user: payload.userId ? { id: payload.userId } : null,
      actor: payload.actor,
      action: "tamper_detected",
      message: "Digital signature verification failed during secure viewing.",
      source: "integrity-check",
      ipAddress,
    });
    throw new Error("Integrity verification failed.");
  }

  const keyMaterial = await getKeyMaterial(lifecycle.file.id);

  if (!keyMaterial) {
    throw new Error("The encryption key no longer exists for this file.");
  }

  const nextViews = Number(lifecycle.file.views || 0) + 1;
  const updated = await updateFileRecord(lifecycle.file.id, {
    views: nextViews,
    lastAccessedAt: new Date().toISOString(),
    dataFlow: {
      ...(lifecycle.file.dataFlow || {}),
      lastAccessor: payload.actor,
      accessHistory: [
        ...((lifecycle.file.dataFlow?.accessHistory || []).slice(-24)),
        {
          actor: payload.actor,
          mode: payload.mode,
          accessedAt: new Date().toISOString(),
        },
      ],
    },
  });

  await appendFileActivity({
    fileId: lifecycle.file.id,
    user: payload.userId ? { id: payload.userId } : null,
    actor: payload.actor,
    action: "access",
    message: `${payload.actorName || payload.actor} opened the secure viewer.`,
    source: payload.mode,
    ipAddress,
  });

  res.setHeader("Content-Type", updated.mimeType);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Disposition", `inline; filename="${updated.originalName}"`);

  // AES decryption stream happens here after the AES key is recovered from RSA-protected KMS storage.
  await streamDecryptedFileToWritable({
    encryptedPath: updated.storagePath,
    aesKey: keyMaterial.aesKey,
    iv: keyMaterial.iv,
    authTag: keyMaterial.authTag,
    writable: res,
  });

  if (updated.rules?.maxViews && nextViews >= Number(updated.rules.maxViews)) {
    await destroyFileAccess(updated.id, "max_views_reached", payload.actor, {
      ipAddress,
      source: "rule-engine",
      user: payload.userId ? { id: payload.userId } : null,
    });
  }

  return decorateFile(updated);
}

export async function destroyFileByOwner(fileId, owner, ipAddress) {
  const file = await findFileById(fileId);

  if (!file || (file.ownerId !== owner.id && owner.role !== "admin")) {
    return null;
  }

  const destroyed = await destroyFileAccess(fileId, "manual_trigger", owner.email, {
    user: owner,
    ipAddress,
    source: "manual",
  });
  return decorateFile(destroyed);
}

export async function deleteFileForOwner(fileId, owner, ipAddress) {
  const file = await findFileById(fileId);

  if (!file || (file.ownerId !== owner.id && owner.role !== "admin")) {
    return null;
  }

  const destroyed = await destroyFileAccess(fileId, "user_deleted", owner.email, {
    user: owner,
    ipAddress,
    source: "gdpr-delete",
  });
  return decorateFile(destroyed);
}

export async function patchFileExpiry(fileId, owner, { expiresAt, expiresInMinutes }, ipAddress) {
  const file = await findFileById(fileId);

  if (!file || (file.ownerId !== owner.id && owner.role !== "admin")) {
    return null;
  }

  const nextExpiry = resolveExpiry({ expiresAt, expiresInMinutes });
  const updated = await updateFileRecord(fileId, {
    rules: {
      ...(file.rules || {}),
      expiresAt: nextExpiry,
    },
  });

  await appendFileActivity({
    fileId,
    user: owner,
    actor: owner.email,
    action: "expiry_updated",
    message: `Retention expiry updated to ${nextExpiry || "none"}.`,
    source: "gdpr-retention",
    ipAddress,
  });

  return decorateFile(updated);
}

export async function simulateBreach(user, fileId) {
  const files = await getUserFiles(user.id);
  const target =
    files.find((file) => file.id === fileId) ||
    files.find((file) => file.status === "destroyed") ||
    files[0];

  if (!target) {
    return null;
  }

  const rawFile = await findFileById(target.id);
  const kmsStatus = await getKmsStatus(target.id);
  const preview = await getEncryptedObjectPreview(rawFile.storagePath);

  return {
    file: decorateFile(rawFile),
    encryptedPreview: preview,
    kmsDestroyed: Boolean(kmsStatus?.destroyedAt),
    message: kmsStatus?.destroyedAt
      ? "Data सुरक्षित है — key destroyed"
      : "Encrypted payload intercepted, but the AES key remains isolated inside KMS.",
  };
}

export async function runRetentionSweep() {
  const files = await listAllFiles();

  await Promise.all(
    files.map(async (file) => {
      await enforceLifecycle(file, { source: "retention-policy" });
    }),
  );
}
