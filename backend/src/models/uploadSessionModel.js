export function createUploadSessionRecord({
  id,
  user,
  title,
  description,
  fileName,
  mimeType,
  totalSize,
  totalChunks,
  expiresInMinutes,
  maxViews,
  storageMode = "local",
  tempDir,
}) {
  const now = new Date().toISOString();

  return {
    id,
    userId: user.id,
    ownerId: user.id,
    ownerName: user.name,
    fileName,
    mimeType,
    totalSize,
    totalChunks,
    receivedChunks: [],
    receivedBytes: 0,
    title: title?.trim() || fileName,
    description: description?.trim() || "",
    expiresInMinutes: expiresInMinutes ? Number(expiresInMinutes) : null,
    maxViews: maxViews ? Number(maxViews) : null,
    status: "initiated",
    storageMode,
    tempDir,
    createdAt: now,
    updatedAt: now,
  };
}

