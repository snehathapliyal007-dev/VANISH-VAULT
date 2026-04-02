import fs from "node:fs/promises";
import crypto from "node:crypto";
import { config } from "../config.js";

const initialKmsDb = {
  records: [],
};

let cachedPrivateKey = null;
let cachedPublicKey = null;
let writeQueue = Promise.resolve();

async function ensureKmsStorage() {
  await fs.mkdir(config.dataDir, { recursive: true });

  try {
    await fs.access(config.kmsPath);
  } catch {
    await fs.writeFile(config.kmsPath, JSON.stringify(initialKmsDb, null, 2));
  }

  if (config.rsaPrivateKey && config.rsaPublicKey) {
    cachedPrivateKey = config.rsaPrivateKey;
    cachedPublicKey = config.rsaPublicKey;
    return;
  }

  try {
    await fs.access(config.rsaPrivateKeyPath);
    await fs.access(config.rsaPublicKeyPath);
  } catch {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    await fs.writeFile(config.rsaPrivateKeyPath, privateKey);
    await fs.writeFile(config.rsaPublicKeyPath, publicKey);
  }
}

async function readKmsDb() {
  await ensureKmsStorage();
  const raw = await fs.readFile(config.kmsPath, "utf8");
  return JSON.parse(raw);
}

async function writeKmsDb(db) {
  await fs.writeFile(config.kmsPath, JSON.stringify(db, null, 2));
}

async function mutateKms(mutator) {
  writeQueue = writeQueue.then(async () => {
    const db = await readKmsDb();
    const result = await mutator(db);
    await writeKmsDb(db);
    return result;
  });

  return writeQueue;
}

export async function initializeKms() {
  await ensureKmsStorage();

  if (!cachedPrivateKey || !cachedPublicKey) {
    cachedPrivateKey = await fs.readFile(config.rsaPrivateKeyPath, "utf8");
    cachedPublicKey = await fs.readFile(config.rsaPublicKeyPath, "utf8");
  }
}

export function getPublicKey() {
  return cachedPublicKey;
}

export function getPrivateKey() {
  return cachedPrivateKey;
}

export async function storeWrappedKey({ fileId, aesKey, iv, authTag, expiryTime }) {
  // RSA wrapping happens here: the file's AES key is encrypted with the RSA public key.
  const encryptedKey = crypto.publicEncrypt(
    {
      key: cachedPublicKey,
      oaepHash: "sha256",
    },
    aesKey,
  );

  return mutateKms(async (db) => {
    db.records = db.records.filter((entry) => entry.fileId !== fileId);
    db.records.push({
      fileId,
      encryptedAESKey: encryptedKey.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      createdAt: new Date().toISOString(),
      expiryTime: expiryTime || null,
      destroyedAt: null,
      destructionReason: null,
    });
    return true;
  });
}

export async function getKeyMaterial(fileId) {
  const db = await readKmsDb();
  const record = db.records.find((entry) => entry.fileId === fileId);

  if (!record || !record.encryptedAESKey || record.destroyedAt) {
    return null;
  }

  // RSA unwrapping happens here during download/view access.
  const aesKey = crypto.privateDecrypt(
    {
      key: cachedPrivateKey,
      oaepHash: "sha256",
    },
    Buffer.from(record.encryptedAESKey, "base64"),
  );

  return {
    aesKey,
    iv: Buffer.from(record.iv, "base64"),
    authTag: Buffer.from(record.authTag, "base64"),
    expiryTime: record.expiryTime,
  };
}

export async function destroyWrappedKey(fileId, reason) {
  return mutateKms(async (db) => {
    const record = db.records.find((entry) => entry.fileId === fileId);

    if (!record) {
      return null;
    }

    record.encryptedAESKey = null;
    record.iv = null;
    record.authTag = null;
    record.destroyedAt = new Date().toISOString();
    record.destructionReason = reason;
    return record;
  });
}

export async function getKmsStatus(fileId) {
  const db = await readKmsDb();
  return db.records.find((entry) => entry.fileId === fileId) || null;
}

