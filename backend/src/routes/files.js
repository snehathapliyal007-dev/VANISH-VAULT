import express from "express";
import {
  breachSimulation,
  completeChunkUpload,
  content,
  dashboard,
  deleteFile,
  destroyFile,
  directUpload,
  fileLogs,
  getUploadStatus,
  listFiles,
  myFiles,
  requestAccess,
  startChunkUpload,
  updateExpiry,
  uploadChunk,
  uploadFile,
} from "../controllers/fileController.js";
import { requireAuth } from "../middleware/auth.js";
import { checkPlanLimits } from "../middleware/planLimits.js";
import { requireRole } from "../middleware/rbac.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", listFiles);
router.get("/my-files", myFiles);
router.get("/dashboard", dashboard);
router.get("/simulate-breach", breachSimulation);

router.post(
  "/upload",
  requireRole(["admin", "uploader"]),
  directUpload.single("file"),
  checkPlanLimits,
  uploadFile,
);

router.post(
  "/start-upload",
  requireRole(["admin", "uploader"]),
  checkPlanLimits,
  startChunkUpload,
);
router.get("/upload-status/:uploadId", getUploadStatus);
router.post("/upload-chunk/:uploadId/:chunkIndex", requireRole(["admin", "uploader"]), uploadChunk);
router.post(
  "/complete-upload/:uploadId",
  requireRole(["admin", "uploader"]),
  completeChunkUpload,
);

router.post("/:id/request-access", requestAccess);
router.get("/:id/logs", fileLogs);
router.post("/:id/destroy", destroyFile);
router.delete("/:id", deleteFile);
router.patch("/:id/expiry", updateExpiry);
router.get("/content/:id", content);

export default router;

