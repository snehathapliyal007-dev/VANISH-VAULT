import { nanoid } from "nanoid";
import { addAuditLog, listAuditLogsByFileId, listAuditLogsByUserId } from "./db.js";

export async function appendAuditLog({
  userId,
  fileId = null,
  action,
  ipAddress,
  details,
  metadata = {},
}) {
  return addAuditLog({
    id: nanoid(),
    userId,
    fileId,
    action,
    timestamp: new Date().toISOString(),
    ipAddress: ipAddress || "unknown",
    details,
    metadata,
  });
}

export async function listAuditLogsForUser(userId) {
  return listAuditLogsByUserId(userId);
}

export async function listAuditLogsForFile(fileId) {
  return listAuditLogsByFileId(fileId);
}
