import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { config } from "../config.js";

export async function initializeObjectStore() {
  await Promise.all([
    fs.mkdir(config.objectStoreDir, { recursive: true }),
    fs.mkdir(config.tempUploadDir, { recursive: true }),
    fs.mkdir(config.chunkUploadDir, { recursive: true }),
  ]);
}

export function getEncryptedObjectPath(fileId) {
  return path.join(config.objectStoreDir, `${fileId}.vault`);
}

export async function createTempUploadDirectory(uploadId) {
  const uploadDir = path.join(config.chunkUploadDir, uploadId);
  const chunksDir = path.join(uploadDir, "chunks");
  await fs.mkdir(chunksDir, { recursive: true });
  return uploadDir;
}

export async function removeTempUploadDirectory(uploadDir) {
  await fs.rm(uploadDir, { recursive: true, force: true });
}

export async function storeEncryptedObject(fileId, encryptedBuffer) {
  await initializeObjectStore();
  const objectPath = getEncryptedObjectPath(fileId);
  await fs.writeFile(objectPath, encryptedBuffer);
  return objectPath;
}

export function createEncryptedReadStream(storagePath) {
  return createReadStream(storagePath);
}

export async function readEncryptedObject(storagePath) {
  return fs.readFile(storagePath);
}

export async function getEncryptedObjectPreview(storagePath, bytes = 96) {
  const handle = await fs.open(storagePath, "r");

  try {
    const buffer = Buffer.alloc(bytes);
    const result = await handle.read(buffer, 0, bytes, 0);
    return buffer.subarray(0, result.bytesRead).toString("hex");
  } finally {
    await handle.close();
  }
}

