import multer from "multer";
import {
  createVaultFileFromTempPath,
  createVaultFileFromUploadSession,
  deleteFileForOwner,
  destroyFileByOwner,
  getDashboard,
  getLogsForOwner,
  getUserFiles,
  issueOwnerAccess,
  patchFileExpiry,
  simulateBreach,
  streamFileContentToResponse,
} from "../services/vaultService.js";
import {
  generatePresignedUrls,
  getSessionChunkPaths,
  getUploadSession,
  markUploadSessionCompleted,
  removeUploadSession,
  startUploadSession,
  storeChunkStream,
} from "../services/uploadService.js";
import { config } from "../config.js";

export const directUpload = multer({
  dest: config.tempUploadDir,
});

export async function listFiles(req, res) {
  const files = await getUserFiles(req.user.id);
  return res.json({ files });
}

export async function myFiles(req, res) {
  const files = await getUserFiles(req.user.id);
  return res.json({ files });
}

export async function dashboard(req, res) {
  const payload = await getDashboard(req.user);
  return res.json(payload);
}

export async function uploadFile(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: "Please choose a file to upload." });
  }

  const file = await createVaultFileFromTempPath({
    tempPath: req.file.path,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype || "application/octet-stream",
    title: req.body.title,
    description: req.body.description,
    expiresInMinutes: req.body.expiresInMinutes,
    maxViews: req.body.maxViews,
    owner: req.user,
    ipAddress: req.ip,
  });

  return res.status(201).json({ file });
}

export async function startChunkUpload(req, res) {
  const { title, description, fileName, mimeType, totalSize, totalChunks, expiresInMinutes, maxViews } = req.body;

  if (!fileName || !mimeType || !Number(totalSize) || !Number(totalChunks)) {
    return res.status(400).json({ message: "Chunk upload metadata is incomplete." });
  }

  const started = await startUploadSession({
    user: req.user,
    title,
    description,
    fileName,
    mimeType,
    totalSize,
    totalChunks,
    expiresInMinutes,
    maxViews,
  });

  return res.status(201).json({
    uploadId: started.uploadId,
    presignedUrls: started.presignedUrls,
    session: started.session,
  });
}

export async function uploadChunk(req, res) {
  const { uploadId, chunkIndex } = req.params;
  const result = await storeChunkStream({
    uploadId,
    chunkIndex,
    stream: req,
  });

  return res.json({
    uploadId,
    chunkIndex: Number(chunkIndex),
    receivedChunks: result.session.receivedChunks,
    totalChunks: result.session.totalChunks,
  });
}

export async function getUploadStatus(req, res) {
  const session = await getUploadSession(req.params.uploadId);

  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ message: "Upload session not found." });
  }

  return res.json({
    session,
    presignedUrls: generatePresignedUrls(session.id, session.totalChunks),
  });
}

export async function completeChunkUpload(req, res) {
  const session = await getUploadSession(req.params.uploadId);

  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ message: "Upload session not found." });
  }

  const { chunkPaths } = await getSessionChunkPaths(session.id);
  const file = await createVaultFileFromUploadSession({
    session,
    chunkPaths,
    owner: req.user,
    ipAddress: req.ip,
  });

  await markUploadSessionCompleted(session.id, file.id);
  await removeUploadSession(session.id);

  return res.status(201).json({ file });
}

export async function requestAccess(req, res) {
  const result = await issueOwnerAccess(req.params.id, req.user, req.ip);

  if (result.error) {
    if (result.error === "not_found") {
      return res.status(404).json({ message: "File not found." });
    }

    return res.status(410).json({
      message: "Access is no longer available because the key has been destroyed.",
      file: result.file,
    });
  }

  return res.json(result);
}

export async function fileLogs(req, res) {
  const logs = await getLogsForOwner(req.params.id, req.user.id);

  if (!logs) {
    return res.status(404).json({ message: "File not found." });
  }

  return res.json({ logs });
}

export async function destroyFile(req, res) {
  const file = await destroyFileByOwner(req.params.id, req.user, req.ip);

  if (!file) {
    return res.status(404).json({ message: "File not found." });
  }

  return res.json({ file });
}

export async function deleteFile(req, res) {
  const file = await deleteFileForOwner(req.params.id, req.user, req.ip);

  if (!file) {
    return res.status(404).json({ message: "File not found." });
  }

  return res.json({ file });
}

export async function updateExpiry(req, res) {
  const file = await patchFileExpiry(req.params.id, req.user, req.body, req.ip);

  if (!file) {
    return res.status(404).json({ message: "File not found." });
  }

  return res.json({ file });
}

export async function content(req, res) {
  const accessToken = req.query.accessToken;

  if (!accessToken) {
    return res.status(400).json({ message: "Missing secure access token." });
  }

  try {
    await streamFileContentToResponse(accessToken, res, req.ip);
    return undefined;
  } catch (error) {
    return res.status(410).json({ message: error.message });
  }
}

export async function breachSimulation(req, res) {
  const simulation = await simulateBreach(req.user, req.query.fileId);

  if (!simulation) {
    return res.status(404).json({ message: "No files available for breach simulation." });
  }

  return res.json(simulation);
}
