import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import crypto from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Transform, Readable } from "node:stream";
import { getPrivateKey, getPublicKey } from "./kms.js";

function createDigestTap(hash) {
  return new Transform({
    transform(chunk, encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  });
}

async function* chunkFileGenerator(sourcePaths) {
  for (const sourcePath of sourcePaths) {
    const stream = createReadStream(sourcePath);
    for await (const chunk of stream) {
      yield chunk;
    }
  }
}

export function signDigest(digest) {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(digest);
  signer.end();
  return signer.sign(getPrivateKey(), "base64");
}

export async function verifyEncryptedSignature({ storagePath, digest, signature }) {
  const verifier = crypto.createVerify("RSA-SHA256");
  const computedDigest = await calculateFileDigest(storagePath);
  verifier.update(computedDigest);
  verifier.end();

  return (
    computedDigest === digest && verifier.verify(getPublicKey(), signature, "base64")
  );
}

export async function calculateFileDigest(storagePath) {
  const hash = crypto.createHash("sha256");
  const tap = createDigestTap(hash);
  const sink = new Transform({
    transform(chunk, encoding, callback) {
      callback();
    },
  });

  await pipeline(createReadStream(storagePath), tap, sink);
  return hash.digest("hex");
}

async function encryptReadableToPath(sourceReadable, targetPath) {
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  const encryptedHash = crypto.createHash("sha256");
  const digestTap = createDigestTap(encryptedHash);

  // AES streaming encryption happens here so large files never sit fully in memory.
  await pipeline(sourceReadable, cipher, digestTap, createWriteStream(targetPath));

  const authTag = cipher.getAuthTag();
  const digest = encryptedHash.digest("hex");
  const signature = signDigest(digest);
  const encryptedSize = (await fs.stat(targetPath)).size;

  return {
    aesKey,
    iv,
    authTag,
    digest,
    signature,
    encryptedSize,
  };
}

export async function encryptFileFromPath({ sourcePath, targetPath }) {
  return encryptReadableToPath(createReadStream(sourcePath), targetPath);
}

export async function encryptFromChunkPaths({ sourcePaths, targetPath }) {
  return encryptReadableToPath(Readable.from(chunkFileGenerator(sourcePaths)), targetPath);
}

export async function streamDecryptedFileToWritable({
  encryptedPath,
  aesKey,
  iv,
  authTag,
  writable,
}) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey, iv);
  decipher.setAuthTag(authTag);
  await pipeline(createReadStream(encryptedPath), decipher, writable);
}

