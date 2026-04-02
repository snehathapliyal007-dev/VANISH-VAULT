import { updateUser } from "../services/db.js";
import { getDashboard } from "../services/vaultService.js";

export async function getAccountOverview(req, res) {
  const dashboard = await getDashboard(req.user);
  return res.json(dashboard);
}

export async function updatePlan(req, res) {
  const requestedPlan = String(req.body?.plan || "").toUpperCase();

  if (!["FREE", "PRO", "ENTERPRISE"].includes(requestedPlan)) {
    return res.status(400).json({ message: "Choose a valid plan." });
  }

  const updated = await updateUser(req.user.id, {
    plan: requestedPlan,
  });

  return res.json({
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      plan: updated.plan,
    },
  });
}

