import express from "express";
import { getAccountOverview, updatePlan } from "../controllers/accountController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);
router.get("/overview", getAccountOverview);
router.patch("/plan", updatePlan);

export default router;
