import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.plan,
      scope: "app",
    },
    config.jwtSecret,
    { expiresIn: config.jwtAccessExpiresIn },
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export function signFileAccessToken(payload) {
  return jwt.sign(
    {
      ...payload,
      scope: "file-access",
    },
    config.jwtSecret,
    { expiresIn: config.fileAccessExpiresIn },
  );
}

export function verifyFileAccessToken(token) {
  return jwt.verify(token, config.jwtSecret);
}
