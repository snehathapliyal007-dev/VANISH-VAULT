import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { nanoid } from "nanoid";
import { config } from "../config.js";
import { createUploadSessionRecord } from "../models/uploadSessionModel.js";
import {
  createUploadSession,
  deleteUploadSession,
  findUploadSessionById,
  listUploadSessions,
  updateUploadSession,
} from "./db.js";
import { createTempUploadDirectory, removeTempUploadDirectory } from "./storage.js";

function getChunkPath(uploadDir, chunkIndex) {
  return path.join(uploadDir, "chunks", `${chunkIndex}.part`);
}

export async function initializeUploadService() {
  await fs.mkdir(config.tempUploadDir, { recursive: true });
  await fs.mkdir(config.chunkUploadDir, { recursive: true });
}

export function generatePresignedUrls(uploadId, totalChunks) {
  return Array.from({ length: totalChunks }, (_, chunkIndex) => ({
    chunkIndex,
    method: "POST",
    url: `/api/files/upload-chunk/${uploadId}/${chunkIndex}`,
  }));
}

export async function startUploadSession({
  user,
  title,
  description,
  fileName,
  mimeType,
  totalSize,
  totalChunks,
  expiresInMinutes,
  maxViews,
}) {
  const uploadId = nanoid(14);
  const tempDir = await createTempUploadDirectory(uploadId);
  const session = createUploadSessionRecord({
    id: uploadId,
    user,
    title,
    description,
    fileName,
    mimeType,
    totalSize: Number(totalSize),
    totalChunks: Number(totalChunks),
    expiresInMinutes,
    maxViews,
    tempDir,
  });

  await createUploadSession(session);

  return {
    uploadId,
    session,
    presignedUrls: generatePresignedUrls(uploadId, Number(totalChunks)),
  };
}

export async function getUploadSession(uploadId) {
  return findUploadSessionById(uploadId);
}

export async function storeChunkStream({ uploadId, chunkIndex, stream }) {
  const session = await findUploadSessionById(uploadId);

  if (!session) {
    throw new Error("Upload session not found.");
  }

  const numericChunkIndex = Number(chunkIndex);

  if (!Number.isInteger(numericChunkIndex) || numericChunkIndex < 0 || numericChunkIndex >= session.totalChunks) {
    throw new Error("Invalid chunk index.");
  }

  const chunkPath = getChunkPath(session.tempDir, numericChunkIndex);
  let previousSize = 0;

  try {
    previousSize = (await fs.stat(chunkPath)).size;
  } catch {
    previousSize = 0;
  }

  await pipeline(stream, createWriteStream(chunkPath));
  const stats = await fs.stat(chunkPath);

  const nextChunks = Array.from(new Set([...(session.receivedChunks || []), numericChunkIndex])).sort(
    (a, b) => a - b,
  );

  const updated = await updateUploadSession(uploadId, {
    receivedChunks: nextChunks,
    receivedBytes: Math.max(0, Number(session.receivedBytes || 0) - previousSize + stats.size),
    updatedAt: new Date().toISOString(),
    status: nextChunks.length === session.totalChunks ? "uploaded" : "receiving",
  });

  return {
    session: updated,
    chunkPath,
    chunkSize: stats.size,
  };
}

export async function getSessionChunkPaths(uploadId) {
  const session = await findUploadSessionById(uploadId);

  if (!session) {
    throw new Error("Upload session not found.");
  }

  const chunkPaths = [];

  for (let chunkIndex = 0; chunkIndex < session.totalChunks; chunkIndex += 1) {
    const chunkPath = getChunkPath(session.tempDir, chunkIndex);

    try {
      await fs.access(chunkPath);
      chunkPaths.push(chunkPath);
    } catch {
      throw new Error(`Missing chunk ${chunkIndex}. Resume upload before completing.`);
    }
  }

  return {
    session,
    chunkPaths,
  };
}

export async function markUploadSessionCompleted(uploadId, fileId) {
  return updateUploadSession(uploadId, {
    status: "completed",
    fileId,
    updatedAt: new Date().toISOString(),
  });
}

export async function removeUploadSession(uploadId) {
  const session = await findUploadSessionById(uploadId);

  if (session?.tempDir) {
    await removeTempUploadDirectory(session.tempDir);
  }

  await deleteUploadSession(uploadId);
}

export async function cleanupExpiredUploadSessions() {
  const sessions = await listUploadSessions();
  const now = Date.now();

  for (const session of sessions) {
    if (now - new Date(session.updatedAt || session.createdAt).getTime() > config.uploadSessionTtlMs) {
      await removeUploadSession(session.id);
    }
  }
}
