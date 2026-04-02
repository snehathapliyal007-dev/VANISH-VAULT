import { verifyAuthToken } from "../utils/tokens.js";
import { findUserById } from "../services/db.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const token = header.slice("Bearer ".length);
    const decoded = verifyAuthToken(token);
    const user = await findUserById(decoded.sub);

    if (!user) {
      return res.status(401).json({ message: "Session is no longer valid." });
    }

    req.user = user;
    req.auth = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}
