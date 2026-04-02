import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import fileRoutes from "./routes/files.js";
import sharedRoutes from "./routes/shared.js";
import accountRoutes from "./routes/account.js";
import { config } from "./config.js";
import { initializeDb } from "./services/db.js";
import { initializeKms } from "./services/kms.js";
import { initializeObjectStore } from "./services/storage.js";
import { runRuleSweep, startRuleEngine } from "./services/ruleEngine.js";
import { initializeUploadService } from "./services/uploadService.js";
import { rateLimit } from "./middleware/throttle.js";

const app = express();

app.set("trust proxy", true);
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: false,
  }),
);
app.use(rateLimit());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "vanish-vault-api",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/shared", sharedRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  return res.status(500).json({
    message: "Unexpected server error.",
  });
});

async function startServer() {
  await initializeDb();
  await initializeKms();
  await initializeObjectStore();
  await initializeUploadService();
  await runRuleSweep();
  startRuleEngine();

  app.listen(config.port, () => {
    console.log(`Vanish Vault API running on http://localhost:${config.port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start Vanish Vault API:", error);
  process.exitCode = 1;
});
