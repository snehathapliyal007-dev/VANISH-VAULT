import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { createUser, findUserByEmail } from "../services/db.js";
import { signAuthToken } from "../utils/tokens.js";

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    plan: user.plan,
    createdAt: user.createdAt,
  };
}

export async function signup(req, res) {
  const { name, email, password, role, plan } = req.body;

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return res.status(400).json({ message: "Name, email, and password are required." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await findUserByEmail(normalizedEmail);

  if (existingUser) {
    return res.status(409).json({ message: "A user with that email already exists." });
  }

  const safeRole = role === "viewer" ? "viewer" : "uploader";
  const safePlan = ["FREE", "PRO", "ENTERPRISE"].includes(String(plan).toUpperCase())
    ? String(plan).toUpperCase()
    : "FREE";

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUser({
    id: nanoid(),
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    role: safeRole,
    plan: safePlan,
    customMonthlyQuotaBytes: null,
    createdAt: new Date().toISOString(),
  });

  const token = signAuthToken(user);

  return res.status(201).json({
    token,
    user: sanitizeUser(user),
  });
}

export async function login(req, res) {
  const { email, password } = req.body;

  if (!email?.trim() || !password?.trim()) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  const user = await findUserByEmail(email.toLowerCase().trim());

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  const matches = await bcrypt.compare(password, user.passwordHash);

  if (!matches) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  const token = signAuthToken(user);

  return res.json({
    token,
    user: sanitizeUser(user),
  });
}

export async function me(req, res) {
  return res.json({
    user: sanitizeUser(req.user),
  });
}

