import crypto from "node:crypto";

export function digestBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function generateAesKey() {
  return crypto.randomBytes(32);
}

export function encryptBuffer(buffer, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return { encrypted, iv, authTag };
}

export function decryptBuffer(encrypted, key, iv, authTag) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function signDigest(digest, privateKey) {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(digest);
  signer.end();
  return signer.sign(privateKey, "base64");
}

export function verifyDigestSignature(digest, signature, publicKey) {
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(digest);
  verifier.end();
  return verifier.verify(publicKey, signature, "base64");
}

