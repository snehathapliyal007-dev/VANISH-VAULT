import express from "express";
import {
  requestSharedAccessController,
  sharedContent,
  sharedMetadata,
} from "../controllers/sharedController.js";

const router = express.Router();

router.get("/:shareToken", sharedMetadata);
router.post("/:shareToken/request-access", requestSharedAccessController);
router.get("/:shareToken/content", sharedContent);

export default router;

