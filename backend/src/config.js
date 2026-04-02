import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

export const config = {
  port: Number(process.env.PORT || 8080),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET || "vanish-vault-demo-secret",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "7d",
  fileAccessExpiresIn: process.env.FILE_ACCESS_EXPIRES_IN || "90s",
  ruleSweepMs: Number(process.env.RULE_SWEEP_MS || 15000),
  usageResetDays: Number(process.env.USAGE_RESET_DAYS || 30),
  uploadSessionTtlMs: Number(process.env.UPLOAD_SESSION_TTL_MS || 24 * 60 * 60 * 1000),
  requestWindowMs: Number(process.env.REQUEST_WINDOW_MS || 60 * 1000),
  requestLimitPerWindow: Number(process.env.REQUEST_LIMIT_PER_WINDOW || 240),
  dataDir: path.join(rootDir, "data"),
  dbPath: path.join(rootDir, "data", "db.json"),
  kmsPath: path.join(rootDir, "data", "kms.json"),
  rsaPrivateKeyPath:
    process.env.RSA_PRIVATE_KEY_PATH || path.join(rootDir, "data", "rsa-private.pem"),
  rsaPublicKeyPath:
    process.env.RSA_PUBLIC_KEY_PATH || path.join(rootDir, "data", "rsa-public.pem"),
  rsaPrivateKey: process.env.RSA_PRIVATE_KEY?.replace(/\\n/g, "\n") || null,
  rsaPublicKey: process.env.RSA_PUBLIC_KEY?.replace(/\\n/g, "\n") || null,
  objectStoreDir: path.join(rootDir, "data", "objects"),
  tempUploadDir: path.join(rootDir, "data", "temp-uploads"),
  chunkUploadDir: path.join(rootDir, "data", "chunk-sessions"),
};
